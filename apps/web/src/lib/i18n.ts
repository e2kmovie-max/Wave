/**
 * Server-side language detection for the Next.js web app.
 *
 * The actual string table + heuristics live behind `@wave/interface` so they're
 * shared with the bot. This module just wires the Next request primitives
 * (`headers()`, `cookies()`) into the shared helper and re-exports the
 * `t(lang, key)` function for convenience in server components.
 */

import { cookies, headers } from "next/headers";
import { pickWebLang, t, type I18nKey, type Lang } from "@wave/interface";

/** The cookie name used to persist the user's explicit language override. */
export const LANG_COOKIE_NAME = "wave_lang";

/**
 * Read the preferred language for the current request from the
 * `wave_lang` cookie + `Accept-Language` header. Safe to call from any server
 * component / route handler.
 */
export async function getCurrentLang(): Promise<Lang> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return pickWebLang({
    cookieValue: cookieStore.get(LANG_COOKIE_NAME)?.value ?? null,
    acceptLanguage: headerList.get("accept-language"),
  });
}

/** Convenience: a `t(key)` closure bound to the current request's language. */
export async function getTranslator(): Promise<{
  lang: Lang;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
}> {
  const lang = await getCurrentLang();
  return {
    lang,
    t: (key, vars) => t(lang, key, vars),
  };
}
