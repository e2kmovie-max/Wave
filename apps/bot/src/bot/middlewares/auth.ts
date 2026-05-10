import type { MiddlewareFn } from "grammy";
import { User, getEnv } from "@wave/shared";
import type { WaveContext } from "../context";

/**
 * Loads / upserts the Wave user for the incoming Telegram update and decides
 * whether they should be treated as an admin (based on `ADMIN_TELEGRAM_IDS`).
 */
export const authMiddleware: MiddlewareFn<WaveContext> = async (ctx, next) => {
  ctx.isAdmin = false;
  ctx.user = null;
  const tgUser = ctx.from;
  if (!tgUser) return next();

  const env = getEnv();
  const isAdmin = env.ADMIN_TELEGRAM_IDS.includes(tgUser.id);

  const user = await User.findOneAndUpdate(
    { telegramId: tgUser.id },
    {
      $set: {
        telegramId: tgUser.id,
        telegramUsername: tgUser.username,
        telegramFirstName: tgUser.first_name,
        telegramLastName: tgUser.last_name,
        ...(isAdmin ? { isAdmin: true } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  ctx.user = user;
  ctx.isAdmin = Boolean(user.isAdmin) || isAdmin;
  return next();
};
