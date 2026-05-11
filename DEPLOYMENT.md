# Wave — Deployment guide

This guide covers three supported topologies, ordered by ramp-up effort:

1. **Single-host Docker Compose** — fastest path; one VM running web + bot + mongo + one local streaming instance.
2. **Bare-metal systemd + nginx** — same single-host but without containers, useful if you already have a reverse proxy or want fine-grained logging.
3. **Multi-host: master + N streaming workers** — production layout. Master (web + bot + mongo) on one node, dedicated `wave-instance` workers on the others.

Each section ends with the env-vars + verification steps that are common to all topologies.

---

## 1. Single-host: Docker Compose (recommended for first deploys)

This is the same shape as `docker-compose.yml` in the repo, plus a `web` and `bot` service. Drop the file below at `docker-compose.prod.yml`.

> Requirements: docker 24+, ~1 GiB RAM, ~1 GiB disk for transient streaming, a public DNS A-record pointing at the host, and ports 80/443 routable.

```bash
# clone + bring everything up
git clone https://github.com/e2kmovie-max/Wave.git
cd Wave
cp .env.example .env  # edit BOT_TOKEN, GOOGLE_*, INSTANCE_LOCAL_SECRET, …
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile instance up -d --build
# verify
curl -fsS http://localhost:3000/api/health | jq .
```

`docker-compose.prod.yml` lives in this repo at `deploy/docker-compose.prod.yml` — see that file for the exact `web` and `bot` service definitions, including health-checks and `depends_on: mongodb`. Bring your own TLS terminator (Caddy, nginx, Cloudflare Tunnel — whatever you already run).

### nginx in front of the master

`deploy/nginx/wave.conf` is a minimal config that:

- terminates TLS on `:443` (snake-oil paths shown as placeholders),
- proxies `/api/rooms/*/ws` with the right `Upgrade: websocket` headers so room sync survives,
- streams `/api/rooms/*/stream` without buffering,
- caches static `_next/static/*` aggressively.

```bash
sudo install -m644 deploy/nginx/wave.conf /etc/nginx/sites-available/wave
sudo ln -sf /etc/nginx/sites-available/wave /etc/nginx/sites-enabled/wave
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. Bare-metal systemd

If you'd rather run Bun + Node directly, install Bun ≥ 1.1 and Go ≥ 1.23 system-wide and use the unit files in `deploy/systemd/`.

```bash
sudo install -m644 deploy/systemd/wave-web.service /etc/systemd/system/
sudo install -m644 deploy/systemd/wave-bot.service /etc/systemd/system/
sudo install -m644 deploy/systemd/wave-instance.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wave-instance wave-bot wave-web
sudo journalctl -fu wave-web
```

Each unit reads `/etc/wave/environment` for its env vars — that file is a plain `KEY=value` list parsed by systemd's `EnvironmentFile=`. **Don't** commit it; mode `0600` it and keep a backup somewhere safe.

---

## 3. Multi-host: master + workers

When you outgrow a single VM, peel the streaming instances off:

```
┌──────────────┐        HMAC-signed JSON         ┌──────────────────┐
│  master VM   │   /info, /stream, /health       │  instance VM #N  │
│              │ ──────────────────────────────▶ │                  │
│  - web       │                                 │  apps/instance   │
│  - bot       │   ◀── proxied bytes ─────────── │  (Go on :8080)   │
│  - mongo     │                                 │  yt-dlp + ffmpeg │
└──────────────┘                                 └──────────────────┘
```

1. On each instance VM, run only `apps/instance` (via Docker `--profile instance` or systemd). Generate a strong `INSTANCE_SECRET` per worker.
2. On the master VM, list each worker in `INSTANCES_JSON`. The master will upsert the records on startup and skip any admin-added entries that are not env-managed.

```jsonc
// /etc/wave/environment (master node)
INSTANCES_JSON=[
  { "name": "edge-fra-1", "url": "https://stream-fra-1.example.com", "secret": "…", "maxStreams": 4 },
  { "name": "edge-fra-2", "url": "https://stream-fra-2.example.com", "secret": "…", "maxStreams": 4 },
  { "name": "edge-ams-1", "url": "http://203.0.113.42:8080",         "secret": "…", "maxStreams": 2 }
]
```

> Plain `http://ip:8080` is fine for diagnostics — the admin UI will tag the record with a yellow `http` warning. For end-user traffic, always front each instance with HTTPS.

The master polls `<instance>/health` every `INSTANCE_HEALTH_INTERVAL_SECONDS` (default 15s). After a failure streak, the record is shown as **unhealthy** with a `consecutiveFailures: N` badge in `/admin/instances`. The pool will skip unhealthy instances when picking one for a new room. The first successful probe resets the counter.

---

## Required environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | yes | `mongodb://…/wave` |
| `SESSION_SECRET` | yes | ≥ 32 random bytes (`openssl rand -hex 32`). Used to sign session JWTs. |
| `BOT_TOKEN` | yes (for bot) | grammY bot token from `@BotFather`. |
| `BOT_USERNAME` | yes (for bot) | The bot's `@username` without the `@`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes (for web login) | Google OAuth 2.0 credentials. |
| `WEB_BASE_URL` | yes | Public origin of the master (e.g. `https://wave.example.com`). Used in OAuth callbacks and Telegram invite links. |
| `ADMIN_GOOGLE_EMAILS` | recommended | Comma-separated emails. Anyone in this list becomes an admin on first sign-in. |
| `ADMIN_TELEGRAM_IDS` | recommended | Comma-separated Telegram user IDs. |
| `INSTANCE_LOCAL_SECRET` | yes (local-only) | Shared HMAC secret for the bundled local instance. |
| `INSTANCES_JSON` | optional | Multi-host pool of streaming instances; see above. |
| `INSTANCE_HEALTH_INTERVAL_SECONDS` | optional | Default 15. |
| `INSTANCE_HEALTH_TIMEOUT_MS` | optional | Default 5000. |
| `COOKIE_ENCRYPTION_KEY` | yes (admin cookie pool) | 32 bytes; encrypts the Google cookie payloads stored in Mongo. |

`.env.example` (in the repo) lists every variable with a one-line description. The Next.js app re-reads its env on each request when in development; in production it caches at startup, so a `systemctl restart wave-web` is needed after editing `/etc/wave/environment`.

---

## Verification checklist

After any deploy, hit these URLs in order — they progressively exercise the stack:

```bash
# 1. master liveness (mongo reachable?)
curl -fsS https://wave.example.com/api/health | jq .

# 2. admin health overview (requires admin session cookie)
curl -fsS -H 'cookie: wave_session=…' \
  https://wave.example.com/api/admin/health | jq '.instances.summary'

# 3. each worker's local health (HMAC-signed; see apps/instance/README.md)
curl -fsS https://stream-fra-1.example.com/health

# 4. end-to-end smoke test: create a room from /, confirm playback starts.
```

The admin health JSON is the easiest way to spot trouble:

```json
{
  "instances": {
    "total": 3, "enabled": 3, "healthy": 2, "failing": 1,
    "activeStreams": 4,
    "instances": [
      { "name": "edge-ams-1", "isHealthy": false, "consecutiveFailures": 7,
        "failingSince": "2025-05-08T03:11:24.000Z",
        "lastHealthError": "fetch failed (status=0)" }
    ]
  },
  "cookies": { "total": 5, "enabled": 4, "autoDisabled": 1, "totalRotations": 12 }
}
```

`consecutiveFailures > 0` + `failingSince` is the signal to investigate (network egress, expired cert, dead ffmpeg). `autoDisabled` Google accounts mean yt-dlp tripped a bot/captcha/login wall — re-export fresh cookies from a clean browser session and re-upload via `/admin/cookies`.

---

## Operating tips

- **Cookies** rotate automatically on bans/captchas. The selection is LRU so adding a new healthy account immediately drains traffic from the older ones.
- **Streams** are short-lived. If you need to drain a worker for maintenance, disable it in `/admin/instances` first — in-flight streams continue, but the master stops routing new rooms to it.
- **Mongo backups**: `wave_mongo_data` is the only stateful volume. A nightly `mongodump` is enough; nothing else on the master is irreplaceable.
- **Logs**: keep `journalctl -u wave-web` and `journalctl -u wave-bot` at INFO. The Go instance logs every yt-dlp error code to stderr — grep for `bot_detected|captcha|login_required` to spot waves of bans.
- **Languages**: the web UI auto-detects RU/EN from `Accept-Language`. Users can override via the in-header switcher (writes a `wave_lang` cookie). Adding a third language is a one-shot expansion of `packages/shared/src/i18n.ts` and `SUPPORTED_WEB_LANGS`.
