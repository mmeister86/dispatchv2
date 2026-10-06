import { v } from "convex/values";
export const lifecycle = v.union(
  v.literal("draft"),
  v.literal("reviewed"),
  v.literal("retired"),
);
export const scope = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  network: v.literal("x"),
  surface: v.literal("for_you"),
};
export const review = v.union(
  v.null(),
  v.object({ actorId: v.id("users"), at: v.number(), reason: v.string() }),
);
export const versionFields = {
  ...scope,
  createdBy: v.id("users"),
  createdAt: v.number(),
  status: lifecycle,
  review,
  retiredAt: v.union(v.number(), v.null()),
};
const commonRefs = {
  formula: v.literal("dispatch-score-v1"),
  routing: v.literal("disabled-v1"),
  verification: v.literal("disabled-v1"),
};
export const oldRefs = v.object({
  ...commonRefs,
  questionSet: v.literal("unavailable-until-task28"),
  normalization: v.literal("unavailable-until-task28"),
});
export const executableRefs = v.object({
  ...commonRefs,
  questionSet: v.literal("jev-post-analysis-v1"),
  normalization: v.literal("jev-normalization-v1"),
});
export const refs = v.union(oldRefs, executableRefs);
const algorithmPayloadFields = {
  repository: v.literal("xai-org/x-algorithm"),
  commit: v.literal("b412112d03f27acbfd668e0cc040abcafa1080c1"),
  commitAt: v.number(),
  observedAt: v.number(),
  reviewDueAt: v.number(),
  validityBasis: v.literal("operational_assumption"),
  sourceScope: v.literal("public_code"),
  productionState: v.literal("unknown"),
  scoringInfluence: v.literal("none"),
  evidence: v.array(
    v.object({ path: v.string(), url: v.string(), sha256: v.string() }),
  ),
  report: v.string(),
};
export const algorithmFields = {
  ...versionFields,
  payload: v.union(
    v.object({
      ...algorithmPayloadFields,
      version: v.literal("x-public-context-v1"),
      refs: oldRefs,
    }),
    v.object({
      ...algorithmPayloadFields,
      version: v.literal("x-post-analysis-v1"),
      refs: executableRefs,
    }),
  ),
};
export const audienceFields = {
  ...versionFields,
  payload: v.object({
    version: v.literal("declared-audience-v1"),
    description: v.string(),
    source: v.literal("authorized_declaration"),
    measurement: v.literal("unavailable"),
    embedding: v.literal("unavailable"),
  }),
};
export const selectionFields = {
  ...scope,
  revision: v.number(),
  algorithmId: v.union(v.id("algorithmProfiles"), v.null()),
  audienceId: v.union(v.id("audienceProfiles"), v.null()),
  selectedBy: v.union(v.id("users"), v.null()),
  updatedAt: v.number(),
};
export const receiptFields = {
  ...scope,
  actorId: v.id("users"),
  commandKey: v.string(),
  fingerprint: v.string(),
  revision: v.number(),
  action: v.string(),
  reason: v.string(),
  algorithmId: v.union(v.id("algorithmProfiles"), v.null()),
  audienceId: v.union(v.id("audienceProfiles"), v.null()),
  createdAt: v.number(),
};
export const algorithmDoc = v.object({
  _id: v.id("algorithmProfiles"),
  _creationTime: v.number(),
  ...algorithmFields,
});
export const audienceDoc = v.object({
  _id: v.id("audienceProfiles"),
  _creationTime: v.number(),
  ...audienceFields,
});
export const selectionDoc = v.object({
  _id: v.id("intelligenceSelections"),
  _creationTime: v.number(),
  ...selectionFields,
});
export const receiptDoc = v.object({
  _id: v.id("intelligenceProfileReceipts"),
  _creationTime: v.number(),
  ...receiptFields,
});
export const commandArgs = {
  accountId: v.id("socialAccounts"),
  expectedRevision: v.number(),
  commandKey: v.string(),
};
export const result = v.object({
  revision: v.number(),
  algorithmId: v.union(v.id("algorithmProfiles"), v.null()),
  audienceId: v.union(v.id("audienceProfiles"), v.null()),
});
