import { Bot, session } from "grammy";
import { conversations } from "@grammyjs/conversations";
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

  // Stage-3 placeholder: when a user sends a URL we'll create a room here.
  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (!/^https?:\/\//.test(ctx.message.text)) {
      await ctx.reply(
        "Send me a video URL (YouTube etc.) and I'll start a watch room.",
      );
      return;
    }
    await ctx.reply(
      "Got the link! Room creation lands in stage 3 — for now, your URL was registered.",
    );
  });

  return bot;
}
