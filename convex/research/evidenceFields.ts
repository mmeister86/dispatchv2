import { v } from "convex/values";
export const freshness = v.union(
  v.literal("time-sensitive"),
  v.literal("context-dependent"),
  v.literal("time-independent"),
  v.literal("unknown"),
);
export const annotation = v.object({
  claim: v.string(),
  consequentialOrContested: v.boolean(),
  eventBased: v.boolean(),
  quote: v.union(v.string(), v.null()),
  interpretation: v.string(),
  gaps: v.array(v.string()),
  relevance: v.string(),
  novelty: v.string(),
  uncertainty: v.string(),
  freshness,
  validityReason: v.string(),
});
export const assessment = v.object({
  reviewerId: v.id("users"),
  assessedAt: v.number(),
  purpose: v.literal("research-context"),
  ruleVersion: v.literal("human-publication-age-v1"),
  basis: v.union(
    v.literal("publication"),
    v.literal("earliest-publication-event"),
  ),
  maxAgeMs: v.number(),
  requestedUntil: v.number(),
  validUntil: v.union(v.number(), v.null()),
  reason: v.string(),
  substantiveSupportAttested: v.boolean(),
  eventAt: v.union(v.number(), v.null()),
  eventQuote: v.union(v.string(), v.null()),
});
export const evidenceFields = {
  modelOrigin: v.optional(
    v.object({
      runId: v.id("agentRuns"),
      promptMessageId: v.string(),
      promptVersion: v.string(),
      policyVersion: v.string(),
      outputHash: v.string(),
    }),
  ),
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  orderId: v.id("researchOrders"),
  sourceId: v.id("researchSources"),
  actorId: v.id("users"),
  annotationActorId: v.id("users"),
  commandKey: v.string(),
  fingerprint: v.string(),
  materialHash: v.string(),
  observedAt: v.number(),
  sourceGeneration: v.number(),
  retentionUntil: v.number(),
  createdAt: v.number(),
  state: v.union(v.literal("review"), v.literal("removed")),
  reason: v.union(v.string(), v.null()),
  parentEvidenceId: v.optional(v.id("researchEvidence")),
  assessment: v.optional(assessment),
  payload: v.union(
    v.object({
      annotation,
      model: v.optional(
        v.object({
          eventAt: v.union(v.number(), v.null()),
          eventQuote: v.union(v.string(), v.null()),
          title: v.string(),
          perspective: v.string(),
          dynamics: v.string(),
          clusterId: v.id("researchClusters"),
          historyIds: v.array(v.id("xPostAttempts")),
          copySourceIds: v.array(v.id("researchSources")),
        }),
      ),
      perspective: v.object({
        profileVersionId: v.id("researchProfileVersions"),
        audience: v.string(),
        topics: v.string(),
        project: v.string(),
      }),
    }),
    v.null(),
  ),
};
