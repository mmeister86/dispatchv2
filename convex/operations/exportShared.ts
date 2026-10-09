import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { workspaceQuery, requireRole } from "../lib/authorization";
import { role } from "../schema";
import {
  content,
  draftFields,
  commentFields,
  approvalFields,
  scheduleFields,
  eventFields,
} from "../lib/editorialFields";
import {
  ideaFields,
  ideaVersionFields,
  feedbackFields as ideaFeedbackFields,
} from "../content/ideaFields";
import { feedbackFields as contentFeedbackFields } from "../content/feedbackFields";
import { evidence as feedbackProof } from "../content/feedback";
import { planFields, itemFields } from "../planning/fields";
import {
  controlFields as seriesFields,
  versionFields as seriesVersionFields,
  commandFields as seriesCommandFields,
  bindingFields,
  config,
} from "../planning/strategyFields";
import {
  policyFields,
  controlFields,
  decisionFields,
  commandFields,
} from "../editorial/reviewFields";
import {
  reviewer,
  commandSource,
  historicalReviewSource,
  loss as reviewLoss,
} from "../editorial/reviews";
import { draftResearchProof, ideaProofUntil } from "../research/contentProof";
import { currentIdeaSource } from "../content/ideas";
import {
  seriesAuthority,
  seriesVersionProof,
  seriesPlanProof,
  sourceLoss,
} from "../planning/strategy";
import { candidate, historyTopic } from "../planning/plans";
import { runSourceKey } from "../ai/sourceAccess";

const sourceReference = v.union(
  v.object({
    kind: v.literal("research"),
    evidenceId: v.id("researchEvidence"),
    accountId: v.id("socialAccounts"),
    orderId: v.id("researchOrders"),
    sourceId: v.id("researchSources"),
    sourceGeneration: v.number(),
  }),
  v.object({
    kind: v.literal("work"),
    repositoryId: v.id("githubRepositories"),
    generation: v.number(),
    contextId: v.optional(v.id("githubContexts")),
    signalId: v.optional(v.id("githubSignals")),
    ideaVersionId: v.optional(v.id("ideaVersions")),
  }),
);
const seriesConfig = v.object({
  styleVersionId: config.fields.styleVersionId,
  theme: config.fields.theme,
  candidateVersionIds: config.fields.candidateVersionIds,
  pillars: config.fields.pillars,
  desiredFormat: config.fields.desiredFormat,
  threshold: config.fields.threshold,
  timezone: config.fields.timezone,
  frequency: config.fields.frequency,
  weekday: config.fields.weekday,
  callbackClock: config.fields.callbackClock,
  publishingClocks: config.fields.publishingClocks,
  start: config.fields.start,
  end: config.fields.end,
  occurrences: config.fields.occurrences,
  itemsPerBatch: config.fields.itemsPerBatch,
});
const rows = {
  drafts: v.object({
    id: v.id("drafts"),
    createdInDatabaseAt: v.number(),
    revision: draftFields.revision,
    currentVersionId: draftFields.currentVersionId,
    authorId: draftFields.authorId,
    source: draftFields.source,
    assigneeId: draftFields.assigneeId,
    updatedAt: draftFields.updatedAt,
    content: content,
  }),
  ideas: v.object({
    id: v.id("ideas"),
    createdInDatabaseAt: v.number(),
    actorId: ideaFields.actorId,
    revision: ideaFields.revision,
    currentVersionId: ideaFields.currentVersionId,
    status: ideaFields.status,
    updatedAt: ideaFields.updatedAt,
  }),
  ideaVersions: v.object({
    id: v.id("ideaVersions"),
    createdInDatabaseAt: v.number(),
    ideaId: ideaVersionFields.ideaId,
    number: ideaVersionFields.number,
    actorId: ideaVersionFields.actorId,
    createdAt: ideaVersionFields.createdAt,
    title: ideaVersionFields.title,
    perspective: ideaVersionFields.perspective,
    note: ideaVersionFields.note,
    priority: ideaVersionFields.priority,
    originals: ideaVersionFields.originals,
    rationale: ideaVersionFields.rationale,
    questions: ideaVersionFields.questions,
    inputVersionId: ideaVersionFields.inputVersionId,
    sources: v.array(sourceReference),
    candidate: v.union(content, v.null()),
  }),
  ideaFeedback: v.object({
    id: v.id("ideaFeedback"),
    createdInDatabaseAt: v.number(),
    ideaId: ideaFeedbackFields.ideaId,
    versionId: ideaFeedbackFields.versionId,
    actorId: ideaFeedbackFields.actorId,
    kind: ideaFeedbackFields.kind,
    text: ideaFeedbackFields.text,
    createdAt: ideaFeedbackFields.createdAt,
    resultingVersionId: ideaFeedbackFields.resultingVersionId,
  }),
  contentFeedback: v.object({
    id: v.id("contentFeedback"),
    createdInDatabaseAt: v.number(),
    accountId: contentFeedbackFields.accountId,
    versionId: contentFeedbackFields.versionId,
    resultingVersionId: contentFeedbackFields.resultingVersionId,
    actorId: contentFeedbackFields.actorId,
    kind: contentFeedbackFields.kind,
    createdAt: contentFeedbackFields.createdAt,
    editExtent: contentFeedbackFields.editExtent,
    definition: contentFeedbackFields.definition,
  }),
  contentPlans: v.object({
    id: v.id("contentPlans"),
    createdInDatabaseAt: v.number(),
    accountId: planFields.accountId,
    actorId: planFields.actorId,
    createdAt: planFields.createdAt,
    desiredCount: planFields.desiredCount,
    start: planFields.start,
    end: planFields.end,
    timezone: planFields.timezone,
    clock: planFields.clock,
    mode: planFields.mode,
    topics: planFields.topics,
    preferences: planFields.preferences,
    seriesId: v.union(v.id("planningSeries"), v.null()),
    seriesVersionId: v.union(v.id("planningSeriesVersions"), v.null()),
  }),
  contentPlanItems: v.object({
    id: v.id("contentPlanItems"),
    createdInDatabaseAt: v.number(),
    planId: itemFields.planId,
    accountId: itemFields.accountId,
    draftId: itemFields.draftId,
    versionId: itemFields.versionId,
    versionNumber: itemFields.versionNumber,
    draftRevision: itemFields.draftRevision,
    ideaVersionId: itemFields.ideaVersionId,
    at: itemFields.at,
    timezone: itemFields.timezone,
    localTime: itemFields.localTime,
    reason: itemFields.reason,
    status: itemFields.status,
    acceptedApprovalId: itemFields.acceptedApprovalId,
    acceptedScheduleId: itemFields.acceptedScheduleId,
    acceptedActorId: itemFields.acceptedActorId,
    acceptedMode: itemFields.acceptedMode,
    sources: v.array(sourceReference),
  }),
  planningSeries: v.object({
    id: v.id("planningSeries"),
    createdInDatabaseAt: v.number(),
    accountId: seriesFields.accountId,
    actorId: seriesFields.actorId,
    revision: seriesFields.revision,
    generation: seriesFields.generation,
    enabled: seriesFields.enabled,
    versionId: seriesFields.versionId,
    nextAt: seriesFields.nextAt,
    nextIndex: seriesFields.nextIndex,
    remaining: seriesFields.remaining,
    createdAt: seriesFields.createdAt,
    updatedAt: seriesFields.updatedAt,
  }),
  planningSeriesVersions: v.object({
    id: v.id("planningSeriesVersions"),
    createdInDatabaseAt: v.number(),
    accountId: seriesVersionFields.accountId,
    seriesId: seriesVersionFields.seriesId,
    revision: seriesVersionFields.revision,
    actorId: seriesVersionFields.actorId,
    sequence: seriesVersionFields.sequence,
    createdAt: seriesVersionFields.createdAt,
    config: seriesConfig,
  }),
  planningSeriesCommands: v.object({
    id: v.id("planningSeriesCommands"),
    createdInDatabaseAt: v.number(),
    accountId: seriesCommandFields.accountId,
    seriesId: seriesCommandFields.seriesId,
    actorId: seriesCommandFields.actorId,
    expectedRevision: seriesCommandFields.expectedRevision,
    revision: seriesCommandFields.revision,
    versionId: seriesCommandFields.versionId,
    generation: seriesCommandFields.generation,
    createdAt: seriesCommandFields.createdAt,
  }),
  semanticPlanBindings: v.object({
    id: v.id("semanticPlanBindings"),
    createdInDatabaseAt: v.number(),
    accountId: bindingFields.accountId,
    planId: bindingFields.planId,
    vectorId: bindingFields.vectorId,
    attemptId: bindingFields.attemptId,
  }),
  editorialComments: v.object({
    id: v.id("editorialComments"),
    createdInDatabaseAt: v.number(),
    draftId: commentFields.draftId,
    versionId: commentFields.versionId,
    authorId: commentFields.authorId,
    versionNumber: commentFields.versionNumber,
    text: commentFields.text,
    resolved: commentFields.resolved,
    createdAt: commentFields.createdAt,
  }),
  approvals: v.object({
    id: v.id("approvals"),
    createdInDatabaseAt: v.number(),
    draftId: approvalFields.draftId,
    versionId: approvalFields.versionId,
    accountId: approvalFields.accountId,
    actorId: approvalFields.actorId,
    createdAt: approvalFields.createdAt,
    revokedAt: approvalFields.revokedAt,
    revokedBy: approvalFields.revokedBy,
    purpose: approvalFields.purpose,
    expiresAt: approvalFields.expiresAt,
  }),
  schedules: v.object({
    id: v.id("schedules"),
    createdInDatabaseAt: v.number(),
    draftId: scheduleFields.draftId,
    versionId: scheduleFields.versionId,
    accountId: scheduleFields.accountId,
    approvalId: scheduleFields.approvalId,
    actorId: scheduleFields.actorId,
    generation: scheduleFields.generation,
    at: scheduleFields.at,
    timezone: scheduleFields.timezone,
    localTime: scheduleFields.localTime,
    state: scheduleFields.state,
    confirmedAt: scheduleFields.confirmedAt,
    abortRequestedAt: scheduleFields.abortRequestedAt,
    abortRequestedBy: scheduleFields.abortRequestedBy,
    purpose: scheduleFields.purpose,
  }),
  editorialEvents: v.object({
    id: v.id("editorialEvents"),
    createdInDatabaseAt: v.number(),
    draftId: eventFields.draftId,
    scheduleId: eventFields.scheduleId,
    actorId: eventFields.actorId,
    code: eventFields.code,
    createdAt: eventFields.createdAt,
  }),
  editorialReviewPolicies: v.object({
    id: v.id("editorialReviewPolicies"),
    createdInDatabaseAt: v.number(),
    accountId: policyFields.accountId,
    editorial: policyFields.editorial,
    brand: policyFields.brand,
    actorId: policyFields.actorId,
    revision: policyFields.revision,
    createdAt: policyFields.createdAt,
  }),
  editorialReviewControls: v.object({
    id: v.id("editorialReviewControls"),
    createdInDatabaseAt: v.number(),
    accountId: controlFields.accountId,
    policyId: controlFields.policyId,
    revision: controlFields.revision,
  }),
  editorialReviewDecisions: v.object({
    id: v.id("editorialReviewDecisions"),
    createdInDatabaseAt: v.number(),
    draftId: decisionFields.draftId,
    versionId: decisionFields.versionId,
    accountId: decisionFields.accountId,
    policyId: decisionFields.policyId,
    stage: decisionFields.stage,
    reviewerId: decisionFields.reviewerId,
    priorDecisionId: decisionFields.priorDecisionId,
    createdAt: decisionFields.createdAt,
    withdrawnAt: decisionFields.withdrawnAt,
    withdrawnBy: decisionFields.withdrawnBy,
    active: decisionFields.active,
  }),
  editorialReviewCommands: v.object({
    id: v.id("editorialReviewCommands"),
    createdInDatabaseAt: v.number(),
    accountId: commandFields.accountId,
    actorId: commandFields.actorId,
    kind: commandFields.kind,
    draftId: commandFields.draftId,
    assigneeId: commandFields.assigneeId,
    requestStage: commandFields.requestStage,
    assignmentResult: commandFields.assignmentResult,
    versionId: commandFields.versionId,
    result: commandFields.result,
  }),
};
export const family = v.union(
  v.literal("drafts"),
  v.literal("ideas"),
  v.literal("ideaVersions"),
  v.literal("ideaFeedback"),
  v.literal("contentFeedback"),
  v.literal("contentPlans"),
  v.literal("contentPlanItems"),
  v.literal("planningSeries"),
  v.literal("planningSeriesVersions"),
  v.literal("planningSeriesCommands"),
  v.literal("semanticPlanBindings"),
  v.literal("editorialComments"),
  v.literal("approvals"),
  v.literal("schedules"),
  v.literal("editorialEvents"),
  v.literal("editorialReviewPolicies"),
  v.literal("editorialReviewControls"),
  v.literal("editorialReviewDecisions"),
  v.literal("editorialReviewCommands"),
);
export type SharedFamily = Infer<typeof family>;
const payload = v.union(
  v.object({ family: v.literal("drafts"), rows: v.array(rows.drafts) }),
  v.object({ family: v.literal("ideas"), rows: v.array(rows.ideas) }),
  v.object({
    family: v.literal("ideaVersions"),
    rows: v.array(rows.ideaVersions),
  }),
  v.object({
    family: v.literal("ideaFeedback"),
    rows: v.array(rows.ideaFeedback),
  }),
  v.object({
    family: v.literal("contentFeedback"),
    rows: v.array(rows.contentFeedback),
  }),
  v.object({
    family: v.literal("contentPlans"),
    rows: v.array(rows.contentPlans),
  }),
  v.object({
    family: v.literal("contentPlanItems"),
    rows: v.array(rows.contentPlanItems),
  }),
  v.object({
    family: v.literal("planningSeries"),
    rows: v.array(rows.planningSeries),
  }),
  v.object({
    family: v.literal("planningSeriesVersions"),
    rows: v.array(rows.planningSeriesVersions),
  }),
  v.object({
    family: v.literal("planningSeriesCommands"),
    rows: v.array(rows.planningSeriesCommands),
  }),
  v.object({
    family: v.literal("semanticPlanBindings"),
    rows: v.array(rows.semanticPlanBindings),
  }),
  v.object({
    family: v.literal("editorialComments"),
    rows: v.array(rows.editorialComments),
  }),
  v.object({ family: v.literal("approvals"), rows: v.array(rows.approvals) }),
  v.object({ family: v.literal("schedules"), rows: v.array(rows.schedules) }),
  v.object({
    family: v.literal("editorialEvents"),
    rows: v.array(rows.editorialEvents),
  }),
  v.object({
    family: v.literal("editorialReviewPolicies"),
    rows: v.array(rows.editorialReviewPolicies),
  }),
  v.object({
    family: v.literal("editorialReviewControls"),
    rows: v.array(rows.editorialReviewControls),
  }),
  v.object({
    family: v.literal("editorialReviewDecisions"),
    rows: v.array(rows.editorialReviewDecisions),
  }),
  v.object({
    family: v.literal("editorialReviewCommands"),
    rows: v.array(rows.editorialReviewCommands),
  }),
);

function numeric(value: unknown): void {
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) || Object.is(value, -0))
  )
    throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
  if (value && typeof value === "object")
    for (const item of Object.values(value)) numeric(item);
}
function unavailable(): never {
  throw new ConvexError("EXPORT_SOURCE_UNAVAILABLE");
}
function binding(ok: boolean): asserts ok {
  if (!ok) throw new ConvexError("REFERENCE_ACCESS_DENIED");
}
// Original proof helpers may conflate missing and foreign references; enforce tenant boundaries before they interpret any row.
function proofContext(ctx: QueryCtx, workspaceId: Id<"workspaces">): QueryCtx {
  const check = (value: unknown) => {
    numeric(value);
    if (
      value &&
      typeof value === "object" &&
      "workspaceId" in value &&
      value.workspaceId !== workspaceId
    )
      throw new ConvexError("REFERENCE_ACCESS_DENIED");
  };
  const query = <T extends object>(target: T): T =>
    new Proxy(target, {
      get(target, key) {
        const method = Reflect.get(target, key);
        if (typeof method !== "function") return method;
        return (...args: unknown[]) => {
          const result = Reflect.apply(method, target, args);
          if (
            ["unique", "first", "take", "collect", "paginate"].includes(
              String(key),
            )
          )
            return Promise.resolve(result).then((value) => {
              const rows =
                key === "paginate"
                  ? value.page
                  : Array.isArray(value)
                    ? value
                    : [value];
              for (const row of rows) check(row);
              return value;
            });
          return result && typeof result === "object" ? query(result) : result;
        };
      },
    });
  return {
    ...ctx,
    db: new Proxy(ctx.db, {
      get(target, key) {
        if (key === "get")
          return async (...args: unknown[]) => {
            const value = await Reflect.apply(target.get, target, args);
            check(value);
            return value;
          };
        if (key === "query")
          return (...args: unknown[]) =>
            query(Reflect.apply(target.query, target, args));
        return Reflect.get(target, key);
      },
    }),
  };
}
function references(
  sources: Awaited<ReturnType<typeof currentIdeaSource>>,
): Infer<typeof sourceReference>[] {
  return sources.map((s) =>
    "kind" in s
      ? {
          kind: "research",
          evidenceId: s.evidenceId,
          accountId: s.accountId,
          orderId: s.orderId,
          sourceId: s.sourceId,
          sourceGeneration: s.sourceGeneration,
        }
      : {
          kind: "work",
          repositoryId: s.repositoryId,
          generation: s.generation,
          contextId: s.contextId,
          signalId: s.signalId,
          ideaVersionId: s.ideaVersionId,
        },
  );
}
function knownLoss(error: unknown) {
  if (error instanceof ConvexError) {
    if (
      [
        "REFERENCE_ACCESS_DENIED",
        "STYLE_REFERENCE_ACCESS_DENIED",
        "STYLE_ANCESTRY_LIMIT",
        "RESEARCH_PROOF_ANCESTRY_LIMIT",
      ].includes(String(error.data))
    )
      throw error;
    if (
      [
        "EXPORT_SOURCE_UNAVAILABLE",
        "RESEARCH_REVIEW_REQUIRED",
        "UNVERIFIED_LINEAGE",
        "MEDIA_NOT_READY",
        "MEDIA_SOURCE_CHANGED",
        "MEDIA_SNAPSHOT_CHANGED",
        "CAPABILITY_VALIDATION_FAILED",
      ].includes(String(error.data))
    )
      return;
  }
  try {
    sourceLoss(error);
  } catch (e) {
    reviewLoss(e);
  }
}

export const shared = workspaceQuery({
  args: {
    expectedAuthId: v.string(),
    expectedSessionId: v.string(),
    requestKey: v.string(),
    family,
    cursor: v.union(v.string(), v.null()),
    creationUpperBound: v.union(v.number(), v.null()),
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
    data: v.object({
      format: v.literal("dispatch-workspace-shared"),
      version: v.literal(1),
      workspaceId: v.id("workspaces"),
      selection: payload,
    }),
  }),
  handler: async (original, a) => {
    requireRole(original.membership, ["Owner", "Admin"]);
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
    const observedAt = Date.now();
    numeric(observedAt);
    if (
      observedAt < 0 ||
      (a.cursor !== null && (!a.cursor || a.creationUpperBound === null)) ||
      (a.cursor === null && a.creationUpperBound !== null) ||
      (a.creationUpperBound !== null &&
        (!Number.isFinite(a.creationUpperBound) ||
          Object.is(a.creationUpperBound, -0) ||
          a.creationUpperBound < 0 ||
          a.creationUpperBound > observedAt))
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const creationUpperBound = a.creationUpperBound ?? observedAt,
      workspaceId = original.workspace._id;
    const ctx = proofContext(original, workspaceId);
    let proofValidUntil = observedAt + 30000;
    const horizon = (until: number | null | undefined) => {
      if (until === null || until === undefined) return;
      numeric(until);
      if (until <= observedAt) unavailable();
      proofValidUntil = Math.min(proofValidUntil, until);
    };
    const read = async <T extends TableNames>(id: Id<T>): Promise<Doc<T>> => {
      const row = await ctx.db.get(id);
      if (!row) unavailable();
      return row;
    };
    const account = async (id: Id<"socialAccounts"> | null) => {
      if (id) await read(id);
    };
    const draft = async (
      id: Id<"draftVersions">,
      draftId?: Id<"drafts">,
      accountId?: Id<"socialAccounts"> | null,
    ) => {
      const ver = await read(id),
        root = await read(ver.draftId);
      binding(
        root.workspaceId === workspaceId &&
          (!draftId || root._id === draftId) &&
          (accountId === undefined || ver.content.accountId === accountId),
      );
      await account(ver.content.accountId);
      if (ver.sourceUnavailable) unavailable();
      horizon(ver.researchProofUntil);
      horizon(await draftResearchProof(ctx, ver));
      return ver;
    };
    const idea = async (id: Id<"ideaVersions">, ideaId?: Id<"ideas">) => {
      const ver = await read(id);
      await read(ver.ideaId);
      binding(!ideaId || ideaId === ver.ideaId);
      if (ver.sourceUnavailable) unavailable();
      horizon(ver.researchProofUntil);
      horizon(await ideaProofUntil(ctx, ver));
      return ver;
    };
    const series = async (
      id: Id<"planningSeriesVersions">,
      seriesId?: Id<"planningSeries">,
    ) => {
      const ver = await read(id),
        root = await read(ver.seriesId);
      binding(!seriesId || ver.seriesId === seriesId);
      await account(ver.accountId);
      horizon(ver.sourceUntil);
      horizon((await seriesVersionProof(ctx, root, ver, false)).until);
      return ver;
    };
    const plan = async (id: Id<"contentPlans">) => {
      const p = await read(id);
      await account(p.accountId);
      if (p.sourceUnavailable) unavailable();
      if (p.series) {
        const v = await read(p.series.versionId),
          s = await read(p.series.seriesId);
        binding(
          v.seriesId === s._id &&
            v.accountId === p.accountId &&
            s.accountId === p.accountId,
        );
        horizon(p.series.sourceUntil);
        horizon(p.semantic?.sourceUntil);
        horizon(await seriesPlanProof(ctx, p, false));
      }
      return p;
    };
    const policy = async (
      id: Id<"editorialReviewPolicies">,
      accountId: Id<"socialAccounts"> | null,
    ) => {
      const p = await read(id);
      binding(p.accountId === null || p.accountId === accountId);
      await account(p.accountId);
      return p;
    };
    const decision = async (id: Id<"editorialReviewDecisions">) => {
      const d = await read(id);
      if (d.sourceUnavailable || !d.reviewerId) unavailable();
      const ver = await draft(d.versionId, d.draftId, d.accountId);
      await policy(d.policyId, d.accountId);
      await reviewer(
        ctx,
        workspaceId,
        d.reviewerId,
        d.stage === "brand" ? ["Owner", "Admin"] : ["Owner", "Admin", "Editor"],
      );
      horizon(await historicalReviewSource(ctx, ver, d.sourceUntil));
      if (d.priorDecisionId) {
        const p = await read(d.priorDecisionId);
        binding(
          p.versionId === d.versionId &&
            p.draftId === d.draftId &&
            p.policyId === d.policyId &&
            p.accountId === d.accountId &&
            p.stage === "editorial",
        );
        if (p.sourceUnavailable || !p.reviewerId) unavailable();
        await reviewer(ctx, workspaceId, p.reviewerId, [
          "Owner",
          "Admin",
          "Editor",
        ]);
        horizon(p.sourceUntil);
      }
      return d;
    };
    const approval = async (id: Id<"approvals">) => {
      const row = await read(id);
      await draft(row.versionId, row.draftId, row.accountId);
      await reviewer(ctx, workspaceId, row.actorId, ["Owner", "Admin"]);
      if (row.reviewPin) {
        if (row.reviewPin.policyId)
          await policy(row.reviewPin.policyId, row.accountId);
        if (row.reviewPin.decisionIds.length > 2)
          throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
        horizon(row.reviewPin.sourceUntil);
        for (const id of row.reviewPin.decisionIds) {
          const d = await decision(id);
          binding(
            d.versionId === row.versionId &&
              d.policyId === row.reviewPin.policyId,
          );
        }
      }
      return row;
    };
    const page = await ctx.db
      .query(a.family)
      .withIndex("by_workspaceId", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .lte("_creationTime", creationUpperBound),
      )
      .order("asc")
      .paginate({ numItems: 1, cursor: a.cursor });
    if (page.page.length > 1) throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    let selection: Infer<typeof payload> = { family: a.family, rows: [] };
    for (const row of page.page) {
      try {
        if ("sourceUnavailable" in row && row.sourceUnavailable) unavailable();
        if ("researchProofUntil" in row) horizon(row.researchProofUntil);
        if ("sourceUntil" in row) horizon(row.sourceUntil);
        switch (a.family) {
          case "drafts": {
            const r = row as Doc<"drafts">;
            if (!r.currentVersionId) unavailable();
            const ver = await draft(r.currentVersionId, r._id);
            selection = {
              family: "drafts",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  revision: r.revision,
                  currentVersionId: r.currentVersionId,
                  authorId: r.authorId,
                  source: r.source,
                  assigneeId: r.assigneeId,
                  updatedAt: r.updatedAt,
                  content: ver.content,
                },
              ],
            };
            break;
          }
          case "ideas": {
            const r = row as Doc<"ideas">;
            if (!r.currentVersionId) unavailable();
            await idea(r.currentVersionId, r._id);
            selection = {
              family: "ideas",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  actorId: r.actorId,
                  revision: r.revision,
                  currentVersionId: r.currentVersionId,
                  status: r.status,
                  updatedAt: r.updatedAt,
                },
              ],
            };
            break;
          }
          case "ideaVersions": {
            const r = row as Doc<"ideaVersions">;
            await idea(r._id);
            const sources = references(
              await currentIdeaSource(ctx, workspaceId, r.source),
            );
            selection = {
              family: "ideaVersions",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  ideaId: r.ideaId,
                  number: r.number,
                  actorId: r.actorId,
                  createdAt: r.createdAt,
                  title: r.title,
                  perspective: r.perspective,
                  note: r.note,
                  priority: r.priority,
                  originals: r.originals,
                  rationale: r.rationale,
                  questions: r.questions,
                  inputVersionId: r.inputVersionId,
                  sources,
                  candidate: r.candidate?.content ?? null,
                },
              ],
            };
            break;
          }
          case "ideaFeedback": {
            const r = row as Doc<"ideaFeedback">;
            await idea(r.versionId, r.ideaId);
            if (r.resultingVersionId)
              await idea(r.resultingVersionId, r.ideaId);
            selection = {
              family: "ideaFeedback",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  ideaId: r.ideaId,
                  versionId: r.versionId,
                  actorId: r.actorId,
                  kind: r.kind,
                  text: r.text,
                  createdAt: r.createdAt,
                  resultingVersionId: r.resultingVersionId,
                },
              ],
            };
            break;
          }
          case "contentFeedback": {
            const r = row as Doc<"contentFeedback">;
            await draft(r.versionId, undefined, r.accountId);
            if (r.resultingVersionId)
              await draft(r.resultingVersionId, undefined, r.accountId);
            horizon((await feedbackProof(ctx, r)).sourceUntil);
            selection = {
              family: "contentFeedback",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  versionId: r.versionId,
                  resultingVersionId: r.resultingVersionId,
                  actorId: r.actorId,
                  kind: r.kind,
                  createdAt: r.createdAt,
                  editExtent: r.editExtent,
                  definition: r.definition,
                },
              ],
            };
            break;
          }
          case "contentPlans": {
            const r = row as Doc<"contentPlans">;
            await plan(r._id);
            selection = {
              family: "contentPlans",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  actorId: r.actorId,
                  createdAt: r.createdAt,
                  desiredCount: r.desiredCount,
                  start: r.start,
                  end: r.end,
                  timezone: r.timezone,
                  clock: r.clock,
                  mode: r.mode,
                  topics: r.topics,
                  preferences: r.preferences,
                  seriesId: r.series?.seriesId ?? null,
                  seriesVersionId: r.series?.versionId ?? null,
                },
              ],
            };
            break;
          }
          case "contentPlanItems": {
            const r = row as Doc<"contentPlanItems">;
            const p = await plan(r.planId);
            binding(p.accountId === r.accountId);
            const ver = await draft(r.versionId, r.draftId, r.accountId);
            await idea(r.ideaVersionId);
            const root = await read(r.draftId);
            const c = await candidate(
              ctx,
              { ...root, currentVersionId: r.versionId },
              r.accountId,
              undefined,
              false,
            );
            binding(
              c.ver._id === r.versionId &&
                c.ver.number === r.versionNumber &&
                c.idea._id === r.ideaVersionId &&
                c.sources.length === r.sources.length &&
                c.sources.every(
                  (s, i) =>
                    runSourceKey(s, false) ===
                    runSourceKey(r.sources[i], false),
                ) &&
                JSON.stringify(c.families) === JSON.stringify(r.families) &&
                JSON.stringify(c.rootEvidenceIds) ===
                  JSON.stringify(r.rootEvidenceIds),
            );
            horizon(r.proofUntil);
            horizon(r.validityUntil);
            horizon(c.proofUntil);
            horizon(c.validityUntil);
            if (!r.historyVersionIds || r.historyVersionIds.length > 10)
              unavailable();
            if (
              (r.historyVersionIds.length === 0 &&
                r.contextProofUntil !== null) ||
              (r.historyVersionIds.length > 0 && r.contextProofUntil == null)
            )
              unavailable();
            horizon(r.contextProofUntil);
            for (const id of r.historyVersionIds) {
              await draft(id, undefined, r.accountId);
              horizon(
                (await historyTopic(ctx, workspaceId, r.accountId, id))
                  .proofUntil,
              );
            }
            const sources = references(r.sources);
            if (r.acceptedApprovalId) {
              const x = await approval(r.acceptedApprovalId);
              binding(x.versionId === ver._id && x.accountId === r.accountId);
            }
            if (r.acceptedScheduleId) {
              const x = await read(r.acceptedScheduleId);
              binding(
                x.versionId === ver._id &&
                  x.accountId === r.accountId &&
                  x.approvalId === r.acceptedApprovalId,
              );
            }

            selection = {
              family: "contentPlanItems",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  planId: r.planId,
                  accountId: r.accountId,
                  draftId: r.draftId,
                  versionId: r.versionId,
                  versionNumber: r.versionNumber,
                  draftRevision: r.draftRevision,
                  ideaVersionId: r.ideaVersionId,
                  at: r.at,
                  timezone: r.timezone,
                  localTime: r.localTime,
                  reason: r.reason,
                  status: r.status,
                  acceptedApprovalId: r.acceptedApprovalId,
                  acceptedScheduleId: r.acceptedScheduleId,
                  acceptedActorId: r.acceptedActorId,
                  acceptedMode: r.acceptedMode,
                  sources,
                },
              ],
            };
            break;
          }
          case "planningSeries": {
            const r = row as Doc<"planningSeries">;
            await account(r.accountId);
            await seriesAuthority(ctx, r);
            if (r.versionId) await series(r.versionId, r._id);
            selection = {
              family: "planningSeries",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  actorId: r.actorId,
                  revision: r.revision,
                  generation: r.generation,
                  enabled: r.enabled,
                  versionId: r.versionId,
                  nextAt: r.nextAt,
                  nextIndex: r.nextIndex,
                  remaining: r.remaining,
                  createdAt: r.createdAt,
                  updatedAt: r.updatedAt,
                },
              ],
            };
            break;
          }
          case "planningSeriesVersions": {
            const r = row as Doc<"planningSeriesVersions">;
            await series(r._id);
            if (!r.config) unavailable();
            const c = r.config;
            selection = {
              family: "planningSeriesVersions",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  seriesId: r.seriesId,
                  revision: r.revision,
                  actorId: r.actorId,
                  sequence: r.sequence,
                  createdAt: r.createdAt,
                  config: {
                    styleVersionId: c.styleVersionId,
                    theme: c.theme,
                    candidateVersionIds: c.candidateVersionIds,
                    pillars: c.pillars,
                    desiredFormat: c.desiredFormat,
                    threshold: c.threshold,
                    timezone: c.timezone,
                    frequency: c.frequency,
                    weekday: c.weekday,
                    callbackClock: c.callbackClock,
                    publishingClocks: c.publishingClocks,
                    start: c.start,
                    end: c.end,
                    occurrences: c.occurrences,
                    itemsPerBatch: c.itemsPerBatch,
                  },
                },
              ],
            };
            break;
          }
          case "planningSeriesCommands": {
            const r = row as Doc<"planningSeriesCommands">;
            await account(r.accountId);
            const s = await read(r.seriesId);
            binding(s.accountId === r.accountId && s.actorId === r.actorId);
            await seriesAuthority(ctx, s);
            if (r.versionId) await series(r.versionId, r.seriesId);
            selection = {
              family: "planningSeriesCommands",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  seriesId: r.seriesId,
                  actorId: r.actorId,
                  expectedRevision: r.expectedRevision,
                  revision: r.revision,
                  versionId: r.versionId,
                  generation: r.generation,
                  createdAt: r.createdAt,
                },
              ],
            };
            break;
          }
          case "semanticPlanBindings": {
            const r = row as Doc<"semanticPlanBindings">;
            const p = await plan(r.planId);
            binding(p.accountId === r.accountId);
            if (!p.series || !p.semantic || !r.sourcePin) unavailable();
            selection = {
              family: "semanticPlanBindings",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  planId: r.planId,
                  vectorId: r.vectorId,
                  attemptId: r.attemptId,
                },
              ],
            };
            break;
          }
          case "editorialComments": {
            const r = row as Doc<"editorialComments">;
            await draft(r.versionId, r.draftId);
            selection = {
              family: "editorialComments",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  draftId: r.draftId,
                  versionId: r.versionId,
                  authorId: r.authorId,
                  versionNumber: r.versionNumber,
                  text: r.text,
                  resolved: r.resolved,
                  createdAt: r.createdAt,
                },
              ],
            };
            break;
          }
          case "approvals": {
            const r = row as Doc<"approvals">;
            await approval(r._id);
            selection = {
              family: "approvals",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  draftId: r.draftId,
                  versionId: r.versionId,
                  accountId: r.accountId,
                  actorId: r.actorId,
                  createdAt: r.createdAt,
                  revokedAt: r.revokedAt,
                  revokedBy: r.revokedBy,
                  purpose: r.purpose,
                  expiresAt: r.expiresAt,
                },
              ],
            };
            break;
          }
          case "schedules": {
            const r = row as Doc<"schedules">;
            await draft(r.versionId, r.draftId, r.accountId);
            const ap = await approval(r.approvalId);
            binding(
              ap.draftId === r.draftId &&
                ap.versionId === r.versionId &&
                ap.accountId === r.accountId,
            );
            await reviewer(ctx, workspaceId, r.actorId, ["Owner", "Admin"]);
            if (r.reviewPin) {
              horizon(r.reviewPin.sourceUntil);
              if (r.reviewPin.policyId)
                await policy(r.reviewPin.policyId, r.accountId);
              if (r.reviewPin.decisionIds.length > 2)
                throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
              for (const id of r.reviewPin.decisionIds) {
                const d = await decision(id);
                binding(
                  d.versionId === r.versionId &&
                    d.policyId === r.reviewPin.policyId,
                );
              }
            }
            selection = {
              family: "schedules",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  draftId: r.draftId,
                  versionId: r.versionId,
                  accountId: r.accountId,
                  approvalId: r.approvalId,
                  actorId: r.actorId,
                  generation: r.generation,
                  at: r.at,
                  timezone: r.timezone,
                  localTime: r.localTime,
                  state: r.state,
                  confirmedAt: r.confirmedAt,
                  abortRequestedAt: r.abortRequestedAt,
                  abortRequestedBy: r.abortRequestedBy,
                  purpose: r.purpose,
                },
              ],
            };
            break;
          }
          case "editorialEvents": {
            const r = row as Doc<"editorialEvents">;
            const d = await read(r.draftId);
            if (!d.currentVersionId) unavailable();
            await draft(d.currentVersionId, r.draftId);
            if (r.scheduleId) {
              const s = await read(r.scheduleId);
              binding(s.draftId === r.draftId);
              await draft(s.versionId, s.draftId, s.accountId);
            }
            selection = {
              family: "editorialEvents",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  draftId: r.draftId,
                  scheduleId: r.scheduleId,
                  actorId: r.actorId,
                  code: r.code,
                  createdAt: r.createdAt,
                },
              ],
            };
            break;
          }
          case "editorialReviewPolicies": {
            const r = row as Doc<"editorialReviewPolicies">;
            await account(r.accountId);
            await reviewer(ctx, workspaceId, r.actorId, ["Owner", "Admin"]);
            selection = {
              family: "editorialReviewPolicies",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  editorial: r.editorial,
                  brand: r.brand,
                  actorId: r.actorId,
                  revision: r.revision,
                  createdAt: r.createdAt,
                },
              ],
            };
            break;
          }
          case "editorialReviewControls": {
            const r = row as Doc<"editorialReviewControls">;
            await account(r.accountId);
            if (r.policyId) {
              const p = await policy(r.policyId, r.accountId);
              binding(p.accountId === r.accountId);
              await reviewer(ctx, workspaceId, p.actorId, ["Owner", "Admin"]);
            }
            selection = {
              family: "editorialReviewControls",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  policyId: r.policyId,
                  revision: r.revision,
                },
              ],
            };
            break;
          }
          case "editorialReviewDecisions": {
            const r = row as Doc<"editorialReviewDecisions">;
            await decision(r._id);
            selection = {
              family: "editorialReviewDecisions",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  draftId: r.draftId,
                  versionId: r.versionId,
                  accountId: r.accountId,
                  policyId: r.policyId,
                  stage: r.stage,
                  reviewerId: r.reviewerId,
                  priorDecisionId: r.priorDecisionId,
                  createdAt: r.createdAt,
                  withdrawnAt: r.withdrawnAt,
                  withdrawnBy: r.withdrawnBy,
                  active: r.active,
                },
              ],
            };
            break;
          }
          case "editorialReviewCommands": {
            const r = row as Doc<"editorialReviewCommands">;
            await account(r.accountId);
            if (r.versionId) await draft(r.versionId, r.draftId, r.accountId);
            if (r.result?.policyId)
              await policy(r.result.policyId, r.accountId);
            if (r.result?.decisionId) await decision(r.result.decisionId);
            horizon(await commandSource(ctx, r));
            selection = {
              family: "editorialReviewCommands",
              rows: [
                {
                  id: r._id,
                  createdInDatabaseAt: r._creationTime,
                  accountId: r.accountId,
                  actorId: r.actorId,
                  kind: r.kind,
                  draftId: r.draftId,
                  assigneeId: r.assigneeId,
                  requestStage: r.requestStage,
                  assignmentResult: r.assignmentResult,
                  versionId: r.versionId,
                  result: r.result,
                },
              ],
            };
            break;
          }
        }
      } catch (error) {
        knownLoss(error);
      }
    }
    const result = {
      authId: original.user.authId,
      sessionId,
      requestKey: a.requestKey,
      workspaceId,
      role: original.membership.role,
      observedAt,
      proofValidUntil,
      creationUpperBound,
      cursor: page.continueCursor,
      isDone: page.isDone,
      data: {
        format: "dispatch-workspace-shared" as const,
        version: 1 as const,
        workspaceId,
        selection,
      },
    };
    numeric(result);
    if (
      proofValidUntil <= Date.now() ||
      new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
    )
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
