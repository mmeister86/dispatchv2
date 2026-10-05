import { v } from "convex/values";
export const mediaJob = {
  scheduleId: v.id("schedules"),
  generation: v.number(),
  mediaPosition: v.number(),
};
export const mediaPhase = v.union(
  ...(
    [
      "initialize",
      "append",
      "finalize",
      "processing",
      "metadata",
      "ready",
      "failed",
      "uncertain",
      "expired",
      "blocked",
    ] as const
  ).map(v.literal),
);
export const mediaSource = v.object({
  workspaceId: v.id("workspaces"),
  versionId: v.id("draftVersions"),
  accountId: v.id("socialAccounts"),
  assetId: v.id("mediaAssets"),
  objectKey: v.string(),
  checksum: v.string(),
  alt: v.string(),
  size: v.number(),
  mime: v.string(),
  bucket: v.string(),
  r2AccountId: v.string(),
});
export const checkpointFields = {
  ...mediaJob,
  ...mediaSource.fields,
  attempt: v.number(),
  phase: mediaPhase,
  claimSequence: v.number(),
  leaseUntil: v.number(),
  operation: v.optional(
    v.union(
      v.literal("read"),
      v.literal("initialize"),
      v.literal("append"),
      v.literal("finalize"),
      v.literal("status"),
      v.literal("metadata"),
    ),
  ),
  credentialGeneration: v.optional(v.number()),
  mediaId: v.optional(v.string()),
  nextSegment: v.number(),
  expiresAt: v.optional(v.number()),
  nextCheckAt: v.number(),
  deadline: v.number(),
  statusReads: v.number(),
  metadataApplied: v.boolean(),
  bytesRead: v.number(),
  bytesUploaded: v.number(),
  bytesSubmitted: v.number(),
  chunkCount: v.number(),
  providerRequests: v.number(),
  durationMs: v.number(),
  measurementIncomplete: v.boolean(),
  errorCode: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const checkpointDoc = v.object({
  _id: v.id("xMediaCheckpoints"),
  _creationTime: v.number(),
  ...checkpointFields,
});
export const CHUNK_BYTES = 4 * 1024 * 1024;
export const EXPIRY_MARGIN_MS = 60000;
export const MEDIA_BUDGET_MS = 30 * 60000;
