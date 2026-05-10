import { getEnv, signToken, verifyToken } from "@wave/shared";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const STATE_TTL_SECONDS = 600; // 10 min

export function googleCallbackUrl(): string {
  const { PUBLIC_WEB_URL } = getEnv();
  return `${PUBLIC_WEB_URL.replace(/\/$/, "")}/api/auth/google/callback`;
}

export interface GoogleAuthState {
  /** Optional path to redirect to after sign-in. */
  next?: string;
  /** When set, this is a "link Google to existing user" flow for that user id. */
  linkUid?: string;
}

export function buildGoogleAuthUrl(state: GoogleAuthState): string {
  const env = getEnv();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: googleCallbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state: signToken(state, STATE_TTL_SECONDS),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function parseGoogleAuthState(stateToken: string): GoogleAuthState | null {
  return verifyToken<GoogleAuthState>(stateToken);
}

export interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const env = getEnv();
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleCallbackUrl(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${detail}`);
  }
  const tok = (await tokenRes.json()) as { access_token: string };
  const userRes = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${tok.access_token}` },
  });
  if (!userRes.ok) {
    const detail = await userRes.text();
    throw new Error(`Google userinfo failed: ${userRes.status} ${detail}`);
  }
  return (await userRes.json()) as GoogleProfile;
}
