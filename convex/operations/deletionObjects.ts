"use node";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { configuration, deleteObject } from "../media/r2";
import { requireR2Binding } from "../media/binding";
export const remove = internalAction({
  args: { jobId: v.id("deletionJobs"), sessionId: v.id("mediaUploadSessions") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const source = await ctx.runQuery(
      internal.operations.deletionExecutor.objectSource,
      args,
    );
    if (!source) return null;
    try {
      const config = configuration();
      const session = await ctx.runMutation(internal.media.cleanup.claim, {
        sessionId: source._id,
      });
      if (!session || session.state !== "cancelled") return null;
      requireR2Binding(session, config);
      await deleteObject(config.client, session.bucket, session.temporaryKey);
      await deleteObject(config.client, session.bucket, session.finalKey);
      await ctx.runMutation(internal.media.cleanup.receipt, {
        sessionId: session._id,
        finalDeleted: true,
      });
    } catch {
      /* No receipt on failure; durable job and original keys remain resumable. */
    }
    return null;
  },
});
