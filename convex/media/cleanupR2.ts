"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { configuration, deleteObject } from "./r2";
import { requireR2Binding } from "./binding";
export const run = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let config: ReturnType<typeof configuration>;
    try {
      config = configuration();
    } catch {
      return null;
    }
    const sessions = await ctx.runQuery(internal.media.cleanup.due, {});
    for (const row of sessions) {
      try {
        const s = await ctx.runMutation(internal.media.cleanup.claim, {
          sessionId: row._id,
        });
        if (!s) continue;
        requireR2Binding(s, config);
        await deleteObject(config.client, s.bucket, s.temporaryKey);
        const finalDeleted = s.state !== "ready";
        if (finalDeleted)
          await deleteObject(config.client, s.bucket, s.finalKey);
        await ctx.runMutation(internal.media.cleanup.receipt, {
          sessionId: s._id,
          finalDeleted,
        });
      } catch {
        /* No receipt, retry after persisted claim delay. Never log signed URLs or provider errors. */
      }
    }
    return null;
  },
});
