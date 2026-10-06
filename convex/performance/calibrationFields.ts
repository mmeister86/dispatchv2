import { v } from "convex/values";
export const TARGET = "dispatch-local-reply-ordering-v1" as const;
export const TRANSFERS = [
  -0.1, -0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.1,
];
export const purposeConfig = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  version: v.string(),
  target: v.literal(TARGET),
  providerIdentity: v.string(),
  rightsEvidence: v.string(),
  explanation: v.string(),
  approvedBy: v.id("users"),
  expiresAt: v.number(),
  retentionMs: v.number(),
};
export const purposeFields = {
  ...purposeConfig,
  redactedAt: v.optional(v.number()),
  createdAt: v.number(),
  fingerprint: v.string(),
  generation: v.number(),
  consent: v.union(
    v.null(),
    v.object({
      actorId: v.id("users"),
      at: v.number(),
      commandKey: v.string(),
    }),
  ),
  withdrawal: v.union(
    v.null(),
    v.object({
      actorId: v.id("users"),
      at: v.number(),
      commandKey: v.string(),
    }),
  ),
};
export const compatibility = v.object({
  network: v.literal("x"),
  format: v.literal("single-text"),
  windowHours: v.literal(24),
  metricPolicyId: v.id("performancePolicies"),
  metricPolicyFingerprint: v.string(),
  metricVersion: v.string(),
  dialect: v.string(),
  replyField: v.string(),
  replyDefinition: v.string(),
  impressionField: v.string(),
  impressionDefinition: v.string(),
  algorithmId: v.id("algorithmProfiles"),
  algorithmFingerprint: v.string(),
  audienceId: v.id("audienceProfiles"),
  audienceFingerprint: v.string(),
  jevPolicyId: v.id("jevPolicies"),
  jevPolicyVersion: v.string(),
  jevPolicyFingerprint: v.string(),
  requestedModel: v.string(),
  resolvedModel: v.string(),
  questionVersion: v.string(),
  questionFingerprint: v.string(),
  inputVersion: v.string(),
  normalizationVersion: v.string(),
  formulaVersion: v.string(),
  thresholdVersion: v.string(),
  formulaFingerprint: v.string(),
});
export const bounds = {
  from: v.number(),
  fitCutoff: v.number(),
  holdout1Start: v.number(),
  holdout1End: v.number(),
  holdout2Start: v.number(),
  holdout2End: v.number(),
};
export const ref = v.object({
  postAttemptId: v.id("xPostAttempts"),
  scheduleId: v.id("schedules"),
  versionId: v.id("draftVersions"),
  externalId: v.string(),
  knowledgeId: v.id("publicationKnowledge"),
  assessmentId: v.id("jevAssessments"),
  analysisReceiptId: v.id("aiAttempts"),
  snapshotId: v.id("performanceSnapshots"),
  metricReceiptId: v.id("aiAttempts"),
  fingerprint: v.string(),
  confirmedAt: v.number(),
  publishedAt: v.number(),
  observedAt: v.number(),
  assessmentAt: v.number(),
  capturedAt: v.number(),
  requestStartedAt: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  originalUntil: v.number(),
  membership: v.union(
    v.literal("train"),
    v.literal("block1"),
    v.literal("block2"),
  ),
});
const common = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  purposeId: v.id("calibrationPurposes"),
  generation: v.number(),
  actorId: v.id("users"),
  createdAt: v.number(),
  commandKey: v.string(),
  requestFingerprint: v.string(),
  expiresAt: v.number(),
};
export const specFields = {
  ...common,
  kind: v.literal("spec"),
  specId: v.null(),
  payload: v.object({
    ...bounds,
    mode: v.union(v.literal("prospective"), v.literal("retrospective")),
    target: v.literal(TARGET),
    transfers: v.array(v.number()),
    empiricalPolicy: v.null(),
    prospectiveStatus: v.union(
      v.literal("candidate-not-frozen"),
      v.literal("retrospective-diagnostic"),
    ),
    activationEligible: v.literal(false),
    compatibility,
    anchor: v.object({
      ...ref.fields,
      membership: v.literal("compatibility-anchor"),
    }),
  }),
};
export const snapshotFields = {
  ...common,
  kind: v.literal("snapshot"),
  specId: v.id("calibrationReferences"),
  payload: v.object({
    asOf: v.number(),
    frameEnd: v.number(),
    frameComplete: v.boolean(),
    scanned: v.number(),
    populationLowerBound: v.number(),
    populationTotal: v.union(v.number(), v.null()),
    refs: v.array(ref),
    exclusions: v.array(
      v.object({ postAttemptId: v.id("xPostAttempts"), reason: v.string() }),
    ),
    counts: v.object({
      n: v.number(),
      train: v.number(),
      block1: v.number(),
      block2: v.number(),
    }),
    timeSpanMs: v.number(),
    engineeringScreen: v.boolean(),
    engineeringScreenBasis: v.literal("unvalidated-30-posts-28-days"),
    empiricalStatus: v.literal("unconfigured"),
    activationEligible: v.literal(false),
    unknownSegments: v.array(v.string()),
    missingPolicies: v.array(v.string()),
  }),
};
export const referenceFields = v.union(
  v.object(specFields),
  v.object(snapshotFields),
);
export const specDoc = v.object({
  _id: v.id("calibrationReferences"),
  _creationTime: v.number(),
  ...specFields,
});
export const snapshotDoc = v.object({
  _id: v.id("calibrationReferences"),
  _creationTime: v.number(),
  ...snapshotFields,
});
