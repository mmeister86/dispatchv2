import { ConvexError, v } from "convex/values";
import {
  workspaceQuery,
  workspaceMutation,
  requireReference,
  requireRole,
} from "../lib/authorization";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { targetFields } from "./assessmentFields";
import { request } from "./assessments";
import { current } from "../ai/jev/access";
import { checkContentSource, saveDraftTransaction } from "../editorial";
import { content } from "../lib/editorialFields";
import { sha256 } from "../lib/crypto";
import {
  recommendationProof,
  edits,
  apply,
  choiceFields,
  RULE_VERSION,
} from "./recommendationEdits";
const binding = {
  ...targetFields,
  assessmentId: v.id("jevAssessments"),
  revision: v.number(),
  proof: v.string(),
  ruleVersion: v.literal(RULE_VERSION),
  ...choiceFields,
};
const ack = v.object({
  versionId: v.id("draftVersions"),
  revision: v.number(),
});
async function review(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Doc<"workspaces">["_id"],
  actorId: Doc<"users">["_id"],
  a: import("convex/values").Infer<typeof reviewArgs>,
) {
  if (
    a.proof.length !== 43 ||
    a.tokenIndices.length > 20 ||
    a.alt.length > 1000
  )
    throw new ConvexError("RECOMMENDATION_INPUT_INVALID");
  const r = await request(
    ctx,
    workspaceId,
    actorId,
    a,
    "recommendation-current-proof",
  );
  const x = await current(ctx, r);
  const draft = requireReference(
    workspaceId,
    await ctx.db.get(a.draftId),
  ) as Doc<"drafts">;
  const ver = requireReference(
    workspaceId,
    await ctx.db.get(a.draftVersionId),
  ) as Doc<"draftVersions">;
  const assessment = requireReference(
    workspaceId,
    await ctx.db.get(a.assessmentId),
  ) as Doc<"jevAssessments">;
  const receipt = await ctx.db.get(assessment.attemptId);
  if (
    draft.revision !== a.revision ||
    assessment.accountId !== a.accountId ||
    assessment.draftId !== draft._id ||
    assessment.draftVersionId !== ver._id ||
    assessment.semanticKey !== x.semanticKey ||
    !receipt ||
    receipt.owner !== "jev-analyzer" ||
    receipt.policyFingerprint !== (await sha256(JSON.stringify(x.p))) ||
    a.proof !==
      (await recommendationProof(x, ver, draft.revision, r.selectionRevision))
  )
    throw new ConvexError("RECOMMENDATION_STALE");
  const images = (
    await Promise.all(ver.content.media.map((m) => ctx.db.get(m.assetId)))
  ).flatMap((asset, i) => (asset?.type === "image" ? [i] : []));
  const candidates = edits(ver.content, images);
  if (
    !Number.isSafeInteger(a.candidateIndex) ||
    a.candidateIndex < 0 ||
    a.candidateIndex >= candidates.length
  )
    throw new ConvexError("RECOMMENDATION_INPUT_INVALID");
  return {
    before: ver.content,
    after: apply(ver.content, candidates[a.candidateIndex], a),
  };
}
const reviewArgs = v.object(binding);
export const compare = workspaceQuery({
  args: binding,
  returns: v.union(v.object({ before: content, after: content }), v.null()),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    try {
      return await review(ctx, ctx.workspace._id, ctx.user._id, a);
    } catch {
      return null;
    }
  },
});
export const adopt = workspaceMutation({
  args: { ...binding, operationKey: v.string() },
  returns: ack,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    if (
      !/^[A-Za-z0-9_-]{8,100}$/.test(a.operationKey) ||
      a.tokenIndices.length > 20 ||
      a.alt.length > 1000
    )
      throw new ConvexError("RECOMMENDATION_INPUT_INVALID");
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.draftVersionId),
    ) as Doc<"draftVersions">;
    if (
      ver.sourceUnavailable ||
      ver.draftId !== a.draftId ||
      ver.content.accountId !== a.accountId
    )
      throw new ConvexError("RECOMMENDATION_STALE");
    await checkContentSource(ctx, ver);
    const { operationKey, ...intentArgs } = a;
    const intent = await sha256(JSON.stringify(intentArgs));
    const old = await ctx.db
      .query("recommendationReceipts")
      .withIndex("by_workspaceId_and_actorId_and_operationKey", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("actorId", ctx.user._id)
          .eq("operationKey", operationKey),
      )
      .unique();
    if (old) {
      if (old.intent !== intent)
        throw new ConvexError("RECOMMENDATION_OPERATION_CONFLICT");
      const saved = requireReference(
        ctx.workspace._id,
        await ctx.db.get(old.versionId),
      ) as Doc<"draftVersions">;
      if (saved.sourceUnavailable)
        throw new ConvexError("RECOMMENDATION_STALE");
      await checkContentSource(ctx, saved);
      return { versionId: old.versionId, revision: old.revision };
    }
    const { after } = await review(ctx, ctx.workspace._id, ctx.user._id, a);
    const versionId = await saveDraftTransaction(
      ctx,
      ctx.workspace._id,
      ctx.user._id,
      {
        draftId: a.draftId,
        expectedRevision: a.revision,
        content: after,
        reason: "Redaktionelle Empfehlung übernommen",
      },
    );
    const revision = a.revision + 1;
    // Receipt retains hashes/IDs only: no protected text, alt, token ranges, proposal or frozen diff copies.
    await ctx.db.insert("recommendationReceipts", {
      workspaceId: ctx.workspace._id,
      actorId: ctx.user._id,
      accountId: a.accountId,
      operationKey,
      intent,
      baseVersionId: ver._id,
      versionId,
      revision,
    });
    return { versionId, revision };
  },
});
