"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CreateRoomForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        missing?: Array<{ chatId: string; title: string; inviteLink?: string }>;
      };
      if (!res.ok || !data.url) {
        if (data.error === "subscription_required" && data.missing?.length) {
          const channels = data.missing
            .map((m) => m.title || m.chatId)
            .join(", ");
          setError(
            `Subscribe to the required channels first: ${channels}. ` +
              `Then press “Create room” again.`,
          );
        } else {
          setError(data.error ?? "Could not create room.");
        }
        return;
      }
      router.push(data.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3 shadow-2xl shadow-black/20 backdrop-blur md:flex-row"
    >
      <input
        className="min-h-12 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm outline-none transition focus:border-[var(--color-accent)]"
        placeholder="Paste YouTube / video URL"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        disabled={loading}
      />
      <Button size="lg" type="submit" disabled={loading || !url.trim()}>
        {loading ? "Preparing…" : "Create room"}
      </Button>
      {error && <p className="text-sm text-[var(--color-danger)] md:basis-full">{error}</p>}
    </form>
  );
}
