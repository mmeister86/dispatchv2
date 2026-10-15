import {
  moreRow,
  moreFamilies,
  morePage,
  type MoreFamily,
} from "./exportRecordsMore";
import { authComponent } from "../auth";
import { ConvexError, v, type Infer } from "convex/values";
import { workspaceQuery, requireRole } from "../lib/authorization";
import { role } from "../schema";
import {
  EXPORT_PAGE_CANDIDATES,
  EXPORT_PAGE_MAX_BYTES,
  numeric,
  proofContext,
} from "./exportShared";
import { repoFields } from "../integrations/github/fields";
import { contextFields } from "../integrations/github/contextFields";
import { currentContext } from "../integrations/github/contextAccess";
import { attemptFields as postAttemptFields } from "../publishing/postFields";
import { checkpointFields } from "../publishing/mediaFields";
import { noticeFields } from "../editorial/reviewFields";
import { proof as editorialProof } from "../editorial/notices";
import { proof as publishingProof } from "../publishing/notices";
import { currentCommand } from "../team";
import { teamResult, deliveryStatus } from "../teamFields";
function pick<T, const K extends readonly (keyof T)[]>(
  r: T,
  keys: K,
): Pick<T, K[number]> {
  return Object.fromEntries(
    keys.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]),
  ) as Pick<T, K[number]>;
}
function binding(ok: unknown): asserts ok {
  if (!ok) throw new ConvexError("REFERENCE_ACCESS_DENIED");
}
const githubRepositorySettingsKeys = [
  "providerId",
  "installationId",
  "fullName",
  "private",
  "selected",
  "access",
  "monitoring",
  "content",
  "contextRead",
  "communicableContext",
  "purposeActorId",
  "purposeAt",
  "purposeVersion",
  "generation",
  "verifiedAt",
  "proofExpiresAt",
  "updatedAt",
] as const;
const publishingPostEffectsKeys = [
  "scheduleId",
  "versionId",
  "accountId",
  "providerIdentity",
  "generation",
  "position",
  "attempt",
  "stage",
  "mediaIds",
  "parentId",
  "externalId",
  "httpStatus",
  "rateResetAt",
  "requestStartedAt",
  "confirmedAt",
  "durationMs",
  "createdAt",
  "updatedAt",
  "reconciledAt",
  "reconciledBy",
  "reconcileReads",
] as const;
const publishingMediaEffectsKeys = [
  "scheduleId",
  "versionId",
  "accountId",
  "assetId",
  "generation",
  "mediaPosition",
  "attempt",
  "phase",
  "operation",
  "mediaId",
  "nextSegment",
  "expiresAt",
  "nextCheckAt",
  "deadline",
  "statusReads",
  "readRetries",
  "metadataApplied",
  "bytesRead",
  "bytesUploaded",
  "bytesSubmitted",
  "chunkCount",
  "providerRequests",
  "durationMs",
  "measurementIncomplete",
  "createdAt",
  "updatedAt",
] as const;
const ownGithubContextsKeys = [
  "actorId",
  "signalId",
  "repositoryId",
  "generation",
  "paths",
  "createdAt",
  "state",
  "excerpts",
  "approvedAt",
  "runId",
  "accountId",
  "resultIdeaId",
  "decision",
  "summary",
  "rationale",
  "novelty",
  "uncertainty",
  "references",
  "evidence",
] as const;
const ownEditorialNoticesKeys = [
  "draftId",
  "versionId",
  "accountId",
  "parent",
  "createdAt",
  "sourceUntil",
  "readAt",
  "dismissedAt",
] as const;
export const family = v.union(
  v.literal("githubRepositorySettings"),
  v.literal("publishingPostEffects"),
  v.literal("publishingMediaEffects"),
  v.literal("ownGithubContexts"),
  v.literal("ownEditorialNotices"),
  v.literal("ownUploadSessions"),
  v.literal("ownPublishingReceipts"),
  v.literal("ownTeamCommands"),
  v.literal("teamInvitationRecords"),
  ...moreFamilies.map(v.literal),
);
export type RecordsFamily = Infer<typeof family>;
const publishingPresentation = v.union(
  v.null(),
  v.object({
    draftId: v.id("drafts"),
    versionId: v.id("draftVersions"),
    accountId: v.id("socialAccounts"),
    approvalId: v.id("approvals"),
    approvalActorId: v.id("users"),
    purpose: v.union(
      v.literal("publishing"),
      v.literal("first_write_verification"),
    ),
    readAt: v.union(v.number(), v.null()),
    dismissedAt: v.union(v.number(), v.null()),
    sourceUntil: v.union(v.number(), v.null()),
  }),
);
const row = v.union(
  moreRow,
  v.object({
    id: v.id("githubRepositories"),
    createdInDatabaseAt: v.number(),
    ...pick(repoFields, githubRepositorySettingsKeys),
  }),
  v.object({
    id: v.id("xPostAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(postAttemptFields, publishingPostEffectsKeys),
  }),
  v.object({
    id: v.id("xMediaCheckpoints"),
    createdInDatabaseAt: v.number(),
    ...pick(checkpointFields, publishingMediaEffectsKeys),
  }),
  v.object({
    id: v.id("githubContexts"),
    createdInDatabaseAt: v.number(),
    ...pick(contextFields, ownGithubContextsKeys),
  }),
  v.object({
    id: v.id("editorialNotices"),
    createdInDatabaseAt: v.number(),
    ...pick(noticeFields, ownEditorialNoticesKeys),
  }),
  v.object({
    id: v.id("mediaUploadSessions"),
    createdInDatabaseAt: v.number(),
    assetId: v.id("mediaAssets"),
    state: v.union(
      v.literal("uploading"),
      v.literal("validating"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("deleted"),
    ),
    expiresAt: v.number(),
    expectedSize: v.number(),
    expectedMime: v.string(),
    deletedAt: v.optional(v.number()),
  }),
  v.object({
    id: v.id("publishingNotifications"),
    createdInDatabaseAt: v.number(),
    scheduleId: v.id("schedules"),
    generation: v.optional(v.number()),
    state: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("blocked"),
    ),
    createdAt: v.number(),
    presentation: publishingPresentation,
  }),
  v.object({
    id: v.id("teamCommands"),
    createdInDatabaseAt: v.number(),
    actorId: v.id("users"),
    ownerOperation: v.boolean(),
    result: v.union(v.null(), teamResult),
    materialAvailability: v.union(
      v.literal("retained"),
      v.literal("unavailable"),
    ),
  }),
  v.object({
    id: v.id("teamInvitations"),
    createdInDatabaseAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired"),
      v.literal("unavailable"),
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    role: v.optional(role),
    delivery: v.union(
      v.null(),
      v.object({
        status: deliveryStatus,
        providerId: v.union(v.string(), v.null()),
        firstSendAt: v.optional(v.number()),
      }),
    ),
  }),
);
export const page = workspaceQuery({
  args: {
    expectedAuthId: v.string(),
    expectedSessionId: v.string(),
    requestKey: v.string(),
    family,
    version: v.optional(
      v.union(
        v.object({ kind: v.literal("draft"), id: v.id("draftVersions") }),
        v.object({ kind: v.literal("idea"), id: v.id("ideaVersions") }),
      ),
    ),
    cursor: v.union(v.string(), v.null()),
    creationUpperBound: v.union(v.number(), v.null()),
  },
  returns: v.object({
    authId: v.string(),
    sessionId: v.string(),
    requestKey: v.string(),
    workspaceId: v.id("workspaces"),
    role,
    version: v.union(
      v.null(),
      v.union(
        v.object({ kind: v.literal("draft"), id: v.id("draftVersions") }),
        v.object({ kind: v.literal("idea"), id: v.id("ideaVersions") }),
      ),
    ),
    observedAt: v.number(),
    proofValidUntil: v.number(),
    creationUpperBound: v.number(),
    cursor: v.string(),
    isDone: v.boolean(),
    data: v.object({
      format: v.literal("dispatch-workspace-operational-records"),
      version: v.literal(1),
      workspaceId: v.id("workspaces"),
      selection: v.object({ family, rows: v.array(row) }),
    }),
  }),
  handler: async (original, a) => {
    const sessionId = (await original.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string" || !sessionId)
      throw new ConvexError("Unauthenticated");
    if (
      !a.expectedAuthId ||
      a.expectedAuthId.length > 256 ||
      !a.expectedSessionId ||
      a.expectedSessionId.length > 256 ||
      !a.requestKey ||
      a.requestKey.length > 64
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      a.expectedAuthId !== original.user.authId ||
      a.expectedSessionId !== sessionId ||
      original.user.activeWorkspaceId !== original.workspace._id
    )
      throw new ConvexError("EXPORT_SCOPE_CHANGED");
    if (!a.family.startsWith("own"))
      requireRole(original.membership, ["Owner", "Admin"]);
    if ((a.family === "mediaVersionReferences") !== (a.version !== undefined))
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const observedAt = Date.now();
    numeric(a);
    numeric(observedAt);
    if (
      observedAt < 0 ||
      (a.cursor === null) !== (a.creationUpperBound === null) ||
      (a.cursor !== null && (!a.cursor || a.cursor.length > 16384)) ||
      (a.creationUpperBound !== null &&
        (a.creationUpperBound < 0 || a.creationUpperBound > observedAt))
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const ws = original.workspace._id,
      ctx = proofContext(original, ws),
      creationUpperBound = a.creationUpperBound ?? observedAt;
    let proofValidUntil = observedAt + 30000;
    const horizon = (h: number | null) => {
      numeric(h);
      if (h !== null) {
        if (h <= observedAt) throw new ConvexError("EXPORT_SOURCE_UNAVAILABLE");
        proofValidUntil = Math.min(proofValidUntil, h);
      }
    };
    let selected: { continueCursor: string; isDone: boolean };
    const rows: Infer<typeof row>[] = [];
    if ((moreFamilies as readonly string[]).includes(a.family)) {
      let email: string | null = null;
      if (a.family === "ownReceivedInvitations") {
        const u = await authComponent.getAuthUser(original);
        if (!u.emailVerified || !u.email)
          throw new ConvexError("EXPORT_CONTACT_UNAVAILABLE");
        email = u.email.trim().toLowerCase();
      }
      const p = await morePage(
        ctx,
        {
          family: a.family as MoreFamily,
          cursor: a.cursor,
          version: a.version,
        },
        ws,
        original.user._id,
        creationUpperBound,
        email,
        horizon,
      );
      selected = {
        continueCursor: p.continueCursor,
        isDone: p.isDone,
      };
      rows.push(...p.rows);
    } else
      switch (a.family) {
        case "githubRepositorySettings": {
          const p = await ctx.db
            .query("githubRepositories")
            .withIndex("by_workspaceId", (q) =>
              q.eq("workspaceId", ws).lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, githubRepositorySettingsKeys),
            });
          }
          break;
        }
        case "publishingPostEffects": {
          const p = await ctx.db
            .query("xPostAttempts")
            .withIndex("by_workspaceId", (q) =>
              q.eq("workspaceId", ws).lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            const ver = await ctx.db.get(r.versionId),
              schedule = await ctx.db.get(r.scheduleId),
              account = await ctx.db.get(r.accountId);
            binding(
              ver &&
                schedule &&
                account &&
                ver.draftId === schedule.draftId &&
                ver.content.accountId === r.accountId,
            );
            const draft = await ctx.db.get(ver.draftId);
            binding(draft);
            binding(
              Number.isSafeInteger(r.position) &&
                r.position >= 0 &&
                r.position < ver.content.text.length,
            );
            if (r.stage === "confirmed")
              binding(r.externalId && r.confirmedAt !== undefined);
            if (r.parentId) {
              const parent = await ctx.db
                .query("xPostAttempts")
                .withIndex("by_workspaceId_and_accountId_and_externalId", (q) =>
                  q
                    .eq("workspaceId", ws)
                    .eq("accountId", r.accountId)
                    .eq("externalId", r.parentId),
                )
                .unique();
              binding(
                parent &&
                  parent.stage === "confirmed" &&
                  parent.scheduleId === r.scheduleId &&
                  parent.versionId === r.versionId &&
                  parent.generation === r.generation &&
                  parent.position === r.position - 1,
              );
            } else binding(r.position === 0);
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, publishingPostEffectsKeys),
            });
          }
          break;
        }
        case "publishingMediaEffects": {
          const p = await ctx.db
            .query("xMediaCheckpoints")
            .withIndex("by_workspaceId", (q) =>
              q.eq("workspaceId", ws).lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            const ver = await ctx.db.get(r.versionId),
              schedule = await ctx.db.get(r.scheduleId),
              account = await ctx.db.get(r.accountId);
            binding(
              ver &&
                schedule &&
                account &&
                ver.draftId === schedule.draftId &&
                ver.content.accountId === r.accountId,
            );
            const draft = await ctx.db.get(ver.draftId);
            binding(draft);
            binding(
              Number.isSafeInteger(r.mediaPosition) &&
                r.mediaPosition >= 0 &&
                ver.content.media[r.mediaPosition]?.assetId === r.assetId,
            );
            binding(await ctx.db.get(r.assetId));
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, publishingMediaEffectsKeys),
            });
          }
          break;
        }
        case "ownGithubContexts": {
          const p = await ctx.db
            .query("githubContexts")
            .withIndex("by_workspace_actor", (q) =>
              q
                .eq("workspaceId", ws)
                .eq("actorId", original.user._id)
                .lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            binding(r.actorId === original.user._id);
            const proof = await currentContext(ctx, r._id, true);
            horizon(proof.r.proofExpiresAt);
            if (r.runId) {
              const run = await ctx.db.get(r.runId);
              binding(
                run &&
                  run.actorId === r.actorId &&
                  run.accountId === r.accountId,
              );
            }
            if (r.resultIdeaId) {
              const idea = await ctx.db.get(r.resultIdeaId);
              binding(
                idea &&
                  idea.actorId === r.actorId &&
                  idea.operationKey === `github-${r._id}`,
              );
            }
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, ownGithubContextsKeys),
            });
          }
          break;
        }
        case "ownEditorialNotices": {
          const p = await ctx.db
            .query("editorialNotices")
            .withIndex("by_workspace_recipient", (q) =>
              q
                .eq("workspaceId", ws)
                .eq("recipientId", original.user._id)
                .lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            binding(r.recipientId === original.user._id);
            horizon(await editorialProof(ctx, r));
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, ownEditorialNoticesKeys),
            });
          }
          break;
        }
        case "ownUploadSessions": {
          const p = await ctx.db
            .query("mediaUploadSessions")
            .withIndex("by_workspace_actor", (q) =>
              q
                .eq("workspaceId", ws)
                .eq("userId", original.user._id)
                .lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            binding(r.userId === original.user._id);
            const asset = await ctx.db.get(r.assetId);
            binding(
              asset &&
                (!asset.uploadSessionId || asset.uploadSessionId === r._id),
            );
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, [
                "assetId",
                "state",
                "expiresAt",
                "expectedSize",
                "expectedMime",
                "deletedAt",
              ]),
            });
          }
          break;
        }
        case "ownPublishingReceipts": {
          const p = await ctx.db
            .query("publishingNotifications")
            .withIndex("by_workspace_recipient", (q) =>
              q
                .eq("workspaceId", ws)
                .eq("recipientId", original.user._id)
                .lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            binding(r.recipientId === original.user._id);
            const schedule = await ctx.db.get(r.scheduleId);
            binding(schedule);
            let presentation: Infer<typeof publishingPresentation> = null;
            if (r.presentationUnavailable === false && r.presentation) {
              horizon(await publishingProof(ctx, r));
              presentation = pick(r.presentation, [
                "draftId",
                "versionId",
                "accountId",
                "approvalId",
                "approvalActorId",
                "purpose",
                "readAt",
                "dismissedAt",
                "sourceUntil",
              ]);
            }
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, ["scheduleId", "generation", "state", "createdAt"]),
              presentation,
            });
          }
          break;
        }
        case "ownTeamCommands": {
          const p = await ctx.db
            .query("teamCommands")
            .withIndex("by_workspace_actor", (q) =>
              q
                .eq("workspaceId", ws)
                .eq("actorId", original.user._id)
                .lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            binding(r.actorId === original.user._id);
            const readable =
              !r.sourceUnavailable && (await currentCommand(ctx, r));
            if (readable && r.result) {
              if (r.result.invitationId) {
                const i = await ctx.db.get(r.result.invitationId);
                binding(!i || i.workspaceId === ws);
              }
              if (r.result.membershipId) {
                const m = await ctx.db.get(r.result.membershipId);
                binding(!m || m.workspaceId === ws);
              }
            }
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              actorId: r.actorId,
              ownerOperation: r.ownerOperation,
              result: readable ? (r.result ?? null) : null,
              materialAvailability: readable ? "retained" : "unavailable",
            });
          }
          break;
        }
        default:
          throw new ConvexError("EXPORT_REQUEST_INVALID");
        case "teamInvitationRecords": {
          const p = await ctx.db
            .query("teamInvitations")
            .withIndex("by_workspaceId", (q) =>
              q.eq("workspaceId", ws).lte("_creationTime", creationUpperBound),
            )
            .order("asc")
            .paginate({
              numItems: EXPORT_PAGE_CANDIDATES,
              cursor: a.cursor,
              maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
            });
          selected = p;
          for (const r of p.page) {
            rows.push({
              id: r._id,
              createdInDatabaseAt: r._creationTime,
              ...pick(r, ["status", "createdAt", "expiresAt", "role"]),
              delivery: r.delivery
                ? {
                    status: r.delivery.status,
                    providerId: r.delivery.providerId ?? null,
                    ...pick(r.delivery, ["firstSendAt"]),
                  }
                : null,
            });
          }
          break;
        }
      }
    const result = {
      version: a.version ?? null,
      authId: original.user.authId,
      sessionId,
      requestKey: a.requestKey,
      workspaceId: ws,
      role: original.membership.role,
      observedAt,
      proofValidUntil,
      creationUpperBound,
      cursor: selected.continueCursor,
      isDone: selected.isDone,
      data: {
        format: "dispatch-workspace-operational-records" as const,
        version: 1 as const,
        workspaceId: ws,
        selection: { family: a.family, rows },
      },
    };
    numeric(result);
    const now = Date.now();
    numeric(now);
    if (
      now < observedAt ||
      now >= proofValidUntil ||
      new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
    )
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
