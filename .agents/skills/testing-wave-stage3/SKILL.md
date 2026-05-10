---
name: testing-wave-stage3
description: Test Wave Stage 3 watch-party room creation, stream proxying, and WebSocket playback sync end-to-end.
---

# Wave Stage 3 Testing

Use this when verifying Wave watch-party rooms, stream proxying, or WebSocket sync behavior.

## Devin Secrets Needed

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: only needed when testing real Google OAuth sign-in.
- `BOT_TOKEN` / `BOT_USERNAME`: only needed when testing Telegram bot or Mini App auth/deeplinks.
- `YOUTUBE_COOKIE_PAYLOAD` (or equivalent repo/user secret): only needed when testing YouTube videos that require cookies. Cookie records are stored in Mongo as `GoogleAccount` documents and forwarded to the instance per request.

The core Stage 3 web room/sync flow can be tested without external auth secrets by creating a local test user and setting a `wave_session` cookie signed with the local `APP_SECRET`.

## Local Services

1. Ensure dependencies are installed with Bun from the repo root:
   ```bash
   export PATH="$HOME/.bun/bin:$PATH"
   bun install
   ```
2. Start MongoDB and the local streaming instance:
   ```bash
   docker compose up -d mongodb
   INSTANCE_LOCAL_SECRET=dev-instance-secret-change-me docker compose --profile instance up -d --build instance
   curl -fsS http://localhost:8080/health
   ```
3. Build and run the production custom server when testing browser flows:
   ```bash
   export MONGODB_URI='mongodb://wave:wave@localhost:27017/wave?authSource=admin'
   export APP_SECRET='dev-only-app-secret-replace-me-please'
   export PUBLIC_WEB_URL='http://localhost:3001'
   export WEB_PORT=3001
   export INSTANCES_JSON='[{"name":"local","url":"http://localhost:8080","secret":"dev-instance-secret-change-me","isLocal":true}]'
   export INSTANCE_HEALTH_INTERVAL_SECONDS=3
   export INSTANCE_HEALTH_TIMEOUT_MS=5000
   bun run build
   NODE_ENV=production bun --filter @wave/web start
   ```

`bun run dev:web` might fail in Next dev mode with a `node:crypto` bundling error when `@wave/shared` barrel imports Node-only modules. If this occurs, report it and use the production custom server for runtime testing rather than claiming dev mode works.

## Local Test Session

Create a local user and signed cookie using the same `APP_SECRET`:

```bash
export MONGODB_URI='mongodb://wave:wave@localhost:27017/wave?authSource=admin'
export APP_SECRET='dev-only-app-secret-replace-me-please'
bun -e 'import { connectMongo, User, signToken } from "@wave/shared"; await connectMongo(); const user = await User.findOneAndUpdate({ googleId: "devin-local-test" }, { $set: { googleId: "devin-local-test", googleEmail: "devin-local-test@example.com", googleName: "Devin Local Test" } }, { upsert: true, new: true, setDefaultsOnInsert: true }); console.log(JSON.stringify({ uid: String(user._id), cookie: signToken({ uid: String(user._id) }, 60*60*24*30) })); process.exit(0);'
```

Set the cookie in Chrome as `wave_session` for `http://localhost:<WEB_PORT>` before recording.

## Primary Browser Flow

Record one focused browser session after setup:

1. Open the signed-in home page and verify the `Paste YouTube / video URL` field and `Create room` button are visible.
2. Use a URL that `yt-dlp` can resolve with formats. Vimeo `https://vimeo.com/76979871` worked in testing and returned multiple formats.
3. Submit the form and verify navigation to `/rooms/<8-char-code>` with a non-fallback video title, preview duration, and quality presets.
4. Verify the player stream URL is `/api/rooms/<code>/stream?format=...`, not the Go instance URL.
5. Open the same room in a second tab and verify `State sync` changes on play, pause/seek, and quality selection.
6. Return home and verify invalid input `not-a-url` shows `Enter a valid http(s) video URL.` without navigating away.

Use recording annotations for room creation, stream proxy verification, sync verification, quality sync, and invalid URL handling.
