import { test, expect, afterEach, beforeEach, vi } from "vitest";
import { api, internal, components } from "../_generated/api";
import { mediaFixture } from "../../tests/media-fixture";
import { modelFixture } from "../../tests/model-fixture";
import { sourceFixture, send } from "../../tests/github-fixture";
import { MockLanguageModelV3 } from "ai/test";
import { generateForRun } from "../ai/provider";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const input = {
  title: "Synthetic idea",
  note: "My own unverified account",
  perspective: "Why does this matter?",
  priority: "normal" as const,
  source: { kind: "note" as const },
};
async function manual() {
  const f = await mediaFixture();
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    ...input,
    operationKey: "manual-one",
  });
  return { ...f, ideaId };
}
async function current(f: Awaited<ReturnType<typeof manual>>) {
  return (
    await f.signed.query(api.content.ideas.list, {
      workspaceId: f.workspaceId,
      paginationOpts: { numItems: 25, cursor: null },
    })
  ).page.find((x) => x.idea._id === f.ideaId)!;
}
const handoffArgs = (f: Awaited<ReturnType<typeof manual>>) => ({
  workspaceId: f.workspaceId,
  ideaId: f.ideaId,
  expectedRevision: 1,
  accountId: null,
  intent: "Prepare an editable draft only",
  draftText: "User supplied claim: My account",
  clarificationConfirmed: false,
});
const proposal = {
  title: "Possible perspective",
  perspective: "What should we ask about this change?",
  rationale: "Explore the stated context; success is unproven",
  questions: ["What was actually achieved?"],
};
async function generative() {
  vi.stubEnv("REQUESTY_API_KEY", "");
  const f = await modelFixture();
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    ...input,
    operationKey: "manual-one",
  });
  const runId = await f.signed.mutation(api.content.ideas.generate, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    intent: "Explore perspective; do not publish",
    operationKey: "generate-one",
  });
  return { ...f, ideaId, runId };
}
const response = (p = proposal) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify({ text: JSON.stringify(p) }),
    },
  ],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 20, text: 20, reasoning: 0 },
  },
  warnings: [],
});
test("manual notes work with no policy/Jev; duplicate exact command creates once, changed inputs cannot overwrite", async () => {
  const f = await manual();
  expect(
    await f.signed.mutation(api.content.ideas.create, {
      workspaceId: f.workspaceId,
      ...input,
      operationKey: "manual-one",
    }),
  ).toBe(f.ideaId);
  await expect(
    f.signed.mutation(api.content.ideas.create, {
      workspaceId: f.workspaceId,
      ...input,
      title: "different",
      operationKey: "manual-one",
    }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  const row = await current(f);
  expect(row.version.note).toBe(input.note);
  expect(row.version.originals).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
});
test("concurrent handoff returns one actual immutable editorial draft/version and never creates approvals or schedules", async () => {
  const f = await manual();
  const [a, b] = await Promise.all([
    f.signed.mutation(api.content.ideas.handoff, handoffArgs(f)),
    f.signed.mutation(api.content.ideas.handoff, handoffArgs(f)),
  ]);
  expect(a).toEqual(b);
  const bundle = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: a.draftId,
  });
  expect(bundle!.versions[0]._id).toBe(a.versionId);
  expect(bundle!.versions[0].content.text).toEqual([handoffArgs(f).draftText]);
  expect(bundle!.approvals).toEqual([]);
  expect(bundle!.schedules).toEqual([]);
  expect((await current(f)).idea.handoff).toMatchObject({
    ideaVersionId: a.ideaVersionId,
    actorId: f.userId,
    intent: handoffArgs(f).intent,
  });
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toHaveLength(
    1,
  );
});
test("CAS edit preserves history and actor feedback, existing historical handoff never rebinds edited version/account/text", async () => {
  const f = await manual();
  const h = await f.signed.mutation(api.content.ideas.handoff, handoffArgs(f));
  const edits = () =>
    f.signed.mutation(api.content.ideas.edit, {
      workspaceId: f.workspaceId,
      ideaId: f.ideaId,
      expectedRevision: 1,
      title: "Edited",
      note: "Corrected account",
      perspective: "Own change",
      priority: "high",
      feedback: "Corrected an unsupported statement",
    });
  await edits();
  await expect(edits()).rejects.toThrow("REVISION_CONFLICT");
  const row = await current(f);
  expect(row.idea.handoff!.draftId).toBe(h.draftId);
  expect(row.version.number).toBe(2);
  const history = await f.signed.query(api.content.ideas.history, {
    workspaceId: f.workspaceId,
    ideaId: f.ideaId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(history.page.map((v) => v.title)).toEqual(["Edited", input.title]);
  const feedback = await f.signed.query(api.content.ideas.feedback, {
    workspaceId: f.workspaceId,
    ideaId: f.ideaId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(feedback.page[0]).toMatchObject({
    actorId: f.userId,
    kind: "edit",
    resultingVersionId: row.version._id,
  });
  await expect(
    f.signed.mutation(api.content.ideas.handoff, {
      ...handoffArgs(f),
      expectedRevision: 2,
    }),
  ).rejects.toThrow("ALREADY_BOUND");
});
test("archive/restore are durable CAS feedback, archived ideas cannot hand off", async () => {
  const f = await manual();
  await f.signed.mutation(api.content.ideas.archive, {
    workspaceId: f.workspaceId,
    ideaId: f.ideaId,
    expectedRevision: 1,
    archived: true,
    feedback: "Not relevant",
  });
  await expect(
    f.signed.mutation(api.content.ideas.handoff, {
      ...handoffArgs(f),
      expectedRevision: 2,
    }),
  ).rejects.toThrow("ARCHIVED");
  await f.signed.mutation(api.content.ideas.archive, {
    workspaceId: f.workspaceId,
    ideaId: f.ideaId,
    expectedRevision: 2,
    archived: false,
    feedback: "Reconsidered",
  });
  expect((await current(f)).idea).toMatchObject({ status: "new", revision: 3 });
});
test("foreign account/idea/workspace and viewer/lifecycle authority are rejected before writes", async () => {
  const f = await manual();
  const foreign = await f.t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "",
    });
    return {
      workspaceId,
      accountId: await ctx.db.insert("socialAccounts", {
        workspaceId,
        provider: "X",
        providerIdentity: "foreign",
        name: "Foreign",
        handle: "foreign",
        connection: "connected",
        capability: {
          maxText: 280,
          maxThread: 10,
          maxMedia: 4,
          mediaTypes: ["image"],
          publish: false,
        },
      }),
    };
  });
  await expect(
    f.signed.mutation(api.content.ideas.handoff, {
      ...handoffArgs(f),
      accountId: foreign.accountId,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS");
  await expect(
    f.signed.query(api.content.ideas.list, {
      workspaceId: foreign.workspaceId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS");
  await f.t.run(async (ctx) => {
    const m = await ctx.db.query("memberships").first();
    await ctx.db.patch(m!._id, { role: "Viewer" });
  });
  await expect(
    f.signed.mutation(api.content.ideas.handoff, handoffArgs(f)),
  ).rejects.toThrow("ROLE_ACCESS");
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(
    f.signed.query(api.content.ideas.list, {
      workspaceId: f.workspaceId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toEqual([]);
});
test("actual signed signal gets factual IDs and immutable metadata, content withdrawal blocks future handoff/generation", async () => {
  const f = await sourceFixture(2);
  await f.t.run((ctx) => ctx.db.patch(f.repositories[0], { content: true }));
  expect((await send(f)).status).toBe(202);
  const receipt = await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  );
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt!._id,
  });
  const signal = await f.t.run((ctx) =>
    ctx.db
      .query("githubSignals")
      .withIndex("by_workspaceId_and_receivedAt", (q) =>
        q.eq("workspaceId", f.workspaceId),
      )
      .first(),
  );
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    ...input,
    source: { kind: "signal", signalId: signal!._id },
    operationKey: "signal-idea",
  });
  const row = (
    await f.signed.query(api.content.ideas.list, {
      workspaceId: f.workspaceId,
      paginationOpts: { numItems: 10, cursor: null },
    })
  ).page[0];
  expect(row.version.source).toEqual({
    kind: "signal",
    signalId: signal!._id,
    repositoryId: f.repositories[0],
    generation: 1,
  });
  expect(row.version.originals.join()).toContain(
    "1 gelieferte Commit-Einträge",
  );
  expect(JSON.stringify(row)).not.toContain("private secret");
  await expect(
    f.signed.mutation(api.content.ideas.create, {
      workspaceId: f.workspaces[1],
      ...input,
      source: { kind: "signal", signalId: signal!._id },
      operationKey: "foreign-signal",
    }),
  ).rejects.toThrow("REFERENCE_ACCESS");
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { content: false, generation: 2 }),
  );
  await expect(
    f.signed.mutation(api.content.ideas.handoff, {
      ...handoffArgs({ ...f, ideaId }),
      accountId: null,
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
});
test("configuration failure preserves original manual idea with no attempts/new results", async () => {
  const f = await manual();
  const account = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
      name: "Synthetic",
      handle: "syn",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: false,
      },
    }),
  );
  await expect(
    f.signed.mutation(api.content.ideas.generate, {
      workspaceId: f.workspaceId,
      ideaId: f.ideaId,
      expectedRevision: 1,
      accountId: account,
      intent: "Propose",
      operationKey: "generate-one",
    }),
  ).rejects.toThrow("PROCESSING_CONFIGURATION");
  expect((await current(f)).version.note).toBe(input.note);
  expect(
    await f.t.run((ctx) => ctx.db.query("contentRequests").collect()),
  ).toEqual([]);
});
test("actual fixed provider funds before physical request, stores real proposal/official thread, preserves original and requires clarification", async () => {
  const f = await generative();
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key");
  let calls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    calls++;
    expect(String(input)).toBe(
      "https://router.eu.requesty.ai/v1/chat/completions",
    );
    expect(init?.redirect).toBe("error");
    const attempts = await f.t.run((ctx) =>
      ctx.db.query("aiAttempts").collect(),
    );
    expect(attempts).toHaveLength(1);
    expect(attempts[0].state).toBe("sent");
    return Response.json({
      id: "synthetic-result",
      object: "chat.completion",
      created: 1791210000,
      model: "synthetic/model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ text: JSON.stringify(proposal) }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  });
  await f.t.action(internal.ai.provider.execute, { runId: f.runId });
  expect(calls).toBe(1);
  const request = await f.t.run((ctx) =>
    ctx.db.query("contentRequests").first(),
  );
  expect(request!.resultIdeaId).not.toBeNull();
  const rows = await f.signed.query(api.content.ideas.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  const created = rows.page.find((x) => x.idea._id === request!.resultIdeaId)!;
  expect(created.version).toMatchObject({
    runId: f.runId,
    inputVersionId: rows.page.find((x) => x.idea._id === f.ideaId)!.version._id,
    originals: [],
    note: input.note,
    ...proposal,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.runId)))!.state).toBe(
    "completed",
  );
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: (await f.t.run((ctx) => ctx.db.get(f.runId)))!.threadId,
      order: "desc",
      paginationOpts: { numItems: 10, cursor: null },
    },
  );
  expect(
    messages.page.some(
      (m) => m.message?.role === "assistant" && m.status === "success",
    ),
  ).toBe(true);
  await expect(
    f.signed.mutation(api.content.ideas.handoff, {
      ...handoffArgs({ ...f, ideaId: created.idea._id }),
    }),
  ).rejects.toThrow("CLARIFICATION_REQUIRED");
  expect(await f.t.run((ctx) => ctx.db.query("approvals").collect())).toEqual(
    [],
  );
});
test.each(["stop", "role", "lifecycle", "edit"])(
  "%s after physical funded return prevents late content commit while usage is preserved",
  async (kind) => {
    const f = await generative();
    const executionKey = "execution";
    await f.t.mutation(internal.ai.runs.claim, {
      runId: f.runId,
      executionKey,
    });
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        if (kind === "stop")
          await f.signed.mutation(api.ai.runs.stop, {
            workspaceId: f.workspaceId,
            runId: f.runId,
          });
        if (kind === "role")
          await f.t.run(async (ctx) => {
            const m = await ctx.db.query("memberships").first();
            await ctx.db.patch(m!._id, { role: "Viewer" });
          });
        if (kind === "lifecycle")
          await f.t.run((ctx) =>
            ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
          );
        if (kind === "edit")
          await f.signed.mutation(api.content.ideas.edit, {
            workspaceId: f.workspaceId,
            ideaId: f.ideaId,
            expectedRevision: 1,
            title: input.title,
            note: input.note,
            perspective: input.perspective,
            priority: input.priority,
            feedback: "Changed source idea",
          });
        return response();
      },
    });
    await expect(
      f.t.action((ctx) => generateForRun(ctx, f.runId, executionKey, model)),
    ).rejects.toThrow();
    expect(
      (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!
        .estimatedMicros,
    ).toBe(30);
    expect(
      (await f.t.run((ctx) => ctx.db.query("contentRequests").first()))!
        .resultIdeaId,
    ).toBeNull();
    expect(
      await f.t.run((ctx) => ctx.db.query("ideas").collect()),
    ).toHaveLength(1);
  },
);
test("unknown/foreign fields and creation-success claims fail strict output, no domain object is invented", async () => {
  const f = await generative();
  const executionKey = "malicious";
  await f.t.mutation(internal.ai.runs.claim, { runId: f.runId, executionKey });
  const model = new MockLanguageModelV3({ doGenerate: async () => response() });
  await f.t.action((ctx) => generateForRun(ctx, f.runId, executionKey, model));
  await expect(
    f.t.mutation(internal.content.ideas.commitProposal, {
      runId: f.runId,
      executionKey,
      output: JSON.stringify({
        ...proposal,
        workspaceId: f.workspaceId,
        published: true,
        draftId: "invented",
      }),
    }),
  ).rejects.toThrow();
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toEqual([]);
});
test("strict manual fields, page limits and changed generation operation cannot overread or retry paid work", async () => {
  const f = await generative();
  await expect(
    f.signed.mutation(api.content.ideas.generate, {
      workspaceId: f.workspaceId,
      ideaId: f.ideaId,
      expectedRevision: 1,
      accountId: f.accountId,
      intent: "Different",
      operationKey: "generate-one",
    }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  expect(
    await f.signed.mutation(api.content.ideas.generate, {
      workspaceId: f.workspaceId,
      ideaId: f.ideaId,
      expectedRevision: 1,
      accountId: f.accountId,
      intent: "Explore perspective; do not publish",
      operationKey: "generate-one",
    }),
  ).toBe(f.runId);
  await expect(
    f.signed.query(api.content.ideas.list, {
      workspaceId: f.workspaceId,
      paginationOpts: { numItems: 500, cursor: null },
    }),
  ).rejects.toThrow("PAGE_LIMIT");
});
test("repeat proposal commit creates once; different result under the same run is rejected", async () => {
  const f = await generative(),
    executionKey = "one-execution";
  await f.t.mutation(internal.ai.runs.claim, { runId: f.runId, executionKey });
  const model = new MockLanguageModelV3({ doGenerate: async () => response() });
  const output = await f.t.action((ctx) =>
    generateForRun(ctx, f.runId, executionKey, model),
  );
  const commit = () =>
    f.t.mutation(internal.content.ideas.commitProposal, {
      runId: f.runId,
      executionKey,
      output,
    });
  const [a, b] = await Promise.all([commit(), commit()]);
  expect(a).toBe(b);
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    2,
  );
  await expect(
    f.t.mutation(internal.content.ideas.commitProposal, {
      runId: f.runId,
      executionKey,
      output: JSON.stringify({ ...proposal, title: "Different output" }),
    }),
  ).rejects.toThrow("OUTPUT_CONFLICT");
});
test("actual transport failure makes one funded request, keeps unknown liabilities and preserves the idea", async () => {
  const f = await generative();
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-provider-secret");
  let calls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    calls++;
    throw new Error("synthetic-provider-secret");
  });
  await f.t.action(internal.ai.provider.execute, { runId: f.runId });
  expect(calls).toBe(1);
  const run = await f.t.run((ctx) => ctx.db.get(f.runId));
  expect(run).toMatchObject({ state: "failed", errorCode: "MODEL_RUN_FAILED" });
  const [attempt] = await f.t.run((ctx) =>
    ctx.db.query("aiAttempts").collect(),
  );
  expect(attempt.state).toBe("unknown");
  expect(attempt.heldMicros).toBeGreaterThan(0);
  expect(JSON.stringify(attempt)).not.toContain("synthetic-provider-secret");
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
  expect(
    (await f.t.run((ctx) => ctx.db.query("contentRequests").first()))!
      .resultIdeaId,
  ).toBeNull();
});
test("idea revision changed after valid model return is rechecked before domain commit", async () => {
  const f = await generative(),
    executionKey = "late-change";
  await f.t.mutation(internal.ai.runs.claim, { runId: f.runId, executionKey });
  const output = await f.t.action((ctx) =>
    generateForRun(
      ctx,
      f.runId,
      executionKey,
      new MockLanguageModelV3({ doGenerate: async () => response() }),
    ),
  );
  await f.signed.mutation(api.content.ideas.edit, {
    workspaceId: f.workspaceId,
    ideaId: f.ideaId,
    expectedRevision: 1,
    title: "Changed",
    note: input.note,
    perspective: input.perspective,
    priority: input.priority,
    feedback: "Changed after response",
  });
  await expect(
    f.t.mutation(internal.content.ideas.commitProposal, {
      runId: f.runId,
      executionKey,
      output,
    }),
  ).rejects.toThrow("IDEA_SOURCE_CHANGED");
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
});
test("source withdrawal during actual generation settles usage but cannot derive a new idea", async () => {
  const source = await sourceFixture();
  const f = await modelFixture(source);
  await f.t.run((ctx) =>
    ctx.db.patch(source.repositories[0], { content: true }),
  );
  await send(f);
  const receipt = await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  );
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt!._id,
  });
  const signal = await f.t.run((ctx) => ctx.db.query("githubSignals").first());
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    ...input,
    source: { kind: "signal", signalId: signal!._id },
    operationKey: "signal-one",
  });
  const runId = await f.signed.mutation(api.content.ideas.generate, {
      workspaceId: f.workspaceId,
      ideaId,
      expectedRevision: 1,
      accountId: f.accountId,
      intent: "Explore original only",
      operationKey: "source-generate",
    }),
    executionKey = "source-execution";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  await expect(
    f.t.action((ctx) =>
      generateForRun(
        ctx,
        runId,
        executionKey,
        new MockLanguageModelV3({
          doGenerate: async () => {
            await f.t.run((ctx) =>
              ctx.db.patch(source.repositories[0], {
                content: false,
                generation: 2,
              }),
            );
            return response();
          },
        }),
      ),
    ),
  ).rejects.toThrow("MODEL_PROVIDER_UNAVAILABLE");
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!
      .estimatedMicros,
  ).toBe(30);
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
});
test("same linked revision cannot silently change own account, intent or text", async () => {
  const f = await manual();
  await f.signed.mutation(api.content.ideas.handoff, handoffArgs(f));
  const model = await modelFixture(f);
  for (const delta of [
    { accountId: model.accountId },
    { intent: "Different intent" },
    { draftText: "Different text" },
  ])
    await expect(
      f.signed.mutation(api.content.ideas.handoff, {
        ...handoffArgs(f),
        ...delta,
      }),
    ).rejects.toThrow("ALREADY_BOUND");
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toHaveLength(
    1,
  );
});
test("manual trust boundary rejects control text and forged actor fields", async () => {
  const f = await manual();
  await expect(
    f.signed.mutation(api.content.ideas.create, {
      workspaceId: f.workspaceId,
      ...input,
      title: "bad\u0000title",
      operationKey: "invalid-text",
    }),
  ).rejects.toThrow("INPUT_INVALID");
  await expect(
    f.signed.mutation(api.content.ideas.create, {
      workspaceId: f.workspaceId,
      ...input,
      operationKey: "forged-actor",
      actorId: f.userId,
    } as never),
  ).rejects.toThrow("Unexpected field");
});
