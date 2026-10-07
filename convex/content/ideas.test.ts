import { ConvexError } from "convex/values";
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
  expect(
    (bundle!.versions[0] as unknown as { ideaVersionId: string }).ideaVersionId,
  ).toBe(a.ideaVersionId);
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
  const copied = await f.signed.mutation(
    api.content.ideas.handoff,
    handoffArgs({ ...f, ideaId }),
  );
  // Existing exact legacy relation remains usable even before optional source-field migration.
  await f.t.run((ctx) =>
    ctx.db.patch(copied.versionId, { ideaVersionId: undefined }),
  );
  expect(
    (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: copied.draftId,
    }))!.versions[0].content.title,
  ).toBe(input.title);
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { content: false, generation: 2 }),
  );
  expect(
    (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: copied.draftId,
    }))!.versions[0].content.title,
  ).toBe("");
  await expect(
    f.signed.mutation(api.content.ideas.handoff, {
      ...handoffArgs({ ...f, ideaId }),
      accountId: null,
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
  const protectedReads = [
    await f.signed.query(api.content.ideas.get, {
      workspaceId: f.workspaceId,
      ideaId,
    }),
    await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: copied.draftId,
    }),
    await f.signed.query(api.editorial.history, {
      workspaceId: f.workspaceId,
      draftId: copied.draftId,
      paginationOpts: { cursor: null, numItems: 20 },
    }),
  ];
  expect(JSON.stringify(protectedReads)).not.toContain(input.title);
  expect(JSON.stringify(protectedReads)).not.toContain(
    handoffArgs({ ...f, ideaId }).draftText,
  );
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

const declaredStyle = {
  author: "Declared author",
  experiences: ["User asserts this experience"],
  tone: "Concise and curious",
  positioning: "Ask precise questions",
  pillars: [{ name: "Practice", weight: 100 }],
  examples: ["An example, never biography"],
  forbidden: ["guaranteed success"],
};
async function styledGeneration() {
  const f = await modelFixture();
  const scope = { workspaceId: f.workspaceId, accountId: f.accountId };
  const saved = await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 0,
    commandKey: "style-save-one",
    action: {
      kind: "save",
      payload: declaredStyle,
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Explicit declaration",
    },
  });
  const selected = await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 1,
    commandKey: "style-select-one",
    action: {
      kind: "select",
      versionId: saved.versionId!,
      reason: "Use this style",
    },
  });
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    ...input,
    operationKey: "styled-note-one",
  });
  const runId = await f.signed.mutation(api.content.ideas.generate, {
    ...scope,
    ideaId,
    expectedRevision: 1,
    intent: "Ask a precise question",
    operationKey: "styled-generation-one",
  });
  return { ...f, scope, saved, selected, ideaId, runId };
}
test("TASK45.2 exact style pin survives unselected saves and retained output is erased after selector loss", async () => {
  const f = await styledGeneration();
  const run = (await f.t.run((ctx) => ctx.db.get(f.runId)))!;
  expect(run).toHaveProperty("styleContext", {
    versionId: f.saved.versionId,
    fingerprint: expect.any(String),
    selectedBy: f.userId,
    selectionReceiptId: f.selected.receiptId,
    sourceUntil: null,
  });
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init!.body));
    expect(JSON.stringify(body.messages)).toContain("explicitUserAssertions");
    expect(JSON.stringify(body.messages)).toContain(declaredStyle.author);
    expect(JSON.stringify(body.messages)).toContain("preferencesAndExamples");
    return Response.json({
      id: "styled-result",
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
  await f.signed.mutation(api.ai.styleProfiles.change, {
    ...f.scope,
    expectedRevision: 2,
    commandKey: "style-unselected-two",
    action: {
      kind: "save",
      payload: { ...declaredStyle, tone: "Other" },
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Unselected",
    },
  });
  await f.t.action(internal.ai.provider.execute, { runId: f.runId });
  const request = (await f.t.run((ctx) =>
    ctx.db.query("contentRequests").first(),
  ))!;
  expect(request.resultIdeaId).not.toBeNull();
  const result = (await f.signed.query(api.content.ideas.get, {
    workspaceId: f.workspaceId,
    ideaId: request.resultIdeaId!,
  }))!;
  await f.signed.mutation(api.content.ideas.edit, {
    workspaceId: f.workspaceId,
    ideaId: result.idea._id,
    expectedRevision: 1,
    title: "Styled edit",
    note: "Retained user claim",
    perspective: "Edited interpretation",
    priority: "normal",
    feedback: "Protected feedback",
  });
  for (let n = 2; n <= 27; n++)
    await f.signed.mutation(api.content.ideas.edit, {
      workspaceId: f.workspaceId,
      ideaId: result.idea._id,
      expectedRevision: n,
      title: "Styled edit",
      note: "Retained user claim",
      perspective: "Edited interpretation",
      priority: "normal",
      feedback: "Protected feedback",
    });
  await f.t.mutation(internal.research.contentCleanup.expired, {});
  await f.t.finishInProgressScheduledFunctions();
  expect(
    (await f.signed.query(api.content.ideas.get, {
      workspaceId: f.workspaceId,
      ideaId: result.idea._id,
    }))!.version.title,
  ).toBe("Styled edit");
  const handoff = await f.signed.mutation(api.content.ideas.handoff, {
    ...f.scope,
    ideaId: result.idea._id,
    expectedRevision: 28,
    intent: "Protected intent",
    draftText: "Protected draft text",
    clarificationConfirmed: true,
  });
  await f.signed.mutation(api.editorial.addComment, {
    workspaceId: f.workspaceId,
    versionId: handoff.versionId,
    text: "Protected comment",
  });
  await f.t.run(async (ctx) => {
    const member = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.patch(member._id, { role: "Editor" });
  });
  const masked = (await f.signed.query(api.content.ideas.get, {
    workspaceId: f.workspaceId,
    ideaId: result.idea._id,
  }))!;
  expect(masked.version.sourceUnavailable).toBe(true);
  expect(masked.version.title).toBe("");
  await f.t.mutation(internal.ai.styleProfiles.purge, {
    versionId: f.saved.versionId!,
    proposalId: null,
  });
  await f.t.finishInProgressScheduledFunctions();
  for (let i = 0; i < 15; i++) {
    await vi.advanceTimersByTimeAsync(1000);
    await f.t.finishInProgressScheduledFunctions();
  }
  expect(
    (await f.t.run((ctx) => ctx.db.get(handoff.versionId)))!.content.text,
  ).toEqual([""]);
  expect(
    (await f.t.run((ctx) => ctx.db.query("editorialComments").first()))!.text,
  ).toBe("");
  const erased = await f.t.run((ctx) =>
    ctx.db
      .query("ideaVersions")
      .withIndex("by_runId", (q) => q.eq("runId", f.runId))
      .take(50),
  );
  expect(erased).toHaveLength(28);
  expect(
    erased.every(
      (v) => v.sourceUnavailable && !v.title && !v.note && !v.perspective,
    ),
  ).toBe(true);
  expect((await f.t.run((ctx) => ctx.db.get(request._id)))!.intent).toBe("");
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!.state,
  ).toBe("settled");
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: run.threadId,
      order: "desc",
      paginationOpts: { numItems: 10, cursor: null },
    },
  );
  expect(messages.page).toEqual([]);
});

test("TASK45.2 reselection of the same immutable version fences funding and exact retry never recaptures", async () => {
  const f = await styledGeneration(),
    executionKey = "same-style-selection";
  await f.t.mutation(internal.ai.runs.claim, { runId: f.runId, executionKey });
  await f.signed.mutation(api.ai.styleProfiles.change, {
    ...f.scope,
    expectedRevision: 2,
    commandKey: "style-reselect-same",
    action: {
      kind: "select",
      versionId: f.saved.versionId!,
      reason: "New explicit selection",
    },
  });
  await expect(
    f.t.mutation(internal.ai.runs.fund, {
      runId: f.runId,
      generation: 1,
      executionKey,
      key: "reselection-attempt",
    }),
  ).rejects.toThrow("STYLE_SELECTION_CHANGED");
  expect(
    await f.signed.mutation(api.content.ideas.generate, {
      ...f.scope,
      ideaId: f.ideaId,
      expectedRevision: 1,
      intent: "Ask a precise question",
      operationKey: "styled-generation-one",
    }),
  ).toBe(f.runId);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.runId)))!.styleContext!
      .selectionReceiptId,
  ).toBe(f.selected.receiptId);
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
});
test("TASK45.2 selection withdrawal during actual I/O settles cost once and rejects output", async () => {
  const f = await styledGeneration();
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key");
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    await f.signed.mutation(api.ai.styleProfiles.change, {
      ...f.scope,
      expectedRevision: 2,
      commandKey: "style-reset-midcall",
      action: { kind: "reset", reason: "Withdraw active style use" },
    });
    return Response.json({
      id: "withdrawn-style",
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
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ state: "settled", estimatedMicros: 30 });
  expect(
    (await f.t.run((ctx) => ctx.db.query("contentRequests").first()))!
      .resultIdeaId,
  ).toBeNull();
  await f.t.mutation(internal.ai.runs.purgeSource, { runId: f.runId });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.runId)))!.sourceCleanupState,
  ).toBeUndefined();
});

test("TASK45.2 valid unbounded Owner style discovers and erases a former Editor's retained run", async () => {
  const f = await styledGeneration();
  const identity = await f.t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Style Editor",
          email: "style-editor@example.test",
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
  const editor = f.t.withIdentity(identity);
  const editorId = await editor.mutation(api.users.bootstrap, {});
  const membershipId = await f.t.run((ctx) =>
    ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId: editorId,
      role: "Editor",
    }),
  );
  const runId = await editor.mutation(api.content.ideas.generate, {
    ...f.scope,
    ideaId: f.ideaId,
    expectedRevision: 1,
    intent: "Editor perspective",
    operationKey: "editor-generation-one",
  });
  const executionKey = "editor-output";
  await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
  const output = await f.t.action((ctx) =>
    generateForRun(
      ctx,
      runId,
      executionKey,
      new MockLanguageModelV3({ doGenerate: async () => response() }),
    ),
  );
  const ideaId = (await f.t.mutation(internal.content.ideas.commitProposal, {
    runId,
    executionKey,
    output,
  }))!;
  await f.t.mutation(internal.ai.runs.finish, {
    runId,
    generation: 1,
    executionKey,
    failed: false,
  });
  await f.t.run((ctx) => ctx.db.patch(membershipId, { role: "Viewer" }));
  expect(
    (
      await f.signed.query(api.ai.styleProfiles.version, {
        ...f.scope,
        versionId: f.saved.versionId!,
      })
    ).payload,
  ).not.toBeNull();
  expect(
    (await f.signed.query(api.content.ideas.get, {
      workspaceId: f.workspaceId,
      ideaId,
    }))!.version.sourceUnavailable,
  ).toBe(true);
  await f.t.mutation(internal.ai.styleProfiles.sweep, {
    table: "versions",
    cursor: null,
  });
  for (let i = 0; i < 10; i++) {
    await vi.advanceTimersByTimeAsync(1000);
    await f.t.finishInProgressScheduledFunctions();
  }
  expect((await f.t.run((ctx) => ctx.db.get(runId)))!.sourceCleanupState).toBe(
    "complete",
  );
  const raw = await f.t.run(async (ctx) =>
    ctx.db.get((await ctx.db.get(ideaId))!.currentVersionId!),
  );
  expect(raw!.title).toBe("");
});

test.each([
  new Error("native resource failure"),
  new ConvexError("UNKNOWN_RETAINED_PROOF"),
])(
  "TASK45.2 lifecycle catches rethrow unknown proof failures without writes: %s",
  async (error) => {
    const f = await styledGeneration();
    const sourceAccess = await import("../ai/sourceAccess");
    const before = await f.t.run(async (ctx) => ({
      run: await ctx.db.get(f.runId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      inputs: await ctx.db.query("ideaRunCopies").collect(),
    }));
    vi.spyOn(sourceAccess, "retainedRunProof").mockRejectedValue(error);
    await expect(
      f.t.mutation(internal.ai.runs.purgeSource, { runId: f.runId }),
    ).rejects.toThrow();
    await expect(
      f.t.mutation(internal.ai.contentCopies.sweep, {
        runId: f.runId,
        cursor: null,
        path: [],
      }),
    ).rejects.toThrow();
    expect(
      await f.t.run(async (ctx) => ({
        run: await ctx.db.get(f.runId),
        scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
        inputs: await ctx.db.query("ideaRunCopies").collect(),
      })),
    ).toEqual(before);
  },
);

test.each(["styled", "edited", "manual-parent", "inherited-run"])(
  "TASK45.2 account-scoped input proof rejects original styled ancestry across consumers: %s",
  async (kind) => {
    const f = await styledGeneration();
    await f.t.mutation(internal.ai.runs.claim, {
      runId: f.runId,
      executionKey: "account-origin",
    });
    const output = await f.t.action((ctx) =>
      generateForRun(
        ctx,
        f.runId,
        "account-origin",
        new MockLanguageModelV3({ doGenerate: async () => response() }),
      ),
    );
    let protectedId = (await f.t.mutation(
      internal.content.ideas.commitProposal,
      { runId: f.runId, executionKey: "account-origin", output },
    ))!;
    await f.t.mutation(internal.ai.runs.finish, {
      runId: f.runId,
      generation: 1,
      executionKey: "account-origin",
      failed: false,
    });
    let revision = 1;
    if (kind === "edited") {
      await f.signed.mutation(api.content.ideas.edit, {
        workspaceId: f.workspaceId,
        ideaId: protectedId,
        expectedRevision: 1,
        title: input.title,
        note: input.note,
        perspective: input.perspective,
        priority: input.priority,
        feedback: "Actual inherited edit",
      });
      revision = 2;
    }
    if (kind === "manual-parent") {
      const { insertIdea } = await import("./ideas");
      protectedId = await f.t.run(async (ctx) => {
        const parent = (await ctx.db.get(protectedId))!;
        return insertIdea(
          ctx,
          f.workspaceId,
          f.userId,
          "manual-parent-copy",
          "manual-copy",
          {
            ...input,
            originals: [],
            rationale: "",
            questions: [],
            inputVersionId: parent.currentVersionId!,
          },
        );
      });
    }
    if (kind === "inherited-run") {
      await f.signed.mutation(api.ai.styleProfiles.change, {
        ...f.scope,
        expectedRevision: 2,
        commandKey: "clear-selected-style",
        action: { kind: "reset", reason: "No direct style on next run" },
      });
      const runId = await f.signed.mutation(api.content.ideas.generate, {
        ...f.scope,
        ideaId: protectedId,
        expectedRevision: 1,
        intent: "Inherit previous styled output",
        operationKey: "inherited-unstyled-run",
      });
      expect(
        (await f.t.run((ctx) => ctx.db.get(runId)))!.styleContext,
      ).toBeUndefined();
      await f.t.mutation(internal.ai.runs.claim, {
        runId,
        executionKey: "inherited-origin",
      });
      const inherited = await f.t.action((ctx) =>
        generateForRun(
          ctx,
          runId,
          "inherited-origin",
          new MockLanguageModelV3({ doGenerate: async () => response() }),
        ),
      );
      protectedId = (await f.t.mutation(internal.content.ideas.commitProposal, {
        runId,
        executionKey: "inherited-origin",
        output: inherited,
      }))!;
      await f.t.mutation(internal.ai.runs.finish, {
        runId,
        generation: 1,
        executionKey: "inherited-origin",
        failed: false,
      });
    }
    await expect(
      f.signed.mutation(api.content.ideas.handoff, {
        workspaceId: f.workspaceId,
        ideaId: protectedId,
        expectedRevision: revision,
        accountId: null,
        intent: "No-account protected handoff",
        draftText: "Reviewed content",
        clarificationConfirmed: true,
      }),
    ).rejects.toThrow("RESEARCH_CONTENT_ACCOUNT_CHANGED");
    const accountB = await f.t.run(async (ctx) => {
      const { _id, _creationTime, ...a } = (await ctx.db.get(f.accountId))!;
      const id = await ctx.db.insert("socialAccounts", {
        ...a,
        name: "B",
        providerIdentity: "account-B",
      });
      const {
        _id: budgetId,
        _creationTime: budgetTime,
        ...budget
      } = (await ctx.db
        .query("aiBudgets")
        .withIndex("by_key", (q) => q.eq("key", `account:${f.accountId}`))
        .unique())!;
      await ctx.db.insert("aiBudgets", {
        ...budget,
        key: `account:${id}`,
        accountId: id,
      });
      return id;
    });
    const bScope = { workspaceId: f.workspaceId, accountId: accountB };
    await expect(
      f.signed.mutation(api.content.ideas.generate, {
        ...bScope,
        ideaId: protectedId,
        expectedRevision: revision,
        intent: "Cross-account copied origin",
        operationKey: "account-B-protected",
      }),
    ).rejects.toThrow("RESEARCH_CONTENT_ACCOUNT_CHANGED");
    await f.t.run(async (ctx) => {
      const { ideaProofUntil } = await import("../research/contentProof");
      const { materialWalk } = await import("../research/pipelineAccess");
      const ver = (await ctx.db.get(
        (await ctx.db.get(protectedId))!.currentVersionId!,
      ))!;
      const walk = materialWalk();
      expect(await ideaProofUntil(ctx, ver, walk)).toBeNull();
      await expect(ideaProofUntil(ctx, ver, walk, accountB)).rejects.toThrow(
        "RESEARCH_CONTENT_ACCOUNT_CHANGED",
      );
    });
    await f.t.run(async (ctx) => {
      const policy = (await ctx.db.query("aiPolicies").first())!;
      await ctx.db.patch(policy._id, { purposes: ["draft", "chat"] });
      for (const budget of await ctx.db.query("aiBudgets").collect())
        await ctx.db.patch(budget._id, { purposes: ["draft", "chat"] });
    });
    const chat = await f.signed.mutation(api.ai.conversations.create, {
      ...bScope,
      operationKey: "B-chat-one",
    });
    await expect(
      f.signed.mutation(api.ai.conversations.send, {
        ...bScope,
        conversationId: chat,
        ideaId: protectedId,
        prompt: "Cross-account input",
        operationKey: "B-chat-protected",
        allowIdeaCreation: true,
      }),
    ).rejects.toThrow("RESEARCH_CONTENT_ACCOUNT_CHANGED");
    const args = {
      ...bScope,
      ideaId: f.ideaId,
      expectedRevision: 1,
      intent: "Fresh source-free note",
      operationKey: "B-fresh-note",
    };
    const fresh = await f.signed.mutation(api.content.ideas.generate, args);
    expect(
      (await f.t.run((ctx) => ctx.db.get(fresh)))!.styleContext,
    ).toBeUndefined();
    expect(await f.signed.mutation(api.content.ideas.generate, args)).toBe(
      fresh,
    );
    await f.signed.mutation(api.ai.conversations.send, {
      ...bScope,
      conversationId: chat,
      ideaId: f.ideaId,
      prompt: "Fresh workspace note",
      operationKey: "B-chat-fresh",
      allowIdeaCreation: true,
    });
    await f.t.run(async (ctx) => {
      const copy = (await ctx.db
        .query("ideaRunCopies")
        .withIndex("by_runId", (q) => q.eq("runId", fresh))
        .unique())!;
      await ctx.db.patch(copy._id, {
        ideaVersionId: (await ctx.db.get(protectedId))!.currentVersionId!,
      });
    });
    await expect(
      f.signed.mutation(api.content.ideas.generate, args),
    ).rejects.toThrow("RESEARCH_CONTENT_ACCOUNT_CHANGED");
  },
);

test("routed explicit generic binds native operation before generation and remains usable after classifier deadline", async () => {
  const f = await modelFixture();
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    ...input,
    operationKey: "router-consumer-idea",
  });
  const operationId = await f.signed.mutation(api.ai.jev.routing.prepare, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    operationKey: "router-consumer-choice",
    intent: {
      intent: "Explore only",
      strategy: "generic",
      outputKind: "perspective",
      network: "x",
      objective: null,
      tone: "Clear",
      cta: null,
    },
  });
  await vi.advanceTimersByTimeAsync(5001);
  const args = {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    intent: "Explore only",
    operationKey: "router-consumer-generate",
    routingOperationId: operationId,
  };
  const runId = await f.signed.mutation(api.content.ideas.generate, args);
  expect(await f.signed.mutation(api.content.ideas.generate, args)).toBe(runId);
  const request = await f.t.run((ctx) =>
    ctx.db
      .query("contentRequests")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique(),
  );
  expect(request).toMatchObject({
    routingOperationId: operationId,
    actorId: f.userId,
  });
  const op = await f.t.run((ctx) => ctx.db.get(operationId));
  expect(op!.result).toMatchObject({
    status: "human_choice",
    effectiveStrategy: "generic",
    generatorKind: "generic",
  });
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
  expect(await f.t.run((ctx) => ctx.db.query("approvals").collect())).toEqual(
    [],
  );
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});

async function routedConsumer(strategy: string | null = "generic") {
  const f = await modelFixture();
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    ...input,
    operationKey: "routed-original",
  });
  const command = {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    operationKey: "routed-choice",
    intent: {
      intent: "Explore only",
      strategy,
      outputKind: "perspective" as const,
      network: "x" as const,
      objective: "Explain",
      tone: "Clear",
      cta: null,
    },
  };
  const operationId = await f.signed.mutation(
    api.ai.jev.routing.prepare,
    command,
  );
  const args = {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    intent: command.intent.intent,
    operationKey: "routed-generation",
    routingOperationId: operationId,
  };
  const runId = await f.signed.mutation(api.content.ideas.generate, args);
  return { ...f, ideaId, operationId, command, args, runId };
}
function routedProviderResponse(tool = false) {
  return Response.json({
    id: "routed-synthetic",
    object: "chat.completion",
    created: 1791210000,
    model: "synthetic/model",
    choices: [
      {
        index: 0,
        message: tool
          ? {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "native-read-context",
                  type: "function",
                  function: { name: "read_context", arguments: "{}" },
                },
              ],
            }
          : {
              role: "assistant",
              content: JSON.stringify({ text: JSON.stringify(proposal) }),
            },
        finish_reason: tool ? "tool_calls" : "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  });
}

test.each([
  "announcement",
  "milestone",
  "launch",
  "educational",
  "thought-leadership",
  "conversation",
  "story",
  "promotional",
  "generic",
  null,
])(
  "native %s routing consumer keeps actual generic perspective and exact prompt intent, rejects changed edge before copies",
  async (strategy) => {
    const f = await routedConsumer(strategy);
    const op = await f.t.run((ctx) => ctx.db.get(f.operationId));
    expect(op!.result).toMatchObject({
      generatorKind: "generic",
      status: strategy === null ? "configuration_required" : "human_choice",
    });
    const run = await f.t.run((ctx) => ctx.db.get(f.runId));
    const messages = await f.t.query(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: run!.threadId,
        order: "asc",
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    expect(JSON.stringify(messages.page)).toContain("Explain");
    expect(JSON.stringify(messages.page)).toContain("perspective");
    await expect(
      f.signed.mutation(api.content.ideas.generate, {
        ...f.args,
        routingOperationId: undefined,
      }),
    ).rejects.toThrow("OPERATION_CONFLICT");
    await expect(
      f.signed.mutation(api.content.ideas.generate, {
        ...f.args,
        intent: "Changed",
      }),
    ).rejects.toThrow("OPERATION_CONFLICT");
    const before = await f.t.run((ctx) => ctx.db.query("agentRuns").collect());
    await f.signed.mutation(api.content.ideas.edit, {
      workspaceId: f.workspaceId,
      ideaId: f.ideaId,
      expectedRevision: 1,
      title: input.title,
      note: input.note,
      perspective: "Changed current",
      priority: "normal",
      feedback: "Human revision",
    });
    await expect(
      f.signed.mutation(api.content.ideas.generate, f.args),
    ).rejects.toThrow("ROUTING_SUPERSEDED");
    expect(await f.t.run((ctx) => ctx.db.query("agentRuns").collect())).toEqual(
      before,
    );
    expect(
      await f.signed.query(api.ai.jev.routing.get, {
        workspaceId: f.workspaceId,
        operationId: f.operationId,
      }),
    ).toMatchObject({ applicability: "historical" });
    expect(
      await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
    ).toEqual([]);
  },
);

test.each(["withdraw", "unknown-proof", "second-step"])(
  "actual routed SDK %s after durable fund denies physical HTTP with known zero charge for that exact step",
  async (kind) => {
    const f = await routedConsumer();
    vi.stubEnv("REQUESTY_API_KEY", "synthetic-no-live-key");
    const { getFunctionName } = await import("convex/server");
    const { execute } = await import("../ai/provider");
    let revoked = false,
      calls = 0,
      funds = 0,
      unknownProof = false;
    const observed: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      calls++;
      return routedProviderResponse(kind === "second-step" && calls === 1);
    });
    // Run the actual registered action with a transport boundary after the native fund commits.
    await f.t.action(async (ctx) => {
      const nameOf = (ref: Parameters<typeof getFunctionName>[0]) => {
        try {
          return getFunctionName(ref);
        } catch {
          return "component-reference";
        }
      };
      const runMutation: typeof ctx.runMutation = async (ref, args) => {
        observed.push(nameOf(ref));
        const result = await ctx.runMutation(ref, args);
        if (
          nameOf(ref) === "ai/runs:fund" &&
          ++funds === (kind === "second-step" ? 2 : 1)
        ) {
          const attempt = await f.t.run((dbCtx) =>
            dbCtx.db.get(
              result as import("../_generated/dataModel").Id<"aiAttempts">,
            ),
          );
          expect(attempt).toMatchObject({
            state: "sent",
            runId: f.runId,
            workspaceId: f.workspaceId,
            generation: 1,
          });
          const ownedRun = (await f.t.run((dbCtx) => dbCtx.db.get(f.runId)))!;
          expect(ownedRun).toMatchObject({
            actorId: f.userId,
            accountId: f.accountId,
            budgetIds: attempt!.budgetIds,
          });
          expect(new Set(attempt!.budgetIds).size).toBe(3);
          for (const id of attempt!.budgetIds)
            expect(await f.t.run((dbCtx) => dbCtx.db.get(id))).toMatchObject({
              heldMicros: attempt!.reservedMicros,
            });
          revoked = true;
          if (kind === "unknown-proof") unknownProof = true;
          else
            await f.signed.mutation(api.ai.jev.routing.disable, {
              workspaceId: f.workspaceId,
              accountId: f.accountId,
            });
        }
        return result;
      };
      const runQuery: typeof ctx.runQuery = async (ref, args) => {
        if (unknownProof && nameOf(ref) === "ai/runs:context")
          throw new ConvexError("SYNTHETIC_NATIVE_RESOURCE_FAULT");
        observed.push(nameOf(ref));
        return ctx.runQuery(ref, args);
      };
      await (
        execute as unknown as {
          _handler: (
            ctx: import("../_generated/server").ActionCtx,
            args: { runId: typeof f.runId },
          ) => Promise<null>;
        }
      )._handler({ ...ctx, runMutation, runQuery }, { runId: f.runId });
    });
    expect(
      revoked,
      JSON.stringify({
        observed,
        run: await f.t.run((ctx) => ctx.db.get(f.runId)),
      }),
    ).toBe(true);
    expect(calls).toBe(kind === "second-step" ? 1 : 0);
    const attempts = await f.t.run((ctx) =>
      ctx.db.query("aiAttempts").collect(),
    );
    expect(attempts).toHaveLength(kind === "second-step" ? 2 : 1);
    expect(attempts.at(-1)).toMatchObject({
      state: "settled",
      inputTokens: 0,
      outputTokens: 0,
      estimatedMicros: 0,
      heldMicros: 0,
    });
    if (kind === "second-step")
      expect(attempts[0]).toMatchObject({
        state: "settled",
        estimatedMicros: 30,
        heldMicros: 0,
      });
    for (const id of attempts.at(-1)!.budgetIds)
      expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
        heldMicros: 0,
        spentMicros: kind === "second-step" ? 30 : 0,
      });
    expect(
      (await f.t.run((ctx) => ctx.db.query("contentRequests").first()))!
        .resultIdeaId,
    ).toBeNull();
    if (kind === "unknown-proof")
      expect(await f.t.run((ctx) => ctx.db.get(f.operationId))).toMatchObject({
        sourceUnavailable: false,
        intent: f.command.intent,
      });
  },
);

test("routed source withdrawal cleans >page requests and their actual Agent copies, terminal router replay cannot restore them", async () => {
  const f = await routedConsumer();
  const ids = [f.runId];
  for (let i = 0; i < 25; i++)
    ids.push(
      await f.signed.mutation(api.content.ideas.generate, {
        ...f.args,
        operationKey: `routed-page-${i}`,
      }),
    );
  const threads = await f.t.run(async (ctx) =>
    Promise.all(ids.map(async (id) => (await ctx.db.get(id))!.threadId)),
  );
  expect(threads).toHaveLength(26);
  await f.signed.mutation(api.ai.jev.routing.disable, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const requests = await f.t.run((ctx) =>
    ctx.db.query("contentRequests").collect(),
  );
  expect(requests).toHaveLength(26);
  expect(requests.every((r) => r.intent === "")).toBe(true);
  for (const id of ids)
    expect((await f.t.run((ctx) => ctx.db.get(id)))!.sourceCleanupState).toBe(
      "complete",
    );
  for (const threadId of threads)
    expect(
      (
        await f.t.query(components.agent.messages.listMessagesByThreadId, {
          threadId,
          order: "desc",
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toEqual([]);
  await f.t.mutation(internal.ai.jev.routing.scrub, {
    operationId: f.operationId,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await expect(
    f.signed.mutation(api.content.ideas.generate, f.args),
  ).rejects.toThrow();
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});

test.each(["missing", "complete"])(
  "router cleanup independently scrubs request and generated Idea when run root is %s",
  async (kind) => {
    const f = await routedConsumer();
    const executionKey = "routed-output";
    await f.t.mutation(internal.ai.runs.claim, {
      runId: f.runId,
      executionKey,
    });
    const resultId = await f.t.mutation(internal.content.ideas.commitProposal, {
      runId: f.runId,
      executionKey,
      output: JSON.stringify(proposal),
    });
    const versionId = (await f.t.run((ctx) => ctx.db.get(resultId!)))!
      .currentVersionId!;
    await f.t.run(async (ctx) => {
      if (kind === "missing") await ctx.db.delete(f.runId);
      else await ctx.db.patch(f.runId, { sourceCleanupState: "complete" });
      await ctx.db.delete(f.operationId);
    });
    await f.t.mutation(internal.ai.jev.routing.scrub, {
      operationId: f.operationId,
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      (await f.t.run((ctx) => ctx.db.query("contentRequests").first()))!.intent,
    ).toBe("");
    expect(await f.t.run((ctx) => ctx.db.get(versionId))).toMatchObject({
      title: "",
      perspective: "",
      rationale: "",
      questions: [],
      originals: [],
      note: "",
      sourceUnavailable: true,
    });
  },
);

test("routed actual entered HTTP keeps unknown hold then settles genuine late original once", async () => {
  const f = await routedConsumer();
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-no-live-key");
  let entered!: () => void, answer!: (response: Response) => void;
  const physical = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const response = new Promise<Response>((resolve) => {
    answer = resolve;
  });
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    entered();
    return response;
  });
  const executing = f.t.action(internal.ai.provider.execute, {
    runId: f.runId,
  });
  await physical;
  const original = (
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())
  )[0];
  expect(original).toMatchObject({
    state: "sent",
    runId: f.runId,
    workspaceId: f.workspaceId,
    generation: 1,
  });
  expect(original.budgetIds).toHaveLength(3);
  expect(await f.t.run((ctx) => ctx.db.get(f.runId))).toMatchObject({
    actorId: f.userId,
    accountId: f.accountId,
    budgetIds: original.budgetIds,
  });
  await vi.advanceTimersByTimeAsync(60001);
  await executing;
  expect(await f.t.run((ctx) => ctx.db.get(original._id))).toMatchObject({
    state: "unknown",
    heldMicros: original.reservedMicros,
    estimatedMicros: null,
  });
  await f.signed.mutation(api.ai.jev.routing.disable, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
  });
  answer(routedProviderResponse());
  await vi.waitFor(async () =>
    expect(await f.t.run((ctx) => ctx.db.get(original._id))).toMatchObject({
      state: "settled",
      estimatedMicros: 30,
      heldMicros: 0,
    }),
  );
  await f.t.action(internal.ai.provider.execute, { runId: f.runId });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
  for (const id of original.budgetIds)
    expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
      heldMicros: 0,
      spentMicros: 30,
    });
  expect(
    (await f.t.run((ctx) => ctx.db.query("contentRequests").first()))!
      .resultIdeaId,
  ).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});

test("routed run shares original aggregate32 proof budget and rejects next ancestor atomically", async () => {
  const f = await routedConsumer();
  await f.t.run(async (ctx) => {
    const idea = (await ctx.db.get(f.ideaId))!,
      version = (await ctx.db.get(idea.currentVersionId!))!;
    const { _id, _creationTime, ...base } = version;
    let parent = _id;
    for (let n = 0; n < 31; n++)
      parent = await ctx.db.insert("ideaVersions", {
        ...base,
        inputVersionId: parent,
        number: n + 2,
      });
    await ctx.db.patch(idea._id, { currentVersionId: parent });
  });
  const operationId = await f.signed.mutation(api.ai.jev.routing.prepare, {
    ...f.command,
    operationKey: "aggregate-original",
  });
  const before = await f.t.run(async (ctx) => ({
    runs: await ctx.db.query("agentRuns").collect(),
    requests: await ctx.db.query("contentRequests").collect(),
    operations: await ctx.db.query("jevRoutingOperations").collect(),
  }));
  await expect(
    f.signed.mutation(api.content.ideas.generate, {
      ...f.args,
      operationKey: "aggregate-denied",
      routingOperationId: operationId,
    }),
  ).rejects.toThrow("STYLE_ANCESTRY_LIMIT");
  expect(
    await f.t.run(async (ctx) => ({
      runs: await ctx.db.query("agentRuns").collect(),
      requests: await ctx.db.query("contentRequests").collect(),
      operations: await ctx.db.query("jevRoutingOperations").collect(),
    })),
  ).toEqual(before);
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
});
