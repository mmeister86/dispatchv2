import { test, expect, vi, afterEach, beforeEach } from "vitest";
import { mediaFixture } from "../../tests/media-fixture";
import { api, internal } from "../_generated/api";
import { localInput } from "../../src/lib/time";
beforeEach(() => vi.stubEnv("R2_MEDIA_BUCKET", "synthetic-eu"));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
test("ready has no public setter; reservation quota, roles and foreign IDs are enforced", async () => {
  const f = await mediaFixture();
  const s = await f.reserve();
  await expect(
    f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      content: {
        title: "Unready",
        text: ["Text"],
        media: [{ assetId: s.assetId, alt: "alt" }],
        accountId: null,
        pillar: "",
        strategy: "",
      },
      source: "test",
    }),
  ).rejects.toThrow("MEDIA_NOT_READY");
  const foreign = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Other", description: "" }),
  );
  await expect(
    f.signed.mutation(api.media.assets.setAlt, {
      workspaceId: foreign,
      assetId: s.assetId,
      alt: "alt",
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  const membership = await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique(),
  );
  await f.t.run((ctx) => ctx.db.patch(membership!._id, { role: "Viewer" }));
  await expect(f.reserve()).rejects.toThrow("ROLE_ACCESS_DENIED");
  await f.t.run(async (ctx) => {
    await ctx.db.patch(membership!._id, { role: "Owner" });
    await ctx.db.patch(f.workspaceId, {
      mediaReservedBytes: 512 * 1024 * 1024,
    });
  });
  await expect(f.reserve()).rejects.toThrow("MEDIA_QUOTA_EXCEEDED");
  await expect(
    f.signed.action(api.media.r2.finish, {
      workspaceId: f.workspaceId,
      sessionId: s._id,
      objectKey: "arbitrary",
    } as never),
  ).rejects.toThrow();
});
test("old immutable references protect deletion and retain exact alt when defaults change", async () => {
  const f = await mediaFixture();
  const s = await f.ready();
  const content = {
    title: "Pinned",
    text: ["Text"],
    media: [{ assetId: s.assetId, alt: "Exact old alt" }],
    accountId: null,
    pillar: "",
    strategy: "",
  };
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content,
    source: "test",
  });
  await f.signed.mutation(api.media.assets.setAlt, {
    workspaceId: f.workspaceId,
    assetId: s.assetId,
    alt: "New default",
  });
  for (let i = 1; i <= 110; i++)
    await f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId,
      expectedRevision: i,
      content: { ...content, media: [] },
      reason: "No medium",
    });
  await expect(
    f.signed.mutation(api.media.uploads.remove, {
      workspaceId: f.workspaceId,
      assetId: s.assetId,
    }),
  ).rejects.toThrow("MEDIA_REFERENCED");
  const version = await f.t.run((ctx) =>
    ctx.db
      .query("draftVersions")
      .withIndex("by_draftId_and_number", (q) =>
        q.eq("draftId", draftId).eq("number", 1),
      )
      .unique(),
  );
  expect(version!.content.media[0].alt).toBe("Exact old alt");
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("mediaVersionReferences")
        .withIndex("by_assetId", (q) => q.eq("assetId", s.assetId))
        .collect(),
    ),
  ).toHaveLength(1);
});
test("deleted/validating media cannot gain references and late finalize cannot resurrect deletion", async () => {
  const f = await mediaFixture();
  const s = await f.reserve();
  const claim = await f.signed.mutation(internal.media.uploads.claim, {
    workspaceId: f.workspaceId,
    sessionId: s._id,
  });
  await f.signed.mutation(api.media.uploads.remove, {
    workspaceId: f.workspaceId,
    assetId: s.assetId,
  });
  await expect(
    f.t.mutation(internal.media.uploads.complete, {
      sessionId: s._id,
      generation: claim.generation,
      metadata: {
        mime: "image/png",
        type: "image",
        size: 70,
        width: 1,
        height: 1,
        checksum: "sha",
      },
    }),
  ).rejects.toThrow("UPLOAD_SESSION_CLOSED");
  await expect(
    f.signed.mutation(internal.media.uploads.claim, {
      workspaceId: f.workspaceId,
      sessionId: s._id,
    }),
  ).rejects.toThrow("UPLOAD_SESSION_CLOSED");
  await expect(
    f.signed.query(internal.media.assets.previewSource, {
      workspaceId: f.workspaceId,
      assetId: s.assetId,
    }),
  ).rejects.toThrow("MEDIA_NOT_READY");
  expect((await f.t.run((ctx) => ctx.db.get(s.assetId)))!.state).toBe(
    "deleting",
  );
});
test("workspace deleting barrier stops preparation, preview, finalization and text-only publisher sends", async () => {
  const f = await mediaFixture();
  const s = await f.reserve();
  const claim = await f.signed.mutation(internal.media.uploads.claim, {
    workspaceId: f.workspaceId,
    sessionId: s._id,
  });
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "fixture",
      name: "Fixture",
      handle: "@fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image", "video"],
        publish: true,
      },
    }),
  );
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: {
      title: "Text only",
      text: ["Text"],
      media: [],
      accountId,
      pillar: "",
      strategy: "",
    },
    source: "test",
  });
  const versionId = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  }))!.versions[0]._id;
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId,
    accountId,
  });
  const at = Math.floor(Date.now() / 60000) * 60000 + 60000;
  const scheduleId = await f.signed.mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    versionId,
    accountId,
    approvalId,
    at,
    timezone: "UTC",
    localTime: localInput(new Date(at).toISOString(), "UTC"),
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(scheduleId, { state: "publishing" });
    await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
  });
  expect(
    await f.t.mutation(internal.publishing.checkSend, {
      scheduleId,
      generation: 1,
    }),
  ).toBe(false);
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.errorCode).toBe(
    "WORKSPACE_INACTIVE",
  );
  await expect(f.reserve()).rejects.toThrow("WORKSPACE_INACTIVE");
  await expect(
    f.signed.action(api.media.r2.preview, {
      workspaceId: f.workspaceId,
      assetId: s.assetId,
    }),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
  await expect(
    f.t.mutation(internal.media.uploads.complete, {
      sessionId: s._id,
      generation: claim.generation,
      metadata: {
        mime: "image/png",
        type: "image",
        size: 70,
        width: 1,
        height: 1,
        checksum: "sha",
      },
    }),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
});
test("cancelled sessions retain expiry tombstones and quota until R2 deletion receipt; later PUT is cleaned again", async () => {
  const f = await mediaFixture();
  const s = await f.reserve();
  await f.signed.mutation(api.media.uploads.remove, {
    workspaceId: f.workspaceId,
    assetId: s.assetId,
  });
  expect(
    await f.t.mutation(internal.media.cleanup.claim, { sessionId: s._id }),
  ).toBeNull();
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.mediaReservedBytes,
  ).toBe(70);
  vi.useFakeTimers();
  vi.setSystemTime(s.expiresAt + 60001);
  const cleanup = await f.t.mutation(internal.media.cleanup.claim, {
    sessionId: s._id,
  });
  expect(cleanup!.state).toBe("cancelled");
  await f.t.mutation(internal.media.cleanup.receipt, {
    sessionId: s._id,
    finalDeleted: true,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.mediaReservedBytes,
  ).toBe(0);
  expect((await f.t.run((ctx) => ctx.db.get(s.assetId)))!.state).toBe(
    "deleted",
  );
  vi.advanceTimersByTime(86400001);
  expect(
    (await f.t.mutation(internal.media.cleanup.claim, { sessionId: s._id }))!
      .state,
  ).toBe("deleted");
  await f.t.mutation(internal.media.cleanup.receipt, {
    sessionId: s._id,
    finalDeleted: true,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.mediaReservedBytes,
  ).toBe(0);
});
test("finalization claim is single-use and resumable using identical final key after full action lease", async () => {
  const f = await mediaFixture();
  const s = await f.reserve();
  const a = { workspaceId: f.workspaceId, sessionId: s._id };
  const first = await f.signed.mutation(internal.media.uploads.claim, a);
  await expect(
    f.signed.mutation(internal.media.uploads.claim, a),
  ).rejects.toThrow("MEDIA_VALIDATION_IN_PROGRESS");
  vi.useFakeTimers();
  vi.setSystemTime(first.leaseUntil + 1);
  const resumed = await f.signed.mutation(internal.media.uploads.claim, a);
  expect(resumed.finalKey).toBe(first.finalKey);
  expect(resumed.generation).toBe(first.generation + 1);
  expect(
    await f.t.mutation(internal.media.cleanup.claim, { sessionId: s._id }),
  ).toBeNull();
  await expect(
    f.t.mutation(internal.media.uploads.complete, {
      sessionId: s._id,
      generation: first.generation,
      metadata: {
        mime: "image/png",
        type: "image",
        size: 70,
        width: 1,
        height: 1,
        checksum: "sha",
      },
    }),
  ).rejects.toThrow("UPLOAD_SESSION_CLOSED");
  const metadata = {
    mime: "image/png",
    type: "image" as const,
    size: 70,
    width: 1,
    height: 1,
    checksum: "sha",
  };
  await f.t.mutation(internal.media.uploads.complete, {
    sessionId: s._id,
    generation: resumed.generation,
    metadata,
  });
  expect(
    await f.t.mutation(internal.media.uploads.complete, {
      sessionId: s._id,
      generation: resumed.generation,
      metadata,
    }),
  ).toBe(s.assetId);
});

test("pinned media descriptors load beyond the first100 resources and media inventory is paginated", async () => {
  const f = await mediaFixture();
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 105; i++)
      await ctx.db.insert("mediaAssets", {
        workspaceId: f.workspaceId,
        storageProvider: "r2",
        objectKey: `old/${i}`,
        checksum: "old",
        name: `Old ${i}`,
        type: "image",
        size: 1,
        state: "ready",
      });
  });
  const s = await f.ready();
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: {
      title: "Deep media",
      text: ["Text"],
      media: [{ assetId: s.assetId, alt: "Pinned" }],
      accountId: null,
      pillar: "",
      strategy: "",
    },
    source: "test",
  });
  const resources = await f.signed.query(api.editorial.resources, {
    workspaceId: f.workspaceId,
  });
  expect(resources.assets.some((a) => a._id === s.assetId)).toBe(false);
  expect(resources.resourcesLimited).toBe(true);
  const detail = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  });
  expect(detail!.assets.map((a) => a._id)).toEqual([s.assetId]);
  const page = await f.signed.query(api.media.assets.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { numItems: 5, cursor: null },
  });
  expect(page.page).toHaveLength(5);
  expect(page.page[0]._id).toBe(s.assetId);
  expect(page.isDone).toBe(false);
});

test("temporary grants are session-bound and sign exact length/type; ready previews are short-lived GETs", async () => {
  const f = await mediaFixture();
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "0".repeat(32));
  vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic-key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "synthetic-secret");
  vi.stubEnv("R2_MEDIA_EU_CONFIRMED", "true");
  const args = {
    workspaceId: f.workspaceId,
    requestId: crypto.randomUUID(),
    name: "Fixture.png",
    size: 70,
    mime: "image/png",
    alt: "Fixture",
  };
  const first = await f.signed.action(api.media.r2.prepare, args),
    replay = await f.signed.action(api.media.r2.prepare, args);
  expect(replay.assetId).toBe(first.assetId);
  expect(replay.sessionId).toBe(first.sessionId);
  const url = new URL(first.uploadUrl);
  expect(url.hostname).toBe(`${"0".repeat(32)}.eu.r2.cloudflarestorage.com`);
  expect(url.pathname).toContain(`/temporary/${f.workspaceId}/`);
  expect(url.pathname).not.toContain("/final/");
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
    "content-length",
  );
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
  expect(Number(url.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(
    600,
  );
  const s = await f.ready();
  const preview = await f.signed.action(api.media.r2.preview, {
    workspaceId: f.workspaceId,
    assetId: s.assetId,
  });
  expect(new URL(preview.url).pathname).toContain("/final/");
  expect(new URL(preview.url).searchParams.get("X-Amz-Expires")).toBe("120");
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.mediaReservedBytes,
  ).toBe(140);
});
