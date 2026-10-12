import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { workflow } from "../ai/researchAgent";
import type { WorkflowId } from "@convex-dev/workflow";
import { drainThreadFiles } from "./deletionExecutor";
import { workspaceQuery } from "../lib/authorization";
import {
  operationalUntil,
  OPERATIONAL_RETENTION_MS,
} from "../lib/operationalRetention";

export const policy = workspaceQuery({
  args: {},
  returns: v.object({
    maximumDays: v.literal(30),
    sourceExpiryWins: v.literal(true),
    debugRawResponsesEnabled: v.literal(false),
    protectedBarrierKinds: v.array(v.string()),
  }),
  handler: async () => ({
    maximumDays: 30 as const,
    sourceExpiryWins: true as const,
    debugRawResponsesEnabled: false as const,
    protectedBarrierKinds: ["publishing", "billing", "upload", "replay"],
  }),
});

export const sweepReference = makeFunctionReference<
  "mutation",
  {
    phase: "sources" | "caches" | "runs" | "orders" | "conversations";
    cursor: string | null;
  },
  null
>("operations/retention:sweep");

const phases = [
  "sources",
  "caches",
  "runs",
  "orders",
  "conversations",
] as const;
export const sweep = internalMutation({
  args: {
    phase: v.union(...phases.map(v.literal)),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const pagination = { cursor: a.cursor, numItems: 25 };
    let page: { isDone: boolean; continueCursor: string };
    if (a.phase === "sources") {
      const rows = await ctx.db
        .query("researchSources")
        .withIndex("by_creation_time")
        .paginate(pagination);
      page = rows;
      for (const s of rows.page)
        if (
          s.status === "usable" &&
          operationalUntil(s.observedAt, s.usableUntil) <= Date.now()
        )
          await ctx.scheduler.runAfter(0, internal.research.cache.expire, {
            sourceId: s._id,
            generation: s.generation,
            usableUntil: s.usableUntil,
          });
    } else if (a.phase === "caches") {
      const rows = await ctx.db
        .query("researchCaches")
        .withIndex("by_creation_time")
        .paginate(pagination);
      page = rows;
      for (const c of rows.page) {
        if (
          operationalUntil(c.createdAt, c.expiresAt) <= Date.now() &&
          c.state !== "removed"
        ) {
          // Keep the exact attempt/cache identity: unknown paid fills must never become retry authority.
          await ctx.db.patch(c._id, {
            state: "removed",
            sourceIds: [],
            reason: "retention_expired",
            leaseUntil: 0,
          });
        }
      }
    } else if (a.phase === "runs") {
      const rows = await ctx.db
        .query("agentRuns")
        .withIndex("by_creation_time")
        .paginate(pagination);
      page = rows;
      for (const r of rows.page) {
        if (r.sourceCleanupState !== "complete")
          await ctx.scheduler.runAfter(0, internal.ai.runs.purgeSource, {
            runId: r._id,
          });
        else
          await ctx.scheduler.runAfter(0, nativeCleanupReference, {
            kind: "run",
            id: r._id,
            phase: -1,
          });
      }
    } else if (a.phase === "orders") {
      const rows = await ctx.db
        .query("researchOrders")
        .withIndex("by_creation_time")
        .paginate(pagination);
      page = rows;
      for (const o of rows.page) {
        if (operationalUntil(o.createdAt) <= Date.now())
          await ctx.db.patch(o._id, {
            config: {
              ...o.config,
              topics: "",
              project: "",
              audience: "",
              languages: [],
              regions: [],
              preferredSources: [],
              exclusions: "",
              autoHandoff: false,
            },
            ...(o.native ? { native: { ...o.native, query: "" } } : {}),
            ...(o.reResearch
              ? { reResearch: { ...o.reResearch, topic: "" } }
              : {}),
            ...(o.automaticHandoff
              ? {
                  automaticHandoff: {
                    ...o.automaticHandoff,
                    option: { ...o.automaticHandoff.option, intent: "" },
                    state: "withdrawn" as const,
                  },
                }
              : {}),
          });
        if (o.pipeline && o.pipeline.cleanupState !== "complete")
          await ctx.scheduler.runAfter(0, internal.research.pipeline.purge, {
            orderId: o._id,
          });
        else if (
          o.pipeline?.cleanupState === "complete" &&
          o.pipeline.workflowId
        )
          await ctx.scheduler.runAfter(0, workflowCleanupReference, {
            orderId: o._id,
          });
      }
    } else {
      const rows = await ctx.db
        .query("conversations")
        .withIndex("by_creation_time")
        .paginate(pagination);
      page = rows;
      for (const c of rows.page) {
        if (c.state === "active")
          await ctx.scheduler.runAfter(
            0,
            internal.ai.conversations.expireSource,
            { conversationId: c._id },
          );
        else if (c.state === "deleting")
          await ctx.scheduler.runAfter(0, internal.ai.conversations.cleanup, {
            conversationId: c._id,
          });
        else if (c.state === "deleted")
          await ctx.scheduler.runAfter(0, nativeCleanupReference, {
            kind: "conversation",
            id: c._id,
            phase: -1,
          });
      }
    }
    const nextPhase = phases[phases.indexOf(a.phase) + 1];
    if (!page.isDone || nextPhase)
      await ctx.scheduler.runAfter(0, sweepReference, {
        phase: page.isDone ? nextPhase! : a.phase,
        cursor: page.isDone ? null : page.continueCursor,
      });
    return null;
  },
});

export const nativeCleanupReference = makeFunctionReference<
  "mutation",
  {
    kind: "run" | "conversation";
    id: string;
    phase: number;
    userPhase?: number;
  },
  null
>("operations/retention:nativeCleanup");
// Parent replay headers retain exact thread ownership after native roots disappear.
export const nativeCleanup = internalMutation({
  args: {
    kind: v.union(v.literal("run"), v.literal("conversation")),
    id: v.string(),
    phase: v.number(),
    userPhase: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const id =
      a.kind === "run"
        ? ctx.db.normalizeId("agentRuns", a.id)
        : ctx.db.normalizeId("conversations", a.id);
    if (!id) return null;
    const row = await ctx.db.get(id);
    if (!row || !("threadId" in row) || !("actorId" in row)) return null;
    if (
      "sourceCleanupState" in row
        ? row.sourceCleanupState !== "complete"
        : !("state" in row) || row.state !== "deleted"
    )
      return null;
    const scope = {
      threadId: row.threadId,
      expectedUserId: String(row.actorId),
    };
    if (a.phase === -1) {
      await ctx.runQuery(components.agent.erasure.listForThread, {
        ...scope,
        paginationOpts: { numItems: 1, cursor: null },
      });
      const r = await ctx.runMutation(
        components.agent.threads.deleteAllForThreadIdAsync,
        { threadId: scope.threadId, limit: 25 },
      );
      await ctx.scheduler.runAfter(0, nativeCleanupReference, {
        ...a,
        phase: r.isDone ? 0 : -1,
      });
      return null;
    }
    if (a.phase <= 10) {
      const r = await ctx.runMutation(
        components.agent.erasure.deleteThreadResiduals,
        { ...scope, phase: a.phase },
      );
      await ctx.scheduler.runAfter(0, nativeCleanupReference, {
        ...a,
        phase: r.isDone ? 11 : r.nextPhase,
      });
      return null;
    }
    if (a.phase === 11) {
      const r = await drainThreadFiles(ctx, scope);
      if (r === "component-proof")
        throw new Error("RETENTION_STORAGE_PROOF_FAILED");
      await ctx.scheduler.runAfter(0, nativeCleanupReference, {
        ...a,
        phase: r === "continue" ? 11 : 12,
        userPhase: 0,
      });
      return null;
    }
    if (a.phase !== 12) throw new Error("RETENTION_PHASE_INVALID");
    const r = await ctx.runMutation(
      components.agent.erasure.deleteUserMemories,
      {
        userId: scope.expectedUserId,
        phase: a.userPhase ?? 0,
        olderThan: Date.now() - OPERATIONAL_RETENTION_MS,
      },
    );
    if (!r.isDone)
      await ctx.scheduler.runAfter(0, nativeCleanupReference, {
        ...a,
        userPhase: r.nextPhase,
      });
    return null;
  },
});

export const workflowCleanupReference = makeFunctionReference<
  "mutation",
  { orderId: import("../_generated/dataModel").Id<"researchOrders"> },
  null
>("operations/retention:workflowCleanup");
export const workflowCleanup = internalMutation({
  args: { orderId: v.id("researchOrders") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    if (o?.pipeline?.cleanupState !== "complete" || !o.pipeline.workflowId)
      return null;
    const workflowId = o.pipeline.workflowId as WorkflowId;
    const status = await ctx.runQuery(components.workflow.erasure.scopeStatus, {
      workflowId,
    });
    if (status === "active") {
      await workflow.cancel(ctx, workflowId);
      await ctx.scheduler.runAfter(10000, workflowCleanupReference, a);
      return null;
    }
    const r = await ctx.runMutation(
      components.workflow.erasure.deleteResiduals,
      { workflowId },
    );
    if (
      !r.isDone ||
      (status !== "missing" && !(await workflow.cleanup(ctx, workflowId)))
    )
      await ctx.scheduler.runAfter(0, workflowCleanupReference, a);
    return null;
  },
});
