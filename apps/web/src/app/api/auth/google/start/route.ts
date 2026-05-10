import { NextRequest, NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@wave/shared";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "google_oauth_not_configured",
        message:
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment to enable Google sign-in.",
      },
      { status: 503 },
    );
  }
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  const link = req.nextUrl.searchParams.get("link") === "1";

  const session = link ? await readSession() : null;
  const state = link && session ? { next, linkUid: session.uid } : { next };
  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
