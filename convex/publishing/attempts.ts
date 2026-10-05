import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { preflight, failure } from "../publishing";
import { LEASE_MS } from "../media/limits";
import { job, outcome, attemptDoc, POST_BUDGET_MS } from "./postFields";

const claimArgs = {
  attemptId: v.id("xPostAttempts"),
  claimSequence: v.number(),
};
async function current(ctx: MutationCtx, c: Doc<"xPostAttempts">) {
  const s = await ctx.db.get(c.scheduleId);
  if (
    !s ||
    s.workspaceId !== c.workspaceId ||
    s.generation !== c.generation ||
    s.state !== "publishing" ||
    s.versionId !== c.versionId ||
    s.accountId !== c.accountId
  )
    throw new ConvexError("X_SCHEDULE_CHANGED");
  const ver = await preflight(ctx, s),
    account = await ctx.db.get(s.accountId);
  if (
    !account ||
    account.provider !== "X" ||
    account.providerIdentity !== c.providerIdentity ||
    (account.xEvidence?.connectionSequence ?? 0) !== c.connectionSequence ||
    c.position >= ver.content.text.length
  )
    throw new ConvexError("ACCOUNT_CONNECTION_CHANGED");
  return { s, ver, account };
}
export const claim = internalMutation({
  args: job,
  returns: v.union(attemptDoc, v.null()),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.scheduleId);
    if (
      !s ||
      s.generation !== a.generation ||
      s.state !== "publishing" ||
      s.abortRequestedAt !== undefined
    )
      return null;
    const history = await ctx.db
      .query("xPostAttempts")
      .withIndex("by_scheduleId_and_generation_and_position", (q) =>
        q.eq("scheduleId", s._id),
      )
      .take(101);
    if (
      history.length > 100 ||
      history.some(
        (c) =>
          c.generation !== s.generation &&
          ["unknown", "sending"].includes(c.stage),
      )
    ) {
      await failure(ctx, s, "X_RECONCILIATION_REQUIRED");
      await ctx.db.patch(s._id, { state: "reconciliation_required" });
      return null;
    }
    const rows = history.filter((c) => c.generation === s.generation);
    const posts = s.externalPosts ?? [];
    if (
      posts.some(
        (p, i) =>
          p.position !== i ||
          !history.some(
            (c) =>
              c._id === p.attemptId &&
              c.position === p.position &&
              c.stage === "confirmed" &&
              c.externalId === p.externalId &&
              c.versionId === s.versionId &&
              c.accountId === s.accountId,
          ),
      )
    ) {
      await failure(ctx, s, "X_POST_CHECKPOINT_CONFLICT");
      return null;
    }
    const position = posts.length;
    let c = rows.find((c) => c.position === position);
    if (c && ["unknown", "rejected"].includes(c.stage)) return null;
    if (c?.leaseUntil && c.leaseUntil > Date.now()) return null;
    if (c?.stage === "sending") {
      await ctx.db.patch(c._id, {
        stage: "unknown",
        leaseUntil: 0,
        errorCode: "X_POST_OUTCOME_UNKNOWN",
        updatedAt: Date.now(),
      });
      await failure(ctx, s, "X_POST_OUTCOME_UNKNOWN");
      await ctx.db.patch(s._id, { state: "reconciliation_required" });
      return null;
    }
    try {
      const ver = await preflight(ctx, s),
        account = await ctx.db.get(s.accountId);
      if (
        history.some(
          (c) =>
            c.workspaceId !== s.workspaceId ||
            c.versionId !== s.versionId ||
            c.accountId !== s.accountId ||
            c.providerIdentity !== account?.providerIdentity,
        )
      )
        throw new ConvexError("ACCOUNT_CONNECTION_CHANGED");
      if (!account || account.provider !== "X")
        throw new ConvexError("PUBLISHER_NOT_CONFIGURED");
      if (position >= ver.content.text.length) {
        await ctx.db.patch(s._id, { state: "published", errorCode: null });
        return null;
      }
      if ((c?.deadline ?? rows[0]?.deadline ?? Infinity) <= Date.now())
        throw new ConvexError("X_POST_BUDGET_EXHAUSTED");
      if (!c) {
        const parent = position
          ? posts.find((p) => p.position === position - 1)?.externalId
          : undefined;
        if (position && !parent)
          throw new ConvexError("X_REPLY_PARENT_REQUIRED");
        const id = await ctx.db.insert("xPostAttempts", {
          ...a,
          workspaceId: s.workspaceId,
          versionId: ver._id,
          accountId: s.accountId,
          providerIdentity: account.providerIdentity,
          connectionSequence: account.xEvidence?.connectionSequence ?? 0,
          position,
          attempt: 1,
          claimSequence: 0,
          stage: "preparing",
          leaseUntil: 0,
          deadline: Math.min(
            rows[0]?.deadline ?? Date.now() + POST_BUDGET_MS,
            s.intentExpiresAt ?? Infinity,
          ),
          mediaIds: [],
          ...(parent ? { parentId: parent } : {}),
          durationMs: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        c = (await ctx.db.get(id))!;
      }
      await current(ctx, c);
      const claimed = {
        ...c,
        claimSequence: c.claimSequence + 1,
        leaseUntil: Date.now() + LEASE_MS,
      };
      await ctx.db.patch(c._id, {
        claimSequence: claimed.claimSequence,
        leaseUntil: claimed.leaseUntil,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        LEASE_MS,
        internal.publishing.workflows.step,
        a,
      );
      return claimed;
    } catch (e) {
      await failure(
        ctx,
        s,
        e instanceof ConvexError ? String(e.data) : "PREFLIGHT_FAILED",
      );
      return null;
    }
  },
});
export const readiness = internalMutation({
  args: claimArgs,
  returns: v.union(v.array(v.string()), v.null()),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.attemptId);
    if (
      !c ||
      c.claimSequence !== a.claimSequence ||
      c.stage !== "preparing" ||
      c.leaseUntil <= Date.now()
    )
      return null;
    const { ver } = await current(ctx, c);
    if (c.position) return [];
    const ids: string[] = [];
    for (
      let mediaPosition = 0;
      mediaPosition < ver.content.media.length;
      mediaPosition++
    ) {
      const args = {
        scheduleId: c.scheduleId,
        generation: c.generation,
        mediaPosition,
      };
      const ready = await ctx.runMutation(
        internal.publishing.media.ready,
        args,
      );
      if (ready) {
        ids.push(ready.mediaId);
        continue;
      }
      const latest = await ctx.db
        .query("xMediaCheckpoints")
        .withIndex("by_scheduleId_and_generation_and_mediaPosition", (q) =>
          q
            .eq("scheduleId", c.scheduleId)
            .eq("generation", c.generation)
            .eq("mediaPosition", mediaPosition),
        )
        .order("desc")
        .first();
      if (latest && ["failed", "uncertain", "blocked"].includes(latest.phase))
        throw new ConvexError(latest.errorCode ?? "X_MEDIA_PREPARATION_FAILED");
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.x.publish.prepare,
        args,
      );
      await ctx.db.patch(c._id, { leaseUntil: 0, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(
        Math.min(10000, Math.max(1000, c.deadline - Date.now())),
        internal.publishing.workflows.step,
        { scheduleId: c.scheduleId, generation: c.generation },
      );
      return null;
    }
    return ids;
  },
});
export const beforeSend = internalMutation({
  args: {
    ...claimArgs,
    credentialGeneration: v.number(),
    mediaIds: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.attemptId);
    if (
      !c ||
      c.claimSequence !== a.claimSequence ||
      c.stage !== "preparing" ||
      c.leaseUntil <= Date.now()
    )
      return false;
    if (c.deadline <= Date.now())
      throw new ConvexError("X_POST_BUDGET_EXHAUSTED");
    const { ver } = await current(ctx, c);
    const credential = await ctx.runQuery(
      internal.integrations.x.oauth.scheduleSource,
      { scheduleId: c.scheduleId, generation: c.generation, operation: "text" },
    );
    if (credential.generation !== a.credentialGeneration)
      throw new ConvexError("X_CONNECTION_CHANGED");
    const expected: string[] = [],
      mediaKeys: (string | null)[] = [];
    if (c.position === 0)
      for (
        let mediaPosition = 0;
        mediaPosition < ver.content.media.length;
        mediaPosition++
      ) {
        const ready = await ctx.runMutation(internal.publishing.media.ready, {
          scheduleId: c.scheduleId,
          generation: c.generation,
          mediaPosition,
        });
        if (!ready) throw new ConvexError("X_MEDIA_EXPIRED_OR_CLAIM_CHANGED");
        expected.push(ready.mediaId);
        mediaKeys.push(ready.mediaKey ?? null);
      }
    if (JSON.stringify(expected) !== JSON.stringify(a.mediaIds))
      throw new ConvexError("X_MEDIA_ATTACHMENT_CHANGED");
    await ctx.db.patch(c._id, {
      stage: "sending",
      credentialGeneration: credential.generation,
      mediaIds: expected,
      mediaKeys,
      requestStartedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  },
});
export const receipt = internalMutation({
  args: {
    ...claimArgs,
    outcome,
    externalId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    rateResetAt: v.optional(v.number()),
    durationMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.attemptId);
    if (
      !c ||
      c.claimSequence !== a.claimSequence ||
      c.stage === "confirmed" ||
      c.stage === "rejected"
    )
      return null;
    if (
      a.outcome === "confirmed" &&
      c.stage !== "sending" &&
      c.stage !== "unknown"
    )
      return null;
    if (
      a.outcome === "confirmed" &&
      (!a.externalId || !/^[0-9]{1,19}$/.test(a.externalId))
    )
      throw new ConvexError("X_POST_RESPONSE_INVALID");
    const s = await ctx.db.get(c.scheduleId),
      now = Date.now();
    let allowed = false,
      account: Doc<"socialAccounts"> | undefined;
    try {
      const src = await current(ctx, c);
      account = src.account;
      allowed = true;
    } catch {
      /* Record actual external evidence after cancellation or lifecycle loss. */
    }
    await ctx.db.patch(c._id, {
      stage: a.outcome,
      leaseUntil: 0,
      ...(a.externalId ? { externalId: a.externalId, confirmedAt: now } : {}),
      ...(a.errorCode ? { errorCode: a.errorCode } : {}),
      ...(a.httpStatus ? { httpStatus: a.httpStatus } : {}),
      ...(a.rateResetAt ? { rateResetAt: a.rateResetAt } : {}),
      durationMs: c.durationMs + a.durationMs,
      updatedAt: now,
    });
    if (!s) return null; // Deletion must retain a schedule/attempt tombstone until outstanding effects are reconciled.
    const credential = await ctx.db
      .query("xCredentials")
      .withIndex("by_accountId", (q) => q.eq("accountId", c.accountId))
      .unique();
    if (a.outcome === "confirmed") {
      const posts = [...(s.externalPosts ?? [])];
      if (
        posts.some(
          (p) => p.position === c.position && p.externalId !== a.externalId,
        )
      )
        throw new ConvexError("X_POST_CHECKPOINT_CONFLICT");
      if (!posts.some((p) => p.position === c.position))
        posts.push({
          position: c.position,
          externalId: a.externalId!,
          url: `https://x.com/i/web/status/${a.externalId}`,
          attemptId: c._id,
          confirmedAt: now,
        });
      posts.sort((x, y) => x.position - y.position);
      await ctx.db.patch(s._id, {
        externalPosts: posts,
        publishedCount: posts.length,
      });
      // Only an actual credentialed POST acknowledgement proves write access. A later read-only match cannot.
      if (
        allowed &&
        account?.xEvidence &&
        credential &&
        credential.generation === c.credentialGeneration &&
        ["tweet.write", "tweet.read", "users.read"].every((scope) =>
          credential.scopes.includes(scope),
        )
      )
        await ctx.db.patch(account._id, {
          capability: { ...account.capability, publish: true },
          xEvidence: {
            ...account.xEvidence,
            liveWrite: "verified",
            errorCode: undefined,
            writeProof: {
              externalId: a.externalId!,
              attemptId: c._id,
              confirmedAt: now,
              connectionSequence: c.connectionSequence,
            },
          },
        });
      if (allowed) {
        const ver = (await ctx.db.get(c.versionId))!;
        if (posts.length === ver.content.text.length)
          await ctx.db.patch(s._id, { state: "published", errorCode: null });
        else
          await ctx.scheduler.runAfter(0, internal.publishing.workflows.step, {
            scheduleId: c.scheduleId,
            generation: c.generation,
          });
      } else if (s.generation === c.generation && s.state === "publishing") {
        await failure(
          ctx,
          { ...s, publishedCount: posts.length },
          "X_SCHEDULE_CHANGED",
        );
      }
    } else if (s.generation === c.generation && s.state === "publishing") {
      if (
        allowed &&
        account?.xEvidence &&
        credential?.generation === c.credentialGeneration &&
        a.outcome === "rejected" &&
        [401, 403].includes(a.httpStatus ?? 0)
      ) {
        await ctx.db.patch(account._id, {
          ...(a.httpStatus === 401
            ? { connection: "reauth_required" as const }
            : {}),
          capability: { ...account.capability, publish: false },
          xEvidence: {
            ...account.xEvidence,
            liveWrite: "blocked",
            errorCode: "X_REAUTH_OR_CAPABILITY_REQUIRED",
          },
        });
      }
      await failure(ctx, s, a.errorCode ?? "X_POST_OUTCOME_UNKNOWN");
      if (a.outcome === "unknown" || a.errorCode?.includes("OUTCOME_UNKNOWN"))
        await ctx.db.patch(s._id, { state: "reconciliation_required" });
    }
    return null;
  },
});
