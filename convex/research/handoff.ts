import { ConvexError, v } from "convex/values";
import {
  workspaceMutation,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { operationKey } from "./access";
import { sha256 } from "../lib/crypto";
import { currentEvidence } from "./evidence";
import { insertIdea } from "../content/ideas";
import { createDraftTransaction } from "../editorial";
import { internal } from "../_generated/api";
export const consume = workspaceMutation({
  args: {
    accountId: v.id("socialAccounts"),
    evidenceIds: v.array(v.id("researchEvidence")),
    target: v.union(v.literal("idea"), v.literal("draft")),
    intent: v.string(),
    requestedCount: v.optional(v.number()),
    commandKey: v.string(),
  },
  returns: v.array(
    v.object({
      ideaId: v.id("ideas"),
      ideaVersionId: v.id("ideaVersions"),
      draftId: v.union(v.id("drafts"), v.null()),
      draftVersionId: v.union(v.id("draftVersions"), v.null()),
    }),
  ),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    operationKey(a.commandKey);
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const intent = a.intent.trim().replace(/\s+/g, " "),
      count = a.requestedCount ?? 1;
    if (
      !intent ||
      intent.length > 1000 ||
      /[\u0000-\u001f]/.test(a.intent) ||
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > 5 ||
      a.evidenceIds.length < 1 ||
      a.evidenceIds.length > count ||
      new Set(a.evidenceIds).size !== a.evidenceIds.length
    )
      throw new ConvexError("RESEARCH_HANDOFF_INTENT_INVALID");
    const proofs = [];
    for (const id of a.evidenceIds)
      proofs.push(
        await currentEvidence(ctx, ctx.workspace._id, id, a.accountId),
      );
    const families = new Set<string>();
    for (const { e } of proofs) {
      let root = e;
      // A chosen finite ceiling bounds this exact immutable review-parent walk.
      for (let n = 0; root.parentEvidenceId && n < 100; n++) {
        const parent = await ctx.db.get(root.parentEvidenceId);
        if (
          !parent ||
          parent.workspaceId !== ctx.workspace._id ||
          parent.orderId !== e.orderId
        )
          throw new ConvexError("RESEARCH_EVIDENCE_MATERIAL_CHANGED");
        root = parent;
      }
      if (root.parentEvidenceId)
        throw new ConvexError("RESEARCH_EVIDENCE_MATERIAL_CHANGED");
      const family = root.modelOrigin
        ? JSON.stringify([
            root.modelOrigin.runId,
            root.sourceId,
            root.materialHash,
            root.payload?.model?.clusterId,
          ])
        : JSON.stringify([
            root.orderId,
            root.sourceId,
            root.materialHash,
            root.payload?.annotation.claim.trim(),
            root.payload?.annotation.quote?.trim(),
            root.payload?.annotation.interpretation.trim(),
            root.payload?.annotation.uncertainty.trim(),
            root.payload?.annotation.gaps.map((g) => g.trim()),
          ]);
      if (families.has(family))
        throw new ConvexError("RESEARCH_HANDOFF_DUPLICATE_PROPOSAL");
      families.add(family);
    }
    const requestHash = await sha256(
      JSON.stringify([
        a.accountId,
        a.target,
        intent,
        count,
        proofs.map(({ e }) => [
          e._id,
          e.fingerprint,
          e.materialHash,
          e.modelOrigin ?? null,
          e.assessment ?? null,
        ]),
      ]),
    );
    const keyReceipt = await ctx.db
      .query("researchContentHandoffs")
      .withIndex("by_workspaceId_and_actorId_and_commandKey", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("actorId", ctx.user._id)
          .eq("commandKey", a.commandKey),
      )
      .unique();
    if (keyReceipt && keyReceipt.requestHash !== requestHash)
      throw new ConvexError("RESEARCH_OPERATION_CONFLICT");
    const prior =
      keyReceipt ??
      (await ctx.db
        .query("researchContentHandoffs")
        .withIndex("by_workspaceId_and_actorId_and_requestHash", (q) =>
          q
            .eq("workspaceId", ctx.workspace._id)
            .eq("actorId", ctx.user._id)
            .eq("requestHash", requestHash),
        )
        .first());
    if (prior) {
      if (!keyReceipt) {
        const { _id, _creationTime, ...receipt } = prior;
        await ctx.db.insert("researchContentHandoffs", {
          ...receipt,
          commandKey: a.commandKey,
          createdAt: Date.now(),
        });
      }
      return prior.results;
    }
    const results = [];
    for (const [i, { e, proofUntil }] of proofs.entries()) {
      const p = e.payload!;
      const source = {
        kind: "research" as const,
        evidenceId: e._id,
        evidenceFingerprint: e.fingerprint,
        accountId: e.accountId,
        orderId: e.orderId,
        sourceId: e.sourceId,
        materialHash: e.materialHash,
        sourceGeneration: e.sourceGeneration,
        ...(e.modelOrigin ? { modelOrigin: e.modelOrigin } : {}),
        ...(e.assessment
          ? {
              assessmentFingerprint: await sha256(JSON.stringify(e.assessment)),
            }
          : {}),
        proofUntil,
      };
      const ideaId = await insertIdea(
        ctx,
        ctx.workspace._id,
        ctx.user._id,
        `research_${requestHash}_${i}`,
        requestHash,
        {
          title: (p.model?.title ?? p.annotation.claim).slice(0, 200),
          note: p.annotation.claim,
          perspective: p.model?.perspective ?? p.annotation.interpretation,
          priority: "normal",
          source,
          originals: [
            p.annotation.claim,
            ...(p.annotation.quote ? [p.annotation.quote] : []),
          ],
          rationale: p.annotation.uncertainty,
          questions: p.annotation.gaps,
          researchProofUntil: proofUntil,
          researchCleanupPending: true,
        },
      );
      const idea = (await ctx.db.get(ideaId))!,
        ideaVersionId = idea.currentVersionId!;
      let draftId = null,
        draftVersionId = null;
      if (a.target === "draft") {
        draftId = await createDraftTransaction(
          ctx,
          ctx.workspace._id,
          ctx.user._id,
          {
            source: `Research ${e._id}`,
            ideaVersionId,
            content: {
              title: (p.model?.title ?? p.annotation.claim).slice(0, 200),
              text: [
                p.annotation.claim,
                p.model?.perspective ?? p.annotation.interpretation,
              ],
              media: [],
              accountId: a.accountId,
              pillar: "Research",
              strategy: "generic",
            },
          },
        );
        draftVersionId = (await ctx.db.get(draftId))!.currentVersionId!;
      }
      if (draftId && draftVersionId)
        await ctx.db.patch(ideaId, {
          status: "accepted",
          handoff: {
            ideaVersionId,
            ideaRevision: 1,
            accountId: a.accountId,
            draftId,
            draftVersionId,
            actorId: ctx.user._id,
            intent,
            clarificationConfirmed: true,
            text: [
              p.annotation.claim,
              p.model?.perspective ?? p.annotation.interpretation,
            ].join("\n\n"),
            at: Date.now(),
          },
        });
      results.push({ ideaId, ideaVersionId, draftId, draftVersionId });
      await ctx.scheduler.runAt(
        proofUntil,
        internal.research.contentCleanup.expired,
        {},
      );
    }
    await ctx.db.insert("researchContentHandoffs", {
      workspaceId: ctx.workspace._id,
      actorId: ctx.user._id,
      accountId: a.accountId,
      requestHash,
      commandKey: a.commandKey,
      createdAt: Date.now(),
      selection: a.evidenceIds,
      count,
      target: a.target,
      results,
    });
    return results;
  },
});
