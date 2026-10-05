import type { QueryCtx } from "../../_generated/server";
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
