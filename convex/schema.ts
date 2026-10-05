import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
  users: defineTable({
    authId: v.string(),
    defaultWorkspaceId: v.id("workspaces"),
    activeWorkspaceId: v.id("workspaces"),
  }).index("by_authId", ["authId"]),
  workspaces: defineTable({ name: v.string(), description: v.string() }),
  memberships: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_workspaceId", ["userId", "workspaceId"]),
  preferences: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    ...profileFields,
  }).index("by_userId_and_workspaceId", ["userId", "workspaceId"]),
});
