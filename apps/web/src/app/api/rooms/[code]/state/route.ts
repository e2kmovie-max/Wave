import { NextResponse } from "next/server";
import { connectMongo, makeRoomState, Room } from "@wave/shared";
import { requireCurrentUser } from "@/lib/room-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  await requireCurrentUser(`/rooms/${encodeURIComponent(code)}`);
  await connectMongo();
  const room = await Room.findOne({ code: code.toUpperCase(), isClosed: false }).lean();
  if (!room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }
  return NextResponse.json({ state: makeRoomState(room) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  await requireCurrentUser(`/rooms/${encodeURIComponent(code)}`);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const update: Record<string, unknown> = { lastSyncAt: new Date() };
  if (typeof body.currentTime === "number" && Number.isFinite(body.currentTime)) {
    update.currentTime = Math.max(0, body.currentTime);
  }
  if (typeof body.isPlaying === "boolean") update.isPlaying = body.isPlaying;
  if (typeof body.playbackRate === "number" && Number.isFinite(body.playbackRate)) {
    update.playbackRate = Math.min(2, Math.max(0.25, body.playbackRate));
  }
  if (typeof body.selectedFormatId === "string" && body.selectedFormatId.trim()) {
    update.selectedFormatId = body.selectedFormatId.trim();
    if (typeof body.quality === "string") update.quality = body.quality;
  }

  await connectMongo();
  const room = await Room.findOneAndUpdate(
    { code: code.toUpperCase(), isClosed: false },
    { $set: update },
    { new: true },
  ).lean();
  if (!room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }
  return NextResponse.json({ state: makeRoomState(room) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
