import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { PNG } from "pngjs";
import { S3Client } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import schema from "../schema";
import { internal } from "../_generated/api";
import { seal } from "../lib/crypto";
import { association } from "../integrations/x/fields";
import { validateBytes } from "../media/validation";
import { EXPIRY_MARGIN_MS, CHUNK_BYTES } from "./mediaFields";
const modules = import.meta.glob("/convex/**/*.ts");
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function fixture(mediaBytes?: Buffer) {
  vi.useFakeTimers();
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a".repeat(32));
  vi.stubEnv("R2_MEDIA_BUCKET", "fixture");
  vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "synthetic");
  vi.stubEnv("R2_MEDIA_EU_CONFIRMED", "true");
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "fixture");
  const bytes =
      mediaBytes ??
      PNG.sync.write({
        width: 1,
        height: 1,
        data: Buffer.from([1, 2, 3, 255]),
      } as PNG),
    checked = validateBytes(bytes, bytes.length, "image/png"),
    t = convexTest(schema, modules);
  const f = await t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
        name: "Fixture",
        description: "",
      }),
      foreign = await ctx.db.insert("workspaces", {
        name: "Other",
        description: "",
      });
    const actorId = await ctx.db.insert("users", {
      authId: "synthetic",
      activeWorkspaceId: workspaceId,
      defaultWorkspaceId: workspaceId,
    });
    const membershipId = await ctx.db.insert("memberships", {
      workspaceId,
      userId: actorId,
      role: "Owner",
    });
    const accountId = await ctx.db.insert("socialAccounts", {
      workspaceId,
      provider: "X",
      providerIdentity: "123",
      name: "Fixture",
      handle: "@fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 100,
        maxMedia: 4,
        mediaTypes: ["image", "video"],
        publish: true,
      },
      xEvidence: {
        connectionSequence: 1,
        scopes: ["media.write", "tweet.write", "users.read", "tweet.read"],
        identityVerifiedAt: Date.now(),
        textScopeEligible: true,
        mediaScopeEligible: true,
        liveWrite: "verified",
      },
    });
    const credentialId = await ctx.db.insert("xCredentials", {
      workspaceId,
      accountId,
      generation: 1,
      envelope: await seal(
        { accessToken: "fixture-token" },
        association(workspaceId, accountId),
      ),
      expiresAt: Date.now() + 86400000,
      scopes: ["media.write", "users.read", "tweet.read", "tweet.write"],
      leaseUntil: 0,
      cleanAfter: Date.now() + 86400000,
    });
    await ctx.db.insert("xBindings", {
      providerIdentity: "123",
      workspaceId,
      accountId,
      changedAt: Date.now(),
      changedSequence: 1,
    });
    const assetId = await ctx.db.insert("mediaAssets", {
      workspaceId,
      storageProvider: "r2",
      objectKey: "pending",
      checksum: checked.checksum,
      name: "Fixture",
      type: "image",
      size: bytes.length,
      mime: "image/png",
      state: "ready",
      bucket: "fixture",
      r2AccountId: "a".repeat(32),
      defaultAlt: "Different default alt",
    });
    const otherAssetId = await ctx.db.insert("mediaAssets", {
      workspaceId: foreign,
      storageProvider: "r2",
      objectKey: "foreign",
      checksum: checked.checksum,
      name: "Other",
      type: "image",
      size: bytes.length,
      mime: "image/png",
      state: "ready",
    });
    const objectKey = `final/${workspaceId}/${assetId}`;
    const sessionId = await ctx.db.insert("mediaUploadSessions", {
      workspaceId,
      assetId,
      temporaryKey: `temporary/${workspaceId}/${assetId}`,
      finalKey: objectKey,
      bucket: "fixture",
      r2AccountId: "a".repeat(32),
      expectedSize: bytes.length,
      expectedMime: "image/png",
      expiresAt: Date.now() - 1,
      state: "ready",
      leaseUntil: 0,
      generation: 1,
      cleanAfter: Date.now() + 86400000,
    });
    await ctx.db.patch(assetId, { uploadSessionId: sessionId, objectKey });
    const draftId = await ctx.db.insert("drafts", {
      workspaceId,
      revision: 1,
      currentVersionId: null,
      authorId: actorId,
      source: "Fixture",
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("draftVersions", {
      workspaceId,
      draftId,
      number: 1,
      authorId: actorId,
      createdAt: Date.now(),
      reason: "Fixture",
      content: {
        title: "Fixture",
        text: ["Approved"],
        media: [{ assetId, alt: "Historical approved alt" }],
        accountId,
        pillar: "",
        strategy: "generic",
      },
      mediaChecksums: [{ assetId, objectKey, checksum: checked.checksum }],
    });
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId,
      draftId,
      versionId,
      accountId,
      actorId,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      workspaceId,
      draftId,
      versionId,
      accountId,
      approvalId,
      actorId,
      accountConnectionSequence: 1,
      generation: 1,
      at: Date.now(),
      timezone: "UTC",
      localTime: "synthetic",
      state: "publishing",
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    });
    return {
      workspaceId,
      foreign,
      actorId,
      membershipId,
      accountId,
      credentialId,
      assetId,
      otherAssetId,
      sessionId,
      draftId,
      versionId,
      approvalId,
      scheduleId,
    };
  });
  const job = { scheduleId: f.scheduleId, generation: 1, mediaPosition: 0 };
  const storage = vi.spyOn(S3Client.prototype, "send").mockImplementation(
    async () =>
      ({
        ContentLength: bytes.length,
        Body: (async function* () {
          yield bytes;
        })(),
      }) as never,
  );
  const checkpoint = () =>
    t.run((ctx) => ctx.db.query("xMediaCheckpoints").order("desc").first());
  return { ...f, t, bytes, job, storage, checkpoint };
}
test("source derives exact historical alt and rejects foreign, unbound, swapped and namespace-drift sources", async () => {
  const f = await fixture();
  expect(
    await f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).toMatchObject({ alt: "Historical approved alt", assetId: f.assetId });
  await f.t.run((ctx) =>
    ctx.db.patch(f.sessionId, {
      assetId: f.otherAssetId,
    }),
  );
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).rejects.toThrow("MEDIA_SOURCE_CHANGED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.sessionId, { assetId: f.assetId, workspaceId: f.foreign }),
  );
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).rejects.toThrow();
  await f.t.run((ctx) =>
    ctx.db.patch(f.sessionId, {
      workspaceId: f.workspaceId,
      r2AccountId: "b".repeat(32),
    }),
  );
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).rejects.toThrow("MEDIA_CONFIGURATION_REQUIRED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.assetId, { uploadSessionId: undefined }),
  );
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).rejects.toThrow("MEDIA_BINDING_RECONCILIATION_REQUIRED");
});
test("source rejects snapshot correspondence, stale schedule, revoked approval, changed authority and deleting workspace", async () => {
  const f = await fixture();
  const version = await f.t.run((ctx) => ctx.db.get(f.versionId));
  const other = await f.t.run((ctx) => ctx.db.get(f.otherAssetId));
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, {
      mediaChecksums: [
        {
          assetId: f.otherAssetId,
          checksum: other!.checksum,
          objectKey: other!.objectKey,
        },
      ],
    }),
  );
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).rejects.toThrow("MEDIA_SNAPSHOT_CHANGED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, { mediaChecksums: version!.mediaChecksums }),
  );
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, {
      ...f.job,
      generation: 2,
    }),
  ).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.patch(f.approvalId, { revokedAt: Date.now() }));
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).rejects.toThrow();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.approvalId, { revokedAt: null });
    await ctx.db.patch(f.membershipId, { role: "Editor" });
  });
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).rejects.toThrow("SCHEDULER_AUTHORITY_CHANGED");
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.membershipId, { role: "Owner" });
    await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
  });
  await expect(
    f.t.mutation(internal.publishing.media.approvedSource, f.job),
  ).rejects.toThrow();
});
test("interrupted reads safely reclaim, interrupted writes stay uncertain and read-only status has bounded retries", async () => {
  const f = await fixture(),
    first = (await f.t.mutation(internal.publishing.media.claim, f.job))!;
  await f.t.run((ctx) =>
    ctx.db.patch(first._id, { leaseUntil: Date.now() - 1 }),
  );
  const resumed = (await f.t.mutation(internal.publishing.media.claim, f.job))!;
  expect(resumed).toMatchObject({
    claimSequence: first.claimSequence + 1,
    phase: "initialize",
    measurementIncomplete: true,
  });
  await f.t.run((ctx) =>
    ctx.db.patch(first._id, {
      leaseUntil: Date.now() - 1,
      operation: "initialize",
    }),
  );
  expect(await f.t.mutation(internal.publishing.media.claim, f.job)).toBe(null);
  expect(await f.checkpoint()).toMatchObject({ phase: "uncertain" });
  const g = await fixture(),
    c = (await g.t.mutation(internal.publishing.media.claim, g.job))!;
  await g.t.run((ctx) =>
    ctx.db.patch(c._id, {
      phase: "processing",
      mediaId: "123",
      expiresAt: Date.now() + 3600000,
      operation: undefined,
      leaseUntil: 0,
    }),
  );
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "Retry-After": "12" } }),
    );
  await g.t.action(internal.integrations.x.publish.prepare, g.job);
  expect(await g.checkpoint()).toMatchObject({
    phase: "processing",
    statusReads: 1,
  });
  expect((await g.checkpoint())!.nextCheckAt).toBeGreaterThanOrEqual(
    Date.now() + 11000,
  );
  await g.t.run((ctx) =>
    ctx.db.patch(c._id, { nextCheckAt: Date.now(), statusReads: 30 }),
  );
  await g.t.action(internal.integrations.x.publish.prepare, g.job);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await g.checkpoint()).toMatchObject({
    phase: "failed",
    errorCode: "X_MEDIA_BUDGET_EXHAUSTED",
  });
});
test("failed processing and rejected metadata never expose ready media, and credentials are rechecked after source read", async () => {
  const f = await fixture(),
    c = (await f.t.mutation(internal.publishing.media.claim, f.job))!;
  await f.t.run((ctx) =>
    ctx.db.patch(c._id, {
      phase: "processing",
      mediaId: "123",
      expiresAt: Date.now() + 3600000,
      operation: undefined,
      leaseUntil: 0,
    }),
  );
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        data: { id: "123", processing_info: { state: "failed" } },
      }),
    ),
  );
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(await f.checkpoint()).toMatchObject({
    phase: "failed",
    metadataApplied: false,
  });
  const g = await fixture(),
    d = (await g.t.mutation(internal.publishing.media.claim, g.job))!;
  await g.t.run((ctx) =>
    ctx.db.patch(d._id, {
      phase: "metadata",
      mediaId: "123",
      expiresAt: Date.now() + 3600000,
      operation: undefined,
      leaseUntil: 0,
    }),
  );
  fetch.mockResolvedValueOnce(new Response("", { status: 403 }));
  await g.t.action(internal.integrations.x.publish.prepare, g.job);
  expect(await g.checkpoint()).toMatchObject({
    phase: "failed",
    metadataApplied: false,
  });
  expect(await g.t.mutation(internal.publishing.media.ready, g.job)).toBe(null);
  const h = await fixture();
  h.storage.mockImplementationOnce(async () => {
    await h.t.run((ctx) => ctx.db.patch(h.credentialId, { scopes: [] }));
    return {
      ContentLength: h.bytes.length,
      Body: (async function* () {
        yield h.bytes;
      })(),
    };
  });
  await h.t.action(internal.integrations.x.publish.prepare, h.job);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await h.checkpoint()).toMatchObject({
    phase: "failed",
    bytesRead: h.bytes.length,
    providerRequests: 0,
    errorCode: "X_SCOPE_REQUIRED",
  });
});
test("actual final read checksum mismatch prevents every X call and measures failed retrieval", async () => {
  const f = await fixture(),
    fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected X"));
  f.storage.mockImplementation(
    async () =>
      ({
        ContentLength: f.bytes.length,
        Body: (async function* () {
          yield Buffer.alloc(f.bytes.length);
        })(),
      }) as never,
  );
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(fetch).not.toHaveBeenCalled();
  expect(await f.checkpoint()).toMatchObject({
    phase: "failed",
    bytesRead: f.bytes.length,
    providerRequests: 0,
    readRetries: 0,
  });
});
test("confirmed initialization and append resume without repeating chunks; processing waits and exact metadata yields ready", async () => {
  const f = await fixture();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { id: "123", expires_after_secs: 3600 } }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { expires_at: Math.floor(Date.now() / 1000) + 3600 },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: "123",
            processing_info: { state: "pending", check_after_secs: 1 },
          },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { id: "123", processing_info: { state: "succeeded" } },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "123" } })),
    );
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(await f.checkpoint()).toMatchObject({
    phase: "finalize",
    nextSegment: 1,
    chunkCount: 1,
    bytesUploaded: f.bytes.length,
    bytesRead: f.bytes.length * 2,
  });
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(await f.checkpoint()).toMatchObject({ phase: "processing" });
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(fetch).toHaveBeenCalledTimes(3);
  const processingCheckpoint = (await f.checkpoint())!;
  await f.t.run(async (ctx) => {
    const c = processingCheckpoint;
    await ctx.db.patch(c._id, { nextCheckAt: Date.now() });
  });
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(await f.checkpoint()).toMatchObject({
    phase: "ready",
    metadataApplied: true,
    providerRequests: 5,
    bytesSubmitted: f.bytes.length,
  });
  expect(fetch.mock.calls[4][1]!.body).toBe(
    JSON.stringify({
      id: "123",
      metadata: { alt_text: { text: "Historical approved alt" } },
    }),
  );
  expect(
    await f.t.mutation(internal.publishing.media.ready, f.job),
  ).toMatchObject({ mediaId: "123" });
});
test("uncertain append is durable and never blindly repeated; stale receipts cannot acknowledge new claims", async () => {
  const f = await fixture(),
    fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { id: "123", expires_after_secs: 3600 } }),
        ),
      )
      .mockRejectedValueOnce(new Error("lost acknowledgment"));
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  const c = (await f.checkpoint())!;
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(c).toMatchObject({
    phase: "uncertain",
    nextSegment: 0,
    bytesUploaded: 0,
    bytesSubmitted: f.bytes.length,
    measurementIncomplete: true,
  });
  await f.t.mutation(internal.publishing.media.receipt, {
    checkpointId: c._id,
    claimSequence: c.claimSequence - 1,
    phase: "ready",
    waitMs: 0,
    bytesRead: 0,
    durationMs: 0,
    incomplete: false,
  });
  expect((await f.checkpoint())!.phase).toBe("uncertain");
});
test("late initialize outcome is recorded after cancel but cannot continue; expired ready media gets new bounded attempt", async () => {
  const f = await fixture();
  vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
    await f.t.run((ctx) =>
      ctx.db.patch(f.scheduleId, { state: "cancelled", generation: 2 }),
    );
    return new Response(
      JSON.stringify({ data: { id: "123", expires_after_secs: 3600 } }),
    );
  });
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(await f.checkpoint()).toMatchObject({
    phase: "blocked",
    mediaId: "123",
  });
  const g = await fixture(),
    c = (await g.t.mutation(internal.publishing.media.claim, g.job))!;
  await g.t.run((ctx) =>
    ctx.db.patch(c._id, {
      phase: "ready",
      metadataApplied: true,
      mediaId: "123",
      expiresAt: Date.now() + EXPIRY_MARGIN_MS - 1,
      deadline: Date.now() - 1,
      operation: undefined,
      leaseUntil: 0,
    }),
  );
  expect(await g.t.mutation(internal.publishing.media.ready, g.job)).toBe(null);
  expect(
    await g.t.mutation(internal.publishing.media.claim, g.job),
  ).toMatchObject({ attempt: 2, phase: "initialize", nextSegment: 0 });
});
test.each(["initialize", "append"] as const)(
  "caught R2 timeout in %s preserves acknowledged progress and resumes only after a fresh read",
  async (phase) => {
    const f = await fixture(),
      c = (await f.t.mutation(internal.publishing.media.claim, f.job))!;
    await f.t.run((ctx) =>
      ctx.db.patch(c._id, {
        phase,
        ...(phase === "append"
          ? {
              mediaId: "123",
              expiresAt: Date.now() + 3600000,
              nextSegment: 1,
              chunkCount: 1,
              bytesUploaded: CHUNK_BYTES,
            }
          : {}),
        operation: undefined,
        leaseUntil: 0,
      }),
    );
    f.storage.mockRejectedValueOnce(
      Object.assign(new Error("read timeout"), { name: "TimeoutError" }),
    );
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { id: "123", expires_after_secs: 3600 } }),
        ),
      );
    await f.t.action(internal.integrations.x.publish.prepare, f.job);
    const retry = (await f.checkpoint())!;
    expect(fetch).not.toHaveBeenCalled();
    expect(retry).toMatchObject({
      phase,
      nextSegment: phase === "append" ? 1 : 0,
      chunkCount: phase === "append" ? 1 : 0,
      providerRequests: 0,
      readRetries: 1,
      errorCode: "MEDIA_RETRIEVAL_RETRY",
    });
    expect(retry.nextCheckAt).toBeGreaterThan(Date.now());
    await f.t.action(internal.integrations.x.publish.prepare, f.job);
    expect(f.storage).toHaveBeenCalledTimes(1);
    // Fresh credential rejection proves the resumed read cannot reuse pre-interruption authorization.
    await f.t.run((ctx) => ctx.db.patch(f.credentialId, { scopes: [] }));
    await vi.advanceTimersByTimeAsync(1000);
    await f.t.finishInProgressScheduledFunctions();
    expect(f.storage).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
    expect(await f.checkpoint()).toMatchObject({
      phase: "failed",
      nextSegment: phase === "append" ? 1 : 0,
      chunkCount: phase === "append" ? 1 : 0,
      errorCode: "X_SCOPE_REQUIRED",
    });
  },
);
test("transient R2 reads exhaust a small retry budget while invalid bytes and access errors remain permanent", async () => {
  const f = await fixture(),
    fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected X"));
  f.storage.mockRejectedValue(
    Object.assign(new Error("connection reset"), { code: "ECONNRESET" }),
  );
  for (let n = 0; n < 4; n++) {
    await f.t.action(internal.integrations.x.publish.prepare, f.job);
    const c = (await f.checkpoint())!;
    await f.t.run((ctx) => ctx.db.patch(c._id, { nextCheckAt: Date.now() }));
  }
  expect(await f.checkpoint()).toMatchObject({
    phase: "failed",
    readRetries: 3,
    errorCode: "MEDIA_READ_RETRY_BUDGET_EXHAUSTED",
  });
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(f.storage).toHaveBeenCalledTimes(4);
  expect(fetch).not.toHaveBeenCalled();
  const g = await fixture();
  g.storage.mockRejectedValueOnce({
    $metadata: { httpStatusCode: 403 },
    name: "AccessDenied",
  });
  await g.t.action(internal.integrations.x.publish.prepare, g.job);
  expect(await g.checkpoint()).toMatchObject({
    phase: "failed",
    readRetries: 0,
  });
  expect(fetch).not.toHaveBeenCalled();
});
test("R2 read retry stops at the shared deadline and rechecks source before any resumed retrieval", async () => {
  const f = await fixture(),
    fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected X"));
  f.storage.mockRejectedValueOnce({ name: "TimeoutError" });
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  const c = (await f.checkpoint())!;
  await f.t.run((ctx) =>
    ctx.db.patch(c._id, { deadline: Date.now() - 1, nextCheckAt: Date.now() }),
  );
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(f.storage).toHaveBeenCalledTimes(1);
  expect(await f.checkpoint()).toMatchObject({
    phase: "failed",
    errorCode: "X_MEDIA_BUDGET_EXHAUSTED",
  });
  const g = await fixture();
  g.storage.mockClear();
  g.storage.mockRejectedValueOnce({ name: "TimeoutError" });
  await g.t.action(internal.integrations.x.publish.prepare, g.job);
  const d = (await g.checkpoint())!;
  await g.t.run(async (ctx) => {
    await ctx.db.patch(d._id, { nextCheckAt: Date.now() });
    await ctx.db.patch(g.assetId, { state: "deleting" });
  });
  await expect(
    g.t.action(internal.integrations.x.publish.prepare, g.job),
  ).rejects.toThrow("MEDIA_NOT_READY");
  expect(g.storage).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});
test("a confirmed first segment survives reset and only the remaining validated segment is uploaded", async () => {
  // One valid image just over the segment boundary; no maximum-size/stress fixture.
  const bytes = PNG.sync.write({
      width: 1024,
      height: 1025,
      data: randomBytes(1024 * 1025 * 4),
    } as PNG),
    f = await fixture(bytes);
  expect(bytes.length).toBeGreaterThan(CHUNK_BYTES);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { id: "123", expires_after_secs: 3600 } }),
      ),
    )
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            data: { expires_at: Math.floor(Date.now() / 1000) + 3600 },
          }),
        ),
    );
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(await f.checkpoint()).toMatchObject({
    nextSegment: 1,
    chunkCount: 1,
    bytesUploaded: CHUNK_BYTES,
  });
  f.storage.mockRejectedValueOnce({ code: "ECONNRESET" });
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  const c = (await f.checkpoint())!;
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(c).toMatchObject({
    phase: "append",
    nextSegment: 1,
    chunkCount: 1,
    readRetries: 1,
  });
  await f.t.run((ctx) => ctx.db.patch(c._id, { nextCheckAt: Date.now() }));
  await f.t.action(internal.integrations.x.publish.prepare, f.job);
  expect(fetch).toHaveBeenCalledTimes(3);
  const form = fetch.mock.calls[2][1]!.body as FormData;
  expect(form.get("segment_index")).toBe("1");
  expect(Buffer.from(await (form.get("media") as Blob).arrayBuffer())).toEqual(
    bytes.subarray(CHUNK_BYTES),
  );
  expect(await f.checkpoint()).toMatchObject({
    phase: "finalize",
    nextSegment: 2,
    chunkCount: 2,
    bytesUploaded: bytes.length,
  });
});
