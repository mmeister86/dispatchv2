import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  workspaceMutation,
  workspaceInternalQuery,
  workspaceQuery,
  requireReference,
  requireRole,
} from "../lib/authorization";
import { internalQuery } from "../_generated/server";
import { assetFields } from "../lib/editorialFields";
import type { Doc } from "../_generated/dataModel";
export const assetDoc = v.object({
  _id: v.id("mediaAssets"),
  _creationTime: v.number(),
  ...assetFields,
});
export const setAlt = workspaceMutation({
  args: { assetId: v.id("mediaAssets"), alt: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const asset = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.assetId),
    ) as Doc<"mediaAssets">;
    if (asset.state !== "ready") throw new ConvexError("MEDIA_NOT_READY");
    if (!a.alt.trim() || a.alt.length > 1000)
      throw new ConvexError("INVALID_ALT");
    // Library default only. Immutable draftVersions retain their explicit alt.
    await ctx.db.patch(asset._id, { defaultAlt: a.alt.trim() });
    return null;
  },
});
export const previewSource = workspaceInternalQuery({
  args: { assetId: v.id("mediaAssets") },
  returns: v.object({
    objectKey: v.string(),
    bucket: v.string(),
    mime: v.string(),
  }),
  handler: async (ctx, a) => {
    const asset = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.assetId),
    ) as Doc<"mediaAssets">;
    if (asset.state !== "ready" || !asset.bucket || !asset.mime)
      throw new ConvexError("MEDIA_NOT_READY");
    return {
      objectKey: asset.objectKey,
      bucket: asset.bucket,
      mime: asset.mime,
    };
  },
});
// Used only by cleanup: no client object keys or credentials accepted.
export const inspect = internalQuery({
  args: { assetId: v.id("mediaAssets") },
  returns: v.union(assetDoc, v.null()),
  handler: (ctx, a) => ctx.db.get(a.assetId),
});

export const list = workspaceQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(assetDoc),
  handler: (ctx, a) =>
    ctx.db
      .query("mediaAssets")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .order("desc")
      .paginate({
        ...a.paginationOpts,
        numItems: Math.min(50, Math.max(1, a.paginationOpts.numItems)),
      }),
});
