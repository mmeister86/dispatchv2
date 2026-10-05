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
  requireActiveWorkspace,
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
import { assetDoc } from "./media/assets";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { textWithinLimit } from "../shared/xText";
import { requireR2Binding } from "./media/binding";
import { mimeLimit } from "./media/limits";
import { FIRST_WRITE_MS } from "./publishing/postFields";
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
  assets: v.array(assetDoc),
  draft: draftDoc,
  versions: v.array(versionDoc),
  approvals: v.array(approvalDoc),
  schedules: v.array(scheduleDoc),
  schedulesLimited: v.boolean(),
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
const ACTIVE_SCHEDULE_LIMIT = 100;
async function activeDraftSchedules(ctx: QueryCtx, draftId: Id<"drafts">) {
  return (
    await Promise.all(
      (["scheduled", "publishing"] as const).map((state) =>
        ctx.db
          .query("schedules")
          .withIndex("by_draftId_and_state", (q) =>
            q.eq("draftId", draftId).eq("state", state),
          )
          .take(ACTIVE_SCHEDULE_LIMIT + 1),
      ),
    )
  ).flat();
}
async function versionAssets(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  versions: Doc<"draftVersions">[],
) {
  return (
    await Promise.all(
      [
        ...new Set(
          versions.flatMap((ver) =>
            ver.content.media.map((ref) => ref.assetId),
          ),
        ),
      ].map((id) => ctx.db.get(id)),
    )
  ).filter(
    (asset): asset is Doc<"mediaAssets"> =>
      asset !== null && asset.workspaceId === workspaceId,
  );
}
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
  const activeSchedules = await activeDraftSchedules(ctx, draft._id);
  const schedulesLimited = activeSchedules.length > ACTIVE_SCHEDULE_LIMIT;
  const schedules = [
    ...new Map(
      [
        ...recentSchedules,
        ...activeSchedules.slice(0, ACTIVE_SCHEDULE_LIMIT),
      ].map((s) => [s._id, s]),
    ).values(),
  ];
  for (const schedule of summary ? [] : schedules)
    if (!versions.some((v) => v._id === schedule.versionId)) {
      const version = await ctx.db.get(schedule.versionId);
      if (
        version?.workspaceId === draft.workspaceId &&
        version.draftId === draft._id
      )
        versions.push(version);
    }
  const approvals = await ctx.db
    .query("approvals")
    .withIndex("by_draftId", (q) => q.eq("draftId", draft._id))
    .order("desc")
    .take(100);
  for (const schedule of schedules)
    if (!approvals.some((a) => a._id === schedule.approvalId)) {
      const approval = await ctx.db.get(schedule.approvalId);
      if (
        approval?.workspaceId === draft.workspaceId &&
        approval.draftId === draft._id &&
        approval.versionId === schedule.versionId &&
        approval.accountId === schedule.accountId
      )
        approvals.push(approval);
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
  const assets = await versionAssets(ctx, draft.workspaceId, versions);
  return {
    assets,
    draft,
    comments,
    commentsLimited,
    historyLimited: draft.revision > (summary ? 1 : 20),
    versions,
    approvals,
    schedules,
    schedulesLimited,
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
        .withIndex("by_workspaceId_and_state", (q) =>
          q.eq("workspaceId", ctx.workspace._id).eq("state", "ready"),
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
    result.accounts = result.accounts.slice(0, 100).map((a) => ({
      _id: a._id,
      _creationTime: a._creationTime,
      workspaceId: a.workspaceId,
      provider: a.provider,
      providerIdentity: a.providerIdentity,
      name: a.name,
      handle: a.handle,
      connection: a.connection,
      capability: a.capability,
      ...(a.xEvidence ? { xEvidence: a.xEvidence } : {}),
    }));
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
  requireActiveWorkspace(await ctx.db.get(workspaceId));
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
        ref.alt.length > 1000
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
      c.text.some((t) => !textWithinLimit(t, account.provider, caps.maxText)) ||
      c.media.length > caps.maxMedia ||
      assets.some((a) => !caps.mediaTypes.includes(a.type)) ||
      (assets.some((a) => a.type === "video" || a.mime === "image/gif") &&
        assets.length !== 1) ||
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
    await recordMediaReferences(ctx, ctx.workspace._id, versionId, a.content);
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
    await recordMediaReferences(ctx, ctx.workspace._id, versionId, a.content);
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
    ).find(
      (x) =>
        x.revokedAt === null && (x.purpose ?? "publishing") === "publishing",
    );
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
export async function firstWriteContent(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  ver: Doc<"draftVersions">,
) {
  const account = await validateContent(ctx, workspaceId, ver.content);
  if (
    !account ||
    account.provider !== "X" ||
    account.connection !== "connected" ||
    !account.xEvidence?.connectionSequence ||
    ver.content.text.some((t) => !t.trim())
  )
    throw new ConvexError("X_FIRST_WRITE_ACCOUNT_REQUIRED");
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
    !credential?.envelope ||
    credential.workspaceId !== workspaceId ||
    credential.leaseUntil ||
    credential.expiresAt <= Date.now() + 30000 ||
    !binding ||
    binding.accountId !== account._id ||
    binding.workspaceId !== workspaceId
  )
    throw new ConvexError("X_REAUTH_REQUIRED");
  if (
    !["tweet.write", "tweet.read", "users.read"].every((scope) =>
      credential.scopes.includes(scope),
    ) ||
    (ver.content.media.length > 0 && !credential.scopes.includes("media.write"))
  )
    throw new ConvexError("X_SCOPE_REQUIRED");
  await checkImmutableMediaSource(ctx, ver);
  return account;
}
// Exact approved R2 source guards also apply to paused read evidence, without write authority.
export async function checkImmutableMediaSource(
  ctx: QueryCtx,
  ver: Doc<"draftVersions">,
) {
  const workspaceId = ver.workspaceId;
  await immutableMedia(ctx, ver);
  for (const [position, ref] of ver.content.media.entries()) {
    if (ver.mediaChecksums?.[position]?.assetId !== ref.assetId)
      throw new ConvexError("MEDIA_SNAPSHOT_CHANGED");
    const asset = requireReference(
      workspaceId,
      await ctx.db.get(ref.assetId),
    ) as Doc<"mediaAssets">;
    const session = asset.uploadSessionId
      ? await ctx.db.get(asset.uploadSessionId)
      : null;
    if (
      !session ||
      session.workspaceId !== workspaceId ||
      session.assetId !== asset._id ||
      session.state !== "ready"
    )
      throw new ConvexError("MEDIA_NOT_READY");
    requireR2Binding(asset);
    requireR2Binding(session);
    if (
      asset.state !== "ready" ||
      asset.storageProvider !== "r2" ||
      asset.objectKey !== `final/${workspaceId}/${asset._id}` ||
      session.finalKey !== asset.objectKey ||
      session.expectedSize !== asset.size ||
      session.expectedMime !== asset.mime ||
      !/^[a-f0-9]{64}$/.test(asset.checksum) ||
      !Number.isInteger(asset.size) ||
      asset.size < 1 ||
      asset.size > mimeLimit(asset.mime ?? "")
    )
      throw new ConvexError("MEDIA_SOURCE_CHANGED");
  }
}
export const approveFirstWrite = workspaceMutation({
  args: { versionId: v.id("draftVersions"), accountId: v.id("socialAccounts") },
  returns: v.id("approvals"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.versionId),
    ) as Doc<"draftVersions">;
    const draft = requireReference(
      ctx.workspace._id,
      await ctx.db.get(ver.draftId),
    ) as Doc<"drafts">;
    if (
      ver.content.accountId !== a.accountId ||
      draft.currentVersionId !== ver._id
    )
      throw new ConvexError("APPROVAL_ACCOUNT_MISMATCH");
    const account = await firstWriteContent(ctx, ctx.workspace._id, ver);
    if (account.capability.publish)
      throw new ConvexError("X_WRITE_ALREADY_VERIFIED");
    const existing = (
      await ctx.db
        .query("approvals")
        .withIndex("by_versionId_and_accountId", (q) =>
          q.eq("versionId", ver._id).eq("accountId", a.accountId),
        )
        .order("desc")
        .take(100)
    ).find(
      (x) =>
        x.purpose === "first_write_verification" &&
        x.actorId === ctx.user._id &&
        x.revokedAt === null &&
        (x.expiresAt ?? 0) > Date.now() &&
        x.accountConnectionSequence === account.xEvidence!.connectionSequence,
    );
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
      purpose: "first_write_verification",
      accountConnectionSequence: account.xEvidence!.connectionSequence,
      expiresAt: Date.now() + FIRST_WRITE_MS,
      mediaPlacement: "first_post",
    });
    await event(
      ctx,
      ctx.workspace._id,
      ver.draftId,
      "FIRST_WRITE_VERSION_APPROVED",
      ctx.user._id,
    );
    return id;
  },
});
export const confirmFirstWrite = workspaceMutation({
  args: {
    versionId: v.id("draftVersions"),
    accountId: v.id("socialAccounts"),
    approvalId: v.id("approvals"),
  },
  returns: v.id("schedules"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const approval = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.approvalId),
    ) as Doc<"approvals">;
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.versionId),
    ) as Doc<"draftVersions">;
    const draft = requireReference(
      ctx.workspace._id,
      await ctx.db.get(ver.draftId),
    ) as Doc<"drafts">;
    if (
      approval.purpose !== "first_write_verification" ||
      approval.actorId !== ctx.user._id ||
      approval.accountId !== a.accountId ||
      approval.versionId !== ver._id ||
      approval.revokedAt !== null ||
      draft.currentVersionId !== ver._id
    )
      throw new ConvexError("APPROVAL_PURPOSE_MISMATCH");
    const existing = await ctx.db
      .query("schedules")
      .withIndex("by_approvalId", (q) => q.eq("approvalId", approval._id))
      .first();
    if (existing) return existing._id; // Separate confirmation is idempotent; never create a second proof job.
    for (const state of [
      "scheduled",
      "publishing",
      "reconciliation_required",
      "partially_published",
    ] as const) {
      const active = await ctx.db
        .query("schedules")
        .withIndex("by_workspaceId_and_accountId_and_state", (q) =>
          q
            .eq("workspaceId", ctx.workspace._id)
            .eq("accountId", a.accountId)
            .eq("state", state),
        )
        .first();
      if (active) throw new ConvexError("FIRST_WRITE_ACTIVE_JOB");
    }
    // Actual possible effects remain an account barrier even on legacy terminal schedules without audit fields.
    for (const stage of ["unknown", "sending"] as const) {
      const effect = await ctx.db
        .query("xPostAttempts")
        .withIndex("by_workspaceId_and_accountId_and_stage", (q) =>
          q
            .eq("workspaceId", ctx.workspace._id)
            .eq("accountId", a.accountId)
            .eq("stage", stage),
        )
        .first();
      if (effect) throw new ConvexError("FIRST_WRITE_ACTIVE_JOB");
    }
    const now = Date.now(),
      fields = {
        workspaceId: ctx.workspace._id,
        draftId: ver.draftId,
        versionId: ver._id,
        versionNumber: ver.number,
        accountId: a.accountId,
        approvalId: approval._id,
        actorId: ctx.user._id,
        accountConnectionSequence: approval.accountConnectionSequence,
        generation: 1,
        at: now,
        timezone: "UTC",
        localTime: new Date(now).toISOString(),
        state: "scheduled" as const,
        publishedCount: 0,
        errorCode: null,
        jobId: null,
        purpose: "first_write_verification" as const,
        intentExpiresAt: Math.min(
          approval.expiresAt ?? 0,
          now + FIRST_WRITE_MS,
        ),
        confirmedAt: now,
        mediaPlacement: "first_post" as const,
      };
    const id = await ctx.db.insert("schedules", fields);
    await checkApproval(
      ctx,
      ctx.workspace._id,
      ver._id,
      a.accountId,
      approval._id,
      (await ctx.db.get(id))!,
    );
    const jobId = await ctx.scheduler.runAfter(
      0,
      internal.publishing.dispatch,
      { scheduleId: id, generation: 1 },
    );
    await ctx.db.patch(id, { jobId });
    await event(
      ctx,
      ctx.workspace._id,
      ver.draftId,
      "FIRST_WRITE_CONFIRMED",
      ctx.user._id,
      id,
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
  schedule?: Doc<"schedules">,
) {
  if (schedule?.abortRequestedAt !== undefined)
    throw new ConvexError("SCHEDULE_ABORT_REQUESTED");
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
  const proof =
    (approval.purpose ?? "publishing") === "first_write_verification";
  if (proof) {
    if (
      !schedule ||
      schedule.purpose !== "first_write_verification" ||
      schedule.approvalId !== approval._id ||
      schedule.versionId !== versionId ||
      schedule.accountId !== accountId ||
      schedule.workspaceId !== workspaceId ||
      schedule.actorId !== approval.actorId ||
      !schedule.confirmedAt ||
      schedule.mediaPlacement !== "first_post" ||
      approval.mediaPlacement !== "first_post"
    )
      throw new ConvexError("APPROVAL_PURPOSE_MISMATCH");
    if (
      !schedule.intentExpiresAt ||
      !approval.expiresAt ||
      Date.now() >= schedule.intentExpiresAt ||
      Date.now() >= approval.expiresAt
    )
      throw new ConvexError("FIRST_WRITE_INTENT_EXPIRED");
    const account = await firstWriteContent(ctx, workspaceId, ver);
    if (
      approval.accountConnectionSequence !==
        account.xEvidence?.connectionSequence ||
      schedule.accountConnectionSequence !== approval.accountConnectionSequence
    )
      throw new ConvexError("ACCOUNT_CONNECTION_CHANGED");
  } else {
    if (schedule?.purpose === "first_write_verification")
      throw new ConvexError("APPROVAL_PURPOSE_MISMATCH");
    await validateContent(ctx, workspaceId, ver.content, true);
  }
  await immutableMedia(ctx, ver);
  return ver;
}
export async function checkAccountConnection(
  ctx: QueryCtx,
  s: Doc<"schedules">,
) {
  const account = requireReference(
    s.workspaceId,
    await ctx.db.get(s.accountId),
  ) as Doc<"socialAccounts">;
  if (
    (s.accountConnectionSequence ?? 0) !==
    (account.xEvidence?.connectionSequence ?? 0)
  )
    throw new ConvexError("ACCOUNT_CONNECTION_CHANGED");
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
    if (
      (await activeDraftSchedules(ctx, ver.draftId)).length >=
      ACTIVE_SCHEDULE_LIMIT
    )
      throw new ConvexError("DRAFT_ACTIVE_SCHEDULE_LIMIT");
    const id = await ctx.db.insert("schedules", {
      workspaceId: ctx.workspace._id,
      draftId: ver.draftId,
      versionId: a.versionId,
      versionNumber: ver.number,
      accountId: a.accountId,
      approvalId: a.approvalId,
      actorId: ctx.user._id,
      accountConnectionSequence:
        (await ctx.db.get(a.accountId))?.xEvidence?.connectionSequence ?? 0,
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
    if (
      s.state !== "scheduled" ||
      s.purpose === "first_write_verification" ||
      s.abortRequestedAt !== undefined
    )
      throw new ConvexError("SCHEDULE_NOT_MOVABLE");
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
      accountConnectionSequence:
        (await ctx.db.get(s.accountId))?.xEvidence?.connectionSequence ?? 0,
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
    if (s.abortRequestedAt !== undefined) return null;
    if (s.generation !== a.expectedGeneration)
      throw new ConvexError("SCHEDULE_CONFLICT");
    if (s.state === "published") throw new ConvexError("PUBLISHED_IMMUTABLE");
    const attempts = await ctx.db
      .query("xPostAttempts")
      .withIndex("by_scheduleId_and_generation_and_position", (q) =>
        q.eq("scheduleId", s._id),
      )
      .take(101);
    const unresolved =
      s.state === "publishing" ||
      s.state === "reconciliation_required" ||
      attempts.length > 100 ||
      attempts.some((c) => c.stage === "sending" || c.stage === "unknown");
    if (s.state === "cancelled" && !unresolved) return null;
    if (s.jobId) await ctx.scheduler.cancel(s.jobId);
    await ctx.db.patch(s._id, {
      generation: s.generation + 1,
      abortRequestedAt: Date.now(),
      abortRequestedBy: ctx.user._id,
      state: unresolved ? "reconciliation_required" : "cancelled",
      errorCode: s.errorCode ?? (unresolved ? "CANCEL_AFTER_CLAIM" : null),
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
export async function immutableMedia(ctx: QueryCtx, ver: Doc<"draftVersions">) {
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
  returns: paginationResultValidator(
    v.object({ ...versionDoc.fields, assets: v.array(assetDoc) }),
  ),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.draftId));
    const result = await ctx.db
      .query("draftVersions")
      .withIndex("by_draftId_and_number", (q) => q.eq("draftId", a.draftId))
      .order("desc")
      .paginate({
        ...a.paginationOpts,
        numItems: Math.min(20, Math.max(1, a.paginationOpts.numItems)),
      });
    const assets = await versionAssets(ctx, ctx.workspace._id, result.page);
    return {
      ...result,
      page: result.page.map((version) => ({
        ...version,
        assets: assets.filter((asset) =>
          version.content.media.some((ref) => ref.assetId === asset._id),
        ),
      })),
    };
  },
});

async function recordMediaReferences(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  versionId: Id<"draftVersions">,
  c: Doc<"draftVersions">["content"],
) {
  for (const assetId of new Set(c.media.map((m) => m.assetId))) {
    const asset = requireReference(
      workspaceId,
      await ctx.db.get(assetId),
    ) as Doc<"mediaAssets">;
    if (asset.state !== "ready") throw new ConvexError("MEDIA_NOT_READY");
    await ctx.db.insert("mediaVersionReferences", {
      workspaceId,
      versionId,
      assetId,
    });
  }
}
