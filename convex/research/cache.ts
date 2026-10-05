import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import {
  workspaceMutation,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { changeLiability } from "../ai/accounting";
import { sha256 } from "../lib/crypto";
import { orderAuthority, sourceAuthority, provider } from "./providerAccess";
import { operation, delivered, resultState } from "./providerFields";
export const begin = internalMutation({
  args: { orderId: v.id("researchOrders"), generation: v.number(), operation },
  returns: v.object({
    cacheId: v.id("researchCaches"),
    attemptId: v.union(v.id("aiAttempts"), v.null()),
    cacheHit: v.boolean(),
    state: resultState,
  }),
  handler: async (ctx, a) => {
    const o = await orderAuthority(ctx, a.orderId, a.generation),
      { p, captured } = await sourceAuthority(ctx, o, a.operation);
    const windowStart =
      a.operation === "x-recent"
        ? Math.max(o.windowStart, o.windowEnd - 7 * 86400000 + 1000)
        : o.windowStart;
    const logicalIntent = await sha256(
      JSON.stringify([
        o.workspaceId,
        o.accountId,
        o.profileId,
        a.operation,
        o.native!.query,
        o.native!.language,
        o.config.freshnessDays,
        p.woeid,
      ]),
    );
    const key = await sha256(
      JSON.stringify([
        logicalIntent,
        o.actorId,
        o.profileVersionId,
        o.config,
        captured.fingerprint,
        Math.floor(o.windowEnd / 300000),
      ]),
    );
    const prior = await ctx.db
      .query("researchCaches")
      .withIndex("by_workspaceId_and_accountId_and_key", (q) =>
        q
          .eq("workspaceId", o.workspaceId)
          .eq("accountId", o.accountId)
          .eq("key", key),
      )
      .unique();
    if (prior) {
      if (prior.state !== "completed" && prior.state !== "empty")
        throw new ConvexError("RESEARCH_FILL_UNRESOLVED");
      if (prior.expiresAt > Date.now()) {
        let valid = true;
        for (const id of prior.sourceIds) {
          const s = await ctx.db.get(id);
          if (
            !s ||
            s.status !== "usable" ||
            s.usableUntil <= Date.now() ||
            s.policyFingerprint !== captured.fingerprint ||
            s.workspaceId !== o.workspaceId ||
            s.accountId !== o.accountId
          )
            valid = false;
        }
        if (valid) {
          const ids = [...o.native!.cacheIds];
          ids[o.native!.operations.indexOf(a.operation)] = prior._id;
          await ctx.db.patch(o._id, {
            native: { ...o.native!, cacheIds: ids },
          });
          return {
            cacheId: prior._id,
            attemptId: null,
            cacheHit: true,
            state: prior.state,
          };
        }
      }
      // An expired known fill is replaced only by this new explicit order; unknown fills never expire into retry authority.
      if (prior.orderId === o._id)
        throw new ConvexError("RESEARCH_ATTEMPT_ALREADY_ADMITTED");
      await ctx.db.patch(prior._id, { key: `expired:${prior._id}` });
    }
    const historical = await ctx.db
      .query("aiAttempts")
      .withIndex("by_logicalIntent", (q) =>
        q.eq("logicalIntent", logicalIntent),
      )
      .take(101);
    if (
      historical.length > 100 ||
      historical.some((x) => x.state === "sent" || x.state === "unknown")
    )
      throw new ConvexError("RESEARCH_PREVIOUS_ATTEMPT_UNRESOLVED");
    const attempts = await ctx.db
      .query("aiAttempts")
      .withIndex("by_researchOrderId_and_key", (q) =>
        q.eq("researchOrderId", o._id),
      )
      .take(31);
    if (
      attempts.length > 30 ||
      attempts.some((x) => x.owner !== "native-search")
    )
      throw new ConvexError("RESEARCH_ORDER_RECEIPT_INVALID");
    if (attempts.some((x) => x.key === a.operation))
      throw new ConvexError("RESEARCH_ATTEMPT_ALREADY_ADMITTED");
    const reservedMicros = p.unitMicros * (a.operation === "x-recent" ? 10 : 1),
      total = attempts.reduce(
        (sum, x) =>
          sum +
          x.heldMicros +
          (x.estimatedMicros ?? 0) * (x.state === "settled" ? 1 : 0),
        0,
      );
    if (
      !Number.isSafeInteger(reservedMicros) ||
      !Number.isSafeInteger(total) ||
      !o.config.cap ||
      p.currency !== o.config.cap.currency ||
      total + reservedMicros > o.config.cap.limitMicros
    )
      throw new ConvexError("RESEARCH_ORDER_BUDGET_EXHAUSTED");
    await changeLiability(ctx, captured.budgetIds, reservedMicros, 0, true);
    const now = Date.now(),
      cacheId = await ctx.db.insert("researchCaches", {
        workspaceId: o.workspaceId,
        accountId: o.accountId,
        key,
        logicalIntent,
        orderId: o._id,
        operation: a.operation,
        policyId: p._id,
        policyFingerprint: captured.fingerprint,
        generation: o.generation,
        leaseUntil: Math.min(o.deadline, now + 20000),
        createdAt: now,
        expiresAt: now + Math.min(300000, p.retentionMs),
        state: "unknown",
        sourceIds: [],
        reason: "RESEARCH_FILL_PENDING",
        attemptId: null,
        windowStart,
        windowEnd: o.windowEnd,
        truncated: false,
      });
    const attemptId = await ctx.db.insert("aiAttempts", {
      owner: "native-search",
      workspaceId: o.workspaceId,
      accountId: o.accountId,
      researchOrderId: o._id,
      cacheId,
      logicalIntent,
      operation: a.operation,
      key: a.operation,
      generation: o.generation,
      budgetIds: captured.budgetIds,
      reservedMicros,
      heldMicros: reservedMicros,
      currency: p.currency,
      policyVersion: p.version,
      policyId: p._id,
      policyFingerprint: captured.fingerprint,
      provider: provider(a.operation),
      unit: p.unit,
      unitMicros: p.unitMicros,
      costCurrencyEvidence: p.costCurrencyEvidence,
      state: "sent",
      sentAt: now,
      settledAt: null,
      estimatedMicros: null,
      billedMicros: null,
      reportedCost: null,
      reportedCurrency: null,
      reportedCostInvalid: false,
      errorCode: null,
      units: null,
      receiptFingerprint: null,
    });
    await ctx.db.patch(cacheId, { attemptId });
    const ids = [...o.native!.cacheIds];
    ids[o.native!.operations.indexOf(a.operation)] = cacheId;
    await ctx.db.patch(o._id, {
      state: "running",
      native: { ...o.native!, cacheIds: ids },
    });
    return { cacheId, attemptId, cacheHit: false, state: "unknown" as const };
  },
});
export const settle = internalMutation({
  args: {
    attemptId: v.id("aiAttempts"),
    units: v.union(v.number(), v.null()),
    reportedCost: v.union(v.number(), v.null()),
    costInvalid: v.boolean(),
    errorCode: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.attemptId);
    if (!t || t.owner !== "native-search" || t.runId !== undefined)
      throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
    const o = await ctx.db.get(t.researchOrderId),
      c = await ctx.db.get(t.cacheId);
    const captured =
      o?.native?.approvals[o.native.operations.indexOf(t.operation)];
    if (
      !captured ||
      captured.policyId !== t.policyId ||
      captured.fingerprint !== t.policyFingerprint ||
      captured.budgetIds.length !== t.budgetIds.length ||
      captured.budgetIds.some((id, i) => id !== t.budgetIds[i]) ||
      c?.operation !== t.operation ||
      c?.generation !== t.generation ||
      o?.config.cap?.currency !== t.currency ||
      !o?.native ||
      !c ||
      o.workspaceId !== t.workspaceId ||
      o.accountId !== t.accountId ||
      c.orderId !== o._id ||
      c.attemptId !== t._id ||
      c.logicalIntent !== t.logicalIntent ||
      c.policyId !== t.policyId ||
      c.policyFingerprint !== t.policyFingerprint ||
      !o.native.operations.includes(t.operation)
    )
      throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
    const knownUnits =
      a.units !== null &&
      Number.isSafeInteger(a.units) &&
      a.units >= 0 &&
      a.units <= 10000;
    const knownCost =
      a.reportedCost !== null &&
      Number.isFinite(a.reportedCost) &&
      a.reportedCost >= 0 &&
      a.reportedCost <= 1e6 &&
      !a.costInvalid;
    const known =
      t.operation === "web-search"
        ? knownCost && !!t.costCurrencyEvidence.trim()
        : knownUnits && !a.costInvalid && a.reportedCost === null;
    const receipt = await sha256(
      JSON.stringify([a.units, a.reportedCost, a.costInvalid]),
    );
    if (t.receiptFingerprint !== null && t.receiptFingerprint !== receipt)
      throw new ConvexError("RESEARCH_RECEIPT_CONFLICT");
    if (t.state === "settled") return null;
    if (!known) {
      await ctx.db.patch(t._id, {
        state: "unknown",
        reportedCost: knownCost ? a.reportedCost : null,
        reportedCostInvalid: a.costInvalid,
        errorCode: a.errorCode ?? "RESEARCH_USAGE_UNKNOWN",
      });
      return null;
    }
    const estimatedMicros =
      t.operation === "web-search"
        ? Math.ceil(a.reportedCost! * 1e6)
        : a.units! * t.unitMicros;
    if (!Number.isSafeInteger(estimatedMicros) || estimatedMicros < 0)
      throw new ConvexError("RESEARCH_RECEIPT_INVALID");
    await changeLiability(ctx, t.budgetIds, -t.heldMicros, estimatedMicros);
    await ctx.db.patch(t._id, {
      state: "settled",
      heldMicros: 0,
      estimatedMicros,
      settledAt: Date.now(),
      units: a.units,
      reportedCost: a.reportedCost,
      reportedCostInvalid: a.costInvalid,
      receiptFingerprint: receipt,
      errorCode: a.errorCode,
    });
    if (
      estimatedMicros > t.reservedMicros &&
      (o.state === "running" || o.state === "queued")
    ) {
      await ctx.db.patch(o._id, {
        state: "cancelled",
        generation: o.generation + 1,
        reason: "RESEARCH_BUDGET_OVERRUN",
        finishedAt: Date.now(),
      });
      const p = await ctx.db.get(o.profileId);
      if (p?.activeOrderId === o._id)
        await ctx.db.patch(p._id, { activeOrderId: null });
    }
    return null;
  },
});
export const commit = internalMutation({
  args: {
    orderId: v.id("researchOrders"),
    generation: v.number(),
    cacheId: v.id("researchCaches"),
    state: resultState,
    reason: v.union(v.string(), v.null()),
    sources: v.array(delivered),
    truncated: v.boolean(),
  },
  returns: resultState,
  handler: async (ctx, a) => {
    const o = await orderAuthority(ctx, a.orderId, a.generation),
      c = await ctx.db.get(a.cacheId);
    if (!c || c.orderId !== o._id || c.generation !== a.generation)
      throw new ConvexError("RESEARCH_FILL_CHANGED");
    const { p, captured } = await sourceAuthority(ctx, o, c.operation);
    if (
      c.policyFingerprint !== captured.fingerprint ||
      c.sourceIds.length ||
      a.sources.length > 20
    )
      throw new ConvexError("RESEARCH_FILL_CHANGED");
    const ids = [];
    let removed = false;
    for (const value of a.sources) {
      if (
        !value.providerIdentity ||
        value.providerIdentity.length > 2000 ||
        value.title.length > 500 ||
        (value.text?.length ?? 0) > 2000 ||
        (value.url?.length ?? 0) > 2000
      )
        throw new ConvexError("RESEARCH_OUTPUT_INVALID");
      const old = await ctx.db
        .query("researchSources")
        .withIndex(
          "by_workspaceId_and_accountId_and_operation_and_providerIdentity",
          (q) =>
            q
              .eq("workspaceId", o.workspaceId)
              .eq("accountId", o.accountId)
              .eq("operation", c.operation)
              .eq("providerIdentity", value.providerIdentity),
        )
        .unique();
      if (old && old.status !== "usable") {
        removed = true;
        continue;
      }
      const payload = {
        ...value,
        workspaceId: o.workspaceId,
        accountId: o.accountId,
        operation: c.operation,
        policyId: p._id,
        policyFingerprint: captured.fingerprint,
        generation: p.generation,
        observedAt: Date.now(),
        usableUntil: Math.min(
          Date.now() + p.retentionMs,
          p.expiresAt,
          p.lifecycleValidUntil,
        ),
        status: "usable" as const,
        reason: null,
        removedAt: null,
      };
      const id = old
        ? old._id
        : await ctx.db.insert("researchSources", payload);
      if (old) await ctx.db.patch(id, payload);
      ids.push(id);
      await ctx.scheduler.runAt(
        payload.usableUntil,
        internal.research.cache.expire,
        {
          sourceId: id,
          generation: payload.generation,
          usableUntil: payload.usableUntil,
        },
      );
    }
    const state = removed ? ("removed" as const) : a.state;
    await ctx.db.patch(c._id, {
      state,
      sourceIds: ids,
      reason: removed ? "RESEARCH_SOURCE_REMOVED" : a.reason,
      truncated: a.truncated,
      leaseUntil: 0,
    });
    return state;
  },
});
export const invalidate = workspaceMutation({
  args: {
    sourceId: v.id("researchSources"),
    reason: v.union(
      v.literal("deleted"),
      v.literal("protected"),
      v.literal("suspended"),
      v.literal("blocked"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = await ctx.db.get(a.sourceId);
    requireReference(ctx.workspace._id, s);
    requireReference(ctx.workspace._id, await ctx.db.get(s!.accountId));
    await ctx.db.patch(s!._id, {
      status: a.reason === "blocked" ? "blocked" : "removed",
      generation: s!.generation + 1,
      reason: a.reason,
      removedAt: Date.now(),
      usableUntil: 0,
      url: null,
      title: null,
      text: null,
      publishedAt: null,
      count: null,
    });
    return null;
  },
});

export const expire = internalMutation({
  args: {
    sourceId: v.id("researchSources"),
    generation: v.number(),
    usableUntil: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sourceId);
    if (
      !s ||
      s.generation !== a.generation ||
      s.usableUntil !== a.usableUntil ||
      s.usableUntil > Date.now() ||
      s.status !== "usable"
    )
      return null;
    await ctx.db.patch(s._id, {
      status: "blocked",
      generation: s.generation + 1,
      reason: "retention_expired",
      removedAt: Date.now(),
      usableUntil: 0,
      url: null,
      title: null,
      text: null,
      publishedAt: null,
      count: null,
    });
    return null;
  },
});
