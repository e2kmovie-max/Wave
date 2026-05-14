import { NextResponse } from "next/server";
import { connectMongo } from "@wave/interface";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for the master node.
 *
 * Returns 200 with `{ ok: true, mongo: "up" }` when Mongo is reachable, and
 * 503 with `{ ok: false, mongo: "down" }` otherwise. Suitable for nginx
 * `proxy_next_upstream`, k8s liveness probes, and uptime monitoring.
 *
 * Deliberately does NOT report on streaming instances (those have their own
 * `/health` endpoints and are summarised at `/api/admin/health`).
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await connectMongo();
    return NextResponse.json(
      {
        ok: true,
        mongo: "up",
        uptimeMs: Date.now() - startedAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        mongo: "down",
        error: (err as Error).message,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
