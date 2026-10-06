import { ConvexError, v, type Infer } from "convex/values";
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
  requireRole,
  requireReference,
  requireWorkspace,
} from "../lib/authorization";
import { admin } from "./capabilities";
import { modelProof } from "./calibration";
import { TRANSFERS, TARGET } from "./calibrationFields";
import {
  policyInput,
  experimentDoc,
  candidateDoc,
  evaluationDoc,
  monitoringPolicyInput,
  declarationDoc,
  checkDoc,
  projection as projectionValidator,
} from "./modelFields";
import { request, source } from "../intelligence/assessments";
import { current } from "../ai/jev/access";
import { POST_ANALYSIS } from "../ai/jev/questions/postAnalysis";
import { dispatchScore } from "../ai/scoring/dispatchScore";
import { sha256 } from "../lib/crypto";
import type { Doc, Id } from "../_generated/dataModel";
type Ctx = QueryCtx | MutationCtx;
type Scope = { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> };
type Experiment = Extract<Doc<"calibrationModels">, { kind: "experiment" }>;
type Candidate = Extract<Doc<"calibrationModels">, { kind: "candidate" }>;
type Evaluation = Extract<Doc<"calibrationModels">, { kind: "evaluation" }>;
type Declaration = Extract<
  Doc<"calibrationModels">,
  { kind: "monitoring-declaration" }
>;
type Check = Extract<Doc<"calibrationModels">, { kind: "monitoring-check" }>;
type Activation = Extract<
  Doc<"calibrationModels">,
  { kind: "activation-decision"; expiresAt: number }
>;
type Projection = Infer<typeof projectionValidator>;
type Feature = {
  score: number;
  clarity: number;
  discussion: number;
  replies: number;
  impressions: number;
};
function fail(code: string): never {
  throw new ConvexError(code);
}
const hash = (value: unknown) =>
  sha256(
    JSON.stringify(value, (_key, item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([a], [b]) =>
              a < b ? -1 : a > b ? 1 : 0,
            ),
          )
        : item,
    ),
  );
const scopeArgs = { accountId: v.id("socialAccounts") };
export function orderingLoss(rows: Feature[], transfer: number) {
  let twiceLoss = 0,
    pairs = 0,
    targetTies = 0,
    predictionTies = 0;
  if (
    rows.length > 200 ||
    !TRANSFERS.includes(transfer) ||
    rows.some(
      (r) =>
        !Number.isFinite(r.score) ||
        [r.clarity, r.discussion].some(
          (n) => !Number.isFinite(n) || n < 0 || n > 1,
        ) ||
        !Number.isSafeInteger(r.replies) ||
        r.replies < 0 ||
        !Number.isSafeInteger(r.impressions) ||
        r.impressions <= 0,
    )
  )
    fail("CALIBRATION_FEATURE_INVALID");
  // ponytail: O(9*n²), n<=200; narrow the immutable frame before adding a training job engine.
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i],
        b = rows[j],
        cross =
          BigInt(a.replies) * BigInt(b.impressions) -
          BigInt(b.replies) * BigInt(a.impressions);
      if (cross === 0n) {
        targetTies++;
        continue;
      }
      pairs++;
      const delta =
        a.score +
        100 * transfer * (a.discussion - a.clarity) -
        (b.score + 100 * transfer * (b.discussion - b.clarity));
      if (delta === 0) {
        predictionTies++;
        twiceLoss++;
      } else if (delta > 0 !== cross > 0n) twiceLoss += 2;
    }
  return {
    n: rows.length,
    twiceLoss,
    pairs,
    targetTies,
    predictionTies,
    loss: pairs ? twiceLoss / (2 * pairs) : null,
  };
}
export function chooseTransfer(rows: Feature[]) {
  const losses = TRANSFERS.map((t) => orderingLoss(rows, t));
  if (!losses[0].pairs) return { transfer: null, losses, selected: null };
  const best = TRANSFERS.map((t, i) => ({ t, i })).sort(
    (a, b) =>
      losses[a.i].twiceLoss - losses[b.i].twiceLoss ||
      Math.abs(a.t) - Math.abs(b.t) ||
      a.t - b.t,
  )[0];
  return { transfer: best.t, losses, selected: losses[best.i] };
}
async function replay(
  ctx: Ctx,
  s: Scope,
  actorId: Id<"users">,
  commandKey: string,
  fingerprint: string,
) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(commandKey))
    fail("CALIBRATION_COMMAND_INVALID");
  const row = await ctx.db
    .query("calibrationModels")
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
      !("requestFingerprint" in row) ||
      row.requestFingerprint !== fingerprint)
  )
    fail("CALIBRATION_REPLAY_CONFLICT");
  return row;
}
async function experiment(ctx: Ctx, s: Scope, id: Id<"calibrationModels">) {
  const e = await ctx.db.get(id);
  if (
    !e ||
    e.kind !== "experiment" ||
    e.workspaceId !== s.workspaceId ||
    e.accountId !== s.accountId
  )
    fail("CALIBRATION_EXPERIMENT_CHANGED");
  if (e.expiresAt <= Date.now()) fail("CALIBRATION_MODEL_EXPIRED");
  if (e.payload.policy) {
    if (e.payload.policy.reviewUntil <= Date.now())
      fail("CALIBRATION_POLICY_EXPIRED");
    await admin(ctx, s.workspaceId, e.payload.policy.reviewerId);
  }
  if ((await hash(e.payload.policy)) !== e.payload.policyFingerprint)
    fail("CALIBRATION_POLICY_CHANGED");
  return e;
}
function validPolicy(p: Infer<typeof policyInput>, now: number) {
  const integers = [p.minTrainN, p.minBlockN, p.minTrainSpanMs, p.reviewUntil];
  if (
    integers.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    p.minTrainN < 2 ||
    p.minTrainN > 200 ||
    p.minBlockN < 2 ||
    p.minBlockN > 200 ||
    p.minTrainSpanMs > 366 * 86400000 ||
    p.reviewUntil <= now ||
    [
      p.maxExcludedFraction,
      p.minImprovement,
      p.maxVariation,
      p.maxClarityDrift,
      p.maxDiscussionDrift,
    ].some((n) => !Number.isFinite(n) || n < 0 || n > 1) ||
    !Number.isFinite(p.maxReplyRateDrift) ||
    p.maxReplyRateDrift < 0 ||
    [p.evidence, p.rationale].some((x) => !x.trim() || x.length > 2000)
  )
    fail("CALIBRATION_POLICY_INVALID");
}
export const predeclare = workspaceMutation({
  args: {
    ...scopeArgs,
    specId: v.id("calibrationReferences"),
    policy: v.union(policyInput, v.null()),
    commandKey: v.string(),
  },
  returns: v.id("calibrationModels"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      now = Date.now(),
      fingerprint = await hash(a);
    const proof = await modelProof(ctx, s, a.specId, null, "train"),
      b = proof.spec.payload;
    const old = await replay(ctx, s, ctx.user._id, a.commandKey, fingerprint);
    if (old) {
      if (old.kind !== "experiment") fail("CALIBRATION_REPLAY_CONFLICT");
      const previous = await experiment(ctx, s, old._id);
      matching(previous, proof);
      if (previous.payload.specFingerprint !== (await hash(proof.spec)))
        fail("CALIBRATION_SPEC_CHANGED");
      return old._id;
    }
    if (b.mode === "prospective" && now >= b.holdout1Start)
      fail("CALIBRATION_PREDECLARE_TOO_LATE");
    if (
      await ctx.db
        .query("calibrationModels")
        .withIndex("by_specId_and_kind", (q) =>
          q.eq("specId", a.specId).eq("kind", "experiment"),
        )
        .unique()
    )
      fail("CALIBRATION_EXPERIMENT_EXISTS");
    if (a.policy) validPolicy(a.policy, now);
    const policy = a.policy
      ? { ...a.policy, reviewerId: ctx.user._id, reviewedAt: now }
      : null;
    return ctx.db.insert("calibrationModels", {
      ...s,
      actorId: ctx.user._id,
      purposeId: proof.purpose._id,
      generation: proof.purpose.generation,
      createdAt: now,
      expiresAt: Math.min(
        proof.horizon,
        now + proof.purpose.retentionMs,
        policy?.reviewUntil ?? Infinity,
      ),
      commandKey: a.commandKey,
      requestFingerprint: fingerprint,
      specId: a.specId,
      experimentId: null,
      kind: "experiment",
      payload: {
        from: b.from,
        fitCutoff: b.fitCutoff,
        holdout1Start: b.holdout1Start,
        holdout1End: b.holdout1End,
        holdout2Start: b.holdout2Start,
        holdout2End: b.holdout2End,
        mode: b.mode,
        target: TARGET,
        transfers: TRANSFERS,
        lossVersion: "twice-discordance-v1",
        specFingerprint: await hash(proof.spec),
        purposeFingerprint: proof.purpose.fingerprint,
        compatibility: b.compatibility,
        predeclaredAt: now,
        policy,
        policyFingerprint: await hash(policy),
        activationEligible: false,
      },
    });
  },
});
function matching(
  e: Experiment,
  proof: Awaited<ReturnType<typeof modelProof>>,
) {
  if (
    e.purposeId !== proof.purpose._id ||
    e.generation !== proof.purpose.generation ||
    e.payload.purposeFingerprint !== proof.purpose.fingerprint
  )
    fail("CALIBRATION_PURPOSE_CHANGED");
}
async function modelInputs(
  ctx: Ctx,
  s: Scope,
  e: Experiment,
  snapshotId: Id<"calibrationReferences">,
  phase: "train" | "comparison",
) {
  const proof = await modelProof(ctx, s, e.specId, snapshotId, phase);
  matching(e, proof);
  if ((await hash(proof.spec)) !== e.payload.specFingerprint)
    fail("CALIBRATION_SPEC_CHANGED");
  return proof;
}
const span = (rows: { reference: { publishedAt: number } }[]) =>
  rows.length
    ? Math.max(...rows.map((r) => r.reference.publishedAt)) -
      Math.min(...rows.map((r) => r.reference.publishedAt))
    : 0;
export const fit = workspaceMutation({
  args: {
    ...scopeArgs,
    experimentId: v.id("calibrationModels"),
    snapshotId: v.id("calibrationReferences"),
    commandKey: v.string(),
  },
  returns: v.id("calibrationModels"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      e = await experiment(ctx, s, a.experimentId),
      now = Date.now();
    const proof = await modelInputs(ctx, s, e, a.snapshotId, "train"),
      fingerprint = await hash(a),
      old = await replay(ctx, s, ctx.user._id, a.commandKey, fingerprint);
    if (old) {
      if (old.kind !== "candidate") fail("CALIBRATION_REPLAY_CONFLICT");
      if (old.expiresAt <= now) fail("CALIBRATION_MODEL_EXPIRED");
      await origin(ctx, s, e, old);
      if (
        (await hash(proof.pairs.map((x) => x.reference))) !==
        (await hash(old.payload.manifest))
      )
        fail("CALIBRATION_FROZEN_TRAIN_CHANGED");
      return old._id;
    }
    if (e.payload.mode === "prospective" && now >= e.payload.holdout1Start)
      fail("CALIBRATION_FREEZE_TOO_LATE");
    if (
      await ctx.db
        .query("calibrationModels")
        .withIndex("by_experimentId_and_kind", (q) =>
          q.eq("experimentId", e._id).eq("kind", "candidate"),
        )
        .unique()
    )
      fail("CALIBRATION_CANDIDATE_EXISTS");
    const winner = chooseTransfer(proof.pairs);
    return ctx.db.insert("calibrationModels", {
      ...s,
      actorId: ctx.user._id,
      purposeId: e.purposeId,
      generation: e.generation,
      createdAt: now,
      expiresAt: Math.min(e.expiresAt, proof.horizon),
      commandKey: a.commandKey,
      requestFingerprint: fingerprint,
      specId: e.specId,
      experimentId: e._id,
      kind: "candidate",
      payload: {
        trainSnapshotId: a.snapshotId,
        trainSnapshotFingerprint: await hash(proof.snapshot),
        manifest: proof.pairs.map((x) => x.reference),
        frozenAt: now,
        transfer: winner.transfer,
        n: proof.pairs.length,
        spanMs: span(proof.pairs),
        trainLosses: winner.losses,
        baseline: winner.losses[4],
        selected: winner.selected,
        status: winner.transfer === null ? "no-comparable-pairs" : "frozen",
        activationEligible: false,
      },
    });
  },
});
async function origin(ctx: Ctx, s: Scope, e: Experiment, c: Candidate) {
  if (c.expiresAt <= Date.now()) fail("CALIBRATION_MODEL_EXPIRED");
  const row = await ctx.db.get(c.payload.trainSnapshotId);
  if (
    !row ||
    row.kind !== "snapshot" ||
    row.workspaceId !== s.workspaceId ||
    row.accountId !== s.accountId ||
    row.specId !== e.specId ||
    row.expiresAt <= Date.now() ||
    (await hash(row)) !== c.payload.trainSnapshotFingerprint
  )
    fail("CALIBRATION_ORIGINAL_TRAIN_CHANGED");
  return row;
}
async function comparisonInputs(
  ctx: Ctx,
  s: Scope,
  e: Experiment,
  c: Candidate,
  snapshotId: Id<"calibrationReferences">,
) {
  const original = await origin(ctx, s, e, c),
    proof = await modelInputs(ctx, s, e, snapshotId, "comparison");
  const train = proof.pairs
    .filter((r) => r.reference.membership === "train")
    .map((r) => r.reference);
  if ((await hash(train)) !== (await hash(c.payload.manifest)))
    fail("CALIBRATION_FROZEN_TRAIN_CHANGED");
  return {
    ...proof,
    horizon: Math.min(
      proof.horizon,
      original.expiresAt,
      c.expiresAt,
      e.expiresAt,
    ),
  };
}
function means(rows: Feature[]) {
  return {
    clarity: rows.length
      ? rows.reduce((n, r) => n + r.clarity, 0) / rows.length
      : null,
    discussion: rows.length
      ? rows.reduce((n, r) => n + r.discussion, 0) / rows.length
      : null,
    replyRate: rows.length
      ? rows.reduce((n, r) => n + r.replies / r.impressions, 0) / rows.length
      : null,
  };
}
function report(
  rows: Awaited<ReturnType<typeof modelProof>>["pairs"],
  transfer: number,
  train: ReturnType<typeof means>,
) {
  const baseline = orderingLoss(rows, 0),
    candidate = orderingLoss(rows, transfer),
    mean = means(rows);
  return {
    n: rows.length,
    spanMs: span(rows),
    baseline,
    candidate,
    improvement:
      baseline.loss === null || candidate.loss === null
        ? null
        : baseline.loss - candidate.loss,
    drift: {
      clarity:
        mean.clarity === null || train.clarity === null
          ? null
          : mean.clarity - train.clarity,
      discussion:
        mean.discussion === null || train.discussion === null
          ? null
          : mean.discussion - train.discussion,
      replyRate:
        mean.replyRate === null || train.replyRate === null
          ? null
          : mean.replyRate - train.replyRate,
    },
  };
}
export const compare = workspaceMutation({
  args: {
    ...scopeArgs,
    experimentId: v.id("calibrationModels"),
    snapshotId: v.id("calibrationReferences"),
    commandKey: v.string(),
  },
  returns: v.id("calibrationModels"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      e = await experiment(ctx, s, a.experimentId);
    const c = await ctx.db
      .query("calibrationModels")
      .withIndex("by_experimentId_and_kind", (q) =>
        q.eq("experimentId", e._id).eq("kind", "candidate"),
      )
      .unique();
    if (!c || c.kind !== "candidate") fail("CALIBRATION_CANDIDATE_REQUIRED");
    const proof = await comparisonInputs(ctx, s, e, c, a.snapshotId),
      snapshot = proof.snapshot!,
      fingerprint = await hash(a);
    const old = await replay(ctx, s, ctx.user._id, a.commandKey, fingerprint);
    if (old) {
      if (old.kind !== "evaluation" || old.expiresAt <= Date.now())
        fail("CALIBRATION_REPLAY_CONFLICT");
      return old._id;
    }
    const train = proof.pairs.filter((x) => x.reference.membership === "train"),
      block1 = proof.pairs.filter((x) => x.reference.membership === "block1"),
      block2 = proof.pairs.filter((x) => x.reference.membership === "block2");
    const avg = means(train),
      first = report(block1, c.payload.transfer ?? 0, avg),
      second = report(block2, c.payload.transfer ?? 0, avg);
    const stability =
        first.improvement === null || second.improvement === null
          ? null
          : Math.abs(first.improvement - second.improvement),
      reasons: string[] = [],
      p = e.payload.policy;
    const excludedFraction = snapshot.payload.scanned
      ? snapshot.payload.exclusions.length / snapshot.payload.scanned
      : 1;
    const engineeringScreen =
      snapshot.payload.engineeringScreen &&
      proof.pairs.length >= 30 &&
      span(proof.pairs) >= 28 * 86400000;
    if (!engineeringScreen)
      reasons.push("unvalidated-30-posts-28-days-screen-not-met");
    if (!p) reasons.push("empirical-policy-unset");
    if (e.payload.mode !== "prospective")
      reasons.push("retrospective-diagnostic");
    if (
      snapshot.payload.asOf < e.payload.holdout2End ||
      !snapshot.payload.frameComplete
    )
      reasons.push("immature-or-incomplete-frame");
    if (
      !block1.length ||
      !block2.length ||
      !first.baseline.pairs ||
      !second.baseline.pairs
    )
      reasons.push("insufficient-independent-blocks");
    if (c.payload.transfer === null)
      reasons.push("no-comparable-training-pairs");
    if (
      c.payload.transfer === 0 ||
      (first.improvement ?? 0) <= 0 ||
      (second.improvement ?? 0) <= 0
    )
      reasons.push("no-strict-benefit-each-block");
    if (
      e.payload.predeclaredAt >= e.payload.holdout1Start ||
      c.payload.frozenAt >= e.payload.holdout1Start ||
      [...block1, ...block2].some(
        (x) =>
          x.reference.publishedAt <= c.payload.frozenAt ||
          x.reference.observedAt <= e.payload.predeclaredAt ||
          x.reference.requestStartedAt <= e.payload.predeclaredAt,
      ) ||
      (p && p.reviewedAt !== e.payload.predeclaredAt)
    )
      reasons.push("prospective-chronology-unproven");
    if (p) {
      if (
        train.length < p.minTrainN ||
        span(train) < p.minTrainSpanMs ||
        first.n < p.minBlockN ||
        second.n < p.minBlockN
      )
        reasons.push("declared-independent-minimum-not-met");
      if (excludedFraction > p.maxExcludedFraction)
        reasons.push("declared-coverage-not-met");
      if (
        (first.improvement ?? -1) < p.minImprovement ||
        (second.improvement ?? -1) < p.minImprovement
      )
        reasons.push("declared-benefit-not-met");
      if (stability === null || stability > p.maxVariation)
        reasons.push("declared-stability-not-met");
      if (
        [first, second].some(
          (x) =>
            x.drift.clarity === null ||
            x.drift.discussion === null ||
            x.drift.replyRate === null ||
            Math.abs(x.drift.clarity) > p.maxClarityDrift ||
            Math.abs(x.drift.discussion) > p.maxDiscussionDrift ||
            Math.abs(x.drift.replyRate) > p.maxReplyRateDrift,
        )
      )
        reasons.push("declared-drift-not-met");
    }
    return ctx.db.insert("calibrationModels", {
      ...s,
      actorId: ctx.user._id,
      purposeId: e.purposeId,
      generation: e.generation,
      createdAt: Date.now(),
      expiresAt: proof.horizon,
      commandKey: a.commandKey,
      requestFingerprint: fingerprint,
      specId: e.specId,
      experimentId: e._id,
      kind: "evaluation",
      payload: {
        candidateId: c._id,
        candidateFingerprint: await hash(c),
        snapshotId: snapshot._id,
        snapshotFingerprint: await hash(snapshot),
        specFingerprint: e.payload.specFingerprint,
        policyFingerprint: e.payload.policyFingerprint,
        evaluatedAt: Date.now(),
        asOf: snapshot.payload.asOf,
        trainN: train.length,
        trainSpanMs: span(train),
        block1: first,
        block2: second,
        stability,
        engineeringScreen,
        engineeringScreenBasis: "unvalidated-30-posts-28-days",
        scanned: snapshot.payload.scanned,
        populationTotal: snapshot.payload.populationTotal,
        populationLowerBound: snapshot.payload.populationLowerBound,
        frameComplete: snapshot.payload.frameComplete,
        excludedFraction,
        exclusions: snapshot.payload.exclusions,
        unknownSegments: snapshot.payload.unknownSegments,
        compatibility: e.payload.compatibility,
        reasons,
        evidenceQualified: reasons.length === 0,
        activationEligible: false,
      },
    });
  },
});
async function readable(
  ctx: Ctx,
  s: Scope,
  row: Doc<"calibrationModels">,
): Promise<number> {
  if (row.kind === "monitoring-tombstone") {
    if (row.expiresAt <= Date.now()) fail("CALIBRATION_MODEL_EXPIRED");
    return row.expiresAt;
  }
  if (row.kind === "activation-decision") {
    if (row.payload.action === "rollback-static") return Infinity;
    return (await decisionProof(ctx, s, row as Activation, false)).horizon;
  }
  if (row.kind === "monitoring-declaration")
    return (await monitoringInputs(ctx, s, row)).horizon;
  if (row.kind === "monitoring-check") {
    const d = await declaration(ctx, s, row.declarationId);
    return (
      await retainedCheck(ctx, s, d, row, await monitoringInputs(ctx, s, d))
    ).horizon;
  }
  const e = await experiment(
    ctx,
    s,
    row.kind === "experiment" ? row._id : row.experimentId,
  );
  if (row.expiresAt <= Date.now()) fail("CALIBRATION_MODEL_EXPIRED");
  if (row.kind === "experiment") {
    const proof = await modelProof(ctx, s, e.specId, null, "train");
    matching(e, proof);
    if ((await hash(proof.spec)) !== e.payload.specFingerprint)
      fail("CALIBRATION_SPEC_CHANGED");
    return Math.min(e.expiresAt, proof.horizon);
  }
  const c =
    row.kind === "candidate" ? row : await ctx.db.get(row.payload.candidateId);
  if (!c || c.kind !== "candidate" || c.experimentId !== e._id)
    fail("CALIBRATION_CANDIDATE_CHANGED");
  const proof =
    row.kind === "candidate"
      ? await modelInputs(ctx, s, e, c.payload.trainSnapshotId, "train")
      : await comparisonInputs(ctx, s, e, c, row.payload.snapshotId);
  if (row.kind === "candidate") {
    await origin(ctx, s, e, c);
    if (
      (await hash(proof.pairs.map((x) => x.reference))) !==
      (await hash(c.payload.manifest))
    )
      fail("CALIBRATION_FROZEN_TRAIN_CHANGED");
  }
  if (
    row.kind === "evaluation" &&
    ((await hash(c)) !== row.payload.candidateFingerprint ||
      (await hash(proof.snapshot)) !== row.payload.snapshotFingerprint)
  )
    fail("CALIBRATION_EVALUATION_CHANGED");
  return Math.min(proof.horizon, row.expiresAt);
}
function knownUnavailable(e: unknown): e is ConvexError<string> {
  return (
    e instanceof ConvexError &&
    e.data !== "CALIBRATION_READ_CAPACITY" &&
    (String(e.data).startsWith("CALIBRATION_") ||
      String(e.data).startsWith("OWN_METRICS_") ||
      e.data === "JEV_SOURCE_CHANGED" ||
      /^(analysis|assessment|executable|fixed|future|knowledge|measured|metric|native|no-applicable|original-source|prepublication|publication|thread-media|zero-impressions)[a-z0-9-]*$/.test(
        String(e.data),
      ) ||
      [
        "ROLE_ACCESS_DENIED",
        "WORKSPACE_ACCESS_DENIED",
        "WORKSPACE_INACTIVE",
        "REFERENCE_ACCESS_DENIED",
      ].includes(String(e.data)))
  );
}
export const get = workspaceQuery({
  args: {
    ...scopeArgs,
    selectedExperimentId: v.optional(v.id("calibrationModels")),
  },
  returns: v.object({
    experiments: v.array(
      v.object({
        id: v.id("calibrationModels"),
        createdAt: v.number(),
        mode: v.union(v.literal("prospective"), v.literal("retrospective")),
      }),
    ),
    selectedId: v.union(v.id("calibrationModels"), v.null()),
    experiment: v.union(experimentDoc, v.null()),
    candidate: v.union(candidateDoc, v.null()),
    evaluation: v.union(evaluationDoc, v.null()),
    reason: v.union(v.string(), v.null()),
    proofUntil: v.union(v.number(), v.null()),
    activationEligible: v.literal(false),
  }),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(s.workspaceId, await ctx.db.get(s.accountId));
    const rows = await ctx.db
      .query("calibrationModels")
      .withIndex("by_workspaceId_and_accountId_and_kind_and_createdAt", (q) =>
        q
          .eq("workspaceId", s.workspaceId)
          .eq("accountId", s.accountId)
          .eq("kind", "experiment"),
      )
      .order("desc")
      .take(20);
    const experiments = rows.flatMap((e) =>
        e.kind === "experiment"
          ? [{ id: e._id, createdAt: e.createdAt, mode: e.payload.mode }]
          : [],
      ),
      selectedId = a.selectedExperimentId ?? experiments[0]?.id ?? null;
    const empty = {
      experiments,
      selectedId,
      experiment: null,
      candidate: null,
      evaluation: null,
      reason: null as string | null,
      proofUntil: null as number | null,
      activationEligible: false as const,
    };
    if (!selectedId) return empty;
    try {
      const e = await experiment(ctx, s, selectedId);
      const c = await ctx.db
        .query("calibrationModels")
        .withIndex("by_experimentId_and_kind", (q) =>
          q.eq("experimentId", e._id).eq("kind", "candidate"),
        )
        .unique();
      const evaluation = await ctx.db
        .query("calibrationModels")
        .withIndex("by_experimentId_and_kind", (q) =>
          q.eq("experimentId", e._id).eq("kind", "evaluation"),
        )
        .order("desc")
        .first();
      const row = evaluation ?? c ?? e,
        horizon = await readable(ctx, s, row);
      return {
        ...empty,
        experiment: e,
        candidate: c as Candidate | null,
        evaluation: evaluation as Evaluation | null,
        proofUntil: horizon,
      };
    } catch (err) {
      if (!knownUnavailable(err)) throw err;
      return { ...empty, reason: String(err.data) };
    }
  },
});
async function clearPointer(
  ctx: MutationCtx,
  s: Scope,
  purposeId: Id<"calibrationPurposes">,
  dependencyId?: Id<"calibrationModels">,
) {
  const control = await scopedControl(ctx, s);
  if (!control?.activeDecisionId) return;
  const decision = await ctx.db.get(control.activeDecisionId);
  let matches = !decision;
  if (
    decision?.kind === "activation-decision" &&
    "purposeId" in decision &&
    decision.purposeId === purposeId
  ) {
    if (!dependencyId) matches = true;
    else {
      const d = await ctx.db.get(decision.declarationId);
      matches = [
        decision._id,
        decision.declarationId,
        decision.payload.evaluationId,
        decision.payload.candidateId,
        decision.payload.checkId,
        d && "experimentId" in d ? d.experimentId : null,
      ].includes(dependencyId);
    }
  }
  if (matches)
    await ctx.db.patch(control._id, {
      activeDecisionId: null,
      revision: control.revision + 1,
      updatedAt: Date.now(),
    });
}
export const clear = internalMutation({
  args: { purposeId: v.id("calibrationPurposes") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.purposeId);
    if (p && !p.withdrawal && p.expiresAt > Date.now()) return null;
    const pins = await ctx.db
      .query("publicationKnowledge")
      .withIndex("by_projection_pin_purposeId", (q) =>
        q.eq("projection.pin.purposeId", a.purposeId),
      )
      .take(25);
    for (const k of pins) {
      await ctx.db.patch(k._id, {
        projection: fallback("unavailable", "CALIBRATION_PURPOSE_REVOKED"),
      });
      await clearPointer(ctx, k, a.purposeId);
    }
    const rows = await ctx.db
      .query("calibrationModels")
      .withIndex("by_purposeId", (q) => q.eq("purposeId", a.purposeId))
      .take(25);
    for (const row of rows) {
      await clearPointer(ctx, row, a.purposeId);
      await ctx.db.delete(row._id);
    }
    if (rows.length === 25 || pins.length === 25)
      await ctx.scheduler.runAfter(0, internal.performance.models.clear, a);
    return null;
  },
});
async function forgetModel(ctx: MutationCtx, row: Doc<"calibrationModels">) {
  if (
    row.kind !== "monitoring-declaration" &&
    row.kind !== "monitoring-check"
  ) {
    await ctx.db.delete(row._id);
    return;
  }
  const candidate = await ctx.db.get(row.candidateId),
    until = candidate?.kind === "candidate" ? candidate.expiresAt : Date.now();
  if (until <= Date.now()) {
    await ctx.db.delete(row._id);
    return;
  }
  // Keep only spent identities until the original candidate horizon; rights restoration cannot reset finality.
  await ctx.db.replace(row._id, {
    workspaceId: row.workspaceId,
    accountId: row.accountId,
    kind: "monitoring-tombstone",
    createdAt: row.createdAt,
    expiresAt: until,
    candidateId: row.candidateId,
    declarationId: row.kind === "monitoring-check" ? row.declarationId : null,
    blockNumber: row.kind === "monitoring-check" ? row.blockNumber : null,
  });
}
export const sweep = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    pins: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.pins) {
      const page = await ctx.db
        .query("publicationKnowledge")
        .withIndex("by_projection_proofUntil")
        .paginate({ cursor: a.cursor, numItems: 1 });
      for (const k of page.page) {
        if (k.projection?.state !== "candidate") continue;
        try {
          await retainedPin(ctx, k, k.projection);
        } catch (err) {
          if (!knownUnavailable(err)) throw err;
          const purposeId = k.projection.pin?.purposeId,
            decisionId = k.projection.pin?.decisionId;
          await ctx.db.patch(k._id, {
            projection: fallback("unavailable", String(err.data)),
          });
          if (purposeId) await clearPointer(ctx, k, purposeId, decisionId);
        }
      }
      if (!page.isDone)
        await ctx.scheduler.runAfter(0, internal.performance.models.sweep, {
          cursor: page.continueCursor,
          pins: true,
        });
      return null;
    }
    const page = await ctx.db
      .query("calibrationModels")
      .withIndex("by_expiresAt")
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const row of page.page) {
      try {
        await readable(ctx, row, row);
      } catch (err) {
        if (!knownUnavailable(err)) throw err;
        if ("purposeId" in row)
          await clearPointer(ctx, row, row.purposeId, row._id);
        await forgetModel(ctx, row);
      }
    }
    await ctx.scheduler.runAfter(
      0,
      internal.performance.models.sweep,
      page.isDone
        ? { cursor: null, pins: true }
        : { cursor: page.continueCursor },
    );
    return null;
  },
});

async function owner(ctx: Ctx, s: Scope, actorId: Id<"users">) {
  const user = await ctx.db.get(actorId);
  if (!user) fail("CALIBRATION_OWNER_UNAVAILABLE");
  requireRole((await requireWorkspace(ctx, s.workspaceId, user)).membership, [
    "Owner",
  ]);
}
async function scopedModel(ctx: Ctx, s: Scope, id: Id<"calibrationModels">) {
  const row = await ctx.db.get(id);
  if (
    !row ||
    row.workspaceId !== s.workspaceId ||
    row.accountId !== s.accountId
  )
    fail("CALIBRATION_MODEL_CHANGED");
  return row;
}
async function qualified(ctx: Ctx, s: Scope, id: Id<"calibrationModels">) {
  const evaluation = await scopedModel(ctx, s, id);
  if (evaluation.kind !== "evaluation" || !evaluation.payload.evidenceQualified)
    fail("CALIBRATION_QUALIFIED_EVALUATION_REQUIRED");
  const e = await experiment(ctx, s, evaluation.experimentId);
  const c = await scopedModel(ctx, s, evaluation.payload.candidateId);
  if (
    e.payload.mode !== "prospective" ||
    c.kind !== "candidate" ||
    c.experimentId !== e._id ||
    c.payload.transfer === null ||
    c.payload.transfer === 0
  )
    fail("CALIBRATION_PROSPECTIVE_CANDIDATE_REQUIRED");
  const proof = await comparisonInputs(
    ctx,
    s,
    e,
    c,
    evaluation.payload.snapshotId,
  );
  if (
    evaluation.expiresAt <= Date.now() ||
    (await hash(c)) !== evaluation.payload.candidateFingerprint ||
    (await hash(proof.snapshot)) !== evaluation.payload.snapshotFingerprint ||
    evaluation.payload.specFingerprint !== e.payload.specFingerprint ||
    evaluation.payload.policyFingerprint !== e.payload.policyFingerprint
  )
    fail("CALIBRATION_EVALUATION_CHANGED");
  return {
    e,
    c,
    evaluation,
    proof,
    horizon: Math.min(proof.horizon, evaluation.expiresAt),
  };
}
async function declaration(ctx: Ctx, s: Scope, id: Id<"calibrationModels">) {
  const row = await scopedModel(ctx, s, id);
  if (row.kind !== "monitoring-declaration")
    fail("CALIBRATION_DECLARATION_REQUIRED");
  return row;
}
function validMonitoringPolicy(
  p: Infer<typeof monitoringPolicyInput>,
  now: number,
) {
  if (
    [p.minBlockN, p.minBlockSpanMs, p.reviewUntil, p.finalValidUntil].some(
      (n) => !Number.isSafeInteger(n) || n < 0,
    ) ||
    p.minBlockN < 2 ||
    p.minBlockN > 200 ||
    p.reviewUntil <= now ||
    p.finalValidUntil <= now ||
    [
      p.maxExcludedFraction,
      p.minImprovement,
      p.maxClarityDrift,
      p.maxDiscussionDrift,
    ].some((n) => !Number.isFinite(n) || n < 0 || n > 1) ||
    !Number.isFinite(p.maxReplyRateDrift) ||
    p.maxReplyRateDrift < 0 ||
    [p.evidence, p.rationale].some((x) => !x.trim() || x.length > 2000)
  )
    fail("CALIBRATION_MONITORING_POLICY_INVALID");
}
async function monitoringInputs(ctx: Ctx, s: Scope, d: Declaration) {
  if (d.expiresAt <= Date.now()) fail("CALIBRATION_MONITORING_EXPIRED");
  const p = d.payload.policy;
  if (p.reviewUntil <= Date.now()) fail("CALIBRATION_POLICY_EXPIRED");
  await owner(ctx, s, p.reviewerId);
  if (
    p.reviewerId !== d.actorId ||
    p.reviewedAt !== d.createdAt ||
    (await hash(p)) !== d.payload.policyFingerprint
  )
    fail("CALIBRATION_POLICY_CHANGED");
  const original = await qualified(ctx, s, d.payload.evaluationId),
    monitor = await modelProof(ctx, s, d.specId, null, "train");
  if (
    d.experimentId !== original.e._id ||
    d.candidateId !== original.c._id ||
    (await hash(original.c)) !== d.payload.candidateFingerprint ||
    (await hash(original.evaluation)) !== d.payload.evaluationFingerprint ||
    (await hash(monitor.spec)) !== d.payload.specFingerprint ||
    d.purposeId !== monitor.purpose._id ||
    d.purposeId !== original.e.purposeId ||
    d.generation !== monitor.purpose.generation ||
    d.generation !== original.e.generation ||
    d.payload.purposeFingerprint !== monitor.purpose.fingerprint ||
    (await hash(monitor.spec.payload.compatibility)) !==
      (await hash(original.e.payload.compatibility)) ||
    (await hash(d.payload.compatibility)) !==
      (await hash(original.e.payload.compatibility))
  )
    fail("CALIBRATION_MONITORING_CHANGED");
  return {
    ...original,
    monitor,
    horizon: Math.min(
      original.horizon,
      monitor.horizon,
      d.expiresAt,
      p.reviewUntil,
    ),
  };
}
export const declareMonitoring = workspaceMutation({
  args: {
    ...scopeArgs,
    candidateId: v.id("calibrationModels"),
    evaluationId: v.id("calibrationModels"),
    monitoringSpecId: v.id("calibrationReferences"),
    policy: monitoringPolicyInput,
    commandKey: v.string(),
  },
  returns: v.id("calibrationModels"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      now = Date.now();
    validMonitoringPolicy(a.policy, now);
    const original = await qualified(ctx, s, a.evaluationId),
      proof = await modelProof(ctx, s, a.monitoringSpecId, null, "train"),
      b = proof.spec.payload;
    if (
      a.candidateId !== original.c._id ||
      a.monitoringSpecId === original.e.specId ||
      proof.purpose._id !== original.e.purposeId ||
      proof.purpose.generation !== original.e.generation ||
      (await hash(b.compatibility)) !==
        (await hash(original.e.payload.compatibility))
    )
      fail("CALIBRATION_MONITORING_SCOPE_CHANGED");
    const fingerprint = await hash(a),
      old = await replay(ctx, s, ctx.user._id, a.commandKey, fingerprint);
    if (old) {
      if (old.kind !== "monitoring-declaration")
        fail("CALIBRATION_REPLAY_CONFLICT");
      await monitoringInputs(ctx, s, old);
      return old._id;
    }
    if (
      b.mode !== "prospective" ||
      now >= b.holdout1Start ||
      proof.spec.createdAt >= b.holdout1Start ||
      b.holdout1End >= a.policy.finalValidUntil ||
      a.policy.finalValidUntil > b.holdout2Start ||
      a.policy.finalValidUntil >
        Math.min(original.horizon, proof.horizon, a.policy.reviewUntil) ||
      a.policy.minBlockSpanMs > b.holdout1End - b.holdout1Start
    )
      fail("CALIBRATION_MONITORING_INTERVAL_INVALID");
    if (
      (await ctx.db
        .query("calibrationModels")
        .withIndex("by_candidateId_and_kind", (q) =>
          q
            .eq("candidateId", a.candidateId)
            .eq("kind", "monitoring-declaration"),
        )
        .first()) ||
      (await ctx.db
        .query("calibrationModels")
        .withIndex("by_candidateId_and_kind", (q) =>
          q.eq("candidateId", a.candidateId).eq("kind", "monitoring-tombstone"),
        )
        .first())
    )
      fail("CALIBRATION_DECLARATION_EXISTS");
    const policy = { ...a.policy, reviewerId: ctx.user._id, reviewedAt: now };
    return ctx.db.insert("calibrationModels", {
      ...s,
      actorId: ctx.user._id,
      purposeId: proof.purpose._id,
      generation: proof.purpose.generation,
      createdAt: now,
      expiresAt: Math.min(original.horizon, proof.horizon, policy.reviewUntil),
      commandKey: a.commandKey,
      requestFingerprint: fingerprint,
      specId: a.monitoringSpecId,
      experimentId: original.e._id,
      candidateId: a.candidateId,
      declarationId: null,
      kind: "monitoring-declaration",
      payload: {
        version: "one-finite-checkpoint-v1",
        candidateFingerprint: await hash(original.c),
        evaluationId: a.evaluationId,
        evaluationFingerprint: await hash(original.evaluation),
        specFingerprint: await hash(proof.spec),
        purposeFingerprint: proof.purpose.fingerprint,
        compatibility: b.compatibility,
        policy,
        policyFingerprint: await hash(policy),
        firstEnd: b.holdout1End,
        unusedSecondStart: b.holdout2Start,
      },
    });
  },
});
async function monitorSnapshot(
  ctx: Ctx,
  s: Scope,
  d: Declaration,
  snapshotId: Id<"calibrationReferences">,
  original: Awaited<ReturnType<typeof monitoringInputs>>,
) {
  const monitor = await modelProof(ctx, s, d.specId, snapshotId, "comparison");
  if (
    (await hash(monitor.spec)) !== d.payload.specFingerprint ||
    monitor.purpose._id !== d.purposeId ||
    monitor.purpose.generation !== d.generation
  )
    fail("CALIBRATION_MONITORING_CHANGED");
  if (
    !monitor.snapshot ||
    monitor.snapshot.payload.asOf > d.payload.unusedSecondStart ||
    monitor.pairs.some((x) => x.reference.membership === "block2")
  )
    fail("CALIBRATION_MONITORING_FRAME_INVALID");
  return { ...monitor, horizon: Math.min(monitor.horizon, original.horizon) };
}
export const checkMonitoring = workspaceMutation({
  args: {
    ...scopeArgs,
    declarationId: v.id("calibrationModels"),
    snapshotId: v.id("calibrationReferences"),
    block: v.literal(1),
    commandKey: v.string(),
  },
  returns: v.id("calibrationModels"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      d = await declaration(ctx, s, a.declarationId),
      now = Date.now(),
      end = d.payload.firstEnd;
    if (now < end) fail("CALIBRATION_MONITORING_NOT_MATURE");
    const original = await monitoringInputs(ctx, s, d),
      proof = await monitorSnapshot(ctx, s, d, a.snapshotId, original),
      snapshot = proof.snapshot!;
    if (snapshot.payload.asOf < end) fail("CALIBRATION_MONITORING_NOT_MATURE");
    const fingerprint = await hash(a),
      old = await replay(ctx, s, ctx.user._id, a.commandKey, fingerprint);
    if (old) {
      if (old.kind !== "monitoring-check") fail("CALIBRATION_REPLAY_CONFLICT");
      await retainedCheck(ctx, s, d, old, original);
      return old._id;
    }
    if (
      await ctx.db
        .query("calibrationModels")
        .withIndex("by_declarationId_and_blockNumber", (q) =>
          q.eq("declarationId", d._id).eq("blockNumber", a.block),
        )
        .unique()
    )
      fail("CALIBRATION_MONITORING_CHECK_FINAL");
    const rows = proof.pairs.filter((x) => x.reference.membership === "block1"),
      train = original.proof.pairs.filter(
        (x) => x.reference.membership === "train",
      ),
      result = report(rows, original.c.payload.transfer!, means(train)),
      p = d.payload.policy,
      excludedFraction = snapshot.payload.scanned
        ? snapshot.payload.exclusions.length / snapshot.payload.scanned
        : 1,
      reasons: string[] = [];
    let unknown = false;
    if (
      result.n < p.minBlockN ||
      result.spanMs < p.minBlockSpanMs ||
      result.improvement === null ||
      !result.baseline.pairs ||
      !result.candidate.pairs
    ) {
      reasons.push("insufficient-independent-monitoring-block");
      unknown = true;
    }
    if (excludedFraction > p.maxExcludedFraction)
      reasons.push("declared-whole-frame-coverage-not-met");
    if (
      result.improvement !== null &&
      (result.improvement <= 0 || result.improvement < p.minImprovement)
    )
      reasons.push("declared-monitoring-benefit-not-met");
    if (
      result.drift.clarity === null ||
      result.drift.discussion === null ||
      result.drift.replyRate === null
    ) {
      if (!unknown) reasons.push("monitoring-drift-unavailable");
      unknown = true;
    } else if (
      Math.abs(result.drift.clarity) > p.maxClarityDrift ||
      Math.abs(result.drift.discussion) > p.maxDiscussionDrift ||
      Math.abs(result.drift.replyRate) > p.maxReplyRateDrift
    )
      reasons.push("declared-monitoring-drift-not-met");
    if (
      rows.some(
        (x) =>
          x.reference.publishedAt <= d.createdAt ||
          x.reference.requestStartedAt <= d.createdAt ||
          x.reference.observedAt <= d.createdAt ||
          x.reference.requestStartedAt <= proof.spec.createdAt,
      )
    )
      reasons.push("monitoring-prospective-chronology-unproven");
    return ctx.db.insert("calibrationModels", {
      ...s,
      actorId: ctx.user._id,
      purposeId: d.purposeId,
      generation: d.generation,
      createdAt: now,
      expiresAt: proof.horizon,
      commandKey: a.commandKey,
      requestFingerprint: fingerprint,
      specId: d.specId,
      experimentId: d.experimentId,
      candidateId: d.candidateId,
      declarationId: d._id,
      blockNumber: a.block,
      kind: "monitoring-check",
      payload: {
        declarationFingerprint: await hash(d),
        snapshotId: a.snapshotId,
        snapshotFingerprint: await hash(snapshot),
        computedAt: now,
        asOf: snapshot.payload.asOf,
        block: result,
        excludedFraction,
        coverageBasis: "whole-declared-frame",
        status: reasons.length ? (unknown ? "unknown" : "fail") : "pass",
        reasons,
      },
    });
  },
});
async function finalCheck(
  ctx: Ctx,
  declarationId: Id<"calibrationModels">,
  block: 1,
) {
  const row = await ctx.db
    .query("calibrationModels")
    .withIndex("by_declarationId_and_blockNumber", (q) =>
      q.eq("declarationId", declarationId).eq("blockNumber", block),
    )
    .unique();
  return row?.kind === "monitoring-check" ? row : null;
}
async function retainedCheck(
  ctx: Ctx,
  s: Scope,
  d: Declaration,
  check: Check,
  original: Awaited<ReturnType<typeof monitoringInputs>>,
) {
  if (
    check.declarationId !== d._id ||
    check.specId !== d.specId ||
    check.purposeId !== d.purposeId ||
    check.generation !== d.generation ||
    check.expiresAt <= Date.now() ||
    check.payload.declarationFingerprint !== (await hash(d))
  )
    fail("CALIBRATION_MONITORING_CHECK_CHANGED");
  await admin(ctx, s.workspaceId, check.actorId);
  const proof = await monitorSnapshot(
      ctx,
      s,
      d,
      check.payload.snapshotId,
      original,
    ),
    end = d.payload.firstEnd;
  if (
    check.payload.snapshotFingerprint !== (await hash(proof.snapshot)) ||
    check.payload.asOf < end ||
    check.payload.computedAt < end ||
    check.payload.asOf !== proof.snapshot!.payload.asOf
  )
    fail("CALIBRATION_MONITORING_CHECK_CHANGED");
  return { ...proof, horizon: Math.min(proof.horizon, check.expiresAt) };
}
async function gate(
  ctx: Ctx,
  s: Scope,
  d: Declaration,
  enforceOperating: boolean,
  originalProof?: Awaited<ReturnType<typeof monitoringInputs>>,
) {
  const original = originalProof ?? (await monitoringInputs(ctx, s, d)),
    now = Date.now();
  if (enforceOperating && now < d.payload.firstEnd)
    fail("CALIBRATION_MONITORING_FIRST_BLOCK_NOT_MATURE");
  if (enforceOperating && now >= d.payload.policy.finalValidUntil)
    fail("CALIBRATION_OPERATING_EXPIRED");
  // ponytail: one measured checkpoint, finite approval; ongoing drift coverage needs new prospective evidence.
  const check = await finalCheck(ctx, d._id, 1);
  if (!check) fail("CALIBRATION_MONITORING_PASS_REQUIRED");
  const horizon = Math.min(
    original.horizon,
    (await retainedCheck(ctx, s, d, check, original)).horizon,
  );
  if (check.payload.status !== "pass")
    fail(
      "CALIBRATION_MONITORING_TERMINAL_" + check.payload.status.toUpperCase(),
    );
  return {
    ...original,
    check,
    horizon,
    operatingUntil: Math.min(horizon, d.payload.policy.finalValidUntil),
  };
}
async function scopedControl(ctx: Ctx, s: Scope) {
  return ctx.db
    .query("calibrationControls")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", s.workspaceId).eq("accountId", s.accountId),
    )
    .unique();
}
function revision(value: number) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  )
    fail("CALIBRATION_REVISION_INVALID");
}
export const activate = workspaceMutation({
  args: {
    ...scopeArgs,
    evaluationId: v.id("calibrationModels"),
    declarationId: v.id("calibrationModels"),
    checkId: v.id("calibrationModels"),
    expectedRevision: v.number(),
    commandKey: v.string(),
  },
  returns: v.id("calibrationModels"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      fingerprint = await hash(a);
    requireReference(s.workspaceId, await ctx.db.get(s.accountId));
    revision(a.expectedRevision);
    const old = await replay(ctx, s, ctx.user._id, a.commandKey, fingerprint);
    if (old) {
      if (
        old.kind !== "activation-decision" ||
        old.payload.action !== "activate"
      )
        fail("CALIBRATION_REPLAY_CONFLICT");
      return old._id; // Receipt replay never re-applies the pointer.
    }
    const d = await declaration(ctx, s, a.declarationId),
      x = await gate(ctx, s, d, true);
    if (a.evaluationId !== d.payload.evaluationId || a.checkId !== x.check._id)
      fail("CALIBRATION_ACTIVATION_PROOF_CHANGED");
    const control = await scopedControl(ctx, s);
    if ((control?.revision ?? 0) !== a.expectedRevision)
      fail("CALIBRATION_REVISION_CONFLICT");
    const id = await ctx.db.insert("calibrationModels", {
      ...s,
      actorId: ctx.user._id,
      purposeId: d.purposeId,
      generation: d.generation,
      createdAt: Date.now(),
      expiresAt: x.horizon,
      commandKey: a.commandKey,
      requestFingerprint: fingerprint,
      specId: d.specId,
      experimentId: d.experimentId,
      declarationId: d._id,
      kind: "activation-decision",
      payload: {
        action: "activate",
        evaluationId: a.evaluationId,
        candidateId: d.candidateId,
        declarationFingerprint: await hash(d),
        checkId: a.checkId,
        checkFingerprint: await hash(x.check),
        expectedRevision: a.expectedRevision,
        resultingRevision: a.expectedRevision + 1,
      },
    });
    const state = {
      ...s,
      revision: a.expectedRevision + 1,
      activeDecisionId: id,
      actorId: ctx.user._id,
      updatedAt: Date.now(),
    };
    if (control) await ctx.db.replace(control._id, state);
    else await ctx.db.insert("calibrationControls", state);
    return id;
  },
});
export const rollback = workspaceMutation({
  args: { ...scopeArgs, expectedRevision: v.number(), commandKey: v.string() },
  returns: v.id("calibrationModels"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      fingerprint = await hash(a);
    requireReference(s.workspaceId, await ctx.db.get(s.accountId));
    revision(a.expectedRevision);
    const old = await replay(ctx, s, ctx.user._id, a.commandKey, fingerprint);
    if (old) {
      if (
        old.kind !== "activation-decision" ||
        old.payload.action !== "rollback-static"
      )
        fail("CALIBRATION_REPLAY_CONFLICT");
      return old._id;
    }
    const control = await scopedControl(ctx, s);
    if ((control?.revision ?? 0) !== a.expectedRevision)
      fail("CALIBRATION_REVISION_CONFLICT");
    const id = await ctx.db.insert("calibrationModels", {
      ...s,
      actorId: ctx.user._id,
      createdAt: Date.now(),
      commandKey: a.commandKey,
      requestFingerprint: fingerprint,
      kind: "activation-decision",
      payload: {
        action: "rollback-static",
        expectedRevision: a.expectedRevision,
        resultingRevision: a.expectedRevision + 1,
        formulaVersion: "dispatch-score-v1",
        thresholdVersion: "jev-confidence-startup-v1",
      },
    });
    const state = {
      ...s,
      revision: a.expectedRevision + 1,
      activeDecisionId: null,
      actorId: ctx.user._id,
      updatedAt: Date.now(),
    };
    if (control) await ctx.db.replace(control._id, state);
    else await ctx.db.insert("calibrationControls", state);
    return id;
  },
});
async function decisionProof(
  ctx: Ctx,
  s: Scope,
  decision: Activation,
  operating: boolean,
  gateProof?: Awaited<ReturnType<typeof gate>>,
) {
  if (
    decision.payload.action !== "activate" ||
    decision.expiresAt <= Date.now()
  )
    fail("CALIBRATION_ACTIVATION_EXPIRED");
  await owner(ctx, s, decision.actorId);
  const d = await declaration(ctx, s, decision.declarationId),
    x = gateProof ?? (await gate(ctx, s, d, operating)),
    approved = await scopedModel(ctx, s, decision.payload.checkId);
  if (
    decision.purposeId !== d.purposeId ||
    decision.generation !== d.generation ||
    decision.payload.evaluationId !== d.payload.evaluationId ||
    decision.payload.candidateId !== d.candidateId ||
    decision.payload.declarationFingerprint !== (await hash(d)) ||
    approved.kind !== "monitoring-check" ||
    approved.declarationId !== d._id ||
    approved.payload.status !== "pass" ||
    decision.payload.checkFingerprint !== (await hash(approved))
  )
    fail("CALIBRATION_ACTIVATION_CHANGED");
  return { ...x, d, horizon: Math.min(x.horizon, decision.expiresAt) };
}
function fallback(
  state: Projection["state"],
  reason: string | null,
  score: number | null = null,
): Projection {
  return {
    version: "prospective-calibration-v1",
    state,
    reason,
    score,
    formulaVersion: "dispatch-score-v1",
    thresholdVersion: "jev-confidence-startup-v1",
    proofUntil: null,
    operatingUntil: null,
    pin: null,
  };
}
export const control = workspaceQuery({
  args: {
    ...scopeArgs,
    selectedDeclarationId: v.optional(v.id("calibrationModels")),
  },
  returns: v.object({
    revision: v.number(),
    activeDecisionId: v.union(v.id("calibrationModels"), v.null()),
    declarations: v.array(
      v.object({
        id: v.id("calibrationModels"),
        createdAt: v.number(),
        firstEnd: v.number(),
        unusedSecondStart: v.number(),
        finalValidUntil: v.number(),
      }),
    ),
    declaration: v.union(declarationDoc, v.null()),
    check: v.union(checkDoc, v.null()),
    checkFinal: v.boolean(),
    state: v.union(v.literal("candidate"), v.literal("static")),
    reason: v.union(v.string(), v.null()),
    proofUntil: v.union(v.number(), v.null()),
    operatingUntil: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(s.workspaceId, await ctx.db.get(s.accountId));
    const control = await scopedControl(ctx, s),
      rows = await ctx.db
        .query("calibrationModels")
        .withIndex("by_workspaceId_and_accountId_and_kind_and_createdAt", (q) =>
          q
            .eq("workspaceId", s.workspaceId)
            .eq("accountId", s.accountId)
            .eq("kind", "monitoring-declaration"),
        )
        .order("desc")
        .take(20),
      declarations = rows.flatMap((d) =>
        d.kind === "monitoring-declaration"
          ? [
              {
                id: d._id,
                createdAt: d.createdAt,
                firstEnd: d.payload.firstEnd,
                unusedSecondStart: d.payload.unusedSecondStart,
                finalValidUntil: d.payload.policy.finalValidUntil,
              },
            ]
          : [],
      );
    const empty = {
      revision: control?.revision ?? 0,
      activeDecisionId: control?.activeDecisionId ?? null,
      declarations,
      declaration: null as Declaration | null,
      check: null as Check | null,
      checkFinal: false,
      state: "static" as "candidate" | "static",
      reason: "CALIBRATION_MONITORING_POLICY_UNSET" as string | null,
      proofUntil: null as number | null,
      operatingUntil: null as number | null,
    };
    try {
      const decision = control?.activeDecisionId
          ? await scopedModel(ctx, s, control.activeDecisionId)
          : null,
        selected =
          a.selectedDeclarationId ??
          (decision?.kind === "activation-decision" &&
          "declarationId" in decision
            ? decision.declarationId
            : declarations[0]?.id);
      if (!selected) return empty;
      const d = await declaration(ctx, s, selected),
        x = await monitoringInputs(ctx, s, d),
        recordedCheck = await ctx.db
          .query("calibrationModels")
          .withIndex("by_declarationId_and_blockNumber", (q) =>
            q.eq("declarationId", d._id).eq("blockNumber", 1),
          )
          .unique(),
        check =
          recordedCheck?.kind === "monitoring-check" ? recordedCheck : null;
      const base = {
        ...empty,
        declaration: d,
        check,
        checkFinal: !!recordedCheck,
        proofUntil: x.horizon,
        reason: "CALIBRATION_OWNER_ACTIVATION_REQUIRED",
      };
      try {
        const ready = await gate(ctx, s, d, true, x);
        if (
          decision?.kind === "activation-decision" &&
          "expiresAt" in decision &&
          decision.declarationId === d._id
        ) {
          const active = await decisionProof(ctx, s, decision, true, ready);
          return {
            ...base,
            state: "candidate" as const,
            reason: null,
            proofUntil: active.horizon,
            operatingUntil: active.operatingUntil,
          };
        }
        return { ...base, operatingUntil: ready.operatingUntil };
      } catch (err) {
        if (!knownUnavailable(err)) throw err;
        const reason = String(err.data);
        return {
          ...base,
          check: reason.startsWith("CALIBRATION_MONITORING_TERMINAL_")
            ? check
            : null,
          reason,
        };
      }
    } catch (err) {
      if (!knownUnavailable(err)) throw err;
      return { ...empty, reason: String(err.data) };
    }
  },
});

async function target(
  ctx: Ctx,
  s: Scope,
  actorId: Id<"users">,
  assessmentId: Id<"jevAssessments">,
) {
  const a = await ctx.db.get(assessmentId);
  if (!a || a.workspaceId !== s.workspaceId || a.accountId !== s.accountId)
    fail("CALIBRATION_TARGET_CHANGED");
  const src = await source(ctx, s.workspaceId, a),
    x = await current(
      ctx,
      await request(
        ctx,
        s.workspaceId,
        actorId,
        a,
        "prospective-calibration-v1",
      ),
    ),
    receipt = await ctx.db.get(a.attemptId),
    algorithm = await ctx.db.get(a.algorithmId),
    audience = await ctx.db.get(a.audienceId),
    score = a.result.score,
    clarity = a.result.answers?.clarity,
    discussion = a.result.answers?.discussionPotential;
  if (
    src.ver.content.text.length !== 1 ||
    src.ver.content.media.length ||
    a.result.deterministic.segments.length !== 1 ||
    a.result.deterministic.media.count ||
    a.semanticKey !== x.semanticKey ||
    !algorithm ||
    !audience ||
    receipt?.owner !== "jev-analyzer" ||
    receipt.state !== "settled" ||
    receipt.settledAt === null ||
    receipt.workspaceId !== s.workspaceId ||
    receipt.accountId !== s.accountId ||
    receipt.draftId !== a.draftId ||
    receipt.draftVersionId !== a.draftVersionId ||
    receipt.algorithmId !== a.algorithmId ||
    receipt.audienceId !== a.audienceId ||
    receipt.policyId !== a.provenance.policyId ||
    receipt.policyId !== x.p._id ||
    receipt.policyVersion !== a.provenance.policyVersion ||
    receipt.policyVersion !== x.p.version ||
    receipt.policyFingerprint !== (await sha256(JSON.stringify(x.p))) ||
    receipt.model !== a.provenance.requestedModel ||
    receipt.model !== x.p.model ||
    receipt.resolvedModel !== a.provenance.resolvedModel ||
    !receipt.resolvedModel ||
    receipt.questionVersion !== a.result.questionVersion ||
    receipt.questionVersion !== x.questionVersion ||
    receipt.normalizationVersion !== a.result.normalizationVersion ||
    receipt.selectionRevision !== a.provenance.selectionRevision ||
    receipt.sentAt !== a.provenance.sentAt ||
    receipt.settledAt !== a.provenance.settledAt ||
    receipt.sentAt > receipt.settledAt ||
    receipt.settledAt > a.createdAt ||
    a.createdAt > Date.now() ||
    receipt.outcome !== a.result.outcome ||
    !score ||
    score.aggregate === null ||
    !Number.isFinite(score.aggregate) ||
    score.missing.length ||
    score.lowConfidence.length ||
    clarity?.type !== "score" ||
    discussion?.type !== "score" ||
    [clarity.value, discussion.value].some(
      (n) => !Number.isFinite(n) || n < 0 || n > 1,
    ) ||
    (await hash(score)) !==
      (await hash(
        dispatchScore(a.result.answers, a.result.deterministic.structure),
      ))
  )
    fail("CALIBRATION_TARGET_UNSUPPORTED");
  const identity = {
    algorithmId: a.algorithmId,
    algorithmFingerprint: await sha256(JSON.stringify(algorithm.payload)),
    audienceId: a.audienceId,
    audienceFingerprint: await sha256(JSON.stringify(audience.payload)),
    jevPolicyId: x.p._id,
    jevPolicyVersion: x.p.version,
    jevPolicyFingerprint: receipt.policyFingerprint,
    requestedModel: receipt.model,
    resolvedModel: receipt.resolvedModel,
    questionVersion: a.result.questionVersion,
    questionFingerprint: await sha256(JSON.stringify(POST_ANALYSIS)),
    inputVersion: a.inputVersion,
    normalizationVersion: a.result.normalizationVersion,
    formulaVersion: score.formulaVersion,
    thresholdVersion: score.thresholdVersion,
    formulaFingerprint: await sha256(
      JSON.stringify({
        weights: score.weights,
        history: score.history,
        threshold: score.minimumConfidence,
        basis: score.thresholdBasis,
        structure: a.result.deterministic.version,
      }),
    ),
  };
  return {
    a,
    identity,
    score: score.aggregate,
    clarity: clarity.value,
    discussion: discussion.value,
    horizon: Math.min(
      src.sourceUntil ?? Infinity,
      x.p.expiresAt,
      algorithm.payload.reviewDueAt,
    ),
  };
}
export const projection = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    ...scopeArgs,
    actorId: v.id("users"),
    assessmentId: v.id("jevAssessments"),
  },
  returns: projectionValidator,
  handler: async (ctx, a): Promise<Projection> => {
    let t: Awaited<ReturnType<typeof target>>;
    try {
      t = await target(ctx, a, a.actorId, a.assessmentId);
    } catch (err) {
      if (
        !knownUnavailable(err) &&
        !(err instanceof ConvexError && String(err.data).startsWith("JEV_"))
      )
        throw err;
      return fallback("unavailable", String((err as ConvexError<string>).data));
    }
    const staticResult = {
      ...fallback("static", "CALIBRATION_OWNER_ACTIVATION_REQUIRED", t.score),
      proofUntil: t.horizon,
    };
    try {
      const c = await scopedControl(ctx, a);
      if (!c?.activeDecisionId) return staticResult;
      const decision = await scopedModel(ctx, a, c.activeDecisionId);
      if (decision.kind !== "activation-decision" || !("expiresAt" in decision))
        fail("CALIBRATION_ACTIVATION_CHANGED");
      const x = await decisionProof(ctx, a, decision, true);
      if (
        Object.entries(t.identity).some(
          ([key, value]) =>
            x.d.payload.compatibility[
              key as keyof typeof x.d.payload.compatibility
            ] !== value,
        )
      )
        fail("CALIBRATION_TARGET_STRATUM_CHANGED");
      const score =
          t.score + 100 * x.c.payload.transfer! * (t.discussion - t.clarity),
        horizon = Math.min(t.horizon, x.horizon);
      if (!Number.isFinite(score) || horizon <= Date.now())
        fail("CALIBRATION_TARGET_EXPIRED");
      return {
        ...staticResult,
        state: "candidate",
        reason: null,
        score,
        proofUntil: horizon,
        operatingUntil: Math.min(horizon, x.operatingUntil),
        pin: {
          assessmentId: t.a._id,
          assessmentFingerprint: await hash(t.a),
          semanticKey: t.a.semanticKey,
          purposeId: x.d.purposeId,
          generation: x.d.generation,
          decisionId: decision._id,
          decisionFingerprint: await hash(decision),
          candidateId: x.c._id,
          evaluationId: x.evaluation._id,
          declarationId: x.d._id,
          declarationFingerprint: await hash(x.d),
          checkId: x.check._id,
          checkFingerprint: await hash(x.check),
          capturedAt: Date.now(),
        },
      };
    } catch (err) {
      if (!knownUnavailable(err)) throw err;
      return { ...staticResult, reason: String(err.data) };
    }
  },
});
async function retainedPin(ctx: Ctx, s: Scope, p: Projection) {
  const pin = p.pin;
  if (
    !pin ||
    p.state !== "candidate" ||
    p.score === null ||
    !Number.isFinite(p.score) ||
    p.proofUntil === null ||
    p.proofUntil <= Date.now()
  )
    fail("CALIBRATION_PIN_EXPIRED");
  const assessment = await ctx.db.get(pin.assessmentId);
  if (
    !assessment ||
    assessment.workspaceId !== s.workspaceId ||
    assessment.accountId !== s.accountId ||
    assessment.semanticKey !== pin.semanticKey ||
    (await hash(assessment)) !== pin.assessmentFingerprint
  )
    fail("CALIBRATION_PIN_CHANGED");
  await source(ctx, s.workspaceId, assessment);
  const d = await declaration(ctx, s, pin.declarationId),
    original = await monitoringInputs(ctx, s, d),
    decision = await scopedModel(ctx, s, pin.decisionId),
    check = await scopedModel(ctx, s, pin.checkId);
  if (
    d.purposeId !== pin.purposeId ||
    d.generation !== pin.generation ||
    d.candidateId !== pin.candidateId ||
    d.payload.evaluationId !== pin.evaluationId ||
    pin.declarationFingerprint !== (await hash(d)) ||
    pin.decisionFingerprint !== (await hash(decision)) ||
    decision.kind !== "activation-decision" ||
    decision.payload.action !== "activate" ||
    !("expiresAt" in decision) ||
    decision.expiresAt <= Date.now() ||
    decision.declarationId !== d._id ||
    decision.payload.candidateId !== pin.candidateId ||
    decision.payload.evaluationId !== pin.evaluationId ||
    check.kind !== "monitoring-check" ||
    check.declarationId !== d._id ||
    check.payload.status !== "pass" ||
    pin.checkFingerprint !== (await hash(check))
  )
    fail("CALIBRATION_PIN_CHANGED");
  await owner(ctx, s, decision.actorId);
  const proof = await retainedCheck(ctx, s, d, check, original);
  return Math.min(p.proofUntil, proof.horizon, decision.expiresAt);
}
export const publicationProjection = workspaceQuery({
  args: { ...scopeArgs, postAttemptId: v.id("xPostAttempts") },
  returns: projectionValidator,
  handler: async (ctx, a): Promise<Projection> => {
    const s = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(s.workspaceId, await ctx.db.get(s.accountId));
    const k = await ctx.db
      .query("publicationKnowledge")
      .withIndex("by_postAttemptId", (q) =>
        q.eq("postAttemptId", a.postAttemptId),
      )
      .unique();
    if (!k || k.workspaceId !== s.workspaceId || k.accountId !== s.accountId)
      return fallback("unavailable", "CALIBRATION_PUBLICATION_PIN_MISSING");
    if (!k.projection)
      return fallback("unavailable", "CALIBRATION_LEGACY_PIN_MISSING");
    const p = k.projection;
    try {
      if (p.state === "candidate")
        return { ...p, proofUntil: await retainedPin(ctx, s, p) };
      if (!k.assessmentId) return fallback("unavailable", p.reason);
      const assessment = await ctx.db.get(k.assessmentId);
      if (
        !assessment ||
        assessment.workspaceId !== s.workspaceId ||
        assessment.accountId !== s.accountId ||
        assessment.draftVersionId !== k.versionId
      )
        fail("CALIBRATION_PIN_CHANGED");
      await source(ctx, s.workspaceId, assessment);
      return {
        ...p,
        score:
          p.state === "static"
            ? (assessment.result.score?.aggregate ?? null)
            : null,
      };
    } catch (err) {
      if (!knownUnavailable(err)) throw err;
      return fallback("unavailable", String(err.data));
    }
  },
});
