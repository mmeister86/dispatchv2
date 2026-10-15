import { ConvexError, v, type Infer } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import {
  workspaceQuery,
  workspaceMutation,
  requireActiveWorkspace,
} from "../lib/authorization";
import {
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { noticeParent } from "./reviewFields";
import { historicalReviewSource, loss, effective } from "./reviews";

type Parent = Infer<typeof noticeParent>;
const view = v.object({
  authId: v.string(),
  sessionId: v.string(),
  id: v.id("editorialNotices"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  parent: noticeParent,
  createdAt: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  readAt: v.union(v.number(), v.null()),
  dismissedAt: v.union(v.number(), v.null()),
});
function roles(p: Parent) {
  return p.kind === "approval" || (p.kind === "request" && p.stage === "brand")
    ? ["Owner", "Admin"]
    : ["Owner", "Admin", "Editor"];
}
async function member(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  id: Id<"users">,
  allowed: string[],
) {
  const row = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", id).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!row || !allowed.includes(row.role) || !(await ctx.db.get(id)))
    throw new ConvexError("NOTICE_UNAVAILABLE");
}
export async function proof(ctx: QueryCtx, n: Doc<"editorialNotices">) {
  requireActiveWorkspace(await ctx.db.get(n.workspaceId));
  const draft = await ctx.db.get(n.draftId),
    ver = await ctx.db.get(n.versionId);
  if (
    n.sourceUnavailable ||
    !draft ||
    !ver ||
    draft.workspaceId !== n.workspaceId ||
    ver.draftId !== draft._id ||
    ver.workspaceId !== n.workspaceId ||
    ver.content.accountId !== n.accountId ||
    draft.assigneeId !== n.recipientId
  )
    throw new ConvexError("NOTICE_UNAVAILABLE");
  if (
    n.accountId &&
    (await ctx.db.get(n.accountId))?.workspaceId !== n.workspaceId
  )
    throw new ConvexError("NOTICE_UNAVAILABLE");
  await member(
    ctx,
    n.workspaceId,
    n.recipientId,
    n.parent.kind === "request"
      ? roles(n.parent)
      : ["Owner", "Admin", "Editor", "Viewer"],
  );
  let actorRoles =
      n.parent.kind === "request"
        ? ["Owner", "Admin", "Editor"]
        : roles(n.parent),
    parentUntil: number | null = null;
  const p = n.parent;
  if (p.kind === "assignment" || p.kind === "request") {
    const c = await ctx.db.get(p.commandId);
    if (
      !c ||
      c.sourceUnavailable ||
      c.workspaceId !== n.workspaceId ||
      !c.assignmentResult ||
      c.kind !== p.kind ||
      c.versionId !== n.versionId ||
      c.draftId !== n.draftId ||
      c.accountId !== n.accountId ||
      c.actorId !== n.actorId ||
      c.assigneeId !== n.recipientId ||
      (p.kind === "request" && c.requestStage !== p.stage)
    )
      throw new ConvexError("NOTICE_UNAVAILABLE");
    if (p.kind === "request") {
      const policy = await effective(ctx, ver);
      if (!policy || policy._id !== c.result?.policyId || !policy[p.stage])
        throw new ConvexError("NOTICE_UNAVAILABLE");
    }
    parentUntil = c.sourceUntil;
  } else if (p.kind === "decision") {
    const d = await ctx.db.get(p.decisionId);
    if (
      !d ||
      d.sourceUnavailable ||
      d.workspaceId !== n.workspaceId ||
      d.versionId !== n.versionId ||
      d.draftId !== n.draftId ||
      d.accountId !== n.accountId ||
      (p.withdrawn
        ? d.withdrawnBy !== n.actorId
        : d.reviewerId !== n.actorId) ||
      (p.withdrawn && d.withdrawnAt === null)
    )
      throw new ConvexError("NOTICE_UNAVAILABLE");
    if (!d.reviewerId) throw new ConvexError("NOTICE_UNAVAILABLE");
    await member(
      ctx,
      n.workspaceId,
      d.reviewerId,
      d.stage === "brand" ? ["Owner", "Admin"] : ["Owner", "Admin", "Editor"],
    );
    actorRoles =
      p.withdrawn && d.reviewerId !== n.actorId
        ? ["Owner", "Admin"]
        : d.stage === "brand"
          ? ["Owner", "Admin"]
          : ["Owner", "Admin", "Editor"];
    parentUntil = d.sourceUntil;
  } else {
    const a = await ctx.db.get(p.approvalId);
    if (
      !a ||
      a.workspaceId !== n.workspaceId ||
      a.versionId !== n.versionId ||
      a.draftId !== n.draftId ||
      a.accountId !== n.accountId ||
      (p.revoked
        ? a.revokedBy !== n.actorId || a.revokedAt === null
        : a.actorId !== n.actorId)
    )
      throw new ConvexError("NOTICE_UNAVAILABLE");
    if (!a.actorId) throw new ConvexError("NOTICE_UNAVAILABLE");
    await member(ctx, n.workspaceId, a.actorId, ["Owner", "Admin"]);
    parentUntil = a.reviewPin?.sourceUntil ?? null;
  }
  await member(ctx, n.workspaceId, n.actorId, actorRoles);
  return historicalReviewSource(ctx, ver, n.sourceUntil, parentUntil);
}
async function safe(ctx: QueryCtx, n: Doc<"editorialNotices">) {
  try {
    return { ...n, sourceUntil: await proof(ctx, n) };
  } catch (e) {
    if (!(e instanceof ConvexError && e.data === "NOTICE_UNAVAILABLE")) loss(e);
    return null;
  }
}
function project(
  n: Doc<"editorialNotices">,
  authId: string,
  sessionId: string,
) {
  return {
    authId,
    sessionId,
    id: n._id,
    draftId: n.draftId,
    versionId: n.versionId,
    accountId: n.accountId,
    parent: n.parent,
    createdAt: n.createdAt,
    sourceUntil: n.sourceUntil,
    readAt: n.readAt,
    dismissedAt: n.dismissedAt,
  };
}
export async function produce(
  ctx: MutationCtx,
  ver: Doc<"draftVersions">,
  actorId: Id<"users">,
  parent: Parent,
  sourceUntil: number | null,
) {
  const draft = await ctx.db.get(ver.draftId),
    recipientId = draft?.assigneeId;
  if (!recipientId) return null;
  const occurrence = JSON.stringify(parent);
  const old = await ctx.db
    .query("editorialNotices")
    .withIndex("by_occurrence_and_recipientId", (q) =>
      q.eq("occurrence", occurrence).eq("recipientId", recipientId),
    )
    .unique();
  if (old) return old._id;
  const fields = {
    workspaceId: ver.workspaceId,
    draftId: ver.draftId,
    versionId: ver._id,
    accountId: ver.content.accountId,
    parent,
    occurrence,
    actorId,
    recipientId,
    createdAt: Date.now(),
    sourceUntil,
    sourceUnavailable: false,
    readAt: null,
    dismissedAt: null,
  };
  // No new authority: a recipient unavailable for this exact occurrence gets no notice.
  const temporary = {
    ...fields,
    _id: "" as Id<"editorialNotices">,
    _creationTime: Date.now(),
  };
  if (!(await safe(ctx, temporary))) return null;
  return ctx.db.insert("editorialNotices", fields);
}
export const list = workspaceQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(view),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialNotices")
      .withIndex("by_workspaceId_and_recipientId_and_createdAt", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("recipientId", ctx.user._id),
      )
      .order("desc")
      .paginate({
        ...a.paginationOpts,
        numItems: Math.min(25, Math.max(1, a.paginationOpts.numItems)),
      });
    const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string") throw new ConvexError("Unauthenticated");
    const rows = await Promise.all(page.page.map((n) => safe(ctx, n)));
    return {
      ...page,
      page: rows.flatMap((n) =>
        n && n.dismissedAt === null
          ? [project(n, ctx.user.authId, sessionId)]
          : [],
      ),
    };
  },
});
export const get = workspaceQuery({
  args: { noticeId: v.id("editorialNotices") },
  returns: v.union(view, v.null()),
  handler: async (ctx, a) => {
    const n = await ctx.db.get(a.noticeId);
    if (
      !n ||
      n.recipientId !== ctx.user._id ||
      n.workspaceId !== ctx.workspace._id
    )
      return null;
    const row = await safe(ctx, n);
    const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string") throw new ConvexError("Unauthenticated");
    return row ? project(row, ctx.user.authId, sessionId) : null;
  },
});
const observed = { noticeIds: v.array(v.id("editorialNotices")) };
async function owned(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  ids: Id<"editorialNotices">[],
) {
  if (ids.length > 25) throw new ConvexError("NOTICE_READ_LIMIT");
  const rows = [];
  for (const id of new Set(ids)) {
    const n = await ctx.db.get(id);
    if (!n || n.workspaceId !== workspaceId || n.recipientId !== userId)
      throw new ConvexError("NOTICE_UNAVAILABLE");
    if (!(await safe(ctx, n))) throw new ConvexError("NOTICE_UNAVAILABLE");
    rows.push(n);
  }
  return rows;
}
export const read = workspaceMutation({
  args: observed,
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await owned(ctx, ctx.workspace._id, ctx.user._id, a.noticeIds);
    for (const n of rows)
      if (n.readAt === null) await ctx.db.patch(n._id, { readAt: Date.now() });
    return null;
  },
});
export const dismiss = workspaceMutation({
  args: observed,
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await owned(ctx, ctx.workspace._id, ctx.user._id, a.noticeIds);
    for (const n of rows)
      if (n.dismissedAt === null)
        await ctx.db.patch(n._id, { dismissedAt: Date.now() });
    return null;
  },
});
export const purgeVersion = internalMutation({
  args: { versionId: v.id("draftVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("editorialNotices")
      .withIndex("by_versionId_and_sourceUnavailable", (q) =>
        q.eq("versionId", a.versionId).eq("sourceUnavailable", false),
      )
      .take(50);
    for (const n of rows) await ctx.db.delete(n._id);
    if (rows.length === 50)
      await ctx.scheduler.runAfter(
        0,
        internal.editorial.notices.purgeVersion,
        a,
      );
    if (rows.length < 50)
      await ctx.scheduler.runAfter(
        0,
        internal.publishing.notices.cleanupVersion,
        { versionId: a.versionId, cursor: null },
      );
    return null;
  },
});
export const purgeActor = internalMutation({
  args: {
    actorId: v.id("users"),
    phase: v.optional(v.union(v.literal("actor"), v.literal("recipient"))),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const query =
      a.phase === "recipient"
        ? ctx.db
            .query("editorialNotices")
            .withIndex("by_recipientId_and_sourceUnavailable", (q) =>
              q.eq("recipientId", a.actorId).eq("sourceUnavailable", false),
            )
        : ctx.db
            .query("editorialNotices")
            .withIndex("by_actorId_and_sourceUnavailable", (q) =>
              q.eq("actorId", a.actorId).eq("sourceUnavailable", false),
            );
    const page = await query.paginate({
      cursor: a.cursor ?? null,
      numItems: 25,
    });
    for (const n of page.page) {
      const row = await safe(ctx, n);
      if (!row) await ctx.db.delete(n._id);
      else if (row.sourceUntil !== n.sourceUntil)
        await ctx.db.patch(n._id, { sourceUntil: row.sourceUntil });
    }
    if (!page.isDone || a.phase !== "recipient")
      await ctx.scheduler.runAfter(0, internal.editorial.notices.purgeActor, {
        actorId: a.actorId,
        phase: page.isDone ? "recipient" : (a.phase ?? "actor"),
        cursor: page.isDone ? null : page.continueCursor,
      });
    if (page.isDone && a.phase === "recipient")
      await ctx.scheduler.runAfter(0, internal.publishing.notices.purgeActor, {
        actorId: a.actorId,
        phase: "recipient",
        cursor: null,
      });
    return null;
  },
});
export const cleanupVersion = internalMutation({
  args: {
    versionId: v.id("draftVersions"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialNotices")
      .withIndex("by_versionId_and_sourceUnavailable", (q) =>
        q.eq("versionId", a.versionId).eq("sourceUnavailable", false),
      )
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const n of page.page) {
      const row = await safe(ctx, n);
      if (!row) await ctx.db.delete(n._id);
      else if (row.sourceUntil !== n.sourceUntil)
        await ctx.db.patch(n._id, { sourceUntil: row.sourceUntil });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.editorial.notices.cleanupVersion,
        { ...a, cursor: page.continueCursor },
      );
    if (page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.publishing.notices.cleanupVersion,
        { versionId: a.versionId, cursor: null },
      );
    return null;
  },
});
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialNotices")
      .withIndex("by_sourceUnavailable_and_sourceUntil", (q) =>
        q.eq("sourceUnavailable", false),
      )
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const n of page.page) {
      const row = await safe(ctx, n);
      if (!row) await ctx.db.delete(n._id);
      else if (row.sourceUntil !== n.sourceUntil)
        await ctx.db.patch(n._id, { sourceUntil: row.sourceUntil });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.editorial.notices.sweep, {
        cursor: page.continueCursor,
      });
    if (page.isDone)
      await ctx.scheduler.runAfter(0, internal.publishing.notices.sweep, {
        cursor: null,
      });
    return null;
  },
});
