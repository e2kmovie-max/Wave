# Wave

Synchronized video watch-party platform. Drop in a link, share a room, and
watch in lockstep with your friends — from the web (Google sign-in) or from
inside Telegram (bot + Mini App). Both identities can be linked into a single
account.

> **Status:** Stage 1 of 5 — foundation. The repo currently contains the
> monorepo layout, shared Mongoose models, web auth (Google OAuth + Telegram
> Mini App `initData` verification), account linking, and a bot scaffold.
> Streaming, rooms, and the admin panel arrive in subsequent stages.

## Stack

- **Runtime:** [Bun](https://bun.sh) (`>= 1.1`) workspaces
- **Language:** TypeScript across all apps
- **Web:** Next.js 15 + React 19 + Tailwind 4 (`apps/web`)
- **Bot:** [grammY](https://grammy.dev) + conversations plugin (`apps/bot`)
- **Database:** MongoDB via Mongoose with `InferSchemaType` (shared schemas live in `packages/shared`)
- **Streaming instance** (Stage 2): Go binary on `:8080` using `yt-dlp` + `ffmpeg`

## Repo layout

```
Wave/
├── apps/
│   ├── web/          Next.js app (Google OAuth, Mini App, account UI)
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

5. **Run the apps.** In two terminals:

   ```bash
   bun run dev:web   # http://localhost:3000
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

## Schemas (Mongoose + InferSchemaType)

All in `packages/shared/src/models`:

| Model | Purpose |
| --- | --- |
| `User` | Wave user with optional Google and Telegram identities. Holds OP state, last `start` payload, admin flag. |
| `Room` | A watch party: video metadata, participants, current playhead, selected `Instance`. Stage 3 fills this out. |
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
| **1 — Foundation** *(this PR)* | Monorepo, schemas, auth, account linking, bot scaffold, MongoDB compose. |
| 2 — Streaming instance | Go binary on `:8080`, yt-dlp + ffmpeg integration, info / stream / health endpoints. Cookies passed in request body. |
| 3 — Watch party logic | Room creation, instance selection, chunked stream proxy, WebSocket sync (play / pause / seek / quality). |
| 4 — Bot + admin | Required-subscription system, deep-link payload rooms, multi-cookie rotation pool, instance admin. |
| 5 — Polish | Banned-cookie auto-rotation, instance health monitoring, README & deployment docs, observability. |
