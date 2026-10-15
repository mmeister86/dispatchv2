import { v } from "convex/values";
export const feedbackFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  versionId: v.id("draftVersions"),
  resultingVersionId: v.union(v.id("draftVersions"), v.null()),
  actorId: v.id("users"),
  kind: v.union(v.literal("accept"), v.literal("reject"), v.literal("edit")),
  createdAt: v.number(),
  sequence: v.optional(v.number()),
  editExtent: v.union(v.number(), v.null()),
  definition: v.literal("changed-middle-codepoints-v1"),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
};
