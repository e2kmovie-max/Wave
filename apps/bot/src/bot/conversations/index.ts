import { Composer } from "grammy";
import type { WaveContext } from "../context";
import { addChannelConversation } from "./add-channel";
import { addCookiesConversation } from "./add-cookies";
import { addInstanceConversation } from "./add-instance";

/**
 * Aggregates every Conversation we expose. The grammY `conversations()`
 * plugin must be registered on the bot before this composer is used.
 */
export const conversationsComposer = new Composer<WaveContext>();
conversationsComposer.use(addChannelConversation);
conversationsComposer.use(addCookiesConversation);
conversationsComposer.use(addInstanceConversation);
