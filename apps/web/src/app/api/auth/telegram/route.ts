import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  connectMongo,
  User,
  getEnv,
  isBotConfigured,
  verifyTelegramInitData,
} from "@wave/shared";
import { readSession, writeSession } from "@/lib/session";

export const runtime = "nodejs";

interface Body {
  initData?: string;
  /** When true, link this Telegram identity to the currently signed-in (Google) user. */
  link?: boolean;
}

export async function POST(req: NextRequest) {
  if (!isBotConfigured()) {
    return NextResponse.json(
      {
        error: "bot_not_configured",
        message: "BOT_TOKEN is not set; Telegram Mini App auth is disabled.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const initData = body.initData?.trim();
  if (!initData) {
    return NextResponse.json({ error: "missing_init_data" }, { status: 400 });
  }

  const env = getEnv();
  const data = verifyTelegramInitData(initData, env.BOT_TOKEN);
  if (!data?.user) {
    return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });
  }

  await connectMongo();

  const tg = data.user;
  const update = {
    telegramId: tg.id,
    telegramUsername: tg.username,
    telegramFirstName: tg.first_name,
    telegramLastName: tg.last_name,
    telegramPhotoUrl: tg.photo_url,
    isAdmin: env.ADMIN_TELEGRAM_IDS.includes(tg.id) || undefined,
  };

  let userId: string;

  const existingSession = await readSession();
  if (body.link && existingSession?.uid && Types.ObjectId.isValid(existingSession.uid)) {
    const conflict = await User.findOne({
      telegramId: tg.id,
      _id: { $ne: existingSession.uid },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "telegram_already_linked" },
        { status: 409 },
      );
    }
    const updated = await User.findByIdAndUpdate(existingSession.uid, update, {
      new: true,
    });
    if (!updated) {
      return NextResponse.json({ error: "session_expired" }, { status: 401 });
    }
    userId = String(updated._id);
  } else {
    const user = await User.findOneAndUpdate(
      { telegramId: tg.id },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    userId = String(user._id);
  }

  if (data.start_param) {
    await User.updateOne(
      { _id: userId },
      { $set: { lastStartPayload: data.start_param } },
    );
  }

  await writeSession({ uid: userId });
  return NextResponse.json({ ok: true, userId });
}
