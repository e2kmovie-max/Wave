# Wave

Synchronized video watch-party platform. Drop in a link, share a room, and
watch in lockstep with your friends — from the web (Google sign-in) or from
inside Telegram (bot + Mini App). Both identities can be linked into a single
account.

> **Status:** Stage 3 of 5 — watch-party rooms and synchronized playback.
> On top of the Stage 1–2 foundation, the repo now creates rooms from the web
> or bot, auto-selects a healthy streaming instance, fetches video preview
> metadata, proxies fragmented MP4 streams through the master node, and keeps
> play / pause / seek / quality in sync over a WebSocket room channel. Admin
> tooling and cookie-pool management arrive in Stage 4.

## Stack

- **Runtime:** [Bun](https://bun.sh) (`>= 1.1`) workspaces
- **Language:** TypeScript across all apps
- **Web:** Next.js 15 + React 19 + Tailwind 4 (`apps/web`)
- **Bot:** [grammY](https://grammy.dev) + conversations plugin (`apps/bot`)
- **Database:** MongoDB via Mongoose with `InferSchemaType` (shared schemas live in `packages/shared`)
- **Streaming instance:** Go 1.23 binary on `:8080` running `yt-dlp` + `ffmpeg`

## Repo layout

```
Wave/
├── apps/
│   ├── web/          Next.js app (auth, rooms, stream proxy, WebSocket sync)
│   ├── bot/          grammY Telegram bot
│   └── instance/     Go streaming instance (Stage 2)
├── packages/
│   └── shared/       Mongoose models + env + crypto + Telegram helpers
├── docker-compose.yml   Local MongoDB
├── tsconfig.base.json
├── bunfig.toml
└── package.json
```

## Quickstart (local dev)

1. **Install Bun** and clone the repo.

   ```bash
   curl -fsSL https://bun.sh/install | bash
   git clone https://github.com/e2kmovie-max/Wave.git && cd Wave
   ```

2. **Install dependencies.**

   ```bash
   bun install
   ```

3. **Bring up MongoDB.**

   ```bash
   bun run db:up
   ```

4. **Configure environment.** Copy `.env.example` to `.env` and fill in what
   you have. With both Google OAuth and the bot empty, the app still runs —
   sign-in buttons render in disabled / informational mode so you can see the
   flow.

   ```bash
   cp .env.example .env
   ```

   The minimum to flip on Google sign-in:

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

   The minimum to flip on the Telegram bot + Mini App:

   ```env
   BOT_TOKEN=123456:abc
   BOT_USERNAME=wave_together_bot
   ```

5. **(Optional) Run a local streaming instance.** The Stage 2 Go binary lives
   at `apps/instance` and ships in a Docker image alongside `yt-dlp` and
   `ffmpeg`.

   ```bash
   docker compose --profile instance up -d
   ```

   Then point the master at it via `INSTANCES_JSON` in `.env`:

   ```env
   INSTANCES_JSON=[{"name":"local","url":"http://localhost:8080","secret":"dev-instance-secret-change-me","isLocal":true}]
   INSTANCE_LOCAL_SECRET=dev-instance-secret-change-me
   ```

   The master upserts that record on startup and pings `/health` every
   `INSTANCE_HEALTH_INTERVAL_SECONDS`. Records added through the future admin
   panel are never overwritten by this sync — see
   [`packages/shared/src/instance-sync.ts`](./packages/shared/src/instance-sync.ts)
   for the matching rules.

6. **Run the apps.** In two terminals:

   ```bash
   bun run dev:web   # http://localhost:3000 (custom Next server + WebSockets)
   bun run dev:bot   # long-poll (skipped automatically if BOT_TOKEN is empty)
   ```

## Auth flows

- **Google OAuth** — OAuth 2.0 authorization-code flow, callback at
  `/api/auth/google/callback`. State is HMAC-signed (carries an optional
  `linkUid` when used to link Google to the currently signed-in user) so we
  don't need a server-side state store.
- **Telegram Mini App** — `apps/web/src/app/miniapp/page.tsx` loads
  `telegram-web-app.js`, posts the raw `initData` to `/api/auth/telegram`,
  and the server verifies the HMAC per the
  [official spec](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
  inside `packages/shared/src/telegram.ts`.
- **Account linking** — `/account` exposes "link Google" and "open Telegram
  bot" actions. Both flows accept an existing session and merge identities
  onto the current Wave user, with conflict detection (`google_already_linked`
  / `telegram_already_linked`) when the identity is already on a different
  account.

## Streaming instances (Stage 2)

Each instance is a stateless Go process you can run on any host. The master
node holds the cookie pool, picks a healthy instance for a room, and forwards
`/info` and `/stream` calls to it — cookies are sent **in the request body**
and are never persisted on the instance.

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | Liveness + reported `yt-dlp` / `ffmpeg` versions + active stream count. |
| `POST /info` | HMAC | Runs `yt-dlp --dump-single-json` and returns trimmed metadata + format list. |
| `POST /stream` | HMAC | Pipes `yt-dlp` → `ffmpeg` (always remuxes to fragmented MP4) directly to the response body. |

**Signing.** Every signed request carries:

```
X-Wave-Timestamp: <unix seconds>
X-Wave-Signature: hex(hmac_sha256(timestamp + "." + body, instanceSecret))
```

The instance enforces a ±30s clock-drift window so captured signatures cannot
be replayed indefinitely. Same algorithm is used by the master
([`packages/shared/src/instance-client.ts`](./packages/shared/src/instance-client.ts))
and the instance ([`apps/instance/internal/auth/hmac.go`](./apps/instance/internal/auth/hmac.go))
and is pinned by parity tests in `packages/shared/test/`.

**Cookies.** Sent as a JSON array on the request body matching the Chrome
DevTools Protocol cookie shape (`name`, `value`, `domain`, `path`, `expires`,
`secure`, `httpOnly`). The instance writes a 0600 Netscape file to the OS
temp dir, hands it to `yt-dlp --cookies`, and `defer`-deletes it after the
request — nothing about the cookie persists across requests.

## Watch-party rooms (Stage 3)

Signed-in users can create rooms from the home page by pasting a video URL.
The master node:

1. selects an enabled, healthy instance with available stream capacity;
2. rotates to the least-recently-used enabled `GoogleAccount` cookie record
   when one exists;
3. calls the instance `/info` endpoint to build preview metadata and quality
   presets;
4. stores the selected instance, metadata, participants, and sync state on the
   `Room` document.

The room page at `/rooms/<code>` streams through
`/api/rooms/<code>/stream?format=...`, so clients never talk to the worker
instance directly. Playback state is synchronized over the custom Next server's
WebSocket upgrade route:

```
ws(s)://<web-host>/api/rooms/<code>/sync
```

Messages support `play`, `pause`, `seek`, and `quality`; every update is also
persisted to MongoDB so late joiners receive the current playhead. A plain HTTP
instance URL (`http://ip:8080` or `http://localhost:8080`) is allowed because it
is only called from the trusted master node.

## Schemas (Mongoose + InferSchemaType)

All in `packages/shared/src/models`:

| Model | Purpose |
| --- | --- |
| `User` | Wave user with optional Google and Telegram identities. Holds OP state, last `start` payload, admin flag. |
| `Room` | A watch party: video metadata, participants, current playhead, selected `Instance`, and optional bot invite payload. |
| `Instance` | A Go streaming instance with HMAC secret, health stats, optional cap on parallel streams. |
| `GoogleAccount` | Pool of YouTube cookies (Netscape format, AES-256-GCM at rest). Rotation logic lands in Stage 4. |
| `RequiredChannel` | Telegram channels users must join before creating/joining a room (admin-managed). |

## Environment reference

See [`.env.example`](./.env.example) for the full list. Required at minimum:

- `MONGODB_URI`
- `APP_SECRET` — used by `signToken` / `verifyToken` and AES-256-GCM cookie
  encryption. Generate with `openssl rand -base64 48`.
- `PUBLIC_WEB_URL` — used to build OAuth redirect URIs and bot deep links.

## Roadmap

| Stage | Scope |
| --- | --- |
| 1 — Foundation *(merged)* | Monorepo, schemas, auth, account linking, bot scaffold, MongoDB compose. |
| 2 — Streaming instance *(merged)* | Go binary on `:8080`, yt-dlp + ffmpeg, HMAC `/info` and `/stream`, env-driven master sync, health probe loop. |
| **3 — Watch party logic** *(this PR)* | Room creation, instance selection, chunked stream proxy, WebSocket sync (play / pause / seek / quality). |
| 4 — Bot + admin | Required-subscription system, deep-link payload rooms, multi-cookie rotation pool, instance admin. |
| 5 — Polish | i18n (RU/EN with Accept-Language autodetect), banned-cookie auto-rotation, observability, deployment docs. |
