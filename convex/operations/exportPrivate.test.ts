import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  makeFunctionReference,
  internalMutationGeneric,
  componentsGeneric,
  type FunctionReference,
} from "convex/server";
import { v } from "convex/values";
import workflowTest from "@convex-dev/workflow/test";
import { api, components, internal } from "../_generated/api";
import { modelFixture } from "../../tests/model-fixture";
import { materialHash } from "../research/evidence";
import { pipelineFixture, streamResponse } from "../../tests/research-fixture";
const endpoint = (name: string) =>
  makeFunctionReference<"query">(`operations/exportPrivate:${name}`);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function request(
  f:
    | Awaited<ReturnType<typeof modelFixture>>
    | Awaited<ReturnType<typeof pipelineFixture>>,
) {
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  return {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "private-archive",
  };
}
async function chat(allowIdeaCreation = false) {
  const f = await modelFixture();
  await f.t.run(async (ctx) => {
    for (const p of await ctx.db.query("aiPolicies").collect())
      await ctx.db.patch(p._id, { purposes: ["draft", "chat"] });
    for (const p of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(p._id, { purposes: ["draft", "chat"] });
  });
  const scope = { workspaceId: f.workspaceId, accountId: f.accountId };
  const conversationId = await f.signed.mutation(api.ai.conversations.create, {
    ...scope,
    operationKey: "archive-chat",
  });
  const runId = await f.signed.mutation(api.ai.conversations.send, {
    ...scope,
    conversationId,
    operationKey: "archive-send",
    prompt: "Own human text",
    allowIdeaCreation,
  });
  const c = (await f.t.run((ctx) => ctx.db.get(conversationId)))!;
  vi.setSystemTime(Date.now() + 1000);
  return { ...f, conversationId, runId, c, args: await request(f) };
}
test("own conversation and actual native message pages are read-only and explicitly projected", async () => {
  const f = await chat();
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const root = await f.signed.query(endpoint("conversations"), {
    ...f.args,
    accountId: f.accountId,
    cursor: null,
    selectionUpperBound: null,
  });
  expect(root.data.selection.rows[0]).toMatchObject({
    conversationId: f.conversationId,
    title: f.c.title,
  });
  const args = {
    ...f.args,
    accountId: f.accountId,
    conversationId: f.conversationId,
    cursor: null,
  };
  const { value, metrics } = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(endpoint("conversationMessages"), args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(value.data.selection.rows[0]).toMatchObject({
    role: "user",
    text: "Own human text",
  });
  expect(JSON.stringify(value.data)).not.toMatch(
    /threadId|promptMessageId|requestKey|sessionId|operationKey/,
  );
  expect(metrics.documentsWritten.used).toBe(0);
  expect(metrics.functionsScheduled.used).toBe(0);
  expect(physical).not.toHaveBeenCalled();
});
test("all four roles retain own roots; mismatched session and actor fail", async () => {
  const f = await chat();
  const args = {
    ...f.args,
    accountId: f.accountId,
    cursor: null,
    selectionUpperBound: null,
  };
  for (const role of ["Owner", "Admin", "Editor", "Viewer"] as const) {
    await f.t.run(async (ctx) =>
      ctx.db.patch((await ctx.db.query("memberships").first())!._id, { role }),
    );
    expect(
      (await f.signed.query(endpoint("conversations"), args)).data.selection
        .rows,
    ).toHaveLength(1);
  }
  await expect(
    f.signed.query(endpoint("conversations"), {
      ...args,
      expectedSessionId: "obsolete",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  await f.t.run(async (ctx) => {
    const u = (await ctx.db.get(f.userId))!;
    const { _id, _creationTime, ...fields } = u;
    const actorId = await ctx.db.insert("users", {
      ...fields,
      authId: "other",
    });
    await ctx.db.patch(f.conversationId, { actorId });
  });
  for (const role of ["Owner", "Admin", "Editor", "Viewer"] as const) {
    await f.t.run(async (ctx) =>
      ctx.db.patch((await ctx.db.query("memberships").first())!._id, { role }),
    );
    await expect(
      f.signed.query(endpoint("conversationMessages"), {
        ...f.args,
        accountId: f.accountId,
        conversationId: f.conversationId,
        cursor: null,
      }),
    ).rejects.toThrow();
  }
});
test("native operations and exact retained run metadata have independent bounded pages", async () => {
  const f = await chat();
  const r = await f.signed.query(endpoint("conversationOperations"), {
    ...f.args,
    accountId: f.accountId,
    conversationId: f.conversationId,
    cursor: null,
    selectionUpperBound: null,
  });
  expect(r.data.selection.rows).toHaveLength(1);
  const p = await f.signed.query(endpoint("conversationRuns"), {
    ...f.args,
    accountId: f.accountId,
    conversationId: f.conversationId,
    operationId: r.data.selection.rows[0].operationId,
    offset: 0,
  });
  expect(p.data.selection.rows[0]).toMatchObject({
    runId: f.runId,
    purpose: "chat",
  });
  expect(JSON.stringify(p.data)).not.toMatch(
    /executionKey|promptMessageId|budgetId|fingerprint/,
  );
});
test("completed native empty research exposes public order and actual Workflow journal pages", async () => {
  vi.useFakeTimers();
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse([]));
  const orderId = await f.start();
  await f.t.finishAllScheduledFunctions(
    () => vi.advanceTimersByTime(100),
    1000,
  );
  const args = await request(f);
  const r = await f.signed.query(endpoint("publicOrders"), {
    ...args,
    profileId: f.profileId,
    cursor: null,
    selectionUpperBound: null,
  });
  expect(r.data.selection.rows[0]).toMatchObject({
    orderId,
    state: "completed",
  });
  vi.mocked(fetch).mockClear();
  const { a, metrics } = await f.signed.run(async (ctx) => ({
    a: await ctx.runQuery(endpoint("workflowSteps"), {
      ...args,
      orderId,
      cursor: null,
    }),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(metrics.documentsWritten.used).toBe(0);
  expect(metrics.functionsScheduled.used).toBe(0);
  expect(metrics.documentsRead.used).toBeLessThan(150);
  expect(fetch).not.toHaveBeenCalled();
  expect(a.data.selection.rows[0]).toMatchObject({
    orderId,
    stage: "reserve",
    kind: "function",
  });
  const b = await f.signed.query(endpoint("workflowSteps"), {
    ...args,
    orderId,
    cursor: a.cursor,
  });
  expect(b.data.selection.rows[0]).toMatchObject({ stage: "prepare" });
  expect(JSON.stringify([a.data, b.data])).not.toMatch(
    /workflowId|stepId|workId|args|runResult|handle|executionKey/,
  );
});
async function researchMaterial() {
  const f = await pipelineFixture();
  const args = await request(f);
  const conversationId = await f.signed.mutation(api.ai.conversations.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    operationKey: "research-chat",
  });
  const orderId = await f.signed.mutation(api.ai.conversations.research, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    conversationId,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "research-order",
    topic: "Own topic",
    language: "de",
    operations: ["web-search"],
  });
  const control = { orderId, generation: 1 };
  await f.t.mutation(internal.ai.researchTools.reserve, control);
  await f.t.mutation(internal.ai.researchTools.prepare, control);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  await f.t.action(internal.research.execute.operation, {
    ...control,
    operation: "web-search",
  });
  await f.t.mutation(internal.ai.researchTools.select, control);
  const runId = await f.t.mutation(
    internal.ai.researchTools.bindModel,
    control,
  );
  const run = (await f.t.run((ctx) => ctx.db.get(runId!)))!;
  await f.t.mutation(components.agent.messages.addMessages, {
    threadId: run.threadId!,
    userId: f.userId,
    messages: [
      { message: { role: "assistant", content: "Retained assistant result" } },
    ],
  });
  const source = (await f.t.run((ctx) =>
    ctx.db.query("researchSources").first(),
  ))!;
  const note = {
    claim: "Claim",
    consequentialOrContested: false,
    eventBased: false,
    quote: null,
    interpretation: "Interpretation",
    gaps: [],
    relevance: "Relevance",
    novelty: "Novelty",
    uncertainty: "Uncertainty",
    freshness: "unknown" as const,
    validityReason: "Needs review",
  };
  const evidenceId = await f.signed.mutation(api.research.evidence.create, {
    workspaceId: f.workspaceId,
    orderId,
    sourceId: source._id,
    commandKey: "evidence",
    expectedMaterialHash: await materialHash(source),
    annotation: note,
  });
  return {
    ...f,
    args,
    conversationId,
    orderId,
    runId: runId!,
    source,
    evidenceId,
    note,
  };
}

test("native targeted source, manual evidence and retained Agent research pages use original delivery", async () => {
  const f = await researchMaterial();
  const { args, conversationId, orderId, source, evidenceId, note } = f;
  const orders = await f.signed.query(endpoint("targetedOrders"), {
    ...args,
    accountId: f.accountId,
    conversationId,
    cursor: null,
    selectionUpperBound: null,
  });
  expect(orders.data.selection.rows[0]).toMatchObject({
    orderId,
    topic: "Own topic",
  });
  const sources = await f.signed.query(endpoint("orderSources"), {
    ...args,
    orderId,
    operation: "web-search",
    offset: 0,
  });
  expect(sources.data.selection.rows[0]).toMatchObject({
    sourceId: source._id,
    title: source.title,
  });
  const evidence = await f.signed.query(endpoint("orderEvidence"), {
    ...args,
    orderId,
    cursor: null,
  });
  expect(evidence.data.selection.rows[0]).toMatchObject({
    evidenceId,
    annotation: note,
  });
  let cursor: string | null = null,
    text = "";
  for (let i = 0; i < 4; i++) {
    const p: { data: unknown; isDone: boolean; cursor: string } =
      await f.signed.query(endpoint("researchMessages"), {
        ...args,
        orderId,
        cursor,
      });
    text += JSON.stringify(p.data);
    if (p.isDone) break;
    cursor = p.cursor;
  }
  expect(text).toContain("Retained assistant result");
  expect(text).not.toContain("research-workflow-v1");
});

test("actual Agent pagination passes fifty messages, keeps mixed failed text and excludes hidden payloads", async () => {
  const f = await chat();
  await f.t.mutation(components.agent.messages.addMessages, {
    threadId: f.c.threadId,
    userId: f.userId,
    messages: [
      ...Array.from({ length: 51 }, (_, i) => ({
        message: { role: "assistant" as const, content: `Retained ${i}` },
      })),
      {
        status: "failed",
        error: "SECRET_ERROR",
        provider: "SECRET_PROVIDER",
        reasoning: "SECRET_REASONING",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Failed mixed text" },
            {
              type: "tool-call",
              toolCallId: "secret-call",
              toolName: "secret-tool",
              args: { sentinel: "SECRET_TOOL" },
            },
          ],
        },
      },
      { message: { role: "system", content: "SECRET_SYSTEM" } },
    ],
  });
  let cursor: string | null = null,
    count = 0,
    all = "";
  for (let i = 0; i < 60; i++) {
    const { p, metrics } = await f.signed.run(async (ctx) => ({
      p: await ctx.runQuery(endpoint("conversationMessages"), {
        ...f.args,
        accountId: f.accountId,
        conversationId: f.conversationId,
        cursor,
      }),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    expect(metrics.documentsWritten.used).toBe(0);
    expect(metrics.functionsScheduled.used).toBe(0);
    expect(metrics.documentsRead.used).toBeLessThan(80);
    count += p.data.selection.rows.length;
    all += JSON.stringify(p.data);
    if (p.isDone) break;
    expect(p.cursor).not.toBe(cursor);
    cursor = p.cursor;
  }
  expect(count).toBe(53);
  expect(all).toContain("Failed mixed text");
  expect(all).not.toMatch(/SECRET_|secret-call|secret-tool/);
  await f.t.run((ctx) => ctx.db.patch(f.conversationId, { state: "deleting" }));
  await expect(
    f.signed.query(endpoint("conversationMessages"), {
      ...f.args,
      accountId: f.accountId,
      conversationId: f.conversationId,
      cursor,
    }),
  ).rejects.toThrow("CHAT_INACTIVE");
});
test("private wire rejects unsafe numbers, oversize UTF8 and native thread substitution", async () => {
  const f = await chat();
  const a = {
    ...f.args,
    accountId: f.accountId,
    conversationId: f.conversationId,
    cursor: null,
  };
  await f.t.run((ctx) => ctx.db.patch(f.conversationId, { revision: NaN }));
  await expect(
    f.signed.query(endpoint("conversationMessages"), a),
  ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
  await f.t.run((ctx) => ctx.db.patch(f.conversationId, { revision: -0 }));
  await expect(
    f.signed.query(endpoint("conversationMessages"), a),
  ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
  await f.t.run((ctx) =>
    ctx.db.patch(f.conversationId, { revision: 1, title: "🧭".repeat(17000) }),
  );
  await expect(
    f.signed.query(endpoint("conversations"), {
      ...f.args,
      accountId: f.accountId,
      cursor: null,
      selectionUpperBound: null,
    }),
  ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
  const other = await f.t.mutation(components.agent.threads.createThread, {
    userId: "foreign-actor",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.conversationId, { title: "Safe", threadId: other._id }),
  );
  await expect(
    f.signed.query(endpoint("conversationMessages"), a),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
});
test("immutable own discovery pages ignore unrelated actors and updatedAt changes", async () => {
  const f = await chat();
  const second = await f.signed.mutation(api.ai.conversations.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    operationKey: "second-conversation",
  });
  vi.setSystemTime(Date.now() + 1000);
  const args = {
    ...f.args,
    accountId: f.accountId,
    cursor: null,
    selectionUpperBound: null,
  };
  const first = await f.signed.query(endpoint("conversations"), args);
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...row } = (await ctx.db.get(
      f.conversationId,
    ))!;
    const {
      _id: uid,
      _creationTime: uc,
      ...user
    } = (await ctx.db.get(f.userId))!;
    const actorId = await ctx.db.insert("users", {
      ...user,
      authId: "other-actor",
    });
    for (let i = 0; i < 60; i++)
      await ctx.db.insert("conversations", {
        ...row,
        actorId,
        title: "SECRET_FOREIGN",
        operationKey: `foreign-${i}`,
      });
    await ctx.db.patch(f.conversationId, { updatedAt: Date.now() + 100000 });
  });
  const next = await f.signed.query(endpoint("conversations"), {
    ...args,
    cursor: first.cursor,
    selectionUpperBound: first.selectionUpperBound,
  });
  expect(next.data.selection.rows[0].conversationId).toBe(second);
  expect(JSON.stringify(next)).not.toContain("SECRET_FOREIGN");
});
test("source withdrawal, foreign research bindings and provider authority revoke later pages", async () => {
  const f = await researchMaterial();
  const a = {
    ...f.args,
    orderId: f.orderId,
    operation: "web-search",
    offset: 0,
  };
  const physical = vi.mocked(fetch);
  physical.mockClear();
  const { p, metrics } = await f.signed.run(async (ctx) => ({
    p: await ctx.runQuery(endpoint("orderSources"), a),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(p.data.selection.rows[0].sourceId).toBe(f.source._id);
  expect(metrics.documentsWritten.used).toBe(0);
  expect(metrics.functionsScheduled.used).toBe(0);
  expect(metrics.documentsRead.used).toBeLessThan(250);
  expect(physical).not.toHaveBeenCalled();
  await f.t.run((ctx) => ctx.db.patch(f.source._id, { status: "removed" }));
  await expect(f.signed.query(endpoint("orderSources"), a)).rejects.toThrow();
  await expect(
    f.signed.query(endpoint("researchMessages"), {
      ...f.args,
      orderId: f.orderId,
      cursor: null,
    }),
  ).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.patch(f.source._id, { status: "usable" }));
  const other = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...u } = (await ctx.db.get(f.userId))!;
    return ctx.db.insert("users", { ...u, authId: "foreign-research-owner" });
  });
  for (const role of ["Owner", "Admin"] as const) {
    await f.t.run(async (ctx) => {
      await ctx.db.patch((await ctx.db.query("memberships").first())!._id, {
        role,
      });
      await ctx.db.patch(f.orderId, { actorId: other });
    });
    await expect(f.signed.query(endpoint("orderSources"), a)).rejects.toThrow(
      "REFERENCE_ACCESS_DENIED",
    );
  }
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.orderId, { actorId: f.userId });
    await ctx.db.patch(f.runId, { actorId: other });
  });
  await expect(
    f.signed.query(endpoint("researchMessages"), {
      ...f.args,
      orderId: f.orderId,
      cursor: null,
    }),
  ).rejects.toThrow();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.runId, { actorId: f.userId });
    await ctx.db.patch(f.policies[0], { enabled: false });
  });
  await expect(
    f.signed.query(endpoint("orderEvidence"), {
      ...f.args,
      orderId: f.orderId,
      cursor: null,
    }),
  ).rejects.toThrow();
});
test("targeted native discovery reaches beyond five orders and excludes public/other private rows", async () => {
  const f = await researchMaterial();
  let previous = f.orderId;
  for (let i = 0; i < 6; i++) {
    await f.signed.mutation(api.research.runs.stop, {
      workspaceId: f.workspaceId,
      orderId: previous,
    });
    previous = await f.signed.mutation(api.ai.conversations.research, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      conversationId: f.conversationId,
      profileId: f.profileId,
      expectedRevision: 2,
      operationKey: `history-research-${i}`,
      topic: `Own historical topic ${i}`,
      language: "de",
      operations: ["web-search"],
    });
  }
  vi.setSystemTime(Date.now() + 1000);
  let cursor: string | null = null,
    selectionUpperBound: number | null = null,
    count = 0;
  for (let i = 0; i < 9; i++) {
    const p: {
      cursor: string;
      selectionUpperBound: number;
      isDone: boolean;
      data: { selection: { rows: unknown[] } };
    } = await f.signed.query(endpoint("targetedOrders"), {
      ...f.args,
      accountId: f.accountId,
      conversationId: f.conversationId,
      cursor,
      selectionUpperBound,
    });
    count += p.data.selection.rows.length;
    cursor = p.cursor;
    selectionUpperBound = p.selectionUpperBound;
    if (p.isDone) break;
  }
  expect(count).toBe(7);
});
test("real native journal rejects foreign original args and unknown stages before projection", async () => {
  const f = await pipelineFixture();
  f.t.registerComponent("workflow", workflowTest.schema, {
    ...workflowTest.modules,
    "./component/fixture.ts": async () => ({
      corrupt: internalMutationGeneric({
        args: { mode: v.string() },
        returns: v.null(),
        handler: async (ctx, a) => {
          const row = (await ctx.db.query("steps").first())!;
          await ctx.db.patch(row._id, {
            step: {
              ...row.step,
              ...(a.mode === "owner"
                ? { args: { ...row.step.args, orderId: "FOREIGN_ORDER" } }
                : { name: "foreign:SECRET_STAGE" }),
            },
          });
          return null;
        },
      }),
    }),
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse([]));
  const orderId = await f.start();
  await f.t.finishAllScheduledFunctions(
    () => vi.advanceTimersByTime(100),
    1000,
  );
  const args = { ...(await request(f)), orderId, cursor: null };
  expect(
    (await f.signed.query(endpoint("workflowSteps"), args)).data.selection.rows,
  ).toHaveLength(1);
  const corrupt = componentsGeneric().workflow.fixture
    .corrupt as FunctionReference<"mutation">;
  await f.t.mutation(corrupt, { mode: "owner" });
  await expect(f.signed.query(endpoint("workflowSteps"), args)).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
  await f.t.mutation(corrupt, { mode: "stage" });
  await expect(f.signed.query(endpoint("workflowSteps"), args)).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
});
test("retention-scrubbed order config is unavailable while broken profile bindings deny access", async () => {
  const f = await researchMaterial();
  const a = {
    ...f.args,
    accountId: f.accountId,
    conversationId: f.conversationId,
    cursor: null,
    selectionUpperBound: null,
  };
  await f.t.run(async (ctx) => {
    const o = (await ctx.db.get(f.orderId))!;
    await ctx.db.patch(o._id, {
      // retention.ts rewrites the order's config snapshot once operational.
      config: {
        ...o.config,
        topics: "",
        project: "",
        audience: "",
        languages: [],
        regions: [],
        preferredSources: [],
        exclusions: "",
        autoHandoff: false,
      },
    });
  });
  const page = await f.signed.query(endpoint("targetedOrders"), a);
  expect(page.data.selection.rows).toEqual([]);
  await f.t.run(async (ctx) => {
    const o = (await ctx.db.get(f.orderId))!;
    await ctx.db.delete(o.profileVersionId);
  });
  await expect(f.signed.query(endpoint("targetedOrders"), a)).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
});
test("chat result metadata proves the original native operation and both idea versions", async () => {
  const f = await chat(true);
  const executionKey = "archive-execution";
  await f.t.mutation(internal.ai.runs.claim, { runId: f.runId, executionKey });
  const ideaId = await f.t.mutation(internal.ai.conversations.createIdea, {
    runId: f.runId,
    generation: 1,
    executionKey,
    title: "Native result",
    perspective: "Perspective",
    rationale: "Rationale",
    questions: ["Question?"],
  });
  const args = {
    ...f.args,
    accountId: f.accountId,
    conversationId: f.conversationId,
    cursor: null,
    selectionUpperBound: null,
  };
  expect(
    (await f.signed.query(endpoint("conversationOperations"), args)).data
      .selection.rows[0].resultIdeaId,
  ).toBe(ideaId);
  await f.t.run((ctx) =>
    ctx.db.patch(ideaId, { operationKey: "foreign-original-operation" }),
  );
  await expect(
    f.signed.query(endpoint("conversationOperations"), args),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
});
test("source and evidence DTO horizons never outlive shorter original pipeline retention", async () => {
  const f = await researchMaterial(),
    until = Date.now() + 1500;
  await f.t.run(async (ctx) => {
    const o = (await ctx.db.get(f.orderId))!;
    await ctx.db.patch(o._id, {
      pipeline: { ...o.pipeline!, retentionUntil: until },
    });
  });
  const source = await f.signed.query(endpoint("orderSources"), {
    ...f.args,
    orderId: f.orderId,
    operation: "web-search",
    offset: 0,
  });
  const evidence = await f.signed.query(endpoint("orderEvidence"), {
    ...f.args,
    orderId: f.orderId,
    cursor: null,
  });
  expect(source.proofValidUntil).toBe(until);
  expect(evidence.proofValidUntil).toBe(until);
  expect(source.data.selection.rows[0].minusableUntil).toBe(until);
  expect(evidence.data.selection.rows[0].minretentionUntil).toBe(until);
});
test("discovery skips positively withdrawn roots and reaches the next eligible conversation", async () => {
  const f = await chat(true);
  await f.t.mutation(internal.ai.runs.claim, {
    runId: f.runId,
    executionKey: "archive-withdrawal",
  });
  const ideaId = await f.t.mutation(internal.ai.conversations.createIdea, {
    runId: f.runId,
    generation: 1,
    executionKey: "archive-withdrawal",
    title: "Source",
    perspective: "Perspective",
    rationale: "Rationale",
    questions: ["Question?"],
  });
  await f.t.run(async (ctx) => {
    const idea = (await ctx.db.get(ideaId))!;
    await ctx.db.patch(f.conversationId, {
      ideaVersionIds: [idea.currentVersionId!],
    });
    await ctx.db.patch(idea.currentVersionId!, { sourceUnavailable: true });
  });
  const nextId = await f.signed.mutation(api.ai.conversations.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    operationKey: "next-after-withdrawal",
  });
  vi.setSystemTime(Date.now() + 1000);
  const a = {
    ...f.args,
    accountId: f.accountId,
    cursor: null,
    selectionUpperBound: null,
  };
  const first = await f.signed.query(endpoint("conversations"), a);
  expect(first.data.selection.rows).toEqual([]);
  expect(first.isDone).toBe(false);
  const next = await f.signed.query(endpoint("conversations"), {
    ...a,
    cursor: first.cursor,
    selectionUpperBound: first.selectionUpperBound,
  });
  expect(next.data.selection.rows[0].conversationId).toBe(nextId);
  await expect(
    f.signed.query(endpoint("conversationMessages"), {
      ...f.args,
      accountId: f.accountId,
      conversationId: f.conversationId,
      cursor: null,
    }),
  ).rejects.toThrow();
});
test("discovery skips explicitly cleaned research while a direct parent read rejects", async () => {
  const f = await researchMaterial();
  await f.signed.mutation(api.research.runs.stop, {
    workspaceId: f.workspaceId,
    orderId: f.orderId,
  });
  const nextId = await f.signed.mutation(api.ai.conversations.research, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    conversationId: f.conversationId,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "next-after-cleanup",
    topic: "Next topic",
    language: "de",
    operations: ["web-search"],
  });
  await f.t.run(async (ctx) => {
    const o = (await ctx.db.get(f.orderId))!;
    await ctx.db.patch(o._id, {
      pipeline: { ...o.pipeline!, cleanupState: "complete" },
    });
  });
  const a = {
    ...f.args,
    accountId: f.accountId,
    conversationId: f.conversationId,
    cursor: null,
    selectionUpperBound: null,
  };
  const first = await f.signed.query(endpoint("targetedOrders"), a);
  expect(first.data.selection.rows).toEqual([]);
  const next = await f.signed.query(endpoint("targetedOrders"), {
    ...a,
    cursor: first.cursor,
    selectionUpperBound: first.selectionUpperBound,
  });
  expect(next.data.selection.rows[0].orderId).toBe(nextId);
  await expect(
    f.signed.query(endpoint("orderSources"), {
      ...f.args,
      orderId: f.orderId,
      operation: "web-search",
      offset: 0,
    }),
  ).rejects.toThrow();
});
test("discovery omits positively removed attached Research material and advances", async () => {
  const f = await researchMaterial();
  await f.t.run(async (ctx) => {
    const e = (await ctx.db.get(f.evidenceId))!;
    await ctx.db.patch(f.conversationId, {
      sources: [
        {
          kind: "research",
          accountId: f.accountId,
          evidenceId: e._id,
          evidenceFingerprint: e.fingerprint,
          orderId: f.orderId,
          sourceId: f.source._id,
          materialHash: e.materialHash,
          sourceGeneration: e.sourceGeneration,
          proofUntil: e.retentionUntil,
        },
      ],
    });
    await ctx.db.patch(f.source._id, { status: "removed" });
  });
  const nextId = await f.signed.mutation(api.ai.conversations.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    operationKey: "next-after-source",
  });
  vi.setSystemTime(Date.now() + 1000);
  const a = {
    ...f.args,
    accountId: f.accountId,
    cursor: null,
    selectionUpperBound: null,
  };
  const first = await f.signed.query(endpoint("conversations"), a);
  expect(first.data.selection.rows).toEqual([]);
  const next = await f.signed.query(endpoint("conversations"), {
    ...a,
    cursor: first.cursor,
    selectionUpperBound: first.selectionUpperBound,
  });
  expect(next.data.selection.rows[0].conversationId).toBe(nextId);
});
test("evidence exports retained perspective, provenance and actual human inbox decisions", async () => {
  const f = await researchMaterial();
  await f.signed.mutation(api.research.evidence.disposition, {
    workspaceId: f.workspaceId,
    evidenceId: f.evidenceId,
    expectedRevision: 0,
    commandKey: "archive-ignore",
    disposition: "ignored",
  });
  const e = (await f.t.run((ctx) => ctx.db.get(f.evidenceId)))!;
  const childId = await f.signed.mutation(api.research.evidence.review, {
    workspaceId: f.workspaceId,
    evidenceId: f.evidenceId,
    commandKey: "archive-review",
    maxAgeMs: 86400000,
    validUntil: Date.now() + 3600000,
    reason: "Retained human review",
    substantiveSupportAttested: false,
    eventAt: null,
    eventQuote: null,
  });
  const p = await f.signed.query(endpoint("orderEvidence"), {
    ...f.args,
    orderId: f.orderId,
    cursor: null,
  });
  expect(p.data.selection.rows[0]).toMatchObject({
    actorId: e.actorId,
    annotationActorId: e.annotationActorId,
    sourceId: f.source._id,
    observedAt: e.observedAt,
    sourceGeneration: e.sourceGeneration,
    perspective: e.payload!.perspective,
    inboxRevision: 1,
    inboxDisposition: "ignored",
    inboxActorId: f.userId,
  });
  expect(JSON.stringify(p.data)).not.toMatch(
    /inboxCommands|commandKey|fingerprint|outputHash/,
  );
  const child = await f.signed.query(endpoint("orderEvidence"), {
    ...f.args,
    orderId: f.orderId,
    cursor: p.cursor,
  });
  expect(child.data.selection.rows[0]).toMatchObject({
    evidenceId: childId,
    parentEvidenceId: f.evidenceId,
    perspective: e.payload!.perspective,
    assessment: { reason: "Retained human review", reviewerId: f.userId },
  });
});
test("native original order choices and re-research provenance are retained", async () => {
  const f = await researchMaterial();
  await f.signed.mutation(api.research.runs.stop, {
    workspaceId: f.workspaceId,
    orderId: f.orderId,
  });
  const childId = await f.signed.mutation(api.research.pipeline.reResearch, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    evidenceId: f.evidenceId,
    topic: "Follow the retained evidence",
    operationKey: "archive-reresearch",
    language: "de",
    operations: ["web-search"],
  });
  vi.setSystemTime(Date.now() + 1000);
  const p = await f.signed.query(endpoint("publicOrders"), {
    ...f.args,
    profileId: f.profileId,
    cursor: null,
    selectionUpperBound: null,
  });
  expect(p.data.selection.rows[0]).toMatchObject({
    orderId: childId,
    language: "de",
    operations: ["web-search"],
    outcomes: [{ operation: "web-search", state: "unknown", cacheHit: false }],
    reResearch: {
      topic: "Follow the retained evidence",
      parentEvidenceId: f.evidenceId,
      parentOrderId: f.orderId,
      parentSourceId: f.source._id,
    },
  });
});
async function automaticArchive() {
  const f = await pipelineFixture(20000, ["x-recent"]);
  const config = (await f.t.run(async (ctx) =>
    ctx.db.get((await ctx.db.get(f.profileId))!.currentVersionId!),
  ))!.config;
  const option = {
    kind: "bounded-editorial-v1" as const,
    count: 1,
    target: "draft" as const,
    intent: "Retained automatic draft",
  };
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "auto-option",
    action: {
      kind: "save",
      config: { ...config, frequency: "daily", autoHandoff: option },
    },
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    commandKey: "auto-activate",
    action: {
      kind: "activate-workflow",
      language: "de",
      operations: ["x-recent"],
    },
  });
  const profile = (await f.t.run((ctx) => ctx.db.get(f.profileId)))!;
  vi.setSystemTime(profile.nextAt!);
  let orderId: import("../_generated/dataModel").Id<"researchOrders">;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (!init?.body)
      return Response.json({
        data: [
          {
            id: "123456789",
            text: "Current public supported source",
            created_at: new Date(Date.now() - 60000).toISOString(),
          },
        ],
      });
    const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!,
      pin = o.pipeline!.sourcePins[0];
    const output = {
      items: [
        {
          title: "Source review",
          sourceId: pin.sourceId,
          materialHash: pin.materialHash,
          annotation: {
            claim: "Current public supported source",
            quote: "Current public supported source",
            consequentialOrContested: false,
            eventBased: false,
            interpretation: "Context",
            gaps: [],
            relevance: "Relevant",
            novelty: "Uncertain",
            uncertainty: "Review",
            freshness: "context-dependent",
            validityReason: "Review",
          },
          perspective: "Builders",
          dynamics: "Discussed",
          clusterId: null,
          clusterRevision: null,
          historyIds: [],
          copySourceIds: [],
          eventAt: null,
          eventQuote: null,
        },
      ],
    };
    return Response.json({
      id: "auto-semantic",
      object: "chat.completion",
      created: 1791210000,
      model: "synthetic/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ text: JSON.stringify(output) }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  });
  orderId = (await f.t.mutation(internal.research.pipeline.fire, {
    profileId: profile._id,
    generation: profile.scheduleGeneration,
    at: profile.nextAt!,
  }))!;
  for (let i = 0; i < 1000; i++) {
    await vi.advanceTimersByTimeAsync(100);
    await f.t.finishInProgressScheduledFunctions();
    if ((await f.t.run((ctx) => ctx.db.get(orderId)))!.state === "completed")
      break;
  }
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(o.state).toBe("completed");
  const evidenceId = await f.signed.mutation(api.research.evidence.review, {
    workspaceId: f.workspaceId,
    evidenceId: o.pipeline!.evidenceIds[0],
    commandKey: "auto-review",
    maxAgeMs: 86400000,
    validUntil: Date.now() + 300000,
    reason: "Support checked",
    substantiveSupportAttested: true,
    eventAt: null,
    eventQuote: null,
  });
  await f.t.mutation(internal.research.handoff.automatic, { orderId });
  return { ...f, orderId, evidenceId, option, args: await request(f) };
}
test("actual automatic handoff receipt and retained results export without resuming work", async () => {
  const f = await automaticArchive();
  const o = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!;
  expect(o.automaticHandoff?.state).toBe("completed");
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const { value, metrics } = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(endpoint("publicOrders"), {
      ...f.args,
      profileId: f.profileId,
      cursor: null,
      selectionUpperBound: null,
    }),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(value.data.selection.rows[0].automaticHandoff).toEqual({
    activationGeneration: o.automaticHandoff!.activationGeneration,
    profileVersionId: o.profileVersionId,
    option: f.option,
    state: "completed",
    selection: [f.evidenceId],
    results: o.automaticHandoff!.results,
  });
  expect(metrics.documentsWritten.used).toBe(0);
  expect(metrics.functionsScheduled.used).toBe(0);
  expect(physical).not.toHaveBeenCalled();
  const profile = (await f.t.run((ctx) => ctx.db.get(f.profileId)))!;
  const nextId = await f.signed.mutation(api.research.pipeline.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: profile.revision,
    operationKey: "after-unavailable-result",
    language: "de",
    operations: ["x-recent"],
  });
  vi.setSystemTime(Date.now() + 1000);
  await f.t.run((ctx) =>
    ctx.db.patch(o.automaticHandoff!.results![0].draftVersionId!, {
      sourceUnavailable: true,
    }),
  );
  const skipped = await f.signed.query(endpoint("publicOrders"), {
    ...f.args,
    profileId: f.profileId,
    cursor: null,
    selectionUpperBound: null,
  });
  expect(skipped.data.selection.rows).toEqual([]);
  const next = await f.signed.query(endpoint("publicOrders"), {
    ...f.args,
    profileId: f.profileId,
    cursor: skipped.cursor,
    selectionUpperBound: skipped.selectionUpperBound,
  });
  expect(next.data.selection.rows[0].orderId).toBe(nextId);
});

test("blocked native human Research retains its original config without provider authority", async () => {
  const f = await pipelineFixture();
  const orderId = await f.signed.mutation(api.research.runs.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "blocked-human",
  });
  await f.t.mutation(internal.research.runs.execute, {
    orderId,
    generation: 1,
  });
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(o.state).toBe("blocked");
  expect(o.native).toBeUndefined();
  await f.t.run(async (ctx) => {
    for (const p of await ctx.db.query("researchSourcePolicies").collect())
      await ctx.db.patch(p._id, { enabled: false });
  });
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const page = await f.signed.query(endpoint("publicOrders"), {
    ...(await request(f)),
    profileId: f.profileId,
    cursor: null,
    selectionUpperBound: null,
  });
  expect(page.data.selection.rows[0]).toMatchObject({
    orderId,
    state: "blocked",
    config: o.config,
  });
  expect(physical).not.toHaveBeenCalled();
});
test.each([
  "archived",
  "original-unavailable",
  "current-unavailable",
  "original-expired",
  "current-expired",
])(
  "operation discovery advances past exact %s results while direct reads reject",
  async (loss) => {
    const f = await chat(true),
      executionKey = "archive-operation";
    await f.t.mutation(internal.ai.runs.claim, {
      runId: f.runId,
      executionKey,
    });
    const ideaId = await f.t.mutation(internal.ai.conversations.createIdea, {
      runId: f.runId,
      generation: 1,
      executionKey,
      title: "Original",
      perspective: "Perspective",
      rationale: "Reason",
      questions: ["Question?"],
    });
    const root = (await f.t.run((ctx) => ctx.db.get(ideaId)))!,
      originalId = root.currentVersionId!;
    const currentId = await f.signed.mutation(api.content.ideas.edit, {
      workspaceId: f.workspaceId,
      ideaId,
      expectedRevision: 1,
      title: "Current",
      perspective: "Perspective",
      note: "Edited",
      priority: "normal",
      feedback: "Current version",
    });
    await f.t.mutation(internal.ai.runs.finish, {
      runId: f.runId,
      generation: 1,
      executionKey,
      failed: false,
    });
    await f.signed.mutation(api.ai.conversations.send, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      conversationId: f.conversationId,
      operationKey: "eligible-next",
      prompt: "Next eligible operation",
      allowIdeaCreation: false,
    });
    const firstOp = (await f.t.run((ctx) =>
      ctx.db
        .query("chatOperations")
        .withIndex("by_conversationId_and_createdAt", (q) =>
          q.eq("conversationId", f.conversationId),
        )
        .order("asc")
        .first(),
    ))!;
    await f.t.run(async (ctx) => {
      if (loss === "archived")
        await ctx.db.patch(ideaId, { status: "archived" });
      else
        await ctx.db.patch(
          loss.startsWith("original") ? originalId : currentId,
          loss.endsWith("unavailable")
            ? { sourceUnavailable: true }
            : { researchProofUntil: Date.now() - 1 },
        );
    });
    vi.setSystemTime(Date.now() + 1000);
    const a = {
      ...f.args,
      accountId: f.accountId,
      conversationId: f.conversationId,
      cursor: null,
      selectionUpperBound: null,
    };
    const first = await f.signed.query(endpoint("conversationOperations"), a);
    expect(first.data.selection.rows).toEqual([]);
    expect(first.isDone).toBe(false);
    const next = await f.signed.query(endpoint("conversationOperations"), {
      ...a,
      cursor: first.cursor,
      selectionUpperBound: first.selectionUpperBound,
    });
    expect(next.data.selection.rows).toHaveLength(1);
    expect(next.data.selection.rows[0].operationId).not.toBe(firstOp._id);
    await expect(
      f.signed.query(endpoint("conversationRuns"), {
        ...f.args,
        accountId: f.accountId,
        conversationId: f.conversationId,
        operationId: firstOp._id,
        offset: 0,
      }),
    ).rejects.toThrow();
    await f.t.run((ctx) =>
      ctx.db.patch(ideaId, { operationKey: "ambiguous-other-operation" }),
    );
    await expect(
      f.signed.query(endpoint("conversationOperations"), a),
    ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  },
);
