"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string } };
  ready(): void;
  expand(): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type Status =
  | { state: "idle" }
  | { state: "verifying" }
  | { state: "ok"; userId: string }
  | { state: "error"; message: string };

export function MiniAppAuth() {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [link, setLink] = useState(false);

  const verify = useCallback(async (initData: string, asLink: boolean) => {
    setStatus({ state: "verifying" });
    try {
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData, link: asLink }),
      });
      const data = (await res.json()) as { ok?: boolean; userId?: string; error?: string };
      if (!res.ok || !data.ok || !data.userId) {
        setStatus({ state: "error", message: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setStatus({ state: "ok", userId: data.userId });
    } catch (e) {
      setStatus({ state: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    const wa = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    if (!wa) return;
    wa.ready();
    wa.expand();
    if (wa.initData) {
      void verify(wa.initData, false);
    }
  }, [verify]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Telegram Mini App</CardTitle>
        <CardDescription>
          Wave verifies your Telegram <code>initData</code> against the bot
          token, then signs you in here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status.state === "idle" && (
          <p className="text-sm text-[var(--color-muted)]">
            Waiting for the Telegram WebApp environment to provide{" "}
            <code>initData</code>. If you opened this page outside Telegram,
            this will stay idle.
          </p>
        )}
        {status.state === "verifying" && (
          <p className="text-sm">Verifying with the server…</p>
        )}
        {status.state === "ok" && (
          <p className="text-sm">
            Signed in as user <code>{status.userId}</code>. You can close this
            and return to the bot.
          </p>
        )}
        {status.state === "error" && (
          <p className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
            {status.message}
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={link}
            onChange={(e) => setLink(e.target.checked)}
          />
          Link this Telegram identity to my currently signed-in Google account
        </label>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const wa = window.Telegram?.WebApp;
            if (wa?.initData) void verify(wa.initData, link);
            else
              setStatus({
                state: "error",
                message:
                  "Telegram WebApp is not present. Open this URL via your bot’s Mini App.",
              });
          }}
        >
          Re-run verification
        </Button>
      </CardContent>
    </Card>
  );
}
