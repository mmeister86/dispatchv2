import { ConvexError, v, type Infer } from "convex/values";
import {
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceMutation,
  workspaceQuery,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { admin } from "./capabilities";
import { modelProof } from "./calibration";
import { TRANSFERS, TARGET } from "./calibrationFields";
import {
  policyInput,
  experimentDoc,
  candidateDoc,
  evaluationDoc,
} from "./modelFields";
import { sha256 } from "../lib/crypto";
import type { Doc, Id } from "../_generated/dataModel";
type Ctx = QueryCtx | MutationCtx;
type Scope = { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> };
type Experiment = Extract<Doc<"calibrationModels">, { kind: "experiment" }>;
type Candidate = Extract<Doc<"calibrationModels">, { kind: "candidate" }>;
type Evaluation = Extract<Doc<"calibrationModels">, { kind: "evaluation" }>;
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
    (row.accountId !== s.accountId || row.requestFingerprint !== fingerprint)
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
async function readable(ctx: Ctx, s: Scope, row: Doc<"calibrationModels">) {
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
export const clear = internalMutation({
  args: { purposeId: v.id("calibrationPurposes") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.purposeId);
    if (p && !p.withdrawal && p.expiresAt > Date.now()) return null;
    const rows = await ctx.db
      .query("calibrationModels")
      .withIndex("by_purposeId", (q) => q.eq("purposeId", a.purposeId))
      .take(25);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 25)
      await ctx.scheduler.runAfter(0, internal.performance.models.clear, a);
    return null;
  },
});
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("calibrationModels")
      .withIndex("by_expiresAt")
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const row of page.page)
      try {
        await readable(ctx, row, row);
      } catch (e) {
        if (knownUnavailable(e)) await ctx.db.delete(row._id);
        else throw e;
      }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.performance.models.sweep, {
        cursor: page.continueCursor,
      });
    return null;
  },
});
