import { expect, vi } from "vitest";
import { mediaFixture } from "./media-fixture";
import { jevFixture } from "./jev-fixture";
import { api, internal, components } from "../convex/_generated/api";
import { seal } from "../convex/lib/crypto";
import { association } from "../convex/integrations/x/fields";
export async function historyFixture(limit = 1000, maxResults = 5) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00Z"));
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "synthetic");
  const f = await mediaFixture();
  const accountId = await f.t.run(async (ctx) => {
    const accountId = await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "123",
      name: "Own fixture",
      handle: "fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
      xEvidence: {
        scopes: ["tweet.read", "users.read", "tweet.write"],
        identityVerifiedAt: Date.now(),
        connectionSequence: 1,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "verified",
      },
    });
    await ctx.db.insert("xBindings", {
      workspaceId: f.workspaceId,
      accountId,
      providerIdentity: "123",
      changedAt: Date.now(),
    });
    await ctx.db.insert("xCredentials", {
      workspaceId: f.workspaceId,
      accountId,
      generation: 1,
      envelope: await seal(
        { accessToken: "synthetic-only" },
        association(f.workspaceId, accountId),
      ),
      scopes: ["tweet.read", "users.read", "tweet.write"],
      expiresAt: Date.now() + 86400000,
      leaseUntil: 0,
      cleanAfter: Number.MAX_SAFE_INTEGER,
    });
    return accountId;
  });
  const args = { workspaceId: f.workspaceId, accountId };
  const policyId = await f.t.mutation(internal.performance.history.configure, {
    ...args,
    version: "history-test-v1",
    approvedBy: f.userId,
    expiresAt: Date.now() + 86400000,
    purpose: "own-history-analytics-context-v1",
    dialect: "post-fields-repost-v2",
    providerIdentity: "123",
    connectionSequence: 1,
    accessEvidence: "Synthetic only",
    rightsEvidence: "Synthetic own context permission",
    pricingEvidence: "Synthetic returned-resource unit, no discount inference",
    protocolEvidence: "Synthetic exact dialect",
    allocationEvidence: "Synthetic only",
    unit: "returned-post-resource",
    unitMicros: 10,
    currency: "USD",
    allocatedProviderLimitMicros: limit,
    retentionMs: 86400000,
    maxResults,
  });
  await f.t.run(async (ctx) => {
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key: [
          "history:x",
          `history:workspace:${f.workspaceId}`,
          `history:account:${accountId}`,
        ][i],
        scope,
        ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
        ...(i === 2 ? { accountId } : {}),
        policyVersion: "history-test-v1",
        currency: "USD",
        purposes: ["own-history"],
        expiresAt: Date.now() + 86400000,
        limitMicros: limit,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  const start = async () => {
    const acknowledged = (
      await f.signed.query(api.performance.history.overview, args)
    ).policy!;
    return f.signed.mutation(api.performance.history.start, {
      ...args,
      policyId: acknowledged.id,
      policyFingerprint: acknowledged.fingerprint,
      purpose: "own-history-analytics-context-v1",
      consent: true,
    });
  };
  return { ...f, args, accountId, policyId, start };
}

export async function publishingFixture(
  metrics = false,
  base?: Parameters<typeof jevFixture>[1],
  existingAccountId?: Parameters<typeof jevFixture>[2],
  original?: {
    draftId: NonNullable<
      Awaited<ReturnType<typeof jevFixture>>
    >["request"]["draftId"];
    draftVersionId: NonNullable<
      Awaited<ReturnType<typeof jevFixture>>
    >["request"]["draftVersionId"];
  },
) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00Z"));
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "synthetic");
  const f = await jevFixture(true, base, existingAccountId),
    accountId = f.request.accountId;
  await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(accountId))!;
    await ctx.db.patch(a._id, {
      providerIdentity: "123",
      capability: { ...a.capability, publish: true },
      xEvidence: {
        scopes: ["tweet.read", "users.read", "tweet.write"],
        identityVerifiedAt: Date.now(),
        connectionSequence: 1,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "verified",
      },
    });
    await ctx.db.insert("xBindings", {
      workspaceId: f.workspaceId,
      accountId,
      providerIdentity: "123",
      changedAt: Date.now(),
    });
    await ctx.db.insert("xCredentials", {
      workspaceId: f.workspaceId,
      accountId,
      generation: 1,
      envelope: await seal(
        { accessToken: "synthetic-only" },
        association(f.workspaceId, accountId),
      ),
      scopes: ["tweet.read", "users.read", "tweet.write"],
      expiresAt: Date.now() + 5 * 86400000,
      leaseUntil: 0,
      cleanAfter: Number.MAX_SAFE_INTEGER,
    });
  });
  const identity = await f.t.run(async (ctx) => {
    const user = (await ctx.db.get(f.userId))!;
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: user.authId,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 5 * 86400000,
          },
        },
      },
    );
    return { subject: user.authId, sessionId: session._id };
  });
  f.signed = f.t.withIdentity(identity);
  const args = { workspaceId: f.workspaceId, accountId };
  if (metrics) {
    await f.t.mutation(internal.performance.capabilities.configure, {
      ...args,
      version: "test-v1",
      approvedBy: f.userId,
      expiresAt: Date.now() + 5 * 86400000,
      purpose: "own-post-descriptive-editorial-v1",
      dialect: "post-fields-repost-v2",
      accessEvidence: "Synthetic field entitlement only",
      rightsEvidence: "Synthetic own count rights only",
      pricingEvidence: "Synthetic single request rate",
      protocolEvidence: "Synthetic dialect receipt",
      allocationEvidence: "Synthetic approved total allocation",
      fields: ["impressions", "likes", "reposts", "url_clicks"],
      unit: "single-post-request",
      unitMicros: 10,
      currency: "USD",
      retentionMs: 3 * 86400000,
      connectionSequence: 1,
      providerIdentity: "123",
      allocatedProviderLimitMicros: 1000,
    });
    await f.t.run(async (ctx) => {
      for (const [i, scope] of (
        ["provider", "workspace", "account"] as const
      ).entries())
        await ctx.db.insert("aiBudgets", {
          key: [
            "metrics:x",
            `metrics:workspace:${f.workspaceId}`,
            `metrics:account:${accountId}`,
          ][i],
          scope,
          ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
          ...(i === 2 ? { accountId } : {}),
          policyVersion: "test-v1",
          currency: "USD",
          purposes: ["own-metrics"],
          expiresAt: Date.now() + 5 * 86400000,
          limitMicros: 1000,
          heldMicros: 0,
          spentMicros: 0,
        });
    });
    await f.signed.mutation(api.performance.capabilities.consent, {
      ...args,
      enabled: true,
    });
  }
  if (original) {
    f.request.draftId = original.draftId;
    f.request.draftVersionId = original.draftVersionId;
  }
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    ...args,
    versionId: f.request.draftVersionId,
  });
  const scheduleId = await f.signed.mutation(api.editorial.schedule, {
    ...args,
    versionId: f.request.draftVersionId,
    approvalId,
    at: Date.now() + 60000,
    timezone: "UTC",
    localTime: "2026-10-06T12:01",
  });
  vi.setSystemTime(Date.now() + 60000);
  const job = { scheduleId, generation: 1 };
  await f.t.mutation(internal.publishing.claim, job);
  const first = await f.t.mutation(internal.publishing.attempts.claim, job);
  expect(first).not.toBeNull();
  const send = () =>
    f.t.mutation(internal.publishing.attempts.beforeSend, {
      attemptId: first!._id,
      claimSequence: first!.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    });
  const confirm = () =>
    f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: first!._id,
      claimSequence: first!.claimSequence,
      outcome: "confirmed",
      externalId: "101",
      durationMs: 1,
    });
  return {
    ...f,
    args,
    accountId,
    scheduleId,
    job,
    first: first!,
    send,
    confirm,
  };
}
