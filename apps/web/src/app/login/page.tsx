import Link from "next/link";
import { isGoogleOAuthConfigured, isBotConfigured, getEnv } from "@wave/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  google_disabled: "Google sign-in is disabled (set GOOGLE_CLIENT_ID / SECRET).",
  invalid_state: "Authorization state expired — please try again.",
  oauth_failed: "Google rejected the sign-in. Please try again.",
  missing_code: "Google did not return an authorization code.",
  session_expired: "Session expired. Please sign in again.",
  access_denied: "You declined Google sign-in.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const env = getEnv();
  const googleReady = isGoogleOAuthConfigured(env);
  const botReady = isBotConfigured(env);
  const next = params.next?.startsWith("/") ? params.next : "/";
  const error = params.error;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in to Wave</CardTitle>
          <CardDescription>
            Pick how you want to get in. You can link the other identity from your
            account page later.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <p className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
              {ERROR_MESSAGES[error] ?? `Error: ${error}`}
            </p>
          )}

          {googleReady ? (
            <a href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}>
              <Button size="lg" className="w-full">
                Continue with Google
              </Button>
            </a>
          ) : (
            <Button size="lg" className="w-full" disabled title="Set GOOGLE_CLIENT_ID/SECRET in .env">
              Continue with Google (not configured)
            </Button>
          )}

          <div className="my-1 flex items-center gap-3 text-xs text-[var(--color-muted)]">
            <span className="h-px flex-1 bg-[var(--color-border)]" />
            or
            <span className="h-px flex-1 bg-[var(--color-border)]" />
          </div>

          {botReady && env.BOT_USERNAME ? (
            <a
              href={`https://t.me/${env.BOT_USERNAME}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="lg" variant="secondary" className="w-full">
                Open the Telegram bot
              </Button>
            </a>
          ) : (
            <Button size="lg" variant="secondary" className="w-full" disabled>
              Telegram bot (not configured)
            </Button>
          )}

          <p className="text-center text-xs text-[var(--color-muted)]">
            Already inside the Telegram bot? Open the Mini App and we’ll sign
            you in automatically.{" "}
            <Link className="underline" href="/miniapp">
              Mini App preview
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
