import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { mediaFixture } from "../../tests/media-fixture";
import { manifest } from "./algorithmProfiles";
const { check, evaluate, inspect } = api.intelligence.profileUpdates;
const { reserve } = internal.intelligence.profileUpdates;
const { create } = api.intelligence.algorithmProfiles;
const { change, get } = api.intelligence.profiles;
const old = "b412112d03f27acbfd668e0cc040abcafa1080c1";
const head = "e62790c99484b51424c2eccc488ed4e7517e8778";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function fixture() {
  const f = await mediaFixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "source-test",
      name: "Source test",
      handle: "@sources",
      connection: "disconnected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
        publish: false,
      },
    }),
  );
  const scope = { workspaceId: f.workspaceId, accountId };
  const profile = await f.signed.mutation(create, {
    ...scope,
    expectedRevision: 0,
    commandKey: crypto.randomUUID(),
    variant: "post-analysis",
  });
  return { ...f, scope, baseProfileId: profile.algorithmId! };
}
function transport(
  options: {
    sha?: string;
    status?: number;
    link?: string;
    compare?: Record<string, unknown>;
    rawFailure?: boolean;
    patch?: string;
  } = {},
) {
  const sha = options.sha ?? head;
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    expect(init.redirect).toBe("error");
    if (url.includes("commits/main"))
      return new Response(
        JSON.stringify({
          sha,
          commit: { committer: { date: "2026-10-06T04:59:30Z" } },
        }),
        {
          status: options.status ?? 200,
          headers: options.status === 429 ? { "retry-after": "3600" } : {},
        },
      );
    if (url.includes("/compare/")) {
      expect(url).toBe(
        `https://api.github.com/repos/xai-org/x-algorithm/compare/${old}...${sha}?per_page=100&page=1`,
      );
      return new Response(
        JSON.stringify({
          status: "ahead",
          total_commits: 1,
          ahead_by: 1,
          behind_by: 0,
          base_commit: { sha: old },
          merge_base_commit: { sha: old },
          commits: [{ sha }],
          files: [
            {
              filename: "README.md",
              status: "modified",
              patch: options.patch ?? "small change",
            },
          ],
          ...options.compare,
        }),
        { headers: { link: options.link ?? "" } },
      );
    }
    expect(url).toMatch(
      new RegExp(
        `^https://raw.githubusercontent.com/xai-org/x-algorithm/${sha}/`,
      ),
    );
    return new Response("synthetic public source bytes", {
      status: options.rawFailure ? 404 : 200,
    });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
async function independent(f: Awaited<ReturnType<typeof fixture>>) {
  const reviewer = await f.t.run(async (ctx) => {
    const { components } = await import("../_generated/api");
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Independent reviewer",
          email: "reviewer@example.test",
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
            userId: u._id,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        },
      },
    );
    const id = await ctx.db.insert("users", {
      authId: u._id,
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    });
    await ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId: id,
      role: "Admin",
    });
    return { subject: u._id, sessionId: session._id };
  });
  return {
    signed: f.t.withIdentity(reviewer),
    userId: await f.t
      .run((ctx) =>
        ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", reviewer.subject))
          .unique(),
      )
      .then((u) => u!._id),
  };
}
const input = (f: Awaited<ReturnType<typeof fixture>>, full = false) => ({
  ...f.scope,
  baseProfileId: f.baseProfileId,
  full,
  commandKey: crypto.randomUUID(),
});
test("unchanged check is factual, replay makes no I/O and does not touch selection/profile/paid state", async () => {
  const f = await fixture(),
    fetch = transport({ sha: old }),
    a = input(f);
  const before = await f.signed.query(get, f.scope);
  const receipt = await f.signed.action(check, a);
  expect(receipt.state).toBe("up_to_date");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await f.signed.action(check, a)).toEqual(receipt);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await f.signed.query(get, f.scope)).toEqual(before);
  expect(
    await f.t.run(async (ctx) => ({
      attempts: await ctx.db.query("aiAttempts").collect(),
      models: await ctx.db.query("calibrationModels").collect(),
      results: await ctx.db.query("jevAssessments").collect(),
    })),
  ).toEqual({ attempts: [], models: [], results: [] });
  await expect(f.signed.action(check, { ...a, full: true })).rejects.toThrow(
    "OPERATION_CONFLICT",
  );
  await expect(f.signed.action(check, input(f))).rejects.toThrow("COOLDOWN");
});
test("changed full observation uses all 13 actual hex digests, bounds excerpts, first-only link is complete, proposal dedupes", async () => {
  const f = await fixture(),
    fetch = transport({
      link: '<https://api.github.com/example?page=1>; rel="first"',
      patch: "x".repeat(4000),
    }),
    a = input(f);
  const before = await f.signed.query(get, f.scope),
    receipt = await f.signed.action(check, a);
  expect(receipt.state).toBe("proposed");
  expect(receipt.requests).toBe(15);
  expect(fetch).toHaveBeenCalledTimes(15);
  expect(receipt.observation!.complete).toBe(true);
  expect(
    receipt.observation!.evidence.map((e: { path: string }) => e.path),
  ).toEqual(manifest.map((x) => x[0]));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("synthetic public source bytes"),
  );
  expect(receipt.observation!.evidence[0].sha256).toBe(
    Array.from(new Uint8Array(digest), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join(""),
  );
  expect(receipt.observation!.changes[0].patchState).toBe("clipped");
  expect(receipt.observation!.changes[0].patch.length).toBe(2000);
  expect(await f.signed.query(get, f.scope)).toEqual(before);
  vi.advanceTimersByTime(600001);
  const repeat = await f.signed.action(check, input(f));
  expect(repeat.proposalId).toBe(receipt.proposalId);
  expect(await f.signed.action(check, a)).toEqual(receipt);
});
test.each([
  {
    name: "next page",
    options: { link: '<https://api.github.com/example?page=2>; rel="next"' },
  },
  {
    name: "300 paths",
    options: {
      compare: {
        files: Array.from({ length: 300 }, (_, i) => ({
          filename: `file-${i}`,
          status: "modified",
        })),
      },
    },
  },
  { name: "count mismatch", options: { compare: { total_commits: 2 } } },
  { name: "diverged", options: { compare: { status: "diverged" } } },
  {
    name: "wrong base",
    options: { compare: { merge_base_commit: { sha: head } } },
  },
])("$name structurally prevents a proposal", async ({ options }) => {
  const f = await fixture();
  transport(options);
  const r = await f.signed.action(check, input(f));
  expect(r.state).toBe("incomplete");
  expect(r.proposalId).toBeNull();
  expect(r.observation!.complete).toBe(false);
});
test("rates/failures never claim freshness; failed bytes counted and bounded backoff enforced", async () => {
  const f = await fixture(),
    fetch = transport({ status: 429 });
  const r = await f.signed.action(check, input(f));
  expect(r.state).toBe("rate_limited");
  expect(r.bytes).toBeGreaterThan(0);
  expect(r.notBefore).toBe(Date.now() + 3600000);
  vi.advanceTimersByTime(600001);
  await expect(f.signed.action(check, input(f))).rejects.toThrow("COOLDOWN");
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(3000000);
  transport({ status: 404 });
  const failed = await f.signed.action(check, input(f));
  expect(failed.state).toBe("failed");
});
test("pre-I/O actor/scope rejection, concurrent cooldown and stale pending inspection", async () => {
  const f = await fixture(),
    fetch = transport();
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(m!._id, { role: "Editor" });
  });
  await expect(f.signed.action(check, input(f))).rejects.toThrow(
    "ROLE_ACCESS_DENIED",
  );
  expect(fetch).not.toHaveBeenCalled();
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(m!._id, { role: "Owner" });
  });
  const a = input(f),
    first = await f.signed.mutation(reserve, a);
  expect(first.admitted).toBe(true);
  expect((await f.signed.mutation(reserve, a)).admitted).toBe(false);
  await expect(f.signed.mutation(reserve, input(f))).rejects.toThrow(
    "COOLDOWN",
  );
  vi.advanceTimersByTime(45001);
  const stale = await f.signed.mutation(inspect, {
    ...f.scope,
    checkId: first.check._id,
  });
  expect(stale.state).toBe("unknown");
  expect((await f.signed.action(check, a)).state).toBe("unknown");
  expect(fetch).not.toHaveBeenCalled();
});
test("full same-SHA refresh from expired base makes fresh immutable observation; exact replay never renews", async () => {
  const f = await fixture();
  transport({ sha: old });
  const a = input(f, true),
    r = await f.signed.action(check, a);
  expect(r.state).toBe("proposed");
  expect(r.requests).toBe(14);
  const original = await f.t.run((ctx) => ctx.db.get(f.baseProfileId));
  vi.advanceTimersByTime(600001);
  expect((await f.signed.action(check, input(f, true))).proposalId).toBe(
    r.proposalId,
  );
  await f.t.run(async (ctx) => {
    const { components } = await import("../_generated/api");
    const sessions = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      { model: "session", paginationOpts: { numItems: 100, cursor: null } },
    );
    for (const session of sessions.page)
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "session",
          where: [{ field: "_id", value: session._id }],
          update: { expiresAt: Date.now() + 30 * 86400000 },
        },
      });
  });
  vi.advanceTimersByTime(7 * 86400000);
  const renewed = await f.signed.action(check, input(f, true));
  expect(renewed.proposalId).not.toBe(r.proposalId);
  expect(await f.signed.action(check, a)).toEqual(r);
  expect(await f.t.run((ctx) => ctx.db.get(f.baseProfileId))).toEqual(original);
});
test("human attestation and native evaluation gate draft/review separately; current evaluator loss invalidates selection", async () => {
  const f = await fixture();
  transport();
  const receipt = await f.signed.action(check, input(f));
  const evaluator = await independent(f);
  const ea = {
    ...f.scope,
    proposalId: receipt.proposalId!,
    commandKey: crypto.randomUUID(),
    variant: "post-analysis" as const,
    interpretation: "Reviewed public source changes",
    impact: "Source context only; Dispatch refs unchanged",
    rationale: "Full immutable compare and all evidence files inspected",
    fullSourceReview: true,
  };
  await expect(
    evaluator.signed.mutation(evaluate, { ...ea, fullSourceReview: false }),
  ).rejects.toThrow("SOURCE_REVIEW_REQUIRED");
  const evaluationId = await evaluator.signed.mutation(evaluate, ea);
  const ev = await f.t.run((ctx) => ctx.db.get(evaluationId));
  expect(ev!.kind).toBe("evaluation");
  if (!ev || ev.kind !== "evaluation") throw new Error();
  expect(ev.reference.passed).toBe(true);
  expect(ev.reference.outcomes.map((x) => x.outcome)).toEqual([
    "success",
    "low_confidence",
    "invalid_response",
  ]);
  const revision = (await f.signed.query(get, f.scope)).capture.revision;
  const draft = await f.signed.mutation(create, {
    ...f.scope,
    expectedRevision: revision,
    commandKey: crypto.randomUUID(),
    variant: "post-analysis",
    proposalId: receipt.proposalId!,
    evaluationId,
  });
  await expect(
    evaluator.signed.mutation(change, {
      ...f.scope,
      expectedRevision: draft.revision,
      commandKey: crypto.randomUUID(),
      action: {
        kind: "review-algorithm",
        algorithmId: draft.algorithmId!,
        reason: "Same evaluator cannot certify review",
      },
    }),
  ).rejects.toThrow("SOURCE_REVIEW_REQUIRED");

  const signed = f.signed;
  const reviewed = await signed.mutation(change, {
    ...f.scope,
    expectedRevision: draft.revision,
    commandKey: crypto.randomUUID(),
    action: {
      kind: "review-algorithm",
      algorithmId: draft.algorithmId!,
      reason: "Independent human source review",
    },
  });
  await signed.mutation(change, {
    ...f.scope,
    expectedRevision: reviewed.revision,
    commandKey: crypto.randomUUID(),
    action: {
      kind: "select",
      algorithmId: draft.algorithmId!,
      audienceId: null,
      reason: "Explicit source selection",
    },
  });
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", evaluator.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(m!._id, { role: "Viewer" });
  });
  const after = await signed.query(get, f.scope);
  expect(after.capture.missing).toContain("algorithm-review");
  await expect(
    signed.mutation(change, {
      ...f.scope,
      expectedRevision: after.capture.revision,
      commandKey: crypto.randomUUID(),
      action: {
        kind: "rollback",
        algorithmId: draft.algorithmId!,
        audienceId: null,
        reason: "Withdrawn evaluator must not resurrect",
      },
    }),
  ).rejects.toThrow("CURRENT_REVIEW_REQUIRED");
});
test.each([
  "raw-missing",
  "oversized-json",
  "oversized-raw",
  "redirect",
  "network",
])("%s never creates a structurally incomplete candidate", async (kind) => {
  const f = await fixture(),
    normal = transport();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (kind === "network") throw new Error("synthetic network failure");
      if (kind === "redirect") return new Response("redirect", { status: 302 });
      if (kind === "oversized-json" && url.includes("commits/main"))
        return new Response("x".repeat(2 * 1024 * 1024 + 1));
      if (url.includes("raw.githubusercontent.com")) {
        if (kind === "raw-missing")
          return new Response("deleted raw source", { status: 404 });
        if (kind === "oversized-raw")
          return new Response("x".repeat(1024 * 1024 + 1));
      }
      return normal(url, init);
    }),
  );
  const r = await f.signed.action(check, input(f));
  expect(["failed", "incomplete"]).toContain(r.state);
  expect(r.proposalId).toBeNull();
  if (kind.startsWith("oversized"))
    expect(r.bytes).toBeGreaterThan(1024 * 1024);
  if (r.observation) expect(r.observation.complete).toBe(false);
});
test("authority withdrawal during public I/O retains unknown receipt, hides late observation and changes no selection", async () => {
  const f = await fixture(),
    original = await f.signed.query(get, f.scope),
    normal = transport();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("commits/main"))
        await f.t.run(async (ctx) => {
          const m = await ctx.db
            .query("memberships")
            .withIndex("by_userId_and_workspaceId", (q) =>
              q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
            )
            .unique();
          await ctx.db.patch(m!._id, { role: "Viewer" });
        });
      return normal(url, init);
    }),
  );
  await expect(f.signed.action(check, input(f))).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
  const records = await f.t.run((ctx) =>
    ctx.db.query("intelligenceSourceUpdates").collect(),
  );
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    kind: "check",
    state: "unknown",
    error: "authority_or_base_changed",
    observation: null,
    proposalId: null,
  });
  expect(await f.signed.query(get, f.scope)).toEqual(original);
});
test("concurrent exact-key check replays pending without a second physical transport", async () => {
  const f = await fixture(),
    normal = transport(),
    a = input(f);
  let release!: () => void, reached!: () => void;
  const paused = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      reached = resolve;
    });
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes("commits/main")) {
      reached();
      await paused;
    }
    return normal(url, init);
  });
  vi.stubGlobal("fetch", fetch);
  const running = f.signed.action(check, a);
  await started;
  const replay = await f.signed.action(check, a);
  expect(replay.state).toBe("pending");
  expect(fetch).toHaveBeenCalledTimes(1);
  release();
  const result = await running;
  expect(result._id).toBe(replay._id);
  expect(result.state).toBe("proposed");
  expect(fetch).toHaveBeenCalledTimes(15);
});
test("informational regression remains non-executable and wrong evaluation variant/direct structural attestation are rejected", async () => {
  const f = await fixture(),
    evaluator = await independent(f);
  transport();
  const receipt = await f.signed.action(check, input(f));
  const evaluationId = await evaluator.signed.mutation(evaluate, {
    ...f.scope,
    proposalId: receipt.proposalId!,
    commandKey: "information-evaluation",
    variant: "public-context",
    interpretation: "Human-reviewed informational source context",
    impact: "No question execution or Dispatch score change",
    rationale: "Full comparison and every fixed evidence path reviewed",
    fullSourceReview: true,
  });
  const ev = await f.t.run((ctx) => ctx.db.get(evaluationId));
  expect(ev).toMatchObject({
    kind: "evaluation",
    reference: {
      passed: true,
      outcomes: [
        { case: "informational", outcome: "non_executable", aggregate: null },
      ],
    },
  });
  await expect(
    f.signed.mutation(create, {
      ...f.scope,
      expectedRevision: 1,
      commandKey: "wrong-evaluation-variant",
      proposalId: receipt.proposalId!,
      evaluationId,
      variant: "post-analysis",
    }),
  ).rejects.toThrow("SOURCE_REVIEW_REQUIRED");
  const draft = await f.signed.mutation(create, {
    ...f.scope,
    expectedRevision: 1,
    commandKey: "information-source-draft",
    proposalId: receipt.proposalId!,
    evaluationId,
    variant: "public-context",
  });
  const row = await f.t.run((ctx) => ctx.db.get(draft.algorithmId!));
  expect(row?.payload).toMatchObject({
    version: "x-public-context-v1",
    scoringInfluence: "none",
    refs: { questionSet: "unavailable-until-task28" },
  });
  vi.advanceTimersByTime(600001);
  transport({ compare: { status: "behind" } });
  const incomplete = await f.signed.action(check, input(f));
  await expect(
    evaluator.signed.mutation(evaluate, {
      ...f.scope,
      proposalId: incomplete._id,
      commandKey: "structural-override-rejected",
      variant: "public-context",
      interpretation: "Attempted override",
      impact: "None",
      rationale: "Human review cannot override acquisition gaps",
      fullSourceReview: true,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
});
test("normal 103-path comparison passes structure despite the 32KiB total excerpt ceiling", async () => {
  const f = await fixture();
  transport({
    compare: {
      files: Array.from({ length: 103 }, (_, i) => ({
        filename: `home-mixer/source-${i}.rs`,
        status: "modified",
        patch: "x".repeat(6000),
      })),
    },
  });
  const r = await f.signed.action(check, input(f));
  expect(r.state).toBe("proposed");
  expect(r.observation!.changes).toHaveLength(103);
  expect(r.observation!.evidence).toHaveLength(13);
  expect(r.observation!.changes.every((c) => c.patchState === "clipped")).toBe(
    true,
  );
  expect(
    r.observation!.changes.reduce(
      (sum, c) => sum + new TextEncoder().encode(c.patch).length,
      0,
    ),
  ).toBeLessThanOrEqual(32768);
  expect(r.bytes).toBeGreaterThan(500000);
});
test("proven 403 rate limit retains bounded reset and late overall deadline cannot report freshness", async () => {
  const f = await fixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("rate limited", {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String((Date.now() + 3 * 86400000) / 1000),
          },
        }),
    ),
  );
  const rate = await f.signed.action(check, input(f));
  expect(rate.state).toBe("rate_limited");
  expect(rate.notBefore).toBe(Date.now() + 86400000);
  expect(rate.bytes).toBe(12);
  vi.advanceTimersByTime(86400001);
  // Restore the isolated auth fixture's session after the synthetic one-day time jump.
  await f.t.run(async (ctx) => {
    const { components } = await import("../_generated/api");
    const sessions = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      { model: "session", paginationOpts: { numItems: 10, cursor: null } },
    );
    for (const session of sessions.page)
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "session",
          where: [{ field: "_id", value: session._id }],
          update: { expiresAt: Date.now() + 86400000 },
        },
      });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      vi.advanceTimersByTime(45001);
      return new Response(
        JSON.stringify({
          sha: old,
          commit: { committer: { date: "2026-10-06T04:59:30Z" } },
        }),
      );
    }),
  );
  const late = await f.signed.action(check, input(f));
  expect(late.state).toBe("unknown");
  expect(late.proposalId).toBeNull();
  expect(late.requests).toBe(1);
  expect(late.bytes).toBeGreaterThan(0);
});

test("pending new-head replay cannot let caller keys occupy the server proposal namespace", async () => {
  const f = await fixture();
  transport();
  const first = await f.signed.action(check, input(f));
  vi.advanceTimersByTime(600001);
  const nextHead = "a".repeat(40),
    nextInput = input(f);
  const actual = transport({ sha: nextHead });
  let release!: () => void, reached!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const physical = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith("/commits/main")) {
      reached();
      await paused;
    }
    return actual(url, init);
  });
  vi.stubGlobal("fetch", physical);
  const running = f.signed.action(check, nextInput);
  await started;
  const pending = await f.signed.action(check, nextInput);
  expect(pending.state).toBe("pending");
  expect(physical).toHaveBeenCalledTimes(1);
  const futureKey = `proposal-${pending._id}`;
  const evaluation = {
    ...f.scope,
    proposalId: first.proposalId!,
    commandKey: crypto.randomUUID(),
    variant: "post-analysis" as const,
    interpretation: "Reviewed public source changes",
    impact: "Source context only",
    rationale: "Reviewed full comparison and all thirteen paths",
    fullSourceReview: true,
  };
  let completed!: Awaited<typeof running>, evaluationId: string | undefined;
  try {
    const before = await f.t.run((ctx) =>
      ctx.db.query("intelligenceSourceUpdates").collect(),
    );
    await expect(
      f.signed.mutation(evaluate, { ...evaluation, commandKey: futureKey }),
    ).rejects.toThrow("COMMAND_INVALID");
    await expect(
      f.signed.action(check, { ...nextInput, commandKey: futureKey }),
    ).rejects.toThrow("COMMAND_INVALID");
    expect(
      await f.t.run((ctx) =>
        ctx.db.query("intelligenceSourceUpdates").collect(),
      ),
    ).toEqual(before);
    expect(physical).toHaveBeenCalledTimes(1);
    evaluationId = await f.signed.mutation(evaluate, evaluation);
    expect(await f.signed.mutation(evaluate, evaluation)).toBe(evaluationId);
  } finally {
    release();
    completed = await running;
  }
  expect(completed.state).toBe("proposed");
  expect(completed.observation!.commit).toBe(nextHead);
  expect(completed.proposalId).not.toBe(first.proposalId);
  expect(await f.signed.action(check, nextInput)).toEqual(completed);
  expect(await f.signed.mutation(evaluate, evaluation)).toBe(evaluationId);
  const generated = await f.t.run((ctx) =>
    ctx.db
      .query("intelligenceSourceUpdates")
      .withIndex("by_command", (q) =>
        q
          .eq("workspaceId", f.workspaceId)
          .eq("accountId", f.scope.accountId)
          .eq("actorId", f.userId)
          .eq("commandKey", futureKey),
      )
      .unique(),
  );
  expect(generated?.kind).toBe("proposal");
  expect(generated?._id).toBe(completed.proposalId);
  expect(physical).toHaveBeenCalledTimes(15);
  expect((await f.signed.query(get, f.scope)).capture.revision).toBe(1);
});
