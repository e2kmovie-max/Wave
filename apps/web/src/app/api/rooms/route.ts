import { NextResponse } from "next/server";
import { connectMongo, createWatchRoom, WatchPartyError } from "@wave/shared";
import { requireCurrentUser } from "@/lib/room-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireCurrentUser("/");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.url !== "string") {
    return NextResponse.json({ error: "url_required" }, { status: 400 });
  }

  try {
    await connectMongo();
    const room = await createWatchRoom({
      ownerId: user._id,
      url: body.url,
      source: "web",
    });
    return NextResponse.json({ code: room.code, url: `/rooms/${room.code}` });
  } catch (err) {
    if (err instanceof WatchPartyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[wave] create room failed:", err);
    return NextResponse.json({ error: "room_create_failed" }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
