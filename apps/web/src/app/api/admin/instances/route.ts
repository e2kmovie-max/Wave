import { NextResponse } from "next/server";
import {
  InstancePoolError,
  addAdminInstance,
  connectMongo,
  listInstances,
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
  return NextResponse.json({ instances: await listInstances() });
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
    typeof body.name !== "string" ||
    typeof body.url !== "string" ||
    typeof body.secret !== "string"
  ) {
    return NextResponse.json(
      { error: "name, url, and secret are required" },
      { status: 400 },
    );
  }
  try {
    await connectMongo();
    const doc = await addAdminInstance({
      name: body.name,
      url: body.url,
      secret: body.secret,
      isLocal: typeof body.isLocal === "boolean" ? body.isLocal : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      maxStreams: typeof body.maxStreams === "number" ? body.maxStreams : undefined,
    });
    return NextResponse.json({ id: String(doc._id) });
  } catch (err) {
    if (err instanceof InstancePoolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[wave] admin add instance failed:", err);
    return NextResponse.json({ error: "add_failed" }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
