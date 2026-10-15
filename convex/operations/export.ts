import { draftResearchProof } from "../research/contentProof";
import { ConvexError, v } from "convex/values";
import { requireRole, workspaceQuery } from "../lib/authorization";
import { profile, role } from "../schema";
import { EXPORT_PAGE_CANDIDATES, EXPORT_PAGE_MAX_BYTES } from "./exportShared";
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
    narrowPage: v.optional(v.boolean()),
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
    const narrow = a.narrowPage === true;
    let proofValidUntil = observedAt + 30_000;
    const rows = [];
    const page = await ctx.db
      .query("draftVersions")
      .withIndex("by_workspaceId", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .lte("_creationTime", creationUpperBound),
      )
      .order("asc")
      .paginate({
        numItems: narrow ? 1 : EXPORT_PAGE_CANDIDATES,
        cursor: a.cursor,
        maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
      });
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
    const sizeOver =
      new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024;
    // A multi-row page that only overflows in combination is retryable one
    // row at a time; a lone oversized row keeps the terminal error below.
    if (sizeOver && !narrow && rows.length > 1)
      throw new ConvexError("EXPORT_PAGE_OVERSIZED");
    if (
      ![
        observedAt,
        proofValidUntil,
        creationUpperBound,
        ...rows.flatMap((r) => [r.versionNumber, r.createdAt]),
      ].every((n) => Number.isFinite(n) && !Object.is(n, -0)) ||
      proofValidUntil <= Date.now() ||
      sizeOver
    )
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});

import { ownNotificationRow, retainedEntry } from "../preferences";
import { personalNotificationSettings } from "../schema";
const exportedSummary = v.object({
  orderId: v.id("researchOrders"),
  generation: v.number(),
  accountId: v.id("socialAccounts"),
  profileId: v.id("researchProfiles"),
  profileVersionId: v.id("researchProfileVersions"),
  finishedAt: v.number(),
  deadline: v.number(),
  sourceUntil: v.number(),
  availableAt: v.number(),
  proofValidUntil: v.number(),
});
export const preferences = workspaceQuery({
  args: {
    expectedAuthId: v.string(),
    expectedSessionId: v.string(),
    requestKey: v.string(),
  },
  returns: v.object({
    authId: v.string(),
    sessionId: v.string(),
    requestKey: v.string(),
    workspaceId: v.id("workspaces"),
    observedAt: v.number(),
    proofValidUntil: v.number(),
    data: v.object({
      format: v.literal("dispatch-self-preferences"),
      version: v.literal(1),
      workspaceId: v.id("workspaces"),
      observedAt: v.number(),
      profile,
      notifications: v.union(v.null(), personalNotificationSettings),
      researchSummaries: v.array(exportedSummary),
      coverage: v.object({
        kind: v.literal("selected_workspace_self_preferences"),
        complete: v.literal(false),
        included: v.array(v.string()),
        unsupported: v.array(v.string()),
      }),
    }),
  }),
  handler: async (ctx, a) => {
    // Reject an obsolete browser session before reading its preferences or source proofs.
    const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string" || !sessionId)
      throw new ConvexError("Unauthenticated");
    if (
      !a.expectedSessionId ||
      a.expectedSessionId.length > 256 ||
      !a.expectedAuthId ||
      a.expectedAuthId.length > 256 ||
      !a.requestKey ||
      a.requestKey.length > 64
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      sessionId !== a.expectedSessionId ||
      a.expectedAuthId !== ctx.user.authId ||
      ctx.user.activeWorkspaceId !== ctx.workspace._id
    )
      throw new ConvexError("EXPORT_SCOPE_CHANGED");
    const { p, settings } = await ownNotificationRow(ctx, a);
    const observedAt = Date.now();
    let proofValidUntil = observedAt + 30_000;
    const summaries = p.researchSummaries ?? [];
    if (summaries.length > 5) throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    const researchSummaries = [];
    for (const r of summaries) {
      const proof = await retainedEntry(ctx, p, r);
      if (!proof || proof.until <= observedAt) continue;
      proofValidUntil = Math.min(proofValidUntil, proof.until);
      researchSummaries.push({
        orderId: r.orderId,
        generation: r.generation,
        accountId: r.accountId,
        profileId: r.profileId,
        profileVersionId: r.profileVersionId,
        finishedAt: r.finishedAt,
        deadline: r.deadline,
        sourceUntil: r.sourceUntil,
        availableAt: r.availableAt,
        proofValidUntil: proof.until,
      });
    }
    const result = {
      authId: ctx.user.authId,
      sessionId,
      requestKey: a.requestKey,
      workspaceId: ctx.workspace._id,
      observedAt,
      proofValidUntil,
      data: {
        format: "dispatch-self-preferences" as const,
        version: 1 as const,
        workspaceId: ctx.workspace._id,
        observedAt,
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
        notifications: p.notifications ? settings : null,
        researchSummaries,
        coverage: {
          kind: "selected_workspace_self_preferences" as const,
          complete: false as const,
          included: [
            "own_profile",
            "stored_own_notification_settings",
            "currently_authorized_own_research_summary_metadata",
          ],
          unsupported: [
            "other_workspaces_and_people",
            "full_personal_or_workspace_archive",
            "private_content_and_components",
            "research_source_bytes",
            "auth_records_and_provider_copies",
          ],
        },
      },
    };
    if (
      ![
        observedAt,
        proofValidUntil,
        p.onboardingStep,
        ...(p.notifications ? [settings.revision] : []),
        ...researchSummaries.flatMap((r) => [
          r.generation,
          r.finishedAt,
          r.deadline,
          r.sourceUntil,
          r.availableAt,
          r.proofValidUntil,
        ]),
      ].every((n) => Number.isFinite(n) && !Object.is(n, -0)) ||
      proofValidUntil <= Date.now() ||
      new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
    )
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
