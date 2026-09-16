import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Dispatch V1 domain schema.
 *
 * Notes:
 * - Convex adds `_id` and `_creationTime` automatically.
 * - `updatedAt` is explicit on mutable domain entities.
 * - OAuth credentials are isolated in `integrationSecrets` and must only be
 *   accessed from internal Convex functions.
 * - Large provider payloads (GitHub diffs, raw X responses, agent traces)
 *   should not be stored directly on these documents.
 */

const membershipRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("editor"),
  v.literal("viewer"),
);

const integrationProvider = v.union(
  v.literal("github"),
  v.literal("x"),
);

const integrationStatus = v.union(
  v.literal("connected"),
  v.literal("disconnected"),
  v.literal("error"),
  v.literal("reauth_required"),
);

const socialProvider = v.union(v.literal("x"));

const socialAccountStatus = v.union(
  v.literal("active"),
  v.literal("reauth_required"),
  v.literal("disabled"),
);

const contentSignalType = v.union(
  v.literal("github_push"),
  v.literal("github_release"),
  v.literal("github_pull_request"),
  v.literal("x_trend"),
  v.literal("web_topic"),
  v.literal("manual_note"),
  v.literal("conversation"),
  v.literal("performance_signal"),
);

const contentSignalSource = v.union(
  v.literal("github"),
  v.literal("x"),
  v.literal("web"),
  v.literal("user"),
  v.literal("agent"),
);

const contentSignalStatus = v.union(
  v.literal("new"),
  v.literal("processed"),
  v.literal("ignored"),
  v.literal("archived"),
);

const researchSourceType = v.union(
  v.literal("web"),
  v.literal("x"),
  v.literal("github"),
  v.literal("mixed"),
);

const researchStatus = v.union(
  v.literal("pending"),
  v.literal("completed"),
  v.literal("failed"),
);

const actorType = v.union(
  v.literal("user"),
  v.literal("agent"),
  v.literal("workflow"),
);

const contentIdeaPriority = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
);

const contentIdeaStatus = v.union(
  v.literal("suggested"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("drafted"),
  v.literal("archived"),
);

const draftFormat = v.union(
  v.literal("single"),
  v.literal("thread"),
);

const draftStatus = v.union(
  v.literal("draft"),
  v.literal("needs_review"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("scheduled"),
  v.literal("published"),
);

const mediaType = v.union(
  v.literal("image"),
  v.literal("video"),
  v.literal("gif"),
);

const mediaSource = v.union(
  v.literal("upload"),
  v.literal("generated"),
  v.literal("github"),
  v.literal("external"),
);

const scheduledPostStatus = v.union(
  v.literal("scheduled"),
  v.literal("publishing"),
  v.literal("published"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const agentRunTrigger = v.union(
  v.literal("user_message"),
  v.literal("github_signal"),
  v.literal("scheduled_planning"),
  v.literal("research"),
  v.literal("manual"),
);

const agentRunPurpose = v.union(
  v.literal("research"),
  v.literal("idea_generation"),
  v.literal("draft_generation"),
  v.literal("planning"),
  v.literal("review"),
);

const agentRunStatus = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const systemEventSeverity = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("error"),
  v.literal("critical"),
);

const systemEventSource = v.union(
  v.literal("github"),
  v.literal("x"),
  v.literal("stripe"),
  v.literal("requesty"),
  v.literal("resend"),
  v.literal("agent"),
  v.literal("system"),
);

const draftPostContent = v.object({
  text: v.string(),
  mediaAssetIds: v.optional(v.array(v.id("mediaAssets"))),
});

export default defineSchema({
  /**
   * Projection of the authenticated Better Auth user into the Dispatch domain.
   * Better Auth remains the source of truth for identity/session data.
   */
  users: defineTable({
    authUserId: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_authUserId", ["authUserId"]),

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerUserId: v.id("users"),
    timezone: v.string(),
    locale: v.string(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerUserId", ["ownerUserId"]),

  memberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: membershipRole,
  })
    .index("by_userId", ["userId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_userId", ["workspaceId", "userId"]),

  integrations: defineTable({
    workspaceId: v.id("workspaces"),
    provider: integrationProvider,
    status: integrationStatus,
    externalAccountId: v.optional(v.string()),
    displayName: v.optional(v.string()),
    connectedAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    lastErrorCode: v.optional(v.string()),
    lastErrorMessage: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_provider", ["workspaceId", "provider"])
    .index("by_provider_and_externalAccountId", [
      "provider",
      "externalAccountId",
    ]),

  /**
   * Internal-only credential store.
   * Store encrypted token material, not plaintext provider tokens.
   * No public Convex query should return documents from this table.
   */
  integrationSecrets: defineTable({
    integrationId: v.id("integrations"),
    accessTokenCiphertext: v.optional(v.string()),
    refreshTokenCiphertext: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    scope: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    encryptionKeyVersion: v.number(),
    updatedAt: v.number(),
  }).index("by_integrationId", ["integrationId"]),

  repositories: defineTable({
    workspaceId: v.id("workspaces"),
    integrationId: v.id("integrations"),
    externalRepositoryId: v.string(),
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),
    isPrivate: v.boolean(),
    defaultBranch: v.string(),
    enabled: v.boolean(),
    contentGenerationEnabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_integrationId", ["integrationId"])
    .index("by_integrationId_and_externalRepositoryId", [
      "integrationId",
      "externalRepositoryId",
    ])
    .index("by_workspaceId_and_enabled", ["workspaceId", "enabled"]),

  socialAccounts: defineTable({
    workspaceId: v.id("workspaces"),
    integrationId: v.id("integrations"),
    provider: socialProvider,
    externalAccountId: v.string(),
    username: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    status: socialAccountStatus,
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_provider", ["workspaceId", "provider"])
    .index("by_integrationId", ["integrationId"])
    .index("by_provider_and_externalAccountId", [
      "provider",
      "externalAccountId",
    ]),

  contentSignals: defineTable({
    workspaceId: v.id("workspaces"),
    repositoryId: v.optional(v.id("repositories")),
    type: contentSignalType,
    source: contentSignalSource,
    externalId: v.optional(v.string()),
    title: v.string(),
    summary: v.optional(v.string()),
    relevanceScore: v.optional(v.number()),
    noveltyScore: v.optional(v.number()),
    confidenceScore: v.optional(v.number()),
    status: contentSignalStatus,
    occurredAt: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    compactMetadata: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_type", ["workspaceId", "type"])
    .index("by_workspaceId_and_source", ["workspaceId", "source"])
    .index("by_repositoryId", ["repositoryId"])
    .index("by_source_and_externalId", ["source", "externalId"]),

  researchItems: defineTable({
    workspaceId: v.id("workspaces"),
    topic: v.string(),
    sourceType: researchSourceType,
    query: v.optional(v.string()),
    summary: v.optional(v.string()),
    status: researchStatus,
    relevanceScore: v.optional(v.number()),
    sourceUrls: v.optional(v.array(v.string())),
    createdBy: actorType,
    completedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_sourceType", ["workspaceId", "sourceType"]),

  contentIdeas: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    angle: v.string(),
    description: v.optional(v.string()),
    sourceSignalIds: v.array(v.id("contentSignals")),
    researchItemIds: v.optional(v.array(v.id("researchItems"))),
    priority: contentIdeaPriority,
    status: contentIdeaStatus,
    createdBy: v.union(v.literal("user"), v.literal("agent")),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_priority", ["workspaceId", "priority"]),

  drafts: defineTable({
    workspaceId: v.id("workspaces"),
    ideaId: v.optional(v.id("contentIdeas")),
    socialAccountId: v.optional(v.id("socialAccounts")),
    platform: socialProvider,
    format: draftFormat,
    status: draftStatus,
    createdBy: v.union(v.literal("user"), v.literal("agent")),
    currentVersionId: v.optional(v.id("draftVersions")),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_ideaId", ["workspaceId", "ideaId"])
    .index("by_socialAccountId", ["socialAccountId"]),

  draftVersions: defineTable({
    workspaceId: v.id("workspaces"),
    draftId: v.id("drafts"),
    version: v.number(),
    posts: v.array(draftPostContent),
    createdBy: v.union(v.literal("user"), v.literal("agent")),
    changeReason: v.optional(v.string()),
  })
    .index("by_draftId", ["draftId"])
    .index("by_draftId_and_version", ["draftId", "version"])
    .index("by_workspaceId", ["workspaceId"]),

  mediaAssets: defineTable({
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    type: mediaType,
    mimeType: v.string(),
    fileName: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sizeBytes: v.optional(v.number()),
    altText: v.optional(v.string()),
    source: mediaSource,
  }).index("by_workspaceId", ["workspaceId"]),

  scheduledPosts: defineTable({
    workspaceId: v.id("workspaces"),
    draftId: v.id("drafts"),
    draftVersionId: v.id("draftVersions"),
    socialAccountId: v.id("socialAccounts"),
    scheduledFor: v.number(),
    timezone: v.string(),
    status: scheduledPostStatus,
    workflowId: v.optional(v.string()),
    retryCount: v.number(),
    lastErrorCode: v.optional(v.string()),
    lastErrorMessage: v.optional(v.string()),
    publishingStartedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_scheduledFor", ["workspaceId", "scheduledFor"])
    .index("by_status_and_scheduledFor", ["status", "scheduledFor"])
    .index("by_draftId", ["draftId"]),

  publishedPosts: defineTable({
    workspaceId: v.id("workspaces"),
    scheduledPostId: v.optional(v.id("scheduledPosts")),
    draftId: v.optional(v.id("drafts")),
    draftVersionId: v.optional(v.id("draftVersions")),
    socialAccountId: v.id("socialAccounts"),
    provider: socialProvider,
    rootExternalPostId: v.string(),
    externalPostIds: v.array(v.string()),
    url: v.string(),
    contentSnapshot: v.array(draftPostContent),
    publishedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_socialAccountId", ["socialAccountId"])
    .index("by_provider_and_rootExternalPostId", [
      "provider",
      "rootExternalPostId",
    ])
    .index("by_scheduledPostId", ["scheduledPostId"]),

  agentRuns: defineTable({
    workspaceId: v.id("workspaces"),
    trigger: agentRunTrigger,
    purpose: agentRunPurpose,
    status: agentRunStatus,
    model: v.optional(v.string()),
    requestId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_status", ["workspaceId", "status"])
    .index("by_workspaceId_and_purpose", ["workspaceId", "purpose"])
    .index("by_requestId", ["requestId"]),

  systemEvents: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    severity: systemEventSeverity,
    source: systemEventSource,
    type: v.string(),
    message: v.string(),
    compactMetadata: v.optional(v.any()),
    occurredAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_severity", ["workspaceId", "severity"])
    .index("by_source", ["source"])
    .index("by_severity", ["severity"]),
});
