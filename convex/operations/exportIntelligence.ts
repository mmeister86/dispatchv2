import { retainedHorizon } from "../performance/history";
import { retainedSnapshotHorizon } from "../performance/snapshots";
import { retainedPin, retainedPinHash } from "../performance/models";
import {
  historyPolicyFields,
  historyControlFields,
  historyJobFields,
  historyPostFields,
} from "../performance/historyFields";
import {
  policyFields as performancePolicyFields,
  controlFields as performanceControlFields,
  snapshotFields,
  knowledgeFields,
} from "../performance/fields";
import { projection as savedProjection } from "../performance/modelFields";
import { sha256 } from "../lib/crypto";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  requireReference,
  requireRole,
  workspaceQuery,
} from "../lib/authorization";
import { role } from "../schema";
import {
  EXPORT_PAGE_CANDIDATES,
  EXPORT_PAGE_MAX_BYTES,
  numeric,
  proofContext,
} from "./exportShared";
import { source as assessmentSource } from "../intelligence/assessments";
import { analyzerReceipt } from "../ai/jev/access";
import {
  sourceCheckFields,
  sourceProposalFields,
  sourceEvaluationFields,
  algorithmFields,
  audienceFields,
  selectionFields,
  receiptFields,
} from "../intelligence/sharedFields";
import { assessmentFields } from "../intelligence/assessmentFields";
import { routingResult, routingOperationFields } from "../ai/jev/types";
import {
  versionFields as styleVersionFields,
  controlFields as styleControlFields,
  commandFields as styleCommandFields,
  proposalFields as styleProposalFields,
} from "../ai/styleFields";
import { versionProof, proposalProof, commandProof } from "../ai/styleProfiles";
import { requestFields as contentRequestFields } from "../content/ideaFields";
import {
  verificationSlot,
  verificationResult,
  compositeEnvelope,
} from "../ai/jev/types";
import {
  reference,
  receipt,
  retainedVerificationProof,
} from "../ai/jev/verify";
import { parent as compositeParent } from "../ai/jev/composite";
import { retainedRunProof } from "../ai/sourceAccess";
import { materialWalk } from "../research/pipelineAccess";
import {
  retainedUpdateProof,
  authorized as profileAuthority,
} from "../intelligence/profiles";
import { routingReceipt, retainedRoutingProof } from "../ai/jev/routing";

function pick<T, K extends keyof T>(row: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, row[key]])) as Pick<T, K>;
}
function binding(ok: unknown): asserts ok {
  if (!ok) throw new ConvexError("REFERENCE_ACCESS_DENIED");
}
const availability = {
  materialAvailability: v.union(
    v.literal("retained"),
    v.literal("unavailable"),
  ),
};
const algorithmKeys = [
  "accountId",
  "network",
  "surface",
  "createdBy",
  "createdAt",
  "status",
  "review",
  "retiredAt",
  "update",
  "payload",
] as const;
const requestKeys = [
  "accountId",
  "draftId",
  "draftVersionId",
  "algorithmId",
  "audienceId",
  "selectionRevision",
  "mode",
  "deadline",
] as const;
const routingKeys = [
  "accountId",
  "actorId",
  "ideaId",
  "inputVersionId",
  "inputRevision",
  "deadline",
  "createdAt",
  "questionVersion",
  "normalizationVersion",
] as const;
const audienceKeys = [
  "accountId",
  "network",
  "surface",
  "createdBy",
  "createdAt",
  "status",
  "review",
  "retiredAt",
  "payload",
] as const;
const selectionKeys = [
  "accountId",
  "network",
  "surface",
  "revision",
  "algorithmId",
  "audienceId",
  "selectedBy",
  "updatedAt",
] as const;
const receiptKeys = [
  "accountId",
  "network",
  "surface",
  "actorId",
  "revision",
  "action",
  "reason",
  "algorithmId",
  "audienceId",
  "createdAt",
] as const;
const styleVersionKeys = [
  "accountId",
  "createdBy",
  "createdAt",
  "declaredBy",
  "declaredAt",
  "selfDeclaration",
  "baseVersionId",
  "proposalId",
  "sourceUntil",
  "sourceUnavailable",
  "status",
] as const;
const styleControlKeys = [
  "accountId",
  "revision",
  "selectedVersionId",
  "selectedBy",
  "selectionReceiptId",
  "updatedAt",
] as const;
const styleCommandKeys = [
  "accountId",
  "actorId",
  "revision",
  "action",
  "versionId",
  "proposalId",
  "createdAt",
  "sourceUnavailable",
] as const;
const styleProposalKeys = [
  "accountId",
  "createdBy",
  "createdAt",
  "baseVersionId",
  "baseSelectionReceiptId",
  "feedbackId",
  "draftId",
  "beforeVersionId",
  "resultingVersionId",
  "beforeUntil",
  "resultUntil",
  "sourceUntil",
  "ownExamples",
  "state",
  "decidedBy",
  "decidedAt",
  "resultVersionId",
  "sourceUnavailable",
] as const;
const contentKeys = [
  "accountId",
  "actorId",
  "ideaId",
  "inputVersionId",
  "inputRevision",
  "createdAt",
  "runId",
  "resultIdeaId",
  "outputKind",
  "routingOperationId",
  "compositeParentId",
  "compositeStage",
] as const;
const slotKeys = [
  "actorId",
  "candidateVersionId",
  "producerRunId",
  "inputVersionId",
  "startedAt",
  "deadline",
  "sourceUntil",
  "state",
  "sourceUnavailable",
] as const;
const resultKeys = [
  "candidateVersionId",
  "questionVersion",
  "normalizationVersion",
  "thresholdVersion",
  "model",
  "decision",
  "criteria",
  "reasonKeys",
] as const;
const compositeKeys = [
  "kind",
  "actorId",
  "startedAt",
  "deadline",
  "sourceUntil",
  "sourceUnavailable",
  "state",
  "currency",
  "maxCostMicros",
  "maxCalls",
  "maxToolSteps",
  "repairRequestId",
  "repairRunId",
  "repairedCandidateVersionId",
] as const;
const risk = v.union(
  v.null(),
  v.object({
    candidateVersionId: v.id("ideaVersions"),
    reasonKeys: verificationResult.fields.reasonKeys,
  }),
);
const verificationRow = v.object({
  contentRequestId: v.id("contentRequests"),
  accountId: v.id("socialAccounts"),
  kind: v.union(
    v.literal("standalone"),
    v.literal("first"),
    v.literal("final"),
  ),
  ...pick(verificationSlot.fields, slotKeys),
  ...availability,
  result: v.union(
    v.null(),
    v.object(pick(verificationResult.fields, resultKeys)),
  ),
  stickyRisk: risk,
});
const compositeRow = v.object({
  ...pick(compositeEnvelope.fields, compositeKeys),
  ...availability,
  first: v.union(v.null(), verificationRow),
  final: v.union(v.null(), verificationRow),
  stickyRisk: risk,
});
const assessmentKeys = [
  "accountId",
  "draftId",
  "draftVersionId",
  "versionNumber",
  "algorithmId",
  "audienceId",
  "inputVersion",
  "createdAt",
  "sourceUntil",
  "provenance",
  "result",
] as const;
const updateKeys = [
  "accountId",
  "network",
  "surface",
  "kind",
  "actorId",
  "baseProfileId",
  "baseCommit",
  "headCommit",
  "createdAt",
] as const;
const checkKeys = [
  "expectedPaths",
  "full",
  "state",
  "deadline",
  "notBefore",
  "finishedAt",
  "requests",
  "bytes",
  "proposalId",
  "observation",
] as const;
const evaluationKeys = [
  "proposalId",
  "variant",
  "refs",
  "interpretation",
  "impact",
  "rationale",
  "fullSourceReview",
] as const;
const updateKind = v.union(
  v.literal("check"),
  v.literal("proposal"),
  v.literal("evaluation"),
);
const historyPostKeys = [
  "accountId",
  "jobId",
  "generation",
  "externalId",
  "network",
  "origin",
  "providerCreatedAt",
  "observedAt",
  "sourceUntil",
  "text",
  "contentType",
  "mediaType",
  "replyTo",
  "accountSize",
  "postAttemptId",
  "versionId",
  "thenKnowledgeId",
  "historicalAnalysisId",
  "metricsStatus",
  "removed",
] as const;
const historyJobKeys = [
  "accountId",
  "actorId",
  "generation",
  "policyId",
  "sourceUntil",
  "state",
  "pages",
  "imported",
  "rejected",
  "createdAt",
  "updatedAt",
  "reason",
  "checkpointUntil",
  "attemptId",
] as const;
const historyPolicyKeys = [
  "accountId",
  "version",
  "approvedBy",
  "expiresAt",
  "purpose",
  "dialect",
  "accessEvidence",
  "rightsEvidence",
  "pricingEvidence",
  "protocolEvidence",
  "allocationEvidence",
  "unit",
  "unitMicros",
  "currency",
  "allocatedProviderLimitMicros",
  "retentionMs",
  "maxResults",
] as const;
const historyControlKeys = [
  "accountId",
  "generation",
  "deletedThroughGeneration",
  "updatedAt",
] as const;
const performancePolicyKeys = [
  "accountId",
  "windows",
  "windowsEvidence",
  "version",
  "approvedBy",
  "expiresAt",
  "purpose",
  "dialect",
  "accessEvidence",
  "rightsEvidence",
  "pricingEvidence",
  "protocolEvidence",
  "allocationEvidence",
  "fields",
  "unit",
  "unitMicros",
  "currency",
  "retentionMs",
  "allocatedProviderLimitMicros",
] as const;
const performanceControlKeys = [
  "accountId",
  "contentPolicyId",
  "contentApprovedBy",
  "deletedThroughGeneration",
  "enabled",
  "deleted",
  "generation",
  "actorId",
  "updatedAt",
] as const;
const snapshotKeys = [
  "accountId",
  "postAttemptId",
  "scheduleId",
  "versionId",
  "externalId",
  "position",
  "confirmedAt",
  "windowHours",
  "observedAgeMs",
  "late",
  "dueAt",
  "generation",
  "state",
  "attemptId",
  "requestedAt",
  "observedAt",
  "providerCreatedAt",
  "definitionVersion",
  "dialect",
  "reason",
  "expiresAt",
] as const;
const knowledgeKeys = [
  "accountId",
  "postAttemptId",
  "generation",
  "scheduleId",
  "versionId",
  "network",
  "capturedAt",
  "assessmentId",
  "applicable",
  "reason",
] as const;
const projectionKeys = [
  "version",
  "state",
  "score",
  "reason",
  "formulaVersion",
  "thresholdVersion",
  "proofUntil",
  "operatingUntil",
] as const;
const pinKeys = [
  "assessmentId",
  "purposeId",
  "generation",
  "decisionId",
  "candidateId",
  "evaluationId",
  "declarationId",
  "checkId",
  "capturedAt",
] as const;
const pinValidator = savedProjection.fields.pin.members[1];
const projectionDTO = v.object({
  ...pick(savedProjection.fields, projectionKeys),
  pin: v.union(v.null(), v.object(pick(pinValidator.fields, pinKeys))),
});
const row = v.union(
  v.object({
    id: v.id("historyPosts"),
    createdInDatabaseAt: v.number(),
    ...pick(historyPostFields, historyPostKeys),
    ...availability,
  }),
  v.object({
    id: v.id("historyJobs"),
    createdInDatabaseAt: v.number(),
    ...pick(historyJobFields, historyJobKeys),
  }),
  v.object({
    id: v.id("historyPolicies"),
    createdInDatabaseAt: v.number(),
    ...pick(historyPolicyFields, historyPolicyKeys),
  }),
  v.object({
    id: v.id("historyControls"),
    createdInDatabaseAt: v.number(),
    ...pick(historyControlFields, historyControlKeys),
  }),
  v.object({
    id: v.id("performancePolicies"),
    createdInDatabaseAt: v.number(),
    ...pick(performancePolicyFields, performancePolicyKeys),
  }),
  v.object({
    id: v.id("performanceControls"),
    createdInDatabaseAt: v.number(),
    ...pick(performanceControlFields, performanceControlKeys),
  }),
  v.object({
    id: v.id("performanceSnapshots"),
    createdInDatabaseAt: v.number(),
    ...pick(snapshotFields, snapshotKeys),
    ...availability,
    fields: v.union(v.null(), snapshotFields.fields),
  }),
  v.object({
    id: v.id("publicationKnowledge"),
    createdInDatabaseAt: v.number(),
    ...pick(knowledgeFields, knowledgeKeys),
    ...availability,
    projection: v.optional(v.union(v.null(), projectionDTO)),
  }),

  v.object({
    id: v.id("jevAssessments"),
    ...pick(assessmentFields, assessmentKeys),
    attemptId: v.id("aiAttempts"),
  }),
  v.object({
    id: v.id("recommendationReceipts"),
    accountId: v.id("socialAccounts"),
    actorId: v.id("users"),
    baseVersionId: v.id("draftVersions"),
    versionId: v.id("draftVersions"),
    revision: v.number(),
    createdAt: v.number(),
  }),
  v.object({
    id: v.id("intelligenceSourceUpdates"),
    ...pick(sourceCheckFields, updateKeys),
    ...pick(sourceCheckFields, checkKeys),
    error: v.union(v.string(), v.null()),
    errorRedacted: v.boolean(),
  }),
  v.object({
    id: v.id("intelligenceSourceUpdates"),
    ...pick(sourceProposalFields, updateKeys),
    checkId: sourceProposalFields.checkId,
    observation: sourceProposalFields.observation,
  }),
  v.object({
    id: v.id("intelligenceSourceUpdates"),
    ...pick(sourceEvaluationFields, updateKeys),
    ...pick(sourceEvaluationFields, evaluationKeys),
    reference: v.object(
      pick(sourceEvaluationFields.reference.fields, [
        "version",
        "passed",
        "outcomes",
      ] as const),
    ),
  }),

  v.object({
    id: v.id("audienceProfiles"),
    ...pick(audienceFields, audienceKeys),
  }),
  v.object({
    id: v.id("intelligenceSelections"),
    ...pick(selectionFields, selectionKeys),
  }),
  v.object({
    id: v.id("intelligenceProfileReceipts"),
    ...pick(receiptFields, receiptKeys),
  }),
  v.object({
    id: v.id("styleProfileVersions"),
    ...pick(styleVersionFields, styleVersionKeys),
    ...availability,
    payload: styleVersionFields.payload,
    reason: v.union(v.string(), v.null()),
  }),
  v.object({
    id: v.id("styleProfileControls"),
    ...pick(styleControlFields, styleControlKeys),
  }),
  v.object({
    id: v.id("styleProfileCommands"),
    ...pick(styleCommandFields, styleCommandKeys),
    ...availability,
    reason: v.union(v.string(), v.null()),
  }),
  v.object({
    id: v.id("learningProposals"),
    ...pick(styleProposalFields, styleProposalKeys),
    ...availability,
    preferences: styleProposalFields.preferences,
    reason: v.union(v.string(), v.null()),
    decisionReason: v.union(v.string(), v.null()),
  }),
  verificationRow,
  v.object({
    id: v.id("contentRequests"),
    ...pick(contentRequestFields, contentKeys),
    ...availability,
    sourceUntil: v.union(v.number(), v.null()),
    intent: v.union(v.string(), v.null()),
    verification: v.union(v.null(), verificationRow),
    composite: v.union(v.null(), compositeRow),
  }),

  v.object({
    id: v.id("algorithmProfiles"),
    ...pick(algorithmFields, algorithmKeys),
  }),
  v.object({
    id: v.id("jevAssessmentRequests"),
    actorId: v.id("users"),
    createdAt: v.number(),
    sourceUntil: v.union(v.number(), v.null()),
    ...availability,
    accountId: v.id("socialAccounts"),
    draftId: v.id("drafts"),
    draftVersionId: v.id("draftVersions"),
    algorithmId: v.id("algorithmProfiles"),
    audienceId: v.id("audienceProfiles"),
    selectionRevision: v.number(),
    mode: v.union(v.literal("composer"), v.literal("background")),
    deadline: v.number(),
  }),
  v.object({
    id: v.id("jevRoutingOperations"),
    ...pick(routingOperationFields, routingKeys),
    policyId: routingOperationFields.policyId,
    attemptId: routingOperationFields.attemptId,
    provenance: v.union(
      v.null(),
      v.object({
        policyVersion: v.string(),
        requestedModel: v.string(),
        resolvedModel: v.union(v.string(), v.null()),
      }),
    ),
    status: v.union(routingResult.fields.status, v.null()),
    sourceUnavailable: routingOperationFields.sourceUnavailable,
    sourceUntil: routingOperationFields.sourceUntil,
    ...availability,
    intent: routingOperationFields.intent,
    result: routingOperationFields.result,
    style: v.union(
      v.null(),
      v.object({
        versionId: v.id("styleProfileVersions"),
        selectedBy: v.id("users"),
        selectionReceiptId: v.id("styleProfileCommands"),
        sourceUntil: v.union(v.number(), v.null()),
      }),
    ),
  }),
);
export const family = v.union(
  v.literal("historyPosts"),
  v.literal("historyJobs"),
  v.literal("historyPolicies"),
  v.literal("historyControls"),
  v.literal("performanceSnapshots"),
  v.literal("performancePolicies"),
  v.literal("performanceControls"),
  v.literal("publicationKnowledge"),

  v.literal("assessments"),
  v.literal("ownRecommendationReceipts"),
  v.literal("intelligenceSourceUpdates"),
  v.literal("audienceProfiles"),
  v.literal("intelligenceSelections"),
  v.literal("intelligenceProfileReceipts"),
  v.literal("styleVersions"),
  v.literal("styleControls"),
  v.literal("styleCommands"),
  v.literal("learningProposals"),
  v.literal("ownStandaloneVerifications"),
  v.literal("ownContentRequests"),
  v.literal("algorithmProfiles"),
  v.literal("ownAssessmentRequests"),
  v.literal("ownRoutingOperations"),
);
export type IntelligenceFamily = Infer<typeof family>;
async function scoped<T extends TableNames>(
  ctx: QueryCtx,
  id: Id<T>,
  ws: Id<"workspaces">,
  accountId?: Id<"socialAccounts">,
): Promise<Doc<T>> {
  const r = await ctx.db.get(id);
  binding(r);
  binding(!("workspaceId" in r) || r.workspaceId === ws);
  binding(!accountId || !("accountId" in r) || r.accountId === accountId);
  return r;
}
async function requestReferences(ctx: QueryCtx, r: Doc<"contentRequests">) {
  const run = await scoped(ctx, r.runId, r.workspaceId, r.accountId),
    input = await scoped(ctx, r.inputVersionId, r.workspaceId),
    idea = await scoped(ctx, r.ideaId, r.workspaceId);
  binding(input.ideaId === idea._id && run.actorId === r.actorId);
  if (r.resultIdeaId) {
    const result = await scoped(ctx, r.resultIdeaId, r.workspaceId);
    binding(
      result.actorId === r.actorId && result.operationKey === `run_${r.runId}`,
    );
    const initial = await ctx.db
      .query("ideaVersions")
      .withIndex("by_ideaId_and_number", (q) =>
        q.eq("ideaId", result._id).eq("number", 1),
      )
      .unique();
    binding(
      initial &&
        initial.ideaId === result._id &&
        initial.runId === r.runId &&
        initial.inputVersionId === r.inputVersionId,
    );
  }
  const same = await ctx.db
    .query("contentRequests")
    .withIndex("by_runId", (q) => q.eq("runId", run._id))
    .unique();
  binding(same?._id === r._id);
  if (r.routingOperationId) {
    const op = await scoped(
      ctx,
      r.routingOperationId,
      r.workspaceId,
      r.accountId,
    );
    binding(
      op.actorId === r.actorId &&
        op.ideaId === r.ideaId &&
        op.inputVersionId === r.inputVersionId &&
        op.inputRevision === r.inputRevision,
    );
  }
  let compositeRoot: Doc<"contentRequests"> | null = null;
  let compositeRootRun: Doc<"agentRuns"> | null = null;
  if (r.compositeParentId) {
    const root = await scoped(
      ctx,
      r.compositeParentId,
      r.workspaceId,
      r.accountId,
    );
    binding(
      root.actorId === r.actorId &&
        root.composite?.repairRequestId === r._id &&
        root.composite.actorId === r.actorId &&
        (!root.composite.first || root.composite.first.actorId === r.actorId) &&
        (!root.composite.final || root.composite.final.actorId === r.actorId) &&
        root.composite.repairRunId === r.runId &&
        r.compositeStage === "repair" &&
        run.compositeParentId === root._id &&
        run.compositeStage === "repair",
    );
    const rootRun = await scoped(ctx, root.runId, r.workspaceId, r.accountId);
    binding(
      rootRun.actorId === r.actorId &&
        rootRun.compositeParentId === root._id &&
        rootRun.compositeStage === "initial",
    );
    compositeRoot = root;
    compositeRootRun = rootRun;
  }
  if (r.composite) {
    const c = r.composite;
    binding(
      c.actorId === r.actorId &&
        (!c.first || c.first.actorId === r.actorId) &&
        (!c.final || c.final.actorId === r.actorId) &&
        run.compositeParentId === r._id &&
        run.compositeStage === "initial" &&
        !r.verification,
    );
    if (c.repairRequestId) {
      const repair = await scoped(
        ctx,
        c.repairRequestId,
        r.workspaceId,
        r.accountId,
      );
      binding(
        repair.actorId === r.actorId &&
          repair.compositeParentId === r._id &&
          repair.compositeStage === "repair" &&
          repair.runId === c.repairRunId,
      );
      const repairRun = await scoped(
        ctx,
        repair.runId,
        r.workspaceId,
        r.accountId,
      );
      binding(
        repairRun.actorId === r.actorId &&
          repairRun.compositeParentId === r._id &&
          repairRun.compositeStage === "repair",
      );
    } else binding(!c.repairRunId && !c.repairedCandidateVersionId);
  }
  return { run, input, idea, compositeRoot, compositeRootRun };
}
async function verification(
  ctx: QueryCtx,
  r: Doc<"contentRequests">,
  slot:
    | NonNullable<Doc<"contentRequests">["verification"]>
    | NonNullable<NonNullable<Doc<"contentRequests">["composite"]>["first"]>,
  kind: "standalone" | "first" | "final",
  actorId: Id<"users">,
  parentLost = false,
): Promise<Infer<typeof verificationRow>> {
  binding(slot.actorId === actorId);
  const { run } = await requestReferences(ctx, r),
    candidate = await scoped(ctx, slot.candidateVersionId, r.workspaceId),
    producer = await scoped(
      ctx,
      slot.producerRunId,
      r.workspaceId,
      r.accountId,
    ),
    input = await scoped(ctx, slot.inputVersionId, r.workspaceId);
  binding(
    candidate.runId === producer._id &&
      ((candidate.sourceUnavailable && !candidate.candidate) ||
        (candidate.candidate?.contentHash === slot.contentHash &&
          candidate.candidate?.provenanceHash === slot.provenanceHash)) &&
      producer.actorId === r.actorId &&
      input._id === r.inputVersionId,
  );
  binding(
    kind === "final"
      ? r.composite?.repairRunId === producer._id
      : producer._id === r.runId,
  );
  const ref = reference(r, slot);
  if (slot.attemptId) await receipt(ctx, slot.attemptId, ref);
  if (slot.result) {
    binding(
      slot.result.candidateVersionId === slot.candidateVersionId &&
        slot.result.contentHash === slot.contentHash &&
        slot.result.provenanceHash === slot.provenanceHash,
    );
  }
  if (slot.stickyRisk)
    binding(
      slot.stickyRisk.candidateVersionId === slot.candidateVersionId &&
        slot.stickyRisk.contentHash === slot.contentHash,
    );
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", slot.actorId).eq("workspaceId", r.workspaceId),
    )
    .unique();
  const lost =
    parentLost ||
    slot.sourceUnavailable ||
    candidate.sourceUnavailable ||
    !!run.sourceCleanupState ||
    !m ||
    m.role === "Viewer" ||
    (slot.sourceUntil !== null && slot.sourceUntil <= Date.now());
  const sourceUntil = lost
    ? slot.sourceUntil
    : await retainedVerificationProof(ctx, r, slot);
  return {
    contentRequestId: r._id,
    accountId: r.accountId,
    kind,
    ...pick(slot, slotKeys),
    sourceUntil,
    materialAvailability: lost ? "unavailable" : "retained",
    result: lost || !slot.result ? null : pick(slot.result, resultKeys),
    stickyRisk:
      lost || !slot.stickyRisk
        ? null
        : pick(slot.stickyRisk, ["candidateVersionId", "reasonKeys"]),
  };
}
const safeUpdateError = (s: string) =>
  /^(deadline_or_request_limit|response_byte_or_deadline_limit|rate_limited|invalid_head|transport_failed|authority_or_base_changed|deadline_elapsed|http_[1-5][0-9]{2}|compare_incomplete_or_nonancestor|changed_paths_incomplete|invalid_changed_path|path_evidence_limit|duplicate_changed_path)$/.test(
    s,
  );
async function updateReferences(
  ctx: QueryCtx,
  r: Doc<"intelligenceSourceUpdates">,
) {
  const base = await scoped(ctx, r.baseProfileId, r.workspaceId, r.accountId);
  binding(
    base.network === r.network &&
      base.surface === r.surface &&
      base.payload.commit === r.baseCommit &&
      (await sha256(JSON.stringify(base.payload))) === r.baseIdentity,
  );
  const same = (x: Doc<"intelligenceSourceUpdates">) =>
    x.network === r.network &&
    x.surface === r.surface &&
    x.baseProfileId === r.baseProfileId &&
    x.baseIdentity === r.baseIdentity &&
    x.baseCommit === r.baseCommit &&
    x.headCommit === r.headCommit;
  const proposal =
    r.kind === "proposal"
      ? r
      : r.proposalId
        ? await scoped(ctx, r.proposalId, r.workspaceId, r.accountId)
        : null;
  if (proposal) {
    binding(proposal.kind === "proposal" && same(proposal));
    const check = await scoped(
      ctx,
      proposal.checkId,
      r.workspaceId,
      r.accountId,
    );
    binding(
      check.kind === "check" &&
        same(check) &&
        check.proposalId === proposal._id &&
        check.state === "proposed" &&
        check.actorId === proposal.actorId &&
        JSON.stringify(check.observation) ===
          JSON.stringify(proposal.observation),
    );
    binding(proposal.headCommit === proposal.observation.commit);
    if (r.kind === "check") binding(check._id === r._id);
  }
  if (r.kind === "evaluation")
    binding(proposal && r.createdAt >= proposal.createdAt);
  if ("observation" in r && r.observation)
    for (const issue of r.observation.issues)
      if (!safeUpdateError(issue))
        throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
}
async function draftReferences(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
  draftId: Id<"drafts">,
  versionId: Id<"draftVersions">,
) {
  await scoped(ctx, accountId, ws);
  await scoped(ctx, draftId, ws);
  const ver = await scoped(ctx, versionId, ws);
  binding(ver.draftId === draftId && ver.content.accountId === accountId);
  return ver;
}
async function originalAdminLost(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  actorId: Id<"users">,
  owner = false,
) {
  const user = await ctx.db.get(actorId);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", actorId).eq("workspaceId", ws),
    )
    .unique();
  return (
    !user ||
    !membership ||
    !(owner ? ["Owner"] : ["Owner", "Admin"]).includes(membership.role)
  );
}
// Only direct current rights loss is a tombstone; malformed original bindings still fail the page.
async function measurementRightsLost(
  ctx: QueryCtx,
  original: Doc<"historyPolicies"> | Doc<"performancePolicies">,
  kind: "history" | "metrics",
) {
  const { workspaceId: ws, accountId } = original;
  const account = await scoped(ctx, accountId, ws);
  const current =
    kind === "history"
      ? await ctx.db
          .query("historyPolicies")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q.eq("workspaceId", ws).eq("accountId", accountId),
          )
          .order("desc")
          .first()
      : await ctx.db
          .query("performancePolicies")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q.eq("workspaceId", ws).eq("accountId", accountId),
          )
          .order("desc")
          .first();
  const cred = await ctx.db
    .query("xCredentials")
    .withIndex("by_accountId", (q) => q.eq("accountId", accountId))
    .unique();
  if (cred) binding(cred.workspaceId === ws && cred.accountId === accountId);
  const ownerBinding = await ctx.db
    .query("xBindings")
    .withIndex("by_providerIdentity", (q) =>
      q.eq("providerIdentity", original.providerIdentity),
    )
    .unique();
  if (ownerBinding)
    binding(
      ownerBinding.workspaceId === ws && ownerBinding.accountId === accountId,
    );
  let lost =
    original.expiresAt <= Date.now() ||
    !current ||
    current.expiresAt <= Date.now() ||
    account.connection !== "connected" ||
    original.providerIdentity !== account.providerIdentity ||
    original.connectionSequence !==
      (account.xEvidence?.connectionSequence ?? 0) ||
    !ownerBinding ||
    !cred ||
    !cred.envelope ||
    cred.expiresAt <= Date.now() + 15000 ||
    !!cred.leaseUntil ||
    !["tweet.read", "users.read"].every((s) => cred.scopes.includes(s)) ||
    (await originalAdminLost(ctx, ws, original.approvedBy));
  if (current) {
    lost ||= await originalAdminLost(ctx, ws, current.approvedBy);
    for (const [i, key] of [
      `${kind}:x`,
      `${kind}:workspace:${ws}`,
      `${kind}:account:${accountId}`,
    ].entries()) {
      const b = await ctx.db
        .query("aiBudgets")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (b)
        binding(
          b.scope === ["provider", "workspace", "account"][i] &&
            (i === 0
              ? b.workspaceId === undefined && b.accountId === undefined
              : b.workspaceId === ws &&
                (i === 1
                  ? b.accountId === undefined
                  : b.accountId === accountId)),
        );
      lost ||=
        !b ||
        b.expiresAt <= Date.now() ||
        !b.purposes.includes(
          kind === "history" ? "own-history" : "own-metrics",
        );
      if (b?.approvedBy)
        lost ||= await originalAdminLost(ctx, ws, b.approvedBy);
    }
  }
  return { lost, current };
}
async function publicationReferences(
  ctx: QueryCtx,
  k: Doc<"publicationKnowledge">,
) {
  const ws = k.workspaceId,
    accountId = k.accountId;
  const attempt = await scoped(ctx, k.postAttemptId, ws, accountId),
    schedule = await scoped(ctx, k.scheduleId, ws, accountId);
  binding(
    attempt.scheduleId === schedule._id &&
      attempt.versionId === k.versionId &&
      schedule.versionId === k.versionId &&
      attempt.generation === k.generation &&
      attempt.providerIdentity === k.providerIdentity &&
      attempt.position === 0 &&
      attempt.requestStartedAt !== undefined &&
      k.capturedAt <= attempt.requestStartedAt &&
      (!k.applicable || (k.assessmentId !== null && k.reason === null)),
  );
  await draftReferences(ctx, ws, accountId, schedule.draftId, k.versionId);
  const unique = await ctx.db
    .query("publicationKnowledge")
    .withIndex("by_postAttemptId", (q) =>
      q.eq("postAttemptId", k.postAttemptId),
    )
    .unique();
  binding(unique?._id === k._id);
  if (k.assessmentId) {
    const a = await scoped(ctx, k.assessmentId, ws, accountId);
    binding(
      a.draftId === schedule.draftId &&
        a.draftVersionId === k.versionId &&
        a.createdAt <= k.capturedAt,
    );
  }
  return schedule;
}
async function historyReceiptReferences(
  ctx: QueryCtx,
  job: Doc<"historyJobs">,
  policy: Doc<"historyPolicies">,
) {
  if (!job.attemptId) return;
  const ws = job.workspaceId,
    accountId = job.accountId;
  const a = await scoped(ctx, job.attemptId, ws, accountId);
  binding(
    a.owner === "own-history" &&
      a.runId === undefined &&
      a.researchOrderId === undefined &&
      a.logicalIntent === undefined &&
      a.historyJobId === job._id &&
      Number.isSafeInteger(a.generation) &&
      a.generation >= 1 &&
      a.generation <= job.generation &&
      a.policyId === policy._id &&
      a.policyFingerprint === job.policyFingerprint &&
      Number.isSafeInteger(a.page) &&
      a.page >= 0 &&
      a.page < 3 &&
      (a.state === "settled" || job.pages === a.page) &&
      a.policyVersion === policy.version &&
      a.currency === policy.currency &&
      a.unitMicros === policy.unitMicros &&
      a.maxResults === policy.maxResults &&
      a.reservedMicros === a.maxResults * a.unitMicros,
  );
  binding(a.budgetIds.length === 3 && new Set(a.budgetIds).size === 3);
  for (const [i, id] of a.budgetIds.entries()) {
    const grant = await scoped(ctx, id, ws, accountId);
    binding(
      grant.key ===
        [
          "history:x",
          `history:workspace:${ws}`,
          `history:account:${accountId}`,
        ][i] &&
        grant.scope === ["provider", "workspace", "account"][i] &&
        grant.currency === a.currency &&
        (i === 0
          ? grant.workspaceId === undefined && grant.accountId === undefined
          : grant.workspaceId === ws &&
            (i === 1
              ? grant.accountId === undefined
              : grant.accountId === accountId)),
    );
  }
}
async function historyReferences(ctx: QueryCtx, r: Doc<"historyPosts">) {
  const ws = r.workspaceId,
    accountId = r.accountId,
    job = await scoped(ctx, r.jobId, ws, accountId),
    policy = await scoped(ctx, job.policyId, ws, accountId);
  const control = await ctx.db
    .query("historyControls")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", ws).eq("accountId", accountId),
    )
    .unique();
  binding(
    control &&
      Number.isSafeInteger(r.generation) &&
      r.generation >= 1 &&
      r.generation <= job.generation &&
      job.generation <= control.generation &&
      job.policyFingerprint === (await sha256(JSON.stringify(policy))),
  );
  const same = await ctx.db
    .query("historyPosts")
    .withIndex("by_workspaceId_and_accountId_and_externalId", (q) =>
      q
        .eq("workspaceId", ws)
        .eq("accountId", accountId)
        .eq("externalId", r.externalId),
    )
    .unique();
  binding(same?._id === r._id);
  await historyReceiptReferences(ctx, job, policy);
  binding((r.postAttemptId === null) === (r.versionId === null));
  if (r.postAttemptId) {
    const a = await scoped(ctx, r.postAttemptId, ws, accountId),
      schedule = await scoped(ctx, a.scheduleId, ws, accountId);
    binding(
      a.versionId === r.versionId &&
        a.externalId === r.externalId &&
        schedule.versionId === r.versionId,
    );
    await draftReferences(ctx, ws, accountId, schedule.draftId, r.versionId!);
  }
  if (r.thenKnowledgeId) {
    const k = await scoped(ctx, r.thenKnowledgeId, ws, accountId);
    binding(k.postAttemptId === r.postAttemptId && k.versionId === r.versionId);
    await publicationReferences(ctx, k);
  }
  return { job, policy, control };
}
async function snapshotReferences(
  ctx: QueryCtx,
  r: Doc<"performanceSnapshots">,
) {
  const ws = r.workspaceId,
    accountId = r.accountId,
    post = await scoped(ctx, r.postAttemptId, ws, accountId),
    schedule = await scoped(ctx, r.scheduleId, ws, accountId);
  binding(
    post.stage === "confirmed" &&
      post.scheduleId === r.scheduleId &&
      post.versionId === r.versionId &&
      post.externalId === r.externalId &&
      schedule.versionId === r.versionId &&
      post.position === r.position &&
      post.confirmedAt === r.confirmedAt &&
      schedule.externalPosts?.some(
        (x) =>
          x.attemptId === post._id &&
          x.externalId === r.externalId &&
          x.position === r.position,
      ),
  );
  await draftReferences(ctx, ws, accountId, schedule.draftId, r.versionId);
  const same = await ctx.db
    .query("performanceSnapshots")
    .withIndex("by_postAttemptId_and_windowHours", (q) =>
      q.eq("postAttemptId", post._id).eq("windowHours", r.windowHours),
    )
    .unique();
  binding(same?._id === r._id);
  let policy: Doc<"performancePolicies"> | null = null;
  if (r.attemptId) {
    const a = await scoped(ctx, r.attemptId, ws, accountId);
    binding(
      a.owner === "own-metrics" &&
        a.runId === undefined &&
        a.researchOrderId === undefined &&
        a.logicalIntent === undefined &&
        a.snapshotId === r._id &&
        a.generation === r.generation,
    );
    binding(a.budgetIds.length === 3 && new Set(a.budgetIds).size === 3);
    for (const [i, id] of a.budgetIds.entries()) {
      const grant = await scoped(ctx, id, ws, accountId);
      binding(
        grant.key ===
          [
            "metrics:x",
            `metrics:workspace:${ws}`,
            `metrics:account:${accountId}`,
          ][i] &&
          grant.scope === ["provider", "workspace", "account"][i] &&
          grant.currency === a.currency &&
          (i === 0
            ? grant.workspaceId === undefined && grant.accountId === undefined
            : grant.workspaceId === ws &&
              (i === 1
                ? grant.accountId === undefined
                : grant.accountId === accountId)),
      );
    }
    policy = await scoped(ctx, a.policyId, ws, accountId);
    binding(
      a.currency === policy.currency &&
        a.unitMicros === policy.unitMicros &&
        a.reservedMicros === a.unitMicros,
    );
    binding(
      a.policyFingerprint === (await sha256(JSON.stringify(policy))) &&
        a.policyVersion === policy.version &&
        post.providerIdentity === policy.providerIdentity,
    );
    if (r.state === "observed")
      binding(
        a.state === "settled" &&
          policy.version === r.definitionVersion &&
          policy.dialect === r.dialect,
      );
  }
  if (r.state === "observed")
    binding(policy && r.observedAt !== null && r.requestedAt !== null);
  for (const f of r.fields)
    binding(
      f.status === "measured"
        ? f.value !== null && Number.isSafeInteger(f.value) && f.value >= 0
        : f.value === null,
    );
  return policy;
}

async function knowledgePinLost(ctx: QueryCtx, r: Doc<"publicationKnowledge">) {
  const p = r.projection!,
    pin = p.pin!;
  binding(p.score !== null && p.proofUntil !== null);
  const ws = r.workspaceId,
    accountId = r.accountId;
  const assessment = await scoped(ctx, pin.assessmentId, ws, accountId),
    purpose = await scoped(ctx, pin.purposeId, ws, accountId),
    declaration = await scoped(ctx, pin.declarationId, ws, accountId),
    decision = await scoped(ctx, pin.decisionId, ws, accountId),
    check = await scoped(ctx, pin.checkId, ws, accountId),
    candidate = await scoped(ctx, pin.candidateId, ws, accountId),
    evaluation = await scoped(ctx, pin.evaluationId, ws, accountId);
  binding(
    assessment.semanticKey === pin.semanticKey &&
      (await retainedPinHash(assessment)) === pin.assessmentFingerprint &&
      (await retainedPinHash(declaration)) === pin.declarationFingerprint &&
      (await retainedPinHash(decision)) === pin.decisionFingerprint &&
      (await retainedPinHash(check)) === pin.checkFingerprint,
  );
  binding(
    declaration.kind === "monitoring-declaration" &&
      decision.kind === "activation-decision" &&
      decision.payload.action === "activate" &&
      "expiresAt" in decision &&
      check.kind === "monitoring-check" &&
      candidate.kind === "candidate" &&
      evaluation.kind === "evaluation",
  );
  binding(
    declaration.purposeId === pin.purposeId &&
      declaration.generation === pin.generation &&
      declaration.candidateId === pin.candidateId &&
      declaration.payload.evaluationId === pin.evaluationId &&
      decision.declarationId === declaration._id &&
      decision.payload.candidateId === candidate._id &&
      decision.payload.evaluationId === evaluation._id &&
      check.declarationId === declaration._id &&
      check.payload.status === "pass" &&
      candidate.purposeId === pin.purposeId &&
      candidate.generation === pin.generation &&
      evaluation.payload.candidateId === candidate._id &&
      evaluation.purposeId === pin.purposeId &&
      evaluation.generation === pin.generation,
  );
  const spec = await scoped(ctx, declaration.specId, ws, accountId),
    experiment = await scoped(ctx, declaration.experimentId!, ws, accountId),
    checkSnapshot = await scoped(ctx, check.payload.snapshotId, ws, accountId),
    trainSnapshot = await scoped(
      ctx,
      candidate.payload.trainSnapshotId,
      ws,
      accountId,
    ),
    evaluationSnapshot = await scoped(
      ctx,
      evaluation.payload.snapshotId,
      ws,
      accountId,
    );
  binding(
    experiment.kind === "experiment" &&
      spec.kind === "spec" &&
      checkSnapshot.kind === "snapshot" &&
      trainSnapshot.kind === "snapshot" &&
      evaluationSnapshot.kind === "snapshot",
  );
  const originalSpec = await scoped(ctx, experiment.specId, ws, accountId);
  binding(originalSpec.kind === "spec");
  if (
    !evaluation.payload.evidenceQualified ||
    experiment.payload.mode !== "prospective" ||
    candidate.payload.transfer === null ||
    candidate.payload.transfer === 0
  )
    throw new ConvexError("CALIBRATION_PROSPECTIVE_CANDIDATE_REQUIRED");
  if (
    (await retainedPinHash(experiment.payload.policy)) !==
    experiment.payload.policyFingerprint
  )
    throw new ConvexError("CALIBRATION_POLICY_CHANGED");
  binding(
    experiment.payload.specFingerprint ===
      (await retainedPinHash(originalSpec)) &&
      experiment.payload.purposeFingerprint === purpose.fingerprint &&
      declaration.payload.purposeFingerprint === purpose.fingerprint &&
      evaluation.payload.specFingerprint ===
        experiment.payload.specFingerprint &&
      evaluation.payload.policyFingerprint ===
        experiment.payload.policyFingerprint &&
      candidate.specId === originalSpec._id &&
      evaluation.specId === originalSpec._id &&
      trainSnapshot.specId === originalSpec._id &&
      evaluationSnapshot.specId === originalSpec._id &&
      checkSnapshot.specId === spec._id &&
      originalSpec.purposeId === purpose._id &&
      originalSpec.generation === pin.generation &&
      [trainSnapshot, evaluationSnapshot, checkSnapshot].every(
        (snapshot) =>
          snapshot.purposeId === purpose._id &&
          snapshot.generation === pin.generation,
      ) &&
      (await retainedPinHash(spec.payload.compatibility)) ===
        (await retainedPinHash(experiment.payload.compatibility)) &&
      (await retainedPinHash(declaration.payload.compatibility)) ===
        (await retainedPinHash(experiment.payload.compatibility)),
  );
  binding(
    declaration.payload.candidateFingerprint ===
      (await retainedPinHash(candidate)) &&
      declaration.payload.evaluationFingerprint ===
        (await retainedPinHash(evaluation)) &&
      declaration.payload.specFingerprint === (await retainedPinHash(spec)) &&
      declaration.payload.policyFingerprint ===
        (await retainedPinHash(declaration.payload.policy)) &&
      evaluation.payload.candidateFingerprint ===
        (await retainedPinHash(candidate)) &&
      evaluation.payload.snapshotFingerprint ===
        (await retainedPinHash(evaluationSnapshot)) &&
      candidate.payload.trainSnapshotFingerprint ===
        (await retainedPinHash(trainSnapshot)) &&
      check.payload.snapshotFingerprint ===
        (await retainedPinHash(checkSnapshot)) &&
      check.payload.declarationFingerprint ===
        (await retainedPinHash(declaration)) &&
      candidate.experimentId === experiment._id &&
      evaluation.experimentId === experiment._id &&
      experiment.purposeId === purpose._id &&
      experiment.generation === pin.generation &&
      check.specId === spec._id &&
      check.purposeId === purpose._id &&
      check.generation === pin.generation &&
      spec.purposeId === purpose._id &&
      spec.generation === pin.generation,
  );
  const version = await scoped(ctx, r.versionId, ws);
  return (
    p.proofUntil! <= Date.now() ||
    experiment.expiresAt <= Date.now() ||
    originalSpec.expiresAt <= Date.now() ||
    trainSnapshot.expiresAt <= Date.now() ||
    evaluationSnapshot.expiresAt <= Date.now() ||
    (experiment.payload.policy !== null &&
      experiment.payload.policy.reviewUntil <= Date.now()) ||
    decision.expiresAt <= Date.now() ||
    declaration.expiresAt <= Date.now() ||
    check.expiresAt <= Date.now() ||
    candidate.expiresAt <= Date.now() ||
    evaluation.expiresAt <= Date.now() ||
    spec.expiresAt <= Date.now() ||
    checkSnapshot.expiresAt <= Date.now() ||
    declaration.payload.policy.reviewUntil <= Date.now() ||
    purpose.expiresAt <= Date.now() ||
    !!purpose.withdrawal ||
    (assessment.sourceUntil !== null && assessment.sourceUntil <= Date.now()) ||
    !!version.sourceUnavailable ||
    (await originalAdminLost(ctx, ws, decision.actorId, true)) ||
    (await originalAdminLost(ctx, ws, declaration.actorId, true)) ||
    (await originalAdminLost(ctx, ws, check.actorId)) ||
    (experiment.payload.policy !== null &&
      (await originalAdminLost(ctx, ws, experiment.payload.policy.reviewerId)))
  );
}

export const page = workspaceQuery({
  args: {
    expectedAuthId: v.string(),
    expectedSessionId: v.string(),
    requestKey: v.string(),
    family,
    kind: v.optional(updateKind),
    accountId: v.optional(v.id("socialAccounts")),
    draftId: v.optional(v.id("drafts")),
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
    draftId: v.union(v.id("drafts"), v.null()),
    kind: v.union(updateKind, v.null()),
    data: v.object({
      format: v.literal("dispatch-workspace-intelligence"),
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
    const own = a.family.startsWith("own");
    if (!own) requireRole(original.membership, ["Owner", "Admin"]);
    if (own ? a.accountId !== undefined : a.accountId === undefined)
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      (a.family === "assessments") !== (a.draftId !== undefined) ||
      (a.family === "intelligenceSourceUpdates") !== (a.kind !== undefined)
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
    const creationUpperBound = a.creationUpperBound ?? observedAt,
      ws = original.workspace._id,
      ctx = proofContext(original, ws);
    if (a.accountId) requireReference(ws, await ctx.db.get(a.accountId));
    let proofValidUntil = observedAt + 30000;
    const horizon = (n: number | null) => {
      numeric(n);
      if (n !== null) {
        if (n <= observedAt) throw new ConvexError("EXPORT_SOURCE_UNAVAILABLE");
        proofValidUntil = Math.min(proofValidUntil, n);
      }
      return n;
    };
    let selected: { continueCursor: string; isDone: boolean };
    const rows: Infer<typeof row>[] = [];
    const narrow = a.narrowPage === true;
    switch (a.family) {
      case "historyPosts":
      case "historyJobs":
      case "historyPolicies":
      case "historyControls":
      case "performanceSnapshots":
      case "performancePolicies":
      case "performanceControls":
      case "publicationKnowledge": {
        const p = await ctx.db
          .query(a.family)
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const value of p.page) {
          binding(value.workspaceId === ws && value.accountId === a.accountId);
          for (const key of [
            "generation",
            "deletedThroughGeneration",
            "position",
            "pages",
            "imported",
            "rejected",
            "unitMicros",
            "allocatedProviderLimitMicros",
            "maxResults",
          ] as const) {
            if (key in value) {
              const n = value[key as keyof typeof value];
              binding(
                n === undefined ||
                  (typeof n === "number" && Number.isSafeInteger(n) && n >= 0),
              );
            }
          }
          if (
            "reason" in value &&
            value.reason !== null &&
            !/^[A-Z][A-Z0-9_]{0,199}$/.test(value.reason)
          )
            throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
          const base = {
            id: value._id,
            createdInDatabaseAt: value._creationTime,
          };
          switch (a.family) {
            case "historyPolicies": {
              const r = value as Doc<"historyPolicies">;
              for (const n of [
                r.unitMicros,
                r.allocatedProviderLimitMicros,
                r.retentionMs,
                r.maxResults,
              ])
                binding(Number.isSafeInteger(n) && n >= 0);
              rows.push({
                ...base,
                id: r._id,
                ...pick(r, historyPolicyKeys),
              });
              break;
            }
            case "historyControls": {
              const r = value as Doc<"historyControls">;
              rows.push({
                ...base,
                id: r._id,
                ...pick(r, historyControlKeys),
              });
              break;
            }
            case "historyJobs": {
              const r = value as Doc<"historyJobs">,
                policy = await scoped(ctx, r.policyId, ws, r.accountId),
                control = await ctx.db
                  .query("historyControls")
                  .withIndex("by_workspaceId_and_accountId", (q) =>
                    q.eq("workspaceId", ws).eq("accountId", r.accountId),
                  )
                  .unique();
              binding(
                control &&
                  Number.isSafeInteger(r.generation) &&
                  r.generation >= 1 &&
                  r.generation <= control.generation,
              );
              binding(
                r.policyFingerprint === (await sha256(JSON.stringify(policy))),
              );
              await historyReceiptReferences(ctx, r, policy);
              for (const n of [r.pages, r.imported, r.rejected])
                binding(Number.isSafeInteger(n) && n >= 0);
              rows.push({ ...base, id: r._id, ...pick(r, historyJobKeys) });
              break;
            }
            case "historyPosts": {
              const r = value as Doc<"historyPosts">,
                { job, policy, control } = await historyReferences(ctx, r);
              const rights = await measurementRightsLost(
                ctx,
                policy,
                "history",
              );
              const lost =
                r.removed ||
                r.text === null ||
                r.sourceUntil <= observedAt ||
                job.sourceUntil <= observedAt ||
                r.generation < job.generation ||
                control.deletedThroughGeneration >= r.generation ||
                rights.lost ||
                (rights.current !== null &&
                  job.createdAt + rights.current.retentionMs <= observedAt) ||
                (await originalAdminLost(ctx, ws, job.actorId));
              if (!lost) horizon(await retainedHorizon(ctx, r));
              rows.push({
                ...base,
                id: r._id,
                ...pick(r, historyPostKeys),
                text: lost ? null : r.text,
                materialAvailability: lost ? "unavailable" : "retained",
              });
              break;
            }
            case "performancePolicies": {
              const r = value as Doc<"performancePolicies">;
              for (const n of [
                r.unitMicros,
                r.allocatedProviderLimitMicros,
                r.retentionMs,
              ])
                binding(Number.isSafeInteger(n) && n >= 0);
              rows.push({
                ...base,
                id: r._id,
                ...pick(r, performancePolicyKeys),
              });
              break;
            }
            case "performanceControls": {
              const r = value as Doc<"performanceControls">;
              if (r.contentPolicyId)
                await scoped(ctx, r.contentPolicyId, ws, r.accountId);
              rows.push({
                ...base,
                id: r._id,
                ...pick(r, performanceControlKeys),
              });
              break;
            }
            case "performanceSnapshots": {
              const r = value as Doc<"performanceSnapshots">,
                policy = await snapshotReferences(ctx, r);
              const c = await ctx.db
                .query("performanceControls")
                .withIndex("by_workspaceId_and_accountId", (q) =>
                  q.eq("workspaceId", ws).eq("accountId", r.accountId),
                )
                .unique();
              const rights = policy
                ? await measurementRightsLost(ctx, policy, "metrics")
                : null;
              const lost =
                r.state !== "observed" ||
                r.expiresAt <= observedAt ||
                !c ||
                c.deleted ||
                r.generation <= (c.deletedThroughGeneration ?? -1) ||
                rights?.lost ||
                (c && (await originalAdminLost(ctx, ws, c.actorId)));
              if (!lost) horizon(await retainedSnapshotHorizon(ctx, r));
              rows.push({
                ...base,
                id: r._id,
                ...pick(r, snapshotKeys),
                fields: lost
                  ? null
                  : r.fields.map((f) =>
                      pick(f, [
                        "name",
                        "rawField",
                        "definition",
                        "status",
                        "value",
                      ]),
                    ),
                materialAvailability: lost ? "unavailable" : "retained",
              });
              break;
            }
            case "publicationKnowledge": {
              const r = value as Doc<"publicationKnowledge">;
              await publicationReferences(ctx, r);
              let lost = false;
              if (r.projection?.state === "candidate") {
                binding(
                  r.projection.pin &&
                    r.applicable &&
                    r.projection.pin.assessmentId === r.assessmentId &&
                    r.projection.pin.capturedAt <= r.capturedAt,
                );
                lost = await knowledgePinLost(ctx, r);
                if (!lost) horizon(await retainedPin(ctx, r, r.projection));
              } else if (r.projection)
                binding(
                  r.projection.score === null && r.projection.pin === null,
                );
              rows.push({
                ...base,
                id: r._id,
                ...pick(r, knowledgeKeys),
                materialAvailability: lost ? "unavailable" : "retained",
                ...(r.projection === undefined
                  ? {}
                  : {
                      projection: lost
                        ? null
                        : {
                            ...pick(r.projection, projectionKeys),
                            pin: r.projection.pin
                              ? pick(r.projection.pin, pinKeys)
                              : null,
                          },
                    }),
              });
              break;
            }
          }
        }
        break;
      }

      case "assessments": {
        await scoped(ctx, a.draftId!, ws);
        const p = await ctx.db
          .query("jevAssessments")
          .withIndex("by_workspaceId_and_accountId_and_draftId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("draftId", a.draftId!)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          const ver = await draftReferences(
            ctx,
            ws,
            r.accountId,
            r.draftId,
            r.draftVersionId,
          );
          binding(ver.number === r.versionNumber);
          for (const id of [r.algorithmId, r.audienceId])
            await scoped(ctx, id, ws, r.accountId);
          const storedAttempt = await scoped(ctx, r.attemptId, ws, r.accountId);
          binding(storedAttempt.owner === "jev-analyzer");
          await scoped(ctx, storedAttempt.policyId, ws, r.accountId);
          const t = await analyzerReceipt(ctx, r.attemptId);
          binding(
            t.owner === "jev-analyzer" &&
              t.draftId === r.draftId &&
              t.draftVersionId === r.draftVersionId &&
              t.algorithmId === r.algorithmId &&
              t.audienceId === r.audienceId &&
              t.policyId === r.provenance.policyId &&
              t.policyVersion === r.provenance.policyVersion &&
              t.model === r.provenance.requestedModel &&
              t.resolvedModel === r.provenance.resolvedModel &&
              t.inputTokens === r.provenance.inputTokens &&
              t.outputTokens === r.provenance.outputTokens &&
              t.sentAt === r.provenance.sentAt &&
              t.settledAt === r.provenance.settledAt &&
              t.latencyMs === r.provenance.latencyMs &&
              t.selectionRevision === r.provenance.selectionRevision,
          );
          const proof = await assessmentSource(ctx, ws, r);
          rows.push({
            id: r._id,
            ...pick(r, assessmentKeys),
            attemptId: r.attemptId,
            sourceUntil: horizon(proof.sourceUntil),
          });
        }
        break;
      }
      case "ownRecommendationReceipts": {
        const p = await ctx.db
          .query("recommendationReceipts")
          .withIndex("by_workspaceId_and_actorId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("actorId", original.user._id)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(r.actorId === original.user._id);
          const base = await scoped(ctx, r.baseVersionId, ws),
            result = await scoped(ctx, r.versionId, ws);
          binding(
            base.draftId === result.draftId &&
              base.content.accountId === r.accountId &&
              result.content.accountId === r.accountId,
          );
          for (const ver of [base, result])
            horizon(
              (
                await assessmentSource(ctx, ws, {
                  accountId: r.accountId,
                  draftId: ver.draftId,
                  draftVersionId: ver._id,
                })
              ).sourceUntil,
            );
          rows.push({
            id: r._id,
            accountId: r.accountId,
            actorId: r.actorId,
            baseVersionId: r.baseVersionId,
            versionId: r.versionId,
            revision: r.revision,
            createdAt: r._creationTime,
          });
        }
        break;
      }
      case "intelligenceSourceUpdates": {
        const p = await ctx.db
          .query("intelligenceSourceUpdates")
          .withIndex("by_scope_kind", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("network", "x")
              .eq("surface", "for_you")
              .eq("kind", a.kind!)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          await updateReferences(ctx, r);
          switch (r.kind) {
            case "check":
              rows.push({
                id: r._id,
                ...pick(r, updateKeys),
                ...pick(r, checkKeys),
                error: r.error && safeUpdateError(r.error) ? r.error : null,
                errorRedacted: !!r.error && !safeUpdateError(r.error),
              });
              break;
            case "proposal":
              rows.push({
                id: r._id,
                ...pick(r, updateKeys),
                checkId: r.checkId,
                observation: r.observation,
              });
              break;
            case "evaluation":
              rows.push({
                id: r._id,
                ...pick(r, updateKeys),
                ...pick(r, evaluationKeys),
                reference: pick(r.reference, ["version", "passed", "outcomes"]),
              });
          }
        }
        break;
      }
      case "audienceProfiles": {
        const p = await ctx.db
          .query("audienceProfiles")
          .withIndex("by_scope", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("network", "x")
              .eq("surface", "for_you")
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page)
          rows.push({ id: r._id, ...pick(r, audienceKeys) });
        break;
      }
      case "intelligenceSelections":
      case "intelligenceProfileReceipts": {
        const table = a.family;
        const p = await ctx.db
          .query(table)
          .withIndex("by_scope", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("network", "x")
              .eq("surface", "for_you")
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          for (const id of [r.algorithmId, r.audienceId])
            if (id) await scoped(ctx, id, ws, a.accountId);
          rows.push(
            "selectedBy" in r
              ? { id: r._id, ...pick(r, selectionKeys) }
              : { id: r._id, ...pick(r, receiptKeys) },
          );
        }
        break;
      }
      case "styleVersions": {
        const p = await ctx.db
          .query("styleProfileVersions")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          if (r.baseVersionId)
            await scoped(ctx, r.baseVersionId, ws, a.accountId);
          if (r.proposalId) {
            const proposal = await scoped(ctx, r.proposalId, ws, a.accountId);
            binding(
              proposal.resultVersionId === r._id &&
                proposal.baseVersionId === r.baseVersionId &&
                proposal.decidedBy === r.createdBy &&
                proposal.state === "accepted",
            );
          }
          const lost =
            r.sourceUnavailable ||
            !r.payload ||
            r.status === "erased" ||
            (r.sourceUntil !== null && r.sourceUntil <= observedAt) ||
            !(await profileAuthority(ctx, ws, r.createdBy)) ||
            !(await profileAuthority(ctx, ws, r.declaredBy));
          const until = lost
            ? r.sourceUntil
            : horizon(await versionProof(ctx, r));
          rows.push({
            id: r._id,
            ...pick(r, styleVersionKeys),
            sourceUntil: until,
            materialAvailability: lost ? "unavailable" : "retained",
            payload: lost ? null : r.payload,
            reason: lost ? null : r.reason,
          });
        }
        break;
      }
      case "styleControls": {
        const p = await ctx.db
          .query("styleProfileControls")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          if (r.selectedVersionId) {
            await scoped(ctx, r.selectedVersionId, ws, a.accountId);
            binding(r.selectionReceiptId && r.selectedBy);
            const receipt = await scoped(
              ctx,
              r.selectionReceiptId,
              ws,
              a.accountId,
            );
            binding(
              receipt.versionId === r.selectedVersionId &&
                receipt.actorId === r.selectedBy &&
                ["select", "rollback"].includes(receipt.action),
            );
          } else binding(!r.selectedBy && !r.selectionReceiptId);
          rows.push({ id: r._id, ...pick(r, styleControlKeys) });
        }
        break;
      }
      case "styleCommands": {
        const p = await ctx.db
          .query("styleProfileCommands")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          if (r.versionId) await scoped(ctx, r.versionId, ws, a.accountId);
          if (r.proposalId) await scoped(ctx, r.proposalId, ws, a.accountId);
          const lost =
            r.sourceUnavailable ||
            !(await profileAuthority(ctx, ws, r.actorId));
          if (!lost) horizon(await commandProof(ctx, r));
          rows.push({
            id: r._id,
            ...pick(r, styleCommandKeys),
            materialAvailability: lost ? "unavailable" : "retained",
            reason: lost ? null : r.reason,
          });
        }
        break;
      }
      case "learningProposals": {
        const p = await ctx.db
          .query("learningProposals")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          const base = await scoped(ctx, r.baseVersionId, ws, a.accountId),
            selection = await scoped(
              ctx,
              r.baseSelectionReceiptId,
              ws,
              a.accountId,
            ),
            feedback = await scoped(ctx, r.feedbackId, ws, a.accountId),
            before = await scoped(ctx, r.beforeVersionId, ws);
          binding(
            selection.versionId === base._id &&
              ["select", "rollback"].includes(selection.action) &&
              feedback.versionId === r.beforeVersionId &&
              feedback.resultingVersionId === r.resultingVersionId &&
              before.draftId === r.draftId &&
              before.content.accountId === a.accountId,
          );
          if (r.resultingVersionId) {
            const after = await scoped(ctx, r.resultingVersionId, ws);
            binding(
              after.draftId === r.draftId &&
                after.content.accountId === a.accountId,
            );
          }
          if (r.resultVersionId) {
            const result = await scoped(
              ctx,
              r.resultVersionId,
              ws,
              a.accountId,
            );
            binding(
              result.proposalId === r._id &&
                result.baseVersionId === r.baseVersionId,
            );
          }
          const lost =
            r.sourceUnavailable ||
            !r.preferences ||
            (r.sourceUntil !== null && r.sourceUntil <= observedAt) ||
            !(await profileAuthority(ctx, ws, r.createdBy)) ||
            (r.decidedBy !== null &&
              !(await profileAuthority(ctx, ws, r.decidedBy)));
          const until = lost
            ? r.sourceUntil
            : horizon(await proposalProof(ctx, r));
          rows.push({
            id: r._id,
            ...pick(r, styleProposalKeys),
            sourceUntil: until,
            materialAvailability: lost ? "unavailable" : "retained",
            preferences: lost ? null : r.preferences,
            reason: lost ? null : r.reason,
            decisionReason: lost ? null : r.decisionReason,
          });
        }
        break;
      }
      case "ownStandaloneVerifications": {
        const p = await ctx.db
          .query("contentRequests")
          .withIndex("by_workspaceId_and_verification_actorId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("verification.actorId", original.user._id)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          requireReference(ws, await ctx.db.get(r.accountId));
          binding(r.verification && !r.composite);
          const v = await verification(
            ctx,
            r,
            r.verification,
            "standalone",
            original.user._id,
          );
          if (v.materialAvailability === "retained") horizon(v.sourceUntil);
          rows.push(v);
        }
        break;
      }
      case "ownContentRequests": {
        const p = await ctx.db
          .query("contentRequests")
          .withIndex("by_workspaceId_and_actorId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("actorId", original.user._id)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(r.actorId === original.user._id);
          requireReference(ws, await ctx.db.get(r.accountId));
          const { run, input, idea, compositeRoot, compositeRootRun } =
              await requestReferences(ctx, r),
            walk = materialWalk(),
            envelope = r.composite ?? compositeRoot?.composite,
            envelopeRun = compositeRootRun ?? run;
          const lost =
            !!(
              envelope &&
              (envelope.sourceUnavailable ||
                envelope.state === "stopped" ||
                (envelope.sourceUntil !== null &&
                  envelope.sourceUntil <= observedAt) ||
                envelopeRun.sourceCleanupState ||
                envelopeRun.state === "stopped" ||
                envelopeRun.state === "failed")
            ) ||
            original.membership.role === "Viewer" ||
            !!run.sourceCleanupState ||
            !!input.sourceUnavailable ||
            idea.status === "archived" ||
            (run.sourceUntil != null && run.sourceUntil <= observedAt);
          if (!lost && compositeRoot) {
            await compositeParent(ctx, compositeRoot._id, false, walk);
            horizon(compositeRoot.composite!.sourceUntil);
          }
          const until = lost
            ? (run.sourceUntil ?? null)
            : horizon(await retainedRunProof(ctx, run, walk, r.accountId));
          let composite: Infer<typeof compositeRow> | null = null;
          if (r.composite) {
            const c = r.composite;
            const unavailable =
              lost ||
              c.sourceUnavailable ||
              c.state === "stopped" ||
              run.state === "stopped" ||
              run.state === "failed" ||
              (c.sourceUntil !== null && c.sourceUntil <= observedAt);
            if (!unavailable) {
              await compositeParent(ctx, r._id, false, walk);
              horizon(c.sourceUntil);
            }
            const first = c.first
                ? await verification(
                    ctx,
                    r,
                    c.first,
                    "first",
                    original.user._id,
                    unavailable,
                  )
                : null,
              final = c.final
                ? await verification(
                    ctx,
                    r,
                    c.final,
                    "final",
                    original.user._id,
                    unavailable,
                  )
                : null;
            for (const v of [first, final])
              if (v?.materialAvailability === "retained")
                horizon(v.sourceUntil);
            composite = {
              ...pick(c, compositeKeys),
              materialAvailability: unavailable ? "unavailable" : "retained",
              first,
              final,
              stickyRisk:
                unavailable || !c.stickyRisk
                  ? null
                  : pick(c.stickyRisk, ["candidateVersionId", "reasonKeys"]),
            };
          }
          const standalone =
            r.verification?.actorId === original.user._id
              ? await verification(
                  ctx,
                  r,
                  r.verification,
                  "standalone",
                  original.user._id,
                  lost,
                )
              : null;
          if (standalone?.materialAvailability === "retained")
            horizon(standalone.sourceUntil);
          rows.push({
            id: r._id,
            ...pick(r, contentKeys),
            materialAvailability: lost ? "unavailable" : "retained",
            sourceUntil: until,
            intent: lost ? null : r.intent,
            verification: standalone,
            composite,
          });
        }
        break;
      }
      case "algorithmProfiles": {
        const p = await ctx.db
          .query("algorithmProfiles")
          .withIndex("by_scope", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId!)
              .eq("network", "x")
              .eq("surface", "for_you")
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(r.workspaceId === ws && r.accountId === a.accountId);
          binding(await retainedUpdateProof(ctx, r));
          rows.push({ id: r._id, ...pick(r, algorithmKeys) });
        }
        break;
      }
      case "ownAssessmentRequests": {
        const p = await ctx.db
          .query("jevAssessmentRequests")
          .withIndex("by_workspaceId_and_actorId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("actorId", original.user._id)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(
            r.actorId === original.user._id &&
              r.workspaceId === ws &&
              r.request.workspaceId === ws &&
              r.request.actorId === r.actorId &&
              r.request.operationKey === r.operationKey,
          );
          requireReference(ws, await ctx.db.get(r.request.accountId));
          for (const id of [r.request.algorithmId, r.request.audienceId]) {
            const profile = await scoped(ctx, id, ws, r.request.accountId);
            binding(profile.network === "x" && profile.surface === "for_you");
          }
          const ver = await draftReferences(
            ctx,
            ws,
            r.request.accountId,
            r.request.draftId,
            r.request.draftVersionId,
          );
          const lost =
            !!ver.sourceUnavailable ||
            (r.sourceUntil !== null && r.sourceUntil <= observedAt) ||
            (ver.researchProofUntil !== undefined &&
              ver.researchProofUntil <= observedAt);
          const until = lost
            ? r.sourceUntil
            : horizon(
                (
                  await assessmentSource(ctx, ws, {
                    ...r.request,
                    sourceUntil: r.sourceUntil,
                  })
                ).sourceUntil,
              );
          rows.push({
            id: r._id,
            actorId: r.actorId,
            createdAt: r.createdAt,
            sourceUntil: until,
            materialAvailability: lost ? "unavailable" : "retained",
            ...pick(r.request, requestKeys),
          });
        }
        break;
      }
      case "ownRoutingOperations": {
        const p = await ctx.db
          .query("jevRoutingOperations")
          .withIndex("by_workspaceId_and_actorId", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("actorId", original.user._id)
              .lte("_creationTime", creationUpperBound),
          )
          .paginate({
            numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(r.actorId === original.user._id && r.workspaceId === ws);
          requireReference(ws, await ctx.db.get(r.accountId));
          const idea = await scoped(ctx, r.ideaId, ws),
            input = await scoped(ctx, r.inputVersionId, ws);
          binding(input.ideaId === idea._id);
          const attempt = r.attemptId
            ? await routingReceipt(ctx, r.attemptId, r._id)
            : null;
          if (r.style) {
            await scoped(ctx, r.style.versionId, ws, r.accountId);
            const receipt = await scoped(
              ctx,
              r.style.selectionReceiptId,
              ws,
              r.accountId,
            );
            binding(
              receipt.actorId === r.style.selectedBy &&
                receipt.versionId === r.style.versionId &&
                ["select", "rollback"].includes(receipt.action),
            );
          }
          if (r.intent?.media)
            for (const m of r.intent.media) await scoped(ctx, m.assetId, ws);
          let lost =
            r.sourceUnavailable ||
            r.intent === null ||
            original.membership.role === "Viewer" ||
            idea.status === "archived" ||
            input.sourceUnavailable ||
            (r.sourceUntil !== null && r.sourceUntil <= observedAt);
          if (r.policyId) {
            const policy = await scoped(ctx, r.policyId, ws, r.accountId);
            binding("purpose" in policy && policy.purpose === "intent-routing");
          }
          let sourceUntil = r.sourceUntil;
          if (!lost)
            try {
              sourceUntil = horizon(
                (await retainedRoutingProof(ctx, r)).sourceUntil,
              );
            } catch (error) {
              if (
                error instanceof ConvexError &&
                error.data === "ROUTING_PURPOSE_WITHDRAWN"
              )
                lost = true;
              else throw error;
            }
          rows.push({
            id: r._id,
            ...pick(r, routingKeys),
            policyId: r.policyId,
            attemptId: r.attemptId,
            provenance: attempt
              ? {
                  policyVersion: attempt.policyVersion,
                  requestedModel: attempt.model,
                  resolvedModel: attempt.resolvedModel ?? null,
                }
              : null,
            status: r.result?.status ?? null,
            sourceUnavailable: r.sourceUnavailable,
            sourceUntil,
            materialAvailability: lost ? "unavailable" : "retained",
            intent: lost ? null : r.intent,
            result: lost ? null : r.result,
            style:
              lost || !r.style
                ? null
                : pick(r.style, [
                    "versionId",
                    "selectedBy",
                    "selectionReceiptId",
                    "sourceUntil",
                  ]),
          });
        }
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
      draftId: a.draftId ?? null,
      kind: a.kind ?? null,
      data: {
        format: "dispatch-workspace-intelligence" as const,
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
    if (sizeOver && !narrow && rows.length > 1)
      throw new ConvexError("EXPORT_PAGE_OVERSIZED");
    if (now < observedAt || proofValidUntil <= now || sizeOver)
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
