import { v } from "convex/values";
export const outcome = v.union(
  ...(
    [
      "success",
      "timeout",
      "rate_limit",
      "provider_error",
      "invalid_response",
      "low_confidence",
    ] as const
  ).map(v.literal),
);
export type Outcome =
  | "success"
  | "timeout"
  | "rate_limit"
  | "provider_error"
  | "invalid_response"
  | "low_confidence";
export type Answer =
  | { type: "choice"; value: string; confidence: number }
  | { type: "score"; value: number; confidence: number }
  | { type: "noul"; probability: number };
export type Normalized =
  | { outcome: "success" | "low_confidence"; answers: Record<string, Answer> }
  | { outcome: "invalid_response" };
export const answer = v.union(
  v.object({
    type: v.literal("choice"),
    value: v.string(),
    confidence: v.number(),
  }),
  v.object({
    type: v.literal("score"),
    value: v.number(),
    confidence: v.number(),
  }),
  v.object({ type: v.literal("noul"), probability: v.number() }),
);
export const requestFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  actorId: v.id("users"),
  draftId: v.id("drafts"),
  draftVersionId: v.id("draftVersions"),
  algorithmId: v.id("algorithmProfiles"),
  audienceId: v.id("audienceProfiles"),
  selectionRevision: v.number(),
  operationKey: v.string(),
  mode: v.union(v.literal("composer"), v.literal("background")),
  deadline: v.number(),
};
export const policyFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  version: v.string(),
  approvedBy: v.id("users"),
  expiresAt: v.number(),
  credentialFingerprint: v.string(),
  model: v.literal("jev-1.13.0"),
  currency: v.string(),
  pricingEvidence: v.string(),
  inputMicrosPerMillion: v.number(),
  outputMicrosPerMillion: v.literal(0),
  maxInputTokens: v.number(),
  maxOutputTokens: v.number(),
  euEvidence: v.object({
    gateway: v.string(),
    inference: v.string(),
    logs: v.string(),
    cache: v.string(),
    storage: v.string(),
    subprocessors: v.string(),
  }),
};
export const controlFields = {
  key: v.string(),
  workspaceId: v.optional(v.id("workspaces")),
  accountId: v.optional(v.id("socialAccounts")),
  enabled: v.boolean(),
  analyzer: v.boolean(),
  routing: v.literal(false),
  verification: v.literal(false),
  networkFit: v.literal(false),
  policyId: v.union(v.id("jevPolicies"), v.null()),
  composerTimeoutMs: v.number(),
  backgroundTimeoutMs: v.number(),
  failures: v.number(),
  openUntil: v.number(),
  probeAttemptId: v.union(v.id("aiAttempts"), v.null()),
};
export const attemptFields = {
  owner: v.literal("jev-analyzer"),
  provider: v.literal("typesafe"),
  purpose: v.literal("analyzer"),
  operation: v.literal("systemone"),
  ...requestFields,
  policyId: v.id("jevPolicies"),
  policyFingerprint: v.string(),
  policyVersion: v.string(),
  currency: v.string(),
  controlId: v.id("jevControls"),
  requestFingerprint: v.string(),
  questionVersion: v.string(),
  normalizationVersion: v.string(),
  model: v.string(),
  resolvedModel: v.union(v.string(), v.null()),
  inputMicrosPerMillion: v.number(),
  outputMicrosPerMillion: v.literal(0),
  maxInputTokens: v.number(),
  maxOutputTokens: v.number(),
  budgetIds: v.array(v.id("aiBudgets")),
  reservedMicros: v.number(),
  heldMicros: v.number(),
  estimatedMicros: v.union(v.number(), v.null()),
  billedMicros: v.null(),
  state: v.union(v.literal("sent"), v.literal("unknown"), v.literal("settled")),
  sentAt: v.number(),
  settledAt: v.union(v.number(), v.null()),
  inputTokens: v.union(v.number(), v.null()),
  outputTokens: v.union(v.number(), v.null()),
  latencyMs: v.union(v.number(), v.null()),
  outcome: v.union(outcome, v.null()),
  fallback: v.union(v.literal("none"), v.literal("unavailable")),
  // Preserve union discrimination in all existing receipt readers.
  runId: v.optional(v.id("agentRuns")),
  researchOrderId: v.optional(v.id("researchOrders")),
  logicalIntent: v.optional(v.string()),
};

export const contextResult = v.object({
  state: v.object({
    thread: v.array(v.object({ position: v.number(), text: v.string() })),
    media: v.array(
      v.object({
        type: v.union(v.literal("image"), v.literal("video")),
        mime: v.union(v.string(), v.null()),
        width: v.union(v.number(), v.null()),
        height: v.union(v.number(), v.null()),
        duration: v.union(v.number(), v.null()),
        alt: v.string(),
      }),
    ),
    audience: v.string(),
  }),
  questions: v.record(
    v.string(),
    v.union(
      v.object({
        type: v.literal("choice"),
        instructions: v.string(),
        criteria: v.record(v.string(), v.string()),
      }),
      v.object({
        type: v.literal("score"),
        instructions: v.string(),
        criteria: v.array(v.string()),
      }),
      v.object({
        type: v.literal("noul"),
        instructions: v.string(),
        criteria: v.optional(
          v.object({
            true: v.optional(v.string()),
            false: v.optional(v.string()),
          }),
        ),
      }),
    ),
  ),
  questionVersion: v.string(),
  requestFingerprint: v.string(),
  budgetIds: v.array(v.id("aiBudgets")),
  p: v.object({
    ...policyFields,
    _id: v.id("jevPolicies"),
    _creationTime: v.number(),
  }),
  c: v.object({
    ...controlFields,
    _id: v.id("jevControls"),
    _creationTime: v.number(),
  }),
});
