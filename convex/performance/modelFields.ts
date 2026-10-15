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
export const monitoringPolicyInput = v.object({
  minBlockN: v.number(),
  minBlockSpanMs: v.number(),
  maxExcludedFraction: v.number(),
  minImprovement: v.number(),
  maxClarityDrift: v.number(),
  maxDiscussionDrift: v.number(),
  maxReplyRateDrift: v.number(),
  reviewUntil: v.number(),
  finalValidUntil: v.number(),
  evidence: v.string(),
  rationale: v.string(),
});
export const declarationFields = {
  ...common,
  kind: v.literal("monitoring-declaration"),
  experimentId: v.id("calibrationModels"),
  candidateId: v.id("calibrationModels"),
  declarationId: v.null(),
  payload: v.object({
    version: v.literal("one-finite-checkpoint-v1"),
    candidateFingerprint: v.string(),
    evaluationId: v.id("calibrationModels"),
    evaluationFingerprint: v.string(),
    specFingerprint: v.string(),
    purposeFingerprint: v.string(),
    compatibility,
    policy: v.object({
      ...monitoringPolicyInput.fields,
      reviewerId: v.id("users"),
      reviewedAt: v.number(),
    }),
    policyFingerprint: v.string(),
    firstEnd: v.number(),
    unusedSecondStart: v.number(),
  }),
};
export const checkFields = {
  ...common,
  kind: v.literal("monitoring-check"),
  experimentId: v.id("calibrationModels"),
  candidateId: v.id("calibrationModels"),
  declarationId: v.id("calibrationModels"),
  blockNumber: v.literal(1),
  payload: v.object({
    declarationFingerprint: v.string(),
    snapshotId: v.id("calibrationReferences"),
    snapshotFingerprint: v.string(),
    computedAt: v.number(),
    asOf: v.number(),
    block,
    excludedFraction: v.number(),
    coverageBasis: v.literal("whole-declared-frame"),
    status: v.union(v.literal("pass"), v.literal("fail"), v.literal("unknown")),
    reasons: v.array(v.string()),
  }),
};
const decisionCommon = {
  workspaceId: common.workspaceId,
  accountId: common.accountId,
  actorId: common.actorId,
  createdAt: common.createdAt,
  commandKey: common.commandKey,
  requestFingerprint: common.requestFingerprint,
  kind: v.literal("activation-decision"),
};
export const activationFields = {
  ...common,
  ...decisionCommon,
  experimentId: v.id("calibrationModels"),
  declarationId: v.id("calibrationModels"),
  payload: v.object({
    action: v.literal("activate"),
    evaluationId: v.id("calibrationModels"),
    candidateId: v.id("calibrationModels"),
    declarationFingerprint: v.string(),
    checkId: v.id("calibrationModels"),
    checkFingerprint: v.string(),
    expectedRevision: v.number(),
    resultingRevision: v.number(),
  }),
};
export const rollbackFields = {
  ...decisionCommon,
  payload: v.object({
    action: v.literal("rollback-static"),
    expectedRevision: v.number(),
    resultingRevision: v.number(),
    formulaVersion: v.literal("dispatch-score-v1"),
    thresholdVersion: v.literal("jev-confidence-startup-v1"),
  }),
};
export const calibrationControlFields = {
  workspaceId: common.workspaceId,
  accountId: common.accountId,
  revision: v.number(),
  activeDecisionId: v.union(v.id("calibrationModels"), v.null()),
  actorId: common.actorId,
  updatedAt: v.number(),
};
export const projection = v.object({
  version: v.literal("prospective-calibration-v1"),
  state: v.union(
    v.literal("candidate"),
    v.literal("static"),
    v.literal("unavailable"),
  ),
  score: v.union(v.number(), v.null()),
  reason: v.union(v.string(), v.null()),
  formulaVersion: v.literal("dispatch-score-v1"),
  thresholdVersion: v.literal("jev-confidence-startup-v1"),
  proofUntil: v.union(v.number(), v.null()),
  operatingUntil: v.union(v.number(), v.null()),
  pin: v.union(
    v.null(),
    v.object({
      assessmentId: v.id("jevAssessments"),
      assessmentFingerprint: v.string(),
      semanticKey: v.string(),
      purposeId: v.id("calibrationPurposes"),
      generation: v.number(),
      decisionId: v.id("calibrationModels"),
      decisionFingerprint: v.string(),
      candidateId: v.id("calibrationModels"),
      evaluationId: v.id("calibrationModels"),
      declarationId: v.id("calibrationModels"),
      declarationFingerprint: v.string(),
      checkId: v.id("calibrationModels"),
      checkFingerprint: v.string(),
      capturedAt: v.number(),
    }),
  ),
});
export const tombstoneFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  kind: v.literal("monitoring-tombstone"),
  createdAt: v.number(),
  expiresAt: v.number(),
  candidateId: v.id("calibrationModels"),
  declarationId: v.union(v.id("calibrationModels"), v.null()),
  blockNumber: v.union(v.literal(1), v.null()),
};
export const modelFields = v.union(
  v.object(experimentFields),
  v.object(candidateFields),
  v.object(evaluationFields),
  v.object(declarationFields),
  v.object(checkFields),
  v.object(activationFields),
  v.object(rollbackFields),
  v.object(tombstoneFields),
);
const doc = { _id: v.id("calibrationModels"), _creationTime: v.number() };
export const experimentDoc = v.object({ ...doc, ...experimentFields });
export const candidateDoc = v.object({ ...doc, ...candidateFields });
export const evaluationDoc = v.object({ ...doc, ...evaluationFields });
export const declarationDoc = v.object({ ...doc, ...declarationFields });
export const checkDoc = v.object({ ...doc, ...checkFields });
