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
  commit: v.string(),
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
  update: v.optional(
    v.object({
      proposalId: v.id("intelligenceSourceUpdates"),
      evaluationId: v.id("intelligenceSourceUpdates"),
    }),
  ),
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

export const sourceVariant = v.union(
  v.literal("public-context"),
  v.literal("post-analysis"),
);
export const sourceEvidence = v.object({
  path: v.string(),
  url: v.string(),
  sha256: v.string(),
});
export const sourceObservation = v.object({
  commit: v.string(),
  commitAt: v.number(),
  observedAt: v.number(),
  reviewDueAt: v.number(),
  compareUrl: v.string(),
  complete: v.boolean(),
  issues: v.array(v.string()),
  evidence: v.array(sourceEvidence),
  changes: v.array(
    v.object({
      path: v.string(),
      status: v.string(),
      url: v.string(),
      patch: v.string(),
      patchState: v.union(
        v.literal("complete"),
        v.literal("clipped"),
        v.literal("missing"),
      ),
    }),
  ),
});
export const sourceState = v.union(
  ...(
    [
      "pending",
      "up_to_date",
      "proposed",
      "failed",
      "unknown",
      "incomplete",
      "rate_limited",
    ] as const
  ).map(v.literal),
);
export const sourceBaseFields = {
  ...scope,
  actorId: v.id("users"),
  commandKey: v.string(),
  fingerprint: v.string(),
  baseProfileId: v.id("algorithmProfiles"),
  baseIdentity: v.string(),
  baseCommit: v.string(),
  headCommit: v.union(v.string(), v.null()),
  createdAt: v.number(),
};
export const sourceCheckFields = {
  ...sourceBaseFields,
  kind: v.literal("check"),
  expectedPaths: v.array(v.string()),
  full: v.boolean(),
  state: sourceState,
  deadline: v.number(),
  notBefore: v.number(),
  finishedAt: v.union(v.number(), v.null()),
  requests: v.number(),
  bytes: v.number(),
  error: v.union(v.string(), v.null()),
  proposalId: v.union(v.id("intelligenceSourceUpdates"), v.null()),
  observation: v.union(sourceObservation, v.null()),
};
export const sourceProposalFields = {
  ...sourceBaseFields,
  kind: v.literal("proposal"),
  checkId: v.id("intelligenceSourceUpdates"),
  observation: sourceObservation,
};
export const sourceEvaluationFields = {
  ...sourceBaseFields,
  kind: v.literal("evaluation"),
  proposalId: v.id("intelligenceSourceUpdates"),
  variant: sourceVariant,
  refs,
  interpretation: v.string(),
  impact: v.string(),
  rationale: v.string(),
  fullSourceReview: v.literal(true),
  reference: v.object({
    version: v.literal("source-compatibility-v1"),
    contract: v.string(),
    passed: v.boolean(),
    outcomes: v.array(
      v.object({
        case: v.string(),
        outcome: v.string(),
        aggregate: v.union(v.number(), v.null()),
      }),
    ),
  }),
};
export const sourceUpdateFields = v.union(
  v.object(sourceCheckFields),
  v.object(sourceProposalFields),
  v.object(sourceEvaluationFields),
);
export const sourceUpdateDoc = v.union(
  ...[sourceCheckFields, sourceProposalFields, sourceEvaluationFields].map(
    (fields) =>
      v.object({
        _id: v.id("intelligenceSourceUpdates"),
        _creationTime: v.number(),
        ...fields,
      }),
  ),
);
export const sourceCheckDoc = v.object({
  _id: v.id("intelligenceSourceUpdates"),
  _creationTime: v.number(),
  ...sourceCheckFields,
});
