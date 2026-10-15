import {
  reviewPresentation,
  frozenPresentation,
  assignmentResult,
} from "./editorial/reviewFields";
import { produce as notice } from "./editorial/notices";
import {
  currentReviewActor,
  currentReview,
  approvalReview,
  sameReview,
  historicalReviewSource,
  command,
  commandInput,
  presentation,
  loss,
} from "./editorial/reviews";
import { record as recordFeedback } from "./content/feedback";
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
  requireUser,
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
  notificationTransportFields,
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
import {
  draftResearchProof,
  ideaProofUntil,
  projectDraft,
  draftIdeaVersion,
} from "./research/contentProof";
import { currentIdeaSource } from "./content/ideas";
import { materialWalk, type MaterialWalk } from "./research/pipelineAccess";
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
  authId: v.string(),
  sessionId: v.string(),
  review: v.union(
    v.object({
      ...reviewPresentation.fields,
      stageSourceUntil: v.optional(v.union(v.number(), v.null())),
      approvalId: v.union(v.id("approvals"), v.null()),
      approvalsLimited: v.boolean(),
    }),
    v.null(),
  ),
  frozenReviews: v.array(
    v.object({ scheduleId: v.id("schedules"), ...frozenPresentation.fields }),
  ),
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
export async function checkContentSource(
  ctx: QueryCtx,
  ver: Doc<"draftVersions">,
) {
  return draftResearchProof(ctx, ver);
}
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
    .take(101);
  const approvalsLimited = approvals.length > 100;
  if (approvalsLimited) approvals.pop();
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
  for (const [i, version] of versions.entries())
    versions[i] = await projectDraft(ctx, version);
  for (const [i, comment] of comments.entries()) {
    const ver = await ctx.db.get(comment.versionId);
    const projection = ver ? await projectDraft(ctx, ver) : null;
    if (!projection || projection.sourceUnavailable)
      comments[i] = { ...comment, text: "", sourceUnavailable: true };
    else if (projection.sourceProofUntil !== undefined)
      comments[i] = {
        ...comment,
        sourceProofUntil: projection.sourceProofUntil,
      };
  }
  const assets = await versionAssets(ctx, draft.workspaceId, versions);
  const current = draft.currentVersionId
    ? await ctx.db.get(draft.currentVersionId)
    : null;
  let review = null;
  if (current && !current.sourceUnavailable)
    try {
      const status = await presentation(ctx, draft.workspaceId, current._id);
      let approvalId: Id<"approvals"> | null = null;
      let sourceUntil = status.sourceUntil ?? Infinity;
      for (const a of approvals)
        if (
          a.versionId === current._id &&
          a.accountId === current.content.accountId &&
          a.revokedAt === null &&
          (a.purpose ?? "publishing") === "publishing"
        )
          try {
            await checkApproval(
              ctx,
              draft.workspaceId,
              current._id,
              a.accountId,
              a._id,
            );
            approvalId = a._id;
            sourceUntil = Math.min(
              sourceUntil,
              a.reviewPin?.sourceUntil ?? Infinity,
            );
            break;
          } catch (e) {
            projectionLoss(e);
          }
      review = {
        ...status,
        stageSourceUntil: status.sourceUntil,
        sourceUntil: Number.isFinite(sourceUntil) ? sourceUntil : null,
        approvalId,
        approvalsLimited,
      };
    } catch (e) {
      projectionLoss(e);
    }
  const frozenReviews = await Promise.all(
    schedules.map(async (s) => ({
      scheduleId: s._id,
      ...(await frozenStatus(ctx, s)),
    })),
  );
  const actor = await requireUser(ctx),
    sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
  if (typeof sessionId !== "string") throw new ConvexError("Unauthenticated");
  return {
    authId: actor.authId,
    sessionId,
    review,
    frozenReviews,
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
        ...notificationTransportFields,
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
    result.notifications = result.notifications.map((n) => ({
      _id: n._id,
      _creationTime: n._creationTime,
      workspaceId: n.workspaceId,
      scheduleId: n.scheduleId,
      ...(n.generation === undefined ? {} : { generation: n.generation }),
      recipientId: n.recipientId,
      state: n.state,
      errorCode: n.errorCode,
      createdAt: n.createdAt,
    }));
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
    rows: v.array(
      v.object({
        schedule: scheduleDoc,
        version: versionDoc,
        frozenReview: frozenPresentation,
      }),
    ),
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
          frozenReview: await frozenStatus(ctx, schedule),
          version: await projectDraft(
            ctx,
            (await ctx.db.get(schedule.versionId))!,
          ),
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
export async function createDraftTransaction(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  a: {
    content: Doc<"draftVersions">["content"];
    source: string;
    ideaVersionId?: Id<"ideaVersions">;
    proofWalk?: MaterialWalk;
  },
) {
  await validateContent(ctx, workspaceId, a.content);
  if (a.source.length > 500) throw new ConvexError("INVALID_SOURCE");
  const sourceVersion = a.ideaVersionId
    ? (requireReference(
        workspaceId,
        await ctx.db.get(a.ideaVersionId),
      ) as Doc<"ideaVersions">)
    : null;
  if (sourceVersion) {
    await ideaProofUntil(ctx, sourceVersion, a.proofWalk, a.content.accountId);
    if (
      (sourceVersion.source.kind === "research" ||
        sourceVersion.source.kind === "context-set") &&
      (sourceVersion.source.kind === "research"
        ? a.content.accountId !== sourceVersion.source.accountId
        : sourceVersion.source.sources.some(
            (s) => "kind" in s && s.accountId !== a.content.accountId,
          ))
    )
      throw new ConvexError("RESEARCH_CONTENT_ACCOUNT_CHANGED");
  }
  const draftId = await ctx.db.insert("drafts", {
    workspaceId: workspaceId,
    revision: 1,
    currentVersionId: null,
    authorId: actorId,
    source: a.source,
    updatedAt: Date.now(),
  });
  const versionId = await ctx.db.insert("draftVersions", {
    workspaceId: workspaceId,
    draftId,
    number: 1,
    ...(a.ideaVersionId ? { ideaVersionId: a.ideaVersionId } : {}),
    ...(sourceVersion?.researchProofUntil !== undefined
      ? { researchProofUntil: sourceVersion.researchProofUntil }
      : {}),
    ...(sourceVersion?.researchCleanupPending
      ? { researchCleanupPending: true }
      : {}),
    content: a.content,
    mediaChecksums: await mediaSnapshot(ctx, a.content),
    authorId: actorId,
    createdAt: Date.now(),
    reason: "Erster Entwurf",
  });
  await recordMediaReferences(ctx, workspaceId, versionId, a.content);
  await ctx.db.patch(draftId, { currentVersionId: versionId });
  await event(ctx, workspaceId, draftId, "DRAFT_CREATED", actorId);
  return draftId;
}
export const create = workspaceMutation({
  args: { content, source: v.string() },
  returns: v.id("drafts"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    return createDraftTransaction(ctx, ctx.workspace._id, ctx.user._id, a);
  },
});
export async function saveDraftTransaction(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  a: {
    draftId: Id<"drafts">;
    expectedRevision: number;
    content: Doc<"draftVersions">["content"];
    reason: string;
    candidateVersionId?: Id<"ideaVersions">;
    expectedCurrentVersionId?: Id<"draftVersions">;
    proofWalk?: MaterialWalk;
  },
) {
  const d = requireReference(
    workspaceId,
    await ctx.db.get(a.draftId),
  ) as Doc<"drafts">;
  if (
    d.revision !== a.expectedRevision ||
    (a.expectedCurrentVersionId !== undefined &&
      d.currentVersionId !== a.expectedCurrentVersionId)
  )
    throw new ConvexError("SAVE_CONFLICT");
  const currentVersion = d.currentVersionId
    ? await ctx.db.get(d.currentVersionId)
    : null;
  if (
    !currentVersion ||
    currentVersion.workspaceId !== workspaceId ||
    currentVersion.draftId !== d._id
  )
    throw new ConvexError("DRAFT_VERSION_CHANGED");
  const walk = a.proofWalk ?? materialWalk();
  await draftResearchProof(ctx, currentVersion, walk);
  if (
    currentVersion.researchProofUntil &&
    a.content.accountId !== currentVersion.content.accountId
  )
    throw new ConvexError("RESEARCH_CONTENT_ACCOUNT_CHANGED");
  await validateContent(ctx, workspaceId, a.content);
  if (a.reason.length > 500) throw new ConvexError("INVALID_REASON");
  const sourceIdeaVersion = await draftIdeaVersion(ctx, currentVersion);
  if (sourceIdeaVersion)
    await ideaProofUntil(ctx, sourceIdeaVersion, walk, a.content.accountId);
  const candidateVersionId =
    a.candidateVersionId ?? currentVersion.candidateVersionId;
  if (candidateVersionId) {
    const { candidateProof } = await import("./research/contentProof");
    const candidate = requireReference(
      workspaceId,
      await ctx.db.get(candidateVersionId),
    ) as Doc<"ideaVersions">;
    await candidateProof(
      ctx,
      candidate,
      a.candidateVersionId !== undefined,
      walk,
    );
    if (candidate.candidate?.content.accountId !== a.content.accountId)
      throw new ConvexError("RESEARCH_CONTENT_ACCOUNT_CHANGED");
  }
  const versionId = await ctx.db.insert("draftVersions", {
    workspaceId: workspaceId,
    draftId: d._id,
    ...(candidateVersionId ? { candidateVersionId } : {}),
    number: d.revision + 1,
    ...(sourceIdeaVersion ? { ideaVersionId: sourceIdeaVersion._id } : {}),
    ...(currentVersion?.researchProofUntil !== undefined
      ? { researchProofUntil: currentVersion.researchProofUntil }
      : {}),
    ...(currentVersion?.researchCleanupPending
      ? { researchCleanupPending: true }
      : {}),
    content: a.content,
    mediaChecksums: await mediaSnapshot(ctx, a.content),
    authorId: actorId,
    createdAt: Date.now(),
    reason: a.reason,
  });
  await recordMediaReferences(ctx, workspaceId, versionId, a.content);
  await ctx.db.patch(d._id, {
    revision: d.revision + 1,
    currentVersionId: versionId,
    updatedAt: Date.now(),
  });
  await recordFeedback(
    ctx,
    currentVersion,
    actorId,
    "edit",
    (await ctx.db.get(versionId))!,
  );
  await event(ctx, workspaceId, d._id, "VERSION_SAVED", actorId);
  return versionId;
}
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
    return saveDraftTransaction(ctx, ctx.workspace._id, ctx.user._id, a);
  },
});
export const approve = workspaceMutation({
  args: { versionId: v.id("draftVersions"), accountId: v.id("socialAccounts") },
  returns: v.id("approvals"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    return approveTransaction(ctx, ctx.workspace._id, ctx.user._id, a);
  },
});
export async function approveTransaction(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  a: { versionId: Id<"draftVersions">; accountId: Id<"socialAccounts"> },
) {
  await currentReviewActor(ctx, workspaceId, actorId);
  const ver = requireReference(
    workspaceId,
    await ctx.db.get(a.versionId),
  ) as Doc<"draftVersions">;
  if (ver.content.accountId !== a.accountId)
    throw new ConvexError("APPROVAL_ACCOUNT_MISMATCH");
  const reviewPin = await currentReview(
    ctx,
    ver,
    await checkContentSource(ctx, ver),
  );
  await validateContent(ctx, workspaceId, ver.content, true);
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
      x.revokedAt === null &&
      x.actorId === actorId &&
      (x.purpose ?? "publishing") === "publishing" &&
      (sameReview(x.reviewPin, reviewPin) ||
        (!x.reviewPin && reviewPin.decisionIds.length === 0)) &&
      (x.reviewPin?.sourceUntil == null ||
        x.reviewPin.sourceUntil > Date.now()),
  );
  if (existing) return existing._id;
  const id = await ctx.db.insert("approvals", {
    workspaceId,
    draftId: ver.draftId,
    versionId: ver._id,
    accountId: a.accountId,
    actorId,
    reviewPin,
    createdAt: Date.now(),
    revokedAt: null,
    revokedBy: null,
  });
  await notice(
    ctx,
    ver,
    actorId,
    { kind: "approval", approvalId: id, revoked: false },
    reviewPin.sourceUntil,
  );
  await recordFeedback(ctx, ver, actorId, "accept");
  await event(ctx, workspaceId, ver.draftId, "VERSION_APPROVED", actorId);
  return id;
}
export async function firstWriteContent(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  ver: Doc<"draftVersions">,
) {
  await checkContentSource(ctx, ver);
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
  await checkContentSource(ctx, ver);
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
    const reviewPin = await currentReview(ctx, ver);
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
        x.accountConnectionSequence === account.xEvidence!.connectionSequence &&
        (sameReview(x.reviewPin, reviewPin) ||
          (!x.reviewPin && reviewPin.decisionIds.length === 0)) &&
        (x.reviewPin?.sourceUntil == null ||
          x.reviewPin.sourceUntil > Date.now()),
    );
    if (existing) return existing._id;
    const id = await ctx.db.insert("approvals", {
      workspaceId: ctx.workspace._id,
      draftId: ver.draftId,
      versionId: ver._id,
      accountId: a.accountId,
      actorId: ctx.user._id,
      reviewPin,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
      purpose: "first_write_verification",
      accountConnectionSequence: account.xEvidence!.connectionSequence,
      expiresAt: Date.now() + FIRST_WRITE_MS,
      mediaPlacement: "first_post",
    });
    await notice(
      ctx,
      ver,
      ctx.user._id,
      { kind: "approval", approvalId: id, revoked: false },
      reviewPin.sourceUntil,
    );
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
      approval.draftId !== ver.draftId ||
      ver.content.accountId !== a.accountId
    )
      throw new ConvexError("APPROVAL_PURPOSE_MISMATCH");
    const existing = await ctx.db
      .query("schedules")
      .withIndex("by_approvalId", (q) => q.eq("approvalId", approval._id))
      .first();
    if (existing) {
      if (
        existing.workspaceId !== ctx.workspace._id ||
        existing.versionId !== ver._id ||
        existing.draftId !== ver.draftId ||
        existing.accountId !== a.accountId ||
        existing.actorId !== ctx.user._id
      )
        throw new ConvexError("APPROVAL_PURPOSE_MISMATCH");
      await historicalReviewSource(
        ctx,
        ver,
        approval.reviewPin?.sourceUntil,
        existing.reviewPin?.sourceUntil,
        approval.expiresAt,
        existing.intentExpiresAt,
      );
      return existing._id; // Readable historical result; no new admission, job or resurrection.
    }
    if (approval.revokedAt !== null || draft.currentVersionId !== ver._id)
      throw new ConvexError("APPROVAL_PURPOSE_MISMATCH");
    const reviewPin = await approvalReview(ctx, ver, approval);
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
        reviewPin,
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
      const ver = await ctx.db.get(approval.versionId);
      if (ver)
        await notice(
          ctx,
          ver,
          ctx.user._id,
          { kind: "approval", approvalId: approval._id, revoked: true },
          approval.reviewPin?.sourceUntil ?? null,
        );
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
  if (schedule && !(await ctx.db.get(schedule.actorId)))
    throw new ConvexError("SCHEDULER_AUTHORITY_CHANGED");
  const ver = requireReference(
    workspaceId,
    await ctx.db.get(versionId),
  ) as Doc<"draftVersions">;
  const sourceUntil = await checkContentSource(ctx, ver);
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
  if (!(await ctx.db.get(approval.actorId)))
    throw new ConvexError("APPROVER_AUTHORITY_CHANGED");
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
  await approvalReview(ctx, ver, approval, schedule, sourceUntil);
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
    return scheduleTransaction(ctx, ctx.workspace._id, ctx.user._id, a);
  },
});
export async function scheduleTransaction(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  a: {
    versionId: Id<"draftVersions">;
    accountId: Id<"socialAccounts">;
    approvalId: Id<"approvals">;
    at: number;
    timezone: string;
    localTime: string;
  },
  readBudget?: { remaining: number },
) {
  await currentReviewActor(ctx, workspaceId, actorId);
  validateTime(a.at, a.timezone, a.localTime);
  const ver = await checkApproval(
    ctx,
    workspaceId,
    a.versionId,
    a.accountId,
    a.approvalId,
  );
  const reviewPin = await approvalReview(
    ctx,
    ver,
    (await ctx.db.get(a.approvalId))!,
  );
  if (
    await occupied(ctx, workspaceId, a.accountId, a.at, undefined, readBudget)
  )
    throw new ConvexError("SLOT_OCCUPIED");
  if (
    (await activeDraftSchedules(ctx, ver.draftId)).length >=
    ACTIVE_SCHEDULE_LIMIT
  )
    throw new ConvexError("DRAFT_ACTIVE_SCHEDULE_LIMIT");
  const id = await ctx.db.insert("schedules", {
    workspaceId,
    draftId: ver.draftId,
    versionId: a.versionId,
    versionNumber: ver.number,
    accountId: a.accountId,
    approvalId: a.approvalId,
    reviewPin,
    actorId,
    accountConnectionSequence:
      (await ctx.db.get(a.accountId))?.xEvidence?.connectionSequence ?? 0,
    generation: 1,
    ...timingValues(a),
    state: "scheduled",
    publishedCount: 0,
    errorCode: null,
    jobId: null,
  });
  const jobId = await ctx.scheduler.runAt(a.at, internal.publishing.dispatch, {
    scheduleId: id,
    generation: 1,
  });
  await ctx.db.patch(id, { jobId });
  await event(ctx, workspaceId, ver.draftId, "SCHEDULE_CREATED", actorId, id);
  return id;
}
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
    const unchanged = versionId === s.versionId && approvalId === s.approvalId;
    const ver = await checkApproval(
      ctx,
      ctx.workspace._id,
      versionId,
      s.accountId,
      approvalId,
      unchanged ? s : undefined,
    );
    const reviewPin = unchanged
      ? s.reviewPin
      : await approvalReview(ctx, ver, (await ctx.db.get(approvalId))!);
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
      reviewPin,
      actorId: unchanged ? s.actorId : ctx.user._id,
      generation,
      jobId,
    });
    await event(
      ctx,
      ctx.workspace._id,
      s.draftId,
      unchanged ? "SCHEDULE_MOVED" : "SCHEDULE_VERSION_REPLACED",
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

export async function scheduleBlocksSlot(
  ctx: QueryCtx,
  row: Doc<"schedules">,
  attemptsBudget = { remaining: 100 },
  readBudget?: { remaining: number },
) {
  if (
    [
      "scheduled",
      "publishing",
      "partially_published",
      "reconciliation_required",
      "published",
    ].includes(row.state) ||
    row.publishedCount > 0 ||
    row.externalPosts?.length ||
    (row.confirmedAt && row.purpose !== "first_write_verification")
  )
    return true;
  if (readBudget && readBudget.remaining <= 0)
    throw new ConvexError("SLOT_SCAN_LIMIT");
  const limit = Math.min(
    attemptsBudget.remaining,
    readBudget?.remaining ?? 100,
  );
  const attempts = await ctx.db
    .query("xPostAttempts")
    .withIndex("by_scheduleId_and_generation_and_position", (q) =>
      q.eq("scheduleId", row._id),
    )
    .take(limit + 1);
  if (attempts.length > limit) throw new ConvexError("SLOT_SCAN_LIMIT");
  attemptsBudget.remaining -= attempts.length;
  if (readBudget) readBudget.remaining -= attempts.length;
  return attempts.some(
    (a) =>
      ["confirmed", "sending", "unknown"].includes(a.stage) ||
      a.externalId ||
      a.confirmedAt,
  );
}
export async function occupied(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
  at: number,
  except?: Id<"schedules">,
  readBudget?: { remaining: number },
) {
  if (readBudget && readBudget.remaining <= 0)
    throw new ConvexError("SLOT_SCAN_LIMIT");
  // Preserve indexed certainty even when harmless cancelled history exceeds the scan cap.
  for (const state of [
    "scheduled",
    "publishing",
    "partially_published",
    "reconciliation_required",
    "published",
  ] as const) {
    if (readBudget && readBudget.remaining <= 0)
      throw new ConvexError("SLOT_SCAN_LIMIT");
    const limit = Math.min(2, readBudget?.remaining ?? 2);
    const active = await ctx.db
      .query("schedules")
      .withIndex("by_workspaceId_and_accountId_and_at_and_state", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("accountId", accountId)
          .eq("at", at)
          .eq("state", state),
      )
      .take(limit);
    if (readBudget) readBudget.remaining -= active.length;
    if (active.some((s) => s._id !== except)) return true;
  }
  const limit = Math.min(100, readBudget?.remaining ?? 100);
  const rows = await ctx.db
    .query("schedules")
    .withIndex("by_workspaceId_and_accountId_and_at", (q) =>
      q.eq("workspaceId", workspaceId).eq("accountId", accountId).eq("at", at),
    )
    .take(limit + 1);
  if (rows.length > limit) throw new ConvexError("SLOT_SCAN_LIMIT");
  if (readBudget) readBudget.remaining -= rows.length;
  const attemptsBudget = { remaining: 100 };
  for (const row of rows)
    if (
      row._id !== except &&
      (await scheduleBlocksSlot(ctx, row, attemptsBudget, readBudget))
    )
      return true;
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
    await checkContentSource(ctx, ver);
    if (!a.text.trim() || a.text.length > 5000)
      throw new ConvexError("INVALID_COMMENT");
    return ctx.db.insert("editorialComments", {
      workspaceId: ctx.workspace._id,
      draftId: ver.draftId,
      versionId: ver._id,
      versionNumber: ver.number,
      ...(ver.researchProofUntil !== undefined
        ? { researchProofUntil: ver.researchProofUntil }
        : {}),
      ...(ver.researchCleanupPending ? { researchCleanupPending: true } : {}),
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
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(comment.versionId),
    ) as Doc<"draftVersions">;
    const draft = requireReference(
      ctx.workspace._id,
      await ctx.db.get(comment.draftId),
    ) as Doc<"drafts">;
    if (comment.sourceUnavailable || ver.draftId !== draft._id)
      throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
    await historicalReviewSource(ctx, ver, comment.researchProofUntil);
    if (comment.resolved !== a.expectedResolved)
      throw new ConvexError("COMMENT_CONFLICT");
    await ctx.db.patch(comment._id, { resolved: !comment.resolved });
    return null;
  },
});
export const assign = workspaceMutation({
  args: {
    draftId: v.id("drafts"),
    versionId: v.id("draftVersions"),
    assigneeId: v.union(v.id("users"), v.null()),
    expectedAssignmentRevision: v.number(),
    commandKey: v.string(),
  },
  returns: assignmentResult,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    commandInput(a.commandKey, a.expectedAssignmentRevision);
    const draft = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.draftId),
    ) as Doc<"drafts">;
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.versionId),
    ) as Doc<"draftVersions">;
    if (ver.draftId !== draft._id)
      throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
    const until = await historicalReviewSource(ctx, ver);
    if (a.assigneeId) {
      const member = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", a.assigneeId!).eq("workspaceId", ctx.workspace._id),
        )
        .unique();
      if (!member || !(await ctx.db.get(a.assigneeId)))
        throw new ConvexError("REFERENCE_ACCESS_DENIED");
    }
    const { old, fingerprint } = await command(
      ctx,
      ctx.workspace._id,
      ctx.user._id,
      a.commandKey,
      [
        "assignment",
        draft._id,
        ver._id,
        ver.content.accountId,
        a.expectedAssignmentRevision,
        a.assigneeId,
      ],
    );
    if (old) return old.assignmentResult!;
    if (
      draft.currentVersionId !== ver._id ||
      (draft.assignmentRevision ?? 0) !== a.expectedAssignmentRevision
    )
      throw new ConvexError("ASSIGNMENT_CONFLICT");
    const result = {
      revision: a.expectedAssignmentRevision + 1,
      assigneeId: a.assigneeId,
      versionId: ver._id,
    };
    await ctx.db.patch(draft._id, {
      assigneeId: a.assigneeId ?? undefined,
      assignmentRevision: result.revision,
    });
    const commandId = await ctx.db.insert("editorialReviewCommands", {
      workspaceId: ctx.workspace._id,
      accountId: ver.content.accountId,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      kind: "assignment",
      draftId: draft._id,
      versionId: ver._id,
      ...(a.assigneeId ? { assigneeId: a.assigneeId } : {}),
      fingerprint,
      assignmentResult: result,
      sourceUntil: until,
      sourceUnavailable: false,
    });
    await event(
      ctx,
      ctx.workspace._id,
      draft._id,
      "DRAFT_ASSIGNED",
      ctx.user._id,
    );
    await notice(
      ctx,
      ver,
      ctx.user._id,
      { kind: "assignment", commandId },
      until,
    );
    await ctx.scheduler.runAfter(0, internal.editorial.notices.cleanupVersion, {
      versionId: ver._id,
      cursor: null,
    });
    return result;
  },
});

export async function mediaSnapshot(
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
export async function immutableMedia(
  ctx: QueryCtx,
  ver: Pick<Doc<"draftVersions">, "content" | "mediaChecksums">,
) {
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
    result.page = await Promise.all(
      result.page.map((ver) => projectDraft(ctx, ver)),
    );
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

export async function recordMediaReferences(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  versionId: Id<"draftVersions"> | Id<"ideaVersions">,
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

function projectionLoss(e: unknown) {
  if (
    e instanceof ConvexError &&
    [
      "APPROVAL_REQUIRED",
      "APPROVER_AUTHORITY_CHANGED",
      "SCHEDULER_AUTHORITY_CHANGED",
      "APPROVAL_PURPOSE_MISMATCH",
      "FIRST_WRITE_INTENT_EXPIRED",
      "ACCOUNT_CONNECTION_CHANGED",
      "ACCOUNT_REAUTH_OR_CAPABILITY_REQUIRED",
      "MEDIA_NOT_READY",
      "MEDIA_SNAPSHOT_CHANGED",
      "SCHEDULE_ABORT_REQUESTED",
      "X_REAUTH_REQUIRED",
      "X_SCOPE_REQUIRED",
      "CAPABILITY_VALIDATION_FAILED",
    ].includes(String(e.data))
  )
    return;
  loss(e);
}
async function frozenStatus(ctx: QueryCtx, s: Doc<"schedules">) {
  try {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", s.actorId).eq("workspaceId", s.workspaceId),
      )
      .unique();
    if (!m || !["Owner", "Admin"].includes(m.role))
      throw new ConvexError("SCHEDULER_AUTHORITY_CHANGED");
    await checkAccountConnection(ctx, s);
    const ver = await checkApproval(
      ctx,
      s.workspaceId,
      s.versionId,
      s.accountId,
      s.approvalId,
      s,
    );
    return {
      usable: true,
      sourceUntil: await historicalReviewSource(
        ctx,
        ver,
        s.reviewPin?.sourceUntil,
        (await ctx.db.get(s.approvalId))?.reviewPin?.sourceUntil,
      ),
    };
  } catch (e) {
    projectionLoss(e);
    return { usable: false, sourceUntil: s.reviewPin?.sourceUntil ?? null };
  }
}
