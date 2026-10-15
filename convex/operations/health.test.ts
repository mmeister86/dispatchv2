import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { mediaFixture } from "../../tests/media-fixture";
const get = makeFunctionReference<"query">("operations/health:get");
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
test("native health is metadata-only bounded coverage with zero provider IO and no writes", async () => {
  vi.stubEnv("R2_MEDIA_BUCKET", "synthetic-health");
  const f = await mediaFixture();
  const session = await f.reserve();
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const before = await f.t.run(async (ctx) => ({
    assets: await ctx.db.query("mediaAssets").collect(),
    sessions: await ctx.db.query("mediaUploadSessions").collect(),
    workspace: await ctx.db.get(f.workspaceId),
    scheduler: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  const result = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    refreshKey: "initial",
  });
  expect(result.coverage.kind).toBe("bounded_receipt_sample");
  expect(result.families.map((x: { family: string }) => x.family)).toEqual([
    "publishing",
    "github",
    "media",
    "research",
    "generation",
    "own_metrics",
    "own_history",
    "jev_analyzer",
    "intent_routing",
    "embedding",
    "output_verification",
  ]);
  const media = result.families.find(
    (x: { family: string }) => x.family === "media",
  );
  expect(media.rows).toHaveLength(1);
  expect(media.rows[0].parent).toEqual({ kind: "media", id: session.assetId });
  expect(media.rows[0].recovery).toEqual({ kind: "media" });
  expect(JSON.stringify(result)).not.toContain("Synthetic.png");
  expect(physical).not.toHaveBeenCalled();
  expect(
    await f.t.run(async (ctx) => ({
      assets: await ctx.db.query("mediaAssets").collect(),
      sessions: await ctx.db.query("mediaUploadSessions").collect(),
      workspace: await ctx.db.get(f.workspaceId),
      scheduler: await ctx.db.system.query("_scheduled_functions").collect(),
    })),
  ).toEqual(before);
});
test("native health denies Viewer before domain sampling", async () => {
  const f = await mediaFixture();
  await f.t.run(async (ctx) => {
    const m = (await ctx.db.query("memberships").first())!;
    await ctx.db.patch(m._id, { role: "Viewer" });
  });
  await expect(
    f.signed.query(get, { workspaceId: f.workspaceId, refreshKey: "viewer" }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
});

import { modelFixture } from "../../tests/model-fixture";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
const researchConfig = {
  topics: "Product",
  project: "Own project",
  audience: "Builders",
  languages: ["de"],
  regions: ["DE"],
  preferredSources: ["https://example.test"],
  exclusions: "",
  freshnessDays: 7,
  topicCount: 5,
  frequency: "manual" as const,
  timeZone: "Europe/Berlin",
  clock: "09:00",
  weekday: 1,
  cap: null,
  autoHandoff: false as const,
};
test("native health entire DTO is invariant under arbitrarily interleaved own and foreign private Agent runs targeted research and unknown costly receipts", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await modelFixture();
  const runId = await f.create();
  const profileId = await f.signed.mutation(api.research.profiles.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    config: researchConfig,
    commandKey: "public-profile",
  });
  const orderId = await f.signed.mutation(api.research.runs.start, {
    workspaceId: f.workspaceId,
    profileId,
    expectedRevision: 1,
    operationKey: "public-order",
  });
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const before = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    refreshKey: "privacy",
  });
  expect(
    before.families.find((x: { family: string }) => x.family === "generation")
      .sampledRows,
  ).toBe(1);
  expect(
    before.families.find((x: { family: string }) => x.family === "research")
      .sampledRows,
  ).toBe(1);
  await f.t.run(async (ctx) => {
    const original = (await ctx.db.get(runId))!,
      { _id, _creationTime, ...run } = original;
    const user = (await ctx.db.get(f.userId))!,
      { _id: uId, _creationTime: uTime, ...u } = user;
    const foreign = await ctx.db.insert("users", {
      ...u,
      authId: "foreign-health-actor",
    });
    const o = (await ctx.db.get(orderId))!,
      { _id: oId, _creationTime: oTime, ...order } = o;
    for (let i = 0; i < 40; i++) {
      const actorId = i % 2 ? f.userId : foreign;
      const conversationId = await ctx.db.insert("conversations", {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        actorId,
        operationKey: `private-${i}`,
        threadId: `private-thread-${i}`,
        title: "PRIVATE_HEALTH_TEXT",
        revision: 1,
        sources: [],
        ideaVersionIds: [],
        turns: 0,
        activeRunId: null,
        updatedAt: Date.now() + i,
        state: "active",
        cleanupAfter: Date.now() + 86400000,
      });
      const privateRunId = await ctx.db.insert("agentRuns", {
        ...run,
        actorId,
        purpose: i % 3 ? "chat" : "draft",
        conversationId,
        createdAt: Date.now() + i,
        threadId: `private-run-${i}`,
      });
      await ctx.db.insert("researchOrders", {
        ...order,
        actorId,
        targetedChat: {
          conversationId,
          topic: "PRIVATE_HEALTH_TOPIC",
          messageId: null,
        },
        createdAt: Date.now() + i,
        operationKey: `private-order-${i}`,
      });
      await ctx.db.insert("aiAttempts", {
        owner: "generation",
        runId: privateRunId,
        workspaceId: f.workspaceId,
        key: `private-cost-${i}`,
        generation: run.generation,
        budgetIds: run.budgetIds,
        reservedMicros: 8100,
        heldMicros: 8100,
        currency: "USD",
        policyVersion: run.policyVersion,
        model: "synthetic/model",
        provider: "requesty",
        inputMicrosPerMillion: 1000000,
        outputMicrosPerMillion: 1000000,
        state: "unknown",
        sentAt: Date.now(),
        settledAt: null,
        inputTokens: null,
        outputTokens: null,
        estimatedMicros: null,
        billedMicros: null,
        reportedCost: null,
        reportedCurrency: null,
        reportedCostInvalid: false,
        errorCode: null,
      });
    }
  });
  expect(
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      refreshKey: "privacy",
    }),
  ).toEqual(before);
  expect(physical).not.toHaveBeenCalled();
});
test("native health actual outer and nested reads respect whole-query ceilings", async () => {
  const f = await mediaFixture();
  const result = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(get, {
      workspaceId: f.workspaceId,
      refreshKey: "metrics",
    }),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(result.metrics.databaseQueries.used).toBeLessThanOrEqual(128);
  expect(result.metrics.documentsRead.used).toBeLessThanOrEqual(512);
  expect(result.metrics.bytesRead.used).toBeLessThanOrEqual(512 * 1024);
  expect(result.metrics.documentsWritten.used).toBe(0);
  expect(result.metrics.functionsScheduled.used).toBe(0);
  expect(
    new TextEncoder().encode(JSON.stringify(result.value)).length,
  ).toBeLessThanOrEqual(64 * 1024);
});

test("public generation without an exact current result parent cannot advertise a recovery link", async () => {
  const f = await modelFixture();
  await f.create();
  const result = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    refreshKey: "no-result",
  });
  expect(
    result.families.find((x: { family: string }) => x.family === "generation")
      .rows[0].recovery,
  ).toBeNull();
});
test("public Research preserves original empty partial and unknown outcomes without returning config or content", async () => {
  const f = await modelFixture();
  const profileId = await f.signed.mutation(api.research.profiles.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    config: researchConfig,
    commandKey: "outcome-profile",
  });
  const orderId = await f.signed.mutation(api.research.runs.start, {
    workspaceId: f.workspaceId,
    profileId,
    expectedRevision: 1,
    operationKey: "outcome-order",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(orderId, {
      state: "completed",
      native: {
        accountIdentity: "PRIVATE_BINDING",
        query: "PRIVATE_QUERY",
        language: "de",
        operations: ["x-recent", "x-trends", "web-search"],
        approvals: [null, null, null],
        cacheIds: [null, null, null],
        outcomes: [
          { state: "empty", reason: "SECRET_REASON", cacheHit: false },
          { state: "partial", reason: null, cacheHit: false },
          { state: "unknown", reason: null, cacheHit: false },
        ],
      },
    }),
  );
  const result = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    refreshKey: "outcome",
  });
  expect(
    result.families.find((x: { family: string }) => x.family === "research")
      .rows[0].outcomes,
  ).toEqual(["empty", "partial", "unknown"]);
  for (const text of ["PRIVATE_BINDING", "PRIVATE_QUERY", "SECRET_REASON"])
    expect(JSON.stringify(result)).not.toContain(text);
});

test("research-linked public-purpose Agent runs are excluded by the selector before cap and optional account selects before unrelated public rows", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await modelFixture();
  const id = await f.create();
  const profileId = await f.signed.mutation(api.research.profiles.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    config: researchConfig,
    commandKey: "linked-profile",
  });
  const orderId = await f.signed.mutation(api.research.runs.start, {
    workspaceId: f.workspaceId,
    profileId,
    expectedRevision: 1,
    operationKey: "linked-order",
  });
  const before = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    refreshKey: "selector",
  });
  await f.t.run(async (ctx) => {
    const r = (await ctx.db.get(id))!,
      { _id, _creationTime, ...run } = r;
    const acc = (await ctx.db.get(f.accountId))!,
      { _id: aId, _creationTime: aTime, ...a } = acc;
    const unrelated = await ctx.db.insert("socialAccounts", {
      ...a,
      providerIdentity: "unrelated",
      name: "Unrelated",
    });
    for (let i = 0; i < 30; i++) {
      await ctx.db.insert("agentRuns", {
        ...run,
        purpose: ["draft", "summary", "plan"][i % 3] as
          "draft" | "summary" | "plan",
        research: { orderId, generation: 1, sources: [] },
        createdAt: Date.now() + i,
      });
      await ctx.db.insert("agentRuns", {
        ...run,
        accountId: unrelated,
        createdAt: Date.now() + i,
      });
    }
  });
  expect(
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      refreshKey: "selector",
    }),
  ).toEqual(before);
});
test("native query capacity deliberately stops an incomplete proof and reports partial coverage within the lowered real transaction limit", async () => {
  const f = await modelFixture();
  await f.create();
  const result = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(
      get,
      { workspaceId: f.workspaceId, refreshKey: "capacity" },
      {
        transactionLimits: {
          databaseQueries: 20,
          documentsRead: 512,
          bytesRead: 512 * 1024,
        },
      },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(result.value.coverage.reasons).toContain("read_budget");
  expect(
    result.value.families.find(
      (x: { family: string }) => x.family === "generation",
    ).rows,
  ).toEqual([]);
  expect(result.metrics.databaseQueries.used).toBeLessThanOrEqual(20);
  expect(result.metrics.documentsWritten.used).toBe(0);
});
test("unexpected actual native byte-limit and unique-reader errors propagate instead of source-loss or healthy empty coverage", async () => {
  const f = await modelFixture();
  const runId = await f.create();
  await f.t.run((ctx) => ctx.db.patch(runId, { threadId: "x".repeat(600000) }));
  await expect(
    f.signed.query(get, { workspaceId: f.workspaceId, refreshKey: "bytes" }),
  ).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.patch(runId, { threadId: "synthetic" }));
  const profileId = await f.signed.mutation(api.research.profiles.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    config: researchConfig,
    commandKey: "duplicate-profile",
  });
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.get(profileId))!,
      { _id, _creationTime, ...row } = p;
    await ctx.db.insert("researchProfiles", row);
  });
  await expect(
    f.signed.query(get, {
      workspaceId: f.workspaceId,
      refreshKey: "duplicate",
    }),
  ).rejects.toThrow();
});

test("completed retained generation remains a historical receipt after its dispatch deadline and never appears overdue", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await modelFixture();
  const id = await f.create();
  await f.t.run((ctx) => ctx.db.patch(id, { state: "completed" }));
  vi.advanceTimersByTime(60001);
  const result = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    refreshKey: "completed-clock",
  });
  const row = result.families.find(
    (x: { family: string }) => x.family === "generation",
  ).rows[0];
  expect(row.state).toBe("completed");
  expect(row.overdue).toBe(false);
  expect(row.code).toBeNull();
});

test("actual generation funding unknown and late reported-cost rehold remain uncertain after completion; observed zero is distinct from missing usage", async () => {
  const f = await modelFixture(),
    runId = await f.create(),
    executionKey = "health-money";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    runId,
    generation: 1,
    executionKey,
    key: "health-receipt",
  });
  const read = async () =>
    (
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        refreshKey: "money",
      })
    ).families.find((x: { family: string }) => x.family === "generation")
      .rows[0];
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: null,
    outputTokens: null,
    errorCode: null,
  });
  await f.t.run((ctx) => ctx.db.patch(runId, { state: "completed" }));
  expect(await read()).toMatchObject({
    state: "completed",
    code: "usage_unresolved",
    receipts: [
      {
        attemptId,
        owner: "generation",
        currency: "USD",
        state: "unknown",
        estimatedMicros: null,
        settledAt: null,
      },
    ],
  });
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: 0,
    outputTokens: 0,
    errorCode: null,
  });
  expect(await read()).toMatchObject({
    code: null,
    receipts: [
      { state: "settled", estimatedMicros: 0, settledAt: expect.any(Number) },
    ],
  });
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: 0,
    outputTokens: 0,
    errorCode: null,
    reportedCost: 0.12,
  });
  const before = await f.t.run((ctx) => ctx.db.get(attemptId));
  expect(await read()).toMatchObject({
    state: "completed",
    code: "usage_unresolved",
    receipts: [
      {
        state: "unknown",
        currency: "USD",
        heldMicros: 8100,
        estimatedMicros: 0,
        settledAt: expect.any(Number),
      },
    ],
  });
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toEqual(before);
});

test("bounded account parent and receipt caps are deterministic with ties and never expose an aggregate total", async () => {
  const f = await modelFixture(),
    id = await f.create();
  const ids = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...run } = (await ctx.db.get(id))!;
    const account = (await ctx.db.get(f.accountId))!;
    for (let i = 0; i < 4; i++) {
      const { _id, _creationTime, ...a } = account;
      await ctx.db.insert("socialAccounts", {
        ...a,
        providerIdentity: `cap-${i}`,
      });
    }
    const ids = [id];
    for (let i = 0; i < 6; i++) ids.push(await ctx.db.insert("agentRuns", run));
    return ids.sort((a, b) => a.localeCompare(b));
  });
  const value = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    refreshKey: "caps",
  });
  const family = value.families.find(
    (x: { family: string }) => x.family === "generation",
  );
  expect(
    family.rows.map((r: { parent: { id: string } }) => r.parent.id),
  ).toEqual(ids.slice(0, 6));
  expect(family).toMatchObject({
    sampledRows: 6,
    moreEligibleRows: true,
    reason: "parent_cap",
    total: null,
  });
  const workspace = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    refreshKey: "accounts",
  });
  expect(workspace.coverage).toMatchObject({
    accountsLoaded: 3,
    moreEligibleAccounts: true,
    total: null,
  });
  expect(
    workspace.families.every((x: { rows: unknown[] }) => x.rows.length <= 6),
  ).toBe(true);
});

test("Owner and Admin only, active workspace and account authority are enforced before domain reads", async () => {
  const f = await modelFixture();
  const membership = await f.t.run((ctx) =>
    ctx.db.query("memberships").first(),
  );
  for (const role of ["Admin", "Owner"] as const) {
    await f.t.run((ctx) => ctx.db.patch(membership!._id, { role }));
    expect(
      (
        await f.signed.query(get, {
          workspaceId: f.workspaceId,
          refreshKey: role,
        })
      ).workspaceId,
    ).toBe(f.workspaceId);
  }
  for (const role of ["Editor", "Viewer"] as const) {
    await f.t.run((ctx) => ctx.db.patch(membership!._id, { role }));
    await expect(
      f.signed.query(get, { workspaceId: f.workspaceId, refreshKey: role }),
    ).rejects.toThrow("ROLE_ACCESS_DENIED");
  }
  await f.t.run((ctx) => ctx.db.patch(membership!._id, { role: "Owner" }));
  const foreign = await f.t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "",
    });
    const { _id, _creationTime, ...account } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", { ...account, workspaceId });
  });
  await expect(
    f.signed.query(get, {
      workspaceId: f.workspaceId,
      accountId: foreign,
      refreshKey: "foreign",
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run(async (ctx) =>
    ctx.db.patch(f.userId, {
      activeWorkspaceId: (await ctx.db.get(foreign))!.workspaceId,
    }),
  );
  await expect(
    f.signed.query(get, {
      workspaceId: f.workspaceId,
      refreshKey: "inactive-selection",
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
});

test("source revocation omits a formerly public generation without disclosing a hidden row count", async () => {
  const f = await modelFixture(),
    id = await f.create();
  expect(
    (
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        refreshKey: "before",
      })
    ).families.find((x: { family: string }) => x.family === "generation")
      .sampledRows,
  ).toBe(1);
  await f.t.run((ctx) =>
    ctx.db.patch(f.accountId, { connection: "disconnected" }),
  );
  const family = (
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      refreshKey: "after",
    })
  ).families.find((x: { family: string }) => x.family === "generation");
  expect(family).toMatchObject({
    rows: [],
    sampledRows: 0,
    moreEligibleRows: false,
    total: null,
  });
  expect(JSON.stringify(family)).not.toContain(id);
});

test("financial child coverage shows six immutable receipt headers and an honest lookahead without budget totals", async () => {
  const f = await modelFixture(),
    runId = await f.create(),
    executionKey = "child-cap";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    runId,
    generation: 1,
    executionKey,
    key: "header-0",
  });
  await f.t.run(async (ctx) => {
    const receipt = (await ctx.db.get(attemptId))!;
    if (receipt.owner !== undefined && receipt.owner !== "generation")
      throw new Error("Expected actual generation receipt");
    const { _id, _creationTime, ...row } = receipt;
    for (let i = 1; i < 8; i++)
      await ctx.db.insert("aiAttempts", { ...row, key: `header-${i}` });
  });
  const row = (
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      refreshKey: "children",
    })
  ).families.find((x: { family: string }) => x.family === "generation").rows[0];
  expect(row).toMatchObject({
    receiptCoverage: "bounded",
    moreReceipts: true,
    code: "usage_unresolved",
  });
  expect(row.receipts).toHaveLength(6);
  expect(
    row.receipts.every(
      (r: { owner: string; currency: string; estimatedMicros: null }) =>
        r.owner === "generation" &&
        r.currency === "USD" &&
        r.estimatedMicros === null,
    ),
  ).toBe(true);
  expect(JSON.stringify(row)).not.toMatch(
    /spentMicros|budgetIds|reportedCost|totalMicros/,
  );
});

import { sourceFixture } from "../../tests/github-fixture";
test("GitHub uses current original recovery proof and local receipt clocks without global attempt counts or provider calls", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await sourceFixture();
  await f.t.mutation(internal.integrations.github.recoveryState.track, {
    delivery: {
      guid: crypto.randomUUID(),
      deliveryId: "1",
      event: "push",
      providerId: "101",
      installationId: "50",
      deliveredAt: Date.now(),
      providerStatus: 503,
    },
    cursor: null,
  });
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const read = async () =>
    (
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        refreshKey: "github",
      })
    ).families.find((x: { family: string }) => x.family === "github");
  const family = await read();
  expect(family.sampledRows).toBe(1);
  expect(family.rows[0]).toMatchObject({
    parent: { kind: "github" },
    localReceipt: false,
    recovery: { kind: "signals" },
  });
  expect(JSON.stringify(family)).not.toMatch(
    /attempts|guid|providerStatus|deliveryId/,
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { monitoring: false }),
  );
  expect(await read()).toMatchObject({
    rows: [],
    sampledRows: 0,
    moreEligibleRows: false,
    total: null,
  });
  expect(physical).not.toHaveBeenCalled();
});

test("Publishing preserves stopped unknown native send liability and original approval revocation without writes or HTTP", async () => {
  const f = await modelFixture();
  const scheduleId = await f.t.run(async (ctx) => {
    await ctx.db.patch(f.accountId, {
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
    });
    const draftId = await ctx.db.insert("drafts", {
      workspaceId: f.workspaceId,
      revision: 1,
      currentVersionId: null,
      authorId: f.userId,
      source: "fixture",
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("draftVersions", {
      workspaceId: f.workspaceId,
      draftId,
      number: 1,
      authorId: f.userId,
      createdAt: Date.now(),
      reason: "fixture",
      content: {
        title: "PRIVATE_DRAFT_TITLE",
        text: ["PRIVATE_DRAFT_TEXT"],
        media: [],
        accountId: f.accountId,
        pillar: "",
        strategy: "generic",
      },
      mediaChecksums: [],
    });
    await ctx.db.patch(draftId, { currentVersionId: versionId });
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      accountId: f.accountId,
      actorId: f.userId,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      accountId: f.accountId,
      approvalId,
      actorId: f.userId,
      accountConnectionSequence: 0,
      generation: 1,
      at: Date.now(),
      timezone: "UTC",
      localTime: "fixture",
      state: "cancelled",
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    });
    await ctx.db.insert("xPostAttempts", {
      workspaceId: f.workspaceId,
      scheduleId,
      generation: 1,
      versionId,
      accountId: f.accountId,
      providerIdentity: "synthetic",
      connectionSequence: 0,
      position: 0,
      attempt: 1,
      claimSequence: 1,
      leaseUntil: 0,
      deadline: Date.now() + 60000,
      stage: "unknown",
      mediaIds: [],
      durationMs: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return scheduleId;
  });
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const read = async () =>
    (
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        refreshKey: "publishing",
      })
    ).families.find((x: { family: string }) => x.family === "publishing");
  const before = await f.t.run((ctx) => ctx.db.get(scheduleId));
  const family = await read();
  expect(family.rows).toHaveLength(1);
  expect(family.rows[0]).toMatchObject({
    state: "cancelled",
    code: "attention",
    overdue: false,
    parent: { kind: "publishing", id: scheduleId },
  });
  expect(JSON.stringify(family)).not.toMatch(
    /PRIVATE_DRAFT_TEXT|PRIVATE_DRAFT_TITLE/,
  );
  expect(await f.t.run((ctx) => ctx.db.get(scheduleId))).toEqual(before);
  await f.t.run((ctx) =>
    ctx.db.patch(before!.approvalId, {
      revokedAt: Date.now(),
      revokedBy: f.userId,
    }),
  );
  const revoked = await read();
  expect(revoked.rows[0]).toMatchObject({
    code: "attention",
    recovery: null,
    parent: { kind: "publishing", id: scheduleId },
  });
  expect(JSON.stringify(revoked)).not.toMatch(
    /PRIVATE_DRAFT_TEXT|PRIVATE_DRAFT_TITLE/,
  );
  // Explicit split: unresolved physical evidence survives revocation; resolved evidence needs current source eligibility.
  const attempt = await f.t.run((ctx) => ctx.db.query("xPostAttempts").first());
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: attempt!._id,
    claimSequence: 1,
    outcome: "rejected",
    durationMs: 0,
  });
  expect(await read()).toMatchObject({
    rows: [],
    sampledRows: 0,
    moreEligibleRows: false,
  });
  expect(physical).not.toHaveBeenCalled();
});

test("registered actual cancellation retains original generation unknown send liability", async () => {
  const f = await modelFixture();
  const scheduleId = await f.t.run(async (ctx) => {
    await ctx.db.patch(f.accountId, {
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
    });
    const draftId = await ctx.db.insert("drafts", {
      workspaceId: f.workspaceId,
      revision: 1,
      currentVersionId: null,
      authorId: f.userId,
      source: "fixture",
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("draftVersions", {
      workspaceId: f.workspaceId,
      draftId,
      number: 1,
      authorId: f.userId,
      createdAt: Date.now(),
      reason: "fixture",
      content: {
        title: "PRIVATE_DRAFT_TITLE",
        text: ["PRIVATE_DRAFT_TEXT"],
        media: [],
        accountId: f.accountId,
        pillar: "",
        strategy: "generic",
      },
      mediaChecksums: [],
    });
    await ctx.db.patch(draftId, { currentVersionId: versionId });
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      accountId: f.accountId,
      actorId: f.userId,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      accountId: f.accountId,
      approvalId,
      actorId: f.userId,
      accountConnectionSequence: 0,
      generation: 1,
      at: Date.now(),
      timezone: "UTC",
      localTime: "fixture",
      state: "cancelled",
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    });
    await ctx.db.insert("xPostAttempts", {
      workspaceId: f.workspaceId,
      scheduleId,
      generation: 1,
      versionId,
      accountId: f.accountId,
      providerIdentity: "synthetic",
      connectionSequence: 0,
      position: 0,
      attempt: 1,
      claimSequence: 1,
      leaseUntil: 0,
      deadline: Date.now() + 60000,
      stage: "unknown",
      mediaIds: [],
      durationMs: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return scheduleId;
  });
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const read = async () =>
    (
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        refreshKey: "publishing",
      })
    ).families.find((x: { family: string }) => x.family === "publishing");
  const before = await f.t.run((ctx) => ctx.db.get(scheduleId));
  const family = await read();
  expect(family.rows).toHaveLength(1);
  expect(family.rows[0]).toMatchObject({
    state: "cancelled",
    code: "attention",
    overdue: false,
    parent: { kind: "publishing", id: scheduleId },
  });
  expect(JSON.stringify(family)).not.toMatch(
    /PRIVATE_DRAFT_TEXT|PRIVATE_DRAFT_TITLE/,
  );
  expect(await f.t.run((ctx) => ctx.db.get(scheduleId))).toEqual(before);
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId,
    expectedGeneration: 1,
  });
  const after = await read();

  expect(after.rows[0].code).toBe("attention");
  expect(after.rows[0]).toMatchObject({
    state: "reconciliation_required",
    recovery: null,
    moreReceipts: false,
  });
  const immutable = await f.t.run((ctx) =>
    ctx.db.query("xPostAttempts").first(),
  );
  expect(immutable).toMatchObject({ generation: 1, stage: "unknown" });
  const cancelled = await f.t.run((ctx) => ctx.db.get(scheduleId));
  expect(cancelled).toMatchObject({
    generation: 2,
    abortRequestedAt: expect.any(Number),
  });
  expect(JSON.stringify(after)).not.toMatch(
    /PRIVATE_DRAFT_TEXT|PRIVATE_DRAFT_TITLE/,
  );
  expect(await f.t.run((ctx) => ctx.db.get(scheduleId))).toEqual(cancelled);
  expect(physical).not.toHaveBeenCalled();
});

test("registered seven omitted newer source parents cannot prove exhaustion of eligible parent window", async () => {
  const f = await modelFixture();
  const scheduleId = await f.t.run(async (ctx) => {
    await ctx.db.patch(f.accountId, {
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
    });
    const draftId = await ctx.db.insert("drafts", {
      workspaceId: f.workspaceId,
      revision: 1,
      currentVersionId: null,
      authorId: f.userId,
      source: "fixture",
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("draftVersions", {
      workspaceId: f.workspaceId,
      draftId,
      number: 1,
      authorId: f.userId,
      createdAt: Date.now(),
      reason: "fixture",
      content: {
        title: "PRIVATE_DRAFT_TITLE",
        text: ["PRIVATE_DRAFT_TEXT"],
        media: [],
        accountId: f.accountId,
        pillar: "",
        strategy: "generic",
      },
      mediaChecksums: [],
    });
    await ctx.db.patch(draftId, { currentVersionId: versionId });
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      accountId: f.accountId,
      actorId: f.userId,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      accountId: f.accountId,
      approvalId,
      actorId: f.userId,
      accountConnectionSequence: 0,
      generation: 1,
      at: Date.now(),
      timezone: "UTC",
      localTime: "fixture",
      state: "cancelled",
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    });
    await ctx.db.insert("xPostAttempts", {
      workspaceId: f.workspaceId,
      scheduleId,
      generation: 1,
      versionId,
      accountId: f.accountId,
      providerIdentity: "synthetic",
      connectionSequence: 0,
      position: 0,
      attempt: 1,
      claimSequence: 1,
      leaseUntil: 0,
      deadline: Date.now() + 60000,
      stage: "unknown",
      mediaIds: [],
      durationMs: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return scheduleId;
  });
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const read = async () =>
    (
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        refreshKey: "publishing",
      })
    ).families.find((x: { family: string }) => x.family === "publishing");
  const before = await f.t.run((ctx) => ctx.db.get(scheduleId));
  const family = await read();
  expect(family.rows).toHaveLength(1);
  expect(family.rows[0]).toMatchObject({
    state: "cancelled",
    code: "attention",
    overdue: false,
    parent: { kind: "publishing", id: scheduleId },
  });
  expect(JSON.stringify(family)).not.toMatch(
    /PRIVATE_DRAFT_TEXT|PRIVATE_DRAFT_TITLE/,
  );
  expect(await f.t.run((ctx) => ctx.db.get(scheduleId))).toEqual(before);
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...original } = (await ctx.db.get(scheduleId))!;
    const {
      _id: aid,
      _creationTime: atime,
      ...approval
    } = (await ctx.db.get(original.approvalId))!;
    const revoked = await ctx.db.insert("approvals", {
      ...approval,
      revokedAt: Date.now(),
      revokedBy: f.userId,
    });
    for (let i = 0; i < 7; i++)
      await ctx.db.insert("schedules", {
        ...original,
        approvalId: revoked,
        at: original.at + i + 1,
      });
  });
  const after = await read();

  expect(after.moreEligibleRows).toBe(null);
  expect(physical).not.toHaveBeenCalled();
});

test("wrong-owner seventh generation financial header cannot claim eligible overflow", async () => {
  const f = await modelFixture(),
    runId = await f.create(),
    executionKey = "bad-seventh";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    runId,
    generation: 1,
    executionKey,
    key: "header-0",
  });
  const extra = await f.t.run(async (ctx) => {
    const receipt = (await ctx.db.get(attemptId))!;
    if (receipt.owner !== undefined && receipt.owner !== "generation")
      throw Error("Expected generation receipt");
    const { _id, _creationTime, ...row } = receipt;
    let extra = attemptId;
    for (let i = 1; i < 7; i++)
      extra = await ctx.db.insert("aiAttempts", { ...row, key: `header-${i}` });
    return extra;
  });
  const read = () =>
    f.signed.query(get, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      refreshKey: "seventh-owner",
    });
  expect(
    (await read()).families.find(
      (x: { family: string }) => x.family === "generation",
    ).rows[0],
  ).toMatchObject({ moreReceipts: true, receiptCoverage: "bounded" });
  await f.t.run((ctx) => ctx.db.patch(extra, { currency: "EUR" }));
  await expect(read()).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
});

import { fixture as nativeResearchFixture } from "../../tests/research-fixture";
test("Research proves the seventh native-search cache and financial owner before financial overflow", async () => {
  const f = await nativeResearchFixture(["web-search"]),
    orderId = await f.start("health-seventh-native");
  const admitted = await f.t.mutation(internal.research.cache.begin, {
    orderId,
    generation: 1,
    operation: "web-search",
  });
  const extra = await f.t.run(async (ctx) => {
    const receipt = (await ctx.db.get(admitted.attemptId!))!;
    if (receipt.owner !== "native-search")
      throw Error("Expected native receipt");
    const { _id, _creationTime, ...row } = receipt;
    const {
      _id: cId,
      _creationTime: cTime,
      ...cache
    } = (await ctx.db.get(admitted.cacheId))!;
    let extra = receipt._id;
    for (let i = 1; i < 7; i++) {
      const cacheId = await ctx.db.insert("researchCaches", {
        ...cache,
        key: `health-cache-${i}`,
        attemptId: null,
      });
      extra = await ctx.db.insert("aiAttempts", {
        ...row,
        key: `health-header-${i}`,
        cacheId,
      });
      await ctx.db.patch(cacheId, { attemptId: extra });
    }
    return extra;
  });
  const read = async () =>
    (
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        refreshKey: "native-seventh",
      })
    ).families.find((x: { family: string }) => x.family === "research");
  expect((await read()).rows[0]).toMatchObject({
    moreReceipts: true,
    receiptCoverage: "bounded",
  });
  await f.t.run((ctx) => ctx.db.patch(extra, { currency: "EUR" }));
  expect(await read()).toMatchObject({
    rows: [],
    sampledRows: 0,
    moreEligibleRows: false,
  });
});

test("Research pipeline proves the extra generation header even when the six displayed headers are valid", async () => {
  const f = await modelFixture(),
    runId = await f.create(),
    executionKey = "pipeline-seventh";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    runId,
    generation: 1,
    executionKey,
    key: "header-0",
  });
  const profileId = await f.signed.mutation(api.research.profiles.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    config: researchConfig,
    commandKey: "pipeline-seventh-profile",
  });
  const orderId = await f.signed.mutation(api.research.runs.start, {
    workspaceId: f.workspaceId,
    profileId,
    expectedRevision: 1,
    operationKey: "pipeline-seventh-order",
  });
  const extra = await f.t.run(async (ctx) => {
    await ctx.db.patch(runId, {
      research: { orderId, generation: 1, sources: [] },
    });
    await ctx.db.patch(orderId, {
      pipeline: {
        kind: "research-workflow-v1",
        materialGeneration: 0,
        workflowId: null,
        step: 0,
        outcome: "pending",
        sourcePins: [],
        history: [],
        historyTruncated: false,
        clusterPins: [],
        clustersTruncated: false,
        duplicateGroups: [],
        runId,
        executionKey,
        proposalHash: null,
        pending: null,
        clusterIds: [],
        evidenceIds: [],
        inboxReady: false,
        retentionUntil: null,
        cleanupState: "retained",
        workflowCleaned: false,
        agentCleaned: false,
        usagePending: false,
        nextAt: null,
        handoff: "disabled",
      },
    });
    const receipt = (await ctx.db.get(attemptId))!;
    if (receipt.owner !== undefined && receipt.owner !== "generation")
      throw Error("Expected generation receipt");
    const { _id, _creationTime, ...row } = receipt;
    let extra = attemptId;
    for (let i = 1; i < 7; i++)
      extra = await ctx.db.insert("aiAttempts", { ...row, key: `header-${i}` });
    return extra;
  });
  const read = () =>
    f.signed.query(get, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      refreshKey: "pipeline-seventh",
    });
  const row = (await read()).families.find(
    (x: { family: string }) => x.family === "research",
  ).rows[0];
  expect(row).toMatchObject({ moreReceipts: true, receiptCoverage: "bounded" });
  expect(row.receipts).toHaveLength(6);
  await f.t.run((ctx) => ctx.db.patch(extra, { currency: "EUR" }));
  await expect(read()).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
});
