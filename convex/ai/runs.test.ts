import { describe, test, expect, afterEach, vi } from "vitest";
import { modelFixture } from "../../tests/model-fixture";
import { internal, components, api } from "../_generated/api";
afterEach(() => vi.unstubAllEnvs());
describe("funded model runs through official Agent", () => {
  test("exhausted A account budget cannot consume B; shared workspace budget still governs both", async () => {
    const f = await modelFixture();
    const b = await f.t.run(async (ctx) => {
      const { _id, _creationTime, ...account } = (await ctx.db.get(
        f.accountId,
      ))!;
      const id = await ctx.db.insert("socialAccounts", {
        ...account,
        providerIdentity: "second",
      });
      const budget = (await ctx.db
        .query("aiBudgets")
        .withIndex("by_key", (q) => q.eq("key", `account:${f.accountId}`))
        .unique())!;
      const { _id: bid, _creationTime: created, ...fields } = budget;
      await ctx.db.insert("aiBudgets", {
        ...fields,
        key: `account:${id}`,
        accountId: id,
      });
      await ctx.db.patch(bid, { spentMicros: budget.limitMicros });
      return id;
    });
    const aRun = await f.create();
    await f.t.mutation(internal.ai.runs.claim, {
      runId: aRun,
      executionKey: "a-budget",
    });
    await expect(
      f.t.mutation(internal.ai.runs.fund, {
        runId: aRun,
        generation: 1,
        executionKey: "a-budget",
        key: "a-attempt",
      }),
    ).rejects.toThrow("MODEL_BUDGET_EXHAUSTED");
    const createB = () =>
      f.t.mutation(internal.ai.runs.create, {
        workspaceId: f.workspaceId,
        accountId: b,
        actorId: f.userId,
        purpose: "draft",
        prompt: "B prompt",
        promptVersion: "fixture-v1",
        sources: [],
      });
    const runId = await createB();
    expect((await f.t.run((ctx) => ctx.db.get(runId)))!.accountId).toBe(b);
    const executionKey = "b-budget";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    const attemptId = await f.t.mutation(internal.ai.runs.fund, {
      runId,
      generation: 1,
      executionKey,
      key: "b-attempt",
    });
    const attempt = (await f.t.run((ctx) => ctx.db.get(attemptId)))!;
    expect(
      (await f.t.run((ctx) => ctx.db.get(attempt.budgetIds[2])))!.accountId,
    ).toBe(b);
    await f.t.run(async (ctx) => {
      const budget = (await ctx.db
        .query("aiBudgets")
        .withIndex("by_key", (q) => q.eq("key", `workspace:${f.workspaceId}`))
        .unique())!;
      await ctx.db.patch(budget._id, { spentMicros: budget.limitMicros });
    });
    const shared = await createB();
    await f.t.mutation(internal.ai.runs.claim, { runId: shared, executionKey });
    await expect(
      f.t.mutation(internal.ai.runs.fund, {
        runId: shared,
        generation: 1,
        executionKey,
        key: "shared-attempt",
      }),
    ).rejects.toThrow("MODEL_BUDGET_EXHAUSTED");
  });
  test("large valid token receipts preserve the exact rounded micro-unit estimate", async () => {
    const f = await modelFixture();
    await f.t.run(async (ctx) => {
      const p = (await ctx.db.query("aiPolicies").first())!;
      await ctx.db.patch(p._id, { inputMicrosPerMillion: 100000001 });
      for (const b of await ctx.db.query("aiBudgets").collect())
        await ctx.db.patch(b._id, { limitMicros: 1e12 });
    });
    const runId = await f.create(),
      executionKey = "exact-estimate";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    const attemptId = await f.t.mutation(internal.ai.runs.fund, {
      runId,
      generation: 1,
      executionKey,
      key: "exact-attempt",
    });
    await f.t.mutation(internal.ai.runs.settle, {
      attemptId,
      inputTokens: 100000001,
      outputTokens: 0,
      errorCode: null,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(attemptId)))!.estimatedMicros,
    ).toBe(10000000201);
  });
  test("saves one official prompt and refuses a third concurrent reservation", async () => {
    const f = await modelFixture(),
      runId = await f.create();
    const run = await f.t.run((ctx) => ctx.db.get(runId));
    const messages = await f.t.query(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: run!.threadId,
        order: "desc",
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    expect(messages.page).toHaveLength(1);
    const executionKey = "execution-one",
      secondRun = await f.create(),
      thirdRun = await f.create();
    for (const id of [runId, secondRun, thirdRun])
      await f.t.mutation(internal.ai.runs.claim, { runId: id, executionKey });
    const fund = (id: typeof runId, key: string) =>
      f.t.mutation(internal.ai.runs.fund, {
        runId: id,
        generation: 1,
        executionKey,
        key,
      });
    await Promise.all([fund(runId, "attempt-a"), fund(secondRun, "attempt-b")]);
    await expect(fund(thirdRun, "attempt-c")).rejects.toThrow(
      "MODEL_BUDGET_EXHAUSTED",
    );
    await expect(fund(runId, "attempt-a")).rejects.toThrow(
      "MODEL_ATTEMPT_ALREADY_ADMITTED",
    );
  });
  test("duplicate receipt settles once, unknown retains holds, later known usage settles after stop", async () => {
    const f = await modelFixture(),
      runId = await f.create(),
      executionKey = "settlement";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    const attemptId = await f.t.mutation(internal.ai.runs.fund, {
      runId,
      generation: 1,
      executionKey,
      key: "one",
    });
    const settle = (inputTokens: number | null, outputTokens: number | null) =>
      f.t.mutation(internal.ai.runs.settle, {
        attemptId,
        inputTokens,
        outputTokens,
        errorCode: null,
      });
    await settle(null, null);
    expect((await f.t.run((ctx) => ctx.db.get(attemptId)))!.state).toBe(
      "unknown",
    );
    await f.signed.mutation(
      (await import("../_generated/api")).api.ai.runs.stop,
      { workspaceId: f.workspaceId, runId },
    );
    await f.t.run(async (ctx) => {
      for (const b of await ctx.db.query("aiBudgets").collect())
        await ctx.db.patch(b._id, {
          expiresAt: 0,
          purposes: [],
          approvedBy: undefined,
          policyVersion: "withdrawn",
          limitMicros: 0,
        });
    });
    await Promise.all([settle(10, 20), settle(10, 20)]);
    const attempt = (await f.t.run((ctx) => ctx.db.get(attemptId)))!;
    expect(attempt.state).toBe("settled");
    for (const id of attempt.budgetIds)
      expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
        heldMicros: 0,
        spentMicros: 30,
      });
    await expect(settle(11, 20)).rejects.toThrow("MODEL_RECEIPT_CONFLICT");
    expect((await f.t.run((ctx) => ctx.db.get(runId)))!.state).toBe("stopped");
  });
  test("actual overage is recorded in every scope and blocks further work instead of hiding costs", async () => {
    const f = await modelFixture(),
      runId = await f.create(),
      executionKey = "overage";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    const attemptId = await f.t.mutation(internal.ai.runs.fund, {
      runId,
      generation: 1,
      executionKey,
      key: "overage-one",
    });
    await f.t.mutation(internal.ai.runs.settle, {
      attemptId,
      inputTokens: 9000,
      outputTokens: 500,
      errorCode: null,
    });
    const attempt = (await f.t.run((ctx) => ctx.db.get(attemptId)))!;
    expect(attempt.estimatedMicros).toBe(9500);
    expect(attempt.billedMicros).toBeNull();
    for (const id of attempt.budgetIds)
      expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
        heldMicros: 0,
        spentMicros: 9500,
      });
    await expect(
      f.t.mutation(internal.ai.runs.fund, {
        runId,
        generation: 1,
        executionKey,
        key: "second",
      }),
    ).rejects.toThrow("MODEL_RUN_INACTIVE");
  });
  test("unknown-currency overage expands held liability; duplicated late cost reholds only once", async () => {
    const f = await modelFixture(),
      runId = await f.create(),
      executionKey = "late-cost";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    const attemptId = await f.t.mutation(internal.ai.runs.fund, {
      runId,
      generation: 1,
      executionKey,
      key: "one",
    });
    const settle = (reportedCost?: number) =>
      f.t.mutation(internal.ai.runs.settle, {
        attemptId,
        inputTokens: 10,
        outputTokens: 20,
        errorCode: null,
        ...(reportedCost !== undefined ? { reportedCost } : {}),
      });
    await settle();
    await Promise.all([settle(0.12), settle(0.12)]);
    const receipt = (await f.t.run((ctx) => ctx.db.get(attemptId)))!;
    expect(receipt.state).toBe("unknown");
    if (
      receipt.owner === "jev-analyzer" ||
      receipt.owner === "own-content-embedding"
    )
      throw new Error("Unexpected Jev receipt");
    expect(receipt.reportedCost).toBe(0.12);
    for (const id of receipt.budgetIds)
      expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
        heldMicros: 8100,
        spentMicros: 30,
      });
    await expect(
      f.t.mutation(internal.ai.runs.fund, {
        runId,
        generation: 1,
        executionKey,
        key: "later",
      }),
    ).rejects.toThrow("MODEL_PREVIOUS_ATTEMPT_UNRESOLVED");
  });
  test("foreign account, role revocation, lifecycle and expired grants block admission", async () => {
    const f = await modelFixture(),
      runId = await f.create(),
      executionKey = "authority";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    await f.t.run(async (ctx) => {
      const member = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
        )
        .unique();
      await ctx.db.patch(member!._id, { role: "Viewer" });
    });
    await expect(
      f.t.mutation(internal.ai.runs.fund, {
        runId,
        generation: 1,
        executionKey,
        key: "role",
      }),
    ).rejects.toThrow("ROLE_ACCESS_DENIED");
    await f.t.run((ctx) =>
      ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
    );
    await expect(
      f.t.mutation(internal.ai.runs.fund, {
        runId,
        generation: 1,
        executionKey,
        key: "lifecycle",
      }),
    ).rejects.toThrow("WORKSPACE_INACTIVE");
  });
  test("same-version operator model/config edits cannot silently retarget a funded run", async () => {
    const f = await modelFixture(),
      runId = await f.create(),
      executionKey = "config";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    await f.t.run(async (ctx) => {
      const p = await ctx.db
        .query("aiPolicies")
        .withIndex("by_key", (q) => q.eq("key", "requesty-generation"))
        .unique();
      await ctx.db.patch(p!._id, { model: "different/model" });
    });
    await expect(
      f.t.mutation(internal.ai.runs.fund, {
        runId,
        generation: 1,
        executionKey,
        key: "one",
      }),
    ).rejects.toThrow("MODEL_POLICY_CHANGED");
  });
  test("own workspace receipts cannot expose raw threads, prompts or global spend; foreign account and scope are rejected", async () => {
    const f = await modelFixture(),
      runId = await f.create();
    const foreign = await f.signed.mutation(api.workspaces.create, {
      name: "Other workspace",
      description: "",
    });
    const otherAccount = await f.t.run(async (ctx) => {
      const own = (await ctx.db.get(f.accountId))!;
      const { _id, _creationTime, ...fields } = own;
      return ctx.db.insert("socialAccounts", {
        ...fields,
        workspaceId: foreign,
      });
    });
    await expect(
      f.t.mutation(internal.ai.runs.create, {
        workspaceId: f.workspaceId,
        accountId: otherAccount,
        actorId: f.userId,
        purpose: "draft",
        prompt: "Synthetic",
        promptVersion: "v1",
        sources: [],
      }),
    ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
    await expect(
      f.signed.mutation(api.ai.runs.stop, { workspaceId: foreign, runId }),
    ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
    const own = await f.signed.query(api.ai.runs.recent, {
      workspaceId: f.workspaceId,
    });
    expect(own).toHaveLength(1);
    expect(
      await f.signed.query(api.ai.runs.recent, { workspaceId: foreign }),
    ).toEqual([]);
    const receipt = JSON.stringify(own);
    for (const key of [
      "threadId",
      "promptMessageId",
      "budgetIds",
      "actorId",
      "Synthetic prompt",
      "provider",
      "spentMicros",
    ])
      expect(receipt).not.toContain(key);
  });
  test("unknown-currency usage beyond reservation is retained with expanded hold and an overrun barrier", async () => {
    const f = await modelFixture(),
      runId = await f.create(),
      executionKey = "unpriced-overrun";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    const attemptId = await f.t.mutation(internal.ai.runs.fund, {
      runId,
      generation: 1,
      executionKey,
      key: "one",
    });
    await f.t.mutation(internal.ai.runs.settle, {
      attemptId,
      inputTokens: 9000,
      outputTokens: 500,
      reportedCost: 0.12,
      errorCode: null,
    });
    const receipt = (await f.t.run((ctx) => ctx.db.get(attemptId)))!;
    expect(receipt).toMatchObject({
      state: "unknown",
      heldMicros: 9500,
      estimatedMicros: 9500,
      reportedCost: 0.12,
    });
    for (const id of receipt.budgetIds)
      expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
        heldMicros: 9500,
        spentMicros: 0,
      });
    expect((await f.t.run((ctx) => ctx.db.get(runId)))!.errorCode).toBe(
      "MODEL_BUDGET_OVERRUN",
    );
  });
  test("expired grant is checked again before each actual paid attempt", async () => {
    const f = await modelFixture(),
      runId = await f.create(),
      executionKey = "expiry";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    await f.t.run(async (ctx) => {
      const r = (await ctx.db.get(runId))!;
      await ctx.db.patch(r.budgetIds[2], { expiresAt: Date.now() - 1 });
    });
    await expect(
      f.t.mutation(internal.ai.runs.fund, {
        runId,
        generation: 1,
        executionKey,
        key: "one",
      }),
    ).rejects.toThrow("MODEL_BUDGET_GRANT_EXPIRED");
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("aiAttempts")
          .withIndex("by_runId_and_key", (q) => q.eq("runId", runId))
          .take(10),
      ),
    ).toEqual([]);
  });
});

test.each([
  "workspace",
  "provider-grant",
  "workspace-grant",
  "account-grant",
  "budget-alias",
  "run-alias",
  "currency",
] as const)(
  "generation receipt %s corruption is rejected before projections, duplicate and terminal shortcuts",
  async (corruption) => {
    const f = await modelFixture(),
      runId = await f.create(),
      executionKey = "owner-guard";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    const args = { runId, generation: 1, executionKey, key: "owner-receipt" };
    const attemptId = await f.t.mutation(internal.ai.runs.fund, args);
    await f.t.mutation(internal.ai.runs.settle, {
      attemptId,
      inputTokens: 10,
      outputTokens: 20,
      errorCode: null,
    });
    const foreign = await f.signed.mutation(api.workspaces.create, {
      name: "Foreign receipt",
      description: "",
    });
    await f.t.run(async (ctx) => {
      const attempt = (await ctx.db.get(attemptId))!;
      if (corruption === "workspace")
        await ctx.db.patch(attemptId, { workspaceId: foreign });
      if (corruption === "currency")
        await ctx.db.patch(attempt.budgetIds[2], { currency: "EUR" });
      if (corruption === "provider-grant")
        await ctx.db.patch(attempt.budgetIds[0], { workspaceId: foreign });
      if (corruption === "workspace-grant")
        await ctx.db.patch(attempt.budgetIds[1], { workspaceId: foreign });
      if (corruption === "account-grant") {
        const budget = await ctx.db.get(attempt.budgetIds[2]);
        const { _id, _creationTime, ...account } = (await ctx.db.get(
          f.accountId,
        ))!;
        const otherAccount = await ctx.db.insert("socialAccounts", account);
        await ctx.db.patch(budget!._id, { accountId: otherAccount });
      }
      if (corruption === "budget-alias") {
        const { _id, _creationTime, ...budget } = (await ctx.db.get(
          attempt.budgetIds[2],
        ))!;
        const otherBudget = await ctx.db.insert("aiBudgets", budget);
        await ctx.db.patch(attemptId, {
          budgetIds: [...attempt.budgetIds.slice(0, 2), otherBudget],
        });
      }
      if (corruption === "run-alias") {
        const { _id, _creationTime, ...r } = (await ctx.db.get(runId))!;
        const otherRun = await ctx.db.insert("agentRuns", {
          ...r,
          budgetIds: [],
        });
        await ctx.db.patch(attemptId, { runId: otherRun });
      }
    });
    await expect(
      f.signed.query(api.ai.runs.recent, { workspaceId: f.workspaceId }),
    ).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
    await expect(
      f.t.mutation(internal.ai.runs.settle, {
        attemptId,
        inputTokens: 10,
        outputTokens: 20,
        errorCode: null,
      }),
    ).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
    if (corruption === "workspace" || corruption === "budget-alias") {
      await expect(f.t.mutation(internal.ai.runs.fund, args)).rejects.toThrow(
        "MODEL_ATTEMPT_OWNER_INVALID",
      );
      await f.t.run((ctx) => ctx.db.patch(attemptId, { state: "unknown" }));
      await expect(
        f.t.mutation(internal.ai.runs.fund, { ...args, key: "different-key" }),
      ).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
    }
  },
);

test("unknown generation currency corruption retains all original holds", async () => {
  const f = await modelFixture(),
    runId = await f.create(),
    executionKey = "late-currency";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    runId,
    generation: 1,
    executionKey,
    key: "currency-hold",
  });
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: null,
    outputTokens: null,
    errorCode: null,
  });
  const receipt = (await f.t.run((ctx) => ctx.db.get(attemptId)))!;
  await f.t.run((ctx) =>
    ctx.db.patch(receipt.budgetIds[2], { currency: "EUR" }),
  );
  await expect(
    f.t.mutation(internal.ai.runs.settle, {
      attemptId,
      inputTokens: 10,
      outputTokens: 20,
      errorCode: null,
    }),
  ).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    state: "unknown",
    heldMicros: receipt.heldMicros,
  });
  for (const id of receipt.budgetIds)
    expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
      heldMicros: receipt.heldMicros,
      spentMicros: 0,
    });
});
