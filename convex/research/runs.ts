import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  workspaceMutation,
  workspaceQuery,
  requireRole,
  requireReference,
} from "../lib/authorization";
import {
  currentProfile,
  account,
  liveAuthority,
  operationKey,
  prerequisites,
  sameApproval,
} from "./access";
import { orderDoc } from "./fields";
import { sha256 } from "../lib/crypto";
export async function admit(
  ctx: MutationCtx,
  p: Doc<"researchProfiles">,
  version: Doc<"researchProfileVersions">,
  actorId: Id<"users">,
  occasion: Doc<"researchOrders">["occasion"],
  key: string,
  fingerprint: string,
  occurrence: Doc<"researchOrders">["occurrence"] = null,
) {
  const old = await ctx.db
    .query("researchOrders")
    .withIndex("by_profileId_and_actorId_and_operationKey", (q) =>
      q.eq("profileId", p._id).eq("actorId", actorId).eq("operationKey", key),
    )
    .unique();
  if (old) {
    if (old.fingerprint !== fingerprint)
      throw new ConvexError("RESEARCH_OPERATION_CONFLICT");
    return old._id;
  }
  const acc = await account(ctx, p.workspaceId, p.accountId),
    sequence = acc.xEvidence?.connectionSequence ?? 0;
  await liveAuthority(ctx, p, actorId, sequence);
  if (p.activeOrderId && occasion !== "scheduled")
    throw new ConvexError("RESEARCH_ORDER_ACTIVE");
  const now = Date.now();
  const reason = p.activeOrderId ? "RESEARCH_ORDER_ACTIVE" : null;
  let approval = null;
  try {
    approval = await prerequisites(ctx, p, version.config);
  } catch {
    /* Unconfigured human orders still receive a truthful blocked execution receipt. */
  }
  const orderId = await ctx.db.insert("researchOrders", {
    workspaceId: p.workspaceId,
    accountId: p.accountId,
    profileId: p._id,
    profileVersionId: version._id,
    actorId,
    occasion,
    operationKey: key,
    fingerprint,
    occurrence,
    accountSequence: sequence,
    approval,
    config: version.config,
    windowStart: now - version.config.freshnessDays * 86400000,
    windowEnd: now,
    deadline: now + 120000,
    state: reason ? "blocked" : "queued",
    generation: 1,
    createdAt: now,
    finishedAt: reason ? now : null,
    reason,
    usageMicros: null,
  });
  if (!reason) {
    await ctx.db.patch(p._id, { activeOrderId: orderId });
    await ctx.scheduler.runAfter(0, internal.research.runs.execute, {
      orderId,
      generation: 1,
    });
  }
  return orderId;
}
export const start = workspaceMutation({
  args: {
    profileId: v.id("researchProfiles"),
    expectedRevision: v.number(),
    operationKey: v.string(),
  },
  returns: v.id("researchOrders"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    operationKey(a.operationKey);
    const { profile: p, version } = await currentProfile(
      ctx,
      ctx.workspace._id,
      a.profileId,
    );
    const fingerprint = await sha256(JSON.stringify(a));
    const old = await ctx.db
      .query("researchOrders")
      .withIndex("by_profileId_and_actorId_and_operationKey", (q) =>
        q
          .eq("profileId", p._id)
          .eq("actorId", ctx.user._id)
          .eq("operationKey", a.operationKey),
      )
      .unique();
    if (old) {
      if (old.fingerprint !== fingerprint)
        throw new ConvexError("RESEARCH_OPERATION_CONFLICT");
      return old._id;
    }
    if (
      !Number.isSafeInteger(a.expectedRevision) ||
      a.expectedRevision !== p.revision
    )
      throw new ConvexError("RESEARCH_REVISION_CONFLICT");
    return admit(
      ctx,
      p,
      version,
      ctx.user._id,
      "manual",
      a.operationKey,
      fingerprint,
    );
  },
});
export const execute = internalMutation({
  args: { orderId: v.id("researchOrders"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    if (!o || o.generation !== a.generation || o.state !== "queued")
      return null;
    let reason = "RESEARCH_DOWNSTREAM_UNAVAILABLE";
    try {
      const p = await ctx.db.get(o.profileId);
      requireReference(o.workspaceId, p);
      if (p!.activeOrderId !== o._id || o.deadline <= Date.now())
        throw new ConvexError("RESEARCH_ORDER_EXPIRED");
      await liveAuthority(ctx, p!, o.actorId, o.accountSequence);
      const approval = await prerequisites(ctx, p!, o.config);
      if (!o.approval || !sameApproval(approval, o.approval))
        throw new ConvexError("RESEARCH_CONFIGURATION_CHANGED");
    } catch (e) {
      reason =
        e instanceof ConvexError && typeof e.data === "string"
          ? e.data
          : "RESEARCH_AUTHORITY_UNAVAILABLE";
    }
    // TASK20 has no paid/provider implementation. A future adapter must never turn this admission into paid work.
    await ctx.db.patch(o._id, {
      state: "blocked",
      reason,
      finishedAt: Date.now(),
    });
    const p = await ctx.db.get(o.profileId);
    if (p?.activeOrderId === o._id)
      await ctx.db.patch(p._id, { activeOrderId: null });
    return null;
  },
});
export const stop = workspaceMutation({
  args: { orderId: v.id("researchOrders") },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const o = await ctx.db.get(a.orderId);
    requireReference(ctx.workspace._id, o);
    if (o!.state !== "queued" && o!.state !== "running") return null;
    await ctx.db.patch(o!._id, {
      state: "cancelled",
      generation: o!.generation + 1,
      reason: "RESEARCH_STOPPED",
      finishedAt: Date.now(),
    });
    const p = await ctx.db.get(o!.profileId);
    if (p?.activeOrderId === o!._id)
      await ctx.db.patch(p._id, { activeOrderId: null });
    return null;
  },
});
export const history = workspaceQuery({
  args: {
    profileId: v.id("researchProfiles"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(orderDoc),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, a) => {
    await currentProfile(ctx, ctx.workspace._id, a.profileId);
    if (
      !Number.isSafeInteger(a.paginationOpts.numItems) ||
      a.paginationOpts.numItems < 1 ||
      a.paginationOpts.numItems > 25
    )
      throw new ConvexError("RESEARCH_PAGE_LIMIT");
    const result = await ctx.db
      .query("researchOrders")
      .withIndex("by_profileId_and_createdAt", (q) =>
        q.eq("profileId", a.profileId),
      )
      .order("desc")
      .paginate(a.paginationOpts);
    return {
      page: result.page.map(
        ({
          approval,
          actorId,
          accountSequence,
          fingerprint,
          operationKey,
          ...safe
        }) => safe,
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
