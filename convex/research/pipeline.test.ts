import { test, expect } from "vitest";
import {
  deriveQuestion,
  canonicalCopies,
  validateProposal,
} from "../ai/researchTools";
test("research question stays bounded and excludes source instructions", () => {
  expect(
    deriveQuestion({
      topics: "Convex",
      project: "Dispatch",
      exclusions: "crypto",
    }),
  ).toBe("Convex Dispatch -crypto");
});
test("copied text is one origin, unknown publication is not new news", () => {
  expect(
    canonicalCopies([
      { id: "one", identity: "1", url: null, text: "same  copy" },
      { id: "two", identity: "2", url: null, text: "same copy" },
    ]),
  ).toEqual([["one", "two"]]);
});
test("semantic output may not fabricate supplied references or confidence", () => {
  expect(() =>
    validateProposal('{"items":[{"sourceId":"foreign"}]}', [], [], []),
  ).toThrow();
});
import { vi, beforeEach, afterEach } from "vitest";
import workflowComponent from "@convex-dev/workflow/test";
import agentComponent from "@convex-dev/agent/test";
import { fixture, streamResponse } from "../../tests/research-fixture";
import { api, internal, components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { sha256 } from "../lib/crypto";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function pipelineFixture(
  cap = 20000,
  operations: Doc<"researchSourcePolicies">["operation"][] = ["web-search"],
) {
  const f = await fixture(operations, cap);
  workflowComponent.register(f.t);
  agentComponent.register(f.t);
  await f.t.run(async (ctx) => {
    await ctx.db.insert("aiPolicies", {
      key: "requesty-generation",
      version: "synthetic-v1",
      enabled: true,
      processingEvidence: "synthetic",
      pricingEvidence: "synthetic",
      model: "synthetic/model",
      baseURL: "https://router.eu.requesty.ai/v1",
      currency: "USD",
      inputMicrosPerMillion: 1000000,
      outputMicrosPerMillion: 1000000,
      maxInputTokens: 16000,
      maxOutputTokens: 3000,
      maxAttempts: 3,
      maxToolSteps: 2,
      maxDurationMs: 120000,
      purposes: ["research"],
    });
    for (const [scope, key] of [
      ["provider", "provider"],
      ["workspace", `workspace:${f.workspaceId}`],
      ["account", `account:${f.accountId}`],
    ] as const)
      await ctx.db.insert("aiBudgets", {
        key,
        scope,
        workspaceId: scope === "provider" ? undefined : f.workspaceId,
        accountId: scope === "account" ? f.accountId : undefined,
        approvedBy: scope === "provider" ? undefined : f.userId,
        policyVersion: "synthetic-v1",
        currency: "USD",
        purposes: ["research"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 100000,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  const start = (key = "pipeline-one") =>
    f.signed.mutation(api.research.pipeline.start, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 2,
      operationKey: key,
      language: "de",
      operations,
    });
  return { ...f, start };
}
const note = {
  claim: "unverified claim",
  consequentialOrContested: false,
  eventBased: false,
  quote: null,
  interpretation: "model interpretation",
  gaps: [],
  relevance: "account profile relevance",
  novelty: "semantic novelty is uncertain",
  uncertainty: "no independent corroboration",
  freshness: "unknown" as const,
  validityReason: "human review required",
};
async function modelOutput(
  f: Awaited<ReturnType<typeof pipelineFixture>>,
  orderId: Id<"researchOrders">,
) {
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!,
    pin = o.pipeline!.sourcePins[0];
  return JSON.stringify({
    items: [
      {
        title: "Source review",
        sourceId: pin.sourceId,
        materialHash: pin.materialHash,
        annotation: note,
        perspective: "Explain what this may mean for builders",
        dynamics: "Currently discussed; no time series",
        clusterId: null,
        clusterRevision: null,
        historyIds: [],
        copySourceIds: [],
        eventAt: null,
        eventQuote: null,
      },
    ],
  });
}
async function prepared(
  f: Awaited<ReturnType<typeof pipelineFixture>>,
  id: Id<"researchOrders">,
) {
  const a = { orderId: id, generation: 1 };
  await f.t.mutation(internal.ai.researchTools.reserve, a);
  await f.t.mutation(internal.ai.researchTools.prepare, a);
  await f.t.action(internal.research.execute.operation, {
    ...a,
    operation: "web-search",
  });
  await f.t.mutation(internal.ai.researchTools.select, a);
  return a;
}
test("registered Workflow completes all ten real steps for an empty search and keeps old admissions inert", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse([]));
  const id = await f.start();
  await f.t.finishAllScheduledFunctions(
    () => vi.advanceTimersByTime(100),
    1000,
  );
  const o = await f.t.run((ctx) => ctx.db.get(id));
  expect(o?.pipeline).toMatchObject({
    step: 10,
    outcome: "empty",
    evidenceIds: [],
    runId: null,
  });
  expect(o?.state).toBe("completed");
  expect(await f.t.run((ctx) => ctx.db.query("agentRuns").collect())).toEqual(
    [],
  );
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(await f.start()).toBe(id);
  const old = await f.signed.mutation(api.research.runs.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "old-inert",
  });
  await f.t.mutation(internal.research.runs.execute, {
    orderId: old,
    generation: 1,
  });
  expect((await f.t.run((ctx) => ctx.db.get(old)))?.state).toBe("blocked");
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
test("real reservations and first-send receipt prohibit replay, while semantic commit stays strict and Inbox evidence remains Review", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start(),
    a = await prepared(f, id);
  const receipt = await f.t.run((ctx) =>
    ctx.db
      .query("aiAttempts")
      .withIndex("by_researchOrderId_and_key", (q) =>
        q.eq("researchOrderId", id),
      )
      .unique(),
  );
  expect(receipt).toMatchObject({
    owner: "native-search",
    state: "settled",
    estimatedMicros: 20,
  });
  expect(
    receipt?.owner === "native-search" ? receipt.dispatchedAt : undefined,
  ).toBeTypeOf("number");
  await f.t.action(internal.research.execute.operation, {
    ...a,
    operation: "web-search",
  });
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  const runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
  expect(runId).not.toBeNull();
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "semantic",
  });
  await expect(
    f.t.mutation(internal.ai.researchTools.commitModel, {
      runId,
      executionKey: "semantic",
      output: '{"items":[{"sourceId":"foreign"}]}',
    }),
  ).rejects.toThrow();
  const output = await modelOutput(f, id);
  await f.t.mutation(internal.ai.researchTools.commitModel, {
    runId,
    executionKey: "semantic",
    output,
  });
  await f.t.mutation(internal.ai.runs.finish, {
    runId,
    generation: 1,
    executionKey: "semantic",
    failed: false,
  });
  for (const fn of [
    internal.ai.researchTools.cluster,
    internal.ai.researchTools.assess,
    internal.ai.researchTools.evidence,
    internal.ai.researchTools.inbox,
    internal.ai.researchTools.finish,
  ])
    await f.t.mutation(fn, a);
  const result = await f.signed.query(api.research.pipeline.results, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  expect(result?.results).toHaveLength(1);
  expect(result?.results[0].state).toBe("review");
  expect(result?.results[0]).not.toHaveProperty("assessment");
  expect(result?.results[0].payload?.annotation.claim).toContain(
    "Quellenmetadaten",
  );
  expect(
    (await f.t.run((ctx) => ctx.db.get(id)))?.pipeline?.pending,
  ).toBeNull();
});
test("all-order native plus model reservations enforce one cap and keep generation ownership immutable", async () => {
  const f = await pipelineFixture(19000);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start(),
    a = await prepared(f, id);
  const runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey: "budget" });
  await expect(
    f.t.mutation(internal.ai.runs.fund, {
      runId,
      generation: 1,
      executionKey: "budget",
      key: "research-semantic",
    }),
  ).rejects.toThrow("RESEARCH_ORDER_BUDGET_EXHAUSTED");
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).length,
  ).toBe(1);
});
test("actual registered Workflow and funded Agent use only two physical calls, stable receipts, and purge prompt/evidence after source withdrawal", async () => {
  const f = await pipelineFixture();
  let orderId: Id<"researchOrders">;
  let calls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    expect(String(input)).toBe(
      "https://router.eu.requesty.ai/v1/chat/completions",
    );
    expect(init?.redirect).toBe("error");
    if (body.tools?.[0]?.type === "web_search") return streamResponse();
    const attempts = await f.t.run((ctx) =>
      ctx.db.query("aiAttempts").collect(),
    );
    expect(attempts).toHaveLength(2);
    expect(attempts[1].state).toBe("sent");
    expect(attempts[1].researchOrderId).toBeUndefined();
    const output = await modelOutput(f, orderId);
    return Response.json({
      id: "semantic-result",
      object: "chat.completion",
      created: 1791210000,
      model: "synthetic/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ text: output }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  });
  orderId = await f.start();
  await driveUntil(f, orderId, (o) => o.state === "completed");
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(calls).toBe(2);
  expect(o.pipeline).toMatchObject({
    step: 10,
    outcome: "completed",
    pending: null,
    inboxReady: true,
  });
  const run = (await f.t.run((ctx) => ctx.db.get(o.pipeline!.runId!)))!;
  expect(run.state).toBe("completed");
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: run.threadId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 20 },
    },
  );
  expect(messages.page.length).toBeGreaterThan(1);
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: o.pipeline!.sourcePins[0].sourceId,
    reason: "blocked",
  });
  expect(
    (
      await f.signed.query(api.research.pipeline.results, {
        workspaceId: f.workspaceId,
        orderId,
      })
    )?.results,
  ).toEqual([]);
  await driveUntil(f, orderId, (o) => o.pipeline?.cleanupState === "complete");
  const clean = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(clean.pipeline).toMatchObject({
    cleanupState: "complete",
    agentCleaned: true,
    workflowCleaned: true,
    pending: null,
  });
  const removedMessages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: run.threadId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 20 },
    },
  );
  expect(removedMessages.page).toEqual([]);
  expect(removedMessages.isDone).toBe(true);
  expect(
    (await f.t.run((ctx) => ctx.db.query("researchEvidence").collect())).every(
      (e) => e.payload === null,
    ),
  ).toBe(true);
  expect(calls).toBe(2);
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).every(
      (a) => a.state === "settled",
    ),
  ).toBe(true);
});
test("new workflow schedule alone reaches the pipeline and old saved callbacks cannot spend", async () => {
  const f = await pipelineFixture();
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "daily-config",
    action: {
      kind: "save",
      config: {
        ...(await f.t.run(async (ctx) =>
          ctx.db.get((await ctx.db.get(f.profileId))!.currentVersionId!),
        ))!.config,
        frequency: "daily",
      },
    },
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    commandKey: "workflow-activate",
    action: {
      kind: "activate-workflow",
      language: "de",
      operations: ["web-search"],
    },
  });
  const p = (await f.t.run((ctx) => ctx.db.get(f.profileId)))!;
  expect(p.workflowActivation?.kind).toBe("research-workflow-v1");
  vi.setSystemTime(p.nextAt!);
  expect(
    await f.t.mutation(internal.research.schedules.fire, {
      profileId: p._id,
      generation: p.scheduleGeneration,
      at: p.nextAt!,
    }),
  ).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
  const id = await f.t.mutation(internal.research.pipeline.fire, {
    profileId: p._id,
    generation: p.scheduleGeneration,
    at: p.nextAt!,
  });
  expect(id).not.toBeNull();
  expect(
    await f.t.mutation(internal.research.pipeline.fire, {
      profileId: p._id,
      generation: p.scheduleGeneration,
      at: p.nextAt!,
    }),
  ).toBe(id);
  const next = (await f.t.run((ctx) => ctx.db.get(p._id)))!;
  expect(next.nextAt).toBeGreaterThan(p.nextAt!);
  expect((await f.t.run((ctx) => ctx.db.get(id!)))?.occasion).toBe("scheduled");
});

async function driveUntil(
  f: Awaited<ReturnType<typeof pipelineFixture>>,
  id: Id<"researchOrders">,
  done: (o: import("../_generated/dataModel").Doc<"researchOrders">) => boolean,
) {
  for (let i = 0; i < 1000; i++) {
    await vi.advanceTimersByTimeAsync(100);
    await f.t.finishInProgressScheduledFunctions();
    const o = await f.t.run((ctx) => ctx.db.get(id));
    if (o && done(o)) return;
  }
  throw new Error("Workflow did not reach bounded expected state");
}
import { MockLanguageModelV3 } from "ai/test";
import { generateForRun } from "../ai/provider";
const modelReceipt = (output: string, known = true) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ text: output }) }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: {
      total: known ? 10 : undefined,
      noCache: 10,
      cacheRead: 0,
      cacheWrite: 0,
    },
    outputTokens: { total: known ? 20 : undefined, text: 20, reasoning: 0 },
  },
  warnings: [],
});
test.each([
  "material",
  "sourcePurpose",
  "actor",
  "sourceApprover",
  "modelApprover",
  "account",
] as const)(
  "current %s withdrawal prevents funded semantic physical I/O",
  async (kind) => {
    const f = await pipelineFixture();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
    const id = await f.start(),
      a = await prepared(f, id),
      runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
    await f.t.mutation(internal.ai.runs.claim, {
      runId,
      executionKey: "guarded",
    });
    const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
    await f.t.run(async (ctx) => {
      if (kind === "material")
        await ctx.db.patch(o.pipeline!.sourcePins[0].sourceId, {
          title: "Rewritten material",
        });
      if (kind === "sourcePurpose")
        await ctx.db.patch(f.policies[0], { rightsEvidence: "" });
      if (kind === "actor") {
        const m = await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique();
        await ctx.db.patch(m!._id, { role: "Viewer" });
      }
      if (kind === "sourceApprover") {
        const pol = (await ctx.db.get(f.policies[0]))!;
        await ctx.db.patch(pol._id, {
          approvedBy: await ctx.db.insert("users", {
            authId: "synthetic-other",
            activeWorkspaceId: f.workspaceId,
            defaultWorkspaceId: f.workspaceId,
          }),
        });
      }
      if (kind === "modelApprover") {
        const r = (await ctx.db.get(runId))!;
        await ctx.db.patch(r.budgetIds[1], { approvedBy: undefined });
      }
      if (kind === "account")
        await ctx.db.patch(f.accountId, { connection: "disconnected" });
    });
    let calls = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        calls++;
        return modelReceipt('{"items":[]}');
      },
    });
    await expect(
      f.t.action((ctx) => generateForRun(ctx, runId, "guarded", model)),
    ).rejects.toThrow();
    expect(calls).toBe(0);
    expect(
      await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
    ).toHaveLength(1);
  },
);
test("source withdrawal during actual Agent I/O settles late model usage once and fences every derived write", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start(),
    a = await prepared(f, id),
    runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!,
    output = await modelOutput(f, id);
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey: "during" });
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  let calls = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      calls++;
      await f.signed.mutation(api.research.cache.invalidate, {
        workspaceId: f.workspaceId,
        sourceId: o.pipeline!.sourcePins[0].sourceId,
        reason: "blocked",
      });
      return modelReceipt(output);
    },
  });
  await expect(
    f.t.action((ctx) => generateForRun(ctx, runId, "during", model)),
  ).rejects.toThrow();
  expect(calls).toBe(1);
  const receipts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(receipts).toHaveLength(2);
  expect(receipts[1]).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
    heldMicros: 0,
  });
  await expect(
    f.t.mutation(internal.ai.researchTools.commitModel, {
      runId,
      executionKey: "during",
      output,
    }),
  ).rejects.toThrow();
  expect(
    await f.t.run((ctx) => ctx.db.query("researchEvidence").collect()),
  ).toEqual([]);
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId: receipts[1]._id,
    inputTokens: 10,
    outputTokens: 20,
    errorCode: null,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(receipts[1].budgetIds[0])))?.spentMicros,
  ).toBe(30);
});
test("stop retains committed Review evidence but clears pending proposal and prevents new calls", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start(),
    a = await prepared(f, id),
    runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "stop-evidence",
  });
  await f.t.mutation(internal.ai.researchTools.commitModel, {
    runId,
    executionKey: "stop-evidence",
    output: JSON.stringify({
      items: JSON.parse(await modelOutput(f, id)).items.map(
        (item: Record<string, unknown>) => ({
          ...item,
          dynamics: "Rising trend, +200% today",
        }),
      ),
    }),
  });
  await f.t.mutation(internal.ai.runs.finish, {
    runId,
    generation: 1,
    executionKey: "stop-evidence",
    failed: false,
  });
  for (const fn of [
    internal.ai.researchTools.cluster,
    internal.ai.researchTools.assess,
    internal.ai.researchTools.evidence,
  ])
    await f.t.mutation(fn, a);
  expect(
    (await f.t.run((ctx) => ctx.db.get(id)))?.pipeline?.pending?.length,
  ).toBe(1);
  await f.signed.mutation(api.research.runs.stop, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(id)))?.pipeline?.pending,
  ).toBeNull();
  const evidence = await f.signed.query(api.research.evidence.list, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  expect(evidence).toHaveLength(1);
  expect(evidence[0].payload?.model?.title).toBe("Source review");
  expect(evidence[0].payload?.model?.dynamics).toBe(
    "Aktuell diskutiert; keine gelieferte Zeitreihe oder nachgewiesene Zunahme.",
  );
  expect(evidence[0].automaticEligible).toBe(false);
  await f.t.action(internal.research.execute.operation, {
    ...a,
    operation: "web-search",
  });
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  await expect(
    f.signed.mutation(api.research.pipeline.resume, {
      workspaceId: f.workspaceId,
      orderId: id,
    }),
  ).rejects.toThrow("RESUME_UNAVAILABLE");
});
test("native unknown is a failed search with a retained hold and a new workflow cannot buy the same request again", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("synthetic provider outage"),
  );
  const id = await f.start();
  const before = (await f.t.run((ctx) => ctx.db.get(id)))!.pipeline!.workflowId;
  expect(
    await f.signed.mutation(api.research.pipeline.resume, {
      workspaceId: f.workspaceId,
      orderId: id,
    }),
  ).toBe("running");
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.pipeline!.workflowId).toBe(
    before,
  );
  await driveUntil(f, id, (o) => o.state === "completed");
  expect((await f.t.run((ctx) => ctx.db.get(id)))?.pipeline).toMatchObject({
    step: 10,
    outcome: "failed",
    usagePending: true,
  });
  const first = (
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())
  )[0];
  expect(first).toMatchObject({
    state: "unknown",
    heldMicros: 100,
    estimatedMicros: null,
  });
  const second = await f.start("pipeline-new-key");
  await driveUntil(f, second, (o) => o.state === "completed");
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
});
test("confirmed history uses the actual published portion and confirmedAt; verification and unpublished thread text never become editorial history", async () => {
  const f = await pipelineFixture();
  const history = await f.t.run(async (ctx) => {
    const result = [];
    for (const purpose of ["publishing", "first_write_verification"] as const) {
      const draftId = await ctx.db.insert("drafts", {
        workspaceId: f.workspaceId,
        revision: 1,
        currentVersionId: null,
        authorId: f.userId,
        source: "synthetic",
        updatedAt: Date.now(),
      });
      const versionId = await ctx.db.insert("draftVersions", {
        workspaceId: f.workspaceId,
        draftId,
        number: 1,
        authorId: f.userId,
        createdAt: Date.now(),
        reason: "synthetic history",
        content: {
          title: "Published topic",
          text: [
            "Unpublished first portion",
            "Actual confirmed second portion",
          ],
          media: [],
          accountId: f.accountId,
          pillar: "",
          strategy: "",
        },
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
        purpose,
        workspaceId: f.workspaceId,
        draftId,
        versionId,
        accountId: f.accountId,
        approvalId,
        actorId: f.userId,
        generation: 1,
        at: Date.now() + 86400000,
        timezone: "UTC",
        localTime: "synthetic",
        state: "partially_published",
        publishedCount: 1,
        errorCode: null,
        jobId: null,
      });
      const confirmedAt = Date.now() - 86400000;
      const attemptId = await ctx.db.insert("xPostAttempts", {
        workspaceId: f.workspaceId,
        scheduleId,
        generation: 1,
        versionId,
        accountId: f.accountId,
        providerIdentity: "synthetic",
        connectionSequence: 0,
        position: 1,
        attempt: 1,
        claimSequence: 1,
        leaseUntil: Date.now(),
        deadline: Date.now(),
        stage: "confirmed",
        mediaIds: [],
        externalId: `confirmed-${purpose}`,
        confirmedAt,
        durationMs: 1,
        createdAt: confirmedAt,
        updatedAt: confirmedAt,
      });
      await ctx.db.patch(scheduleId, {
        externalPosts: [
          {
            position: 1,
            externalId: `confirmed-${purpose}`,
            url: "https://x.com/synthetic/status/1",
            attemptId,
            confirmedAt,
          },
        ],
      });
      result.push({ attemptId, confirmedAt });
    }
    return result;
  });
  const id = await f.start();
  await f.t.mutation(internal.ai.researchTools.reserve, {
    orderId: id,
    generation: 1,
  });
  await f.t.mutation(internal.ai.researchTools.prepare, {
    orderId: id,
    generation: 1,
  });
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(o.pipeline!.history.map((h) => h.attemptId)).toEqual([
    history[0].attemptId,
  ]);
  expect(o.pipeline!.history[0].confirmedAt).toBe(history[0].confirmedAt);
  expect(o.pipeline!.history[0].materialHash).toBe(
    await sha256(
      JSON.stringify([
        "Published topic",
        "Actual confirmed second portion",
        history[0].confirmedAt,
        "confirmed-publishing",
      ]),
    ),
  );
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const a = { orderId: id, generation: 1 };
  await f.t.action(internal.research.execute.operation, {
    ...a,
    operation: "web-search",
  });
  await f.t.mutation(internal.ai.researchTools.select, a);
  const runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!,
    output = await modelOutput(f, id);
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "history-withdrawal",
  });
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      await f.t.run((ctx) =>
        ctx.db.patch(o.pipeline!.history[0].scheduleId, { externalPosts: [] }),
      );
      return modelReceipt(output);
    },
  });
  await expect(
    f.t.action((ctx) =>
      generateForRun(ctx, runId, "history-withdrawal", model),
    ),
  ).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
  await expect(
    f.t.mutation(internal.ai.researchTools.commitModel, {
      runId,
      executionKey: "history-withdrawal",
      output,
    }),
  ).rejects.toThrow("RESEARCH_HISTORY_CHANGED");
  expect(
    await f.t.run((ctx) => ctx.db.query("researchEvidence").collect()),
  ).toEqual([]);
  const receipts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
    semantic = receipts.find((r) => r.owner !== "native-search")!;
  expect(semantic).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
    heldMicros: 0,
  });
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId: semantic._id,
    inputTokens: 10,
    outputTokens: 20,
    errorCode: null,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(semantic.budgetIds[0])))?.spentMicros,
  ).toBe(30);
});
test("one origin copy may not claim independent support and foreign refs/confidence cannot enter semantic output", () => {
  const id = "source-one" as Id<"researchSources">,
    hash = "material",
    s = {
      sourceId: id,
      materialHash: hash,
      text: "Actual quoted 2020-01-01",
      title: "Source",
      publishedAt: 1,
      observedAt: 2,
      operation: "x-recent" as const,
    },
    item = {
      title: "Topic",
      sourceId: id,
      materialHash: hash,
      annotation: { ...note, quote: "Actual quoted 2020-01-01" },
      perspective: "Account",
      dynamics: "Discussed",
      clusterId: null,
      clusterRevision: null,
      historyIds: [],
      copySourceIds: [],
      eventAt: Date.parse("2020-01-01"),
      eventQuote: "Actual quoted 2020-01-01",
    };
  expect(
    validateProposal(JSON.stringify({ items: [item] }), [s], [], []),
  ).toHaveLength(1);
  for (const changed of [
    { ...item, confidence: 0.99 },
    { ...item, sourceId: "foreign" },
    { ...item, materialHash: "different" },
    { ...item, copySourceIds: ["foreign"] },
    { ...item, historyIds: ["foreign"] },
    { ...item, annotation: { ...item.annotation, quote: "fabricated" } },
    { ...item, eventAt: Date.parse("2026-01-01") },
  ])
    expect(() =>
      validateProposal(JSON.stringify({ items: [changed] }), [s], [], []),
    ).toThrow();
  expect(
    canonicalCopies([
      { id: "a", identity: "a", url: "https://source/one", text: null },
      { id: "b", identity: "b", url: "https://source/two", text: "copied" },
      { id: "c", identity: "c", url: "https://source/one", text: "copied" },
    ])[0].sort(),
  ).toEqual(["a", "b", "c"]);
});
test("existing cluster context binds every prior source and withdrawal fences new generation", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const { first, old } = await seedCluster(f);
  vi.mocked(globalThis.fetch).mockResolvedValue(
    streamResponse([
      { url: "https://second.test/new", title: "New independent topic" },
    ]),
  );
  const second = await f.signed.mutation(api.research.pipeline.start, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 3,
      operationKey: "cluster-second",
      language: "de",
      operations: ["web-search"],
    }),
    b = await prepared(f, second),
    secondRun = (await f.t.mutation(internal.ai.researchTools.bindModel, b))!;
  const order = (await f.t.run((ctx) => ctx.db.get(second)))!;
  expect(order.pipeline!.contextPins).toContainEqual({
    ...old.pipeline!.sourcePins[0],
    orderId: first,
    until: old.pipeline!.retentionUntil,
  });
  expect(order.pipeline!.contextEvidence).toHaveLength(1);
  expect(order.pipeline!.clusterPins).toHaveLength(1);
  await f.t.mutation(internal.ai.runs.claim, {
    runId: secondRun,
    executionKey: "cluster-second",
  });
  let calls = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      calls++;
      await f.signed.mutation(api.research.cache.invalidate, {
        workspaceId: f.workspaceId,
        sourceId: old.pipeline!.sourcePins[0].sourceId,
        reason: "blocked",
      });
      return modelReceipt(await modelOutput(f, second));
    },
  });
  await expect(
    f.t.action((ctx) =>
      generateForRun(ctx, secondRun, "cluster-second", model),
    ),
  ).rejects.toThrow();
  expect(calls).toBe(1);
  await expect(
    f.t.mutation(internal.ai.researchTools.commitModel, {
      runId: secondRun,
      executionKey: "cluster-second",
      output: await modelOutput(f, second),
    }),
  ).rejects.toThrow();
  const projection = await f.signed.query(api.research.pipeline.results, {
    workspaceId: f.workspaceId,
    orderId: second,
  });
  expect(projection?.removed).toBe(true);
  await f.t.mutation(internal.ai.runs.finish, {
    runId: secondRun,
    generation: 1,
    executionKey: "cluster-second",
    failed: true,
  });
  await driveUntil(f, second, (o) => o.pipeline?.cleanupState === "complete");
  const r = (await f.t.run((ctx) => ctx.db.get(secondRun)))!;
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: r.threadId,
      paginationOpts: { cursor: null, numItems: 100 },
      order: "asc",
    },
  );
  expect(messages.page).toEqual([]);
});
test("Web results remain partial and usage nullable when X fails, and cluster CAS replay is stable", async () => {
  const f = await pipelineFixture(20000, ["x-recent", "web-search"]);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).includes("api.x.com")
      ? Response.json({ error: "synthetic outage" }, { status: 503 })
      : streamResponse(),
  );
  const id = await f.start(),
    a = { orderId: id, generation: 1 };
  await f.t.mutation(internal.ai.researchTools.reserve, a);
  await f.t.mutation(internal.ai.researchTools.prepare, a);
  for (const operation of ["x-recent", "web-search"] as const)
    await f.t.action(internal.research.execute.operation, { ...a, operation });
  await f.t.mutation(internal.ai.researchTools.select, a);
  const runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!,
    output = await modelOutput(f, id);
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "partial-run",
  });
  const model = new MockLanguageModelV3({
    doGenerate: async () => modelReceipt(output),
  });
  await f.t.action((ctx) => generateForRun(ctx, runId, "partial-run", model));
  await f.t.mutation(internal.ai.researchTools.commitModel, {
    runId,
    executionKey: "partial-run",
    output,
  });
  await f.t.mutation(internal.ai.runs.finish, {
    runId,
    generation: 1,
    executionKey: "partial-run",
    failed: false,
  });
  await Promise.all([
    f.t.mutation(internal.ai.researchTools.cluster, a),
    f.t.mutation(internal.ai.researchTools.cluster, a),
  ]);
  expect(
    await f.t.run((ctx) => ctx.db.query("researchClusters").collect()),
  ).toHaveLength(1);
  for (const fn of [
    internal.ai.researchTools.assess,
    internal.ai.researchTools.evidence,
    internal.ai.researchTools.inbox,
    internal.ai.researchTools.finish,
  ])
    await f.t.mutation(fn, a);
  const result = await f.signed.query(api.research.pipeline.results, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  expect(result).toMatchObject({
    outcome: "partial",
    step: 10,
    estimatedMicros: null,
    usagePending: true,
  });
  expect(result!.results).toHaveLength(1);
  expect(result!.results[0].payload!.annotation.gaps).toContain(
    "Publikationszeit unbekannt; Beobachtungszeit beweist keine Neuigkeit.",
  );
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});
test("claimed execution without a finished receipt keeps native prompt purge pending until actual completion", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start(),
    a = await prepared(f, id),
    runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "crashed-execution",
  });
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: o.pipeline!.sourcePins[0].sourceId,
    reason: "blocked",
  });
  await f.t.mutation(internal.research.pipeline.clearSource, {
    sourceId: o.pipeline!.sourcePins[0].sourceId,
  });
  await f.t.mutation(internal.research.pipeline.purge, { orderId: id });
  expect((await f.t.run((ctx) => ctx.db.get(id)))?.pipeline).toMatchObject({
    cleanupState: "pending",
    agentCleaned: false,
  });
  const r = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  const before = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: r.threadId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 20 },
    },
  );
  expect(before.page.length).toBeGreaterThan(0);
  await f.t.mutation(internal.ai.runs.finish, {
    runId,
    generation: 1,
    executionKey: "crashed-execution",
    failed: true,
  });
  await driveUntil(f, id, (o) => o.pipeline?.cleanupState === "complete");
  const after = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: r.threadId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 20 },
    },
  );
  expect(after.page).toEqual([]);
  expect(after.isDone).toBe(true);
});

async function seedCluster(f: Awaited<ReturnType<typeof pipelineFixture>>) {
  const first = await f.start(),
    a = await prepared(f, first),
    runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "cluster-first",
  });
  await f.t.mutation(internal.ai.researchTools.commitModel, {
    runId,
    executionKey: "cluster-first",
    output: await modelOutput(f, first),
  });
  await f.t.mutation(internal.ai.runs.finish, {
    runId,
    generation: 1,
    executionKey: "cluster-first",
    failed: false,
  });
  for (const fn of [
    internal.ai.researchTools.cluster,
    internal.ai.researchTools.assess,
    internal.ai.researchTools.evidence,
    internal.ai.researchTools.inbox,
  ])
    await f.t.mutation(fn, a);
  await f.signed.mutation(api.research.runs.stop, {
    workspaceId: f.workspaceId,
    orderId: first,
  });
  const old = (await f.t.run((ctx) => ctx.db.get(first)))!;
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "cluster-context-edit",
    action: {
      kind: "save",
      config: { ...old.config, topics: "Different topic" },
    },
  });
  return { first, old };
}
test("two semantic results update one existing cluster once and concurrent stage replay does not duplicate CAS", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  await seedCluster(f);
  vi.mocked(globalThis.fetch).mockResolvedValue(
    streamResponse([
      { url: "https://a.test/new", title: "New A" },
      { url: "https://b.test/new", title: "New B" },
    ]),
  );
  const id = await f.signed.mutation(api.research.pipeline.start, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 3,
      operationKey: "cluster-multiple",
      language: "de",
      operations: ["web-search"],
    }),
    a = await prepared(f, id),
    runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!,
    pin = o.pipeline!.clusterPins[0];
  expect(o.pipeline!.sourcePins).toHaveLength(2);
  const template = JSON.parse(await modelOutput(f, id)).items[0],
    output = JSON.stringify({
      items: o.pipeline!.sourcePins.map((p) => ({
        ...template,
        sourceId: p.sourceId,
        materialHash: p.materialHash,
        clusterId: pin.id,
        clusterRevision: pin.revision,
      })),
    });
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "cluster-multiple",
  });
  await f.t.action((ctx) =>
    generateForRun(
      ctx,
      runId,
      "cluster-multiple",
      new MockLanguageModelV3({ doGenerate: async () => modelReceipt(output) }),
    ),
  );
  await f.t.mutation(internal.ai.researchTools.commitModel, {
    runId,
    executionKey: "cluster-multiple",
    output,
  });
  await f.t.mutation(internal.ai.runs.finish, {
    runId,
    generation: 1,
    executionKey: "cluster-multiple",
    failed: false,
  });
  await Promise.all([
    f.t.mutation(internal.ai.researchTools.cluster, a),
    f.t.mutation(internal.ai.researchTools.cluster, a),
  ]);
  expect(
    (await f.t.run((ctx) => ctx.db.get(id)))!.pipeline!.clusterIds,
  ).toEqual([pin.id, pin.id]);
  expect((await f.t.run((ctx) => ctx.db.get(pin.id)))!.revision).toBe(
    pin.revision + 1,
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("researchClusters").collect()),
  ).toHaveLength(1);
});
