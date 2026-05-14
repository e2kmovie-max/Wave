"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { CookieRecordView } from "@wave/player";

export function CookiesForm({ initial }: { initial: CookieRecordView[] }) {
  const [cookies, setCookies] = useState<CookieRecordView[]>(initial);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [notes, setNotes] = useState("");
  const [payload, setPayload] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = async () => {
    const res = await fetch("/api/admin/cookies", { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { cookies: CookieRecordView[] };
      setCookies(body.cookies);
    }
  };

  const add = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/cookies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          email: email || undefined,
          userAgent: userAgent || undefined,
          notes: notes || undefined,
          rawPayload: payload,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Add failed (${res.status})`);
        return;
      }
      setLabel("");
      setEmail("");
      setUserAgent("");
      setNotes("");
      setPayload("");
      await refresh();
    });
  };

  const toggle = (id: string, disabled: boolean) => {
    startTransition(async () => {
      await fetch(`/api/admin/cookies/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      await refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/admin/cookies/${id}`, { method: "DELETE" });
      await refresh();
    });
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
          Upload a new account
        </h3>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. throwaway-1)"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <input
          value={userAgent}
          onChange={(e) => setUserAgent(e.target.value)}
          placeholder="User-Agent override (optional)"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional, admin-only)"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder={`Paste Netscape cookies.txt content OR a JSON array of cookies, e.g.:\n.youtube.com\tTRUE\t/\tTRUE\t1893456000\tSID\t...`}
          rows={10}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-accent)]"
        />
        {error && (
          <p className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <div>
          <Button onClick={add} disabled={pending || !label.trim() || !payload.trim()}>
            Upload account
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
          Current pool ({cookies.length})
        </h3>
        {cookies.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No cookies uploaded yet. YouTube downloads will be limited.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-xl border border-[var(--color-border)]">
            {cookies.map((cookie) => (
              <li key={cookie.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {cookie.label}
                    {cookie.disabled && cookie.autoDisabled && (
                      <span className="ml-2 rounded bg-[var(--color-danger)]/20 px-2 py-0.5 text-xs text-[var(--color-danger)]">
                        auto-disabled
                      </span>
                    )}
                    {cookie.disabled && !cookie.autoDisabled && (
                      <span className="ml-2 rounded bg-[var(--color-danger)]/20 px-2 py-0.5 text-xs text-[var(--color-danger)]">
                        disabled
                      </span>
                    )}
                    {cookie.rotationCount > 0 && (
                      <span className="ml-2 rounded bg-white/5 px-2 py-0.5 text-xs text-[var(--color-muted)]">
                        rotations: {cookie.rotationCount}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {cookie.email ?? "—"} · used {cookie.usageCount}× ·
                    last {cookie.lastUsedAt ? new Date(cookie.lastUsedAt).toISOString().slice(0, 10) : "never"}
                  </p>
                  {cookie.disabledReason && (
                    <p className="truncate text-xs text-[var(--color-danger)]">
                      {cookie.disabledReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={cookie.disabled ? "primary" : "secondary"}
                    disabled={pending}
                    onClick={() => toggle(cookie.id, !cookie.disabled)}
                  >
                    {cookie.disabled ? "Enable" : "Disable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={pending}
                    onClick={() => remove(cookie.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
