import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import {
  requireRole,
  requireWorkspace,
  requireReference,
} from "../../lib/authorization";
import { checkSource } from "./repositories";
export async function currentContext(
  ctx: QueryCtx | MutationCtx,
  id: Id<"githubContexts">,
  approved = false,
) {
  const c = await ctx.db.get(id);
  if (!c) throw new ConvexError("GITHUB_CONTEXT_CHANGED");
  const actor = await ctx.db.get(c.actorId);
  if (!actor) throw new ConvexError("GITHUB_CONTEXT_CHANGED");
  requireRole((await requireWorkspace(ctx, c.workspaceId, actor)).membership, [
    "Owner",
    "Admin",
    "Editor",
  ]);
  const r = await checkSource(
    ctx,
    c.workspaceId,
    c.repositoryId,
    c.generation,
    "context",
  );
  const connection = await ctx.db
    .query("githubConnections")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", c.workspaceId))
    .unique();
  const s = await ctx.db.get(c.signalId);
  requireReference(c.workspaceId, s);
  const receipt = s && (await ctx.db.get(s.receiptId));
  if (
    !connection ||
    connection.generation !== c.connectionGeneration ||
    connection.credentialGeneration !== c.credentialGeneration ||
    !s ||
    s.repositoryId !== r._id ||
    s.fullName !== r.fullName ||
    s.private !== r.private ||
    !receipt ||
    receipt.digest !== s.digest ||
    receipt.facts.providerId !== r.providerId ||
    receipt.facts.installationId !== r.installationId ||
    (approved &&
      (c.state !== "ready" ||
        !c.hash ||
        c.approvedHash !== c.hash ||
        !c.approvedAt))
  )
    throw new ConvexError("GITHUB_CONTEXT_CHANGED");
  return { c, r, s };
}
