import { cookies } from "next/headers";
import { signToken, verifyToken } from "@wave/interface";

const SESSION_COOKIE = "wave_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  /** Mongo ObjectId of the user as a string. */
  uid: string;
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return verifyToken<Session>(value);
}

export async function writeSession(session: Session): Promise<void> {
  const jar = await cookies();
  const token = signToken(session, SESSION_TTL_SECONDS);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}
