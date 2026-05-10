import type { Metadata, Viewport } from "next";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
