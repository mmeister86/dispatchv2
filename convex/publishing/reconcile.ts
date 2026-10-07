import { currentReview, currentReviewActor } from "../editorial/reviews";
import { enqueue as enqueueMetrics } from "../performance/snapshots";
import twitterText from "twitter-text";
import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  requireWorkspace,
  requireReference,
  requireRole,
  workspaceMutation,
  workspaceQuery,
} from "../lib/authorization";
import {
  firstWriteContent,
  checkImmutableMediaSource,
  validateContent,
  checkApproval,
  event,
} from "../editorial";
import { credentialDoc } from "../integrations/x/fields";
import { attemptDoc, FIRST_WRITE_MS } from "./postFields";

const target = {
  scheduleId: v.id("schedules"),
  expectedGeneration: v.number(),
};
const readArgs = {
  workspaceId: v.id("workspaces"),
  ...target,
  position: v.number(),
  candidateId: v.string(),
};
const result = v.union(v.literal("confirmed"), v.literal("unknown"));
const MAX_READS = 3,
  READ_BUDGET_MS = 15 * 60000;
type ReadSource = {
  attempt: Doc<"xPostAttempts">;
  credential: Doc<"xCredentials">;
  text: string;
  connectionSequence: number;
};
async function context(
  ctx: QueryCtx,
  a: {
    workspaceId: Id<"workspaces">;
    scheduleId: Id<"schedules">;
    expectedGeneration: number;
  },
) {
  const auth = await requireWorkspace(ctx, a.workspaceId);
  requireRole(auth.membership, ["Owner", "Admin"]);
  if (auth.user.activeWorkspaceId !== a.workspaceId)
    throw new ConvexError("X_WORKSPACE_CHANGED");
  const s = requireReference(
    a.workspaceId,
    await ctx.db.get(a.scheduleId),
  ) as Doc<"schedules">;
  if (s.generation !== a.expectedGeneration)
    throw new ConvexError("SCHEDULE_CONFLICT");
  const ver = requireReference(
    a.workspaceId,
    await ctx.db.get(s.versionId),
  ) as Doc<"draftVersions">;
  const account = requireReference(
    a.workspaceId,
    await ctx.db.get(s.accountId),
  ) as Doc<"socialAccounts">;
  if (
    ver.draftId !== s.draftId ||
    ver.content.accountId !== s.accountId ||
    account.provider !== "X"
  )
    throw new ConvexError("X_SCHEDULE_CHANGED");
  const rows = await ctx.db
    .query("xPostAttempts")
    .withIndex("by_scheduleId_and_generation_and_position", (q) =>
      q.eq("scheduleId", s._id),
    )
    .take(101);
  if (rows.length > 100) throw new ConvexError("X_POST_ATTEMPT_LIMIT");
  if (
    rows.some(
      (c) =>
        c.workspaceId !== s.workspaceId ||
        c.accountId !== s.accountId ||
        c.versionId !== ver._id ||
        c.providerIdentity !== account.providerIdentity,
    )
  )
    throw new ConvexError("ACCOUNT_CONNECTION_CHANGED");
  const posts = s.externalPosts ?? [];
  if (
    s.publishedCount !== posts.length ||
    posts.length > ver.content.text.length ||
    rows.some(
      (c) =>
        !Number.isInteger(c.position) ||
        c.position < 0 ||
        c.position >= ver.content.text.length,
    ) ||
    posts.some(
      (p, i) =>
        p.position !== i ||
        !rows.some(
          (c) =>
            c._id === p.attemptId &&
            c.position === p.position &&
            c.stage === "confirmed" &&
            c.externalId === p.externalId &&
            c.parentId === (i ? posts[i - 1].externalId : undefined),
        ),
    )
  )
    throw new ConvexError("X_POST_CHECKPOINT_CONFLICT");
  return { ...auth, s, ver, account, rows };
}
function hasUnresolvedEffects(rows: Doc<"xPostAttempts">[]) {
  return rows.some(
    (c) =>
      ["unknown", "sending"].includes(c.stage) ||
      (c.stage !== "confirmed" && c.errorCode?.includes("OUTCOME_UNKNOWN")),
  );
}
// Derive stopped outcomes from complete guarded history; this never schedules writes or proves capability.
function stoppedState(
  s: Doc<"schedules">,
  ver: Doc<"draftVersions">,
  rows: Doc<"xPostAttempts">[],
): Doc<"schedules">["state"] {
  const posts = s.externalPosts ?? [];
  if (
    rows.some(
      (c) =>
        c.stage === "confirmed" &&
        !posts.some(
          (p) =>
            p.attemptId === c._id &&
            p.position === c.position &&
            p.externalId === c.externalId,
        ),
    )
  )
    throw new ConvexError("X_POST_CHECKPOINT_CONFLICT");
  // Legacy terminal tombstones are authority even when optional abort audit fields are absent.
  if (s.state === "cancelled" || s.state === "published") return s.state;
  if (hasUnresolvedEffects(rows)) return "reconciliation_required";
  if (s.abortRequestedAt !== undefined) return "cancelled";
  if (posts.length === ver.content.text.length) return "published";
  return posts.length ? "partially_published" : "failed";
}
async function recordStoppedState(
  ctx: MutationCtx,
  s: Doc<"schedules">,
  ver: Doc<"draftVersions">,
  rows: Doc<"xPostAttempts">[],
  actorId: Id<"users">,
) {
  const state = stoppedState(s, ver, rows);
  if (state !== s.state) {
    await ctx.db.patch(s._id, {
      state,
      errorCode: hasUnresolvedEffects(rows) ? s.errorCode : null,
    });
    await event(
      ctx,
      s.workspaceId,
      s.draftId,
      state === "cancelled" ? "X_ABORT_RECONCILED" : "X_POST_RECONCILED",
      actorId,
      s._id,
    );
  }
}
async function readable(
  ctx: QueryCtx,
  a: {
    workspaceId: Id<"workspaces">;
    scheduleId: Id<"schedules">;
    expectedGeneration: number;
  },
) {
  const source = await context(ctx, a);
  await checkImmutableMediaSource(ctx, source.ver);
  const { account, s } = source;
  const credential = await ctx.db
    .query("xCredentials")
    .withIndex("by_accountId", (q) => q.eq("accountId", account._id))
    .unique();
  const binding = await ctx.db
    .query("xBindings")
    .withIndex("by_providerIdentity", (q) =>
      q.eq("providerIdentity", account.providerIdentity),
    )
    .unique();
  if (
    account.connection !== "connected" ||
    !account.xEvidence?.connectionSequence ||
    !credential?.envelope ||
    credential.workspaceId !== s.workspaceId ||
    credential.leaseUntil ||
    credential.expiresAt <= Date.now() + 30000 ||
    binding?.accountId !== account._id ||
    binding.workspaceId !== s.workspaceId
  )
    throw new ConvexError("X_REAUTH_REQUIRED");
  if (
    !["tweet.read", "users.read"].every((scope) =>
      credential.scopes.includes(scope),
    )
  )
    throw new ConvexError("X_SCOPE_REQUIRED");
  return { ...source, credential };
}
export function candidateId(input: string) {
  if (/^[0-9]{1,19}$/.test(input)) return input;
  if (input.length > 200) throw new ConvexError("X_CANDIDATE_ID_REQUIRED");
  try {
    const u = new URL(input);
    const m = /^\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/([0-9]{1,19})$/.exec(
      u.pathname,
    );
    if (
      u.protocol === "https:" &&
      u.hostname === "x.com" &&
      !u.port &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      m
    )
      return m[1];
  } catch {
    /* The input is an ID or canonical post link, never a fetch URL. */
  }
  throw new ConvexError("X_CANDIDATE_ID_REQUIRED");
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function matchedPost(
  value: unknown,
  c: Pick<
    Doc<"xPostAttempts">,
    | "providerIdentity"
    | "parentId"
    | "mediaIds"
    | "mediaKeys"
    | "requestStartedAt"
  >,
  requested: string,
  text: string,
) {
  const response = record(value),
    d = record(response?.data);
  if (
    !d ||
    (response?.errors !== undefined &&
      (!Array.isArray(response.errors) || response.errors.length))
  )
    return false;
  if (
    d.id !== requested ||
    d.author_id !== c.providerIdentity ||
    typeof d.text !== "string" ||
    d.note_post !== undefined
  )
    return false;
  if (
    !Array.isArray(d.edit_history_post_ids) ||
    d.edit_history_post_ids.length !== 1 ||
    d.edit_history_post_ids[0] !== requested
  )
    return false;
  if (!Array.isArray(d.referenced_posts)) return false;
  if (
    c.parentId
      ? d.referenced_posts.length !== 1 ||
        record(d.referenced_posts[0])?.type !== "replied_to" ||
        record(d.referenced_posts[0])?.id !== c.parentId
      : d.referenced_posts.length !== 0
  )
    return false;
  const keys = record(d.attachments)?.media_keys;
  const actual = keys === null ? [] : keys;
  const expected = c.mediaKeys ?? (c.mediaIds.length ? null : []);
  if (
    !Array.isArray(actual) ||
    !expected ||
    expected.length !== c.mediaIds.length ||
    expected.some((k) => !k) ||
    actual.length !== expected.length ||
    new Set(actual).size !== actual.length ||
    actual.some((k) => typeof k !== "string" || !expected.includes(k))
  )
    return false;
  const at =
    typeof d.created_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      d.created_at,
    )
      ? Date.parse(d.created_at)
      : NaN;
  if (
    !c.requestStartedAt ||
    !Number.isFinite(at) ||
    at < c.requestStartedAt - 5000 ||
    at > c.requestStartedAt + 60000
  )
    return false;
  let approved = text.normalize("NFC"),
    returned = d.text.normalize("NFC");
  if (approved === returned) return true;
  // Use local parser URL tokens, never provider index units. t.co parser truncation with an adjacent suffix is unknown.
  const urls = record(d.entities)?.urls;
  if (!Array.isArray(urls) || urls.length > 20) return false;
  const originalReturned = returned;
  const approvedUrls = twitterText.extractUrlsWithIndices(approved, {
    extractUrlsWithoutProtocol: false,
  });
  const returnedUrls = twitterText.extractUrlsWithIndices(returned, {
    extractUrlsWithoutProtocol: false,
  });
  const seen = new Set<string>();
  for (const item of urls) {
    const entity = record(item),
      url = entity?.url,
      expanded = entity?.expanded_url;
    if (
      typeof url !== "string" ||
      typeof expanded !== "string" ||
      !/^https:\/\/t\.co\/[A-Za-z0-9]+$/.test(url) ||
      !/^https?:\/\//.test(expanded) ||
      seen.has(url) ||
      expanded.includes(url)
    )
      return false;
    seen.add(url);
    const tokens = returnedUrls.filter((token) => token.url === url);
    if (
      tokens.length !== 1 ||
      (tokens[0].indices[1] < originalReturned.length &&
        !/\s/u.test(originalReturned[tokens[0].indices[1]])) ||
      approvedUrls.filter((token) => token.url === expanded.normalize("NFC"))
        .length !== 1 ||
      returned.split(url).length !== 2 ||
      approved.split(expanded.normalize("NFC")).length !== 2
    )
      return false;
    returned = returned.replace(url, expanded.normalize("NFC"));
  }
  return approved === returned;
}
export const source = internalQuery({
  args: readArgs,
  returns: v.object({
    attempt: attemptDoc,
    credential: credentialDoc,
    text: v.string(),
    connectionSequence: v.number(),
  }),
  handler: async (ctx, a): Promise<ReadSource> => {
    const { s, ver, rows, account, credential } = await readable(ctx, a);
    if (
      !Number.isInteger(a.position) ||
      a.position < 0 ||
      a.position >= ver.content.text.length
    )
      throw new ConvexError("X_POSITION_INVALID");
    const attempt =
      rows.find(
        (c) =>
          c.position === a.position &&
          (c.stage === "unknown" || c.stage === "sending"),
      ) ??
      rows.find((c) => c.position === a.position && c.stage === "confirmed");
    if (
      !attempt ||
      ![
        "reconciliation_required",
        "partially_published",
        "failed",
        "cancelled",
        "published",
      ].includes(s.state)
    )
      throw new ConvexError("X_RECONCILIATION_REQUIRED");
    if (
      attempt.position &&
      attempt.parentId !==
        s.externalPosts?.find((p) => p.position === attempt.position - 1)
          ?.externalId
    )
      throw new ConvexError("X_REPLY_PARENT_REQUIRED");
    return {
      attempt,
      credential,
      text: ver.content.text[a.position],
      connectionSequence: account.xEvidence!.connectionSequence!,
    };
  },
});
export const begin = internalMutation({
  args: readArgs,
  returns: v.union(
    v.object({
      attempt: attemptDoc,
      credential: credentialDoc,
      text: v.string(),
      connectionSequence: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, a): Promise<ReadSource | null> => {
    const { s, ver, rows, user } = await context(ctx, a);
    if (
      ![
        "reconciliation_required",
        "partially_published",
        "failed",
        "cancelled",
        "published",
      ].includes(s.state)
    )
      throw new ConvexError("X_RECONCILIATION_REQUIRED");
    const known =
      rows.find(
        (c) =>
          c.position === a.position && ["unknown", "sending"].includes(c.stage),
      ) ??
      rows.find((c) => c.position === a.position && c.stage === "confirmed");
    if (known?.stage === "confirmed") {
      if (known.externalId !== a.candidateId)
        throw new ConvexError("X_POST_CHECKPOINT_CONFLICT");
      await recordStoppedState(ctx, s, ver, rows, user._id);
      return null; // Trusted stored receipt: no fresh provider read authority or capability proof.
    }
    const src = await ctx.runQuery(internal.publishing.reconcile.source, a);
    const c = src.attempt,
      now = Date.now();
    if (
      (c.stage === "sending" && c.leaseUntil > now) ||
      (c.reconcileLeaseUntil ?? 0) > now
    )
      throw new ConvexError("X_RECONCILIATION_IN_PROGRESS");
    if ((c.reconcileNotBefore ?? 0) > now)
      throw new ConvexError("X_RECONCILIATION_BACKOFF");
    const freshWindow =
      c.reconcileDeadline !== undefined && c.reconcileDeadline <= now;
    if (!freshWindow && (c.reconcileReads ?? 0) >= MAX_READS)
      throw new ConvexError("X_RECONCILIATION_BUDGET_EXHAUSTED");
    const attempt = {
      ...c,
      stage: "unknown" as const,
      leaseUntil: 0,
      reconcileSequence: (c.reconcileSequence ?? 0) + 1,
      reconcileReads: (freshWindow ? 0 : (c.reconcileReads ?? 0)) + 1,
      reconcileLeaseUntil: now + 20000,
      reconcileDeadline: freshWindow
        ? now + READ_BUDGET_MS
        : (c.reconcileDeadline ?? now + READ_BUDGET_MS),
    };
    await ctx.db.patch(c._id, {
      stage: attempt.stage,
      leaseUntil: 0,
      reconcileSequence: attempt.reconcileSequence,
      reconcileReads: attempt.reconcileReads,
      reconcileLeaseUntil: attempt.reconcileLeaseUntil,
      reconcileDeadline: attempt.reconcileDeadline,
    });
    return { ...src, attempt };
  },
});
export const evidence = internalMutation({
  args: {
    ...readArgs,
    attemptId: v.id("xPostAttempts"),
    reconcileSequence: v.number(),
    credentialGeneration: v.number(),
    connectionSequence: v.number(),
    verified: v.boolean(),
    errorCode: v.optional(v.string()),
    notBefore: v.optional(v.number()),
    durationMs: v.number(),
  },
  returns: result,
  handler: async (ctx, a): Promise<"confirmed" | "unknown"> => {
    const src = await ctx.runQuery(internal.publishing.reconcile.source, {
        workspaceId: a.workspaceId,
        scheduleId: a.scheduleId,
        expectedGeneration: a.expectedGeneration,
        position: a.position,
        candidateId: a.candidateId,
      }),
      c = src.attempt;
    if (
      c._id !== a.attemptId ||
      src.credential.generation !== a.credentialGeneration ||
      src.connectionSequence !== a.connectionSequence ||
      c.reconcileSequence !== a.reconcileSequence
    )
      throw new ConvexError("X_RECONCILIATION_CHANGED");
    if (c.stage === "confirmed") {
      if (c.externalId !== a.candidateId)
        throw new ConvexError("X_POST_CHECKPOINT_CONFLICT");
      const { s, ver, rows, user } = await context(ctx, a);
      await recordStoppedState(ctx, s, ver, rows, user._id);
      return "confirmed";
    }
    if ((c.reconcileLeaseUntil ?? 0) <= Date.now())
      throw new ConvexError("X_RECONCILIATION_CHANGED");
    const { s, ver, rows, user } = await context(ctx, a);
    const posts = [...(s.externalPosts ?? [])];
    if (
      a.verified &&
      posts.some(
        (p) => p.position === c.position && p.externalId !== a.candidateId,
      )
    )
      throw new ConvexError("X_POST_CHECKPOINT_CONFLICT");
    await ctx.db.patch(c._id, {
      stage: a.verified ? "confirmed" : "unknown",
      reconcileLeaseUntil: 0,
      reconcileNotBefore: a.notBefore,
      errorCode: a.verified
        ? undefined
        : (a.errorCode ?? "X_RECONCILIATION_INCOMPLETE"),
      durationMs: c.durationMs + a.durationMs,
      ...(a.verified
        ? {
            externalId: a.candidateId,
            confirmedAt: Date.now(),
            reconciledAt: Date.now(),
            reconciledBy: user._id,
          }
        : {}),
    });
    if (!a.verified) return "unknown";
    if (!posts.some((p) => p.position === c.position))
      posts.push({
        position: c.position,
        externalId: a.candidateId,
        url: `https://x.com/i/web/status/${a.candidateId}`,
        attemptId: c._id,
        confirmedAt: Date.now(),
      });
    posts.sort((a, b) => a.position - b.position);
    const state = stoppedState(
      { ...s, externalPosts: posts, publishedCount: posts.length },
      ver,
      rows.map((r) =>
        r._id === c._id
          ? { ...r, stage: "confirmed", externalId: a.candidateId }
          : r,
      ),
    );
    await enqueueMetrics(ctx, {
      ...c,
      stage: "confirmed",
      externalId: a.candidateId,
      confirmedAt: posts.find((p) => p.attemptId === c._id)!.confirmedAt,
    });
    await ctx.db.patch(s._id, {
      externalPosts: posts,
      publishedCount: posts.length,
      state,
      errorCode: hasUnresolvedEffects(rows.filter((r) => r._id !== c._id))
        ? s.errorCode
        : null,
    });
    await event(
      ctx,
      s.workspaceId,
      s.draftId,
      "X_POST_RECONCILED",
      user._id,
      s._id,
    );
    return "confirmed"; // No scheduling and no capability proof from a read.
  },
});
export const lookup = action({
  args: readArgs,
  returns: result,
  handler: async (ctx, args): Promise<"confirmed" | "unknown"> => {
    const a = { ...args, candidateId: candidateId(args.candidateId) },
      src = await ctx.runMutation(internal.publishing.reconcile.begin, a);
    if (!src) return "confirmed";
    const token = await ctx.runAction(
      internal.integrations.x.client.credentialForReconciliation,
      { ...a, reconcileSequence: src.attempt.reconcileSequence! },
    );
    const current = await ctx.runQuery(internal.publishing.reconcile.source, a);
    if (
      current.credential.generation !== src.credential.generation ||
      current.connectionSequence !== src.connectionSequence ||
      current.attempt._id !== src.attempt._id ||
      current.attempt.stage !== "unknown" ||
      current.attempt.reconcileSequence !== src.attempt.reconcileSequence ||
      (current.attempt.reconcileLeaseUntil ?? 0) <= Date.now()
    )
      throw new ConvexError("X_CONNECTION_CHANGED");
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000),
      started = Date.now();
    let verified = false,
      errorCode = "X_RECONCILIATION_INCOMPLETE",
      notBefore: number | undefined;
    try {
      const url = new URL(`https://api.x.com/2/tweets/${a.candidateId}`);
      url.searchParams.set(
        "post.fields",
        "id,text,created_at,attachments,entities,note_post",
      );
      url.searchParams.set(
        "expansions",
        "author_id,referenced_posts,edit_history_post_ids,attachments.media_keys",
      );
      const r = await fetch(url.href, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      if (!r.ok) {
        await r.body?.cancel();
        errorCode = [401, 403].includes(r.status)
          ? "X_REAUTH_REQUIRED"
          : r.status === 404
            ? "X_RECONCILIATION_UNAVAILABLE"
            : "X_RECONCILIATION_INCOMPLETE";
        if (r.status === 429 || r.status >= 500) {
          const reset = r.headers.get("x-rate-limit-reset"),
            retry = r.headers.get("retry-after");
          const hint = Math.max(
            reset && /^\d{1,12}$/.test(reset) ? Number(reset) * 1000 : 0,
            retry && /^\d{1,7}$/.test(retry)
              ? Date.now() + Number(retry) * 1000
              : retry
                ? Date.parse(retry) || 0
                : 0,
          );
          notBefore = Math.max(
            Date.now() + 1000 * 2 ** src.attempt.reconcileReads!,
            hint,
          );
          errorCode = "X_RECONCILIATION_BACKOFF";
        }
      } else {
        const reader = r.body?.getReader();
        if (!reader) throw new Error("empty");
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 32768) {
            await reader.cancel();
            throw new Error("oversize");
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        verified = matchedPost(
          JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
          src.attempt,
          a.candidateId,
          src.text,
        );
      }
    } catch {
      errorCode = "X_RECONCILIATION_READ_UNKNOWN";
      notBefore = Date.now() + 2000;
    } finally {
      clearTimeout(timer);
    }
    return ctx.runMutation(internal.publishing.reconcile.evidence, {
      ...a,
      attemptId: src.attempt._id,
      reconcileSequence: src.attempt.reconcileSequence!,
      credentialGeneration: src.credential.generation,
      connectionSequence: src.connectionSequence,
      verified,
      ...(!verified ? { errorCode } : {}),
      ...(notBefore ? { notBefore } : {}),
      durationMs: Date.now() - started,
    });
  },
});
export const continueThread = workspaceMutation({
  args: target,
  returns: v.null(),
  handler: async (ctx, a) => {
    const { s, ver, account, rows, user } = await readable(ctx, {
      ...a,
      workspaceId: ctx.workspace._id,
    });
    if (s.abortRequestedAt !== undefined)
      throw new ConvexError("SCHEDULE_ABORT_REQUESTED");
    if (
      !["partially_published", "failed", "reconciliation_required"].includes(
        s.state,
      ) ||
      !["partially_published", "failed"].includes(stoppedState(s, ver, rows))
    )
      throw new ConvexError("X_RECONCILIATION_REQUIRED");
    const posts = s.externalPosts ?? [];
    if (
      posts.length >= ver.content.text.length ||
      posts.some(
        (p, i) =>
          p.position !== i ||
          !rows.some(
            (c) =>
              c._id === p.attemptId &&
              c.stage === "confirmed" &&
              c.externalId === p.externalId,
          ),
      )
    )
      throw new ConvexError("X_POST_CHECKPOINT_CONFLICT");
    const rejected = rows.filter((c) => c.position >= posts.length);
    if (
      rejected.some(
        (c) =>
          c.stage === "confirmed" || c.errorCode?.includes("OUTCOME_UNKNOWN"),
      )
    )
      throw new ConvexError("X_RECONCILIATION_REQUIRED");
    if (rejected.some((c) => [400, 422].includes(c.httpStatus ?? 0)))
      throw new ConvexError("X_POST_PERMANENT_REJECTION");
    if (rejected.some((c) => (c.rateResetAt ?? 0) > Date.now()))
      throw new ConvexError("X_POST_RATE_LIMITED");
    const purpose =
      !account.capability.publish || s.purpose === "first_write_verification"
        ? "first_write_verification"
        : "publishing";
    if (purpose === "first_write_verification")
      await firstWriteContent(ctx, s.workspaceId, ver);
    else await validateContent(ctx, s.workspaceId, ver.content, true);
    await currentReviewActor(ctx, s.workspaceId, user._id);
    const reviewPin = await currentReview(ctx, ver);
    const now = Date.now(),
      sequence = account.xEvidence!.connectionSequence!;
    // This concrete human command reauthorizes the same immutable version; it never changes identity or unknown outcomes.
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: s.workspaceId,
      draftId: s.draftId,
      versionId: s.versionId,
      accountId: s.accountId,
      actorId: user._id,
      reviewPin,
      createdAt: now,
      revokedAt: null,
      revokedBy: null,
      purpose,
      accountConnectionSequence: sequence,
      expiresAt: now + FIRST_WRITE_MS,
      mediaPlacement: "first_post",
    });
    const next: Doc<"schedules"> = {
      ...s,
      purpose,
      generation: s.generation + 1,
      approvalId,
      reviewPin,
      actorId: user._id,
      accountConnectionSequence: sequence,
      confirmedAt: now,
      intentExpiresAt: now + FIRST_WRITE_MS,
      mediaPlacement: "first_post" as const,
      state: "publishing" as const,
      errorCode: null,
    };
    await checkApproval(
      ctx,
      s.workspaceId,
      s.versionId,
      s.accountId,
      approvalId,
      next,
    );
    await ctx.db.patch(s._id, {
      purpose,
      generation: next.generation,
      approvalId,
      reviewPin,
      actorId: user._id,
      accountConnectionSequence: sequence,
      confirmedAt: now,
      intentExpiresAt: next.intentExpiresAt,
      mediaPlacement: "first_post",
      state: "publishing",
      errorCode: null,
    });
    await ctx.scheduler.runAfter(0, internal.publishing.workflows.step, {
      scheduleId: s._id,
      generation: next.generation,
    });
    await event(
      ctx,
      s.workspaceId,
      s.draftId,
      "X_THREAD_CONTINUATION_CONFIRMED",
      user._id,
      s._id,
    );
    return null;
  },
});
export const inspect = workspaceQuery({
  args: { scheduleId: v.id("schedules") },
  returns: v.object({
    aborted: v.boolean(),
    positions: v.array(
      v.object({
        position: v.number(),
        stage: v.union(
          v.literal("confirmed"),
          v.literal("unknown"),
          v.literal("rejected"),
          v.literal("unsent"),
        ),
        errorCode: v.union(v.string(), v.null()),
        notBefore: v.union(v.number(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, a) => {
    const s = requireReference(
        ctx.workspace._id,
        await ctx.db.get(a.scheduleId),
      ) as Doc<"schedules">,
      ver = (await ctx.db.get(s.versionId))!;
    const rows = await ctx.db
      .query("xPostAttempts")
      .withIndex("by_scheduleId_and_generation_and_position", (q) =>
        q.eq("scheduleId", s._id),
      )
      .take(101);
    return {
      aborted: s.state === "cancelled" || s.abortRequestedAt !== undefined,
      positions: ver.content.text.map((_, position) => {
        const post = s.externalPosts?.find((p) => p.position === position),
          c = rows.filter((c) => c.position === position).at(-1),
          unknown =
            rows.length > 100 ||
            rows.some(
              (c) =>
                c.position === position &&
                ["sending", "unknown"].includes(c.stage),
            );
        return {
          position,
          stage: unknown
            ? ("unknown" as const)
            : post
              ? ("confirmed" as const)
              : c?.stage === "rejected"
                ? ("rejected" as const)
                : ("unsent" as const),
          errorCode: [400, 422].includes(c?.httpStatus ?? 0)
            ? "X_POST_PERMANENT_REJECTION"
            : (c?.errorCode ?? null),
          notBefore: c?.reconcileNotBefore ?? c?.rateResetAt ?? null,
        };
      }),
    };
  },
});

// Human review of known receipts can finish an abort; no client outcome assertion is accepted.
export const finalizeAbort = workspaceMutation({
  args: target,
  returns: v.null(),
  handler: async (ctx, a) => {
    const { s, ver, rows, user } = await context(ctx, {
      ...a,
      workspaceId: ctx.workspace._id,
    });
    if (s.abortRequestedAt === undefined)
      throw new ConvexError("SCHEDULE_ABORT_REQUIRED");
    if (
      hasUnresolvedEffects(rows) ||
      stoppedState(s, ver, rows) !== "cancelled"
    )
      throw new ConvexError("X_RECONCILIATION_REQUIRED");
    await recordStoppedState(ctx, s, ver, rows, user._id);
    return null;
  },
});
