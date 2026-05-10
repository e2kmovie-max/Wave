import { Composer } from "grammy";
import { Room, User, getEnv } from "@wave/shared";
import type { WaveContext } from "../context";

export const startHandler = new Composer<WaveContext>();

startHandler.command("start", async (ctx) => {
  const payload = ctx.match?.toString().trim();

  if (payload && ctx.user?._id) {
    await User.updateOne(
      { _id: ctx.user._id },
      { $set: { lastStartPayload: payload } },
    );
    const room = await Room.findOne({ botPayload: payload, isClosed: false }).lean();
    if (room) {
      const env = getEnv();
      const url = `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/rooms/${room.code}`;
      await ctx.reply(`Open this Wave room:\n${url}`);
      return;
    }
  }

  const lines = [
    `<b>Wave</b> — watch videos together.`,
    "",
    "Send me a YouTube link and I'll spin up a watch-room for you and your friends.",
  ];
  if (payload) {
    lines.push("");
    lines.push(
      `You arrived with payload <code>${escapeHtml(payload)}</code>, but I could not find an active room for it.`,
    );
  }
  if (ctx.isAdmin) {
    lines.push("");
    lines.push("You're an admin. /admin will open the panel (stage 4).");
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}
