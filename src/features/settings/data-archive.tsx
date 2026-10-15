import { useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import {
  makeFunctionReference,
  type ApiFromModules,
  type FunctionArgs,
  type FunctionReturnType,
} from "convex/server";
import { Download } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type {
  RemainingFamily,
  page as remainingPage,
} from "../../../convex/operations/exportRemaining";
import type {
  FinanceFamily,
  page as financePage,
} from "../../../convex/operations/exportFinance";
import type {
  RecordsFamily,
  page as recordsPage,
} from "../../../convex/operations/exportRecords";
import type { IntelligenceFamily } from "../../../convex/operations/exportIntelligence";
import type { SharedFamily } from "../../../convex/operations/exportShared";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared";

type RecordsArchive = FunctionReturnType<
  ApiFromModules<{ module: { page: typeof recordsPage } }>["module"]["page"]
>;
const recordsQuery = makeFunctionReference<
  "query",
  FunctionArgs<
    ApiFromModules<{ module: { page: typeof recordsPage } }>["module"]["page"]
  >,
  RecordsArchive
>("operations/exportRecords:page");
const recordsFamilies: Record<RecordsFamily, string> = {
  githubRepositorySettings: "Gespeicherte Repository-Einstellungen",
  publishingPostEffects: "Publishing-Postbelege",
  publishingMediaEffects: "Publishing-Medienbelege",
  ownGithubContexts: "Eigene freigegebene GitHub-Kontexte",
  ownEditorialNotices: "Eigene redaktionelle Hinweise",
  ownUploadSessions: "Eigene Uploadvorgänge",
  ownPublishingReceipts: "Eigene Publishing-Mitteilungen",
  ownTeamCommands: "Eigene Teamvorgänge",
  teamInvitationRecords: "Einladungsmetadaten",
  publicGithubSignals: "Öffentliche GitHub-Signale",
  publicGithubRecoveries: "Öffentliche GitHub-Wiederherstellungen",
  ownCreatedInvitations: "Eigene erstellte Einladungen",
  ownReceivedInvitations: "Eigene empfangene Einladungen",
  ownIdeaHandoffs: "Eigene Ideenübergaben",
  ownResearchHandoffs: "Eigene Research-Übergaben",
  mediaVersionReferences: "Originale Medienreferenzen einer Version",
};
const recordsFields: Record<RecordsFamily, string> = {
  githubRepositorySettings:
    "id createdInDatabaseAt providerId installationId fullName private selected access monitoring content contextRead communicableContext purposeActorId purposeAt purposeVersion generation verifiedAt proofExpiresAt updatedAt",
  publishingPostEffects:
    "id createdInDatabaseAt scheduleId versionId accountId providerIdentity generation position attempt stage mediaIds parentId externalId httpStatus rateResetAt requestStartedAt confirmedAt durationMs createdAt updatedAt reconciledAt reconciledBy reconcileReads",
  publishingMediaEffects:
    "id createdInDatabaseAt scheduleId versionId accountId assetId generation mediaPosition attempt phase operation mediaId nextSegment expiresAt nextCheckAt deadline statusReads readRetries metadataApplied bytesRead bytesUploaded bytesSubmitted chunkCount providerRequests durationMs measurementIncomplete createdAt updatedAt",
  ownGithubContexts:
    "id createdInDatabaseAt actorId signalId repositoryId generation paths createdAt state excerpts approvedAt runId accountId resultIdeaId decision summary rationale novelty uncertainty references evidence",
  ownEditorialNotices:
    "id createdInDatabaseAt draftId versionId accountId parent createdAt sourceUntil readAt dismissedAt",
  ownUploadSessions:
    "id createdInDatabaseAt assetId state expiresAt expectedSize expectedMime deletedAt",
  ownPublishingReceipts:
    "id createdInDatabaseAt scheduleId generation state createdAt presentation",
  ownTeamCommands:
    "id createdInDatabaseAt actorId ownerOperation result materialAvailability",
  teamInvitationRecords:
    "id createdInDatabaseAt status createdAt expiresAt role delivery",
  publicGithubSignals:
    "id createdInDatabaseAt repositoryId generation kind fullName private ref before after commitCount created deleted forced releaseId tag prerelease url providerAt receivedAt processedAt explicitRecovery",
  publicGithubRecoveries:
    "id createdInDatabaseAt repositoryId generation providerId installationId event deliveredAt providerStatus state attempts notBefore updatedAt",
  ownCreatedInvitations:
    "id createdInDatabaseAt email role status createdAt expiresAt",
  ownReceivedInvitations:
    "id createdInDatabaseAt email role status createdAt expiresAt",
  ownIdeaHandoffs: "id createdInDatabaseAt handoff",
  ownResearchHandoffs:
    "id createdInDatabaseAt accountId actorId createdAt count target selection results",
  mediaVersionReferences:
    "id createdInDatabaseAt assetId versionId versionKind positions",
};
function recordsData(data: RecordsArchive["data"]) {
  const rows = data.selection.rows.map((row) => {
    const r = fields(row, recordsFields[data.selection.family]);
    if (r.handoff)
      r.handoff = fields(
        r.handoff,
        "ideaVersionId ideaRevision accountId draftId draftVersionId actorId intent clarificationConfirmed text at",
      );
    if (r.results && Array.isArray(r.results))
      r.results = r.results.map((x) =>
        fields(x, "ideaId ideaVersionId draftId draftVersionId"),
      );
    if (r.positions && Array.isArray(r.positions))
      r.positions = r.positions.map((x) => fields(x, "position alt"));
    if (r.explicitRecovery)
      r.explicitRecovery = fields(
        r.explicitRecovery,
        "actorId authorizedAt recoveryId",
      );
    if (r.activation) {
      const activation = fields(
        r.activation,
        "kind language operations autoHandoff",
      );
    }
    if (r.presentation)
      r.presentation = fields(
        r.presentation,
        "draftId versionId accountId approvalId approvalActorId purpose readAt dismissedAt sourceUntil",
      );
    if (r.result)
      r.result = fields(
        r.result,
        "revision invitationId membershipId userId disposition",
      );
    if (r.delivery)
      r.delivery = fields(r.delivery, "status providerId firstSendAt");
    if (r.parent)
      r.parent = fields(
        r.parent,
        "kind commandId stage decisionId withdrawn approvalId revoked",
      );
    if (r.excerpts && Array.isArray(r.excerpts))
      r.excerpts = r.excerpts.map((x) =>
        fields(x, "path previousPath blobSha change patch"),
      );
    if (r.evidence && Array.isArray(r.evidence))
      r.evidence = r.evidence.map((x) => fields(x, "path quote"));
    return r;
  });
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: { family: data.selection.family, rows },
  };
}

type FinanceArchive = FunctionReturnType<
  ApiFromModules<{ module: { page: typeof financePage } }>["module"]["page"]
>;
const financeQuery = makeFunctionReference<
  "query",
  FunctionArgs<
    ApiFromModules<{ module: { page: typeof financePage } }>["module"]["page"]
  >,
  FinanceArchive
>("operations/exportFinance:page");
const financeFamilies: Record<FinanceFamily, string> = {
  businessFinanceRuns: "Gemeinsame KI-Finanzläufe",
  businessRunUsage: "Kosten eines gemeinsamen KI-Laufs",
  publicFinanceOrders: "Gemeinsame Research-Finanzaufträge",
  publicOrderUsage: "Kosten eines öffentlichen Research-Auftrags",
  researchRunUsage: "KI-Kosten eines Research-Auftrags",
  ownFinanceRuns: "Eigene KI-Finanzläufe",
  ownFinanceOrders: "Eigene Research-Finanzaufträge",
  ownFinanceReceipts: "Eigene KI-Kostenbelege",
  runUsage: "Kosten eines eigenen KI-Laufs",
  orderUsage: "Kosten eines eigenen Research-Auftrags",
  metricsUsage: "Messkosten",
  historyUsage: "Historienkosten",
  usageBudgets: "Workspace- und Accountbudgets",
};
const financeFields: Record<string, string> = {
  generation:
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt runId generation model inputMicrosPerMillion outputMicrosPerMillion inputTokens outputTokens reportedCost reportedCurrency reportedCostInvalid compositeParentId compositeStage",
  "generation-reservation":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt runId generation model inputMicrosPerMillion outputMicrosPerMillion inputTokens outputTokens reportedCost reportedCurrency reportedCostInvalid compositeParentId compositeStage accountId actorId maxInputTokens maxOutputTokens compositeRootRunId reservedAt",
  "native-search":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt accountId researchOrderId operation generation policyId unit unitMicros costCurrencyEvidence reportedCost reportedCurrency reportedCostInvalid units dispatchedAt intentVersion",
  "jev-analyzer":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt accountId actorId purpose operation draftId draftVersionId algorithmId audienceId selectionRevision mode deadline policyId controlId questionVersion normalizationVersion model resolvedModel inputMicrosPerMillion outputMicrosPerMillion maxInputTokens maxOutputTokens inputTokens outputTokens latencyMs outcome fallback",
  "jev-intent-router":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt accountId actorId purpose operation routingOperationId inputVersionId policyId controlId questionVersion normalizationVersion model resolvedModel inputMicrosPerMillion outputMicrosPerMillion maxInputTokens maxOutputTokens inputTokens outputTokens latencyMs outcome fallback",
  "jev-output-verifier":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt accountId actorId purpose operation inputVersionId policyId controlId questionVersion normalizationVersion model resolvedModel inputMicrosPerMillion outputMicrosPerMillion maxInputTokens maxOutputTokens inputTokens outputTokens latencyMs outcome fallback contentRequestId candidateVersionId producerRunId thresholdVersion compositeParentId compositeStage compositeRootRunId",
  "jev-output-verifier-reservation":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt accountId actorId purpose operation inputVersionId policyId controlId questionVersion normalizationVersion model resolvedModel inputMicrosPerMillion outputMicrosPerMillion maxInputTokens maxOutputTokens inputTokens outputTokens latencyMs outcome fallback contentRequestId producerRunId thresholdVersion compositeParentId compositeStage compositeRootRunId deadline reservedAt",
  "own-metrics":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt accountId purpose snapshotId policyId generation unit unitMicros inputTokens outputTokens reportedCurrency reportedCostInvalid reportedCost",
  "own-history":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt accountId purpose historyJobId policyId generation unit unitMicros inputTokens outputTokens reportedCurrency reportedCostInvalid reportedCost page maxResults resourceCount",
  "own-content-embedding":
    "id createdInDatabaseAt owner currency policyVersion provider state reservedMicros heldMicros estimatedMicros billedMicros sentAt settledAt accountId actorId purpose controlId generation policyId model identity inputMicrosPerMillion maxInputTokens inputTokens createdAt deadline sourceUnavailable",
  run: "id createdInDatabaseAt accountId actorId purpose state generation policyVersion promptVersion createdAt deadline executionFinishedAt attempts toolSteps",
  order:
    "id createdInDatabaseAt accountId actorId profileId profileVersionId occasion state generation createdAt",
  budget:
    "id createdInDatabaseAt scope workspaceId accountId policyVersion currency purposes approvedBy expiresAt limitMicros heldMicros spentMicros namespace",
};
function financeData(data: FinanceArchive["data"]) {
  const rows = data.selection.rows.map((row) => {
    const r = fields(
      row,
      financeFields[
        "owner" in row
          ? (row.owner ?? "generation")
          : ["ownFinanceRuns", "businessFinanceRuns"].includes(
                data.selection.family,
              )
            ? "run"
            : ["ownFinanceOrders", "publicFinanceOrders"].includes(
                  data.selection.family,
                )
              ? "order"
              : "budget"
      ],
    );
    if (r.identity)
      r.identity = fields(
        r.identity,
        "resolvedModel dimension assembly normalization",
      );
    return r;
  });
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: { family: data.selection.family, rows },
  };
}

type RemainingArchive = FunctionReturnType<
  ApiFromModules<{ module: { page: typeof remainingPage } }>["module"]["page"]
>;
const remainingQuery = makeFunctionReference<
  "query",
  FunctionArgs<
    ApiFromModules<{ module: { page: typeof remainingPage } }>["module"]["page"]
  >,
  RemainingArchive
>("operations/exportRemaining:page");
const remainingFamilies: Record<RemainingFamily, string> = {
  mediaManifest: "Medienverzeichnis",
  accountRecords: "Accounts",
  githubConnections: "GitHub-Verbindungen",
  embeddingPolicies: "Embedding-Richtlinien",
  embeddingControls: "Embedding-Einwilligungen",
  performanceContentPolicies: "Inhaltsrichtlinien",
  researchPoliciesRecent: "Research-Richtlinien: X-Posts",
  researchPoliciesTrends: "Research-Richtlinien: X-Trends",
  researchPoliciesWeb: "Research-Richtlinien: Websuche",
  researchProfileRecords: "Research-Profile",
  researchVersionRecords: "Research-Profilversionen",
  calibrationPurposes: "Kalibrierungszwecke",
  calibrationControls: "Kalibrierungssteuerung",
  calibrationReferences: "Kalibrierungsreferenzen",
  calibrationModels: "Kalibrierungsmodelle",
  jevPolicies: "Jev-Richtlinien",
  jevAnalyzerControl: "Jev-Analyzersteuerung",
  jevRoutingControl: "Jev-Routingsteuerung",
  jevVerificationControl: "Jev-Prüfsteuerung",
  editorialExperiments: "Redaktionelle Experimente",
  experimentCommands: "Experimentänderungen",
  experimentAssignments: "Experimentzuordnungen",
  experimentBindings: "Experimentbelege",
  workspaceRecord: "Workspace",
  memberRecords: "Mitgliedschaftsrollen",
};
const remainingFields: Record<RemainingFamily, string> = {
  mediaManifest:
    "id createdInDatabaseAt name defaultAlt type mime size width height duration state",
  accountRecords:
    "id createdInDatabaseAt provider providerIdentity name handle connection capability xEvidence",
  githubConnections:
    "id createdInDatabaseAt status identity login installations inventoryLimited updatedAt",
  embeddingPolicies:
    "id createdInDatabaseAt accountId version enabled approvedBy expiresAt purpose provider baseURL model identity processingEvidence upstreamEuEvidence storageEvidence trainingEvidence retentionEvidence rightsEvidence pricingEvidence protocolEvidence allocationEvidence currency inputMicrosPerMillion allocatedProviderLimitMicros maxInputTokens retentionMs maxDurationMs",
  embeddingControls:
    "id createdInDatabaseAt accountId generation enabled approvedBy connectionSequence policyId purpose ownHistory draftVersions consentEvidence expiresAt updatedAt",
  performanceContentPolicies:
    "id createdInDatabaseAt accountId version purpose rightsEvidence approvedBy expiresAt",
  researchPoliciesRecent:
    "id createdInDatabaseAt accountId operation enabled version generation approvedBy expiresAt accessEvidence processingEvidence pricingEvidence rightsEvidence protocolEvidence lifecycleEvidence lifecycleValidUntil retentionMs authMode protocol currency unit unitMicros totalChargeBoundEvidence allocationEvidence allocatedProviderLimitMicros costCurrencyEvidence model woeid",
  researchPoliciesTrends:
    "id createdInDatabaseAt accountId operation enabled version generation approvedBy expiresAt accessEvidence processingEvidence pricingEvidence rightsEvidence protocolEvidence lifecycleEvidence lifecycleValidUntil retentionMs authMode protocol currency unit unitMicros totalChargeBoundEvidence allocationEvidence allocatedProviderLimitMicros costCurrencyEvidence model woeid",
  researchPoliciesWeb:
    "id createdInDatabaseAt accountId operation enabled version generation approvedBy expiresAt accessEvidence processingEvidence pricingEvidence rightsEvidence protocolEvidence lifecycleEvidence lifecycleValidUntil retentionMs authMode protocol currency unit unitMicros totalChargeBoundEvidence allocationEvidence allocatedProviderLimitMicros costCurrencyEvidence model woeid",
  researchProfileRecords:
    "id createdInDatabaseAt accountId currentVersionId revision paused deleted scheduleActive scheduleGeneration scheduleActorId nextAt scheduleReason activation",
  researchVersionRecords:
    "id createdInDatabaseAt profileId actorId number createdAt config",
  calibrationPurposes:
    "id createdInDatabaseAt accountId version target rightsEvidence explanation approvedBy expiresAt retentionMs redactedAt createdAt generation consent withdrawal",
  calibrationControls:
    "id createdInDatabaseAt accountId revision activeDecisionId actorId updatedAt",
  jevPolicies:
    "id createdInDatabaseAt policyKind accountId version approvedBy expiresAt model currency pricingEvidence inputMicrosPerMillion outputMicrosPerMillion maxInputTokens maxOutputTokens euEvidence purpose processingRights questionVersion normalizationVersion thresholdVersion",
  jevAnalyzerControl:
    "id createdInDatabaseAt policyKind accountId enabled analyzer routing verification networkFit policyId composerTimeoutMs backgroundTimeoutMs purpose withdrawn",
  jevRoutingControl:
    "id createdInDatabaseAt policyKind accountId enabled analyzer routing verification networkFit policyId composerTimeoutMs backgroundTimeoutMs purpose withdrawn",
  jevVerificationControl:
    "id createdInDatabaseAt policyKind accountId enabled analyzer routing verification networkFit policyId composerTimeoutMs backgroundTimeoutMs purpose withdrawn",
  editorialExperiments:
    "id createdInDatabaseAt accountId actorId membershipId revision state startSequence stopSequence startedAt stoppedAt endsAt sourceUntil sourceUnavailable createdAt spec",
  experimentCommands:
    "id createdInDatabaseAt accountId experimentId actorId revision sourceUnavailable createdAt",
  experimentAssignments:
    "id createdInDatabaseAt accountId experimentId draftId versionId reviewerId reviewerMembershipId arm planItemId seriesVersionId sourceUntil sourceUnavailable style publication",
  experimentBindings:
    "id createdInDatabaseAt accountId assignmentId vectorId draftVersionId snapshotId sourceUntil sourceUnavailable",
  workspaceRecord:
    "id createdInDatabaseAt name description lifecycle teamRevision",
  memberRecords: "id createdInDatabaseAt userId role",
  calibrationReferences:
    "id createdInDatabaseAt accountId purposeId generation actorId createdAt expiresAt kind specId payload",
  calibrationModels:
    "id createdInDatabaseAt accountId purposeId generation actorId createdAt expiresAt kind specId experimentId candidateId declarationId blockNumber payload",
};
const remainingPayloadFields: Record<string, string> = {
  spec: "from fitCutoff holdout1Start holdout1End holdout2Start holdout2End mode target transfers empiricalPolicy prospectiveStatus activationEligible compatibility anchor",
  snapshot:
    "asOf frameEnd frameComplete scanned populationLowerBound populationTotal exclusions counts timeSpanMs engineeringScreen engineeringScreenBasis empiricalStatus activationEligible unknownSegments missingPolicies refs",
  experiment:
    "from fitCutoff holdout1Start holdout1End holdout2Start holdout2End mode target transfers lossVersion predeclaredAt policy activationEligible compatibility",
  candidate:
    "trainSnapshotId frozenAt transfer n spanMs trainLosses baseline selected status activationEligible manifest",
  evaluation:
    "candidateId snapshotId evaluatedAt asOf trainN trainSpanMs block1 block2 stability engineeringScreen engineeringScreenBasis scanned populationTotal populationLowerBound frameComplete excludedFraction exclusions unknownSegments reasons evidenceQualified activationEligible compatibility",
  "monitoring-declaration":
    "version evaluationId policy firstEnd unusedSecondStart compatibility",
  "monitoring-check":
    "snapshotId computedAt asOf block excludedFraction coverageBasis status reasons",
  activate:
    "action evaluationId candidateId checkId expectedRevision resultingRevision",
  "rollback-static":
    "action expectedRevision resultingRevision formulaVersion thresholdVersion",
};
const remainingCompatibilityFields =
  "network format windowHours metricPolicyId metricVersion dialect replyField replyDefinition impressionField impressionDefinition algorithmId audienceId jevPolicyId jevPolicyVersion requestedModel resolvedModel questionVersion inputVersion normalizationVersion formulaVersion thresholdVersion";
const remainingRefFields =
  "postAttemptId scheduleId versionId externalId knowledgeId assessmentId analysisReceiptId snapshotId metricReceiptId confirmedAt publishedAt observedAt assessmentAt capturedAt requestStartedAt sourceUntil originalUntil membership";
function remainingData(data: RemainingArchive["data"]) {
  const rows = data.selection.rows.map((row) => {
    const r = fields(row, remainingFields[data.selection.family]);
    if (r.activation) {
      const activation = fields(
        r.activation,
        "kind language operations autoHandoff",
      );
      if (activation.autoHandoff)
        activation.autoHandoff = fields(
          activation.autoHandoff,
          "count target intent",
        );
      r.activation = activation;
    }
    if (r.xEvidence) {
      const evidence = fields(
        r.xEvidence,
        "scopes identityVerifiedAt textScopeEligible mediaScopeEligible liveWrite remoteRevocation writeProof",
      );
      if (evidence.writeProof)
        evidence.writeProof = fields(
          evidence.writeProof,
          "externalId attemptId confirmedAt",
        );
      r.xEvidence = evidence;
    }
    if (r.spec) {
      const spec = fields(
        r.spec,
        "hypothesis dimension a b outcome startsAt endsAt sampleCap stopCondition context frequency publication",
      );
      if (spec.publication)
        spec.publication = fields(
          spec.publication,
          "metric windowHours policyId rightsEvidence explanation expiresAt",
        );
      r.spec = spec;
    }
    if (r.style)
      r.style = fields(
        r.style,
        "versionId selectedBy selectionReceiptId sourceUntil",
      );
    if (r.publication)
      r.publication = fields(
        r.publication,
        "scheduleId approvalId generation admittedAt",
      );
    if (r.consent) r.consent = fields(r.consent, "actorId at");
    if (r.withdrawal) r.withdrawal = fields(r.withdrawal, "actorId at");
    if (r.payload) {
      const native = r.payload as Record<string, unknown>;
      const k =
        r.kind === "activation-decision"
          ? String(native.action)
          : String(r.kind);
      const p = fields(native, remainingPayloadFields[k]);
      if (p.compatibility)
        p.compatibility = fields(p.compatibility, remainingCompatibilityFields);
      if (p.anchor) p.anchor = fields(p.anchor, remainingRefFields);
      if (p.refs) p.refs = items(p.refs, (x) => fields(x, remainingRefFields));
      if (p.manifest)
        p.manifest = items(p.manifest, (x) => fields(x, remainingRefFields));
      r.payload = p;
    }
    return r;
  });
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: { family: data.selection.family, rows },
  };
}

type Archive = FunctionReturnType<typeof api.operations.exportShared.shared>;
const intelligenceFamilies: Record<IntelligenceFamily, string> = {
  historyPosts: "Importierte Posts",
  historyJobs: "Historienimporte",
  historyPolicies: "Historienrichtlinien",
  historyControls: "Historiensteuerung",
  performanceSnapshots: "Leistungsmessungen",
  performancePolicies: "Messrichtlinien",
  performanceControls: "Messsteuerung",
  publicationKnowledge: "Wissen beim ersten Senden",

  assessments: "Jev-Bewertungen",
  ownAssessmentRequests: "Eigene Bewertungsanfragen",
  ownRecommendationReceipts: "Eigene Übernahmebelege",
  ownRoutingOperations: "Eigene Routingvorgänge",
  ownContentRequests: "Eigene Inhaltsanfragen",
  ownStandaloneVerifications: "Eigene Inhaltsprüfungen",
  algorithmProfiles: "Algorithmusprofile",
  audienceProfiles: "Zielgruppenprofile",
  intelligenceSelections: "Intelligence-Auswahl",
  intelligenceProfileReceipts: "Intelligence-Änderungen",
  intelligenceSourceUpdates: "Öffentliche Quellprüfungen",
  styleVersions: "Stilversionen",
  styleControls: "Stilauswahl",
  learningProposals: "Stilvorschläge",
  styleCommands: "Stiländerungen",
};
type IntelligenceArchive = FunctionReturnType<
  typeof api.operations.exportIntelligence.page
>;
const intelligenceFields: Record<IntelligenceFamily, string> = {
  historyPosts:
    "id createdInDatabaseAt accountId jobId generation externalId network origin providerCreatedAt observedAt sourceUntil text contentType mediaType replyTo accountSize postAttemptId versionId thenKnowledgeId historicalAnalysisId metricsStatus removed materialAvailability",
  historyJobs:
    "id createdInDatabaseAt accountId actorId generation policyId sourceUntil state pages imported rejected createdAt updatedAt reason checkpointUntil attemptId",
  historyPolicies:
    "id createdInDatabaseAt accountId version approvedBy expiresAt purpose dialect accessEvidence rightsEvidence pricingEvidence protocolEvidence allocationEvidence unit unitMicros currency allocatedProviderLimitMicros retentionMs maxResults",
  historyControls:
    "id createdInDatabaseAt accountId generation deletedThroughGeneration updatedAt",
  performanceSnapshots:
    "id createdInDatabaseAt accountId postAttemptId scheduleId versionId externalId position confirmedAt windowHours observedAgeMs late dueAt generation state attemptId requestedAt observedAt providerCreatedAt definitionVersion dialect reason expiresAt materialAvailability fields",
  performancePolicies:
    "id createdInDatabaseAt accountId windows windowsEvidence version approvedBy expiresAt purpose dialect accessEvidence rightsEvidence pricingEvidence protocolEvidence allocationEvidence fields unit unitMicros currency retentionMs allocatedProviderLimitMicros",
  performanceControls:
    "id createdInDatabaseAt accountId contentPolicyId contentApprovedBy deletedThroughGeneration enabled deleted generation actorId updatedAt",
  publicationKnowledge:
    "id createdInDatabaseAt accountId postAttemptId generation scheduleId versionId network capturedAt assessmentId applicable reason materialAvailability projection",

  assessments:
    "id accountId draftId draftVersionId versionNumber algorithmId audienceId inputVersion createdAt sourceUntil attemptId provenance result",
  ownAssessmentRequests:
    "id actorId accountId draftId draftVersionId algorithmId audienceId selectionRevision mode deadline createdAt sourceUntil materialAvailability",
  ownRecommendationReceipts:
    "id accountId actorId baseVersionId versionId revision createdAt",
  ownRoutingOperations:
    "id accountId actorId ideaId inputVersionId inputRevision createdAt deadline questionVersion normalizationVersion sourceUntil sourceUnavailable status materialAvailability intent result style policyId attemptId provenance",
  ownContentRequests:
    "id accountId actorId ideaId inputVersionId inputRevision createdAt runId resultIdeaId outputKind routingOperationId compositeParentId compositeStage materialAvailability sourceUntil intent verification composite",
  ownStandaloneVerifications:
    "contentRequestId accountId kind actorId candidateVersionId producerRunId inputVersionId startedAt deadline sourceUntil state sourceUnavailable materialAvailability result stickyRisk",
  algorithmProfiles:
    "id accountId network surface createdBy createdAt status review retiredAt update payload",
  audienceProfiles:
    "id accountId network surface createdBy createdAt status review retiredAt payload",
  intelligenceSelections:
    "id accountId network surface revision algorithmId audienceId selectedBy updatedAt",
  intelligenceProfileReceipts:
    "id accountId network surface actorId revision action reason algorithmId audienceId createdAt",
  intelligenceSourceUpdates:
    "id accountId network surface kind actorId baseProfileId baseCommit headCommit createdAt expectedPaths full state deadline notBefore finishedAt requests bytes error errorRedacted proposalId observation checkId variant refs interpretation impact rationale fullSourceReview reference",
  styleVersions:
    "id accountId createdBy createdAt declaredBy declaredAt selfDeclaration baseVersionId proposalId sourceUntil sourceUnavailable status materialAvailability payload reason",
  styleControls:
    "id accountId revision selectedVersionId selectedBy selectionReceiptId updatedAt",
  learningProposals:
    "id accountId createdBy createdAt baseVersionId baseSelectionReceiptId feedbackId draftId beforeVersionId resultingVersionId beforeUntil resultUntil sourceUntil ownExamples state decidedBy decidedAt resultVersionId sourceUnavailable materialAvailability preferences reason decisionReason",
  styleCommands:
    "id accountId actorId revision action versionId proposalId createdAt sourceUnavailable materialAvailability reason",
};
const fields = (value: unknown, keys: string) => pick(value, keys.split(" "));
function items(value: unknown, project: (v: unknown) => unknown) {
  if (!Array.isArray(value)) throw Error("EXPORT_DATA_UNAVAILABLE");
  return value.map(project);
}
function verificationData(value: unknown) {
  const r = fields(value, intelligenceFields.ownStandaloneVerifications);
  if (r.result) {
    const result = fields(
      r.result,
      "candidateVersionId questionVersion normalizationVersion thresholdVersion model decision criteria reasonKeys",
    );
    const criteria = fields(
      result.criteria,
      "meaningPreserved intentPreserved newStrongClaim unwantedPromotion toneFits ctaFits networkFits",
    );
    result.criteria = Object.fromEntries(
      Object.entries(criteria).map(([k, v]) => [
        k,
        fields(v, "probability applicability"),
      ]),
    );
    r.result = result;
  }
  if (r.stickyRisk)
    r.stickyRisk = fields(r.stickyRisk, "candidateVersionId reasonKeys");
  return r;
}
function styleData(value: unknown) {
  const r = fields(
    value,
    "author experiences tone positioning pillars examples forbidden",
  );
  if (r.pillars) r.pillars = items(r.pillars, (p) => fields(p, "name weight"));
  return r;
}
function intelligenceData(data: IntelligenceArchive["data"]) {
  const family = data.selection.family;
  const rows = data.selection.rows.map((row) => {
    if (family === "ownStandaloneVerifications") return verificationData(row);
    const r = fields(row, intelligenceFields[family]);
    if (family === "performanceSnapshots" && r.fields !== null)
      r.fields = items(r.fields, (f) =>
        fields(f, "name rawField definition status value"),
      );
    if (family === "publicationKnowledge" && r.projection) {
      const projection = fields(
        r.projection,
        "version state score reason formulaVersion thresholdVersion proofUntil operatingUntil pin",
      );
      if (projection.pin)
        projection.pin = fields(
          projection.pin,
          "assessmentId purposeId generation decisionId candidateId evaluationId declarationId checkId capturedAt",
        );
      r.projection = projection;
    }
    if (r.review) r.review = fields(r.review, "actorId at reason");
    if (r.update) r.update = fields(r.update, "proposalId evaluationId");
    if (r.provenance)
      r.provenance = fields(
        r.provenance,
        "policyId policyVersion requestedModel resolvedModel inputTokens outputTokens sentAt settledAt latencyMs selectionRevision",
      );
    if (family === "ownRoutingOperations") {
      if (r.intent) {
        r.intent = fields(
          r.intent,
          "intent outputKind strategy network objective tone cta media",
        );
        const i = r.intent as Record<string, unknown>;
        if (i.media) i.media = items(i.media, (m) => fields(m, "assetId alt"));
      }
      if (r.result)
        r.result = fields(
          r.result,
          "status category choiceConfidence suggestion effectiveStrategy generatorKind thresholdVersion",
        );
      if (r.style)
        r.style = fields(
          r.style,
          "versionId selectedBy selectionReceiptId sourceUntil",
        );
    }
    if (family === "ownContentRequests") {
      if (r.verification) r.verification = verificationData(r.verification);
      if (r.composite) {
        const c = fields(
          r.composite,
          "kind actorId startedAt deadline sourceUntil sourceUnavailable state currency maxCostMicros maxCalls maxToolSteps repairRequestId repairRunId repairedCandidateVersionId materialAvailability first final stickyRisk",
        );
        if (c.first) c.first = verificationData(c.first);
        if (c.final) c.final = verificationData(c.final);
        if (c.stickyRisk)
          c.stickyRisk = fields(c.stickyRisk, "candidateVersionId reasonKeys");
        r.composite = c;
      }
    }
    if (family === "styleVersions" && r.payload)
      r.payload = styleData(r.payload);
    if (r.preferences) r.preferences = styleData(r.preferences);
    if (family === "audienceProfiles" && r.payload)
      r.payload = fields(
        r.payload,
        "version description source measurement embedding",
      );
    if (family === "algorithmProfiles" && r.payload) {
      const p = fields(
        r.payload,
        "version repository commit commitAt observedAt reviewDueAt validityBasis sourceScope productionState scoringInfluence evidence report refs",
      );
      p.evidence = items(p.evidence, (e) => fields(e, "path url sha256"));
      p.refs = fields(
        p.refs,
        "formula routing verification questionSet normalization",
      );
      r.payload = p;
    }
    if (family === "intelligenceSourceUpdates") {
      if (r.refs)
        r.refs = fields(
          r.refs,
          "formula routing verification questionSet normalization",
        );
      if (r.reference) {
        const ref = fields(r.reference, "version passed outcomes");
        ref.outcomes = items(ref.outcomes, (o) =>
          fields(o, "case outcome aggregate"),
        );
        r.reference = ref;
      }
      if (r.observation) {
        const o = fields(
          r.observation,
          "commit commitAt observedAt reviewDueAt compareUrl complete issues evidence changes",
        );
        o.evidence = items(o.evidence, (e) => fields(e, "path url sha256"));
        o.changes = items(o.changes, (c) =>
          fields(c, "path status url patch patchState"),
        );
        r.observation = o;
      }
    }
    if (family === "assessments" && r.result) {
      const result = fields(
        r.result,
        "outcome answers score deterministic questionVersion normalizationVersion",
      );
      if (result.answers && typeof result.answers === "object")
        result.answers = Object.fromEntries(
          Object.entries(result.answers).map(([k, a]) => [
            k,
            fields(a, "type value confidence probability"),
          ]),
        );
      if (result.score) {
        const score = fields(
          result.score,
          "formulaVersion thresholdVersion thresholdBasis minimumConfidence weights aggregate missing lowConfidence history audienceFit",
        );
        score.weights = fields(
          score.weights,
          "hookStrength clarity discussionPotential originality naturalCta structure history",
        );
        score.history = fields(score.history, "value basis");
        result.score = score;
      }
      if (result.deterministic) {
        const d = fields(
          result.deterministic,
          "version segments media structure",
        );
        d.segments = items(d.segments, (s) =>
          fields(
            s,
            "position length lengthValid hashtags mentions links lines questionMarks explicitCtaSigns repeatedParagraphs structure",
          ),
        );
        d.media = fields(d.media, "present count images videos withAlt");
        result.deterministic = d;
      }
      r.result = result;
    }
    return r;
  });
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: { family, rows },
  };
}

const privateFamilies = {
  conversations: "Eigene Unterhaltungen",
  conversationMessages: "Eigene Chatnachrichten",
  conversationOperations: "Eigene Chatvorgänge",
  conversationRuns: "Eigene Chatläufe",
  targetedOrders: "Eigene gezielte Research-Aufträge",
  publicOrders: "Öffentliche Research-Aufträge",
  orderSources: "Erhaltene Research-Quellen",
  orderEvidence: "Erhaltene Research-Belege",
  researchMessages: "Erhaltene Research-Antworten",
  workflowSteps: "Research-Ablaufschritte",
};
type PrivateFamily = keyof typeof privateFamilies;
type Family =
  | SharedFamily
  | PrivateFamily
  | IntelligenceFamily
  | RemainingFamily
  | FinanceFamily
  | RecordsFamily;
type PrivateArchive = FunctionReturnType<
  (typeof api.operations.exportPrivate)[PrivateFamily]
>;
const privateRowFields: Record<PrivateFamily, string> = {
  conversations:
    "conversationId accountId createdAt title revision updatedAt turns state",
  conversationMessages:
    "conversationId messageId _creationTime order stepOrder status role text",
  conversationOperations:
    "operationId conversationId createdAt allowIdeaCreation inputVersionId resultIdeaId",
  conversationRuns:
    "runId operationId purpose state createdAt deadline executionFinishedAt policyVersion promptVersion attempts toolSteps",
  targetedOrders:
    "orderId accountId profileId profileVersionId occasion state generation createdAt finishedAt windowStart windowEnd deadline occurrence query topic language operations",
  publicOrders:
    "orderId accountId profileId profileVersionId occasion state generation createdAt finishedAt windowStart windowEnd deadline occurrence query language operations",
  orderSources:
    "sourceId operation url title text publishedAt count observedAt minusableUntil",
  orderEvidence:
    "evidenceId actorId annotationActorId orderId sourceId observedAt sourceGeneration parentEvidenceId createdAt promptVersion policyVersion minretentionUntil inboxRevision inboxDisposition inboxActorId",
  researchMessages:
    "orderId messageId _creationTime order stepOrder status role text",
  workflowSteps:
    "orderId stepNumber stage kind startedAt completedAt resultKind",
};
function privateData(data: PrivateArchive["data"]) {
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: {
      family: data.selection.family,
      rows: data.selection.rows.map((row) => {
        const r = pick(row, privateRowFields[data.selection.family].split(" "));
        if ("occurrence" in row && row.occurrence)
          r.occurrence = pick(row.occurrence, ["generation", "at"]);
        if ("outcomes" in row && row.outcomes)
          r.outcomes = row.outcomes.map((o) =>
            pick(o, ["operation", "state", "cacheHit"]),
          );
        if ("reResearch" in row && row.reResearch)
          r.reResearch = pick(row.reResearch, [
            "topic",
            "parentEvidenceId",
            "parentOrderId",
            "parentSourceId",
          ]);
        if ("automaticHandoff" in row && row.automaticHandoff) {
          const a = row.automaticHandoff;
          r.automaticHandoff = {
            ...pick(a, [
              "activationGeneration",
              "profileVersionId",
              "state",
              "selection",
            ]),
            option: pick(a.option, ["kind", "count", "target", "intent"]),
            ...(a.results
              ? {
                  results: a.results.map((result) =>
                    pick(result, [
                      "ideaId",
                      "ideaVersionId",
                      "draftId",
                      "draftVersionId",
                    ]),
                  ),
                }
              : {}),
          };
        }
        if ("config" in row && row.config) {
          const config = pick(
            row.config,
            "topics project audience languages regions preferredSources exclusions freshnessDays topicCount frequency timeZone clock weekday".split(
              " ",
            ),
          );
          r.config = {
            ...config,
            cap: row.config.cap
              ? pick(row.config.cap, ["currency", "limitMicros"])
              : null,
            autoHandoff: row.config.autoHandoff
              ? pick(row.config.autoHandoff, [
                  "kind",
                  "count",
                  "target",
                  "intent",
                ])
              : false,
          };
        }
        if ("perspective" in row)
          r.perspective = pick(row.perspective, [
            "profileVersionId",
            "audience",
            "topics",
            "project",
          ]);
        if ("annotation" in row)
          r.annotation = pick(
            row.annotation,
            "claim consequentialOrContested eventBased quote interpretation gaps relevance novelty uncertainty freshness validityReason".split(
              " ",
            ),
          );
        if ("model" in row && row.model)
          r.model = pick(
            row.model,
            "eventAt eventQuote title perspective dynamics clusterId historyIds copySourceIds".split(
              " ",
            ),
          );
        if ("assessment" in row && row.assessment)
          r.assessment = pick(
            row.assessment,
            "reviewerId assessedAt purpose ruleVersion basis maxAgeMs requestedUntil validUntil reason substantiveSupportAttested eventAt eventQuote".split(
              " ",
            ),
          );
        return r;
      }),
    },
  };
}
const families: Record<SharedFamily, string> = {
  drafts: "Entwürfe",
  ideas: "Ideen",
  ideaVersions: "Ideenversionen",
  ideaFeedback: "Ideenfeedback",
  contentFeedback: "Inhaltsfeedback",
  contentPlans: "Inhaltspläne",
  contentPlanItems: "Planeinträge",
  planningSeries: "Planungsserien",
  planningSeriesVersions: "Serienversionen",
  planningSeriesCommands: "Serienänderungen",
  semanticPlanBindings: "Planquellen-Verknüpfungen",
  editorialComments: "Redaktionskommentare",
  approvals: "Freigaben",
  schedules: "Veröffentlichungsplanung",
  editorialEvents: "Redaktionsereignisse",
  editorialReviewPolicies: "Prüfrichtlinien",
  editorialReviewControls: "Prüfeinstellungen",
  editorialReviewDecisions: "Prüfentscheidungen",
  editorialReviewCommands: "Prüfänderungen",
};
const rowFields: Record<SharedFamily, readonly string[]> = {
  drafts:
    "id createdInDatabaseAt revision currentVersionId authorId source assigneeId updatedAt".split(
      " ",
    ),
  ideas:
    "id createdInDatabaseAt actorId revision currentVersionId status updatedAt".split(
      " ",
    ),
  ideaVersions:
    "id createdInDatabaseAt ideaId number actorId createdAt title perspective note priority originals rationale questions inputVersionId".split(
      " ",
    ),
  ideaFeedback:
    "id createdInDatabaseAt ideaId versionId actorId kind text createdAt resultingVersionId".split(
      " ",
    ),
  contentFeedback:
    "id createdInDatabaseAt accountId versionId resultingVersionId actorId kind createdAt editExtent definition".split(
      " ",
    ),
  contentPlans:
    "id createdInDatabaseAt accountId actorId createdAt desiredCount start end timezone clock mode topics preferences".split(
      " ",
    ),
  contentPlanItems:
    "id createdInDatabaseAt planId accountId draftId versionId versionNumber draftRevision ideaVersionId at timezone localTime reason status acceptedApprovalId acceptedScheduleId acceptedActorId acceptedMode".split(
      " ",
    ),
  planningSeries:
    "id createdInDatabaseAt accountId actorId revision generation enabled versionId nextAt nextIndex remaining createdAt updatedAt".split(
      " ",
    ),
  planningSeriesVersions:
    "id createdInDatabaseAt accountId seriesId revision actorId sequence createdAt".split(
      " ",
    ),
  planningSeriesCommands:
    "id createdInDatabaseAt accountId seriesId actorId expectedRevision revision versionId generation createdAt".split(
      " ",
    ),
  semanticPlanBindings:
    "id createdInDatabaseAt accountId planId vectorId attemptId".split(" "),
  editorialComments:
    "id createdInDatabaseAt draftId versionId authorId versionNumber text resolved createdAt".split(
      " ",
    ),
  approvals:
    "id createdInDatabaseAt draftId versionId accountId actorId createdAt revokedAt revokedBy purpose expiresAt".split(
      " ",
    ),
  schedules:
    "id createdInDatabaseAt draftId versionId accountId approvalId actorId generation at timezone localTime state confirmedAt abortRequestedAt abortRequestedBy purpose".split(
      " ",
    ),
  editorialEvents:
    "id createdInDatabaseAt draftId scheduleId actorId code createdAt".split(
      " ",
    ),
  editorialReviewPolicies:
    "id createdInDatabaseAt accountId editorial brand actorId revision createdAt".split(
      " ",
    ),
  editorialReviewControls:
    "id createdInDatabaseAt accountId policyId revision".split(" "),
  editorialReviewDecisions:
    "id createdInDatabaseAt draftId versionId accountId policyId stage reviewerId priorDecisionId createdAt withdrawnAt withdrawnBy active".split(
      " ",
    ),
  editorialReviewCommands:
    "id createdInDatabaseAt accountId actorId kind draftId assigneeId requestStage assignmentResult versionId result".split(
      " ",
    ),
};
function pick(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("EXPORT_DATA_UNAVAILABLE");
  return Object.fromEntries(
    keys.filter((k) => k in value).map((k) => [k, Reflect.get(value, k)]),
  );
}
function content(value: unknown) {
  const result = pick(value, [
    "title",
    "text",
    "media",
    "accountId",
    "pillar",
    "strategy",
  ]);
  if (!Array.isArray(result.media)) throw Error("EXPORT_DATA_UNAVAILABLE");
  result.media = result.media.map((m) => pick(m, ["assetId", "alt"]));
  return result;
}
function numeric(value: unknown): boolean {
  if (typeof value === "number")
    return Number.isFinite(value) && !Object.is(value, -0);
  return (
    !value || typeof value !== "object" || Object.values(value).every(numeric)
  );
}
function downloadData(data: Archive["data"]) {
  const selection = data.selection;
  const rows = selection.rows.map((row) => {
    const r = pick(row, rowFields[selection.family]);
    if ("content" in row) r.content = content(row.content);
    if ("candidate" in row)
      r.candidate = row.candidate === null ? null : content(row.candidate);
    if ("sources" in row)
      r.sources = row.sources.map((s) =>
        pick(
          s,
          s.kind === "research"
            ? [
                "kind",
                "evidenceId",
                "accountId",
                "orderId",
                "sourceId",
                "sourceGeneration",
              ]
            : [
                "kind",
                "repositoryId",
                "generation",
                "contextId",
                "signalId",
                "ideaVersionId",
              ],
        ),
      );
    if ("preferences" in row)
      r.preferences = pick(row.preferences, [
        "timezone",
        "language",
        "audience",
        "tone",
        "topics",
      ]);
    if ("seriesId" in row) r.seriesId = row.seriesId;
    if ("seriesVersionId" in row) r.seriesVersionId = row.seriesVersionId;
    if ("config" in row) {
      r.config = {
        ...pick(row.config, [
          "styleVersionId",
          "theme",
          "candidateVersionIds",
          "desiredFormat",
          "threshold",
          "timezone",
          "frequency",
          "weekday",
          "callbackClock",
          "publishingClocks",
          "start",
          "end",
          "occurrences",
          "itemsPerBatch",
        ]),
        pillars: row.config.pillars.map((p) => pick(p, ["name", "weight"])),
      };
    }
    if ("assignmentResult" in row && row.assignmentResult)
      r.assignmentResult = pick(row.assignmentResult, [
        "revision",
        "assigneeId",
        "versionId",
      ]);
    if ("result" in row && row.result)
      r.result = pick(row.result, ["revision", "policyId", "decisionId"]);
    return r;
  });
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: { family: selection.family, rows },
  };
}
export function NativeArchiveExport() {
  const { state, nativeScope } = useStore();
  const [family, setFamily] = useState<Family>(
    ["Owner", "Admin"].includes(state.role) ? "drafts" : "conversations",
  );
  const [remainingKind, setRemainingKind] = useState<
    | "spec"
    | "snapshot"
    | "experiment"
    | "candidate"
    | "evaluation"
    | "monitoring-declaration"
    | "monitoring-check"
    | "activation-decision"
    | "monitoring-tombstone"
  >("spec");
  const [financePurpose, setFinancePurpose] = useState<
    "summary" | "research" | "draft" | "plan"
  >("draft");
  const [financeRunId, setFinanceRunId] = useState("");
  const [financeNamespace, setFinanceNamespace] = useState<
    "generation" | "native-search" | "jev" | "metrics" | "history" | "embedding"
  >("generation");
  const [financeBudgetScope, setFinanceBudgetScope] = useState<
    "workspace" | "account"
  >("account");
  const [recordsVersionKind, setRecordsVersionKind] = useState<
    "draft" | "idea"
  >("draft");
  const [recordsVersionId, setRecordsVersionId] = useState("");
  const [experimentId, setExperimentId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [draftId, setDraftId] = useState("");
  const [updateKind, setUpdateKind] = useState<
    "check" | "proposal" | "evaluation"
  >("check");
  const [conversationId, setConversationId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [operationId, setOperationId] = useState("");
  const [operation, setOperation] = useState<
    "web-search" | "x-recent" | "x-trends"
  >("web-search");
  const recordsFamily = family in recordsFamilies;
  const ownRecords = recordsFamily && family.startsWith("own");
  const financeFamily = family in financeFamilies;
  const ownFinance =
    financeFamily &&
    ![
      "metricsUsage",
      "historyUsage",
      "usageBudgets",
      "businessFinanceRuns",
      "businessRunUsage",
      "publicFinanceOrders",
      "publicOrderUsage",
    ].includes(family);
  const remainingFamily = family in remainingFamilies;
  const needsRemainingAccount =
    remainingFamily &&
    ![
      "mediaManifest",
      "accountRecords",
      "githubConnections",
      "workspaceRecord",
      "memberRecords",
    ].includes(family);
  const selectedRemainingKind =
    family === "calibrationReferences"
      ? remainingKind === "snapshot"
        ? "snapshot"
        : "spec"
      : remainingKind === "spec" || remainingKind === "snapshot"
        ? "experiment"
        : remainingKind;
  const privateFamily = family in privateFamilies;
  const intelligenceFamily = family in intelligenceFamilies;
  const ownIntelligence = intelligenceFamily && family.startsWith("own");
  const needsConversation = [
    "conversationMessages",
    "conversationOperations",
    "conversationRuns",
    "targetedOrders",
  ].includes(family);
  const needsOrder = [
    "orderSources",
    "orderEvidence",
    "researchMessages",
    "workflowSteps",
  ].includes(family);
  const allowed =
    ownRecords ||
    ownFinance ||
    ownIntelligence ||
    (privateFamily
      ? family !== "publicOrders" || ["Owner", "Admin"].includes(state.role)
      : ["Owner", "Admin"].includes(state.role));
  const needsExperiment = [
    "experimentCommands",
    "experimentAssignments",
    "experimentBindings",
  ].includes(family);
  const ready =
    allowed &&
    (!(
      financeFamily ||
      needsRemainingAccount ||
      privateFamily ||
      (intelligenceFamily && !ownIntelligence)
    ) ||
      !!state.activeAccountId) &&
    (family !== "mediaVersionReferences" || !!recordsVersionId) &&
    (!needsExperiment || !!experimentId) &&
    (family !== "experimentBindings" || !!assignmentId) &&
    (family !== "assessments" || !!draftId) &&
    (!needsConversation || !!conversationId) &&
    (!needsOrder || !!orderId) &&
    (!["runUsage", "businessRunUsage"].includes(family) || !!financeRunId) &&
    (!["orderUsage", "publicOrderUsage", "researchRunUsage"].includes(family) ||
      !!orderId) &&
    ((family !== "publicOrders" &&
      family !== "researchVersionRecords" &&
      family !== "publicFinanceOrders") ||
      !!profileId) &&
    (family !== "conversationRuns" || !!operationId);
  const { data: session } = authClient.useSession();
  const convex = useConvex();
  const authId = session?.user.id,
    sessionId = session?.session.id;
  const workspaceId = state.activeWorkspaceId,
    accountId = state.activeAccountId,
    role = state.role;
  const scope = `${nativeScope}:${authId}:${sessionId}:${workspaceId}:${accountId}:${role}:${family}:${conversationId}:${profileId}:${orderId}:${operationId}:${operation}:${draftId}:${updateKind}:${selectedRemainingKind}:${financeRunId}:${financeNamespace}:${financeBudgetScope}:${financePurpose}:${experimentId}:${assignmentId}:${recordsVersionKind}:${recordsVersionId}`;
  const current = useRef({ scope, epoch: 0 });
  if (current.current.scope !== scope)
    current.current = { scope, epoch: current.current.epoch + 1 };
  const alive = useRef(true),
    nonce = useRef(0),
    inFlight = useRef(false);
  const position = useRef<{
    cursor: string | null;
    creationUpperBound: number | null;
    epoch: number;
  }>({ cursor: null, creationUpperBound: null, epoch: current.current.epoch });
  if (position.current.epoch !== current.current.epoch)
    position.current = {
      cursor: null,
      creationUpperBound: null,
      epoch: current.current.epoch,
    };
  const objectURL = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [done, setDone] = useState(false);
  const revoke = () => {
    if (timer.current) clearTimeout(timer.current);
    if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    objectURL.current = null;
    timer.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      nonce.current++;
      revoke();
    };
  }, []);
  useEffect(() => {
    nonce.current++;
    inFlight.current = false;
    setBusy(false);
    setDone(false);
    setError("");
    setStatus("");
    revoke();
  }, [scope]);
  const download = async (narrow = false) => {
    if (inFlight.current || !authId || !sessionId || !ready) return;
    inFlight.current = true;
    if (done) {
      position.current = {
        cursor: null,
        creationUpperBound: null,
        epoch: current.current.epoch,
      };
      setDone(false);
    }
    const ticket = ++nonce.current,
      epoch = current.current.epoch;
    const stillCurrent = () =>
      alive.current &&
      nonce.current === ticket &&
      current.current.epoch === epoch &&
      current.current.scope === scope;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const requestKey = crypto.randomUUID();
      const sent = position.current;
      const narrowArg = narrow ? { narrowPage: true as const } : {};
      const common = {
        workspaceId: workspaceId as Id<"workspaces">,
        expectedAuthId: authId,
        expectedSessionId: sessionId,
        requestKey,
      };
      const parent = {
        accountId: accountId as Id<"socialAccounts">,
        conversationId: conversationId as Id<"conversations">,
      };
      const bounds = {
        cursor: sent.cursor,
        selectionUpperBound: sent.creationUpperBound,
      };
      const research = {
        orderId: orderId as Id<"researchOrders">,
        cursor: sent.cursor,
      };
      const offset = sent.cursor === null ? 0 : Number(sent.cursor);
      let raw:
        | Archive
        | PrivateArchive
        | IntelligenceArchive
        | RemainingArchive
        | FinanceArchive
        | RecordsArchive;
      switch (family) {
        case "conversations":
          raw = await convex.query(api.operations.exportPrivate.conversations, {
            ...common,
            accountId: parent.accountId,
            ...bounds,
            ...narrowArg,
          });
          break;
        case "conversationMessages":
          raw = await convex.query(
            api.operations.exportPrivate.conversationMessages,
            {
              ...common,
              ...parent,
              cursor: sent.cursor,
              ...narrowArg,
            },
          );
          break;
        case "conversationOperations":
          raw = await convex.query(
            api.operations.exportPrivate.conversationOperations,
            { ...common, ...parent, ...bounds, ...narrowArg },
          );
          break;
        case "conversationRuns":
          raw = await convex.query(
            api.operations.exportPrivate.conversationRuns,
            {
              ...common,
              ...parent,
              operationId: operationId as Id<"chatOperations">,
              offset,
            },
          );
          break;
        case "targetedOrders":
          raw = await convex.query(
            api.operations.exportPrivate.targetedOrders,
            { ...common, ...parent, ...bounds, ...narrowArg },
          );
          break;
        case "publicOrders":
          raw = await convex.query(api.operations.exportPrivate.publicOrders, {
            ...common,
            profileId: profileId as Id<"researchProfiles">,
            ...bounds,
            ...narrowArg,
          });
          break;
        case "orderSources":
          raw = await convex.query(api.operations.exportPrivate.orderSources, {
            ...common,
            orderId: research.orderId,
            operation,
            offset,
          });
          break;
        case "orderEvidence":
          raw = await convex.query(api.operations.exportPrivate.orderEvidence, {
            ...common,
            ...research,
            ...narrowArg,
          });
          break;
        case "researchMessages":
          raw = await convex.query(
            api.operations.exportPrivate.researchMessages,
            { ...common, ...research, ...narrowArg },
          );
          break;
        case "workflowSteps":
          raw = await convex.query(api.operations.exportPrivate.workflowSteps, {
            ...common,
            ...research,
            ...narrowArg,
          });
          break;
        default:
          raw = recordsFamily
            ? await convex.query(recordsQuery, {
                ...common,
                family: family as RecordsFamily,
                ...(family === "mediaVersionReferences"
                  ? {
                      version:
                        recordsVersionKind === "draft"
                          ? {
                              kind: "draft" as const,
                              id: recordsVersionId as Id<"draftVersions">,
                            }
                          : {
                              kind: "idea" as const,
                              id: recordsVersionId as Id<"ideaVersions">,
                            },
                    }
                  : {}),
                cursor: sent.cursor,
                creationUpperBound: sent.creationUpperBound,
                ...narrowArg,
              })
            : financeFamily
              ? await convex.query(financeQuery, {
                  ...common,
                  family: family as FinanceFamily,
                  accountId: parent.accountId,
                  ...(["runUsage", "businessRunUsage"].includes(family)
                    ? { runId: financeRunId as Id<"agentRuns"> }
                    : {}),
                  ...([
                    "orderUsage",
                    "publicOrderUsage",
                    "researchRunUsage",
                  ].includes(family)
                    ? { orderId: orderId as Id<"researchOrders"> }
                    : {}),
                  ...(["businessFinanceRuns", "businessRunUsage"].includes(
                    family,
                  )
                    ? { purpose: financePurpose }
                    : {}),
                  ...(family === "publicFinanceOrders"
                    ? { profileId: profileId as Id<"researchProfiles"> }
                    : {}),
                  ...(family === "usageBudgets"
                    ? {
                        namespace: financeNamespace,
                        budgetScope: financeBudgetScope,
                      }
                    : {}),
                  cursor: sent.cursor,
                  creationUpperBound: sent.creationUpperBound,
                  ...narrowArg,
                })
              : remainingFamily
                ? await convex.query(remainingQuery, {
                    ...common,
                    family: family as RemainingFamily,
                    ...(needsExperiment
                      ? {
                          experimentId:
                            experimentId as Id<"editorialExperiments">,
                        }
                      : {}),
                    ...(family === "experimentBindings"
                      ? {
                          assignmentId:
                            assignmentId as Id<"editorialExperimentAssignments">,
                        }
                      : {}),
                    ...(needsRemainingAccount
                      ? { accountId: parent.accountId }
                      : {}),
                    ...(family === "researchVersionRecords"
                      ? { profileId: profileId as Id<"researchProfiles"> }
                      : {}),
                    ...(["calibrationReferences", "calibrationModels"].includes(
                      family,
                    )
                      ? { kind: selectedRemainingKind }
                      : {}),
                    cursor: sent.cursor,
                    creationUpperBound: sent.creationUpperBound,
                    ...narrowArg,
                  })
                : intelligenceFamily
                  ? await convex.query(api.operations.exportIntelligence.page, {
                      ...common,
                      family: family as IntelligenceFamily,
                      ...(ownIntelligence
                        ? {}
                        : { accountId: parent.accountId }),
                      ...(family === "assessments"
                        ? { draftId: draftId as Id<"drafts"> }
                        : {}),
                      ...(family === "intelligenceSourceUpdates"
                        ? { kind: updateKind }
                        : {}),
                      cursor: sent.cursor,
                      creationUpperBound: sent.creationUpperBound,
                      ...narrowArg,
                    })
                  : await convex.query(api.operations.exportShared.shared, {
                      ...common,
                      family: family as SharedFamily,
                      cursor: sent.cursor,
                      creationUpperBound: sent.creationUpperBound,
                      ...narrowArg,
                    });
      }
      const result = {
        ...raw,
        creationUpperBound:
          "creationUpperBound" in raw
            ? raw.creationUpperBound
            : raw.selectionUpperBound,
      };
      if (!stillCurrent()) return;
      const now = Date.now();
      if (
        !Number.isFinite(now) ||
        Object.is(now, -0) ||
        result.requestKey !== requestKey ||
        result.authId !== authId ||
        result.sessionId !== sessionId ||
        result.workspaceId !== workspaceId ||
        result.data.workspaceId !== workspaceId ||
        result.role !== role ||
        result.data.format !==
          (recordsFamily
            ? "dispatch-workspace-operational-records"
            : financeFamily
              ? "dispatch-workspace-finance"
              : remainingFamily
                ? "dispatch-workspace-records"
                : intelligenceFamily
                  ? "dispatch-workspace-intelligence"
                  : privateFamily
                    ? "dispatch-workspace-private"
                    : "dispatch-workspace-shared") ||
        (recordsFamily &&
          (!("version" in raw) ||
            (family === "mediaVersionReferences"
              ? raw.version?.kind !== recordsVersionKind ||
                raw.version.id !== recordsVersionId
              : raw.version !== null))) ||
        result.data.version !== 1 ||
        result.data.selection.family !== family ||
        result.data.selection.rows.length > 25 ||
        typeof result.cursor !== "string" ||
        (!result.isDone && (!result.cursor || result.cursor === sent.cursor)) ||
        typeof result.isDone !== "boolean" ||
        ![result.observedAt, result.proofValidUntil].every(
          (n) => Number.isFinite(n) && !Object.is(n, -0),
        ) ||
        !numeric(result) ||
        (result.creationUpperBound !== null &&
          (!Number.isFinite(result.creationUpperBound) ||
            Object.is(result.creationUpperBound, -0) ||
            result.creationUpperBound < 0 ||
            result.creationUpperBound > result.observedAt)) ||
        (financeFamily &&
          (!("purpose" in raw) ||
            raw.purpose !==
              (["businessFinanceRuns", "businessRunUsage"].includes(family)
                ? financePurpose
                : null) ||
            !("profileId" in raw) ||
            raw.profileId !==
              (family === "publicFinanceOrders" ? profileId : null))) ||
        (financeFamily &&
          (!("runId" in raw) ||
            raw.runId !==
              (["runUsage", "businessRunUsage"].includes(family)
                ? financeRunId
                : null) ||
            !("orderId" in raw) ||
            raw.orderId !==
              (["orderUsage", "publicOrderUsage", "researchRunUsage"].includes(
                family,
              )
                ? orderId
                : null) ||
            !("accountId" in raw) ||
            raw.accountId !== accountId ||
            !("namespace" in raw) ||
            raw.namespace !==
              (family === "usageBudgets" ? financeNamespace : null) ||
            !("budgetScope" in raw) ||
            raw.budgetScope !==
              (family === "usageBudgets" ? financeBudgetScope : null) ||
            result.creationUpperBound === null)) ||
        (remainingFamily &&
          (!("experimentId" in raw) ||
            raw.experimentId !== (needsExperiment ? experimentId : null) ||
            !("assignmentId" in raw) ||
            raw.assignmentId !==
              (family === "experimentBindings" ? assignmentId : null))) ||
        (remainingFamily &&
          (!("accountId" in raw) ||
            raw.accountId !== (needsRemainingAccount ? accountId : null) ||
            !("profileId" in raw) ||
            raw.profileId !==
              (family === "researchVersionRecords" ? profileId : null) ||
            !("kind" in raw) ||
            raw.kind !==
              (["calibrationReferences", "calibrationModels"].includes(family)
                ? selectedRemainingKind
                : null) ||
            result.creationUpperBound === null)) ||
        (intelligenceFamily &&
          (!("kind" in raw) ||
            raw.kind !==
              (family === "intelligenceSourceUpdates" ? updateKind : null) ||
            !("draftId" in raw) ||
            raw.draftId !== (family === "assessments" ? draftId : null) ||
            !("accountId" in raw) ||
            raw.accountId !== (ownIntelligence ? null : accountId) ||
            result.creationUpperBound === null)) ||
        (privateFamily &&
          ("accountId" in raw ? raw.accountId !== accountId : true)) ||
        (needsConversation &&
          (!("conversationId" in raw) ||
            raw.conversationId !== conversationId)) ||
        (needsOrder && (!("orderId" in raw) || raw.orderId !== orderId)) ||
        (family === "publicOrders" &&
          (!("profileId" in raw) || raw.profileId !== profileId)) ||
        (family === "conversationRuns" &&
          (!("operationId" in raw) || raw.operationId !== operationId)) ||
        (family === "orderSources" &&
          (!("operation" in raw) || raw.operation !== operation)) ||
        ([
          "conversations",
          "conversationOperations",
          "targetedOrders",
          "publicOrders",
        ].includes(family) &&
          result.creationUpperBound === null) ||
        (["conversationRuns", "orderSources"].includes(family) &&
          (!("nextOffset" in raw) ||
            raw.nextOffset !== offset + 1 ||
            raw.cursor !== String(offset + 1))) ||
        result.observedAt > now ||
        result.proofValidUntil <= now ||
        result.proofValidUntil > result.observedAt + 30_000 ||
        (sent.creationUpperBound !== null &&
          result.creationUpperBound !== sent.creationUpperBound) ||
        new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
      )
        throw new Error("EXPORT_SCOPE_CHANGED");
      revoke();
      if (result.data.selection.rows.length) {
        const payload = recordsFamily
          ? recordsData(result.data as RecordsArchive["data"])
          : financeFamily
            ? financeData(result.data as FinanceArchive["data"])
            : remainingFamily
              ? remainingData(result.data as RemainingArchive["data"])
              : intelligenceFamily
                ? intelligenceData(result.data as IntelligenceArchive["data"])
                : privateFamily
                  ? privateData(result.data as PrivateArchive["data"])
                  : downloadData(result.data as Archive["data"]);
        const serialized = JSON.stringify(payload);
        if (new TextEncoder().encode(serialized).length > 64 * 1024)
          throw Error("EXPORT_DATA_UNAVAILABLE");
        const beforeURL = Date.now();
        if (
          !stillCurrent() ||
          !Number.isFinite(beforeURL) ||
          Object.is(beforeURL, -0) ||
          beforeURL < result.observedAt ||
          beforeURL >= result.proofValidUntil
        )
          throw Error("EXPORT_SOURCE_EXPIRED");
        const url = URL.createObjectURL(
          new Blob([serialized], { type: "application/json" }),
        );
        objectURL.current = url;
        const link = document.createElement("a");
        link.href = url;
        link.download = `dispatch-workspace-${family}.json`;
        const handoffAt = Date.now();
        if (
          !stillCurrent() ||
          !Number.isFinite(handoffAt) ||
          Object.is(handoffAt, -0) ||
          handoffAt < result.observedAt ||
          handoffAt >= result.proofValidUntil
        )
          throw new Error("EXPORT_SOURCE_EXPIRED");
        link.click();
        timer.current = setTimeout(revoke, 1000);
        setStatus("Archivseite wurde zum Download übergeben.");
      } else
        setStatus("Diese Seite enthält keine freigegebenen Archivinhalte.");
      const advanceAt = Date.now();
      if (
        !stillCurrent() ||
        !Number.isFinite(advanceAt) ||
        Object.is(advanceAt, -0) ||
        advanceAt >= result.proofValidUntil
      )
        throw new Error("EXPORT_SOURCE_EXPIRED");
      position.current = {
        cursor: result.cursor,
        creationUpperBound: result.creationUpperBound,
        epoch,
      };
      setDone(result.isDone);
    } catch (error) {
      // A healthy multi-row window that only overflows in combination is
      // retried once, one row at a time, from the same cursor.
      if (
        !narrow &&
        stillCurrent() &&
        (error as { data?: unknown })?.data === "EXPORT_PAGE_OVERSIZED"
      ) {
        inFlight.current = false;
        setBusy(false);
        return download(true);
      }
      if (stillCurrent()) {
        revoke();
        setError(
          "Archiv-Export konnte nicht erstellt werden. Bitte erneut versuchen.",
        );
      }
    } finally {
      if (stillCurrent()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <Section
      title="Inhalte und Verlauf exportieren"
      description="Lade die erhaltenen Inhalte eines Archivbereichs seitenweise herunter. Quellen und Berechtigungen werden bei jeder Seite erneut geprüft. Diese Auswahl ist kein Snapshot. Draft-Versionshistorie und eigene Einstellungen haben separate Exporte; Chatnachrichten und Ablaufschritte zeigen den erhaltenen Verlauf mit fortlaufender Seitenauswahl. Medienbytes sind nicht enthalten."
    >
      {family === "mediaVersionReferences" && (
        <>
          <label htmlFor="archive-reference-kind">Versionstyp</label>
          <select
            id="archive-reference-kind"
            className="native-select mb-3"
            value={recordsVersionKind}
            onChange={(e) =>
              setRecordsVersionKind(e.target.value as "draft" | "idea")
            }
          >
            <option value="draft">Draft-Version</option>
            <option value="idea">Ideen-Version</option>
          </select>
          <label htmlFor="archive-reference-version">Versions-ID</label>
          <input
            id="archive-reference-version"
            value={recordsVersionId}
            onChange={(e) => setRecordsVersionId(e.target.value)}
            className="input mb-3"
          />
        </>
      )}
      <label htmlFor="archive-family" className="block text-sm mb-2">
        Archivbereich
      </label>
      <select
        id="archive-family"
        className="native-select mb-3"
        value={family}
        onChange={(e) => setFamily(e.target.value as Family)}
      >
        {Object.entries({
          ...(["Owner", "Admin"].includes(role)
            ? { ...families, ...remainingFamilies }
            : {}),
          ...Object.fromEntries(
            Object.entries(recordsFamilies).filter(
              ([k]) => k.startsWith("own") || ["Owner", "Admin"].includes(role),
            ),
          ),
          ...privateFamilies,
          ...Object.fromEntries(
            Object.entries(financeFamilies).filter(
              ([k]) =>
                ![
                  "metricsUsage",
                  "historyUsage",
                  "usageBudgets",
                  "businessFinanceRuns",
                  "businessRunUsage",
                  "publicFinanceOrders",
                  "publicOrderUsage",
                ].includes(k) || ["Owner", "Admin"].includes(role),
            ),
          ),
          ...Object.fromEntries(
            Object.entries(intelligenceFamilies).filter(
              ([key]) =>
                key.startsWith("own") || ["Owner", "Admin"].includes(role),
            ),
          ),
        })
          .filter(
            ([value]) =>
              value !== "publicOrders" || ["Owner", "Admin"].includes(role),
          )
          .map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
      </select>
      {privateFamily && (
        <p className="muted text-sm mb-3">
          Wähle einen aktiven Account. Verwende die nativen IDs aus den
          Unterhaltungs-, Vorgangs- oder Research-Archivseiten. Jeder
          übergeordnete Datensatz wird erneut geprüft.
        </p>
      )}
      {intelligenceFamily && (
        <p className="muted text-sm mb-3">
          Eigene Vorgänge umfassen den Workspace. Gemeinsame Profile und
          Bewertungen verwenden den aktiven Account. Nicht mehr freigegebene
          Inhalte sind ausdrücklich als nicht verfügbar gekennzeichnet.
        </p>
      )}
      {remainingFamily &&
        ["calibrationReferences", "calibrationModels"].includes(family) && (
          <label className="block text-sm mb-3">
            Datensatzart
            <select
              className="native-select block"
              value={selectedRemainingKind}
              onChange={(e) =>
                setRemainingKind(e.target.value as typeof remainingKind)
              }
            >
              {(family === "calibrationReferences"
                ? ["spec", "snapshot"]
                : [
                    "experiment",
                    "candidate",
                    "evaluation",
                    "monitoring-declaration",
                    "monitoring-check",
                    "activation-decision",
                    "monitoring-tombstone",
                  ]
              ).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        )}
      {["runUsage", "businessRunUsage"].includes(family) && (
        <label className="block text-sm mb-3">
          KI-Lauf-ID
          <input
            className="native-input block"
            value={financeRunId}
            onChange={(e) => setFinanceRunId(e.target.value.trim())}
          />
        </label>
      )}
      {["businessFinanceRuns", "businessRunUsage"].includes(family) && (
        <label className="block text-sm mb-3">
          KI-Zweck
          <select
            className="native-select block"
            value={financePurpose}
            onChange={(e) =>
              setFinancePurpose(e.target.value as typeof financePurpose)
            }
          >
            {["summary", "research", "draft", "plan"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      )}
      {family === "usageBudgets" && (
        <>
          <label className="block text-sm mb-3">
            Budgetbereich
            <select
              className="native-select block"
              value={financeNamespace}
              onChange={(e) =>
                setFinanceNamespace(e.target.value as typeof financeNamespace)
              }
            >
              {[
                "generation",
                "native-search",
                "jev",
                "metrics",
                "history",
                "embedding",
              ].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm mb-3">
            Budgetumfang
            <select
              className="native-select block"
              value={financeBudgetScope}
              onChange={(e) =>
                setFinanceBudgetScope(
                  e.target.value as typeof financeBudgetScope,
                )
              }
            >
              <option value="account">Account</option>
              <option value="workspace">Workspace</option>
            </select>
          </label>
        </>
      )}
      {needsExperiment && (
        <label className="block text-sm mb-3">
          Experiment-ID
          <input
            className="native-input block"
            value={experimentId}
            onChange={(e) => setExperimentId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "experimentBindings" && (
        <label className="block text-sm mb-3">
          Zuordnungs-ID
          <input
            className="native-input block"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "assessments" && (
        <label className="block text-sm mb-3">
          Entwurf-ID
          <input
            className="native-input block"
            value={draftId}
            onChange={(e) => setDraftId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "intelligenceSourceUpdates" && (
        <label className="block text-sm mb-3">
          Quellverlauf
          <select
            className="native-select block"
            value={updateKind}
            onChange={(e) => setUpdateKind(e.target.value as typeof updateKind)}
          >
            <option value="check">Prüfungen</option>
            <option value="proposal">Vorschläge</option>
            <option value="evaluation">Bewertungen</option>
          </select>
        </label>
      )}
      {needsConversation && (
        <label className="block text-sm mb-3">
          Unterhaltung-ID
          <input
            className="native-input block"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value.trim())}
          />
        </label>
      )}
      {(family === "publicOrders" ||
        family === "researchVersionRecords" ||
        family === "publicFinanceOrders") && (
        <label className="block text-sm mb-3">
          Research-Profil-ID
          <input
            className="native-input block"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value.trim())}
          />
        </label>
      )}
      {(needsOrder ||
        ["orderUsage", "publicOrderUsage", "researchRunUsage"].includes(
          family,
        )) && (
        <label className="block text-sm mb-3">
          Research-Auftrag-ID
          <input
            className="native-input block"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "conversationRuns" && (
        <label className="block text-sm mb-3">
          Chatvorgang-ID
          <input
            className="native-input block"
            value={operationId}
            onChange={(e) => setOperationId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "orderSources" && (
        <label className="block text-sm mb-3">
          Quellenart
          <select
            className="native-select block"
            value={operation}
            onChange={(e) => setOperation(e.target.value as typeof operation)}
          >
            <option value="web-search">Websuche</option>
            <option value="x-recent">X-Beiträge</option>
            <option value="x-trends">X-Trends</option>
          </select>
        </label>
      )}
      <Button
        variant="outline"
        disabled={busy || !authId || !sessionId || !ready}
        onClick={() => download()}
      >
        <Download size={15} />
        {done
          ? "Neue Archivauswahl beginnen"
          : position.current.cursor === null
            ? "Erste Archivseite herunterladen"
            : "Nächste Archivseite herunterladen"}
      </Button>
      {busy && (
        <p role="status" className="muted text-sm mt-3">
          Archivseite wird geprüft …
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm mt-3">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="muted text-sm mt-3">
          {status}
          {done
            ? " Das Ende dieser Auswahl wurde erreicht."
            : " Die nächste Seite kann geladen werden."}
        </p>
      )}
    </Section>
  );
}
