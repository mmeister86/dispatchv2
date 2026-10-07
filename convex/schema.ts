import { teamResult, deliveryFields } from "./teamFields";
import {
  experimentFields,
  commandFields as experimentCommandFields,
  assignmentFields as experimentAssignmentFields,
  bindingFields as experimentBindingFields,
} from "./performance/experimentFields";
import {
  controlFields as seriesControlFields,
  versionFields as seriesVersionFields,
  commandFields as seriesCommandFields,
  bindingFields as semanticBindingFields,
} from "./planning/strategyFields";
import {
  policyFields as embeddingPolicyFields,
  controlFields as embeddingControlFields,
  vectorFields as embeddingVectorFields,
  attemptFields as embeddingAttemptFields,
} from "./content/similarityFields";
import {
  versionFields as styleVersionFields,
  controlFields as styleControlFields,
  commandFields as styleCommandFields,
  proposalFields as styleProposalFields,
} from "./ai/styleFields";
import {
  modelFields as calibrationModelFields,
  calibrationControlFields,
} from "./performance/modelFields";
import {
  purposeFields as calibrationPurposeFields,
  referenceFields as calibrationReferenceFields,
} from "./performance/calibrationFields";
import { planFields, itemFields } from "./planning/fields";
import { contentPerformancePolicyFields } from "./content/performanceFields";
import {
  historyPolicyFields,
  historyControlFields,
  historyJobFields,
  historyPostFields,
  historyAttemptFields,
} from "./performance/historyFields";
import { feedbackFields as contentFeedbackFields } from "./content/feedbackFields";
import {
  policyFields as performancePolicyFields,
  controlFields as performanceControlFields,
  knowledgeFields,
  snapshotFields,
  metricsAttemptFields,
} from "./performance/fields";
import { receiptFields as recommendationReceiptFields } from "./intelligence/recommendationEdits";
import {
  assessmentFields,
  assessmentRequestFields,
} from "./intelligence/assessmentFields";
import {
  policyFields as jevPolicyFields,
  controlFields as jevControlFields,
  attemptFields as jevAttemptFields,
} from "./ai/jev/types";
import {
  sourceUpdateFields,
  algorithmFields as intelligenceAlgorithmFields,
  audienceFields as intelligenceAudienceFields,
  selectionFields as intelligenceSelectionFields,
  receiptFields as intelligenceReceiptFields,
} from "./intelligence/sharedFields";
import { clusterFields, bindingFields } from "./research/pipelineFields";
import { evidenceFields } from "./research/evidenceFields";
import {
  policyFields as researchSourcePolicyFields,
  sourceFields as researchSourceFields,
  cacheFields as researchCacheFields,
  nativeAttemptFields,
} from "./research/providerFields";
import {
  profileFields as researchProfileFields,
  versionFields as researchVersionFields,
  orderFields as researchOrderFields,
} from "./research/fields";
import { contextFields } from "./integrations/github/contextFields";
import {
  ideaFields,
  ideaVersionFields,
  feedbackFields,
  requestFields,
} from "./content/ideaFields";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  source as agentSource,
  policyFields,
  budgetFields,
  runFields,
  attemptFields as aiAttemptFields,
} from "./ai/fields";
import { stateFields, credentialFields } from "./integrations/x/fields";
import {
  connectionFields as githubConnectionFields,
  stateFields as githubStateFields,
  repoFields as githubRepoFields,
} from "./integrations/github/fields";
import { attemptFields } from "./publishing/postFields";
import { checkpointFields } from "./publishing/mediaFields";
import {
  receiptFields,
  signalFields,
  recoveryFields,
} from "./integrations/github/signalFields";

import {
  accountFields,
  assetFields,
  draftFields,
  versionFields,
  approvalFields,
  scheduleFields,
  eventFields,
  notificationFields,
  commentFields,
} from "./lib/editorialFields";

export const role = v.union(
  v.literal("Owner"),
  v.literal("Admin"),
  v.literal("Editor"),
  v.literal("Viewer"),
);
export const profileFields = {
  timezone: v.string(),
  language: v.union(v.literal("Deutsch"), v.literal("English")),
  audience: v.string(),
  tone: v.string(),
  topics: v.string(),
  name: v.string(),
  onboardingDone: v.boolean(),
  onboardingStep: v.number(),
};
export const profile = v.object(profileFields);
export default defineSchema({
  embeddingPolicies: defineTable(embeddingPolicyFields)
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_workspaceId_and_accountId_and_version", [
      "workspaceId",
      "accountId",
      "version",
    ]),
  embeddingControls: defineTable(embeddingControlFields).index(
    "by_workspaceId_and_accountId",
    ["workspaceId", "accountId"],
  ),
  contentEmbeddings: defineTable(embeddingVectorFields)
    .index("by_sourcePin_historyPostId", ["sourcePin.historyPostId"])
    .index("by_sourcePin_draftVersionId", ["sourcePin.draftVersionId"])
    .index("by_controlId", ["controlId"])
    .index("by_actorId", ["actorId"])
    .index("by_sourceUntil", ["sourceUntil"]),
  styleProfileVersions: defineTable(styleVersionFields)
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_proposalId_and_sourceUnavailable", [
      "proposalId",
      "sourceUnavailable",
    ])
    .index("by_baseVersionId_and_sourceUnavailable", [
      "baseVersionId",
      "sourceUnavailable",
    ])
    .index("by_sourceUnavailable", ["sourceUnavailable"]),
  styleProfileControls: defineTable(styleControlFields).index(
    "by_workspaceId_and_accountId",
    ["workspaceId", "accountId"],
  ),
  styleProfileCommands: defineTable(styleCommandFields)
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_workspaceId_and_accountId_and_actorId_and_commandKey", [
      "workspaceId",
      "accountId",
      "actorId",
      "commandKey",
    ])
    .index("by_versionId_and_sourceUnavailable", [
      "versionId",
      "sourceUnavailable",
    ])
    .index("by_proposalId_and_sourceUnavailable", [
      "proposalId",
      "sourceUnavailable",
    ])
    .index("by_sourceUnavailable", ["sourceUnavailable"]),
  learningProposals: defineTable(styleProposalFields)
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_feedbackId_and_sourceUnavailable", [
      "feedbackId",
      "sourceUnavailable",
    ])
    .index("by_baseVersionId_and_sourceUnavailable", [
      "baseVersionId",
      "sourceUnavailable",
    ])
    .index("by_sourceUnavailable", ["sourceUnavailable"]),
  calibrationControls: defineTable(calibrationControlFields).index(
    "by_workspaceId_and_accountId",
    ["workspaceId", "accountId"],
  ),
  calibrationModels: defineTable(calibrationModelFields)
    .index("by_workspaceId_and_accountId_and_kind_and_createdAt", [
      "workspaceId",
      "accountId",
      "kind",
      "createdAt",
    ])
    .index("by_workspaceId_and_actorId_and_commandKey", [
      "workspaceId",
      "actorId",
      "commandKey",
    ])
    .index("by_candidateId_and_kind", ["candidateId", "kind"])
    .index("by_declarationId_and_blockNumber", ["declarationId", "blockNumber"])
    .index("by_specId_and_kind", ["specId", "kind"])
    .index("by_experimentId_and_kind", ["experimentId", "kind"])
    .index("by_purposeId", ["purposeId"])
    .index("by_expiresAt", ["expiresAt"]),
  calibrationPurposes: defineTable(calibrationPurposeFields)
    .index("by_workspaceId_and_accountId_and_version", [
      "workspaceId",
      "accountId",
      "version",
    ])
    .index("by_workspaceId_and_accountId_and_createdAt", [
      "workspaceId",
      "accountId",
      "createdAt",
    ]),
  calibrationReferences: defineTable(calibrationReferenceFields)
    .index("by_workspaceId_and_accountId_and_kind_and_createdAt", [
      "workspaceId",
      "accountId",
      "kind",
      "createdAt",
    ])
    .index("by_workspaceId_and_actorId_and_commandKey", [
      "workspaceId",
      "actorId",
      "commandKey",
    ])
    .index("by_purposeId", ["purposeId"])
    .index("by_expiresAt", ["expiresAt"]),
  editorialExperiments: defineTable(experimentFields).index(
    "by_workspaceId_and_accountId",
    ["workspaceId", "accountId"],
  ),
  editorialExperimentCommands: defineTable(experimentCommandFields)
    .index("by_workspaceId_and_accountId_and_actorId_and_commandKey", [
      "workspaceId",
      "accountId",
      "actorId",
      "commandKey",
    ])
    .index("by_experimentId", ["experimentId"]),
  editorialExperimentAssignments: defineTable(experimentAssignmentFields)
    .index("by_experimentId", ["experimentId"])
    .index("by_publication_scheduleId_and_sourceUnavailable", [
      "publication.scheduleId",
      "sourceUnavailable",
    ])
    .index("by_versionId_and_reviewerId", ["versionId", "reviewerId"])
    .index("by_versionId_and_sourceUnavailable", [
      "versionId",
      "sourceUnavailable",
    ])
    .index("by_style_versionId_and_sourceUnavailable", [
      "style.versionId",
      "sourceUnavailable",
    ])
    .index("by_seriesVersionId_and_sourceUnavailable", [
      "seriesVersionId",
      "sourceUnavailable",
    ])
    .index("by_sourceUnavailable", ["sourceUnavailable"]),
  editorialExperimentBindings: defineTable(experimentBindingFields)
    .index("by_draftVersionId_and_sourceUnavailable", [
      "draftVersionId",
      "sourceUnavailable",
    ])
    .index("by_assignmentId", ["assignmentId"])
    .index("by_assignmentId_and_snapshotId", ["assignmentId", "snapshotId"])
    .index("by_snapshotId_and_sourceUnavailable", [
      "snapshotId",
      "sourceUnavailable",
    ])
    .index("by_vectorId_and_fingerprint", ["vectorId", "fingerprint"]),
  planningSeries: defineTable(seriesControlFields).index(
    "by_workspaceId_and_accountId",
    ["workspaceId", "accountId"],
  ),
  planningSeriesVersions: defineTable(seriesVersionFields)
    .index("by_seriesId", ["seriesId"])
    .index("by_style_versionId", ["style.versionId"])
    .index("by_sourceUnavailable", ["sourceUnavailable"]),
  planningSeriesCommands: defineTable(seriesCommandFields)
    .index("by_seriesId_and_actorId_and_commandKey", [
      "seriesId",
      "actorId",
      "commandKey",
    ])
    .index("by_versionId", ["versionId"]),
  semanticPlanBindings: defineTable(semanticBindingFields)
    .index("by_vectorId_and_fingerprint", ["vectorId", "fingerprint"])
    .index("by_planId", ["planId"]),
  contentPlans: defineTable(planFields)
    .index("by_workspaceId_and_accountId_and_createdAt", [
      "workspaceId",
      "accountId",
      "createdAt",
    ])
    .index("by_workspaceId_and_actorId_and_commandKey", [
      "workspaceId",
      "actorId",
      "commandKey",
    ])
    .index("by_series_seriesId_and_series_generation_and_series_at", [
      "series.seriesId",
      "series.generation",
      "series.at",
    ])
    .index("by_series_versionId", ["series.versionId"])
    .index("by_series_seriesId", ["series.seriesId"]),
  contentPlanItems: defineTable(itemFields)
    .index("by_planId", ["planId"])
    .index("by_versionId", ["versionId"]),
  performanceContentPolicies: defineTable(contentPerformancePolicyFields)
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_workspaceId_and_accountId_and_version", [
      "workspaceId",
      "accountId",
      "version",
    ]),
  contentFeedback: defineTable(contentFeedbackFields)
    .index("by_versionId_and_actorId_and_kind_and_createdAt", [
      "versionId",
      "actorId",
      "kind",
      "createdAt",
    ])
    .index("by_versionId_and_actorId_and_kind_and_sequence", [
      "versionId",
      "actorId",
      "kind",
      "sequence",
    ])
    .index("by_resultingVersionId_and_sourceUnavailable", [
      "resultingVersionId",
      "sourceUnavailable",
    ])
    .index("by_sourceUnavailable", ["sourceUnavailable"])
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_versionId_and_sourceUnavailable", [
      "versionId",
      "sourceUnavailable",
    ])
    .index("by_sourceUntil", ["sourceUntil"]),
  historyPolicies: defineTable(historyPolicyFields)
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_workspaceId_and_accountId_and_version", [
      "workspaceId",
      "accountId",
      "version",
    ]),
  historyControls: defineTable(historyControlFields).index(
    "by_workspaceId_and_accountId",
    ["workspaceId", "accountId"],
  ),
  historyJobs: defineTable(historyJobFields)
    .index("by_checkpointUntil", ["checkpointUntil"])
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"]),
  historyPosts: defineTable(historyPostFields)
    .index("by_workspaceId_and_accountId_and_providerCreatedAt", [
      "workspaceId",
      "accountId",
      "providerCreatedAt",
    ])
    .index("by_workspaceId_and_accountId_and_externalId", [
      "workspaceId",
      "accountId",
      "externalId",
    ])
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_sourceUntil", ["sourceUntil"]),
  performancePolicies: defineTable(performancePolicyFields)
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_workspaceId_and_accountId_and_version", [
      "workspaceId",
      "accountId",
      "version",
    ]),
  performanceControls: defineTable(performanceControlFields).index(
    "by_workspaceId_and_accountId",
    ["workspaceId", "accountId"],
  ),
  publicationKnowledge: defineTable(knowledgeFields)
    .index("by_postAttemptId", ["postAttemptId"])
    .index("by_projection_pin_purposeId", ["projection.pin.purposeId"])
    .index("by_projection_proofUntil", ["projection.proofUntil"]),
  performanceSnapshots: defineTable(snapshotFields)
    .index("by_postAttemptId_and_windowHours", ["postAttemptId", "windowHours"])
    .index("by_workspaceId_and_accountId", ["workspaceId", "accountId"])
    .index("by_expiresAt", ["expiresAt"]),
  recommendationReceipts: defineTable(recommendationReceiptFields).index(
    "by_workspaceId_and_actorId_and_operationKey",
    ["workspaceId", "actorId", "operationKey"],
  ),
  jevAssessmentRequests: defineTable(assessmentRequestFields)
    .index("by_request_draftVersionId", ["request.draftVersionId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_workspaceId_and_actorId_and_operationKey", [
      "workspaceId",
      "actorId",
      "operationKey",
    ]),
  jevAssessments: defineTable(assessmentFields)
    .index("by_workspaceId_and_accountId_and_draftVersionId_and_semanticKey", [
      "workspaceId",
      "accountId",
      "draftVersionId",
      "semanticKey",
    ])
    .index("by_draftVersionId", ["draftVersionId"])
    .index("by_workspaceId_and_accountId_and_draftId", [
      "workspaceId",
      "accountId",
      "draftId",
    ])
    .index("by_sourceUntil", ["sourceUntil"]),
  intelligenceSourceUpdates: defineTable(sourceUpdateFields)
    .index("by_scope_kind", [
      "workspaceId",
      "accountId",
      "network",
      "surface",
      "kind",
    ])
    .index("by_command", ["workspaceId", "accountId", "actorId", "commandKey"])
    .index("by_base_head_kind", [
      "workspaceId",
      "accountId",
      "baseProfileId",
      "headCommit",
      "kind",
    ]),
  algorithmProfiles: defineTable(intelligenceAlgorithmFields).index(
    "by_scope",
    ["workspaceId", "accountId", "network", "surface"],
  ),
  audienceProfiles: defineTable(intelligenceAudienceFields).index("by_scope", [
    "workspaceId",
    "accountId",
    "network",
    "surface",
  ]),
  intelligenceSelections: defineTable(intelligenceSelectionFields).index(
    "by_scope",
    ["workspaceId", "accountId", "network", "surface"],
  ),
  intelligenceProfileReceipts: defineTable(intelligenceReceiptFields)
    .index("by_scope", ["workspaceId", "accountId", "network", "surface"])
    .index("by_command", ["workspaceId", "accountId", "actorId", "commandKey"])
    .index("by_selection", [
      "workspaceId",
      "accountId",
      "network",
      "surface",
      "algorithmId",
      "audienceId",
      "action",
    ]),
  ideaRunCopies: defineTable({
    workspaceId: v.id("workspaces"),
    accountId: v.id("socialAccounts"),
    ideaVersionId: v.id("ideaVersions"),
    runId: v.id("agentRuns"),
    conversationId: v.optional(v.id("conversations")),
    state: v.union(v.literal("retained"), v.literal("removed")),
  })
    .index("by_ideaVersionId_and_state", ["ideaVersionId", "state"])
    .index("by_runId", ["runId"]),
  draftResearchCopies: defineTable({
    workspaceId: v.id("workspaces"),
    accountId: v.id("socialAccounts"),
    draftVersionId: v.id("draftVersions"),
    orderId: v.id("researchOrders"),
    state: v.union(v.literal("retained"), v.literal("removed")),
  })
    .index("by_draftVersionId_and_state", ["draftVersionId", "state"])
    .index("by_orderId", ["orderId"]),
  researchCopyBindings: defineTable({
    evidenceId: v.id("researchEvidence"),
    orderId: v.optional(v.id("researchOrders")),
    conversationId: v.optional(v.id("conversations")),
    ideaVersionId: v.optional(v.id("ideaVersions")),
    runId: v.optional(v.id("agentRuns")),
    state: v.union(v.literal("retained"), v.literal("removed")),
  }).index("by_evidenceId_and_state", ["evidenceId", "state"]),
  researchContentHandoffs: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.id("users"),
    accountId: v.id("socialAccounts"),
    requestHash: v.string(),
    commandKey: v.string(),
    createdAt: v.number(),
    selection: v.array(v.id("researchEvidence")),
    count: v.number(),
    target: v.union(v.literal("idea"), v.literal("draft")),
    results: v.array(
      v.object({
        ideaId: v.id("ideas"),
        ideaVersionId: v.id("ideaVersions"),
        draftId: v.union(v.id("drafts"), v.null()),
        draftVersionId: v.union(v.id("draftVersions"), v.null()),
      }),
    ),
  })
    .index("by_workspaceId_and_actorId_and_requestHash", [
      "workspaceId",
      "actorId",
      "requestHash",
    ])
    .index("by_workspaceId_and_actorId_and_commandKey", [
      "workspaceId",
      "actorId",
      "commandKey",
    ]),
  researchClusters: defineTable(clusterFields).index(
    "by_workspaceId_and_accountId_and_key",
    ["workspaceId", "accountId", "key"],
  ),
  researchSourceBindings: defineTable(bindingFields)
    .index("by_sourceId_and_state_and_materialHash", [
      "sourceId",
      "state",
      "materialHash",
    ])
    .index("by_orderId", ["orderId"]),
  researchEvidence: defineTable(evidenceFields)
    .index("by_workspaceId_and_accountId_and_createdAt", [
      "workspaceId",
      "accountId",
      "createdAt",
    ])
    .index("by_modelOrigin_runId_and_state", ["modelOrigin.runId", "state"])
    .index("by_orderId_and_createdAt", ["orderId", "createdAt"])
    .index("by_orderId_and_actorId_and_commandKey", [
      "orderId",
      "actorId",
      "commandKey",
    ])
    .index("by_sourceId_and_state_and_materialHash", [
      "sourceId",
      "state",
      "materialHash",
    ]),
  researchProfiles: defineTable(researchProfileFields).index(
    "by_workspaceId_and_accountId",
    ["workspaceId", "accountId"],
  ),
  researchProfileVersions: defineTable(researchVersionFields).index(
    "by_profileId_and_actorId_and_commandKey",
    ["profileId", "actorId", "commandKey"],
  ),
  researchOrders: defineTable(researchOrderFields)
    .index("by_targetedChat_conversationId_and_createdAt", [
      "targetedChat.conversationId",
      "createdAt",
    ])
    .index("by_profileId_and_actorId_and_operationKey", [
      "profileId",
      "actorId",
      "operationKey",
    ])
    .index("by_profileId_and_createdAt", ["profileId", "createdAt"])
    .index("by_profileId_and_occasion_and_operationKey", [
      "profileId",
      "occasion",
      "operationKey",
    ]),
  researchSourcePolicies: defineTable(researchSourcePolicyFields).index(
    "by_workspaceId_and_accountId_and_operation",
    ["workspaceId", "accountId", "operation"],
  ),
  researchCaches: defineTable(researchCacheFields).index(
    "by_workspaceId_and_accountId_and_key",
    ["workspaceId", "accountId", "key"],
  ),
  researchSources: defineTable(researchSourceFields).index(
    "by_workspaceId_and_accountId_and_operation_and_providerIdentity",
    ["workspaceId", "accountId", "operation", "providerIdentity"],
  ),
  conversations: defineTable({
    evidenceAttachments: v.optional(
      v.array(
        v.object({
          operationKey: v.string(),
          fingerprint: v.string(),
          messageId: v.string(),
        }),
      ),
    ),
    workspaceId: v.id("workspaces"),
    accountId: v.id("socialAccounts"),
    actorId: v.id("users"),
    operationKey: v.string(),
    threadId: v.string(),
    title: v.string(),
    revision: v.number(),
    sources: v.array(agentSource),
    ideaVersionIds: v.array(v.id("ideaVersions")),
    turns: v.number(),
    activeRunId: v.union(v.id("agentRuns"), v.null()),
    updatedAt: v.number(),
    state: v.union(
      v.literal("active"),
      v.literal("deleting"),
      v.literal("deleted"),
    ),
    cleanupAfter: v.number(),
  })
    .index("by_workspaceId_and_accountId_and_actorId_and_updatedAt", [
      "workspaceId",
      "accountId",
      "actorId",
      "updatedAt",
    ])
    .index("by_workspaceId_and_actorId_and_operationKey", [
      "workspaceId",
      "actorId",
      "operationKey",
    ]),
  chatOperations: defineTable({
    workspaceId: v.id("workspaces"),
    accountId: v.id("socialAccounts"),
    actorId: v.id("users"),
    conversationId: v.id("conversations"),
    operationKey: v.string(),
    fingerprint: v.string(),
    allowIdeaCreation: v.boolean(),
    promptMessageId: v.string(),
    runIds: v.array(v.id("agentRuns")),
    inputVersionId: v.union(v.id("ideaVersions"), v.null()),
    resultIdeaId: v.union(v.id("ideas"), v.null()),
    resultFingerprint: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_conversationId_and_operationKey", [
      "conversationId",
      "operationKey",
    ])
    .index("by_conversationId_and_createdAt", ["conversationId", "createdAt"]),
  ideas: defineTable(ideaFields)
    .index("by_handoff_draftId", ["handoff.draftId"])
    .index("by_workspaceId_and_updatedAt", ["workspaceId", "updatedAt"])
    .index("by_workspaceId_and_actorId_and_operationKey", [
      "workspaceId",
      "actorId",
      "operationKey",
    ]),
  ideaVersions: defineTable(ideaVersionFields)
    .index("by_runId", ["runId"])
    .index("by_inputVersionId", ["inputVersionId"])
    .index("by_source_evidenceId_and_researchCleanupPending", [
      "source.evidenceId",
      "researchCleanupPending",
    ])
    .index("by_researchCleanupPending_and_researchProofUntil", [
      "researchCleanupPending",
      "researchProofUntil",
    ])
    .index("by_ideaId_and_number", ["ideaId", "number"]),
  ideaFeedback: defineTable(feedbackFields)
    .index("by_versionId_and_researchCleanupPending", [
      "versionId",
      "researchCleanupPending",
    ])

    .index("by_ideaId", ["ideaId"]),
  contentRequests: defineTable(requestFields)
    .index("by_inputVersionId", ["inputVersionId"])
    .index("by_runId", ["runId"])
    .index("by_workspaceId_and_actorId_and_operationKey", [
      "workspaceId",
      "actorId",
      "operationKey",
    ])
    .index("by_ideaId_and_createdAt", ["ideaId", "createdAt"]),
  jevPolicies: defineTable(jevPolicyFields).index("by_scope", [
    "workspaceId",
    "accountId",
  ]),
  jevControls: defineTable(jevControlFields).index("by_key", ["key"]),
  aiPolicies: defineTable(policyFields).index("by_key", ["key"]),
  aiBudgets: defineTable(budgetFields).index("by_key", ["key"]),
  agentRuns: defineTable(runFields)
    .index("by_styleContext_versionId", ["styleContext.versionId"])
    .index("by_workspaceId_and_createdAt", ["workspaceId", "createdAt"]),
  aiAttempts: defineTable(
    v.union(
      v.object(aiAttemptFields),
      v.object(nativeAttemptFields),
      v.object(jevAttemptFields),
      v.object(metricsAttemptFields),
      v.object(historyAttemptFields),
      v.object(embeddingAttemptFields),
    ),
  )
    .index("by_embedding_command", [
      "owner",
      "workspaceId",
      "accountId",
      "actorId",
      "commandKey",
    ])
    .index("by_embedding_source_history", ["owner", "sourcePin.historyPostId"])
    .index("by_embedding_source_draft", ["owner", "sourcePin.draftVersionId"])
    .index("by_embedding_control", ["owner", "controlId"])
    .index("by_embedding_cleanup", ["owner", "sourceUnavailable"])
    .index("by_jev_operation", [
      "owner",
      "workspaceId",
      "accountId",
      "actorId",
      "operationKey",
    ])
    .index("by_jev_pending", [
      "owner",
      "workspaceId",
      "accountId",
      "draftVersionId",
      "state",
    ])
    .index("by_runId_and_key", ["runId", "key"])
    .index("by_runId_and_state", ["runId", "state"])
    .index("by_researchOrderId_and_key", ["researchOrderId", "key"])
    .index("by_logicalIntent", ["logicalIntent"])
    .index("by_native_legacy_intent", [
      "workspaceId",
      "accountId",
      "operation",
      "intentVersion",
      "state",
    ]),
  githubContexts: defineTable(contextFields)
    .index("by_workspaceId_and_actorId_and_operationKey", [
      "workspaceId",
      "actorId",
      "operationKey",
    ])
    .index("by_signalId", ["signalId"])
    .index("by_runId", ["runId"]),
  githubAdmissionOrder: defineTable({ sequence: v.number() }),
  githubRevocationBarriers: defineTable({
    key: v.string(),
    receivedAt: v.number(),
    receiptId: v.id("githubWebhookReceipts"),
    sequence: v.number(),
  }).index("by_key", ["key"]),
  githubWebhookReceipts: defineTable(receiptFields)
    .index("by_digest", ["digest"])
    .index("by_eventKey", ["eventKey"])
    .index("by_state_and_dueAt", ["state", "dueAt"]),
  githubDeliveryGuids: defineTable({
    guid: v.string(),
    digest: v.string(),
    receiptId: v.id("githubWebhookReceipts"),
  }).index("by_guid", ["guid"]),
  githubSignals: defineTable(signalFields)
    .index("by_workspaceId_and_eventKey", ["workspaceId", "eventKey"])
    .index("by_workspaceId_and_receivedAt", ["workspaceId", "receivedAt"]),
  githubRecoveries: defineTable(recoveryFields)
    .index("by_workspaceId_and_guid", ["workspaceId", "guid"])
    .index("by_guid_and_notBefore", ["guid", "notBefore"])
    .index("by_guid_and_attempts", ["guid", "attempts"])
    .index("by_workspaceId_and_updatedAt", ["workspaceId", "updatedAt"]),
  githubRecoveryScan: defineTable({
    key: v.string(),
    leaseUntil: v.number(),
    sequence: v.number(),
    cursor: v.union(v.string(), v.null()),
    startedAt: v.number(),
    checkedAt: v.number(),
    oldestAt: v.union(v.number(), v.null()),
    limited: v.boolean(),
    notBefore: v.number(),
    errorCode: v.union(v.string(), v.null()),
    pages: v.number(),
  }).index("by_key", ["key"]),
  githubConnections: defineTable(githubConnectionFields)
    .index("by_workspaceId", ["workspaceId"])
    .index("by_identity", ["identity"])
    .index("by_leaseUntil", ["leaseUntil"]),
  githubOAuthStates: defineTable(githubStateFields)
    .index("by_digest", ["digest"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_expiresAt", ["expiresAt"]),
  githubRepositories: defineTable(githubRepoFields)
    .index("by_workspaceId_and_providerId", ["workspaceId", "providerId"])
    .index("by_providerId_and_installationId_and_selected", [
      "providerId",
      "installationId",
      "selected",
    ])
    .index("by_installationId_and_selected", ["installationId", "selected"])
    .index("by_workspaceId_and_selected", ["workspaceId", "selected"]),
  xPostAttempts: defineTable(attemptFields)
    .index("by_workspaceId_and_accountId_and_externalId", [
      "workspaceId",
      "accountId",
      "externalId",
    ])
    .index("by_scheduleId_and_generation_and_position", [
      "scheduleId",
      "generation",
      "position",
    ])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_accountId_and_stage", [
      "workspaceId",
      "accountId",
      "stage",
    ])
    .index("by_workspaceId_and_accountId_and_stage_and_confirmedAt", [
      "workspaceId",
      "accountId",
      "stage",
      "confirmedAt",
    ]),
  xMediaCheckpoints: defineTable(checkpointFields)
    .index("by_scheduleId_and_generation_and_mediaPosition", [
      "scheduleId",
      "generation",
      "mediaPosition",
    ])
    .index("by_workspaceId", ["workspaceId"]),
  xOAuthFence: defineTable({ key: v.string(), sequence: v.number() }).index(
    "by_key",
    ["key"],
  ),
  xOAuthStates: defineTable(stateFields)
    .index("by_digest", ["digest"])
    .index("by_workspaceId_and_userId", ["workspaceId", "userId"])
    .index("by_expiresAt", ["expiresAt"]),
  xCredentials: defineTable(credentialFields)
    .index("by_accountId", ["accountId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_cleanAfter", ["cleanAfter"]),
  xBindings: defineTable({
    providerIdentity: v.string(),
    accountId: v.optional(v.id("socialAccounts")),
    workspaceId: v.optional(v.id("workspaces")),
    changedAt: v.number(),
    changedSequence: v.optional(v.number()),
  }).index("by_providerIdentity", ["providerIdentity"]),
  mediaUploadSessions: defineTable({
    workspaceId: v.id("workspaces"),
    assetId: v.id("mediaAssets"),
    userId: v.optional(v.id("users")),
    requestId: v.optional(v.string()),
    temporaryKey: v.string(),
    finalKey: v.string(),
    bucket: v.string(),
    r2AccountId: v.optional(v.string()),
    expectedSize: v.number(),
    expectedMime: v.string(),
    expiresAt: v.number(),
    state: v.union(
      ...(
        [
          "uploading",
          "validating",
          "ready",
          "failed",
          "cancelled",
          "deleted",
        ] as const
      ).map((x) => v.literal(x)),
    ),
    leaseUntil: v.number(),
    generation: v.number(),
    cleanAfter: v.number(),
    deletedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
  })
    .index("by_workspaceId_and_requestId", ["workspaceId", "requestId"])
    .index("by_assetId", ["assetId"])
    .index("by_cleanAfter", ["cleanAfter"]),
  mediaVersionReferences: defineTable({
    workspaceId: v.id("workspaces"),
    assetId: v.id("mediaAssets"),
    versionId: v.id("draftVersions"),
  })
    .index("by_assetId", ["assetId"])
    .index("by_versionId", ["versionId"]),
  editorialComments: defineTable(commentFields)
    .index("by_versionId_and_researchCleanupPending", [
      "versionId",
      "researchCleanupPending",
    ])

    .index("by_draftId", ["draftId"]),
  socialAccounts: defineTable(accountFields)
    .index("by_workspaceId", ["workspaceId"])
    .index("by_provider_and_providerIdentity", [
      "provider",
      "providerIdentity",
    ]),
  mediaAssets: defineTable(assetFields)
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_state", ["workspaceId", "state"]),
  drafts: defineTable(draftFields).index("by_workspaceId_and_updatedAt", [
    "workspaceId",
    "updatedAt",
  ]),
  draftVersions: defineTable(versionFields)
    .index("by_ideaVersionId", ["ideaVersionId"])
    .index("by_ideaVersionId_and_researchCleanupPending", [
      "ideaVersionId",
      "researchCleanupPending",
    ])

    .index("by_draftId_and_number", ["draftId", "number"]),
  approvals: defineTable(approvalFields)
    .index("by_versionId_and_accountId", ["versionId", "accountId"])
    .index("by_draftId", ["draftId"]),
  schedules: defineTable(scheduleFields)
    .index("by_approvalId", ["approvalId"])
    .index("by_workspaceId_and_accountId_and_state", [
      "workspaceId",
      "accountId",
      "state",
    ])
    .index("by_workspaceId_and_at", ["workspaceId", "at"])
    .index("by_workspaceId_and_accountId_and_at", [
      "workspaceId",
      "accountId",
      "at",
    ])
    .index("by_draftId", ["draftId"])
    .index("by_draftId_and_state", ["draftId", "state"])
    .index("by_workspaceId_and_accountId_and_at_and_state", [
      "workspaceId",
      "accountId",
      "at",
      "state",
    ]),
  editorialEvents: defineTable(eventFields).index(
    "by_workspaceId_and_createdAt",
    ["workspaceId", "createdAt"],
  ),
  publishingNotifications: defineTable(notificationFields).index(
    "by_workspaceId_and_createdAt",
    ["workspaceId", "createdAt"],
  ),
  teamInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    createdBy: v.optional(v.id("users")),
    email: v.optional(v.string()),
    role: v.optional(role),
    createdAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired"),
      v.literal("unavailable"),
    ),
    acceptedUserId: v.optional(v.id("users")),
    result: v.optional(teamResult),
    delivery: v.optional(deliveryFields),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status_and_expiresAt", [
      "workspaceId",
      "status",
      "expiresAt",
    ])
    .index("by_createdBy_and_status", ["createdBy", "status"])
    .index("by_status", ["status"])
    .index("by_delivery_cleanAfter", ["delivery.cleanAfter"]),
  teamCommands: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.id("users"),
    commandKey: v.string(),
    fingerprint: v.optional(v.string()),
    ownerOperation: v.boolean(),
    result: v.optional(teamResult),
    sourceUnavailable: v.boolean(),
    cleanAfter: v.union(v.number(), v.null()),
  })
    .index("by_workspaceId_and_actorId_and_commandKey", [
      "workspaceId",
      "actorId",
      "commandKey",
    ])
    .index("by_actorId_and_sourceUnavailable", ["actorId", "sourceUnavailable"])
    .index("by_cleanAfter", ["cleanAfter"]),
  users: defineTable({
    authId: v.string(),
    defaultWorkspaceId: v.id("workspaces"),
    activeWorkspaceId: v.id("workspaces"),
  }).index("by_authId", ["authId"]),
  workspaces: defineTable({
    name: v.string(),
    description: v.string(),
    lifecycle: v.optional(
      v.union(v.literal("active"), v.literal("deleting"), v.literal("deleted")),
    ),
    teamRevision: v.optional(v.number()),
    feedbackSequence: v.optional(v.number()),
    mediaReservedBytes: v.optional(v.number()),
    mediaAssetCount: v.optional(v.number()),
  }),
  memberships: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role,
  })
    .index("by_userId", ["userId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_userId_and_workspaceId", ["userId", "workspaceId"]),
  preferences: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    ...profileFields,
  }).index("by_userId_and_workspaceId", ["userId", "workspaceId"]),
});
