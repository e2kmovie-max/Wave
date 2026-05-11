import { NextRequest, NextResponse } from "next/server";
import { connectMongo, User } from "@wave/shared";
import { writeSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawName = (await readName(req)) ?? "";
  const guestName = normalizeGuestName(rawName);
  await connectMongo();
  const user = await User.create({ guestName, isGuest: true });
  await writeSession({ uid: String(user._id) });

  const next = req.nextUrl.searchParams.get("next");
  return NextResponse.redirect(new URL(next && next.startsWith("/") ? next : "/", req.url), 303);
}

async function readName(req: NextRequest): Promise<string | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
    return typeof body?.name === "string" ? body.name : null;
  }
  const formData = await req.formData().catch(() => null);
  const value = formData?.get("name");
  return typeof value === "string" ? value : null;
}

function normalizeGuestName(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, " ").slice(0, 32);
  return cleaned || `Guest ${Math.floor(1000 + Math.random() * 9000)}`;
}
