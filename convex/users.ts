import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import {
  requireIdentity,
  requireWorkspace,
  userQuery,
} from "./lib/authorization";
import { profile, role } from "./schema";

export const defaultProfile = (name: string) => ({
  name,
  timezone: "Europe/Berlin",
  language: "Deutsch" as const,
  audience: "",
  tone: "",
  topics: "",
  onboardingDone: false,
  onboardingStep: 0,
});
export async function provisionUser(
  ctx: MutationCtx,
  authId: string,
  name: string,
) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authId))
    .unique();
  if (existing) return existing._id;
  const workspaceId = await ctx.db.insert("workspaces", {
    name: "Mein Workspace",
    description: "",
  });
  const userId = await ctx.db.insert("users", {
    authId,
    defaultWorkspaceId: workspaceId,
    activeWorkspaceId: workspaceId,
  });
  await ctx.db.insert("memberships", { userId, workspaceId, role: "Owner" });
  await ctx.db.insert("preferences", {
    userId,
    workspaceId,
    ...defaultProfile(name),
  });
  return userId;
}
export const bootstrap = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await provisionUser(ctx, identity._id, identity.name);
  },
});
export const current = userQuery({
  args: {},
  returns: v.object({
    userId: v.id("users"),
    activeWorkspaceId: v.id("workspaces"),
    workspaces: v.array(
      v.object({
        id: v.id("workspaces"),
        name: v.string(),
        description: v.string(),
        role,
      }),
    ),
    preferences: profile,
  }),
  handler: async (ctx) => {
    await requireWorkspace(ctx, ctx.user.activeWorkspaceId, ctx.user);
    // ponytail: at most 100 workspaces per user; paginate if the product raises this limit.
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .take(100);
    const workspaces = [];
    for (const membership of memberships) {
      const w = await ctx.db.get(membership.workspaceId);
      if (w)
        workspaces.push({
          id: w._id,
          name: w.name,
          description: w.description,
          role: membership.role,
        });
    }
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q
          .eq("userId", ctx.user._id)
          .eq("workspaceId", ctx.user.activeWorkspaceId),
      )
      .unique();
    if (!preferences) throw new Error("Workspace profile is missing");
    const { _id, _creationTime, userId, workspaceId, ...fields } = preferences;
    return {
      userId: ctx.user._id,
      activeWorkspaceId: ctx.user.activeWorkspaceId,
      workspaces,
      preferences: fields,
    };
  },
});
