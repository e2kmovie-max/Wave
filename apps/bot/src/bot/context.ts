import type { Context, SessionFlavor } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";
import type { I18nKey, Lang, UserDoc } from "@wave/interface";
import type { HydratedDocument } from "mongoose";

/**
 * Action to resume after the user has cleared OP. Stored on the bot session
 * because callback `data` is capped at 64 bytes and we want richer state.
 */
export type PendingAction =
  | { kind: "create_room"; url: string }
  | { kind: "open_room"; code: string };

export interface SessionData {
  /** Most recent action queued behind the OP gate, replayed after pass. */
  pendingAction?: PendingAction;
}

/**
 * Augmented bot context. We attach the resolved Wave user (loaded from Mongo
 * by middleware) so handlers can access subscription/admin state without
 * round-tripping the DB themselves.
 */
export interface WaveContextExtra {
  user?: HydratedDocument<UserDoc> | null;
  isAdmin: boolean;
  lang: Lang;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

type BaseContext = Context & SessionFlavor<SessionData> & WaveContextExtra;

export type WaveContext = ConversationFlavor<BaseContext>;
