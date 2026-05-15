import { Composer, InlineKeyboard } from "grammy";
import {
  InstancePoolError,
  deleteAdminInstance,
  listInstances,
  setInstanceEnabled,
  type InstanceRecordView,
} from "@wave/player";
import type { WaveContext } from "../context";
import { editOrReply } from "./index";
import { ADD_INSTANCE_CONVERSATION } from "../conversations/add-instance";

const CB_ADD = "wv:admin:instances:add";
const CB_TOGGLE = /^wv:admin:instances:toggle:([0-9a-f]{24})$/;
const CB_DELETE = /^wv:admin:instances:delete:([0-9a-f]{24})$/;

export interface AdminView {
  text: string;
  keyboard: InlineKeyboard;
}

export async function renderInstances(ctx: WaveContext): Promise<AdminView> {
  const instances = await listInstances();
  const lines = [`<b>${escapeHtml(ctx.t("admin.menu_instances"))}</b>`];
  lines.push(ctx.t("admin.instances.title"));
  if (instances.length === 0) {
    lines.push("");
    lines.push(`<i>${escapeHtml(ctx.t("admin.instances.empty"))}</i>`);
  } else {
    lines.push("");
    for (const inst of instances) {
      const flag = !inst.enabled ? "⛔" : inst.isHealthy ? "🟢" : "🔴";
      const meta = [
        inst.managedByEnv ? "env" : "admin",
        inst.isLocal ? "local" : null,
        inst.insecure ? "http" : null,
        inst.toolsYtDlp ? `yt-dlp ${inst.toolsYtDlp}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(`${flag} <b>${escapeHtml(inst.name)}</b> — <code>${escapeHtml(inst.url)}</code>`);
      if (meta) lines.push(`   <i>${escapeHtml(meta)}</i>`);
      if (!inst.isHealthy && inst.lastHealthError) {
        lines.push(`   <i>${escapeHtml(truncate(inst.lastHealthError, 80))}</i>`);
      }
    }
  }
  const keyboard = new InlineKeyboard()
    .text(ctx.t("admin.instances.add_btn"), CB_ADD).row();
  for (const inst of instances) {
    keyboard.text(
      `${inst.enabled ? "⏸" : "▶"} ${truncate(inst.name, 24)}`,
      `wv:admin:instances:toggle:${inst.id}`,
    );
    if (!inst.managedByEnv) {
      keyboard.text("🗑", `wv:admin:instances:delete:${inst.id}`);
    }
    keyboard.row();
  }
  keyboard.text(ctx.t("common.back"), "wv:admin:home");
  return { text: lines.join("\n"), keyboard };
}

export const instancesAdmin = new Composer<WaveContext>();

instancesAdmin.callbackQuery(CB_ADD, async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter(ADD_INSTANCE_CONVERSATION);
});

instancesAdmin.callbackQuery(CB_TOGGLE, async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  const id = ctx.match?.[1];
  if (!id) {
    await ctx.answerCallbackQuery();
    return;
  }
  const instances = await listInstances();
  const target = instances.find((i) => i.id === id);
  if (target) {
    await setInstanceEnabled(id, !target.enabled);
  }
  await ctx.answerCallbackQuery({
    text: target?.enabled ? ctx.t("common.disabled") : ctx.t("common.enabled"),
  });
  const view = await renderInstances(ctx);
  await editOrReply(ctx, view.text, view.keyboard);
});

instancesAdmin.callbackQuery(CB_DELETE, async (ctx) => {
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
    await deleteAdminInstance(id);
    await ctx.answerCallbackQuery({ text: ctx.t("common.removed") });
  } catch (err) {
    const msg = err instanceof InstancePoolError ? err.message : ctx.t("common.error_generic");
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
  }
  const view = await renderInstances(ctx);
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

export type { InstanceRecordView };
