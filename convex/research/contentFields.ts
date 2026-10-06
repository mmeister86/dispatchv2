import { v } from "convex/values";
import { evidenceFields } from "./evidenceFields";
// One immutable evidence record per proposal; canonical copies are evidence provenance.
export const researchContentSource = v.object({
  kind: v.literal("research"),
  ideaVersionId: v.optional(v.id("ideaVersions")),
  evidenceId: v.id("researchEvidence"),
  evidenceFingerprint: v.string(),
  accountId: v.id("socialAccounts"),
  orderId: v.id("researchOrders"),
  sourceId: v.id("researchSources"),
  materialHash: v.string(),
  sourceGeneration: v.number(),
  modelOrigin: evidenceFields.modelOrigin,
  assessmentFingerprint: v.optional(v.string()),
  proofUntil: v.number(),
});
export const researchCopyFields = {
  sourceCleanupState: v.optional(
    v.union(v.literal("pending"), v.literal("complete")),
  ),
  sourceProofUntil: v.optional(v.number()),
  researchProofUntil: v.optional(v.number()),
  researchCleanupPending: v.optional(v.boolean()),
  sourceUnavailable: v.optional(v.boolean()),
};
