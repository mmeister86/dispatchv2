import { sha256 } from "../lib/crypto";
import {
  recommendations,
  edits,
  recommendationProof,
  RULE_VERSION,
} from "./recommendationEdits";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  action,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceQuery,
  workspaceInternalMutation,
  requireReference,
  requireRole,
  requireActiveWorkspace,
} from "../lib/authorization";
import { selection } from "./profiles";
import { current, type Request } from "../ai/jev/access";
import { requestFields } from "../ai/jev/types";
import { resultContract } from "../ai/jev/resultFields";
import { draftResearchProof } from "../research/contentProof";
import { assessmentDoc, targetFields } from "./assessmentFields";
import type { Doc, Id } from "../_generated/dataModel";
async function source(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  a: {
    accountId: Id<"socialAccounts">;
    draftId: Id<"drafts">;
    draftVersionId: Id<"draftVersions">;
  },
) {
  requireActiveWorkspace(await ctx.db.get(workspaceId));
  requireReference(workspaceId, await ctx.db.get(a.accountId));
  const draft = requireReference(
    workspaceId,
    await ctx.db.get(a.draftId),
  ) as Doc<"drafts">;
  const ver = requireReference(
    workspaceId,
    await ctx.db.get(a.draftVersionId),
  ) as Doc<"draftVersions">;
  if (
    ver.draftId !== draft._id ||
    ver.content.accountId !== a.accountId ||
    ver.sourceUnavailable
  )
    throw new ConvexError("JEV_SOURCE_CHANGED");
  const sourceUntil = await draftResearchProof(ctx, ver);
  return { draft, ver, sourceUntil };
}
export async function request(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  a: {
    accountId: Id<"socialAccounts">;
    draftId: Id<"drafts">;
    draftVersionId: Id<"draftVersions">;
  },
  operationKey: string,
): Promise<Request> {
  const selected = await selection(ctx, workspaceId, a.accountId);
  if (!selected?.algorithmId || !selected.audienceId)
    throw new ConvexError("JEV_PROFILE_CHANGED");
  return {
    ...a,
    workspaceId,
    actorId,
    algorithmId: selected.algorithmId,
    audienceId: selected.audienceId,
    selectionRevision: selected.revision,
    operationKey,
    mode: "composer",
    deadline: Date.now() + 2500,
  };
}
export const prepare = workspaceInternalMutation({
  args: { ...targetFields, operationKey: v.string() },
  returns: v.object({
    request: v.object(requestFields),
    cached: v.union(v.id("jevAssessments"), v.null()),
  }),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const r = await request(
      ctx,
      ctx.workspace._id,
      ctx.user._id,
      a,
      a.operationKey,
    );
    const x = await current(ctx, r);
    const cached = await ctx.db
      .query("jevAssessments")
      .withIndex(
        "by_workspaceId_and_accountId_and_draftVersionId_and_semanticKey",
        (q) =>
          q
            .eq("workspaceId", r.workspaceId)
            .eq("accountId", r.accountId)
            .eq("draftVersionId", r.draftVersionId)
            .eq("semanticKey", x.semanticKey),
      )
      .first();
    const old = await ctx.db
      .query("jevAssessmentRequests")
      .withIndex("by_workspaceId_and_actorId_and_operationKey", (q) =>
        q
          .eq("workspaceId", r.workspaceId)
          .eq("actorId", r.actorId)
          .eq("operationKey", r.operationKey),
      )
      .unique();
    const draft = (await ctx.db.get(a.draftId))!;
    if (old) {
      if (
        old.request.accountId !== r.accountId ||
        old.request.draftId !== r.draftId ||
        old.request.draftVersionId !== r.draftVersionId ||
        old.semanticKey !== x.semanticKey
      )
        throw new ConvexError("JEV_REQUEST_CONFLICT");
      if (draft.assessmentRequestId !== old._id)
        throw new ConvexError("JEV_REQUEST_SUPERSEDED");
      return { request: old.request, cached: cached?._id ?? null };
    }
    const id = await ctx.db.insert("jevAssessmentRequests", {
      workspaceId: r.workspaceId,
      actorId: r.actorId,
      operationKey: r.operationKey,
      request: r,
      sourceUntil: x.sourceUntil,
      semanticKey: x.semanticKey,
      createdAt: Date.now(),
    });
    await ctx.db.patch(a.draftId, { assessmentRequestId: id });
    return { request: r, cached: cached?._id ?? null };
  },
});
export const finish = internalMutation({
  args: { request: v.object(requestFields), result: resultContract },
  returns: v.union(v.id("jevAssessments"), v.null()),
  handler: async (ctx, { request: r, result }) => {
    if (
      !result.answers ||
      !result.score ||
      !result.deterministic ||
      !result.questionVersion ||
      !result.normalizationVersion ||
      (result.outcome !== "success" && result.outcome !== "low_confidence")
    )
      return null;
    let x;
    try {
      x = await current(ctx, r);
    } catch {
      return null;
    }
    const draft = await ctx.db.get(r.draftId),
      fence = draft?.assessmentRequestId
        ? await ctx.db.get(draft.assessmentRequestId)
        : null;
    if (
      !fence ||
      fence.actorId !== r.actorId ||
      fence.operationKey !== r.operationKey ||
      fence.request.draftVersionId !== r.draftVersionId ||
      fence.semanticKey !== x.semanticKey
    )
      return null;
    const receipt = await ctx.db
      .query("aiAttempts")
      .withIndex("by_jev_operation", (q) =>
        q
          .eq("owner", "jev-analyzer")
          .eq("workspaceId", r.workspaceId)
          .eq("accountId", r.accountId)
          .eq("actorId", r.actorId)
          .eq("operationKey", r.operationKey),
      )
      .first();
    if (
      !receipt ||
      receipt.owner !== "jev-analyzer" ||
      receipt.draftId !== r.draftId ||
      receipt.draftVersionId !== r.draftVersionId ||
      receipt.algorithmId !== r.algorithmId ||
      receipt.audienceId !== r.audienceId ||
      receipt.requestFingerprint !== x.requestFingerprint ||
      receipt.outcome !== result.outcome ||
      receipt.questionVersion !== result.questionVersion ||
      receipt.normalizationVersion !== result.normalizationVersion
    )
      return null;
    const existing = await ctx.db
      .query("jevAssessments")
      .withIndex(
        "by_workspaceId_and_accountId_and_draftVersionId_and_semanticKey",
        (q) =>
          q
            .eq("workspaceId", r.workspaceId)
            .eq("accountId", r.accountId)
            .eq("draftVersionId", r.draftVersionId)
            .eq("semanticKey", x.semanticKey),
      )
      .first();
    if (existing) return existing._id;
    const { deterministic } = result;
    return ctx.db.insert("jevAssessments", {
      workspaceId: r.workspaceId,
      accountId: r.accountId,
      draftId: r.draftId,
      draftVersionId: r.draftVersionId,
      versionNumber: (await ctx.db.get(r.draftVersionId))!.number,
      algorithmId: r.algorithmId,
      audienceId: r.audienceId,
      semanticKey: x.semanticKey,
      inputVersion: "dispatch-assessment-input-v1",
      attemptId: receipt._id,
      provenance: {
        policyId: receipt.policyId,
        policyVersion: receipt.policyVersion,
        requestedModel: receipt.model,
        resolvedModel: receipt.resolvedModel,
        inputTokens: receipt.inputTokens,
        outputTokens: receipt.outputTokens,
        sentAt: receipt.sentAt,
        settledAt: receipt.settledAt,
        latencyMs: receipt.latencyMs,
        selectionRevision: receipt.selectionRevision,
      },
      createdAt: Date.now(),
      sourceUntil: x.sourceUntil,
      result: {
        outcome: result.outcome,
        answers: result.answers,
        score: result.score,
        questionVersion: result.questionVersion,
        normalizationVersion: result.normalizationVersion,
        deterministic: {
          ...deterministic,
          segments: deterministic.segments.map(
            ({ text: _text, ...segment }) => segment,
          ),
        },
      },
    });
  },
});
export const analyze = action({
  args: {
    workspaceId: v.id("workspaces"),
    ...targetFields,
    operationKey: v.string(),
  },
  returns: v.object({ outcome: v.string(), cached: v.boolean() }),
  handler: async (ctx, a): Promise<{ outcome: string; cached: boolean }> => {
    const prepared = await ctx.runMutation(
      internal.intelligence.assessments.prepare,
      a,
    );
    if (prepared.cached) return { outcome: "success", cached: true };
    const result = await ctx.runAction(
      internal.ai.jev.analyzePost.analyze,
      prepared.request,
    );
    const id = await ctx.runMutation(internal.intelligence.assessments.finish, {
      request: prepared.request,
      result,
    });
    return {
      outcome: id
        ? result.outcome
        : result.outcome === "success" || result.outcome === "low_confidence"
          ? "unavailable"
          : result.outcome,
      cached: false,
    };
  },
});
export const get = workspaceQuery({
  args: targetFields,
  returns: v.object({
    assessment: v.union(assessmentDoc, v.null()),
    recommendations: v.union(recommendations, v.null()),
    applicable: v.boolean(),
    sourceUntil: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, a) => {
    let proof;
    try {
      proof = await source(ctx, ctx.workspace._id, a);
    } catch {
      return {
        assessment: null,
        recommendations: null,
        applicable: false,
        sourceUntil: null,
      };
    }
    const rows = await ctx.db
      .query("jevAssessments")
      .withIndex("by_draftVersionId", (q) =>
        q.eq("draftVersionId", a.draftVersionId),
      )
      .order("desc")
      .take(20);
    const retained =
      rows.find(
        (row) =>
          row.workspaceId === ctx.workspace._id &&
          row.accountId === a.accountId,
      ) ?? null;
    try {
      const x = await current(
        ctx,
        await request(
          ctx,
          ctx.workspace._id,
          ctx.user._id,
          a,
          "current-read-assessment",
        ),
      );
      const matched = await ctx.db
        .query("jevAssessments")
        .withIndex(
          "by_workspaceId_and_accountId_and_draftVersionId_and_semanticKey",
          (q) =>
            q
              .eq("workspaceId", ctx.workspace._id)
              .eq("accountId", a.accountId)
              .eq("draftVersionId", a.draftVersionId)
              .eq("semanticKey", x.semanticKey),
        )
        .first();
      const receipt = matched ? await ctx.db.get(matched.attemptId) : null;
      const usable =
        matched &&
        receipt?.owner === "jev-analyzer" &&
        receipt.policyFingerprint === (await sha256(JSON.stringify(x.p)));
      return {
        assessment: matched ?? retained,
        recommendations: usable
          ? {
              assessmentId: matched._id,
              revision: proof.draft.revision,
              proof: await recommendationProof(
                x,
                proof.ver,
                proof.draft.revision,
                (await selection(ctx, ctx.workspace._id, a.accountId))!
                  .revision,
              ),
              ruleVersion: RULE_VERSION,
              candidates: edits(
                proof.ver.content,
                (
                  await Promise.all(
                    proof.ver.content.media.map((m) => ctx.db.get(m.assetId)),
                  )
                ).flatMap((asset, i) => (asset?.type === "image" ? [i] : [])),
              ),
            }
          : null,
        applicable: !!matched,
        sourceUntil: proof.sourceUntil,
      };
    } catch {
      return {
        assessment: retained,
        recommendations: null,
        applicable: false,
        sourceUntil: proof.sourceUntil,
      };
    }
  },
});
export const history = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    draftId: v.id("drafts"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(assessmentDoc),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    requireReference(ctx.workspace._id, await ctx.db.get(a.draftId));
    const result = await ctx.db
      .query("jevAssessments")
      .withIndex("by_workspaceId_and_accountId_and_draftId", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("accountId", a.accountId)
          .eq("draftId", a.draftId),
      )
      .order("desc")
      .paginate({
        ...a.paginationOpts,
        numItems: Math.min(20, a.paginationOpts.numItems),
      });
    const page = [];
    for (const row of result.page) {
      try {
        const proof = await source(ctx, ctx.workspace._id, row);
        page.push({ ...row, sourceUntil: proof.sourceUntil });
      } catch {
        /* protected history is hidden too */
      }
    }
    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
export const purgeVersion = internalMutation({
  args: { versionId: v.id("draftVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("jevAssessments")
      .withIndex("by_draftVersionId", (q) =>
        q.eq("draftVersionId", a.versionId),
      )
      .take(50);
    for (const row of rows) await ctx.db.delete(row._id);
    const requests = await ctx.db
      .query("jevAssessmentRequests")
      .withIndex("by_request_draftVersionId", (q) =>
        q.eq("request.draftVersionId", a.versionId),
      )
      .take(50);
    for (const row of requests) await ctx.db.delete(row._id);
    if (rows.length === 50 || requests.length === 50)
      await ctx.scheduler.runAfter(
        0,
        internal.intelligence.assessments.purgeVersion,
        a,
      );
    return null;
  },
});
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.cursor === null)
      await ctx.scheduler.runAfter(
        0,
        internal.intelligence.assessments.sweepRequests,
        { cursor: null },
      );
    const batch = await ctx.db
      .query("jevAssessments")
      .withIndex("by_sourceUntil", (q) => q.gt("sourceUntil", null))
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const row of batch.page) {
      try {
        await source(ctx, row.workspaceId, row);
      } catch {
        await ctx.db.delete(row._id);
      }
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(0, internal.intelligence.assessments.sweep, {
        cursor: batch.continueCursor,
      });
    return null;
  },
});

export const sweepRequests = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const batch = await ctx.db
      .query("jevAssessmentRequests")
      .withIndex("by_createdAt")
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const row of batch.page) {
      let remove = row.createdAt < Date.now() - 30 * 86400000;
      try {
        await source(ctx, row.workspaceId, row.request);
      } catch {
        remove = true;
      }
      if (remove) await ctx.db.delete(row._id);
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.intelligence.assessments.sweepRequests,
        { cursor: batch.continueCursor },
      );
    return null;
  },
});
