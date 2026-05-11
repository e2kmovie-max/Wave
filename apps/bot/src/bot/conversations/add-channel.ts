import { type Conversation, createConversation } from "@grammyjs/conversations";
import { RequiredChannelError, addRequiredChannel, parseChannelInput } from "@wave/shared";
import type { WaveContext } from "../context";

export const ADD_CHANNEL_CONVERSATION = "add-channel";

export const addChannelConversation = createConversation<WaveContext, WaveContext>(
  async (conversation: Conversation<WaveContext, WaveContext>, ctx) => {
    await ctx.reply(ctx.t("admin.channels.add_prompt"));

    while (true) {
      const next = await conversation.wait();
      const message = next.message ?? next.channelPost;
      if (!message) {
        await next.reply(ctx.t("admin.channels.invalid"));
        continue;
      }
      let parsed: { chatId: string; title: string; inviteLink?: string } | null = null;
      // Case 1: forwarded post from a channel/chat. forward_origin is the new
      // shape used by Bot API 7.x; we read both for robustness.
      const forwardOrigin = (message as { forward_origin?: unknown }).forward_origin;
      if (forwardOrigin && typeof forwardOrigin === "object") {
        const origin = forwardOrigin as {
          type?: string;
          chat?: { id?: number; title?: string; username?: string };
        };
        if (origin.type === "channel" && origin.chat?.id) {
          parsed = {
            chatId: String(origin.chat.id),
            title: origin.chat.title ?? String(origin.chat.id),
          };
        }
      }
      const forwardFromChat = (message as { forward_from_chat?: { id: number; title?: string } })
        .forward_from_chat;
      if (!parsed && forwardFromChat?.id) {
        parsed = {
          chatId: String(forwardFromChat.id),
          title: forwardFromChat.title ?? String(forwardFromChat.id),
        };
      }
      // Case 2: plain text — @username, https://t.me/<name>, or -100…
      if (!parsed && message.text) {
        parsed = parseChannelInput(message.text);
      }

      if (!parsed) {
        await next.reply(ctx.t("admin.channels.invalid"));
        continue;
      }
      try {
        await addRequiredChannel(parsed);
        await next.reply(ctx.t("common.added"));
      } catch (err) {
        if (err instanceof RequiredChannelError) {
          await next.reply(
            err.status === 409 ? ctx.t("admin.channels.duplicate") : err.message,
          );
        } else {
          await next.reply(ctx.t("common.error_generic"));
        }
      }
      return;
    }
  },
  { id: ADD_CHANNEL_CONVERSATION },
);
