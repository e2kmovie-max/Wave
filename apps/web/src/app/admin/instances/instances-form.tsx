"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { InstanceRecordView } from "@wave/player";

export function InstancesForm({ initial }: { initial: InstanceRecordView[] }) {
  const [instances, setInstances] = useState<InstanceRecordView[]>(initial);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [maxStreams, setMaxStreams] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = async () => {
    const res = await fetch("/api/admin/instances", { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { instances: InstanceRecordView[] };
      setInstances(body.instances);
    }
  };

  const add = () => {
    setError(null);
    startTransition(async () => {
      const max = maxStreams.trim() ? Number(maxStreams) : 0;
      const res = await fetch("/api/admin/instances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          secret,
          maxStreams: Number.isFinite(max) && max > 0 ? max : 0,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Add failed (${res.status})`);
        return;
      }
      setName("");
      setUrl("");
      setSecret("");
      setMaxStreams("");
      await refresh();
    });
  };

  const toggle = (id: string, enabled: boolean) => {
    startTransition(async () => {
      await fetch(`/api/admin/instances/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/admin/instances/${id}`, { method: "DELETE" });
      await refresh();
    });
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
          Add an instance
        </h3>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. eu-west-1)"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://stream-1.example.com  or  http://203.0.113.42:8080"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="HMAC secret (INSTANCE_SECRET)"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-accent)]"
        />
        <input
          value={maxStreams}
          onChange={(e) => setMaxStreams(e.target.value)}
          placeholder="Max concurrent streams (0 = unlimited)"
          inputMode="numeric"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        {error && (
          <p className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <div>
          <Button disabled={pending || !name.trim() || !url.trim() || !secret.trim()} onClick={add}>
            Add instance
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
          Instances ({instances.length})
        </h3>
        {instances.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No instances yet. Add one above or list it in <code>INSTANCES_JSON</code>.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-xl border border-[var(--color-border)]">
            {instances.map((inst) => (
              <li key={inst.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {inst.name}
                    {inst.managedByEnv && (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[var(--color-muted)]">
                        env
                      </span>
                    )}
                    {inst.insecure && (
                      <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-300">
                        http
                      </span>
                    )}
                    {!inst.enabled && (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[var(--color-muted)]">
                        disabled
                      </span>
                    )}
                    {inst.enabled && (
                      <span
                        className={
                          inst.isHealthy
                            ? "rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                            : "rounded bg-[var(--color-danger)]/10 px-2 py-0.5 text-xs text-[var(--color-danger)]"
                        }
                      >
                        {inst.isHealthy ? "healthy" : "unhealthy"}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    <code>{inst.url}</code>
                    {inst.toolsYtDlp ? ` · yt-dlp ${inst.toolsYtDlp}` : ""}
                    {inst.toolsFfmpeg ? ` · ffmpeg ${inst.toolsFfmpeg}` : ""}
                    {` · streams ${inst.activeStreams}${inst.maxStreams ? `/${inst.maxStreams}` : ""}`}
                    {inst.consecutiveFailures > 0
                      ? ` · failures: ${inst.consecutiveFailures}`
                      : ""}
                  </p>
                  {!inst.isHealthy && inst.lastHealthError && (
                    <p className="truncate text-xs text-[var(--color-danger)]">
                      {inst.lastHealthError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={inst.enabled ? "secondary" : "primary"}
                    disabled={pending}
                    onClick={() => toggle(inst.id, !inst.enabled)}
                  >
                    {inst.enabled ? "Disable" : "Enable"}
                  </Button>
                  {!inst.managedByEnv && (
                    <Button size="sm" variant="danger" disabled={pending} onClick={() => remove(inst.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
