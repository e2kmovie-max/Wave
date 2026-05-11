"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const EMOJI_REACTIONS = ["😀", "😂", "😍", "🔥", "👏", "🍿", "💙", "🎉"];
const SPEED_MIN = 0.25;
const SPEED_MAX = 2;
const SPEED_STEP = 0.25;

export interface PlayerFormat {
  formatId: string;
  label: string;
}

export interface InitialRoomState {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  selectedFormatId?: string;
  quality?: string;
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  createdAt: string;
}

interface RoomPlayerProps {
  code: string;
  formats: PlayerFormat[];
  initialState: InitialRoomState;
  initialMessages: ChatMessage[];
  currentUser: {
    id: string;
    name: string;
  };
}

type SyncPayload =
  | {
      type: "state";
      event?: "play" | "pause" | "seek" | "quality" | "speed";
      state: InitialRoomState;
    }
  | { type: "chat"; message: ChatMessage }
  | { type: "error"; error: string };

export function RoomPlayer({
  code,
  formats,
  initialState,
  initialMessages,
  currentUser,
}: RoomPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const suppressRef = useRef(false);
  const [state, setState] = useState(initialState);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const selectedFormatId = state.selectedFormatId ?? formats[0]?.formatId ?? "";
  const playbackRate = state.playbackRate ?? 1;
  const streamUrl = useMemo(
    () => `/api/rooms/${code}/stream?format=${encodeURIComponent(selectedFormatId)}`,
    [code, selectedFormatId],
  );

  useEffect(() => {
    void fetch(`/api/rooms/${code}/join`, { method: "POST" });
  }, [code]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/rooms/${code}/sync`);
    socketRef.current = socket;
    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "hello" }));
    });
    socket.addEventListener("close", () => setConnected(false));
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data as string) as SyncPayload;
      if (payload.type === "state") applyState(payload.state);
      if (payload.type === "chat") {
        setMessages((current) => [...current, payload.message].slice(-100));
      }
    });
    return () => socket.close();
  }, [code]);

  function applyState(next: InitialRoomState) {
    setState(next);
    const video = videoRef.current;
    if (!video) return;
    suppressRef.current = true;
    video.playbackRate = next.playbackRate ?? 1;
    if (Math.abs(video.currentTime - next.currentTime) > 1) {
      video.currentTime = Math.max(0, next.currentTime);
    }
    if (next.isPlaying && video.paused) {
      void video.play().catch(() => undefined);
    }
    if (!next.isPlaying && !video.paused) {
      video.pause();
    }
    window.setTimeout(() => {
      suppressRef.current = false;
    }, 250);
  }

  function send(
    type: "play" | "pause" | "seek" | "quality" | "speed",
    override: Partial<InitialRoomState> = {},
  ) {
    const video = videoRef.current;
    const currentTime = override.currentTime ?? video?.currentTime ?? state.currentTime;
    const payload = {
      type,
      currentTime,
      playbackRate: override.playbackRate ?? playbackRate,
      selectedFormatId: override.selectedFormatId ?? state.selectedFormatId,
      quality: override.quality ?? state.quality,
    };
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      return;
    }
    void fetch(`/api/rooms/${code}/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        isPlaying: type === "play",
      }),
    });
  }

  function changeQuality(formatId: string) {
    const selected = formats.find((format) => format.formatId === formatId);
    const next = {
      ...state,
      selectedFormatId: formatId,
      quality: selected?.label ?? formatId,
      currentTime: videoRef.current?.currentTime ?? state.currentTime,
      isPlaying: false,
    };
    setState(next);
    send("quality", next);
  }

  function changeSpeed(value: string) {
    const nextRate = clampPlaybackRate(Number(value));
    if (videoRef.current) videoRef.current.playbackRate = nextRate;
    const next = {
      ...state,
      playbackRate: nextRate,
      currentTime: videoRef.current?.currentTime ?? state.currentTime,
    };
    setState(next);
    send("speed", next);
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: "chat",
        text,
        userId: currentUser.id,
      }),
    );
    setDraft("");
  }

  function addEmoji(emoji: string) {
    setDraft((current) => `${current}${emoji}`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black shadow-2xl shadow-black/30">
          <video
            key={selectedFormatId}
            ref={videoRef}
            src={streamUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black"
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = playbackRate;
            }}
            onPlay={() => {
              if (!suppressRef.current) send("play");
            }}
            onPause={() => {
              if (!suppressRef.current) send("pause");
            }}
            onSeeked={() => {
              if (!suppressRef.current) send("seek");
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
          <span
            className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`}
            title={connected ? "Connected" : "Reconnecting"}
          />
          <Button type="button" onClick={() => videoRef.current?.play()}>
            Play
          </Button>
          <Button type="button" variant="secondary" onClick={() => videoRef.current?.pause()}>
            Pause
          </Button>
          <label className="grid gap-1 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Quality
            <select
              className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm normal-case tracking-normal text-[var(--color-fg)]"
              value={selectedFormatId}
              onChange={(event) => changeQuality(event.target.value)}
            >
              {formats.map((format) => (
                <option key={format.formatId} value={format.formatId}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-48 gap-1 text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Speed {playbackRate.toFixed(2)}×
            <input
              type="range"
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={SPEED_STEP}
              value={playbackRate}
              onChange={(event) => changeSpeed(event.target.value)}
            />
          </label>
          <p className="text-sm text-[var(--color-muted)]">
            State sync: {state.isPlaying ? "playing" : "paused"} · {Math.round(state.currentTime)}s
          </p>
        </div>
      </div>

      <aside className="grid content-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
        <div>
          <h2 className="text-lg font-semibold">Chat</h2>
          <p className="text-sm text-[var(--color-muted)]">Signed in as {currentUser.name}</p>
        </div>
        <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">
              No messages yet. Say hi with an emoji.
            </p>
          ) : (
            messages.map((message) => (
              <article key={message.id} className="rounded-xl bg-[var(--color-bg)] p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <strong>{message.name}</strong>
                  <time className="text-xs text-[var(--color-muted)]">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="break-words">{message.text}</p>
              </article>
            ))
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {EMOJI_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-lg transition hover:border-[var(--color-accent)]"
              onClick={() => addEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <form onSubmit={sendChat} className="grid gap-2">
          <input
            value={draft}
            maxLength={280}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message or emoji"
            className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm outline-none transition focus:border-[var(--color-accent)]"
          />
          <Button type="submit" disabled={!draft.trim() || !connected}>
            Send
          </Button>
        </form>
      </aside>
    </div>
  );
}

function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, rate));
}
