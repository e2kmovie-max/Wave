import { redirect } from "next/navigation";
import Link from "next/link";
import { Types } from "mongoose";
import { connectMongo, User, getEnv, isGoogleOAuthConfigured } from "@wave/shared";
import { readSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const LINK_ERROR_MESSAGES: Record<string, string> = {
  google_already_linked:
    "That Google account is already attached to a different Wave user.",
  telegram_already_linked:
    "That Telegram account is already attached to a different Wave user.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readSession();
  if (!session || !Types.ObjectId.isValid(session.uid)) redirect("/login?next=/account");

  await connectMongo();
  const user = await User.findById(session.uid).lean();
  if (!user) redirect("/login");

  const env = getEnv();
  const params = await searchParams;
  const error = params.error ? LINK_ERROR_MESSAGES[params.error] ?? params.error : null;
  const googleReady = isGoogleOAuthConfigured(env);

  const hasGoogle = Boolean(user.googleId);
  const hasTelegram = Boolean(user.telegramId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-[var(--color-muted)] hover:underline">
          ← Home
        </Link>
        <form action="/api/auth/logout" method="post">
          <Button variant="secondary" size="sm" type="submit">Sign out</Button>
        </form>
      </header>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">Account</h1>

      {error && (
        <p className="mb-4 rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Google</CardTitle>
            <CardDescription>
              {hasGoogle
                ? `Linked as ${user.googleEmail ?? user.googleName ?? user.googleId}`
                : "Not linked"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasGoogle ? (
              <p className="text-sm text-[var(--color-muted)]">
                Your Google identity is attached to this Wave account.
              </p>
            ) : googleReady ? (
              <a href="/api/auth/google/start?link=1&next=/account">
                <Button>Link Google account</Button>
              </a>
            ) : (
              <Button disabled>Google OAuth not configured</Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telegram</CardTitle>
            <CardDescription>
              {hasTelegram
                ? `Linked as ${user.telegramUsername ? "@" + user.telegramUsername : user.telegramFirstName ?? user.telegramId}`
                : "Not linked"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {hasTelegram ? (
              <p className="text-sm text-[var(--color-muted)]">
                Your Telegram identity is attached. You can open the bot any time.
              </p>
            ) : env.BOT_USERNAME ? (
              <>
                <p className="text-sm text-[var(--color-muted)]">
                  Open the bot, then return here from inside the Mini App to
                  link automatically. After linking, both identities point to
                  this same Wave account.
                </p>
                <a href={`https://t.me/${env.BOT_USERNAME}`} target="_blank" rel="noreferrer">
                  <Button variant="secondary">Open @{env.BOT_USERNAME}</Button>
                </a>
              </>
            ) : (
              <Button disabled>Telegram bot not configured</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
