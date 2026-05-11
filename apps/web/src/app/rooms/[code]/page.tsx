import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connectMongo, getEnv, makeRoomState, Room, User } from "@wave/shared";
import { readSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RoomPlayer, type ChatMessage, type PlayerFormat } from "./room-player";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await readSession();
  if (!session) redirect(`/login?next=/rooms/${encodeURIComponent(code)}`);

  await connectMongo();
  const [room, user] = await Promise.all([
    Room.findOne({ code: code.toUpperCase(), isClosed: false }).lean(),
    User.findById(session.uid).lean(),
  ]);
  if (!room) notFound();
  if (!user) redirect(`/login?next=/rooms/${encodeURIComponent(code)}`);

  const env = getEnv();
  const webInvite = `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/rooms/${room.code}`;
  const botInvite =
    room.source === "bot" && room.botPayload && env.BOT_USERNAME
      ? `https://t.me/${env.BOT_USERNAME}?start=${room.botPayload}`
      : null;
  const formats: PlayerFormat[] = room.availableFormats.map((format) => ({
    formatId: format.formatId,
    label: format.label,
  }));
  const initialMessages: ChatMessage[] = (room.chatMessages ?? []).slice(-100).map((message) => ({
    id: String(message._id),
    name: message.name,
    text: message.text,
    createdAt: (message.createdAt ?? new Date()).toISOString(),
  }));
  const currentUser = {
    id: String(user._id),
    name: displayName(user),
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-[var(--color-muted)] hover:underline">
          ← Home
        </Link>
        <Link href="/account">
          <Button variant="secondary" size="sm">Account</Button>
        </Link>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.35em] text-[var(--color-muted)]">
              Room {room.code}
            </p>
            <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
              {room.videoTitle ?? "Watch room"}
            </h1>
            {room.videoUploader && (
              <p className="mt-2 text-[var(--color-muted)]">{room.videoUploader}</p>
            )}
          </div>
          <RoomPlayer
            code={room.code}
            formats={formats}
            initialState={makeRoomState(room)}
            initialMessages={initialMessages}
            currentUser={currentUser}
          />
        </div>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Invite</CardTitle>
              <CardDescription>
                Share the room link. Telegram-created rooms prefer the bot deeplink.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {botInvite && (
                <CopyableLink label="Telegram invite" href={botInvite} />
              )}
              <CopyableLink label="Web invite" href={webInvite} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {formatDuration(room.videoDuration ?? undefined)} · {formats.length} quality presets
              </CardDescription>
            </CardHeader>
            {room.videoThumbnail && (
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={room.videoThumbnail}
                  alt=""
                  className="aspect-video w-full rounded-xl object-cover"
                />
              </CardContent>
            )}
          </Card>
        </aside>
      </section>
    </main>
  );
}

function CopyableLink({ label, href }: { label: string; href: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">{label}</span>
      <a
        className="break-all rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 hover:border-[var(--color-accent)]"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {href}
      </a>
    </div>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "Unknown duration";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function displayName(user: {
  googleName?: string | null;
  googleEmail?: string | null;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  guestName?: string | null;
}): string {
  return (
    user.googleName ??
    user.telegramUsername ??
    user.telegramFirstName ??
    user.guestName ??
    user.googleEmail ??
    "Guest"
  );
}
