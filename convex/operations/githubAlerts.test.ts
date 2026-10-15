import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { sourceFixture, send, push } from "../../tests/github-fixture";
import { internal, components } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
const get = makeFunctionReference<"query">("operations/githubAlerts:get");
const sample = makeFunctionReference<"query">("operations/githubAlerts:sample");
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00Z"));
  const f = await sourceFixture(2);
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    refreshKey: crypto.randomUUID(),
  };
  const add = async (
    state: Doc<"githubRecoveries">["state"] = "missing",
    patch: Partial<Doc<"githubRecoveries">> = {},
  ) =>
    f.t.run((ctx) =>
      ctx.db.insert("githubRecoveries", {
        workspaceId: f.workspaceId,
        repositoryId: f.repositories[0],
        generation: 1,
        providerId: "101",
        installationId: "50",
        deliveryId: "1",
        guid: crypto.randomUUID(),
        event: "push",
        deliveredAt: Date.now(),
        providerStatus: null,
        state,
        sequence: 0,
        attempts: 0,
        leaseUntil: 0,
        notBefore: 0,
        updatedAt: Date.now(),
        errorCode: null,
        ...patch,
      }),
    );
  return { ...f, args, add };
}
test("registered bounded native branches retain missing behind processed and expired requesting behind live leases", async () => {
  const f = await fixture();
  const ids = [
    await f.add(),
    await f.add("unknown"),
    await f.add("requesting", { leaseUntil: Date.now() - 1 }),
  ];
  for (let i = 0; i < 7; i++) {
    await f.add("processed");
    await f.add("accepted");
    await f.add("requesting", { leaseUntil: Date.now() + 60000 });
  }
  const result = await f.signed.query(get, f.args);
  expect(result.data.rows.map((r: { id: string }) => r.id)).toEqual(ids);
  expect(result.data.coverage).toEqual({
    partial: true,
    parentLimit: 6,
    remainder: "unknown",
  });
  expect(result.data.validUntil).toBe(Date.now() + 30000);
  expect(Object.keys(result).sort()).toEqual([
    "authId",
    "data",
    "refreshKey",
    "sessionId",
    "workspaceId",
  ]);
  expect(
    result.data.rows.every((r: object) => Object.keys(r).join() === "id"),
  ).toBe(true);
});
test("perbranch caps and denied interleaving preserve honest unknown even when empty", async () => {
  const f = await fixture();
  for (const state of ["missing", "unknown", "requesting"] as const)
    for (let i = 0; i < 4; i++) await f.add(state);
  expect((await f.signed.query(get, f.args)).data.rows).toHaveLength(6);
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { monitoring: false }),
  );
  expect((await f.signed.query(get, f.args)).data).toMatchObject({
    coverage: { remainder: "unknown" },
    rows: [],
  });
});
test("native producer replay, signed receipt alone and actual processed signal have distinct attention semantics", async () => {
  const f = await fixture(),
    guid = crypto.randomUUID();
  const delivery = {
    guid,
    deliveryId: "1",
    providerId: "101",
    installationId: "50",
    event: "push" as const,
    deliveredAt: Date.now(),
    providerStatus: null,
  };
  await f.t.mutation(internal.integrations.github.recoveryState.track, {
    delivery,
    cursor: null,
  });
  await f.t.mutation(internal.integrations.github.recoveryState.track, {
    delivery,
    cursor: null,
  });
  expect((await f.signed.query(get, f.args)).data.rows).toHaveLength(1);
  expect((await send(f, push, "push", guid)).status).toBe(202);
  expect((await f.signed.query(get, f.args)).data.rows).toHaveLength(1);
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  expect((await f.signed.query(get, f.args)).data.rows).toEqual([]);
});
test.each(["Editor", "Viewer"] as const)(
  "%s cannot read either registered entry",
  async (role) => {
    const f = await fixture();
    await f.add();
    await f.t.run(async (ctx) => {
      const m = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
        )
        .unique();
      await ctx.db.patch(m!._id, { role });
    });
    for (const fn of [get, sample])
      await expect(f.signed.query(fn, f.args)).rejects.toThrow(
        "ROLE_ACCESS_DENIED",
      );
  },
);
test.each([
  { expectedAuthId: "wrong" },
  { expectedAuthId: "x".repeat(257) },
  { refreshKey: "" },
  { refreshKey: "x".repeat(65) },
])("auth/request fence %j", async (patch) => {
  const f = await fixture();
  await expect(f.signed.query(get, { ...f.args, ...patch })).rejects.toThrow();
});
test.each([
  { generation: 2 },
  { providerId: "999" },
  { installationId: "999" },
])("stored recovery authority loss is omitted %j", async (patch) => {
  const f = await fixture();
  await f.add("missing", patch);
  expect((await f.signed.query(get, f.args)).data.rows).toEqual([]);
});
test.each([
  { selected: false },
  { access: false },
  { monitoring: false },
  { generation: 2 },
  { connectionGeneration: 2 },
  { proofExpiresAt: 0 },
])("current source loss is omitted %j", async (patch) => {
  const f = await fixture();
  await f.add();
  await f.t.run((ctx) => ctx.db.patch(f.repositories[0], patch));
  expect((await f.signed.query(get, f.args)).data.rows).toEqual([]);
});
test.each([
  "leaseUntil",
  "notBefore",
  "updatedAt",
  "deliveredAt",
  "generation",
] as const)(
  "nonfinite native recovery clock %s fails whole query",
  async (field) => {
    const f = await fixture();
    await f.add("missing", { [field]: NaN });
    await expect(f.signed.query(get, f.args)).rejects.toThrow(
      "GITHUB_ALERT_CLOCK_INVALID",
    );
  },
);
test("displayed source horizon is exact and future cooldown does not hide attention", async () => {
  const f = await fixture();
  await f.add("unknown", { notBefore: Date.now() + 86400000 });
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { proofExpiresAt: Date.now() + 501 }),
  );
  expect((await f.signed.query(get, f.args)).data.validUntil).toBe(
    Date.now() + 501,
  );
  vi.advanceTimersByTime(501);
  expect((await f.signed.query(get, f.args)).data.rows).toEqual([]);
});
test("actual six current proofs include outer native Auth budgets/wire and never write or schedule; native resource errors propagate", async () => {
  const f = await fixture();
  for (const state of ["missing", "unknown", "requesting"] as const)
    for (let i = 0; i < 2; i++) {
      const guid = crypto.randomUUID();
      await f.add(state, { guid });
      await send(f, { ...push, after: String(i + 3).repeat(40) }, "push", guid);
    }
  const before = await f.t.run((ctx) =>
    ctx.db.query("githubRecoveries").collect(),
  );
  const measured = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(get, f.args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(measured.value.data.rows).toHaveLength(6);
  expect(measured.metrics.databaseQueries.used).toBeLessThanOrEqual(128);
  expect(measured.metrics.documentsRead.used).toBeLessThanOrEqual(128);
  expect(measured.metrics.bytesRead.used).toBeLessThanOrEqual(256 * 1024);
  expect(measured.metrics.documentsWritten.used).toBe(0);
  expect(measured.metrics.functionsScheduled.used).toBe(0);
  expect(
    new TextEncoder().encode(JSON.stringify(measured.value)).length,
  ).toBeLessThanOrEqual(16 * 1024);
  console.log(
    "TASK31.3 actual six-proof metrics",
    JSON.stringify({
      ...measured,
      wireBytes: new TextEncoder().encode(JSON.stringify(measured.value))
        .length,
    }),
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("githubRecoveries").collect()),
  ).toEqual(before);
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

test.each(["monitor", "connection"])(
  "current %s actor authority is checked",
  async (kind) => {
    const f = await fixture();
    await f.add();
    await f.t.run(async (ctx) => {
      const u = (await ctx.db.get(f.userId))!;
      const { _id, _creationTime, ...fields } = u;
      const actorId = await ctx.db.insert("users", {
        ...fields,
        authId: "separate-native-actor",
      });
      await ctx.db.insert("memberships", {
        workspaceId: f.workspaceId,
        userId: actorId,
        role: "Editor",
      });
      if (kind === "monitor")
        await ctx.db.patch(f.repositories[0], { purposeActorId: actorId });
      else {
        const c = await ctx.db
          .query("githubConnections")
          .withIndex("by_workspaceId", (q) =>
            q.eq("workspaceId", f.workspaceId),
          )
          .unique();
        await ctx.db.patch(c!._id, { actorId });
      }
    });
    expect((await f.signed.query(get, f.args)).data.rows).toEqual([]);
  },
);
test.each(["user:7", "install:50", "repo:50:101"])(
  "current revocation barrier %s removes attention",
  async (key) => {
    const f = await fixture();
    await f.add();
    const guid = crypto.randomUUID();
    await send(f, push, "push", guid);
    await f.t.run(async (ctx) => {
      const receipt = await ctx.db.query("githubWebhookReceipts").first();
      await ctx.db.insert("githubRevocationBarriers", {
        key,
        receivedAt: Date.now(),
        receiptId: receipt!._id,
        sequence: 999,
      });
    });
    expect((await f.signed.query(get, f.args)).data.rows).toEqual([]);
  },
);
test("selected active workspace is a native entry fence", async () => {
  const f = await fixture();
  await f.add();
  await expect(
    f.signed.query(get, { ...f.args, workspaceId: f.workspaces[1] }),
  ).rejects.toThrow("GITHUB_WORKSPACE_CHANGED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(f.signed.query(get, f.args)).rejects.toThrow(
    "WORKSPACE_INACTIVE",
  );
});
test("unexpected native uniqueness errors propagate rather than reporting an empty sample", async () => {
  const f = await fixture();
  await f.add();
  await f.t.run(async (ctx) => {
    const c = (await ctx.db.query("githubConnections").first())!;
    const { _id, _creationTime, ...fields } = c;
    await ctx.db.insert("githubConnections", fields);
  });
  await expect(f.signed.query(get, f.args)).rejects.toThrow();
});

test("native requesting original lease before/equal/after observation is ranged before cap", async () => {
  const f = await fixture(),
    now = Date.now();
  const before = await f.add("requesting", { leaseUntil: now - 1 });
  const equal = await f.add("requesting", { leaseUntil: now });
  await f.add("requesting", { leaseUntil: now + 1 });
  expect(
    (await f.signed.query(get, f.args)).data.rows.map(
      (r: { id: string }) => r.id,
    ),
  ).toEqual([equal, before]);
  vi.advanceTimersByTime(1);
  expect((await f.signed.query(get, f.args)).data.rows).toHaveLength(2);
});
test("missing native session refuses both public and internal entry", async () => {
  const f = await fixture();
  for (const fn of [get, sample])
    await expect(
      f.t.withIdentity({ subject: f.args.expectedAuthId }).query(fn, f.args),
    ).rejects.toThrow();
});

test("unverified native identity is denied before domain reads", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", value: f.args.expectedAuthId }],
        update: { emailVerified: false },
      },
    }),
  );
  for (const fn of [get, sample])
    await expect(f.signed.query(fn, f.args)).rejects.toThrow(
      "EMAIL_NOT_VERIFIED",
    );
});
test.each([NaN, Infinity])(
  "nonfinite current proof horizon %s never produces a visible row",
  async (proofExpiresAt) => {
    const f = await fixture();
    await f.add();
    await f.t.run((ctx) => ctx.db.patch(f.repositories[0], { proofExpiresAt }));
    if (Number.isNaN(proofExpiresAt))
      expect((await f.signed.query(get, f.args)).data.rows).toEqual([]);
    else
      await expect(f.signed.query(get, f.args)).rejects.toThrow(
        "GITHUB_ALERT_CLOCK_INVALID",
      );
  },
);
test("full-entry public read bytes include native private source documents and fail honestly at installed limit", async () => {
  const f = await fixture();
  await f.add();
  await f.t.run(async (ctx) => {
    const c = await ctx.db
      .query("githubConnections")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", f.workspaceId))
      .unique();
    await ctx.db.patch(c!._id, {
      envelope: { ...c!.envelope!, ciphertext: "x".repeat(270 * 1024) },
    });
  });
  await expect(f.signed.query(get, f.args)).rejects.toThrow();
});
