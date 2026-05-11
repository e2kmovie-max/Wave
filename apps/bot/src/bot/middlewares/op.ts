/**
 * Helpers for the "обязательная подписка" (OP) gate.
 *
 * The bot calls `findUserMissingChannels` to figure out which RequiredChannels
 * the current user is still missing, then either lets the action through or
 * shows the subscription prompt via `sendSubscriptionPrompt`.
 *
 * Telegram only lets us call `getChatMember` if the bot is a member/admin in
 * the chat. When `getChatMember` errors we treat the user as still-missing
 * (so the admin sees the issue) and log a warning.
 */

import type { Api } from "grammy";
import { InlineKeyboard } from "grammy";
import {
  findMissingSubscriptions,
  listEnabledRequiredChannels,
  User,
  type RequiredChannelLite,
} from "@wave/shared";
import type { WaveContext } from "../context";

export const OP_CONTINUE_CALLBACK = "op:continue";

export interface OpCheckResult {
  /** Channels the user has not subscribed to (in the original sort order). */
  missing: RequiredChannelLite[];
  /** True when the user has cleared all enabled required channels. */
  passed: boolean;
}

export async function findUserMissingChannels(
  api: Api,
  telegramId: number,
): Promise<OpCheckResult> {
  const channels = await listEnabledRequiredChannels();
  if (channels.length === 0) return { missing: [], passed: true };

  const statuses: Record<string, string | null> = {};
  for (const channel of channels) {
    try {
      const member = await api.getChatMember(channel.chatId, telegramId);
      statuses[channel.chatId] = member.status;
    } catch (err) {
      const reason = (err as Error).message;
      console.warn(
        `[bot] getChatMember failed for ${channel.chatId} / user ${telegramId}: ${reason}`,
      );
      statuses[channel.chatId] = null;
    }
  }
  const lite: RequiredChannelLite[] = channels.map((doc) => ({
    chatId: doc.chatId,
    title: doc.title,
    inviteLink: doc.inviteLink ?? undefined,
  }));
  const missing = findMissingSubscriptions(lite, statuses);
  return { missing, passed: missing.length === 0 };
}

export function buildSubscriptionKeyboard(
  missing: RequiredChannelLite[],
  continueLabel: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const channel of missing) {
    const url = subscriptionUrl(channel);
    if (url) keyboard.url(channel.title || channel.chatId, url).row();
    else keyboard.text(channel.title || channel.chatId, "op:noop").row();
  }
  keyboard.text(continueLabel, OP_CONTINUE_CALLBACK);
  return keyboard;
}

function subscriptionUrl(channel: RequiredChannelLite): string | null {
  if (channel.inviteLink) return channel.inviteLink;
  if (channel.chatId.startsWith("@")) {
    return `https://t.me/${channel.chatId.slice(1)}`;
  }
  return null;
}

export async function sendSubscriptionPrompt(
  ctx: WaveContext,
  missing: RequiredChannelLite[],
): Promise<void> {
  const keyboard = buildSubscriptionKeyboard(missing, ctx.t("op.continue_btn"));
  await ctx.reply(ctx.t("op.title"), { reply_markup: keyboard });
}

/**
 * Persists OP state on the User doc so the web app can read it without
 * re-calling Telegram on every request.
 */
export async function persistOpResult(
  telegramId: number,
  passed: boolean,
): Promise<void> {
  await User.updateOne(
    { telegramId },
    { $set: { hasPassedOp: passed, lastOpAt: new Date() } },
  );
}
