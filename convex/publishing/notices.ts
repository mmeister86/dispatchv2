import { ConvexError, v, type Infer } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import {
  internalQuery,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  workspaceQuery,
  workspaceMutation,
  requireActiveWorkspace,
} from "../lib/authorization";
import { publishingPresentation } from "../lib/editorialFields";
import {
  historicalReviewSource,
  frozenReview,
  sameReview,
  loss,
} from "../editorial/reviews";

// Native schedule creation already captures its source/review horizon. Failure
// records that original binding; current ancestry belongs to readers and cleanup.
export async function capture(ctx: MutationCtx, s: Doc<"schedules">) {
  const unsupported = { presentationUnavailable: true };
  const pin = s.reviewPin;
  if (
    !pin ||
    pin.decisionIds.length > 2 ||
    (pin.sourceUntil !== null &&
      (!Number.isFinite(pin.sourceUntil) || pin.sourceUntil <= Date.now()))
  )
    return unsupported;
  const a = await ctx.db.get(s.approvalId);
  if (
    !a ||
    a.workspaceId !== s.workspaceId ||
    a.draftId !== s.draftId ||
    a.versionId !== s.versionId ||
    a.accountId !== s.accountId ||
    (a.purpose ?? "publishing") !== (s.purpose ?? "publishing") ||
    (a.reviewPin &&
      (!sameReview(a.reviewPin, pin) ||
        a.reviewPin.decisionIds.length > 2 ||
        (a.reviewPin.sourceUntil !== null &&
          !Number.isFinite(a.reviewPin.sourceUntil))))
  )
    return unsupported;
  const n = Math.min(
    pin.sourceUntil ?? Infinity,
    a.reviewPin?.sourceUntil ?? Infinity,
  );
  if (n <= Date.now()) return unsupported;
  return {
    presentationUnavailable: false,
    presentation: {
      draftId: s.draftId,
      versionId: s.versionId,
      accountId: s.accountId,
      approvalId: s.approvalId,
      approvalActorId: a.actorId,
      purpose: s.purpose ?? "publishing",
      reviewPin: pin,
      sourceUntil: Number.isFinite(n) ? n : null,
      readAt: null,
      dismissedAt: null,
    },
  };
}
async function member(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
) {
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!m || !["Owner", "Admin"].includes(m.role) || !(await ctx.db.get(userId)))
    throw new ConvexError("NOTICE_UNAVAILABLE");
}
async function proof(ctx: QueryCtx, n: Doc<"publishingNotifications">) {
  const p = n.presentation;
  if (
    n.presentationUnavailable !== false ||
    !p ||
    !Number.isSafeInteger(n.generation) ||
    n.generation! <= 0 ||
    p.reviewPin.decisionIds.length > 2 ||
    (p.sourceUntil !== null && !Number.isFinite(p.sourceUntil)) ||
    (p.reviewPin.sourceUntil !== null &&
      !Number.isFinite(p.reviewPin.sourceUntil))
  )
    throw new ConvexError("NOTICE_UNAVAILABLE");
  requireActiveWorkspace(await ctx.db.get(n.workspaceId));
  const s = await ctx.db.get(n.scheduleId),
    ver = await ctx.db.get(p.versionId),
    draft = await ctx.db.get(p.draftId),
    account = await ctx.db.get(p.accountId),
    a = await ctx.db.get(p.approvalId);
  // A later continuation may change schedule actor/approval/generation. Its
  // immutable content/workspace identity cannot replace this episode's header.
  if (
    !s ||
    s.workspaceId !== n.workspaceId ||
    s.draftId !== p.draftId ||
    !ver ||
    ver.workspaceId !== n.workspaceId ||
    ver.draftId !== p.draftId ||
    ver.content.accountId !== p.accountId ||
    !draft ||
    draft.workspaceId !== n.workspaceId ||
    !account ||
    account.workspaceId !== n.workspaceId ||
    !a ||
    a.workspaceId !== n.workspaceId ||
    a.draftId !== p.draftId ||
    a.versionId !== p.versionId ||
    a.accountId !== p.accountId ||
    a.actorId !== p.approvalActorId ||
    (a.purpose ?? "publishing") !== p.purpose ||
    (a.reviewPin &&
      (!sameReview(a.reviewPin, p.reviewPin) ||
        a.reviewPin.decisionIds.length > 2 ||
        (a.reviewPin.sourceUntil !== null &&
          !Number.isFinite(a.reviewPin.sourceUntil))))
  )
    throw new ConvexError("NOTICE_UNAVAILABLE");
  await member(ctx, n.workspaceId, n.recipientId);
  await member(ctx, n.workspaceId, p.approvalActorId);
  const until = await historicalReviewSource(
    ctx,
    ver,
    p.sourceUntil,
    p.reviewPin.sourceUntil,
    a.reviewPin?.sourceUntil,
  );
  return (await frozenReview(ctx, ver, p.reviewPin, until)).sourceUntil;
}
async function safe(ctx: QueryCtx, n: Doc<"publishingNotifications">) {
  try {
    return {
      ...n,
      presentation: { ...n.presentation!, sourceUntil: await proof(ctx, n) },
    };
  } catch (e) {
    if (!(e instanceof ConvexError && e.data === "NOTICE_UNAVAILABLE")) loss(e);
    return null;
  }
}
const viewFields = {
  family: v.literal("publishing"),
  id: v.id("publishingNotifications"),
  authId: v.string(),
  sessionId: v.string(),
  requestKey: v.string(),
  workspaceId: v.id("workspaces"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  accountId: v.id("socialAccounts"),
  createdAt: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  readAt: v.union(v.number(), v.null()),
  dismissedAt: v.union(v.number(), v.null()),
};
const view = v.object(viewFields);
const sampleResult = paginationResultValidator(
  v.object({ ...viewFields, binding: v.optional(publishingPresentation) }),
);
const request = { expectedAuthId: v.string(), requestKey: v.string() };
const ack = v.object({
  authId: v.string(),
  sessionId: v.string(),
  requestKey: v.string(),
});
const limits = {
  databaseQueries: 640,
  documentsRead: 640,
  bytesRead: 512 * 1024,
};
async function checkTotals(ctx: QueryCtx) {
  const total = await ctx.meta.getTransactionMetrics();
  if (
    total.databaseQueries.used > limits.databaseQueries ||
    total.documentsRead.used > limits.documentsRead ||
    total.bytesRead.used > limits.bytesRead
  )
    throw new ConvexError("NOTICE_READ_LIMIT");
}
async function scope(
  ctx: QueryCtx & { user: Doc<"users">; workspace: Doc<"workspaces"> },
  a: { expectedAuthId: string; requestKey: string },
) {
  if (
    !a.requestKey ||
    a.requestKey.length > 64 ||
    !a.expectedAuthId ||
    a.expectedAuthId.length > 256
  )
    throw new ConvexError("NOTICE_REQUEST_INVALID");
  if (
    ctx.user.authId !== a.expectedAuthId ||
    ctx.user.activeWorkspaceId !== ctx.workspace._id
  )
    throw new ConvexError("NOTICE_UNAVAILABLE");
  const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
  if (typeof sessionId !== "string" || !sessionId)
    throw new ConvexError("Unauthenticated");
  return { authId: ctx.user.authId, sessionId, requestKey: a.requestKey };
}
const mode = v.union(
  v.object({
    kind: v.literal("page"),
    paginationOpts: paginationOptsValidator,
  }),
  v.object({
    kind: v.literal("batch"),
    noticeIds: v.array(v.id("publishingNotifications")),
  }),
);
export const sample = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    ...request,
    sessionId: v.string(),
    mode,
  },
  returns: sampleResult,
  handler: async (ctx, a) => {
    let rows: Doc<"publishingNotifications">[],
      continueCursor = "",
      isDone = true;
    if (a.mode.kind === "page") {
      const page = await ctx.db
        .query("publishingNotifications")
        .withIndex("by_personal_presentation", (q) =>
          q
            .eq("workspaceId", a.workspaceId)
            .eq("recipientId", a.userId)
            .eq("presentationUnavailable", false),
        )
        .order("desc")
        .paginate({
          ...a.mode.paginationOpts,
          numItems: Math.min(25, Math.max(1, a.mode.paginationOpts.numItems)),
        });
      rows = page.page;
      continueCursor = page.continueCursor;
      isDone = page.isDone;
    } else {
      if (
        a.mode.noticeIds.length > 25 ||
        new Set(a.mode.noticeIds).size !== a.mode.noticeIds.length
      )
        throw new ConvexError("NOTICE_READ_LIMIT");
      rows = [];
      for (const id of a.mode.noticeIds) {
        const n = await ctx.db.get(id);
        if (!n || n.workspaceId !== a.workspaceId || n.recipientId !== a.userId)
          throw new ConvexError("NOTICE_UNAVAILABLE");
        rows.push(n);
      }
    }
    const page = [];
    for (const n of rows) {
      const row = await safe(ctx, n);
      if (!row) {
        if (a.mode.kind === "batch")
          throw new ConvexError("NOTICE_UNAVAILABLE");
        continue;
      }
      const p = row.presentation;
      if (a.mode.kind === "page" && p.dismissedAt !== null) continue;
      page.push({
        family: "publishing" as const,
        id: n._id,
        authId: a.expectedAuthId,
        sessionId: a.sessionId,
        requestKey: a.requestKey,
        workspaceId: a.workspaceId,
        draftId: p.draftId,
        versionId: p.versionId,
        accountId: p.accountId,
        createdAt: n.createdAt,
        sourceUntil: p.sourceUntil,
        readAt: p.readAt,
        dismissedAt: p.dismissedAt,
        ...(a.mode.kind === "batch" ? { binding: p } : {}),
      });
    }
    return { page, continueCursor, isDone };
  },
});
async function bounded(
  ctx: QueryCtx,
  a: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    expectedAuthId: string;
    requestKey: string;
    sessionId: string;
    mode: typeof mode.type;
  },
) {
  const m = await ctx.meta.getTransactionMetrics();
  const remaining = {
    databaseQueries: limits.databaseQueries - m.databaseQueries.used - 1,
    documentsRead: limits.documentsRead - m.documentsRead.used,
    bytesRead: limits.bytesRead - m.bytesRead.used,
  };
  if (Object.values(remaining).some((n) => n <= 0))
    throw new ConvexError("NOTICE_READ_LIMIT");
  const result: Infer<typeof sampleResult> = await ctx.runQuery(
    internal.publishing.notices.sample,
    a,
    { transactionLimits: remaining },
  );
  await checkTotals(ctx);
  if (new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024)
    throw new ConvexError("NOTICE_DTO_LIMIT");
  return result;
}
export const list = workspaceQuery({
  args: { ...request, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(view),
  handler: async (ctx, a) => {
    const wire = await scope(ctx, a);
    return bounded(ctx, {
      workspaceId: ctx.workspace._id,
      userId: ctx.user._id,
      expectedAuthId: a.expectedAuthId,
      requestKey: a.requestKey,
      sessionId: wire.sessionId,
      mode: { kind: "page", paginationOpts: a.paginationOpts },
    });
  },
});
const observed = {
  ...request,
  noticeIds: v.array(v.id("publishingNotifications")),
};
async function change(
  ctx: MutationCtx & { user: Doc<"users">; workspace: Doc<"workspaces"> },
  a: {
    expectedAuthId: string;
    requestKey: string;
    noticeIds: Id<"publishingNotifications">[];
  },
  field: "readAt" | "dismissedAt",
) {
  const wire = await scope(ctx, a);
  const rows = await bounded(ctx, {
    workspaceId: ctx.workspace._id,
    userId: ctx.user._id,
    expectedAuthId: a.expectedAuthId,
    requestKey: a.requestKey,
    sessionId: wire.sessionId,
    mode: { kind: "batch", noticeIds: a.noticeIds },
  });
  for (const n of rows.page)
    if (n[field] === null) {
      await ctx.db.patch(n.id, {
        presentation: { ...n.binding!, [field]: Date.now() },
      });
    }
  await checkTotals(ctx);
  if (new TextEncoder().encode(JSON.stringify(wire)).length > 64 * 1024)
    throw new ConvexError("NOTICE_DTO_LIMIT");
  return wire;
}
export const read = workspaceMutation({
  args: observed,
  returns: ack,
  handler: (ctx, a) => change(ctx, a, "readAt"),
});
export const dismiss = workspaceMutation({
  args: observed,
  returns: ack,
  handler: (ctx, a) => change(ctx, a, "dismissedAt"),
});
async function scrub(ctx: MutationCtx, n: Doc<"publishingNotifications">) {
  const row = await safe(ctx, n);
  if (!row)
    await ctx.db.patch(n._id, {
      presentation: undefined,
      presentationUnavailable: true,
    });
  else if (row.presentation.sourceUntil !== n.presentation?.sourceUntil)
    await ctx.db.patch(n._id, { presentation: row.presentation });
}
// ponytail: one proof per job avoids repeated retained ancestry walks exhausting a cleanup transaction.
export const cleanupVersion = internalMutation({
  args: {
    versionId: v.id("draftVersions"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("publishingNotifications")
      .withIndex("by_presentation_version", (q) =>
        q
          .eq("presentation.versionId", a.versionId)
          .eq("presentationUnavailable", false),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const n of page.page) await scrub(ctx, n);
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.publishing.notices.cleanupVersion,
        { ...a, cursor: page.continueCursor },
      );
    return null;
  },
});
export const purgeActor = internalMutation({
  args: {
    actorId: v.id("users"),
    phase: v.union(v.literal("recipient"), v.literal("approver")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const query =
      a.phase === "recipient"
        ? ctx.db
            .query("publishingNotifications")
            .withIndex("by_presentation_recipient", (q) =>
              q
                .eq("recipientId", a.actorId)
                .eq("presentationUnavailable", false),
            )
        : ctx.db
            .query("publishingNotifications")
            .withIndex("by_presentation_approver", (q) =>
              q
                .eq("presentation.approvalActorId", a.actorId)
                .eq("presentationUnavailable", false),
            );
    const page = await query.paginate({ cursor: a.cursor, numItems: 1 });
    for (const n of page.page) await scrub(ctx, n);
    if (!page.isDone || a.phase !== "approver")
      await ctx.scheduler.runAfter(0, internal.publishing.notices.purgeActor, {
        actorId: a.actorId,
        phase: page.isDone ? "approver" : a.phase,
        cursor: page.isDone ? null : page.continueCursor,
      });
    return null;
  },
});
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("publishingNotifications")
      .withIndex("by_presentation_horizon", (q) =>
        q.eq("presentationUnavailable", false),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const n of page.page) await scrub(ctx, n);
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.publishing.notices.sweep, {
        cursor: page.continueCursor,
      });
    return null;
  },
});
