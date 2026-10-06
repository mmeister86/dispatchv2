import { afterEach, expect, test, vi } from "vitest";
import * as definitions from "./questions";
import { mediaFixture } from "../../../tests/media-fixture";
import { sha256 } from "../../lib/crypto";
import { api, internal } from "../../_generated/api";
vi.mock("./questions", () => ({
  resolveQuestions: () => ({
    version: "synthetic-test-only-v1",
    questions: {
      synthetic: {
        type: "noul",
        instructions: "Synthetic intercepted runtime only?",
      },
    },
  }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function fixture() {
  vi.stubEnv("TYPESAFE_API_KEY", "synthetic-secret-no-live-key");
  const f = await mediaFixture();
  const request = await f.t.run(async (ctx) => {
    const accountId = await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
      name: "Fixture",
      handle: "fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: false,
      },
    });
    const common = {
      workspaceId: f.workspaceId,
      accountId,
      network: "x" as const,
      surface: "for_you" as const,
      createdBy: f.userId,
      createdAt: Date.now(),
      status: "reviewed" as const,
      review: {
        actorId: f.userId,
        at: Date.now(),
        reason: "Synthetic test only",
      },
      retiredAt: null,
    };
    const algorithmId = await ctx.db.insert("algorithmProfiles", {
      ...common,
      payload: {
        version: "x-public-context-v1",
        repository: "xai-org/x-algorithm",
        commit: "b412112d03f27acbfd668e0cc040abcafa1080c1",
        commitAt: 0,
        observedAt: 0,
        reviewDueAt: Date.now() + 86400000,
        validityBasis: "operational_assumption",
        sourceScope: "public_code",
        productionState: "unknown",
        scoringInfluence: "none",
        evidence: [],
        report: "Synthetic only",
        refs: {
          questionSet: "unavailable-until-task28",
          normalization: "unavailable-until-task28",
          formula: "dispatch-score-v1",
          routing: "disabled-v1",
          verification: "disabled-v1",
        },
      },
    });
    const audienceId = await ctx.db.insert("audienceProfiles", {
      ...common,
      payload: {
        version: "declared-audience-v1",
        description: "Synthetic audience",
        source: "authorized_declaration",
        measurement: "unavailable",
        embedding: "unavailable",
      },
    });
    await ctx.db.insert("intelligenceSelections", {
      workspaceId: f.workspaceId,
      accountId,
      network: "x",
      surface: "for_you",
      revision: 1,
      algorithmId,
      audienceId,
      selectedBy: f.userId,
      updatedAt: Date.now(),
    });
    const draftId = await ctx.db.insert("drafts", {
      workspaceId: f.workspaceId,
      revision: 1,
      currentVersionId: null,
      authorId: f.userId,
      source: "manual",
      updatedAt: Date.now(),
    });
    const draftVersionId = await ctx.db.insert("draftVersions", {
      workspaceId: f.workspaceId,
      draftId,
      number: 1,
      content: {
        title: "Private fixture",
        text: ["Synthetic first segment", "Synthetic second segment"],
        media: [],
        accountId,
        pillar: "",
        strategy: "",
      },
      authorId: f.userId,
      createdAt: Date.now(),
      reason: "synthetic",
    });
    await ctx.db.patch(draftId, { currentVersionId: draftVersionId });
    const policyId = await ctx.db.insert("jevPolicies", {
      workspaceId: f.workspaceId,
      accountId,
      version: "synthetic-price-v1",
      credentialFingerprint: await sha256("synthetic-secret-no-live-key"),
      approvedBy: f.userId,
      expiresAt: Date.now() + 86400000,
      model: "jev-1.13.0",
      currency: "USD",
      pricingEvidence: "synthetic only",
      inputMicrosPerMillion: 1000000,
      outputMicrosPerMillion: 0,
      maxInputTokens: 8000,
      maxOutputTokens: 1000,
      euEvidence: {
        gateway: "synthetic",
        inference: "synthetic",
        logs: "synthetic",
        cache: "synthetic",
        storage: "synthetic",
        subprocessors: "synthetic",
      },
    });
    const flags = {
      enabled: true,
      analyzer: true,
      routing: false as const,
      verification: false as const,
      networkFit: false as const,
      policyId,
      composerTimeoutMs: 2500,
      backgroundTimeoutMs: 5000,
      failures: 0,
      openUntil: 0,
      probeAttemptId: null,
    };
    await ctx.db.insert("jevControls", {
      ...flags,
      key: "global",
      policyId: null,
    });
    await ctx.db.insert("jevControls", {
      ...flags,
      key: `account:${accountId}`,
      workspaceId: f.workspaceId,
      accountId,
    });
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key:
          i === 0
            ? "jev:provider"
            : i === 1
              ? `jev:workspace:${f.workspaceId}`
              : `jev:account:${accountId}`,
        scope,
        workspaceId: i ? f.workspaceId : undefined,
        accountId: i === 2 ? accountId : undefined,
        approvedBy: i ? f.userId : undefined,
        policyVersion: "synthetic-price-v1",
        currency: "USD",
        purposes: ["analyzer"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 100000,
        heldMicros: 0,
        spentMicros: 0,
      });
    return {
      workspaceId: f.workspaceId,
      accountId,
      actorId: f.userId,
      draftId,
      draftVersionId,
      algorithmId,
      audienceId,
      selectionRevision: 1,
      operationKey: "synthetic-operation-one",
      mode: "composer" as const,
      deadline: Date.now() + 2500,
    };
  });
  return { ...f, request };
}
const success = () =>
  new Response(
    JSON.stringify({
      model: "jev-1.13.0",
      usage: { input_tokens: 23, output_tokens: 7 },
      answers: { synthetic: { type: "noul", noul: 0.9 } },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
test("registered Action uses pinned official SDK, funds exactly one physical call, preserves whole thread and settles known usage", async () => {
  const f = await fixture();
  const transport = vi.fn(async (url, init) => {
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(new Headers(init.headers).get("X-TypeSafe-SDK")).toBe(
      "typesafe-sdk/0.6.0",
    );
    const body = JSON.parse(init.body);
    expect(body.model).toBe("jev-1.13.0");
    expect(body.state.thread).toHaveLength(2);
    expect(
      (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))?.state,
    ).toBe("sent");
    return success();
  });
  vi.stubGlobal("fetch", transport);
  expect(
    await f.t.action(internal.ai.jev.client.execute, f.request),
  ).toMatchObject({
    outcome: "success",
    answers: { synthetic: { probability: 0.9 } },
  });
  expect(transport).toHaveBeenCalledTimes(1);
  const receipts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    owner: "jev-analyzer",
    state: "settled",
    estimatedMicros: 23,
    billedMicros: null,
    inputTokens: 23,
    outputTokens: 7,
  });
  for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 23 });
  expect(JSON.stringify(receipts)).not.toContain("Synthetic first segment");
});
test("default-off controls, missing EU links, missing secret and generation-only grants refuse before I/O or funding", async () => {
  for (const corruption of [
    "global",
    "eu",
    "secret",
    "purpose",
    "profile",
    "source",
    "input",
  ] as const) {
    const f = await fixture();
    if (corruption === "secret") vi.stubEnv("TYPESAFE_API_KEY", "");
    await f.t.run(async (ctx) => {
      if (corruption === "global")
        await ctx.db.delete(
          (await ctx.db
            .query("jevControls")
            .withIndex("by_key", (q) => q.eq("key", "global"))
            .unique())!._id,
        );
      if (corruption === "eu") {
        const p = (await ctx.db.query("jevPolicies").first())!;
        await ctx.db.patch(p._id, {
          euEvidence: { ...p.euEvidence, subprocessors: "" },
        });
      }
      if (corruption === "purpose")
        for (const b of await ctx.db.query("aiBudgets").collect())
          await ctx.db.patch(b._id, { purposes: ["draft"] });
      if (corruption === "profile")
        await ctx.db.patch(f.request.algorithmId, { status: "retired" });
      if (corruption === "source")
        await ctx.db.patch(f.request.draftId, { currentVersionId: null });
      if (corruption === "input") {
        const d = (await ctx.db.get(f.request.draftVersionId))!;
        await ctx.db.patch(d._id, {
          content: { ...d.content, text: ["x".repeat(9000)] },
        });
      }
    });
    const transport = vi.fn(async () => success());
    vi.stubGlobal("fetch", transport);
    expect(await f.t.action(internal.ai.jev.client.execute, f.request)).toEqual(
      { outcome: "unavailable", answers: null },
    );
    expect(transport).not.toHaveBeenCalled();
    expect(
      await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
    ).toHaveLength(0);
  }
});
test("SDK 429 and 5xx cannot multiply requests; unknown retains holds and blocks another logical operation", async () => {
  for (const status of [429, 503]) {
    const f = await fixture();
    const warn = vi.spyOn(console, "warn"),
      error = vi.spyOn(console, "error"),
      debug = vi.spyOn(console, "debug");
    const transport = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: "Private fixture should never log" }),
          {
            status,
            headers: { "retry-after": "0", "content-type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", transport);
    expect(
      (await f.t.action(internal.ai.jev.client.execute, f.request)).outcome,
    ).toBe(status === 429 ? "rate_limit" : "provider_error");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
    const t = (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!;
    expect(t).toMatchObject({
      state: "unknown",
      heldMicros: 8000,
      estimatedMicros: null,
    });
    expect(
      (
        await f.t.action(internal.ai.jev.client.execute, {
          ...f.request,
          operationKey: "different-operation",
        })
      ).outcome,
    ).toBe("provider_error");
    expect(transport).toHaveBeenCalledTimes(1);
  }
});
test("timeout bounds a transport ignoring cancellation; late known usage settles after revocation exactly once", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const c = (await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `account:${f.request.accountId}`))
      .unique())!;
    await ctx.db.patch(c._id, { composerTimeoutMs: 80 });
  });
  let release!: (r: Response) => void;
  const transport = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal("fetch", transport);
  const before = Date.now();
  expect(
    (await f.t.action(internal.ai.jev.client.execute, f.request)).outcome,
  ).toBe("timeout");
  expect(Date.now() - before).toBeLessThan(1000);
  expect(transport).toHaveBeenCalledTimes(1);
  const t = (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!;
  expect(t.state).toBe("unknown");
  await f.signed.mutation(api.ai.jev.access.disable, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.request.draftId, { currentVersionId: null });
    for (const b of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(b._id, {
        expiresAt: 0,
        purposes: [],
        approvedBy: undefined,
        policyVersion: "revoked",
        limitMicros: 0,
      });
  });
  release(success());
  // A post-return response never writes: the Action is not a durable background worker.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect((await f.t.run((ctx) => ctx.db.get(t._id)))!.state).toBe("unknown");
  const args = {
    attemptId: t._id,
    inputTokens: 23,
    outputTokens: 7,
    resolvedModel: "jev-1.13.0",
    outcome: "timeout" as const,
    latencyMs: 100,
  };
  await Promise.all([
    f.t.mutation(internal.ai.jev.access.settle, args),
    f.t.mutation(internal.ai.jev.access.settle, args),
  ]);
  for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
    expect(b).toMatchObject({ spentMicros: 23, heldMicros: 0 });
  await expect(
    f.t.mutation(internal.ai.jev.access.settle, { ...args, inputTokens: 24 }),
  ).rejects.toThrow("JEV_RECEIPT_CONFLICT");
});
test("three concrete failures open circuit; cooldown permits only one recovery probe", async () => {
  const f = await fixture();
  const transport = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          usage: { input_tokens: 1, output_tokens: 0 },
          error: "Synthetic error",
        }),
        { status: 503 },
      ),
  );
  vi.stubGlobal("fetch", transport);
  for (let i = 0; i < 3; i++)
    expect(
      (
        await f.t.action(internal.ai.jev.client.execute, {
          ...f.request,
          operationKey: `synthetic-failure-${i}`,
        })
      ).outcome,
    ).toBe("provider_error");
  expect(transport).toHaveBeenCalledTimes(3);
  expect(
    (
      await f.t.action(internal.ai.jev.client.execute, {
        ...f.request,
        operationKey: "synthetic-circuit-block",
      })
    ).outcome,
  ).toBe("unavailable");
  const c = (await f.t.run((ctx) =>
    ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `account:${f.request.accountId}`))
      .unique(),
  ))!;
  expect(c.failures).toBe(3);
  expect(c.openUntil).toBeGreaterThan(Date.now());
  await f.t.run((ctx) => ctx.db.patch(c._id, { openUntil: 0 }));
  const a = { ...f.request, operationKey: "synthetic-probe-one" };
  const captured = await f.t.query(internal.ai.jev.access.context, a);
  const id = await f.t.mutation(internal.ai.jev.access.fund, {
    ...a,
    expectedFingerprint: captured.requestFingerprint,
  });
  const other = { ...f.request, operationKey: "synthetic-probe-two" };
  await expect(
    f.t.query(internal.ai.jev.access.context, other),
  ).rejects.toThrow("JEV_CIRCUIT_OPEN");
  await f.t.mutation(internal.ai.jev.access.settle, {
    attemptId: id,
    inputTokens: 1,
    outputTokens: 0,
    resolvedModel: "jev-1.13.0",
    outcome: "success",
    latencyMs: 1,
  });
  expect(await f.t.run((ctx) => ctx.db.get(c._id))).toMatchObject({
    failures: 0,
    openUntil: 0,
    probeAttemptId: null,
  });
});
test("foreign ledger owners cannot settle as Jev; duplicate operations cannot be funded again", async () => {
  const f = await fixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => success()),
  );
  await f.t.action(internal.ai.jev.client.execute, f.request);
  expect(
    (await f.t.action(internal.ai.jev.client.execute, f.request)).outcome,
  ).toBe("provider_error");
  const t = (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!;
  await f.t.run(async (ctx) => {
    if (t.owner !== "jev-analyzer") throw new Error("fixture owner");
    const runId = await ctx.db.insert("agentRuns", {
      workspaceId: f.workspaceId,
      accountId: f.request.accountId,
      actorId: f.userId,
      purpose: "draft",
      policyVersion: "synthetic",
      promptVersion: "synthetic",
      policyFingerprint: "synthetic",
      accountConnectionSequence: 0,
      sources: [],
      threadId: "synthetic",
      promptMessageId: "synthetic",
      generation: 1,
      state: "ready",
      executionKey: null,
      deadline: Date.now() + 5000,
      attempts: 0,
      toolSteps: 0,
      budgetIds: [],
      createdAt: Date.now(),
      errorCode: null,
    });
    await ctx.db.patch(t._id, { runId });
  });
  await expect(
    f.t.mutation(internal.ai.jev.access.settle, {
      attemptId: t._id,
      inputTokens: 23,
      outputTokens: 7,
      resolvedModel: "jev-1.13.0",
      outcome: "success",
      latencyMs: 1,
    }),
  ).rejects.toThrow("JEV_ATTEMPT_OWNER_INVALID");
});
test("financial admission refuses exhausted caps before HTTP; foreign grant owners cannot settle", async () => {
  const f = await fixture();
  const transport = vi.fn(async () => success());
  vi.stubGlobal("fetch", transport);
  await f.t.run(async (ctx) => {
    const b = (await ctx.db.query("aiBudgets").first())!;
    await ctx.db.patch(b._id, { limitMicros: 7999 });
  });
  expect(
    (await f.t.action(internal.ai.jev.client.execute, f.request)).outcome,
  ).toBe("provider_error");
  expect(transport).not.toHaveBeenCalled();
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(0);
  await f.t.run(async (ctx) => {
    const b = (await ctx.db.query("aiBudgets").first())!;
    await ctx.db.patch(b._id, { limitMicros: 100000 });
  });
  await f.t.action(internal.ai.jev.client.execute, f.request);
  const t = (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!;
  await f.t.run((ctx) => ctx.db.patch(t.budgetIds[0], { currency: "EUR" }));
  await expect(
    f.t.mutation(internal.ai.jev.access.settle, {
      attemptId: t._id,
      inputTokens: 23,
      outputTokens: 7,
      resolvedModel: "jev-1.13.0",
      outcome: "success",
      latencyMs: 1,
    }),
  ).rejects.toThrow("JEV_ATTEMPT_OWNER_INVALID");
});
test("invalid and oversized provider responses have distinct outcomes; known malformed-answer usage still costs once", async () => {
  for (const malformed of ["answer", "body", "model", "output"] as const) {
    const f = await fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        malformed === "body"
          ? new Response("x".repeat(65000), { status: 200 })
          : new Response(
              JSON.stringify({
                model: malformed === "model" ? "different-model" : "jev-1.13.0",
                usage: {
                  input_tokens: 23,
                  output_tokens: malformed === "output" ? 1001 : 7,
                },
                answers: {
                  synthetic: {
                    type: "noul",
                    noul: malformed === "answer" ? 1.1 : 0.9,
                  },
                },
              }),
              { status: 200 },
            ),
      ),
    );
    expect(await f.t.action(internal.ai.jev.client.execute, f.request)).toEqual(
      { outcome: "invalid_response", answers: null },
    );
    expect(
      await f.t.run((ctx) => ctx.db.query("aiAttempts").first()),
    ).toMatchObject({
      state: malformed === "body" ? "unknown" : "settled",
      estimatedMicros: malformed === "body" ? null : 23,
    });
  }
});
test("withdrawn draft/profile permission suppresses normalized results while legitimate usage is settled", async () => {
  const f = await fixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await f.t.run((ctx) =>
        ctx.db.patch(f.request.audienceId, { status: "retired" }),
      );
      return success();
    }),
  );
  expect(await f.t.action(internal.ai.jev.client.execute, f.request)).toEqual({
    outcome: "unavailable",
    answers: null,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").first()),
  ).toMatchObject({ state: "settled", estimatedMicros: 23 });
});
test("fresh grant and new operation fund each separate known-safe physical call", async () => {
  const f = await fixture();
  const transport = vi.fn(async () => success());
  vi.stubGlobal("fetch", transport);
  for (const operationKey of [
    "synthetic-operation-one",
    "synthetic-operation-two",
  ])
    expect(
      (
        await f.t.action(internal.ai.jev.client.execute, {
          ...f.request,
          operationKey,
        })
      ).outcome,
    ).toBe("success");
  expect(transport).toHaveBeenCalledTimes(2);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(2);
  for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
    expect(b).toMatchObject({ spentMicros: 46, heldMicros: 0 });
});

test("valid low-confidence component values remain available after the same current authority check, without aggregate", async () => {
  const f = await fixture();
  vi.spyOn(definitions, "resolveQuestions").mockReturnValue({
    version: "synthetic-low-confidence-v1",
    questions: {
      synthetic: {
        type: "choice",
        instructions: "Synthetic only",
        criteria: { calm: "Calm", loud: "Loud" },
      },
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            model: "jev-1.13.0",
            usage: { input_tokens: 23, output_tokens: 0 },
            answers: {
              synthetic: {
                type: "choice",
                choice: "calm",
                confidence: 0.2,
                probabilities: { calm: 0.9, loud: 0.1 },
              },
            },
          }),
          { status: 200 },
        ),
    ),
  );
  const result = await f.t.action(internal.ai.jev.client.execute, f.request);
  expect(result).toEqual({
    outcome: "low_confidence",
    answers: { synthetic: { type: "choice", value: "calm", confidence: 0.2 } },
  });
  expect(result).not.toHaveProperty("aggregate");
});
