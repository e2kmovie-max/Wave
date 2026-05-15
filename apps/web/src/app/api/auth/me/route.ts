import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectMongo, User } from "@wave/interface";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session || !Types.ObjectId.isValid(session.uid)) {
    return NextResponse.json({ user: null });
  }
  await connectMongo();
  const user = await User.findById(session.uid).lean();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: String(user._id),
      isAdmin: user.isAdmin ?? false,
      guest: user.isGuest
        ? {
            name: user.guestName,
          }
        : null,
      google: user.googleId
        ? {
            id: user.googleId,
            email: user.googleEmail,
            name: user.googleName,
            avatar: user.googleAvatar,
          }
        : null,
      telegram: user.telegramId
        ? {
            id: user.telegramId,
            username: user.telegramUsername,
            firstName: user.telegramFirstName,
            lastName: user.telegramLastName,
            photoUrl: user.telegramPhotoUrl,
          }
        : null,
    },
  });
}
