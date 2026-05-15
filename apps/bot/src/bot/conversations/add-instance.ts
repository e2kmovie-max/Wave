import { type Conversation, createConversation } from "@grammyjs/conversations";
import { InstancePoolError, addAdminInstance } from "@wave/player";
import type { WaveContext } from "../context";

export const ADD_INSTANCE_CONVERSATION = "add-instance";

const URL_RE = /^https?:\/\/[^\s]+$/i;

export const addInstanceConversation = createConversation<WaveContext, WaveContext>(
  async (conversation: Conversation<WaveContext, WaveContext>, ctx) => {
    await ctx.reply(ctx.t("admin.instances.name_prompt"));
    const nameCtx = await conversation.waitFor("message:text");
    const name = nameCtx.message.text.trim();

    let url = "";
    while (!url) {
      await ctx.reply(ctx.t("admin.instances.url_prompt"));
      const urlCtx = await conversation.waitFor("message:text");
      const candidate = urlCtx.message.text.trim();
      if (!URL_RE.test(candidate)) {
        await urlCtx.reply(ctx.t("admin.instances.url_invalid"));
        continue;
      }
      url = candidate;
    }

    await ctx.reply(ctx.t("admin.instances.secret_prompt"));
    const secretCtx = await conversation.waitFor("message:text");
    const secret = secretCtx.message.text.trim();

    try {
      await addAdminInstance({
        name,
        url,
        secret,
        isLocal: /^https?:\/\/(localhost|127\.)/i.test(url),
      });
      await secretCtx.reply(ctx.t("common.added"));
    } catch (err) {
      if (err instanceof InstancePoolError) {
        await secretCtx.reply(
          err.status === 409 ? ctx.t("admin.instances.duplicate") : err.message,
        );
        return;
      }
      await secretCtx.reply(ctx.t("common.error_generic"));
    }
  },
  { id: ADD_INSTANCE_CONVERSATION },
);
