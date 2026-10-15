import type { QueryCtx, MutationCtx } from "../../_generated/server";
export async function nextAdmissionSequence(ctx: MutationCtx) {
  // ponytail: one App-wide OCC counter orders purpose grants and factual receipts; split by installation if measured contention requires it.
  const row = await ctx.db.query("githubAdmissionOrder").first();
  const sequence = (row?.sequence ?? 0) + 1;
  if (row) await ctx.db.patch(row._id, { sequence });
  else await ctx.db.insert("githubAdmissionOrder", { sequence });
  return sequence;
}
export async function barrierSequence(ctx: QueryCtx, keys: string[]) {
  let at = 0;
  for (const key of keys) {
    const row = await ctx.db
      .query("githubRevocationBarriers")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    at = Math.max(at, row?.sequence ?? 0);
  }
  return at;
}
