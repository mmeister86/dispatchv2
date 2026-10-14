import { convexTest } from "convex-test";
import betterAuthComponent from "@convex-dev/better-auth/test";
import { expect, test, vi, afterEach } from "vitest";
import schema from "../convex/schema";
import { ConvexError, v } from "convex/values";
import * as contentProof from "../convex/research/contentProof";
import { api, internal, components } from "../convex/_generated/api";
import { resolveLocalTime, localInput } from "../src/lib/time";
import { preflight, failure } from "../convex/publishing";
import { internalQuery } from "../convex/_generated/server";
const modules = import.meta.glob("../convex/**/*.ts");
test("manual account move preserves old scheduled snapshot and excludes mixed edit feedback", async () => {
  const f = await setup();
  const scheduleId = await f.plan();
  const accountId = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...a } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", {
      ...a,
      providerIdentity: "second",
      handle: "@second",
    });
  });
  const versionId = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    expectedRevision: 1,
    content: { ...f.content, accountId, text: ["Changed B text"] },
    reason: "Move",
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.draftId)))!.currentVersionId,
  ).toBe(versionId);
  expect(
    (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
    }))!.approvals.some((a) => a.versionId === versionId),
  ).toBe(false);
  await expect(
    f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId,
      accountId: f.accountId,
    }),
  ).rejects.toThrow("APPROVAL_ACCOUNT_MISMATCH");
  expect(
    await f.t.run(
      async (ctx) =>
        (await preflight(ctx, (await ctx.db.get(scheduleId))!))._id,
    ),
  ).toBe(f.versionId);
  let rows = await f.signed.query(api.content.feedback.list, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
  });
  expect(rows.map((r) => r.kind)).toEqual(["accept"]);
  const legacyId = await f.t.run((ctx) =>
    ctx.db.insert("contentFeedback", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      versionId: f.versionId,
      resultingVersionId: versionId,
      actorId: f.userId,
      kind: "edit",
      createdAt: Date.now(),
      editExtent: 99,
      definition: "changed-middle-codepoints-v1",
      sourceUntil: null,
      sourceUnavailable: false,
    }),
  );
  rows = await f.signed.query(api.content.feedback.list, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
  });
  expect(rows.find((r) => r._id === legacyId)).toMatchObject({
    sourceUnavailable: true,
    editExtent: null,
  });
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId,
    expectedGeneration: 1,
  });
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId,
      generation: 1,
    }),
  ).toBeNull();
  const same = await setup();
  await same.signed.mutation(api.editorial.save, {
    workspaceId: same.workspaceId,
    draftId: same.draftId,
    expectedRevision: 1,
    content: { ...same.content, text: ["Changed A text"] },
    reason: "Edit",
  });
  for (const kind of ["accept", "reject"] as const)
    await same.signed.mutation(api.content.feedback.decide, {
      workspaceId: same.workspaceId,
      versionId: same.versionId,
      kind,
    });
  const kept = await same.signed.query(api.content.feedback.list, {
    workspaceId: same.workspaceId,
    accountId: same.accountId,
  });
  expect(kept.map((r) => r.kind).sort()).toEqual(["accept", "edit", "reject"]);
  expect(kept.find((r) => r.kind === "edit")!.editExtent).toBeGreaterThan(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function setup(fixtureModules = modules) {
  const t = convexTest(schema, fixtureModules);
  betterAuthComponent.register(t);
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const identity = await t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Owner",
          email: "editorial@example.test",
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: {
          userId: u._id,
          providerId: "credential",
          accountId: u._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          password: "synthetic-hash",
        },
      },
    });
    const s = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: u._id,
          token: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      },
    });
    return { subject: u._id, sessionId: s._id };
  });
  const signed = t.withIdentity(identity);
  const userId = await signed.mutation(api.users.bootstrap, {});
  const workspaceSnapshot = await signed.query(api.users.current, {});
  if (workspaceSnapshot.state !== "ready")
    throw new Error("Fixture workspace must be ready");
  const { activeWorkspaceId: workspaceId } = workspaceSnapshot;
  const accountId = await t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
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
    }),
  );
  const content = {
    title: "Draft",
    text: ["A synthetic post"],
    media: [],
    accountId,
    pillar: "Learnings",
    strategy: "generic",
  };
  const draftId = await signed.mutation(api.editorial.create, {
    workspaceId,
    content,
    source: "Test",
  });
  const versionId = (await signed.query(api.editorial.get, {
    workspaceId,
    draftId,
  }))!.versions[0]._id;
  const approve = () =>
    signed.mutation(api.editorial.approve, {
      workspaceId,
      versionId,
      accountId,
    });
  const plan = async () => {
    const approvalId = await approve();
    const at = Math.floor(Date.now() / 60000) * 60000 + 3600000;
    return signed.mutation(api.editorial.schedule, {
      workspaceId,
      versionId,
      accountId,
      approvalId,
      at,
      timezone: "UTC",
      localTime: localInput(new Date(at).toISOString(), "UTC"),
    });
  };
  return {
    t,
    signed,
    userId,
    workspaceId,
    accountId,
    content,
    draftId,
    versionId,
    approve,
    plan,
  };
}
test("versions immutable, concurrent CAS preserves winner and rejects loser, and pagination-independent get", async () => {
  const f = await setup();
  const args = {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    expectedRevision: 1,
    reason: "Edit",
  };
  const results = await Promise.allSettled([
    f.signed.mutation(api.editorial.save, {
      ...args,
      content: { ...f.content, text: ["winner"] },
    }),
    f.signed.mutation(api.editorial.save, {
      ...args,
      content: { ...f.content, text: ["loser"] },
    }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: expect.objectContaining({
      message: expect.stringContaining("SAVE_CONFLICT"),
    }),
  });
  const b = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  expect(b!.versions[0].content.text).toEqual(["A synthetic post"]);
  expect(b!.versions).toHaveLength(2);
});
test("approval binds exact version/account/media and rejects nested foreign references and Viewer", async () => {
  const f = await setup();
  const approvalId = await f.approve();
  const v2 = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    expectedRevision: 1,
    content: { ...f.content, text: ["edited"] },
    reason: "Edit",
  });
  const at = Math.floor(Date.now() / 60000) * 60000 + 3600000;
  await expect(
    f.signed.mutation(api.editorial.schedule, {
      workspaceId: f.workspaceId,
      versionId: v2,
      accountId: f.accountId,
      approvalId,
      at,
      timezone: "UTC",
      localTime: localInput(new Date(at).toISOString(), "UTC"),
    }),
  ).rejects.toThrow("APPROVAL_REQUIRED");
  const foreign = await f.t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "",
    });
    return ctx.db.insert("mediaAssets", {
      workspaceId,
      storageProvider: "r2",
      objectKey: "immutable",
      checksum: "synthetic",
      name: "Foreign",
      type: "image",
      size: 1,
      state: "ready",
    });
  });
  await expect(
    f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      expectedRevision: 2,
      content: { ...f.content, media: [{ assetId: foreign, alt: "alt" }] },
      reason: "Media",
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(m!._id, { role: "Viewer" });
  });
  await expect(
    f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      expectedRevision: 2,
      content: f.content,
      reason: "Edit",
    }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  await expect(f.approve()).rejects.toThrow("ROLE_ACCESS_DENIED");
});
test("capability adapter controls validation and account changes require new approval", async () => {
  const f = await setup();
  await f.t.run((ctx) =>
    ctx.db.patch(f.accountId, {
      capability: {
        maxText: 3,
        maxThread: 1,
        maxMedia: 0,
        mediaTypes: [],
        publish: true,
      },
    }),
  );
  await expect(f.approve()).rejects.toThrow("CAPABILITY_VALIDATION_FAILED");
  await expect(
    f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      expectedRevision: 1,
      content: f.content,
      reason: "Edit",
    }),
  ).rejects.toThrow("CAPABILITY_VALIDATION_FAILED");
  const d = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: { ...f.content, accountId: null, text: [""] },
    source: "Manual",
  });
  expect(d).toBeTruthy();
});
test("job claims once, reschedule invalidates previous job, cancellation before and after claim defined", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  const f = await setup();
  const scheduleId = await f.plan();
  const at = Date.now() + 7200000;
  await f.signed.mutation(api.editorial.reschedule, {
    workspaceId: f.workspaceId,
    scheduleId,
    expectedGeneration: 1,
    at,
    timezone: "UTC",
    localTime: localInput(new Date(at).toISOString(), "UTC"),
  });
  vi.setSystemTime(at);
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId,
      generation: 1,
    }),
  ).toBeNull();
  const claims = await Promise.all([
    f.t.mutation(internal.publishing.claim, { scheduleId, generation: 2 }),
    f.t.mutation(internal.publishing.claim, { scheduleId, generation: 2 }),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId,
    expectedGeneration: 2,
  });
  expect(
    await f.t.mutation(internal.publishing.checkSend, {
      scheduleId,
      generation: 2,
    }),
  ).toBe(false);
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.state).toBe(
    "reconciliation_required",
  );
  const before = await f.plan();
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: before,
    expectedGeneration: 1,
  });
  vi.advanceTimersByTime(3600000);
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId: before,
      generation: 1,
    }),
  ).toBeNull();
});
test("revocation, missing asset, disconnection and loss of authority block claim or further send", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  const f = await setup();
  const scheduleId = await f.plan();
  const approvalId = await f.approve();
  await f.signed.mutation(api.editorial.revoke, {
    workspaceId: f.workspaceId,
    approvalId,
  });
  vi.setSystemTime(Math.floor(Date.now() / 60000) * 60000 + 3600000);
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId,
      generation: 1,
    }),
  ).toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.errorCode).toBe(
    "APPROVAL_REQUIRED",
  );
  const next = await f.plan();
  vi.setSystemTime(Math.floor(Date.now() / 60000) * 60000 + 3600000);
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId: next,
      generation: 1,
    }),
  ).toBeTruthy();
  await f.t.run((ctx) =>
    ctx.db.patch(f.accountId, { connection: "reauth_required" }),
  );
  expect(
    await f.t.mutation(internal.publishing.checkSend, {
      scheduleId: next,
      generation: 1,
    }),
  ).toBe(false);
});
test("dispatcher records real unavailable failure and blocked optional email without external request", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  vi.stubEnv("AUTH_EMAIL_FROM", "");
  const f = await setup();
  const scheduleId = await f.plan();
  vi.setSystemTime(Math.floor(Date.now() / 60000) * 60000 + 3600000);
  const fetchIO = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("UNEXPECTED_PROVIDER_IO"));
  await f.t.action(internal.publishing.dispatch, { scheduleId, generation: 1 });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  const notification = await f.t.run((ctx) =>
    ctx.db
      .query("publishingNotifications")
      .withIndex("by_workspaceId_and_createdAt", (q) =>
        q.eq("workspaceId", f.workspaceId),
      )
      .first(),
  );
  await f.t.action(internal.publishing.notify, {
    notificationId: notification!._id,
  });
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.state).toBe(
    "failed",
  );
  expect(
    (await f.t.run((ctx) => ctx.db.get(notification!._id)))!.errorCode,
  ).toBe("OPTIONAL_EMAIL_UNAVAILABLE");
  expect(notification).toMatchObject({
    generation: 1,
    state: "blocked",
    errorCode: "OPTIONAL_EMAIL_UNAVAILABLE",
  });
  expect(await f.t.run((ctx) => ctx.db.get(notification!._id))).toEqual(
    notification,
  );
  expect(fetchIO).not.toHaveBeenCalled();
  fetchIO.mockRestore();
});
test("server validates DST gaps, overlap chosen instant, future times and bounded calendar", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  const f = await setup();
  const approvalId = await f.approve();
  const common = {
    workspaceId: f.workspaceId,
    versionId: f.versionId,
    accountId: f.accountId,
    approvalId,
    timezone: "Europe/Berlin",
  };
  expect(resolveLocalTime("2026-03-29T02:30", "Europe/Berlin")).toEqual([]);
  const overlap = resolveLocalTime("2026-10-25T02:30", "Europe/Berlin");
  expect(overlap).toEqual([
    "2026-10-25T00:30:00.000Z",
    "2026-10-25T01:30:00.000Z",
  ]);
  await expect(
    f.signed.mutation(api.editorial.schedule, {
      ...common,
      at: Date.parse("2026-03-29T01:30:00Z"),
      localTime: "2026-03-29T02:30",
    }),
  ).rejects.toThrow("LOCAL_TIME_REQUIRES_EXPLICIT_INSTANT");
  for (const instant of overlap)
    await f.signed.mutation(api.editorial.schedule, {
      ...common,
      at: Date.parse(instant),
      localTime: "2026-10-25T02:30",
    });
  const rows = await f.signed.query(api.editorial.calendar, {
    workspaceId: f.workspaceId,
    start: Date.parse("2026-10-25T00:00Z"),
    end: Date.parse("2026-10-26T00:00Z"),
  });
  expect(rows.rows.map((r) => r.schedule.at)).toEqual(overlap.map(Date.parse));
  await expect(
    f.signed.query(api.editorial.calendar, {
      workspaceId: f.workspaceId,
      start: 0,
      end: 100 * 86400000,
    }),
  ).rejects.toThrow("INVALID_CALENDAR_RANGE");
});

test("media changes and account changes need new bound approval, planned V1 stays until explicit approved replacement", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  const f = await setup();
  const assetId = await f.t.run((ctx) =>
    ctx.db.insert("mediaAssets", {
      workspaceId: f.workspaceId,
      storageProvider: "r2",
      objectKey: "final-v1",
      checksum: "checksum-v1",
      name: "Fixture",
      type: "image",
      size: 1,
      state: "ready",
    }),
  );
  const v2 = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    expectedRevision: 1,
    content: { ...f.content, media: [{ assetId, alt: "First alt" }] },
    reason: "Media",
  });
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId: v2,
    accountId: f.accountId,
  });
  const at = Date.now() + 3600000;
  const scheduleId = await f.signed.mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    versionId: v2,
    accountId: f.accountId,
    approvalId,
    at,
    timezone: "UTC",
    localTime: localInput(new Date(at).toISOString(), "UTC"),
  });
  const v3 = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    expectedRevision: 2,
    content: { ...f.content, media: [{ assetId, alt: "Changed alt" }] },
    reason: "Alt metadata",
  });
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.versionId).toBe(v2);
  await expect(
    f.signed.mutation(api.editorial.reschedule, {
      workspaceId: f.workspaceId,
      scheduleId,
      expectedGeneration: 1,
      versionId: v3,
      approvalId,
      at,
      timezone: "UTC",
      localTime: localInput(new Date(at).toISOString(), "UTC"),
    }),
  ).rejects.toThrow("APPROVAL_REQUIRED");
  const newApproval = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId: v3,
    accountId: f.accountId,
  });
  await f.signed.mutation(api.editorial.reschedule, {
    workspaceId: f.workspaceId,
    scheduleId,
    expectedGeneration: 1,
    versionId: v3,
    approvalId: newApproval,
    at,
    timezone: "UTC",
    localTime: localInput(new Date(at).toISOString(), "UTC"),
  });
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.generation).toBe(2);
  await f.t.run((ctx) => ctx.db.patch(assetId, { checksum: "changed-bytes" }));
  vi.setSystemTime(at);
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId,
      generation: 2,
    }),
  ).toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.errorCode).toBe(
    "MEDIA_SNAPSHOT_CHANGED",
  );
  const another = await f.t.run(async (ctx) => {
    const account = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", {
      workspaceId: account.workspaceId,
      provider: account.provider,
      providerIdentity: "second",
      name: "Second",
      handle: "@second",
      connection: "connected",
      capability: account.capability,
    });
  });
  await expect(
    f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId: f.versionId,
      accountId: another,
    }),
  ).rejects.toThrow("APPROVAL_ACCOUNT_MISMATCH");
});
test("slot collision after over100 cancelled histories, nonmovable published rows, and densecalendar recoverable metadata", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  const f = await setup();
  const scheduleId = await f.plan();
  const row = (await f.t.run((ctx) => ctx.db.get(scheduleId)))!;
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = row;
    for (let i = 0; i < 101; i++)
      await ctx.db.insert("schedules", {
        ...fields,
        state: "cancelled",
        jobId: null,
      });
  });
  await expect(f.plan()).rejects.toThrow("SLOT_OCCUPIED");
  const dense = await f.signed.query(api.editorial.calendar, {
    workspaceId: f.workspaceId,
    start: Date.now(),
    end: Date.now() + 2 * 3600000,
  });
  expect(dense).toEqual({ rows: [], tooDense: true });
  await f.t.run((ctx) => ctx.db.patch(scheduleId, { state: "published" }));
  await expect(
    f.signed.mutation(api.editorial.cancel, {
      workspaceId: f.workspaceId,
      scheduleId,
      expectedGeneration: 1,
    }),
  ).rejects.toThrow("PUBLISHED_IMMUTABLE");
  await expect(
    f.signed.mutation(api.editorial.reschedule, {
      workspaceId: f.workspaceId,
      scheduleId,
      expectedGeneration: 1,
      at: row.at,
      timezone: row.timezone,
      localTime: row.localTime,
    }),
  ).rejects.toThrow("SCHEDULE_NOT_MOVABLE");
});
test("list only current snapshot, composer fetch beyond first page and paged historical versions, genuine comments and member assignment", async () => {
  const f = await setup();
  for (let i = 0; i < 21; i++)
    await f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      expectedRevision: i + 1,
      content: { ...f.content, text: [`Version ${i + 2}`] },
      reason: "History",
    });
  for (let i = 0; i < 26; i++)
    await f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      content: { ...f.content, title: `Draft ${i}` },
      source: "Fixture",
    });
  const list = await f.signed.query(api.editorial.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(list.isDone).toBe(false);
  expect(list.page.every((b) => b.versions.length === 1)).toBe(true);
  expect(list.page.some((b) => b.draft._id === f.draftId)).toBe(false);
  const detail = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  expect(detail!.versions.at(-1)!.number).toBe(22);
  expect(detail!.versions).toHaveLength(20);
  const first = await f.signed.query(api.editorial.history, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const second = await f.signed.query(api.editorial.history, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    paginationOpts: { numItems: 20, cursor: first.continueCursor },
  });
  expect(second.page.at(-1)!._id).toBe(f.versionId);
  const commentId = await f.signed.mutation(api.editorial.addComment, {
    workspaceId: f.workspaceId,
    versionId: f.versionId,
    text: "Review original",
  });
  const comment = await f.t.run((ctx) => ctx.db.get(commentId));
  expect(comment!.authorId).toBe(f.userId);
  expect(comment!.versionId).toBe(f.versionId);
  await f.signed.mutation(api.editorial.resolveComment, {
    workspaceId: f.workspaceId,
    commentId,
    expectedResolved: false,
  });
  await expect(
    f.signed.mutation(api.editorial.resolveComment, {
      workspaceId: f.workspaceId,
      commentId,
      expectedResolved: false,
    }),
  ).rejects.toThrow("COMMENT_CONFLICT");
  await f.signed.mutation(api.editorial.assign, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    versionId: (await f.t.run((ctx) => ctx.db.get(f.draftId)))!
      .currentVersionId!,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
    assigneeId: f.userId,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.draftId)))!.assigneeId).toBe(
    f.userId,
  );
  const otherWorkspace = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Foreign", description: "" }),
  );
  await expect(
    f.signed.query(api.editorial.get, {
      workspaceId: otherWorkspace,
      draftId: f.draftId,
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
});

test("real registered scheduler job executes once and stores missing credential notification without network", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  vi.stubEnv("AUTH_EMAIL_FROM", "");
  const f = await setup();
  const scheduleId = await f.plan();
  await vi.advanceTimersByTimeAsync(3600000);
  await f.t.finishAllScheduledFunctions(() =>
    vi.advanceTimersByTimeAsync(1000),
  );
  const row = await f.t.run((ctx) => ctx.db.get(scheduleId));
  expect(row!.state).toBe("failed");
  expect(row!.errorCode).toBe("X_REAUTH_REQUIRED");
  const events = await f.t.run((ctx) =>
    ctx.db
      .query("editorialEvents")
      .withIndex("by_workspaceId_and_createdAt", (q) =>
        q.eq("workspaceId", f.workspaceId),
      )
      .take(20),
  );
  expect(events.filter((e) => e.code === "PUBLISHING_CLAIMED")).toHaveLength(1);
  const notifications = await f.t.run((ctx) =>
    ctx.db
      .query("publishingNotifications")
      .withIndex("by_workspaceId_and_createdAt", (q) =>
        q.eq("workspaceId", f.workspaceId),
      )
      .take(10),
  );
  expect(notifications).toHaveLength(1);
  expect(notifications[0].state).toBe("blocked");
});
test("planning stops at the readable active limit and legacy overflow remains recoverable", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  const f = await setup();
  const approvalId = await f.approve();
  const planAt = (i: number) => {
    const at = Date.now() + 3600000 + i * 60000;
    return f.signed.mutation(api.editorial.schedule, {
      workspaceId: f.workspaceId,
      versionId: f.versionId,
      accountId: f.accountId,
      approvalId,
      at,
      timezone: "UTC",
      localTime: localInput(new Date(at).toISOString(), "UTC"),
    });
  };
  const ids: Awaited<ReturnType<typeof planAt>>[] = [];
  for (let i = 0; i < 100; i++) ids.push(await planAt(i));
  await expect(planAt(100)).rejects.toThrow("DRAFT_ACTIVE_SCHEDULE_LIMIT");
  const normal = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  expect(normal!.schedulesLimited).toBe(false);
  expect(normal!.schedules.filter((s) => s.state === "scheduled")).toHaveLength(
    100,
  );
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = (await ctx.db.get(ids[0]))!;
    await ctx.db.insert("schedules", {
      ...fields,
      at: fields.at + 100 * 60000,
      localTime: localInput(
        new Date(fields.at + 100 * 60000).toISOString(),
        "UTC",
      ),
      jobId: null,
    });
  });
  const overflow = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  expect(overflow!.schedulesLimited).toBe(true);
  const list = await f.signed.query(api.editorial.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(list.page[0].schedulesLimited).toBe(true);
  const visible = overflow!.schedules.find((s) => s.state === "scheduled")!;
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: visible._id,
    expectedGeneration: visible.generation,
  });
  const recovered = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  expect(recovered!.schedulesLimited).toBe(false);
  const next = recovered!.schedules.find((s) => s.state === "scheduled")!;
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: next._id,
    expectedGeneration: next.generation,
  });
  await expect(planAt(101)).resolves.toBeDefined();
});
test("planned approval stays available for revocation beyond the latest hundred approvals", async () => {
  const f = await setup();
  const scheduleId = await f.plan();
  const planned = (await f.t.run((ctx) => ctx.db.get(scheduleId)))!;
  for (let expectedRevision = 1; expectedRevision <= 100; expectedRevision++) {
    const versionId = await f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      expectedRevision,
      content: { ...f.content, text: [`Revision ${expectedRevision + 1}`] },
      reason: "Edit",
    });
    await f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId,
      accountId: f.accountId,
    });
  }
  const bundle = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  expect(bundle!.versions.some((v) => v._id === f.versionId)).toBe(true);
  expect(
    bundle!.approvals.some(
      (a) => a._id === planned.approvalId && a.revokedAt === null,
    ),
  ).toBe(true);
  await f.signed.mutation(api.editorial.revoke, {
    workspaceId: f.workspaceId,
    approvalId: planned.approvalId,
  });
  expect(
    (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
    }))!.approvals.find((a) => a._id === planned.approvalId)!.revokedAt,
  ).not.toBeNull();
});

test.each([
  new Error("Unexpected draft proof"),
  new ConvexError("UNKNOWN_SOURCE"),
  new ConvexError({ code: "CONTENT_FEEDBACK_SOURCE_UNAVAILABLE" }),
])(
  "feedback list and sweep propagate unknown proof failures without removing retained extent (%s)",
  async (error) => {
    const f = await setup();
    await f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      expectedRevision: 1,
      content: { ...f.content, text: ["Edited"] },
      reason: "Edit",
    });
    const snapshot = () =>
      f.t.run(async (ctx) => ({
        rows: await ctx.db.query("contentFeedback").collect(),
        scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      }));
    const before = await snapshot();
    const spy = vi
      .spyOn(contentProof, "draftResearchProof")
      .mockRejectedValue(error);
    try {
      await expect(
        f.signed.query(api.content.feedback.list, {
          workspaceId: f.workspaceId,
          accountId: f.accountId,
        }),
      ).rejects.toThrow();
      await expect(
        f.t.mutation(internal.content.feedback.sweep, { cursor: null }),
      ).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(await snapshot()).toEqual(before);
  },
);
test("feedback known source withdrawal masks and physically removes descriptive extent", async () => {
  vi.useFakeTimers();
  const f = await setup();
  await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
    expectedRevision: 1,
    content: { ...f.content, text: ["Edited"] },
    reason: "Edit",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, { sourceUnavailable: true }),
  );
  expect(
    (
      await f.signed.query(api.content.feedback.list, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
      })
    )[0],
  ).toMatchObject({ sourceUnavailable: true, editExtent: null });
  await f.t.mutation(internal.content.feedback.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await f.t.run((ctx) => ctx.db.query("contentFeedback").collect()),
  ).toEqual([
    expect.objectContaining({ sourceUnavailable: true, editExtent: null }),
  ]);
});

test("failure episodes retain the first native receipt across actual helper replay and concurrent transactions", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  const f = await setup();
  const scheduleId = await f.plan();
  const jobs = await f.t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  const fail = (code: string) =>
    f.t.run(async (ctx) => failure(ctx, (await ctx.db.get(scheduleId))!, code));
  await Promise.all([fail("FIRST_FAILURE"), fail("CONCURRENT_FAILURE")]);
  const first = await f.t.run((ctx) =>
    ctx.db.query("publishingNotifications").collect(),
  );
  expect(first).toHaveLength(1);
  expect(first[0]).toMatchObject({
    scheduleId,
    generation: 1,
    recipientId: f.userId,
    state: "blocked",
    errorCode: "OPTIONAL_EMAIL_UNAVAILABLE",
  });
  vi.setSystemTime(Date.now() + 1000);
  await fail("REPLAY_FAILURE");
  expect(
    await f.t.run((ctx) => ctx.db.query("publishingNotifications").collect()),
  ).toEqual(first);
  expect(
    await f.t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    ),
  ).toEqual(jobs);
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.errorCode).toBe(
    "REPLAY_FAILURE",
  );
  const events = await f.t.run((ctx) =>
    ctx.db.query("editorialEvents").collect(),
  );
  expect(
    events.filter((e) =>
      ["FIRST_FAILURE", "CONCURRENT_FAILURE", "REPLAY_FAILURE"].includes(
        e.code,
      ),
    ),
  ).toHaveLength(3); // A preexisting corrupted duplicate must not roll back the core failure fact.
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...receipt } = first[0];
    await ctx.db.insert("publishingNotifications", receipt);
  });
  await fail("DUPLICATE_HISTORY_FAILURE");
  expect(await f.t.run((ctx) => ctx.db.get(first[0]._id))).toEqual(first[0]);
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.errorCode).toBe(
    "DUPLICATE_HISTORY_FAILURE",
  );
});

test("failure episode identity uses original generation, recipient and schedule while malformed generations keep domain facts only", async () => {
  const f = await setup();
  const scheduleId = await f.plan();
  const original = (await f.t.run((ctx) => ctx.db.get(scheduleId)))!;
  await f.signed.mutation(api.editorial.reschedule, {
    workspaceId: f.workspaceId,
    scheduleId,
    expectedGeneration: 1,
    at: original.at + 60000,
    timezone: "UTC",
    localTime: localInput(new Date(original.at + 60000).toISOString(), "UTC"),
  });
  // Exercise the captured original failure header as well as the actual new registered generation.
  await f.t.run((ctx) => failure(ctx, original, "ORIGINAL_FAILURE"));
  await f.t.run(async (ctx) =>
    failure(ctx, (await ctx.db.get(scheduleId))!, "NEW_GENERATION_FAILURE"),
  );
  const another = await f.plan();
  await f.t.run(async (ctx) =>
    failure(ctx, (await ctx.db.get(another))!, "OTHER_SCHEDULE_FAILURE"),
  );
  const recipientId = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...user } = (await ctx.db.get(f.userId))!;
    return ctx.db.insert("users", {
      ...user,
      authId: "other-synthetic-recipient",
    });
  });
  await f.t.run((ctx) =>
    failure(
      ctx,
      { ...original, actorId: recipientId },
      "OTHER_RECIPIENT_FAILURE",
    ),
  );
  const receipts = await f.t.run((ctx) =>
    ctx.db.query("publishingNotifications").collect(),
  );
  expect(receipts).toHaveLength(4);
  expect(
    receipts
      .filter((n) => n.scheduleId === scheduleId && n.recipientId === f.userId)
      .map((n) => n.generation)
      .sort(),
  ).toEqual([1, 2]);
  expect(receipts.find((n) => n.scheduleId === another)!.generation).toBe(1);
  expect(receipts.find((n) => n.recipientId === recipientId)!.generation).toBe(
    1,
  );
  const jobs = await f.t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  for (const generation of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await f.t.run((ctx) =>
      failure(ctx, { ...original, generation }, "MALFORMED_GENERATION"),
    );
  }
  expect(
    await f.t.run((ctx) => ctx.db.query("publishingNotifications").collect()),
  ).toEqual(receipts);
  expect(
    await f.t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    ),
  ).toEqual(jobs);
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.errorCode).toBe(
    "MALFORMED_GENERATION",
  );
  expect(
    (await f.t.run((ctx) => ctx.db.query("editorialEvents").collect())).filter(
      (e) => e.code === "MALFORMED_GENERATION",
    ),
  ).toHaveLength(4);
});

test("configured direct and queued notify preserve all legacy receipts without recipient or provider IO and retain original late results", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  vi.stubEnv("AUTH_EMAIL_FROM", "synthetic@example.test");
  vi.stubEnv("RESEND_API_KEY", "synthetic-not-a-key");
  vi.stubEnv("SITE_URL", "https://synthetic.example.test");
  const recipientIO = vi.fn(() => {
    throw new Error("UNEXPECTED_RECIPIENT_IO");
  });
  const f = await setup({
    ...modules,
    "../convex/publishing.ts": async () => ({
      ...((await modules[
        "../convex/publishing.ts"
      ]()) as typeof import("../convex/publishing")),
      recipient: internalQuery({
        args: { notificationId: v.id("publishingNotifications") },
        returns: v.null(),
        handler: recipientIO,
      }),
    }),
  });
  const scheduleId = await f.plan();
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId,
    expectedGeneration: 1,
  });
  const ids = await f.t.run(async (ctx) => {
    const ids = [];
    for (const state of ["pending", "sent", "blocked"] as const)
      ids.push(
        await ctx.db.insert("publishingNotifications", {
          workspaceId: f.workspaceId,
          scheduleId,
          recipientId: f.userId,
          state,
          errorCode: state === "blocked" ? "HISTORICAL_TRANSPORT_ERROR" : null,
          createdAt: Date.now() - 10000,
        }),
      );
    await failure(ctx, (await ctx.db.get(scheduleId))!, "NEW_FAILURE");
    return ids;
  });
  const before = await f.t.run((ctx) =>
    ctx.db.query("publishingNotifications").collect(),
  );
  const fetchIO = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("UNEXPECTED_PROVIDER_IO"));
  try {
    for (const n of before)
      await f.t.action(internal.publishing.notify, { notificationId: n._id });
    await f.t.run(async (ctx) => {
      for (const n of before)
        await ctx.scheduler.runAfter(0, internal.publishing.notify, {
          notificationId: n._id,
        });
    });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1000));
    expect(recipientIO).not.toHaveBeenCalled();
    expect(fetchIO).not.toHaveBeenCalled();
    expect(
      await f.t.run((ctx) => ctx.db.query("publishingNotifications").collect()),
    ).toEqual(before);
    expect(before.filter((n) => n.generation === undefined)).toHaveLength(3);
    expect(before.filter((n) => n.generation === 2)).toHaveLength(1);
    await f.t.mutation(internal.publishing.notificationResult, {
      notificationId: ids[0],
      state: "sent",
      errorCode: null,
    });
    expect(await f.t.run((ctx) => ctx.db.get(ids[0]))).toEqual({
      ...before.find((n) => n._id === ids[0])!,
      state: "sent",
      errorCode: null,
    });
  } finally {
    fetchIO.mockRestore();
  }
});
