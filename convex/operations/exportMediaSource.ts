import { ConvexError, v, type Infer } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  workspaceQuery,
  requireWorkspace,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { requireR2Binding } from "../media/binding";
import { mimeLimit } from "../media/limits";
import { draftResearchProof } from "../research/contentProof";

export const selection = v.union(
  v.object({ kind: v.literal("asset"), assetId: v.id("mediaAssets") }),
  v.object({
    kind: v.literal("draftVersion"),
    versionId: v.id("draftVersions"),
    mediaPosition: v.number(),
  }),
);
export const args = {
  workspaceId: v.id("workspaces"),
  expectedAuthId: v.string(),
  expectedSessionId: v.string(),
  requestKey: v.string(),
  selection,
  expectedChecksum: v.union(v.string(), v.null()),
};
const publicFields = {
  workspaceId: v.id("workspaces"),
  authId: v.string(),
  sessionId: v.string(),
  requestKey: v.string(),
  selection,
  assetId: v.id("mediaAssets"),
  name: v.string(),
  mime: v.string(),
  size: v.number(),
  checksum: v.string(),
  role: v.union(v.literal("Owner"), v.literal("Admin")),
  observedAt: v.number(),
  proofValidUntil: v.number(),
};
export const receipt = v.object(publicFields);
const descriptor = v.object({
  ...publicFields,
  objectKey: v.string(),
  bucket: v.string(),
  r2AccountId: v.string(),
});
const input = v.object(args);
async function proof(
  ctx: QueryCtx,
  a: Infer<typeof input>,
): Promise<Infer<typeof descriptor>> {
  const { user, workspace, membership } = await requireWorkspace(
    ctx,
    a.workspaceId,
  );
  requireRole(membership, ["Owner", "Admin"]);
  const claims = await ctx.auth.getUserIdentity();
  if (
    !a.requestKey ||
    a.requestKey.length > 64 ||
    a.expectedAuthId !== user.authId ||
    a.expectedSessionId !== claims?.sessionId ||
    user.activeWorkspaceId !== workspace._id
  )
    throw new ConvexError("EXPORT_SCOPE_CHANGED");
  let assetId,
    snapshot,
    horizon: number | null = null;
  if (a.selection.kind === "asset") assetId = a.selection.assetId;
  else {
    const ver = requireReference(
      workspace._id,
      await ctx.db.get(a.selection.versionId),
    ) as Doc<"draftVersions">;
    requireReference(workspace._id, await ctx.db.get(ver.draftId));
    if (ver.content.accountId)
      requireReference(workspace._id, await ctx.db.get(ver.content.accountId));
    const position = a.selection.mediaPosition;
    if (
      !Number.isSafeInteger(position) ||
      position < 0 ||
      position >= ver.content.media.length
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    horizon = await draftResearchProof(ctx, ver);
    snapshot = ver.mediaChecksums?.[position];
    assetId = ver.content.media[position].assetId;
    if (!snapshot || snapshot.assetId !== assetId)
      throw new ConvexError("EXPORT_MEDIA_UNAVAILABLE");
  }
  const asset = requireReference(
    workspace._id,
    await ctx.db.get(assetId),
  ) as Doc<"mediaAssets">;
  const session = asset.uploadSessionId
    ? await ctx.db.get(asset.uploadSessionId)
    : null;
  if (
    !session ||
    session.workspaceId !== workspace._id ||
    session.assetId !== asset._id ||
    session.state !== "ready" ||
    asset.state !== "ready" ||
    !asset.mime ||
    session.finalKey !== asset.objectKey ||
    asset.objectKey !== `final/${workspace._id}/${asset._id}` ||
    session.expectedMime !== asset.mime ||
    session.expectedSize !== asset.size ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 1 ||
    asset.size > mimeLimit(asset.mime) ||
    !/^[a-f0-9]{64}$/.test(asset.checksum) ||
    (snapshot &&
      (snapshot.checksum !== asset.checksum ||
        snapshot.objectKey !== asset.objectKey)) ||
    (a.expectedChecksum !== null && a.expectedChecksum !== asset.checksum)
  )
    throw new ConvexError("EXPORT_MEDIA_UNAVAILABLE");
  requireR2Binding(asset);
  requireR2Binding(session);
  const observedAt = Date.now();
  const proofValidUntil = Math.min(observedAt + 30000, horizon ?? Infinity);
  if (proofValidUntil <= observedAt)
    throw new ConvexError("EXPORT_MEDIA_UNAVAILABLE");
  return {
    workspaceId: workspace._id,
    authId: user.authId,
    sessionId: a.expectedSessionId,
    requestKey: a.requestKey,
    selection: a.selection,
    role: membership.role as "Owner" | "Admin",
    assetId: asset._id,
    name: asset.name,
    mime: asset.mime,
    size: asset.size,
    checksum: asset.checksum,
    observedAt,
    proofValidUntil,
    objectKey: asset.objectKey,
    bucket: asset.bucket!,
    r2AccountId: asset.r2AccountId!,
  };
}
export const prove = internalQuery({
  args,
  returns: descriptor,
  handler: proof,
});
export const verify = workspaceQuery({
  args: {
    expectedAuthId: args.expectedAuthId,
    expectedSessionId: args.expectedSessionId,
    requestKey: args.requestKey,
    selection,
    expectedChecksum: args.expectedChecksum,
  },
  returns: receipt,
  handler: async (ctx, a) => {
    const {
      objectKey: _key,
      bucket: _bucket,
      r2AccountId: _account,
      ...safe
    } = await proof(ctx, { ...a, workspaceId: ctx.workspace._id });
    return safe;
  },
});
