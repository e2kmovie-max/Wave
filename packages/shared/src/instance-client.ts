/**
 * HTTP client for talking to a Wave streaming instance.
 *
 * Wraps `fetch` to attach the master→instance HMAC signature on every signed
 * request. /health is unauthenticated by design; /info and /stream require
 * `X-Wave-Timestamp` + `X-Wave-Signature` headers.
 *
 * The signature payload is `${timestamp}.${body}` — including the timestamp
 * inside the MAC binds the signature to a specific time window so an
 * attacker who captures one request cannot replay it forever (the instance
 * also enforces a ±30s clock-drift window).
 */

import { createHmac } from "node:crypto";

export interface InstanceCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number; // unix seconds, 0 ⇒ session
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
}

export interface InstanceTarget {
  /** Base URL — `http://host:port` or `https://host`. No trailing slash. */
  url: string;
  /** HMAC secret matching the instance's `INSTANCE_SECRET` env var. */
  secret: string;
}

export interface InstanceHealth {
  ok: boolean;
  version: string;
  startedAt: string;
  uptimeSeconds: number;
  activeStreams: number;
  maxStreams: number;
  tools: { ytDlp?: string; ffmpeg?: string };
}

export interface InstanceFormat {
  formatId: string;
  ext?: string;
  resolution?: string;
  height?: number;
  width?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  note?: string;
}

export interface InstanceInfo {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  channel?: string;
  webpageUrl?: string;
  extractor?: string;
  formats: InstanceFormat[];
}

export interface InfoRequest {
  url: string;
  cookies?: InstanceCookie[];
  userAgent?: string;
}

export interface StreamRequest {
  url: string;
  formatId?: string;
  cookies?: InstanceCookie[];
  userAgent?: string;
}

export class InstanceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "InstanceError";
  }
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return b + p;
}

function signBody(secret: string, timestamp: string, body: string): string {
  const mac = createHmac("sha256", secret);
  mac.update(timestamp);
  mac.update(".");
  mac.update(body);
  return mac.digest("hex");
}

export class InstanceClient {
  constructor(
    private readonly target: InstanceTarget,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async health(opts: { timeoutMs?: number } = {}): Promise<InstanceHealth> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 5000);
    try {
      const res = await this.fetchImpl(joinUrl(this.target.url, "/health"), {
        method: "GET",
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new InstanceError(`/health returned ${res.status}`, res.status, text);
      }
      try {
        return JSON.parse(text) as InstanceHealth;
      } catch (err) {
        throw new InstanceError(
          `/health returned non-JSON: ${(err as Error).message}`,
          res.status,
          text,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async info(req: InfoRequest, opts: { timeoutMs?: number } = {}): Promise<InstanceInfo> {
    const body = JSON.stringify(req);
    const res = await this.signedFetch("/info", body, opts.timeoutMs ?? 30_000);
    const text = await res.text();
    if (!res.ok) {
      throw new InstanceError(`/info returned ${res.status}`, res.status, text);
    }
    return JSON.parse(text) as InstanceInfo;
  }

  /**
   * Returns the raw streaming Response — caller must consume `res.body` and
   * pipe it onward (e.g. to its own HTTP response). Do NOT call
   * `res.text()` / `.json()`; the body is large and chunked.
   */
  async stream(req: StreamRequest, opts: { signal?: AbortSignal } = {}): Promise<Response> {
    const body = JSON.stringify(req);
    return this.signedFetch("/stream", body, undefined, opts.signal);
  }

  private async signedFetch(
    path: string,
    body: string,
    timeoutMs: number | undefined,
    externalSignal?: AbortSignal,
  ): Promise<Response> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = signBody(this.target.secret, ts, body);

    let abort: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let signal = externalSignal;
    if (timeoutMs !== undefined) {
      abort = new AbortController();
      if (externalSignal) {
        externalSignal.addEventListener("abort", () => abort?.abort(), { once: true });
      }
      timer = setTimeout(() => abort?.abort(), timeoutMs);
      signal = abort.signal;
    }

    try {
      return await this.fetchImpl(joinUrl(this.target.url, path), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Wave-Timestamp": ts,
          "X-Wave-Signature": sig,
        },
        body,
        signal,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/** Test helper exposed for the master's unit tests. */
export const __test__ = { signBody };
