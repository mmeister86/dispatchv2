import { policy, grants, fingerprint } from "./providerAccess";
import { planSchedule } from "./schedules";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { components, internal } from "../_generated/api";
import {
  workspaceMutation,
  workspaceQuery,
  requireRole,
  requireReference,
  requireWorkspace,
} from "../lib/authorization";
import {
  currentProfile,
  prerequisites,
  sameApproval,
  liveAuthority,
} from "./access";
import { operation } from "./providerFields";
import { disposition, sourceCoverage } from "./pipelineFields";
import { admitNative } from "./native";
import { deriveQuestion } from "../ai/researchTools";
import { workflow } from "../ai/researchAgent";
import {
  currentMaterials,
  currentMaterialProof,
  orderLiability,
} from "./pipelineAccess";
import { deliveredSource, materialHash } from "./evidence";
import { evidenceFields } from "./evidenceFields";
import type { WorkflowId } from "@convex-dev/workflow";
export async function admitPipeline(
  ctx: MutationCtx,
  a: {
    profileId: Doc<"researchProfiles">["_id"];
    expectedRevision: number;
    operationKey: string;
    language: string;
    operations: Doc<"researchSourcePolicies">["operation"][];
  },
  workspaceId: Doc<"workspaces">["_id"],
  actorId: Doc<"users">["_id"],
  occasion: Doc<"researchOrders">["occasion"] = "manual",
  occurrence: Doc<"researchOrders">["occurrence"] = null,
) {
  const { profile, version } = await currentProfile(
    ctx,
    workspaceId,
    a.profileId,
  );
  const id = await admitNative(
      ctx,
      { ...a, query: deriveQuestion(version.config) },
      workspaceId,
      actorId,
      true,
    ),
    o = (await ctx.db.get(id))!;
  if (o.pipeline) return id;
  // A former source-only or TASK20 command cannot acquire workflow authority by deployment/replay.
  if (
    o.state !== "queued" ||
    o.finishedAt !== null ||
    o.native?.cacheIds.some(Boolean)
  )
    throw new ConvexError("RESEARCH_NEW_WORKFLOW_ACTIVATION_REQUIRED");
  const pipeline: NonNullable<Doc<"researchOrders">["pipeline"]> = {
    kind: "research-workflow-v1",
    materialGeneration: profile.researchMaterialGeneration ?? 0,
    workflowId: null,
    step: 0,
    outcome: "pending",
    sourcePins: [],
    history: [],
    historyTruncated: false,
    clusterPins: [],
    clustersTruncated: false,
    duplicateGroups: [],
    runId: null,
    executionKey: null,
    proposalHash: null,
    pending: null,
    clusterIds: [],
    evidenceIds: [],
    inboxReady: false,
    retentionUntil: null,
    cleanupState: "retained",
    workflowCleaned: false,
    agentCleaned: false,
    usagePending: false,
    nextAt: null,
    handoff: "disabled",
  };
  let approval = null;
  try {
    approval = await prerequisites(ctx, profile, version.config);
  } catch {
    /* Source-only partial results do not fabricate model configuration. */
  }
  await ctx.db.patch(id, { pipeline, approval, occasion, occurrence });
  const workflowId = await workflow.start(
    ctx,
    internal.ai.researchAgent.research,
    { orderId: id, generation: o.generation },
    {
      onComplete: internal.ai.researchAgent.completed,
      context: { orderId: id, generation: o.generation },
      startAsync: true,
    },
  );
  await ctx.db.patch(id, { pipeline: { ...pipeline, workflowId } });
  return id;
}
export const start = workspaceMutation({
  args: {
    profileId: v.id("researchProfiles"),
    expectedRevision: v.number(),
    operationKey: v.string(),
    language: v.string(),
    operations: v.array(operation),
  },
  returns: v.id("researchOrders"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    return admitPipeline(ctx, a, ctx.workspace._id, ctx.user._id);
  },
});
export const resume = workspaceMutation({
  args: { orderId: v.id("researchOrders") },
  returns: v.union(v.literal("running"), v.literal("restarted")),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const o = await ctx.db.get(a.orderId);
    requireReference(ctx.workspace._id, o);
    if (
      !o!.pipeline?.workflowId ||
      o!.pipeline.cleanupState !== "retained" ||
      !["queued", "running"].includes(o!.state) ||
      o!.deadline <= Date.now()
    )
      throw new ConvexError("RESEARCH_RESUME_UNAVAILABLE");
    await currentMaterials(ctx, o!);
    const status = await workflow.status(
      ctx,
      o!.pipeline.workflowId as WorkflowId,
    );
    if (status.type === "inProgress") return "running";
    // Replay preserves completed journal entries; first-send/unknown receipts still prohibit paid replay.
    await workflow.restart(ctx, o!.pipeline.workflowId as WorkflowId);
    return "restarted";
  },
});
export const results = workspaceQuery({
  args: { orderId: v.id("researchOrders") },
  returns: v.union(
    v.object({
      step: v.number(),
      outcome: disposition,
      results: v.array(
        v.object({
          evidenceId: v.id("researchEvidence"),
          payload: evidenceFields.payload,
          retentionUntil: v.number(),
          state: v.literal("review"),
          publishedAt: v.union(v.number(), v.null()),
          observedAt: v.number(),
          provenance: v.union(
            v.object({
              runId: v.id("agentRuns"),
              promptVersion: v.string(),
              policyVersion: v.string(),
            }),
            v.null(),
          ),
        }),
      ),
      removed: v.boolean(),
      estimatedMicros: v.union(v.number(), v.null()),
      usagePending: v.boolean(),
      currency: v.union(v.string(), v.null()),
      nextAt: v.union(v.number(), v.null()),
      handoff: v.literal("disabled"),
      sourceCoverage: v.union(v.array(sourceCoverage), v.null()),
      historyIncomplete: v.boolean(),
      cleanupState: v.union(
        v.literal("retained"),
        v.literal("pending"),
        v.literal("complete"),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    requireReference(ctx.workspace._id, o);
    if (!o!.pipeline) return null;
    const money = await orderLiability(ctx, o!);
    let readable = true,
      displayUntil = 0;
    try {
      displayUntil = (await currentMaterialProof(ctx, o!)).proofUntil;
    } catch {
      readable = false;
    }
    const results = [];
    if (readable && o!.pipeline.inboxReady)
      for (const id of o!.pipeline.evidenceIds) {
        const e = await ctx.db.get(id);
        if (
          !e?.payload ||
          e.state !== "review" ||
          e.retentionUntil <= Date.now()
        )
          continue;
        try {
          const d = await deliveredSource(ctx, o!._id, e.sourceId);
          if ((await materialHash(d.s)) !== e.materialHash) continue;
          results.push({
            evidenceId: e._id,
            payload: e.payload,
            retentionUntil: Math.min(e.retentionUntil, displayUntil, d.until),
            state: "review" as const,
            publishedAt: d.s.publishedAt,
            observedAt: d.s.observedAt,
            provenance: e.modelOrigin
              ? {
                  runId: e.modelOrigin.runId,
                  promptVersion: e.modelOrigin.promptVersion,
                  policyVersion: e.modelOrigin.policyVersion,
                }
              : null,
          });
        } catch {
          /* Fail closed for current provenance. */
        }
      }
    return {
      step: o!.pipeline.step,
      outcome: o!.pipeline.outcome,
      results,
      removed: !readable,
      estimatedMicros: money.estimated,
      usagePending: money.usagePending,
      currency: o!.config.cap?.currency ?? null,
      nextAt: o!.pipeline.nextAt,
      handoff: "disabled" as const,
      sourceCoverage: o!.pipeline.sourceCoverage ?? null,
      historyIncomplete:
        o!.pipeline.historyTruncated ||
        o!.pipeline.clustersTruncated ||
        o!.pipeline.sourceCoverage === undefined ||
        (o!.pipeline.sourceCoverage ?? []).some((c) => c.omitted > 0),
      cleanupState: o!.pipeline.cleanupState,
    };
  },
});
export const clearSource = internalMutation({
  args: {
    sourceId: v.id("researchSources"),
    oldMaterialHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("researchSourceBindings")
      .withIndex("by_sourceId_and_state_and_materialHash", (q) => {
        const base = q.eq("sourceId", a.sourceId).eq("state", "retained");
        return a.oldMaterialHash
          ? base.eq("materialHash", a.oldMaterialHash)
          : base;
      })
      .take(10);
    for (const row of rows) {
      await ctx.db.patch(row._id, { state: "removed" });
      const o = await ctx.db.get(row.orderId);
      if (o?.pipeline && o.pipeline.cleanupState === "retained")
        await ctx.db.patch(o._id, {
          generation: o.generation + 1,
          state: ["queued", "running"].includes(o.state)
            ? "cancelled"
            : o.state,
          pipeline: {
            ...o.pipeline,
            cleanupState: "pending",
            pending: null,
            inboxReady: false,
          },
        });
      await ctx.scheduler.runAfter(0, internal.research.pipeline.purge, {
        orderId: row.orderId,
      });
    }
    if (rows.length === 10)
      await ctx.scheduler.runAfter(
        0,
        internal.research.pipeline.clearSource,
        a,
      );
    return null;
  },
});
export const purge = internalMutation({
  args: { orderId: v.id("researchOrders") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    if (!o?.pipeline || o.pipeline.cleanupState === "complete") return null;
    if (
      o.pipeline.cleanupState === "retained" &&
      o.pipeline.retentionUntil !== null &&
      o.pipeline.retentionUntil > Date.now()
    )
      return null;
    const p = o.pipeline;
    await ctx.db.patch(o._id, {
      generation:
        p.cleanupState === "retained" ? o.generation + 1 : o.generation,
      state: ["queued", "running"].includes(o.state) ? "cancelled" : o.state,
      pipeline: {
        ...p,
        cleanupState: "pending",
        pending: null,
        inboxReady: false,
      },
    });
    const profile = await ctx.db.get(o.profileId);
    if (profile?.activeOrderId === o._id)
      await ctx.db.patch(profile._id, { activeOrderId: null });
    const r = p.runId ? await ctx.db.get(p.runId) : null;
    if (r && ["ready", "running"].includes(r.state))
      await ctx.db.patch(r._id, {
        state: "stopped",
        generation: r.generation + 1,
      });
    if (p.workflowId && !p.workflowCleaned)
      await workflow.cancel(ctx, p.workflowId as WorkflowId);
    const copies = p.runId
      ? await ctx.db
          .query("researchEvidence")
          .withIndex("by_modelOrigin_runId_and_state", (q) =>
            q.eq("modelOrigin.runId", p.runId!).eq("state", "review"),
          )
          .take(20)
      : [];
    for (const e of copies)
      await ctx.db.patch(e._id, {
        payload: null,
        state: "removed",
        reason: "pipeline_source_or_retention_removed",
        ...(e.assessment
          ? {
              assessment: {
                ...e.assessment,
                reason: "",
                eventQuote: null,
                eventAt: null,
              },
            }
          : {}),
      });
    const copiesRemain = p.runId
      ? !!(await ctx.db
          .query("researchEvidence")
          .withIndex("by_modelOrigin_runId_and_state", (q) =>
            q.eq("modelOrigin.runId", p.runId!).eq("state", "review"),
          )
          .first())
      : false;
    for (const id of [...new Set(p.clusterIds)]) {
      const c = await ctx.db.get(id);
      if (c)
        await ctx.db.patch(id, {
          evidenceIds: c.evidenceIds.filter(
            (id) => !p.evidenceIds.includes(id),
          ),
          revision: c.revision + 1,
          updatedAt: Date.now(),
        });
    }
    const bindings = await ctx.db
      .query("researchSourceBindings")
      .withIndex("by_orderId", (q) => q.eq("orderId", o._id))
      .take(11);
    if (bindings.length > 10) throw new ConvexError("RESEARCH_BINDING_LIMIT");
    for (const b of bindings)
      if (b.state !== "removed")
        await ctx.db.patch(b._id, { state: "removed" });
    let agentCleaned = p.agentCleaned || !r,
      workflowCleaned = p.workflowCleaned || !p.workflowId;
    // Native isDone proves component traversal finished; a canceled/stopped wrapper is insufficient.
    if (r && !agentCleaned && (!r.executionKey || r.executionFinishedAt))
      agentCleaned = (
        await ctx.runMutation(
          components.agent.threads.deleteAllForThreadIdAsync,
          { threadId: r.threadId, limit: 100 },
        )
      ).isDone;
    if (p.workflowId && !workflowCleaned) {
      workflowCleaned = await workflow.cleanup(ctx, p.workflowId as WorkflowId);
      if (workflowCleaned) {
        const remaining = await workflow.listSteps(
          ctx,
          p.workflowId as WorkflowId,
          { paginationOpts: { cursor: null, numItems: 1 } },
        );
        // ponytail: this workflow has fewer than 20 entries, below native cleanup's 256 batch; inventory continuations if that ceiling grows.
        if (remaining.page.length || !remaining.isDone)
          throw new ConvexError("RESEARCH_WORKFLOW_JOURNAL_NOT_EMPTY");
      }
    }
    await ctx.db.patch(o._id, {
      pipeline: {
        ...p,
        pending: null,
        inboxReady: false,
        cleanupState:
          agentCleaned && workflowCleaned && !copiesRemain
            ? "complete"
            : "pending",
        agentCleaned,
        workflowCleaned,
      },
    });
    if (!agentCleaned || !workflowCleaned || copiesRemain)
      await ctx.scheduler.runAfter(10000, internal.research.pipeline.purge, a);
    return null;
  },
});
export const cancel = internalMutation({
  args: { orderId: v.id("researchOrders") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    if (o?.pipeline?.workflowId && o.state === "cancelled")
      await workflow.cancel(ctx, o.pipeline.workflowId as WorkflowId);
    return null;
  },
});

export async function captureWorkflowApproval(
  ctx: MutationCtx,
  p: Doc<"researchProfiles">,
  config: Doc<"researchProfileVersions">["config"],
  language: string,
  operations: Doc<"researchSourcePolicies">["operation"][],
) {
  if (
    !config.languages.includes(language) ||
    !config.cap ||
    operations.length < 1 ||
    operations.length > 3 ||
    new Set(operations).size !== operations.length
  )
    throw new ConvexError("RESEARCH_NATIVE_INPUT_INVALID");
  const approvals = [];
  for (const op of operations) {
    const pol = await policy(ctx, p.workspaceId, p.accountId, op);
    if (pol.currency !== config.cap.currency)
      throw new ConvexError("RESEARCH_CURRENCY_INCOMPATIBLE");
    approvals.push({
      policyId: pol._id,
      fingerprint: await fingerprint(pol),
      budgetIds: await grants(ctx, pol),
    });
  }
  return {
    kind: "research-workflow-v1" as const,
    language,
    operations,
    approvals,
  };
}
export const fire = internalMutation({
  args: {
    profileId: v.id("researchProfiles"),
    generation: v.number(),
    at: v.number(),
  },
  returns: v.union(v.id("researchOrders"), v.null()),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.profileId);
    if (!p?.workflowActivation) return null;
    const key = `workflow-schedule-${a.generation}-${a.at}`;
    const old = await ctx.db
      .query("researchOrders")
      .withIndex("by_profileId_and_occasion_and_operationKey", (q) =>
        q
          .eq("profileId", p._id)
          .eq("occasion", "scheduled")
          .eq("operationKey", key),
      )
      .unique();
    if (old) return old._id;
    if (
      !p.scheduleActive ||
      p.scheduleGeneration !== a.generation ||
      p.nextAt !== a.at ||
      a.at > Date.now() ||
      !p.scheduleActorId ||
      p.scheduleAccountSequence === null
    )
      return null;
    const { version } = await currentProfile(ctx, p.workspaceId, p._id);
    try {
      const actor = await ctx.db.get(p.scheduleActorId);
      if (!actor) throw new ConvexError("RESEARCH_ACTOR_UNAVAILABLE");
      requireRole(
        (await requireWorkspace(ctx, p.workspaceId, actor)).membership,
        ["Owner", "Admin"],
      );
      await liveAuthority(ctx, p, p.scheduleActorId, p.scheduleAccountSequence);
      if (
        !sameApproval(
          p.scheduleApproval,
          await prerequisites(ctx, p, version.config),
        ) ||
        !sameWorkflowActivation(
          p.workflowActivation,
          await captureWorkflowApproval(
            ctx,
            p,
            version.config,
            p.workflowActivation.language,
            p.workflowActivation.operations,
          ),
        )
      )
        throw new ConvexError("RESEARCH_CONFIGURATION_CHANGED");
    } catch {
      await ctx.db.patch(p._id, {
        scheduleActive: false,
        workflowActivation: null,
        nextAt: null,
        scheduledJobId: null,
        scheduleReason: "RESEARCH_WORKFLOW_CONFIGURATION_CHANGED",
      });
      return null;
    }
    let id = null;
    if (!p.activeOrderId)
      id = await admitPipeline(
        ctx,
        {
          profileId: p._id,
          expectedRevision: p.revision,
          operationKey: key,
          language: p.workflowActivation.language,
          operations: p.workflowActivation.operations,
        },
        p.workspaceId,
        p.scheduleActorId,
        "scheduled",
        { generation: a.generation, at: a.at },
      );
    await planSchedule(ctx, p, version.config);
    return id;
  },
});
export const purgeProfile = internalMutation({
  args: {
    profileId: v.id("researchProfiles"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.profileId);
    if (!p) return null;
    const rows = await ctx.db
      .query("researchOrders")
      .withIndex("by_profileId_and_createdAt", (q) => q.eq("profileId", p._id))
      .paginate({ cursor: a.cursor, numItems: 20 });
    for (const o of rows.page)
      if (
        o.pipeline &&
        o.pipeline.materialGeneration !== (p.researchMaterialGeneration ?? 0) &&
        o.pipeline.cleanupState === "retained"
      ) {
        await ctx.db.patch(o._id, {
          pipeline: {
            ...o.pipeline,
            cleanupState: "pending",
            pending: null,
            inboxReady: false,
          },
        });
        await ctx.scheduler.runAfter(0, internal.research.pipeline.purge, {
          orderId: o._id,
        });
      }
    if (!rows.isDone)
      await ctx.scheduler.runAfter(0, internal.research.pipeline.purgeProfile, {
        ...a,
        cursor: rows.continueCursor,
      });
    return null;
  },
});

function sameWorkflowActivation(
  a: NonNullable<Doc<"researchProfiles">["workflowActivation"]>,
  b: NonNullable<Doc<"researchProfiles">["workflowActivation"]>,
) {
  return (
    a.kind === b.kind &&
    a.language === b.language &&
    a.operations.length === b.operations.length &&
    a.operations.every((op, i) => op === b.operations[i]) &&
    a.approvals.length === b.approvals.length &&
    a.approvals.every(
      (x, i) =>
        x.policyId === b.approvals[i].policyId &&
        x.fingerprint === b.approvals[i].fingerprint &&
        x.budgetIds.length === b.approvals[i].budgetIds.length &&
        x.budgetIds.every((id, j) => id === b.approvals[i].budgetIds[j]),
    )
  );
}
