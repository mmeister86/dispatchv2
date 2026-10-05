import { test, expect, vi, afterEach } from "vitest";
import { api, internal, components } from "../_generated/api";
import { generateKeyPairSync } from "node:crypto";
import {
  sourceFixture,
  send as signedDelivery,
  push,
} from "../../tests/github-fixture";
import { base64 } from "../lib/crypto";
import { insertIdea } from "../content/ideas";
import { modelFixture } from "../../tests/model-fixture";
import { MockLanguageModelV3 } from "ai/test";
import { simulateReadableStream } from "ai";
import { generateForRun } from "./provider";
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function fixture(base?: Awaited<ReturnType<typeof modelFixture>>) {
  const f = base ?? (await modelFixture());
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("aiPolicies").first())!;
    await ctx.db.patch(p._id, { purposes: ["draft", "chat"] });
    for (const b of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(b._id, { purposes: ["draft", "chat"] });
  });
  const scope = { workspaceId: f.workspaceId, accountId: f.accountId };
  const conversationId = await f.signed.mutation(api.ai.conversations.create, {
    ...scope,
    operationKey: "conversation-one",
  });
  const target = { ...scope, conversationId };
  const send = (extra = {}) =>
    f.signed.mutation(api.ai.conversations.send, {
      ...target,
      prompt: "Please explore this synthetic note",
      operationKey: "send-operation-one",
      allowIdeaCreation: false,
      ...extra,
    });
  return { ...f, scope, conversationId, target, send };
}
async function claim(
  f: Awaited<ReturnType<typeof fixture>>,
  runId: Awaited<ReturnType<typeof f.send>>,
) {
  const executionKey = "synthetic-execution";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  return { runId, generation: 1, executionKey };
}
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};
test("persistent native history, one duplicate prompt/run and contradictory replay rejected", async () => {
  const f = await fixture();
  const [a, b] = await Promise.all([f.send(), f.send()]);
  expect(a).toBe(b);
  const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  const r = (await f.t.run((ctx) => ctx.db.get(a)))!;
  expect(r.threadId).toBe(c.threadId);
  const p = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(p.page).toHaveLength(1);
  expect(p.page[0].text).toContain("synthetic note");
  await expect(f.send({ prompt: "contradiction" })).rejects.toThrow(
    "CHAT_OPERATION_CONFLICT",
  );
  expect(
    (
      await f.signed.query(api.ai.conversations.list, {
        ...f.scope,
        paginationOpts: { numItems: 25, cursor: null },
      })
    ).page[0].turns,
  ).toBe(1);
  await f.signed.mutation(api.ai.conversations.rename, {
    ...f.target,
    expectedRevision: 1,
    title: "Reloaded native conversation",
  });
  await expect(
    f.signed.mutation(api.ai.conversations.rename, {
      ...f.target,
      expectedRevision: 1,
      title: "stale",
    }),
  ).rejects.toThrow("CHAT_REVISION_CONFLICT");
});
test("missing configuration rolls back native prompt and leaves real conversation usable", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("aiPolicies").first())!;
    await ctx.db.patch(p._id, { enabled: false });
  });
  await expect(f.send()).rejects.toThrow(
    "MODEL_PROCESSING_CONFIGURATION_REQUIRED",
  );
  const p = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(p.page).toEqual([]);
  expect(
    await f.t.run((ctx) => ctx.db.query("chatOperations").collect()),
  ).toEqual([]);
});
test("raw foreign thread and same-human account/workspace cannot read conversation", async () => {
  const f = await fixture();
  const foreign = await f.signed.mutation(api.workspaces.create, {
    name: "Foreign",
    description: "",
  });
  const foreignAccount = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...a } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", { ...a, workspaceId: foreign });
  });
  const other = await f.signed.mutation(api.ai.conversations.create, {
    workspaceId: foreign,
    accountId: foreignAccount,
    operationKey: "other-conversation",
  });
  const c = (await f.t.run((ctx) => ctx.db.get(other)))!;
  for (const threadId of [c.threadId, other])
    await expect(
      f.signed.query(api.ai.conversations.messages, {
        ...f.scope,
        threadId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow();
  await expect(
    f.signed.mutation(api.ai.conversations.rename, {
      ...f.target,
      accountId: foreignAccount,
      title: "forged",
      expectedRevision: 1,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
});
test.each(["streaming", "finished", "aborted"] as const)(
  "foreign %s cursor is omitted before native delta read; own cursor allowed; zero-item sentinel",
  async (state) => {
    const f = await fixture();
    const other = await f.signed.mutation(api.ai.conversations.create, {
      ...f.scope,
      operationKey: "other-conversation",
    });
    const own = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!,
      foreign = (await f.t.run((ctx) => ctx.db.get(other)))!;
    const make = async (threadId: string) => {
      const streamId = await f.t.mutation(components.agent.streams.create, {
        threadId,
        order: 0,
        stepOrder: 0,
        format: "TextStreamPart",
      });
      await f.t.mutation(components.agent.streams.addDelta, {
        streamId,
        start: 0,
        end: 1,
        parts: [
          {
            type: "text-delta",
            id: "text",
            text: threadId === own.threadId ? "own-safe" : "FOREIGN-PRIVATE",
          },
        ],
      });
      if (state === "finished")
        await f.t.mutation(components.agent.streams.finish, { streamId });
      if (state === "aborted")
        await f.t.mutation(components.agent.streams.abort, {
          streamId,
          reason: "synthetic",
        });
      return streamId;
    };
    const ownId = await make(own.threadId),
      foreignId = await make(foreign.threadId);
    const p = await f.signed.query(api.ai.conversations.messages, {
      ...f.scope,
      threadId: f.conversationId,
      paginationOpts: { numItems: 0, cursor: null },
      streamArgs: {
        kind: "deltas",
        cursors: [
          { streamId: ownId, cursor: 0 },
          { streamId: foreignId, cursor: 0 },
        ],
      },
    });
    expect(JSON.stringify(p)).toContain("own-safe");
    expect(JSON.stringify(p)).not.toContain("FOREIGN-PRIVATE");
    expect(p.streams!.kind).toBe("deltas");
    await expect(
      f.signed.query(api.ai.conversations.messages, {
        ...f.scope,
        threadId: f.conversationId,
        paginationOpts: { numItems: 0, cursor: null },
        streamArgs: {
          kind: "deltas",
          cursors: [{ streamId: ownId, cursor: -1 }],
        },
      }),
    ).rejects.toThrow("CHAT_CURSOR_INVALID");
    await expect(
      f.signed.query(api.ai.conversations.messages, {
        ...f.scope,
        threadId: f.conversationId,
        paginationOpts: { numItems: 0, cursor: null },
        streamArgs: {
          kind: "deltas",
          cursors: [
            { streamId: ownId, cursor: 0 },
            { streamId: ownId, cursor: 1 },
          ],
        },
      }),
    ).rejects.toThrow("CHAT_CURSOR_INVALID");
  },
);
test("stopped generation cannot create idea, late usage settles, unknown prevents continuation and saved prompt remains unique", async () => {
  const f = await fixture();
  const runId = await f.send({ allowIdeaCreation: true });
  const control = await claim(f, runId);
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    ...control,
    key: "first-attempt",
  });
  await f.signed.mutation(api.ai.conversations.stop, f.target);
  await expect(
    f.t.mutation(internal.ai.conversations.createIdea, {
      ...control,
      title: "late",
      perspective: "late",
      rationale: "late",
      questions: ["What?"],
    }),
  ).rejects.toThrow("MODEL_RUN_INACTIVE");
  const op = (await f.t.run((ctx) => ctx.db.query("chatOperations").first()))!;
  await expect(
    f.signed.mutation(api.ai.conversations.resume, {
      ...f.target,
      operationId: op._id,
      expectedRunId: runId,
    }),
  ).rejects.toThrow("CHAT_USAGE_RECONCILIATION_REQUIRED");
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: 10,
    outputTokens: 20,
    errorCode: null,
  });
  const [resumed, replay] = await Promise.all([
    f.signed.mutation(api.ai.conversations.resume, {
      ...f.target,
      operationId: op._id,
      expectedRunId: runId,
    }),
    f.signed.mutation(api.ai.conversations.resume, {
      ...f.target,
      operationId: op._id,
      expectedRunId: runId,
    }),
  ]);
  expect(resumed).toBe(replay);
  expect(resumed).not.toBe(runId);
  expect((await f.t.run((ctx) => ctx.db.get(resumed)))!.promptMessageId).toBe(
    op.promptMessageId,
  );
  const p = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(p.page.filter((m) => m.role === "user")).toHaveLength(1);
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
  expect((await f.t.run((ctx) => ctx.db.get(attemptId)))!.state).toBe(
    "settled",
  );
});
test("real idea tool permission is human bound; completed operation survives continuation without second object", async () => {
  const f = await fixture();
  const runId = await f.send({ allowIdeaCreation: true }),
    control = await claim(f, runId);
  const args = {
    ...control,
    title: "Actual idea",
    perspective: "Unverified interpretation",
    rationale: "Unverified rationale",
    questions: ["What was observed?"],
  };
  const id = await f.t.mutation(internal.ai.conversations.createIdea, args);
  expect(await f.t.mutation(internal.ai.conversations.createIdea, args)).toBe(
    id,
  );
  await f.signed.mutation(api.ai.conversations.stop, f.target);
  const op = (await f.t.run((ctx) => ctx.db.query("chatOperations").first()))!;
  const resumed = await f.signed.mutation(api.ai.conversations.resume, {
    ...f.target,
    operationId: op._id,
    expectedRunId: runId,
  });
  const next = await claim(f, resumed);
  expect(
    await f.t.mutation(internal.ai.conversations.createIdea, {
      ...args,
      ...next,
    }),
  ).toBe(id);
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toEqual([]);
});
test("tool without explicit permission and archived history source fail closed", async () => {
  const f = await fixture();
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    title: "Own note",
    note: "human claim",
    perspective: "perspective",
    priority: "normal",
    source: { kind: "note" },
    operationKey: "human-note-one",
  });
  const runId = await f.send({ ideaId });
  const control = await claim(f, runId);
  await expect(
    f.t.mutation(internal.ai.conversations.createIdea, {
      ...control,
      title: "injection",
      perspective: "claim",
      rationale: "claim",
      questions: ["What?"],
    }),
  ).rejects.toThrow("CHAT_IDEA_PERMISSION_REQUIRED");
  await f.signed.mutation(api.ai.conversations.stop, f.target);
  await f.signed.mutation(api.content.ideas.archive, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    archived: true,
    feedback: "withdrawal",
  });
  await expect(
    f.send({ operationKey: "source-less-send-two" }),
  ).rejects.toThrow("CHAT_HISTORY_SOURCE_WITHDRAWN");
});
test("actual saved native streaming plain text and physical funding/settlement", async () => {
  const f = await fixture(),
    runId = await f.send(),
    control = await claim(f, runId);
  let calls = 0;
  const model = new MockLanguageModelV3({
    doStream: async () => {
      calls++;
      expect(
        (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!.state,
      ).toBe("sent");
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "reply" },
            {
              type: "text-delta",
              id: "reply",
              delta: "Readable actual reply. ",
            },
            { type: "text-end", id: "reply" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage,
            },
          ],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      };
    },
  });
  expect(
    await f.t.action((ctx) =>
      generateForRun(ctx, runId, control.executionKey, model, true),
    ),
  ).toBe("Readable actual reply. ");
  expect(calls).toBe(1);
  const p = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { numItems: 50, cursor: null },
    streamArgs: { kind: "list" },
  });
  expect(p.page.some((m) => m.text.includes("Readable actual reply"))).toBe(
    true,
  );
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!,
  ).toMatchObject({ state: "settled", estimatedMicros: 30 });
});
test("delete waits for actual execution-finished receipt, cleans native thread, retains unknown financial liability", async () => {
  const f = await fixture(),
    runId = await f.send(),
    control = await claim(f, runId);
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    ...control,
    key: "unknown",
  });
  await f.signed.mutation(api.ai.conversations.remove, f.target);
  await f.t.run((ctx) => ctx.db.patch(f.conversationId, { cleanupAfter: 0 }));
  await f.t.mutation(internal.ai.conversations.cleanup, {
    conversationId: f.conversationId,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))!.state).toBe(
    "deleting",
  );
  await f.t.mutation(internal.ai.runs.finish, { ...control, failed: true });
  await f.t.mutation(internal.ai.conversations.cleanup, {
    conversationId: f.conversationId,
  });
  const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  expect(c.state).toBe("deleted");
  expect(
    await f.t.query(components.agent.threads.getThread, {
      threadId: c.threadId,
    }),
  ).toBeNull();
  expect(
    (await f.t.run((ctx) => ctx.db.get(attemptId)))!.heldMicros,
  ).toBeGreaterThan(0);
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: 10,
    outputTokens: 20,
    errorCode: null,
  });
  expect((await f.t.run((ctx) => ctx.db.get(attemptId)))!.state).toBe(
    "settled",
  );
  await expect(f.send()).rejects.toThrow("CHAT_INACTIVE");
});
test("physical fixed Requesty SSE creates actual idea via native tool and persists readable reply with minimized metadata", async () => {
  const f = await fixture(),
    runId = await f.send({ allowIdeaCreation: true });
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key-only");
  let calls = 0;
  const toolArgs = {
    title: "Saved synthetic idea",
    perspective: "Unverified perspective",
    rationale: "A question, not a fact",
    questions: ["What was verified?"],
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    expect(String(input)).toBe(
      "https://router.eu.requesty.ai/v1/chat/completions",
    );
    calls++;
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("synthetic/model");
    expect(body.stream).toBe(true);
    expect(body.messages.some((m: { role: string }) => m.role === "user")).toBe(
      true,
    );
    expect(
      (await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).filter(
        (a) => a.state === "sent",
      ),
    ).toHaveLength(1);
    const base = {
      id: `synthetic-${calls}`,
      object: "chat.completion.chunk",
      created: 1791210000,
      model: "synthetic/model",
    };
    const data =
      calls === 1
        ? [
            {
              ...base,
              choices: [
                {
                  index: 0,
                  delta: {
                    role: "assistant",
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
                  },
                  finish_reason: null,
                },
              ],
            },
            {
              ...base,
              choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
            },
            {
              ...base,
              choices: [],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
              },
            },
          ]
        : [
            {
              ...base,
              choices: [
                {
                  index: 0,
                  delta: {
                    role: "assistant",
                    content: "Die Idee ist gespeichert und bleibt ungeprüft. ",
                  },
                  finish_reason: null,
                },
              ],
            },
            {
              ...base,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            },
            {
              ...base,
              choices: [],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
              },
            },
          ];
    return new Response(
      data.map((d) => `data: ${JSON.stringify(d)}\n\n`).join("") +
        "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  await f.t.action(internal.ai.provider.execute, { runId });
  expect(calls).toBe(2);
  const status = await f.signed.query(api.ai.conversations.status, f.target);
  expect(status[0]).toMatchObject({
    state: "completed",
    estimatedMicros: 60,
    usagePending: false,
  });
  expect(status[0].resultIdeaId).not.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toEqual([]);
  const page = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(JSON.stringify(page)).toContain("Die Idee ist gespeichert");
  expect(JSON.stringify(page)).not.toContain('"text":"{');
});
test("stop inside actual physical Requesty response retains unobserved liability and permits safe late receipt", async () => {
  const f = await fixture(),
    runId = await f.send({ allowIdeaCreation: true });
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key-only");
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    await f.signed.mutation(api.ai.conversations.stop, f.target);
    return new Response(
      'data: {"id":"stopped","object":"chat.completion.chunk","created":1791210000,"model":"synthetic/model","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  await f.t.action(internal.ai.provider.execute, { runId });
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
  const r = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  expect(r.state).toBe("stopped");
  expect(r.executionFinishedAt).toBeGreaterThan(0);
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts).toHaveLength(1);
  expect(attempts[0].state).toBe("unknown");
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId: attempts[0]._id,
    inputTokens: 10,
    outputTokens: 20,
    errorCode: null,
  });
  expect((await f.t.run((ctx) => ctx.db.get(attempts[0]._id)))!.state).toBe(
    "settled",
  );
});
test("actual linked idea query works beyond the current page and denies invalid/foreign references", async () => {
  const f = await fixture();
  const id = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    title: "Linked result",
    note: "unverified",
    perspective: "interpretation",
    priority: "normal",
    source: { kind: "note" },
    operationKey: "linked-result-one",
  });
  expect(
    (await f.signed.query(api.content.ideas.get, {
      workspaceId: f.workspaceId,
      ideaId: id,
    }))!.idea._id,
  ).toBe(id);
  const foreign = await f.signed.mutation(api.workspaces.create, {
    name: "Foreign",
    description: "",
  });
  expect(
    await f.signed.query(api.content.ideas.get, {
      workspaceId: foreign,
      ideaId: id,
    }),
  ).toBeNull();
  expect(
    await f.signed.query(api.content.ideas.get, {
      workspaceId: f.workspaceId,
      ideaId: "guessed-native-id",
    }),
  ).toBeNull();
});

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();
test.each(["hash", "source", "actor", "expiry", "credential"] as const)(
  "actual approved private patch history/streams are blocked after %s withdrawal",
  async (mode) => {
    vi.useFakeTimers();
    const g = await sourceFixture();
    await signedDelivery(g);
    const receipt = (await g.t.run((ctx) =>
      ctx.db.query("githubWebhookReceipts").first(),
    ))!;
    await g.t.mutation(internal.integrations.github.deliveries.process, {
      receiptId: receipt._id,
    });
    const signal = (await g.t.run((ctx) =>
      ctx.db.query("githubSignals").first(),
    ))!;
    await g.signed.mutation(api.integrations.github.repositories.configure, {
      workspaceId: g.workspaceId,
      repositoryId: g.repositories[0],
      expectedGeneration: 1,
      access: true,
      monitoring: true,
      content: true,
      contextRead: true,
      communicableContext: "Explicit selected patch consent",
    });
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "synthetic-client");
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "synthetic-secret");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", privateKey);
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "synthetic");
    vi.stubEnv(
      "INTEGRATION_ENCRYPTION_KEY",
      base64(new Uint8Array(32).fill(1)),
    );
    const contextId = await g.signed.mutation(
      api.integrations.github.context.request,
      {
        workspaceId: g.workspaceId,
        signalId: signal._id,
        expectedGeneration: 2,
        paths: ["src/example.ts"],
        operationKey: "approved-chat-context",
      },
    );
    const patch =
      "@@ -1 +1 @@\n-export const name = 'old';\n+export const name = 'PRIVATE_SELECTED_DETAIL';";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      String(url).endsWith("/access_tokens")
        ? Response.json({
            token: "synthetic-token",
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            permissions: { metadata: "read", contents: "read" },
            repositories: [{ id: 101 }],
          })
        : Response.json({
            status: "ahead",
            total_commits: 1,
            base_commit: { sha: push.before },
            merge_base_commit: { sha: push.before },
            commits: [{ sha: push.after }],
            files: [
              {
                filename: "src/example.ts",
                sha: "3".repeat(40),
                status: "modified",
                patch,
                additions: 1,
                deletions: 1,
              },
            ],
          }),
    );
    await g.t.action(internal.integrations.github.contextRead.load, {
      contextId,
    });
    spy.mockRestore();
    const context = (await g.t.run((ctx) => ctx.db.get(contextId)))!;
    expect(context.state).toBe("ready");
    await g.signed.mutation(api.integrations.github.context.approve, {
      workspaceId: g.workspaceId,
      contextId,
      expectedHash: context.hash,
      approved: true,
    });
    const ideaId = await g.t.run((ctx) =>
      insertIdea(ctx, g.workspaceId, g.userId, "context-idea", "synthetic", {
        title: "Approved patch context",
        note: "",
        perspective: "Unverified interpretation",
        priority: "normal",
        source: { kind: "context", contextId },
        originals: ["Actual signed push metadata"],
        rationale: "Interpretation",
        questions: ["What was observed?"],
      }),
    );
    const f = await fixture(await modelFixture(g));
    const runId = await f.send({ ideaId });
    const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
    const streamId = await f.t.mutation(components.agent.streams.create, {
      threadId: c.threadId,
      order: 2,
      stepOrder: 0,
      format: "TextStreamPart",
    });
    await f.t.mutation(components.agent.streams.addDelta, {
      streamId,
      start: 0,
      end: 1,
      parts: [
        { type: "text-delta", id: "private", text: "PRIVATE_SELECTED_DETAIL" },
      ],
    });
    const before = await f.signed.query(api.ai.conversations.messages, {
      ...f.scope,
      threadId: f.conversationId,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(JSON.stringify(before)).toContain("PRIVATE_SELECTED_DETAIL");
    await f.t.run(async (ctx) => {
      if (mode === "hash")
        await ctx.db.patch(contextId, {
          approvedHash: undefined,
          approvedAt: undefined,
        });
      if (mode === "source")
        await ctx.db.patch(g.repositories[0], { content: false });
      if (mode === "expiry")
        await ctx.db.patch(g.repositories[0], {
          proofExpiresAt: Date.now() - 1,
        });
      if (mode === "credential") {
        const conn = (await ctx.db.query("githubConnections").first())!;
        await ctx.db.patch(conn._id, {
          credentialGeneration: conn.credentialGeneration + 1,
        });
      }
      if (mode === "actor") {
        const member = (await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique())!;
        await ctx.db.patch(member._id, { role: "Viewer" });
      }
    });
    const blocked = await f.signed.query(api.ai.conversations.messages, {
      ...f.scope,
      threadId: f.conversationId,
      paginationOpts: { numItems: 50, cursor: null },
      streamArgs: { kind: "deltas", cursors: [{ streamId, cursor: 0 }] },
    });
    expect(blocked.page).toEqual([]);
    expect(blocked.streams).toEqual({ kind: "deltas", deltas: [] });
    expect(
      await f.signed.query(api.ai.conversations.projection, f.target),
    ).toMatchObject({ authorized: false });
    expect(
      (await f.signed.query(api.ai.conversations.status, f.target))[0].runId,
    ).toBe(runId);
  },
);
test("malformed private tool arguments never enter SDK logs or native messages/deltas", async () => {
  const f = await fixture(),
    runId = await f.send({ allowIdeaCreation: true }),
    control = await claim(f, runId);
  const logs = vi.spyOn(console, "error").mockImplementation(() => {});
  const raw =
    '{"title":"PRIVATE_MALFORMED_ARGUMENT","perspective":"x","rationale":"x","questions":["q"],"publish":true}';
  const model = new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "tool-input-start", id: "call", toolName: "create_idea" },
          { type: "tool-input-delta", id: "call", delta: raw },
          { type: "tool-input-end", id: "call" },
          {
            type: "tool-call",
            toolCallId: "call",
            toolName: "create_idea",
            input: raw,
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: "tool_calls" },
            usage,
          },
        ],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    }),
  });
  await expect(
    f.t.action((ctx) =>
      generateForRun(ctx, runId, control.executionKey, model, true),
    ),
  ).rejects.toThrow();
  expect(JSON.stringify(logs.mock.calls)).not.toContain(
    "PRIVATE_MALFORMED_ARGUMENT",
  );
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
  const page = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { numItems: 50, cursor: null },
    streamArgs: { kind: "list" },
  });
  expect(JSON.stringify(page)).not.toContain("PRIVATE_MALFORMED_ARGUMENT");
  const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  const native = await f.t.query(components.agent.streams.list, {
    threadId: c.threadId,
    statuses: ["streaming", "finished", "aborted"],
  });
  for (const stream of native) {
    const result = await f.t.query(components.agent.streams.listDeltas, {
      threadId: c.threadId,
      cursors: [{ streamId: stream.streamId, cursor: 0 }],
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_MALFORMED_ARGUMENT");
  }
});
test("actual continuation receives completed idea receipt and cannot offer create tool again", async () => {
  const f = await fixture(),
    original = await f.send({ allowIdeaCreation: true }),
    first = await claim(f, original);
  const ideaId = await f.t.mutation(internal.ai.conversations.createIdea, {
    ...first,
    title: "Completed idea",
    perspective: "Unverified",
    rationale: "Unverified",
    questions: ["What?"],
  });
  await f.signed.mutation(api.ai.conversations.stop, f.target);
  const op = (await f.t.run((ctx) => ctx.db.query("chatOperations").first()))!;
  const resumed = await f.signed.mutation(api.ai.conversations.resume, {
    ...f.target,
    operationId: op._id,
    expectedRunId: original,
  });
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key-only");
  let calls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    calls++;
    expect(String(input)).toBe(
      "https://router.eu.requesty.ai/v1/chat/completions",
    );
    const body = JSON.parse(String(init?.body));
    expect(JSON.stringify(body.messages)).toContain(ideaId);
    expect(JSON.stringify(body.messages)).toContain(
      "completed creation receipt",
    );
    expect(
      body.tools?.some(
        (t: { function: { name: string } }) =>
          t.function.name === "create_idea",
      ),
    ).toBe(false);
    const base = {
      id: "synthetic-continuation",
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
              content: "Die vorherige Idee wartet auf menschliche Prüfung.",
            },
            finish_reason: null,
          },
        ],
      },
      { ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
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
  });
  await f.t.action(internal.ai.provider.execute, { runId: resumed });
  expect(calls).toBe(1);
  const status = await f.signed.query(api.ai.conversations.status, f.target);
  expect(status[0]).toMatchObject({
    state: "completed",
    resultIdeaId: ideaId,
    usagePending: false,
  });
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
  const page = await f.signed.query(api.ai.conversations.messages, {
    ...f.scope,
    threadId: f.conversationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(page.page.filter((m) => m.role === "user")).toHaveLength(1);
  expect(page.page.some((m) => m.text.includes("vorherige Idee"))).toBe(true);
});
test.each(["ready", "running", "stopped", "completed", "failed"] as const)(
  "generic stop denies a second real Editor for another actor's %s personal chat",
  async (state) => {
    const f = await fixture(),
      runId = await f.send();
    const identity = await f.t.run(async (ctx) => {
      const user = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "user",
          data: {
            name: "Second Editor",
            email: "second-chat-editor@example.test",
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
              token: crypto.randomUUID(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              expiresAt: Date.now() + 86400000,
            },
          },
        },
      );
      return { subject: user._id, sessionId: session._id };
    });
    const other = f.t.withIdentity(identity),
      userId = await other.mutation(api.users.bootstrap, {});
    await f.t.run(async (ctx) => {
      await ctx.db.insert("memberships", {
        userId,
        workspaceId: f.workspaceId,
        role: "Editor",
      });
      await ctx.db.patch(runId, { state });
    });
    expect(
      (
        await other.query(api.ai.runs.recent, { workspaceId: f.workspaceId })
      ).some((r) => r.runId === runId),
    ).toBe(true);
    await expect(
      other.mutation(api.ai.conversations.stop, f.target),
    ).rejects.toThrow("CHAT_ACCESS_DENIED");
    await expect(
      other.mutation(api.ai.runs.stop, { workspaceId: f.workspaceId, runId }),
    ).rejects.toThrow("CHAT_ACCESS_DENIED");
    expect((await f.t.run((ctx) => ctx.db.get(runId)))!).toMatchObject({
      state,
      generation: 1,
    });
  },
);
test("authorized generic chat stop fences the run and aborts actual native streaming without losing late usage", async () => {
  const f = await fixture(),
    runId = await f.send(),
    control = await claim(f, runId);
  const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  const streamId = await f.t.mutation(components.agent.streams.create, {
    threadId: c.threadId,
    order: 0,
    stepOrder: 0,
    format: "TextStreamPart",
  });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    ...control,
    key: "generic-stop-late-usage",
  });
  await f.signed.mutation(api.ai.runs.stop, {
    workspaceId: f.workspaceId,
    runId,
  });
  expect((await f.t.run((ctx) => ctx.db.get(runId)))!).toMatchObject({
    state: "stopped",
    generation: 2,
  });
  const abort = (
    await f.t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    )
  ).find((job) => job.name.includes("conversations:abortStreams"));
  expect(abort?.args[0]).toEqual({
    conversationId: c._id,
    expectedRunId: runId,
  });
  await f.t.mutation(internal.ai.conversations.abortStreams, abort!.args[0]);
  const streams = await f.t.query(components.agent.streams.list, {
    threadId: c.threadId,
    statuses: ["aborted"],
  });
  expect(streams.some((s) => s.streamId === streamId)).toBe(true);
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: 10,
    outputTokens: 20,
    errorCode: null,
  });
  expect((await f.t.run((ctx) => ctx.db.get(attemptId)))!).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
    heldMicros: 0,
  });
});
test("delayed generic-stop abort cannot abort the newer actual continuation", async () => {
  const f = await fixture(),
    runId = await f.send();
  await f.signed.mutation(api.ai.runs.stop, {
    workspaceId: f.workspaceId,
    runId,
  });
  const op = (await f.t.run((ctx) => ctx.db.query("chatOperations").first()))!;
  const resumed = await f.signed.mutation(api.ai.conversations.resume, {
    ...f.target,
    operationId: op._id,
    expectedRunId: runId,
  });
  const c = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
  const streamId = await f.t.mutation(components.agent.streams.create, {
    threadId: c.threadId,
    order: 0,
    stepOrder: 0,
    format: "TextStreamPart",
  });
  await f.t.mutation(internal.ai.conversations.abortStreams, {
    conversationId: c._id,
    expectedRunId: runId,
  });
  const streams = await f.t.query(components.agent.streams.list, {
    threadId: c.threadId,
    statuses: ["streaming"],
  });
  expect(streams.some((s) => s.streamId === streamId)).toBe(true);
  expect((await f.t.run((ctx) => ctx.db.get(resumed)))!.state).toBe("ready");
});

test.each(["status", "resume", "continuation-authority"] as const)(
  "chat %s rejects a foreign account receipt before usage shortcuts",
  async (consumer) => {
    const f = await fixture(),
      runId = await f.send(),
      control = await claim(f, runId);
    const attemptId = await f.t.mutation(internal.ai.runs.fund, {
      ...control,
      key: "chat-owned-receipt",
    });
    await f.t.mutation(internal.ai.runs.settle, {
      attemptId,
      inputTokens: 10,
      outputTokens: 20,
      errorCode: null,
    });
    await f.signed.mutation(api.ai.conversations.stop, f.target);
    const op = (await f.t.run((ctx) =>
      ctx.db.query("chatOperations").first(),
    ))!;
    const resumeArgs = {
      ...f.target,
      operationId: op._id,
      expectedRunId: runId,
    };
    const next =
      consumer === "continuation-authority"
        ? await f.signed.mutation(api.ai.conversations.resume, resumeArgs)
        : null;
    await f.t.run(async (ctx) => {
      const receipt = (await ctx.db.get(attemptId))!;
      const { _id, _creationTime, ...account } = (await ctx.db.get(
        f.accountId,
      ))!;
      const foreignAccount = await ctx.db.insert("socialAccounts", account);
      await ctx.db.patch(receipt.budgetIds[2], { accountId: foreignAccount });
      await ctx.db.patch(attemptId, { state: "unknown" });
    });
    if (consumer === "status")
      await expect(
        f.signed.query(api.ai.conversations.status, f.target),
      ).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
    if (consumer === "resume")
      await expect(
        f.signed.mutation(api.ai.conversations.resume, resumeArgs),
      ).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
    if (next)
      await expect(claim(f, next)).rejects.toThrow(
        "MODEL_ATTEMPT_OWNER_INVALID",
      );
  },
);
