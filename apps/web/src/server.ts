import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import next from "next";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { connectMongo, makeRoomState, Room } from "@wave/shared";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.WEB_PORT ?? process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const rooms = new Map<string, Set<WebSocket>>();

interface SyncEvent {
  type: "play" | "pause" | "seek" | "quality" | "hello";
  currentTime?: number;
  selectedFormatId?: string;
  quality?: string;
}

await app.prepare();

const server = createServer((req, res) => {
  void handle(req, res);
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const match = /^\/api\/rooms\/([^/]+)\/sync$/.exec(url.pathname);
  if (!match) {
    socket.destroy();
    return;
  }
  const code = match[1]?.toUpperCase();
  if (!code) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req, code);
  });
});

wss.on("connection", (ws: WebSocket, _req: IncomingMessage, code: string) => {
  addClient(code, ws);
  void sendInitialState(code, ws);

  ws.on("message", (raw: RawData) => {
    void handleMessage(code, ws, raw.toString());
  });
  ws.on("close", () => removeClient(code, ws));
  ws.on("error", () => removeClient(code, ws));
});

server.listen(port, hostname, () => {
  console.log(`[web] ready on http://${hostname}:${port}`);
});

function addClient(code: string, ws: WebSocket) {
  const set = rooms.get(code) ?? new Set<WebSocket>();
  set.add(ws);
  rooms.set(code, set);
}

function removeClient(code: string, ws: WebSocket) {
  const set = rooms.get(code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(code);
}

async function sendInitialState(code: string, ws: WebSocket) {
  await connectMongo();
  const room = await Room.findOne({ code, isClosed: false }).lean();
  if (!room) {
    ws.send(JSON.stringify({ type: "error", error: "room_not_found" }));
    ws.close();
    return;
  }
  ws.send(JSON.stringify({ type: "state", state: makeRoomState(room) }));
}

async function handleMessage(code: string, sender: WebSocket, raw: string) {
  let event: SyncEvent;
  try {
    event = JSON.parse(raw) as SyncEvent;
  } catch {
    sender.send(JSON.stringify({ type: "error", error: "invalid_json" }));
    return;
  }
  if (!["play", "pause", "seek", "quality", "hello"].includes(event.type)) {
    sender.send(JSON.stringify({ type: "error", error: "invalid_event" }));
    return;
  }
  if (event.type === "hello") {
    await sendInitialState(code, sender);
    return;
  }

  const update: Record<string, unknown> = { lastSyncAt: new Date() };
  if (typeof event.currentTime === "number" && Number.isFinite(event.currentTime)) {
    update.currentTime = Math.max(0, event.currentTime);
  }
  if (event.type === "play") update.isPlaying = true;
  if (event.type === "pause" || event.type === "seek" || event.type === "quality") {
    update.isPlaying = event.type === "quality" ? undefined : false;
  }
  if (event.type === "quality" && event.selectedFormatId) {
    update.selectedFormatId = event.selectedFormatId;
    update.quality = event.quality ?? event.selectedFormatId;
  }

  await connectMongo();
  const room = await Room.findOneAndUpdate(
    { code, isClosed: false },
    { $set: stripUndefined(update) },
    { new: true },
  ).lean();
  if (!room) {
    sender.send(JSON.stringify({ type: "error", error: "room_not_found" }));
    return;
  }
  broadcast(code, {
    type: "state",
    event: event.type,
    state: makeRoomState(room),
  });
}

function broadcast(code: string, payload: unknown) {
  const set = rooms.get(code);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
