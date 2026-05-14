import { NextResponse } from "next/server";
import {
  RequiredChannelError,
  addRequiredChannel,
  connectMongo,
  listRequiredChannels,
} from "@wave/social";
import { checkAdmin } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await checkAdmin();
  if (guard.status !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await connectMongo();
  return NextResponse.json({ channels: await listRequiredChannels() });
}

export async function POST(request: Request) {
  const guard = await checkAdmin();
  if (guard.status !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.chatId !== "string") {
    return NextResponse.json({ error: "chatId is required" }, { status: 400 });
  }
  try {
    await connectMongo();
    const doc = await addRequiredChannel({
      chatId: body.chatId,
      title: typeof body.title === "string" && body.title.trim() ? body.title : body.chatId,
      inviteLink: typeof body.inviteLink === "string" ? body.inviteLink : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
    });
    return NextResponse.json({ id: String(doc._id) });
  } catch (err) {
    if (err instanceof RequiredChannelError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[wave] admin add channel failed:", err);
    return NextResponse.json({ error: "add_failed" }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
