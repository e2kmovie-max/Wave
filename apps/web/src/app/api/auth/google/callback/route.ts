import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectMongo, User, isGoogleOAuthConfigured } from "@wave/interface";
import { exchangeCodeForProfile, parseGoogleAuthState } from "@/lib/google-oauth";
import { writeSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_disabled", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const stateToken = req.nextUrl.searchParams.get("state") ?? "";
  const errorParam = req.nextUrl.searchParams.get("error");
  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorParam)}`, req.url),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  const state = parseGoogleAuthState(stateToken);
  if (!state) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", req.url));
  }

  let profile;
  try {
    profile = await exchangeCodeForProfile(code);
  } catch (e) {
    console.error("[google callback] exchange failed", e);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  await connectMongo();

  const update = {
    googleId: profile.sub,
    googleEmail: profile.email,
    googleName: profile.name,
    googleAvatar: profile.picture,
    isGuest: false,
  };

  let userId: string;
  if (state.linkUid && Types.ObjectId.isValid(state.linkUid)) {
    // Link Google identity onto an existing (Telegram) user.
    const existingByGoogle = await User.findOne({ googleId: profile.sub });
    if (existingByGoogle && String(existingByGoogle._id) !== state.linkUid) {
      return NextResponse.redirect(
        new URL("/account?error=google_already_linked", req.url),
      );
    }
    const updated = await User.findByIdAndUpdate(state.linkUid, update, { new: true });
    if (!updated) {
      return NextResponse.redirect(new URL("/login?error=session_expired", req.url));
    }
    userId = String(updated._id);
  } else {
    const user = await User.findOneAndUpdate(
      { googleId: profile.sub },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    userId = String(user._id);
  }

  await writeSession({ uid: userId });
  const next = state.next && state.next.startsWith("/") ? state.next : "/";
  return NextResponse.redirect(new URL(next, req.url));
}
