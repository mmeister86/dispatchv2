import { afterEach, expect, test, vi } from "vitest";
import { mediaFixture } from "../../tests/media-fixture";
import { api, internal, components } from "../_generated/api";
import { localInput } from "../../src/lib/time";
import { failure } from "../publishing";
import * as reviews from "../editorial/reviews";
import * as notices from "./notices";
import { seal } from "../lib/crypto";
import { association } from "../integrations/x/fields";
import type { Id } from "../_generated/dataModel";
const list = api.publishing.notices.list;
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function fixture(review = false) {
  const f = await mediaFixture();
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
        maxThread: 100,
        maxMedia: 4,
        mediaTypes: ["image", "video"],
        publish: true,
      },
    }),
  );
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: {
      title: "Private title",
      text: ["Private text"],
      media: [],
      accountId,
      pillar: "Test",
      strategy: "generic",
    },
    source: "Test",
  });
  const versionId = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  }))!.versions[0]._id;
  if (review) {
    const policy = await f.signed.mutation(api.editorial.reviews.configure, {
      workspaceId: f.workspaceId,
      accountId: null,
      expectedRevision: 0,
      commandKey: crypto.randomUUID(),
      policy: { editorial: true, brand: true },
    });
    for (const [revision, stage] of [
      [0, "editorial"],
      [1, "brand"],
    ] as const)
      await f.signed.mutation(api.editorial.reviews.decide, {
        workspaceId: f.workspaceId,
        versionId,
        stage,
        policyId: policy.policyId,
        expectedRevision: revision,
        commandKey: crypto.randomUUID(),
      });
  }
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId,
    accountId,
  });
  const at = Math.floor(Date.now() / 60000) * 60000 + 3600000;
  const scheduleId = await f.signed.mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    versionId,
    accountId,
    approvalId,
    at,
    timezone: "UTC",
    localTime: localInput(new Date(at).toISOString(), "UTC"),
  });
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  return {
    ...f,
    accountId,
    draftId,
    versionId,
    approvalId,
    scheduleId,
    at,
    args: {
      workspaceId: f.workspaceId,
      expectedAuthId: user.authId,
      requestKey: crypto.randomUUID(),
      paginationOpts: { numItems: 25, cursor: null },
    },
  };
}
test("actual native failure captures original personal presentation while resources keep the original transport contract", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  vi.setSystemTime(f.at);
  await f.t.mutation(internal.publishing.claim, {
    scheduleId: f.scheduleId,
    generation: 1,
  });
  await f.t.mutation(internal.publishing.unavailable, {
    scheduleId: f.scheduleId,
    generation: 1,
  });
  const result = await f.signed.query(list, f.args);
  expect(result.page).toHaveLength(1);
  expect(result.page[0]).toMatchObject({
    family: "publishing",
    draftId: f.draftId,
    versionId: f.versionId,
    accountId: f.accountId,
    readAt: null,
    dismissedAt: null,
  });
  const resources = await f.signed.query(api.editorial.resources, {
    workspaceId: f.workspaceId,
  });
  expect(Object.keys(resources.notifications[0]).sort()).toEqual([
    "_creationTime",
    "_id",
    "createdAt",
    "errorCode",
    "generation",
    "recipientId",
    "scheduleId",
    "state",
    "workspaceId",
  ]);
  expect(JSON.stringify(result)).not.toContain("Private text");
  expect(JSON.stringify(result)).not.toContain("PUBLISHER_NOT_CONFIGURED");
});
async function fail(f: Awaited<ReturnType<typeof fixture>>) {
  vi.setSystemTime(f.at);
  await f.t.mutation(internal.publishing.claim, {
    scheduleId: f.scheduleId,
    generation: 1,
  });
  await f.t.mutation(internal.publishing.unavailable, {
    scheduleId: f.scheduleId,
    generation: 1,
  });
  return (await f.t.run((ctx) =>
    ctx.db.query("publishingNotifications").first(),
  ))!;
}
test("post-birth approval nonfinite source horizons mask the reader and are physically scrubbed", async () => {
  vi.useFakeTimers();
  for (const sourceUntil of [NaN, Infinity, -Infinity]) {
    const f = await fixture();
    const n = await fail(f);
    await f.t.run(async (ctx) => {
      const a = (await ctx.db.get(f.approvalId))!;
      await ctx.db.patch(a._id, {
        reviewPin: { ...a.reviewPin!, sourceUntil },
      });
    });
    expect((await f.signed.query(list, f.args)).page).toEqual([]);
    await f.t.mutation(internal.publishing.notices.sweep, { cursor: null });
    expect(await f.t.run((ctx) => ctx.db.get(n._id))).toMatchObject({
      presentationUnavailable: true,
    });
    expect(await f.t.run((ctx) => ctx.db.get(n._id))).not.toHaveProperty(
      "presentation",
    );
  }
});
test("real missing-version preflight and unsupported legacy pin preserve failure/event with zero optional transport", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.delete(f.versionId));
  vi.setSystemTime(f.at);
  const http = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("No IO"));
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId: f.scheduleId,
      generation: 1,
    }),
  ).toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
    "failed",
  );
  const n = (await f.t.run((ctx) =>
    ctx.db.query("publishingNotifications").first(),
  ))!;
  expect(n.presentationUnavailable).toBe(false); // birth needs the retained original header, not current ancestry
  expect((await f.signed.query(list, f.args)).page).toEqual([]);
  await f.t.mutation(internal.publishing.notices.sweep, { cursor: null });
  expect(
    (await f.t.run((ctx) => ctx.db.get(n._id)))!.presentationUnavailable,
  ).toBe(true);
  const g = await fixture();
  await g.t.run((ctx) => ctx.db.patch(g.scheduleId, { reviewPin: undefined }));
  vi.setSystemTime(g.at);
  await g.t.mutation(internal.publishing.claim, {
    scheduleId: g.scheduleId,
    generation: 1,
  });
  await g.t.mutation(internal.publishing.unavailable, {
    scheduleId: g.scheduleId,
    generation: 1,
  });
  expect(
    (await g.t.run((ctx) => ctx.db.query("publishingNotifications").first()))!,
  ).toMatchObject({
    presentationUnavailable: true,
    state: "blocked",
    errorCode: "OPTIONAL_EMAIL_UNAVAILABLE",
  });
  expect(
    (
      await g.t.run((ctx) =>
        ctx.db
          .query("editorialEvents")
          .withIndex("by_workspaceId_and_createdAt", (q) =>
            q.eq("workspaceId", g.workspaceId),
          )
          .take(20),
      )
    ).some((e) => e.code === "PUBLISHER_NOT_CONFIGURED"),
  ).toBe(true);
  expect(http).not.toHaveBeenCalled();
});
async function readyX(f: Awaited<ReturnType<typeof fixture>>) {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "fixture");
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.accountId, {
      xEvidence: {
        scopes: ["tweet.read", "users.read", "tweet.write"],
        identityVerifiedAt: Date.now(),
        connectionSequence: 1,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "verified",
      },
    });
    await ctx.db.patch(f.scheduleId, { accountConnectionSequence: 1 });
    await ctx.db.insert("xBindings", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      providerIdentity: "fixture",
      changedSequence: 1,
      changedAt: Date.now(),
    });
    await ctx.db.insert("xCredentials", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      generation: 1,
      envelope: await seal(
        { accessToken: "synthetic" },
        association(f.workspaceId, f.accountId),
      ),
      scopes: ["tweet.read", "users.read", "tweet.write"],
      expiresAt: f.at + 86400000,
      leaseUntil: 0,
      cleanAfter: f.at + 86400000,
    });
  });
}
test("actual beforeSend then source loss still commits unknown physical receipt and original failure", async () => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "fixture");
  vi.useFakeTimers();
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  const f = await fixture();
  await readyX(f);
  vi.setSystemTime(f.at);
  await f.t.mutation(internal.publishing.claim, {
    scheduleId: f.scheduleId,
    generation: 1,
  });
  const c = (await f.t.mutation(internal.publishing.attempts.claim, {
    scheduleId: f.scheduleId,
    generation: 1,
  }))!;
  expect(
    await f.t.mutation(internal.publishing.attempts.beforeSend, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    }),
  ).toBe(true);
  await f.t.run((ctx) => ctx.db.delete(f.approvalId));
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    outcome: "unknown",
    errorCode: "X_POST_OUTCOME_UNKNOWN",
    durationMs: 12,
  });
  expect(await f.t.run((ctx) => ctx.db.get(c._id))).toMatchObject({
    stage: "unknown",
    durationMs: 12,
    requestStartedAt: f.at,
  });
  expect(await f.t.run((ctx) => ctx.db.get(f.scheduleId))).toMatchObject({
    state: "reconciliation_required",
  });
  expect(
    (await f.t.run((ctx) => ctx.db.query("publishingNotifications").first()))!,
  ).toMatchObject({ presentationUnavailable: true });
  expect((await f.signed.query(list, f.args)).page).toEqual([]);
});
test("exact first episode survives concurrent replay and restored proof cannot resurrect scrubbed presentation", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    n = await fail(f);
  await Promise.all(
    [1, 2].map(() =>
      f.t.run(async (ctx) =>
        failure(ctx, (await ctx.db.get(f.scheduleId))!, "PREFLIGHT_FAILED"),
      ),
    ),
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("publishingNotifications").collect()),
  ).toEqual([n]);
  const pin = (await f.t.run((ctx) => ctx.db.get(f.approvalId)))!.reviewPin!;
  await f.t.run((ctx) =>
    ctx.db.patch(f.approvalId, {
      reviewPin: { ...pin, sourceUntil: Date.now() },
    }),
  );
  expect((await f.signed.query(list, f.args)).page).toEqual([]);
  await f.t.mutation(internal.publishing.notices.sweep, { cursor: null });
  await f.t.run((ctx) => ctx.db.patch(f.approvalId, { reviewPin: pin }));
  await f.t.run(async (ctx) =>
    failure(ctx, (await ctx.db.get(f.scheduleId))!, "OTHER"),
  );
  const after = (await f.t.run((ctx) => ctx.db.get(n._id)))!;
  expect(after).not.toHaveProperty("presentation");
  expect(after.createdAt).toBe(n.createdAt);
  expect(after.state).toBe(n.state);
  expect((await f.signed.query(list, f.args)).page).toEqual([]);
});
test("mixed foreign/unavailable batches rollback, strict25 limit and idempotent read/dismiss retain first timestamps", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    n = await fail(f);
  const a = {
    workspaceId: f.workspaceId,
    expectedAuthId: f.args.expectedAuthId,
    requestKey: crypto.randomUUID(),
    noticeIds: [n._id],
  };
  await expect(
    f.signed.mutation(api.publishing.notices.read, {
      ...a,
      noticeIds: Array(26).fill(n._id),
    }),
  ).rejects.toThrow("NOTICE_READ_LIMIT");
  await expect(
    f.signed.mutation(api.publishing.notices.read, {
      ...a,
      noticeIds: [n._id, n._id],
    }),
  ).rejects.toThrow("NOTICE_READ_LIMIT");
  const foreign = await f.t.run((ctx) =>
    ctx.db.insert("publishingNotifications", {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      generation: 2,
      recipientId: f.userId,
      state: "blocked",
      errorCode: null,
      createdAt: Date.now(),
      presentationUnavailable: true,
    }),
  );
  await expect(
    f.signed.mutation(api.publishing.notices.read, {
      ...a,
      noticeIds: [n._id, foreign],
    }),
  ).rejects.toThrow("NOTICE_UNAVAILABLE");
  expect(
    (await f.t.run((ctx) => ctx.db.get(n._id)))!.presentation!.readAt,
  ).toBeNull();
  await f.signed.mutation(api.publishing.notices.read, a);
  const first = (await f.t.run((ctx) => ctx.db.get(n._id)))!.presentation!
    .readAt;
  vi.setSystemTime(Date.now() + 1);
  await f.signed.mutation(api.publishing.notices.read, {
    ...a,
    requestKey: crypto.randomUUID(),
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(n._id)))!.presentation!.readAt,
  ).toBe(first);
  await f.signed.mutation(api.publishing.notices.dismiss, a);
  const dismissed = (await f.t.run((ctx) => ctx.db.get(n._id)))!.presentation!
    .dismissedAt;
  vi.setSystemTime(Date.now() + 1);
  await f.signed.mutation(api.publishing.notices.dismiss, a);
  expect(
    (await f.t.run((ctx) => ctx.db.get(n._id)))!.presentation!.dismissedAt,
  ).toBe(dismissed);
  expect((await f.signed.query(list, f.args)).page).toEqual([]);
});
async function person(
  f: Awaited<ReturnType<typeof fixture>>,
  role: "Admin" | "Viewer",
) {
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Other",
          email: `${crypto.randomUUID()}@example.test`,
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
  const signed = f.t.withIdentity(identity);
  const userId = await signed.mutation(api.users.bootstrap, {});
  await f.t.run((ctx) =>
    ctx.db.insert("memberships", { workspaceId: f.workspaceId, userId, role }),
  );
  await signed.mutation(api.workspaces.select, { workspaceId: f.workspaceId });
  return { signed, userId, identity };
}
test("foreign actual Viewer/Admin resources never expose private bindings, mailbox or batch override", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    n = await fail(f);
  for (const role of ["Viewer", "Admin"] as const) {
    const p = await person(f, role);
    const resources = await p.signed.query(api.editorial.resources, {
      workspaceId: f.workspaceId,
    });
    expect(resources.notifications).toHaveLength(1);
    expect(resources.notifications[0]).not.toHaveProperty("presentation");
    expect(resources.notifications[0]).not.toHaveProperty(
      "presentationUnavailable",
    );
    expect(
      (
        await p.signed.query(list, {
          ...f.args,
          expectedAuthId: p.identity.subject,
        })
      ).page,
    ).toEqual([]);
    await expect(
      p.signed.mutation(api.publishing.notices.read, {
        workspaceId: f.workspaceId,
        expectedAuthId: p.identity.subject,
        requestKey: crypto.randomUUID(),
        noticeIds: [n._id],
      }),
    ).rejects.toThrow("NOTICE_UNAVAILABLE");
  }
  await expect(f.t.query(list, f.args)).rejects.toThrow();
  await expect(
    f.t
      .withIdentity({ subject: f.args.expectedAuthId, sessionId: "foreign" })
      .query(list, f.args),
  ).rejects.toThrow();
  await expect(
    f.signed.query(list, { ...f.args, requestKey: "x".repeat(65) }),
  ).rejects.toThrow("NOTICE_REQUEST_INVALID");
});
test("actual distinct approver reschedule and public continuation keep original episode ownership", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    p = await person(f, "Admin");
  await readyX(f);
  const approvalId = await p.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId: f.versionId,
    accountId: f.accountId,
  });
  await f.signed.mutation(api.editorial.reschedule, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
    approvalId,
    at: f.at,
    timezone: "UTC",
    localTime: localInput(new Date(f.at).toISOString(), "UTC"),
  });
  vi.setSystemTime(f.at);
  await f.t.mutation(internal.publishing.claim, {
    scheduleId: f.scheduleId,
    generation: 2,
  });
  await f.t.mutation(internal.publishing.unavailable, {
    scheduleId: f.scheduleId,
    generation: 2,
  });
  const n = (await f.t.run((ctx) =>
    ctx.db.query("publishingNotifications").first(),
  ))!;
  expect(n.recipientId).toBe(f.userId);
  expect(n.presentation!.approvalActorId).toBe(p.userId);
  expect(n.generation).toBe(2);
  await p.signed.mutation(api.publishing.reconcile.continueThread, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 2,
  });
  const continued = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(continued.generation).toBe(3);
  expect(continued.actorId).toBe(p.userId);
  expect(continued.approvalId).not.toBe(approvalId);
  expect((await f.signed.query(list, f.args)).page.map((r) => r.id)).toEqual([
    n._id,
  ]);
  expect(
    (
      await p.signed.query(list, {
        ...f.args,
        expectedAuthId: p.identity.subject,
      })
    ).page,
  ).toEqual([]);
  await f.t.run(async (ctx) =>
    failure(ctx, (await ctx.db.get(f.scheduleId))!, "ANY"),
  );
  expect(
    (
      await p.signed.query(list, {
        ...f.args,
        expectedAuthId: p.identity.subject,
      })
    ).page,
  ).toHaveLength(1);
});
test("each current dependency masks immediately; null-horizon rootless sweep scrubs without transport or money changes", async () => {
  vi.useFakeTimers();
  for (const dependency of [
    "version",
    "draft",
    "account",
    "approval",
    "schedule",
    "recipient",
    "role",
    "workspace",
  ] as const) {
    const f = await fixture(),
      n = await fail(f);
    const financial = await f.t.run((ctx) =>
      ctx.db.query("aiAttempts").collect(),
    );
    await f.t.run(async (ctx) => {
      if (dependency === "version") await ctx.db.delete(f.versionId);
      if (dependency === "draft") await ctx.db.delete(f.draftId);
      if (dependency === "account") await ctx.db.delete(f.accountId);
      if (dependency === "approval") await ctx.db.delete(f.approvalId);
      if (dependency === "schedule") await ctx.db.delete(f.scheduleId);
      if (dependency === "recipient") await ctx.db.delete(f.userId);
      if (dependency === "role")
        await ctx.db.patch(
          (await ctx.db
            .query("memberships")
            .withIndex("by_userId_and_workspaceId", (q) =>
              q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
            )
            .unique())!._id,
          { role: "Editor" },
        );
      if (dependency === "workspace")
        await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
    });
    if (dependency === "recipient" || dependency === "workspace")
      await expect(f.signed.query(list, f.args)).rejects.toThrow();
    else expect((await f.signed.query(list, f.args)).page).toEqual([]);
    await f.t.mutation(internal.publishing.notices.sweep, { cursor: null });
    const after = (await f.t.run((ctx) => ctx.db.get(n._id)))!;
    const {
      _id,
      _creationTime,
      presentation,
      presentationUnavailable,
      ...transport
    } = n;
    expect(after).toEqual({
      _id,
      _creationTime,
      ...transport,
      presentationUnavailable: true,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
    ).toEqual(financial);
  }
});
test("unexpected birth/proof infrastructure errors propagate and roll back native writes", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  vi.setSystemTime(f.at);
  await f.t.mutation(internal.publishing.claim, {
    scheduleId: f.scheduleId,
    generation: 1,
  });
  const before = await f.t.run((ctx) => ctx.db.get(f.scheduleId));
  const capture = vi
    .spyOn(notices, "capture")
    .mockRejectedValue(Error("unexpected DB index failure"));
  await expect(
    f.t.mutation(internal.publishing.unavailable, {
      scheduleId: f.scheduleId,
      generation: 1,
    }),
  ).rejects.toThrow("unexpected DB index failure");
  expect(await f.t.run((ctx) => ctx.db.get(f.scheduleId))).toEqual(before);
  expect(
    await f.t.run((ctx) => ctx.db.query("publishingNotifications").collect()),
  ).toEqual([]);
  capture.mockRestore();
  await f.t.mutation(internal.publishing.unavailable, {
    scheduleId: f.scheduleId,
    generation: 1,
  });
  vi.spyOn(reviews, "historicalReviewSource").mockRejectedValue(
    Error("unexpected native resource error"),
  );
  await expect(f.signed.query(list, f.args)).rejects.toThrow(
    "unexpected native resource error",
  );
  await expect(
    f.t.mutation(internal.publishing.notices.sweep, { cursor: null }),
  ).rejects.toThrow("unexpected native resource error");
});
test("25 actual own rows measure whole-entry ceilings; bounded multi-page cleanup reaches empty editorial terminal and retains legacy late ACK", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    original = await fail(f);
  await f.t.run(async (ctx) => {
    for (let generation = 2; generation <= 62; generation++) {
      await ctx.db.patch(f.scheduleId, { generation });
      await failure(
        ctx,
        { ...(await ctx.db.get(f.scheduleId))!, generation },
        "TEST",
      );
    }
  });
  const result = await f.signed.run(async (ctx) => {
    const page = await ctx.runQuery(list, f.args);
    return { page, metrics: await ctx.meta.getTransactionMetrics() };
  });
  expect(result.page.page).toHaveLength(25);
  expect(result.page.isDone).toBe(false);
  expect(result.metrics.databaseQueries.used).toBeLessThanOrEqual(512);
  expect(result.metrics.documentsRead.used).toBeLessThanOrEqual(512);
  expect(result.metrics.bytesRead.used).toBeLessThanOrEqual(512 * 1024);
  expect(result.metrics.documentsWritten.used).toBe(0);
  expect(result.metrics.functionsScheduled.used).toBe(0);
  expect(
    new TextEncoder().encode(JSON.stringify(result.page)).length,
  ).toBeLessThanOrEqual(64 * 1024);
  console.log(
    "Publishing25 whole native metrics",
    JSON.stringify(result.metrics),
  );
  await f.signed.mutation(api.publishing.notices.read, {
    workspaceId: f.workspaceId,
    expectedAuthId: f.args.expectedAuthId,
    requestKey: crypto.randomUUID(),
    noticeIds: result.page.page.map((n) => n.id),
  });
  const legacyId = await f.t.run((ctx) =>
    ctx.db.insert("publishingNotifications", {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      recipientId: f.userId,
      state: "pending",
      errorCode: null,
      createdAt: 1,
    }),
  );
  const legacy = await f.t.run((ctx) => ctx.db.get(legacyId));
  await f.t.run((ctx) => ctx.db.delete(f.versionId));
  await f.t.mutation(internal.editorial.notices.cleanupVersion, {
    versionId: f.versionId,
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  const rows = await f.t.run((ctx) =>
    ctx.db.query("publishingNotifications").collect(),
  );
  expect(rows.filter((n) => n.presentationUnavailable === true)).toHaveLength(
    62,
  );
  expect(rows.some((n) => n.presentation)).toBe(false);
  expect(await f.t.run((ctx) => ctx.db.get(legacyId))).toEqual(legacy);
  expect((await f.t.run((ctx) => ctx.db.get(original._id)))!.createdAt).toBe(
    original.createdAt,
  );
  await f.t.mutation(internal.publishing.notificationResult, {
    notificationId: legacyId,
    state: "sent",
    errorCode: null,
  });
  expect((await f.t.run((ctx) => ctx.db.get(legacyId)))!.state).toBe("sent");
});

test("25 own rows with both captured review decisions fit the complete native entry budget", async () => {
  vi.useFakeTimers();
  const f = await fixture(true);
  await fail(f);
  await f.t.run(async (ctx) => {
    for (let generation = 2; generation <= 25; generation++) {
      await ctx.db.patch(f.scheduleId, { generation });
      await failure(ctx, (await ctx.db.get(f.scheduleId))!, "TEST");
    }
  });
  const result = await f.signed.run(async (ctx) => {
    const page = await ctx.runQuery(list, f.args);
    return { page, metrics: await ctx.meta.getTransactionMetrics() };
  });
  expect(result.page.page).toHaveLength(25);
  console.log(
    "Publishing25 two decisions whole native metrics",
    JSON.stringify(result.metrics),
  );
  await expect(
    f.signed.run(async (ctx) => {
      for (let i = 0; i < 11; i++) await ctx.db.get(f.workspaceId);
      await ctx.runMutation(api.publishing.notices.read, {
        workspaceId: f.workspaceId,
        expectedAuthId: f.args.expectedAuthId,
        requestKey: crypto.randomUUID(),
        noticeIds: result.page.page.map((n) => n.id),
      });
    }),
  ).rejects.toThrow("Too many index ranges read");
  expect(
    (await f.t.run((ctx) => ctx.db.get(result.page.page[0].id)))!.presentation!
      .readAt,
  ).toBeNull();
  for (const command of [
    api.publishing.notices.read,
    api.publishing.notices.dismiss,
  ]) {
    const metrics = await f.signed.run(async (ctx) => {
      await ctx.runMutation(command, {
        workspaceId: f.workspaceId,
        expectedAuthId: f.args.expectedAuthId,
        requestKey: crypto.randomUUID(),
        noticeIds: result.page.page.map((n) => n.id),
      });
      return ctx.meta.getTransactionMetrics();
    });
    expect(metrics.databaseQueries.used).toBeLessThanOrEqual(640);
    expect(metrics.documentsRead.used).toBeLessThanOrEqual(640);
    expect(metrics.bytesRead.used).toBeLessThanOrEqual(512 * 1024);
    expect(metrics.documentsWritten.used).toBe(25);
    expect(metrics.functionsScheduled.used).toBe(0);
    console.log("Publishing25 whole mutation metrics", JSON.stringify(metrics));
  }
});
test("captured retention never renews; historical revoked execution approval still records generic attention", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const s = (await ctx.db.get(f.scheduleId))!;
    await ctx.db.patch(s._id, {
      reviewPin: { ...s.reviewPin!, sourceUntil: f.at + 500 },
    });
  });
  const n = await fail(f);
  expect(n.presentation!.sourceUntil).toBe(f.at + 500);
  await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(f.approvalId))!;
    await ctx.db.patch(a._id, {
      reviewPin: { ...a.reviewPin!, sourceUntil: f.at + 50000 },
    });
  });
  expect((await f.signed.query(list, f.args)).page[0].sourceUntil).toBe(
    f.at + 500,
  );
  vi.setSystemTime(f.at + 500);
  expect((await f.signed.query(list, f.args)).page).toEqual([]);
  const g = await fixture();
  await g.signed.mutation(api.editorial.revoke, {
    workspaceId: g.workspaceId,
    approvalId: g.approvalId,
  });
  vi.setSystemTime(g.at);
  expect(
    await g.t.mutation(internal.publishing.claim, {
      scheduleId: g.scheduleId,
      generation: 1,
    }),
  ).toBeNull();
  expect((await g.signed.query(list, g.args)).page).toHaveLength(1);
  expect((await g.t.run((ctx) => ctx.db.get(g.scheduleId)))!.state).toBe(
    "failed",
  );
});
test("original captured review decisions are masked after actual withdrawal; terminal version cleanup scrubs the personal binding", async () => {
  vi.useFakeTimers();
  const f = await fixture(true),
    n = await fail(f);
  const decisionId = n.presentation!.reviewPin.decisionIds[0];
  await f.signed.mutation(api.editorial.reviews.withdraw, {
    workspaceId: f.workspaceId,
    decisionId,
    expectedRevision: 2,
    commandKey: crypto.randomUUID(),
  });
  expect((await f.signed.query(list, f.args)).page).toEqual([]);
  await f.t.mutation(internal.editorial.notices.cleanupVersion, {
    versionId: f.versionId,
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  expect(
    (await f.t.run((ctx) => ctx.db.get(n._id)))!.presentationUnavailable,
  ).toBe(true);
  expect(await f.t.run((ctx) => ctx.db.get(n._id))).not.toHaveProperty(
    "presentation",
  );
});
test("indexed own partition precedes cap and foreign/private interleaving changes no own DTO", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    n = await fail(f),
    p = await person(f, "Admin");
  const before = await f.signed.query(list, f.args);
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = n;
    for (let i = 0; i < 80; i++) {
      await ctx.db.insert("publishingNotifications", {
        ...fields,
        recipientId: p.userId,
        generation: i + 2,
        createdAt: Date.now() + i,
      });
      await ctx.db.insert("publishingNotifications", {
        ...fields,
        presentation: undefined,
        presentationUnavailable: true,
        generation: i + 82,
        createdAt: Date.now() + i,
      });
    }
  });
  expect(await f.signed.query(list, f.args)).toEqual(before);
});

test.each(["version", "actor", "sweep"] as const)(
  "deep valid retained ancestry cleans all episodes through %s worker without changing transport receipts",
  async (worker) => {
    vi.useFakeTimers();
    const f = await fixture();
    let previous: Id<"ideaVersions"> | null = null;
    let deepest: Id<"ideas"> | null = null;
    for (let i = 0; i < 31; i++) {
      const id = await f.signed.mutation(api.content.ideas.create, {
        workspaceId: f.workspaceId,
        operationKey: crypto.randomUUID(),
        title: "Note",
        perspective: "",
        note: "",
        priority: "normal",
        source: { kind: "note" },
      });
      const row = (await f.t.run((ctx) => ctx.db.get(id)))!;
      deepest ??= id;
      if (previous)
        await f.t.run((ctx) =>
          ctx.db.patch(row.currentVersionId!, { inputVersionId: previous! }),
        );
      previous = row.currentVersionId!;
    }
    await f.t.run((ctx) =>
      ctx.db.patch(f.versionId, { ideaVersionId: previous! }),
    );
    await fail(f);
    for (let generation = 2; generation <= 25; generation++)
      await f.t.run(async (ctx) => {
        await ctx.db.patch(f.scheduleId, { generation });
        await failure(ctx, (await ctx.db.get(f.scheduleId))!, "TEST");
      });
    const before = await f.t.run((ctx) =>
      ctx.db.query("publishingNotifications").collect(),
    );
    expect(before).toHaveLength(25);
    expect(before.every((n) => n.presentationUnavailable === false)).toBe(true);
    expect(
      (
        await f.signed.query(list, {
          ...f.args,
          paginationOpts: { numItems: 1, cursor: null },
        })
      ).page,
    ).toHaveLength(1);
    const schedule = await f.t.run((ctx) => ctx.db.get(f.scheduleId));
    const events = await f.t.run((ctx) =>
      ctx.db.query("editorialEvents").collect(),
    );
    await f.t.run((ctx) => ctx.db.patch(deepest!, { status: "archived" }));
    if (worker === "version")
      await f.t.mutation(internal.publishing.notices.cleanupVersion, {
        versionId: f.versionId,
        cursor: null,
      });
    else if (worker === "actor")
      await f.t.mutation(internal.publishing.notices.purgeActor, {
        actorId: f.userId,
        phase: "recipient",
        cursor: null,
      });
    else
      await f.t.mutation(internal.publishing.notices.sweep, { cursor: null });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
    const after = await f.t.run((ctx) =>
      ctx.db.query("publishingNotifications").collect(),
    );
    expect(after).toHaveLength(25);
    expect(
      after.every((n) => !n.presentation && n.presentationUnavailable),
    ).toBe(true);
    const transport = (n: (typeof before)[number]) => {
      const { presentation, presentationUnavailable, ...original } = n;
      return original;
    };
    expect(after.map(transport)).toEqual(before.map(transport));
    expect(await f.t.run((ctx) => ctx.db.get(f.scheduleId))).toEqual(schedule);
    expect(
      await f.t.run((ctx) => ctx.db.query("editorialEvents").collect()),
    ).toEqual(events);
  },
);
