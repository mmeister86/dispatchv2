import { ConvexError, v } from "convex/values";
import {
  userMutation,
  workspaceMutation,
  workspaceQuery,
  requireWorkspace,
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
      .take(100);
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
    const current = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q
          .eq("userId", ctx.user._id)
          .eq("workspaceId", ctx.user.activeWorkspaceId),
      )
      .unique();
    await ctx.db.insert("preferences", {
      userId: ctx.user._id,
      workspaceId,
      ...defaultProfile(current?.name ?? ""),
    });
    await ctx.db.patch(ctx.user._id, { activeWorkspaceId: workspaceId });
    return workspaceId;
  },
});
