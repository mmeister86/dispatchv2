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
import type { WorkflowId } from "@convex-dev/workflow";
import { pipelineFixture, streamResponse } from "../../tests/research-fixture";
import { api, internal, components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { sha256 } from "../lib/crypto";
import { workflow } from "../ai/researchAgent";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

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
    expect(
      "researchOrderId" in attempts[1]
        ? attempts[1].researchOrderId
        : undefined,
    ).toBeUndefined();
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
  expect(clean.pipeline!.outcome).toBe("completed");
  expect(clean.state).toBe("completed");
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
test("ordinary profile save during unresolved registered native transport preserves the active immutable query/model/evidence snapshot", async () => {
  const f = await pipelineFixture();
  let orderId: Id<"researchOrders">;
  let calls = 0;
  let capturedVersion: Id<"researchProfileVersions">;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    if (body.tools?.[0]?.type === "web_search") {
      const active = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
      capturedVersion = active.profileVersionId;
      expect(active.config).toMatchObject({
        topics: "Product",
        freshnessDays: 30,
        topicCount: 5,
      });
      expect(JSON.stringify(body)).toContain("Product");
      expect(JSON.stringify(body)).not.toContain("Future distinctive topics");
      let release!: (response: Response) => void;
      const unresolved = new Promise<Response>((resolve) => {
        release = resolve;
      });
      await f.signed.mutation(api.research.profiles.change, {
        workspaceId: f.workspaceId,
        profileId: f.profileId,
        expectedRevision: 2,
        commandKey: "ordinary-active-edit",
        action: {
          kind: "save",
          config: {
            ...active.config,
            topics: "Future distinctive topics",
            freshnessDays: 7,
            topicCount: 2,
          },
        },
      });
      const stillActive = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
      expect(stillActive.profileVersionId).toBe(capturedVersion);
      expect(stillActive.config).toEqual(active.config);
      release(streamResponse());
      return unresolved;
    }
    expect(JSON.stringify(body.messages)).toContain("Product");
    expect(JSON.stringify(body.messages)).not.toContain(
      "Future distinctive topics",
    );
    return Response.json({
      id: "active-profile-result",
      object: "chat.completion",
      created: 1791210000,
      model: "synthetic/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ text: await modelOutput(f, orderId) }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  });
  orderId = await f.start();
  await driveUntil(f, orderId, (o) => o.state === "completed");
  const order = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(calls).toBe(2);
  expect(order.profileVersionId).toBe(capturedVersion!);
  expect(order.pipeline).toMatchObject({ step: 10, outcome: "completed" });
  const evidence = (await f.t.run((ctx) =>
    ctx.db.get(order.pipeline!.evidenceIds[0]),
  ))!;
  expect(evidence.payload!.perspective).toMatchObject({
    profileVersionId: capturedVersion!,
    topics: "Product",
  });
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts).toHaveLength(2);
  expect(
    attempts.every((a) => a.state === "settled" && a.heldMicros === 0),
  ).toBe(true);
  expect(
    attempts
      .filter((a) => "runId" in a && a.runId === order.pipeline!.runId)
      .map((a) => a.estimatedMicros),
  ).toEqual([30]);
  const future = await f.signed.mutation(api.research.pipeline.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    operationKey: "future-profile-order",
    language: "de",
    operations: ["web-search"],
  });
  const next = (await f.t.run((ctx) => ctx.db.get(future)))!;
  expect(next.profileVersionId).not.toBe(capturedVersion!);
  expect(next.config).toMatchObject({
    topics: "Future distinctive topics",
    freshnessDays: 7,
    topicCount: 2,
  });
  await f.signed.mutation(api.research.runs.stop, {
    workspaceId: f.workspaceId,
    orderId: future,
  });
  expect(calls).toBe(2);
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
      config: { ...old.config, topics: "Different topic", topicCount: 1 },
    },
  });
  return { first, old };
}
test("registered research handoff fails closed for a two-order retained-context cycle", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const { first, old } = await seedCluster(f);
  vi.mocked(globalThis.fetch).mockResolvedValue(
    streamResponse([
      { url: "https://cycle.test/new", title: "Distinct second topic" },
    ]),
  );
  const second = await f.signed.mutation(api.research.pipeline.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    operationKey: "cycle-second",
    language: "de",
    operations: ["web-search"],
  });
  const secondArgs = await prepared(f, second);
  await f.t.mutation(internal.ai.researchTools.bindModel, secondArgs);
  const next = (await f.t.run((ctx) => ctx.db.get(second)))!;
  expect(next.pipeline!.contextEvidence).toHaveLength(1);
  await f.t.run((ctx) =>
    ctx.db.patch(first, {
      pipeline: {
        ...old.pipeline!,
        contextPins: [{ ...next.pipeline!.sourcePins[0], orderId: second }],
      },
    }),
  );
  await expect(
    f.signed.mutation(api.research.handoff.consume, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      evidenceIds: [old.pipeline!.evidenceIds[0]],
      target: "idea",
      intent: "Prepare one proposal",
      commandKey: "cycle-consume",
    }),
  ).rejects.toThrow("ANCESTRY_LIMIT");
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
});
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
async function finishSemantic(
  f: Awaited<ReturnType<typeof pipelineFixture>>,
  id: Id<"researchOrders">,
  a: { orderId: Id<"researchOrders">; generation: number },
  output?: string,
) {
  const runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!,
    body = output ?? (await modelOutput(f, id)),
    executionKey = `proof-${id}`;
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  await f.t.action((ctx) =>
    generateForRun(
      ctx,
      runId,
      executionKey,
      new MockLanguageModelV3({ doGenerate: async () => modelReceipt(body) }),
    ),
  );
  await f.t.mutation(internal.ai.researchTools.commitModel, {
    runId,
    executionKey,
    output: body,
  });
  await f.t.mutation(internal.ai.runs.finish, {
    runId,
    generation: 1,
    executionKey,
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
}
test.each(["generation", "native"] as const)(
  "display proof uses current short %s grant expiry in Inbox and model-origin manual evidence",
  async (owner) => {
    const f = await pipelineFixture();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
    const id = await f.start(),
      a = await prepared(f, id);
    await finishSemantic(f, id, a);
    const expiry = Date.now() + 1000;
    await f.t.run(async (ctx) => {
      const rows = await ctx.db.query("aiAttempts").collect(),
        receipt = rows.find(
          (t) => (t.owner === "native-search") === (owner === "native"),
        )!;
      await ctx.db.patch(receipt.budgetIds[0], { expiresAt: expiry });
    });
    const row = await f.signed.query(api.research.pipeline.results, {
        workspaceId: f.workspaceId,
        orderId: id,
      }),
      evidence = await f.signed.query(api.research.evidence.list, {
        workspaceId: f.workspaceId,
        orderId: id,
      });
    expect(row!.results).toHaveLength(1);
    expect(row!.results[0].retentionUntil).toBeLessThanOrEqual(expiry);
    expect(evidence[0].proofUntil).toBeLessThanOrEqual(expiry);
    expect(
      (await f.t.run((ctx) => ctx.db.get(evidence[0].evidenceId)))!
        .retentionUntil,
    ).toBeGreaterThan(expiry);
    vi.setSystemTime(expiry + 1);
    expect(
      (await f.signed.query(api.research.pipeline.results, {
        workspaceId: f.workspaceId,
        orderId: id,
      }))!.results,
    ).toEqual([]);
  },
);
test.each(["legacy-exact-title", "explicit-key", "different-title"])(
  "two independent first-order sources share one requested topic using %s",
  async (grouping) => {
    const f = await pipelineFixture(20000, ["web-search"], 1);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse([
        { url: "https://one.test/new", title: "First" },
        { url: "https://two.test/new", title: "Second" },
      ]),
    );
    const id = await f.start(),
      a = await prepared(f, id),
      o = (await f.t.run((ctx) => ctx.db.get(id)))!,
      template = JSON.parse(await modelOutput(f, id)).items[0];
    const output = JSON.stringify({
      items: o.pipeline!.sourcePins.map((p) => ({
        ...template,
        sourceId: p.sourceId,
        materialHash: p.materialHash,
        title:
          grouping !== "legacy-exact-title"
            ? `Launch topic ${p.sourceId}`
            : "Same declared launch topic",
        ...(grouping === "explicit-key" ? { topicKey: "launch_update" } : {}),
      })),
    });
    if (grouping === "different-title") {
      await expect(finishSemantic(f, id, a, output)).rejects.toThrow(
        "RESEARCH_OUTPUT_LIMIT",
      );
      expect(
        await f.t.run((ctx) => ctx.db.query("researchEvidence").collect()),
      ).toEqual([]);
      return;
    }
    await finishSemantic(f, id, a, output);
    const done = (await f.t.run((ctx) => ctx.db.get(id)))!;
    expect(done.pipeline!.evidenceIds).toHaveLength(2);
    expect(new Set(done.pipeline!.clusterIds).size).toBe(1);
  },
);
test("secondary cluster native grant has its own short display proof even when current primary grants remain live", async () => {
  const f = await pipelineFixture(20000, ["x-recent", "web-search"]);
  let xCall = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).startsWith("https://api.x.com/")
      ? Response.json({
          data: [
            {
              id: String(++xCall + 1000),
              text: "Delivered independent X text",
              created_at: new Date(Date.now() - 1000).toISOString(),
            },
          ],
          meta: { result_count: 1 },
        })
      : streamResponse(),
  );
  const { first, old } = await seedCluster(f);
  const id = await f.signed.mutation(api.research.pipeline.start, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 3,
      operationKey: "secondary-proof",
      language: "de",
      operations: ["x-recent"],
    }),
    a = { orderId: id, generation: 1 };
  await f.t.mutation(internal.ai.researchTools.reserve, a);
  await f.t.mutation(internal.ai.researchTools.prepare, a);
  await f.t.action(internal.research.execute.operation, {
    ...a,
    operation: "x-recent",
  });
  await f.t.mutation(internal.ai.researchTools.select, a);
  await finishSemantic(f, id, a);
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(
    o.pipeline!.contextPins!.some(
      (p) =>
        p.orderId === first &&
        old.pipeline!.sourcePins.some((s) => s.sourceId === p.sourceId),
    ),
  ).toBe(true);
  const expiry = Date.now() + 1000;
  await f.t.run(async (ctx) => {
    const rows = await ctx.db
        .query("aiAttempts")
        .withIndex("by_researchOrderId_and_key", (q) =>
          q.eq("researchOrderId", first),
        )
        .collect(),
      web = rows.find(
        (r) => r.owner === "native-search" && r.operation === "web-search",
      )!;
    await ctx.db.patch(web.budgetIds[0], { expiresAt: expiry });
  });
  const row = await f.signed.query(api.research.pipeline.results, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  expect(row!.results).toHaveLength(1);
  expect(row!.results[0].retentionUntil).toBeLessThanOrEqual(expiry);
  const manual = await f.signed.query(api.research.evidence.list, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  expect(manual[0].proofUntil).toBeLessThanOrEqual(expiry);
  vi.setSystemTime(expiry + 1);
  expect(
    (await f.signed.query(api.research.pipeline.results, {
      workspaceId: f.workspaceId,
      orderId: id,
    }))!.results,
  ).toEqual([]);
});
test("actual combined source selection records omitted per-operation coverage in prompt, evidence and partial Inbox", async () => {
  const f = await pipelineFixture(20000, ["x-recent", "web-search"]);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).startsWith("https://api.x.com/")
      ? Response.json({
          data: Array.from({ length: 10 }, (_, i) => ({
            id: String(3000 + i),
            text: `Independent actual X ${i}`,
            created_at: new Date(Date.now() - 1000).toISOString(),
          })),
          meta: { result_count: 10 },
        })
      : streamResponse(
          Array.from({ length: 10 }, (_, i) => ({
            url: `https://coverage${i}.test/news`,
            title: `Web source ${i}`,
          })),
        ),
  );
  const id = await f.start(),
    a = { orderId: id, generation: 1 };
  await f.t.mutation(internal.ai.researchTools.reserve, a);
  await f.t.mutation(internal.ai.researchTools.prepare, a);
  for (const operation of ["x-recent", "web-search"] as const)
    await f.t.action(internal.research.execute.operation, { ...a, operation });
  await f.t.mutation(internal.ai.researchTools.select, a);
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(o.pipeline!.sourcePins).toHaveLength(10);
  expect(o.pipeline!.sourceCoverage).toEqual([
    { operation: "x-recent", delivered: 10, selected: 5, omitted: 5 },
    { operation: "web-search", delivered: 10, selected: 5, omitted: 5 },
  ]);
  await finishSemantic(f, id, a);
  const row = await f.signed.query(api.research.pipeline.results, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  expect(row).toMatchObject({
    outcome: "partial",
    historyIncomplete: true,
    sourceCoverage: o.pipeline!.sourceCoverage,
  });
  expect(row!.results[0].payload!.annotation.gaps.join(" ")).toContain(
    "Begrenzte Quellenabdeckung",
  );
  const done = (await f.t.run((ctx) => ctx.db.get(id)))!,
    run = (await f.t.run((ctx) => ctx.db.get(done.pipeline!.runId!)))!,
    messages = await f.t.query(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: run.threadId,
        order: "asc",
        paginationOpts: { cursor: null, numItems: 20 },
      },
    );
  expect(JSON.stringify(messages.page)).toContain("sourceCoverage");
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});
test("successful empty semantic output with bounded source omissions remains partial", async () => {
  const f = await pipelineFixture(20000, ["x-recent", "web-search"]);
  const calls = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, init) => {
      if (String(url).startsWith("https://api.x.com/"))
        return Response.json({
          data: Array.from({ length: 10 }, (_, i) => ({
            id: String(4000 + i),
            text: `Independent X source ${i}`,
            created_at: new Date(Date.now() - 1000).toISOString(),
          })),
          meta: { result_count: 10 },
        });
      const body = JSON.parse(String(init?.body));
      if (body.tools?.[0]?.type === "web_search")
        return streamResponse(
          Array.from({ length: 10 }, (_, i) => ({
            url: `https://empty-coverage${i}.test/news`,
            title: `Independent Web ${i}`,
          })),
        );
      return Response.json({
        id: "empty-semantic",
        object: "chat.completion",
        model: "synthetic/model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({ text: '{"items":[]}' }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    });
  const id = await f.start();
  await driveUntil(f, id, (o) => o.state === "completed");
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  const run = (await f.t.run((ctx) => ctx.db.get(o.pipeline!.runId!)))!;
  const row = (await f.signed.query(api.research.pipeline.results, {
    workspaceId: f.workspaceId,
    orderId: id,
  }))!;
  expect(calls).toHaveBeenCalledTimes(3);
  expect(o.native!.outcomes.every((x) => x.state === "completed")).toBe(true);
  expect(run.state).toBe("completed");
  expect(row.results).toEqual([]);
  expect(row.sourceCoverage!.reduce((n, c) => n + c.omitted, 0)).toBe(10);
  expect(row.historyIncomplete).toBe(true);
  expect(row.outcome).toBe("partial");
  expect(o.reason).toBe("RESEARCH_PARTIAL");
});
test("new topic identifiers are bounded local declarations and cannot also select an existing or foreign cluster", () => {
  const s = {
      sourceId: "source" as Id<"researchSources">,
      materialHash: "hash",
      text: null,
      title: "Metadata",
      publishedAt: null,
      observedAt: 1,
      operation: "web-search" as const,
    },
    item = {
      title: "Declared topic",
      sourceId: s.sourceId,
      materialHash: s.materialHash,
      annotation: note,
      perspective: "Account perspective",
      dynamics: "No time series",
      clusterId: null,
      clusterRevision: null,
      historyIds: [],
      copySourceIds: [],
      eventAt: null,
      eventQuote: null,
    };
  for (const topicKey of ["", "x".repeat(65), "bad\u0000label"]) {
    expect(() =>
      validateProposal(
        JSON.stringify({ items: [{ ...item, topicKey }] }),
        [s],
        [],
        [],
      ),
    ).toThrow();
  }
  expect(
    validateProposal(
      JSON.stringify({
        items: [{ ...item, topicKey: "foreign-looking:local-label" }],
      }),
      [s],
      [],
      [],
    )[0].topicKey,
  ).toBe("foreign-looking:local-label");
  const clusterId = "known" as Id<"researchClusters">;
  expect(() =>
    validateProposal(
      JSON.stringify({
        items: [{ ...item, topicKey: "local", clusterId, clusterRevision: 1 }],
      }),
      [s],
      [{ id: clusterId, revision: 1 }],
      [],
    ),
  ).toThrow("RESEARCH_OUTPUT_GROUP_INVALID");
  expect(() =>
    validateProposal(
      JSON.stringify({
        items: [{ ...item, clusterId: "foreign", clusterRevision: 1 }],
      }),
      [s],
      [{ id: clusterId, revision: 1 }],
      [],
    ),
  ).toThrow();
});

test("Q1 semantic run inherits immutable total order deadline after native work consumes time", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start();
  const a = await prepared(f, id);
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  vi.setSystemTime(o.deadline - 1000);
  const runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
  const r = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  expect(r.deadline).toBeLessThanOrEqual(o.deadline);
});
test("Q2 withdrawing a running source leaves an explicit cancelled disposition after cleanup", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start();
  const a = await prepared(f, id);
  await f.t.mutation(internal.ai.researchTools.bindModel, a);
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
  const stopped = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(stopped.state).toBe("cancelled");
  const view = await f.signed.query(api.research.pipeline.results, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  expect(view!.removed).toBe(true);
  expect(view!.results).toEqual([]);
  expect(view!.outcome).toBe("cancelled");
});
test("Q1 physical Agent request uses only remaining order time for abort timeout", async () => {
  const f = await pipelineFixture();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(streamResponse());
  const id = await f.start();
  const a = await prepared(f, id);
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  vi.setSystemTime(o.deadline - 1000);
  const runId = (await f.t.mutation(internal.ai.researchTools.bindModel, a))!;
  const durations: number[] = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    durations.push(ms);
    return new AbortController().signal;
  });
  fetch.mockResolvedValue(
    Response.json({
      id: "semantic",
      object: "chat.completion",
      created: 1791210000,
      model: "synthetic/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ text: '{"items":[]}' }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
  );
  await f.t.action(internal.ai.provider.execute, { runId });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(durations.length).toBeGreaterThan(0);
  expect(Math.max(...durations)).toBeLessThanOrEqual(1000);
});
test("Q2 completion callback cannot repair withdrawal disposition after generation fencing", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start();
  const a = await prepared(f, id);
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: o.pipeline!.sourcePins[0].sourceId,
    reason: "blocked",
  });
  await f.t.mutation(internal.research.pipeline.clearSource, {
    sourceId: o.pipeline!.sourcePins[0].sourceId,
  });
  await f.t.mutation(internal.ai.researchAgent.completed, {
    workflowId: o.pipeline!.workflowId! as WorkflowId,
    result: { kind: "canceled" },
    context: a,
  });
  const current = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(current.state).toBe("cancelled");
  expect(current.pipeline!.outcome).toBe("cancelled");
});

test.each(["pause", "delete"] as const)(
  "profile %s atomically cancels active pipeline disposition",
  async (kind) => {
    const f = await pipelineFixture();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
    const id = await f.start();
    await prepared(f, id);
    await f.signed.mutation(api.research.profiles.change, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 2,
      commandKey: `terminal-${kind}`,
      action: kind === "pause" ? { kind, paused: true } : { kind },
    });
    const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
    expect(o.state).toBe("cancelled");
    expect(o.pipeline!.outcome).toBe("cancelled");
    expect(o.pipeline!.pending).toBeNull();
    expect(o.finishedAt).not.toBeNull();
    expect(o.reason).toBe(
      kind === "pause" ? "RESEARCH_PROFILE_PAUSED" : "RESEARCH_PROFILE_DELETED",
    );
  },
);
test("native budget overrun atomically cancels pipeline disposition and preserves once-only settlement", async () => {
  const f = await pipelineFixture();
  const id = await f.start();
  await f.t.mutation(internal.ai.researchTools.reserve, {
    orderId: id,
    generation: 1,
  });
  const attempt = (
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())
  ).find((t) => "researchOrderId" in t && t.researchOrderId === id)!;
  const receipt = {
    attemptId: attempt._id,
    units: null,
    reportedCost: 1,
    costInvalid: false,
    errorCode: null,
  };
  await f.t.mutation(internal.research.cache.settle, receipt);
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(o.state).toBe("cancelled");
  expect(o.reason).toBe("RESEARCH_BUDGET_OVERRUN");
  expect(o.pipeline!.outcome).toBe("cancelled");
  expect(o.pipeline!.pending).toBeNull();
  const settled = await f.t.run((ctx) => ctx.db.get(attempt._id));
  await f.t.mutation(internal.research.cache.settle, receipt);
  expect(await f.t.run((ctx) => ctx.db.get(attempt._id))).toEqual(settled);
});
test.each(["active", "completed", "partial", "empty"] as const)(
  "retention purge terminalizes only active orders and preserves %s disposition",
  async (kind) => {
    const f = await pipelineFixture();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
    const id = await f.start(),
      a = await prepared(f, id);
    if (kind !== "active") {
      await finishSemantic(
        f,
        id,
        a,
        kind === "empty" ? '{"items":[]}' : undefined,
      );
      if (kind === "partial")
        await f.t.run(async (ctx) => {
          const o = (await ctx.db.get(id))!;
          await ctx.db.patch(id, {
            pipeline: { ...o.pipeline!, outcome: "partial" },
            reason: "RESEARCH_PARTIAL",
          });
        });
    }
    const before = (await f.t.run((ctx) => ctx.db.get(id)))!;
    vi.setSystemTime(before.pipeline!.retentionUntil! + 1);
    await f.t.mutation(internal.research.pipeline.purge, { orderId: id });
    const after = (await f.t.run((ctx) => ctx.db.get(id)))!;
    expect(after.pipeline!.outcome).toBe(
      kind === "active" ? "cancelled" : kind,
    );
    expect(after.state).toBe(kind === "active" ? "cancelled" : "completed");
    expect(after.pipeline!.pending).toBeNull();
    expect(after.finishedAt).not.toBeNull();
    if (kind !== "active") {
      expect(after.reason).toBe(before.reason);
      expect(after.finishedAt).toBe(before.finishedAt);
    }
  },
);

test("published source horizon bounds descendant workflow, prompt, evidence and copied content through scheduled expiry", async () => {
  const f = await pipelineFixture(20000, ["x-recent", "web-search"]);
  const secret = "Distinctive inherited historical quote 231";
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: [
        {
          id: "123456789",
          text: secret,
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ],
    }),
  );
  const parentOrderId = await f.signed.mutation(api.research.native.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "history-parent",
    query: "Parent",
    language: "de",
    operations: ["x-recent"],
  });
  await f.t.action(internal.research.execute.execute, {
    orderId: parentOrderId,
    generation: 1,
  });
  const source = (
    await f.signed.query(api.research.native.results, {
      workspaceId: f.workspaceId,
      orderId: parentOrderId,
    })
  )[0].sources[0];
  const evidenceId = await f.signed.mutation(api.research.evidence.create, {
    workspaceId: f.workspaceId,
    orderId: parentOrderId,
    sourceId: source.sourceId,
    expectedMaterialHash: source.materialHash,
    commandKey: "history-evidence",
    annotation: {
      ...note,
      claim: secret,
      quote: secret,
      interpretation: secret,
    },
  });
  const handoff = {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    evidenceIds: [evidenceId],
    intent: "Prepare unapproved historical proposal",
    target: "draft" as const,
    commandKey: "history-parent-copy",
  };
  const [parentCopy] = await f.signed.mutation(
    api.research.handoff.consume,
    handoff,
  );
  const parent = (await f.t.run((ctx) =>
    ctx.db.get(parentCopy.draftVersionId!),
  ))!;
  const horizon = parent.researchProofUntil!;
  // Controlled exact confirmed facts, no X publishing transport.
  await f.t.run(async (ctx) => {
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: f.workspaceId,
      draftId: parentCopy.draftId!,
      versionId: parent._id,
      accountId: f.accountId,
      actorId: f.userId,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      purpose: "publishing",
      workspaceId: f.workspaceId,
      draftId: parentCopy.draftId!,
      versionId: parent._id,
      accountId: f.accountId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at: Date.now(),
      timezone: "UTC",
      localTime: "fixture",
      state: "published",
      publishedCount: 1,
      errorCode: null,
      jobId: null,
    });
    const attemptId = await ctx.db.insert("xPostAttempts", {
      workspaceId: f.workspaceId,
      scheduleId,
      generation: 1,
      versionId: parent._id,
      accountId: f.accountId,
      providerIdentity: "synthetic",
      connectionSequence: 0,
      position: 0,
      attempt: 1,
      claimSequence: 1,
      leaseUntil: Date.now(),
      deadline: Date.now(),
      stage: "confirmed",
      mediaIds: [],
      externalId: "confirmed-history",
      confirmedAt: Date.now(),
      durationMs: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(scheduleId, {
      externalPosts: [
        {
          position: 0,
          externalId: "confirmed-history",
          url: "https://x.com/synthetic/status/1",
          attemptId,
          confirmedAt: Date.now(),
        },
      ],
    });
  });
  vi.setSystemTime(Date.now() + 100000);
  let childOrderId: Id<"researchOrders">;
  fetch.mockImplementation(async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.tools?.[0]?.type === "web_search") return streamResponse();
    const o = (await f.t.run((ctx) => ctx.db.get(childOrderId)))!;
    expect(o.pipeline!.history).toHaveLength(1);
    expect(JSON.stringify(body.messages)).toContain(secret);
    const pin = o.pipeline!.sourcePins[0];
    const output = JSON.stringify({
      items: [
        {
          title: "Child history",
          sourceId: pin.sourceId,
          materialHash: pin.materialHash,
          annotation: { ...note, claim: secret, interpretation: secret },
          perspective: secret,
          dynamics: "No series",
          clusterId: null,
          clusterRevision: null,
          historyIds: [o.pipeline!.history[0].attemptId],
          copySourceIds: [],
          eventAt: null,
          eventQuote: null,
        },
      ],
    });
    return Response.json({
      id: "history-result",
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
  childOrderId = await f.signed.mutation(api.research.pipeline.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "history-child",
    language: "de",
    operations: ["web-search"],
  });
  await driveUntil(f, childOrderId, (o) => o.state === "completed");
  await vi.advanceTimersByTimeAsync(1000);
  await f.t.finishInProgressScheduledFunctions();
  const child = (await f.t.run((ctx) => ctx.db.get(childOrderId)))!;
  const childEvidence = (await f.t.run((ctx) =>
    ctx.db.get(child.pipeline!.evidenceIds[0]),
  ))!;
  const [copy] = await f.signed.mutation(api.research.handoff.consume, {
    ...handoff,
    evidenceIds: [childEvidence._id],
    commandKey: "history-child-copy",
  });
  const copyVersion = (await f.t.run((ctx) => ctx.db.get(copy.ideaVersionId)))!;
  const cached = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: copy.draftId!,
  }))!;
  expect(cached.versions[0].sourceUnavailable).not.toBe(true);
  expect(child.pipeline!.retentionUntil).toBeLessThanOrEqual(horizon);
  expect(childEvidence.retentionUntil).toBeLessThanOrEqual(horizon);
  expect(copyVersion.researchProofUntil).toBeLessThanOrEqual(horizon);
  expect(
    copyVersion.source.kind === "research" && copyVersion.source.proofUntil,
  ).toBeLessThanOrEqual(horizon);
  expect(cached.versions[0].sourceProofUntil).toBeLessThanOrEqual(horizon);
  const run = (await f.t.run((ctx) => ctx.db.get(child.pipeline!.runId!)))!;
  expect(
    (
      await f.t.query(components.agent.messages.listMessagesByThreadId, {
        threadId: run.threadId,
        order: "asc",
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).page.length,
  ).toBeGreaterThan(1);
  const nativeStatus = await f.t.run((ctx) =>
    workflow.status(ctx, child.pipeline!.workflowId as WorkflowId),
  );
  expect(nativeStatus.type).toBe("completed");
  console.log(
    "Inherited history native Workflow before expiry:",
    nativeStatus.type,
  );
  expect(run.deadline).toBeLessThanOrEqual(horizon);
  const receipts = (ctx: import("../_generated/server").QueryCtx) =>
    Promise.all([
      ctx.db.query("aiAttempts").collect(),
      ctx.db.query("aiBudgets").collect(),
    ]);
  const usageBefore = await f.t.run(receipts);
  expect(usageBefore[0]).toHaveLength(3);
  expect(usageBefore[0].every((a) => a.state === "settled")).toBe(true);
  await vi.advanceTimersByTimeAsync(horizon - Date.now() + 1);
  expect(cached.versions[0].sourceProofUntil!).toBeLessThan(Date.now());
  expect(
    (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: copy.draftId!,
    }))!.versions[0].sourceUnavailable,
  ).toBe(true);
  await f.t.finishAllScheduledFunctions(
    () => vi.advanceTimersByTime(100),
    1000,
  );
  const cleaned = (await f.t.run((ctx) => ctx.db.get(childOrderId)))!;
  expect(cleaned.pipeline).toMatchObject({
    cleanupState: "complete",
    agentCleaned: true,
    workflowCleaned: true,
    outcome: "completed",
    pending: null,
  });
  expect(cleaned.state).toBe("completed");
  const journal = await f.t.run((ctx) =>
    workflow.listSteps(ctx, child.pipeline!.workflowId as WorkflowId, {
      paginationOpts: { cursor: null, numItems: 1 },
    }),
  );
  expect(journal.page).toEqual([]);
  expect(journal.isDone).toBe(true);
  console.log(
    "Inherited history native Workflow after scheduled expiry: journal empty, isDone=true",
  );
  expect(
    (
      await f.t.query(components.agent.messages.listMessagesByThreadId, {
        threadId: run.threadId,
        order: "asc",
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).page,
  ).toEqual([]);
  expect(
    (await f.t.run((ctx) => ctx.db.get(childEvidence._id)))!.payload,
  ).toBeNull();
  const erased = await f.t.run(async (ctx) => ({
    idea: await ctx.db.get(copy.ideaId),
    ideaVersion: await ctx.db.get(copy.ideaVersionId),
    draftVersion: await ctx.db.get(copy.draftVersionId!),
    parentVersion: await ctx.db.get(parent._id),
  }));
  expect(JSON.stringify(erased)).not.toContain(secret);
  expect(erased.draftVersion!.content.text).toEqual(["", ""]);
  expect(await f.t.run(receipts)).toEqual(usageBefore);
  expect(
    await f.t.run((ctx) => ctx.db.query("xPostAttempts").first()),
  ).toMatchObject({
    stage: "confirmed",
    externalId: "confirmed-history",
    durationMs: 1,
  });
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("included cluster context with an already-present source pin still bounds retained descendant copies", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const { first, old } = await seedCluster(f);
  const horizon = Date.now() + 50000;
  // Input-only fixture: two retained evidence dependencies share the same concrete
  // native pins; the second has a shorter immutable evidence horizon. All child
  // proof/retention capture, funded model receipts and public copies are registered.
  const shortEvidenceId = await f.t.run(async (ctx) => {
    const original = (await ctx.db.get(old.pipeline!.evidenceIds[0]))!;
    const { _id, _creationTime, ...copy } = original;
    const id = await ctx.db.insert("researchEvidence", {
      ...copy,
      commandKey: "fixture-short-context",
      retentionUntil: horizon,
    });
    await ctx.db.patch(first, {
      pipeline: {
        ...old.pipeline!,
        evidenceIds: [...old.pipeline!.evidenceIds, id],
      },
    });
    await ctx.db.insert("researchClusters", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      key: "zz-short-context",
      revision: 1,
      evidenceIds: [id],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  });
  vi.mocked(globalThis.fetch).mockResolvedValue(
    streamResponse([
      {
        url: "https://dedup-context.test/new",
        title: "Independent child source",
      },
    ]),
  );
  const childId = await f.signed.mutation(api.research.pipeline.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    operationKey: "dedup-context-child",
    language: "de",
    operations: ["web-search"],
  });
  const args = await prepared(f, childId);
  await finishSemantic(f, childId, args);
  const child = (await f.t.run((ctx) => ctx.db.get(childId)))!;
  expect(child.pipeline!.contextPins).toHaveLength(1);
  expect(child.pipeline!.contextPins![0].until).toBeGreaterThan(horizon);
  expect(child.pipeline!.contextEvidence!.map((p) => p.evidenceId)).toEqual([
    old.pipeline!.evidenceIds[0],
    shortEvidenceId,
  ]);
  expect(child.pipeline!.retentionUntil).toBe(horizon);
  const evidence = (await f.t.run((ctx) =>
    ctx.db.get(child.pipeline!.evidenceIds[0]),
  ))!;
  expect(evidence.retentionUntil).toBe(horizon);
  const [copy] = await f.signed.mutation(api.research.handoff.consume, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    evidenceIds: [evidence._id],
    intent: "Prepare one unapproved context proposal",
    target: "draft",
    commandKey: "dedup-context-copy",
  });
  const idea = (await f.t.run((ctx) => ctx.db.get(copy.ideaVersionId)))!;
  expect(idea.researchProofUntil).toBe(horizon);
  expect(idea.source.kind === "research" && idea.source.proofUntil).toBe(
    horizon,
  );
  expect(
    (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: copy.draftId!,
    }))!.versions[0].sourceProofUntil,
  ).toBe(horizon);
  expect(
    (await f.t.run((ctx) => ctx.db.get(child.pipeline!.runId!)))!.deadline,
  ).toBeLessThanOrEqual(horizon);
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test("personal targeted command admits an immutable topic into the registered workflow and exact replay returns its order", async () => {
  const f = await pipelineFixture();
  const conversationId = await f.signed.mutation(api.ai.conversations.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    operationKey: "target-chat-create",
  });
  const request = {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    conversationId,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "target-chat-request",
    topic: "Explicit synthetic topic",
    language: "de",
    operations: ["web-search" as const],
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse([]));
  const orderId = await f.signed.mutation(
    api.ai.conversations.research,
    request,
  );
  expect(await f.signed.mutation(api.ai.conversations.research, request)).toBe(
    orderId,
  );
  await expect(
    f.signed.mutation(api.ai.conversations.research, {
      ...request,
      topic: "different",
    }),
  ).rejects.toThrow("CONFLICT");
  await f.t.finishAllScheduledFunctions(
    () => vi.advanceTimersByTime(100),
    1000,
  );
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(o.native?.query).toBe(request.topic);
  expect(o.targetedChat).toMatchObject({
    conversationId,
    topic: request.topic,
  });
  expect(o.pipeline?.outcome).toBe("empty");
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  const messages = await f.signed.query(api.ai.conversations.messages, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    threadId: conversationId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(messages.page.some((m) => m.text?.includes(String(orderId)))).toBe(
    true,
  );
});

import {
  sourceFixture,
  send as deliverGithub,
  release,
} from "../../tests/github-fixture";
function syntheticChat(toolArgs?: object) {
  const base = {
    id: "chat-result",
    object: "chat.completion.chunk",
    created: 1791210000,
    model: "synthetic/model",
  };
  const data = [
    {
      ...base,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            ...(toolArgs
              ? {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call-create",
                      type: "function",
                      function: {
                        name: "create_idea",
                        arguments: JSON.stringify(toolArgs),
                      },
                    },
                  ],
                }
              : { content: "Unverified personal perspective" }),
          },
          finish_reason: null,
        },
      ],
    },
    {
      ...base,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: toolArgs ? "tool_calls" : "stop",
        },
      ],
    },
    {
      ...base,
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    },
  ];
  return new Response(
    data.map((d) => `data: ${JSON.stringify(d)}\n\n`).join("") +
      "data: [DONE]\n\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}
async function targetedSetup(withGithub = false) {
  const g = withGithub ? await sourceFixture() : undefined;
  const f = await pipelineFixture(20000, ["web-search"], undefined, g);
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("aiPolicies").first())!;
    await ctx.db.patch(p._id, { purposes: ["research", "chat", "draft"] });
    for (const b of await ctx.db.query("aiBudgets").collect())
      if (b.purposes.includes("research"))
        await ctx.db.patch(b._id, { purposes: ["research", "chat", "draft"] });
  });
  const scope = { workspaceId: f.workspaceId, accountId: f.accountId },
    conversationId = await f.signed.mutation(api.ai.conversations.create, {
      ...scope,
      operationKey: "j05-personal-chat",
    });
  const target = { ...scope, conversationId };
  let orderId: Id<"researchOrders">,
    nativeCalls = 0,
    semanticCalls = 0,
    chatCalls = 0,
    toolNext = false;
  const toolArgs = {
    title: "Compound sourced idea",
    perspective: "Unverified own perspective",
    rationale: "Open interpretation",
    questions: ["What remains unverified?"],
  };
  const physical = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      expect(String(input)).toBe(
        "https://router.eu.requesty.ai/v1/chat/completions",
      );
      const body = JSON.parse(String(init?.body));
      if (body.tools?.[0]?.type === "web_search") {
        nativeCalls++;
        return streamResponse([
          {
            url: `https://example.test/topic-${nativeCalls}`,
            title: `Current distinct topic ${nativeCalls}`,
          },
        ]);
      }
      if (body.stream) {
        chatCalls++;
        const useTool = toolNext;
        toolNext = false;
        return syntheticChat(useTool ? toolArgs : undefined);
      }
      semanticCalls++;
      expect(JSON.stringify(body.messages)).toContain(
        "Explicit targeted topic",
      );
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
              content: JSON.stringify({ text: await modelOutput(f, orderId) }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    });
  if (g) {
    await g.signed.mutation(api.integrations.github.repositories.configure, {
      workspaceId: g.workspaceId,
      repositoryId: g.repositories[0],
      expectedGeneration: 1,
      access: true,
      monitoring: true,
      content: true,
      contextRead: false,
      communicableContext: "Explicit factual context",
    });
    await deliverGithub(g, release, "release");
    const receipt = (await g.t.run((ctx) =>
      ctx.db.query("githubWebhookReceipts").first(),
    ))!;
    await g.t.mutation(internal.integrations.github.deliveries.process, {
      receiptId: receipt._id,
    });
    const signal = (await g.t.run((ctx) =>
      ctx.db.query("githubSignals").first(),
    ))!;
    const ideaId = await f.signed.mutation(api.content.ideas.create, {
      workspaceId: f.workspaceId,
      title: "Release discussion",
      perspective: "Human interpretation",
      note: "Unverified human claim",
      priority: "normal",
      source: { kind: "signal", signalId: signal._id },
      operationKey: "j05-earlier-github",
    });
    const runId = await f.signed.mutation(api.ai.conversations.send, {
      ...target,
      prompt: "Discuss this earlier factual release",
      allowIdeaCreation: false,
      ideaId,
      operationKey: "j05-github-chat",
    });
    await f.t.action(internal.ai.provider.execute, { runId });
  }
  const request = async (n: number) => {
    const args = {
      ...target,
      profileId: f.profileId,
      expectedRevision: 2,
      operationKey: `j05-targeted-${n}`,
      topic: `Explicit targeted topic ${n}`,
      language: "de",
      operations: ["web-search" as const],
    };
    orderId = await f.signed.mutation(api.ai.conversations.research, args);
    await driveUntil(f, orderId, (o) => o.state === "completed");
    await f.t.mutation(internal.ai.conversations.researchResult, { orderId });
    return {
      orderId,
      args,
      order: (await f.t.run((ctx) => ctx.db.get(orderId)))!,
    };
  };
  return {
    ...f,
    g,
    target,
    scope,
    conversationId,
    request,
    physical,
    toolArgs,
    toolNext: () => {
      toolNext = true;
    },
    calls: () => ({ nativeCalls, semanticCalls, chatCalls }),
  };
}
test("J05 actual native Workflow semantic evidence and personal summaries fund a later Agent idea with all historical research/GitHub sources; secondary withdrawal cleans actual copies", async () => {
  const f = await targetedSetup(true),
    first = await f.request(1),
    second = await f.request(2);
  expect(f.calls()).toEqual({ nativeCalls: 2, semanticCalls: 2, chatCalls: 1 });
  for (const r of [first, second]) {
    expect(r.order.pipeline).toMatchObject({
      outcome: "completed",
      inboxReady: true,
    });
    expect(r.order.config.topics).toBe("Product");
    const e = (await f.t.run((ctx) =>
      ctx.db.get(r.order.pipeline!.evidenceIds[0]),
    ))!;
    expect(e.payload!.perspective.topics).toBe(r.args.topic);
    expect(await f.signed.mutation(api.ai.conversations.research, r.args)).toBe(
      r.orderId,
    );
  }
  const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  expect(c.sources).toHaveLength(3);
  const native = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { cursor: null, numItems: 50 },
  });
  expect(JSON.stringify(native)).toContain(
    String(first.order.pipeline!.evidenceIds[0]),
  );
  expect(JSON.stringify(native)).toContain(
    String(second.order.pipeline!.evidenceIds[0]),
  );
  expect(JSON.stringify(native)).toContain("unknown");
  f.toolNext();
  const runId = await f.signed.mutation(api.ai.conversations.send, {
    ...f.target,
    prompt: "Save one own perspective from this history",
    allowIdeaCreation: true,
    operationKey: "j05-save-perspective",
  });
  expect((await f.t.run((ctx) => ctx.db.get(runId)))!.sources).toEqual(
    c.sources,
  );
  await f.t.action(internal.ai.provider.execute, { runId });
  const status = await f.signed.query(api.ai.conversations.status, f.target),
    ideaId = status[0].resultIdeaId!;
  expect(ideaId).not.toBeNull();
  expect(status[0].usagePending).toBe(false);
  const idea = await f.signed.query(api.content.ideas.get, {
    workspaceId: f.workspaceId,
    ideaId,
  });
  expect(idea!.version.source).toEqual({
    kind: "context-set",
    sources: c.sources,
  });
  const draftId = await f.signed.mutation(api.content.ideas.handoff, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    intent: "Prepare a human-reviewed draft",
    draftText: "Protected compound draft text",
    clarificationConfirmed: true,
  });
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: second.order.pipeline!.sourcePins[0].sourceId,
    reason: "blocked",
  });
  expect(
    await f.signed.query(api.ai.conversations.projection, f.target),
  ).toEqual({ authorized: false, proofExpiresAt: 0 });
  expect(
    (
      await f.signed.query(api.ai.conversations.messages, {
        ...f.scope,
        threadId: f.conversationId,
        paginationOpts: { cursor: null, numItems: 50 },
        streamArgs: { kind: "list" },
      })
    ).page,
  ).toEqual([]);
  await expect(
    f.signed.mutation(api.ai.conversations.send, {
      ...f.target,
      prompt: "Source-free bypass",
      allowIdeaCreation: true,
      operationKey: "j05-denied-later",
    }),
  ).rejects.toThrow();
  await f.t.finishAllScheduledFunctions(
    () => vi.advanceTimersByTime(100),
    1000,
  );
  const erased = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: c.threadId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 50 },
    },
  );
  expect(erased.page).toEqual([]);
  expect(erased.isDone).toBe(true);
  expect(
    (await f.t.run((ctx) => ctx.db.get(idea!.version._id)))!.perspective,
  ).toBe("");
  const draft = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: draftId.draftId,
  });
  expect(draft!.versions[0].content.text.every((t) => t === "")).toBe(true);
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).every(
      (a) => a.state === "settled",
    ),
  ).toBe(true);
  expect(f.calls()).toEqual({ nativeCalls: 2, semanticCalls: 2, chatCalls: 3 });
});

test.each([
  "native-policy",
  "native-provider-grant",
  "native-workspace-grant",
  "native-account-grant",
  "generation-policy",
  "generation-provider-grant",
  "generation-workspace-grant",
  "generation-account-grant",
  "account",
  "author",
  "expiry",
])(
  "targeted history and all new funding fail closed after current %s withdrawal",
  async (mode) => {
    const f = await targetedSetup(),
      r = await f.request(1),
      before = f.calls();
    await f.t.run(async (ctx) => {
      if (mode === "native-policy") {
        const p = (await ctx.db.get(f.policies[0]))!;
        await ctx.db.patch(p._id, { enabled: false });
      } else if (mode === "generation-policy") {
        const p = (await ctx.db.query("aiPolicies").first())!;
        await ctx.db.patch(p._id, { enabled: false });
      } else if (mode.includes("grant")) {
        const scope = mode.includes("provider")
          ? "provider"
          : mode.includes("workspace")
            ? "workspace"
            : "account";
        const captured = mode.startsWith("native")
          ? r.order.native!.approvals[0]!.budgetIds
          : r.order.approval!.budgetIds;
        const b = (await ctx.db.get(
          captured[scope === "provider" ? 0 : scope === "workspace" ? 1 : 2],
        ))!;
        await ctx.db.patch(b._id, { purposes: [] });
      } else if (mode === "account")
        await ctx.db.patch(f.accountId, { connection: "disconnected" });
      else if (mode === "author") {
        const m = (await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique())!;
        await ctx.db.patch(m._id, { role: "Viewer" });
      } else {
        const e = (await ctx.db.get(r.order.pipeline!.evidenceIds[0]))!;
        await ctx.db.patch(e._id, { retentionUntil: Date.now() - 1 });
      }
    });
    expect(
      (await f.signed.query(api.ai.conversations.projection, f.target))
        .authorized,
    ).toBe(false);
    const history = await f.signed.query(api.ai.conversations.messages, {
      ...f.scope,
      threadId: f.conversationId,
      paginationOpts: { cursor: null, numItems: 50 },
      streamArgs: { kind: "list" },
    });
    expect(history.page).toEqual([]);
    expect(JSON.stringify(history.streams)).not.toContain("unverified claim");
    await expect(
      f.signed.mutation(api.ai.conversations.send, {
        ...f.target,
        prompt: "Cannot launder retained context",
        allowIdeaCreation: true,
        operationKey: "target-source-less",
      }),
    ).rejects.toThrow();
    expect(f.calls()).toEqual(before);
    await f.signed.mutation(api.ai.conversations.cleanupUnavailable, f.target);
    await f.t.mutation(internal.ai.conversations.cleanup, {
      conversationId: f.conversationId,
    });
    expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))!.state).toBe(
      "deleted",
    );
  },
);
test("research source-aware existing Ideas generation preserves the exact compound source in its actual run and result", async () => {
  const f = await targetedSetup(),
    one = await f.request(1),
    two = await f.request(2);
  f.toolNext();
  const chatRun = await f.signed.mutation(api.ai.conversations.send, {
    ...f.target,
    prompt: "Create my own idea",
    allowIdeaCreation: true,
    operationKey: "ideas-input-chat",
  });
  await f.t.action(internal.ai.provider.execute, { runId: chatRun });
  const ideaId = (
    await f.signed.query(api.ai.conversations.status, f.target)
  )[0].resultIdeaId!;
  const before = (await f.signed.query(api.content.ideas.get, {
    workspaceId: f.workspaceId,
    ideaId,
  }))!;
  const runId = await f.signed.mutation(api.content.ideas.generate, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    ideaId,
    expectedRevision: 1,
    intent: "Explore another explicit perspective",
    operationKey: "compound-generation",
  });
  const bound = (await f.t.run((ctx) => ctx.db.get(runId)))!.sources;
  expect(bound).toHaveLength(4);
  expect(
    bound.filter((s) => s.ideaVersionId === before.version._id),
  ).toHaveLength(2);
  f.physical.mockResolvedValue(
    Response.json({
      id: "perspective",
      object: "chat.completion",
      created: 1791210000,
      model: "synthetic/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              text: JSON.stringify({
                title: "Follow-up idea",
                perspective: "Unverified",
                rationale: "Question",
                questions: ["What remains?"],
              }),
            }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
  );
  await f.t.action(internal.ai.provider.execute, { runId });
  const request = (await f.t.run((ctx) =>
    ctx.db
      .query("contentRequests")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique(),
  ))!;
  const result = (await f.signed.query(api.content.ideas.get, {
    workspaceId: f.workspaceId,
    ideaId: request.resultIdeaId!,
  }))!;
  expect(result.version.source).toEqual({
    kind: "context-set",
    sources: bound,
  });
  expect(result.version.researchProofUntil).toBeLessThanOrEqual(
    before.version.researchProofUntil!,
  );
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: two.order.pipeline!.sourcePins[0].sourceId,
    reason: "blocked",
  });
  await f.t.finishAllScheduledFunctions(
    () => vi.advanceTimersByTime(100),
    1000,
  );
  const run = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  expect(run.sourceCleanupState).toBe("complete");
  expect(
    (
      await f.t.query(components.agent.messages.listMessagesByThreadId, {
        threadId: run.threadId,
        order: "asc",
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).page,
  ).toEqual([]);
  expect(
    (await f.t.run((ctx) => ctx.db.get(result.version._id)))!.perspective,
  ).toBe("");
  expect(one.order.pipeline!.evidenceIds[0]).not.toBe(
    two.order.pipeline!.evidenceIds[0],
  );
});
test("source withdrawal keeps native cleanup pending until an incarnation finishes and permits exactly-once late settlement", async () => {
  const f = await targetedSetup(),
    r = await f.request(1),
    runId = await f.signed.mutation(api.ai.conversations.send, {
      ...f.target,
      prompt: "Explicit own follow-up",
      allowIdeaCreation: true,
      operationKey: "pending-source-chat",
    });
  const control = { runId, generation: 1, executionKey: "pending-execution" };
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: control.executionKey,
  });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    ...control,
    key: "pending-attempt",
  });
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: r.order.pipeline!.sourcePins[0].sourceId,
    reason: "blocked",
  });
  await f.signed.mutation(api.ai.conversations.cleanupUnavailable, f.target);
  await f.t.mutation(internal.ai.conversations.cleanup, {
    conversationId: f.conversationId,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))!.state).toBe(
    "deleting",
  );
  await expect(
    f.t.mutation(internal.ai.conversations.createIdea, {
      ...control,
      ...f.toolArgs,
    }),
  ).rejects.toThrow();
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: null,
    outputTokens: null,
    errorCode: "MODEL_PROVIDER_UNAVAILABLE",
  });
  const held = (await f.t.run((ctx) => ctx.db.get(attemptId)))!.heldMicros;
  expect(held).toBeGreaterThan(0);
  await f.t.mutation(internal.ai.runs.finish, { ...control, failed: true });
  await f.t.mutation(internal.ai.conversations.cleanup, {
    conversationId: f.conversationId,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))!.state).toBe(
    "deleted",
  );
  expect((await f.t.run((ctx) => ctx.db.get(attemptId)))!.heldMicros).toBe(
    held,
  );
  const receipt = {
    attemptId,
    inputTokens: 10,
    outputTokens: 20,
    errorCode: null,
  };
  await f.t.mutation(internal.ai.runs.settle, receipt);
  await f.t.mutation(internal.ai.runs.settle, receipt);
  expect((await f.t.run((ctx) => ctx.db.get(attemptId)))!).toMatchObject({
    state: "settled",
    heldMicros: 0,
    estimatedMicros: 30,
  });
});

async function otherEditor(f: Awaited<ReturnType<typeof targetedSetup>>) {
  const identity = await f.t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Other editor",
          email: "targeted-other@example.test",
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: user._id,
            token: "targeted-other-session",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  const signed = f.t.withIdentity(identity),
    userId = await signed.mutation(api.users.bootstrap, {});
  await f.t.run((ctx) =>
    ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId,
      role: "Editor",
    }),
  );
  return signed;
}
test("targeted domain admission and actual order reads/stop/resume reject raw foreign thread, same-workspace other actor and wrong account", async () => {
  const f = await targetedSetup(),
    r = await f.request(1),
    other = await otherEditor(f),
    c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  const foreignAccount = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...a } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", { ...a, providerIdentity: "other" });
  });
  await expect(
    f.signed.mutation(api.ai.conversations.research, {
      ...r.args,
      accountId: foreignAccount,
      operationKey: "wrong-account",
    }),
  ).rejects.toThrow("CHAT_ACCESS_DENIED");
  await expect(
    f.signed.mutation(api.ai.conversations.research, {
      ...r.args,
      conversationId: c.threadId as Id<"conversations">,
      operationKey: "raw-thread",
    }),
  ).rejects.toThrow();
  for (const action of [
    () =>
      other.mutation(api.ai.conversations.research, {
        ...r.args,
        operationKey: "wrong-actor",
      }),
    () => other.query(api.ai.conversations.researchStatus, f.target),
    () =>
      other.query(api.research.pipeline.results, {
        workspaceId: f.workspaceId,
        orderId: r.orderId,
      }),
    () =>
      other.query(api.research.native.results, {
        workspaceId: f.workspaceId,
        orderId: r.orderId,
      }),
    () =>
      other.mutation(api.research.runs.stop, {
        workspaceId: f.workspaceId,
        orderId: r.orderId,
      }),
    () =>
      other.mutation(api.research.pipeline.resume, {
        workspaceId: f.workspaceId,
        orderId: r.orderId,
      }),
  ])
    await expect(action()).rejects.toThrow("CHAT_ACCESS_DENIED");
  expect(f.calls()).toEqual({ nativeCalls: 1, semanticCalls: 1, chatCalls: 0 });
});
test("unknown native receipt prevents a key-rotated identical topic from repeating paid transport; exact retry retains actual order", async () => {
  const f = await targetedSetup();
  let calls = 0;
  f.physical.mockImplementation(async () => {
    calls++;
    throw new Error("synthetic lost response");
  });
  const r = await f.request(1);
  expect(await f.signed.mutation(api.ai.conversations.research, r.args)).toBe(
    r.orderId,
  );
  const again = await f.signed.mutation(api.ai.conversations.research, {
    ...r.args,
    operationKey: "rotated-identical-topic",
  });
  await driveUntil(f, again, (o) => !!o.finishedAt);
  expect(calls).toBe(1);
  const receipts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(receipts).toHaveLength(1);
  expect(receipts[0].state).toBe("unknown");
  expect(receipts[0].heldMicros).toBeGreaterThan(0);
  await expect(
    f.signed.mutation(api.research.pipeline.resume, {
      workspaceId: f.workspaceId,
      orderId: r.orderId,
    }),
  ).rejects.toThrow("RESUME_UNAVAILABLE");
});
test("removing the original personal chat while native transport is sent fences semantic model and summary delivery without losing confirmed usage", async () => {
  const f = await targetedSetup();
  let calls = 0;
  f.physical.mockImplementation(async () => {
    calls++;
    expect(
      (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!.state,
    ).toBe("sent");
    await f.signed.mutation(api.ai.conversations.remove, f.target);
    return streamResponse();
  });
  const orderId = await f.signed.mutation(api.ai.conversations.research, {
    ...f.target,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "delete-in-native",
    topic: "Explicit targeted topic removal",
    language: "de",
    operations: ["web-search"],
  });
  await driveUntil(f, orderId, (o) => !!o.finishedAt);
  await f.t.mutation(internal.ai.conversations.researchResult, { orderId });
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(o.pipeline!.runId).toBeNull();
  expect(o.targetedChat!.messageId).toBeNull();
  expect(calls).toBe(1);
  const receipt = (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!;
  expect(receipt.state).toBe("settled");
  expect(receipt.estimatedMicros).toBe(20);
  await f.t.run((ctx) => ctx.db.patch(f.conversationId, { cleanupAfter: 0 }));
  await f.t.mutation(internal.ai.conversations.cleanup, {
    conversationId: f.conversationId,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))!.state).toBe(
    "deleted",
  );
});
test("missing semantic configuration has an honest partial result with no second paid chat and no source-free summary", async () => {
  const f = await targetedSetup();
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("aiPolicies").first())!;
    await ctx.db.patch(p._id, { purposes: ["chat"] });
  });
  const r = await f.request(1);
  expect(r.order.pipeline!.runId).toBeNull();
  expect(r.order.pipeline!.evidenceIds).toEqual([]);
  expect(f.calls()).toEqual({ nativeCalls: 1, semanticCalls: 0, chatCalls: 0 });
  const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  expect(c.sources).toEqual([]);
  const native = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { cursor: null, numItems: 50 },
  });
  expect(JSON.stringify(native)).toContain("Keine belegte Zusammenfassung");
  expect(JSON.stringify(native)).not.toContain("unverified claim");
});

test("new immutable GitHub capture expiry remains closed after repository proof renewal for server history, compound reads and physical follow-ups", async () => {
  const f = await targetedSetup(true);
  f.toolNext();
  const runId = await f.signed.mutation(api.ai.conversations.send, {
    ...f.target,
    prompt: "Create one idea from the earlier release",
    allowIdeaCreation: true,
    operationKey: "gh-captured-result",
  });
  await f.t.action(internal.ai.provider.execute, { runId });
  const ideaId = (
    await f.signed.query(api.ai.conversations.status, f.target)
  )[0].resultIdeaId!;
  const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!,
    pin = c.sources.find((s) => !("kind" in s))!;
  expect("signalId" in pin && pin.signalId).toBeTruthy();
  expect(pin.ideaVersionId).toBe(c.ideaVersionIds[0]);
  const expiry = pin.proofUntil!;
  const before = f.calls();
  vi.setSystemTime(expiry + 1);
  await f.t.run((ctx) =>
    ctx.db.patch(f.g!.repositories[0], { proofExpiresAt: Date.now() + 900000 }),
  );
  expect(
    (await f.signed.query(api.ai.conversations.projection, f.target))
      .authorized,
  ).toBe(false);
  expect(
    (
      await f.signed.query(api.ai.conversations.messages, {
        ...f.scope,
        threadId: f.conversationId,
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).page,
  ).toEqual([]);
  expect(
    (await f.signed.query(api.content.ideas.get, {
      workspaceId: f.workspaceId,
      ideaId,
    }))!.version.sourceUnavailable,
  ).toBe(true);
  await expect(
    f.signed.mutation(api.ai.conversations.send, {
      ...f.target,
      prompt: "Expired capture cannot be renewed",
      allowIdeaCreation: true,
      operationKey: "gh-renewed-bypass",
    }),
  ).rejects.toThrow("MODEL_SOURCE_EXPIRED");
  await expect(
    f.signed.mutation(api.content.ideas.generate, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      ideaId,
      expectedRevision: 1,
      intent: "A funded source-aware follow-up",
      operationKey: "gh-expired-generation",
    }),
  ).rejects.toThrow("MODEL_SOURCE_EXPIRED");
  expect(f.calls()).toEqual(before);
});
test("immutable earlier idea version remains part of compound provenance after native cleanup and its archive fences the descendant", async () => {
  const f = await targetedSetup(true),
    r = await f.request(1);
  f.toolNext();
  const runId = await f.signed.mutation(api.ai.conversations.send, {
    ...f.target,
    prompt: "Keep earlier source version and research",
    allowIdeaCreation: true,
    operationKey: "lineage-result",
  });
  await f.t.action(internal.ai.provider.execute, { runId });
  const ideaId = (
      await f.signed.query(api.ai.conversations.status, f.target)
    )[0].resultIdeaId!,
    c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  const original = (await f.t.run((ctx) => ctx.db.get(c.ideaVersionIds[0])))!;
  const result = (await f.signed.query(api.content.ideas.get, {
    workspaceId: f.workspaceId,
    ideaId,
  }))!;
  expect(result.version.source.kind).toBe("context-set");
  if (result.version.source.kind !== "context-set")
    throw new Error("missing source contract");
  expect(
    result.version.source.sources.some(
      (s) =>
        s.ideaVersionId === original._id &&
        !("kind" in s) &&
        s.signalId ===
          (original.source.kind === "signal" ? original.source.signalId : null),
    ),
  ).toBe(true);
  await f.signed.mutation(api.ai.conversations.remove, f.target);
  await f.t.run((ctx) => ctx.db.patch(f.conversationId, { cleanupAfter: 0 }));
  await f.t.mutation(internal.ai.conversations.cleanup, {
    conversationId: f.conversationId,
  });
  expect(
    (await f.signed.query(api.content.ideas.get, {
      workspaceId: f.workspaceId,
      ideaId,
    }))!.version.sourceUnavailable,
  ).not.toBe(true);
  await f.signed.mutation(api.content.ideas.archive, {
    workspaceId: f.workspaceId,
    ideaId: original.ideaId,
    expectedRevision: 1,
    archived: true,
    feedback: "Withdraw this earlier input",
  });
  expect(
    (await f.signed.query(api.content.ideas.get, {
      workspaceId: f.workspaceId,
      ideaId,
    }))!.version.sourceUnavailable,
  ).toBe(true);
  expect(r.order.pipeline!.evidenceIds.length).toBe(1);
});

test("targeted semantic funding rechecks an earlier chat source withdrawn during native search", async () => {
  const f = await targetedSetup(true);
  let calls = 0;
  f.physical.mockImplementation(async () => {
    calls++;
    await f.t.run((ctx) =>
      ctx.db.patch(f.g!.repositories[0], { access: false }),
    );
    return streamResponse();
  });
  const orderId = await f.signed.mutation(api.ai.conversations.research, {
    ...f.target,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "earlier-source-withdrawal",
    topic: "Explicit targeted topic with earlier context",
    language: "de",
    operations: ["web-search"],
  });
  await driveUntil(f, orderId, (o) => !!o.finishedAt);
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(o.pipeline!.runId).toBeNull();
  expect(calls).toBe(1);
  await f.t.mutation(internal.ai.conversations.researchResult, { orderId });
  expect(
    (await f.t.run((ctx) => ctx.db.get(orderId)))!.targetedChat!.messageId,
  ).toBeNull();
  expect(
    (await f.signed.query(api.ai.conversations.projection, f.target))
      .authorized,
  ).toBe(false);
});

test("compound Draft proof retains upstream Research version ownership and shares overlapping material walk", async () => {
  const f = await targetedSetup();
  const r = await f.request(1);
  const [upstream] = await f.signed.mutation(api.research.handoff.consume, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    evidenceIds: [r.order.pipeline!.evidenceIds[0]],
    target: "idea",
    intent: "Retain original Review",
    commandKey: "compound-upstream",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.conversationId, {
      ideaVersionIds: [upstream.ideaVersionId!],
    }),
  );
  f.toolNext();
  const runId = await f.signed.mutation(api.ai.conversations.send, {
    ...f.target,
    prompt: "Save this sourced perspective",
    allowIdeaCreation: true,
    operationKey: "compound-version-followup",
  });
  await f.t.action(internal.ai.provider.execute, { runId });
  const ideaId = (
    await f.signed.query(api.ai.conversations.status, f.target)
  )[0].resultIdeaId!;
  const d = await f.signed.mutation(api.content.ideas.handoff, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    intent: "Prepare Review",
    draftText: "Protected lineage draft",
    clarificationConfirmed: true,
  });
  // The same retained order occurs in a primitive and an exact version pin.
  const before = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: d.draftId,
  }))!;
  expect(before.versions[0].sourceUnavailable).not.toBe(true);
  // Controlled exact confirmed facts, no X publishing transport.
  const historyPin = await f.t.run(async (ctx) => {
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: f.workspaceId,
      draftId: d.draftId,
      versionId: before.versions[0]._id,
      accountId: f.accountId,
      actorId: f.userId,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      purpose: "publishing",
      workspaceId: f.workspaceId,
      draftId: d.draftId,
      versionId: before.versions[0]._id,
      accountId: f.accountId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at: Date.now(),
      timezone: "UTC",
      localTime: "fixture",
      state: "published",
      publishedCount: 1,
      errorCode: null,
      jobId: null,
    });
    const attemptId = await ctx.db.insert("xPostAttempts", {
      workspaceId: f.workspaceId,
      scheduleId,
      generation: 1,
      versionId: before.versions[0]._id,
      accountId: f.accountId,
      providerIdentity: "synthetic",
      connectionSequence: 0,
      position: 0,
      attempt: 1,
      claimSequence: 1,
      leaseUntil: Date.now(),
      deadline: Date.now(),
      stage: "confirmed",
      mediaIds: [],
      externalId: "confirmed-history",
      confirmedAt: Date.now(),
      durationMs: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(scheduleId, {
      externalPosts: [
        {
          position: 0,
          externalId: "confirmed-history",
          url: "https://x.com/synthetic/status/1",
          attemptId,
          confirmedAt: Date.now(),
        },
      ],
    });
    return {
      scheduleId,
      attemptId,
      versionId: before.versions[0]._id,
      position: 0,
      externalId: "confirmed-history",
      confirmedAt: Date.now(),
      materialHash: await sha256(
        JSON.stringify([
          before.versions[0].content.title,
          before.versions[0].content.text[0],
          Date.now(),
          "confirmed-history",
        ]),
      ),
    };
  });
  const second = await f.request(2);
  await f.t.run((ctx) =>
    ctx.db.patch(second.order._id, {
      pipeline: { ...second.order.pipeline!, history: [historyPin] },
    }),
  );
  const currentHistory = () =>
    f.signed.query(api.research.evidence.list, {
      workspaceId: f.workspaceId,
      orderId: second.order._id,
    });
  expect((await currentHistory())[0].payload).not.toBeNull();
  // Controlled retained cache-hit ancestors exercise the existing 32-order bound.
  const ancestors = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...base } = r.order;
    const ids: Id<"researchOrders">[] = [];
    for (let i = 0; i < 31; i++) {
      const ancestor = await ctx.db.insert("researchOrders", {
        ...base,
        operationKey: `compound-ancestor-${i}`,
        native: {
          ...base.native!,
          outcomes: base.native!.outcomes.map((o) => ({
            ...o,
            cacheHit: true,
          })),
        },
        pipeline: {
          ...base.pipeline!,
          runId: null,
          history: [],
          contextEvidence: [],
          contextPins: [
            { ...base.pipeline!.sourcePins[0], orderId: ids.at(-1) ?? _id },
          ],
        },
      });
      ids.push(ancestor);
    }
    await ctx.db.patch(second.order._id, {
      pipeline: {
        ...second.order.pipeline!,
        history: [historyPin],
        contextPins: [{ ...r.order.pipeline!.sourcePins[0], orderId: ids[26] }],
      },
    });
    return ids;
  });
  // Orders and the retained Draft/Idea/chat-run ancestors share one 32-node budget.
  expect((await currentHistory())[0].payload).toBeNull();
  await f.t.run((ctx) =>
    ctx.db.patch(second.order._id, {
      pipeline: {
        ...second.order.pipeline!,
        history: [historyPin],
        contextPins: [
          { ...r.order.pipeline!.sourcePins[0], orderId: ancestors[25] },
        ],
      },
    }),
  );
  expect((await currentHistory())[0].payload).not.toBeNull();
  await f.t.run(async (ctx) => {
    const cycle = (await ctx.db.get(ancestors[25]))!;
    await ctx.db.patch(cycle._id, {
      pipeline: {
        ...cycle.pipeline!,
        contextPins: [
          { ...r.order.pipeline!.sourcePins[0], orderId: cycle._id },
        ],
      },
    });
  });
  expect((await currentHistory())[0].payload).toBeNull();
  await f.t.run((ctx) =>
    ctx.db.patch(second.order._id, {
      pipeline: { ...second.order.pipeline!, history: [historyPin] },
    }),
  );
  expect((await currentHistory())[0].payload).not.toBeNull();
  await f.signed.mutation(api.content.ideas.archive, {
    workspaceId: f.workspaceId,
    ideaId: upstream.ideaId,
    expectedRevision: 1,
    archived: true,
    feedback: "Withdraw original Review",
  });
  expect(
    (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: d.draftId,
    }))!.versions[0].sourceUnavailable,
  ).toBe(true);
  expect((await currentHistory())[0].payload).toBeNull();
  await expect(
    f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId: before.versions[0]._id,
      accountId: f.accountId,
    }),
  ).rejects.toThrow("IDEA_SOURCE_CHANGED");
});

async function scheduledAutomatic(
  target: "idea" | "draft" = "draft",
  count = 3,
  unresolved = false,
) {
  const operations: ("x-recent" | "web-search")[] = unresolved
    ? ["x-recent", "web-search"]
    : ["x-recent"];
  const f = await pipelineFixture(20000, operations);
  const config = (await f.t.run(async (ctx) =>
    ctx.db.get((await ctx.db.get(f.profileId))!.currentVersionId!),
  ))!.config;
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "auto-save-option",
    action: {
      kind: "save",
      config: {
        ...config,
        frequency: "daily",
        autoHandoff: {
          kind: "bounded-editorial-v1",
          count,
          target,
          intent: "Prepare bounded unapproved drafts",
        },
      },
    },
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    commandKey: "auto-activate-v2",
    action: {
      kind: "activate-workflow",
      language: "de",
      operations,
    },
  });
  const p = (await f.t.run((ctx) => ctx.db.get(f.profileId)))!;
  vi.setSystemTime(p.nextAt!);
  let orderId: Id<"researchOrders">;
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
    if (JSON.parse(String(init.body)).tools?.[0]?.type === "web_search")
      throw new Error("Synthetic search response lost");
    const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
    const output = JSON.parse(await modelOutput(f, orderId));
    output.items[0].annotation = {
      ...note,
      claim: "Current public supported source",
      quote: "Current public supported source",
      freshness: "context-dependent",
    };
    expect(o.automaticHandoff?.state).toBe("awaiting-review");
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
    profileId: p._id,
    generation: p.scheduleGeneration,
    at: p.nextAt!,
  }))!;
  await driveUntil(f, orderId, (o) => o.state === "completed");
  await f.t.mutation(internal.research.handoff.automatic, { orderId });
  return { ...f, orderId, p };
}

test("J04 marked v2 scheduled Workflow waits for actual human review, then freezes underfilled unapproved Draft receipt once", async () => {
  const f = await scheduledAutomatic();
  const o = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!;
  expect(o.automaticHandoff?.state).toBe("awaiting-review");
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
  const review = {
    workspaceId: f.workspaceId,
    evidenceId: o.pipeline!.evidenceIds[0],
    commandKey: "auto-human-review",
    maxAgeMs: 86400000,
    validUntil: Date.now() + 300000,
    reason: "Explicit current support assessment",
    substantiveSupportAttested: true,
    eventAt: null,
    eventQuote: null,
  };
  const reviewedId = await f.signed.mutation(
    api.research.evidence.review,
    review,
  );
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: f.orderId,
  });
  const final = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!;
  expect(final.automaticHandoff?.state).toBe("completed");
  expect(final.automaticHandoff?.selection).toEqual([reviewedId]);
  expect(final.automaticHandoff?.results).toHaveLength(1);
  expect(final.automaticHandoff?.option.count).toBe(3);
  const result = final.automaticHandoff!.results![0];
  const draft = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: result.draftId!,
  }))!;
  expect(draft.approvals).toEqual([]);
  expect(draft.schedules).toEqual([]);
  await f.signed.mutation(api.research.evidence.review, {
    ...review,
    commandKey: "auto-second-review",
  });
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: f.orderId,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.orderId)))!.automaticHandoff,
  ).toEqual(final.automaticHandoff);
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
});

test.each(["actor-editor", "save", "pause", "native-revoke"] as const)(
  "marked auto reauthorizes %s before insertion without losing settled usage",
  async (kind) => {
    const f = await scheduledAutomatic();
    const o = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!;
    await f.signed.mutation(api.research.evidence.review, {
      workspaceId: f.workspaceId,
      evidenceId: o.pipeline!.evidenceIds[0],
      commandKey: "auto-negative-review",
      maxAgeMs: 86400000,
      validUntil: Date.now() + 300000,
      reason: "Actual human support assessment",
      substantiveSupportAttested: true,
      eventAt: null,
      eventQuote: null,
    });
    if (kind === "actor-editor")
      await f.t.run(async (ctx) => {
        const membership = await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique();
        await ctx.db.patch(membership!._id, { role: "Editor" });
      });
    if (kind === "save" || kind === "pause")
      await f.signed.mutation(api.research.profiles.change, {
        workspaceId: f.workspaceId,
        profileId: f.profileId,
        expectedRevision: 4,
        commandKey: "auto-withdraw-profile",
        action:
          kind === "pause"
            ? { kind: "pause", paused: true }
            : { kind: "save", config: o.config },
      });
    if (kind === "native-revoke")
      await f.t.run((ctx) => ctx.db.patch(f.policies[0], { enabled: false }));
    await f.t.mutation(internal.research.handoff.automatic, {
      orderId: f.orderId,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.orderId)))!.automaticHandoff?.state,
    ).toBe("withdrawn");
    expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
    const attempts = await f.t.run((ctx) =>
      ctx.db.query("aiAttempts").collect(),
    );
    expect(attempts).toHaveLength(2);
    expect(
      attempts.every((t) => t.state === "settled" && t.heldMicros === 0),
    ).toBe(true);
  },
);

test("Inbox re-research is a new current typed parent workflow with exact topic and inherited expiry, never automatic", async () => {
  const f = await targetedSetup();
  const first = await f.request(1);
  const parentId = first.order.pipeline!.evidenceIds[0];
  const args = {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    evidenceId: parentId,
    topic: "Explicit new inherited research topic",
    operationKey: "inbox-new-research",
    language: "de",
    operations: ["web-search" as const],
  };
  // This lineage check is implementation-first validation, not a retrospective TDD RED.
  const id = await f.signed.mutation(api.research.pipeline.reResearch, args);
  expect(id).not.toBe(first.orderId);
  expect(await f.signed.mutation(api.research.pipeline.reResearch, args)).toBe(
    id,
  );
  const o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(o.targetedChat).toBeUndefined();
  expect(o.automaticHandoff).toBeUndefined();
  expect(o.reResearch?.parent.evidenceId).toBe(parentId);
  expect(o.native?.query).toBe(args.topic);
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: o.reResearch!.parent.sourceId,
    reason: "blocked",
  });
  await expect(
    f.signed.mutation(api.research.pipeline.reResearch, args),
  ).rejects.toThrow();
  await expect(
    f.t.query(internal.research.native.context, {
      orderId: id,
      generation: 1,
      operation: "web-search",
    }),
  ).rejects.toThrow();
  expect(f.calls().nativeCalls).toBe(1);
});

test("new Inbox child counts itself toward shared32 before native or model funding", async () => {
  const f = await targetedSetup(),
    r = await f.request(1);
  // Controlled cache-hit graph inputs only; no invented paid provider executions.
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, targetedChat: _chat, ...base } = r.order;
    let previous: Id<"researchOrders"> | null = null;
    for (let i = 0; i < 31; i++)
      previous = await ctx.db.insert("researchOrders", {
        ...base,
        operationKey: `inbox-ancestor-${i}`,
        native: {
          ...base.native!,
          outcomes: base.native!.outcomes.map((o) => ({
            ...o,
            cacheHit: true,
          })),
        },
        pipeline: {
          ...base.pipeline!,
          runId: null,
          history: [],
          contextEvidence: [],
          contextPins: previous
            ? [{ ...base.pipeline!.sourcePins[0], orderId: previous }]
            : [],
        },
      });
    await ctx.db.patch(r.orderId, {
      pipeline: {
        ...r.order.pipeline!,
        contextPins: [{ ...base.pipeline!.sourcePins[0], orderId: previous! }],
      },
    });
  });
  expect(
    (
      await f.signed.query(api.research.evidence.list, {
        workspaceId: f.workspaceId,
        orderId: r.orderId,
      })
    )[0].payload,
  ).not.toBeNull();
  await expect(
    f.signed.mutation(api.research.pipeline.reResearch, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 2,
      evidenceId: r.order.pipeline!.evidenceIds[0],
      topic: "Ancestry bounded child",
      operationKey: "inbox-ancestry-child",
      language: "de",
      operations: ["web-search"],
    }),
  ).rejects.toThrow("ANCESTRY_LIMIT");
  expect(f.calls()).toEqual({ nativeCalls: 1, semanticCalls: 1, chatCalls: 0 });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.profileId)))!.activeOrderId,
  ).toBeNull();
});

test.each([false, true])(
  "no-GitHub Inbox parent→new native Workflow/Agent→manual/model descendant Drafts retain original finite secondary lineage and actual erasure (historical completion marker=%s)",
  async (historicalComplete) => {
    const f = await pipelineFixture(20000, ["x-recent"]);
    let id: Id<"researchOrders">,
      nativeCalls = 0,
      semanticCalls = 0;
    const physical = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_input, init) => {
        if (!init?.body) {
          nativeCalls++;
          return Response.json({
            data: [0, 1].map((n) => ({
              id: String(123456780 + nativeCalls * 10 + n),
              text: `Public current source ${nativeCalls}`,
              created_at: new Date(Date.now() - 60000).toISOString(),
            })),
          });
        }
        semanticCalls++;
        const body = JSON.parse(String(init.body)),
          o = (await f.t.run((ctx) => ctx.db.get(id)))!,
          output = JSON.parse(await modelOutput(f, id));
        output.items[0].copySourceIds = [o.pipeline!.sourcePins[1].sourceId];
        if (o.reResearch) {
          expect(JSON.stringify(body.messages)).toContain(
            "Follow the inherited explicit topic",
          );
          expect(JSON.stringify(body.messages)).toContain(
            o.reResearch.parent.evidenceId,
          );
          expect(JSON.stringify(body.messages)).toContain("unverified claim");
        }
        return Response.json({
          id: "lineage-semantic",
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
    id = await f.start("lineage-parent-current");
    await driveUntil(f, id, (o) => o.state === "completed");
    const parent = (await f.t.run((ctx) => ctx.db.get(id)))!,
      parentId = parent.pipeline!.evidenceIds[0];
    const parentView = (
      await f.signed.query(api.research.evidence.list, {
        workspaceId: f.workspaceId,
        orderId: id,
      })
    )[0];
    expect(parentView.payload!.model!.copySourceIds).toEqual([
      parent.pipeline!.sourcePins[1].sourceId,
    ]);
    const args = {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 2,
      evidenceId: parentId,
      topic: "Follow the inherited explicit topic",
      operationKey: "lineage-child-current",
      language: "de",
      operations: ["x-recent" as const],
    };
    id = await f.signed.mutation(api.research.pipeline.reResearch, args);
    await driveUntil(f, id, (o) => o.state === "completed");
    const child = (await f.t.run((ctx) => ctx.db.get(id)))!,
      childEvidence = child.pipeline!.evidenceIds[0];
    expect(child.pipeline!.retentionUntil).toBeLessThanOrEqual(
      parentView.proofUntil,
    );
    expect(
      (await f.t.run((ctx) => ctx.db.get(childEvidence)))!.retentionUntil,
    ).toBeLessThanOrEqual(parentView.proofUntil);
    const [copy] = await f.signed.mutation(api.research.handoff.consume, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      evidenceIds: [childEvidence],
      target: "draft",
      intent: "Human explicit descendant draft",
      commandKey: "lineage-child-copy",
    });
    const original = (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: copy.draftId!,
    }))!;
    expect(original.versions[0].sourceProofUntil).toBeLessThanOrEqual(
      parentView.proofUntil,
    );
    const childManual = await f.signed.mutation(api.research.evidence.create, {
      workspaceId: f.workspaceId,
      orderId: id,
      sourceId: child.pipeline!.sourcePins[0].sourceId,
      expectedMaterialHash: child.pipeline!.sourcePins[0].materialHash,
      commandKey: "lineage-manual-child",
      annotation: { ...note, claim: "Inherited manual child protected claim" },
    });
    // More than the retirement batch exercises the same order-index continuation.
    const additionalManual: Id<"researchEvidence">[] = [];
    for (let n = 0; n < 20; n++)
      additionalManual.push(
        await f.signed.mutation(api.research.evidence.create, {
          workspaceId: f.workspaceId,
          orderId: id,
          sourceId: child.pipeline!.sourcePins[0].sourceId,
          expectedMaterialHash: child.pipeline!.sourcePins[0].materialHash,
          commandKey: `lineage-manual-child-${n}`,
          annotation: { ...note, claim: `Inherited manual continuation ${n}` },
        }),
      );
    const [manualCopy] = await f.signed.mutation(api.research.handoff.consume, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      evidenceIds: [childManual],
      target: "draft",
      intent: "Explicit manual descendant draft",
      commandKey: "lineage-manual-copy",
    });
    const receiptsBefore = await f.t.run((ctx) =>
      ctx.db.query("aiAttempts").collect(),
    );
    expect(child.automaticHandoff).toBeUndefined();
    expect(nativeCalls).toBe(2);
    expect(semanticCalls).toBe(2);
    expect(physical).toHaveBeenCalledTimes(4);
    expect(
      await f.t.run((ctx) => ctx.db.query("githubRepositories").collect()),
    ).toEqual([]);
    await f.signed.mutation(api.research.cache.invalidate, {
      workspaceId: f.workspaceId,
      sourceId: parent.pipeline!.sourcePins[1].sourceId,
      reason: "blocked",
    });
    const hidden = (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: copy.draftId!,
    }))!;
    expect(hidden.versions[0].sourceUnavailable).toBe(true);
    expect(hidden.versions[0].content.text.every((t) => t === "")).toBe(true);
    const manualHidden = (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: manualCopy.draftId!,
    }))!;
    expect(manualHidden.versions[0].sourceUnavailable).toBe(true);
    expect(manualHidden.versions[0].content.text.every((t) => t === "")).toBe(
      true,
    );
    if (historicalComplete) {
      // Controlled historical marker input only: all actual native completion flags,
      // messages, evidence, copies and financial receipts remain untouched.
      await f.t.run(async (ctx) => {
        const current = (await ctx.db.get(id))!;
        await ctx.db.patch(id, {
          pipeline: { ...current.pipeline!, cleanupState: "complete" },
        });
      });
    }
    await f.t.mutation(internal.research.pipeline.purge, { orderId: id });
    // Drain due cleanup only, before original finite retention expiry.
    for (let n = 0; n < 120; n++) {
      await vi.advanceTimersByTimeAsync(100);
      await f.t.finishInProgressScheduledFunctions();
    }
    const manual = (await f.t.run((ctx) => ctx.db.get(childManual)))!;
    expect(manual.retentionUntil - Date.now()).toBeGreaterThan(280000);
    expect(manual.state).toBe("removed");
    expect(manual.payload).toBeNull();
    for (const evidenceId of additionalManual) {
      const e = (await f.t.run((ctx) => ctx.db.get(evidenceId)))!;
      expect(e.state).toBe("removed");
      expect(e.payload).toBeNull();
    }
    const manualIdea = (await f.t.run((ctx) =>
      ctx.db.get(manualCopy.ideaVersionId),
    ))!;
    const manualDraft = (await f.t.run((ctx) =>
      ctx.db.get(manualCopy.draftVersionId!),
    ))!;
    expect(manualIdea.note).toBe("");
    expect(manualIdea.researchCleanupPending).toBe(false);
    expect(manualDraft.content.text.every((t) => t === "")).toBe(true);
    expect(manualDraft.researchCleanupPending).toBe(false);
    expect(
      (await f.t.run((ctx) => ctx.db.get(id)))!.pipeline!.cleanupState,
    ).toBe("complete");
    expect((await f.t.run((ctx) => ctx.db.get(childEvidence)))!.state).toBe(
      "removed",
    );
    expect(
      (await f.t.run((ctx) => ctx.db.get(copy.draftVersionId!)))!
        .researchCleanupPending,
    ).toBe(false);
    const run = (await f.t.run((ctx) => ctx.db.get(child.pipeline!.runId!)))!;
    expect(
      (
        await f.t.query(components.agent.messages.listMessagesByThreadId, {
          threadId: run.threadId,
          order: "asc",
          paginationOpts: { cursor: null, numItems: 20 },
        })
      ).page,
    ).toEqual([]);
    const receipts = await f.t.run((ctx) =>
      ctx.db.query("aiAttempts").collect(),
    );
    expect(receipts).toEqual(receiptsBefore);
    expect(receipts).toHaveLength(4);
    expect(receipts.every((t) => t.state === "settled")).toBe(true);
  },
);

test("marked automatic Idea target is explicit and manual current-config admissions remain inert", async () => {
  const f = await scheduledAutomatic("idea", 1),
    o = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!;
  await f.signed.mutation(api.research.evidence.review, {
    workspaceId: f.workspaceId,
    evidenceId: o.pipeline!.evidenceIds[0],
    commandKey: "auto-explicit-idea-review",
    maxAgeMs: 86400000,
    validUntil: Date.now() + 300000,
    reason: "Explicit current support assessment",
    substantiveSupportAttested: true,
    eventAt: null,
    eventQuote: null,
  });
  await f.t.mutation(internal.research.handoff.automatic, { orderId: o._id });
  const auto = (await f.t.run((ctx) => ctx.db.get(o._id)))!.automaticHandoff!;
  expect(auto.option.target).toBe("idea");
  expect(auto.results).toHaveLength(1);
  expect(auto.results![0].draftId).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toEqual([]);
  const manualId = await f.signed.mutation(api.research.pipeline.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 4,
    operationKey: "manual-under-auto-config",
    language: "de",
    operations: ["x-recent"],
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(manualId)))!.automaticHandoff,
  ).toBeUndefined();
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: manualId,
  });
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
});

test("already-finalized false-version Workflow never acquires auto from later saved v2 activation", async () => {
  const f = await pipelineFixture();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse([]));
  const id = await f.start("old-finalized-workflow");
  await driveUntil(f, id, (o) => o.state === "completed");
  const old = (await f.t.run((ctx) => ctx.db.get(id)))!;
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "later-enabled-save",
    action: {
      kind: "save",
      config: {
        ...old.config,
        frequency: "daily",
        autoHandoff: {
          kind: "bounded-editorial-v1",
          target: "idea",
          count: 5,
          intent: "Only future explicit scheduled workflow",
        },
      },
    },
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    commandKey: "later-v2-activation",
    action: {
      kind: "activate-workflow",
      language: "de",
      operations: ["web-search"],
    },
  });
  await f.t.mutation(internal.research.handoff.automatic, { orderId: id });
  expect(
    (await f.t.run((ctx) => ctx.db.get(id)))!.automaticHandoff,
  ).toBeUndefined();
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.config.autoHandoff).toBe(
    false,
  );
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
});

test("Inbox attachment checks actual native execution and active owned domain thread before append/replay", async () => {
  const f = await targetedSetup(),
    r = await f.request(1),
    evidenceId = r.order.pipeline!.evidenceIds[0];
  const args = {
    ...f.target,
    evidenceId,
    operationKey: "inbox-busy-attach",
    intent: "Discuss exact current evidence",
  };
  const runId = await f.signed.mutation(api.ai.conversations.send, {
    ...f.target,
    operationKey: "inbox-busy-run",
    prompt: "Keep native response pending",
    allowIdeaCreation: false,
  });
  await expect(
    f.signed.mutation(api.ai.conversations.attachEvidence, args),
  ).rejects.toThrow("NATIVE_EXECUTION_PENDING");
  await f.signed.mutation(api.ai.conversations.stop, f.target);
  const receipt = await f.signed.mutation(
    api.ai.conversations.attachEvidence,
    args,
  );
  expect(receipt.conversationId).toBe(f.conversationId);
  await expect(
    (await otherEditor(f)).mutation(api.ai.conversations.attachEvidence, args),
  ).rejects.toThrow("CHAT_ACCESS_DENIED");
  const thread = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!
    .threadId;
  await expect(
    f.signed.mutation(api.ai.conversations.attachEvidence, {
      ...args,
      conversationId: thread as Id<"conversations">,
    }),
  ).rejects.toThrow();
  await f.signed.mutation(api.ai.conversations.remove, f.target);
  expect(
    await f.signed.mutation(api.ai.conversations.create, {
      ...f.scope,
      operationKey: "j05-personal-chat",
    }),
  ).toBe(f.conversationId);
  await expect(
    f.signed.mutation(api.ai.conversations.attachEvidence, args),
  ).rejects.toThrow("CHAT_INACTIVE");
  expect((await f.t.run((ctx) => ctx.db.get(runId)))!.state).toBe("stopped");
});

test("eligible human Review cannot auto-consume while actual native sent/unknown liability remains unresolved", async () => {
  const f = await scheduledAutomatic("draft", 3, true),
    o = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!;
  const native = (
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())
  ).find((t) => t.owner === "native-search" && t.operation === "web-search")!;
  expect(native.state).toBe("unknown");
  expect(native.heldMicros).toBeGreaterThan(0);
  const id = await f.signed.mutation(api.research.evidence.review, {
    workspaceId: f.workspaceId,
    evidenceId: o.pipeline!.evidenceIds[0],
    commandKey: "auto-unknown-review",
    maxAgeMs: 86400000,
    validUntil: Date.now() + 300000,
    reason: "Actual current support assessment",
    substantiveSupportAttested: true,
    eventAt: null,
    eventQuote: null,
  });
  expect(
    (
      await f.signed.query(api.research.evidence.list, {
        workspaceId: f.workspaceId,
        orderId: f.orderId,
      })
    ).find((e) => e.evidenceId === id)!.automaticEligible,
  ).toBe(true);
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: f.orderId,
  });
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.orderId)))!.automaticHandoff?.reason,
  ).toBe("RESEARCH_AUTOMATIC_USAGE_UNRESOLVED");
  expect(await f.t.run((ctx) => ctx.db.get(native._id))).toEqual(native);
  // Actual late native receipt settles the existing hold; no new attempt or queue.
  await f.t.mutation(internal.research.cache.settle, {
    attemptId: native._id,
    units: null,
    reportedCost: 0,
    costInvalid: false,
    errorCode: null,
  });
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: f.orderId,
  });
  const receipt = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!
    .automaticHandoff!;
  expect(receipt.state).toBe("completed");
  expect(receipt.results).toHaveLength(1);
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: f.orderId,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.orderId)))!.automaticHandoff,
  ).toEqual(receipt);
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
});

test("actual late native over-cap receipt keeps the marked automatic selection unfrozen", async () => {
  const f = await scheduledAutomatic("draft", 3, true),
    o = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!;
  const native = (
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())
  ).find((t) => t.owner === "native-search" && t.operation === "web-search")!;
  await f.signed.mutation(api.research.evidence.review, {
    workspaceId: f.workspaceId,
    evidenceId: o.pipeline!.evidenceIds[0],
    commandKey: "auto-over-cap-review",
    maxAgeMs: 86400000,
    validUntil: Date.now() + 300000,
    reason: "Actual current support assessment",
    substantiveSupportAttested: true,
    eventAt: null,
    eventQuote: null,
  });
  await f.t.mutation(internal.research.cache.settle, {
    attemptId: native._id,
    units: null,
    reportedCost: 1,
    costInvalid: false,
    errorCode: null,
  });
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: f.orderId,
  });
  const capture = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!
    .automaticHandoff!;
  expect(capture.state).toBe("awaiting-review");
  expect(capture.reason).toBe("RESEARCH_AUTOMATIC_ORDER_LIMIT_EXCEEDED");
  expect(capture.results).toBeUndefined();
  expect(capture.selection).toBeUndefined();
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
  expect((await f.t.run((ctx) => ctx.db.get(native._id)))!.state).toBe(
    "settled",
  );
});

test("known late native receipt restores awaiting human Review reason when no eligible assessment exists", async () => {
  const f = await scheduledAutomatic("draft", 3, true);
  const native = (
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())
  ).find((t) => t.owner === "native-search" && t.operation === "web-search")!;
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: f.orderId,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.orderId)))!.automaticHandoff!.reason,
  ).toBe("RESEARCH_AUTOMATIC_USAGE_UNRESOLVED");
  await f.t.mutation(internal.research.cache.settle, {
    attemptId: native._id,
    units: null,
    reportedCost: 0,
    costInvalid: false,
    errorCode: null,
  });
  await f.t.mutation(internal.research.handoff.automatic, {
    orderId: f.orderId,
  });
  const capture = (await f.t.run((ctx) => ctx.db.get(f.orderId)))!
    .automaticHandoff!;
  expect(capture.reason).toBe("RESEARCH_AUTOMATIC_AWAITING_HUMAN_REVIEW");
  expect(capture.state).toBe("awaiting-review");
  expect(capture.results).toBeUndefined();
});

test("TASK45.2 published styled history erases model and later cluster copies while confirmed receipts survive", async () => {
  const f = await pipelineFixture(20000, ["web-search"]);
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("aiPolicies").first())!;
    await ctx.db.patch(p._id, { purposes: [...p.purposes, "draft"] });
    for (const b of await ctx.db.query("aiBudgets").collect())
      if (b.purposes.includes("research"))
        await ctx.db.patch(b._id, { purposes: [...b.purposes, "draft"] });
  });
  const scope = { workspaceId: f.workspaceId, accountId: f.accountId };
  const saved = await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 0,
    commandKey: "history-style-save",
    action: {
      kind: "save",
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Explicit style",
      payload: {
        author: "History author",
        experiences: [],
        tone: "Concise",
        positioning: "",
        pillars: [{ name: "Questions", weight: 100 }],
        examples: [],
        forbidden: [],
      },
    },
  });
  await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 1,
    commandKey: "history-style-select",
    action: { kind: "select", versionId: saved.versionId!, reason: "Select" },
  });
  const input = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    operationKey: "history-style-input",
    title: "Own idea",
    note: "Own claim",
    perspective: "Question",
    priority: "normal",
    source: { kind: "note" },
  });
  const runId = await f.signed.mutation(api.content.ideas.generate, {
    ...scope,
    ideaId: input,
    expectedRevision: 1,
    intent: "Interpret",
    operationKey: "history-style-run",
  });
  const physical = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      id: "styled-history",
      object: "chat.completion",
      created: 1791210000,
      model: "synthetic/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              text: JSON.stringify({
                title: "Protected styled title",
                perspective: "Question",
                rationale: "Unverified",
                questions: ["Why?"],
              }),
            }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
  );
  await f.t.action(internal.ai.provider.execute, { runId });
  const request = (await f.t.run((ctx) =>
    ctx.db
      .query("contentRequests")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique(),
  ))!;
  const draft = await f.signed.mutation(api.content.ideas.handoff, {
    ...scope,
    ideaId: request.resultIdeaId!,
    expectedRevision: 1,
    intent: "Review",
    draftText: "Protected published style text",
    clarificationConfirmed: true,
  });
  const receipts = await f.t.run(async (ctx) => {
    const approvalId = await ctx.db.insert("approvals", {
      ...scope,
      draftId: draft.draftId,
      versionId: draft.versionId,
      actorId: f.userId,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      ...scope,
      draftId: draft.draftId,
      versionId: draft.versionId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at: Date.now(),
      timezone: "UTC",
      localTime: "fixture",
      purpose: "publishing",
      state: "published",
      publishedCount: 1,
      errorCode: null,
      jobId: null,
    });
    const attemptId = await ctx.db.insert("xPostAttempts", {
      ...scope,
      scheduleId,
      versionId: draft.versionId,
      generation: 1,
      providerIdentity: "synthetic",
      connectionSequence: 0,
      position: 0,
      attempt: 1,
      claimSequence: 1,
      leaseUntil: Date.now(),
      deadline: Date.now(),
      stage: "confirmed",
      mediaIds: [],
      externalId: "style-confirmed",
      confirmedAt: Date.now(),
      durationMs: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(scheduleId, {
      externalPosts: [
        {
          position: 0,
          externalId: "style-confirmed",
          url: "https://x.com/synthetic/status/1",
          attemptId,
          confirmedAt: Date.now(),
        },
      ],
    });
    return { scheduleId, attemptId };
  });
  let currentOrder: Id<"researchOrders">;
  physical.mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.tools?.[0]?.type === "web_search") return streamResponse();
    expect(JSON.stringify(body.messages)).toContain(
      "Protected published style text",
    );
    expect(JSON.stringify(body.messages)).not.toContain(
      "explicitUserAssertions",
    );
    return Response.json({
      id: "research-history",
      object: "chat.completion",
      created: 1791210000,
      model: "synthetic/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              text: await modelOutput(f, currentOrder),
            }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  });
  const first = (currentOrder = await f.start("styled-history-first"));
  await driveUntil(f, first, (o) => o.state === "completed");
  const firstOrder = (await f.t.run((ctx) => ctx.db.get(first)))!;
  const originalEvidence = firstOrder.pipeline!.evidenceIds[0];
  const manual = await f.signed.mutation(api.research.evidence.review, {
    workspaceId: f.workspaceId,
    evidenceId: originalEvidence,
    commandKey: "styled-history-manual",
    maxAgeMs: 86400000,
    validUntil: Date.now() + 100000,
    reason: "Human assessment",
    substantiveSupportAttested: false,
    eventAt: null,
    eventQuote: null,
  });
  const second = (currentOrder = await f.start("styled-history-second"));
  await driveUntil(f, second, (o) => o.state === "completed");
  const secondOrder = (await f.t.run((ctx) => ctx.db.get(second)))!;
  expect(
    secondOrder.pipeline!.contextEvidence!.some(
      (p) => p.evidenceId === originalEvidence,
    ),
  ).toBe(true);
  const bindings = await f.t.run((ctx) =>
    ctx.db
      .query("researchCopyBindings")
      .withIndex("by_evidenceId_and_state", (q) =>
        q.eq("evidenceId", originalEvidence).eq("state", "retained"),
      )
      .take(25),
  );
  expect(bindings.some((b) => b.orderId === second)).toBe(true);
  const [copy] = await f.signed.mutation(api.research.handoff.consume, {
    ...scope,
    evidenceIds: [manual],
    intent: "Manual assessed parent",
    target: "draft",
    commandKey: "styled-history-copy",
  });
  await f.t.mutation(internal.ai.styleProfiles.purge, {
    versionId: saved.versionId!,
    proposalId: null,
  });
  expect(
    (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: copy.draftId!,
    }))!.versions[0].sourceUnavailable,
  ).toBe(true);
  await driveUntil(f, first, (o) => o.pipeline?.cleanupState === "complete");
  await driveUntil(f, second, (o) => o.pipeline?.cleanupState === "complete");
  for (let i = 0; i < 10; i++) {
    await vi.advanceTimersByTimeAsync(1000);
    await f.t.finishInProgressScheduledFunctions();
  }
  expect((await f.t.run((ctx) => ctx.db.get(manual)))!.payload).toBeNull();
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(copy.draftVersionId!),
    ))!.content.text.every((s) => s === ""),
  ).toBe(true);
  expect((await f.t.run((ctx) => ctx.db.get(receipts.attemptId)))!.stage).toBe(
    "confirmed",
  );
  expect(
    (await f.t.run((ctx) => ctx.db.get(receipts.scheduleId)))!.externalPosts,
  ).toHaveLength(1);
  for (const order of [firstOrder, secondOrder]) {
    const journal = await f.t.run((ctx) =>
      workflow.listSteps(ctx, order.pipeline!.workflowId as WorkflowId, {
        paginationOpts: { cursor: null, numItems: 1 },
      }),
    );
    expect(journal.page).toEqual([]);
    const run = (await f.t.run((ctx) => ctx.db.get(order.pipeline!.runId!)))!;
    expect(
      (
        await f.t.query(components.agent.messages.listMessagesByThreadId, {
          threadId: run.threadId,
          order: "desc",
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toEqual([]);
  }
});
