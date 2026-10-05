import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  workspaceMutation,
  workspaceQuery,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { currentProfile, operationKey } from "./access";
import {
  policy,
  grants,
  fingerprint,
  orderAuthority,
  sourceAuthority,
} from "./providerAccess";
import {
  operation,
  publicSource,
  resultState,
  policyFields,
} from "./providerFields";
import { orderFields } from "./fields";
import type { Doc } from "../_generated/dataModel";
import { sha256 } from "../lib/crypto";
export const start = workspaceMutation({
  args: {
    profileId: v.id("researchProfiles"),
    expectedRevision: v.number(),
    operationKey: v.string(),
    query: v.string(),
    language: v.string(),
    operations: v.array(operation),
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
    const hash = await sha256(JSON.stringify(a));
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
      if (old.fingerprint !== hash || !old.native)
        throw new ConvexError("RESEARCH_OPERATION_CONFLICT");
      return old._id;
    }
    if (
      p.deleted ||
      p.paused ||
      p.activeOrderId ||
      p.revision !== a.expectedRevision ||
      !Number.isSafeInteger(a.expectedRevision)
    )
      throw new ConvexError("RESEARCH_REVISION_CONFLICT");
    if (
      !a.query.trim() ||
      a.query.length > 450 ||
      /[\u0000-\u001f]/.test(a.query) ||
      !version.config.languages.includes(a.language) ||
      a.operations.length < 1 ||
      a.operations.length > 3 ||
      new Set(a.operations).size !== a.operations.length ||
      !version.config.cap
    )
      throw new ConvexError("RESEARCH_NATIVE_INPUT_INVALID");
    const approvals = [];
    for (const op of a.operations) {
      try {
        const sourcePolicy = await policy(ctx, p.workspaceId, p.accountId, op);
        if (sourcePolicy.currency !== version.config.cap.currency)
          throw new ConvexError("RESEARCH_CURRENCY_INCOMPATIBLE");
        approvals.push({
          policyId: sourcePolicy._id,
          fingerprint: await fingerprint(sourcePolicy),
          budgetIds: await grants(ctx, sourcePolicy),
        });
      } catch {
        approvals.push(null);
      }
    }
    const now = Date.now(),
      acc = await ctx.db.get(p.accountId);
    const id = await ctx.db.insert("researchOrders", {
      workspaceId: p.workspaceId,
      accountId: p.accountId,
      profileId: p._id,
      profileVersionId: version._id,
      actorId: ctx.user._id,
      occasion: "manual",
      operationKey: a.operationKey,
      fingerprint: hash,
      occurrence: null,
      accountSequence: acc?.xEvidence?.connectionSequence ?? 0,
      approval: null,
      config: version.config,
      windowStart: now - version.config.freshnessDays * 86400000,
      windowEnd: now,
      deadline: now + 120000,
      state: "queued",
      generation: 1,
      createdAt: now,
      finishedAt: null,
      reason: null,
      usageMicros: null,
      native: {
        accountIdentity: acc!.providerIdentity,
        query: a.query,
        language: a.language,
        operations: a.operations,
        approvals,
        cacheIds: a.operations.map(() => null),
        outcomes: a.operations.map(() => ({
          state: "unknown" as const,
          reason: "RESEARCH_QUEUED",
          cacheHit: false,
        })),
      },
    });
    await ctx.db.patch(p._id, { activeOrderId: id });
    await ctx.scheduler.runAfter(0, internal.research.execute.execute, {
      orderId: id,
      generation: 1,
    });
    return id;
  },
});
export const context = internalQuery({
  args: { orderId: v.id("researchOrders"), generation: v.number(), operation },
  returns: v.object({
    order: v.object({
      _id: v.id("researchOrders"),
      _creationTime: v.number(),
      ...orderFields,
    }),
    policy: v.object({
      _id: v.id("researchSourcePolicies"),
      _creationTime: v.number(),
      ...policyFields,
    }),
  }),
  handler: async (ctx, a) => {
    const order = await orderAuthority(ctx, a.orderId, a.generation),
      { p } = await sourceAuthority(ctx, order, a.operation);
    return { order, policy: p };
  },
});
export const outcome = internalMutation({
  args: {
    orderId: v.id("researchOrders"),
    generation: v.number(),
    operation,
    state: resultState,
    reason: v.union(v.string(), v.null()),
    cacheHit: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    if (
      !o?.native ||
      o.generation !== a.generation ||
      (o.state !== "queued" && o.state !== "running")
    )
      return null;
    const index = o.native.operations.indexOf(a.operation);
    if (index < 0) throw new ConvexError("RESEARCH_SOURCE_CHANGED");
    const outcomes = [...o.native.outcomes];
    outcomes[index] = {
      state: a.state,
      reason: a.reason,
      cacheHit: a.cacheHit,
    };
    await ctx.db.patch(o._id, { native: { ...o.native, outcomes } });
    return null;
  },
});
export const finish = internalMutation({
  args: { orderId: v.id("researchOrders"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    if (
      !o?.native ||
      o.generation !== a.generation ||
      (o.state !== "queued" && o.state !== "running")
    )
      return null;
    await ctx.db.patch(o._id, { state: "completed", finishedAt: Date.now() });
    const p = await ctx.db.get(o.profileId);
    if (p?.activeOrderId === o._id)
      await ctx.db.patch(p._id, { activeOrderId: null });
    return null;
  },
});
export const availability = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.array(
    v.object({
      operation,
      state: v.union(
        v.literal("available"),
        v.literal("configuration_required"),
      ),
      currency: v.union(v.string(), v.null()),
      reason: v.string(),
    }),
  ),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    return Promise.all(
      (["x-recent", "x-trends", "web-search"] as const).map(async (op) => {
        try {
          const p = await policy(ctx, ctx.workspace._id, a.accountId, op);
          await grants(ctx, p);
          const acc = await ctx.db.get(a.accountId);
          if (op !== "web-search" && acc!.connection !== "connected")
            throw new Error();
          return {
            operation: op,
            state: "available" as const,
            currency: p.currency,
            reason:
              op === "x-recent"
                ? "Öffentliche Posts der letzten sieben Tage; keine steigenden Trends."
                : op === "x-trends"
                  ? "Freigegebene WOEID-Snapshotzählung; kein Wachstumsnachweis."
                  : "Native Websuche mit Quellenmetadaten; Aussagen bleiben ungeprüft.",
          };
        } catch {
          return {
            operation: op,
            state: "configuration_required" as const,
            currency: null,
            reason:
              op === "x-trends"
                ? "Trendberechtigung, Auth-Modus und WOEID nicht aktuell nachgewiesen; keine Live-Trends."
                : op === "web-search"
                  ? "Suchverarbeitung und endlicher Gesamtpreis einschließlich interner Suchgebühren sowie drei Budgets erforderlich."
                  : "Öffentliche Suchberechtigung, exaktes Feldprotokoll, Preise und laufende Quellenkontrolle erforderlich.",
          };
        }
      }),
    );
  },
});
export const results = workspaceQuery({
  args: { orderId: v.id("researchOrders") },
  returns: v.array(
    v.object({
      operation,
      query: v.string(),
      language: v.string(),
      provider: v.string(),
      protocol: v.union(v.string(), v.null()),
      policyVersion: v.union(v.string(), v.null()),
      model: v.union(v.string(), v.null()),
      state: resultState,
      reason: v.union(v.string(), v.null()),
      cacheHit: v.boolean(),
      windowStart: v.number(),
      windowEnd: v.number(),
      truncated: v.boolean(),
      sources: v.array(publicSource),
      estimatedMicros: v.union(v.number(), v.null()),
      currency: v.union(v.string(), v.null()),
      usagePending: v.boolean(),
      billedMicros: v.null(),
    }),
  ),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    requireReference(ctx.workspace._id, o);
    if (!o!.native) return [];
    const p = await ctx.db.get(o!.profileId);
    requireReference(ctx.workspace._id, p);
    const readable = !p!.paused && !p!.deleted;
    return Promise.all(
      o!.native.operations.map(async (op, i) => {
        const cacheId = o!.native!.cacheIds[i],
          cache = cacheId ? await ctx.db.get(cacheId) : null;
        const attempt = cache?.attemptId
          ? await ctx.db.get(cache.attemptId)
          : null;
        let currentPolicy: Doc<"researchSourcePolicies"> | null = null;
        let allowed = readable;
        let proofUntil = cache?.expiresAt ?? 0;
        try {
          const { p: current, captured } = await sourceAuthority(ctx, o!, op);
          currentPolicy = current;
          proofUntil = Math.min(
            proofUntil,
            current.expiresAt,
            current.lifecycleValidUntil,
          );
          for (const id of captured.budgetIds)
            proofUntil = Math.min(
              proofUntil,
              (await ctx.db.get(id))!.expiresAt,
            );
        } catch {
          allowed = false;
        }
        const sources = [];
        if (
          allowed &&
          cache &&
          cache.workspaceId === ctx.workspace._id &&
          cache.accountId === o!.accountId
        )
          for (const id of cache.sourceIds) {
            const s = await ctx.db.get(id);
            if (
              s &&
              s.workspaceId === o!.workspaceId &&
              s.accountId === o!.accountId &&
              s.status === "usable" &&
              Math.min(s.usableUntil, proofUntil) > Date.now() &&
              s.policyFingerprint === cache.policyFingerprint &&
              s.title !== null
            )
              sources.push({
                sourceId: s._id,
                operation: s.operation,
                url: s.url,
                title: s.title,
                text: s.text,
                publishedAt: s.publishedAt,
                count: s.count,
                observedAt: s.observedAt,
                usableUntil: Math.min(s.usableUntil, proofUntil),
              });
          }
        return {
          operation: op,
          query: o!.native!.query,
          language: o!.native!.language,
          provider: op === "web-search" ? "requesty" : "x",
          protocol: currentPolicy?.protocol ?? null,
          policyVersion: currentPolicy?.version ?? null,
          model: currentPolicy?.model ?? null,
          ...o!.native!.outcomes[i],
          state:
            cache?.sourceIds.length &&
            (!allowed || sources.length !== cache.sourceIds.length)
              ? ("removed" as const)
              : o!.native!.outcomes[i].state,
          reason:
            cache?.sourceIds.length &&
            (!allowed || sources.length !== cache.sourceIds.length)
              ? "RESEARCH_SOURCE_UNUSABLE"
              : o!.native!.outcomes[i].reason,
          windowStart: cache?.windowStart ?? o!.windowStart,
          windowEnd: cache?.windowEnd ?? o!.windowEnd,
          truncated: cache?.truncated ?? false,
          sources,
          estimatedMicros: o!.native!.outcomes[i].cacheHit
            ? null
            : (attempt?.estimatedMicros ?? null),
          currency: o!.native!.outcomes[i].cacheHit
            ? null
            : (attempt?.currency ?? null),
          usagePending:
            !o!.native!.outcomes[i].cacheHit &&
            !!attempt &&
            attempt.state !== "settled",
          billedMicros: null,
        };
      }),
    );
  },
});

export const executionOrder = internalQuery({
  args: { orderId: v.id("researchOrders"), generation: v.number() },
  returns: v.union(
    v.object({
      _id: v.id("researchOrders"),
      _creationTime: v.number(),
      ...orderFields,
    }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    try {
      return await orderAuthority(ctx, a.orderId, a.generation);
    } catch {
      return null;
    }
  },
});
