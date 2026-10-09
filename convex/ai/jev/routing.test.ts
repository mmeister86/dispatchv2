import { fixture, response } from "../../../tests/jev-routing-fixture";
import { afterEach, expect, test, vi } from "vitest";
import { type FunctionArgs } from "convex/server";
import { mediaFixture } from "../../../tests/media-fixture";
import { api, internal } from "../../_generated/api";
import { sha256 } from "../../lib/crypto";
import { TypeSafeClient, APIPromise } from "@typesafe-ai/sdk";
import { ConvexError } from "convex/values";
import * as contentProof from "../../research/contentProof";
import type { Id } from "../../_generated/dataModel";

const prepare = api.ai.jev.routing.prepare;
const classify = internal.ai.jev.routing.classifyAction;
const get = api.ai.jev.routing.get;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("native defaultOFF command is indexed and replays its original generic fallback without funding", async () => {
  const f = await fixture(false),
    transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  const id = await f.signed.mutation(prepare, f.command);
  expect(await f.signed.mutation(prepare, f.command)).toBe(id);
  expect(
    await f.signed.query(get, { workspaceId: f.workspaceId, operationId: id }),
  ).toMatchObject({
    applicability: "current",
    result: { status: "configuration_required", generatorKind: "generic" },
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(0);
  expect(transport).not.toHaveBeenCalled();
  await expect(
    f.signed.mutation(prepare, {
      ...f.command,
      intent: { ...f.command.intent, tone: "changed" },
    }),
  ).rejects.toThrow("ROUTING_OPERATION_CONFLICT");
});

test("registered classifier resolves the real versioned rubric, funds installed SDK and commits one exact result", async () => {
  const f = await fixture();
  const transport = vi.fn(async (_url, init) => {
    expect(_url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(new Headers(init.headers).get("X-TypeSafe-SDK")).toBe(
      "typesafe-sdk/0.6.0",
    );
    const body = JSON.parse(init.body);
    expect(Object.keys(body.questions.intent.criteria)).toHaveLength(9);
    expect(body.state.input).toMatchObject({
      title: "Native original",
      userClaims: "Unverified human assertion",
      previousPerspective: "Possible interpretation",
    });
    expect(body.state.intent).toMatchObject({
      outputKind: "perspective",
      strategy: null,
      network: "x",
      objective: "Explain the implications",
      tone: "Clear",
      cta: null,
    });
    expect(JSON.stringify(body.state)).not.toContain(f.userId);
    expect(
      (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))?.state,
    ).toBe("sent");
    return response();
  });
  vi.stubGlobal("fetch", transport);
  const id = await f.signed.mutation(prepare, f.command);
  await f.t.action(classify, { operationId: id });
  expect(
    await f.signed.query(get, { workspaceId: f.workspaceId, operationId: id }),
  ).toMatchObject({
    applicability: "current",
    result: {
      status: "routed",
      category: "educational",
      choiceConfidence: 0.9,
      effectiveStrategy: "educational",
      generatorKind: "generic",
    },
  });
  await f.t.action(classify, { operationId: id });
  expect(transport).toHaveBeenCalledTimes(1);
  const receipts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    owner: "jev-intent-router",
    state: "settled",
    estimatedMicros: 30,
    heldMicros: 0,
    routingOperationId: id,
  });
  expect(JSON.stringify(receipts)).not.toContain("Unverified human assertion");
  for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 30 });
});

const names = [
  "announcement",
  "milestone",
  "launch",
  "educational",
  "thoughtLeadership",
  "conversation",
  "story",
  "promotional",
  "generic",
];
type Fixture = Awaited<ReturnType<typeof fixture>>;
const scope = (f: Fixture) => ({
  workspaceId: f.workspaceId,
  accountId: f.accountId,
});
const inspect = (f: Fixture) =>
  f.t.run(async (ctx) => ({
    operations: await ctx.db.query("jevRoutingOperations").collect(),
    attempts: await ctx.db.query("aiAttempts").collect(),
    budgets: await ctx.db.query("aiBudgets").collect(),
    controls: await ctx.db.query("jevControls").collect(),
  }));
async function route(f: Fixture, category = "educational", confidence = 0.9) {
  const transport = vi.fn(async () => response(category, confidence));
  vi.stubGlobal("fetch", transport);
  const id = await f.signed.mutation(prepare, f.command);
  await f.signed.action(api.ai.jev.routing.classify, {
    workspaceId: f.workspaceId,
    operationId: id,
  });
  return {
    id,
    transport,
    view: await f.signed.query(get, {
      workspaceId: f.workspaceId,
      operationId: id,
    }),
  };
}

// These all enter the registered action, production rubric and installed SDK; no resolver or paid-result fixture is mocked.
test.each(names)(
  "native category %s maps honestly to the available generic generator",
  async (category) => {
    const f = await fixture(),
      r = await route(f, category);
    expect(r.view).toMatchObject({
      applicability: "current",
      result: {
        status: "routed",
        category,
        effectiveStrategy: category,
        generatorKind: "generic",
        choiceConfidence: 0.9,
      },
    });
    expect(r.transport).toHaveBeenCalledTimes(1);
  },
);
test.each([
  [0.499, "fallback", "generic"],
  [0.5, "suggestion", "generic"],
  [0.7, "suggestion", "generic"],
  [0.899, "suggestion", "generic"],
  [0.9, "routed", "story"],
  [1, "routed", "story"],
])(
  "versioned choice confidence %s produces %s independently of a probability of 1",
  async (confidence, status, effectiveStrategy) => {
    const f = await fixture(),
      r = await route(f, "story", Number(confidence));
    expect(r.view.result).toMatchObject({
      status,
      category: "story",
      choiceConfidence: confidence,
      effectiveStrategy,
      generatorKind: "generic",
      suggestion: Number(confidence) >= 0.5 ? "story" : null,
    });
  },
);
test.each([
  "generic",
  "thought-leadership",
  ...names.filter((x) => x !== "generic"),
])(
  "explicit human choice %s wins without funding or HTTP",
  async (strategy) => {
    const f = await fixture(false),
      transport = vi.fn(async () => response());
    vi.stubGlobal("fetch", transport);
    const id = await f.signed.mutation(prepare, {
      ...f.command,
      intent: { ...f.command.intent, strategy },
    });
    await f.signed.action(api.ai.jev.routing.classify, {
      workspaceId: f.workspaceId,
      operationId: id,
    });
    expect(
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        operationId: id,
      }),
    ).toMatchObject({
      result: {
        status: "human_choice",
        effectiveStrategy:
          strategy === "thought-leadership" ? "thoughtLeadership" : strategy,
        generatorKind: "generic",
        choiceConfidence: null,
      },
    });
    expect((await inspect(f)).attempts).toHaveLength(0);
    expect(transport).not.toHaveBeenCalled();
  },
);

async function mutateConfiguration(f: Fixture, kind: string) {
  await f.t.run(async (ctx) => {
    const c = (await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `routing:account:${f.accountId}`))
      .unique())!;
    if (!("purpose" in c)) throw new Error("routing fixture control");
    const p = (await ctx.db.get(c.policyId!))!;
    if (kind === "disabled") await ctx.db.patch(c._id, { routing: false });
    else if (kind === "circuit")
      await ctx.db.patch(c._id, {
        failures: 3,
        openUntil: Date.now() + 100000,
      });
    else if (kind === "missing-model") await ctx.db.patch(p._id, { model: "" });
    else if (kind === "unresolved-model")
      await ctx.db.patch(p._id, { model: "latest" });
    else if (kind === "EU")
      await ctx.db.patch(p._id, {
        euEvidence: {
          gateway: "",
          inference: "",
          logs: "",
          cache: "",
          storage: "",
          subprocessors: "",
        },
      });
    else if (kind === "pricing")
      await ctx.db.patch(p._id, { pricingEvidence: "" });
    else if (kind === "processing")
      await ctx.db.patch(p._id, {
        processingRights: { processing: "", storage: "", training: "" },
      });
    else if (kind === "credential")
      await ctx.db.patch(p._id, { credentialFingerprint: "different" });
    else if (kind === "expired")
      await ctx.db.patch(p._id, { expiresAt: Date.now() - 1 });
    else if (kind.startsWith("grant-")) {
      const b = (await ctx.db
        .query("aiBudgets")
        .withIndex("by_key", (q) =>
          q.eq(
            "key",
            kind === "grant-provider"
              ? "jev:provider"
              : kind === "grant-workspace"
                ? `jev:workspace:${f.workspaceId}`
                : `jev:account:${f.accountId}`,
          ),
        )
        .unique())!;
      await ctx.db.patch(b._id, { purposes: [] });
    } else if (kind === "currency") {
      const b = (await ctx.db
        .query("aiBudgets")
        .withIndex("by_key", (q) => q.eq("key", "jev:provider"))
        .unique())!;
      await ctx.db.patch(b._id, { currency: "EUR" });
    } else if (kind === "budget")
      for (const b of await ctx.db.query("aiBudgets").collect())
        await ctx.db.patch(b._id, { limitMicros: 1 });
  });
}
test.each([
  "disabled",
  "circuit",
  "missing-model",
  "unresolved-model",
  "EU",
  "pricing",
  "processing",
  "credential",
  "expired",
  "grant-provider",
  "grant-workspace",
  "grant-account",
  "currency",
  "budget",
])("native %s denial precedes attempt and physical traffic", async (kind) => {
  const f = await fixture();
  await mutateConfiguration(f, kind);
  const r = await route(f);
  expect(r.view.result!.status).toBe(
    kind === "budget" ? "fallback" : "configuration_required",
  );
  const state = await inspect(f);
  expect(state.attempts).toHaveLength(0);
  for (const b of state.budgets)
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 0 });
  expect(r.transport).not.toHaveBeenCalled();
});

test.each(["model", "category", "extra-answer", "probabilities"])(
  "strict native %s response is rejected while genuine reported money is retained",
  async (kind) => {
    const f = await fixture();
    const body = await response().json();
    if (kind === "model") body.model = "other-model";
    else if (kind === "category") body.answers.intent.choice = "unsupported";
    else if (kind === "extra-answer")
      body.answers.extra = { type: "noul", probability: 1 };
    else body.answers.intent.probabilities.educational = 0.5;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    );
    const id = await f.signed.mutation(prepare, f.command);
    await f.t.action(classify, { operationId: id });
    expect(
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        operationId: id,
      }),
    ).toMatchObject({
      result: { status: "fallback", category: null, choiceConfidence: null },
    });
    expect((await inspect(f)).attempts[0]).toMatchObject({
      state: "settled",
      estimatedMicros: 30,
      outcome: "invalid_response",
    });
  },
);

test("exact command, semantic identity and native source supersession remain separate", async () => {
  const f = await fixture(),
    r = await route(f),
    before = (await inspect(f)).operations[0];
  const another = await f.signed.mutation(prepare, {
    ...f.command,
    operationKey: "native-distinct-command",
  });
  const other = await f.t.run((ctx) => ctx.db.get(another));
  expect(other!.semanticKey).toBe(before.semanticKey);
  await f.signed.mutation(api.content.ideas.edit, {
    workspaceId: f.workspaceId,
    ideaId: f.ideaId,
    expectedRevision: 1,
    title: "Edited",
    note: "Different",
    perspective: "New",
    priority: "normal",
    feedback: "Superseded",
  });
  expect(
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      operationId: r.id,
    }),
  ).toMatchObject({
    applicability: "historical",
    result: { category: "educational" },
  });
  await expect(f.signed.mutation(prepare, f.command)).rejects.toThrow(
    "ROUTING_SUPERSEDED",
  );
  await f.t.mutation(internal.ai.jev.routing.purge, {
    ideaId: f.ideaId,
    cursor: null,
    force: false,
  });
  expect((await f.t.run((ctx) => ctx.db.get(r.id)))?.sourceUnavailable).toBe(
    false,
  );
  await expect(
    f.signed.action(api.ai.jev.routing.classify, {
      workspaceId: f.workspaceId,
      operationId: r.id,
    }),
  ).rejects.toThrow("ROUTING_SUPERSEDED");
  expect(r.transport).toHaveBeenCalledTimes(1);
});

test("later policy selection and circuit drift preserve eligible original history", async () => {
  const f = await fixture(),
    r = await route(f);
  await f.t.run(async (ctx) => {
    const c = (await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `routing:account:${f.accountId}`))
      .unique())!;
    const p = (await ctx.db.get(c.policyId!))!;
    const { _id, _creationTime, ...original } = p;
    const next = await ctx.db.insert("jevPolicies", {
      ...original,
      version: "synthetic-later-policy",
    });
    await ctx.db.patch(c._id, {
      policyId: next,
      failures: 3,
      openUntil: Date.now() + 50000,
    });
  });
  expect(
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      operationId: r.id,
    }),
  ).toMatchObject({
    applicability: "historical",
    result: { category: "educational" },
  });
  await f.t.mutation(internal.ai.jev.routing.scrub, { operationId: r.id });
  expect((await f.t.run((ctx) => ctx.db.get(r.id)))?.intent).not.toBeNull();
});

function beforePhysical(change: () => Promise<void>) {
  const native = TypeSafeClient.prototype.systemOne;
  vi.spyOn(TypeSafeClient.prototype, "systemOne").mockImplementation(function (
    this: TypeSafeClient,
    ...args: Parameters<typeof native>
  ) {
    let actual: ReturnType<typeof native> | undefined;
    const response = change().then(() => {
      actual = native.apply(this, args);
      return actual.asResponse();
    });
    // The response remains untouched; the installed SDK parses it once through its original APIPromise.
    return new APIPromise(response, async () => {
      if (!actual) throw new Error("Native SDK test gate did not admit");
      return actual;
    });
  });
}

test.each(["account", "actor", "purpose", "superseded", "unknown"])(
  "awaited native %s change after funding is rejoined before zero HTTP",
  async (kind) => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      const c = (await ctx.db
        .query("jevControls")
        .withIndex("by_key", (q) =>
          q.eq("key", `routing:account:${f.accountId}`),
        )
        .unique())!;
      await ctx.db.patch(c._id, { failures: 2, openUntil: 0 });
    });
    const id = await f.signed.mutation(prepare, f.command),
      transport = vi.fn(async () => response());
    vi.stubGlobal("fetch", transport);
    beforePhysical(async () => {
      const t = (await inspect(f)).attempts[0];
      expect(t.state).toBe("sent");
      if (kind === "account")
        await f.t.run((ctx) =>
          ctx.db.patch(f.accountId, { providerIdentity: "reconnected" }),
        );
      else if (kind === "actor")
        await f.t.run(async (ctx) => {
          const m = (await ctx.db
            .query("memberships")
            .withIndex("by_userId_and_workspaceId", (q) =>
              q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
            )
            .unique())!;
          await ctx.db.delete(m._id);
        });
      else if (kind === "purpose")
        await f.signed.mutation(api.ai.jev.routing.disable, scope(f));
      else if (kind === "superseded")
        await f.signed.mutation(api.content.ideas.edit, {
          workspaceId: f.workspaceId,
          ideaId: f.ideaId,
          expectedRevision: 1,
          title: "Later",
          note: "Later",
          perspective: "Later",
          priority: "normal",
          feedback: "Exact native change",
        });
      else
        vi.spyOn(contentProof, "ideaProofUntil").mockRejectedValue(
          new Error("Synthetic unexpected native proof failure"),
        );
    });
    if (kind === "unknown")
      await expect(f.t.action(classify, { operationId: id })).rejects.toThrow(
        "Synthetic unexpected native proof failure",
      );
    else await f.t.action(classify, { operationId: id });
    expect(transport).not.toHaveBeenCalled();
    const state = await inspect(f);
    expect(state.attempts[0]).toMatchObject({
      state: "settled",
      estimatedMicros: 0,
      inputTokens: 0,
      outputTokens: 0,
      heldMicros: 0,
      outcome: "unavailable",
    });
    for (const b of state.budgets)
      expect(b).toMatchObject({ heldMicros: 0, spentMicros: 0 });
    expect(
      state.controls.find((c) => c.key === `routing:account:${f.accountId}`),
    ).toMatchObject({ failures: 2, openUntil: 0, probeAttemptId: null });
    const o = state.operations[0];
    expect(o.sourceUnavailable).toBe(!["superseded", "unknown"].includes(kind));
    if (kind === "superseded")
      expect(o.result).toMatchObject({ status: "fallback", category: null });
    if (kind === "unknown") {
      expect(o.intent).not.toBeNull();
      expect(o.result).toBeNull();
    }
  },
);

test("own admitted half-open probe survives reproof and unrelated Analyzer circuit remains literal", async () => {
  const f = await fixture();
  let ownPolicy: Id<"jevPolicies"> | null = null;
  await f.t.run(async (ctx) => {
    const own = (await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `routing:account:${f.accountId}`))
      .unique())!;
    ownPolicy = own.policyId;
    await ctx.db.patch(own._id, { failures: 3, openUntil: 0 });
    await ctx.db.insert("jevControls", {
      key: `account:${f.accountId}`,
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      enabled: true,
      analyzer: true,
      routing: false,
      verification: false,
      networkFit: false,
      policyId: null,
      composerTimeoutMs: 2500,
      backgroundTimeoutMs: 5000,
      failures: 2,
      openUntil: 999,
      probeAttemptId: null,
    });
  });
  const id = await f.signed.mutation(prepare, f.command),
    transport = vi.fn(async () => {
      const state = await inspect(f);
      expect(
        state.controls.find((c) => c.key === `routing:account:${f.accountId}`)
          ?.probeAttemptId,
      ).toBe(state.attempts[0]._id);
      return response();
    });
  vi.stubGlobal("fetch", transport);
  await f.t.action(classify, { operationId: id });
  const state = await inspect(f);
  expect(
    state.controls.find((c) => c.key === `routing:account:${f.accountId}`),
  ).toMatchObject({
    policyId: ownPolicy,
    failures: 0,
    openUntil: 0,
    probeAttemptId: null,
  });
  expect(
    state.controls.find((c) => c.key === `account:${f.accountId}`),
  ).toMatchObject({
    analyzer: true,
    routing: false,
    failures: 2,
    openUntil: 999,
    probeAttemptId: null,
  });
  expect(transport).toHaveBeenCalledTimes(1);
});

test("pre-HTTP withdrawal releases only the operation's own half-open probe", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const c = (await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `routing:account:${f.accountId}`))
      .unique())!;
    await ctx.db.patch(c._id, { failures: 3, openUntil: 0 });
  });
  const id = await f.signed.mutation(prepare, f.command);
  beforePhysical(async () => {
    await f.signed.mutation(api.ai.jev.routing.disable, scope(f));
  });
  const transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  await f.t.action(classify, { operationId: id });
  expect(
    (await inspect(f)).controls.find(
      (c) => c.key === `routing:account:${f.accountId}`,
    ),
  ).toMatchObject({
    failures: 3,
    openUntil: 0,
    probeAttemptId: null,
    withdrawn: true,
  });
  expect(transport).not.toHaveBeenCalled();
});

test("late genuine reported cost survives immediate purpose fencing and physical scrub exactly once", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    id = await f.signed.mutation(prepare, f.command);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await f.signed.mutation(api.ai.jev.routing.disable, scope(f));
      expect(
        await f.signed.query(get, {
          workspaceId: f.workspaceId,
          operationId: id,
        }),
      ).toMatchObject({ applicability: "unavailable", result: null });
      await f.t.mutation(internal.ai.jev.routing.purge, {
        ...scope(f),
        cursor: null,
        force: true,
      });
      return response();
    }),
  );
  await f.t.action(classify, { operationId: id });
  const before = await inspect(f),
    t = before.attempts[0];
  expect(before.operations[0]).toMatchObject({
    sourceUnavailable: true,
    intent: null,
    result: null,
  });
  expect(t).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
    heldMicros: 0,
    outcome: "success",
  });
  const settlement = {
    attemptId: t._id,
    inputTokens: 20,
    outputTokens: 10,
    resolvedModel: "synthetic-routing-1.0",
    outcome: "success" as const,
    latencyMs: 1,
  };
  await f.t.mutation(internal.ai.jev.routing.settle, settlement);
  for (const b of (await inspect(f)).budgets)
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 30 });
  await expect(
    f.t.mutation(internal.ai.jev.routing.settle, {
      ...settlement,
      inputTokens: 21,
    }),
  ).rejects.toThrow("ROUTING_RECEIPT_CONFLICT");
  expect((await inspect(f)).attempts).toEqual(before.attempts);
});

test("uncertain actual provider IO keeps the original hold through scrub and later receipt", async () => {
  const f = await fixture(),
    id = await f.signed.mutation(prepare, f.command);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error(
        "Synthetic transport uncertainty after physical boundary",
      );
    }),
  );
  await f.t.action(classify, { operationId: id });
  let state = await inspect(f);
  const t = state.attempts[0];
  expect(t).toMatchObject({
    state: "unknown",
    heldMicros: 17000,
    estimatedMicros: null,
    outcome: "provider_error",
  });
  const other = await f.signed.mutation(prepare, {
    ...f.command,
    operationKey: "native-second-operation",
  });
  await f.t.action(classify, { operationId: other });
  expect((await inspect(f)).attempts).toHaveLength(1);
  await f.signed.mutation(api.ai.jev.routing.disable, scope(f));
  await f.t.mutation(internal.ai.jev.routing.purge, {
    ...scope(f),
    cursor: null,
    force: true,
  });
  await f.t.mutation(internal.ai.jev.routing.settle, {
    attemptId: t._id,
    inputTokens: 20,
    outputTokens: 10,
    resolvedModel: "synthetic-routing-1.0",
    outcome: "success",
    latencyMs: 1,
  });
  state = await inspect(f);
  expect(
    state.operations.every(
      (o) => o.sourceUnavailable && o.intent === null && o.result === null,
    ),
  ).toBe(true);
  for (const b of state.budgets)
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 30 });
  expect(
    state.controls.find((c) => c.key === `routing:account:${f.accountId}`)
      ?.failures,
  ).toBe(1);
});

test.each(["currency", "budget-scope", "owner-contamination"])(
  "original receipt rejects %s without changing original money",
  async (kind) => {
    const f = await fixture(),
      id = await f.signed.mutation(prepare, f.command),
      x = await f.t.query(internal.ai.jev.routing.context, { operationId: id });
    const tid = await f.t.mutation(internal.ai.jev.routing.fund, {
      operationId: id,
      expectedFingerprint: x.requestFingerprint,
    });
    await f.t.run(async (ctx) => {
      const t = (await ctx.db.get(tid))!;
      if (t.owner !== "jev-intent-router")
        throw new Error("fixture routing receipt");
      if (kind === "currency")
        await ctx.db.patch(t.budgetIds[0], { currency: "EUR" });
      else if (kind === "budget-scope")
        await ctx.db.patch(t.budgetIds[1], { scope: "account" });
      else
        await ctx.db.patch(t._id, { logicalIntent: "foreign-contamination" });
    });
    const before = await inspect(f);
    await expect(
      f.t.mutation(internal.ai.jev.routing.settle, {
        attemptId: tid,
        inputTokens: 1,
        outputTokens: 1,
        resolvedModel: "synthetic-routing-1.0",
        outcome: "success",
        latencyMs: 1,
      }),
    ).rejects.toThrow("ROUTING_RECEIPT_INVALID");
    expect(await inspect(f)).toEqual(before);
  },
);

test.each(["account", "global"])(
  "explicit %s withdrawal masks defaultOFF/human text immediately and physically drains more than one page",
  async (kind) => {
    vi.useFakeTimers();
    const f = await fixture(false),
      ids = [];
    for (let n = 0; n < 31; n++)
      ids.push(
        await f.signed.mutation(prepare, {
          ...f.command,
          operationKey: `native-cleanup-${n}`,
          intent: { ...f.command.intent, strategy: n % 2 ? "generic" : null },
        }),
      );
    if (kind === "account")
      await f.signed.mutation(api.ai.jev.routing.disable, scope(f));
    else await f.t.mutation(internal.ai.jev.routing.disableGlobal, {});
    for (const id of ids)
      expect(
        await f.signed.query(get, {
          workspaceId: f.workspaceId,
          operationId: id,
        }),
      ).toMatchObject({ applicability: "unavailable", result: null });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    let state = await inspect(f);
    expect(state.operations).toHaveLength(31);
    expect(
      state.operations.every(
        (o) => o.sourceUnavailable && o.intent === null && o.result === null,
      ),
    ).toBe(true);
    await f.t.run(async (ctx) => {
      for (const c of await ctx.db.query("jevControls").collect())
        await ctx.db.patch(c._id, {
          withdrawn: false,
          enabled: true,
          routing: true,
        });
    });
    // Regrant cannot resurrect original erased keys or protected bytes.
    await expect(
      f.signed.mutation(prepare, {
        ...f.command,
        operationKey: "native-cleanup-0",
      }),
    ).rejects.toThrow("ROUTING_SOURCE_UNAVAILABLE");
    state = await inspect(f);
    expect(
      state.operations
        .filter((o) => o.sourceUnavailable)
        .every((o) => o.intent === null && o.result === null),
    ).toBe(true);
    expect(state.attempts).toHaveLength(0);
  },
);

test.each(["missing", "complete"])(
  "shared version cleanup follows router edges before a %s root's early return",
  async (kind) => {
    vi.useFakeTimers();
    const f = await fixture(false),
      id = await f.signed.mutation(prepare, f.command),
      o = (await f.t.run((ctx) => ctx.db.get(id)))!;
    await f.t.run(async (ctx) => {
      if (kind === "missing") await ctx.db.delete(o.inputVersionId);
      else
        await ctx.db.patch(o.inputVersionId, {
          sourceUnavailable: true,
          sourceCleanupState: "complete",
        });
    });
    expect(
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        operationId: id,
      }),
    ).toMatchObject({ applicability: "unavailable", result: null });
    await f.t.mutation(internal.research.contentCleanup.version, {
      versionId: o.inputVersionId,
    });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
      intent: null,
      result: null,
      sourceUnavailable: true,
    });
  },
);

test("actual null-horizon copied source loss drains without a generator run and retains native IDs", async () => {
  vi.useFakeTimers();
  const f = await fixture(false),
    id = await f.signed.mutation(prepare, f.command),
    o = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(o.sourceUntil).toBeNull();
  expect(o.attemptId).toBeNull();
  await f.t.run((ctx) =>
    ctx.db.patch(o.inputVersionId, { sourceUnavailable: true }),
  );
  await f.t.mutation(internal.ai.contentCopies.sweep, {
    ideaVersionId: o.inputVersionId,
    cursor: null,
    path: [],
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
    workspaceId: f.workspaceId,
    actorId: f.userId,
    accountId: f.accountId,
    ideaId: f.ideaId,
    inputVersionId: o.inputVersionId,
    intent: null,
    result: null,
    sourceUnavailable: true,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("agentRuns").collect()),
  ).toHaveLength(0);
});

test("native Idea archive drains terminal protected text; ordinary edit keeps eligible history", async () => {
  vi.useFakeTimers();
  const f = await fixture(false),
    id = await f.signed.mutation(prepare, f.command);
  await f.signed.mutation(api.content.ideas.archive, {
    workspaceId: f.workspaceId,
    ideaId: f.ideaId,
    expectedRevision: 1,
    archived: true,
    feedback: "Withdrawal",
  });
  expect(
    await f.signed.query(get, { workspaceId: f.workspaceId, operationId: id }),
  ).toMatchObject({ applicability: "unavailable", result: null });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  await f.signed.mutation(api.content.ideas.archive, {
    workspaceId: f.workspaceId,
    ideaId: f.ideaId,
    expectedRevision: 2,
    archived: false,
    feedback: "Restore",
  });
  expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
    intent: null,
    result: null,
    sourceUnavailable: true,
  });
});

const declaredStyle = {
  author: "Unverified human style assertion",
  experiences: ["Human statement"],
  tone: "Clear",
  positioning: "Useful",
  pillars: [{ name: "Product", weight: 100 }],
  examples: ["Quoted achievement is untrusted"],
  forbidden: ["guaranteed"],
};
async function styles(f: Fixture) {
  let revision = 0;
  const change = async (
    action: FunctionArgs<typeof api.ai.styleProfiles.change>["action"],
  ) => {
    const r = await f.signed.mutation(api.ai.styleProfiles.change, {
      ...scope(f),
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      action,
    });
    revision = r.revision;
    return r;
  };
  const save = () =>
    change({
      kind: "save",
      payload: declaredStyle,
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Synthetic declared style",
    });
  return { change, save };
}

test("actual native style selection differs from saving an unselected style and from retained rights loss", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    s = await styles(f),
    first = await s.save();
  await s.change({
    kind: "select",
    versionId: first.versionId!,
    reason: "First selection",
  });
  const r = await route(f);
  expect(r.view).toMatchObject({
    applicability: "current",
    result: { category: "educational", status: "routed" },
  });
  expect(r.transport).toHaveBeenCalledTimes(1);
  await s.save();
  expect(
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      operationId: r.id,
    }),
  ).toMatchObject({
    applicability: "current",
    result: { category: "educational" },
  });
  const second = await s.save();
  await s.change({
    kind: "select",
    versionId: second.versionId!,
    reason: "Second selection",
  });
  expect(
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      operationId: r.id,
    }),
  ).toMatchObject({
    applicability: "historical",
    result: { category: "educational" },
  });
  await f.t.mutation(internal.ai.jev.routing.scrub, { operationId: r.id });
  expect((await f.t.run((ctx) => ctx.db.get(r.id)))?.intent).not.toBeNull();
  await f.t.run((ctx) =>
    ctx.db.patch(first.versionId!, { sourceUnavailable: true, payload: null }),
  );
  await f.t.mutation(internal.ai.styleProfiles.purgeRuns, {
    versionId: first.versionId!,
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.t.run((ctx) => ctx.db.get(r.id))).toMatchObject({
    intent: null,
    result: null,
    sourceUnavailable: true,
  });
  expect((await inspect(f)).attempts[0]).toMatchObject({
    estimatedMicros: 30,
    state: "settled",
  });
});

test("native team actor hook drains operations even with an unbounded source horizon", async () => {
  vi.useFakeTimers();
  const f = await fixture(false),
    id = await f.signed.mutation(prepare, f.command);
  await f.t.run(async (ctx) => {
    const m = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.delete(m._id);
  });
  await f.t.mutation(internal.team.purgeActor, { actorId: f.userId });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
    sourceUnavailable: true,
    intent: null,
    result: null,
  });
});

test("native query/resource failures propagate without destructive scrub or continued scheduling", async () => {
  const f = await fixture(false),
    id = await f.signed.mutation(prepare, f.command),
    before = await inspect(f);
  const limits = {
    databaseQueries: 3,
    bytesRead: 16 * 1024 * 1024,
    documentsRead: 32000,
  };
  for (const mode of ["get", "scrub", "purge"] as const) {
    const outcome = await f.signed.run(async (ctx) => {
      try {
        if (mode === "get")
          await ctx.runQuery(
            api.ai.jev.routing.get,
            { workspaceId: f.workspaceId, operationId: id },
            { transactionLimits: limits },
          );
        else if (mode === "scrub")
          await ctx.runMutation(
            internal.ai.jev.routing.scrub,
            { operationId: id },
            { transactionLimits: limits },
          );
        else
          await ctx.runMutation(
            internal.ai.jev.routing.purge,
            { cursor: null, force: false },
            { transactionLimits: limits },
          );
        return null;
      } catch (error) {
        return {
          message: String(error),
          typed: error instanceof ConvexError,
          metrics: await ctx.meta.getTransactionMetrics(),
        };
      }
    });
    expect(outcome).not.toBeNull();
    expect(outcome!.typed).toBe(false);
    expect(outcome!.metrics.databaseQueries.used).toBeGreaterThan(3);
  }
  expect(await inspect(f)).toEqual(before);
});

test("real 32-ancestor input remains bounded; the next ancestor propagates without a new operation", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const i = (await ctx.db.get(f.ideaId))!,
      v = (await ctx.db.get(i.currentVersionId!))!;
    const { _id, _creationTime, ...base } = v;
    let parent = v._id;
    for (let n = 0; n < 32; n++)
      parent = await ctx.db.insert("ideaVersions", {
        ...base,
        inputVersionId: parent,
        number: n + 2,
      });
    await ctx.db.patch(i._id, { currentVersionId: parent });
  });
  const routed = await route(f),
    first = routed.id,
    snap = await inspect(f);
  expect(snap.operations).toHaveLength(1);
  expect(routed.view).toMatchObject({
    applicability: "current",
    result: { status: "routed", category: "educational" },
  });
  expect(routed.transport).toHaveBeenCalledTimes(1);
  await f.t.run(async (ctx) => {
    const i = (await ctx.db.get(f.ideaId))!,
      v = (await ctx.db.get(i.currentVersionId!))!;
    const { _id, _creationTime, ...base } = v;
    const next = await ctx.db.insert("ideaVersions", {
      ...base,
      inputVersionId: v._id,
      number: 34,
    });
    await ctx.db.patch(i._id, { currentVersionId: next });
  });
  await expect(
    f.signed.mutation(prepare, {
      ...f.command,
      operationKey: "native-33rd-ancestor",
    }),
  ).rejects.toThrow("STYLE_ANCESTRY_LIMIT");
  await expect(
    f.t.mutation(internal.ai.jev.routing.scrub, { operationId: first }),
  ).resolves.toBeNull();
  expect((await inspect(f)).operations).toHaveLength(1);
});

test("original source and three-grant horizons are pinned downward and never renewed by later grants", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    until = Date.now() + 40000;
  await f.t.run(async (ctx) => {
    const idea = (await ctx.db.get(f.ideaId))!;
    await ctx.db.patch(idea.currentVersionId!, {
      researchProofUntil: Date.now() + 60000,
    });
    for (const b of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(b._id, { expiresAt: until });
  });
  const r = await route(f);
  expect((await f.t.run((ctx) => ctx.db.get(r.id)))?.sourceUntil).toBe(until);
  await f.t.run(async (ctx) => {
    for (const b of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(b._id, { expiresAt: until + 100000 });
  });
  expect(
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      operationId: r.id,
    }),
  ).toMatchObject({ sourceUntil: until, result: { category: "educational" } });
  await vi.advanceTimersByTimeAsync(40000);
  await f.t.finishInProgressScheduledFunctions();
  expect(await f.t.run((ctx) => ctx.db.get(r.id))).toMatchObject({
    intent: null,
    result: null,
    sourceUnavailable: true,
  });
  expect((await inspect(f)).attempts[0]).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
  });
});

test.each([
  "Viewer",
  "inactive",
  "disconnected",
  "foreign-account",
  "foreign-idea",
  "untrusted-strategy",
])(
  "native %s prepare boundary creates no operation or paid traffic",
  async (kind) => {
    const f = await fixture(),
      transport = vi.fn(async () => response());
    vi.stubGlobal("fetch", transport);
    let command = { ...f.command };
    await f.t.run(async (ctx) => {
      if (kind === "Viewer") {
        const m = (await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique())!;
        await ctx.db.patch(m._id, { role: "Viewer" });
      } else if (kind === "inactive")
        await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
      else if (kind === "disconnected")
        await ctx.db.patch(f.accountId, { connection: "disconnected" });
      else if (kind === "foreign-account" || kind === "foreign-idea") {
        const ws = (await ctx.db.get(f.workspaceId))!,
          { _id, _creationTime, ...base } = ws,
          other = await ctx.db.insert("workspaces", base);
        await ctx.db.patch(
          kind === "foreign-account" ? f.accountId : f.ideaId,
          { workspaceId: other },
        );
      }
    });
    if (kind === "untrusted-strategy")
      await expect(
        f.signed.mutation(prepare, {
          ...command,
          intent: { ...command.intent, strategy: "invented-special-generator" },
        }),
      ).rejects.toThrow("ROUTING_INPUT_INVALID");
    else await expect(f.signed.mutation(prepare, command)).rejects.toThrow();
    const state = await inspect(f);
    expect(state.operations).toHaveLength(0);
    expect(state.attempts).toHaveLength(0);
    expect(transport).not.toHaveBeenCalled();
  },
);

test("authenticated consumer cannot dispatch another native actor's operation or an unsigned public action", async () => {
  const f = await fixture(),
    id = await f.signed.mutation(prepare, f.command),
    transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  await expect(
    f.t.action(api.ai.jev.routing.classify, {
      workspaceId: f.workspaceId,
      operationId: id,
    }),
  ).rejects.toThrow();
  await f.t.run(async (ctx) => {
    const u = (await ctx.db.get(f.userId))!,
      { _id, _creationTime, ...base } = u;
    const other = await ctx.db.insert("users", {
      ...base,
      authId: "synthetic-another-owner",
    });
    await ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId: other,
      role: "Editor",
    });
    await ctx.db.patch(id, { actorId: other });
  });
  await expect(
    f.signed.action(api.ai.jev.routing.classify, {
      workspaceId: f.workspaceId,
      operationId: id,
    }),
  ).rejects.toThrow("ROUTING_AUTHORITY_UNAVAILABLE");
  expect((await inspect(f)).attempts).toHaveLength(0);
  expect(transport).not.toHaveBeenCalled();
});

test.each(["epoch", "capability"])(
  "original native account %s cannot silently renew through same identity",
  async (kind) => {
    const f = await fixture(),
      id = await f.signed.mutation(prepare, f.command),
      transport = vi.fn(async () => response());
    vi.stubGlobal("fetch", transport);
    await f.t.run(async (ctx) => {
      const a = (await ctx.db.get(f.accountId))!;
      if (kind === "capability")
        await ctx.db.patch(a._id, {
          capability: { ...a.capability, maxText: 279 },
        });
      else
        await ctx.db.patch(a._id, {
          xEvidence: {
            scopes: [],
            identityVerifiedAt: Date.now(),
            textScopeEligible: false,
            mediaScopeEligible: false,
            liveWrite: "unverified",
            ...a.xEvidence,
            connectionSequence: 1,
          },
        });
    });
    await f.t.action(classify, { operationId: id });
    expect(transport).not.toHaveBeenCalled();
    expect((await inspect(f)).attempts).toHaveLength(0);
    expect(
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        operationId: id,
      }),
    ).toMatchObject({ applicability: "unavailable", result: null });
  },
);

test.each(["superseded", "source", "style"])(
  "native %s change during actual SDK response rejects new stale output and preserves genuine cost",
  async (kind) => {
    const f = await fixture();
    let s: Awaited<ReturnType<typeof styles>> | undefined,
      version: Id<"styleProfileVersions"> | null = null;
    if (kind === "style") {
      s = await styles(f);
      version = (await s.save()).versionId;
      await s.change({
        kind: "select",
        versionId: version!,
        reason: "Original receipt",
      });
    }
    const id = await f.signed.mutation(prepare, f.command);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (kind === "superseded")
          await f.signed.mutation(api.content.ideas.edit, {
            workspaceId: f.workspaceId,
            ideaId: f.ideaId,
            expectedRevision: 1,
            title: "Changed",
            note: "Changed",
            perspective: "Changed",
            priority: "normal",
            feedback: "Concurrent native edit",
          });
        else if (kind === "source")
          await f.t.run(async (ctx) => {
            const o = (await ctx.db.get(id))!;
            await ctx.db.patch(o.inputVersionId, { sourceUnavailable: true });
          });
        else
          await s!.change({
            kind: "select",
            versionId: version!,
            reason: "New exact receipt",
          });
        return response("story", 0.9);
      }),
    );
    await f.t.action(classify, { operationId: id });
    const state = await inspect(f);
    expect(state.attempts[0]).toMatchObject({
      state: "settled",
      estimatedMicros: 30,
      heldMicros: 0,
    });
    const view = await f.signed.query(get, {
      workspaceId: f.workspaceId,
      operationId: id,
    });
    expect(view.applicability).toBe(
      kind === "source" ? "unavailable" : "historical",
    );
    expect(view.result?.category ?? null).toBeNull();
    expect(state.operations[0].sourceUnavailable).toBe(kind === "source");
  },
);

test("a different operation cannot inherit the half-open native circuit probe", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const c = (await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `routing:account:${f.accountId}`))
      .unique())!;
    await ctx.db.patch(c._id, { failures: 3, openUntil: 0 });
  });
  const first = await f.signed.mutation(prepare, f.command),
    x = await f.t.query(internal.ai.jev.routing.context, {
      operationId: first,
    }),
    tid = await f.t.mutation(internal.ai.jev.routing.fund, {
      operationId: first,
      expectedFingerprint: x.requestFingerprint,
    });
  await expect(
    f.t.query(internal.ai.jev.routing.authorizeFetch, {
      operationId: first,
      attemptId: tid,
      expectedFingerprint: x.requestFingerprint,
    }),
  ).resolves.toBeNull();
  const other = await f.signed.mutation(prepare, {
      ...f.command,
      operationKey: "other-recovery-probe",
    }),
    transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  await f.t.action(classify, { operationId: other });
  expect((await inspect(f)).attempts).toHaveLength(1);
  expect(transport).not.toHaveBeenCalled();
  expect(
    await f.signed.query(get, {
      workspaceId: f.workspaceId,
      operationId: other,
    }),
  ).toMatchObject({ result: { status: "configuration_required" } });
});

test("native UTF-8 input cap refuses before operation insertion or funding", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const c = (await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `routing:account:${f.accountId}`))
      .unique())!;
    await ctx.db.patch(c.policyId!, { maxInputTokens: 100 });
  });
  const transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  await expect(f.signed.mutation(prepare, f.command)).rejects.toThrow(
    "ROUTING_INPUT_LIMIT",
  );
  const state = await inspect(f);
  expect(state.operations).toHaveLength(0);
  expect(state.attempts).toHaveLength(0);
  expect(transport).not.toHaveBeenCalled();
});

test.each([null, -0.01, 1.01])(
  "malformed choice confidence %s cannot become probability-based confidence",
  async (confidence) => {
    const f = await fixture(),
      body = await response().json();
    body.answers.intent.confidence = confidence;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body))),
    );
    const id = await f.signed.mutation(prepare, f.command);
    await f.t.action(classify, { operationId: id });
    expect(
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        operationId: id,
      }),
    ).toMatchObject({
      result: { status: "fallback", category: null, choiceConfidence: null },
    });
    expect((await inspect(f)).attempts[0]).toMatchObject({
      state: "settled",
      estimatedMicros: 30,
      outcome: "invalid_response",
    });
  },
);

test("genuine usage over the reservation remains actual money and invalidates the routed answer", async () => {
  const f = await fixture(),
    body = await response().json();
  body.usage = { input_tokens: 16001, output_tokens: 1001 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body))),
  );
  const id = await f.signed.mutation(prepare, f.command);
  await f.t.action(classify, { operationId: id });
  const state = await inspect(f);
  expect(state.attempts[0]).toMatchObject({
    state: "settled",
    reservedMicros: 17000,
    estimatedMicros: 17002,
    heldMicros: 0,
    outcome: "invalid_response",
  });
  for (const b of state.budgets)
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 17002 });
  expect(state.operations[0].result).toMatchObject({
    status: "fallback",
    category: null,
  });
});

test("oversized physical response is bounded at 64000 bytes with no SDK retry", async () => {
  const f = await fixture(),
    transport = vi.fn(async () => new Response("x".repeat(64001)));
  vi.stubGlobal("fetch", transport);
  const id = await f.signed.mutation(prepare, f.command);
  await f.t.action(classify, { operationId: id });
  expect(transport).toHaveBeenCalledTimes(1);
  expect((await inspect(f)).attempts[0]).toMatchObject({
    state: "unknown",
    heldMicros: 17000,
    outcome: "invalid_response",
  });
  expect((await inspect(f)).operations[0].result).toMatchObject({
    status: "fallback",
    category: null,
  });
});

test("bounded native SDK timeout preserves uncertainty and late original settlement after source loss", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    id = await f.signed.mutation(prepare, f.command);
  let start!: () => void, resolve!: (value: Response) => void;
  const started = new Promise<void>((r) => {
    start = r;
  });
  const transport = vi.fn(() => {
    start();
    return new Promise<Response>((r) => {
      resolve = r;
    });
  });
  vi.stubGlobal("fetch", transport);
  const execution = f.t.action(classify, { operationId: id });
  await started;
  await vi.advanceTimersByTimeAsync(5001);
  await execution;
  const t = (await inspect(f)).attempts[0];
  expect(t).toMatchObject({
    state: "unknown",
    outcome: "timeout",
    heldMicros: 17000,
  });
  expect(transport).toHaveBeenCalledTimes(1);
  await f.t.run(async (ctx) => {
    const o = (await ctx.db.get(id))!;
    await ctx.db.patch(o.inputVersionId, { sourceUnavailable: true });
  });
  await f.t.mutation(internal.ai.jev.routing.scrub, { operationId: id });
  resolve(response());
  await Promise.resolve();
  await f.t.mutation(internal.ai.jev.routing.settle, {
    attemptId: t._id,
    inputTokens: 20,
    outputTokens: 10,
    resolvedModel: "synthetic-routing-1.0",
    outcome: "success",
    latencyMs: 5001,
  });
  const state = await inspect(f);
  expect(state.operations[0]).toMatchObject({
    sourceUnavailable: true,
    intent: null,
    result: null,
  });
  expect(state.attempts[0]).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
  });
  expect(
    state.controls.find((c) => c.key === `routing:account:${f.accountId}`)
      ?.failures,
  ).toBe(1);
});

test("unknown native proof after actual SDK IO propagates with genuine money and no destructive scrub", async () => {
  const f = await fixture(),
    id = await f.signed.mutation(prepare, f.command),
    transport = vi.fn(async () => {
      vi.spyOn(contentProof, "ideaProofUntil").mockRejectedValue(
        new ConvexError("SYNTHETIC_UNKNOWN_NATIVE_PROOF"),
      );
      return response();
    });
  vi.stubGlobal("fetch", transport);
  await expect(f.t.action(classify, { operationId: id })).rejects.toThrow(
    "SYNTHETIC_UNKNOWN_NATIVE_PROOF",
  );
  const state = await inspect(f);
  expect(state.attempts[0]).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
    heldMicros: 0,
  });
  expect(state.operations[0].sourceUnavailable).toBe(false);
  expect(state.operations[0].intent).not.toBeNull();
  expect(state.operations[0].result).toBeNull();
  expect(transport).toHaveBeenCalledTimes(1);
});

test("canonical boundary alias replays one exact native human operation", async () => {
  const f = await fixture(false),
    a = {
      ...f.command,
      intent: { ...f.command.intent, strategy: "thought-leadership" },
    },
    id = await f.signed.mutation(prepare, a);
  expect(
    await f.signed.mutation(prepare, {
      ...a,
      intent: { ...a.intent, strategy: "thoughtLeadership" },
    }),
  ).toBe(id);
  expect((await inspect(f)).operations).toHaveLength(1);
});

test("nonfinite native grant horizon cannot become an unbounded paid authority", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const b = (await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", "jev:provider"))
      .unique())!;
    await ctx.db.patch(b._id, { expiresAt: NaN });
  });
  const r = await route(f);
  expect(r.view.result).toMatchObject({ status: "configuration_required" });
  expect((await inspect(f)).attempts).toHaveLength(0);
  expect(r.transport).not.toHaveBeenCalled();
});

test("public routing money projection distinguishes original no-attempt deadline from unknown funded fallback", async () => {
  const f = await fixture(false);
  const id = await f.signed.mutation(prepare, f.command);
  const o = await f.t.run((ctx) => ctx.db.get(id));
  expect(
    await f.signed.query(get, { workspaceId: f.workspaceId, operationId: id }),
  ).toMatchObject({ deadline: o!.deadline, usage: null });
  const paid = await fixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("x".repeat(64001))),
  );
  const operationId = await paid.signed.mutation(prepare, paid.command);
  await paid.signed.action(api.ai.jev.routing.classify, {
    workspaceId: paid.workspaceId,
    operationId,
  });
  expect(
    await paid.signed.query(get, {
      workspaceId: paid.workspaceId,
      operationId,
    }),
  ).toMatchObject({
    result: { status: "fallback" },
    usage: {
      state: "unknown",
      heldMicros: 17000,
      estimatedMicros: null,
      currency: "USD",
    },
  });
});

test("public funded router result joins exact native generation SDK once and commits an unapproved perspective Idea", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  const { modelFixture } = await import("../../../tests/model-fixture");
  const generation = await modelFixture(f);
  await f.t.run(async (ctx) => {
    const budget = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) =>
        q.eq("key", `account:${generation.accountId}`),
      )
      .unique();
    await ctx.db.patch(budget!._id, {
      accountId: f.accountId,
      key: `account:${f.accountId}`,
    });
  });
  const routed = await route(f);
  expect(routed.transport).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5001);
  const args = {
    ...scope(f),
    ideaId: f.ideaId,
    expectedRevision: 1,
    intent: f.command.intent.intent,
    operationKey: "funded-routed-generation",
    routingOperationId: routed.id,
  };
  const runId = await f.signed.mutation(api.content.ideas.generate, args);
  expect(await f.signed.mutation(api.content.ideas.generate, args)).toBe(runId);
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-only-no-live-key");
  let physical = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      physical++;
      expect(String(url)).toBe(
        "https://router.eu.requesty.ai/v1/chat/completions",
      );
      expect(init!.body).toContain("requestedIntent");
      expect(init!.body).toContain("educational");
      return Response.json({
        id: "synthetic-generation",
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
                  title: "Unverified perspective",
                  perspective: "An interpretation",
                  rationale: "Unverified",
                  questions: ["What is known?"],
                }),
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    }),
  );
  await f.t.action(internal.ai.provider.execute, { runId });
  expect(physical).toBe(1);
  const request = await f.t.run((ctx) =>
    ctx.db
      .query("contentRequests")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique(),
  );
  expect(request).toMatchObject({ routingOperationId: routed.id });
  expect(request!.resultIdeaId).not.toBeNull();
  const idea = await f.signed.query(api.content.ideas.get, {
    workspaceId: f.workspaceId,
    ideaId: request!.resultIdeaId!,
  });
  expect(idea).toMatchObject({
    version: {
      title: "Unverified perspective",
      runId,
      questions: ["What is known?"],
    },
  });
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts).toHaveLength(2);
  expect(attempts.find((a) => a.owner === "jev-intent-router")).toMatchObject({
    routingOperationId: routed.id,
    estimatedMicros: 30,
    state: "settled",
  });
  expect(attempts.find((a) => "runId" in a && a.runId === runId)).toMatchObject(
    { estimatedMicros: 30, state: "settled" },
  );
  await f.signed.action(api.ai.jev.routing.classify, {
    workspaceId: f.workspaceId,
    operationId: routed.id,
  });
  expect(physical).toBe(1);
  expect(await f.t.run((ctx) => ctx.db.query("approvals").collect())).toEqual(
    [],
  );
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});

test.each(["get", "finish"])(
  "operation-owned %s rejects a deliberately misbound genuine different receipt without money or result changes",
  async (caller) => {
    const f = await fixture(),
      paid = await route(f),
      paidOperation = (await f.t.run((ctx) => ctx.db.get(paid.id)))!;
    const ownId = await f.signed.mutation(prepare, {
      ...f.command,
      operationKey: `wrong-pointer-${caller}`,
      intent: {
        ...f.command.intent,
        strategy: caller === "get" ? "generic" : null,
        tone: "Different immutable intent",
      },
    });
    expect(ownId).not.toBe(paid.id);
    expect(paidOperation.attemptId).not.toBeNull();
    expect((await inspect(f)).attempts).toHaveLength(1);
    expect(
      await f.signed.query(get, {
        workspaceId: f.workspaceId,
        operationId: ownId,
      }),
    ).toMatchObject({ usage: null });
    if (caller === "finish")
      expect((await f.t.run((ctx) => ctx.db.get(ownId)))!.result).toBeNull();
    // Stored pointer corruption in one actual DB; this is not a public forgery endpoint.
    await f.t.run((ctx) =>
      ctx.db.patch(ownId, { attemptId: paidOperation.attemptId }),
    );
    const before = await inspect(f);
    if (caller === "get")
      await expect(
        f.signed.query(get, {
          workspaceId: f.workspaceId,
          operationId: ownId,
        }),
      ).rejects.toThrow("ROUTING_RECEIPT_INVALID");
    else
      await expect(
        f.t.mutation(internal.ai.jev.routing.finish, {
          operationId: ownId,
          outcome: "success",
          answers: {
            intent: { type: "choice", value: "launch", confidence: 0.95 },
          },
        }),
      ).rejects.toThrow("ROUTING_RECEIPT_INVALID");
    expect(await inspect(f)).toEqual(before);
    expect(paid.transport).toHaveBeenCalledTimes(1);
    expect(await f.t.run((ctx) => ctx.db.query("approvals").collect())).toEqual(
      [],
    );
    expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
      [],
    );
  },
);
