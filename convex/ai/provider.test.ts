import { test, expect, vi, afterEach } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { simulateReadableStream } from "ai";
import { sourceFixture } from "../../tests/github-fixture";
import { generateForRun, requestyFetch } from "./provider";
import { modelFixture } from "../../tests/model-fixture";
import { internal, api, components } from "../_generated/api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
test.each([0.12345, -1, "NaN", null])(
  "actual openai-compatible adapter preserves reported cost %s separately from estimates and bills",
  async (cost) => {
    const f = await modelFixture(),
      runId = await f.create();
    vi.stubEnv("REQUESTY_API_KEY", "synthetic-key-only");
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls++;
      expect(String(input)).toBe(
        "https://router.eu.requesty.ai/v1/chat/completions",
      );
      expect(init!.redirect).toBe("error");
      expect(JSON.parse(init!.body as string).model).toBe("synthetic/model");
      expect(
        await f.t.run((ctx) =>
          ctx.db
            .query("aiAttempts")
            .withIndex("by_runId_and_state", (q) =>
              q.eq("runId", runId).eq("state", "sent"),
            )
            .first(),
        ),
      ).not.toBeNull();
      return new Response(
        JSON.stringify({
          id: "synthetic-completion",
          object: "chat.completion",
          created: 1791210000,
          model: "synthetic/model",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  text: "Actual adapter synthetic answer",
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
            cost,
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    });
    await f.t.action(internal.ai.provider.execute, { runId });
    expect(calls).toBe(1);
    expect((await f.t.run((ctx) => ctx.db.get(runId)))!.state).toBe(
      "completed",
    );
    const receipt = await f.t.run((ctx) =>
      ctx.db
        .query("aiAttempts")
        .withIndex("by_runId_and_state", (q) =>
          q.eq("runId", runId).eq("state", "unknown"),
        )
        .first(),
    );
    expect(receipt).toMatchObject({
      estimatedMicros: 30,
      reportedCost: typeof cost === "number" && cost >= 0 ? cost : null,
      reportedCostInvalid: typeof cost !== "number" || cost < 0,
      reportedCurrency: null,
      billedMicros: null,
      currency: "USD",
    });
    for (const id of receipt!.budgetIds)
      expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
        heldMicros: 8100,
        spentMicros: 0,
      });
  },
);
test.each([
  "not JSON",
  '{"text":"Valid text","publish":true}',
  '{"text":""}',
  '{"foreignId":"other-workspace"}',
])(
  "strict actual model output rejects malformed or additional fields: %s",
  async (text) => {
    const f = await claimed();
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        ...response(),
        content: [{ type: "text", text }],
      }),
    });
    await expect(
      f.t.action((ctx) => generateForRun(ctx, f.runId, f.executionKey, model)),
    ).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
    const messages = await f.t.query(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: f.run.threadId,
        order: "desc",
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    expect(
      messages.page.some((m) => m.text === text && m.status === "success"),
    ).toBe(false);
  },
);
test("real Agent streaming settles its own finish usage and preserves the stable official prompt", async () => {
  const f = await claimed();
  let calls = 0;
  const model = new MockLanguageModelV3({
    doStream: async () => {
      calls++;
      expect(
        await f.t.run((ctx) =>
          ctx.db
            .query("aiAttempts")
            .withIndex("by_runId_and_state", (q) =>
              q.eq("runId", f.runId).eq("state", "sent"),
            )
            .first(),
        ),
      ).not.toBeNull();
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "text" },
            {
              type: "text-delta",
              id: "text",
              delta: JSON.stringify({ text: "Streaming synthetic answer" }),
            },
            { type: "text-end", id: "text" },
            {
              type: "finish",
              usage,
              finishReason: { unified: "stop", raw: "stop" },
              providerMetadata: {
                requesty: { reportedCost: null, reportedCostInvalid: false },
                private: { body: "SYNTHETIC-PRIVATE-STREAM-METADATA" },
              },
            },
          ],
        }),
      };
    },
  });
  expect(
    await f.t.action((ctx) =>
      generateForRun(ctx, f.runId, f.executionKey, model, true),
    ),
  ).toBe("Streaming synthetic answer");
  expect(calls).toBe(1);
  const receipt = await f.t.run((ctx) =>
    ctx.db
      .query("aiAttempts")
      .withIndex("by_runId_and_state", (q) =>
        q.eq("runId", f.runId).eq("state", "settled"),
      )
      .first(),
  );
  expect(receipt!.estimatedMicros).toBe(30);
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: f.run.threadId,
      order: "desc",
      paginationOpts: { numItems: 10, cursor: null },
    },
  );
  expect(JSON.stringify(messages)).not.toContain(
    "SYNTHETIC-PRIVATE-STREAM-METADATA",
  );
});
test("missing streaming finish and transport timeout retain unknown cost, sanitize logger and do not retry", async () => {
  const f = await claimed();
  let calls = 0;
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args.map(String).join(" "));
  });
  const model = new MockLanguageModelV3({
    doStream: async () => {
      calls++;
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "error", error: new Error("RAW-SECRET-BODY") },
          ],
        }),
      };
    },
  });
  await expect(
    f.t.action((ctx) =>
      generateForRun(ctx, f.runId, f.executionKey, model, true),
    ),
  ).rejects.toThrow();
  expect(calls).toBe(1);
  expect(errors.join(" ")).not.toContain("RAW-SECRET-BODY");
  const unknown = await f.t.run((ctx) =>
    ctx.db
      .query("aiAttempts")
      .withIndex("by_runId_and_state", (q) =>
        q.eq("runId", f.runId).eq("state", "unknown"),
      )
      .first(),
  );
  expect(unknown).not.toBeNull();
  expect(
    (await f.t.run((ctx) => ctx.db.get(unknown!.budgetIds[0])))!.heldMicros,
  ).toBe(8100);
});
test("fixed Requesty HTTP boundary rejects arbitrary URLs/redirects and caps actual bytes", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(new Uint8Array(1024 * 1024 + 1)));
  await expect(
    requestyFetch("https://attacker.example", { method: "POST", body: "{}" }),
  ).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
  expect(fetch).not.toHaveBeenCalled();
  const response = await requestyFetch(
    "https://router.eu.requesty.ai/v1/chat/completions",
    { method: "POST", body: "{}" },
  );
  expect(fetch.mock.calls[0][1]!.redirect).toBe("error");
  await expect(response.text()).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
});
test("actual provider deadline bounds a hanging call without releasing its unknown reservation", async () => {
  const f = await claimed();
  let calls = 0;
  await f.t.run((ctx) => ctx.db.patch(f.runId, { deadline: Date.now() + 200 }));
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      calls++;
      return new Promise(() => {});
    },
  });
  const started = Date.now();
  await expect(
    f.t.action((ctx) => generateForRun(ctx, f.runId, f.executionKey, model)),
  ).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
  expect(calls).toBe(1);
  expect(Date.now() - started).toBeLessThan(1000);
  const receipt = await f.t.run((ctx) =>
    ctx.db
      .query("aiAttempts")
      .withIndex("by_runId_and_state", (q) =>
        q.eq("runId", f.runId).eq("state", "unknown"),
      )
      .first(),
  );
  expect(receipt).not.toBeNull();
  expect(
    (await f.t.run((ctx) => ctx.db.get(receipt!.budgetIds[0])))!.heldMicros,
  ).toBe(8100);
});
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};
const response = () => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify({ text: "Synthetic valid answer" }),
    },
  ],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage,
  warnings: [],
});
test("monitoring alone never grants model context; source revocation after send permits cost only", async () => {
  const source = await sourceFixture();
  const f = await modelFixture(source);
  const args = {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    actorId: f.userId,
    purpose: "draft" as const,
    prompt: "Synthetic source-bound request",
    promptVersion: "fixture",
    sources: [{ repositoryId: source.repositories[0], generation: 1 }],
  };
  await expect(f.t.mutation(internal.ai.runs.create, args)).rejects.toThrow();
  await f.t.run((ctx) =>
    ctx.db.patch(source.repositories[0], { content: true }),
  );
  const runId = await f.t.mutation(internal.ai.runs.create, args),
    executionKey = "source";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      await f.t.run((ctx) =>
        ctx.db.patch(source.repositories[0], { content: false, generation: 2 }),
      );
      return response();
    },
  });
  await expect(
    f.t.action((ctx) => generateForRun(ctx, runId, executionKey, model)),
  ).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
  const receipt = await f.t.run((ctx) =>
    ctx.db
      .query("aiAttempts")
      .withIndex("by_runId_and_state", (q) =>
        q.eq("runId", runId).eq("state", "settled"),
      )
      .first(),
  );
  expect(receipt!.estimatedMicros).toBe(30);
});
async function claimed() {
  const f = await modelFixture(),
    runId = await f.create(),
    executionKey = crypto.randomUUID();
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  const run = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  return { ...f, runId, executionKey, run };
}
test("exact Agent/AI6/provider matrix sees durable funding before physical model call and stores official history", async () => {
  const f = await claimed();
  let calls = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      calls++;
      const attempts = await f.t.run((ctx) =>
        ctx.db
          .query("aiAttempts")
          .withIndex("by_runId_and_state", (q) =>
            q.eq("runId", f.runId).eq("state", "sent"),
          )
          .take(3),
      );
      expect(attempts).toHaveLength(1);
      expect(attempts[0].reservedMicros).toBe(8100);
      expect(
        (await f.t.run((ctx) => ctx.db.get(attempts[0].budgetIds[0])))!
          .heldMicros,
      ).toBe(8100);
      return response();
    },
  });
  const result = await f.t.action((ctx) =>
    generateForRun(ctx, f.runId, f.executionKey, model),
  );
  expect(result).toBe("Synthetic valid answer");
  expect(calls).toBe(1);
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: f.run.threadId,
      order: "desc",
      paginationOpts: { numItems: 10, cursor: null },
    },
  );
  expect(messages.page.filter((m) => m.message?.role === "user")).toHaveLength(
    1,
  );
  expect(
    messages.page.some(
      (m) => m.text === JSON.stringify({ text: "Synthetic valid answer" }),
    ),
  ).toBe(true);
  const receipts = await f.t.run((ctx) =>
    ctx.db
      .query("aiAttempts")
      .withIndex("by_runId_and_state", (q) =>
        q.eq("runId", f.runId).eq("state", "settled"),
      )
      .take(10),
  );
  expect(receipts[0].estimatedMicros).toBe(30);
  expect(receipts[0].billedMicros).toBeNull();
});
test("transport failure makes one call, keeps unknown hold and sanitizes secret before component persistence", async () => {
  const f = await claimed();
  let calls = 0;
  const secret = "PRIVATE-API-KEY private-body";
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      calls++;
      throw new Error(secret);
    },
  });
  await expect(
    f.t.action((ctx) => generateForRun(ctx, f.runId, f.executionKey, model)),
  ).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
  expect(calls).toBe(1);
  const rows = await f.t.run((ctx) =>
    ctx.db
      .query("aiAttempts")
      .withIndex("by_runId_and_state", (q) =>
        q.eq("runId", f.runId).eq("state", "unknown"),
      )
      .take(10),
  );
  expect(rows).toHaveLength(1);
  expect(
    (await f.t.run((ctx) => ctx.db.get(rows[0].budgetIds[0])))!.heldMicros,
  ).toBe(8100);
  await expect(
    f.t.mutation(internal.ai.runs.fund, {
      runId: f.runId,
      generation: 1,
      executionKey: f.executionKey,
      key: "fresh-funded-retry",
    }),
  ).rejects.toThrow("MODEL_PREVIOUS_ATTEMPT_UNRESOLVED");
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: f.run.threadId,
      order: "desc",
      paginationOpts: { numItems: 10, cursor: null },
    },
  );
  expect(JSON.stringify(messages)).not.toContain(secret);
});
test("actual human stop after send settles usage but cannot store model output or reactivate", async () => {
  const f = await claimed();
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      await f.signed.mutation(api.ai.runs.stop, {
        workspaceId: f.workspaceId,
        runId: f.runId,
      });
      return response();
    },
  });
  await expect(
    f.t.action((ctx) => generateForRun(ctx, f.runId, f.executionKey, model)),
  ).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
  const run = await f.t.run((ctx) => ctx.db.get(f.runId));
  expect(run!.state).toBe("stopped");
  const receipt = await f.t.run((ctx) =>
    ctx.db
      .query("aiAttempts")
      .withIndex("by_runId_and_state", (q) =>
        q.eq("runId", f.runId).eq("state", "settled"),
      )
      .first(),
  );
  expect(receipt!.estimatedMicros).toBe(30);
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: f.run.threadId,
      order: "desc",
      paginationOpts: { numItems: 10, cursor: null },
    },
  );
  expect(JSON.stringify(messages)).not.toContain("Synthetic valid answer");
});
test("endless actual Agent tools stop at independent tool/attempt ceilings and strict foreign fields cannot execute", async () => {
  const f = await claimed();
  let calls = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      calls++;
      return {
        ...response(),
        content: [
          {
            type: "tool-call",
            toolCallId: `call-${calls}`,
            toolName: "read_context",
            input:
              calls === 1
                ? '{"workspaceId":"foreign","operation":"publish","env":"SECRET"}'
                : "{}",
          },
        ],
        finishReason: { unified: "tool-calls", raw: "tool_calls" },
      };
    },
  });
  await expect(
    f.t.action((ctx) => generateForRun(ctx, f.runId, f.executionKey, model)),
  ).rejects.toThrow();
  expect(calls).toBe(3);
  const run = await f.t.run((ctx) => ctx.db.get(f.runId));
  expect(run!.toolSteps).toBe(2);
  expect(run!.attempts).toBe(3);
});
