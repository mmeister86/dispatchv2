import { ConvexError, v } from "convex/values";
import { workspaceQuery } from "../lib/authorization";
import { profile, role } from "../schema";
const data = v.object({
  format: v.literal("dispatch-self-profile"),
  version: v.literal(1),
  observedAt: v.number(),
  user: v.object({ id: v.id("users"), createdAt: v.number() }),
  workspace: v.object({
    id: v.id("workspaces"),
    name: v.string(),
  }),
  membership: v.object({ role }),
  profile,
  coverage: v.object({
    kind: v.literal("selected_workspace_self_profile"),
    complete: v.literal(true),
    included: v.array(v.string()),
    unsupported: v.array(v.string()),
  }),
});
export const self = workspaceQuery({
  args: { expectedAuthId: v.string(), requestKey: v.string() },
  returns: v.object({
    requestKey: v.string(),
    authId: v.string(),
    sessionId: v.string(),
    data,
  }),
  handler: async (ctx, a) => {
    if (
      a.requestKey.length < 1 ||
      a.requestKey.length > 64 ||
      a.expectedAuthId.length < 1 ||
      a.expectedAuthId.length > 256
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      a.expectedAuthId !== ctx.user.authId ||
      ctx.user.activeWorkspaceId !== ctx.workspace._id
    )
      throw new ConvexError("EXPORT_SCOPE_CHANGED");
    const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string" || !sessionId)
      throw new ConvexError("Unauthenticated");
    const p = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id),
      )
      .unique();
    if (!p) throw new ConvexError("EXPORT_PROFILE_UNAVAILABLE");
    const result = {
      requestKey: a.requestKey,
      authId: ctx.user.authId,
      sessionId,
      data: {
        format: "dispatch-self-profile" as const,
        version: 1 as const,
        observedAt: Date.now(),
        user: { id: ctx.user._id, createdAt: ctx.user._creationTime },
        workspace: {
          id: ctx.workspace._id,
          name: ctx.workspace.name,
        },
        membership: { role: ctx.membership.role },
        profile: {
          name: p.name,
          audience: p.audience,
          tone: p.tone,
          topics: p.topics,
          timezone: p.timezone,
          language: p.language,
          onboardingDone: p.onboardingDone,
          onboardingStep: p.onboardingStep,
        },
        coverage: {
          kind: "selected_workspace_self_profile" as const,
          complete: true as const,
          included: [
            "app_user_context",
            "selected_workspace_context",
            "own_membership",
            "own_profile",
          ],
          unsupported: [
            "other_workspaces_and_people",
            "private_content_and_components",
            "drafts_research_ideas_plans_reviews",
            "notices_and_publishing_receipts",
            "financial_and_external_effects",
            "media_and_source_bytes",
            "auth_records_and_provider_copies",
          ],
        },
      },
    };
    if (
      ![
        result.data.observedAt,
        result.data.user.createdAt,
        p.onboardingStep,
      ].every((n) => Number.isFinite(n) && !Object.is(n, -0)) ||
      new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
    )
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
