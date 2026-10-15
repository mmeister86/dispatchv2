import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  makeFunctionReference,
  type ApiFromModules,
  type FunctionArgs,
  type FunctionReturnType,
} from "convex/server";
import type { page as financePage } from "./exportFinance";
import { modelFixture } from "../../tests/model-fixture";
import { jevFixture } from "../../tests/jev-fixture";
import {
  publishingFixture,
  historyFixture,
} from "../../tests/performance-export-fixture";
import { internal } from "../_generated/api";
type Ref = ApiFromModules<{
  module: { page: typeof financePage };
}>["module"]["page"];
const page = makeFunctionReference<
  "query",
  FunctionArgs<Ref>,
  FunctionReturnType<Ref>
>("operations/exportFinance:page");
beforeEach(() => vi.stubEnv("R2_MEDIA_BUCKET", "finance-tests"));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function args(
  f: Pick<
    Awaited<ReturnType<typeof modelFixture>>,
    "signed" | "t" | "userId" | "workspaceId" | "accountId"
  >,
) {
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity()),
    u = await f.t.run((ctx) => ctx.db.get(f.userId));
  return {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    expectedAuthId: u!.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "finance",
    cursor: null,
    creationUpperBound: null,
  };
}
test("native generation receipt preserves uncertainty/overage and legacy original money after source cleanup", async () => {
  const f = await modelFixture(),
    a = await args(f),
    runId = await f.create();
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "finance",
  });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    runId,
    generation: 1,
    executionKey: "finance",
    key: "secret-key",
  });
  const pending = await f.signed.query(page, {
    ...a,
    family: "runUsage",
    runId,
  });
  const row = pending.data.selection.rows[0];
  expect("estimatedMicros" in row && row.estimatedMicros).toBe(null);
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: 100000,
    outputTokens: 0,
    errorCode: null,
  });
  await f.t.run((ctx) =>
    ctx.db.patch(runId, { sourceUntil: 0, sourceCleanupState: "complete" }),
  );
  const r = await f.signed.query(page, { ...a, family: "runUsage", runId });
  const cost = r.data.selection.rows[0];
  expect("estimatedMicros" in cost && cost.estimatedMicros).toBe(100000);
  expect(JSON.stringify(r)).not.toMatch(
    /secret-key|budgetIds|Fingerprint|threadId|promptMessageId|sources|errorCode/,
  );
  await f.t.run((ctx) => ctx.db.patch(attemptId, { owner: undefined }));
  const legacy = await f.signed.query(page, {
    ...a,
    family: "runUsage",
    runId,
  });
  expect(legacy.data.selection.rows[0]).not.toHaveProperty("owner");
});
test("native run discovery continues with stable bound and rejects account/session/foreign actor", async () => {
  const f = await modelFixture(),
    a = await args(f);
  const firstRun = await f.create();
  await f.create();
  const first = await f.signed.query(page, { ...a, family: "ownFinanceRuns" });
  expect(first.data.selection.rows).toHaveLength(1);
  const second = await f.signed.query(page, {
    ...a,
    family: "ownFinanceRuns",
    cursor: first.cursor,
    creationUpperBound: first.creationUpperBound,
  });
  expect(second.data.selection.rows[0].id).not.toBe(
    first.data.selection.rows[0].id,
  );
  await expect(
    f.signed.query(page, {
      ...a,
      family: "ownFinanceRuns",
      expectedSessionId: "foreign",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  const other = await f.t.run((ctx) =>
    ctx.db.insert("users", {
      authId: "foreign",
      activeWorkspaceId: f.workspaceId,
      defaultWorkspaceId: f.workspaceId,
    }),
  );
  await f.t.run((ctx) => ctx.db.patch(firstRun, { actorId: other }));
  await expect(
    f.signed.query(page, {
      ...a,
      family: "runUsage",
      runId: first.data.selection.rows[0].id as Awaited<
        ReturnType<typeof f.create>
      >,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
});
test("native scoped budget preserves expired over-limit balances without provider grant", async () => {
  const f = await modelFixture(),
    a = await args(f);
  await f.t.run(async (ctx) => {
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `account:${f.accountId}`))
      .unique();
    await ctx.db.patch(b!._id, { expiresAt: 1, spentMicros: 999999 });
  });
  const r = await f.signed.query(page, {
    ...a,
    family: "usageBudgets",
    namespace: "generation",
    budgetScope: "account",
  });
  const b = r.data.selection.rows[0];
  expect("spentMicros" in b && b.spentMicros).toBe(999999);
  expect(JSON.stringify(r.data)).not.toMatch(/provider"|key|reservedMicros/);
});
test("native analyzer funding exports independent original finance", async () => {
  const f = await jevFixture(true),
    a = await args({ ...f, accountId: f.request.accountId });
  const context = await f.t.query(internal.ai.jev.access.context, f.request);
  await f.t.mutation(internal.ai.jev.access.fund, {
    ...f.request,
    expectedFingerprint: context.requestFingerprint,
  });
  const own = await f.signed.query(page, {
    ...a,
    family: "ownFinanceReceipts",
  });
  expect(own.data.selection.rows).toHaveLength(1);
  expect(JSON.stringify(own)).not.toMatch(
    /requestFingerprint|budgetIds|credential|answers|intent/,
  );
});
test("native metrics funding survives source withdrawal without text authority", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const snapshot = await f.t.run((ctx) =>
    ctx.db.query("performanceSnapshots").first(),
  );
  vi.setSystemTime(snapshot!.dueAt);
  await f.t.mutation(internal.performance.snapshots.begin, {
    snapshotId: snapshot!._id,
    generation: snapshot!.generation,
    credentialGeneration: 1,
  });
  const a = await args(f),
    r = await f.signed.query(page, { ...a, family: "metricsUsage" });
  expect(r.data.selection.rows).toHaveLength(1);
  await f.t.run(async (ctx) => {
    const c = await ctx.db.query("performanceControls").first();
    await ctx.db.patch(c!._id, { enabled: false, deleted: true });
  });
  expect(
    (await f.signed.query(page, { ...a, family: "metricsUsage" })).data
      .selection.rows,
  ).toHaveLength(1);
});
test("native settled historical page remains exportable after the job advances", async () => {
  const f = await historyFixture(),
    jobId = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [],
            meta: { result_count: 0, next_token: "nextpage" },
          }),
        ),
    ),
  );
  const job = await f.t.run((ctx) => ctx.db.get(jobId));
  await f.t.action(internal.performance.backfill.read, {
    jobId,
    generation: job!.generation,
  });
  vi.advanceTimersByTime(1);
  const a = await args(f),
    r = await f.signed.query(page, { ...a, family: "historyUsage" });
  expect(r.data.selection.rows).toHaveLength(1);
  const t = r.data.selection.rows[0];
  expect("resourceCount" in t && t.resourceCount).toBe(0);
  expect("estimatedMicros" in t && t.estimatedMicros).toBe(0);
});
