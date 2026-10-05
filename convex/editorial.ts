import { ConvexError, v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
} from "./lib/authorization";
import {
  content,
  accountFields,
  assetFields,
  draftFields,
  versionFields,
  approvalFields,
  scheduleFields,
  eventFields,
  notificationFields,
  commentFields,
} from "./lib/editorialFields";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { resolveLocalTime } from "../src/lib/time";
const draftDoc = v.object({
  _id: v.id("drafts"),
  _creationTime: v.number(),
  ...draftFields,
});
const versionDoc = v.object({
  _id: v.id("draftVersions"),
  _creationTime: v.number(),
  ...versionFields,
});
const approvalDoc = v.object({
  _id: v.id("approvals"),
  _creationTime: v.number(),
  ...approvalFields,
});
export const scheduleDoc = v.object({
  _id: v.id("schedules"),
  _creationTime: v.number(),
  ...scheduleFields,
});
const bundle = v.object({
  draft: draftDoc,
  versions: v.array(versionDoc),
  approvals: v.array(approvalDoc),
  schedules: v.array(scheduleDoc),
  historyLimited: v.boolean(),
  commentsLimited: v.boolean(),
  comments: v.array(
    v.object({
      _id: v.id("editorialComments"),
      _creationTime: v.number(),
      ...commentFields,
    }),
  ),
});
export async function draftBundle(
  ctx: QueryCtx,
  draft: Doc<"drafts">,
  summary = false,
) {
  const versions = (
    await ctx.db
      .query("draftVersions")
      .withIndex("by_draftId_and_number", (q) => q.eq("draftId", draft._id))
      .order("desc")
      .take(summary ? 1 : 20)
  ).reverse();
  const recentSchedules = await ctx.db
    .query("schedules")
    .withIndex("by_draftId", (q) => q.eq("draftId", draft._id))
    .order("desc")
    .take(20);
  const activeSchedules = (
    await Promise.all(
      ["scheduled", "publishing"].map((state) =>
        ctx.db
          .query("schedules")
          .withIndex("by_draftId_and_state", (q) =>
            q
              .eq("draftId", draft._id)
              .eq("state", state as "scheduled" | "publishing"),
          )
          .take(101),
      ),
    )
  ).flat();
  if (activeSchedules.length > 100)
    throw new ConvexError("DRAFT_ACTIVE_SCHEDULE_LIMIT");
  const schedules = [
    ...new Map(
      [...recentSchedules, ...activeSchedules].map((s) => [s._id, s]),
    ).values(),
  ];
  for (const schedule of summary ? [] : schedules)
    if (!versions.some((v) => v._id === schedule.versionId)) {
      const version = await ctx.db.get(schedule.versionId);
      if (version) versions.push(version);
    }
  versions.sort((a, b) => a.number - b.number);
  const comments = summary
    ? []
    : await ctx.db
        .query("editorialComments")
        .withIndex("by_draftId", (q) => q.eq("draftId", draft._id))
        .order("desc")
        .take(101);
  const commentsLimited = comments.length > 100;
  if (commentsLimited) comments.pop();
  return {
    draft,
    comments,
    commentsLimited,
    historyLimited: draft.revision > (summary ? 1 : 20),
    versions,
    approvals: await ctx.db
      .query("approvals")
      .withIndex("by_draftId", (q) => q.eq("draftId", draft._id))
      .order("desc")
      .take(100),
    schedules,
  };
}
export const list = workspaceQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(bundle),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("drafts")
      .withIndex("by_workspaceId_and_updatedAt", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(25, Math.max(1, args.paginationOpts.numItems)),
      });
    return {
      ...result,
      page: await Promise.all(
        result.page.map((d) => draftBundle(ctx, d, true)),
      ),
    };
  },
});
export const get = workspaceQuery({
  args: { draftId: v.id("drafts") },
  returns: v.union(bundle, v.null()),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.workspaceId !== ctx.workspace._id) return null;
    return draftBundle(ctx, draft);
  },
});
export const resources = workspaceQuery({
  args: {},
  returns: v.object({
    accounts: v.array(
      v.object({
        _id: v.id("socialAccounts"),
        _creationTime: v.number(),
        ...accountFields,
      }),
    ),
    assets: v.array(
      v.object({
        _id: v.id("mediaAssets"),
        _creationTime: v.number(),
        ...assetFields,
      }),
    ),
    events: v.array(
      v.object({
        _id: v.id("editorialEvents"),
        _creationTime: v.number(),
        ...eventFields,
      }),
    ),
    members: v.array(
      v.object({ id: v.id("users"), role: v.string(), name: v.string() }),
    ),
    resourcesLimited: v.boolean(),
    notifications: v.array(
      v.object({
        _id: v.id("publishingNotifications"),
        _creationTime: v.number(),
        ...notificationFields,
      }),
    ),
  }),
  handler: async (ctx) => {
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .take(101);
    if (members.length > 100)
      throw new ConvexError("MEMBER_LIMIT_REQUIRES_PAGINATION");
    const result = {
      resourcesLimited: false,
      members: await Promise.all(
        members.map(async (m) => {
          const p = await ctx.db
            .query("preferences")
            .withIndex("by_userId_and_workspaceId", (q) =>
              q.eq("userId", m.userId).eq("workspaceId", ctx.workspace._id),
            )
            .unique();
          return { id: m.userId, role: m.role, name: p?.name || "Mitglied" };
        }),
      ),
      accounts: await ctx.db
        .query("socialAccounts")
        .withIndex("by_workspaceId", (q) =>
          q.eq("workspaceId", ctx.workspace._id),
        )
        .take(101),
      assets: await ctx.db
        .query("mediaAssets")
        .withIndex("by_workspaceId", (q) =>
          q.eq("workspaceId", ctx.workspace._id),
        )
        .take(101),
      events: await ctx.db
        .query("editorialEvents")
        .withIndex("by_workspaceId_and_createdAt", (q) =>
          q.eq("workspaceId", ctx.workspace._id),
        )
        .order("desc")
        .take(50),
      notifications: await ctx.db
        .query("publishingNotifications")
        .withIndex("by_workspaceId_and_createdAt", (q) =>
          q.eq("workspaceId", ctx.workspace._id),
        )
        .order("desc")
        .take(50),
    };
    result.resourcesLimited =
      result.accounts.length > 100 || result.assets.length > 100;
    result.accounts = result.accounts.slice(0, 100);
    result.assets = result.assets.slice(0, 100);
    return result;
  },
});
export const calendar = workspaceQuery({
  args: {
    start: v.number(),
    end: v.number(),
    accountId: v.optional(v.id("socialAccounts")),
  },
  returns: v.object({
    rows: v.array(v.object({ schedule: scheduleDoc, version: versionDoc })),
    tooDense: v.boolean(),
  }),
  handler: async (ctx, a) => {
    if (
      !Number.isFinite(a.start) ||
      !Number.isFinite(a.end) ||
      a.end <= a.start ||
      a.end - a.start > 93 * 86400000
    )
      throw new ConvexError("INVALID_CALENDAR_RANGE");
    if (a.accountId)
      requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const rows = await (a.accountId
      ? ctx.db
          .query("schedules")
          .withIndex("by_workspaceId_and_accountId_and_at", (q) =>
            q
              .eq("workspaceId", ctx.workspace._id)
              .eq("accountId", a.accountId!)
              .gte("at", a.start)
              .lt("at", a.end),
          )
          .take(101)
      : ctx.db
          .query("schedules")
          .withIndex("by_workspaceId_and_at", (q) =>
            q
              .eq("workspaceId", ctx.workspace._id)
              .gte("at", a.start)
              .lt("at", a.end),
          )
          .take(101));
    if (rows.length > 100) return { rows: [], tooDense: true };
    return {
      rows: await Promise.all(
        rows.map(async (schedule) => ({
          schedule,
          version: (await ctx.db.get(schedule.versionId))!,
        })),
      ),
      tooDense: false,
    };
  },
});
export async function validateContent(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  c: Doc<"draftVersions">["content"],
  publishing = false,
) {
  if (new TextEncoder().encode(JSON.stringify(c)).length > 32768)
    throw new ConvexError("CONTENT_SNAPSHOT_TOO_LARGE");
  if (
    !c.title.trim() ||
    c.title.length > 200 ||
    c.text.length < 1 ||
    c.text.length > 100 ||
    c.text.some((t) => t.length > 25000) ||
    c.media.length > 20 ||
    c.pillar.length > 200 ||
    c.strategy.length > 100
  )
    throw new ConvexError("INVALID_CONTENT");
  const account = c.accountId
    ? (requireReference(
        workspaceId,
        await ctx.db.get(c.accountId),
      ) as Doc<"socialAccounts">)
    : null;
  const assets = await Promise.all(
    c.media.map(async (ref) => {
      const a = requireReference(
        workspaceId,
        await ctx.db.get(ref.assetId),
      ) as Doc<"mediaAssets">;
      if (
        a.state !== "ready" ||
        !a.checksum ||
        !a.objectKey ||
        !ref.alt.trim() ||
        ref.alt.length > 2000
      )
        throw new ConvexError("MEDIA_NOT_READY");
      return a;
    }),
  );
  if (
    publishing &&
    (!account ||
      account.connection !== "connected" ||
      !account.capability.publish)
  )
    throw new ConvexError("ACCOUNT_REAUTH_OR_CAPABILITY_REQUIRED");
  if (account) {
    const caps = account.capability;
    if (
      c.text.length > caps.maxThread ||
      c.text.some((t) => t.length > caps.maxText) ||
      c.media.length > caps.maxMedia ||
      assets.some((a) => !caps.mediaTypes.includes(a.type)) ||
      (assets.some((a) => a.type === "video") && assets.length !== 1) ||
      (publishing && c.text.some((t) => !t.trim()))
    )
      throw new ConvexError("CAPABILITY_VALIDATION_FAILED");
  }
  return account;
}
export async function event(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  draftId: Id<"drafts">,
  code: string,
  actorId: Id<"users"> | null,
  scheduleId: Id<"schedules"> | null = null,
) {
  await ctx.db.insert("editorialEvents", {
    workspaceId,
    draftId,
    code,
    actorId,
    scheduleId,
    createdAt: Date.now(),
  });
}
export const create = workspaceMutation({
  args: { content, source: v.string() },
  returns: v.id("drafts"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    await validateContent(ctx, ctx.workspace._id, a.content);
    if (a.source.length > 500) throw new ConvexError("INVALID_SOURCE");
    const draftId = await ctx.db.insert("drafts", {
      workspaceId: ctx.workspace._id,
      revision: 1,
      currentVersionId: null,
      authorId: ctx.user._id,
      source: a.source,
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("draftVersions", {
      workspaceId: ctx.workspace._id,
      draftId,
      number: 1,
      content: a.content,
      mediaChecksums: await mediaSnapshot(ctx, a.content),
      authorId: ctx.user._id,
      createdAt: Date.now(),
      reason: "Erster Entwurf",
    });
    await ctx.db.patch(draftId, { currentVersionId: versionId });
    await event(ctx, ctx.workspace._id, draftId, "DRAFT_CREATED", ctx.user._id);
    return draftId;
  },
});
export const save = workspaceMutation({
  args: {
    draftId: v.id("drafts"),
    expectedRevision: v.number(),
    content,
    reason: v.string(),
  },
  returns: v.id("draftVersions"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const d = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.draftId),
    ) as Doc<"drafts">;
    if (d.revision !== a.expectedRevision)
      throw new ConvexError("SAVE_CONFLICT");
    await validateContent(ctx, ctx.workspace._id, a.content);
    if (a.reason.length > 500) throw new ConvexError("INVALID_REASON");
    const versionId = await ctx.db.insert("draftVersions", {
      workspaceId: ctx.workspace._id,
      draftId: d._id,
      number: d.revision + 1,
      content: a.content,
      mediaChecksums: await mediaSnapshot(ctx, a.content),
      authorId: ctx.user._id,
      createdAt: Date.now(),
      reason: a.reason,
    });
    await ctx.db.patch(d._id, {
      revision: d.revision + 1,
      currentVersionId: versionId,
      updatedAt: Date.now(),
    });
    await event(ctx, ctx.workspace._id, d._id, "VERSION_SAVED", ctx.user._id);
    return versionId;
  },
});
export const approve = workspaceMutation({
  args: { versionId: v.id("draftVersions"), accountId: v.id("socialAccounts") },
  returns: v.id("approvals"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.versionId),
    ) as Doc<"draftVersions">;
    if (ver.content.accountId !== a.accountId)
      throw new ConvexError("APPROVAL_ACCOUNT_MISMATCH");
    await validateContent(ctx, ctx.workspace._id, ver.content, true);
    await immutableMedia(ctx, ver);
    const existing = (
      await ctx.db
        .query("approvals")
        .withIndex("by_versionId_and_accountId", (q) =>
          q.eq("versionId", ver._id).eq("accountId", a.accountId),
        )
        .order("desc")
        .take(100)
    ).find((x) => x.revokedAt === null);
    if (existing) return existing._id;
    const id = await ctx.db.insert("approvals", {
      workspaceId: ctx.workspace._id,
      draftId: ver.draftId,
      versionId: ver._id,
      accountId: a.accountId,
      actorId: ctx.user._id,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    await event(
      ctx,
      ctx.workspace._id,
      ver.draftId,
      "VERSION_APPROVED",
      ctx.user._id,
    );
    return id;
  },
});
export const revoke = workspaceMutation({
  args: { approvalId: v.id("approvals") },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const approval = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.approvalId),
    ) as Doc<"approvals">;
    if (approval.revokedAt === null) {
      await ctx.db.patch(approval._id, {
        revokedAt: Date.now(),
        revokedBy: ctx.user._id,
      });
      await event(
        ctx,
        ctx.workspace._id,
        approval.draftId,
        "APPROVAL_REVOKED",
        ctx.user._id,
      );
    }
    return null;
  },
});
export function validateTime(at: number, timezone: string, localTime: string) {
  let matches: string[];
  try {
    matches = resolveLocalTime(localTime, timezone);
  } catch {
    throw new ConvexError("INVALID_TIMEZONE");
  }
  if (!Number.isFinite(at) || !matches.includes(new Date(at).toISOString()))
    throw new ConvexError("LOCAL_TIME_REQUIRES_EXPLICIT_INSTANT");
  if (at <= Date.now()) throw new ConvexError("SCHEDULE_IN_PAST");
}
export async function checkApproval(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  versionId: Id<"draftVersions">,
  accountId: Id<"socialAccounts">,
  approvalId: Id<"approvals">,
) {
  const ver = requireReference(
    workspaceId,
    await ctx.db.get(versionId),
  ) as Doc<"draftVersions">;
  const approval = requireReference(
    workspaceId,
    await ctx.db.get(approvalId),
  ) as Doc<"approvals">;
  if (
    approval.versionId !== versionId ||
    approval.accountId !== accountId ||
    approval.draftId !== ver.draftId ||
    approval.revokedAt !== null ||
    ver.content.accountId !== accountId
  )
    throw new ConvexError("APPROVAL_REQUIRED");
  const member = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", approval.actorId).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!member || !["Owner", "Admin"].includes(member.role))
    throw new ConvexError("APPROVER_AUTHORITY_CHANGED");
  await validateContent(ctx, workspaceId, ver.content, true);
  await immutableMedia(ctx, ver);
  return ver;
}
const timing = { at: v.number(), timezone: v.string(), localTime: v.string() };
export const schedule = workspaceMutation({
  args: {
    versionId: v.id("draftVersions"),
    accountId: v.id("socialAccounts"),
    approvalId: v.id("approvals"),
    ...timing,
  },
  returns: v.id("schedules"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    validateTime(a.at, a.timezone, a.localTime);
    const ver = await checkApproval(
      ctx,
      ctx.workspace._id,
      a.versionId,
      a.accountId,
      a.approvalId,
    );
    if (await occupied(ctx, ctx.workspace._id, a.accountId, a.at))
      throw new ConvexError("SLOT_OCCUPIED");
    const id = await ctx.db.insert("schedules", {
      workspaceId: ctx.workspace._id,
      draftId: ver.draftId,
      versionId: a.versionId,
      versionNumber: ver.number,
      accountId: a.accountId,
      approvalId: a.approvalId,
      actorId: ctx.user._id,
      generation: 1,
      ...timingValues(a),
      state: "scheduled",
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    });
    const jobId = await ctx.scheduler.runAt(
      a.at,
      internal.publishing.dispatch,
      { scheduleId: id, generation: 1 },
    );
    await ctx.db.patch(id, { jobId });
    await event(
      ctx,
      ctx.workspace._id,
      ver.draftId,
      "SCHEDULE_CREATED",
      ctx.user._id,
      id,
    );
    return id;
  },
});
function timingValues(a: { at: number; timezone: string; localTime: string }) {
  return { at: a.at, timezone: a.timezone, localTime: a.localTime };
}
export const reschedule = workspaceMutation({
  args: {
    scheduleId: v.id("schedules"),
    expectedGeneration: v.number(),
    versionId: v.optional(v.id("draftVersions")),
    approvalId: v.optional(v.id("approvals")),
    ...timing,
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.scheduleId),
    ) as Doc<"schedules">;
    if (s.generation !== a.expectedGeneration)
      throw new ConvexError("SCHEDULE_CONFLICT");
    if (s.state !== "scheduled") throw new ConvexError("SCHEDULE_NOT_MOVABLE");
    validateTime(a.at, a.timezone, a.localTime);
    const versionId = a.versionId ?? s.versionId,
      approvalId = a.approvalId ?? s.approvalId;
    const ver = await checkApproval(
      ctx,
      ctx.workspace._id,
      versionId,
      s.accountId,
      approvalId,
    );
    if (ver.draftId !== s.draftId)
      throw new ConvexError("REFERENCE_ACCESS_DENIED");
    if (await occupied(ctx, ctx.workspace._id, s.accountId, a.at, s._id))
      throw new ConvexError("SLOT_OCCUPIED");
    if (s.jobId) await ctx.scheduler.cancel(s.jobId);
    const generation = s.generation + 1;
    const jobId = await ctx.scheduler.runAt(
      a.at,
      internal.publishing.dispatch,
      { scheduleId: s._id, generation },
    );
    await ctx.db.patch(s._id, {
      ...timingValues(a),
      versionId,
      versionNumber: ver.number,
      approvalId,
      generation,
      jobId,
    });
    await event(
      ctx,
      ctx.workspace._id,
      s.draftId,
      a.versionId ? "SCHEDULE_VERSION_REPLACED" : "SCHEDULE_MOVED",
      ctx.user._id,
      s._id,
    );
    return null;
  },
});
export const cancel = workspaceMutation({
  args: { scheduleId: v.id("schedules"), expectedGeneration: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const s = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.scheduleId),
    ) as Doc<"schedules">;
    if (s.generation !== a.expectedGeneration)
      throw new ConvexError("SCHEDULE_CONFLICT");
    if (s.state === "published") throw new ConvexError("PUBLISHED_IMMUTABLE");
    if (s.state === "cancelled") return null;
    if (s.jobId) await ctx.scheduler.cancel(s.jobId);
    await ctx.db.patch(s._id, {
      generation: s.generation + 1,
      state:
        s.state === "publishing" || s.publishedCount > 0
          ? "reconciliation_required"
          : "cancelled",
      errorCode: s.state === "publishing" ? "CANCEL_AFTER_CLAIM" : null,
    });
    await event(
      ctx,
      ctx.workspace._id,
      s.draftId,
      "SCHEDULE_CANCELLED",
      ctx.user._id,
      s._id,
    );
    return null;
  },
});

async function occupied(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
  at: number,
  except?: Id<"schedules">,
) {
  for (const state of ["scheduled", "publishing"] as const) {
    const rows = await ctx.db
      .query("schedules")
      .withIndex("by_workspaceId_and_accountId_and_at_and_state", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("accountId", accountId)
          .eq("at", at)
          .eq("state", state),
      )
      .take(2);
    if (rows.some((x) => x._id !== except)) return true;
  }
  return false;
}

export const addComment = workspaceMutation({
  args: { versionId: v.id("draftVersions"), text: v.string() },
  returns: v.id("editorialComments"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.versionId),
    ) as Doc<"draftVersions">;
    if (!a.text.trim() || a.text.length > 5000)
      throw new ConvexError("INVALID_COMMENT");
    return ctx.db.insert("editorialComments", {
      workspaceId: ctx.workspace._id,
      draftId: ver.draftId,
      versionId: ver._id,
      versionNumber: ver.number,
      text: a.text.trim(),
      authorId: ctx.user._id,
      resolved: false,
      createdAt: Date.now(),
    });
  },
});
export const resolveComment = workspaceMutation({
  args: { commentId: v.id("editorialComments"), expectedResolved: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const comment = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.commentId),
    ) as Doc<"editorialComments">;
    if (comment.resolved !== a.expectedResolved)
      throw new ConvexError("COMMENT_CONFLICT");
    await ctx.db.patch(comment._id, { resolved: !comment.resolved });
    return null;
  },
});
export const assign = workspaceMutation({
  args: {
    draftId: v.id("drafts"),
    assigneeId: v.union(v.id("users"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const draft = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.draftId),
    ) as Doc<"drafts">;
    if (a.assigneeId) {
      const member = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", a.assigneeId!).eq("workspaceId", ctx.workspace._id),
        )
        .unique();
      if (!member) throw new ConvexError("REFERENCE_ACCESS_DENIED");
    }
    await ctx.db.patch(draft._id, { assigneeId: a.assigneeId ?? undefined });
    await event(
      ctx,
      ctx.workspace._id,
      draft._id,
      "DRAFT_ASSIGNED",
      ctx.user._id,
    );
    return null;
  },
});

async function mediaSnapshot(
  ctx: QueryCtx,
  c: Doc<"draftVersions">["content"],
) {
  return Promise.all(
    c.media.map(async (ref) => {
      const asset = (await ctx.db.get(ref.assetId))!;
      return {
        assetId: asset._id,
        checksum: asset.checksum,
        objectKey: asset.objectKey,
      };
    }),
  );
}
async function immutableMedia(ctx: QueryCtx, ver: Doc<"draftVersions">) {
  if (ver.content.media.length !== (ver.mediaChecksums ?? []).length)
    throw new ConvexError("MEDIA_SNAPSHOT_CHANGED");
  for (const ref of ver.mediaChecksums ?? []) {
    const asset = await ctx.db.get(ref.assetId);
    if (
      !asset ||
      asset.checksum !== ref.checksum ||
      asset.objectKey !== ref.objectKey
    )
      throw new ConvexError("MEDIA_SNAPSHOT_CHANGED");
  }
}

export const history = workspaceQuery({
  args: { draftId: v.id("drafts"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(versionDoc),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.draftId));
    return ctx.db
      .query("draftVersions")
      .withIndex("by_draftId_and_number", (q) => q.eq("draftId", a.draftId))
      .order("desc")
      .paginate({
        ...a.paginationOpts,
        numItems: Math.min(20, Math.max(1, a.paginationOpts.numItems)),
      });
  },
});
