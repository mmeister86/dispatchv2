import { ConvexError, v } from "convex/values";
import {
  workspaceMutation,
  workspaceQuery,
  workspaceInternalMutation,
  requireReference,
  requireRole,
  requireActiveWorkspace,
} from "../lib/authorization";
import { internalMutation } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  mimeLimit,
  ASSET_LIMIT,
  QUOTA_BYTES,
  GRANT_MS,
  LEASE_MS,
} from "./limits";
import { configuredR2Binding, requireR2Binding } from "./binding";
const sessionFields = {
  _id: v.id("mediaUploadSessions"),
  _creationTime: v.number(),
  workspaceId: v.id("workspaces"),
  assetId: v.id("mediaAssets"),
  userId: v.optional(v.id("users")),
  requestId: v.optional(v.string()),
  temporaryKey: v.string(),
  finalKey: v.string(),
  bucket: v.string(),
  r2AccountId: v.optional(v.string()),
  expectedSize: v.number(),
  expectedMime: v.string(),
  expiresAt: v.number(),
  state: v.union(
    ...(
      [
        "uploading",
        "validating",
        "ready",
        "failed",
        "cancelled",
        "deleted",
      ] as const
    ).map((x) => v.literal(x)),
  ),
  leaseUntil: v.number(),
  generation: v.number(),
  cleanAfter: v.number(),
  deletedAt: v.optional(v.number()),
  errorCode: v.optional(v.string()),
};
export const sessionDoc = v.object(sessionFields);
export const reserve = workspaceInternalMutation({
  args: {
    requestId: v.string(),
    name: v.string(),
    size: v.number(),
    mime: v.string(),
    alt: v.string(),
  },
  returns: sessionDoc,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    if (
      !/^[a-f0-9-]{36}$/i.test(a.requestId) ||
      !a.name.trim() ||
      a.name.length > 200 ||
      !a.alt.trim() ||
      a.alt.length > 1000 ||
      !Number.isSafeInteger(a.size) ||
      a.size < 1 ||
      a.size > mimeLimit(a.mime)
    )
      throw new ConvexError("INVALID_MEDIA_UPLOAD");
    // Bucket is resolved from server configuration; no client bucket or object key is accepted.
    const binding = configuredR2Binding();
    const existing = await ctx.db
      .query("mediaUploadSessions")
      .withIndex("by_workspaceId_and_requestId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("requestId", a.requestId),
      )
      .unique();
    if (existing) {
      requireR2Binding(existing, binding);
      const asset = await ctx.db.get(existing.assetId);
      if (!asset) throw new ConvexError("UPLOAD_SESSION_CLOSED");
      requireR2Binding(asset, binding);
      if (
        existing.userId !== ctx.user._id ||
        existing.expectedSize !== a.size ||
        existing.expectedMime !== a.mime
      )
        throw new ConvexError("UPLOAD_REQUEST_CONFLICT");
      if (existing.state !== "uploading" || existing.expiresAt <= Date.now())
        throw new ConvexError("UPLOAD_SESSION_EXPIRED");
      return existing;
    }
    let used = ctx.workspace.mediaReservedBytes,
      count = ctx.workspace.mediaAssetCount;
    if (used === undefined || count === undefined) {
      const assets = await ctx.db
        .query("mediaAssets")
        .withIndex("by_workspaceId", (q) =>
          q.eq("workspaceId", ctx.workspace._id),
        )
        .take(ASSET_LIMIT + 1);
      if (assets.length > ASSET_LIMIT)
        throw new ConvexError("MEDIA_QUOTA_REQUIRES_MIGRATION");
      const live = assets.filter((x) => x.state !== "deleted");
      used = live.reduce((sum, x) => sum + x.size, 0);
      count = live.length;
    }
    if (used + a.size > QUOTA_BYTES || count >= ASSET_LIMIT)
      throw new ConvexError("MEDIA_QUOTA_EXCEEDED");
    const assetId = await ctx.db.insert("mediaAssets", {
      workspaceId: ctx.workspace._id,
      storageProvider: "r2",
      objectKey: "",
      checksum: "",
      name: a.name.trim(),
      type: a.mime.startsWith("video/") ? "video" : "image",
      size: a.size,
      state: "uploading",
      defaultAlt: a.alt.trim(),
      ...binding,
    });
    const expiresAt = Date.now() + GRANT_MS;
    const sessionId = await ctx.db.insert("mediaUploadSessions", {
      workspaceId: ctx.workspace._id,
      assetId,
      userId: ctx.user._id,
      requestId: a.requestId,
      temporaryKey: `temporary/${ctx.workspace._id}/${assetId}`,
      finalKey: `final/${ctx.workspace._id}/${assetId}`,
      ...binding,
      expectedSize: a.size,
      expectedMime: a.mime,
      expiresAt,
      state: "uploading",
      leaseUntil: 0,
      generation: 0,
      cleanAfter: expiresAt + 60000,
    });
    await ctx.db.patch(assetId, { uploadSessionId: sessionId });
    await ctx.db.patch(ctx.workspace._id, {
      mediaReservedBytes: used + a.size,
      mediaAssetCount: count + 1,
    });
    return (await ctx.db.get(sessionId))!;
  },
});
export const claim = workspaceInternalMutation({
  args: { sessionId: v.id("mediaUploadSessions") },
  returns: sessionDoc,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const s = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.sessionId),
    ) as Doc<"mediaUploadSessions">;
    if (
      s.userId !== ctx.user._id &&
      !["Owner", "Admin"].includes(ctx.membership.role)
    )
      throw new ConvexError("ROLE_ACCESS_DENIED");
    const asset = await ctx.db.get(s.assetId);
    requireR2Binding(s);
    if (asset) requireR2Binding(asset);
    if (s.state === "ready" && asset?.state === "ready") return s;
    if (
      !asset ||
      ["cancelled", "deleted", "failed"].includes(s.state) ||
      ["deleting", "deleted"].includes(asset.state)
    )
      throw new ConvexError("UPLOAD_SESSION_CLOSED");
    if (s.state === "validating" && s.leaseUntil > Date.now())
      throw new ConvexError("MEDIA_VALIDATION_IN_PROGRESS");
    if (s.state === "uploading" && s.expiresAt + 60000 < Date.now())
      throw new ConvexError("UPLOAD_SESSION_EXPIRED");
    const leaseUntil = Date.now() + LEASE_MS,
      generation = s.generation + 1;
    await ctx.db.patch(s._id, {
      state: "validating",
      leaseUntil,
      generation,
      cleanAfter: Math.max(leaseUntil, s.expiresAt + 60000),
    });
    // Final key is fixed before ANY external storage work, reused after crashes.
    await ctx.db.patch(s.assetId, {
      state: "validating",
      objectKey: s.finalKey,
    });
    return {
      ...s,
      state: "validating" as const,
      leaseUntil,
      generation,
      cleanAfter: Math.max(leaseUntil, s.expiresAt + 60000),
    };
  },
});
export const metadata = v.object({
  mime: v.string(),
  type: v.union(v.literal("image"), v.literal("video")),
  size: v.number(),
  width: v.number(),
  height: v.number(),
  checksum: v.string(),
  duration: v.optional(v.number()),
});
export const complete = internalMutation({
  args: {
    sessionId: v.id("mediaUploadSessions"),
    generation: v.number(),
    metadata,
  },
  returns: v.id("mediaAssets"),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sessionId);
    if (!s) throw new ConvexError("UPLOAD_SESSION_CLOSED");
    requireActiveWorkspace(await ctx.db.get(s.workspaceId));
    const asset = await ctx.db.get(s.assetId);
    requireR2Binding(s);
    if (asset) requireR2Binding(asset);
    if (s.state === "ready" && asset?.state === "ready") return s.assetId;
    if (
      s.state !== "validating" ||
      s.generation !== a.generation ||
      asset?.state !== "validating"
    )
      throw new ConvexError("UPLOAD_SESSION_CLOSED");
    if (
      a.metadata.size !== s.expectedSize ||
      a.metadata.mime !== s.expectedMime ||
      !a.metadata.checksum
    )
      throw new ConvexError("MEDIA_VALIDATION_FAILED");
    await ctx.db.patch(s.assetId, {
      ...a.metadata,
      state: "ready",
      objectKey: s.finalKey,
      errorCode: undefined,
    });
    await ctx.db.patch(s._id, {
      state: "ready",
      leaseUntil: 0,
      cleanAfter: s.expiresAt + 60000,
    });
    return s.assetId;
  },
});
export const fail = internalMutation({
  args: {
    sessionId: v.id("mediaUploadSessions"),
    generation: v.number(),
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.sessionId);
    if (s?.state === "validating" && s.generation === a.generation) {
      await ctx.db.patch(s._id, { state: "failed", errorCode: a.code });
      await ctx.db.patch(s.assetId, { state: "failed", errorCode: a.code });
    }
    return null;
  },
});
export const remove = workspaceMutation({
  args: { assetId: v.id("mediaAssets") },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const asset = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.assetId),
    ) as Doc<"mediaAssets">;
    if (asset.state === "deleted" || asset.state === "deleting") return null;
    // Legacy fixtures may have unindexed old versions; fail closed until explicitly migrated.
    if (!asset.uploadSessionId)
      throw new ConvexError("MEDIA_LEGACY_REFERENCE_REVIEW");
    if (
      await ctx.db
        .query("mediaVersionReferences")
        .withIndex("by_assetId", (q) => q.eq("assetId", asset._id))
        .first()
    )
      throw new ConvexError("MEDIA_REFERENCED");
    const s = await ctx.db.get(asset.uploadSessionId);
    if (!s) throw new ConvexError("UPLOAD_SESSION_CLOSED");
    await ctx.db.patch(asset._id, { state: "deleting" });
    await ctx.db.patch(s._id, {
      state: "cancelled",
      cleanAfter: Math.max(Date.now(), s.leaseUntil, s.expiresAt + 60000),
    });
    return null;
  },
});
export const authorize = workspaceQuery({
  args: {},
  returns: v.null(),
  handler: () => null,
});
