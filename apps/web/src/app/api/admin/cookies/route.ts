import { NextResponse } from "next/server";
import {
  CookiePoolError,
  addCookieAccount,
  connectMongo,
  listCookieAccounts,
} from "@wave/player";
import { checkAdmin } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await checkAdmin();
  if (guard.status !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await connectMongo();
  return NextResponse.json({ cookies: await listCookieAccounts() });
}

export async function POST(request: Request) {
  const guard = await checkAdmin();
  if (guard.status !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    typeof body.label !== "string" ||
    typeof body.rawPayload !== "string"
  ) {
    return NextResponse.json(
      { error: "label and rawPayload are required" },
      { status: 400 },
    );
  }
  try {
    await connectMongo();
    const doc = await addCookieAccount({
      label: body.label,
      rawPayload: body.rawPayload,
      email: typeof body.email === "string" ? body.email : undefined,
      userAgent: typeof body.userAgent === "string" ? body.userAgent : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return NextResponse.json({ id: String(doc._id) });
  } catch (err) {
    if (err instanceof CookiePoolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[wave] admin add cookie failed:", err);
    return NextResponse.json({ error: "add_failed" }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
