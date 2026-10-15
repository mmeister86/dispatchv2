import { xEvidence } from "../integrations/x/fields";
import {
  policyFields as jevPolicyFields,
  routingPolicyFields,
  verificationPolicyFields,
  controlFields as jevControlFields,
  routingControlFields,
  verificationControlFields,
} from "../ai/jev/types";
import {
  authority as experimentAuthority,
  assignmentProof,
} from "../performance/experiments";
import {
  experimentFields as editorialExperimentFields,
  commandFields as experimentCommandFields,
  assignmentFields as experimentAssignmentFields,
  bindingFields as experimentBindingFields,
  spec as experimentSpec,
  publicationSpec,
} from "../performance/experimentFields";
import { ConvexError, v, type Infer } from "convex/values";
import {
  workspaceQuery,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { role } from "../schema";
import {
  EXPORT_PAGE_CANDIDATES,
  EXPORT_PAGE_MAX_BYTES,
  numeric,
  proofContext,
} from "./exportShared";
import { assetFields, accountFields } from "../lib/editorialFields";
import { connectionFields } from "../integrations/github/fields";
import {
  policyFields as embeddingPolicyFields,
  controlFields as embeddingControlFields,
} from "../content/similarityFields";
import { contentPerformancePolicyFields } from "../content/performanceFields";
import { policyFields as researchPolicyFields } from "../research/providerFields";
import {
  profileFields as researchProfileFields,
  versionFields as researchVersionFields,
} from "../research/fields";
import { readableSpec, readableSnapshot } from "../performance/calibration";
import { readable as readableModel } from "../performance/models";
import {
  purposeFields,
  specFields,
  snapshotFields,
  compatibility,
  ref,
} from "../performance/calibrationFields";
import {
  experimentFields as modelExperimentFields,
  candidateFields,
  evaluationFields,
  declarationFields,
  checkFields,
  activationFields,
  rollbackFields,
  tombstoneFields,
  calibrationControlFields,
} from "../performance/modelFields";

function pick<T, const K extends readonly (keyof T)[]>(
  r: T,
  keys: K,
): Pick<T, K[number]> {
  return Object.fromEntries(
    keys.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]),
  ) as Pick<T, K[number]>;
}
function binding(ok: unknown): asserts ok {
  if (!ok) throw new ConvexError("REFERENCE_ACCESS_DENIED");
}
const mediaManifestKeys = [
  "name",
  "defaultAlt",
  "type",
  "mime",
  "size",
  "width",
  "height",
  "duration",
  "state",
] as const;
const accountRecordsKeys = [
  "provider",
  "providerIdentity",
  "name",
  "handle",
  "connection",
  "capability",
] as const;
const githubConnectionsKeys = [
  "status",
  "identity",
  "login",
  "installations",
  "inventoryLimited",
  "updatedAt",
] as const;
const embeddingPoliciesKeys = [
  "accountId",
  "version",
  "enabled",
  "approvedBy",
  "expiresAt",
  "purpose",
  "provider",
  "baseURL",
  "model",
  "identity",
  "processingEvidence",
  "upstreamEuEvidence",
  "storageEvidence",
  "trainingEvidence",
  "retentionEvidence",
  "rightsEvidence",
  "pricingEvidence",
  "protocolEvidence",
  "allocationEvidence",
  "currency",
  "inputMicrosPerMillion",
  "allocatedProviderLimitMicros",
  "maxInputTokens",
  "retentionMs",
  "maxDurationMs",
] as const;
const embeddingControlsKeys = [
  "accountId",
  "generation",
  "enabled",
  "approvedBy",
  "connectionSequence",
  "policyId",
  "purpose",
  "ownHistory",
  "draftVersions",
  "consentEvidence",
  "expiresAt",
  "updatedAt",
] as const;
const performanceContentPoliciesKeys = [
  "accountId",
  "version",
  "purpose",
  "rightsEvidence",
  "approvedBy",
  "expiresAt",
] as const;
const researchPoliciesRecentKeys = [
  "accountId",
  "operation",
  "enabled",
  "version",
  "generation",
  "approvedBy",
  "expiresAt",
  "accessEvidence",
  "processingEvidence",
  "pricingEvidence",
  "rightsEvidence",
  "protocolEvidence",
  "lifecycleEvidence",
  "lifecycleValidUntil",
  "retentionMs",
  "authMode",
  "protocol",
  "currency",
  "unit",
  "unitMicros",
  "totalChargeBoundEvidence",
  "allocationEvidence",
  "allocatedProviderLimitMicros",
  "costCurrencyEvidence",
  "model",
  "woeid",
] as const;
const researchPoliciesTrendsKeys = [
  "accountId",
  "operation",
  "enabled",
  "version",
  "generation",
  "approvedBy",
  "expiresAt",
  "accessEvidence",
  "processingEvidence",
  "pricingEvidence",
  "rightsEvidence",
  "protocolEvidence",
  "lifecycleEvidence",
  "lifecycleValidUntil",
  "retentionMs",
  "authMode",
  "protocol",
  "currency",
  "unit",
  "unitMicros",
  "totalChargeBoundEvidence",
  "allocationEvidence",
  "allocatedProviderLimitMicros",
  "costCurrencyEvidence",
  "model",
  "woeid",
] as const;
const researchPoliciesWebKeys = [
  "accountId",
  "operation",
  "enabled",
  "version",
  "generation",
  "approvedBy",
  "expiresAt",
  "accessEvidence",
  "processingEvidence",
  "pricingEvidence",
  "rightsEvidence",
  "protocolEvidence",
  "lifecycleEvidence",
  "lifecycleValidUntil",
  "retentionMs",
  "authMode",
  "protocol",
  "currency",
  "unit",
  "unitMicros",
  "totalChargeBoundEvidence",
  "allocationEvidence",
  "allocatedProviderLimitMicros",
  "costCurrencyEvidence",
  "model",
  "woeid",
] as const;
const researchProfileRecordsKeys = [
  "accountId",
  "currentVersionId",
  "revision",
  "paused",
  "deleted",
  "scheduleActive",
  "scheduleGeneration",
  "scheduleActorId",
  "nextAt",
  "scheduleReason",
] as const;
const researchVersionRecordsKeys = [
  "profileId",
  "actorId",
  "number",
  "createdAt",
  "config",
] as const;
const calibrationPurposesKeys = [
  "accountId",
  "version",
  "target",
  "rightsEvidence",
  "explanation",
  "approvedBy",
  "expiresAt",
  "retentionMs",
  "redactedAt",
  "createdAt",
  "generation",
] as const;
const calibrationControlsKeys = [
  "accountId",
  "revision",
  "activeDecisionId",
  "actorId",
  "updatedAt",
] as const;
export const family = v.union(
  v.literal("mediaManifest"),
  v.literal("accountRecords"),
  v.literal("githubConnections"),
  v.literal("embeddingPolicies"),
  v.literal("embeddingControls"),
  v.literal("performanceContentPolicies"),
  v.literal("researchPoliciesRecent"),
  v.literal("researchPoliciesTrends"),
  v.literal("researchPoliciesWeb"),
  v.literal("researchProfileRecords"),
  v.literal("researchVersionRecords"),
  v.literal("calibrationPurposes"),
  v.literal("calibrationControls"),
  v.literal("jevPolicies"),
  v.literal("jevAnalyzerControl"),
  v.literal("jevRoutingControl"),
  v.literal("jevVerificationControl"),
  v.literal("editorialExperiments"),
  v.literal("experimentCommands"),
  v.literal("experimentAssignments"),
  v.literal("experimentBindings"),
  v.literal("workspaceRecord"),
  v.literal("memberRecords"),
  v.literal("calibrationReferences"),
  v.literal("calibrationModels"),
);
export type RemainingFamily = Infer<typeof family>;
const referenceKind = v.union(v.literal("spec"), v.literal("snapshot"));
const modelKind = v.union(
  v.literal("experiment"),
  v.literal("candidate"),
  v.literal("evaluation"),
  v.literal("monitoring-declaration"),
  v.literal("monitoring-check"),
  v.literal("activation-decision"),
  v.literal("monitoring-tombstone"),
);
const kind = v.union(referenceKind, modelKind);
const compatibilityKeys = [
  "network",
  "format",
  "windowHours",
  "metricPolicyId",
  "metricVersion",
  "dialect",
  "replyField",
  "replyDefinition",
  "impressionField",
  "impressionDefinition",
  "algorithmId",
  "audienceId",
  "jevPolicyId",
  "jevPolicyVersion",
  "requestedModel",
  "resolvedModel",
  "questionVersion",
  "inputVersion",
  "normalizationVersion",
  "formulaVersion",
  "thresholdVersion",
] as const;
const refKeys = [
  "postAttemptId",
  "scheduleId",
  "versionId",
  "externalId",
  "knowledgeId",
  "assessmentId",
  "analysisReceiptId",
  "snapshotId",
  "metricReceiptId",
  "confirmedAt",
  "publishedAt",
  "observedAt",
  "assessmentAt",
  "capturedAt",
  "requestStartedAt",
  "sourceUntil",
  "originalUntil",
  "membership",
] as const;
const compatibilityDTO = v.object(
  pick(compatibility.fields, compatibilityKeys),
);
const refDTO = v.object(pick(ref.fields, refKeys));
const commonReferenceKeys = [
  "accountId",
  "purposeId",
  "generation",
  "actorId",
  "createdAt",
  "expiresAt",
  "kind",
  "specId",
] as const;
const specKeys = [
  "from",
  "fitCutoff",
  "holdout1Start",
  "holdout1End",
  "holdout2Start",
  "holdout2End",
  "mode",
  "target",
  "transfers",
  "empiricalPolicy",
  "prospectiveStatus",
  "activationEligible",
] as const;
const snapshotKeys = [
  "asOf",
  "frameEnd",
  "frameComplete",
  "scanned",
  "populationLowerBound",
  "populationTotal",
  "exclusions",
  "counts",
  "timeSpanMs",
  "engineeringScreen",
  "engineeringScreenBasis",
  "empiricalStatus",
  "activationEligible",
  "unknownSegments",
  "missingPolicies",
] as const;
const commonModelKeys = [
  "accountId",
  "purposeId",
  "generation",
  "actorId",
  "createdAt",
  "expiresAt",
  "kind",
  "specId",
  "experimentId",
] as const;
const modelExperimentKeys = [
  "from",
  "fitCutoff",
  "holdout1Start",
  "holdout1End",
  "holdout2Start",
  "holdout2End",
  "mode",
  "target",
  "transfers",
  "lossVersion",
  "predeclaredAt",
  "policy",
  "activationEligible",
] as const;
const candidateKeys = [
  "trainSnapshotId",
  "frozenAt",
  "transfer",
  "n",
  "spanMs",
  "trainLosses",
  "baseline",
  "selected",
  "status",
  "activationEligible",
] as const;
const evaluationKeys = [
  "candidateId",
  "snapshotId",
  "evaluatedAt",
  "asOf",
  "trainN",
  "trainSpanMs",
  "block1",
  "block2",
  "stability",
  "engineeringScreen",
  "engineeringScreenBasis",
  "scanned",
  "populationTotal",
  "populationLowerBound",
  "frameComplete",
  "excludedFraction",
  "exclusions",
  "unknownSegments",
  "reasons",
  "evidenceQualified",
  "activationEligible",
] as const;
const declarationKeys = [
  "version",
  "evaluationId",
  "policy",
  "firstEnd",
  "unusedSecondStart",
] as const;
const checkKeys = [
  "snapshotId",
  "computedAt",
  "asOf",
  "block",
  "excludedFraction",
  "coverageBasis",
  "status",
  "reasons",
] as const;
const activationKeys = [
  "action",
  "evaluationId",
  "candidateId",
  "checkId",
  "expectedRevision",
  "resultingRevision",
] as const;
const rollbackKeys = [
  "action",
  "expectedRevision",
  "resultingRevision",
  "formulaVersion",
  "thresholdVersion",
] as const;
const consent = v.union(
  v.null(),
  v.object({ actorId: v.id("users"), at: v.number() }),
);
const jevPolicyKeys = [
  "accountId",
  "version",
  "approvedBy",
  "expiresAt",
  "model",
  "currency",
  "pricingEvidence",
  "inputMicrosPerMillion",
  "outputMicrosPerMillion",
  "maxInputTokens",
  "maxOutputTokens",
  "euEvidence",
] as const;
const jevExtendedKeys = [
  "accountId",
  "version",
  "approvedBy",
  "expiresAt",
  "model",
  "currency",
  "pricingEvidence",
  "inputMicrosPerMillion",
  "outputMicrosPerMillion",
  "maxInputTokens",
  "maxOutputTokens",
  "euEvidence",
  "purpose",
  "processingRights",
  "questionVersion",
  "normalizationVersion",
  "thresholdVersion",
] as const;
const jevControlKeys = [
  "accountId",
  "enabled",
  "analyzer",
  "routing",
  "verification",
  "networkFit",
  "policyId",
  "composerTimeoutMs",
  "backgroundTimeoutMs",
] as const;
const jevExtendedControlKeys = [
  "accountId",
  "enabled",
  "analyzer",
  "routing",
  "verification",
  "networkFit",
  "policyId",
  "composerTimeoutMs",
  "backgroundTimeoutMs",
  "purpose",
  "withdrawn",
] as const;
const experimentKeys = [
  "accountId",
  "actorId",
  "membershipId",
  "revision",
  "state",
  "startSequence",
  "stopSequence",
  "startedAt",
  "stoppedAt",
  "endsAt",
  "sourceUntil",
  "sourceUnavailable",
  "createdAt",
] as const;
const experimentCommandKeys = [
  "accountId",
  "experimentId",
  "actorId",
  "revision",
  "sourceUnavailable",
  "createdAt",
] as const;
const experimentAssignmentKeys = [
  "accountId",
  "experimentId",
  "draftId",
  "versionId",
  "reviewerId",
  "reviewerMembershipId",
  "arm",
  "planItemId",
  "seriesVersionId",
  "sourceUntil",
  "sourceUnavailable",
] as const;
const experimentBindingKeys = [
  "accountId",
  "assignmentId",
  "vectorId",
  "draftVersionId",
  "snapshotId",
  "sourceUntil",
  "sourceUnavailable",
] as const;
const specDTO = v.object({
  ...pick(experimentSpec.fields, [
    "hypothesis",
    "dimension",
    "a",
    "b",
    "outcome",
    "startsAt",
    "endsAt",
    "sampleCap",
    "stopCondition",
    "context",
    "frequency",
  ]),
  publication: v.optional(
    v.object(
      pick(publicationSpec.fields, [
        "metric",
        "windowHours",
        "policyId",
        "rightsEvidence",
        "explanation",
        "expiresAt",
      ]),
    ),
  ),
});
const styleDTO = v.union(
  v.null(),
  v.object({
    versionId: v.id("styleProfileVersions"),
    selectedBy: v.id("users"),
    selectionReceiptId: v.id("styleProfileCommands"),
    sourceUntil: v.union(v.number(), v.null()),
  }),
);
const publicationDTO = v.optional(
  v.union(
    v.null(),
    v.object({
      scheduleId: v.id("schedules"),
      approvalId: v.id("approvals"),
      generation: v.number(),
      admittedAt: v.number(),
    }),
  ),
);
const row = v.union(
  v.object({
    id: v.id("editorialExperiments"),
    createdInDatabaseAt: v.number(),
    ...pick(editorialExperimentFields, experimentKeys),
    spec: v.union(v.null(), specDTO),
  }),
  v.object({
    id: v.id("editorialExperimentCommands"),
    createdInDatabaseAt: v.number(),
    ...pick(experimentCommandFields, experimentCommandKeys),
  }),
  v.object({
    id: v.id("editorialExperimentAssignments"),
    createdInDatabaseAt: v.number(),
    ...pick(experimentAssignmentFields, experimentAssignmentKeys),
    style: styleDTO,
    publication: publicationDTO,
  }),
  v.object({
    id: v.id("editorialExperimentBindings"),
    createdInDatabaseAt: v.number(),
    ...pick(experimentBindingFields, experimentBindingKeys),
  }),
  v.object({
    id: v.id("jevPolicies"),
    createdInDatabaseAt: v.number(),
    policyKind: v.literal("analyzer"),
    ...pick(jevPolicyFields, jevPolicyKeys),
  }),
  v.object({
    id: v.id("jevPolicies"),
    createdInDatabaseAt: v.number(),
    policyKind: v.literal("routing"),
    ...pick(routingPolicyFields, jevExtendedKeys),
  }),
  v.object({
    id: v.id("jevPolicies"),
    createdInDatabaseAt: v.number(),
    policyKind: v.literal("verification"),
    ...pick(verificationPolicyFields, jevExtendedKeys),
  }),
  v.object({
    id: v.id("jevControls"),
    createdInDatabaseAt: v.number(),
    policyKind: v.literal("analyzer"),
    ...pick(jevControlFields, jevControlKeys),
  }),
  v.object({
    id: v.id("jevControls"),
    createdInDatabaseAt: v.number(),
    policyKind: v.literal("routing"),
    ...pick(routingControlFields, jevExtendedControlKeys),
  }),
  v.object({
    id: v.id("jevControls"),
    createdInDatabaseAt: v.number(),
    policyKind: v.literal("verification"),
    ...pick(verificationControlFields, jevExtendedControlKeys),
  }),
  v.object({
    id: v.id("calibrationReferences"),
    createdInDatabaseAt: v.number(),
    ...pick(specFields, commonReferenceKeys),
    payload: v.object({
      ...pick(specFields.payload.fields, specKeys),
      compatibility: compatibilityDTO,
      anchor: v.object({
        ...pick(ref.fields, refKeys),
        membership: v.literal("compatibility-anchor"),
      }),
    }),
  }),
  v.object({
    id: v.id("calibrationReferences"),
    createdInDatabaseAt: v.number(),
    ...pick(snapshotFields, commonReferenceKeys),
    payload: v.object({
      ...pick(snapshotFields.payload.fields, snapshotKeys),
      refs: v.array(refDTO),
    }),
  }),
  v.object({
    id: v.id("calibrationModels"),
    createdInDatabaseAt: v.number(),
    ...pick(modelExperimentFields, commonModelKeys),
    payload: v.object({
      ...pick(modelExperimentFields.payload.fields, modelExperimentKeys),
      compatibility: compatibilityDTO,
    }),
  }),
  v.object({
    id: v.id("calibrationModels"),
    createdInDatabaseAt: v.number(),
    ...pick(candidateFields, commonModelKeys),
    payload: v.object({
      ...pick(candidateFields.payload.fields, candidateKeys),
      manifest: v.array(refDTO),
    }),
  }),
  v.object({
    id: v.id("calibrationModels"),
    createdInDatabaseAt: v.number(),
    ...pick(evaluationFields, commonModelKeys),
    payload: v.object({
      ...pick(evaluationFields.payload.fields, evaluationKeys),
      compatibility: compatibilityDTO,
    }),
  }),
  v.object({
    id: v.id("calibrationModels"),
    createdInDatabaseAt: v.number(),
    ...pick(declarationFields, commonModelKeys),
    candidateId: declarationFields.candidateId,
    declarationId: declarationFields.declarationId,
    payload: v.object({
      ...pick(declarationFields.payload.fields, declarationKeys),
      compatibility: compatibilityDTO,
    }),
  }),
  v.object({
    id: v.id("calibrationModels"),
    createdInDatabaseAt: v.number(),
    ...pick(checkFields, commonModelKeys),
    candidateId: checkFields.candidateId,
    declarationId: checkFields.declarationId,
    blockNumber: checkFields.blockNumber,
    payload: v.object({ ...pick(checkFields.payload.fields, checkKeys) }),
  }),
  v.object({
    id: v.id("calibrationModels"),
    createdInDatabaseAt: v.number(),
    ...pick(activationFields, commonModelKeys),
    declarationId: activationFields.declarationId,
    payload: v.object({
      ...pick(activationFields.payload.fields, activationKeys),
    }),
  }),
  v.object({
    id: v.id("calibrationModels"),
    createdInDatabaseAt: v.number(),
    ...pick(rollbackFields, ["accountId", "actorId", "createdAt", "kind"]),
    payload: v.object(pick(rollbackFields.payload.fields, rollbackKeys)),
  }),
  v.object({
    id: v.id("calibrationModels"),
    createdInDatabaseAt: v.number(),
    ...pick(tombstoneFields, [
      "accountId",
      "kind",
      "createdAt",
      "expiresAt",
      "candidateId",
      "declarationId",
      "blockNumber",
    ]),
  }),
  v.object({
    id: v.id("mediaAssets"),
    createdInDatabaseAt: v.number(),
    ...pick(assetFields, mediaManifestKeys),
  }),
  v.object({
    id: v.id("socialAccounts"),
    createdInDatabaseAt: v.number(),
    ...pick(accountFields, accountRecordsKeys),
    xEvidence: v.optional(
      v.object({
        ...pick(xEvidence.fields, [
          "scopes",
          "identityVerifiedAt",
          "textScopeEligible",
          "mediaScopeEligible",
          "liveWrite",
          "remoteRevocation",
        ]),
        writeProof: v.optional(
          v.object({
            externalId: v.string(),
            attemptId: v.id("xPostAttempts"),
            confirmedAt: v.number(),
          }),
        ),
      }),
    ),
  }),
  v.object({
    id: v.id("githubConnections"),
    createdInDatabaseAt: v.number(),
    ...pick(connectionFields, githubConnectionsKeys),
  }),
  v.object({
    id: v.id("embeddingPolicies"),
    createdInDatabaseAt: v.number(),
    ...pick(embeddingPolicyFields, embeddingPoliciesKeys),
  }),
  v.object({
    id: v.id("embeddingControls"),
    createdInDatabaseAt: v.number(),
    ...pick(embeddingControlFields, embeddingControlsKeys),
  }),
  v.object({
    id: v.id("performanceContentPolicies"),
    createdInDatabaseAt: v.number(),
    ...pick(contentPerformancePolicyFields, performanceContentPoliciesKeys),
  }),
  v.object({
    id: v.id("researchSourcePolicies"),
    createdInDatabaseAt: v.number(),
    ...pick(researchPolicyFields, researchPoliciesRecentKeys),
  }),
  v.object({
    id: v.id("researchSourcePolicies"),
    createdInDatabaseAt: v.number(),
    ...pick(researchPolicyFields, researchPoliciesTrendsKeys),
  }),
  v.object({
    id: v.id("researchSourcePolicies"),
    createdInDatabaseAt: v.number(),
    ...pick(researchPolicyFields, researchPoliciesWebKeys),
  }),
  v.object({
    id: v.id("researchProfiles"),
    createdInDatabaseAt: v.number(),
    ...pick(researchProfileFields, researchProfileRecordsKeys),
    activation: v.union(
      v.null(),
      v.object({
        kind: v.literal("research-workflow-v1"),
        language: v.string(),
        operations: v.array(
          v.union(
            v.literal("x-recent"),
            v.literal("x-trends"),
            v.literal("web-search"),
          ),
        ),
      }),
      v.object({
        kind: v.literal("research-workflow-v2"),
        language: v.string(),
        operations: v.array(
          v.union(
            v.literal("x-recent"),
            v.literal("x-trends"),
            v.literal("web-search"),
          ),
        ),
        autoHandoff: v.object({
          count: v.number(),
          target: v.union(v.literal("idea"), v.literal("draft")),
          intent: v.string(),
        }),
      }),
    ),
  }),
  v.object({
    id: v.id("researchProfileVersions"),
    createdInDatabaseAt: v.number(),
    ...pick(researchVersionFields, researchVersionRecordsKeys),
  }),
  v.object({
    id: v.id("calibrationPurposes"),
    createdInDatabaseAt: v.number(),
    ...pick(purposeFields, calibrationPurposesKeys),
    consent,
    withdrawal: consent,
  }),
  v.object({
    id: v.id("calibrationControls"),
    createdInDatabaseAt: v.number(),
    ...pick(calibrationControlFields, calibrationControlsKeys),
  }),
  v.object({
    id: v.id("workspaces"),
    createdInDatabaseAt: v.number(),
    name: v.string(),
    description: v.string(),
    lifecycle: v.optional(
      v.union(v.literal("active"), v.literal("deleting"), v.literal("deleted")),
    ),
    teamRevision: v.optional(v.number()),
  }),
  v.object({
    id: v.id("memberships"),
    createdInDatabaseAt: v.number(),
    userId: v.id("users"),
    role,
  }),
);
export const page = workspaceQuery({
  args: {
    expectedAuthId: v.string(),
    expectedSessionId: v.string(),
    requestKey: v.string(),
    family,
    kind: v.optional(kind),
    accountId: v.optional(v.id("socialAccounts")),
    experimentId: v.optional(v.id("editorialExperiments")),
    assignmentId: v.optional(v.id("editorialExperimentAssignments")),
    profileId: v.optional(v.id("researchProfiles")),
    cursor: v.union(v.string(), v.null()),
    creationUpperBound: v.union(v.number(), v.null()),
    narrowPage: v.optional(v.boolean()),
  },
  returns: v.object({
    authId: v.string(),
    sessionId: v.string(),
    requestKey: v.string(),
    workspaceId: v.id("workspaces"),
    role,
    observedAt: v.number(),
    proofValidUntil: v.number(),
    creationUpperBound: v.number(),
    cursor: v.string(),
    isDone: v.boolean(),
    accountId: v.union(v.id("socialAccounts"), v.null()),
    experimentId: v.union(v.id("editorialExperiments"), v.null()),
    assignmentId: v.union(v.id("editorialExperimentAssignments"), v.null()),
    profileId: v.union(v.id("researchProfiles"), v.null()),
    kind: v.union(kind, v.null()),
    data: v.object({
      format: v.literal("dispatch-workspace-records"),
      version: v.literal(1),
      workspaceId: v.id("workspaces"),
      selection: v.object({ family, rows: v.array(row) }),
    }),
  }),
  handler: async (original, a) => {
    const sessionId = (await original.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string" || !sessionId)
      throw new ConvexError("Unauthenticated");
    if (
      !a.expectedAuthId ||
      a.expectedAuthId.length > 256 ||
      !a.expectedSessionId ||
      a.expectedSessionId.length > 256 ||
      !a.requestKey ||
      a.requestKey.length > 64
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      a.expectedAuthId !== original.user.authId ||
      a.expectedSessionId !== sessionId ||
      original.user.activeWorkspaceId !== original.workspace._id
    )
      throw new ConvexError("EXPORT_SCOPE_CHANGED");
    requireRole(original.membership, ["Owner", "Admin"]);
    const accountRequired = ![
      "mediaManifest",
      "accountRecords",
      "githubConnections",
      "workspaceRecord",
      "memberRecords",
    ].includes(a.family);
    if (
      accountRequired !== (a.accountId !== undefined) ||
      (a.family === "researchVersionRecords") !== (a.profileId !== undefined)
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      (a.family === "calibrationReferences" ||
        a.family === "calibrationModels") !==
        (a.kind !== undefined) ||
      (a.family === "calibrationReferences" &&
        a.kind !== "spec" &&
        a.kind !== "snapshot") ||
      (a.family === "calibrationModels" &&
        (a.kind === "spec" || a.kind === "snapshot"))
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      [
        "experimentCommands",
        "experimentAssignments",
        "experimentBindings",
      ].includes(a.family) !==
        (a.experimentId !== undefined) ||
      (a.family === "experimentBindings") !== (a.assignmentId !== undefined)
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const observedAt = Date.now();
    numeric(a);
    numeric(observedAt);
    if (
      observedAt < 0 ||
      (a.cursor === null) !== (a.creationUpperBound === null) ||
      (a.cursor !== null && (!a.cursor || a.cursor.length > 16384)) ||
      (a.creationUpperBound !== null &&
        (a.creationUpperBound < 0 || a.creationUpperBound > observedAt))
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const ws = original.workspace._id,
      ctx = proofContext(original, ws),
      creationUpperBound = a.creationUpperBound ?? observedAt;
    if (a.accountId) requireReference(ws, await ctx.db.get(a.accountId));
    if (a.profileId) {
      const p = await ctx.db.get(a.profileId);
      binding(p && p.accountId === a.accountId);
    }
    let proofValidUntil = observedAt + 30000;
    const horizon = (n: number) => {
      numeric(n);
      if (n <= observedAt) throw new ConvexError("EXPORT_SOURCE_UNAVAILABLE");
      proofValidUntil = Math.min(proofValidUntil, n);
    };
    let selected: { continueCursor: string; isDone: boolean };
    const rows: Infer<typeof row>[] = [];
    const narrow = a.narrowPage === true;
    switch (a.family) {
      case "mediaManifest": {
        const p = await ctx.db
          .query("mediaAssets")
          .withIndex("by_workspaceId", (q) =>
            q.eq("workspaceId", ws).lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, mediaManifestKeys),
          });
        }
        break;
      }
      case "accountRecords": {
        const p = await ctx.db
          .query("socialAccounts")
          .withIndex("by_workspaceId", (q) =>
            q.eq("workspaceId", ws).lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          if (r.xEvidence?.writeProof) {
            const proof = r.xEvidence.writeProof;
            const attempt = await ctx.db.get(proof.attemptId);
            binding(
              attempt &&
                attempt.accountId === r._id &&
                attempt.providerIdentity === r.providerIdentity &&
                attempt.stage === "confirmed" &&
                attempt.externalId === proof.externalId &&
                attempt.confirmedAt === proof.confirmedAt,
            );
            const schedule = await ctx.db.get(attempt.scheduleId),
              version = await ctx.db.get(attempt.versionId);
            binding(
              schedule &&
                version &&
                version.draftId === schedule.draftId &&
                version.content.accountId === r._id,
            );
            binding(await ctx.db.get(version.draftId));
          }
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...(r.xEvidence
              ? {
                  xEvidence: {
                    ...pick(r.xEvidence, [
                      "scopes",
                      "identityVerifiedAt",
                      "textScopeEligible",
                      "mediaScopeEligible",
                      "liveWrite",
                      "remoteRevocation",
                    ]),
                    ...(r.xEvidence.writeProof
                      ? {
                          writeProof: pick(r.xEvidence.writeProof, [
                            "externalId",
                            "attemptId",
                            "confirmedAt",
                          ]),
                        }
                      : {}),
                  },
                }
              : {}),
            ...pick(r, accountRecordsKeys),
          });
        }
        break;
      }
      case "githubConnections": {
        const p = await ctx.db
          .query("githubConnections")
          .withIndex("by_workspaceId", (q) =>
            q.eq("workspaceId", ws).lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, githubConnectionsKeys),
          });
        }
        break;
      }
      case "embeddingPolicies": {
        const p = await ctx.db
          .query("embeddingPolicies")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, embeddingPoliciesKeys),
          });
        }
        break;
      }
      case "embeddingControls": {
        const p = await ctx.db
          .query("embeddingControls")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          const policy = await ctx.db.get(r.policyId);
          binding(policy && policy.accountId === r.accountId);
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, embeddingControlsKeys),
          });
        }
        break;
      }
      case "performanceContentPolicies": {
        const p = await ctx.db
          .query("performanceContentPolicies")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, performanceContentPoliciesKeys),
          });
        }
        break;
      }
      case "researchPoliciesRecent": {
        const p = await ctx.db
          .query("researchSourcePolicies")
          .withIndex("by_workspaceId_and_accountId_and_operation", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("operation", "x-recent")
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, researchPoliciesRecentKeys),
          });
        }
        break;
      }
      case "researchPoliciesTrends": {
        const p = await ctx.db
          .query("researchSourcePolicies")
          .withIndex("by_workspaceId_and_accountId_and_operation", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("operation", "x-trends")
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, researchPoliciesTrendsKeys),
          });
        }
        break;
      }
      case "researchPoliciesWeb": {
        const p = await ctx.db
          .query("researchSourcePolicies")
          .withIndex("by_workspaceId_and_accountId_and_operation", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("operation", "web-search")
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, researchPoliciesWebKeys),
          });
        }
        break;
      }
      case "researchProfileRecords": {
        const p = await ctx.db
          .query("researchProfiles")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          if (r.currentVersionId) {
            const version = await ctx.db.get(r.currentVersionId);
            binding(version && version.profileId === r._id);
          }
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, researchProfileRecordsKeys),
            activation: r.workflowActivation
              ? r.workflowActivation.kind === "research-workflow-v1"
                ? pick(r.workflowActivation, ["kind", "language", "operations"])
                : pick(r.workflowActivation, [
                    "kind",
                    "language",
                    "operations",
                    "autoHandoff",
                  ])
              : null,
          });
        }
        break;
      }
      case "researchVersionRecords": {
        const p = await ctx.db
          .query("researchProfileVersions")
          .withIndex("by_profileId", (q) =>
            q
              .eq("profileId", a.profileId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, researchVersionRecordsKeys),
          });
        }
        break;
      }
      case "calibrationPurposes": {
        const p = await ctx.db
          .query("calibrationPurposes")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, calibrationPurposesKeys),
            consent:
              r.consent === null ? null : pick(r.consent, ["actorId", "at"]),
            withdrawal:
              r.withdrawal === null
                ? null
                : pick(r.withdrawal, ["actorId", "at"]),
          });
        }
        break;
      }
      case "calibrationControls": {
        const p = await ctx.db
          .query("calibrationControls")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, calibrationControlsKeys),
          });
        }
        break;
      }
      case "calibrationReferences": {
        const p = await ctx.db
          .query("calibrationReferences")
          .withIndex("by_workspaceId_and_accountId_and_kind", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("kind", a.kind as "spec" | "snapshot")
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(r.accountId === a.accountId);
          const scope = { workspaceId: ws, accountId: a.accountId! };
          if (r.kind === "spec") {
            horizon((await readableSpec(ctx, scope, r._id)).horizon);
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, commonReferenceKeys),
              payload: {
                ...pick(r.payload, specKeys),
                compatibility: pick(r.payload.compatibility, compatibilityKeys),
                anchor: pick(r.payload.anchor, refKeys),
              },
            });
          } else {
            horizon((await readableSnapshot(ctx, scope, r)).row.expiresAt);
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, commonReferenceKeys),
              payload: {
                ...pick(r.payload, snapshotKeys),
                refs: r.payload.refs.map((x) => pick(x, refKeys)),
              },
            });
          }
        }
        break;
      }
      case "calibrationModels": {
        const p = await ctx.db
          .query("calibrationModels")
          .withIndex("by_workspaceId_and_accountId_and_kind", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("kind", a.kind as Infer<typeof modelKind>)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(r.accountId === a.accountId);
          const h = await readableModel(
            ctx,
            { workspaceId: ws, accountId: a.accountId! },
            r,
          );
          if (!(
            r.kind === "activation-decision" &&
            r.payload.action === "rollback-static" &&
            h === Infinity
          ))
            horizon(h);
          const system = { id: r._id, createdInDatabaseAt: r._creationTime };
          switch (r.kind) {
            case "experiment":
              rows.push({
                ...system,
                ...pick(r, commonModelKeys),
                payload: {
                  ...pick(r.payload, modelExperimentKeys),
                  compatibility: pick(
                    r.payload.compatibility,
                    compatibilityKeys,
                  ),
                },
              });
              break;
            case "candidate":
              rows.push({
                ...system,
                ...pick(r, commonModelKeys),
                payload: {
                  ...pick(r.payload, candidateKeys),
                  manifest: r.payload.manifest.map((x) => pick(x, refKeys)),
                },
              });
              break;
            case "evaluation":
              rows.push({
                ...system,
                ...pick(r, commonModelKeys),
                payload: {
                  ...pick(r.payload, evaluationKeys),
                  compatibility: pick(
                    r.payload.compatibility,
                    compatibilityKeys,
                  ),
                },
              });
              break;
            case "monitoring-declaration":
              rows.push({
                ...system,
                ...pick(r, commonModelKeys),
                candidateId: r.candidateId,
                declarationId: r.declarationId,
                payload: {
                  ...pick(r.payload, declarationKeys),
                  compatibility: pick(
                    r.payload.compatibility,
                    compatibilityKeys,
                  ),
                },
              });
              break;
            case "monitoring-check":
              rows.push({
                ...system,
                ...pick(r, commonModelKeys),
                candidateId: r.candidateId,
                declarationId: r.declarationId,
                blockNumber: r.blockNumber,
                payload: pick(r.payload, checkKeys),
              });
              break;
            case "activation-decision":
              if (r.payload.action === "rollback-static") {
                rows.push({
                  ...system,
                  ...pick(r, ["accountId", "actorId", "createdAt", "kind"]),
                  payload: pick(r.payload, rollbackKeys),
                });
              } else {
                const x = r as Extract<typeof r, { declarationId: unknown }>;
                rows.push({
                  ...system,
                  ...pick(x, commonModelKeys),
                  declarationId: x.declarationId,
                  payload: pick(x.payload, activationKeys),
                });
              }
              break;
            case "monitoring-tombstone":
              rows.push({
                ...system,
                ...pick(r, [
                  "accountId",
                  "kind",
                  "createdAt",
                  "expiresAt",
                  "candidateId",
                  "declarationId",
                  "blockNumber",
                ]),
              });
              break;
          }
        }
        break;
      }
      case "jevPolicies": {
        const p = await ctx.db
          .query("jevPolicies")
          .withIndex("by_scope", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(r.accountId === a.accountId);
          if (!("purpose" in r))
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              policyKind: "analyzer",
              ...pick(r, jevPolicyKeys),
            });
          else if (r.purpose === "intent-routing")
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              policyKind: "routing",
              ...pick(r, jevExtendedKeys),
            });
          else
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              policyKind: "verification",
              ...pick(r, jevExtendedKeys),
            });
        }
        break;
      }
      case "jevAnalyzerControl":
      case "jevRoutingControl":
      case "jevVerificationControl": {
        if (a.cursor !== null) throw new ConvexError("EXPORT_REQUEST_INVALID");
        const prefix =
          a.family === "jevAnalyzerControl"
            ? ""
            : a.family === "jevRoutingControl"
              ? "routing:"
              : "verification:";
        const r = await ctx.db
          .query("jevControls")
          .withIndex("by_key", (q) =>
            q.eq("key", `${prefix}account:${a.accountId}`),
          )
          .unique();
        if (r) {
          binding(r.workspaceId === ws && r.accountId === a.accountId);
          binding(
            a.family === "jevAnalyzerControl"
              ? !("purpose" in r)
              : "purpose" in r &&
                  r.purpose ===
                    (a.family === "jevRoutingControl"
                      ? "intent-routing"
                      : "output-verification"),
          );
          if (r.policyId) {
            const p = await ctx.db.get(r.policyId);
            binding(
              p &&
                p.accountId === a.accountId &&
                ("purpose" in r
                  ? "purpose" in p && p.purpose === r.purpose
                  : !("purpose" in p)),
            );
          }
          if (r._creationTime <= creationUpperBound) {
            if (!("purpose" in r))
              rows.push({
                id: r._id,
                createdInDatabaseAt: r._creationTime,
                policyKind: "analyzer",
                ...pick(r, jevControlKeys),
              });
            else if (r.purpose === "intent-routing")
              rows.push({
                id: r._id,
                createdInDatabaseAt: r._creationTime,
                policyKind: "routing",
                ...pick(r, jevExtendedControlKeys),
              });
            else
              rows.push({
                id: r._id,
                createdInDatabaseAt: r._creationTime,
                policyKind: "verification",
                ...pick(r, jevExtendedControlKeys),
              });
          }
        }
        selected = { continueCursor: "complete", isDone: true };
        break;
      }
      case "editorialExperiments": {
        const p = await ctx.db
          .query("editorialExperiments")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(r.accountId === a.accountId);
          let spec: Infer<typeof specDTO> | null = null;
          if (!r.sourceUnavailable) {
            await experimentAuthority(ctx, r);
            if (r.sourceUntil !== null) horizon(r.sourceUntil);
            if (r.spec) {
              spec = {
                ...pick(r.spec, [
                  "hypothesis",
                  "dimension",
                  "a",
                  "b",
                  "outcome",
                  "startsAt",
                  "endsAt",
                  "sampleCap",
                  "stopCondition",
                  "context",
                  "frequency",
                ]),
                ...(r.spec.publication
                  ? {
                      publication: pick(r.spec.publication, [
                        "metric",
                        "windowHours",
                        "policyId",
                        "rightsEvidence",
                        "explanation",
                        "expiresAt",
                      ]),
                    }
                  : {}),
              };
            }
          }
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, experimentKeys),
            spec,
          });
        }
        break;
      }
      case "experimentCommands":
      case "experimentAssignments":
      case "experimentBindings": {
        const e = await ctx.db.get(a.experimentId!);
        binding(e && e.accountId === a.accountId);
        if (!e.sourceUnavailable) {
          await experimentAuthority(ctx, e);
          if (e.sourceUntil !== null) horizon(e.sourceUntil);
        }
        if (a.family === "experimentCommands") {
          const p = await ctx.db
            .query("editorialExperimentCommands")
            .withIndex("by_experimentId", (q) =>
              q
                .eq("experimentId", e._id)
                .lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            binding(r.accountId === a.accountId && r.experimentId === e._id);
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, experimentCommandKeys),
            });
          }
        } else if (a.family === "experimentAssignments") {
          const p = await ctx.db
            .query("editorialExperimentAssignments")
            .withIndex("by_experimentId", (q) =>
              q
                .eq("experimentId", e._id)
                .lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            binding(r.accountId === a.accountId && r.experimentId === e._id);
            if (!r.sourceUnavailable) {
              binding(!e.sourceUnavailable);
              const h = await assignmentProof(ctx, r);
              if (h !== null) horizon(h);
            }
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, experimentAssignmentKeys),
              style:
                r.sourceUnavailable || !r.style
                  ? null
                  : pick(r.style, [
                      "versionId",
                      "selectedBy",
                      "selectionReceiptId",
                      "sourceUntil",
                    ]),
              ...(r.publication !== undefined
                ? {
                    publication:
                      r.publication === null
                        ? null
                        : pick(r.publication, [
                            "scheduleId",
                            "approvalId",
                            "generation",
                            "admittedAt",
                          ]),
                  }
                : {}),
            });
          }
        } else {
          const assignment = await ctx.db.get(a.assignmentId!);
          binding(
            assignment &&
              assignment.accountId === a.accountId &&
              assignment.experimentId === e._id,
          );
          if (!assignment.sourceUnavailable) {
            binding(!e.sourceUnavailable);
            const h = await assignmentProof(ctx, assignment);
            if (h !== null) horizon(h);
          }
          const p = await ctx.db
            .query("editorialExperimentBindings")
            .withIndex("by_assignmentId", (q) =>
              q
                .eq("assignmentId", assignment._id)
                .lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            binding(
              r.accountId === a.accountId && r.assignmentId === assignment._id,
            );
            if (!r.sourceUnavailable) {
              binding(!assignment.sourceUnavailable);
              if (r.sourceUntil !== null) horizon(r.sourceUntil);
            }
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, experimentBindingKeys),
            });
          }
        }
        break;
      }
      case "workspaceRecord": {
        if (a.cursor !== null) throw new ConvexError("EXPORT_REQUEST_INVALID");
        const r = original.workspace;
        numeric(r);
        rows.push({
          id: r._id,
          createdInDatabaseAt: r._creationTime,
          ...pick(r, ["name", "description", "lifecycle", "teamRevision"]),
        });
        selected = { continueCursor: "complete", isDone: true };
        break;
      }
      case "memberRecords": {
        const p = await ctx.db
          .query("memberships")
          .withIndex("by_workspaceId", (q) =>
            q.eq("workspaceId", ws).lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page)
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            userId: r.userId,
            role: r.role,
          });
        break;
      }
    }
    const result = {
      authId: original.user.authId,
      sessionId,
      requestKey: a.requestKey,
      workspaceId: ws,
      role: original.membership.role,
      observedAt,
      proofValidUntil,
      creationUpperBound,
      cursor: selected.continueCursor,
      isDone: selected.isDone,
      accountId: a.accountId ?? null,
      experimentId: a.experimentId ?? null,
      assignmentId: a.assignmentId ?? null,
      profileId: a.profileId ?? null,
      kind: a.kind ?? null,
      data: {
        format: "dispatch-workspace-records" as const,
        version: 1 as const,
        workspaceId: ws,
        selection: { family: a.family, rows },
      },
    };
    numeric(result);
    const now = Date.now();
    numeric(now);
    const sizeOver =
      new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024;
    // A multi-row page that only overflows in combination is retryable one
    // row at a time; a lone oversized row keeps the terminal error below.
    if (sizeOver && a.narrowPage !== true && rows.length > 1)
      throw new ConvexError("EXPORT_PAGE_OVERSIZED");
    if (now < observedAt || now >= result.proofValidUntil || sizeOver)
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
