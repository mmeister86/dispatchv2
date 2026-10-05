import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { sessionDoc } from "./uploads";
export const due = internalQuery({
  args: {},
  returns: v.array(sessionDoc),
  handler: (ctx) =>
    ctx.db
      .query("mediaUploadSessions")
      .withIndex("by_cleanAfter", (q) => q.lte("cleanAfter", Date.now()))
      .take(20),
});
export const claim = internalMutation({
  args: { sessionId: v.id("mediaUploadSessions") },
  returns: v.union(sessionDoc, v.null()),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sessionId);
    if (
      !s ||
      s.cleanAfter > Date.now() ||
      s.leaseUntil > Date.now() ||
      s.expiresAt + 60000 > Date.now()
    )
      return null;
    const asset = await ctx.db.get(s.assetId);
    if (!asset) return null;
    if (s.state === "validating") {
      // A crashed finalization remains explicitly resumable for 24h before abandoned-object deletion.
      if (Date.now() < s.expiresAt + 86400000) {
        await ctx.db.patch(s._id, { cleanAfter: s.expiresAt + 86400000 });
        return null;
      }
    }
    if (s.state !== "ready" && s.state !== "deleted") {
      if (
        await ctx.db
          .query("mediaVersionReferences")
          .withIndex("by_assetId", (q) => q.eq("assetId", s.assetId))
          .first()
      )
        return null;
      await ctx.db.patch(s.assetId, { state: "deleting" });
      await ctx.db.patch(s._id, { state: "cancelled" });
    }
    await ctx.db.patch(s._id, { cleanAfter: Date.now() + 15 * 60000 });
    return {
      ...s,
      state:
        s.state === "ready"
          ? ("ready" as const)
          : s.state === "deleted"
            ? ("deleted" as const)
            : ("cancelled" as const),
    };
  },
});
export const receipt = internalMutation({
  args: { sessionId: v.id("mediaUploadSessions"), finalDeleted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sessionId);
    if (!s) return null;
    // ponytail: permanent tombstones catch late PUTs; 20 sessions/15min. Purge only after verified bucket lifecycle/TASK-36 retention.
    await ctx.db.patch(s._id, {
      cleanAfter:
        Date.now() +
        (s.state === "cancelled" && !a.finalDeleted ? 15 * 60000 : 86400000),
    });
    if (a.finalDeleted && s.state === "cancelled") {
      const asset = await ctx.db.get(s.assetId);
      const workspace = await ctx.db.get(s.workspaceId);
      if (asset?.state === "deleting") {
        await ctx.db.patch(asset._id, {
          state: "deleted",
          name: "",
          defaultAlt: undefined,
          checksum: "",
          width: undefined,
          height: undefined,
          duration: undefined,
          mime: undefined,
          errorCode: undefined,
        });
        await ctx.db.patch(s._id, {
          state: "deleted",
          deletedAt: Date.now(),
          userId: undefined,
          requestId: undefined,
          errorCode: undefined,
        });
        if (workspace)
          await ctx.db.patch(workspace._id, {
            mediaReservedBytes: Math.max(
              0,
              (workspace.mediaReservedBytes ?? s.expectedSize) - s.expectedSize,
            ),
            mediaAssetCount: Math.max(0, (workspace.mediaAssetCount ?? 1) - 1),
          });
      }
    }
    return null;
  },
});
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.media.cleanupR2.run, {});
    return null;
  },
});
