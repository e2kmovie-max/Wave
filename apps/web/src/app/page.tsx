import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isGoogleOAuthConfigured, isBotConfigured } from "@wave/shared";
import { readSession } from "@/lib/session";
import { checkAdmin } from "@/lib/admin-access";
import { getTranslator } from "@/lib/i18n";
import { LangSwitcher } from "@/components/lang-switcher";
import { CreateRoomForm } from "./create-room-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await readSession();
  const googleReady = isGoogleOAuthConfigured();
  const botReady = isBotConfigured();
  const adminCheck = session ? await checkAdmin() : { status: "unauthenticated" as const };
  const isAdmin = adminCheck.status === "ok";
  const { lang, t } = await getTranslator();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] font-black">
            W
          </span>
          <span className="text-lg font-semibold tracking-tight">{t("web.brand")}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <LangSwitcher current={lang} />
          {session ? (
            <>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">{t("web.nav.admin")}</Button>
                </Link>
              )}
              <Link href="/account">
                <Button variant="ghost" size="sm">{t("web.nav.account")}</Button>
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button variant="secondary" size="sm" type="submit">
                  {t("web.nav.sign_out")}
                </Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">{t("web.nav.sign_in")}</Button>
            </Link>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 py-20 text-center">
        <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          {t("web.home.title")}
          <br />
          <span className="bg-gradient-to-r from-[var(--color-accent)] to-pink-300 bg-clip-text text-transparent">
            {t("web.home.title_emph")}
          </span>
        </h1>
        <p className="max-w-2xl text-balance text-lg text-[var(--color-muted)]">
          {t("web.home.lead")}
        </p>
        {session ? (
          <CreateRoomForm
            strings={{
              placeholder: t("web.home.form_label"),
              submit: t("web.home.form_submit"),
              loading: t("web.home.creating"),
              invalid: t("web.home.form_invalid"),
              subscriptionRequired:
                lang === "ru"
                  ? "Сначала подпишитесь на обязательные каналы: {channels}. Затем нажмите «Создать комнату» ещё раз."
                  : "Subscribe to the required channels first: {channels}. Then press “Create room” again.",
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg">{t("web.home.cta_sign_in")}</Button>
            </Link>
            <a href="https://github.com/e2kmovie-max/Wave" target="_blank" rel="noreferrer">
              <Button variant="secondary" size="lg">GitHub</Button>
            </a>
          </div>
        )}
      </section>

      <section className="grid gap-4 pb-10 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Google sign-in</CardTitle>
            <CardDescription>
              {googleReady
                ? "Configured. Use the “Sign in with Google” button on /login."
                : "Stub: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[var(--color-muted)]">
            OAuth 2.0 authorization-code flow with HMAC-signed state and a
            secure session cookie. See <code className="text-[var(--color-fg)]">apps/web/src/lib/google-oauth.ts</code>.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telegram Mini App</CardTitle>
            <CardDescription>
              {botReady
                ? "Configured. Open the bot’s Mini App from inside Telegram."
                : "Stub: set BOT_TOKEN and BOT_USERNAME to enable."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[var(--color-muted)]">
            Verifies <code className="text-[var(--color-fg)]">initData</code>{" "}
            via HMAC-SHA-256 per the Telegram spec, then issues a session
            cookie compatible with the web flow.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account linking</CardTitle>
            <CardDescription>
              Link your Google and Telegram identities into one Wave account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[var(--color-muted)]">
            From <code className="text-[var(--color-fg)]">/account</code> you
            can attach the missing identity to the user you’re currently signed
            in as.
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
