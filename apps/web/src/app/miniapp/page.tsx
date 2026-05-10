import Script from "next/script";
import { MiniAppAuth } from "./mini-app-auth";

export const dynamic = "force-dynamic";

export default function MiniAppPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-10">
      {/* Telegram WebApp SDK */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <MiniAppAuth />
    </main>
  );
}
