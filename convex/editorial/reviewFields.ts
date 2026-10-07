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
  withdrawnBy: v.optional(v.id("users")),
  active: v.boolean(),
  sourceUnavailable: v.boolean(),
};
export const commandResult = v.object({
  revision: v.number(),
  policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
  decisionId: v.union(v.id("editorialReviewDecisions"), v.null()),
});
export const assignmentResult = v.object({
  revision: v.number(),
  assigneeId: v.union(v.id("users"), v.null()),
  versionId: v.id("draftVersions"),
});
export const noticeParent = v.union(
  v.object({
    kind: v.literal("assignment"),
    commandId: v.id("editorialReviewCommands"),
  }),
  v.object({
    kind: v.literal("request"),
    commandId: v.id("editorialReviewCommands"),
    stage: stages,
  }),
  v.object({
    kind: v.literal("decision"),
    decisionId: v.id("editorialReviewDecisions"),
    withdrawn: v.boolean(),
  }),
  v.object({
    kind: v.literal("approval"),
    approvalId: v.id("approvals"),
    revoked: v.boolean(),
  }),
);
export const noticeFields = {
  workspaceId: v.id("workspaces"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  parent: noticeParent,
  occurrence: v.string(),
  actorId: v.id("users"),
  recipientId: v.id("users"),
  createdAt: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
  readAt: v.union(v.number(), v.null()),
  dismissedAt: v.union(v.number(), v.null()),
};
export const commandFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  actorId: v.id("users"),
  commandKey: v.string(),
  kind: v.union(
    v.literal("policy"),
    v.literal("assignment"),
    v.literal("request"),
    v.literal("editorial"),
    v.literal("brand"),
  ),
  draftId: v.optional(v.id("drafts")),
  assigneeId: v.optional(v.id("users")),
  requestStage: v.optional(stages),
  assignmentResult: v.optional(assignmentResult),
  versionId: v.optional(v.id("draftVersions")),
  fingerprint: v.optional(v.string()),
  result: v.optional(commandResult),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
};

export const reviewPresentation = v.object({
  revision: v.number(),
  policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
  editorial: v.boolean(),
  brand: v.boolean(),
  editorialDecisionId: v.union(v.id("editorialReviewDecisions"), v.null()),
  brandDecisionId: v.union(v.id("editorialReviewDecisions"), v.null()),
  sourceUntil: v.union(v.number(), v.null()),
});
export const frozenPresentation = v.object({
  usable: v.boolean(),
  sourceUntil: v.union(v.number(), v.null()),
});
