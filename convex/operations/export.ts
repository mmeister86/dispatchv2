import { draftResearchProof } from "../research/contentProof";
import { ConvexError, v } from "convex/values";
import { requireRole, workspaceQuery } from "../lib/authorization";
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

const sharedVersion = v.object({
  versionId: v.id("draftVersions"),
  draftId: v.id("drafts"),
  versionNumber: v.number(),
  createdAt: v.number(),
  title: v.string(),
  text: v.array(v.string()),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  pillar: v.string(),
  strategy: v.string(),
  reason: v.string(),
});
export const versions = workspaceQuery({
  args: {
    expectedAuthId: v.string(),
    requestKey: v.string(),
    cursor: v.union(v.string(), v.null()),
    creationUpperBound: v.union(v.number(), v.null()),
  },
  returns: v.object({
    requestKey: v.string(),
    authId: v.string(),
    sessionId: v.string(),
    workspaceId: v.id("workspaces"),
    role,
    creationUpperBound: v.number(),
    cursor: v.string(),
    isDone: v.boolean(),
    observedAt: v.number(),
    proofValidUntil: v.number(),
    data: v.object({
      format: v.literal("dispatch-workspace-draft-versions"),
      version: v.literal(1),
      workspaceId: v.id("workspaces"),
      versions: v.array(sharedVersion),
    }),
  }),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    if (
      !a.requestKey ||
      a.requestKey.length > 64 ||
      !a.expectedAuthId ||
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
    const observedAt = Date.now();
    if (!Number.isFinite(observedAt) || Object.is(observedAt, -0))
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    if (
      (a.cursor !== null && (!a.cursor || a.creationUpperBound === null)) ||
      (a.cursor === null && a.creationUpperBound !== null) ||
      (a.creationUpperBound !== null &&
        (!Number.isFinite(a.creationUpperBound) ||
          Object.is(a.creationUpperBound, -0) ||
          a.creationUpperBound > observedAt ||
          a.creationUpperBound < 0))
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const creationUpperBound = a.creationUpperBound ?? observedAt;
    const page = await ctx.db
      .query("draftVersions")
      .withIndex("by_workspaceId", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .lte("_creationTime", creationUpperBound),
      )
      .order("asc")
      .paginate({ numItems: 1, cursor: a.cursor });
    if (page.page.length > 1) throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    let proofValidUntil = observedAt + 30_000;
    const rows = [];
    for (const ver of page.page) {
      if (ver.workspaceId !== ctx.workspace._id)
        throw new ConvexError("REFERENCE_ACCESS_DENIED");
      const root = await ctx.db.get(ver.draftId);
      if (root && root.workspaceId !== ver.workspaceId)
        throw new ConvexError("REFERENCE_ACCESS_DENIED");
      const account = ver.content.accountId
        ? await ctx.db.get(ver.content.accountId)
        : null;
      if (account && account.workspaceId !== ver.workspaceId)
        throw new ConvexError("REFERENCE_ACCESS_DENIED");
      if (
        ver.researchProofUntil !== undefined &&
        (!Number.isFinite(ver.researchProofUntil) ||
          Object.is(ver.researchProofUntil, -0))
      )
        throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
      if (
        !root ||
        (ver.content.accountId && !account) ||
        ver.sourceUnavailable ||
        (Number.isFinite(ver.researchProofUntil) &&
          ver.researchProofUntil! <= observedAt)
      )
        continue;
      const until = await draftResearchProof(ctx, ver);
      if (until !== null) {
        if (!Number.isFinite(until) || Object.is(until, -0))
          throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
        if (until <= observedAt) continue;
        proofValidUntil = Math.min(proofValidUntil, until);
      }
      rows.push({
        versionId: ver._id,
        draftId: ver.draftId,
        versionNumber: ver.number,
        createdAt: ver.createdAt,
        title: ver.content.title,
        text: ver.content.text,
        accountId: ver.content.accountId,
        pillar: ver.content.pillar,
        strategy: ver.content.strategy,
        reason: ver.reason,
      });
    }
    const result = {
      requestKey: a.requestKey,
      authId: ctx.user.authId,
      sessionId,
      workspaceId: ctx.workspace._id,
      role: ctx.membership.role,
      creationUpperBound,
      cursor: page.continueCursor,
      isDone: page.isDone,
      observedAt,
      proofValidUntil,
      data: {
        format: "dispatch-workspace-draft-versions" as const,
        version: 1 as const,
        workspaceId: ctx.workspace._id,
        versions: rows,
      },
    };
    if (
      ![
        observedAt,
        proofValidUntil,
        creationUpperBound,
        ...rows.flatMap((r) => [r.versionNumber, r.createdAt]),
      ].every((n) => Number.isFinite(n) && !Object.is(n, -0)) ||
      proofValidUntil <= Date.now() ||
      new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
    )
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
