import { v } from "convex/values";
import { scope, dialect, metricsAttemptFields } from "./fields";
export const historyPolicyFields = {
  ...scope,
  version: v.string(),
  approvedBy: v.id("users"),
  expiresAt: v.number(),
  purpose: v.literal("own-history-analytics-context-v1"),
  dialect,
  providerIdentity: v.string(),
  connectionSequence: v.number(),
  accessEvidence: v.string(),
  rightsEvidence: v.string(),
  pricingEvidence: v.string(),
  protocolEvidence: v.string(),
  allocationEvidence: v.string(),
  unit: v.literal("returned-post-resource"),
  unitMicros: v.number(),
  currency: v.string(),
  allocatedProviderLimitMicros: v.number(),
  retentionMs: v.number(),
  maxResults: v.number(),
};
export const historyControlFields = {
  ...scope,
  generation: v.number(),
  deletedThroughGeneration: v.number(),
  updatedAt: v.number(),
};
export const historyJobFields = {
  checkpointUntil: v.optional(v.number()),
  ...scope,
  actorId: v.id("users"),
  generation: v.number(),
  policyId: v.id("historyPolicies"),
  policyFingerprint: v.string(),
  sourceUntil: v.number(),
  state: v.union(
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
  ),
  pages: v.number(),
  imported: v.number(),
  rejected: v.number(),
  cursor: v.union(v.string(), v.null()),
  seenCursors: v.array(v.string()),
  attemptId: v.union(v.id("aiAttempts"), v.null()),
  jobId: v.optional(v.id("_scheduled_functions")),
  createdAt: v.number(),
  updatedAt: v.number(),
  reason: v.union(v.string(), v.null()),
};
export const historyPostFields = {
  ...scope,
  jobId: v.id("historyJobs"),
  generation: v.number(),
  externalId: v.string(),
  network: v.literal("x"),
  origin: v.literal("own-history-import"),
  providerCreatedAt: v.number(),
  observedAt: v.number(),
  sourceUntil: v.number(),
  text: v.union(v.string(), v.null()),
  contentType: v.union(v.literal("original"), v.literal("reply")),
  mediaType: v.union(v.literal("unknown"), v.literal("none")),
  replyTo: v.union(v.string(), v.null()),
  accountSize: v.null(),
  postAttemptId: v.union(v.id("xPostAttempts"), v.null()),
  versionId: v.union(v.id("draftVersions"), v.null()),
  thenKnowledgeId: v.union(v.id("publicationKnowledge"), v.null()),
  historicalAnalysisId: v.null(),
  metricsStatus: v.literal("not-observed"),
  removed: v.boolean(),
};
const {
  snapshotId: _snapshotId,
  policyId: _policyId,
  owner: _owner,
  purpose: _purpose,
  unit: _unit,
  ...financial
} = metricsAttemptFields;
export const historyAttemptFields = {
  ...financial,
  owner: v.literal("own-history"),
  purpose: v.literal("own-history-analytics-context-v1"),
  unit: v.literal("returned-post-resource"),
  policyId: v.id("historyPolicies"),
  historyJobId: v.id("historyJobs"),
  page: v.number(),
  maxResults: v.number(),
  resourceCount: v.union(v.number(), v.null()),
};
export const historyJobDoc = v.object({
  _id: v.id("historyJobs"),
  _creationTime: v.number(),
  ...historyJobFields,
});
export const historyPostDoc = v.object({
  _id: v.id("historyPosts"),
  _creationTime: v.number(),
  ...historyPostFields,
});
export const importedPost = v.object({
  externalId: v.string(),
  text: v.string(),
  providerCreatedAt: v.number(),
  contentType: v.union(v.literal("original"), v.literal("reply")),
  mediaType: v.union(v.literal("unknown"), v.literal("none")),
  replyTo: v.union(v.string(), v.null()),
});
