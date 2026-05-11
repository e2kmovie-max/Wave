import { Composer, InlineKeyboard } from "grammy";
import {
  RequiredChannelError,
  deleteRequiredChannel,
  listRequiredChannels,
  setRequiredChannelEnabled,
  type RequiredChannelView,
} from "@wave/shared";
import type { WaveContext } from "../context";
import { editOrReply } from "./index";
import { ADD_CHANNEL_CONVERSATION } from "../conversations/add-channel";

const CB_ADD = "wv:admin:channels:add";
const CB_TOGGLE = /^wv:admin:channels:toggle:([0-9a-f]{24})$/;
const CB_DELETE = /^wv:admin:channels:delete:([0-9a-f]{24})$/;

export interface AdminView {
  text: string;
  keyboard: InlineKeyboard;
}

export async function renderChannels(ctx: WaveContext): Promise<AdminView> {
  const channels = await listRequiredChannels();
  const lines = [`<b>${escapeHtml(ctx.t("admin.menu_channels"))}</b>`];
  lines.push(ctx.t("admin.channels.title"));
  if (channels.length === 0) {
    lines.push("");
    lines.push(`<i>${escapeHtml(ctx.t("admin.channels.empty"))}</i>`);
  } else {
    lines.push("");
    for (const channel of channels) {
      const flag = channel.enabled ? "🟢" : "⚪️";
      lines.push(`${flag} <code>${escapeHtml(channel.chatId)}</code> — ${escapeHtml(channel.title)}`);
    }
  }
  const keyboard = new InlineKeyboard()
    .text(ctx.t("admin.channels.add_btn"), CB_ADD).row();
  for (const channel of channels) {
    keyboard
      .text(`${channel.enabled ? "🔕" : "🔔"} ${truncate(channel.title, 24)}`, `wv:admin:channels:toggle:${channel.id}`)
      .text("🗑", `wv:admin:channels:delete:${channel.id}`)
      .row();
  }
  keyboard.text(ctx.t("common.back"), "wv:admin:home");
  return { text: lines.join("\n"), keyboard };
}

export const channelsAdmin = new Composer<WaveContext>();

channelsAdmin.callbackQuery(CB_ADD, async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter(ADD_CHANNEL_CONVERSATION);
});

channelsAdmin.callbackQuery(CB_TOGGLE, async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  const id = ctx.match?.[1];
  if (!id) {
    await ctx.answerCallbackQuery();
    return;
  }
  const channels = await listRequiredChannels();
  const target = channels.find((c) => c.id === id);
  if (target) {
    await setRequiredChannelEnabled(id, !target.enabled);
  }
  await ctx.answerCallbackQuery({ text: target?.enabled ? ctx.t("common.disabled") : ctx.t("common.enabled") });
  const view = await renderChannels(ctx);
  await editOrReply(ctx, view.text, view.keyboard);
});

channelsAdmin.callbackQuery(CB_DELETE, async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  const id = ctx.match?.[1];
  if (!id) {
    await ctx.answerCallbackQuery();
    return;
  }
  try {
    await deleteRequiredChannel(id);
    await ctx.answerCallbackQuery({ text: ctx.t("common.removed") });
  } catch (err) {
    const msg = err instanceof RequiredChannelError ? err.message : ctx.t("common.error_generic");
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
  }
  const view = await renderChannels(ctx);
  await editOrReply(ctx, view.text, view.keyboard);
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export const __test__ = { renderChannels };
export type { RequiredChannelView };
