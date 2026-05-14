import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectMongo, User, getEnv, type UserDoc } from "@wave/interface";
import { readSession } from "@/lib/session";
import type { HydratedDocument } from "mongoose";

export interface AdminCheckSuccess {
  status: "ok";
  user: HydratedDocument<UserDoc>;
}

export type AdminCheckResult =
  | AdminCheckSuccess
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: HydratedDocument<UserDoc> };

/**
 * Validates that the caller is a signed-in admin. An admin is a user who
 * either:
 *  - has `isAdmin:true` on their Wave doc (e.g. they're an ADMIN_TELEGRAM_IDS
 *    admin who has used the bot at least once); or
 *  - has a Google account whose email is listed in ADMIN_GOOGLE_EMAILS.
 */
export async function checkAdmin(): Promise<AdminCheckResult> {
  const session = await readSession();
  if (!session || !Types.ObjectId.isValid(session.uid)) {
    return { status: "unauthenticated" };
  }
  await connectMongo();
  const user = await User.findById(session.uid);
  if (!user) return { status: "unauthenticated" };

  const env = getEnv();
  const emailMatch = Boolean(
    user.googleEmail && env.ADMIN_GOOGLE_EMAILS.includes(user.googleEmail.toLowerCase()),
  );
  const isAdmin = Boolean(user.isAdmin) || emailMatch;
  if (isAdmin) {
    if (!user.isAdmin && emailMatch) {
      // First time hitting /admin from an env-listed email — sticky it on the doc.
      user.isAdmin = true;
      await user.save();
    }
    return { status: "ok", user };
  }
  return { status: "forbidden", user };
}

/** Server-component / server-action helper: redirects on failure. */
export async function requireAdminUser(): Promise<HydratedDocument<UserDoc>> {
  const result = await checkAdmin();
  if (result.status === "unauthenticated") redirect("/login?next=/admin");
  if (result.status === "forbidden") redirect("/?error=not_admin");
  return result.user;
}
