import { Composer, InlineKeyboard } from "grammy";
import {
  CookiePoolError,
  deleteCookieAccount,
  listCookieAccounts,
  setCookieAccountDisabled,
  type CookieRecordView,
} from "@wave/shared";
import type { WaveContext } from "../context";
import { editOrReply } from "./index";
import { ADD_COOKIES_CONVERSATION } from "../conversations/add-cookies";

const CB_ADD = "wv:admin:cookies:add";
const CB_TOGGLE = /^wv:admin:cookies:toggle:([0-9a-f]{24})$/;
const CB_DELETE = /^wv:admin:cookies:delete:([0-9a-f]{24})$/;

export interface AdminView {
  text: string;
  keyboard: InlineKeyboard;
}

export async function renderCookies(ctx: WaveContext): Promise<AdminView> {
  const accounts = await listCookieAccounts();
  const lines = [`<b>${escapeHtml(ctx.t("admin.menu_cookies"))}</b>`];
  lines.push(ctx.t("admin.cookies.title"));
  if (accounts.length === 0) {
    lines.push("");
    lines.push(`<i>${escapeHtml(ctx.t("admin.cookies.empty"))}</i>`);
  } else {
    lines.push("");
    for (const account of accounts) {
      const flag = account.disabled ? "⛔" : "🟢";
      const usage = account.usageCount ? ` · ×${account.usageCount}` : "";
      const lastUsed = account.lastUsedAt ? ` · ${formatDate(account.lastUsedAt)}` : "";
      lines.push(`${flag} <b>${escapeHtml(account.label)}</b>${usage}${lastUsed}`);
      if (account.email) lines.push(`   <code>${escapeHtml(account.email)}</code>`);
      if (account.disabled && account.disabledReason) {
        lines.push(`   <i>${escapeHtml(account.disabledReason)}</i>`);
      }
    }
  }
  const keyboard = new InlineKeyboard()
    .text(ctx.t("admin.cookies.add_btn"), CB_ADD).row();
  for (const account of accounts) {
    keyboard
      .text(`${account.disabled ? "▶" : "⏸"} ${truncate(account.label, 24)}`, `wv:admin:cookies:toggle:${account.id}`)
      .text("🗑", `wv:admin:cookies:delete:${account.id}`)
      .row();
  }
  keyboard.text(ctx.t("common.back"), "wv:admin:home");
  return { text: lines.join("\n"), keyboard };
}

export const cookiesAdmin = new Composer<WaveContext>();

cookiesAdmin.callbackQuery(CB_ADD, async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter(ADD_COOKIES_CONVERSATION);
});

cookiesAdmin.callbackQuery(CB_TOGGLE, async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  const id = ctx.match?.[1];
  if (!id) {
    await ctx.answerCallbackQuery();
    return;
  }
  const accounts = await listCookieAccounts();
  const target = accounts.find((c) => c.id === id);
  if (target) {
    await setCookieAccountDisabled(id, !target.disabled, "manually toggled");
  }
  await ctx.answerCallbackQuery({
    text: target?.disabled ? ctx.t("common.enabled") : ctx.t("common.disabled"),
  });
  const view = await renderCookies(ctx);
  await editOrReply(ctx, view.text, view.keyboard);
});

cookiesAdmin.callbackQuery(CB_DELETE, async (ctx) => {
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
    await deleteCookieAccount(id);
    await ctx.answerCallbackQuery({ text: ctx.t("common.removed") });
  } catch (err) {
    const msg = err instanceof CookiePoolError ? err.message : ctx.t("common.error_generic");
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
  }
  const view = await renderCookies(ctx);
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export type { CookieRecordView };
