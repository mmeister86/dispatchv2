import { operationalUntil } from "../lib/operationalRetention";
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
} from "../lib/authorization";
import type { Doc, Id } from "../_generated/dataModel";
import { admin, credential } from "./capabilities";
import { scope, dialect } from "./fields";
import {
  historyPolicyFields,
  historyPostDoc,
  importedPost,
} from "./historyFields";
import { credentialDoc } from "../integrations/x/fields";
import { changeLiability } from "../ai/accounting";
import { sha256 } from "../lib/crypto";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
type Ctx = QueryCtx | MutationCtx;
const positive = (n: number, max = 1e12) =>
  Number.isSafeInteger(n) && n > 0 && n <= max;
const keys = (a: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
}) => [
  "history:x",
  `history:workspace:${a.workspaceId}`,
  `history:account:${a.accountId}`,
];
const hash = (p: Doc<"historyPolicies">) => sha256(JSON.stringify(p));
async function policy(
  ctx: Ctx,
  a: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
) {
  const account = (await ctx.db.get(a.accountId))!;
  requireReference(a.workspaceId, account);
  const p = await ctx.db
    .query("historyPolicies")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
    )
    .order("desc")
    .first();
  if (
    !p ||
    account.provider !== "X" ||
    account.connection !== "connected" ||
    !/^[0-9]{1,19}$/.test(p.providerIdentity) ||
    account.providerIdentity !== p.providerIdentity ||
    !account.xEvidence?.identityVerifiedAt ||
    p.connectionSequence !== (account.xEvidence.connectionSequence ?? 0) ||
    !positive(p.expiresAt, Number.MAX_SAFE_INTEGER) ||
    p.expiresAt <= Date.now() ||
    !positive(p.retentionMs, 30 * 86400000) ||
    !positive(p.unitMicros) ||
    !positive(p.allocatedProviderLimitMicros) ||
    !Number.isSafeInteger(p.maxResults) ||
    p.maxResults < 5 ||
    p.maxResults > 100 ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(p.version) ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    [
      p.accessEvidence,
      p.rightsEvidence,
      p.pricingEvidence,
      p.protocolEvidence,
      p.allocationEvidence,
    ].some((x) => !x.trim() || x.length > 2000)
  )
    throw new ConvexError("OWN_HISTORY_CONFIGURATION_REQUIRED");
  await admin(ctx, a.workspaceId, p.approvedBy);
  return p;
}
async function grants(ctx: Ctx, p: Doc<"historyPolicies">, reserve = true) {
  const ids: Id<"aiBudgets">[] = [];
  for (const [i, key] of keys(p).entries()) {
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (
      !b ||
      b.scope !== (["provider", "workspace", "account"] as const)[i] ||
      b.policyVersion !== p.version ||
      b.currency !== p.currency ||
      !b.purposes.includes("own-history") ||
      b.expiresAt <= Date.now() ||
      !positive(b.limitMicros) ||
      !Number.isSafeInteger(b.heldMicros) ||
      b.heldMicros < 0 ||
      !Number.isSafeInteger(b.spentMicros) ||
      b.spentMicros < 0 ||
      (i === 0 &&
        (b.workspaceId !== undefined ||
          b.accountId !== undefined ||
          b.limitMicros !== p.allocatedProviderLimitMicros)) ||
      (i === 1 &&
        (b.workspaceId !== p.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== p.workspaceId || b.accountId !== p.accountId)) ||
      (i > 0 && !b.approvedBy)
    )
      throw new ConvexError("OWN_HISTORY_BUDGET_CONFIGURATION_REQUIRED");
    if (
      reserve &&
      b.spentMicros + b.heldMicros + p.maxResults * p.unitMicros > b.limitMicros
    )
      throw new ConvexError("OWN_HISTORY_BUDGET_EXHAUSTED");
    if (b.approvedBy) await admin(ctx, p.workspaceId, b.approvedBy);
    ids.push(b._id);
  }
  return ids;
}
async function control(
  ctx: Ctx,
  a: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
) {
  return ctx.db
    .query("historyControls")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
    )
    .unique();
}
async function source(
  ctx: Ctx,
  a: { jobId: Id<"historyJobs">; generation: number },
  reserve = true,
) {
  const job = await ctx.db.get(a.jobId);
  if (
    !job ||
    job.generation !== a.generation ||
    !["queued", "reading"].includes(job.state) ||
    operationalUntil(job.createdAt, job.sourceUntil) <= Date.now() ||
    job.pages >= 3
  )
    throw new ConvexError("OWN_HISTORY_INTENT_INACTIVE");
  const c = await control(ctx, job);
  if (
    !c ||
    c.generation !== job.generation ||
    c.deletedThroughGeneration >= job.generation
  )
    throw new ConvexError("OWN_HISTORY_CONTROL_CHANGED");
  await admin(ctx, job.workspaceId, job.actorId);
  const p = await policy(ctx, job);
  if (p._id !== job.policyId || (await hash(p)) !== job.policyFingerprint)
    throw new ConvexError("OWN_HISTORY_POLICY_CHANGED");
  return {
    job,
    p,
    credential: await credential(ctx, job, p),
    budgetIds: await grants(ctx, p, reserve),
  };
}
export const configure = internalMutation({
  args: historyPolicyFields,
  returns: v.id("historyPolicies"),
  handler: async (ctx, a) => {
    const old = await ctx.db
      .query("historyPolicies")
      .withIndex("by_workspaceId_and_accountId_and_version", (q) =>
        q
          .eq("workspaceId", a.workspaceId)
          .eq("accountId", a.accountId)
          .eq("version", a.version),
      )
      .unique();
    if (old) {
      if (
        Object.keys(a).some(
          (key) =>
            JSON.stringify(old[key as keyof typeof old]) !==
            JSON.stringify(a[key as keyof typeof a]),
        )
      )
        throw new ConvexError("OWN_HISTORY_POLICY_VERSION_CONFLICT");
      return old._id;
    }
    const id = await ctx.db.insert("historyPolicies", a);
    await policy(ctx, a);
    return id;
  },
});
export const start = workspaceMutation({
  args: {
    accountId: scope.accountId,
    policyId: v.optional(v.id("historyPolicies")),
    policyFingerprint: v.optional(v.string()),
    purpose: v.literal("own-history-analytics-context-v1"),
    consent: v.literal(true),
  },
  returns: v.id("historyJobs"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      p = await policy(ctx, args);
    if (a.policyId !== p._id || a.policyFingerprint !== (await hash(p)))
      throw new ConvexError("OWN_HISTORY_CONSENT_POLICY_CHANGED");
    const budgetIds = await grants(ctx, p);
    const originalCredential = await credential(ctx, args, p);
    const grantUntil = Math.min(
      ...(await Promise.all(budgetIds.map((id) => ctx.db.get(id)))).map(
        (b) => b!.expiresAt,
      ),
    );
    const old = await control(ctx, args);
    const active = await ctx.db
      .query("historyJobs")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("accountId", args.accountId),
      )
      .order("desc")
      .take(10);
    if (
      active.some(
        (j) =>
          j.generation > (old?.deletedThroughGeneration ?? 0) &&
          ["queued", "reading", "paused"].includes(j.state),
      )
    )
      throw new ConvexError("OWN_HISTORY_JOB_ACTIVE");
    const generation = (old?.generation ?? 0) + 1;
    const data = {
      ...args,
      generation,
      deletedThroughGeneration: old?.deletedThroughGeneration ?? 0,
      updatedAt: Date.now(),
    };
    if (old) await ctx.db.replace(old._id, data);
    else await ctx.db.insert("historyControls", data);
    const id = await ctx.db.insert("historyJobs", {
      ...args,
      actorId: ctx.user._id,
      generation,
      policyId: p._id,
      policyFingerprint: await hash(p),
      checkpointUntil: Math.min(
        p.expiresAt,
        grantUntil,
        originalCredential.expiresAt - 15000,
        operationalUntil(Date.now(), Date.now() + p.retentionMs),
      ),
      sourceUntil: Math.min(
        p.expiresAt,
        grantUntil,
        originalCredential.expiresAt - 15000,
        operationalUntil(Date.now(), Date.now() + p.retentionMs),
      ),
      state: "queued",
      pages: 0,
      imported: 0,
      rejected: 0,
      cursor: null,
      seenCursors: [],
      attemptId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reason: null,
    });
    const jobId = await ctx.scheduler.runAfter(
      0,
      internal.performance.backfill.read,
      { jobId: id, generation },
    );
    await ctx.db.patch(id, { jobId });
    return id;
  },
});
export const manage = workspaceMutation({
  args: {
    jobId: v.id("historyJobs"),
    operation: v.union(
      v.literal("pause"),
      v.literal("resume"),
      v.literal("cancel"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const j = (await ctx.db.get(a.jobId))!;
    requireReference(ctx.workspace._id, j);
    if (!j || !["queued", "reading", "paused"].includes(j.state))
      throw new ConvexError("OWN_HISTORY_INTENT_INACTIVE");
    const old = await control(ctx, j);
    if (!old || old.generation !== j.generation)
      throw new ConvexError("OWN_HISTORY_CONTROL_CHANGED");
    if (a.operation === "resume") {
      if (j.state !== "paused" || j.attemptId !== null)
        throw new ConvexError("OWN_HISTORY_NO_AMBIGUOUS_REPLAY");
      await admin(ctx, j.workspaceId, ctx.user._id);
      const p = await policy(ctx, j);
      await grants(ctx, p);
      await credential(ctx, j, p);
      if (
        p._id !== j.policyId ||
        (await hash(p)) !== j.policyFingerprint ||
        j.sourceUntil <= Date.now()
      )
        throw new ConvexError("OWN_HISTORY_POLICY_CHANGED");
    }
    if (j.jobId)
      try {
        await ctx.scheduler.cancel(j.jobId);
      } catch {
        /* Active action is fenced by generation. */
      }
    const generation = old.generation + 1;
    await ctx.db.patch(old._id, { generation, updatedAt: Date.now() });
    await ctx.db.patch(j._id, {
      ...(a.operation === "cancel"
        ? {
            cursor: null,
            seenCursors: [],
            checkpointUntil: Number.MAX_SAFE_INTEGER,
          }
        : {}),
      generation,
      state:
        a.operation === "resume"
          ? "queued"
          : a.operation === "pause"
            ? "paused"
            : "cancelled",
      jobId: undefined,
      updatedAt: Date.now(),
      reason:
        a.operation === "resume"
          ? null
          : `OWN_HISTORY_${a.operation.toUpperCase()}`,
    });
    if (a.operation === "resume") {
      const jobId = await ctx.scheduler.runAfter(
        0,
        internal.performance.backfill.read,
        { jobId: j._id, generation },
      );
      await ctx.db.patch(j._id, { jobId });
    }
    return null;
  },
});
export const remove = workspaceMutation({
  args: { accountId: scope.accountId },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    const old = await control(ctx, args),
      generation = (old?.generation ?? 0) + 1;
    const data = {
      ...args,
      generation,
      deletedThroughGeneration: generation,
      updatedAt: Date.now(),
    };
    if (old) await ctx.db.replace(old._id, data);
    else await ctx.db.insert("historyControls", data);
    await ctx.scheduler.runAfter(0, internal.performance.history.clear, {
      ...args,
      generation,
      cursor: null,
      jobs: true,
    });
    return null;
  },
});
export const credentialSource = internalQuery({
  args: { jobId: v.id("historyJobs"), generation: v.number() },
  returns: credentialDoc,
  handler: async (ctx, a) => (await source(ctx, a)).credential,
});
export const begin = internalMutation({
  args: {
    jobId: v.id("historyJobs"),
    generation: v.number(),
    credentialGeneration: v.number(),
  },
  returns: v.union(
    v.object({
      attemptId: v.id("aiAttempts"),
      providerIdentity: v.string(),
      dialect,
      maxResults: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    let x;
    try {
      x = await source(ctx, a);
    } catch (e) {
      await blockJob(
        ctx,
        a,
        e instanceof ConvexError ? String(e.data) : "OWN_HISTORY_UNAVAILABLE",
      );
      return null;
    }
    if (x.job.state !== "queued" || x.job.attemptId !== null) return null;
    if (x.credential.generation !== a.credentialGeneration) {
      await blockJob(ctx, a, "OWN_HISTORY_CREDENTIAL_CHANGED");
      return null;
    }
    const reservedMicros = x.p.maxResults * x.p.unitMicros;
    await changeLiability(ctx, x.budgetIds, reservedMicros, 0, true);
    const attemptId = await ctx.db.insert("aiAttempts", {
      owner: "own-history",
      provider: "x",
      purpose: "own-history-analytics-context-v1",
      workspaceId: x.job.workspaceId,
      accountId: x.job.accountId,
      historyJobId: x.job._id,
      page: x.job.pages,
      maxResults: x.p.maxResults,
      resourceCount: null,
      policyId: x.p._id,
      policyFingerprint: x.job.policyFingerprint,
      policyVersion: x.p.version,
      generation: a.generation,
      credentialGeneration: a.credentialGeneration,
      budgetIds: x.budgetIds,
      currency: x.p.currency,
      unit: "returned-post-resource",
      unitMicros: x.p.unitMicros,
      reservedMicros,
      heldMicros: reservedMicros,
      estimatedMicros: null,
      billedMicros: null,
      state: "sent",
      sentAt: Date.now(),
      settledAt: null,
      receiptFingerprint: null,
      errorCode: null,
    });
    await ctx.db.patch(x.job._id, {
      state: "reading",
      attemptId,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(20000, internal.performance.history.timeout, {
      attemptId,
    });
    return {
      attemptId,
      providerIdentity: x.p.providerIdentity,
      dialect: x.p.dialect,
      maxResults: x.p.maxResults,
      cursor: x.job.cursor,
    };
  },
});
async function blockJob(
  ctx: MutationCtx,
  a: { jobId: Id<"historyJobs">; generation: number },
  reason: string,
) {
  const j = await ctx.db.get(a.jobId);
  if (j?.generation === a.generation && j.state === "queued")
    await ctx.db.patch(j._id, {
      state: "blocked",
      cursor: null,
      seenCursors: [],
      checkpointUntil: Number.MAX_SAFE_INTEGER,
      reason: reason.slice(0, 200),
      updatedAt: Date.now(),
    });
}
export const block = internalMutation({
  args: {
    jobId: v.id("historyJobs"),
    generation: v.number(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await blockJob(ctx, a, a.reason);
    return null;
  },
});
export async function historyAttempt(
  ctx: QueryCtx | MutationCtx,
  attemptId: Id<"aiAttempts">,
) {
  const t = await ctx.db.get(attemptId);
  if (
    !t ||
    t.owner !== "own-history" ||
    t.runId !== undefined ||
    t.researchOrderId !== undefined ||
    t.logicalIntent !== undefined
  )
    throw new ConvexError("OWN_HISTORY_RECEIPT_OWNER_INVALID");
  const j = await ctx.db.get(t.historyJobId),
    p = await ctx.db.get(t.policyId);
  if (
    !j ||
    (t.state !== "settled" && j.attemptId !== t._id) ||
    j.workspaceId !== t.workspaceId ||
    j.accountId !== t.accountId ||
    j.policyId !== t.policyId ||
    j.policyFingerprint !== t.policyFingerprint ||
    !Number.isSafeInteger(t.page) ||
    t.page < 0 ||
    t.page >= 3 ||
    (t.state !== "settled" && j.pages !== t.page) ||
    !p ||
    p.workspaceId !== t.workspaceId ||
    p.accountId !== t.accountId ||
    p.version !== t.policyVersion ||
    p.currency !== t.currency ||
    p.unitMicros !== t.unitMicros ||
    p.maxResults !== t.maxResults ||
    t.reservedMicros !== t.maxResults * t.unitMicros ||
    (await hash(p)) !== t.policyFingerprint ||
    t.budgetIds.length !== 3 ||
    new Set(t.budgetIds).size !== 3
  )
    throw new ConvexError("OWN_HISTORY_RECEIPT_OWNER_INVALID");
  for (const [i, id] of t.budgetIds.entries()) {
    const b = await ctx.db.get(id);
    if (
      !b ||
      b.key !== keys(t)[i] ||
      b.scope !== (["provider", "workspace", "account"] as const)[i] ||
      b.currency !== t.currency ||
      (i === 0 && (b.workspaceId !== undefined || b.accountId !== undefined)) ||
      (i === 1 &&
        (b.workspaceId !== t.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== t.workspaceId || b.accountId !== t.accountId))
    )
      throw new ConvexError("OWN_HISTORY_RECEIPT_OWNER_INVALID");
  }
  return { t, j, p };
}
export const finish = internalMutation({
  args: {
    attemptId: v.id("aiAttempts"),
    resourceCount: v.union(v.number(), v.null()),
    posts: v.array(importedPost),
    rejected: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { t, j, p } = await historyAttempt(ctx, a.attemptId);
    if (
      a.resourceCount !== null &&
      (!Number.isSafeInteger(a.resourceCount) ||
        a.resourceCount < 0 ||
        a.resourceCount > t.maxResults ||
        a.posts.length + a.rejected !== a.resourceCount)
    )
      throw new ConvexError("OWN_HISTORY_RECEIPT_INVALID");
    if (
      a.posts.length > t.maxResults ||
      !Number.isSafeInteger(a.rejected) ||
      a.rejected < 0 ||
      (a.nextCursor !== null && !/^[A-Za-z0-9_-]{1,1024}$/.test(a.nextCursor))
    )
      throw new ConvexError("OWN_HISTORY_RECEIPT_INVALID");
    if (
      new TextEncoder().encode(JSON.stringify(a.posts)).byteLength >
      6 * 1024 * 1024
    )
      throw new ConvexError("OWN_HISTORY_PAYLOAD_LIMIT");
    if (a.reason !== null && a.reason.length > 200)
      throw new ConvexError("OWN_HISTORY_RECEIPT_INVALID");
    const receipt = await sha256(JSON.stringify(a));
    if (t.state === "settled") {
      if (t.receiptFingerprint !== receipt)
        throw new ConvexError("OWN_HISTORY_RECEIPT_CONFLICT");
      return null;
    }
    const known = a.resourceCount !== null,
      cost = known ? a.resourceCount! * t.unitMicros : null;
    if (known) await changeLiability(ctx, t.budgetIds, -t.heldMicros, cost!);
    await ctx.db.patch(t._id, {
      state: known ? "settled" : "unknown",
      resourceCount: a.resourceCount,
      heldMicros: known ? 0 : t.heldMicros,
      estimatedMicros: cost,
      settledAt: known ? Date.now() : null,
      receiptFingerprint: receipt,
      errorCode: a.reason,
    });
    let allowed = false;
    try {
      const x = await source(
        ctx,
        { jobId: j._id, generation: t.generation },
        false,
      );
      allowed =
        x.credential.generation === t.credentialGeneration &&
        (await hash(x.p)) === t.policyFingerprint;
    } catch {
      /* Original finance settles even when payload rights are gone. */
    }
    if (!allowed) {
      if (["reading", "paused"].includes(j.state) && j.attemptId === t._id)
        await ctx.db.patch(j._id, {
          state: known ? "blocked" : "unknown",
          cursor: null,
          seenCursors: [],
          checkpointUntil: Number.MAX_SAFE_INTEGER,
          reason:
            j.state === "paused" && known
              ? "OWN_HISTORY_PAUSED_PAGE_DISCARDED"
              : known
                ? "OWN_HISTORY_AUTHORITY_UNAVAILABLE"
                : "OWN_HISTORY_READ_OUTCOME_UNKNOWN",
          updatedAt: Date.now(),
        });
      return null;
    }
    if (!known) {
      await ctx.db.patch(j._id, {
        state: "unknown",
        cursor: null,
        seenCursors: [],
        checkpointUntil: Number.MAX_SAFE_INTEGER,
        reason: a.reason ?? "OWN_HISTORY_READ_OUTCOME_UNKNOWN",
        updatedAt: Date.now(),
      });
      return null;
    }
    const currentControl = await control(ctx, j);
    let imported = 0;
    for (const post of a.posts) {
      if (
        !/^[0-9]{1,19}$/.test(post.externalId) ||
        !Number.isFinite(post.providerCreatedAt) ||
        post.providerCreatedAt > Date.now() ||
        !post.text ||
        post.text.length > 25000 ||
        (post.replyTo !== null && !/^[0-9]{1,19}$/.test(post.replyTo))
      )
        throw new ConvexError("OWN_HISTORY_POST_INVALID");
      const old = await ctx.db
        .query("historyPosts")
        .withIndex("by_workspaceId_and_accountId_and_externalId", (q) =>
          q
            .eq("workspaceId", j.workspaceId)
            .eq("accountId", j.accountId)
            .eq("externalId", post.externalId),
        )
        .unique();
      if (
        old &&
        !old.removed &&
        old.generation > (currentControl?.deletedThroughGeneration ?? 0)
      ) {
        let retainedUntil = 0;
        try {
          retainedUntil = await retainedHorizon(ctx, old);
        } catch {
          /* A new authorized intent may replace unavailable old context. */
        }
        if (retainedUntil > Date.now()) continue;
      }
      // Only a confirmed exact owner receipt can supply immutable publication knowledge.
      const match = await ctx.db
        .query("xPostAttempts")
        .withIndex("by_workspaceId_and_accountId_and_externalId", (q) =>
          q
            .eq("workspaceId", j.workspaceId)
            .eq("accountId", j.accountId)
            .eq("externalId", post.externalId),
        )
        .unique();
      const schedule = match ? await ctx.db.get(match.scheduleId) : null;
      const valid =
        match?.stage === "confirmed" &&
        match.providerIdentity === p.providerIdentity &&
        schedule?.workspaceId === j.workspaceId &&
        schedule.accountId === j.accountId &&
        schedule.versionId === match.versionId &&
        schedule.externalPosts?.some(
          (r) =>
            r.attemptId === match._id &&
            r.externalId === post.externalId &&
            r.position === match.position,
        );
      const first = valid
        ? schedule?.externalPosts?.find((r) => r.position === 0)
        : null;
      const k = first
        ? await ctx.db
            .query("publicationKnowledge")
            .withIndex("by_postAttemptId", (q) =>
              q.eq("postAttemptId", first.attemptId),
            )
            .unique()
        : null;
      const data = {
        ...post,
        workspaceId: j.workspaceId,
        accountId: j.accountId,
        jobId: j._id,
        generation: j.generation,
        network: "x" as const,
        origin: "own-history-import" as const,
        observedAt: Date.now(),
        sourceUntil: Math.min(j.sourceUntil, p.expiresAt),
        accountSize: null,
        postAttemptId: valid ? match._id : null,
        versionId: valid ? match.versionId : null,
        thenKnowledgeId:
          k && match && k.versionId === match.versionId ? k._id : null,
        historicalAnalysisId: null,
        metricsStatus: "not-observed" as const,
        removed: false,
      };
      if (old) {
        await ctx.scheduler.runAfter(0, internal.content.similarity.purge, {
          historyPostId: old._id,
        });
        await ctx.db.replace(old._id, data);
      } else await ctx.db.insert("historyPosts", data);
      imported++;
    }
    const repeated =
        a.nextCursor !== null &&
        (j.seenCursors.includes(a.nextCursor) || a.nextCursor === j.cursor),
      pages = j.pages + 1;
    const state =
      repeated || (a.nextCursor && pages >= 3) || a.rejected > 0
        ? "partial"
        : a.nextCursor
          ? "queued"
          : "completed";
    await ctx.db.patch(j._id, {
      state,
      pages,
      imported: j.imported + imported,
      rejected: j.rejected + a.rejected,
      checkpointUntil:
        state === "queued"
          ? (j.checkpointUntil ?? j.sourceUntil)
          : Number.MAX_SAFE_INTEGER,
      cursor: state === "queued" ? a.nextCursor : null,
      seenCursors:
        state === "queued" && a.nextCursor
          ? [...j.seenCursors, a.nextCursor].slice(0, 3)
          : [],
      attemptId: null,
      updatedAt: Date.now(),
      reason: repeated
        ? "OWN_HISTORY_CURSOR_REPEATED"
        : a.nextCursor && pages >= 3
          ? "OWN_HISTORY_PAGE_LIMIT"
          : a.rejected > 0
            ? "OWN_HISTORY_PARTIAL_PAGE"
            : a.reason,
    });
    if (state === "queued") {
      const jobId = await ctx.scheduler.runAfter(
        0,
        internal.performance.backfill.read,
        { jobId: j._id, generation: j.generation },
      );
      await ctx.db.patch(j._id, { jobId });
    }
    return null;
  },
});
export const timeout = internalMutation({
  args: { attemptId: v.id("aiAttempts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.attemptId);
    if (
      !t ||
      t.owner !== "own-history" ||
      t.state !== "sent" ||
      t.sentAt + 20000 > Date.now()
    )
      return null;
    await ctx.db.patch(t._id, {
      state: "unknown",
      errorCode: "OWN_HISTORY_READ_OUTCOME_UNKNOWN",
    });
    const j = await ctx.db.get(t.historyJobId);
    if (j && ["reading", "paused"].includes(j.state) && j.attemptId === t._id)
      await ctx.db.patch(j._id, {
        state: "unknown",
        cursor: null,
        seenCursors: [],
        checkpointUntil: Number.MAX_SAFE_INTEGER,
        reason: "OWN_HISTORY_READ_OUTCOME_UNKNOWN",
        updatedAt: Date.now(),
      });
    return null;
  },
});
export const clear = internalMutation({
  args: {
    ...scope,
    generation: v.number(),
    cursor: v.union(v.string(), v.null()),
    jobs: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await control(ctx, a);
    if (!c || c.deletedThroughGeneration < a.generation) return null;
    if (a.jobs) {
      const batch = await ctx.db
        .query("historyJobs")
        .withIndex("by_workspaceId_and_accountId", (q) =>
          q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
        )
        .paginate({ cursor: a.cursor, numItems: 25 });
      for (const j of batch.page) {
        if (j.generation > a.generation) continue;
        if (j.jobId)
          try {
            await ctx.scheduler.cancel(j.jobId);
          } catch {
            /* In-flight fenced. */
          }
        await ctx.db.patch(j._id, {
          state: "removed",
          cursor: null,
          seenCursors: [],
          checkpointUntil: Number.MAX_SAFE_INTEGER,
          jobId: undefined,
          reason: "OWN_HISTORY_REMOVED",
          updatedAt: Date.now(),
        });
      }
      await ctx.scheduler.runAfter(0, internal.performance.history.clear, {
        ...a,
        jobs: !batch.isDone,
        cursor: batch.isDone ? null : batch.continueCursor,
      });
    } else {
      const batch = await ctx.db
        .query("historyPosts")
        .withIndex("by_workspaceId_and_accountId", (q) =>
          q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
        )
        .paginate({ cursor: a.cursor, numItems: 25 });
      for (const p of batch.page)
        if (p.generation <= a.generation) await scrub(ctx, p);
      if (!batch.isDone)
        await ctx.scheduler.runAfter(0, internal.performance.history.clear, {
          ...a,
          cursor: batch.continueCursor,
        });
    }
    return null;
  },
});
export async function retainedHorizon(
  ctx: Ctx,
  row: Doc<"historyPosts">,
  memo?: Map<string, number>,
) {
  // Read-only transaction memo: the exact account/job/generation shares current rights, never row material or its horizon.
  if (row.removed || !row.text)
    throw new ConvexError("OWN_HISTORY_SOURCE_UNAVAILABLE");
  const key = JSON.stringify([
    row.workspaceId,
    row.accountId,
    row.jobId,
    row.generation,
  ]);
  if (operationalUntil(row.observedAt, row.sourceUntil) <= Date.now())
    throw new ConvexError("OWN_HISTORY_SOURCE_UNAVAILABLE");
  const prior = memo?.get(key);
  if (prior !== undefined) return Math.min(row.sourceUntil, prior);
  const j = await ctx.db.get(row.jobId),
    original = j ? await ctx.db.get(j.policyId) : null;
  const c = await control(ctx, row);
  if (
    row.removed ||
    !row.text ||
    !c ||
    c.deletedThroughGeneration >= row.generation ||
    !j ||
    j.workspaceId !== row.workspaceId ||
    j.accountId !== row.accountId ||
    j.generation !== row.generation ||
    !original ||
    original.workspaceId !== row.workspaceId ||
    original.accountId !== row.accountId ||
    (await hash(original)) !== j.policyFingerprint
  )
    throw new ConvexError("OWN_HISTORY_SOURCE_UNAVAILABLE");
  await admin(ctx, row.workspaceId, j.actorId);
  await admin(ctx, row.workspaceId, original.approvedBy);
  const p = await policy(ctx, row),
    ids = await grants(ctx, p, false);
  if (
    original.providerIdentity !== p.providerIdentity ||
    original.connectionSequence !== p.connectionSequence
  )
    throw new ConvexError("OWN_HISTORY_SOURCE_UNAVAILABLE");
  const currentCredential = await credential(ctx, row, p);
  const until = Math.min(
    operationalUntil(j.createdAt, j.sourceUntil),
    j.createdAt + p.retentionMs,
    original.expiresAt,
    p.expiresAt,
    currentCredential.expiresAt - 15000,
    ...(await Promise.all(ids.map((id) => ctx.db.get(id)))).map(
      (b) => b!.expiresAt,
    ),
  );
  memo?.set(key, until);
  return Math.min(row.sourceUntil, until);
}
async function scrub(ctx: MutationCtx, p: Doc<"historyPosts">) {
  await ctx.scheduler.runAfter(0, internal.content.similarity.purge, {
    historyPostId: p._id,
  });
  // The financial graph refers to the job, not the text row: no raw-text tombstone is needed.
  await ctx.db.delete(p._id);
}
export const expire = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    jobs: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.jobs) {
      const jobs = await ctx.db
        .query("historyJobs")
        .withIndex("by_creation_time")
        .paginate({ cursor: a.cursor ?? null, numItems: 25 });
      for (const j of jobs.page) {
        if (
          j.checkpointUntil === Number.MAX_SAFE_INTEGER ||
          Math.min(
            j.checkpointUntil ?? Infinity,
            operationalUntil(j.createdAt, j.sourceUntil),
          ) > Date.now()
        )
          continue;
        if (
          operationalUntil(j.createdAt, j.sourceUntil) > Date.now() &&
          ["queued", "reading", "paused"].includes(j.state)
        ) {
          await ctx.db.patch(j._id, {
            checkpointUntil: operationalUntil(j.createdAt, j.sourceUntil),
          });
          continue;
        }
        if (j.jobId)
          try {
            await ctx.scheduler.cancel(j.jobId);
          } catch {
            /* Active callback remains fenced by original expiry. */
          }
        await ctx.db.patch(j._id, {
          cursor: null,
          seenCursors: [],
          checkpointUntil: Number.MAX_SAFE_INTEGER,
          jobId: undefined,
          ...(["queued", "reading", "paused"].includes(j.state)
            ? {
                state: "blocked" as const,
                reason: "OWN_HISTORY_PERMISSION_EXPIRED",
              }
            : {}),
          updatedAt: Date.now(),
        });
      }
      if (!jobs.isDone)
        await ctx.scheduler.runAfter(0, internal.performance.history.expire, {
          jobs: true,
          cursor: jobs.continueCursor,
        });
      return null;
    }
    const batch = await ctx.db
      .query("historyPosts")
      .paginate({ cursor: a.cursor ?? null, numItems: 25 });
    for (const row of batch.page) {
      let until = 0;
      try {
        until = await retainedHorizon(ctx, row);
      } catch (error) {
        rethrowUnexpectedSourceError(error);
      }
      if (until <= Date.now()) await scrub(ctx, row);
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(0, internal.performance.history.expire, {
        cursor: batch.continueCursor,
      });
    else
      await ctx.scheduler.runAfter(0, internal.performance.history.expire, {
        jobs: true,
      });
    return null;
  },
});
export const overview = workspaceQuery({
  args: { accountId: scope.accountId },
  returns: v.object({
    reason: v.union(v.string(), v.null()),
    maxResults: v.union(v.number(), v.null()),
    policy: v.union(
      v.object({
        id: v.id("historyPolicies"),
        fingerprint: v.string(),
        unitMicros: v.number(),
        currency: v.string(),
        retentionMs: v.number(),
        expiresAt: v.number(),
      }),
      v.null(),
    ),
    jobs: v.array(
      v.object({
        id: v.id("historyJobs"),
        state: historyPolicyState(),
        pages: v.number(),
        imported: v.number(),
        rejected: v.number(),
        reason: v.union(v.string(), v.null()),
        canResume: v.boolean(),
      }),
    ),
    posts: v.array(historyPostDoc),
  }),
  handler: async (ctx, a) => {
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    let reason: string | null = null,
      p: Doc<"historyPolicies"> | null = null;
    try {
      p = await policy(ctx, args);
      await grants(ctx, p, false);
      await credential(ctx, args, p);
    } catch (e) {
      reason =
        e instanceof ConvexError ? String(e.data) : "OWN_HISTORY_UNAVAILABLE";
    }
    const c = await control(ctx, args),
      jobs = await ctx.db
        .query("historyJobs")
        .withIndex("by_workspaceId_and_accountId", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("accountId", args.accountId),
        )
        .order("desc")
        .take(10);
    const rows = await ctx.db
      .query("historyPosts")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("accountId", args.accountId),
      )
      .order("desc")
      .take(25);
    return {
      reason,
      maxResults: p?.maxResults ?? null,
      policy: p
        ? {
            id: p._id,
            fingerprint: await hash(p),
            unitMicros: p.unitMicros,
            currency: p.currency,
            retentionMs: p.retentionMs,
            expiresAt: p.expiresAt,
          }
        : null,
      jobs: jobs.map((j) => ({
        id: j._id,
        state:
          j.generation <= (c?.deletedThroughGeneration ?? 0)
            ? ("removed" as const)
            : j.state,
        pages: j.pages,
        imported: j.imported,
        rejected: j.rejected,
        reason: j.reason,
        canResume:
          j.state === "paused" &&
          j.attemptId === null &&
          j.sourceUntil > Date.now(),
      })),
      posts: await Promise.all(
        rows
          .filter(
            (r) =>
              !r.removed && r.generation > (c?.deletedThroughGeneration ?? 0),
          )
          .map(async (r) => {
            let until = 0;
            try {
              until = await retainedHorizon(ctx, r);
            } catch {
              /* Source authority missing. */
            }
            return {
              ...r,
              sourceUntil: until,
              text: until > Date.now() ? r.text : null,
              replyTo: until > Date.now() ? r.replyTo : null,
            };
          }),
      ),
    };
  },
});
function historyPolicyState() {
  return v.union(
    ...(
      [
        "queued",
        "reading",
        "paused",
        "completed",
        "partial",
        "blocked",
        "unknown",
        "cancelled",
        "removed",
      ] as const
    ).map(v.literal),
  );
}
