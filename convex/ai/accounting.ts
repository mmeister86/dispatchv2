import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
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
