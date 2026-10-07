import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { jevFixture } from "../../tests/jev-fixture";
import { api, internal, components } from "../_generated/api";
import { seal } from "../lib/crypto";
import { association } from "../integrations/x/fields";
import { normalize } from "../performance/normalize";
const get = makeFunctionReference<"query">("operations/pilot:get");
const sample = makeFunctionReference<"query">("operations/pilot:sample");
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function publishingFixture(
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
      fields: ["impressions"],
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
  await f.t.run((ctx) =>
    ctx.db.patch(f.request.draftVersionId, {
      content: {
        title: "Synthetic",
        text: ["Synthetic single text"],
        media: [],
        accountId,
        pillar: "",
        strategy: "",
      },
    }),
  );
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

async function observed(value: number | null = 0) {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await f.t.run((ctx) =>
    ctx.db
      .query("performanceSnapshots")
      .withIndex("by_postAttemptId_and_windowHours", (q) =>
        q.eq("postAttemptId", f.first._id).eq("windowHours", 24),
      )
      .unique(),
  ))!;
  vi.setSystemTime(row.dueAt);
  const begun = (await f.t.mutation(internal.performance.snapshots.begin, {
    snapshotId: row._id,
    generation: row.generation,
    credentialGeneration: 1,
  }))!;
  const c = (await f.t.run((ctx) => ctx.db.get(f.first._id)))!;
  const result = normalize(
    {
      data: {
        id: "101",
        author_id: "123",
        created_at: new Date(c.confirmedAt!).toISOString(),
        public_metrics: value === null ? {} : { impression_count: value },
      },
    },
    "101",
    "123",
    ["impressions"],
    "post-fields-repost-v2",
  );
  await f.t.mutation(internal.performance.snapshots.finish, {
    attemptId: begun.attemptId,
    knownCharge: true,
    fields: result.fields,
    providerCreatedAt: c.confirmedAt!,
    reason: null,
  });
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  return {
    ...f,
    rowId: row._id,
    args: {
      ...f.args,
      expectedAuthId: user.authId,
      refreshKey: crypto.randomUUID(),
    },
  };
}
test("registered pilot retains an actual settled zero without provider calls, private data or writes", async () => {
  const f = await observed();
  const http = vi.fn(() => {
    throw new Error("No HTTP allowed");
  });
  vi.stubGlobal("fetch", http);
  const before = await f.t.run(async (ctx) => ({
    budgets: await ctx.db.query("aiBudgets").collect(),
    attempts: await ctx.db.query("aiAttempts").collect(),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  const r = await f.signed.query(get, f.args);
  expect(r.data.cohorts).toHaveLength(1);
  expect(r.data.cohorts[0].impressions).toEqual({ n: 1, sum: 0, mean: 0 });
  expect(r.data.coverage).toEqual({
    partial: true,
    candidateLimit: 5,
    subset: "original_single_text_post",
    remainder: "unknown",
  });
  expect(r.authId).toBe(f.args.expectedAuthId);
  expect(r.refreshKey).toBe(f.args.refreshKey);
  expect(r.sessionId).toBeTruthy();
  expect(JSON.stringify(r.data)).not.toMatch(
    /Synthetic|definition|externalId|providerIdentity|spent|held|cost|candidateCount|withdrawn|sessionId|authId/,
  );
  expect(
    new TextEncoder().encode(JSON.stringify(r)).length,
  ).toBeLessThanOrEqual(32768);
  expect(
    await f.t.run(async (ctx) => ({
      budgets: await ctx.db.query("aiBudgets").collect(),
      attempts: await ctx.db.query("aiAttempts").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    })),
  ).toEqual(before);
  expect(http).not.toHaveBeenCalled();
});
test("registered pilot missing impressions are unknown rather than measured zero", async () => {
  const f = await observed(null);
  const r = await f.signed.query(get, f.args);
  expect(r.data.cohorts[0].impressions).toEqual({
    n: 0,
    sum: null,
    mean: null,
  });
});

test("outer and independently registered inner deny roles, auth mismatch, inactive scope and foreign account before numbers", async () => {
  const f = await observed();
  for (const fn of [get, sample]) {
    await expect(
      f.signed.query(fn, { ...f.args, expectedAuthId: "foreign" }),
    ).rejects.toThrow("PILOT_SCOPE_CHANGED");
    for (const refreshKey of ["", "x".repeat(65)])
      await expect(
        f.signed.query(fn, { ...f.args, refreshKey }),
      ).rejects.toThrow("PILOT_REQUEST_INVALID");
    for (const role of ["Editor", "Viewer"] as const) {
      await f.t.run(async (ctx) => {
        const m = (await ctx.db.query("memberships").first())!;
        await ctx.db.patch(m._id, { role });
      });
      await expect(f.signed.query(fn, f.args)).rejects.toThrow(
        "ROLE_ACCESS_DENIED",
      );
    }
    await f.t.run(async (ctx) => {
      const m = (await ctx.db.query("memberships").first())!;
      await ctx.db.patch(m._id, { role: "Admin" });
    });
    expect(
      (await f.signed.query(fn, f.args)).data.cohorts[0].impressions.n,
    ).toBe(1);
  }
  await expect(f.t.query(get, f.args)).rejects.toThrow();
  const foreign = await f.t.run(async (ctx) => {
    const w = await ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "Synthetic foreign workspace",
    });
    const a = (await ctx.db.get(f.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return ctx.db.insert("socialAccounts", { ...fields, workspaceId: w });
  });
  await expect(
    f.signed.query(get, { ...f.args, accountId: foreign }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(f.signed.query(get, f.args)).rejects.toThrow(
    "WORKSPACE_INACTIVE",
  );
});
test("original candidate position, confirmation, policy descriptor and duplicate fields fail the entire registered response", async () => {
  const f = await observed();
  const r = (await f.t.run((ctx) => ctx.db.get(f.rowId)))!;
  for (const fields of [
    { position: 1 },
    { confirmedAt: r.confirmedAt + 1 },
    { externalId: "foreign" },
    { fields: [...r.fields, ...r.fields] },
    { fields: r.fields.map((x) => ({ ...x, definition: "corrupt" })) },
    { fields: r.fields.map((x) => ({ ...x, rawField: "corrupt" })) },
  ]) {
    await f.t.run((ctx) => ctx.db.patch(r._id, fields));
    await expect(f.signed.query(get, f.args)).rejects.toThrow(
      "PILOT_SOURCE_UNAVAILABLE",
    );
    await f.t.run((ctx) =>
      ctx.db.patch(r._id, {
        position: r.position,
        confirmedAt: r.confirmedAt,
        externalId: r.externalId,
        fields: r.fields,
      }),
    );
  }
  const t = (await f.t.run((ctx) => ctx.db.get(r.attemptId!)))!;
  if (t.owner !== "own-metrics") throw new Error("Wrong fixture receipt");
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.get(t.policyId))!;
    await ctx.db.patch(p._id, { fields: [...p.fields, ...p.fields] });
  });
  await expect(f.signed.query(get, f.args)).rejects.toThrow();
});
test("retained numeric rights withdrawal and expiry erase all numbers, while private source ancestry is never traversed", async () => {
  const f = await observed();
  // The original immutable post text is sufficient; no draft current pointer or AI ancestry is read.
  await f.t.run((ctx) => ctx.db.delete(f.request.draftId));
  expect(
    (await f.signed.query(get, f.args)).data.cohorts[0].impressions.n,
  ).toBe(1);
  const control = (await f.t.run((ctx) =>
    ctx.db.query("performanceControls").first(),
  ))!;
  await f.t.run((ctx) => ctx.db.patch(control._id, { deleted: true }));
  await expect(f.signed.query(get, f.args)).rejects.toThrow(
    "OWN_METRICS_SOURCE_UNAVAILABLE",
  );
  await f.t.run((ctx) => ctx.db.patch(control._id, { deleted: false }));
  const r = await f.signed.query(get, f.args);
  vi.setSystemTime(r.data.until!);
  await expect(f.signed.query(get, f.args)).rejects.toThrow();
});
async function copyObservation(
  f: Awaited<ReturnType<typeof observed>>,
  n: number,
  value: number,
  version = "test-v1",
) {
  return f.t.run(async (ctx) => {
    const original = (await ctx.db.get(f.rowId))!,
      c = (await ctx.db.get(f.first._id))!,
      s = (await ctx.db.get(f.scheduleId))!,
      t = (await ctx.db.get(original.attemptId!))!;
    if (t.owner !== "own-metrics") throw new Error("Wrong fixture receipt");
    const { _id: sid, _creationTime: st, ...schedule } = s;
    const scheduleId = await ctx.db.insert("schedules", {
      ...schedule,
      externalPosts: [],
    });
    const { _id: cid, _creationTime: ct, ...candidate } = c;
    const externalId = String(1000 + n),
      postAttemptId = await ctx.db.insert("xPostAttempts", {
        ...candidate,
        scheduleId,
        externalId,
        confirmedAt: c.confirmedAt! + n,
      });
    await ctx.db.patch(scheduleId, {
      externalPosts: [
        {
          ...s.externalPosts![0],
          position: 0,
          externalId,
          attemptId: postAttemptId,
          confirmedAt: c.confirmedAt! + n,
        },
      ],
    });
    const { _id: rid, _creationTime: rt, ...row } = original;
    const snapshotId = await ctx.db.insert("performanceSnapshots", {
      ...row,
      postAttemptId,
      scheduleId,
      externalId,
      confirmedAt: c.confirmedAt! + n,
      definitionVersion: version,
      fields: row.fields.map((x) => ({ ...x, value })),
    });
    const { _id: tid, _creationTime: tt, ...attempt } = t;
    let policyId = t.policyId,
      policyFingerprint = t.policyFingerprint;
    if (version !== "test-v1") {
      const p = (await ctx.db.get(t.policyId))!;
      const { _id, _creationTime, ...policy } = p;
      policyId = await ctx.db.insert("performancePolicies", {
        ...policy,
        version,
      });
      for (const b of await ctx.db.query("aiBudgets").collect())
        await ctx.db.patch(b._id, { policyVersion: version });
      policyFingerprint = await (
        await import("../performance/capabilities")
      ).fingerprint((await ctx.db.get(policyId))!);
    }
    const attemptId = await ctx.db.insert("aiAttempts", {
      ...attempt,
      snapshotId,
      policyId,
      policyFingerprint,
    });
    await ctx.db.patch(snapshotId, { attemptId });
    return { snapshotId, postAttemptId };
  });
}
test("five latest confirmations preserve compatible metric-specific sums, unsafe totals and opaque distinct original cohorts", async () => {
  const f = await observed(3);
  await copyObservation(f, 1, 7);
  await copyObservation(f, 2, 11, "older-approved-definition");
  let r = await f.signed.query(get, f.args);
  expect(
    r.data.cohorts
      .map((c: any) => c.impressions)
      .sort((a: any, b: any) => a.n - b.n),
  ).toEqual([
    { n: 1, sum: 11, mean: 11 },
    { n: 2, sum: 10, mean: 5 },
  ]);
  expect(new Set(r.data.cohorts.map((c: any) => c.key)).size).toBe(2);
  expect(
    r.data.cohorts.every((c: any) => /^[A-Za-z0-9_-]{43}$/.test(c.key)),
  ).toBe(true);
  await copyObservation(f, 3, Number.MAX_SAFE_INTEGER);
  await copyObservation(f, 4, Number.MAX_SAFE_INTEGER);
  r = await f.signed.query(get, f.args);
  expect(
    r.data.cohorts.find((c: any) => c.impressions.n === 4).impressions,
  ).toEqual({ n: 4, sum: null, mean: null });
  await copyObservation(f, 5, 2);
  r = await f.signed.query(get, f.args);
  expect(
    r.data.cohorts.reduce((sum: number, c: any) => sum + c.impressions.n, 0),
  ).toBe(5);
  expect(r.data.coverage.remainder).toBe("unknown");
});
test("actual same-snapshot query metrics include outer Auth and nested proof, and native lower limits propagate", async () => {
  const f = await observed();
  for (let i = 1; i < 5; i++) await copyObservation(f, i, i);
  const measured = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(get, f.args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(measured.metrics.databaseQueries.used).toBeLessThanOrEqual(256);
  expect(measured.metrics.documentsRead.used).toBeLessThanOrEqual(256);
  expect(measured.metrics.bytesRead.used).toBeLessThanOrEqual(512 * 1024);
  expect(measured.metrics.documentsWritten.used).toBe(0);
  expect(measured.metrics.functionsScheduled.used).toBe(0);
  console.log(
    "TASK35.1 actual five-proof metrics",
    JSON.stringify(measured.metrics),
  );
  await expect(
    f.signed.run((ctx) =>
      ctx.runQuery(get, f.args, {
        transactionLimits: {
          databaseQueries: 10,
          documentsRead: 10,
          bytesRead: 4096,
        },
      }),
    ),
  ).rejects.toThrow();
});

test("registered singleton refuses extra and mismatched original physical confirmation entries", async () => {
  const f = await observed(),
    s = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!,
    original = s.externalPosts!;
  for (const externalPosts of [
    [...original, { ...original[0], position: 1 }],
    [{ ...original[0], confirmedAt: original[0].confirmedAt + 1 }],
  ]) {
    await f.t.run((ctx) => ctx.db.patch(s._id, { externalPosts }));
    await expect(f.signed.query(get, f.args)).rejects.toThrow(
      "PILOT_SOURCE_UNAVAILABLE",
    );
  }
  await f.t.run((ctx) =>
    ctx.db.patch(s._id, {
      externalPosts: original,
      generation: s.generation + 1,
    }),
  );
  await expect(f.signed.query(get, f.args)).rejects.toThrow(
    "PILOT_SOURCE_UNAVAILABLE",
  );
});

test("registered pilot rejects nonfinite observation clocks while null and finite outside-window times remain unknown", async () => {
  const f = await observed(7),
    original = (await f.t.run((ctx) => ctx.db.get(f.rowId)))!;
  for (const field of ["observedAt", "providerCreatedAt"] as const) {
    for (const value of [
      NaN,
      Infinity,
      -Infinity,
      null,
      original[field]! + 120000,
    ]) {
      await f.t.run((ctx) =>
        ctx.db.patch(f.rowId, {
          observedAt: original.observedAt,
          providerCreatedAt: original.providerCreatedAt,
          [field]: value,
        }),
      );
      if (value !== null && !Number.isFinite(value)) {
        await expect(f.signed.query(get, f.args)).rejects.toThrow(
          "PILOT_SOURCE_UNAVAILABLE",
        );
      } else {
        const result = await f.signed.query(get, f.args);
        expect(result.data.cohorts[0].impressions).toEqual({
          n: 0,
          sum: null,
          mean: null,
        });
      }
    }
  }
  await f.t.run((ctx) =>
    ctx.db.patch(f.rowId, {
      observedAt: original.observedAt,
      providerCreatedAt: original.providerCreatedAt,
    }),
  );
  expect(
    (await f.signed.query(get, f.args)).data.cohorts[0].impressions,
  ).toEqual({ n: 1, sum: 7, mean: 7 });
});
