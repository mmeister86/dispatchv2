import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  workspaceQuery,
  workspaceInternalQuery,
  requireRole,
} from "../lib/authorization";
import { checkRecoverySource } from "../integrations/github/recoveryState";
import { localEvidence } from "../integrations/github/deliveries";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
const args = { expectedAuthId: v.string(), refreshKey: v.string() };
const input = v.object(args);
const wire = v.object({
  authId: v.string(),
  sessionId: v.string(),
  workspaceId: v.id("workspaces"),
  refreshKey: v.string(),
  data: v.object({
    observedAt: v.number(),
    validUntil: v.number(),
    coverage: v.object({
      partial: v.literal(true),
      parentLimit: v.literal(6),
      remainder: v.literal("unknown"),
    }),
    rows: v.array(v.object({ id: v.id("githubRecoveries") })),
  }),
});
type Wire = Infer<typeof wire>;
const limits = {
  databaseQueries: 128,
  documentsRead: 128,
  bytesRead: 256 * 1024,
};
async function scope(
  ctx: QueryCtx & {
    user: Doc<"users">;
    workspace: Doc<"workspaces">;
    membership: Doc<"memberships">;
  },
  a: Infer<typeof input>,
) {
  requireRole(ctx.membership, ["Owner", "Admin"]);
  if (
    !a.expectedAuthId ||
    a.expectedAuthId.length > 256 ||
    !a.refreshKey ||
    a.refreshKey.length > 64
  )
    throw new ConvexError("GITHUB_ALERT_REQUEST_INVALID");
  if (
    a.expectedAuthId !== ctx.user.authId ||
    ctx.user.activeWorkspaceId !== ctx.workspace._id
  )
    throw new ConvexError("GITHUB_WORKSPACE_CHANGED");
  const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
  if (typeof sessionId !== "string" || !sessionId)
    throw new ConvexError("Unauthenticated");
  return sessionId;
}
export const get = workspaceQuery({
  args,
  returns: wire,
  handler: async (ctx, a): Promise<Wire> => {
    await scope(ctx, a);
    const m = await ctx.meta.getTransactionMetrics();
    const remaining = {
      databaseQueries: limits.databaseQueries - m.databaseQueries.used - 1,
      documentsRead: limits.documentsRead - m.documentsRead.used,
      bytesRead: limits.bytesRead - m.bytesRead.used,
    };
    if (Object.values(remaining).some((n) => n <= 0))
      throw new ConvexError("GITHUB_ALERT_READ_LIMIT");
    const result: Wire = await ctx.runQuery(
      internal.operations.githubAlerts.sample,
      { workspaceId: ctx.workspace._id, ...a },
      { transactionLimits: remaining },
    );
    const total = await ctx.meta.getTransactionMetrics();
    if (
      total.databaseQueries.used > limits.databaseQueries ||
      total.documentsRead.used > limits.documentsRead ||
      total.bytesRead.used > limits.bytesRead
    )
      throw new ConvexError("GITHUB_ALERT_READ_LIMIT");
    if (new TextEncoder().encode(JSON.stringify(result)).length > 16 * 1024)
      throw new ConvexError("GITHUB_ALERT_DTO_LIMIT");
    return result;
  },
});
export const sample = workspaceInternalQuery({
  args,
  returns: wire,
  handler: async (ctx, a): Promise<Wire> => {
    const sessionId = await scope(ctx, a),
      now = Date.now();
    if (!Number.isFinite(now))
      throw new ConvexError("GITHUB_ALERT_CLOCK_INVALID");
    let validUntil = now + 30000;
    const rows: Wire["data"]["rows"] = [];
    for (const state of ["missing", "unknown", "requesting"] as const) {
      const parents = await ctx.db
        .query("githubRecoveries")
        .withIndex("by_workspaceId_and_state_and_leaseUntil", (q) => {
          const branch = q
            .eq("workspaceId", ctx.workspace._id)
            .eq("state", state);
          return state === "requesting"
            ? branch.lte("leaseUntil", now)
            : branch;
        })
        .order("desc")
        .take(2);
      for (const r of parents) {
        if (
          ![
            r.generation,
            r.leaseUntil,
            r.notBefore,
            r.updatedAt,
            r.deliveredAt,
          ].every(Number.isFinite)
        )
          throw new ConvexError("GITHUB_ALERT_CLOCK_INVALID");
        let source;
        try {
          source = await checkRecoverySource(ctx, r, r.generation);
        } catch (error) {
          rethrowUnexpectedSourceError(error);
          continue;
        }
        if (
          ![source.proofExpiresAt, source.verifiedAt, source.purposeAt].every(
            Number.isFinite,
          ) ||
          source.proofExpiresAt <= now
        )
          throw new ConvexError("GITHUB_ALERT_CLOCK_INVALID");
        if ((await localEvidence(ctx, r.workspaceId, r.guid)).signal) continue;
        validUntil = Math.min(validUntil, source.proofExpiresAt);
        rows.push({ id: r._id });
      }
    }
    return {
      authId: ctx.user.authId,
      sessionId,
      workspaceId: ctx.workspace._id,
      refreshKey: a.refreshKey,
      data: {
        observedAt: now,
        validUntil,
        coverage: { partial: true, parentLimit: 6, remainder: "unknown" },
        rows,
      },
    };
  },
});
