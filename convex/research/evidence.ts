import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import {
  currentMaterials,
  currentMaterialProof,
  type MaterialWalk,
} from "./pipelineAccess";
import { automaticHandoff } from "./pipelineFields";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
  requireWorkspace,
} from "../lib/authorization";
import { sha256 } from "../lib/crypto";
import { operationKey } from "./access";
import { sourceAuthority, nativeAttempt } from "./providerAccess";
import { annotation, evidenceFields, assessment } from "./evidenceFields";
import { publicSource } from "./providerFields";

type Ctx = QueryCtx | MutationCtx;
export const materialHash = (s: Doc<"researchSources">) =>
  sha256(
    JSON.stringify([
      s.operation,
      s.providerIdentity,
      s.generation,
      s.policyId,
      s.policyFingerprint,
      s.observedAt,
      s.usableUntil,
      s.url,
      s.title,
      s.text,
      s.publishedAt,
      s.count,
    ]),
  );

// This validates actual delivery, including a cache filled by an earlier order.
export async function deliveredSource(
  ctx: Ctx,
  orderId: Id<"researchOrders">,
  sourceId: Id<"researchSources">,
) {
  const o = await ctx.db.get(orderId),
    s = await ctx.db.get(sourceId);
  if (
    !o?.native ||
    !s ||
    o.workspaceId !== s.workspaceId ||
    o.accountId !== s.accountId
  )
    throw new ConvexError("RESEARCH_EVIDENCE_SOURCE_INVALID");
  const profile = await ctx.db.get(o.profileId),
    version = await ctx.db.get(o.profileVersionId);
  requireReference(o.workspaceId, profile);
  requireReference(o.workspaceId, version);
  if (
    profile!.paused ||
    profile!.deleted ||
    profile!.accountId !== o.accountId ||
    version!.profileId !== o.profileId
  )
    throw new ConvexError("RESEARCH_PROFILE_INACTIVE");
  const i = o.native.operations.indexOf(s.operation),
    cacheId = o.native.cacheIds[i];
  const c = cacheId ? await ctx.db.get(cacheId) : null;
  if (
    !c?.attemptId ||
    c.workspaceId !== o.workspaceId ||
    c.accountId !== o.accountId ||
    c.operation !== s.operation ||
    !c.sourceIds.includes(sourceId) ||
    (c.state !== "completed" && c.state !== "partial") ||
    c.policyId !== s.policyId ||
    c.policyFingerprint !== s.policyFingerprint
  )
    throw new ConvexError("RESEARCH_EVIDENCE_NOT_DELIVERED");
  const owned = await nativeAttempt(ctx, c.attemptId);
  if (
    owned.c._id !== c._id ||
    (!o.native.outcomes[i].cacheHit && owned.o._id !== o._id)
  )
    throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
  const { p, captured } = await sourceAuthority(ctx, o, s.operation);
  let until = Math.min(
    c.expiresAt,
    s.usableUntil,
    p.expiresAt,
    p.lifecycleValidUntil,
  );
  for (const id of captured.budgetIds)
    until = Math.min(until, (await ctx.db.get(id))!.expiresAt);
  if (
    s.status !== "usable" ||
    s.title === null ||
    until <= Date.now() ||
    s.generation !== p.generation ||
    c.policyFingerprint !== captured.fingerprint
  )
    throw new ConvexError("RESEARCH_EVIDENCE_SOURCE_UNUSABLE");
  return { o, s, until };
}

function bounded(a: typeof annotation.type) {
  for (const value of [
    a.claim,
    a.interpretation,
    a.relevance,
    a.novelty,
    a.uncertainty,
    a.validityReason,
  ])
    if (
      !value.trim() ||
      value.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    )
      throw new ConvexError("RESEARCH_EVIDENCE_INPUT_INVALID");
  if (
    (a.quote !== null &&
      (!a.quote.trim() ||
        a.quote.length > 2000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(a.quote))) ||
    a.gaps.length > 10 ||
    a.gaps.some(
      (g) => !g.trim() || g.length > 1000 || /[\u0000-\u001f]/.test(g),
    )
  )
    throw new ConvexError("RESEARCH_EVIDENCE_INPUT_INVALID");
}
export const create = workspaceMutation({
  args: {
    orderId: v.id("researchOrders"),
    sourceId: v.id("researchSources"),
    commandKey: v.string(),
    expectedMaterialHash: v.string(),
    annotation,
  },
  returns: v.id("researchEvidence"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    operationKey(a.commandKey);
    bounded(a.annotation);
    requireReference(ctx.workspace._id, await ctx.db.get(a.orderId));
    const fingerprint = await sha256(JSON.stringify(a));
    const prior = await ctx.db
      .query("researchEvidence")
      .withIndex("by_orderId_and_actorId_and_commandKey", (q) =>
        q
          .eq("orderId", a.orderId)
          .eq("actorId", ctx.user._id)
          .eq("commandKey", a.commandKey),
      )
      .unique();
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ConvexError("RESEARCH_OPERATION_CONFLICT");
      // A receipt is historical: returning it never rewrites or renews removed material.
      return prior._id;
    }
    const {
      o,
      s,
      until: deliveredUntil,
    } = await deliveredSource(ctx, a.orderId, a.sourceId);
    const until = o.reResearch
      ? Math.min(
          deliveredUntil,
          (await currentMaterialProof(ctx, o)).proofUntil,
        )
      : deliveredUntil;
    if ((await materialHash(s)) !== a.expectedMaterialHash)
      throw new ConvexError("RESEARCH_EVIDENCE_MATERIAL_CHANGED");
    if (
      a.annotation.quote !== null &&
      (s.text === null || !s.text.includes(a.annotation.quote))
    )
      throw new ConvexError("RESEARCH_EVIDENCE_QUOTE_NOT_DELIVERED");
    const count = await ctx.db
      .query("researchEvidence")
      .withIndex("by_orderId_and_createdAt", (q) => q.eq("orderId", o._id))
      .take(101);
    // ponytail: 100 immutable manual records per order; paginate before increasing this ceiling.
    if (count.length >= 100) throw new ConvexError("RESEARCH_EVIDENCE_LIMIT");
    const id = await ctx.db.insert("researchEvidence", {
      workspaceId: o.workspaceId,
      accountId: o.accountId,
      orderId: o._id,
      sourceId: s._id,
      actorId: ctx.user._id,
      annotationActorId: ctx.user._id,
      commandKey: a.commandKey,
      fingerprint,
      materialHash: await materialHash(s),
      observedAt: s.observedAt,
      sourceGeneration: s.generation,
      retentionUntil: until,
      createdAt: Date.now(),
      state: "review",
      reason: null,
      payload: {
        annotation: a.annotation,
        perspective: {
          profileVersionId: o.profileVersionId,
          audience: o.config.audience,
          topics: o.config.topics,
          project: o.config.project,
        },
      },
    });
    await ctx.scheduler.runAt(until, internal.research.evidence.expire, {
      evidenceId: id,
    });
    return id;
  },
});
// Displayable Review is separate from freshness/support eligibility and publishing approval.
export async function currentEvidence(
  ctx: Ctx,
  ws: Id<"workspaces">,
  id: Id<"researchEvidence">,
  accountId?: Id<"socialAccounts">,
  walk?: MaterialWalk,
) {
  const e = await ctx.db.get(id);
  requireReference(ws, e);
  if (
    !e ||
    (accountId && e.accountId !== accountId) ||
    e.state !== "review" ||
    !e.payload ||
    e.retentionUntil <= Date.now()
  )
    throw new ConvexError("RESEARCH_EVIDENCE_SOURCE_UNUSABLE");
  const author = await ctx.db.get(e.annotationActorId);
  if (!author) throw new ConvexError("RESEARCH_ACTOR_UNAVAILABLE");
  requireRole((await requireWorkspace(ctx, ws, author)).membership, [
    "Owner",
    "Admin",
    "Editor",
  ]);
  if (e.assessment) {
    try {
      const reviewer = await ctx.db.get(e.assessment.reviewerId);
      if (!reviewer)
        throw new ConvexError("RESEARCH_EVIDENCE_REVIEWER_UNAVAILABLE");
      requireRole((await requireWorkspace(ctx, ws, reviewer)).membership, [
        "Owner",
        "Admin",
      ]);
    } catch (error) {
      rethrowUnexpectedSourceError(error);
      throw new ConvexError("RESEARCH_EVIDENCE_REVIEWER_UNAVAILABLE");
    }
  }
  const { o, s, until } = await deliveredSource(ctx, e.orderId, e.sourceId);
  if (
    o.accountId !== e.accountId ||
    s.generation !== e.sourceGeneration ||
    (await materialHash(s)) !== e.materialHash ||
    e.payload.perspective.profileVersionId !== o.profileVersionId
  )
    throw new ConvexError("RESEARCH_EVIDENCE_MATERIAL_CHANGED");
  let proofUntil = Math.min(until, e.retentionUntil);
  if (e.modelOrigin) {
    const run = await ctx.db.get(e.modelOrigin.runId);
    if (
      !o.pipeline ||
      o.pipeline.runId !== e.modelOrigin.runId ||
      o.pipeline.proposalHash !== e.modelOrigin.outputHash ||
      !run ||
      run.promptMessageId !== e.modelOrigin.promptMessageId ||
      run.promptVersion !== e.modelOrigin.promptVersion ||
      run.policyVersion !== e.modelOrigin.policyVersion
    )
      throw new ConvexError("RESEARCH_EVIDENCE_MODEL_CHANGED");
    const proof = await currentMaterialProof(ctx, o, walk);
    proofUntil = Math.min(proofUntil, proof.proofUntil);
    for (const id of e.payload.model?.copySourceIds ?? [])
      if (!proof.materials.some((d) => d.s._id === id))
        throw new ConvexError("RESEARCH_EVIDENCE_MATERIAL_CHANGED");
  }
  if (o.reResearch && !e.modelOrigin)
    proofUntil = Math.min(
      proofUntil,
      (await currentMaterialProof(ctx, o, walk)).proofUntil,
    );
  if (proofUntil <= Date.now())
    throw new ConvexError("RESEARCH_EVIDENCE_SOURCE_UNUSABLE");
  return { e, o, s, proofUntil };
}

export const inboxItem = v.object({
  evidenceId: v.id("researchEvidence"),
  orderId: v.id("researchOrders"),
  runOutcome: v.union(v.string(), v.null()),
  automaticHandoff: v.union(automaticHandoff, v.null()),
  runState: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("blocked"),
    v.literal("cancelled"),
    v.literal("completed"),
  ),
  inboxRevision: v.number(),
  inboxDisposition: v.union(
    v.literal("active"),
    v.literal("ignored"),
    v.literal("archived"),
  ),
  createdAt: v.number(),
  state: v.union(v.literal("review"), v.literal("removed")),
  reason: v.union(v.string(), v.null()),
  payload: evidenceFields.payload,
  source: v.union(publicSource, v.null()),
  proofUntil: v.number(),
  automaticEligible: v.boolean(),
  validityUntil: v.union(v.number(), v.null()),
  assessment: v.union(assessment, v.null()),
});

export async function projectEvidence(
  ctx: Ctx,
  ws: Id<"workspaces">,
  e: Doc<"researchEvidence">,
) {
  let source = null,
    payload = null,
    proofUntil = 0,
    reason = e.reason;
  try {
    const proof = await currentEvidence(ctx, ws, e._id);
    const s = proof.s;
    proofUntil = proof.proofUntil;
    payload = e.payload;
    source = {
      materialHash: e.materialHash,
      sourceId: s._id,
      operation: s.operation,
      url: s.url,
      title: s.title!,
      text: s.text,
      publishedAt: s.publishedAt,
      count: s.count,
      observedAt: s.observedAt,
      usableUntil: proofUntil,
    };
  } catch (error) {
    rethrowUnexpectedSourceError(error);
    reason =
      error instanceof ConvexError &&
      error.data === "RESEARCH_EVIDENCE_REVIEWER_UNAVAILABLE"
        ? String(error.data)
        : (reason ?? "RESEARCH_EVIDENCE_NO_CURRENT_PROOF");
  }
  let validityUntil: number | null = null;
  if (
    payload &&
    e.assessment?.validUntil &&
    e.assessment.validUntil > Date.now()
  ) {
    validityUntil = Math.min(e.assessment.validUntil, proofUntil);
  }
  const order = await ctx.db.get(e.orderId);
  return {
    evidenceId: e._id,
    orderId: e.orderId,
    runOutcome: order?.pipeline?.outcome ?? null,
    automaticHandoff: payload ? (order?.automaticHandoff ?? null) : null,
    runState: order?.state ?? "blocked",
    inboxRevision: e.inboxRevision ?? 0,
    inboxDisposition: e.inboxDisposition ?? "active",
    createdAt: e.createdAt,
    state: payload ? ("review" as const) : ("removed" as const),
    reason,
    payload,
    source,
    proofUntil,
    automaticEligible: validityUntil !== null,
    validityUntil,
    assessment: payload ? (e.assessment ?? null) : null,
  };
}

export const inbox = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(inboxItem),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const rows = await ctx.db
      .query("researchEvidence")
      .withIndex("by_workspaceId_and_accountId_and_createdAt", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .order("desc")
      .paginate({
        ...a.paginationOpts,
        numItems: Math.min(20, Math.max(1, a.paginationOpts.numItems)),
      });
    const page = [];
    for (const e of rows.page)
      page.push(await projectEvidence(ctx, ctx.workspace._id, e));
    return { page, isDone: rows.isDone, continueCursor: rows.continueCursor };
  },
});
export const list = workspaceQuery({
  args: { orderId: v.id("researchOrders") },
  returns: v.array(inboxItem),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.orderId));
    const rows = await ctx.db
      .query("researchEvidence")
      .withIndex("by_orderId_and_createdAt", (q) => q.eq("orderId", a.orderId))
      .order("desc")
      .take(100);
    return Promise.all(
      rows.map((e) => projectEvidence(ctx, ctx.workspace._id, e)),
    );
  },
});
export const review = workspaceMutation({
  args: {
    evidenceId: v.id("researchEvidence"),
    commandKey: v.string(),
    maxAgeMs: v.number(),
    validUntil: v.number(),
    reason: v.string(),
    substantiveSupportAttested: v.boolean(),
    eventAt: v.union(v.number(), v.null()),
    eventQuote: v.union(v.string(), v.null()),
  },
  returns: v.id("researchEvidence"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    operationKey(a.commandKey);
    if (
      !a.reason.trim() ||
      a.reason.length > 2000 ||
      /[\u0000-\u001f]/.test(a.reason) ||
      !Number.isSafeInteger(a.maxAgeMs) ||
      a.maxAgeMs < 1 ||
      a.maxAgeMs > 90 * 86400000 ||
      !Number.isSafeInteger(a.validUntil) ||
      a.validUntil <= 0
    )
      throw new ConvexError("RESEARCH_EVIDENCE_VALIDITY_INVALID");
    const e = await ctx.db.get(a.evidenceId);
    requireReference(ctx.workspace._id, e);
    const fingerprint = await sha256(JSON.stringify(a));
    const prior = await ctx.db
      .query("researchEvidence")
      .withIndex("by_orderId_and_actorId_and_commandKey", (q) =>
        q
          .eq("orderId", e!.orderId)
          .eq("actorId", ctx.user._id)
          .eq("commandKey", a.commandKey),
      )
      .unique();
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ConvexError("RESEARCH_OPERATION_CONFLICT");
      return prior._id;
    }
    if (a.validUntil <= Date.now())
      throw new ConvexError("RESEARCH_EVIDENCE_VALIDITY_INVALID");
    if (!e!.payload || e!.state !== "review" || e!.retentionUntil <= Date.now())
      throw new ConvexError("RESEARCH_EVIDENCE_SOURCE_UNUSABLE");
    const { s, proofUntil: until } = await currentEvidence(
      ctx,
      ctx.workspace._id,
      e!._id,
    );
    const note = e!.payload.annotation;
    if (
      a.eventAt !== null &&
      (!Number.isSafeInteger(a.eventAt) ||
        a.eventAt < 0 ||
        a.eventAt > Date.now())
    )
      throw new ConvexError("RESEARCH_EVIDENCE_VALIDITY_INVALID");
    if (
      a.eventQuote !== null &&
      (!a.eventQuote.trim() || a.eventQuote.length > 2000)
    )
      throw new ConvexError("RESEARCH_EVIDENCE_VALIDITY_INVALID");
    // ponytail: event attribution accepts an explicit delivered ISO date only; other date formats remain Review.
    const eventSupported =
      a.eventAt !== null &&
      a.eventQuote !== null &&
      s.text !== null &&
      s.text.includes(a.eventQuote) &&
      a.eventQuote.includes(new Date(a.eventAt).toISOString().slice(0, 10));
    const attributedEventAt = eventSupported
      ? Date.parse(new Date(a.eventAt!).toISOString().slice(0, 10))
      : null;
    const basis = note.eventBased
      ? Math.min(s.publishedAt ?? 0, attributedEventAt ?? 0)
      : (s.publishedAt ?? 0);
    const candidate = Math.min(
      a.validUntil,
      e!.retentionUntil,
      until,
      basis + a.maxAgeMs,
    );
    const validUntil =
      a.substantiveSupportAttested &&
      s.text !== null &&
      s.publishedAt !== null &&
      note.quote !== null &&
      s.text.includes(note.quote) &&
      note.freshness !== "unknown" &&
      !note.consequentialOrContested &&
      (!note.eventBased || eventSupported) &&
      candidate > Date.now()
        ? candidate
        : null;
    const count = await ctx.db
      .query("researchEvidence")
      .withIndex("by_orderId_and_createdAt", (q) => q.eq("orderId", e!.orderId))
      .take(101);
    if (count.length >= 100) throw new ConvexError("RESEARCH_EVIDENCE_LIMIT");
    const {
      _id: _id,
      _creationTime: _time,
      assessment: _assessment,
      inboxRevision: _inboxRevision,
      inboxDisposition: _inboxDisposition,
      inboxActorId: _inboxActor,
      inboxCommands: _inboxCommands,
      parentEvidenceId: _parent,
      commandKey: _key,
      fingerprint: _hash,
      ...copy
    } = e!;
    const id = await ctx.db.insert("researchEvidence", {
      ...copy,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      fingerprint,
      parentEvidenceId: e!._id,
      createdAt: Date.now(),
      reason:
        validUntil === null
          ? "RESEARCH_EVIDENCE_NEEDS_SUPPORT_OR_FRESHNESS"
          : null,
      assessment: {
        reviewerId: ctx.user._id,
        assessedAt: Date.now(),
        purpose: "research-context",
        ruleVersion: "human-publication-age-v1",
        basis: note.eventBased ? "earliest-publication-event" : "publication",
        maxAgeMs: a.maxAgeMs,
        requestedUntil: a.validUntil,
        validUntil,
        reason: a.reason,
        substantiveSupportAttested: a.substantiveSupportAttested,
        eventAt: attributedEventAt,
        eventQuote: eventSupported ? a.eventQuote : null,
      },
    });
    if (validUntil !== null)
      await ctx.scheduler.runAfter(0, internal.research.handoff.automatic, {
        orderId: e!.orderId,
      });
    await ctx.scheduler.runAt(
      copy.retentionUntil,
      internal.research.evidence.expire,
      { evidenceId: id },
    );
    return id;
  },
});
export const expire = internalMutation({
  args: { evidenceId: v.id("researchEvidence") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const e = await ctx.db.get(a.evidenceId);
    if (e?.state === "review" && e.retentionUntil <= Date.now()) {
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.evidence,
        { evidenceId: e._id },
      );
      await ctx.db.patch(e._id, {
        payload: null,
        state: "removed",
        reason: "retention_expired",
        ...(e.assessment
          ? {
              assessment: {
                ...e.assessment,
                reason: "",
                eventQuote: null,
                eventAt: null,
              },
            }
          : {}),
      });
    }
    return null;
  },
});
export async function clearSourceCopies(
  ctx: MutationCtx,
  sourceId: Id<"researchSources">,
  oldMaterialHash?: string,
  batchSize = 100,
) {
  await ctx.scheduler.runAfter(0, internal.research.pipeline.clearSource, {
    sourceId,
    ...(oldMaterialHash ? { oldMaterialHash } : {}),
  });
  const rows = await ctx.db
    .query("researchEvidence")
    .withIndex("by_sourceId_and_state_and_materialHash", (q) => {
      const indexed = q.eq("sourceId", sourceId).eq("state", "review");
      return oldMaterialHash
        ? indexed.eq("materialHash", oldMaterialHash)
        : indexed;
    })
    .take(batchSize);
  for (const e of rows) {
    await ctx.scheduler.runAfter(0, internal.research.contentCleanup.evidence, {
      evidenceId: e._id,
    });
    await ctx.db.patch(e._id, {
      payload: null,
      state: "removed",
      reason: "source_material_changed_or_removed",
      ...(e.assessment
        ? {
            assessment: {
              ...e.assessment,
              reason: "",
              eventQuote: null,
              eventAt: null,
            },
          }
        : {}),
    });
  }
  if (rows.length === batchSize)
    await ctx.scheduler.runAfter(0, internal.research.evidence.clearSource, {
      sourceId,
      ...(oldMaterialHash ? { oldMaterialHash } : {}),
    });
}
export const clearSource = internalMutation({
  args: {
    sourceId: v.id("researchSources"),
    oldMaterialHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await clearSourceCopies(ctx, a.sourceId, a.oldMaterialHash);
    return null;
  },
});

export const disposition = workspaceMutation({
  args: {
    evidenceId: v.id("researchEvidence"),
    expectedRevision: v.number(),
    commandKey: v.optional(v.string()),
    disposition: v.union(
      v.literal("active"),
      v.literal("ignored"),
      v.literal("archived"),
    ),
  },
  returns: v.number(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const e = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.evidenceId),
    ) as Doc<"researchEvidence">;
    await currentEvidence(ctx, ctx.workspace._id, e._id);
    if (a.commandKey) operationKey(a.commandKey);
    const hash = await sha256(
      JSON.stringify([a.expectedRevision, a.disposition]),
    );
    const prior = e.inboxCommands?.find(
      (c) => c.actorId === ctx.user._id && c.commandKey === a.commandKey,
    );
    if (prior) {
      if (prior.fingerprint !== hash)
        throw new ConvexError("RESEARCH_OPERATION_CONFLICT");
      return prior.revision;
    }
    const revision = e.inboxRevision ?? 0;
    if (revision !== a.expectedRevision)
      throw new ConvexError("RESEARCH_INBOX_REVISION_CONFLICT");
    // ponytail: 100 exact disposition receipts per immutable evidence; new review IDs provide a fresh bounded command history.
    if ((e.inboxCommands?.length ?? 0) >= 100)
      throw new ConvexError("RESEARCH_INBOX_COMMAND_LIMIT");
    await ctx.db.patch(e._id, {
      inboxRevision: revision + 1,
      inboxDisposition: a.disposition,
      inboxActorId: ctx.user._id,
      ...(a.commandKey
        ? {
            inboxCommands: [
              ...(e.inboxCommands ?? []),
              {
                actorId: ctx.user._id,
                commandKey: a.commandKey,
                fingerprint: hash,
                revision: revision + 1,
              },
            ],
          }
        : {}),
    });
    return revision + 1;
  },
});
