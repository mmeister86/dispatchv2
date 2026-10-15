import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import { seal } from "../lib/crypto";
import { association } from "../integrations/x/fields";
const modules = import.meta.glob("/convex/**/*.ts");
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function fixture() {
  vi.useFakeTimers();
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "fixture");
  const t = convexTest(schema, modules);
  const f = await t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Fixture",
      description: "",
    });
    const actorId = await ctx.db.insert("users", {
      authId: "synthetic",
      activeWorkspaceId: workspaceId,
      defaultWorkspaceId: workspaceId,
    });
    await ctx.db.insert("memberships", {
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
        text: ["First"],
        media: [],
        accountId,
        pillar: "",
        strategy: "generic",
      },
      mediaChecksums: [],
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
      actorId,
      accountId,
      credentialId,
      draftId,
      versionId,
      approvalId,
      scheduleId,
    };
  });
  const job = { scheduleId: f.scheduleId, generation: 1 };
  return { ...f, t, job };
}
test("claim holds the lease, reclaim resumes after expiry and duplicate receipts stay idempotent", async () => {
  const f = await fixture();
  const first = (await f.t.mutation(
    internal.publishing.attempts.claim,
    f.job,
  ))!;
  expect(first.stage).toBe("preparing");
  expect(
    await f.t.mutation(internal.publishing.attempts.claim, f.job),
  ).toBeNull();
  await f.t.run((ctx) =>
    ctx.db.patch(first._id, { leaseUntil: Date.now() - 1 }),
  );
  const resumed = (await f.t.mutation(
    internal.publishing.attempts.claim,
    f.job,
  ))!;
  expect(resumed._id).toBe(first._id);
  expect(resumed.claimSequence).toBe(first.claimSequence + 1);
  expect(
    await f.t.mutation(internal.publishing.attempts.beforeSend, {
      attemptId: resumed._id,
      claimSequence: resumed.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    }),
  ).toBe(true);
  const receipt = {
    attemptId: resumed._id,
    claimSequence: resumed.claimSequence,
    outcome: "confirmed" as const,
    externalId: "123",
    durationMs: 1,
  };
  await f.t.mutation(internal.publishing.attempts.receipt, receipt);
  await f.t.mutation(internal.publishing.attempts.receipt, receipt);
  const attempt = (await f.t.run((ctx) => ctx.db.get(resumed._id)))!;
  expect(attempt.stage).toBe("confirmed");
  const schedule = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(schedule.externalPosts).toHaveLength(1);
  expect(schedule.state).toBe("published");
});
test(">100 settled attempts in old generations no longer brick a fresh generation", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 105; i++)
      await ctx.db.insert("xPostAttempts", {
        workspaceId: f.workspaceId,
        scheduleId: f.scheduleId,
        generation: 1,
        versionId: f.versionId,
        accountId: f.accountId,
        providerIdentity: "123",
        connectionSequence: 1,
        position: i,
        attempt: 1,
        claimSequence: 1,
        leaseUntil: 0,
        deadline: Date.now() + 3600000,
        stage: "rejected",
        mediaIds: [],
        durationMs: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    await ctx.db.patch(f.scheduleId, { generation: 2 });
  });
  const claimed = await f.t.mutation(internal.publishing.attempts.claim, {
    scheduleId: f.scheduleId,
    generation: 2,
  });
  expect(claimed).toMatchObject({ generation: 2, position: 0 });
  const schedule = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(schedule.state).toBe("publishing");
});
test.each(["sending", "unknown"] as const)(
  "an old generation stuck in %s still blocks a fresh generation",
  async (stage) => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      await ctx.db.insert("xPostAttempts", {
        workspaceId: f.workspaceId,
        scheduleId: f.scheduleId,
        generation: 1,
        versionId: f.versionId,
        accountId: f.accountId,
        providerIdentity: "123",
        connectionSequence: 1,
        position: 0,
        attempt: 1,
        claimSequence: 1,
        leaseUntil: 0,
        deadline: Date.now() + 3600000,
        stage,
        mediaIds: [],
        durationMs: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.patch(f.scheduleId, { generation: 2 });
    });
    expect(
      await f.t.mutation(internal.publishing.attempts.claim, {
        scheduleId: f.scheduleId,
        generation: 2,
      }),
    ).toBeNull();
    const schedule = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
    expect(schedule.state).toBe("reconciliation_required");
    expect(schedule.errorCode).toBe("X_RECONCILIATION_REQUIRED");
  },
);
