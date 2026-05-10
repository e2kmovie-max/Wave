import { Types } from "mongoose";
import { decrypt, randomCode } from "./crypto";
import { GoogleAccount, Instance, Room } from "./models";
import { InstanceClient, type InstanceCookie, type InstanceInfo } from "./instance-client";

export interface RoomVideoFormat {
  formatId: string;
  label: string;
  width?: number;
  height?: number;
  fps?: number;
  ext?: string;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  bitrate?: number;
}

export interface RoomSyncState {
  currentTime: number;
  isPlaying: boolean;
  selectedFormatId?: string;
  quality?: string;
  updatedAt: string;
}

interface InstanceRecord {
  _id: Types.ObjectId;
  name: string;
  url: string;
  secret: string;
  activeStreams?: number;
  maxStreams?: number;
}

interface CookieAccountRecord {
  _id: Types.ObjectId;
  cookiesEncrypted: string;
  userAgent?: string;
}

interface RoomStateRecord {
  currentTime?: number;
  isPlaying?: boolean;
  lastSyncAt?: Date;
  selectedFormatId?: string | null;
  quality?: string | null;
}

export class WatchPartyError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "WatchPartyError";
  }
}

export function normalizeVideoUrl(input: string): string {
  const trimmed = input.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new WatchPartyError("Enter a valid http(s) video URL.", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new WatchPartyError("Only http(s) video URLs are supported.", 400);
  }
  return parsed.toString();
}

export async function selectStreamingInstance(): Promise<InstanceRecord> {
  const candidates = await Instance.find({ enabled: true, isHealthy: true })
    .sort({ activeStreams: 1, lastHealthAt: -1, updatedAt: -1 })
    .lean<InstanceRecord[]>();
  const selected = candidates.find((candidate) => {
    const max = candidate.maxStreams ?? 0;
    return max === 0 || (candidate.activeStreams ?? 0) < max;
  });
  if (!selected) {
    throw new WatchPartyError(
      "No healthy streaming instance is available. Start the local instance or add one in INSTANCES_JSON.",
      503,
    );
  }
  return selected;
}

export async function loadYtDlpCredentials(): Promise<{
  cookies?: InstanceCookie[];
  userAgent?: string;
}> {
  const account = await GoogleAccount.findOneAndUpdate(
    { disabled: false },
    { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } },
    { sort: { lastUsedAt: 1, usageCount: 1, createdAt: 1 }, new: true },
  ).lean<CookieAccountRecord | null>();
  if (!account) return {};

  let cookies: InstanceCookie[];
  try {
    cookies = parseCookiePayload(decrypt(account.cookiesEncrypted));
  } catch (err) {
    throw new WatchPartyError(`Configured YouTube cookies cannot be used: ${(err as Error).message}`, 500);
  }
  return {
    cookies,
    userAgent: account.userAgent,
  };
}

export async function previewVideo(urlInput: string): Promise<{
  url: string;
  instance: InstanceRecord;
  info: InstanceInfo;
  formats: RoomVideoFormat[];
  selectedFormatId: string;
  quality: string;
}> {
  const url = normalizeVideoUrl(urlInput);
  const instance = await selectStreamingInstance();
  const credentials = await loadYtDlpCredentials();
  const client = new InstanceClient({ url: instance.url, secret: instance.secret });
  const info = await client.info({
    url,
    cookies: credentials.cookies,
    userAgent: credentials.userAgent,
  });
  const formats = buildRoomFormats(info);
  const first = formats[0];
  if (!first) {
    throw new WatchPartyError("The instance returned no streamable formats for this video.", 502);
  }
  return {
    url,
    instance,
    info,
    formats,
    selectedFormatId: first.formatId,
    quality: first.label,
  };
}

export async function createWatchRoom(input: {
  ownerId: string | Types.ObjectId;
  url: string;
  source?: "web" | "bot";
  botPayload?: string;
}): Promise<{ code: string; botPayload?: string }> {
  const ownerId =
    input.ownerId instanceof Types.ObjectId ? input.ownerId : new Types.ObjectId(input.ownerId);
  const preview = await previewVideo(input.url);
  const payload = input.botPayload ?? (input.source === "bot" ? randomCode(24).toLowerCase() : undefined);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode(8);
    try {
      await Room.create({
        code,
        ownerId,
        instanceId: preview.instance._id,
        videoUrl: preview.url,
        videoTitle: preview.info.title,
        videoDuration: preview.info.duration,
        videoThumbnail: preview.info.thumbnail,
        videoUploader: preview.info.uploader ?? preview.info.channel,
        availableFormats: preview.formats,
        selectedFormatId: preview.selectedFormatId,
        quality: preview.quality,
        participants: [{ userId: ownerId }],
        source: input.source ?? "web",
        botPayload: payload,
      });
      return { code, botPayload: payload };
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new WatchPartyError("Could not allocate a unique room code.", 500);
}

export function buildRoomFormats(info: InstanceInfo): RoomVideoFormat[] {
  const heights = Array.from(
    new Set(
      info.formats
        .filter((format) => format.hasVideo && Number.isFinite(format.height) && (format.height ?? 0) > 0)
        .map((format) => format.height as number),
    ),
  ).sort((a, b) => b - a);

  const formats: RoomVideoFormat[] = [
    {
      formatId: "bv*+ba/b",
      label: "Best available",
    },
  ];
  for (const height of heights) {
    const sample = info.formats.find((format) => format.hasVideo && format.height === height);
    formats.push({
      formatId: `bv*[height<=${height}]+ba/b[height<=${height}]/best[height<=${height}]`,
      label: `${height}p`,
      width: sample?.width,
      height,
      fps: sample?.fps,
      ext: sample?.ext,
      vcodec: sample?.vcodec,
      acodec: sample?.acodec,
      filesize: sample?.filesize,
    });
  }
  return formats;
}

export function makeRoomState(room: RoomStateRecord): RoomSyncState {
  const syncedAt = room.lastSyncAt ?? new Date();
  const base = Math.max(0, room.currentTime ?? 0);
  const currentTime = room.isPlaying
    ? base + Math.max(0, Date.now() - syncedAt.getTime()) / 1000
    : base;
  return {
    currentTime,
    isPlaying: Boolean(room.isPlaying),
    selectedFormatId: room.selectedFormatId ?? undefined,
    quality: room.quality ?? undefined,
    updatedAt: syncedAt.toISOString(),
  };
}

function parseCookiePayload(payload: string): InstanceCookie[] {
  const trimmed = payload.trim();
  if (trimmed === "") return [];
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("cookie JSON must be an array");
    return parsed.map(parseJsonCookie);
  }
  return parseNetscapeCookies(trimmed);
}

function parseJsonCookie(value: unknown): InstanceCookie {
  if (!isRecord(value)) throw new Error("cookie must be an object");
  const name = asString(value.name);
  const cookieValue = asString(value.value);
  const domain = asString(value.domain);
  if (!name || !domain) throw new Error("cookie requires name and domain");
  const expires = typeof value.expires === "number" ? value.expires : undefined;
  return {
    name,
    value: cookieValue,
    domain,
    path: typeof value.path === "string" ? value.path : "/",
    expires,
    secure: typeof value.secure === "boolean" ? value.secure : undefined,
    httpOnly: typeof value.httpOnly === "boolean" ? value.httpOnly : undefined,
  };
}

function parseNetscapeCookies(payload: string): InstanceCookie[] {
  const cookies: InstanceCookie[] = [];
  for (const rawLine of payload.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (line.startsWith("#") && !line.startsWith("#HttpOnly_"))) continue;
    const httpOnly = line.startsWith("#HttpOnly_");
    const normalized = httpOnly ? line.replace(/^#HttpOnly_/, "") : line;
    const parts = normalized.split("\t");
    if (parts.length < 7) continue;
    const [domain, , path, secureRaw, expiresRaw, name, ...valueParts] = parts;
    if (!domain || !name) continue;
    const expires = Number(expiresRaw);
    cookies.push({
      domain,
      path: path || "/",
      secure: secureRaw?.toUpperCase() === "TRUE",
      expires: Number.isFinite(expires) ? expires : undefined,
      name,
      value: valueParts.join("\t"),
      httpOnly,
    });
  }
  return cookies;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDuplicateKeyError(err: unknown): boolean {
  return isRecord(err) && err.code === 11000;
}

export const __watchPartyTest__ = {
  buildRoomFormats,
  parseCookiePayload,
};
