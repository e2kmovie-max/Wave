import { connectMongo, getEnv, isBotConfigured } from "@wave/shared";
import { createBot } from "./bot";

async function main() {
  const env = getEnv();
  if (!isBotConfigured(env)) {
    console.warn(
      "[bot] BOT_TOKEN is not set; the bot is in stub mode and will not start. " +
        "Set BOT_TOKEN in .env to launch the Telegram bot.",
    );
    return;
  }

  await connectMongo();
  const bot = createBot(env.BOT_TOKEN);

  bot.catch((err) => {
    console.error("[bot] unhandled error:", err);
  });

  console.log("[bot] starting long-polling…");
  await bot.start({
    onStart: (info) => {
      console.log(`[bot] @${info.username} (id=${info.id}) is online`);
    },
  });
}

main().catch((err) => {
  console.error("[bot] fatal:", err);
  process.exit(1);
});
