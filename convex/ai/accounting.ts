import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
// These counters remain the sole financial authority for generation and native search.
export async function changeLiability(
  ctx: MutationCtx,
  ids: Id<"aiBudgets">[],
  heldDelta: number,
  spentDelta = 0,
  admission = false,
) {
  if (
    ids.length !== 3 ||
    new Set(ids).size !== 3 ||
    !Number.isSafeInteger(heldDelta) ||
    !Number.isSafeInteger(spentDelta) ||
    spentDelta < 0
  )
    throw new ConvexError("MODEL_BUDGET_RECEIPT_INVALID");
  for (const id of ids) {
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError("MODEL_BUDGET_RECEIPT_MISSING");
    const heldMicros = b.heldMicros + heldDelta,
      spentMicros = b.spentMicros + spentDelta;
    if (
      !Number.isSafeInteger(heldMicros) ||
      !Number.isSafeInteger(spentMicros) ||
      heldMicros < 0 ||
      spentMicros < 0
    )
      throw new ConvexError("MODEL_BUDGET_RECEIPT_INVALID");
    if (admission && heldMicros + spentMicros > b.limitMicros)
      throw new ConvexError("MODEL_BUDGET_EXHAUSTED");
    await ctx.db.patch(id, { heldMicros, spentMicros });
  }
}

// Receipt ownership is immutable; expired or revoked approvals still permit safe late settlement.
export async function generationAttempt(
  ctx: QueryCtx | MutationCtx,
  attempt: Doc<"aiAttempts">,
  run: Doc<"agentRuns"> | null,
) {
  if (
    attempt.owner === "native-search" ||
    attempt.researchOrderId !== undefined ||
    attempt.logicalIntent !== undefined ||
    !run ||
    attempt.runId !== run._id ||
    attempt.workspaceId !== run.workspaceId ||
    attempt.budgetIds.length !== 3 ||
    new Set(attempt.budgetIds).size !== 3 ||
    run.budgetIds.length !== 3 ||
    attempt.budgetIds.some((id, i) => id !== run.budgetIds[i])
  )
    throw new ConvexError("MODEL_ATTEMPT_OWNER_INVALID");
  for (const [i, id] of attempt.budgetIds.entries()) {
    const b = await ctx.db.get(id);
    if (
      !b ||
      b.currency !== attempt.currency ||
      (i === 0 &&
        (b.scope !== "provider" ||
          b.workspaceId !== undefined ||
          b.accountId !== undefined)) ||
      (i === 1 &&
        (b.scope !== "workspace" ||
          b.workspaceId !== run.workspaceId ||
          b.accountId !== undefined)) ||
      (i === 2 &&
        (b.scope !== "account" ||
          b.workspaceId !== run.workspaceId ||
          b.accountId !== run.accountId))
    )
      throw new ConvexError("MODEL_ATTEMPT_OWNER_INVALID");
  }
  return attempt;
}
