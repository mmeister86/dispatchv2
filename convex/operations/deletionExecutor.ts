import { ConvexError, v, type ValidatorJSON, type Value } from "convex/values";
import type { GenericMutationCtx, GenericDataModel } from "convex/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server";
import { internal, components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { sessionDoc } from "../media/uploads";
import { workflow } from "../ai/researchAgent";
import type { WorkflowId } from "@convex-dev/workflow";

// Explicit dispositions: new schema families require review before deletion can finish.
const disposition = {
  researchCopyBindings: "D",
  researchSourceBindings: "D",
  xBindings: "F",
  embeddingPolicies: "D",
  embeddingControls: "D",
  contentEmbeddings: "D",
  styleProfileVersions: "D",
  styleProfileControls: "D",
  styleProfileCommands: "D",
  learningProposals: "D",
  calibrationControls: "D",
  calibrationModels: "D",
  calibrationPurposes: "D",
  calibrationReferences: "D",
  editorialExperiments: "D",
  editorialExperimentCommands: "D",
  editorialExperimentAssignments: "D",
  editorialExperimentBindings: "D",
  planningSeries: "D",
  planningSeriesVersions: "D",
  planningSeriesCommands: "D",
  semanticPlanBindings: "D",
  contentPlans: "D",
  contentPlanItems: "D",
  performanceContentPolicies: "D",
  contentFeedback: "D",
  historyPolicies: "D",
  historyControls: "D",
  historyJobs: "D",
  historyPosts: "D",
  performancePolicies: "D",
  performanceControls: "D",
  publicationKnowledge: "D",
  performanceSnapshots: "D",
  recommendationReceipts: "D",
  jevAssessmentRequests: "D",
  jevAssessments: "D",
  intelligenceSourceUpdates: "D",
  algorithmProfiles: "D",
  audienceProfiles: "D",
  intelligenceSelections: "D",
  intelligenceProfileReceipts: "D",
  ideaRunCopies: "D",
  draftResearchCopies: "D",
  researchContentHandoffs: "D",
  researchClusters: "D",
  researchEvidence: "D",
  researchProfiles: "D",
  researchProfileVersions: "D",
  researchOrders: "C",
  researchSourcePolicies: "D",
  researchCaches: "D",
  researchSources: "F",
  conversations: "C",
  chatOperations: "C",
  ideas: "D",
  ideaVersions: "D",
  ideaFeedback: "D",
  contentRequests: "D",
  jevRoutingOperations: "D",
  jevPolicies: "D",
  jevControls: "D",
  aiPolicies: "G",
  aiBudgets: "E",
  agentRuns: "C",
  aiAttempts: "E",
  githubContexts: "D",
  githubAdmissionOrder: "G",
  githubRevocationBarriers: "G",
  githubWebhookReceipts: "G",
  githubDeliveryGuids: "G",
  githubSignals: "D",
  githubRecoveries: "D",
  githubRecoveryScan: "G",
  githubConnections: "S",
  githubOAuthStates: "S",
  githubRepositories: "D",
  xPostAttempts: "E",
  xMediaCheckpoints: "E",
  xOAuthFence: "G",
  xOAuthStates: "S",
  xCredentials: "S",
  mediaUploadSessions: "E",
  mediaVersionReferences: "D",
  editorialNotices: "D",
  editorialReviewPolicies: "D",
  editorialReviewControls: "D",
  editorialReviewDecisions: "D",
  editorialReviewCommands: "D",
  editorialComments: "D",
  socialAccounts: "D",
  mediaAssets: "E",
  drafts: "D",
  draftVersions: "D",
  approvals: "D",
  schedules: "E",
  editorialEvents: "D",
  publishingNotifications: "D",
  teamInvitations: "E",
  teamCommands: "D",
  memberships: "D",
  preferences: "D",
} as const;
const families = Object.keys(disposition).sort((a, b) =>
  a === "mediaVersionReferences" ? -1 : b === "mediaVersionReferences" ? 1 : 0,
) as (keyof typeof disposition)[];
const workspaceIndexes: Partial<Record<keyof typeof disposition, string>> = {
  embeddingPolicies: "by_workspaceId_and_accountId",
  embeddingControls: "by_workspaceId_and_accountId",
  styleProfileVersions: "by_workspaceId_and_accountId",
  styleProfileControls: "by_workspaceId_and_accountId",
  styleProfileCommands: "by_workspaceId_and_accountId",
  learningProposals: "by_workspaceId_and_accountId",
  calibrationControls: "by_workspaceId_and_accountId",
  calibrationModels: "by_workspaceId_and_accountId_and_kind",
  calibrationPurposes: "by_workspaceId_and_accountId",
  calibrationReferences: "by_workspaceId_and_accountId_and_kind",
  editorialExperiments: "by_workspaceId_and_accountId",
  editorialExperimentCommands:
    "by_workspaceId_and_accountId_and_actorId_and_commandKey",
  planningSeries: "by_workspaceId",
  planningSeriesVersions: "by_workspaceId",
  planningSeriesCommands: "by_workspaceId",
  semanticPlanBindings: "by_workspaceId",
  contentPlans: "by_workspaceId",
  contentPlanItems: "by_workspaceId",
  performanceContentPolicies: "by_workspaceId_and_accountId",
  contentFeedback: "by_workspaceId",
  historyPolicies: "by_workspaceId_and_accountId",
  historyControls: "by_workspaceId_and_accountId",
  historyJobs: "by_workspaceId_and_accountId",
  historyPosts: "by_workspaceId_and_accountId_and_providerCreatedAt",
  performancePolicies: "by_workspaceId_and_accountId",
  performanceControls: "by_workspaceId_and_accountId",
  publicationKnowledge: "by_workspaceId_and_accountId",
  performanceSnapshots: "by_workspaceId_and_accountId",
  recommendationReceipts: "by_workspaceId_and_actorId",
  jevAssessmentRequests: "by_workspaceId_and_actorId",
  jevAssessments:
    "by_workspaceId_and_accountId_and_draftVersionId_and_semanticKey",
  intelligenceSourceUpdates: "by_scope_kind",
  algorithmProfiles: "by_scope",
  audienceProfiles: "by_scope",
  intelligenceSelections: "by_scope",
  intelligenceProfileReceipts: "by_scope",
  researchContentHandoffs: "by_workspaceId_and_actorId_and_requestHash",
  researchClusters: "by_workspaceId_and_accountId_and_key",
  researchEvidence: "by_workspaceId_and_accountId_and_createdAt",
  researchProfiles: "by_workspaceId_and_accountId",
  researchOrders: "by_workspace_account_actor",
  researchSourcePolicies: "by_workspaceId_and_accountId_and_operation",
  researchCaches: "by_workspaceId_and_accountId_and_key",
  researchSources:
    "by_workspaceId_and_accountId_and_operation_and_providerIdentity",
  conversations: "by_workspaceId_and_accountId_and_actorId",
  ideas: "by_workspaceId",
  ideaVersions: "by_workspaceId",
  ideaFeedback: "by_workspaceId",
  contentRequests: "by_workspaceId_and_actorId",
  jevRoutingOperations: "by_workspaceId_and_actorId",
  jevPolicies: "by_scope",
  agentRuns: "by_workspace_account_actor",
  aiAttempts: "by_workspace_account_actor",
  githubContexts: "by_workspaceId_and_actorId_and_operationKey",
  githubSignals: "by_workspaceId_and_eventKey",
  githubRecoveries: "by_workspaceId_and_state_and_leaseUntil",
  githubConnections: "by_workspaceId",
  githubOAuthStates: "by_workspaceId",
  githubRepositories: "by_workspaceId_and_providerId",
  xPostAttempts: "by_workspaceId_and_accountId_and_externalId",
  xMediaCheckpoints: "by_workspaceId",
  xOAuthStates: "by_workspaceId_and_userId",
  xCredentials: "by_workspaceId",
  mediaUploadSessions: "by_workspaceId_and_requestId",
  editorialNotices: "by_workspaceId_and_recipientId_and_createdAt",
  editorialReviewPolicies: "by_workspaceId",
  editorialReviewControls: "by_workspaceId",
  editorialReviewDecisions: "by_workspaceId",
  editorialReviewCommands: "by_workspaceId",
  editorialComments: "by_workspaceId",
  socialAccounts: "by_workspaceId",
  mediaAssets: "by_workspaceId",
  drafts: "by_workspaceId",
  draftVersions: "by_workspaceId",
  approvals: "by_workspaceId",
  schedules: "by_workspaceId",
  editorialEvents: "by_workspaceId",
  publishingNotifications: "by_workspaceId_and_createdAt",
  teamInvitations: "by_workspaceId",
  teamCommands: "by_workspaceId_and_actorId_and_commandKey",
  memberships: "by_workspaceId",
  preferences: "by_workspaceId_and_activeSummary",
};

type DynamicCtx = GenericMutationCtx<GenericDataModel>;
type Row = Record<string, any>;
const cast = (ctx: MutationCtx) => ctx as unknown as DynamicCtx;
const phases = [
  "stop",
  "components",
  "objects",
  "rows",
  "auth",
  "verify",
  "complete",
] as const;
const ownPrivate = new Set([
  "preferences",
  "memberships",
  "xOAuthStates",
  "githubOAuthStates",
]);
const actorPrivate = new Set([
  "conversations",
  "chatOperations",
  "agentRuns",
  "contentRequests",
  "jevRoutingOperations",
  "jevAssessmentRequests",
  "recommendationReceipts",
  "githubContexts",
  "researchProfiles",
  "researchProfileVersions",
  "researchOrders",
  "researchCaches",
  "researchEvidence",
  "researchContentHandoffs",
]);
const authModels = [
  "account",
  "twoFactor",
  "oauthApplication",
  "oauthAccessToken",
  "oauthConsent",
  "verification",
  "session",
  "user",
] as const;

async function owned(
  ctx: MutationCtx,
  job: Doc<"deletionJobs">,
  table: string,
  row: Row,
) {
  const workspaceIds = job.deleteWorkspaces.map((w) => w.workspaceId as string);
  if (workspaceIds.includes(row.workspaceId)) return true;
  if (table === "researchCopyBindings" || table === "researchSourceBindings") {
    for (const parent of [row.orderId, row.evidenceId, row.sourceId].filter(
      Boolean,
    )) {
      const root = await cast(ctx).db.get(parent);
      if (
        root &&
        (workspaceIds.includes(String(root.workspaceId)) ||
          (job.scope === "account" && root.actorId === job.userId))
      )
        return true;
    }
  }
  if (table === "xBindings" && row.accountId) {
    const account = await cast(ctx).db.get(row.accountId);
    if (account && workspaceIds.includes(String(account.workspaceId)))
      return true;
  }
  return (
    job.scope === "account" &&
    ((ownPrivate.has(table) && row.userId === job.userId) ||
      (actorPrivate.has(table) && row.actorId === job.userId) ||
      (table === "editorialComments" && row.authorId === job.userId) ||
      (table === "teamCommands" && row.actorId === job.userId) ||
      (table === "editorialNotices" &&
        (row.actorId === job.userId || row.recipientId === job.userId)))
  );
}
function refersToUser(row: unknown, userId: string): boolean {
  if (row === userId) return true;
  if (Array.isArray(row)) return row.some((v) => refersToUser(v, userId));
  if (row && typeof row === "object")
    return Object.entries(row).some(
      ([key, v]) => key !== "_id" && refersToUser(v, userId),
    );
  return false;
}
// Required authority IDs point only to the content-free deleted user barrier.
// Optional/nullable references can be removed without violating the table validator.
function scrubReferences(
  value: unknown,
  validator: ValidatorJSON,
  userId: string,
): unknown {
  if (validator.type === "union") {
    if (
      value === userId &&
      validator.value.some((branch) => branch.type === "null")
    )
      return null;
    const branch = validator.value.find((candidate) => {
      if (
        candidate.type === "object" &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        return Object.entries(candidate.value).every(([key, field]) => {
          const actual = (value as Record<string, unknown>)[key];
          return (
            field.fieldType.type !== "literal" ||
            actual === field.fieldType.value
          );
        });
      }
      return candidate.type === "array"
        ? Array.isArray(value)
        : candidate.type === "null"
          ? value === null
          : candidate.type === "id"
            ? typeof value === "string"
            : candidate.type === typeof value;
    });
    return branch ? scrubReferences(value, branch, userId) : value;
  }
  if (validator.type === "array" && Array.isArray(value)) {
    return value
      .filter(
        (item) =>
          !(
            validator.value.type === "id" &&
            validator.value.tableName === "users" &&
            item === userId
          ),
      )
      .map((item) => scrubReferences(item, validator.value, userId));
  }
  if (
    validator.type === "object" &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const result = { ...(value as Record<string, unknown>) };
    for (const [key, field] of Object.entries(validator.value)) {
      if (!(key in result)) continue;
      if (
        field.optional &&
        result[key] === userId &&
        field.fieldType.type === "id" &&
        field.fieldType.tableName === "users"
      )
        delete result[key];
      else result[key] = scrubReferences(result[key], field.fieldType, userId);
    }
    return result;
  }
  return value;
}
async function anonymizeShared(
  ctx: MutationCtx,
  table: string,
  row: Row,
  userId: Id<"users">,
) {
  const definition = schema.tables[table as keyof typeof schema.tables];
  const cleaned = scrubReferences(
    row,
    (definition.validator as unknown as { json: ValidatorJSON }).json,
    userId,
  ) as Row;
  const patch: Record<string, Value | undefined> = {};
  for (const key of Object.keys(row)) {
    if (
      !key.startsWith("_") &&
      JSON.stringify(cleaned[key]) !== JSON.stringify(row[key])
    )
      patch[key] = cleaned[key] as Value | undefined;
  }
  if (table === "ideaFeedback" && row.actorId === userId) patch.text = "";
  if (table === "contentFeedback" && row.actorId === userId) {
    patch.sourceUnavailable = true;
    patch.editExtent = null;
  }
  if (
    table === "publishingNotifications" &&
    (row.recipientId === userId || refersToUser(row.presentation, userId))
  ) {
    patch.presentation = undefined;
    patch.presentationUnavailable = true;
  }
  if (Object.keys(patch).length) await cast(ctx).db.patch(row._id, patch);
  if (table === "contentFeedback" && row.actorId === userId) {
    await ctx.runMutation(internal.ai.styleProfiles.purgeFeedback, {
      feedbackId: row._id,
    });
  }
}
async function cancel(ctx: MutationCtx, id: unknown) {
  if (typeof id !== "string") return;
  const scheduledId = ctx.db.system.normalizeId("_scheduled_functions", id);
  if (!scheduledId) return;
  const scheduled = await ctx.db.system.get(scheduledId);
  if (scheduled?.state.kind === "pending")
    await ctx.scheduler.cancel(scheduledId);
}
async function stopRow(
  ctx: MutationCtx,
  table: string,
  row: Row,
): Promise<Doc<"deletionJobs">["reason"]> {
  const db = cast(ctx).db;
  if (table === "xCredentials")
    await db.patch(row._id, {
      envelope: undefined,
      generation: row.generation + 1,
    });
  if (table === "githubConnections")
    await db.patch(row._id, {
      envelope: undefined,
      status: "disconnected",
      generation: row.generation + 1,
      credentialGeneration: row.credentialGeneration + 1,
      installations: [],
    });
  if (table === "xOAuthStates" || table === "githubOAuthStates")
    await db.patch(row._id, { verifier: undefined, status: "denied" });
  if (table === "socialAccounts")
    await db.patch(row._id, { connection: "disconnected" });
  if (table === "planningSeries") {
    await cancel(ctx, row.scheduledJobId);
    await db.patch(row._id, {
      enabled: false,
      generation: row.generation + 1,
      scheduledJobId: null,
      nextAt: null,
      nextKey: null,
    });
  }
  if (table === "researchProfiles") {
    await cancel(ctx, row.scheduledJobId);
    await db.patch(row._id, {
      scheduledJobId: null,
      scheduleGeneration: row.scheduleGeneration + 1,
      nextAt: null,
    });
  }
  if (table === "preferences") {
    for (const s of row.researchSummaries ?? []) {
      await cancel(ctx, s.job);
      await cancel(ctx, s.expiryJob);
    }
    await db.patch(row._id, {
      researchSummaries: [],
      activeSummary: false,
      summaryEpoch: (row.summaryEpoch ?? 0) + 1,
    });
  }
  if (table === "agentRuns") {
    if (["ready", "running"].includes(row.state))
      await db.patch(row._id, {
        state: "stopped",
        generation: row.generation + 1,
      });
    if (row.executionKey && !row.executionFinishedAt) return "in-flight";
  }
  if (table === "conversations") {
    await ctx.scheduler.runAfter(0, internal.ai.conversations.abortStreams, {
      conversationId: row._id,
      expectedRunId: row.activeRunId,
    });
    await db.patch(row._id, { state: "deleting", cleanupAfter: Date.now() });
  }
  if (table === "researchOrders") {
    if (["queued", "running"].includes(row.state))
      await db.patch(row._id, {
        state: "cancelled",
        generation: row.generation + 1,
      });
    if (row.pipeline?.workflowId && !row.pipeline.workflowCleaned) {
      const status = await ctx.runQuery(
        components.workflow.erasure.scopeStatus,
        {
          workflowId: row.pipeline.workflowId as WorkflowId,
        },
      );
      if (status === "active")
        await workflow.cancel(ctx, row.pipeline.workflowId as WorkflowId);
    }
  }
  if (table === "historyJobs") {
    await cancel(ctx, row.jobId);
    if (["queued", "reading", "paused"].includes(row.state))
      await db.patch(row._id, {
        state: "cancelled",
        generation: row.generation + 1,
        jobId: undefined,
      });
  }
  if (table === "schedules") {
    await cancel(ctx, row.jobId);
    if (
      ["sending", "unknown", "publishing", "reconciliation_required"].includes(
        row.state,
      )
    )
      return "external-outcome";
    await db.patch(row._id, {
      state: "cancelled",
      generation: row.generation + 1,
      jobId: null,
    });
  }
  if (table === "aiAttempts" && !["settled", "cancelled"].includes(row.state))
    return "external-outcome";
  if (table === "aiBudgets" && (row.heldMicros > 0 || row.reservedMicros > 0))
    return "external-outcome";
  if (
    table === "xPostAttempts" &&
    !["confirmed", "rejected"].includes(row.stage)
  )
    return "external-outcome";
  if (
    table === "xMediaCheckpoints" &&
    !["ready", "failed", "expired", "blocked"].includes(row.phase)
  )
    return "external-outcome";
  if (
    table === "teamInvitations" &&
    ["sending", "unknown"].includes(row.delivery?.state)
  )
    return "external-outcome";
  if (table === "researchSources")
    await db.patch(row._id, {
      status: "removed",
      removedAt: row.removedAt ?? Date.now(),
      url: null,
      title: null,
      text: null,
      publishedAt: null,
      count: null,
    });
  if (row.leaseUntil > Date.now()) return "in-flight";
  return undefined;
}
export async function drainThreadFiles(
  ctx: MutationCtx,
  { threadId, expectedUserId }: { threadId: string; expectedUserId: string },
): Promise<"component-proof" | "continue" | null> {
  const page = await ctx.runQuery(components.agent.erasure.listForThread, {
    threadId,
    expectedUserId,
    paginationOpts: { numItems: 25, cursor: null },
  });
  for (const file of page.page) {
    const storageId = ctx.db.system.normalizeId("_storage", file.storageId);
    if (!storageId) return "component-proof";
    const metadata = await ctx.db.system.get(storageId);
    if (metadata && metadata.sha256 !== file.hash) return "component-proof";
  }
  if (page.page.length) {
    const result = await ctx.runMutation(
      components.agent.erasure.deleteUnusedClaimed,
      {
        threadId,
        expectedUserId,
        claims: page.page.map((file) => ({
          fileId: file.fileId,
          storageId: file.storageId,
        })),
      },
    );
    // Native claim/metadata removal and app storage deletion share this mutation transaction.
    for (const id of result.deletedStorageIds) {
      const storageId = ctx.db.system.normalizeId("_storage", id);
      if (!storageId || !page.page.some((file) => file.storageId === id))
        throw new ConvexError("DELETION_STORAGE_CLAIM_INVALID");
      await ctx.storage.delete(storageId);
    }
    return "continue";
  }
  if (!page.isDone) return "component-proof";
  return null;
}
export async function componentRow(
  ctx: MutationCtx,
  job: Doc<"deletionJobs">,
  table: string,
  row: Row,
): Promise<"component-proof" | "in-flight" | "continue" | null> {
  if (table === "agentRuns" && row.executionKey && !row.executionFinishedAt)
    return "in-flight";
  if (table === "chatOperations" && row.promptMessageId) {
    const parent = await ctx.db.get(row.conversationId as Id<"conversations">);
    if (!parent || parent.actorId !== row.actorId) return "component-proof";
  }
  if (["agentRuns", "conversations"].includes(table) && row.threadId) {
    const expectedUserId = String(row.actorId);
    if (!job.componentStage || job.componentStage === "native") {
      await ctx.runQuery(components.agent.erasure.listForThread, {
        threadId: row.threadId,
        expectedUserId,
        paginationOpts: { numItems: 1, cursor: null },
      });
      // The pinned component captures file ownership claims before message/reference erasure.
      const result = await ctx.runMutation(
        components.agent.threads.deleteAllForThreadIdAsync,
        { threadId: row.threadId, limit: 25 },
      );
      await ctx.db.patch(job._id, {
        componentStage: result.isDone ? "residuals" : "native",
        componentPhase: 0,
      });
      return "continue";
    }
    if (job.componentStage === "residuals") {
      const result = await ctx.runMutation(
        components.agent.erasure.deleteThreadResiduals,
        {
          threadId: row.threadId,
          expectedUserId,
          phase: job.componentPhase ?? 0,
        },
      );
      await ctx.db.patch(job._id, {
        componentStage: result.isDone ? "files" : "residuals",
        componentPhase: result.nextPhase,
      });
      return "continue";
    }
    if (job.componentStage === "files") {
      const result = await drainThreadFiles(ctx, {
        threadId: row.threadId,
        expectedUserId,
      });
      if (result) return result;
      await ctx.db.patch(job._id, {
        componentStage: undefined,
        componentPhase: undefined,
      });
    }
  }
  if (table === "researchOrders" && row.pipeline?.workflowId) {
    const workflowId = row.pipeline.workflowId as WorkflowId;
    const status = await ctx.runQuery(components.workflow.erasure.scopeStatus, {
      workflowId,
    });
    if (status === "active") return "in-flight";
    const residuals = await ctx.runMutation(
      components.workflow.erasure.deleteResiduals,
      { workflowId },
    );
    if (!residuals.isDone) return "continue";
    // Original root loss does not erase residual ownership: the fenced app row retains the exact ID.
    if (status === "missing") return null;
    if (!(await workflow.cleanup(ctx, workflowId))) return "in-flight";
    const steps = await workflow.listSteps(ctx, workflowId, {
      paginationOpts: { cursor: null, numItems: 1 },
    });
    if (steps.page.length || !steps.isDone) return "component-proof";
  }
  return null;
}
async function queue(
  ctx: MutationCtx,
  job: Doc<"deletionJobs">,
  patch: Partial<Doc<"deletionJobs">>,
  delay = 0,
) {
  const revision = job.revision + 1;
  await ctx.db.patch(job._id, { ...patch, revision, updatedAt: Date.now() });
  await ctx.scheduler.runAfter(
    delay,
    internal.operations.deletionExecutor.step,
    { jobId: job._id, revision },
  );
}
async function wait(
  ctx: MutationCtx,
  job: Doc<"deletionJobs">,
  reason: NonNullable<Doc<"deletionJobs">["reason"]>,
  table: string,
) {
  const retryCount = (job.retryCount ?? 0) + 1;
  if (
    retryCount >= 8 ||
    reason === "scope-discovery" ||
    reason === "component-proof" ||
    reason === "external-outcome"
  ) {
    await ctx.db.patch(job._id, {
      state: "blocked",
      reason,
      blockedTable: table,
      retryCount,
      updatedAt: Date.now(),
    });
  } else
    await queue(
      ctx,
      job,
      { state: "waiting", reason, blockedTable: table, retryCount },
      10000,
    );
}
async function nextPhase(ctx: MutationCtx, job: Doc<"deletionJobs">) {
  const phase =
    phases[phases.indexOf(job.phase as (typeof phases)[number]) + 1];
  await queue(ctx, job, {
    phase,
    tableIndex: 0,
    cursor: null,
    reason: undefined,
    blockedTable: undefined,
    retryCount: 0,
    state: "running",
  });
}

export const advance = internalMutation({
  args: { jobId: v.id("deletionJobs"), revision: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.revision !== args.revision ||
      !["running", "waiting"].includes(job.state)
    )
      return null;
    const unknown = Object.keys(schema.tables).find(
      (table) =>
        !(table in disposition) &&
        ![
          "users",
          "workspaces",
          "deletionJobs",
          "authRoots",
          "authGuardKey",
          "authLeases",
          "authWritePermits",
          "authEmailIssuance",
          "authLeaseSessions",
          "authReplayFences",
          "authVerificationJournal",
        ].includes(table),
    );
    if (unknown) {
      await wait(ctx, job, "scope-discovery", unknown);
      return null;
    }
    if (job.phase === "auth") {
      if (job.scope === "workspace") {
        await nextPhase(ctx, job);
        return null;
      }
      if (job.cursor !== "captured") {
        const page = await ctx.runMutation(
          internal.operations.authAdmission.captureVerificationPage,
          { jobId: job._id, cursor: job.cursor ?? null },
        );
        await queue(ctx, job, {
          cursor: page.isDone ? "captured" : page.cursor,
          processed: job.processed + page.processed,
        });
        return null;
      }
      const model = authModels[job.authModelIndex ?? 0];
      if (!model) {
        await nextPhase(ctx, job);
        return null;
      }
      const result = await ctx.runMutation(
        internal.operations.authAdmission.purgeNativePage,
        { jobId: job._id, model },
      );
      await queue(ctx, job, {
        processed: job.processed + result.processed,
        authModelIndex: (job.authModelIndex ?? 0) + (result.processed ? 0 : 1),
      });
      return null;
    }
    if (job.phase === "verify" && (job.tableIndex ?? 0) >= families.length) {
      if (job.scope === "account") {
        const proof = await ctx.runQuery(
          internal.operations.authAdmission.nativeErasureProof,
          { jobId: job._id },
        );
        if (!proof.ownedAbsent || proof.rootPresent || !proof.guardConfigured) {
          await wait(ctx, job, "retry-required", "native-auth");
          return null;
        }
      }
      // Rows were exhausted while roots were fenced. Recheck before removing roots.
      for (const w of job.deleteWorkspaces) {
        const root = await ctx.db.get(w.workspaceId);
        if (root?.lifecycle !== "deleting")
          throw new ConvexError("DELETION_ROOT_FENCE_LOST");
        const memberships = await ctx.db
          .query("memberships")
          .withIndex("by_workspaceId", (q) =>
            q.eq("workspaceId", w.workspaceId),
          )
          .take(1);
        if (memberships.length)
          throw new ConvexError("DELETION_MEMBERSHIPS_REMAIN");
        // Retain the content-free lifecycle barrier: restoring child rows cannot revive access.
        await ctx.db.patch(w.workspaceId, {
          lifecycle: "deleted",
          name: "",
          description: "",
          mediaReservedBytes: 0,
          mediaAssetCount: 0,
        });
      }
      if (job.userId) await ctx.db.patch(job.userId, { lifecycle: "deleted" });
      await ctx.db.patch(job._id, {
        phase: "complete",
        state: "complete",
        reason: undefined,
        cursor: undefined,
        updatedAt: Date.now(),
        revision: job.revision + 1,
      });
      return null;
    }
    const table = families[job.tableIndex ?? 0];
    if (!table) {
      if (job.phase === "components" && job.userId) {
        const result = await ctx.runMutation(
          components.agent.erasure.deleteUserMemories,
          { userId: String(job.userId), phase: job.componentPhase ?? 0 },
        );
        if (!result.isDone) {
          await queue(ctx, job, { componentPhase: result.nextPhase });
          return null;
        }
      }
      if (job.phase === "stop" && job.reason) {
        await wait(
          ctx,
          { ...job, tableIndex: 0, cursor: null },
          job.reason,
          job.blockedTable ?? "scope",
        );
        await ctx.db.patch(job._id, { tableIndex: 0, cursor: null });
        return null;
      }
      await nextPhase(ctx, job);
      return null;
    }
    if (
      disposition[table] === "G" ||
      (job.phase === "components" &&
        ![
          "agentRuns",
          "conversations",
          "chatOperations",
          "researchOrders",
        ].includes(table)) ||
      (job.phase === "objects" &&
        ![
          "mediaVersionReferences",
          "mediaUploadSessions",
          "mediaAssets",
        ].includes(table))
    ) {
      await queue(ctx, job, {
        tableIndex: (job.tableIndex ?? 0) + 1,
        cursor: null,
      });
      return null;
    }
    const db = cast(ctx).db;
    const index = workspaceIndexes[table];
    const source =
      job.scope === "workspace" && index
        ? db
            .query(table)
            .withIndex(index, (q) => q.eq("workspaceId", job.workspaceId!))
        : db.query(table); // Bounded discovery also finds prior shared actor references and rootless edges.
    const page = await source.paginate({
      cursor: job.cursor ?? null,
      // The components stage machine (componentStage/componentPhase) is
      // job-global but tracks one row's thread at a time; serializing owned
      // rows one per step keeps later rows from inheriting a stale stage and
      // skipping native capture/erasure. shortcut: per-row stage cursor, when
      // components pages are ever widened again.
      numItems: job.phase === "components" ? 1 : 20,
      maximumBytesRead: 1024 * 1024,
    });
    const restartingStop =
      job.phase === "stop" && !job.tableIndex && !job.cursor;
    let processed = 0,
      reason = restartingStop ? undefined : job.reason,
      blockedTable = restartingStop ? undefined : job.blockedTable;
    for (const value of page.page) {
      const row = value as Row;
      const inScope = await owned(ctx, job, table, row);
      if (!inScope) {
        if (
          job.phase === "stop" &&
          job.userId &&
          refersToUser(row, job.userId)
        ) {
          await anonymizeShared(ctx, table, row, job.userId);
        }
        continue;
      }
      if (job.phase === "stop") {
        const pending = await stopRow(ctx, table, row);
        if (pending) {
          reason = pending;
          blockedTable = table;
        }
      }
      if (job.phase === "components") {
        const componentReason = await componentRow(ctx, job, table, row);
        if (componentReason === "continue") {
          await queue(ctx, job, { state: "running" });
          return null;
        }
        if (componentReason) {
          await wait(ctx, job, componentReason, table);
          return null;
        }
      }
      if (job.phase === "objects") {
        if (table === "mediaVersionReferences")
          await cast(ctx).db.delete(row._id);
        if (table === "mediaUploadSessions" && row.state !== "deleted") {
          // Never shorten a signed PUT's original validity or an in-flight lease.
          if (
            row.expiresAt + 60000 > Date.now() ||
            row.leaseUntil > Date.now()
          ) {
            await wait(ctx, job, "object-cleanup", table);
            return null;
          }
          await cast(ctx).db.patch(row.assetId, { state: "deleting" });
          await cast(ctx).db.patch(row._id, {
            state: "cancelled",
            cleanAfter: Date.now(),
            generation: row.generation + 1,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.operations.deletionObjects.remove,
            { jobId: job._id, sessionId: row._id },
          );
          await wait(ctx, job, "object-cleanup", table);
          return null;
        }
        if (table === "mediaAssets" && row.state !== "deleted") {
          // A legacy asset without its exact namespace/session cannot be safely guessed.
          await wait(ctx, job, "object-cleanup", table);
          return null;
        }
      }
      if (job.phase === "verify") {
        if (
          table === "researchSources" &&
          row.status === "removed" &&
          row.text === null &&
          row.title === null &&
          row.url === null
        )
          continue;
        await queue(ctx, job, {
          phase: "stop",
          tableIndex: 0,
          cursor: null,
          state: "running",
          reason: undefined,
          retryCount: 0,
        });
        return null;
      }
      if (job.phase === "rows") {
        if (table === "researchSources") continue;
        if (table === "xBindings") {
          await cast(ctx).db.patch(row._id, {
            accountId: undefined,
            workspaceId: undefined,
          });
          continue;
        }
        if (table === "memberships") {
          const user = await ctx.db.get(row.userId as Id<"users">);
          if (
            user &&
            user._id !== job.userId &&
            (user.activeWorkspaceId === row.workspaceId ||
              user.defaultWorkspaceId === row.workspaceId)
          ) {
            const other = await ctx.db
              .query("memberships")
              .withIndex("by_userId", (q) => q.eq("userId", user._id))
              .take(101);
            const replacement = other.find(
              (m) =>
                !job.deleteWorkspaces.some(
                  (w) => w.workspaceId === m.workspaceId,
                ),
            );
            if (replacement) {
              const workspace = await ctx.db.get(replacement.workspaceId);
              if (
                !workspace ||
                (workspace.lifecycle && workspace.lifecycle !== "active")
              ) {
                await wait(
                  ctx,
                  job,
                  "scope-discovery",
                  "member-workspace-pointer",
                );
                return null;
              }
              await ctx.db.patch(user._id, {
                activeWorkspaceId: replacement.workspaceId,
                defaultWorkspaceId: replacement.workspaceId,
              });
            }
            // A member with no other workspace retains a deleted root pointer; bootstrap repairs it without shared data loss.
          }
        }
        await cast(ctx).db.delete(row._id);
        processed++;
      }
    }
    await queue(ctx, job, {
      tableIndex: (job.tableIndex ?? 0) + (page.isDone ? 1 : 0),
      cursor: page.isDone ? null : page.continueCursor,
      processed: job.processed + processed,
      reason,
      blockedTable,
      state: "running",
    });
    return null;
  },
});
export const failed = internalMutation({
  args: { jobId: v.id("deletionJobs"), revision: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const job = await ctx.db.get(args.jobId);
    if (
      job &&
      job.revision === args.revision &&
      ["running", "waiting"].includes(job.state)
    )
      await wait(
        ctx,
        job,
        "retry-required",
        families[job.tableIndex ?? 0] ?? job.phase,
      );
    return null;
  },
});
export const step = internalAction({
  args: { jobId: v.id("deletionJobs"), revision: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    try {
      await ctx.runMutation(internal.operations.deletionExecutor.advance, args);
    } catch {
      await ctx.runMutation(internal.operations.deletionExecutor.failed, args);
    }
    return null;
  },
});
export const objectSource = internalQuery({
  args: { jobId: v.id("deletionJobs"), sessionId: v.id("mediaUploadSessions") },
  returns: v.union(sessionDoc, v.null()),
  handler: async (ctx, args): Promise<Doc<"mediaUploadSessions"> | null> => {
    const job = await ctx.db.get(args.jobId),
      session = await ctx.db.get(args.sessionId);
    if (
      !job ||
      job.phase !== "objects" ||
      !session ||
      !job.deleteWorkspaces.some((w) => w.workspaceId === session.workspaceId)
    )
      return null;
    return session;
  },
});
