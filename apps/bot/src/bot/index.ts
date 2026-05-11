import { Bot, session } from "grammy";
import { conversations } from "@grammyjs/conversations";
import type { WaveContext, SessionData } from "./context";
import { authMiddleware } from "./middlewares/auth";
import { startHandler } from "./handlers/start";
import { opHandler, createRoomForUser, gateBehindOp } from "./handlers/op";
import { adminComposer } from "./admin";
import { conversationsComposer } from "./conversations";

export function createBot(token: string): Bot<WaveContext> {
  const bot = new Bot<WaveContext>(token);

  bot.use(
    session<SessionData, WaveContext>({
      initial: () => ({}),
    }),
  );
  bot.use(conversations());
  bot.use(authMiddleware);

  bot.use(conversationsComposer);

  bot.use(opHandler);
  bot.use(adminComposer);
  bot.use(startHandler);

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (!/^https?:\/\//.test(ctx.message.text)) {
      await ctx.reply(ctx.t("room.send_video_url"));
      return;
    }
    if (!ctx.user?._id) {
      await ctx.reply(ctx.t("room.identify_failed"));
      return;
    }
    const proceed = await gateBehindOp(ctx, {
      kind: "create_room",
      url: ctx.message.text,
    });
    if (!proceed) return;
    await createRoomForUser(ctx, ctx.message.text);
  });

  return bot;
}
