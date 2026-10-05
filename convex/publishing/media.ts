import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { preflight } from "../publishing";
import { requireReference, workspaceQuery } from "../lib/authorization";
import { requireR2Binding } from "../media/binding";
import { mimeLimit, LEASE_MS } from "../media/limits";
import {
  checkpointDoc,
  mediaJob,
  mediaSource,
  mediaPhase,
  CHUNK_BYTES,
  EXPIRY_MARGIN_MS,
  MEDIA_BUDGET_MS,
} from "./mediaFields";

async function source(
  ctx: MutationCtx,
  a: {
    scheduleId: Doc<"schedules">["_id"];
    generation: number;
    mediaPosition: number;
  },
) {
  const s = await ctx.db.get(a.scheduleId);
  if (!s || s.generation !== a.generation || s.state !== "publishing")
    throw new ConvexError("X_SCHEDULE_CHANGED");
  const version = await preflight(ctx, s);
  if (s.draftId !== version.draftId)
    throw new ConvexError("MEDIA_SOURCE_CHANGED");
  const account = requireReference(
    s.workspaceId,
    await ctx.db.get(s.accountId),
  ) as Doc<"socialAccounts">;
  if (account.provider !== "X") throw new ConvexError("X_ACCOUNT_REQUIRED");
  if (
    !Number.isInteger(a.mediaPosition) ||
    a.mediaPosition < 0 ||
    a.mediaPosition >= version.content.media.length
  )
    throw new ConvexError("MEDIA_POSITION_INVALID");
  const ref = version.content.media[a.mediaPosition],
    snapshot = version.mediaChecksums?.[a.mediaPosition];
  if (!snapshot || snapshot.assetId !== ref.assetId)
    throw new ConvexError("MEDIA_SNAPSHOT_CHANGED");
  const asset = requireReference(
    s.workspaceId,
    await ctx.db.get(ref.assetId),
  ) as Doc<"mediaAssets">;
  const session = asset.uploadSessionId
    ? (requireReference(
        s.workspaceId,
        await ctx.db.get(asset.uploadSessionId),
      ) as Doc<"mediaUploadSessions">)
    : null;
  if (!session) throw new ConvexError("MEDIA_BINDING_RECONCILIATION_REQUIRED");
  requireR2Binding(asset);
  requireR2Binding(session);
  if (
    session.assetId !== asset._id ||
    session.state !== "ready" ||
    asset.state !== "ready" ||
    asset.storageProvider !== "r2" ||
    asset.objectKey !== `final/${s.workspaceId}/${asset._id}` ||
    session.finalKey !== asset.objectKey ||
    snapshot.objectKey !== asset.objectKey ||
    snapshot.checksum !== asset.checksum ||
    !/^[a-f0-9]{64}$/.test(asset.checksum) ||
    session.expectedSize !== asset.size ||
    session.expectedMime !== asset.mime ||
    !Number.isInteger(asset.size) ||
    asset.size < 1 ||
    asset.size > mimeLimit(asset.mime ?? "")
  )
    throw new ConvexError("MEDIA_SOURCE_CHANGED");
  return {
    workspaceId: s.workspaceId,
    versionId: version._id,
    accountId: s.accountId,
    assetId: asset._id,
    objectKey: asset.objectKey,
    checksum: snapshot.checksum,
    alt: ref.alt,
    size: asset.size,
    mime: asset.mime!,
    bucket: asset.bucket!,
    r2AccountId: asset.r2AccountId!,
  };
}
export const approvedSource = internalMutation({
  args: mediaJob,
  returns: mediaSource,
  handler: source,
});
function sameSource(
  c: Doc<"xMediaCheckpoints">,
  s: Awaited<ReturnType<typeof source>>,
) {
  for (const key of Object.keys(s) as (keyof typeof s)[])
    if (c[key] !== s[key]) throw new ConvexError("MEDIA_SOURCE_CHANGED");
}
export const claim = internalMutation({
  args: mediaJob,
  returns: v.union(checkpointDoc, v.null()),
  handler: async (ctx, a) => {
    const src = await source(ctx, a),
      now = Date.now();
    const rows = await ctx.db
      .query("xMediaCheckpoints")
      .withIndex("by_scheduleId_and_generation_and_mediaPosition", (q) =>
        q
          .eq("scheduleId", a.scheduleId)
          .eq("generation", a.generation)
          .eq("mediaPosition", a.mediaPosition),
      )
      .order("desc")
      .take(4);
    if (rows.length > 3)
      throw new ConvexError("MEDIA_ATTEMPT_BUDGET_EXHAUSTED");
    let c = rows[0];
    if (c) {
      sameSource(c, src);
      if (c.leaseUntil > now || c.nextCheckAt > now) return null;
      if (c.operation) {
        if (c.operation !== "read" && c.operation !== "status") {
          await ctx.db.patch(c._id, {
            phase: "uncertain",
            errorCode: "X_MEDIA_OUTCOME_UNKNOWN",
            operation: undefined,
            leaseUntil: 0,
            measurementIncomplete: true,
          });
          return null;
        }
        await ctx.db.patch(c._id, {
          operation: undefined,
          leaseUntil: 0,
          measurementIncomplete: true,
        });
        c = { ...c, measurementIncomplete: true };
      }
      if (["failed", "uncertain", "blocked"].includes(c.phase)) return null;
      if (c.expiresAt && c.expiresAt <= now + EXPIRY_MARGIN_MS) {
        await ctx.db.patch(c._id, {
          phase: "expired",
          errorCode: "X_MEDIA_EXPIRED",
        });
        c = { ...c, phase: "expired" };
      }
      if (c.phase === "ready") return null;
      if (c.phase !== "expired" && (now >= c.deadline || c.statusReads >= 30)) {
        await ctx.db.patch(c._id, {
          phase: "failed",
          errorCode: "X_MEDIA_BUDGET_EXHAUSTED",
        });
        return null;
      }
    }
    if (!c || c.phase === "expired") {
      if (rows.length >= 3) {
        await ctx.db.patch(c!._id, {
          phase: "failed",
          errorCode: "MEDIA_ATTEMPT_BUDGET_EXHAUSTED",
        });
        return null;
      }
      const id = await ctx.db.insert("xMediaCheckpoints", {
        ...a,
        ...src,
        attempt: rows.length + 1,
        phase: "initialize",
        claimSequence: 0,
        leaseUntil: 0,
        nextSegment: 0,
        nextCheckAt: now,
        deadline: now + MEDIA_BUDGET_MS,
        statusReads: 0,
        readRetries: 0,
        metadataApplied: false,
        bytesRead: 0,
        bytesUploaded: 0,
        bytesSubmitted: 0,
        chunkCount: 0,
        providerRequests: 0,
        durationMs: 0,
        measurementIncomplete: false,
        createdAt: now,
        updatedAt: now,
      });
      c = (await ctx.db.get(id))!;
    }
    const claimed = {
      ...c,
      claimSequence: c.claimSequence + 1,
      leaseUntil: now + LEASE_MS,
      operation: "read" as const,
    };
    await ctx.db.patch(c._id, {
      claimSequence: claimed.claimSequence,
      leaseUntil: claimed.leaseUntil,
      operation: "read",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      LEASE_MS,
      internal.integrations.x.publish.prepare,
      a,
    );
    return claimed;
  },
});
const claimArgs = {
  checkpointId: v.id("xMediaCheckpoints"),
  claimSequence: v.number(),
};
export const beforeRequest = internalMutation({
  args: {
    ...claimArgs,
    credentialGeneration: v.number(),
    bytesRead: v.number(),
    durationMs: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.checkpointId);
    if (
      !c ||
      c.claimSequence !== a.claimSequence ||
      c.operation !== "read" ||
      c.leaseUntil <= Date.now()
    )
      return false;
    const src = await source(ctx, c);
    sameSource(c, src);
    const credential = await ctx.runQuery(
      internal.integrations.x.oauth.scheduleSource,
      {
        scheduleId: c.scheduleId,
        generation: c.generation,
        operation: "media",
      },
    );
    if (credential.generation !== a.credentialGeneration)
      throw new ConvexError("X_CONNECTION_CHANGED");
    if (c.expiresAt && c.expiresAt <= Date.now() + EXPIRY_MARGIN_MS)
      return false;
    const operation = c.phase === "processing" ? "status" : c.phase;
    if (
      !["initialize", "append", "finalize", "status", "metadata"].includes(
        operation,
      )
    )
      return false;
    await ctx.db.patch(c._id, {
      operation: operation as
        "initialize" | "append" | "finalize" | "status" | "metadata",
      credentialGeneration: a.credentialGeneration,
      bytesRead: c.bytesRead + a.bytesRead,
      durationMs: c.durationMs + a.durationMs,
      providerRequests: c.providerRequests + 1,
      statusReads: c.statusReads + (operation === "status" ? 1 : 0),
      bytesSubmitted:
        c.bytesSubmitted +
        (operation === "append"
          ? Math.min(CHUNK_BYTES, c.size - c.nextSegment * CHUNK_BYTES)
          : 0),
      updatedAt: Date.now(),
    });
    return true;
  },
});
export const receipt = internalMutation({
  args: {
    ...claimArgs,
    phase: mediaPhase,
    mediaId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    waitMs: v.number(),
    errorCode: v.optional(v.string()),
    bytesRead: v.number(),
    durationMs: v.number(),
    incomplete: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.checkpointId);
    if (!c || c.claimSequence !== a.claimSequence || !c.operation) return null;
    // Preserve a late confirmed external outcome even when local permission has been revoked.
    let allowed = true;
    try {
      sameSource(c, await source(ctx, c));
    } catch {
      allowed = false;
    }
    const confirmedChunk =
      c.operation === "append" &&
      a.phase !== "failed" &&
      a.phase !== "uncertain";
    const nextCheckAt = Date.now() + a.waitMs;
    await ctx.db.patch(c._id, {
      phase: allowed ? a.phase : "blocked",
      errorCode: allowed ? a.errorCode : "X_SCHEDULE_CHANGED",
      ...(a.mediaId ? { mediaId: a.mediaId } : {}),
      ...(a.expiresAt
        ? { expiresAt: Math.min(c.expiresAt ?? a.expiresAt, a.expiresAt) }
        : {}),
      nextSegment: c.nextSegment + Number(confirmedChunk),
      bytesUploaded:
        c.bytesUploaded +
        (confirmedChunk
          ? Math.min(CHUNK_BYTES, c.size - c.nextSegment * CHUNK_BYTES)
          : 0),
      chunkCount: c.chunkCount + Number(confirmedChunk),
      metadataApplied:
        c.metadataApplied ||
        (c.operation === "metadata" && ["ready", "expired"].includes(a.phase)),
      bytesRead: c.bytesRead + a.bytesRead,
      durationMs: c.durationMs + a.durationMs,
      measurementIncomplete: c.measurementIncomplete || a.incomplete,
      readRetries:
        (c.readRetries ?? 0) +
        Number(
          c.operation === "read" && a.errorCode === "MEDIA_RETRIEVAL_RETRY",
        ),
      operation: undefined,
      leaseUntil: 0,
      nextCheckAt,
      updatedAt: Date.now(),
    });
    if (
      allowed &&
      [
        "initialize",
        "append",
        "finalize",
        "processing",
        "metadata",
        "expired",
      ].includes(a.phase)
    )
      await ctx.scheduler.runAfter(
        a.waitMs,
        internal.integrations.x.publish.prepare,
        {
          scheduleId: c.scheduleId,
          generation: c.generation,
          mediaPosition: c.mediaPosition,
        },
      );
    return null;
  },
});
export const ready = internalMutation({
  args: mediaJob,
  returns: v.union(
    v.object({ mediaId: v.string(), expiresAt: v.number() }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    const src = await source(ctx, a);
    await ctx.runQuery(internal.integrations.x.oauth.scheduleSource, {
      scheduleId: a.scheduleId,
      generation: a.generation,
      operation: "media",
    });
    const c = await ctx.db
      .query("xMediaCheckpoints")
      .withIndex("by_scheduleId_and_generation_and_mediaPosition", (q) =>
        q
          .eq("scheduleId", a.scheduleId)
          .eq("generation", a.generation)
          .eq("mediaPosition", a.mediaPosition),
      )
      .order("desc")
      .first();
    if (!c) return null;
    sameSource(c, src);
    return c.phase === "ready" &&
      c.metadataApplied &&
      c.mediaId &&
      c.expiresAt &&
      c.expiresAt > Date.now() + EXPIRY_MARGIN_MS
      ? { mediaId: c.mediaId, expiresAt: c.expiresAt }
      : null;
  },
});
// Payload-only reference estimate: actual plan/region, allowances, protocol overhead and provider billing remain unknown.
export const measurements = workspaceQuery({
  args: {
    scheduleId: v.id("schedules"),
    generation: v.number(),
    mediaPosition: v.number(),
  },
  returns: v.array(
    v.object({
      attempt: v.number(),
      phase: mediaPhase,
      bytesRead: v.number(),
      bytesUploaded: v.number(),
      bytesSubmitted: v.number(),
      chunkCount: v.number(),
      providerRequests: v.number(),
      durationMs: v.number(),
      measurementIncomplete: v.boolean(),
      currency: v.literal("USD"),
      pricingVersion: v.literal("convex-pro-us-east-2026-10-05"),
      mediaPayloadEstimateUsd: v.number(),
      billedUsd: v.null(),
      errorCode: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.scheduleId));
    const rows = await ctx.db
      .query("xMediaCheckpoints")
      .withIndex("by_scheduleId_and_generation_and_mediaPosition", (q) =>
        q
          .eq("scheduleId", a.scheduleId)
          .eq("generation", a.generation)
          .eq("mediaPosition", a.mediaPosition),
      )
      .take(3);
    return rows.map((c) => ({
      attempt: c.attempt,
      phase: c.phase,
      bytesRead: c.bytesRead,
      bytesUploaded: c.bytesUploaded,
      bytesSubmitted: c.bytesSubmitted,
      chunkCount: c.chunkCount,
      providerRequests: c.providerRequests,
      durationMs: c.durationMs,
      measurementIncomplete: c.measurementIncomplete,
      currency: "USD" as const,
      pricingVersion: "convex-pro-us-east-2026-10-05" as const,
      mediaPayloadEstimateUsd: (c.bytesSubmitted / 1e9) * 0.12,
      billedUsd: null,
      errorCode: c.errorCode ?? null,
    }));
  },
});
