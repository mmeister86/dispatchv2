import { ConvexError, v } from "convex/values";
import {
  userMutation,
  requireIdentity,
  workspaceMutation,
  workspaceQuery,
} from "./lib/authorization";
import { defaultProfile } from "./users";

export const get = workspaceQuery({
  args: {},
  returns: v.object({
    id: v.id("workspaces"),
    name: v.string(),
    description: v.string(),
  }),
  handler: (ctx) => ({
    id: ctx.workspace._id,
    name: ctx.workspace.name,
    description: ctx.workspace.description,
  }),
});
export const select = workspaceMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id),
      )
      .unique();
    if (!preferences)
      await ctx.db.insert("preferences", {
        userId: ctx.user._id,
        workspaceId: ctx.workspace._id,
        ...defaultProfile(identity.name),
        ...(ctx.membership.role === "Viewer"
          ? { onboardingDone: true, onboardingStep: 3 }
          : {}),
      });
    await ctx.db.patch(ctx.user._id, { activeWorkspaceId: ctx.workspace._id });
    return null;
  },
});
export const create = userMutation({
  args: { name: v.string(), description: v.string() },
  returns: v.id("workspaces"),
  handler: async (ctx, args) => {
    if (
      !args.name.trim() ||
      args.name.length > 100 ||
      args.description.length > 2000
    )
      throw new ConvexError("INVALID_WORKSPACE");
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .take(101);
    if (memberships.length >= 100) throw new ConvexError("WORKSPACE_LIMIT");
    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name.trim(),
      description: args.description.trim(),
    });
    await ctx.db.insert("memberships", {
      userId: ctx.user._id,
      workspaceId,
      role: "Owner",
    });
    const identity = await requireIdentity(ctx);
    await ctx.db.insert("preferences", {
      userId: ctx.user._id,
      workspaceId,
      ...defaultProfile(identity.name),
    });
    await ctx.db.patch(ctx.user._id, { activeWorkspaceId: workspaceId });
    return workspaceId;
  },
});
