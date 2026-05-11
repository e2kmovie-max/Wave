import { Composer } from "grammy";
import { Room, User } from "@wave/shared";
import type { WaveContext } from "../context";
import { gateBehindOp, openRoomForUser } from "./op";

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
      const proceed = await gateBehindOp(ctx, { kind: "open_room", code: room.code });
      if (!proceed) return;
      await openRoomForUser(ctx, room.code);
      return;
    }
  }

  const lines = [ctx.t("start.greeting_title"), "", ctx.t("start.greeting_body")];
  if (payload) {
    lines.push("");
    lines.push(ctx.t("start.payload_no_room"));
  }
  if (ctx.isAdmin) {
    lines.push("");
    lines.push(ctx.t("start.admin_hint"));
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
});
