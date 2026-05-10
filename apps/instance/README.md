# `@wave/instance` — streaming instance (Stage 2)

A Go binary that hosts on `:8080` (HTTP, optionally fronted by HTTPS via a
reverse proxy) and exposes the streaming endpoints used by the master node:

- `GET /health` — liveness probe used by the master to mark the instance up/down.
- `POST /info` — accepts `{ url, cookies, userAgent }`; runs `yt-dlp -F` and
  returns the available formats + metadata. Cookies are accepted in the body
  in Netscape format and are **never** persisted on the instance.
- `GET /stream/:roomId?format=…` — proxies a chunked video stream. The master
  passes the cookies bundle in a signed header per request; the instance uses
  it for the duration of the stream and discards it.

This directory is a placeholder for now; the binary lands in Stage 2.
