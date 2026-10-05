import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { workspaceQuery, requireRole } from "../lib/authorization";
import {
  signalFields,
  recoveryFields,
} from "../integrations/github/signalFields";
import { localEvidence } from "../integrations/github/deliveries";
export const list = workspaceQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("githubSignals"),
        _creationTime: v.number(),
        ...signalFields,
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, a) => {
    if (a.paginationOpts.numItems < 1 || a.paginationOpts.numItems > 50)
      throw Error("GITHUB_PAGE_LIMIT");
    const result = await ctx.db
      .query("githubSignals")
      .withIndex("by_workspaceId_and_receivedAt", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .order("desc")
      .paginate(a.paginationOpts);
    return {
      page: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
export const recoveries = workspaceQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("githubRecoveries"),
        _creationTime: v.number(),
        ...recoveryFields,
        localReceipt: v.boolean(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    if (a.paginationOpts.numItems < 1 || a.paginationOpts.numItems > 50)
      throw Error("GITHUB_PAGE_LIMIT");
    const result = await ctx.db
      .query("githubRecoveries")
      .withIndex("by_workspaceId_and_updatedAt", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .order("desc")
      .paginate(a.paginationOpts);
    const page = [];
    for (const r of result.page) {
      const { receipt, signal } = await localEvidence(
        ctx,
        r.workspaceId,
        r.guid,
      );
      const globalCooldown = await ctx.db
        .query("githubRecoveries")
        .withIndex("by_guid_and_notBefore", (q) => q.eq("guid", r.guid))
        .order("desc")
        .first();
      const lastAttempt = await ctx.db
        .query("githubRecoveries")
        .withIndex("by_guid_and_attempts", (q) => q.eq("guid", r.guid))
        .order("desc")
        .first();
      page.push({
        ...r,
        localReceipt: receipt !== null,
        notBefore: Math.max(r.notBefore, globalCooldown?.notBefore ?? 0),
        attempts: lastAttempt?.attempts ?? r.attempts,
        state: signal
          ? ("processed" as const)
          : r.state === "requesting" && r.leaseUntil <= Date.now()
            ? ("unknown" as const)
            : r.state,
      });
    }
    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
