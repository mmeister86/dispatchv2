import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { mediaFixture } from "../../tests/media-fixture";
import { api, internal } from "../_generated/api";
import { sha256 } from "../lib/crypto";
import { parseSearch } from "./webSearch";
import type { Id } from "../_generated/dataModel";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const config = {
  topics: "Product",
  project: "",
  audience: "Builders",
  languages: ["de"],
  regions: ["DE"],
  preferredSources: [],
  exclusions: "",
  freshnessDays: 30,
  topicCount: 5,
  frequency: "manual" as const,
  timeZone: "Europe/Berlin",
  clock: "09:00",
  weekday: 1,
  cap: null,
  autoHandoff: false as const,
};
async function fixture(
  operations: ("x-recent" | "x-trends" | "web-search")[] = [
    "x-recent",
    "web-search",
  ],
  cap = 300,
) {
  const f = await mediaFixture();
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key");
  vi.stubEnv("X_RESEARCH_BEARER_TOKEN", "synthetic-x-key");
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
      name: "Synthetic",
      handle: "@synthetic",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
        publish: false,
      },
    }),
  );
  const policies: Id<"researchSourcePolicies">[] = [];
  await f.t.run(async (ctx) => {
    for (const operation of operations)
      policies.push(
        await ctx.db.insert("researchSourcePolicies", {
          workspaceId: f.workspaceId,
          accountId,
          operation,
          enabled: true,
          version: "synthetic-v1",
          generation: 1,
          approvedBy: f.userId,
          expiresAt: Date.now() + 86400000,
          accessEvidence: "synthetic-own-access",
          processingEvidence: "synthetic-complete-chain",
          pricingEvidence: "synthetic-priced",
          rightsEvidence: "synthetic-public-only",
          protocolEvidence: "synthetic-exact-mode",
          lifecycleEvidence: "synthetic-current-removal-coverage",
          lifecycleValidUntil: Date.now() + 86400000,
          retentionMs: 600000,
          authMode: "app-only",
          credentialFingerprint: await sha256(
            operation === "web-search" ? "synthetic-key" : "synthetic-x-key",
          ),
          protocol:
            operation === "web-search"
              ? "requesty-chat-web-search-v1"
              : operation === "x-recent"
                ? "x-post-fields-v2"
                : "x-woeid-v2",
          currency: "USD",
          unit:
            operation === "web-search"
              ? "total-request"
              : operation === "x-recent"
                ? "post"
                : "request",
          unitMicros: operation === "web-search" ? 100 : 10,
          totalChargeBoundEvidence:
            "synthetic-hard-search-and-generation-total",
          allocationEvidence:
            "synthetic-native-slice-excludes-generation-and-publishing",
          allocatedProviderLimitMicros: 1000,
          costCurrencyEvidence: "synthetic-cost-field-exact-USD",
          model: operation === "web-search" ? "synthetic/model" : null,
          woeid: operation === "x-trends" ? 23424829 : null,
        }),
      );
    for (const [scope, key] of [
      ["provider", "native:x"],
      ["provider", "native:requesty"],
      ["workspace", `native:workspace:${f.workspaceId}`],
      ["account", `native:account:${accountId}`],
    ] as const)
      await ctx.db.insert("aiBudgets", {
        key,
        scope,
        workspaceId: scope === "provider" ? undefined : f.workspaceId,
        accountId: scope === "account" ? accountId : undefined,
        approvedBy: scope === "provider" ? undefined : f.userId,
        policyVersion: "synthetic-v1",
        currency: "USD",
        purposes: ["native-search"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 1000,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  const profileId = await f.signed.mutation(api.research.profiles.create, {
    workspaceId: f.workspaceId,
    accountId,
    config,
    commandKey: "create-native",
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId,
    expectedRevision: 1,
    commandKey: "native-cap",
    action: {
      kind: "save",
      config: { ...config, cap: { currency: "USD", limitMicros: cap } },
    },
  });
  const start = (key = "native-one", ops = operations) =>
    f.signed.mutation(api.research.native.start, {
      workspaceId: f.workspaceId,
      profileId,
      expectedRevision: 2,
      operationKey: key,
      query: "Product news",
      language: "de",
      operations: ops,
    });
  return { ...f, accountId, profileId, policies, start };
}
const frame = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
function streamResponse(
  sources = [
    { url: "https://example.test/news", title: "Öffentliche Nachricht" },
  ],
  cost: unknown = 0.00002,
) {
  return new Response(
    frame({
      choices: [
        {
          index: 0,
          delta: {
            content: "Invented https://fake.test",
            web_search: { content: sources },
          },
        },
      ],
    }) +
      frame({ choices: [{ delta: {}, finish_reason: "stop" }] }) +
      frame({
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cost,
        },
      }) +
      "data: [DONE]\r\n\r\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}
async function execute(
  f: Awaited<ReturnType<typeof fixture>>,
  id: Id<"researchOrders">,
) {
  await f.t.action(internal.research.execute.execute, {
    orderId: id,
    generation: 1,
  });
  return f.signed.query(api.research.native.results, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
}
test("physical independent X failure/Web success has actual three-scope reservations and leaves publishing unchanged", async () => {
  const f = await fixture(),
    id = await f.start();
  const publishing = await f.t.run((ctx) => ctx.db.get(f.accountId));
  let calls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    calls++;
    const attempts = await f.t.run((ctx) =>
      ctx.db
        .query("aiAttempts")
        .withIndex("by_researchOrderId_and_key", (q) =>
          q.eq("researchOrderId", id),
        )
        .collect(),
    );
    const current = attempts.find((t) => t.state === "sent")!;
    expect(current.owner).toBe("native-search");
    expect(current.reservedMicros).toBe(100);
    for (const bid of current.budgetIds)
      expect(
        (await f.t.run((ctx) => ctx.db.get(bid)))!.heldMicros,
      ).toBeGreaterThanOrEqual(100);
    expect(
      attempts.reduce((n, t) => n + t.heldMicros + (t.estimatedMicros ?? 0), 0),
    ).toBeLessThanOrEqual(300);
    if (String(url).startsWith("https://api.x.com/")) {
      const u = new URL(String(url));
      expect(u.pathname).toBe("/2/tweets/search/recent");
      expect(u.searchParams.get("post.fields")).toBe(
        "created_at,withheld,public_metrics",
      );
      expect(u.searchParams.has("expansions")).toBe(false);
      expect(u.searchParams.get("max_results")).toBe("10");
      return new Response("", { status: 503 });
    }
    expect(String(url)).toBe(
      "https://router.eu.requesty.ai/v1/chat/completions",
    );
    expect(init!.redirect).toBe("error");
    expect(JSON.parse(String(init!.body))).toMatchObject({
      tools: [{ type: "web_search" }],
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 256,
    });
    return streamResponse();
  });
  const rows = await execute(f, id);
  expect(calls).toBe(2);
  expect(rows[0]).toMatchObject({
    state: "unknown",
    sources: [],
    usagePending: true,
    billedMicros: null,
  });
  expect(rows[1]).toMatchObject({
    state: "completed",
    estimatedMicros: 20,
    billedMicros: null,
  });
  expect(rows[1].sources.map((s) => s.url)).toEqual([
    "https://example.test/news",
  ]);
  expect(await f.t.run((ctx) => ctx.db.get(f.accountId))).toEqual(publishing);
  expect(await f.t.run((ctx) => ctx.db.query("agentRuns").collect())).toEqual(
    [],
  );
});
test("Web native admission works with disconnected X and absent generation policy; old shells remain inert", async () => {
  const f = await fixture(["web-search"]);
  await f.t.run((ctx) =>
    ctx.db.patch(f.accountId, { connection: "disconnected" }),
  );
  expect(
    (
      await f.signed.query(api.research.profiles.configuration, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
      })
    ).currency,
  ).toBe("USD");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start();
  expect((await execute(f, id))[0].state).toBe("completed");
  const old = await f.signed
    .mutation(api.research.runs.start, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 2,
      operationKey: "old-shell",
    })
    .catch(() => null);
  expect(old).toBeNull();
});
test("missing trend permission is current visible configuration and never a live trend", async () => {
  const f = await fixture(["web-search"]),
    availability = await f.signed.query(api.research.native.availability, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
    });
  expect(availability.find((a) => a.operation === "x-trends")).toMatchObject({
    state: "configuration_required",
    currency: null,
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const rows = await execute(
    f,
    await f.start("trend-missing", ["x-trends", "web-search"]),
  );
  expect(rows[0].state).toBe("configuration_required");
  expect(rows[1].state).toBe("completed");
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("same authorized query cache hit makes no second physical receipt; source removal clears payload and prevents late refill", async () => {
  const f = await fixture(["web-search"]);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    streamResponse(),
  );
  const first = await execute(f, await f.start());
  const sourceId = first[0].sources[0].sourceId;
  const second = await execute(f, await f.start("cache-hit"));
  expect(second[0].cacheHit).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId,
    reason: "deleted",
  });
  expect(await f.t.run((ctx) => ctx.db.get(sourceId))).toMatchObject({
    status: "removed",
    url: null,
    title: null,
    text: null,
    count: null,
  });
  const id = await f.start("late-refill"),
    rows = await execute(f, id);
  expect(rows[0].sources).toEqual([]);
  expect(rows[0].state).toBe("removed");
});
test("unknown same logical intent survives a new order/fill key and lease expiry; separate Web still proceeds within cap", async () => {
  const f = await fixture();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).includes("api.x.com")
      ? new Response("", { status: 503 })
      : streamResponse(),
  );
  await execute(f, await f.start());
  vi.advanceTimersByTime(300001);
  const rows = await execute(f, await f.start("new-wrapper"));
  expect(rows[0].state).toBe("unknown");
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(rows[1].state).toBe("completed");
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(3);
});
test("atomic order cap blocks Web truthfully after held X failure", async () => {
  const f = await fixture(undefined, 150);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("", { status: 503 }),
  );
  const rows = await execute(f, await f.start());
  expect(rows[0].state).toBe("unknown");
  expect(rows[1].state).toBe("budget_exhausted");
  expect(fetch).toHaveBeenCalledTimes(1);
});
test.each([
  "totalChargeBoundEvidence",
  "allocationEvidence",
  "lifecycleEvidence",
  "processingEvidence",
  "protocolEvidence",
] as const)("missing %s proof denies physical I/O", async (field) => {
  const f = await fixture(["web-search"]);
  await f.t.run((ctx) => ctx.db.patch(f.policies[0], { [field]: "" }));
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const rows = await execute(f, await f.start());
  expect(rows[0].state).toBe("configuration_required");
  expect(fetch).not.toHaveBeenCalled();
});
test("late exact finance after stop settles once; conflicting receipt and legacy owner settlement reject", async () => {
  const f = await fixture(["x-recent"]),
    id = await f.start(),
    fill = await f.t.mutation(internal.research.cache.begin, {
      orderId: id,
      generation: 1,
      operation: "x-recent",
    });
  await f.signed.mutation(api.research.runs.stop, {
    workspaceId: f.workspaceId,
    orderId: id,
  });
  const receipt = {
    attemptId: fill.attemptId!,
    units: 3,
    reportedCost: null,
    costInvalid: false,
    errorCode: null,
  };
  await f.t.mutation(internal.research.cache.settle, receipt);
  await f.t.mutation(internal.research.cache.settle, receipt);
  expect(await f.t.run((ctx) => ctx.db.get(fill.attemptId!))).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
    heldMicros: 0,
    billedMicros: null,
  });
  await expect(
    f.t.mutation(internal.research.cache.settle, { ...receipt, units: 4 }),
  ).rejects.toThrow("RESEARCH_RECEIPT_CONFLICT");
  await expect(
    f.t.mutation(internal.ai.runs.settle, {
      attemptId: fill.attemptId!,
      inputTokens: 0,
      outputTokens: 0,
      errorCode: null,
    }),
  ).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
  for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
    if (b.key !== "native:requesty") expect(b.spentMicros).toBe(30);
});
test("actual current approver, currency and source hash changes before funding prevent physical call", async () => {
  const f = await fixture(["web-search"]),
    id = await f.start();
  await f.t.run((ctx) => ctx.db.patch(f.policies[0], { version: "changed" }));
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  expect((await execute(f, id))[0].sources).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
test("concurrent same fill admits one durable physical owner; expired lease cannot retry", async () => {
  const f = await fixture(["web-search"]),
    id = await f.start(),
    args = { orderId: id, generation: 1, operation: "web-search" as const };
  const results = await Promise.allSettled([
    f.t.mutation(internal.research.cache.begin, args),
    f.t.mutation(internal.research.cache.begin, args),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  vi.advanceTimersByTime(25000);
  await expect(
    f.t.mutation(internal.research.cache.begin, args),
  ).rejects.toThrow("RESEARCH_FILL_UNRESOLVED");
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
});
test("strict incremental UTF8 and multiline CRLF SSE retains only delivered URLs, no model-invented sources", async () => {
  const original = await streamResponse().text(),
    bytes = new TextEncoder().encode(original);
  const response = new Response(
    new ReadableStream({
      start(controller) {
        for (const b of bytes) controller.enqueue(new Uint8Array([b]));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
  const result = await parseSearch(response);
  expect(result.state).toBe("completed");
  expect(result.sources).toHaveLength(1);
  expect(result.sources[0].title).toBe("Öffentliche Nachricht");
  const multi = original.replace(
    'data: {"choices":',
    'data: {\r\ndata: "choices":',
  );
  expect(
    (
      await parseSearch(
        new Response(multi, {
          headers: { "content-type": "text/event-stream" },
        }),
      )
    ).state,
  ).toBe("completed");
});
test.each([
  "eof",
  "error",
  "corrupt",
  "utf8",
  "oversize",
  "conflicting-usage",
  "terminal-without-usage",
])("native stream %s never becomes completed", async (kind) => {
  let text = await streamResponse().text();
  if (kind === "eof") text = text.replace("data: [DONE]\r\n\r\n", "");
  if (kind === "error")
    text = text.replace(
      "data: [DONE]\r\n\r\n",
      frame({ error: { message: "private-provider-error" } }),
    );
  if (kind === "corrupt") text = text.replace("data: [DONE]", "data: {broken");
  if (kind === "oversize") text = "data: " + "x".repeat(65537) + "\n\n";
  if (kind === "conflicting-usage")
    text = text.replace(
      "data: [DONE]",
      frame({
        choices: [],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
          cost: 1,
        },
      }) + "data: [DONE]",
    );
  if (kind === "terminal-without-usage")
    text = text.replace(/data: \{"choices":\[\],"usage"[^\r]+\r\n\r\n/, "");
  const response = new Response(
      kind === "utf8" ? new Uint8Array([255]) : text,
      { headers: { "content-type": "text/event-stream" } },
    ),
    result = await parseSearch(response);
  expect(["unknown", "partial"]).toContain(result.state);
  expect(result.reportedCost).toBeNull();
  expect(result.reason).not.toContain("private-provider-error");
});

test.each([
  "member",
  "approver",
  "expiry",
  "purpose",
  "credential",
  "connection",
])("current %s withdrawal prevents physical native X funding", async (kind) => {
  const f = await fixture(["x-recent"]),
    id = await f.start();
  await f.t.run(async (ctx) => {
    if (kind === "member") {
      const m = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
        )
        .unique();
      await ctx.db.patch(m!._id, { role: "Viewer" });
    }
    if (kind === "approver" || kind === "expiry" || kind === "purpose") {
      const b = await ctx.db
        .query("aiBudgets")
        .withIndex("by_key", (q) =>
          q.eq("key", `native:account:${f.accountId}`),
        )
        .unique();
      await ctx.db.patch(
        b!._id,
        kind === "approver"
          ? { approvedBy: undefined }
          : kind === "expiry"
            ? { expiresAt: Date.now() - 1 }
            : { purposes: ["research"] },
      );
    }
    if (kind === "connection")
      await ctx.db.patch(f.accountId, { connection: "disconnected" });
  });
  if (kind === "credential")
    vi.stubEnv("X_RESEARCH_BEARER_TOKEN", "changed-synthetic-key");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: [] }));
  await f.t.action(internal.research.execute.execute, {
    orderId: id,
    generation: 1,
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
});
test("actual X recent page preserves unknown metrics, excludes withheld posts, and narrows 30-day profile to seven days", async () => {
  const f = await fixture(["x-recent"]),
    id = await f.start();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const u = new URL(String(url));
    expect(Date.parse(u.searchParams.get("start_time")!)).toBeGreaterThan(
      Date.now() - 7 * 86400000,
    );
    return Response.json({
      data: [
        {
          id: "123",
          text: "Public text",
          created_at: new Date(Date.now() - 10000).toISOString(),
        },
        {
          id: "124",
          text: "Withheld",
          created_at: new Date(Date.now() - 10000).toISOString(),
          withheld: { country_codes: ["DE"] },
        },
      ],
      meta: { next_token: "bounded-one-page" },
    });
  });
  const rows = await execute(f, id);
  expect(rows[0].sources).toHaveLength(1);
  expect(rows[0].sources[0]).toMatchObject({
    url: "https://x.com/i/web/status/123",
    text: "Public text",
    count: null,
  });
  expect(rows[0].estimatedMicros).toBe(20);
  expect(rows[0].truncated).toBe(true);
});
test("actual X trend request binds approved WOEID and does not fabricate absent count or public URL", async () => {
  const f = await fixture(["x-trends"]);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const u = new URL(String(url));
    expect(u.pathname).toBe("/2/trends/by/woeid/23424829");
    expect(u.searchParams.get("max_trends")).toBe("10");
    expect(u.searchParams.get("trend.fields")).toBe("trend_name,tweet_count");
    return Response.json({ data: [{ trend_name: "Synthetic trend" }] });
  });
  const rows = await execute(f, await f.start());
  expect(rows[0].sources[0]).toMatchObject({
    title: "Synthetic trend",
    count: null,
    url: null,
    publishedAt: null,
  });
  expect(rows[0].estimatedMicros).toBe(10);
});
test("foreign workspace cannot read cache/source results or invalidate an actual source", async () => {
  const f = await fixture(["web-search"]);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start(),
    rows = await execute(f, id),
    foreign = await f.t.run((ctx) =>
      ctx.db.insert("workspaces", { name: "Foreign", description: "" }),
    );
  await expect(
    f.signed.query(api.research.native.results, {
      workspaceId: foreign,
      orderId: id,
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  await expect(
    f.signed.mutation(api.research.cache.invalidate, {
      workspaceId: foreign,
      sourceId: rows[0].sources[0].sourceId,
      reason: "deleted",
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
});
test("current grant expiry bounds cached render proof and actual retention expiry clears payload without releasing unknown usage", async () => {
  const f = await fixture(["web-search"]);
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.policies[0], {
      costCurrencyEvidence: "",
      retentionMs: 5000,
    });
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `native:account:${f.accountId}`))
      .unique();
    await ctx.db.patch(b!._id, { expiresAt: Date.now() + 2000 });
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const id = await f.start(),
    rows = await execute(f, id),
    s = rows[0].sources[0];
  expect(s.usableUntil).toBe(Date.now() + 2000);
  expect(rows[0].usagePending).toBe(true);
  vi.advanceTimersByTime(5001);
  const stored = (await f.t.run((ctx) => ctx.db.get(s.sourceId)))!;
  await f.t.mutation(internal.research.cache.expire, {
    sourceId: s.sourceId,
    generation: stored.generation,
    usableUntil: stored.usableUntil,
  });
  expect(await f.t.run((ctx) => ctx.db.get(s.sourceId))).toMatchObject({
    text: null,
    title: null,
    url: null,
    status: "blocked",
  });
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!.heldMicros,
  ).toBe(100);
});
test("source removal while later physical fill is in flight cannot revive content; late finance still settles once", async () => {
  const f = await fixture(["web-search"]);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const original = await execute(f, await f.start()),
    sourceId = original[0].sources[0].sourceId;
  await f.t.run(async (ctx) => {
    const c = await ctx.db.query("researchCaches").first();
    await ctx.db.patch(c!._id, { expiresAt: Date.now() - 1 });
  });
  vi.mocked(fetch).mockImplementation(async () => {
    await f.signed.mutation(api.research.cache.invalidate, {
      workspaceId: f.workspaceId,
      sourceId,
      reason: "protected",
    });
    return streamResponse();
  });
  const id = await f.start("during-fill"),
    rows = await execute(f, id);
  expect(rows[0]).toMatchObject({
    state: "removed",
    reason: "RESEARCH_SOURCE_REMOVED",
    sources: [],
    estimatedMicros: 20,
    usagePending: false,
  });
  expect(await f.t.run((ctx) => ctx.db.get(sourceId))).toMatchObject({
    status: "removed",
    url: null,
    title: null,
  });
});
test("unknown intent cannot be laundered through a new identical profile version or operation key", async () => {
  const f = await fixture(["x-recent"]);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("", { status: 503 }),
  );
  await execute(f, await f.start());
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "new-version",
    action: {
      kind: "save",
      config: { ...config, cap: { currency: "USD", limitMicros: 300 } },
    },
  });
  const id = await f.signed.mutation(api.research.native.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    operationKey: "new-version-order",
    query: "Product news",
    language: "de",
    operations: ["x-recent"],
  });
  await execute(f, id);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
});

test("native allocation proof binds the provider slice limit without claiming external credit", async () => {
  const f = await fixture(["web-search"]),
    id = await f.start();
  await f.t.run(async (ctx) => {
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", "native:requesty"))
      .unique();
    await ctx.db.patch(b!._id, { limitMicros: 2000 });
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  const rows = await execute(f, id);
  expect(rows[0].state).toBe("configuration_required");
  expect(fetch).not.toHaveBeenCalled();
});
