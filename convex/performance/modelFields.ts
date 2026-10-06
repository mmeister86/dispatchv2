import { v } from "convex/values";
import { bounds, compatibility, ref, TARGET } from "./calibrationFields";
export const policyInput = v.object({
  minTrainN: v.number(),
  minTrainSpanMs: v.number(),
  minBlockN: v.number(),
  maxExcludedFraction: v.number(),
  minImprovement: v.number(),
  maxVariation: v.number(),
  maxClarityDrift: v.number(),
  maxDiscussionDrift: v.number(),
  maxReplyRateDrift: v.number(),
  reviewUntil: v.number(),
  evidence: v.string(),
  rationale: v.string(),
});
export const policy = v.object({
  ...policyInput.fields,
  reviewerId: v.id("users"),
  reviewedAt: v.number(),
});
const common = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  actorId: v.id("users"),
  purposeId: v.id("calibrationPurposes"),
  generation: v.number(),
  createdAt: v.number(),
  expiresAt: v.number(),
  commandKey: v.string(),
  requestFingerprint: v.string(),
  specId: v.id("calibrationReferences"),
  experimentId: v.union(v.id("calibrationModels"), v.null()),
};
export const experimentFields = {
  ...common,
  kind: v.literal("experiment"),
  experimentId: v.null(),
  payload: v.object({
    ...bounds,
    mode: v.union(v.literal("prospective"), v.literal("retrospective")),
    target: v.literal(TARGET),
    transfers: v.array(v.number()),
    lossVersion: v.literal("twice-discordance-v1"),
    specFingerprint: v.string(),
    purposeFingerprint: v.string(),
    compatibility,
    predeclaredAt: v.number(),
    policy: v.union(policy, v.null()),
    policyFingerprint: v.string(),
    activationEligible: v.literal(false),
  }),
};
export const loss = v.object({
  n: v.number(),
  pairs: v.number(),
  targetTies: v.number(),
  predictionTies: v.number(),
  twiceLoss: v.number(),
  loss: v.union(v.number(), v.null()),
});
export const candidateFields = {
  ...common,
  kind: v.literal("candidate"),
  experimentId: v.id("calibrationModels"),
  payload: v.object({
    trainSnapshotId: v.id("calibrationReferences"),
    trainSnapshotFingerprint: v.string(),
    manifest: v.array(ref),
    frozenAt: v.number(),
    transfer: v.union(v.number(), v.null()),
    n: v.number(),
    spanMs: v.number(),
    trainLosses: v.array(loss),
    baseline: loss,
    selected: v.union(loss, v.null()),
    status: v.union(v.literal("frozen"), v.literal("no-comparable-pairs")),
    activationEligible: v.literal(false),
  }),
};
export const drift = v.object({
  clarity: v.union(v.number(), v.null()),
  discussion: v.union(v.number(), v.null()),
  replyRate: v.union(v.number(), v.null()),
});
export const block = v.object({
  n: v.number(),
  spanMs: v.number(),
  baseline: loss,
  candidate: loss,
  improvement: v.union(v.number(), v.null()),
  drift,
});
export const evaluationFields = {
  ...common,
  kind: v.literal("evaluation"),
  experimentId: v.id("calibrationModels"),
  payload: v.object({
    candidateId: v.id("calibrationModels"),
    candidateFingerprint: v.string(),
    snapshotId: v.id("calibrationReferences"),
    snapshotFingerprint: v.string(),
    specFingerprint: v.string(),
    policyFingerprint: v.string(),
    evaluatedAt: v.number(),
    asOf: v.number(),
    trainN: v.number(),
    trainSpanMs: v.number(),
    block1: block,
    block2: block,
    stability: v.union(v.number(), v.null()),
    engineeringScreen: v.boolean(),
    engineeringScreenBasis: v.literal("unvalidated-30-posts-28-days"),
    scanned: v.number(),
    populationTotal: v.union(v.number(), v.null()),
    populationLowerBound: v.number(),
    frameComplete: v.boolean(),
    excludedFraction: v.number(),
    exclusions: v.array(
      v.object({ postAttemptId: v.id("xPostAttempts"), reason: v.string() }),
    ),
    unknownSegments: v.array(v.string()),
    compatibility,
    reasons: v.array(v.string()),
    evidenceQualified: v.boolean(),
    activationEligible: v.literal(false),
  }),
};
export const modelFields = v.union(
  v.object(experimentFields),
  v.object(candidateFields),
  v.object(evaluationFields),
);
const doc = { _id: v.id("calibrationModels"), _creationTime: v.number() };
export const experimentDoc = v.object({ ...doc, ...experimentFields });
export const candidateDoc = v.object({ ...doc, ...candidateFields });
export const evaluationDoc = v.object({ ...doc, ...evaluationFields });
