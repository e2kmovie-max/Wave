import type { Context, SessionFlavor } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";
import type { UserDoc } from "@wave/shared";
import type { HydratedDocument } from "mongoose";

export interface SessionData {
  /** Currently in-progress action key, used by future conversations. */
  pending?: string;
}

/**
 * Augmented bot context. We attach the resolved Wave user (loaded from Mongo
 * by middleware) so handlers can access subscription/admin state without
 * round-tripping the DB themselves.
 */
export interface WaveContextExtra {
  user?: HydratedDocument<UserDoc> | null;
  isAdmin: boolean;
}

type BaseContext = Context & SessionFlavor<SessionData> & WaveContextExtra;

export type WaveContext = ConversationFlavor<BaseContext>;
