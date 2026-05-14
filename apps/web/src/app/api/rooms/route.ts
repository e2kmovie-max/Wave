import { NextResponse } from "next/server";
import {
  WatchPartyError,
  createWatchRoom,
} from "@wave/player";
import { checkTelegramSubscriptions, connectMongo } from "@wave/social";
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

  await connectMongo();

  // OP gate: only applies to web users who already have a Telegram identity
  // attached. Pure-Google users are always allowed (they have no way to
  // subscribe to a channel).
  if (typeof user.telegramId === "number") {
    const op = await checkTelegramSubscriptions(user.telegramId);
    if (!op.passed) {
      return NextResponse.json(
        {
          error: "subscription_required",
          missing: op.missing,
        },
        { status: 403 },
      );
    }
    // Sticky-bit the pass on the user doc so later UI can skip the wait.
    user.hasPassedOp = true;
    user.lastOpAt = new Date();
    await user.save();
  }

  try {
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
