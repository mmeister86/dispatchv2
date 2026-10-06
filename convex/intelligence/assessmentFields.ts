import { requestFields } from "../ai/jev/types";
import { v } from "convex/values";
import { resultContract, segmentFields } from "../ai/jev/resultFields";
export const normalizedResult = v.object({
  outcome: v.union(v.literal("success"), v.literal("low_confidence")),
  answers: resultContract.fields.answers,
  score: resultContract.fields.score,
  deterministic: v.object({
    version: v.literal("structure-v1"),
    segments: v.array(v.object(segmentFields)),
    media: v.object({
      present: v.boolean(),
      count: v.number(),
      images: v.number(),
      videos: v.number(),
      withAlt: v.number(),
    }),
    structure: v.number(),
  }),
  questionVersion: v.literal("jev-post-analysis-v1"),
  normalizationVersion: v.literal("jev-normalization-v1"),
});
export const assessmentFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  draftId: v.id("drafts"),
  draftVersionId: v.id("draftVersions"),
  versionNumber: v.number(),
  algorithmId: v.id("algorithmProfiles"),
  audienceId: v.id("audienceProfiles"),
  semanticKey: v.string(),
  inputVersion: v.literal("dispatch-assessment-input-v1"),
  attemptId: v.id("aiAttempts"),
  provenance: v.object({
    policyId: v.id("jevPolicies"),
    policyVersion: v.string(),
    requestedModel: v.string(),
    resolvedModel: v.union(v.string(), v.null()),
    inputTokens: v.union(v.number(), v.null()),
    outputTokens: v.union(v.number(), v.null()),
    sentAt: v.number(),
    settledAt: v.union(v.number(), v.null()),
    latencyMs: v.union(v.number(), v.null()),
    selectionRevision: v.number(),
  }),
  createdAt: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  result: normalizedResult,
};
export const assessmentDoc = v.object({
  _id: v.id("jevAssessments"),
  _creationTime: v.number(),
  ...assessmentFields,
});
export const assessmentRequestFields = {
  workspaceId: v.id("workspaces"),
  actorId: v.id("users"),
  operationKey: v.string(),
  sourceUntil: v.union(v.number(), v.null()),
  request: v.object(requestFields),
  semanticKey: v.string(),
  createdAt: v.number(),
};
export const targetFields = {
  accountId: v.id("socialAccounts"),
  draftId: v.id("drafts"),
  draftVersionId: v.id("draftVersions"),
};
