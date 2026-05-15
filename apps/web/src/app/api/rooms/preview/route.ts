import { NextResponse } from "next/server";
import { connectMongo, previewVideo, WatchPartyError } from "@wave/player";
import { requireCurrentUser } from "@/lib/room-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireCurrentUser("/");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.url !== "string") {
    return NextResponse.json({ error: "url_required" }, { status: 400 });
  }

  try {
    await connectMongo();
    const preview = await previewVideo(body.url);
    return NextResponse.json({
      video: {
        title: preview.info.title,
        duration: preview.info.duration,
        thumbnail: preview.info.thumbnail,
        uploader: preview.info.uploader ?? preview.info.channel,
        formats: preview.formats,
        selectedFormatId: preview.selectedFormatId,
        quality: preview.quality,
      },
      instance: {
        name: preview.instance.name,
        url: preview.instance.url,
      },
    });
  } catch (err) {
    if (err instanceof WatchPartyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[wave] video preview failed:", err);
    return NextResponse.json({ error: "preview_failed" }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
