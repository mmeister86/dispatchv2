import { v } from "convex/values";
export const capability = v.object({
  maxText: v.number(),
  maxThread: v.number(),
  maxMedia: v.number(),
  mediaTypes: v.array(v.union(v.literal("image"), v.literal("video"))),
  publish: v.boolean(),
});
export const mediaReference = v.object({
  assetId: v.id("mediaAssets"),
  alt: v.string(),
});
export const content = v.object({
  title: v.string(),
  text: v.array(v.string()),
  media: v.array(mediaReference),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  pillar: v.string(),
  strategy: v.string(),
});
export const publishState = v.union(
  ...(
    [
      "scheduled",
      "publishing",
      "partially_published",
      "published",
      "failed",
      "reconciliation_required",
      "cancelled",
    ] as const
  ).map((x) => v.literal(x)),
);
export const accountFields = {
  workspaceId: v.id("workspaces"),
  provider: v.union(
    v.literal("X"),
    v.literal("LinkedIn"),
    v.literal("Bluesky"),
    v.literal("Mastodon"),
  ),
  providerIdentity: v.string(),
  name: v.string(),
  handle: v.string(),
  connection: v.union(
    v.literal("connected"),
    v.literal("reauth_required"),
    v.literal("disconnected"),
  ),
  capability,
};
export const assetFields = {
  workspaceId: v.id("workspaces"),
  storageProvider: v.literal("r2"),
  objectKey: v.string(),
  checksum: v.string(),
  name: v.string(),
  type: v.union(v.literal("image"), v.literal("video")),
  size: v.number(),
  state: v.union(
    ...(
      [
        "uploading",
        "validating",
        "ready",
        "failed",
        "deleting",
        "deleted",
      ] as const
    ).map((x) => v.literal(x)),
  ),
  uploadSessionId: v.optional(v.id("mediaUploadSessions")),
  mime: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  duration: v.optional(v.number()),
  defaultAlt: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  bucket: v.optional(v.string()),
  r2AccountId: v.optional(v.string()),
};
export const draftFields = {
  workspaceId: v.id("workspaces"),
  revision: v.number(),
  currentVersionId: v.union(v.id("draftVersions"), v.null()),
  authorId: v.id("users"),
  source: v.string(),
  assigneeId: v.optional(v.id("users")),
  updatedAt: v.number(),
};
export const versionFields = {
  workspaceId: v.id("workspaces"),
  draftId: v.id("drafts"),
  number: v.number(),
  content,
  mediaChecksums: v.optional(
    v.array(
      v.object({
        assetId: v.id("mediaAssets"),
        checksum: v.string(),
        objectKey: v.string(),
      }),
    ),
  ),
  authorId: v.id("users"),
  createdAt: v.number(),
  reason: v.string(),
};
export const approvalFields = {
  workspaceId: v.id("workspaces"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  accountId: v.id("socialAccounts"),
  actorId: v.id("users"),
  createdAt: v.number(),
  revokedAt: v.union(v.number(), v.null()),
  revokedBy: v.union(v.id("users"), v.null()),
};
export const scheduleFields = {
  workspaceId: v.id("workspaces"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  versionNumber: v.optional(v.number()),
  accountId: v.id("socialAccounts"),
  approvalId: v.id("approvals"),
  actorId: v.id("users"),
  generation: v.number(),
  at: v.number(),
  timezone: v.string(),
  localTime: v.string(),
  state: publishState,
  publishedCount: v.number(),
  errorCode: v.union(v.string(), v.null()),
  jobId: v.union(v.id("_scheduled_functions"), v.null()),
};
export const eventFields = {
  workspaceId: v.id("workspaces"),
  draftId: v.id("drafts"),
  scheduleId: v.union(v.id("schedules"), v.null()),
  actorId: v.union(v.id("users"), v.null()),
  code: v.string(),
  createdAt: v.number(),
};
export const notificationFields = {
  workspaceId: v.id("workspaces"),
  scheduleId: v.id("schedules"),
  recipientId: v.id("users"),
  state: v.union(v.literal("pending"), v.literal("sent"), v.literal("blocked")),
  errorCode: v.union(v.string(), v.null()),
  createdAt: v.number(),
};

export const commentFields = {
  workspaceId: v.id("workspaces"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  authorId: v.id("users"),
  versionNumber: v.optional(v.number()),
  text: v.string(),
  resolved: v.boolean(),
  createdAt: v.number(),
};
