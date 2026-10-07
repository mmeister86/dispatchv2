import { historicalReviewSource } from "../editorial/reviews";
import { seriesVersionProof } from "./strategy";
import { ConvexError, v } from "convex/values";
import {
  workspaceMutation,
  requireReference,
  requireRole,
} from "../lib/authorization";
import {
  approveTransaction,
  scheduleTransaction,
  validateTime,
} from "../editorial";
import { validateProposedItem } from "./plans";
import type { Doc, Id } from "../_generated/dataModel";

const selection = v.object({
  itemId: v.id("contentPlanItems"),
  versionId: v.id("draftVersions"),
  draftRevision: v.number(),
  approvalId: v.optional(v.id("approvals")),
});

export const selected = workspaceMutation({
  args: {
    planId: v.id("contentPlans"),
    selections: v.array(selection),
    mode: v.union(v.literal("approved"), v.literal("approve_and_schedule")),
  },
  returns: v.array(
    v.object({
      itemId: v.id("contentPlanItems"),
      approvalId: v.id("approvals"),
      scheduleId: v.id("schedules"),
    }),
  ),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    if (
      !a.selections.length ||
      a.selections.length > 7 ||
      new Set(a.selections.map((s) => s.itemId)).size !== a.selections.length
    )
      throw new ConvexError("INVALID_PLAN_SELECTION");
    const plan = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.planId),
    ) as Doc<"contentPlans">;
    const readBudget = { remaining: 256 };
    const seriesProofs = new Map<Id<"contentPlans">, number | null>();
    const historicalSeriesProofs = new Map<Id<"contentPlans">, number>();
    const result = [];
    for (const selected of a.selections) {
      const item = requireReference(
        ctx.workspace._id,
        await ctx.db.get(selected.itemId),
      ) as Doc<"contentPlanItems">;
      if (
        item.planId !== plan._id ||
        item.accountId !== plan.accountId ||
        item.versionId !== selected.versionId ||
        item.draftRevision !== selected.draftRevision ||
        (a.mode === "approved") !== (selected.approvalId !== undefined)
      )
        throw new ConvexError("PLAN_SELECTION_CHANGED");
      if (item.status === "accepted") {
        const schedule = item.acceptedScheduleId
          ? await ctx.db.get(item.acceptedScheduleId)
          : null;
        const approval = item.acceptedApprovalId
          ? await ctx.db.get(item.acceptedApprovalId)
          : null;
        if (
          item.acceptedActorId !== ctx.user._id ||
          item.acceptedMode !== a.mode ||
          !schedule ||
          !approval ||
          schedule.workspaceId !== ctx.workspace._id ||
          schedule.accountId !== item.accountId ||
          schedule.versionId !== item.versionId ||
          schedule.draftId !== item.draftId ||
          schedule.approvalId !== approval._id ||
          schedule.at !== item.at ||
          schedule.timezone !== item.timezone ||
          schedule.localTime !== item.localTime ||
          approval.workspaceId !== ctx.workspace._id ||
          approval.accountId !== item.accountId ||
          approval.versionId !== item.versionId ||
          approval.draftId !== item.draftId ||
          (approval.purpose ?? "publishing") !== "publishing" ||
          (a.mode === "approved" && selected.approvalId !== approval._id)
        )
          throw new ConvexError("PLAN_ACCEPTANCE_CHANGED");
        const ver = requireReference(
          ctx.workspace._id,
          await ctx.db.get(item.versionId),
        ) as Doc<"draftVersions">;
        if (
          ver.draftId !== item.draftId ||
          ver.content.accountId !== item.accountId
        )
          throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
        if (
          !item.historyVersionIds ||
          item.historyVersionIds.length > 10 ||
          (item.historyVersionIds.length === 0
            ? item.contextProofUntil !== null
            : item.contextProofUntil == null ||
              !Number.isFinite(item.contextProofUntil))
        )
          throw new ConvexError("PLAN_CONTEXT_CHANGED");
        await historicalReviewSource(
          ctx,
          ver,
          item.proofUntil,
          item.validityUntil,
          item.contextProofUntil,
          approval.reviewPin?.sourceUntil,
          schedule.reviewPin?.sourceUntil,
        );
        if (plan.series) {
          if (!historicalSeriesProofs.has(plan._id)) {
            const series = await ctx.db.get(plan.series.seriesId),
              version = await ctx.db.get(plan.series.versionId);
            if (
              !series ||
              !version ||
              series.workspaceId !== plan.workspaceId ||
              series.accountId !== plan.accountId ||
              series.actorId !== plan.actorId
            )
              throw new ConvexError("SERIES_VERSION_CHANGED");
            const proof = await seriesVersionProof(ctx, series, version, false);
            historicalSeriesProofs.set(
              plan._id,
              Math.min(plan.series.sourceUntil, proof.until),
            );
          }
          const original = historicalSeriesProofs.get(plan._id)!;
          if (original <= Date.now())
            throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
        }
        for (const id of item.historyVersionIds) {
          const previous = requireReference(
            ctx.workspace._id,
            await ctx.db.get(id),
          ) as Doc<"draftVersions">;
          if (previous.content.accountId !== item.accountId)
            throw new ConvexError("PLAN_CONTEXT_CHANGED");
          await historicalReviewSource(ctx, previous, item.contextProofUntil);
        }
        result.push({
          itemId: item._id,
          approvalId: approval._id,
          scheduleId: schedule._id,
        });
        continue;
      }
      if (item.status !== "proposed")
        throw new ConvexError("PLAN_ITEM_REJECTED");
      validateTime(item.at, item.timezone, item.localTime);
      await validateProposedItem(ctx, item, readBudget, true, seriesProofs);
      const approvalId =
        selected.approvalId ??
        (await approveTransaction(ctx, ctx.workspace._id, ctx.user._id, {
          versionId: item.versionId,
          accountId: item.accountId,
        }));
      const scheduleId = await scheduleTransaction(
        ctx,
        ctx.workspace._id,
        ctx.user._id,
        {
          versionId: item.versionId,
          accountId: item.accountId,
          approvalId,
          at: item.at,
          timezone: item.timezone,
          localTime: item.localTime,
        },
        readBudget,
      );
      await ctx.db.patch(item._id, {
        status: "accepted",
        acceptedApprovalId: approvalId,
        acceptedScheduleId: scheduleId,
        acceptedActorId: ctx.user._id,
        acceptedMode: a.mode,
      });
      result.push({ itemId: item._id, approvalId, scheduleId });
    }
    return result;
  },
});
