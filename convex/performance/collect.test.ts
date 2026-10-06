import { afterEach, expect, test, vi } from "vitest";
import { mediaFixture } from "../../tests/media-fixture";
import { jevFixture } from "../../tests/jev-fixture";
import { api, internal } from "../_generated/api";
import { seal } from "../lib/crypto";
import { association } from "../integrations/x/fields";
import { normalizePage } from "./historyNormalize";
import { aggregate } from "./metricDefinitions";
import type { Doc } from "../_generated/dataModel";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function fixture(limit = 1000, maxResults = 5) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00Z"));
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "synthetic");
  const f = await mediaFixture();
  const accountId = await f.t.run(async (ctx) => {
    const accountId = await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "123",
      name: "Own fixture",
      handle: "fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
      xEvidence: {
        scopes: ["tweet.read", "users.read", "tweet.write"],
        identityVerifiedAt: Date.now(),
        connectionSequence: 1,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "verified",
      },
    });
    await ctx.db.insert("xBindings", {
      workspaceId: f.workspaceId,
      accountId,
      providerIdentity: "123",
      changedAt: Date.now(),
    });
    await ctx.db.insert("xCredentials", {
      workspaceId: f.workspaceId,
      accountId,
      generation: 1,
      envelope: await seal(
        { accessToken: "synthetic-only" },
        association(f.workspaceId, accountId),
      ),
      scopes: ["tweet.read", "users.read", "tweet.write"],
      expiresAt: Date.now() + 86400000,
      leaseUntil: 0,
      cleanAfter: Number.MAX_SAFE_INTEGER,
    });
    return accountId;
  });
  const args = { workspaceId: f.workspaceId, accountId };
  const policyId = await f.t.mutation(internal.performance.history.configure, {
    ...args,
    version: "history-test-v1",
    approvedBy: f.userId,
    expiresAt: Date.now() + 86400000,
    purpose: "own-history-analytics-context-v1",
    dialect: "post-fields-repost-v2",
    providerIdentity: "123",
    connectionSequence: 1,
    accessEvidence: "Synthetic only",
    rightsEvidence: "Synthetic own context permission",
    pricingEvidence: "Synthetic returned-resource unit, no discount inference",
    protocolEvidence: "Synthetic exact dialect",
    allocationEvidence: "Synthetic only",
    unit: "returned-post-resource",
    unitMicros: 10,
    currency: "USD",
    allocatedProviderLimitMicros: limit,
    retentionMs: 86400000,
    maxResults,
  });
  await f.t.run(async (ctx) => {
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key: [
          "history:x",
          `history:workspace:${f.workspaceId}`,
          `history:account:${accountId}`,
        ][i],
        scope,
        ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
        ...(i === 2 ? { accountId } : {}),
        policyVersion: "history-test-v1",
        currency: "USD",
        purposes: ["own-history"],
        expiresAt: Date.now() + 86400000,
        limitMicros: limit,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  const start = async () => {
    const acknowledged = (
      await f.signed.query(api.performance.history.overview, args)
    ).policy!;
    return f.signed.mutation(api.performance.history.start, {
      ...args,
      policyId: acknowledged.id,
      policyFingerprint: acknowledged.fingerprint,
      purpose: "own-history-analytics-context-v1",
      consent: true,
    });
  };
  return { ...f, args, accountId, policyId, start };
}
const row = (id = "101", extra = {}) => ({
  id,
  author_id: "123",
  text: "Own old text",
  created_at: "2026-07-01T12:00:00Z",
  ...extra,
});
const page = (rows: ReturnType<typeof row>[], next?: string) =>
  new Response(
    JSON.stringify({
      data: rows,
      meta: {
        result_count: rows.length,
        ...(next ? { next_token: next } : {}),
      },
    }),
  );
const view = (f: Awaited<ReturnType<typeof fixture>>) =>
  f.signed.query(api.performance.history.overview, f.args);
const budgets = (f: Awaited<ReturnType<typeof fixture>>) =>
  f.t.run((ctx) => ctx.db.query("aiBudgets").collect());
async function read(
  f: Awaited<ReturnType<typeof fixture>>,
  jobId: Doc<"historyJobs">["_id"],
) {
  const j = await f.t.run((ctx) => ctx.db.get(jobId));
  await f.t.action(internal.performance.backfill.read, {
    jobId,
    generation: j!.generation,
  });
}
test("TASK41 default OFF: numeric metric permission cannot authorize own-history context", async () => {
  const f = await mediaFixture(),
    accountId = await f.t.run((ctx) =>
      ctx.db.insert("socialAccounts", {
        workspaceId: f.workspaceId,
        provider: "X",
        providerIdentity: "123",
        name: "Own",
        handle: "own",
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
  expect(
    await f.signed.query(api.performance.history.overview, {
      workspaceId: f.workspaceId,
      accountId,
    }),
  ).toMatchObject({ reason: "OWN_HISTORY_CONFIGURATION_REQUIRED", posts: [] });
  await expect(
    f.signed.mutation(api.performance.history.start, {
      workspaceId: f.workspaceId,
      accountId,
      purpose: "own-history-analytics-context-v1",
      consent: true,
    }),
  ).rejects.toThrow("OWN_HISTORY_CONFIGURATION_REQUIRED");
});
test("TASK41 fixed verified owned endpoint reserves max returned resources on ALL3 before physical IO; known quantity settles, billed NULL and old private metrics stay incomplete", async () => {
  const f = await fixture(50);
  const id = await f.start();
  const fetchMock = vi.fn(async (url: string) => {
    expect(new URL(url).pathname).toBe("/2/users/123/tweets");
    expect(new URL(url).searchParams.get("max_results")).toBe("5");
    expect(new URL(url).searchParams.get("exclude")).toBe("retweets");
    expect(new URL(url).searchParams.get("post.fields")).not.toContain(
      "metrics",
    );
    expect(new URL(url).searchParams.has("tweet.fields")).toBe(false);
    expect(new URL(url).searchParams.has("expansions")).toBe(false);
    expect(
      (await budgets(f)).every(
        (b) => b.heldMicros === 50 && b.spentMicros === 0,
      ),
    ).toBe(true);
    return page([row()]);
  });
  vi.stubGlobal("fetch", fetchMock);
  await read(f, id);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(
    (await budgets(f)).every((b) => b.heldMicros === 0 && b.spentMicros === 10),
  ).toBe(true);
  expect((await view(f)).posts[0]).toMatchObject({
    text: "Own old text",
    metricsStatus: "not-observed",
    accountSize: null,
    postAttemptId: null,
    versionId: null,
    thenKnowledgeId: null,
    historicalAnalysisId: null,
  });
  const t = await f.t.run((ctx) => ctx.db.query("aiAttempts").first());
  expect(t).toMatchObject({
    reservedMicros: 50,
    estimatedMicros: 10,
    billedMicros: null,
    resourceCount: 1,
    state: "settled",
  });
});
test("TASK41 funded last unit remains readable and following page is denied without new IO", async () => {
  const f = await fixture(50),
    id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      page(
        [row("101"), row("102"), row("103"), row("104"), row("105")],
        "next",
      ),
    ),
  );
  await read(f, id);
  expect((await view(f)).posts).toHaveLength(5);
  expect((await view(f)).reason).toBeNull();
  await read(f, id);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await view(f)).posts.every((p) => p.text !== null)).toBe(true);
  expect((await view(f)).jobs[0]).toMatchObject({
    state: "blocked",
    reason: "OWN_HISTORY_BUDGET_EXHAUSTED",
  });
});
test("TASK41 bounded empty-next pages continue; three pages stop partial and explicit fresh import deduplicates", async () => {
  const f = await fixture(),
    id = await f.start();
  const responses = [
    page([], "one"),
    page([row()], "two"),
    page([row()], "three"),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => responses.shift()!),
  );
  await read(f, id);
  expect((await view(f)).jobs[0]).toMatchObject({ state: "queued", pages: 1 });
  await read(f, id);
  await read(f, id);
  expect((await view(f)).jobs[0]).toMatchObject({
    state: "partial",
    pages: 3,
    imported: 1,
    reason: "OWN_HISTORY_PAGE_LIMIT",
  });
  expect((await view(f)).posts).toHaveLength(1);
  await read(f, id);
  expect(fetch).toHaveBeenCalledTimes(3);
  const second = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => page([row()])),
  );
  await read(f, second);
  expect((await view(f)).posts).toHaveLength(1);
  expect((await view(f)).jobs[0].imported).toBe(0);
});
test("TASK41 repeated cursor and partially invalid own records are explicit bounded partial, no foreign expansion", async () => {
  const f = await fixture(),
    id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => page([row()], "same")),
  );
  await read(f, id);
  await read(f, id);
  expect((await view(f)).jobs[0]).toMatchObject({
    state: "partial",
    reason: "OWN_HISTORY_CURSOR_REPEATED",
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  const next = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      page([
        row("102", { referenced_tweets: [{ type: "quoted", id: "999" }] }),
        row("103", { referenced_tweets: [{ type: "retweeted", id: "999" }] }),
      ]),
    ),
  );
  await read(f, next);
  expect((await view(f)).jobs[0]).toMatchObject({
    state: "partial",
    rejected: 1,
  });
  expect((await view(f)).posts.find((p) => p.externalId === "102")?.text).toBe(
    "Own old text",
  );
  expect(
    (await view(f)).posts.find((p) => p.externalId === "103"),
  ).toBeUndefined();
});
test.each(["provider", "workspace", "account"] as const)(
  "TASK41 %s exhausted quota prevents provider IO",
  async (scope) => {
    const f = await fixture(),
      id = await f.start();
    await f.t.run(async (ctx) => {
      const b = (await ctx.db.query("aiBudgets").collect()).find(
        (b) => b.scope === scope,
      )!;
      await ctx.db.patch(b._id, { spentMicros: 999 });
    });
    vi.stubGlobal("fetch", vi.fn());
    await read(f, id);
    expect(fetch).not.toHaveBeenCalled();
    expect((await view(f)).jobs[0].reason).toContain("EXHAUSTED");
  },
);
test.each(["credential", "actor", "purpose", "grant", "owner"])(
  "TASK41 changed %s authority prevents physical IO",
  async (kind) => {
    const f = await fixture(),
      id = await f.start();
    await f.t.run(async (ctx) => {
      if (kind === "credential") {
        const c = (await ctx.db.query("xCredentials").first())!;
        await ctx.db.patch(c._id, { envelope: undefined });
      }
      if (kind === "actor") {
        const m = (await ctx.db.query("memberships").first())!;
        await ctx.db.patch(m._id, { role: "Viewer" });
      }
      if (kind === "purpose" || kind === "grant") {
        const b = (await ctx.db.query("aiBudgets").first())!;
        await ctx.db.patch(
          b._id,
          kind === "purpose"
            ? { purposes: ["own-metrics"] }
            : { expiresAt: Date.now() },
        );
      }
      if (kind === "owner")
        await ctx.db.patch(f.accountId, { providerIdentity: "456" });
    });
    vi.stubGlobal("fetch", vi.fn());
    await read(f, id);
    expect(fetch).not.toHaveBeenCalled();
  },
);
test("TASK41 foreign tenant query/manage deny and foreign author response imports nothing, liability held", async () => {
  const f = await fixture(),
    other = await mediaFixture(),
    id = await f.start();
  await expect(
    other.signed.query(api.performance.history.overview, f.args),
  ).rejects.toThrow();
  const foreignWorkspace = await f.signed.mutation(api.workspaces.create, {
    name: "Separate tenant fixture",
    description: "Synthetic same-store tenant boundary",
  });
  await expect(
    f.signed.query(api.performance.history.overview, {
      workspaceId: foreignWorkspace,
      accountId: f.accountId,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await expect(
    f.signed.mutation(api.performance.history.manage, {
      workspaceId: foreignWorkspace,
      jobId: id,
      operation: "pause",
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => page([row("101", { author_id: "foreign" })])),
  );
  await read(f, id);
  expect((await view(f)).posts).toHaveLength(0);
  expect((await view(f)).jobs[0].state).toBe("unknown");
  expect(
    (await budgets(f)).every((b) => b.heldMicros === 50 && b.spentMicros === 0),
  ).toBe(true);
  await read(f, id);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("TASK41 queued pause/resume/cancel durable control; unknown paid page cannot resume", async () => {
  const f = await fixture(),
    id = await f.start();
  await f.signed.mutation(api.performance.history.manage, {
    workspaceId: f.workspaceId,
    jobId: id,
    operation: "pause",
  });
  vi.stubGlobal("fetch", vi.fn());
  await read(f, id);
  expect(fetch).not.toHaveBeenCalled();
  await f.signed.mutation(api.performance.history.manage, {
    workspaceId: f.workspaceId,
    jobId: id,
    operation: "resume",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("failure", { status: 503 })),
  );
  await read(f, id);
  expect((await view(f)).jobs[0].state).toBe("unknown");
  await expect(
    f.signed.mutation(api.performance.history.manage, {
      workspaceId: f.workspaceId,
      jobId: id,
      operation: "resume",
    }),
  ).rejects.toThrow();
  const fresh = await f.start();
  await f.signed.mutation(api.performance.history.manage, {
    workspaceId: f.workspaceId,
    jobId: fresh,
    operation: "cancel",
  });
  await read(f, fresh);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await view(f)).jobs[0].state).toBe("cancelled");
});
test("TASK41 late known settlement once after delete/reactivate cannot restore old payload; delete cutoff survives fresh import", async () => {
  const f = await fixture(),
    id = await f.start();
  let firstReceipt:
    | Parameters<
        typeof f.t.mutation<typeof internal.performance.history.finish>
      >[1]
    | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await f.signed.mutation(api.performance.history.remove, f.args);
      await f.start();
      return page([row()]);
    }),
  );
  await read(f, id);
  expect((await view(f)).posts).toHaveLength(0);
  expect(
    (await budgets(f)).every((b) => b.spentMicros === 10 && b.heldMicros === 0),
  ).toBe(true);
  const t = (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!;
  firstReceipt = {
    attemptId: t._id,
    ...normalizePage({ data: [row()], meta: { result_count: 1 } }, "123", 5),
  };
  await f.t.mutation(internal.performance.history.finish, firstReceipt);
  expect((await budgets(f)).every((b) => b.spentMicros === 10)).toBe(true);
  await expect(
    f.t.mutation(internal.performance.history.finish, {
      ...firstReceipt,
      reason: "conflict",
    }),
  ).rejects.toThrow("CONFLICT");
  const fresh = (await view(f)).jobs.find((j) => j.state === "queued")!;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => page([row("102")])),
  );
  await read(f, fresh.id);
  const cutoff = (await f.t.run((ctx) =>
    ctx.db.query("historyControls").first(),
  ))!.deletedThroughGeneration;
  await f.t.mutation(internal.performance.history.clear, {
    ...f.args,
    generation: cutoff,
    cursor: null,
    jobs: false,
  });
  expect((await view(f)).posts.map((p) => p.externalId)).toEqual(["102"]);
});
test.each(["deleted", "original-actor-revoked"] as const)(
  "TASK41 fresh acknowledged same-post intent replaces %s source before delayed cleanup",
  async (mode) => {
    const f = await fixture(),
      original = await f.start();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => page([row()])),
    );
    await read(f, original);
    const old = (await f.t.run((ctx) => ctx.db.query("historyPosts").first()))!;
    expect((await view(f)).posts[0].text).toBe("Own old text");
    let cutoff = 0;
    if (mode === "deleted") {
      await f.signed.mutation(api.performance.history.remove, f.args);
      cutoff = (await f.t.run((ctx) =>
        ctx.db.query("historyControls").first(),
      ))!.deletedThroughGeneration;
      expect((await view(f)).posts).toHaveLength(0);
    } else {
      await f.t.run(async (ctx) => {
        const revoked = await ctx.db.insert("users", {
          authId: "revoked-original-history-actor",
          defaultWorkspaceId: f.workspaceId,
          activeWorkspaceId: f.workspaceId,
        });
        await ctx.db.patch(original, { actorId: revoked });
      });
      expect((await view(f)).posts[0].text).toBeNull();
    }
    const fresh = await f.start();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        page([row("101", { text: "Fresh authorized context" })]),
      ),
    );
    await read(f, fresh);
    expect((await view(f)).posts).toHaveLength(1);
    expect((await view(f)).posts[0]).toMatchObject({
      externalId: "101",
      text: "Fresh authorized context",
      jobId: fresh,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("historyPosts").collect()),
    ).toHaveLength(1);
    expect(
      (await budgets(f)).every(
        (b) => b.spentMicros === 20 && b.heldMicros === 0,
      ),
    ).toBe(true);
    if (mode === "deleted") {
      await f.t.mutation(internal.performance.history.clear, {
        ...f.args,
        generation: cutoff,
        cursor: null,
        jobs: false,
      });
      expect((await view(f)).posts[0]).toMatchObject({
        _id: old._id,
        jobId: fresh,
        text: "Fresh authorized context",
      });
    }
  },
);
test("TASK41 token rotation during physical read settles once but suppresses text; in-flight pause refuses replay", async () => {
  const f = await fixture(),
    id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await f.t.run(async (ctx) => {
        const c = (await ctx.db.query("xCredentials").first())!;
        await ctx.db.patch(c._id, { generation: 2 });
      });
      return page([row()]);
    }),
  );
  await read(f, id);
  expect((await view(f)).posts).toHaveLength(0);
  expect((await budgets(f)).every((b) => b.spentMicros === 10)).toBe(true);
  expect((await view(f)).jobs[0].state).toBe("blocked");
  const next = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await f.signed.mutation(api.performance.history.manage, {
        workspaceId: f.workspaceId,
        jobId: next,
        operation: "pause",
      });
      return page([row()]);
    }),
  );
  await read(f, next);
  expect((await view(f)).jobs[0]).toMatchObject({
    state: "blocked",
    reason: "OWN_HISTORY_PAUSED_PAGE_DISCARDED",
    canResume: false,
  });
  await expect(
    f.signed.mutation(api.performance.history.manage, {
      workspaceId: f.workspaceId,
      jobId: next,
      operation: "resume",
    }),
  ).rejects.toThrow("INTENT_INACTIVE");
});
test("TASK41 original grant horizon survives renewal: text hidden before physical cleanup and then removed", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const b = (await ctx.db.query("aiBudgets").collect()).find(
      (b) => b.scope === "account",
    )!;
    await ctx.db.patch(b._id, { expiresAt: Date.now() + 1000 });
  });
  const id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => page([row()])),
  );
  await read(f, id);
  expect((await view(f)).posts[0].text).toBe("Own old text");
  await f.t.run(async (ctx) => {
    const b = (await ctx.db.query("aiBudgets").collect()).find(
      (b) => b.scope === "account",
    )!;
    await ctx.db.patch(b._id, { expiresAt: Date.now() + 86400000 });
  });
  vi.setSystemTime(Date.now() + 1001);
  expect((await view(f)).posts[0].text).toBeNull();
  await f.t.mutation(internal.performance.history.expire, {});
  expect(
    await f.t.run((ctx) => ctx.db.query("historyPosts").collect()),
  ).toHaveLength(0);
});
test("TASK41 current revoked purpose immediately hides retained text and physical cleanup removes it", async () => {
  const f = await fixture(),
    id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => page([row()])),
  );
  await read(f, id);
  await f.t.run(async (ctx) => {
    const b = (await ctx.db.query("aiBudgets").first())!;
    await ctx.db.patch(b._id, { purposes: [] });
  });
  expect((await view(f)).posts[0].text).toBeNull();
  await f.t.mutation(internal.performance.history.expire, {});
  expect((await view(f)).posts).toHaveLength(0);
});
test("TASK41 exact original Dispatch publication remains separate from latest edited imported text and explicit THEN null", async () => {
  const f = await fixture(),
    e = await jevFixture(true, f, f.accountId);
  const approvalId = await e.signed.mutation(api.editorial.approve, {
    ...f.args,
    versionId: e.request.draftVersionId,
  });
  const scheduleId = await e.signed.mutation(api.editorial.schedule, {
    ...f.args,
    versionId: e.request.draftVersionId,
    approvalId,
    at: Date.now() + 60000,
    timezone: "UTC",
    localTime: "2026-10-06T12:01",
  });
  vi.setSystemTime(Date.now() + 60000);
  await f.t.mutation(internal.publishing.claim, { scheduleId, generation: 1 });
  const first = await f.t.mutation(internal.publishing.attempts.claim, {
    scheduleId,
    generation: 1,
  });
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: first!._id,
    claimSequence: first!.claimSequence,
    credentialGeneration: 1,
    mediaIds: [],
  });
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: first!._id,
    claimSequence: first!.claimSequence,
    outcome: "confirmed",
    externalId: "101",
    durationMs: 1,
  });
  const original = await f.t.run((ctx) => ctx.db.get(e.request.draftVersionId)),
    k = await f.t.run((ctx) => ctx.db.query("publicationKnowledge").first());
  expect(k?.assessmentId).toBeNull();
  const id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      page([row("101", { text: "LATEST EDIT, not original send" })]),
    ),
  );
  await read(f, id);
  expect((await view(f)).posts[0]).toMatchObject({
    text: "LATEST EDIT, not original send",
    versionId: e.request.draftVersionId,
    thenKnowledgeId: k!._id,
    historicalAnalysisId: null,
  });
  expect(await f.t.run((ctx) => ctx.db.get(e.request.draftVersionId))).toEqual(
    original,
  );
  expect(await f.t.run((ctx) => ctx.db.get(k!._id))).toEqual(k);
});
test("TASK41 exact page bounds, invalid envelope/owner/date, 100 supported posts, zero versus missing compatible aggregate and late exclusion", () => {
  expect(
    normalizePage({ data: [row()], meta: { result_count: 2 } }, "123", 5)
      .resourceCount,
  ).toBeNull();
  expect(
    normalizePage(
      { data: [row("101", { author_id: "456" })], meta: { result_count: 1 } },
      "123",
      5,
    ).resourceCount,
  ).toBeNull();
  expect(
    normalizePage(
      {
        data: [row("101", { created_at: "2027-01-01T00:00:00Z" })],
        meta: { result_count: 1 },
      },
      "123",
      5,
    ),
  ).toMatchObject({ resourceCount: 1, rejected: 1 });
  const hundred = Array.from({ length: 100 }, (_, i) =>
    row(String(i + 1), { text: "x".repeat(25000) }),
  );
  expect(
    normalizePage({ data: hundred, meta: { result_count: 100 } }, "123", 100)
      .posts,
  ).toHaveLength(100);
  const base = {
    state: "observed",
    windowHours: 24,
    definitionVersion: "v1",
    dialect: "post-fields-repost-v2",
    late: false,
    fields: [
      {
        name: "impressions",
        rawField: "public_metrics.impression_count",
        definition: "Repeated impressions",
        status: "measured",
        value: 0,
      },
    ],
  } as Doc<"performanceSnapshots">;
  expect(
    aggregate(
      [
        base,
        {
          ...base,
          fields: [{ ...base.fields[0], status: "missing", value: null }],
        },
      ],
      3,
    ),
  ).toMatchObject({ covered: 2, total: 3, fields: [{ value: 0, covered: 1 }] });
  expect(
    aggregate(
      [
        base,
        { ...base, dialect: "tweet-fields-retweet-v2" },
        { ...base, late: true },
      ],
      3,
    ),
  ).toMatchObject({ covered: 1 });
});
test("TASK41 a 100-post streamed page exceeds old32KiB cap safely; oversized or overdue stream keeps paid resource usage unknown", async () => {
  const f = await fixture(1000, 100),
    id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      page(
        Array.from({ length: 100 }, (_, i) =>
          row(String(i + 1), { text: "x".repeat(1000) }),
        ),
      ),
    ),
  );
  await read(f, id);
  expect((await view(f)).posts).toHaveLength(25);
  expect(
    await f.t.run((ctx) => ctx.db.query("historyPosts").collect()),
  ).toHaveLength(100);
  expect(
    (await budgets(f)).every(
      (b) => b.spentMicros === 1000 && b.heldMicros === 0,
    ),
  ).toBe(true);
  const g = await fixture(1000, 100),
    next = await g.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(17 * 1024 * 1024));
              controller.close();
            },
          }),
        ),
    ),
  );
  await read(g, next);
  expect((await view(g)).jobs[0].state).toBe("unknown");
  expect(
    (await budgets(g)).every(
      (b) => b.heldMicros === 1000 && b.spentMicros === 0,
    ),
  ).toBe(true);
  const h = await fixture(),
    last = await h.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      vi.setSystemTime(Date.now() + 15001);
      return page([row()]);
    }),
  );
  await read(h, last);
  expect((await view(h)).jobs[0].state).toBe("unknown");
  expect((await budgets(h)).every((b) => b.heldMicros === 50)).toBe(true);
});
test("TASK41 explicit immutable five-window policy schedules exact local anchors; late 15min cumulative read is not historical window count", async () => {
  const f = await fixture(),
    e = await jevFixture(true, f, f.accountId);
  const config = {
    ...f.args,
    version: "metrics-five-v1",
    approvedBy: f.userId,
    expiresAt: Date.now() + 86400000,
    purpose: "own-post-descriptive-editorial-v1" as const,
    dialect: "post-fields-repost-v2" as const,
    accessEvidence: "Synthetic",
    rightsEvidence: "Synthetic",
    pricingEvidence: "Synthetic",
    protocolEvidence: "Synthetic",
    allocationEvidence: "Synthetic",
    fields: ["likes", "url_clicks"],
    unit: "single-post-request" as const,
    unitMicros: 10,
    currency: "USD",
    retentionMs: 86400000,
    connectionSequence: 1,
    providerIdentity: "123",
    allocatedProviderLimitMicros: 1000,
    windows: [0.25, 1, 6, 24, 48] as (0.25 | 1 | 6 | 24 | 48)[],
    windowsEvidence: "Explicit synthetic five-window benefit and price consent",
  };
  await f.t.mutation(internal.performance.capabilities.configure, config);
  await expect(
    f.t.mutation(internal.performance.capabilities.configure, {
      ...config,
      windows: [24, 48],
    }),
  ).rejects.toThrow("VERSION_CONFLICT");
  await f.t.run(async (ctx) => {
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key: [
          "metrics:x",
          `metrics:workspace:${f.workspaceId}`,
          `metrics:account:${f.accountId}`,
        ][i],
        scope,
        ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
        ...(i === 2 ? { accountId: f.accountId } : {}),
        policyVersion: config.version,
        currency: "USD",
        purposes: ["own-metrics"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 1000,
        spentMicros: 0,
        heldMicros: 0,
      });
  });
  const acknowledged = (
    await f.signed.query(api.performance.snapshots.overview, f.args)
  ).configuration!;
  await expect(
    f.signed.mutation(api.performance.capabilities.consent, {
      ...f.args,
      enabled: true,
    }),
  ).rejects.toThrow("WINDOW_CONSENT_POLICY_CHANGED");
  await expect(
    f.signed.mutation(api.performance.capabilities.consent, {
      ...f.args,
      enabled: true,
      policyId: acknowledged.id,
      policyFingerprint: "stale",
    }),
  ).rejects.toThrow("WINDOW_CONSENT_POLICY_CHANGED");
  await f.signed.mutation(api.performance.capabilities.consent, {
    ...f.args,
    enabled: true,
    policyId: acknowledged.id,
    policyFingerprint: acknowledged.fingerprint,
  });
  const approvalId = await e.signed.mutation(api.editorial.approve, {
    ...f.args,
    versionId: e.request.draftVersionId,
  });
  const scheduleId = await e.signed.mutation(api.editorial.schedule, {
    ...f.args,
    versionId: e.request.draftVersionId,
    approvalId,
    at: Date.now() + 60000,
    timezone: "UTC",
    localTime: "2026-10-06T12:01",
  });
  vi.setSystemTime(Date.now() + 60000);
  await f.t.mutation(internal.publishing.claim, { scheduleId, generation: 1 });
  const first = await f.t.mutation(internal.publishing.attempts.claim, {
    scheduleId,
    generation: 1,
  });
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: first!._id,
    claimSequence: first!.claimSequence,
    credentialGeneration: 1,
    mediaIds: [],
  });
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: first!._id,
    claimSequence: first!.claimSequence,
    outcome: "confirmed",
    externalId: "101",
    durationMs: 1,
  });
  const rows = await f.t.run((ctx) =>
    ctx.db.query("performanceSnapshots").collect(),
  );
  expect(rows.map((r) => r.windowHours).sort((a, b) => a - b)).toEqual([
    0.25, 1, 6, 24, 48,
  ]);
  for (const r of rows)
    expect(r.dueAt - r.confirmedAt).toBe(r.windowHours * 3600000);
  const fifteen = rows.find((r) => r.windowHours === 0.25)!;
  vi.setSystemTime(fifteen.dueAt + 120000);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: "101",
              author_id: "123",
              created_at: "2026-10-06T12:01:00Z",
              public_metrics: { like_count: 0 },
            },
          }),
        ),
    ),
  );
  await f.t.action(internal.performance.collect.read, {
    snapshotId: fifteen._id,
    generation: fifteen.generation,
  });
  const actual = (
    await f.signed.query(api.performance.snapshots.overview, f.args)
  ).posts[0].snapshots.find((r) => r.windowHours === 0.25)!;
  expect(actual).toMatchObject({
    late: true,
    observedAgeMs: 17 * 60000,
    state: "observed",
  });
  expect(actual.fields).toMatchObject([
    { value: 0, status: "measured" },
    { value: null, status: "missing" },
  ]);
  expect(aggregate([actual], 1).covered).toBe(0);
});
test("TASK41 expired resumable cursor physically cleared by same native cleanup, original financial/job identity retained", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    for (const b of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(b._id, { expiresAt: Date.now() + 1000 });
  });
  const id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => page([row()], "opaque_next")),
  );
  await read(f, id);
  await f.signed.mutation(api.performance.history.manage, {
    workspaceId: f.workspaceId,
    jobId: id,
    operation: "pause",
  });
  const before = await f.t.run((ctx) => ctx.db.get(id));
  expect(before?.cursor).toBe("opaque_next");
  vi.setSystemTime(Date.now() + 1001);
  await f.t.mutation(internal.performance.history.expire, { jobs: true });
  const after = await f.t.run((ctx) => ctx.db.get(id));
  expect(after).toMatchObject({
    state: "blocked",
    reason: "OWN_HISTORY_PERMISSION_EXPIRED",
    cursor: null,
    seenCursors: [],
    policyId: before!.policyId,
    policyFingerprint: before!.policyFingerprint,
    sourceUntil: before!.sourceUntil,
  });
  expect(
    (await budgets(f)).every((b) => b.spentMicros === 10 && b.heldMicros === 0),
  ).toBe(true);
  await read(f, id);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("TASK41 wrong pre-send credential generation creates no funded attempt; timeout keeps unknown hold, later legitimate known quantity settles once without restoration", async () => {
  const f = await fixture(),
    id = await f.start(),
    j = (await f.t.run((ctx) => ctx.db.get(id)))!;
  vi.stubGlobal("fetch", vi.fn());
  expect(
    await f.t.mutation(internal.performance.history.begin, {
      jobId: id,
      generation: j.generation,
      credentialGeneration: 0,
    }),
  ).toBeNull();
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
  const fresh = await f.start(),
    job = (await f.t.run((ctx) => ctx.db.get(fresh)))!,
    send = await f.t.mutation(internal.performance.history.begin, {
      jobId: fresh,
      generation: job.generation,
      credentialGeneration: 1,
    });
  vi.setSystemTime(Date.now() + 20001);
  await f.t.mutation(internal.performance.history.timeout, {
    attemptId: send!.attemptId,
  });
  expect(
    (await budgets(f)).every((b) => b.heldMicros === 50 && b.spentMicros === 0),
  ).toBe(true);
  const receipt = {
    attemptId: send!.attemptId,
    ...normalizePage({ data: [row()], meta: { result_count: 1 } }, "123", 5),
  };
  await f.t.mutation(internal.performance.history.finish, receipt);
  await f.t.mutation(internal.performance.history.finish, receipt);
  expect(
    (await budgets(f)).every((b) => b.heldMicros === 0 && b.spentMicros === 10),
  ).toBe(true);
  expect((await view(f)).posts).toHaveLength(0);
  expect((await view(f)).jobs[0].state).toBe("unknown");
});
test("TASK41 explicit history consent must acknowledge exact priced/retained policy, stale/missing acknowledgement funds nothing", async () => {
  const f = await fixture();
  vi.stubGlobal("fetch", vi.fn());
  const approved = (await view(f)).policy!;
  await expect(
    f.signed.mutation(api.performance.history.start, {
      ...f.args,
      purpose: "own-history-analytics-context-v1",
      consent: true,
    }),
  ).rejects.toThrow("CONSENT_POLICY_CHANGED");
  await expect(
    f.signed.mutation(api.performance.history.start, {
      ...f.args,
      policyId: approved.id,
      policyFingerprint: "stale",
      purpose: "own-history-analytics-context-v1",
      consent: true,
    }),
  ).rejects.toThrow("CONSENT_POLICY_CHANGED");
  expect(
    (await budgets(f)).every((b) => b.heldMicros === 0 && b.spentMicros === 0),
  ).toBe(true);
  expect((await view(f)).jobs).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});
test("TASK41 captured and current credential horizon cannot be extended by token renewal; retained projection supplies expiry before cleanup", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const c = (await ctx.db.query("xCredentials").first())!;
    await ctx.db.patch(c._id, { expiresAt: Date.now() + 20000 });
  });
  const id = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => page([row()])),
  );
  await read(f, id);
  const until = (await view(f)).posts[0].sourceUntil;
  expect(until).toBe(Date.now() + 5000);
  await f.t.run(async (ctx) => {
    const c = (await ctx.db.query("xCredentials").first())!;
    await ctx.db.patch(c._id, {
      generation: 2,
      expiresAt: Date.now() + 86400000,
    });
  });
  expect((await view(f)).posts[0].sourceUntil).toBe(until);
  vi.setSystemTime(until + 1);
  expect((await view(f)).posts[0].text).toBeNull();
  await f.t.mutation(internal.performance.history.expire, {});
  expect((await view(f)).posts).toHaveLength(0);
});
