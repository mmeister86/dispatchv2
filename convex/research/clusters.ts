import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { sha256 } from "../lib/crypto";
// Technical cluster membership only: source-derived text stays in governed evidence.
export async function assignCluster(
  ctx: MutationCtx,
  o: Doc<"researchOrders">,
  index: number,
  item: NonNullable<
    NonNullable<Doc<"researchOrders">["pipeline"]>["pending"]
  >[number],
) {
  const key = await sha256(
    JSON.stringify([o._id, index, o.pipeline!.proposalHash]),
  );
  if (item.clusterId) {
    const c = await ctx.db.get(item.clusterId);
    if (
      !c ||
      c.workspaceId !== o.workspaceId ||
      c.accountId !== o.accountId ||
      c.revision !== item.clusterRevision
    )
      throw new ConvexError("RESEARCH_CLUSTER_REVISION_CONFLICT");
    await ctx.db.patch(c._id, {
      revision: c.revision + 1,
      updatedAt: Date.now(),
    });
    return c._id;
  }
  const old = await ctx.db
    .query("researchClusters")
    .withIndex("by_workspaceId_and_accountId_and_key", (q) =>
      q
        .eq("workspaceId", o.workspaceId)
        .eq("accountId", o.accountId)
        .eq("key", key),
    )
    .unique();
  if (old) return old._id;
  return ctx.db.insert("researchClusters", {
    workspaceId: o.workspaceId,
    accountId: o.accountId,
    key,
    revision: 1,
    evidenceIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
export async function attachEvidence(
  ctx: MutationCtx,
  id: Id<"researchClusters">,
  evidenceId: Id<"researchEvidence">,
) {
  const c = await ctx.db.get(id);
  if (!c) throw new ConvexError("RESEARCH_CLUSTER_CHANGED");
  if (c.evidenceIds.includes(evidenceId)) return;
  // ponytail: retain the latest 100 governed evidence references; paginate history if cluster coverage needs to grow.
  await ctx.db.patch(id, {
    evidenceIds: [...c.evidenceIds, evidenceId].slice(-100),
    revision: c.revision + 1,
    updatedAt: Date.now(),
  });
}
