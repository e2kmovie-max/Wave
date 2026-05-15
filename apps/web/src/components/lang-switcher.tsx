"use client";

import { useRef } from "react";
import { SUPPORTED_WEB_LANGS, type Lang } from "@wave/interface/i18n";

/**
 * Compact language switcher. Posts to `/api/lang` so it round-trips through
 * the Next route handler and re-renders the page in the new language without
 * relying on client-side translation. Falls back to a Submit button if the
 * client has JavaScript disabled.
 */
export function LangSwitcher({ current }: { current: Lang }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action="/api/lang"
      method="post"
      className="inline-flex items-center gap-1"
    >
      <label htmlFor="wave-lang" className="sr-only">
        Language
      </label>
      <select
        id="wave-lang"
        name="lang"
        defaultValue={current}
        className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm"
        onChange={() => formRef.current?.submit()}
      >
        {SUPPORTED_WEB_LANGS.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.label}
          </option>
        ))}
      </select>
      <noscript>
        <button
          type="submit"
          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm"
        >
          Set
        </button>
      </noscript>
    </form>
  );
}
