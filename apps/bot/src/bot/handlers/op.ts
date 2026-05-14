import { Composer } from "grammy";
import { getEnv } from "@wave/interface";
import { createWatchRoom, WatchPartyError } from "@wave/player";
import { Room } from "@wave/social";
import type { WaveContext } from "../context";
import {
  OP_CONTINUE_CALLBACK,
  findUserMissingChannels,
  persistOpResult,
  sendSubscriptionPrompt,
} from "../middlewares/op";

/**
 * Replays whatever the user originally tried to do (paste a video URL, open
 * a deeplink) after they have cleared the OP gate.
 */
async function replayPendingAction(ctx: WaveContext): Promise<void> {
  const pending = ctx.session.pendingAction;
  if (!pending) {
    await ctx.reply(ctx.t("op.no_pending"));
    return;
  }
  ctx.session.pendingAction = undefined;
  if (pending.kind === "create_room") {
    await createRoomForUser(ctx, pending.url);
  } else if (pending.kind === "open_room") {
    await openRoomForUser(ctx, pending.code);
  }
}

export async function createRoomForUser(ctx: WaveContext, url: string): Promise<void> {
  if (!ctx.user?._id) {
    await ctx.reply(ctx.t("room.identify_failed"));
    return;
  }
  const progress = await ctx.reply(ctx.t("room.preparing"));
  try {
    const room = await createWatchRoom({
      ownerId: ctx.user._id,
      url,
      source: "bot",
    });
    const env = getEnv();
    const webUrl = `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/rooms/${room.code}`;
    const invite =
      env.BOT_USERNAME && room.botPayload
        ? `https://t.me/${env.BOT_USERNAME}?start=${room.botPayload}`
        : webUrl;
    await ctx.api.editMessageText(
      ctx.chat!.id,
      progress.message_id,
      ctx.t("room.ready_open", { webUrl, invite }),
    );
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      progress.message_id,
      err instanceof WatchPartyError ? err.message : ctx.t("room.create_failed"),
    );
  }
}

export async function openRoomForUser(ctx: WaveContext, code: string): Promise<void> {
  const room = await Room.findOne({ code, isClosed: false }).lean();
  if (!room) {
    await ctx.reply(ctx.t("start.payload_no_room"));
    return;
  }
  const env = getEnv();
  const url = `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/rooms/${room.code}`;
  await ctx.reply(`${ctx.t("start.room_ready")}\n${url}`);
}

export const opHandler = new Composer<WaveContext>();

opHandler.callbackQuery(OP_CONTINUE_CALLBACK, async (ctx) => {
  const tgUser = ctx.from;
  if (!tgUser) {
    await ctx.answerCallbackQuery();
    return;
  }
  const result = await findUserMissingChannels(ctx.api, tgUser.id);
  await persistOpResult(tgUser.id, result.passed);
  if (!result.passed) {
    await ctx.answerCallbackQuery({ text: ctx.t("op.still_missing"), show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery({ text: ctx.t("op.passed") });
  await replayPendingAction(ctx);
});

// No-op for channel buttons we couldn't link to (no invite, no @username).
opHandler.callbackQuery("op:noop", async (ctx) => {
  await ctx.answerCallbackQuery();
});

/**
 * Ensures the user has subscribed before proceeding. If they haven't, queues
 * `pending` on the session and shows the subscription prompt, returning false
 * so the caller can stop.
 */
export async function gateBehindOp(
  ctx: WaveContext,
  pending: NonNullable<WaveContext["session"]["pendingAction"]>,
): Promise<boolean> {
  const tgUser = ctx.from;
  if (!tgUser) return true;
  const result = await findUserMissingChannels(ctx.api, tgUser.id);
  await persistOpResult(tgUser.id, result.passed);
  if (result.passed) return true;
  ctx.session.pendingAction = pending;
  await sendSubscriptionPrompt(ctx, result.missing);
  return false;
}
