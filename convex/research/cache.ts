import { clearSourceCopies, materialHash } from "./evidence";
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
import {
  orderAuthority,
  sourceAuthority,
  provider,
  nativeAttempt,
} from "./providerAccess";
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
    // Durable identity follows the actual request; elapsed time and profile wrappers never authorize retry.
    const inputs =
      a.operation === "x-recent"
        ? [
            o.native!.query,
            o.native!.language.split("-")[0],
            Math.min(o.config.freshnessDays, 7),
          ]
        : a.operation === "web-search"
          ? [o.native!.query, o.native!.language]
          : [p.woeid];
    const logicalIntent = await sha256(
      JSON.stringify([2, o.workspaceId, o.accountId, a.operation, ...inputs]),
    );
    const cacheKey = (intent: string) =>
      sha256(
        JSON.stringify([
          intent,
          o.actorId,
          o.profileVersionId,
          o.config,
          captured.fingerprint,
          Math.floor(o.windowEnd / 300000),
        ]),
      );
    const key = await cacheKey(logicalIntent);
    const lookup = (key: string) =>
      ctx.db
        .query("researchCaches")
        .withIndex("by_workspaceId_and_accountId_and_key", (q) =>
          q
            .eq("workspaceId", o.workspaceId)
            .eq("accountId", o.accountId)
            .eq("key", key),
        )
        .unique();
    let prior = await lookup(key);
    if (!prior) {
      // One exact old cache probe preserves authorized hits from an unchanged pre-v2 snapshot.
      const oldIntent = await sha256(
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
      const old = await lookup(await cacheKey(oldIntent));
      if (old?.state === "completed" || old?.state === "empty") prior = old;
    }
    if (prior) {
      if (!prior.attemptId)
        throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
      const owned = await nativeAttempt(ctx, prior.attemptId);
      if (
        owned.c._id !== prior._id ||
        owned.t.workspaceId !== o.workspaceId ||
        owned.t.accountId !== o.accountId ||
        owned.t.operation !== a.operation
      )
        throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
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
    // Old raw hashes cannot reconstruct all effective requests after policy/profile changes.
    // Fail closed for this account/source family until old sent/unknown liability is reconciled.
    for (const state of ["sent", "unknown"] as const) {
      const legacy = await ctx.db
        .query("aiAttempts")
        .withIndex("by_native_legacy_intent", (q) =>
          q
            .eq("workspaceId", o.workspaceId)
            .eq("accountId", o.accountId)
            .eq("operation", a.operation)
            .eq("intentVersion", undefined)
            .eq("state", state),
        )
        .take(101);
      if (legacy.length > 100)
        throw new ConvexError("RESEARCH_LEGACY_INTENT_RECONCILIATION_REQUIRED");
      for (const receipt of legacy) await nativeAttempt(ctx, receipt._id);
      if (legacy.length)
        throw new ConvexError("RESEARCH_LEGACY_INTENT_RECONCILIATION_REQUIRED");
    }
    const historical = await ctx.db
      .query("aiAttempts")
      .withIndex("by_logicalIntent", (q) =>
        q.eq("logicalIntent", logicalIntent),
      )
      .take(101);
    for (const receipt of historical) {
      const { t } = await nativeAttempt(ctx, receipt._id);
      if (
        t.workspaceId !== o.workspaceId ||
        t.accountId !== o.accountId ||
        t.operation !== a.operation
      )
        throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
    }
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
    for (const receipt of attempts) {
      const { t } = await nativeAttempt(ctx, receipt._id);
      if (t.researchOrderId !== o._id)
        throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
    }
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
      intentVersion: 2,
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
    const { t, o } = await nativeAttempt(ctx, a.attemptId);
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
    if (
      (knownUnits && t.units !== null && t.units !== a.units) ||
      (knownCost &&
        t.reportedCost !== null &&
        t.reportedCost !== a.reportedCost)
    )
      throw new ConvexError("RESEARCH_RECEIPT_CONFLICT");
    const invalid = t.reportedCostInvalid || a.costInvalid;
    const known =
      !invalid &&
      (t.operation === "web-search"
        ? knownCost && !!t.costCurrencyEvidence.trim()
        : knownUnits && a.reportedCost === null);
    const receipt = await sha256(
      JSON.stringify([a.units, a.reportedCost, a.costInvalid]),
    );
    if (t.receiptFingerprint !== null && t.receiptFingerprint !== receipt)
      throw new ConvexError("RESEARCH_RECEIPT_CONFLICT");
    if (t.state === "settled") return null;
    if (!known) {
      await ctx.db.patch(t._id, {
        state: "unknown",
        units: knownUnits ? a.units : t.units,
        reportedCost: knownCost ? a.reportedCost : t.reportedCost,
        reportedCostInvalid: invalid,
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
      if (old) {
        await ctx.db.patch(id, payload);
        // ponytail: a 20-source fill clears 10 copies per source here; bounded continuations drain the rest.
        await clearSourceCopies(ctx, id, await materialHash(old), 10);
      }
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
    await clearSourceCopies(ctx, s!._id);
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
    await clearSourceCopies(ctx, s._id);
    return null;
  },
});
