import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ideaProofUntil } from "../research/contentProof";
import { materialWalk } from "../research/pipelineAccess";

export async function runInputs(ctx: QueryCtx, r: Doc<"agentRuns">) {
  const rows = await ctx.db
    .query("ideaRunCopies")
    .withIndex("by_runId", (q) => q.eq("runId", r._id))
    .take(11);
  if (
    rows.length > 10 ||
    rows.some(
      (x) =>
        x.workspaceId !== r.workspaceId ||
        x.accountId !== r.accountId ||
        (x.conversationId && x.conversationId !== r.conversationId),
    )
  )
    throw new ConvexError("IDEA_SOURCE_CHANGED");
  return rows;
}
export async function captureRunInputs(
  ctx: MutationCtx,
  runId: Id<"agentRuns">,
  ids: Id<"ideaVersions">[],
  walk = materialWalk(),
) {
  const r = (await ctx.db.get(runId))!;
  const versions = [...new Set(ids)];
  if (versions.length > 10) throw new ConvexError("MODEL_INPUT_INVALID");
  const until: number[] = [];
  for (const id of versions) {
    const v = await ctx.db.get(id);
    if (!v || v.workspaceId !== r.workspaceId)
      throw new ConvexError("IDEA_SOURCE_CHANGED");
    const horizon = await ideaProofUntil(ctx, v, walk, r.accountId);
    if (horizon !== null) until.push(horizon);
    await ctx.db.insert("ideaRunCopies", {
      workspaceId: r.workspaceId,
      accountId: r.accountId,
      ideaVersionId: id,
      runId,
      ...(r.conversationId ? { conversationId: r.conversationId } : {}),
      state: "retained",
    });
  }
  return until.length ? Math.min(...until) : null;
}
export async function captureHistory(
  ctx: MutationCtx,
  o: Doc<"researchOrders">,
  ids: Id<"draftVersions">[],
) {
  const versions = [...new Set(ids)];
  if (versions.length > 10) throw new ConvexError("RESEARCH_HISTORY_CHANGED");
  for (const draftVersionId of versions)
    await ctx.db.insert("draftResearchCopies", {
      workspaceId: o.workspaceId,
      accountId: o.accountId,
      draftVersionId,
      orderId: o._id,
      state: "retained",
    });
}

// Follow concrete copied-input edges even when the original style remains valid.
// Pagination bounds each callback; path IDs stop corrupt cycles without a registry.
export const sweep = internalMutation({
  args: {
    runId: v.optional(v.id("agentRuns")),
    ideaVersionId: v.optional(v.id("ideaVersions")),
    draftVersionId: v.optional(v.id("draftVersions")),
    phase: v.optional(
      v.union(v.literal("runs"), v.literal("edits"), v.literal("drafts")),
    ),
    cursor: v.union(v.string(), v.null()),
    path: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.ideaVersionId && !a.phase && a.cursor === null)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.candidateCopies,
        { versionId: a.ideaVersionId, cursor: null, phase: "references" },
      );
    if (a.ideaVersionId && !a.phase && a.cursor === null)
      await ctx.scheduler.runAfter(0, internal.ai.jev.routing.purge, {
        inputVersionId: a.ideaVersionId,
        cursor: null,
        force: false,
      });
    const id = a.runId ?? a.ideaVersionId ?? a.draftVersionId;
    if (!id || a.path.includes(id) || a.path.length >= 32) return null;
    const path = [...a.path, id];
    const next = async (args: {
      runId?: Id<"agentRuns">;
      ideaVersionId?: Id<"ideaVersions">;
      draftVersionId?: Id<"draftVersions">;
    }) =>
      ctx.scheduler.runAfter(0, internal.ai.contentCopies.sweep, {
        ...args,
        cursor: null,
        path,
      });
    const continuePage = async (
      page: { isDone: boolean; continueCursor: string },
      phase = a.phase,
    ) => {
      if (!page.isDone)
        await ctx.scheduler.runAfter(0, internal.ai.contentCopies.sweep, {
          ...a,
          phase,
          cursor: page.continueCursor,
        });
    };
    if (a.runId) {
      if (a.cursor === null)
        await ctx.scheduler.runAfter(
          0,
          internal.research.contentCleanup.candidateRun,
          { runId: a.runId, cursor: null },
        );
      const r = await ctx.db.get(a.runId);
      if (!r || r.sourceCleanupState) return null;
      const { retainedRunProof } = await import("./sourceAccess");
      const { rethrowUnexpectedSourceError } =
        await import("../lib/sourceProof");
      try {
        await retainedRunProof(ctx, r);
      } catch (error) {
        rethrowUnexpectedSourceError(error);
        await ctx.scheduler.runAfter(0, internal.ai.runs.purgeSource, {
          runId: r._id,
        });
        return null;
      }
      const page = await ctx.db
        .query("ideaVersions")
        .withIndex("by_runId", (q) => q.eq("runId", r._id))
        .paginate({ numItems: 25, cursor: a.cursor });
      for (const row of page.page) await next({ ideaVersionId: row._id });
      await continuePage(page);
    } else if (a.ideaVersionId) {
      const phase = a.phase ?? "runs";
      if (phase === "runs") {
        const page = await ctx.db
          .query("ideaRunCopies")
          .withIndex("by_ideaVersionId_and_state", (q) =>
            q.eq("ideaVersionId", a.ideaVersionId!).eq("state", "retained"),
          )
          .paginate({ numItems: 25, cursor: a.cursor });
        for (const row of page.page) await next({ runId: row.runId });
        await continuePage(page, phase);
        if (page.isDone)
          await ctx.scheduler.runAfter(0, internal.ai.contentCopies.sweep, {
            ...a,
            phase: "edits",
            cursor: null,
          });
      } else if (phase === "edits") {
        const page = await ctx.db
          .query("ideaVersions")
          .withIndex("by_inputVersionId", (q) =>
            q.eq("inputVersionId", a.ideaVersionId),
          )
          .paginate({ numItems: 25, cursor: a.cursor });
        for (const row of page.page) await next({ ideaVersionId: row._id });
        await continuePage(page, phase);
        if (page.isDone)
          await ctx.scheduler.runAfter(0, internal.ai.contentCopies.sweep, {
            ...a,
            phase: "drafts",
            cursor: null,
          });
      } else {
        const page = await ctx.db
          .query("draftVersions")
          .withIndex("by_ideaVersionId_and_researchCleanupPending", (q) =>
            q
              .eq("ideaVersionId", a.ideaVersionId!)
              .eq("researchCleanupPending", true),
          )
          .paginate({ numItems: 25, cursor: a.cursor });
        for (const row of page.page) await next({ draftVersionId: row._id });
        await continuePage(page, phase);
      }
    } else if (a.draftVersionId) {
      const page = await ctx.db
        .query("draftResearchCopies")
        .withIndex("by_draftVersionId_and_state", (q) =>
          q.eq("draftVersionId", a.draftVersionId!).eq("state", "retained"),
        )
        .paginate({ numItems: 25, cursor: a.cursor });
      for (const row of page.page) {
        const order = await ctx.db.get(row.orderId);
        if (order?.pipeline?.runId) await next({ runId: order.pipeline.runId });
      }
      await continuePage(page);
    }
    return null;
  },
});
