import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
} from "../lib/authorization";
import type { Doc, Id } from "../_generated/dataModel";
import { draftResearchProof } from "../research/contentProof";
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
export async function record(
  ctx: MutationCtx,
  ver: Doc<"draftVersions">,
  actorId: Id<"users">,
  kind: "accept" | "reject" | "edit",
  resulting: Doc<"draftVersions"> | null = null,
) {
  if (!ver.content.accountId) return;
  const sourceUntil = await draftResearchProof(ctx, ver);
  await ctx.db.insert("contentFeedback", {
    workspaceId: ver.workspaceId,
    accountId: ver.content.accountId,
    versionId: ver._id,
    resultingVersionId: resulting?._id ?? null,
    actorId,
    kind,
    createdAt: Date.now(),
    editExtent:
      kind === "edit" && resulting
        ? extent(ver.content.text, resulting.content.text)
        : null,
    definition: "changed-middle-codepoints-v1",
    sourceUntil,
    sourceUnavailable: false,
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
      let valid = !r.sourceUnavailable,
        sourceUntil = r.sourceUntil;
      try {
        const ver = await ctx.db.get(r.versionId);
        if (!ver || ver.sourceUnavailable) throw new Error();
        const horizon = Math.min(
          r.sourceUntil ?? Infinity,
          (await draftResearchProof(ctx, ver)) ?? Infinity,
        );
        sourceUntil = Number.isFinite(horizon) ? horizon : null;
      } catch {
        valid = false;
      }
      out.push(
        valid
          ? { ...r, sourceUntil }
          : { ...r, editExtent: null, sourceUnavailable: true },
      );
    }
    return out;
  },
});
export const purgeVersion = internalMutation({
  args: { versionId: v.id("draftVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("contentFeedback")
      .withIndex("by_versionId_and_sourceUnavailable", (q) =>
        q.eq("versionId", a.versionId).eq("sourceUnavailable", false),
      )
      .take(50);
    for (const r of rows)
      await ctx.db.patch(r._id, { editExtent: null, sourceUnavailable: true });
    if (rows.length === 50)
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
      .withIndex("by_sourceUntil", (q) => q.gt("sourceUntil", null))
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const r of batch.page) {
      try {
        const ver = await ctx.db.get(r.versionId);
        if (!ver || ver.sourceUnavailable) throw new Error();
        await draftResearchProof(ctx, ver);
      } catch {
        await ctx.db.patch(r._id, {
          editExtent: null,
          sourceUnavailable: true,
        });
      }
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(0, internal.content.feedback.sweep, {
        cursor: batch.continueCursor,
      });
    return null;
  },
});
