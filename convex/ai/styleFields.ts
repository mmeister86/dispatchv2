import { v } from "convex/values";
export const preferencesFields = {
  tone: v.string(),
  positioning: v.string(),
  pillars: v.array(v.object({ name: v.string(), weight: v.number() })),
  examples: v.array(v.string()),
  forbidden: v.array(v.string()),
};
export const preferences = v.object(preferencesFields);
export const payload = v.object({
  author: v.string(),
  experiences: v.array(v.string()),
  ...preferencesFields,
});
export const scope = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
};
export const horizon = v.union(v.number(), v.null());
export const versionFields = {
  ...scope,
  createdBy: v.id("users"),
  createdAt: v.number(),
  declaredBy: v.id("users"),
  declaredAt: v.number(),
  selfDeclaration: v.literal(true),
  fingerprint: v.string(),
  payload: v.union(payload, v.null()),
  baseVersionId: v.union(v.id("styleProfileVersions"), v.null()),
  proposalId: v.union(v.id("learningProposals"), v.null()),
  sourceUntil: horizon,
  sourceUnavailable: v.boolean(),
  reason: v.string(),
  status: v.union(
    v.literal("active"),
    v.literal("retired"),
    v.literal("erased"),
  ),
};
export const controlFields = {
  ...scope,
  revision: v.number(),
  selectedVersionId: v.union(v.id("styleProfileVersions"), v.null()),
  selectedBy: v.union(v.id("users"), v.null()),
  selectionReceiptId: v.union(v.id("styleProfileCommands"), v.null()),
  updatedAt: v.number(),
};
export const result = v.object({
  revision: v.number(),
  versionId: v.union(v.id("styleProfileVersions"), v.null()),
  proposalId: v.union(v.id("learningProposals"), v.null()),
  receiptId: v.id("styleProfileCommands"),
});
export const commandFields = {
  ...scope,
  actorId: v.id("users"),
  commandKey: v.string(),
  fingerprint: v.string(),
  revision: v.number(),
  action: v.string(),
  reason: v.string(),
  versionId: v.union(v.id("styleProfileVersions"), v.null()),
  proposalId: v.union(v.id("learningProposals"), v.null()),
  createdAt: v.number(),
  sourceUnavailable: v.boolean(),
};
export const proposalFields = {
  ...scope,
  createdBy: v.id("users"),
  createdAt: v.number(),
  baseVersionId: v.id("styleProfileVersions"),
  baseFingerprint: v.string(),
  baseSelectionReceiptId: v.id("styleProfileCommands"),
  feedbackId: v.id("contentFeedback"),
  draftId: v.id("drafts"),
  beforeVersionId: v.id("draftVersions"),
  resultingVersionId: v.union(v.id("draftVersions"), v.null()),
  beforeUntil: horizon,
  resultUntil: horizon,
  sourceUntil: horizon,
  preferences: v.union(preferences, v.null()),
  ownExamples: v.boolean(),
  reason: v.string(),
  state: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("rejected"),
  ),
  decidedBy: v.union(v.id("users"), v.null()),
  decidedAt: horizon,
  decisionReason: v.string(),
  resultVersionId: v.union(v.id("styleProfileVersions"), v.null()),
  sourceUnavailable: v.boolean(),
};
export const versionDoc = v.object({
  _id: v.id("styleProfileVersions"),
  _creationTime: v.number(),
  ...versionFields,
});
export const controlDoc = v.object({
  _id: v.id("styleProfileControls"),
  _creationTime: v.number(),
  ...controlFields,
});
export const commandDoc = v.object({
  _id: v.id("styleProfileCommands"),
  _creationTime: v.number(),
  ...commandFields,
});
export const versionCatalog = v.object({
  _id: v.id("styleProfileVersions"),
  _creationTime: v.number(),
  status: versionFields.status,
  declaredBy: v.id("users"),
  declaredAt: v.number(),
  createdBy: v.id("users"),
  createdAt: v.number(),
});
export const proposalCatalog = v.object({
  _id: v.id("learningProposals"),
  state: proposalFields.state,
});
export const commandCatalog = v.object({
  _id: v.id("styleProfileCommands"),
  _creationTime: v.number(),
  revision: v.number(),
  action: v.string(),
  versionId: v.union(v.id("styleProfileVersions"), v.null()),
  proposalId: v.union(v.id("learningProposals"), v.null()),
  createdAt: v.number(),
});
export const proposalDoc = v.object({
  _id: v.id("learningProposals"),
  _creationTime: v.number(),
  ...proposalFields,
});
export const action = v.union(
  v.object({
    kind: v.literal("save"),
    payload,
    freshDeclaration: v.boolean(),
    baseVersionId: v.union(v.id("styleProfileVersions"), v.null()),
    reason: v.string(),
  }),
  v.object({
    kind: v.literal("propose"),
    baseVersionId: v.id("styleProfileVersions"),
    feedbackId: v.id("contentFeedback"),
    preferences,
    ownExamples: v.boolean(),
    reason: v.string(),
  }),
  v.object({
    kind: v.union(v.literal("accept"), v.literal("reject")),
    proposalId: v.id("learningProposals"),
    reason: v.string(),
  }),
  v.object({
    kind: v.union(v.literal("select"), v.literal("retire")),
    versionId: v.id("styleProfileVersions"),
    reason: v.string(),
  }),
  v.object({ kind: v.literal("reset"), reason: v.string() }),
  v.object({
    kind: v.literal("rollback"),
    receiptId: v.id("styleProfileCommands"),
    reason: v.string(),
  }),
);
