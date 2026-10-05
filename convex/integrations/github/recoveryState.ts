import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import {
  workspaceQuery,
  workspaceInternalQuery,
  workspaceInternalMutation,
  requireRole,
} from "../../lib/authorization";
import { checkSource } from "./repositories";
import { recoveryFields, observedDelivery } from "./signalFields";
import { localEvidence, admitFact } from "./deliveries";
import type { QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
async function checkRecoverySource(
  ctx: QueryCtx,
  r: Doc<"githubRecoveries">,
  generation: number,
) {
  const source = await checkSource(
    ctx,
    r.workspaceId,
    r.repositoryId,
    generation,
    "monitoring",
  );
  if (
    source.providerId !== r.providerId ||
    source.installationId !== r.installationId
  )
    throw new ConvexError("GITHUB_SOURCE_DISABLED");
  return source;
}
const scanFields = {
  sequence: v.number(),
  cursor: v.union(v.string(), v.null()),
  startedAt: v.number(),
  checkedAt: v.number(),
  oldestAt: v.union(v.number(), v.null()),
  limited: v.boolean(),
  notBefore: v.number(),
  errorCode: v.union(v.string(), v.null()),
  pages: v.number(),
};
export const scanClaim = internalMutation({
  args: {},
  returns: v.union(v.object(scanFields), v.null()),
  handler: async (ctx) => {
    const s = await ctx.db
        .query("githubRecoveryScan")
        .withIndex("by_key", (q) => q.eq("key", "app"))
        .unique(),
      now = Date.now();
    if (s && (s.leaseUntil > now || s.notBefore > now)) return null;
    if (
      s?.cursor &&
      (s.pages >= 10 || now - s.startedAt >= 120000) &&
      now - s.startedAt < 900000
    )
      return null;
    const continuation =
      s?.cursor && s.pages < 10 && now - s.startedAt < 120000;
    const data = {
      sequence: (s?.sequence ?? 0) + 1,
      cursor: continuation ? s.cursor : null,
      startedAt: continuation ? s.startedAt : now,
      checkedAt: s?.checkedAt ?? 0,
      oldestAt: continuation ? s.oldestAt : null,
      limited: true,
      notBefore: s?.notBefore ?? 0,
      errorCode: null,
      pages: continuation ? s.pages : 0,
    };
    if (s) await ctx.db.patch(s._id, { ...data, leaseUntil: now + 60000 });
    else
      await ctx.db.insert("githubRecoveryScan", {
        key: "app",
        ...data,
        leaseUntil: now + 60000,
      });
    return data;
  },
});
export const scanFinish = internalMutation({
  args: {
    sequence: v.number(),
    deliveries: v.array(observedDelivery),
    cursor: v.union(v.string(), v.null()),
    oldestAt: v.union(v.number(), v.null()),
    limited: v.boolean(),
    notBefore: v.number(),
    errorCode: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const s = await ctx.db
      .query("githubRecoveryScan")
      .withIndex("by_key", (q) => q.eq("key", "app"))
      .unique();
    if (!s || s.sequence !== a.sequence || s.leaseUntil <= Date.now())
      return null;
    if (a.deliveries.length > 100)
      throw new ConvexError("GITHUB_RECOVERY_LIMIT");
    for (const d of a.deliveries)
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.github.recoveryState.track,
        { delivery: d, cursor: null },
      );
    const pages = s.pages + 1;
    await ctx.db.patch(s._id, {
      cursor: a.cursor,
      oldestAt: a.oldestAt,
      limited: a.limited,
      checkedAt: Date.now(),
      pages,
      leaseUntil: 0,
      notBefore: a.errorCode
        ? a.notBefore
        : a.cursor && pages < 10
          ? 0
          : Date.now() + (a.cursor ? 900000 : 60000),
      errorCode: a.errorCode,
    });
    if (a.cursor && !a.errorCode && pages < 10)
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.github.recovery.scan,
        {},
      );
    return null;
  },
});
export const track = internalMutation({
  args: { delivery: observedDelivery, cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const d = a.delivery;
    const page = await ctx.db
      .query("githubRepositories")
      .withIndex("by_providerId_and_installationId_and_selected", (q) =>
        q
          .eq("providerId", d.providerId)
          .eq("installationId", d.installationId)
          .eq("selected", true),
      )
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const r of page.page) {
      try {
        await checkSource(
          ctx,
          r.workspaceId,
          r._id,
          r.generation,
          "monitoring",
        );
      } catch {
        continue;
      }
      const old = await ctx.db
        .query("githubRecoveries")
        .withIndex("by_workspaceId_and_guid", (q) =>
          q.eq("workspaceId", r.workspaceId).eq("guid", d.guid),
        )
        .unique();
      const { signal } = await localEvidence(ctx, r.workspaceId, d.guid);
      if (old) {
        if (signal && old.state !== "processed")
          await ctx.db.patch(old._id, {
            state: "processed",
            leaseUntil: 0,
            updatedAt: Date.now(),
            errorCode: null,
          });
        // Stable GUID groups redelivery attempts. Do not reset unknown/accepted POST outcomes during polling.
        else if (
          old.generation !== r.generation &&
          !["requesting", "accepted", "unknown"].includes(old.state)
        )
          await ctx.db.patch(old._id, {
            generation: r.generation,
            repositoryId: r._id,
            updatedAt: Date.now(),
          });
        continue;
      }
      if (signal) continue;
      await ctx.db.insert("githubRecoveries", {
        workspaceId: r.workspaceId,
        repositoryId: r._id,
        generation: r.generation,
        providerId: d.providerId,
        installationId: d.installationId,
        deliveryId: d.deliveryId,
        guid: d.guid,
        event: d.event,
        deliveredAt: d.deliveredAt,
        providerStatus: d.providerStatus,
        state: "missing",
        sequence: 0,
        attempts: 0,
        leaseUntil: 0,
        notBefore: 0,
        updatedAt: Date.now(),
        errorCode: null,
      });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.github.recoveryState.track,
        { delivery: d, cursor: page.continueCursor },
      );
    return null;
  },
});
export const authorize = workspaceInternalQuery({
  args: {
    recoveryId: v.optional(v.id("githubRecoveries")),
    expectedGeneration: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    if (ctx.user.activeWorkspaceId !== ctx.workspace._id)
      throw new ConvexError("GITHUB_WORKSPACE_CHANGED");
    if (!a.recoveryId || a.expectedGeneration === undefined) return false;
    const r = await ctx.db.get(a.recoveryId);
    if (!r || r.workspaceId !== ctx.workspace._id)
      throw new ConvexError("REFERENCE_ACCESS_DENIED");
    await checkRecoverySource(ctx, r, a.expectedGeneration);
    return Boolean((await localEvidence(ctx, r.workspaceId, r.guid)).receipt);
  },
});
const recoveryDoc = v.object({
  _id: v.id("githubRecoveries"),
  _creationTime: v.number(),
  ...recoveryFields,
});
export const claim = workspaceInternalMutation({
  args: {
    recoveryId: v.id("githubRecoveries"),
    expectedGeneration: v.number(),
  },
  returns: v.union(recoveryDoc, v.null()),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    if (ctx.user.activeWorkspaceId !== ctx.workspace._id)
      throw new ConvexError("GITHUB_WORKSPACE_CHANGED");
    const r = await ctx.db.get(a.recoveryId);
    if (!r || r.workspaceId !== ctx.workspace._id)
      throw new ConvexError("REFERENCE_ACCESS_DENIED");
    const source = await checkRecoverySource(ctx, r, a.expectedGeneration);
    const { receipt, signal } = await localEvidence(ctx, r.workspaceId, r.guid);
    if (signal || r.state === "processed")
      throw new ConvexError("GITHUB_RECOVERY_ALREADY_PROCESSED");
    if (receipt) {
      if (
        receipt.facts.kind !== r.event ||
        (await admitFact(ctx, receipt, source, {
          actorId: ctx.user._id,
          authorizedAt: Date.now(),
          recoveryId: r._id,
        })) === null
      )
        throw new ConvexError("GITHUB_RECOVERY_SOURCE_BLOCKED");
      // The human command admits only this tenant's signed facts under its current proof; no remote attempt.
      await ctx.db.patch(r._id, {
        generation: a.expectedGeneration,
        sequence: r.sequence + 1,
        state: "processed",
        leaseUntil: 0,
        updatedAt: Date.now(),
        errorCode: null,
      });
      if (receipt.state === "pending")
        await ctx.scheduler.runAfter(
          0,
          internal.integrations.github.deliveries.process,
          { receiptId: receipt._id },
        );
      return null;
    }
    const otherPending = await ctx.db
      .query("githubRecoveries")
      .withIndex("by_guid_and_notBefore", (q) =>
        q.eq("guid", r.guid).gt("notBefore", Date.now()),
      )
      .first();
    const lastAttempt = await ctx.db
      .query("githubRecoveries")
      .withIndex("by_guid_and_attempts", (q) => q.eq("guid", r.guid))
      .order("desc")
      .first();
    if (
      r.leaseUntil > Date.now() ||
      r.notBefore > Date.now() ||
      (lastAttempt?.attempts ?? 0) >= 3 ||
      otherPending
    )
      throw new ConvexError("GITHUB_RECOVERY_NOT_READY");
    const fields = {
      generation: a.expectedGeneration,
      sequence: r.sequence + 1,
      attempts: (lastAttempt?.attempts ?? 0) + 1,
      state: "requesting" as const,
      leaseUntil: Date.now() + 60000,
      notBefore: Date.now() + 900000,
      updatedAt: Date.now(),
      errorCode: null,
    };
    await ctx.db.patch(r._id, fields);
    return { ...r, ...fields };
  },
});
export const finish = internalMutation({
  args: {
    recoveryId: v.id("githubRecoveries"),
    sequence: v.number(),
    accepted: v.boolean(),
    code: v.union(v.string(), v.null()),
    notBefore: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.recoveryId);
    if (!r || r.sequence !== a.sequence || r.state === "processed") return null;
    let current = true;
    try {
      await checkRecoverySource(ctx, r, r.generation);
    } catch {
      current = false;
    }
    const { signal } = await localEvidence(ctx, r.workspaceId, r.guid);
    await ctx.db.patch(r._id, {
      state: signal
        ? "processed"
        : a.accepted && current
          ? "accepted"
          : "unknown",
      leaseUntil: 0,
      notBefore: Math.max(r.notBefore, a.notBefore),
      errorCode: current ? a.code : "GITHUB_SOURCE_DISABLED",
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const scope = workspaceInternalQuery({
  args: { recoveryId: v.id("githubRecoveries"), sequence: v.number() },
  returns: recoveryDoc,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    if (ctx.user.activeWorkspaceId !== ctx.workspace._id)
      throw new ConvexError("GITHUB_WORKSPACE_CHANGED");
    const r = await ctx.db.get(a.recoveryId);
    if (
      !r ||
      r.sequence !== a.sequence ||
      r.state !== "requesting" ||
      r.leaseUntil <= Date.now()
    )
      throw new ConvexError("GITHUB_RECOVERY_NOT_READY");
    if (r.workspaceId !== ctx.workspace._id)
      throw new ConvexError("REFERENCE_ACCESS_DENIED");
    await checkRecoverySource(ctx, r, r.generation);
    return r;
  },
});
export const scanStatus = workspaceQuery({
  args: {},
  returns: v.union(
    v.object({
      checkedAt: v.number(),
      oldestAt: v.union(v.number(), v.null()),
      limited: v.boolean(),
      errorCode: v.union(v.string(), v.null()),
      notBefore: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = await ctx.db
      .query("githubRecoveryScan")
      .withIndex("by_key", (q) => q.eq("key", "app"))
      .unique();
    return s
      ? {
          checkedAt: s.checkedAt,
          oldestAt: s.oldestAt,
          limited: s.limited,
          errorCode: s.errorCode,
          notBefore: s.notBefore,
        }
      : null;
  },
});
