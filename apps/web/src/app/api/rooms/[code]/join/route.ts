import { NextResponse } from "next/server";
import { connectMongo, Room } from "@wave/shared";
import { requireCurrentUser } from "@/lib/room-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const user = await requireCurrentUser(`/rooms/${encodeURIComponent(code)}`);
  await connectMongo();
  const room = await Room.findOneAndUpdate(
    { code: code.toUpperCase(), isClosed: false },
    {
      $pull: { participants: { userId: user._id } },
    },
    { new: true },
  );
  if (!room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }
  await Room.updateOne(
    { _id: room._id },
    {
      $addToSet: { participants: { userId: user._id, joinedAt: new Date(), lastSeenAt: new Date() } },
    },
  );
  return NextResponse.json({ ok: true });
}
