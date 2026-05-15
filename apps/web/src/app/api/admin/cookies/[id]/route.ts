import { NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  connectMongo,
  deleteCookieAccount,
  setCookieAccountDisabled,
} from "@wave/player";
import { checkAdmin } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await checkAdmin();
  if (guard.status !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.disabled !== "boolean") {
    return NextResponse.json({ error: "disabled_required" }, { status: 400 });
  }
  await connectMongo();
  await setCookieAccountDisabled(
    id,
    body.disabled,
    typeof body.reason === "string" ? body.reason : undefined,
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const guard = await checkAdmin();
  if (guard.status !== "ok") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  await connectMongo();
  await deleteCookieAccount(id);
  return NextResponse.json({ ok: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
