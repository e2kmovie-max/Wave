/**
 * Bot admin entry point.
 *
 * Wires `/admin` to the menu and routes the menu's inline-keyboard callbacks
 * into the section composers (channels / cookies / instances). Each section
 * lives in its own module and exposes:
 *   - a `render*` helper that produces text + keyboard for the current state;
 *   - a Composer with the section's callback handlers.
 *
 * All callbacks share the `wv:admin:` prefix so a single regex can route them
 * back to the matching section when needed.
 */

import { Composer, InlineKeyboard } from "grammy";
import type { WaveContext } from "../context";
import { channelsAdmin, renderChannels } from "./channels";
import { cookiesAdmin, renderCookies } from "./cookies";
import { instancesAdmin, renderInstances } from "./instances";

export const adminComposer = new Composer<WaveContext>();

function adminOnly<T extends WaveContext>(handler: (ctx: T) => Promise<void>) {
  return async (ctx: T) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t("common.not_admin"));
      return;
    }
    await handler(ctx);
  };
}

function buildMenu(ctx: WaveContext): InlineKeyboard {
  return new InlineKeyboard()
    .text(ctx.t("admin.menu_channels"), "wv:admin:channels").row()
    .text(ctx.t("admin.menu_cookies"), "wv:admin:cookies").row()
    .text(ctx.t("admin.menu_instances"), "wv:admin:instances").row()
    .text(ctx.t("admin.menu_close"), "wv:admin:close");
}

adminComposer.command(
  "admin",
  adminOnly(async (ctx) => {
    await ctx.reply(ctx.t("admin.menu_title"), { reply_markup: buildMenu(ctx) });
  }),
);

adminComposer.callbackQuery("wv:admin:home", async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await editOrReply(ctx, ctx.t("admin.menu_title"), buildMenu(ctx));
});

adminComposer.callbackQuery("wv:admin:close", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.callbackQuery?.message) {
    await ctx.api
      .deleteMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id)
      .catch(() => {});
  }
});

adminComposer.callbackQuery("wv:admin:channels", async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  const view = await renderChannels(ctx);
  await editOrReply(ctx, view.text, view.keyboard);
});

adminComposer.callbackQuery("wv:admin:cookies", async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  const view = await renderCookies(ctx);
  await editOrReply(ctx, view.text, view.keyboard);
});

adminComposer.callbackQuery("wv:admin:instances", async (ctx) => {
  if (!ctx.isAdmin) {
    await ctx.answerCallbackQuery({ text: ctx.t("common.not_admin"), show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  const view = await renderInstances(ctx);
  await editOrReply(ctx, view.text, view.keyboard);
});

adminComposer.use(channelsAdmin);
adminComposer.use(cookiesAdmin);
adminComposer.use(instancesAdmin);

export async function editOrReply(
  ctx: WaveContext,
  text: string,
  keyboard: InlineKeyboard,
): Promise<void> {
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "HTML" });
      return;
    } catch {
      // fall through to a fresh reply when the message can't be edited
    }
  }
  await ctx.reply(text, { reply_markup: keyboard, parse_mode: "HTML" });
}
