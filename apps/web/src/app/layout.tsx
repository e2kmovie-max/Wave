import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Wave — watch videos together",
  description:
    "Wave is a synchronized video watch party platform — drop in a link, share a room, and watch in lockstep with your friends.",
};

export const viewport: Viewport = {
  themeColor: "#0e1218",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getCurrentLang();
  return (
    <html lang={lang}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
