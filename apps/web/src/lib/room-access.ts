import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectMongo, User } from "@wave/shared";
import { readSession } from "@/lib/session";

export async function requireCurrentUser(next?: string) {
  const session = await readSession();
  if (!session || !Types.ObjectId.isValid(session.uid)) {
    redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  await connectMongo();
  const user = await User.findById(session.uid);
  if (!user) redirect("/login");
  return user;
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await readSession();
  if (!session || !Types.ObjectId.isValid(session.uid)) return null;
  await connectMongo();
  const exists = await User.exists({ _id: session.uid });
  return exists ? session.uid : null;
}
