import { excerpt } from "../../integrations/github/contextFields";
import { payload as stylePayload } from "../styleFields";
import { v } from "convex/values";
import { mediaReference, mediaChecksums } from "../../lib/editorialFields";
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
    network: v.literal("x"),
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
  capability: v.object({ maxText: v.number() }),
  questionVersion: v.string(),
  requestFingerprint: v.string(),
  semanticKey: v.string(),
  sourceUntil: v.union(v.number(), v.null()),
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

export const strategies = [
  "announcement",
  "milestone",
  "launch",
  "educational",
  "thoughtLeadership",
  "conversation",
  "story",
  "promotional",
  "generic",
] as const;
export const routingStrategy = v.union(...strategies.map(v.literal));
export const routingIntent = v.object({
  intent: v.string(),
  outputKind: v.union(
    v.literal("perspective"),
    v.literal("social-post-candidate"),
  ),
  media: v.optional(v.array(mediaReference)),
  strategy: v.union(routingStrategy, v.null()),
  network: v.literal("x"),
  objective: v.union(v.string(), v.null()),
  tone: v.union(v.string(), v.null()),
  cta: v.union(v.string(), v.null()),
});
export const routingStateContract = v.object({
  input: v.object({
    title: v.string(),
    originalFacts: v.array(v.string()),
    userClaims: v.string(),
    previousPerspective: v.string(),
    interpretationRationale: v.string(),
    questions: v.array(v.string()),
    approvedPatchEvidence: v.array(excerpt),
  }),
  intent: routingIntent,
  style: v.union(stylePayload, v.null()),
});
export const routingPolicyFields = {
  ...policyFields,
  purpose: v.literal("intent-routing"),
  model: v.string(),
  outputMicrosPerMillion: v.number(),
  processingRights: v.object({
    processing: v.string(),
    storage: v.string(),
    training: v.string(),
  }),
  questionVersion: v.literal("jev-intent-routing-v1"),
  normalizationVersion: v.literal("jev-routing-normalization-v1"),
  thresholdVersion: v.literal("jev-routing-hypotheses-v1"),
};
export const routingControlFields = {
  ...controlFields,
  purpose: v.literal("intent-routing"),
  analyzer: v.literal(false),
  routing: v.boolean(),
  withdrawn: v.optional(v.boolean()),
};
export const routingResult = v.object({
  status: v.union(
    v.literal("human_choice"),
    v.literal("configuration_required"),
    v.literal("fallback"),
    v.literal("suggestion"),
    v.literal("routed"),
  ),
  category: v.union(routingStrategy, v.null()),
  choiceConfidence: v.union(v.number(), v.null()),
  suggestion: v.union(routingStrategy, v.null()),
  effectiveStrategy: routingStrategy,
  generatorKind: v.literal("generic"),
  thresholdVersion: v.literal("jev-routing-hypotheses-v1"),
});
export const routingOperationFields = {
  candidateMediaChecksums: v.optional(mediaChecksums),
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  actorId: v.id("users"),
  ideaId: v.id("ideas"),
  inputVersionId: v.id("ideaVersions"),
  inputRevision: v.number(),
  operationKey: v.string(),
  commandFingerprint: v.string(),
  semanticKey: v.string(),
  intent: v.union(routingIntent, v.null()),
  accountIdentity: v.union(v.string(), v.null()),
  accountConnectionSequence: v.number(),
  capabilityFingerprint: v.string(),
  style: v.union(
    v.object({
      versionId: v.id("styleProfileVersions"),
      fingerprint: v.string(),
      selectedBy: v.id("users"),
      selectionReceiptId: v.id("styleProfileCommands"),
      sourceUntil: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
  policyId: v.union(v.id("jevPolicies"), v.null()),
  policyFingerprint: v.union(v.string(), v.null()),
  controlId: v.union(v.id("jevControls"), v.null()),
  questionVersion: v.literal("jev-intent-routing-v1"),
  normalizationVersion: v.literal("jev-routing-normalization-v1"),
  deadline: v.number(),
  createdAt: v.number(),
  result: v.union(routingResult, v.null()),
  attemptId: v.union(v.id("aiAttempts"), v.null()),
};
export const routingAttemptFields = {
  owner: v.literal("jev-intent-router"),
  provider: v.literal("typesafe"),
  purpose: v.literal("intent-routing"),
  operation: v.literal("systemone"),
  routingOperationId: v.id("jevRoutingOperations"),
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  actorId: v.id("users"),
  inputVersionId: v.id("ideaVersions"),
  operationKey: v.string(),
  policyId: v.id("jevPolicies"),
  policyFingerprint: v.string(),
  policyVersion: v.string(),
  controlId: v.id("jevControls"),
  requestFingerprint: v.string(),
  questionVersion: v.literal("jev-intent-routing-v1"),
  normalizationVersion: v.literal("jev-routing-normalization-v1"),
  model: v.string(),
  resolvedModel: v.union(v.string(), v.null()),
  currency: v.string(),
  inputMicrosPerMillion: v.number(),
  outputMicrosPerMillion: v.number(),
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
  outcome: v.union(outcome, v.literal("unavailable"), v.null()),
  fallback: v.union(v.literal("none"), v.literal("unavailable")),
  runId: v.optional(v.id("agentRuns")),
  researchOrderId: v.optional(v.id("researchOrders")),
  logicalIntent: v.optional(v.string()),
};

export const verificationRef = v.object({
  compositeStage: v.optional(
    v.union(v.literal("first-verification"), v.literal("final-verification")),
  ),
  contentRequestId: v.id("contentRequests"),
  candidateVersionId: v.id("ideaVersions"),
  contentHash: v.string(),
  commandFingerprint: v.string(),
});
export const verificationPolicyFields = {
  ...routingPolicyFields,
  purpose: v.literal("output-verification"),
  questionVersion: v.literal("jev-output-verification-v1"),
  normalizationVersion: v.literal("jev-verification-normalization-v1"),
  thresholdVersion: v.literal("jev-verification-hypotheses-v1"),
};
export const verificationControlFields = {
  ...controlFields,
  purpose: v.literal("output-verification"),
  analyzer: v.literal(false),
  verification: v.boolean(),
  withdrawn: v.optional(v.boolean()),
};
export const verificationCriterionKey = v.union(
  ...(
    [
      "meaningPreserved",
      "intentPreserved",
      "newStrongClaim",
      "unwantedPromotion",
      "toneFits",
      "ctaFits",
      "networkFits",
    ] as const
  ).map(v.literal),
);
const verificationCriterion = v.object({
  probability: v.number(),
  applicability: v.union(v.literal("specified"), v.literal("unspecified")),
});
export const verificationResult = v.object({
  candidateVersionId: v.id("ideaVersions"),
  contentHash: v.string(),
  provenanceHash: v.string(),
  questionVersion: verificationPolicyFields.questionVersion,
  normalizationVersion: verificationPolicyFields.normalizationVersion,
  thresholdVersion: verificationPolicyFields.thresholdVersion,
  model: v.string(),
  decision: v.union(
    v.literal("manual_review"),
    v.literal("repairable"),
    v.literal("accept_with_warning"),
    v.literal("accept"),
  ),
  criteria: v.object({
    meaningPreserved: verificationCriterion,
    intentPreserved: verificationCriterion,
    newStrongClaim: verificationCriterion,
    unwantedPromotion: verificationCriterion,
    toneFits: verificationCriterion,
    ctaFits: verificationCriterion,
    networkFits: verificationCriterion,
  }),
  reasonKeys: v.array(verificationCriterionKey),
  resultFingerprint: v.string(),
});
export const verificationRisk = v.object({
  candidateVersionId: v.id("ideaVersions"),
  contentHash: v.string(),
  reasonKeys: v.array(verificationCriterionKey),
});
export const verificationSlot = v.object({
  kind: v.literal("standalone-verification-v1"),
  candidateVersionId: v.id("ideaVersions"),
  contentHash: v.string(),
  provenanceHash: v.string(),
  operationKey: v.string(),
  commandFingerprint: v.string(),
  requestFingerprint: v.string(),
  actorId: v.id("users"),
  producerRunId: v.id("agentRuns"),
  inputVersionId: v.id("ideaVersions"),
  startedAt: v.number(),
  deadline: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  policyId: v.id("jevPolicies"),
  policyFingerprint: v.string(),
  controlId: v.id("jevControls"),
  questionVersion: verificationPolicyFields.questionVersion,
  normalizationVersion: verificationPolicyFields.normalizationVersion,
  thresholdVersion: verificationPolicyFields.thresholdVersion,
  state: v.union(
    v.literal("ready"),
    v.literal("admitted"),
    v.literal("finished"),
    v.literal("stopped"),
  ),
  attemptId: v.union(v.id("aiAttempts"), v.null()),
  sourceUnavailable: v.boolean(),
  result: v.union(verificationResult, v.null()),
  resultFingerprint: v.union(v.string(), v.null()),
  stickyRisk: v.union(verificationRisk, v.null()),
});
export const verificationAttemptFields = {
  compositeParentId: v.optional(v.id("contentRequests")),
  compositeStage: v.optional(
    v.union(v.literal("first-verification"), v.literal("final-verification")),
  ),
  compositeRootRunId: v.optional(v.id("agentRuns")),
  ...routingAttemptFields,
  owner: v.literal("jev-output-verifier"),
  purpose: v.literal("output-verification"),
  routingOperationId: v.optional(v.id("jevRoutingOperations")),
  contentRequestId: v.id("contentRequests"),
  candidateVersionId: v.id("ideaVersions"),
  contentHash: v.string(),
  provenanceHash: v.string(),
  producerRunId: v.id("agentRuns"),
  commandFingerprint: v.string(),
  questionVersion: verificationPolicyFields.questionVersion,
  normalizationVersion: verificationPolicyFields.normalizationVersion,
  thresholdVersion: verificationPolicyFields.thresholdVersion,
};
export const checkedVerification = v.object({
  reference: verificationRef,
  resultFingerprint: v.string(),
});
export const verificationView = v.object({
  reference: verificationRef,
  applicability: v.union(
    v.literal("current"),
    v.literal("historical"),
    v.literal("unavailable"),
  ),
  sourceUntil: v.union(v.number(), v.null()),
  deadline: v.number(),
  state: v.union(
    v.literal("ready"),
    v.literal("admitted"),
    v.literal("finished"),
    v.literal("stopped"),
  ),
  result: v.union(verificationResult, v.null()),
  stickyRisk: v.union(verificationRisk, v.null()),
  usage: v.union(
    v.null(),
    v.object({
      attemptId: v.id("aiAttempts"),
      state: v.union(
        v.literal("sent"),
        v.literal("unknown"),
        v.literal("settled"),
      ),
      heldMicros: v.number(),
      estimatedMicros: v.union(v.number(), v.null()),
      currency: v.string(),
    }),
  ),
});

export const compositeVerificationSlot = v.object({
  ...verificationSlot.fields,
  kind: v.literal("composite-verification-v1"),
});
export const compositeEnvelope = v.object({
  kind: v.literal("composite-generation-v1"),
  actorId: v.id("users"),
  startedAt: v.number(),
  deadline: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
  state: v.union(
    v.literal("initial"),
    v.literal("verified"),
    v.literal("repair"),
    v.literal("finished"),
    v.literal("stopped"),
  ),
  currency: v.string(),
  maxCostMicros: v.number(),
  maxCalls: v.number(),
  maxToolSteps: v.number(),
  policyId: v.id("jevPolicies"),
  policyFingerprint: v.string(),
  controlId: v.id("jevControls"),
  first: v.union(compositeVerificationSlot, v.null()),
  final: v.union(compositeVerificationSlot, v.null()),
  repairRequestId: v.union(v.id("contentRequests"), v.null()),
  repairRunId: v.union(v.id("agentRuns"), v.null()),
  repairedCandidateVersionId: v.union(v.id("ideaVersions"), v.null()),
  reservationId: v.union(v.id("aiAttempts"), v.null()),
  repairCommandFingerprint: v.union(v.string(), v.null()),
  stickyRisk: v.union(verificationRisk, v.null()),
});
const { requestFingerprint: futurePacketFingerprint, ...reservationHeader } =
  routingAttemptFields;
export const finalReservationFields = {
  ...reservationHeader,
  reservationFingerprint: v.string(),
  deadline: v.number(),
  owner: v.literal("jev-output-verifier-reservation"),
  purpose: v.literal("output-verification"),
  routingOperationId: v.optional(v.id("jevRoutingOperations")),
  compositeParentId: v.id("contentRequests"),
  compositeStage: v.literal("final-verification"),
  compositeRootRunId: v.id("agentRuns"),
  contentRequestId: v.id("contentRequests"),
  producerRunId: v.id("agentRuns"),
  commandFingerprint: v.string(),
  questionVersion: verificationPolicyFields.questionVersion,
  normalizationVersion: verificationPolicyFields.normalizationVersion,
  thresholdVersion: verificationPolicyFields.thresholdVersion,
  state: v.union(v.literal("reserved"), v.literal("cancelled")),
  sentAt: v.null(),
  reservedAt: v.number(),
};
export const compositeView = v.object({
  contentRequestId: v.id("contentRequests"),
  startedAt: v.number(),
  deadline: v.number(),
  currency: v.string(),
  state: compositeEnvelope.fields.state,
  sourceUnavailable: v.boolean(),
  repairedCandidateVersionId: v.union(v.id("ideaVersions"), v.null()),
  reservedFinal: v.boolean(),
  bookedMicros: v.number(),
  heldMicros: v.number(),
  observedMicros: v.number(),
  usagePending: v.boolean(),
  calls: v.number(),
  toolSteps: v.number(),
  maxCostMicros: v.number(),
  maxCalls: v.number(),
  maxToolSteps: v.number(),
  stickyRisk: v.union(verificationRisk, v.null()),
});
