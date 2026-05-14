# Wave split architecture

Wave stays in one Bun monorepo for this PR, but runtime code now consumes three domain packages that map to the future repository split.

## Future repositories

| Future repo | Current package | Responsibility |
| --- | --- | --- |
| `wave-interface` | `@wave/interface` | Web UI, Google sign-in, Telegram Mini App verification, bot-facing interface helpers, i18n, and user identity surface. |
| `wave-player` | `@wave/player` | Video preview/stream orchestration, Go instance client, `yt-dlp` cookie pool rotation, instance health and admin APIs for workers. |
| `wave-social` | `@wave/social` | Rooms as social spaces: participants, chat, playback status sync state, required Telegram-channel gate, and room/user social models. |

`@wave/shared` remains the internal persistence and utility package while the project is still a monorepo. Apps should import from the domain packages above, not from `@wave/shared`, unless they are adding new low-level shared infrastructure.

## Split rules

1. `apps/web` may depend on all three domains because it hosts UI, auth routes, admin pages, room playback and WebSocket sync.
2. `apps/bot` may depend on:
   - `@wave/interface` for env, Mongo, users, i18n;
   - `@wave/social` for OP gate, rooms and Telegram-channel state;
   - `@wave/player` only when it prepares a video/room.
3. The Go worker in `apps/instance` is already the player runtime boundary. It must stay stateless: cookies are accepted per request and never stored on the instance.
4. New feature code should be placed behind the narrowest domain facade first. Avoid importing models directly from `@wave/shared` in app code.

## YouTube cookies

Cookies must not be committed. Admins can upload multiple Google/YouTube accounts through `/admin/cookies` as Netscape `cookies.txt` or CDP JSON. The master encrypts cookie payloads at rest, rotates accounts LRU, auto-disables accounts on rotatable `yt-dlp` errors, and sends plaintext cookies only in signed request bodies to the selected player instance.

For reliable exports, follow the `yt-dlp` guidance: use a fresh private/incognito browser session, log in, open `https://www.youtube.com/robots.txt`, export `youtube.com` cookies, then close the browser session so those cookies are not rotated by an open tab.
