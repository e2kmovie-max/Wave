import { type Conversation, createConversation } from "@grammyjs/conversations";
import { CookiePoolError, addCookieAccount } from "@wave/player";
import type { WaveContext } from "../context";

export const ADD_COOKIES_CONVERSATION = "add-cookies";

export const addCookiesConversation = createConversation<WaveContext, WaveContext>(
  async (conversation: Conversation<WaveContext, WaveContext>, ctx) => {
    await ctx.reply(ctx.t("admin.cookies.label_prompt"));
    const labelCtx = await conversation.waitFor("message:text");
    const label = labelCtx.message.text.trim();

    await ctx.reply(ctx.t("admin.cookies.cookies_prompt"));
    while (true) {
      const payloadCtx = await conversation.wait();
      let rawPayload: string | null = null;

      if (payloadCtx.message?.text) {
        rawPayload = payloadCtx.message.text;
      } else if (payloadCtx.message?.document) {
        const file = await payloadCtx.api.getFile(payloadCtx.message.document.file_id);
        if (file.file_path) {
          const url = `https://api.telegram.org/file/bot${payloadCtx.api.token}/${file.file_path}`;
          const res = await fetch(url);
          if (res.ok) rawPayload = await res.text();
        }
      }

      if (!rawPayload) {
        await payloadCtx.reply(ctx.t("admin.cookies.cookies_prompt"));
        continue;
      }

      try {
        await addCookieAccount({ label, rawPayload });
        await payloadCtx.reply(ctx.t("common.added"));
        return;
      } catch (err) {
        if (err instanceof CookiePoolError) {
          await payloadCtx.reply(
            ctx.t("admin.cookies.invalid_payload", { error: err.message }),
          );
          return;
        }
        await payloadCtx.reply(ctx.t("common.error_generic"));
        return;
      }
    }
  },
  { id: ADD_COOKIES_CONVERSATION },
);
