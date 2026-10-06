import { materialWalk } from "../research/pipelineAccess";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  requireWorkspace,
  requireReference,
  requireRole,
} from "../lib/authorization";
import { generationAttempt } from "./accounting";
import { currentRunSources } from "./sourceAccess";
import { ideaProofUntil } from "../research/contentProof";
export async function conversationAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
  id: Id<"conversations">,
  edit = false,
) {
  const auth = await requireWorkspace(ctx, workspaceId);
  requireReference(workspaceId, await ctx.db.get(accountId));
  const c = await ctx.db.get(id);
  requireReference(workspaceId, c);
  if (c!.accountId !== accountId || c!.actorId !== auth.user._id)
    throw new ConvexError("CHAT_ACCESS_DENIED");
  if (edit) requireRole(auth.membership, ["Owner", "Admin", "Editor"]);
  return { c: c!, ...auth };
}
export async function historyAuthority(
  ctx: QueryCtx | MutationCtx,
  c: Doc<"conversations">,
) {
  if (c.state !== "active") throw new ConvexError("CHAT_INACTIVE");
  const walk = materialWalk();
  const horizons: (number | null)[] = await currentRunSources(
    ctx,
    c.workspaceId,
    c.accountId,
    c.sources,
    walk,
  );
  for (const id of c.ideaVersionIds) {
    const version = await ctx.db.get(id);
    requireReference(c.workspaceId, version);
    const idea = await ctx.db.get(version!.ideaId);
    requireReference(c.workspaceId, idea);
    if (idea!.status === "archived")
      throw new ConvexError("CHAT_HISTORY_SOURCE_WITHDRAWN");
    horizons.push(await ideaProofUntil(ctx, version!, walk, c.accountId));
  }
  const until = Math.min(...horizons.map((x) => x ?? Infinity));
  return Number.isFinite(until) ? until : null;
}
export async function operationRun(
  ctx: QueryCtx | MutationCtx,
  op: Doc<"chatOperations">,
  id: Id<"agentRuns">,
) {
  const r = await ctx.db.get(id);
  if (
    !r ||
    r.workspaceId !== op.workspaceId ||
    r.accountId !== op.accountId ||
    r.actorId !== op.actorId ||
    r.conversationId !== op.conversationId ||
    r.chatOperationId !== op._id ||
    r.promptMessageId !== op.promptMessageId ||
    r.purpose !== "chat" ||
    !op.runIds.includes(id)
  )
    throw new ConvexError("MODEL_ATTEMPT_OWNER_INVALID");
  return r;
}
export async function conversationAuthority(
  ctx: QueryCtx | MutationCtx,
  r: Doc<"agentRuns">,
) {
  const c = r.conversationId ? await ctx.db.get(r.conversationId) : null;
  const op = r.chatOperationId ? await ctx.db.get(r.chatOperationId) : null;
  if (
    !c ||
    !op ||
    c.state !== "active" ||
    c.activeRunId !== r._id ||
    c.threadId !== r.threadId ||
    c.actorId !== r.actorId ||
    c.accountId !== r.accountId ||
    c.workspaceId !== r.workspaceId ||
    op.conversationId !== c._id ||
    !op.runIds.includes(r._id) ||
    op.promptMessageId !== r.promptMessageId
  )
    throw new ConvexError("CHAT_RUN_CHANGED");
  for (const previous of op.runIds)
    if (previous !== r._id) {
      const owner = await operationRun(ctx, op, previous);
      for (const state of ["sent", "unknown"] as const) {
        const receipt = await ctx.db
          .query("aiAttempts")
          .withIndex("by_runId_and_state", (q) =>
            q.eq("runId", previous).eq("state", state),
          )
          .first();
        if (receipt) {
          await generationAttempt(ctx, receipt, owner);
          throw new ConvexError("CHAT_USAGE_RECONCILIATION_REQUIRED");
        }
      }
    }
  await historyAuthority(ctx, c);
}
