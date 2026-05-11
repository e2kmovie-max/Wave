import { NextResponse } from "next/server";
import { SUPPORTED_WEB_LANGS, type Lang } from "@wave/shared";
import { LANG_COOKIE_NAME } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sets the `wave_lang` cookie used by the server to translate pages on the
 * next render. Accepts JSON `{ "lang": "ru" | "en" }` or a form `lang=` field
 * so a no-JS `<form>` works too.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let lang: string | undefined;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as { lang?: string };
      lang = body?.lang;
    } catch {
      // fall through — invalid JSON behaves like missing input
    }
  } else {
    const form = await request.formData().catch(() => null);
    if (form) lang = form.get("lang")?.toString();
  }
  const trimmed = (lang ?? "").trim().toLowerCase() as Lang;
  if (!SUPPORTED_WEB_LANGS.some((entry) => entry.code === trimmed)) {
    return NextResponse.json({ error: "unsupported_lang" }, { status: 400 });
  }

  // Mirror Next's redirect-after-form pattern: when the caller submitted a
  // form, send them back to the referer; otherwise return JSON.
  const referer = request.headers.get("referer");
  const wantsJson = ct.includes("application/json") || request.headers.get("accept")?.includes("application/json");
  const res = wantsJson
    ? NextResponse.json({ ok: true, lang: trimmed })
    : NextResponse.redirect(referer ?? new URL("/", request.url));
  res.cookies.set(LANG_COOKIE_NAME, trimmed, {
    path: "/",
    httpOnly: false, // accessible to client JS so an in-page switcher can read it
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
