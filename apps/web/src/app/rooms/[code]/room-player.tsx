"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export interface PlayerFormat {
  formatId: string;
  label: string;
}

export interface InitialRoomState {
  currentTime: number;
  isPlaying: boolean;
  selectedFormatId?: string;
  quality?: string;
}

interface RoomPlayerProps {
  code: string;
  formats: PlayerFormat[];
  initialState: InitialRoomState;
}

type SyncPayload =
  | {
      type: "state";
      event?: "play" | "pause" | "seek" | "quality";
      state: InitialRoomState;
    }
  | { type: "error"; error: string };

export function RoomPlayer({ code, formats, initialState }: RoomPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const suppressRef = useRef(false);
  const [state, setState] = useState(initialState);
  const [connected, setConnected] = useState(false);
  const selectedFormatId = state.selectedFormatId ?? formats[0]?.formatId ?? "";
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
    });
    return () => socket.close();
  }, [code]);

  function applyState(next: InitialRoomState) {
    setState(next);
    const video = videoRef.current;
    if (!video) return;
    suppressRef.current = true;
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

  function send(type: "play" | "pause" | "seek" | "quality", override: Partial<InitialRoomState> = {}) {
    const video = videoRef.current;
    const currentTime = override.currentTime ?? video?.currentTime ?? state.currentTime;
    const payload = {
      type,
      currentTime,
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

  return (
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
        <select
          className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
          value={selectedFormatId}
          onChange={(event) => changeQuality(event.target.value)}
        >
          {formats.map((format) => (
            <option key={format.formatId} value={format.formatId}>
              {format.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-[var(--color-muted)]">
          State sync: {state.isPlaying ? "playing" : "paused"} · {Math.round(state.currentTime)}s
        </p>
      </div>
    </div>
  );
}
