import { v } from "convex/values";

export const stages = v.union(v.literal("editorial"), v.literal("brand"));
export const policyValue = v.object({
  editorial: v.boolean(),
  brand: v.boolean(),
});
export const reviewPin = v.object({
  policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
  decisionIds: v.array(v.id("editorialReviewDecisions")),
  sourceUntil: v.union(v.number(), v.null()),
});
export const policyFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  editorial: v.boolean(),
  brand: v.boolean(),
  actorId: v.id("users"),
  revision: v.number(),
  createdAt: v.number(),
};
export const controlFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
  revision: v.number(),
};
export const decisionFields = {
  workspaceId: v.id("workspaces"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  policyId: v.id("editorialReviewPolicies"),
  stage: stages,
  reviewerId: v.optional(v.id("users")),
  priorDecisionId: v.optional(v.id("editorialReviewDecisions")),
  createdAt: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  withdrawnAt: v.union(v.number(), v.null()),
  active: v.boolean(),
  sourceUnavailable: v.boolean(),
};
export const commandResult = v.object({
  revision: v.number(),
  policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
  decisionId: v.union(v.id("editorialReviewDecisions"), v.null()),
});
export const commandFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  actorId: v.id("users"),
  commandKey: v.string(),
  kind: v.union(
    v.literal("policy"),
    v.literal("editorial"),
    v.literal("brand"),
  ),
  versionId: v.optional(v.id("draftVersions")),
  fingerprint: v.optional(v.string()),
  result: v.optional(commandResult),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
};
