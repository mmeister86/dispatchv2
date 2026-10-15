import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  workspaceQuery,
  workspaceInternalQuery,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { retainedSnapshotHorizon } from "../performance/snapshots";
import { describe, type BaselinePost } from "../performance/baselines";
import { definitions, normalize } from "../performance/normalize";
import { sha256 } from "../lib/crypto";
const args = {
  accountId: v.id("socialAccounts"),
  expectedAuthId: v.string(),
  refreshKey: v.string(),
};
const nullable = v.union(v.number(), v.null());
const wire = v.object({
  authId: v.string(),
  sessionId: v.string(),
  refreshKey: v.string(),
  data: v.object({
    observedAt: v.number(),
    accountId: v.id("socialAccounts"),
    windowHours: v.literal(24),
    until: nullable,
    coverage: v.object({
      partial: v.literal(true),
      candidateLimit: v.literal(5),
      subset: v.literal("original_single_text_post"),
      remainder: v.literal("unknown"),
    }),
    cohorts: v.array(
      v.object({
        key: v.string(),
        dialect: v.union(
          v.literal("tweet-fields-retweet-v2"),
          v.literal("post-fields-repost-v2"),
        ),
        unit: v.literal("post"),
        media: v.literal("none"),
        windowHours: v.literal(24),
        until: v.number(),
        impressions: v.object({ n: v.number(), sum: nullable, mean: nullable }),
      }),
    ),
  }),
});
type Wire = Infer<typeof wire>;
const input = v.object(args);
const limits = {
  databaseQueries: 256,
  documentsRead: 256,
  bytesRead: 512 * 1024,
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
    !a.refreshKey ||
    a.refreshKey.length > 64 ||
    !a.expectedAuthId ||
    a.expectedAuthId.length > 256
  )
    throw new ConvexError("PILOT_REQUEST_INVALID");
  if (
    a.expectedAuthId !== ctx.user.authId ||
    ctx.user.activeWorkspaceId !== ctx.workspace._id
  )
    throw new ConvexError("PILOT_SCOPE_CHANGED");
  requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
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
      throw new ConvexError("PILOT_READ_LIMIT");
    const result: Wire = await ctx.runQuery(
      internal.operations.pilot.sample,
      { workspaceId: ctx.workspace._id, ...a },
      { transactionLimits: remaining },
    );
    const total = await ctx.meta.getTransactionMetrics();
    if (
      total.databaseQueries.used > limits.databaseQueries ||
      total.documentsRead.used > limits.documentsRead ||
      total.bytesRead.used > limits.bytesRead
    )
      throw new ConvexError("PILOT_READ_LIMIT");
    if (new TextEncoder().encode(JSON.stringify(result)).length > 32 * 1024)
      throw new ConvexError("PILOT_DTO_LIMIT");
    return result;
  },
});
export const sample = workspaceInternalQuery({
  args,
  returns: wire,
  handler: async (ctx, a): Promise<Wire> => {
    const sessionId = await scope(ctx, a),
      now = Date.now(),
      posts: BaselinePost[] = [];
    const candidates = await ctx.db
      .query("xPostAttempts")
      .withIndex(
        "by_workspaceId_and_accountId_and_stage_and_confirmedAt",
        (q) =>
          q
            .eq("workspaceId", ctx.workspace._id)
            .eq("accountId", a.accountId)
            .eq("stage", "confirmed"),
      )
      .order("desc")
      .take(5);
    for (const c of candidates) {
      if (c.position !== 0) continue;
      const s = await ctx.db.get(c.scheduleId),
        version = await ctx.db.get(c.versionId);
      if (
        !s ||
        !version ||
        s.purpose === "first_write_verification" ||
        s.workspaceId !== ctx.workspace._id ||
        s.accountId !== a.accountId ||
        s.versionId !== c.versionId ||
        version.workspaceId !== ctx.workspace._id ||
        version.draftId !== s.draftId ||
        version.content.accountId !== a.accountId ||
        version.content.text.length !== 1 ||
        version.content.media.length !== 0
      )
        continue;
      const physical = s.externalPosts;
      if (
        !physical ||
        physical.length !== 1 ||
        physical[0].position !== 0 ||
        physical[0].attemptId !== c._id ||
        physical[0].externalId !== c.externalId ||
        physical[0].confirmedAt !== c.confirmedAt ||
        s.generation !== c.generation ||
        s.accountConnectionSequence !== c.connectionSequence
      )
        throw new ConvexError("PILOT_SOURCE_UNAVAILABLE");
      const r = await ctx.db
        .query("performanceSnapshots")
        .withIndex("by_postAttemptId_and_windowHours", (q) =>
          q.eq("postAttemptId", c._id).eq("windowHours", 24),
        )
        .unique();
      if (!r) continue;
      if (
        (r.observedAt !== null && !Number.isFinite(r.observedAt)) ||
        (r.providerCreatedAt !== null &&
          !Number.isFinite(r.providerCreatedAt)) ||
        r.position !== 0 ||
        r.position !== c.position ||
        r.confirmedAt !== c.confirmedAt ||
        !Number.isFinite(c.confirmedAt) ||
        c.confirmedAt! <= 0 ||
        r.workspaceId !== ctx.workspace._id ||
        r.accountId !== a.accountId ||
        r.versionId !== version._id ||
        r.scheduleId !== s._id ||
        r.externalId !== c.externalId ||
        r.fields.length > 8 ||
        new Set(r.fields.map((f) => f.name)).size !== r.fields.length
      )
        throw new ConvexError("PILOT_SOURCE_UNAVAILABLE");
      const until = await retainedSnapshotHorizon(ctx, r);
      const t = r.attemptId ? await ctx.db.get(r.attemptId) : null;
      const p =
        t?.owner === "own-metrics" ? await ctx.db.get(t.policyId) : null;
      const impressions = r.fields.filter((f) => f.name === "impressions");
      if (
        !p ||
        p.fields.some((name) => !Object.hasOwn(definitions, name)) ||
        p.fields.length > 8 ||
        new Set(p.fields).size !== p.fields.length ||
        !p.fields.includes("impressions") ||
        impressions.length !== 1 ||
        impressions[0].rawField !== "public_metrics.impression_count" ||
        impressions[0].definition !== definitions.impressions ||
        !Number.isFinite(until) ||
        until <= now ||
        (r.dialect !== "tweet-fields-retweet-v2" &&
          r.dialect !== "post-fields-repost-v2")
      )
        throw new ConvexError("PILOT_SOURCE_UNAVAILABLE");
      const canonical = normalize(
        undefined,
        r.externalId,
        p.providerIdentity,
        p.fields,
        r.dialect,
      ).fields;
      if (
        r.fields.length !== canonical.length ||
        r.fields.some(
          (f) =>
            !canonical.some(
              (expected) =>
                expected.name === f.name &&
                expected.rawField === f.rawField &&
                expected.definition === f.definition,
            ),
        )
      )
        throw new ConvexError("PILOT_SOURCE_UNAVAILABLE");
      posts.push({
        scheduleId: s._id,
        versionId: version._id,
        externalId: r.externalId,
        position: 0,
        coverage: { confirmed: physical.length, total: physical.length },
        mediaType: "none",
        topic: null,
        topicUntil: Infinity,
        timezone: null,
        snapshots: [{ ...r, expiresAt: until }],
      });
    }
    const cohorts: Wire["data"]["cohorts"] = [];
    for (const c of describe(posts, now, a.accountId).cohorts) {
      const metric = c.metrics.find((m) => m.name === "impressions")!;
      if (
        c.dialect !== "tweet-fields-retweet-v2" &&
        c.dialect !== "post-fields-repost-v2"
      )
        throw new ConvexError("PILOT_SOURCE_UNAVAILABLE");
      cohorts.push({
        key: await sha256(c.key),
        dialect: c.dialect,
        unit: "post",
        media: "none",
        windowHours: 24,
        until: c.until,
        impressions: { n: metric.n, sum: metric.sum, mean: metric.mean },
      });
    }
    return {
      authId: ctx.user.authId,
      sessionId,
      refreshKey: a.refreshKey,
      data: {
        observedAt: now,
        accountId: a.accountId,
        windowHours: 24,
        until: cohorts.length ? Math.min(...cohorts.map((c) => c.until)) : null,
        coverage: {
          partial: true,
          candidateLimit: 5,
          subset: "original_single_text_post",
          remainder: "unknown",
        },
        cohorts,
      },
    };
  },
});
