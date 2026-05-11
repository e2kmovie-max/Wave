"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { RequiredChannelView } from "@wave/shared";

type Channel = RequiredChannelView;

export function ChannelsForm({ initial }: { initial: Channel[] }) {
  const [channels, setChannels] = useState<Channel[]>(initial);
  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = async () => {
    const res = await fetch("/api/admin/channels", { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { channels: Channel[] };
      setChannels(body.channels);
    }
  };

  const add = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId: input, title, inviteLink: inviteLink || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Add failed (${res.status})`);
        return;
      }
      setInput("");
      setTitle("");
      setInviteLink("");
      await refresh();
    });
  };

  const toggle = (id: string, enabled: boolean) => {
    startTransition(async () => {
      await fetch(`/api/admin/channels/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/admin/channels/${id}`, { method: "DELETE" });
      await refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
          Add channel
        </label>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="@channel_username  or  -1001234567890"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Display name (optional)"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] md:w-64"
          />
        </div>
        <input
          value={inviteLink}
          onChange={(e) => setInviteLink(e.target.value)}
          placeholder="Invite link (optional, used for private channels)"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        {error && (
          <p className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <div>
          <Button disabled={pending || !input.trim()} onClick={add}>
            Add channel
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <h3 className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
          Current list ({channels.length})
        </h3>
        {channels.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No required channels. OP is effectively disabled.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-xl border border-[var(--color-border)]">
            {channels.map((channel) => (
              <li key={channel.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{channel.title}</p>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    <code>{channel.chatId}</code>
                    {channel.inviteLink ? ` · ${channel.inviteLink}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={channel.enabled ? "secondary" : "primary"}
                    disabled={pending}
                    onClick={() => toggle(channel.id, !channel.enabled)}
                  >
                    {channel.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={pending}
                    onClick={() => remove(channel.id)}
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
