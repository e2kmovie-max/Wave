import { Bot, session } from "grammy";
import { conversations } from "@grammyjs/conversations";
import { createWatchRoom, getEnv, WatchPartyError } from "@wave/shared";
import type { WaveContext, SessionData } from "./context";
import { authMiddleware } from "./middlewares/auth";
import { startHandler } from "./handlers/start";

export function createBot(token: string): Bot<WaveContext> {
  const bot = new Bot<WaveContext>(token);

  bot.use(
    session<SessionData, WaveContext>({
      initial: () => ({}),
    }),
  );
  bot.use(conversations());
  bot.use(authMiddleware);

  bot.use(startHandler);

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (!/^https?:\/\//.test(ctx.message.text)) {
      await ctx.reply(
        "Send me a video URL (YouTube etc.) and I'll start a watch room.",
      );
      return;
    }
    if (!ctx.user?._id) {
      await ctx.reply("I could not identify your Wave account. Press /start and try again.");
      return;
    }
    const progress = await ctx.reply("Preparing your watch room…");
    try {
      const room = await createWatchRoom({
        ownerId: ctx.user._id,
        url: ctx.message.text,
        source: "bot",
      });
      const env = getEnv();
      const webUrl = `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/rooms/${room.code}`;
      const invite = env.BOT_USERNAME && room.botPayload
        ? `https://t.me/${env.BOT_USERNAME}?start=${room.botPayload}`
        : webUrl;
      await ctx.api.editMessageText(
        ctx.chat.id,
        progress.message_id,
        [
          "Room is ready.",
          "",
          `Open: ${webUrl}`,
          `Invite: ${invite}`,
        ].join("\n"),
      );
    } catch (err) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        progress.message_id,
        err instanceof WatchPartyError
          ? err.message
          : "Could not create a room for this URL. Try again later.",
      );
    }
  });

  return bot;
}
