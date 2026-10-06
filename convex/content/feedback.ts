import {
  materialWalk,
  enterMaterial,
  type MaterialWalk,
} from "../research/pipelineAccess";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
  requireActiveWorkspace,
} from "../lib/authorization";
import type { Doc, Id } from "../_generated/dataModel";
import { draftIdeaVersion, draftResearchProof } from "../research/contentProof";
import { feedbackFields } from "./feedbackFields";
// Common prefix/suffix leaves the changed middle; extent is descriptive, never semantic similarity.
export function extent(before: string[], after: string[]) {
  const a = Array.from(before.join("\n")),
    b = Array.from(after.join("\n"));
  let start = 0,
    end = 0;
  while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++;
  while (
    end < Math.min(a.length, b.length) - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  return Math.max(a.length - start - end, b.length - start - end);
}
// The same exact before/result proof protects every consumer, including legacy rows.
export async function evidence(
  ctx: QueryCtx,
  row: Pick<
    Doc<"contentFeedback">,
    | "workspaceId"
    | "accountId"
    | "versionId"
    | "resultingVersionId"
    | "actorId"
    | "kind"
    | "createdAt"
    | "sourceUntil"
    | "sourceUnavailable"
  > & { _id?: Id<"contentFeedback"> },
  walk: MaterialWalk = materialWalk(),
) {
  requireActiveWorkspace(await ctx.db.get(row.workspaceId));
  requireReference(row.workspaceId, await ctx.db.get(row.accountId));
  const ver = await ctx.db.get(row.versionId);
  const result = row.resultingVersionId
    ? await ctx.db.get(row.resultingVersionId)
    : null;
  const member = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", row.actorId).eq("workspaceId", row.workspaceId),
    )
    .unique();
  if (
    !member ||
    !(await ctx.db.get(row.actorId)) ||
    !["Owner", "Admin", "Editor"].includes(member.role) ||
    row.sourceUnavailable ||
    !ver ||
    ver.sourceUnavailable ||
    ver.workspaceId !== row.workspaceId ||
    ver.content.accountId !== row.accountId
  )
    throw new ConvexError("CONTENT_FEEDBACK_SOURCE_UNAVAILABLE");
  const draft = await ctx.db.get(ver.draftId);
  if (
    !draft ||
    draft.workspaceId !== row.workspaceId ||
    (row.kind === "edit"
      ? !result ||
        result.sourceUnavailable ||
        result.workspaceId !== row.workspaceId ||
        result.draftId !== ver.draftId ||
        result.content.accountId !== row.accountId ||
        result.number !== ver.number + 1 ||
        result.authorId !== row.actorId ||
        result.createdAt < ver.createdAt ||
        row.createdAt < result.createdAt
      : row.resultingVersionId !== null)
  )
    throw new ConvexError("CONTENT_FEEDBACK_SOURCE_UNAVAILABLE");
  const recursive =
    (await draftIdeaVersion(ctx, ver)) ||
    (result && (await draftIdeaVersion(ctx, result)));
  const owner =
    row._id ??
    `feedback:${row.versionId}:${row.resultingVersionId ?? ""}:${row.actorId}:${row.createdAt}`;
  if (recursive) enterMaterial(walk, owner, "STYLE_ANCESTRY_LIMIT");
  let beforeUntil: number | null, resultUntil: number | null;
  try {
    beforeUntil = await draftResearchProof(ctx, ver, walk);
    resultUntil = result ? await draftResearchProof(ctx, result, walk) : null;
  } finally {
    if (recursive) walk.active.delete(owner);
  }
  const until = Math.min(
    row.sourceUntil ?? Infinity,
    beforeUntil ?? Infinity,
    resultUntil ?? Infinity,
  );
  if (until <= Date.now())
    throw new ConvexError("CONTENT_FEEDBACK_SOURCE_UNAVAILABLE");
  return {
    recursive: !!recursive,
    ver,
    result,
    beforeUntil,
    resultUntil,
    sourceUntil: Number.isFinite(until) ? until : null,
  };
}
export async function record(
  ctx: MutationCtx,
  ver: Doc<"draftVersions">,
  actorId: Id<"users">,
  kind: "accept" | "reject" | "edit",
  resulting: Doc<"draftVersions"> | null = null,
) {
  if (
    !ver.content.accountId ||
    (kind === "edit" && ver.content.accountId !== resulting?.content.accountId)
  )
    return;
  const row = {
    workspaceId: ver.workspaceId,
    accountId: ver.content.accountId,
    versionId: ver._id,
    resultingVersionId: resulting?._id ?? null,
    actorId,
    kind,
    createdAt: Date.now(),
    sourceUntil: null,
    sourceUnavailable: false,
  };
  const proof = await evidence(ctx, row);
  await ctx.db.insert("contentFeedback", {
    ...row,
    editExtent:
      kind === "edit" && resulting
        ? extent(ver.content.text, resulting.content.text)
        : null,
    definition: "changed-middle-codepoints-v1",
    sourceUntil: proof.sourceUntil,
  });
}
async function remove(ctx: MutationCtx, row: Doc<"contentFeedback">) {
  await ctx.db.patch(row._id, { editExtent: null, sourceUnavailable: true });
  await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purgeFeedback, {
    feedbackId: row._id,
  });
}
export const decide = workspaceMutation({
  args: {
    versionId: v.id("draftVersions"),
    kind: v.union(v.literal("accept"), v.literal("reject")),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.versionId),
    ) as Doc<"draftVersions">;
    if (ver.sourceUnavailable)
      throw new ConvexError("CONTENT_SOURCE_UNAVAILABLE");
    await record(ctx, ver, ctx.user._id, a.kind);
    return null;
  },
});
export const list = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.array(
    v.object({
      _id: v.id("contentFeedback"),
      _creationTime: v.number(),
      ...feedbackFields,
    }),
  ),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const rows = await ctx.db
        .query("contentFeedback")
        .withIndex("by_workspaceId_and_accountId", (q) =>
          q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
        )
        .order("desc")
        .take(50),
      out = [];
    for (const r of rows) {
      try {
        const proof = await evidence(ctx, r);
        out.push({ ...r, sourceUntil: proof.sourceUntil });
      } catch (error) {
        rethrowUnexpectedSourceError(error);
        out.push({ ...r, editExtent: null, sourceUnavailable: true });
      }
    }
    return out;
  },
});
export const purgeVersion = internalMutation({
  args: { versionId: v.id("draftVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    let more = false;
    for (const field of ["versionId", "resultingVersionId"] as const) {
      const rows = await ctx.db
        .query("contentFeedback")
        .withIndex(
          field === "versionId"
            ? "by_versionId_and_sourceUnavailable"
            : "by_resultingVersionId_and_sourceUnavailable",
          (q) => q.eq(field, a.versionId).eq("sourceUnavailable", false),
        )
        .take(50);
      for (const r of rows) await remove(ctx, r);
      more ||= rows.length === 50;
    }
    if (more)
      await ctx.scheduler.runAfter(
        0,
        internal.content.feedback.purgeVersion,
        a,
      );
    return null;
  },
});
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const batch = await ctx.db
      .query("contentFeedback")
      .withIndex("by_sourceUnavailable", (q) =>
        q.eq("sourceUnavailable", false),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const r of batch.page) {
      try {
        await evidence(ctx, r);
      } catch (error) {
        rethrowUnexpectedSourceError(error);
        await remove(ctx, r);
      }
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(0, internal.content.feedback.sweep, {
        cursor: batch.continueCursor,
      });
    return null;
  },
});
