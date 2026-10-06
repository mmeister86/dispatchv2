import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { orderLiability } from "./pipelineAccess";
import { handoffResults } from "./pipelineFields";
import { requireWorkspace } from "../lib/authorization";
import { liveAuthority, prerequisites, sameApproval } from "./access";
import { captureWorkflowApproval, sameWorkflowActivation } from "./pipeline";
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
  returns: handoffResults,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    return consumeEvidence(ctx, a, ctx.workspace._id, ctx.user._id);
  },
});

export async function consumeEvidence(
  ctx: MutationCtx,
  a: {
    accountId: Id<"socialAccounts">;
    evidenceIds: Id<"researchEvidence">[];
    target: "idea" | "draft";
    intent: string;
    requestedCount?: number;
    commandKey: string;
  },
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
) {
  operationKey(a.commandKey);
  requireReference(workspaceId, await ctx.db.get(a.accountId));
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
    proofs.push(await currentEvidence(ctx, workspaceId, id, a.accountId));
  const families = new Set<string>();
  for (const { e } of proofs) {
    const { family } = await proposalFamily(ctx, workspaceId, e);
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
        .eq("workspaceId", workspaceId)
        .eq("actorId", actorId)
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
          .eq("workspaceId", workspaceId)
          .eq("actorId", actorId)
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
      workspaceId,
      actorId,
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
      draftId = await createDraftTransaction(ctx, workspaceId, actorId, {
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
      });
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
          actorId: actorId,
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
    workspaceId: workspaceId,
    actorId: actorId,
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
}

export async function proposalFamily(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  e: Doc<"researchEvidence">,
) {
  let root = e;
  // A chosen finite ceiling bounds this exact immutable review-parent walk.
  for (let n = 0; root.parentEvidenceId && n < 100; n++) {
    const parent = await ctx.db.get(root.parentEvidenceId);
    if (
      !parent ||
      parent.workspaceId !== workspaceId ||
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
  return { family, root };
}

export const automatic = internalMutation({
  args: { orderId: v.id("researchOrders") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId),
      capture = o?.automaticHandoff;
    if (
      !o ||
      !capture ||
      capture.state !== "awaiting-review" ||
      !o.finishedAt ||
      !o.pipeline ||
      o.occasion !== "scheduled"
    )
      return null;
    try {
      const p = await ctx.db.get(o.profileId),
        actor = await ctx.db.get(capture.actorId);
      if (
        !p ||
        !actor ||
        p.paused ||
        p.deleted ||
        !p.scheduleActive ||
        p.scheduleGeneration !== capture.activationGeneration ||
        p.currentVersionId !== capture.profileVersionId ||
        p.scheduleActorId !== capture.actorId ||
        p.workflowActivation?.kind !== "research-workflow-v2" ||
        JSON.stringify(p.workflowActivation.autoHandoff) !==
          JSON.stringify(capture.option) ||
        JSON.stringify(o.config.autoHandoff) !== JSON.stringify(capture.option)
      )
        throw new ConvexError("RESEARCH_AUTOMATIC_ACTIVATION_WITHDRAWN");
      requireRole(
        (await requireWorkspace(ctx, o.workspaceId, actor)).membership,
        ["Owner", "Admin"],
      );
      await liveAuthority(ctx, p, actor._id, o.accountSequence);
      if (
        !sameApproval(
          o.approval,
          await prerequisites(ctx, p, o.config, false),
        ) ||
        !sameWorkflowActivation(
          p.workflowActivation,
          await captureWorkflowApproval(
            ctx,
            p,
            o.config,
            p.workflowActivation.language,
            p.workflowActivation.operations,
          ),
        )
      )
        throw new ConvexError("RESEARCH_AUTOMATIC_AUTHORITY_CHANGED");
    } catch (error) {
      await ctx.db.patch(o._id, {
        automaticHandoff: {
          ...capture,
          state: "withdrawn",
          reason:
            error instanceof ConvexError
              ? String(error.data)
              : "RESEARCH_AUTOMATIC_AUTHORITY_UNAVAILABLE",
        },
      });
      return null;
    }
    if (
      !o.pipeline.inboxReady ||
      o.pipeline.cleanupState !== "retained" ||
      !["completed", "partial"].includes(o.pipeline.outcome)
    )
      return null;
    const money = await orderLiability(ctx, o);
    if (
      money.usagePending ||
      !o.config.cap ||
      money.total > o.config.cap.limitMicros
    ) {
      await ctx.db.patch(o._id, {
        automaticHandoff: {
          ...capture,
          reason: money.usagePending
            ? "RESEARCH_AUTOMATIC_USAGE_UNRESOLVED"
            : "RESEARCH_AUTOMATIC_ORDER_LIMIT_EXCEEDED",
        },
      });
      return null;
    }
    const rows = await ctx.db
      .query("researchEvidence")
      .withIndex("by_orderId_and_createdAt", (q) => q.eq("orderId", o._id))
      .order("desc")
      .take(100);
    const ids: Id<"researchEvidence">[] = [],
      families = new Set<string>();
    for (const row of rows) {
      if (
        !row.assessment?.validUntil ||
        row.assessment.validUntil <= Date.now() ||
        (row.inboxDisposition ?? "active") !== "active"
      )
        continue;
      try {
        const { e } = await currentEvidence(
          ctx,
          o.workspaceId,
          row._id,
          o.accountId,
        );
        const { family, root } = await proposalFamily(ctx, o.workspaceId, e);
        if (
          !o.pipeline.evidenceIds.includes(root._id) ||
          (root.inboxDisposition ?? "active") !== "active" ||
          families.has(family)
        )
          continue;
        families.add(family);
        ids.push(e._id);
        if (ids.length === capture.option.count) break;
      } catch {
        /* A noncurrent candidate never grants automatic authority. */
      }
    }
    if (!ids.length) {
      await ctx.db.patch(o._id, {
        automaticHandoff: {
          ...capture,
          reason: "RESEARCH_AUTOMATIC_AWAITING_HUMAN_REVIEW",
        },
      });
      return null;
    }
    const results = await consumeEvidence(
      ctx,
      {
        accountId: o.accountId,
        evidenceIds: ids,
        target: capture.option.target,
        intent: capture.option.intent,
        requestedCount: capture.option.count,
        commandKey: `automatic_${o._id}`,
      },
      o.workspaceId,
      capture.actorId,
    );
    await ctx.db.patch(o._id, {
      automaticHandoff: {
        ...capture,
        state: "completed",
        reason:
          ids.length < capture.option.count
            ? "RESEARCH_AUTOMATIC_UNDERFILLED"
            : null,
        selection: ids,
        results,
      },
    });
    return null;
  },
});
