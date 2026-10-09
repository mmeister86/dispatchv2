import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireIdentity, requireActiveUser } from "./lib/authorization";
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
  if (existing) {
    requireActiveUser(existing);
    return existing._id;
  }
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
const workspaceChoice = v.object({
  id: v.id("workspaces"),
  name: v.string(),
  description: v.string(),
  role,
});
export const current = query({
  args: {},
  returns: v.union(
    v.object({
      state: v.literal("ready"),
      authId: v.string(),
      userId: v.id("users"),
      activeWorkspaceId: v.id("workspaces"),
      workspaces: v.array(workspaceChoice),
      preferences: profile,
      repairWorkspaceId: v.null(),
    }),
    v.object({
      state: v.union(
        v.literal("inactive"),
        v.literal("recovery"),
        v.literal("no-workspaces"),
        v.literal("uninitialized"),
      ),
      authId: v.string(),
      userId: v.union(v.id("users"), v.null()),
      activeWorkspaceId: v.null(),
      workspaces: v.array(workspaceChoice),
      preferences: v.null(),
      repairWorkspaceId: v.union(v.id("workspaces"), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity._id))
      .unique();
    if (!user)
      return {
        state: "uninitialized" as const,
        authId: identity._id,
        userId: null,
        activeWorkspaceId: null,
        workspaces: [],
        preferences: null,
        repairWorkspaceId: null,
      };
    if (user.lifecycle && user.lifecycle !== "active")
      return {
        state: "inactive" as const,
        authId: identity._id,
        userId: user._id,
        activeWorkspaceId: null,
        workspaces: [],
        preferences: null,
        repairWorkspaceId: null,
      };
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(101);
    if (memberships.length > 100)
      throw new ConvexError("WORKSPACE_LIMIT_REQUIRES_PAGINATION");
    const workspaces = [];
    for (const m of memberships) {
      const w = await ctx.db.get(m.workspaceId);
      if (w && (!w.lifecycle || w.lifecycle === "active"))
        workspaces.push({
          id: w._id,
          name: w.name,
          description: w.description,
          role: m.role,
        });
    }
    const target =
      workspaces.find((w) => w.id === user.activeWorkspaceId) ??
      workspaces.find((w) => w.id === user.defaultWorkspaceId) ??
      workspaces[0];
    if (target?.id === user.activeWorkspaceId) {
      const p = await ctx.db
        .query("preferences")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", user._id).eq("workspaceId", target.id),
        )
        .unique();
      if (p) {
        const preferences = {
          timezone: p.timezone,
          language: p.language,
          audience: p.audience,
          tone: p.tone,
          topics: p.topics,
          name: p.name,
          onboardingDone: p.onboardingDone,
          onboardingStep: p.onboardingStep,
        };
        return {
          state: "ready" as const,
          authId: identity._id,
          userId: user._id,
          activeWorkspaceId: target.id,
          workspaces,
          preferences,
          repairWorkspaceId: null,
        };
      }
    }
    return {
      state: target ? ("recovery" as const) : ("no-workspaces" as const),
      authId: identity._id,
      userId: user._id,
      activeWorkspaceId: null,
      workspaces,
      preferences: null,
      repairWorkspaceId: target?.id ?? null,
    };
  },
});
