import { v } from "convex/values";
import { scope } from "../performance/fields";
export const contentPerformancePolicyFields = {
  ...scope,
  version: v.string(),
  purpose: v.literal("own-performance-human-content-v1"),
  rightsEvidence: v.string(),
  approvedBy: v.id("users"),
  expiresAt: v.number(),
};
export const performanceSignal = v.object({
  kind: v.literal("performance_signal"),
  asOf: v.number(),
  cohort: v.string(),
  definitionVersion: v.union(v.string(), v.null()),
  expiresAt: v.number(),
  snapshotIds: v.array(v.id("performanceSnapshots")),
  versionIds: v.array(v.id("draftVersions")),
  knowledgeIds: v.array(v.id("publicationKnowledge")),
  assessmentIds: v.array(v.id("jevAssessments")),
  n: v.number(),
  meanImpressions: v.union(v.number(), v.null()),
  denominators: v.array(
    v.object({
      name: v.string(),
      components: v.array(v.string()),
      missing: v.array(v.object({ reason: v.string(), n: v.number() })),
      n: v.number(),
      numerator: v.union(v.number(), v.null()),
      denominator: v.union(v.number(), v.null()),
    }),
  ),
  summary: v.string(),
});
