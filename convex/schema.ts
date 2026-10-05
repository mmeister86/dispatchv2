import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
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

export const role = v.union(
  v.literal("Owner"),
  v.literal("Admin"),
  v.literal("Editor"),
  v.literal("Viewer"),
);
export const profileFields = {
  timezone: v.string(),
  language: v.union(v.literal("Deutsch"), v.literal("English")),
  audience: v.string(),
  tone: v.string(),
  topics: v.string(),
  name: v.string(),
  onboardingDone: v.boolean(),
  onboardingStep: v.number(),
};
export const profile = v.object(profileFields);
export default defineSchema({
  mediaUploadSessions: defineTable({
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
  })
    .index("by_workspaceId_and_requestId", ["workspaceId", "requestId"])
    .index("by_assetId", ["assetId"])
    .index("by_cleanAfter", ["cleanAfter"]),
  mediaVersionReferences: defineTable({
    workspaceId: v.id("workspaces"),
    assetId: v.id("mediaAssets"),
    versionId: v.id("draftVersions"),
  })
    .index("by_assetId", ["assetId"])
    .index("by_versionId", ["versionId"]),
  editorialComments: defineTable(commentFields).index("by_draftId", [
    "draftId",
  ]),
  socialAccounts: defineTable(accountFields).index("by_workspaceId", [
    "workspaceId",
  ]),
  mediaAssets: defineTable(assetFields)
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_state", ["workspaceId", "state"]),
  drafts: defineTable(draftFields).index("by_workspaceId_and_updatedAt", [
    "workspaceId",
    "updatedAt",
  ]),
  draftVersions: defineTable(versionFields).index("by_draftId_and_number", [
    "draftId",
    "number",
  ]),
  approvals: defineTable(approvalFields)
    .index("by_versionId_and_accountId", ["versionId", "accountId"])
    .index("by_draftId", ["draftId"]),
  schedules: defineTable(scheduleFields)
    .index("by_workspaceId_and_at", ["workspaceId", "at"])
    .index("by_workspaceId_and_accountId_and_at", [
      "workspaceId",
      "accountId",
      "at",
    ])
    .index("by_draftId", ["draftId"])
    .index("by_draftId_and_state", ["draftId", "state"])
    .index("by_workspaceId_and_accountId_and_at_and_state", [
      "workspaceId",
      "accountId",
      "at",
      "state",
    ]),
  editorialEvents: defineTable(eventFields).index(
    "by_workspaceId_and_createdAt",
    ["workspaceId", "createdAt"],
  ),
  publishingNotifications: defineTable(notificationFields).index(
    "by_workspaceId_and_createdAt",
    ["workspaceId", "createdAt"],
  ),
  users: defineTable({
    authId: v.string(),
    defaultWorkspaceId: v.id("workspaces"),
    activeWorkspaceId: v.id("workspaces"),
  }).index("by_authId", ["authId"]),
  workspaces: defineTable({
    name: v.string(),
    description: v.string(),
    lifecycle: v.optional(
      v.union(v.literal("active"), v.literal("deleting"), v.literal("deleted")),
    ),
    mediaReservedBytes: v.optional(v.number()),
    mediaAssetCount: v.optional(v.number()),
  }),
  memberships: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role,
  })
    .index("by_userId", ["userId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_userId_and_workspaceId", ["userId", "workspaceId"]),
  preferences: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    ...profileFields,
  }).index("by_userId_and_workspaceId", ["userId", "workspaceId"]),
});
