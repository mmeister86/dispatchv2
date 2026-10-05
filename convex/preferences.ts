import { ConvexError, v } from "convex/values";
import { profile } from "./schema";
import {
  workspaceMutation,
  requireRole,
  requireReference,
} from "./lib/authorization";
export const save = workspaceMutation({
  args: {
    profile,
    project: v.optional(
      v.object({ name: v.string(), description: v.string() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const p = args.profile;
    if (
      !p.name.trim() ||
      p.name.length > 100 ||
      p.audience.length > 4000 ||
      p.topics.length > 4000 ||
      p.tone.length > 500 ||
      !Number.isInteger(p.onboardingStep) ||
      p.onboardingStep < 0 ||
      p.onboardingStep > 3
    )
      throw new ConvexError("INVALID_PROFILE");
    try {
      new Intl.DateTimeFormat("en", { timeZone: p.timezone });
    } catch {
      throw new ConvexError("INVALID_TIMEZONE");
    }
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id),
      )
      .unique();
    requireReference(ctx.workspace._id, existing);
    if (args.project) {
      requireRole(ctx.membership, ["Owner", "Admin"]);
      if (
        !args.project.name.trim() ||
        args.project.name.length > 100 ||
        args.project.description.length > 2000
      )
        throw new ConvexError("INVALID_WORKSPACE");
      await ctx.db.patch(ctx.workspace._id, {
        name: args.project.name.trim(),
        description: args.project.description.trim(),
      });
    }
    await ctx.db.patch(existing!._id, { ...p, name: p.name.trim() });
    return null;
  },
});
