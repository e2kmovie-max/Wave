import { NextResponse } from "next/server";
import {
  connectMongo,
  Instance,
  InstanceClient,
  InstanceError,
  loadYtDlpCredentials,
  Room,
  WatchPartyError,
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
    const credentials = await loadYtDlpCredentials();
    const client = new InstanceClient({ url: instance.url, secret: instance.secret });
    const upstream = await client.stream(
      {
        url: room.videoUrl,
        formatId,
        cookies: credentials.cookies,
        userAgent: credentials.userAgent,
      },
      { signal: request.signal },
    );
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return new NextResponse(text || "stream failed", {
        status: upstream.status || 502,
      });
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
