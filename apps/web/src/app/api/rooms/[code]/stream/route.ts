import { NextResponse } from "next/server";
import {
  connectMongo,
  Instance,
  InstanceClient,
  InstanceError,
  Room,
  WatchPartyError,
  withCookieRotation,
} from "@wave/shared";
import { requireCurrentUser } from "@/lib/room-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  await requireCurrentUser(`/rooms/${encodeURIComponent(code)}`);
  await connectMongo();
  const room = await Room.findOne({ code: code.toUpperCase(), isClosed: false }).lean();
  if (!room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }
  if (!room.instanceId) {
    return NextResponse.json({ error: "room_has_no_instance" }, { status: 503 });
  }
  const instance = await Instance.findById(room.instanceId).lean<{
    url: string;
    secret: string;
    enabled?: boolean;
    isHealthy?: boolean;
  } | null>();
  if (!instance || !instance.enabled || !instance.isHealthy) {
    return NextResponse.json({ error: "room_instance_unavailable" }, { status: 503 });
  }

  const formatId =
    new URL(request.url).searchParams.get("format") ?? room.selectedFormatId ?? undefined;

  try {
    const client = new InstanceClient({ url: instance.url, secret: instance.secret });
    const { value: upstream } = await withCookieRotation(async (creds) => {
      const res = await client.stream(
        {
          url: room.videoUrl,
          formatId,
          cookies: creds.cookies,
          userAgent: creds.userAgent,
        },
        { signal: request.signal },
      );
      if (!res.ok) {
        // The instance writes a JSON error body when it can detect failure
        // before any bytes have been flushed. Surface that as an InstanceError
        // so the rotation wrapper can decide whether to retry.
        const text = await res.text();
        throw new InstanceError(
          deriveErrorMessage(text, `stream returned ${res.status}`),
          res.status,
          text,
        );
      }
      return res;
    });
    if (!upstream.body) {
      return new NextResponse("stream had no body", { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "video/mp4",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof WatchPartyError || err instanceof InstanceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[wave] stream proxy failed:", err);
    return NextResponse.json({ error: "stream_proxy_failed" }, { status: 502 });
  }
}

function deriveErrorMessage(body: string, fallback: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { error?: unknown }).error === "string" &&
      (parsed as { error: string }).error.trim() !== ""
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
    // body is plain text — fall through
  }
  return fallback;
}
