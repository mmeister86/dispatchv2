import { ConvexError, v, type Infer } from "convex/values";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
} from "../lib/authorization";
import {
  admin,
  policy as currentMetricPolicy,
  fingerprint as metricFingerprint,
} from "./capabilities";
import { retainedSnapshotHorizon } from "./snapshots";
import { source as assessmentSource } from "../intelligence/assessments";
import { sha256 } from "../lib/crypto";
import { POST_ANALYSIS } from "../ai/jev/questions/postAnalysis";
import { definitions } from "./normalize";
import { WEIGHTS } from "../ai/scoring/dispatchScore";
import {
  TARGET,
  TRANSFERS,
  purposeConfig,
  bounds,
  compatibility,
  ref,
  specDoc,
  snapshotDoc,
} from "./calibrationFields";
import type { Doc, Id } from "../_generated/dataModel";
type Ctx = QueryCtx | MutationCtx;
type Spec = Extract<Doc<"calibrationReferences">, { kind: "spec" }>;
type Snapshot = Extract<Doc<"calibrationReferences">, { kind: "snapshot" }>;
type Scope = { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> };
function fail(code: string): never {
  throw new ConvexError(code);
}
const hash = (value: unknown) => sha256(JSON.stringify(value));
const keyValid = (key: string) => /^[A-Za-z0-9_-]{1,100}$/.test(key);
const dateValid = (n: number) => Number.isSafeInteger(n) && n >= 0;
const scoped = { accountId: v.id("socialAccounts") };
async function latestPurpose(ctx: Ctx, s: Scope) {
  requireReference(s.workspaceId, await ctx.db.get(s.accountId));
  return ctx.db
    .query("calibrationPurposes")
    .withIndex("by_workspaceId_and_accountId_and_createdAt", (q) =>
      q.eq("workspaceId", s.workspaceId).eq("accountId", s.accountId),
    )
    .order("desc")
    .first();
}
async function configured(ctx: Ctx, p: Doc<"calibrationPurposes">) {
  const account = await ctx.db.get(p.accountId);
  requireReference(p.workspaceId, account);
  if (
    account!.provider !== "X" ||
    account!.providerIdentity !== p.providerIdentity ||
    p.expiresAt <= Date.now()
  )
    fail("CALIBRATION_CONFIGURATION_REQUIRED");
  await admin(ctx, p.workspaceId, p.approvedBy);
  if ((await latestPurpose(ctx, p))?._id !== p._id)
    fail("CALIBRATION_PURPOSE_CHANGED");
  return p;
}
async function allowed(
  ctx: Ctx,
  id: Id<"calibrationPurposes">,
  s: Scope,
  generation?: number,
) {
  const p = await ctx.db.get(id);
  if (!p || p.workspaceId !== s.workspaceId || p.accountId !== s.accountId)
    fail("CALIBRATION_PURPOSE_CHANGED");
  if (p.withdrawal) fail("CALIBRATION_PURPOSE_REVOKED");
  await configured(ctx, p);
  if (p.withdrawal) fail("CALIBRATION_PURPOSE_REVOKED");
  if (!p.consent || (generation !== undefined && generation !== p.generation))
    fail("CALIBRATION_CONSENT_REQUIRED");
  await admin(ctx, p.workspaceId, p.consent.actorId);
  return p;
}
export const configurePurpose = internalMutation({
  args: purposeConfig,
  returns: v.id("calibrationPurposes"),
  handler: async (ctx, a) => {
    if (
      !keyValid(a.version) ||
      !a.rightsEvidence.trim() ||
      a.rightsEvidence.length > 2000 ||
      !a.explanation.trim() ||
      a.explanation.length > 2000 ||
      !dateValid(a.expiresAt) ||
      a.expiresAt <= Date.now() ||
      !Number.isSafeInteger(a.retentionMs) ||
      a.retentionMs <= 0 ||
      a.retentionMs > 30 * 86400000
    )
      fail("CALIBRATION_CONFIGURATION_INVALID");
    const account = await ctx.db.get(a.accountId);
    requireReference(a.workspaceId, account);
    if (
      account!.provider !== "X" ||
      account!.providerIdentity !== a.providerIdentity
    )
      fail("CALIBRATION_ACCOUNT_CHANGED");
    await admin(ctx, a.workspaceId, a.approvedBy);
    const fingerprint = await hash(a);
    const old = await ctx.db
      .query("calibrationPurposes")
      .withIndex("by_workspaceId_and_accountId_and_version", (q) =>
        q
          .eq("workspaceId", a.workspaceId)
          .eq("accountId", a.accountId)
          .eq("version", a.version),
      )
      .unique();
    if (old) {
      if (
        old.withdrawal ||
        old.redactedAt !== undefined ||
        old.expiresAt <= Date.now()
      )
        fail("CALIBRATION_PURPOSE_REVOKED");
      if (old.fingerprint !== fingerprint)
        fail("CALIBRATION_PURPOSE_VERSION_CONFLICT");
      return old._id;
    }
    return ctx.db.insert("calibrationPurposes", {
      ...a,
      createdAt: Date.now(),
      fingerprint,
      generation: 0,
      consent: null,
      withdrawal: null,
    });
  },
});
export const consent = workspaceMutation({
  args: {
    ...scoped,
    purposeId: v.id("calibrationPurposes"),
    purposeFingerprint: v.string(),
    enabled: v.boolean(),
    commandKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const p = await ctx.db.get(a.purposeId);
    if (
      !p ||
      p.workspaceId !== ctx.workspace._id ||
      p.accountId !== a.accountId ||
      p.fingerprint !== a.purposeFingerprint ||
      !keyValid(a.commandKey)
    )
      fail("CALIBRATION_PURPOSE_CHANGED");
    if (a.enabled) {
      await configured(ctx, p);
      if (p.withdrawal) fail("CALIBRATION_PURPOSE_REVOKED");
      if (p.consent) {
        if (
          p.consent.commandKey !== a.commandKey ||
          p.consent.actorId !== ctx.user._id
        )
          fail("CALIBRATION_CONSENT_CONFLICT");
        return null;
      }
      await ctx.db.patch(p._id, {
        consent: {
          actorId: ctx.user._id,
          at: Date.now(),
          commandKey: a.commandKey,
        },
        generation: p.generation + 1,
      });
    } else {
      if (p.consent?.commandKey === a.commandKey)
        fail("CALIBRATION_CONSENT_CONFLICT");
      if (p.withdrawal) {
        if (
          p.withdrawal.commandKey !== a.commandKey ||
          p.withdrawal.actorId !== ctx.user._id
        )
          fail("CALIBRATION_CONSENT_CONFLICT");
        return null;
      }
      await ctx.db.patch(p._id, {
        withdrawal: {
          actorId: ctx.user._id,
          at: Date.now(),
          commandKey: a.commandKey,
        },
        generation: p.generation + 1,
      });
      await ctx.scheduler.runAfter(0, internal.performance.models.clear, {
        purposeId: p._id,
      });
      await ctx.scheduler.runAfter(0, internal.performance.calibration.clear, {
        purposeId: p._id,
        generation: p.generation + 1,
      });
    }
    return null;
  },
});
function sameIdentity(
  a: Infer<typeof compatibility>,
  b: Infer<typeof compatibility>,
) {
  return Object.entries(a).every(
    ([key, value]) => value === b[key as keyof typeof b],
  );
}
type Pair = {
  identity: Infer<typeof compatibility>;
  reference: Infer<typeof ref>;
  replies: number;
  impressions: number;
  score: number;
  clarity: number;
  discussion: number;
  horizon: number;
};
// Each pair rejoins native publication and receipts; no scores or labels are stored here.
async function pair(
  ctx: Ctx,
  c: Doc<"xPostAttempts">,
  asOf: number,
): Promise<Pair> {
  const capacity = await ctx.meta.getTransactionMetrics();
  // ponytail: bounded native joins; reserve headroom for one lineage proof, narrow the frame if capacity is insufficient.
  if (
    capacity.databaseQueries.remaining < 512 ||
    capacity.documentsRead.remaining < 1000 ||
    capacity.bytesRead.remaining < 2 * 1024 * 1024
  )
    fail("CALIBRATION_READ_CAPACITY");
  if (
    c.stage !== "confirmed" ||
    !c.externalId ||
    c.confirmedAt === undefined ||
    c.requestStartedAt === undefined ||
    c.position !== 0 ||
    c.parentId ||
    c.mediaIds.length
  )
    fail("publication-unproven");
  const s = await ctx.db.get(c.scheduleId),
    ver = await ctx.db.get(c.versionId);
  if (
    !s ||
    !ver ||
    s.workspaceId !== c.workspaceId ||
    s.accountId !== c.accountId ||
    s.versionId !== c.versionId ||
    s.draftId !== ver.draftId ||
    s.purpose === "first_write_verification" ||
    s.state !== "published" ||
    s.generation !== c.generation ||
    ver.workspaceId !== c.workspaceId ||
    ver.content.accountId !== c.accountId
  )
    fail("native-correspondence-unproven");
  if (
    ver.content.text.length !== 1 ||
    ver.content.media.length !== 0 ||
    s.externalPosts?.length !== 1
  )
    fail("thread-media-or-incomplete");
  const external = s.externalPosts[0];
  if (
    external.attemptId !== c._id ||
    external.externalId !== c.externalId ||
    external.position !== 0 ||
    external.confirmedAt !== c.confirmedAt ||
    s.publishedCount !== 1
  )
    fail("native-correspondence-unproven");
  const k = await ctx.db
    .query("publicationKnowledge")
    .withIndex("by_postAttemptId", (q) => q.eq("postAttemptId", c._id))
    .unique();
  if (!k?.applicable || !k.assessmentId)
    fail("no-applicable-publication-assessment");
  if (
    k.workspaceId !== c.workspaceId ||
    k.accountId !== c.accountId ||
    k.scheduleId !== c.scheduleId ||
    k.versionId !== c.versionId ||
    k.generation !== c.generation ||
    k.providerIdentity !== c.providerIdentity
  )
    fail("knowledge-correspondence-unproven");
  const a = await ctx.db.get(k.assessmentId);
  if (
    !a ||
    a.workspaceId !== c.workspaceId ||
    a.accountId !== c.accountId ||
    a.draftVersionId !== c.versionId ||
    a.draftId !== s.draftId
  )
    fail("assessment-correspondence-unproven");
  const proof = await assessmentSource(ctx, c.workspaceId, a);
  const receipt = await ctx.db.get(a.attemptId),
    algorithm = await ctx.db.get(a.algorithmId),
    audience = await ctx.db.get(a.audienceId);
  if (
    !receipt ||
    receipt.owner !== "jev-analyzer" ||
    receipt.runId !== undefined ||
    receipt.researchOrderId !== undefined ||
    receipt.logicalIntent !== undefined ||
    receipt.state !== "settled" ||
    receipt.settledAt === null ||
    !receipt.resolvedModel ||
    receipt.draftId !== a.draftId ||
    receipt.draftVersionId !== a.draftVersionId ||
    receipt.accountId !== c.accountId ||
    receipt.workspaceId !== c.workspaceId ||
    receipt.algorithmId !== a.algorithmId ||
    receipt.audienceId !== a.audienceId ||
    receipt.outcome !== a.result.outcome ||
    receipt.questionVersion !== a.result.questionVersion ||
    receipt.normalizationVersion !== a.result.normalizationVersion ||
    receipt.policyId !== a.provenance.policyId ||
    receipt.policyVersion !== a.provenance.policyVersion ||
    receipt.model !== a.provenance.requestedModel ||
    receipt.resolvedModel !== a.provenance.resolvedModel ||
    receipt.sentAt !== a.provenance.sentAt ||
    receipt.settledAt !== a.provenance.settledAt ||
    receipt.selectionRevision !== a.provenance.selectionRevision
  )
    fail("analysis-receipt-unproven");
  const policy = await ctx.db.get(receipt.policyId);
  if (
    !policy ||
    policy.workspaceId !== c.workspaceId ||
    policy.accountId !== c.accountId ||
    policy.version !== receipt.policyVersion ||
    (await hash(policy)) !== receipt.policyFingerprint
  )
    fail("analysis-policy-unproven");
  await admin(ctx, c.workspaceId, policy.approvedBy);
  if (
    !algorithm ||
    !audience ||
    algorithm.workspaceId !== c.workspaceId ||
    audience.workspaceId !== c.workspaceId ||
    algorithm.accountId !== c.accountId ||
    audience.accountId !== c.accountId ||
    algorithm.payload.version !== "x-post-analysis-v1" ||
    algorithm.payload.refs.questionSet !== a.result.questionVersion ||
    algorithm.payload.refs.normalization !== a.result.normalizationVersion ||
    algorithm.payload.refs.formula !== a.result.score?.formulaVersion ||
    !algorithm.review ||
    !audience.review
  )
    fail("executable-profiles-unproven");
  await admin(ctx, c.workspaceId, algorithm.review.actorId);
  await admin(ctx, c.workspaceId, audience.review.actorId);
  const score = a.result.score;
  if (
    !score ||
    score.aggregate === null ||
    score.missing.length ||
    score.lowConfidence.length ||
    score.history.value !== 0.5 ||
    Object.entries(WEIGHTS).some(
      ([key, value]) => score.weights[key as keyof typeof WEIGHTS] !== value,
    ) ||
    a.result.questionVersion !== POST_ANALYSIS.version ||
    a.result.deterministic.segments.length !== 1 ||
    a.result.deterministic.media.count !== 0
  )
    fail("assessment-features-missing");
  const clarity = a.result.answers?.clarity,
    discussion = a.result.answers?.discussionPotential;
  if (
    !clarity ||
    clarity.type !== "score" ||
    !discussion ||
    discussion.type !== "score" ||
    [clarity.value, discussion.value, score.aggregate].some(
      (n) => !Number.isFinite(n),
    ) ||
    [clarity.value, discussion.value].some((n) => n < 0 || n > 1)
  )
    fail("assessment-features-invalid");
  const snap = await ctx.db
    .query("performanceSnapshots")
    .withIndex("by_postAttemptId_and_windowHours", (q) =>
      q.eq("postAttemptId", c._id).eq("windowHours", 24),
    )
    .unique();
  if (
    !snap ||
    snap.observedAt === null ||
    snap.providerCreatedAt === null ||
    snap.requestedAt === null ||
    snap.late ||
    Math.abs(snap.observedAt - snap.providerCreatedAt - 86400000) > 60000 ||
    snap.confirmedAt !== c.confirmedAt ||
    snap.position !== 0
  )
    fail("fixed-24h-observation-missing");
  const horizon = await retainedSnapshotHorizon(ctx, snap);
  const metricReceipt = snap.attemptId
    ? await ctx.db.get(snap.attemptId)
    : null;
  if (
    !metricReceipt ||
    metricReceipt.owner !== "own-metrics" ||
    metricReceipt.runId !== undefined ||
    metricReceipt.researchOrderId !== undefined ||
    metricReceipt.logicalIntent !== undefined ||
    metricReceipt.state !== "settled" ||
    metricReceipt.settledAt === null ||
    !metricReceipt.receiptFingerprint ||
    metricReceipt.settledAt > snap.observedAt ||
    metricReceipt.sentAt > snap.observedAt ||
    snap.requestedAt < metricReceipt.sentAt
  )
    fail("metric-receipt-unproven");
  const original = await ctx.db.get(metricReceipt.policyId);
  if (
    !original ||
    original.providerIdentity !== c.providerIdentity ||
    metricReceipt.policyVersion !== original.version ||
    (await metricFingerprint(original)) !== metricReceipt.policyFingerprint
  )
    fail("metric-policy-unproven");
  await admin(ctx, c.workspaceId, original.approvedBy);
  const replies = snap.fields.filter((x) => x.name === "replies"),
    impressions = snap.fields.filter((x) => x.name === "impressions");
  if (replies.length !== 1 || impressions.length !== 1)
    fail("measured-target-missing");
  for (const [f, name, raw] of [
    [replies[0], "replies", "public_metrics.reply_count"],
    [impressions[0], "impressions", "public_metrics.impression_count"],
  ] as const)
    if (
      f.status !== "measured" ||
      f.value === null ||
      !Number.isSafeInteger(f.value) ||
      f.value < 0 ||
      f.rawField !== raw ||
      f.definition !== definitions[name]
    )
      fail("measured-target-invalid");
  if (impressions[0].value! <= 0) fail("zero-impressions");
  if (
    receipt.sentAt > receipt.settledAt ||
    receipt.settledAt > a.createdAt ||
    a.createdAt > k.capturedAt ||
    k.capturedAt > c.requestStartedAt ||
    c.requestStartedAt > snap.providerCreatedAt ||
    snap.providerCreatedAt > c.confirmedAt
  )
    fail("prepublication-order-unproven");
  const artifacts = [
    c,
    s,
    ver,
    k,
    a,
    receipt,
    algorithm,
    audience,
    policy,
    snap,
    metricReceipt,
    original,
  ];
  if (
    artifacts.some((row) => row._creationTime > asOf) ||
    [
      c.createdAt,
      c.updatedAt,
      c.reconciledAt ?? c.confirmedAt,
      c.confirmedAt,
      c.requestStartedAt,
      k.capturedAt,
      a.createdAt,
      receipt.sentAt,
      receipt.settledAt,
      snap.providerCreatedAt,
      snap.requestedAt,
      snap.observedAt,
      metricReceipt.sentAt,
      metricReceipt.settledAt,
    ].some((t) => !dateValid(t) || t > asOf)
  )
    fail("future-or-backfilled-artifact");
  const currentNumeric = await currentMetricPolicy(ctx, c);
  const until = Math.min(
    horizon,
    snap.dueAt + original.retentionMs,
    snap.dueAt + currentNumeric.retentionMs,
    proof.sourceUntil ?? Infinity,
  );
  if (
    until <= Date.now() ||
    (a.sourceUntil !== null && a.sourceUntil <= snap.observedAt)
  )
    fail("original-source-expired-before-label");
  const identity: Infer<typeof compatibility> = {
    network: "x",
    format: "single-text",
    windowHours: 24,
    metricPolicyId: original._id,
    metricPolicyFingerprint: metricReceipt.policyFingerprint,
    metricVersion: original.version,
    dialect: original.dialect,
    replyField: replies[0].rawField,
    replyDefinition: replies[0].definition,
    impressionField: impressions[0].rawField,
    impressionDefinition: impressions[0].definition,
    algorithmId: algorithm._id,
    algorithmFingerprint: await hash(algorithm.payload),
    audienceId: audience._id,
    audienceFingerprint: await hash(audience.payload),
    jevPolicyId: policy._id,
    jevPolicyVersion: policy.version,
    jevPolicyFingerprint: receipt.policyFingerprint,
    requestedModel: receipt.model,
    resolvedModel: receipt.resolvedModel,
    questionVersion: a.result.questionVersion,
    questionFingerprint: await hash(POST_ANALYSIS),
    inputVersion: a.inputVersion,
    normalizationVersion: a.result.normalizationVersion,
    formulaVersion: score.formulaVersion,
    thresholdVersion: score.thresholdVersion,
    formulaFingerprint: await hash({
      weights: score.weights,
      history: score.history,
      threshold: score.minimumConfidence,
      basis: score.thresholdBasis,
      structure: a.result.deterministic.version,
    }),
  };
  return {
    identity,
    replies: replies[0].value!,
    impressions: impressions[0].value!,
    score: score.aggregate,
    clarity: clarity.value,
    discussion: discussion.value,
    horizon: until,
    reference: {
      postAttemptId: c._id,
      scheduleId: s._id,
      versionId: ver._id,
      externalId: c.externalId,
      knowledgeId: k._id,
      assessmentId: a._id,
      analysisReceiptId: receipt._id,
      snapshotId: snap._id,
      metricReceiptId: metricReceipt._id,
      fingerprint: await hash({
        identity,
        assessment: a.result,
        semanticKey: a.semanticKey,
        inputFingerprint: receipt.requestFingerprint,
        metrics: snap.fields,
        metricReceiptFingerprint: metricReceipt.receiptFingerprint,
        knowledge: k,
        native: {
          attempt: c._id,
          createdAt: c.createdAt,
          confirmedAt: c.confirmedAt,
          requestStartedAt: c.requestStartedAt,
          publishedAt: snap.providerCreatedAt,
          requestedAt: snap.requestedAt,
          observedAt: snap.observedAt,
        },
        analysisReceipt: {
          id: receipt._id,
          requestFingerprint: receipt.requestFingerprint,
          sentAt: receipt.sentAt,
          settledAt: receipt.settledAt,
        },
        metricReceipt: {
          id: metricReceipt._id,
          sentAt: metricReceipt.sentAt,
          settledAt: metricReceipt.settledAt,
        },
      }),
      confirmedAt: c.confirmedAt,
      publishedAt: snap.providerCreatedAt,
      observedAt: snap.observedAt,
      assessmentAt: a.createdAt,
      capturedAt: k.capturedAt,
      requestStartedAt: c.requestStartedAt,
      sourceUntil: proof.sourceUntil,
      originalUntil: until,
      membership: "train",
    },
  };
}
function reason(e: unknown) {
  return e instanceof ConvexError
    ? String(e.data)
    : "current-source-unavailable";
}
async function replay(
  ctx: Ctx,
  s: Scope,
  actorId: Id<"users">,
  commandKey: string,
  requestFingerprint: string,
) {
  if (!keyValid(commandKey)) fail("CALIBRATION_COMMAND_INVALID");
  const row = await ctx.db
    .query("calibrationReferences")
    .withIndex("by_workspaceId_and_actorId_and_commandKey", (q) =>
      q
        .eq("workspaceId", s.workspaceId)
        .eq("actorId", actorId)
        .eq("commandKey", commandKey),
    )
    .unique();
  if (
    row &&
    (row.accountId !== s.accountId ||
      row.requestFingerprint !== requestFingerprint)
  )
    fail("CALIBRATION_REPLAY_CONFLICT");
  return row;
}
export async function readableSpec(
  ctx: Ctx,
  s: Scope,
  id: Id<"calibrationReferences">,
): Promise<{ spec: Spec; p: Doc<"calibrationPurposes">; horizon: number }> {
  const spec = await ctx.db.get(id);
  if (
    !spec ||
    spec.kind !== "spec" ||
    spec.workspaceId !== s.workspaceId ||
    spec.accountId !== s.accountId
  )
    fail("CALIBRATION_SPEC_CHANGED");
  if (spec.expiresAt <= Date.now()) fail("CALIBRATION_REFERENCE_EXPIRED");
  const p = await allowed(ctx, spec.purposeId, s, spec.generation);
  const c = await ctx.db.get(spec.payload.anchor.postAttemptId);
  if (!c) fail("CALIBRATION_SPEC_SOURCE_UNAVAILABLE");
  const source = await pair(ctx, c, Date.now());
  if (
    source.reference.fingerprint !== spec.payload.anchor.fingerprint ||
    !sameIdentity(source.identity, spec.payload.compatibility)
  )
    fail("CALIBRATION_SPEC_SOURCE_CHANGED");
  const horizon = Math.min(spec.expiresAt, source.horizon, p.expiresAt);
  if (horizon <= Date.now()) fail("CALIBRATION_REFERENCE_EXPIRED");
  return { spec, p, horizon };
}
export const createSpec = workspaceMutation({
  args: {
    ...scoped,
    purposeId: v.id("calibrationPurposes"),
    commandKey: v.string(),
    mode: v.union(v.literal("prospective"), v.literal("retrospective")),
    ...bounds,
    referencePostAttemptId: v.id("xPostAttempts"),
    referenceAssessmentId: v.id("jevAssessments"),
  },
  returns: v.id("calibrationReferences"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      p = await allowed(ctx, a.purposeId, s),
      now = Date.now();
    const sequence = [
      a.from,
      a.fitCutoff,
      a.holdout1Start,
      a.holdout1End,
      a.holdout2Start,
      a.holdout2End,
    ];
    if (
      sequence.some((n) => !dateValid(n)) ||
      !(
        a.from < a.fitCutoff &&
        a.fitCutoff <= a.holdout1Start &&
        a.holdout1Start < a.holdout1End &&
        a.holdout1End <= a.holdout2Start &&
        a.holdout2Start < a.holdout2End
      ) ||
      a.holdout2End - a.from > 366 * 86400000 ||
      a.fitCutoff > now ||
      (a.mode === "prospective" && a.holdout1Start <= now)
    )
      fail("CALIBRATION_UTC_BOUNDS_INVALID");
    const requestFingerprint = await hash(a),
      old = await replay(
        ctx,
        s,
        ctx.user._id,
        a.commandKey,
        requestFingerprint,
      );
    if (old) {
      await readableSpec(ctx, s, old._id);
      return old._id;
    }
    const c = await ctx.db.get(a.referencePostAttemptId);
    if (!c || c.workspaceId !== s.workspaceId || c.accountId !== s.accountId)
      fail("CALIBRATION_REFERENCE_CHANGED");
    const x = await pair(ctx, c, now);
    if (x.reference.assessmentId !== a.referenceAssessmentId)
      fail("CALIBRATION_REFERENCE_CHANGED");
    return ctx.db.insert("calibrationReferences", {
      ...s,
      purposeId: p._id,
      generation: p.generation,
      actorId: ctx.user._id,
      createdAt: now,
      commandKey: a.commandKey,
      requestFingerprint,
      expiresAt: Math.min(p.expiresAt, now + p.retentionMs, x.horizon),
      kind: "spec",
      specId: null,
      payload: {
        from: a.from,
        fitCutoff: a.fitCutoff,
        holdout1Start: a.holdout1Start,
        holdout1End: a.holdout1End,
        holdout2Start: a.holdout2Start,
        holdout2End: a.holdout2End,
        mode: a.mode,
        target: TARGET,
        transfers: TRANSFERS,
        empiricalPolicy: null,
        prospectiveStatus:
          a.mode === "prospective"
            ? "candidate-not-frozen"
            : "retrospective-diagnostic",
        activationEligible: false,
        compatibility: x.identity,
        anchor: { ...x.reference, membership: "compatibility-anchor" },
      },
    });
  },
});
export async function readableSnapshot(ctx: Ctx, s: Scope, row: Snapshot) {
  if (row.expiresAt <= Date.now()) fail("CALIBRATION_REFERENCE_EXPIRED");
  const { spec, p, horizon } = await readableSpec(ctx, s, row.specId);
  if (
    row.generation !== p.generation ||
    row.purposeId !== p._id ||
    row.payload.asOf > Date.now()
  )
    fail("CALIBRATION_SNAPSHOT_CHANGED");
  let until = Math.min(row.expiresAt, horizon);
  const measurements = [];
  for (const r of row.payload.refs) {
    const c = await ctx.db.get(r.postAttemptId);
    if (!c) fail("CALIBRATION_SOURCE_REMOVED");
    const x = await pair(ctx, c, row.payload.asOf);
    if (
      x.reference.fingerprint !== r.fingerprint ||
      !sameIdentity(x.identity, spec.payload.compatibility)
    )
      fail("CALIBRATION_SOURCE_CHANGED");
    until = Math.min(until, r.originalUntil, x.horizon);
    measurements.push({
      postAttemptId: r.postAttemptId,
      replies: x.replies,
      impressions: x.impressions,
      rate: x.replies / x.impressions,
      staticScore: x.score,
    });
  }
  if (until <= Date.now()) fail("CALIBRATION_REFERENCE_EXPIRED");
  return { row: { ...row, expiresAt: until }, measurements };
}
// Server-only adapter: select training membership before any native label join.
export async function modelProof(
  ctx: Ctx,
  s: Scope,
  specId: Id<"calibrationReferences">,
  snapshotId: Id<"calibrationReferences"> | null,
  phase: "train" | "comparison",
) {
  const spec = await ctx.db.get(specId);
  if (
    !spec ||
    spec.kind !== "spec" ||
    spec.workspaceId !== s.workspaceId ||
    spec.accountId !== s.accountId
  )
    fail("CALIBRATION_SPEC_CHANGED");
  const p = await allowed(ctx, spec.purposeId, s, spec.generation),
    b = spec.payload;
  if (spec.expiresAt <= Date.now()) fail("CALIBRATION_REFERENCE_EXPIRED");
  const anchor = b.anchor;
  if (
    anchor.publishedAt < b.from ||
    anchor.publishedAt >= b.fitCutoff ||
    anchor.observedAt > b.fitCutoff
  )
    fail("CALIBRATION_TRAIN_ANCHOR_REQUIRED");
  const row = snapshotId ? await ctx.db.get(snapshotId) : null;
  if (
    snapshotId &&
    (!row ||
      row.kind !== "snapshot" ||
      row.specId !== specId ||
      row.workspaceId !== s.workspaceId ||
      row.accountId !== s.accountId ||
      row.purposeId !== p._id ||
      row.generation !== p.generation ||
      row.payload.asOf > Date.now())
  )
    fail("CALIBRATION_SNAPSHOT_CHANGED");
  const snapshot = row as Snapshot | null;
  if (
    snapshot &&
    (!snapshot.payload.frameComplete || snapshot.payload.refs.length > 200)
  )
    fail("CALIBRATION_FRAME_INCOMPLETE");
  let horizon = Math.min(
    spec.expiresAt,
    p.expiresAt,
    snapshot?.expiresAt ?? Infinity,
  );
  if (horizon <= Date.now()) fail("CALIBRATION_REFERENCE_EXPIRED");
  const selected =
    snapshot?.payload.refs.filter(
      (r) => phase === "comparison" || r.membership === "train",
    ) ?? [];
  const cache = new Map<string, Pair>();
  async function prove(r: Infer<typeof ref> | typeof anchor) {
    const train =
      r.membership === "train" || r.membership === "compatibility-anchor";
    const valid = train
      ? r.publishedAt >= b.from &&
        r.publishedAt < b.fitCutoff &&
        r.observedAt <= b.fitCutoff
      : r.membership === "block1"
        ? r.publishedAt >= b.holdout1Start &&
          r.publishedAt < b.holdout1End &&
          r.observedAt < b.holdout1End
        : r.publishedAt >= b.holdout2Start &&
          r.publishedAt < b.holdout2End &&
          r.observedAt < b.holdout2End;
    if (!valid) fail("CALIBRATION_MEMBERSHIP_CHANGED");
    let x = cache.get(String(r.postAttemptId));
    if (!x) {
      const c = await ctx.db.get(r.postAttemptId);
      if (!c || c.workspaceId !== s.workspaceId || c.accountId !== s.accountId)
        fail("CALIBRATION_SOURCE_REMOVED");
      try {
        x = await pair(
          ctx,
          c,
          train
            ? Math.min(snapshot?.payload.asOf ?? b.fitCutoff, b.fitCutoff)
            : snapshot!.payload.asOf,
        );
      } catch (e) {
        if (
          e instanceof Error &&
          e.message === "OWN_METRICS_SOURCE_UNAVAILABLE"
        )
          fail("CALIBRATION_SOURCE_UNAVAILABLE");
        throw e;
      }
      cache.set(String(r.postAttemptId), x);
    }
    if (
      !sameIdentity(x.identity, b.compatibility) ||
      x.reference.fingerprint !== r.fingerprint ||
      Object.entries(r).some(
        ([k, val]) =>
          k !== "membership" &&
          k !== "originalUntil" &&
          val !== x!.reference[k as keyof Pair["reference"]],
      )
    )
      fail("CALIBRATION_SOURCE_CHANGED");
    horizon = Math.min(horizon, r.originalUntil, x.horizon);
    return {
      ...x,
      reference: {
        ...r,
        membership: r.membership as Infer<typeof ref>["membership"],
      },
    };
  }
  await prove(anchor);
  const pairs = [];
  const units = new Set<string>(),
    externals = new Set<string>();
  for (const r of selected) {
    if (units.has(String(r.scheduleId)) || externals.has(r.externalId))
      fail("CALIBRATION_DUPLICATE_UNIT");
    units.add(String(r.scheduleId));
    externals.add(r.externalId);
    pairs.push(await prove(r));
  }
  if (horizon <= Date.now()) fail("CALIBRATION_REFERENCE_EXPIRED");
  return { spec, purpose: p, snapshot, pairs, horizon };
}
export const build = workspaceMutation({
  args: {
    ...scoped,
    specId: v.id("calibrationReferences"),
    asOf: v.number(),
    commandKey: v.string(),
  },
  returns: v.id("calibrationReferences"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      now = Date.now();
    if (!dateValid(a.asOf) || a.asOf > now) fail("CALIBRATION_AS_OF_INVALID");
    const { spec, p, horizon } = await readableSpec(ctx, s, a.specId);
    if (
      spec.createdAt > a.asOf ||
      p.createdAt > a.asOf ||
      !p.consent ||
      p.consent.at > a.asOf
    )
      fail("CALIBRATION_SPEC_AFTER_AS_OF");
    const requestFingerprint = await hash(a),
      old = await replay(
        ctx,
        s,
        ctx.user._id,
        a.commandKey,
        requestFingerprint,
      );
    if (old) {
      if (old.kind !== "snapshot") fail("CALIBRATION_REPLAY_CONFLICT");
      await readableSnapshot(ctx, s, old);
      return old._id;
    }
    const b = spec.payload,
      frameEnd = Math.min(a.asOf, b.holdout2End);
    const rows = await ctx.db
      .query("xPostAttempts")
      .withIndex(
        "by_workspaceId_and_accountId_and_stage_and_confirmedAt",
        (q) =>
          q
            .eq("workspaceId", s.workspaceId)
            .eq("accountId", s.accountId)
            .eq("stage", "confirmed")
            .gte("confirmedAt", b.from)
            .lt("confirmedAt", frameEnd),
      )
      .take(201);
    const refs: Infer<typeof ref>[] = [],
      exclusions: { postAttemptId: Id<"xPostAttempts">; reason: string }[] = [],
      units = new Set<string>(),
      externals = new Set<string>();
    let until = Math.min(horizon, p.expiresAt, now + p.retentionMs);
    for (const c of rows.slice(0, 200)) {
      try {
        const unit = String(c.scheduleId);
        if (units.has(unit) || (c.externalId && externals.has(c.externalId)))
          fail("duplicate-publication");
        units.add(unit);
        if (c.externalId) externals.add(c.externalId);
        const x = await pair(ctx, c, a.asOf);
        if (!sameIdentity(x.identity, b.compatibility))
          fail("incompatible-version-stratum");
        const at = x.reference.publishedAt;
        let membership: Infer<typeof ref>["membership"];
        if (at >= b.from && at < b.fitCutoff) {
          if (x.reference.observedAt > b.fitCutoff)
            fail("training-label-after-cutoff");
          membership = "train";
        } else if (at >= b.holdout1Start && at < b.holdout1End) {
          if (x.reference.observedAt >= b.holdout1End)
            fail("label-straddles-block");
          membership = "block1";
        } else if (at >= b.holdout2Start && at < b.holdout2End) {
          if (x.reference.observedAt >= b.holdout2End)
            fail("label-straddles-block");
          membership = "block2";
        } else fail("outside-declared-split");
        refs.push({ ...x.reference, membership });
        until = Math.min(until, x.horizon);
      } catch (e) {
        if (reason(e) === "CALIBRATION_READ_CAPACITY") throw e;
        exclusions.push({ postAttemptId: c._id, reason: reason(e) });
      }
    }
    const counts = {
      n: refs.length,
      train: refs.filter((r) => r.membership === "train").length,
      block1: refs.filter((r) => r.membership === "block1").length,
      block2: refs.filter((r) => r.membership === "block2").length,
    };
    const times = refs.map((r) => r.publishedAt),
      timeSpanMs = times.length ? Math.max(...times) - Math.min(...times) : 0;
    const payload = {
      asOf: a.asOf,
      frameEnd,
      frameComplete: rows.length <= 200,
      scanned: Math.min(rows.length, 200),
      populationLowerBound: rows.length,
      populationTotal: rows.length > 200 ? null : rows.length,
      refs,
      exclusions,
      counts,
      timeSpanMs,
      engineeringScreen:
        rows.length <= 200 && counts.n >= 30 && timeSpanMs >= 28 * 86400000,
      engineeringScreenBasis: "unvalidated-30-posts-28-days" as const,
      empiricalStatus: "unconfigured" as const,
      activationEligible: false as const,
      unknownSegments: [
        "account-size",
        "topic",
        "timezone",
        "unseen-version-strata",
      ],
      missingPolicies: [
        "training-minimum",
        "holdout-minimum",
        "each-block-minimum",
        "small-segment",
        "coverage",
        "benefit",
        "drift",
      ],
    };
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 256 * 1024)
      fail("CALIBRATION_MANIFEST_OVERFLOW");
    return ctx.db.insert("calibrationReferences", {
      ...s,
      purposeId: p._id,
      generation: p.generation,
      actorId: ctx.user._id,
      createdAt: now,
      commandKey: a.commandKey,
      requestFingerprint,
      expiresAt: until,
      kind: "snapshot",
      specId: spec._id,
      payload,
    });
  },
});
const configurationView = v.object({
  id: v.id("calibrationPurposes"),
  fingerprint: v.string(),
  version: v.string(),
  rightsEvidence: v.string(),
  explanation: v.string(),
  expiresAt: v.number(),
  retentionMs: v.number(),
  withdrawn: v.boolean(),
});
export const get = workspaceQuery({
  args: scoped,
  returns: v.object({
    enabled: v.boolean(),
    reason: v.union(v.string(), v.null()),
    configuration: v.union(configurationView, v.null()),
    choices: v.array(
      v.object({
        postAttemptId: v.id("xPostAttempts"),
        assessmentId: v.id("jevAssessments"),
        publishedAt: v.number(),
        versionNumber: v.number(),
        requestedModel: v.string(),
        resolvedModel: v.string(),
        expiresAt: v.number(),
      }),
    ),
    choicesPartial: v.boolean(),
    specs: v.array(specDoc),
    snapshots: v.array(
      v.object({
        row: snapshotDoc,
        measurements: v.array(
          v.object({
            postAttemptId: v.id("xPostAttempts"),
            replies: v.number(),
            impressions: v.number(),
            rate: v.number(),
            staticScore: v.number(),
          }),
        ),
      }),
    ),
    unavailable: v.array(
      v.object({ id: v.id("calibrationReferences"), reason: v.string() }),
    ),
  }),
  handler: async (ctx, a) => {
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      p = await latestPurpose(ctx, s),
      choices = [],
      specs: Spec[] = [],
      snapshots: Awaited<ReturnType<typeof readableSnapshot>>[] = [],
      unavailable: { id: Id<"calibrationReferences">; reason: string }[] = [];
    let enabled = false,
      why: string | null = p
        ? "CALIBRATION_CONSENT_REQUIRED"
        : "CALIBRATION_CONFIGURATION_REQUIRED",
      choicesPartial = false;
    if (p)
      try {
        await allowed(ctx, p._id, s);
        enabled = true;
        why = null;
      } catch (e) {
        why = reason(e);
      }
    if (enabled) {
      const rows = await ctx.db
        .query("xPostAttempts")
        .withIndex(
          "by_workspaceId_and_accountId_and_stage_and_confirmedAt",
          (q) =>
            q
              .eq("workspaceId", s.workspaceId)
              .eq("accountId", s.accountId)
              .eq("stage", "confirmed"),
        )
        .order("desc")
        .take(6);
      choicesPartial = rows.length > 5;
      for (const c of rows.slice(0, 5))
        try {
          const x = await pair(ctx, c, Date.now()),
            assessment = await ctx.db.get(x.reference.assessmentId);
          choices.push({
            postAttemptId: c._id,
            assessmentId: x.reference.assessmentId,
            publishedAt: x.reference.publishedAt,
            versionNumber: assessment!.versionNumber,
            requestedModel: x.identity.requestedModel,
            resolvedModel: x.identity.resolvedModel,
            expiresAt: Math.min(x.horizon, p!.expiresAt),
          });
        } catch {
          /* Unreadable candidates never expose protected identity. */
        }
      for (const kind of ["spec", "snapshot"] as const) {
        const rows = await ctx.db
          .query("calibrationReferences")
          .withIndex(
            "by_workspaceId_and_accountId_and_kind_and_createdAt",
            (q) =>
              q
                .eq("workspaceId", s.workspaceId)
                .eq("accountId", s.accountId)
                .eq("kind", kind),
          )
          .order("desc")
          .take(kind === "snapshot" ? 1 : 5);
        for (const row of rows)
          try {
            if (row.kind === "spec") {
              const x = await readableSpec(ctx, s, row._id);
              specs.push({ ...x.spec, expiresAt: x.horizon });
            } else snapshots.push(await readableSnapshot(ctx, s, row));
          } catch (e) {
            unavailable.push({ id: row._id, reason: reason(e) });
          }
      }
    }
    return {
      enabled,
      reason: why,
      configuration: p
        ? {
            id: p._id,
            fingerprint:
              enabled || why === "CALIBRATION_CONSENT_REQUIRED"
                ? p.fingerprint
                : "",
            version: p.version,
            rightsEvidence:
              enabled || why === "CALIBRATION_CONSENT_REQUIRED"
                ? p.rightsEvidence
                : "",
            explanation:
              enabled || why === "CALIBRATION_CONSENT_REQUIRED"
                ? p.explanation
                : "",
            expiresAt: p.expiresAt,
            retentionMs: p.retentionMs,
            withdrawn: p.withdrawal !== null,
          }
        : null,
      choices,
      choicesPartial,
      specs,
      snapshots,
      unavailable,
    };
  },
});
export const remove = workspaceMutation({
  args: { ...scoped, purposeId: v.id("calibrationPurposes") },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const p = await ctx.db.get(a.purposeId);
    if (
      !p ||
      p.workspaceId !== ctx.workspace._id ||
      p.accountId !== a.accountId
    )
      fail("CALIBRATION_PURPOSE_CHANGED");
    if (!p.withdrawal)
      await ctx.db.patch(p._id, {
        withdrawal: {
          actorId: ctx.user._id,
          at: Date.now(),
          commandKey: crypto.randomUUID(),
        },
        generation: p.generation + 1,
      });
    await ctx.scheduler.runAfter(0, internal.performance.models.clear, {
      purposeId: p._id,
    });
    await ctx.scheduler.runAfter(0, internal.performance.calibration.clear, {
      purposeId: p._id,
      generation: p.withdrawal ? p.generation : p.generation + 1,
    });
    return null;
  },
});
export const clear = internalMutation({
  args: { purposeId: v.id("calibrationPurposes"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.purposeId);
    if (!p || !p.withdrawal || p.generation !== a.generation) return null;
    const rows = await ctx.db
      .query("calibrationReferences")
      .withIndex("by_purposeId", (q) => q.eq("purposeId", p._id))
      .take(25);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 25)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.calibration.clear,
        a,
      );
    else await redactPurpose(ctx, p);
    return null;
  },
});
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.cursor === null)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.calibration.sweepPurposes,
        { cursor: null },
      );
    const page = await ctx.db
      .query("calibrationReferences")
      .withIndex("by_expiresAt")
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const row of page.page)
      try {
        if (row.kind === "spec") await readableSpec(ctx, row, row._id);
        else await readableSnapshot(ctx, row, row);
      } catch (e) {
        if (
          (e instanceof ConvexError &&
            e.data !== "CALIBRATION_READ_CAPACITY") ||
          (e instanceof Error && e.message === "OWN_METRICS_SOURCE_UNAVAILABLE")
        )
          await ctx.db.delete(row._id);
        else throw e;
      }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.performance.calibration.sweep, {
        cursor: page.continueCursor,
      });
    return null;
  },
});

async function redactPurpose(ctx: MutationCtx, p: Doc<"calibrationPurposes">) {
  if (p.redactedAt !== undefined) return;
  await ctx.db.patch(p._id, {
    rightsEvidence: "",
    explanation: "",
    providerIdentity: "",
    fingerprint: "",
    redactedAt: Date.now(),
  });
}
export const sweepPurposes = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("calibrationPurposes")
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const p of page.page)
      if (p.expiresAt <= Date.now() || p.withdrawal)
        await redactPurpose(ctx, p);
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.calibration.sweepPurposes,
        { cursor: page.continueCursor },
      );
    return null;
  },
});
