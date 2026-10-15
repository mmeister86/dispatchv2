import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { fixture } from "../../tests/research-fixture";
import { internal } from "../_generated/api";
import { quietWindow } from "./time";
const query = makeFunctionReference<"query">("preferences:researchSummaries");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
test("quiet overlap waits for the later end and missing end resumes after gap", () => {
  expect(
    quietWindow(
      { timezone: "Europe/Berlin", quiet: { start: "01:00", end: "02:30" } },
      Date.parse("2026-10-25T00:45Z"),
    ).availableAt,
  ).toBe(Date.parse("2026-10-25T01:30Z"));
  expect(
    quietWindow(
      { timezone: "Europe/Berlin", quiet: { start: "01:00", end: "02:30" } },
      Date.parse("2026-03-29T00:45Z"),
    ).availableAt,
  ).toBe(Date.parse("2026-03-29T01:00Z"));
});
test("real native finish admits once only after own opt-in and retains original finite clock", async () => {
  vi.useFakeTimers();
  const f = await fixture(["web-search"]);
  const p = await f.t.run((ctx) => ctx.db.query("preferences").first());
  await f.t.run((ctx) =>
    ctx.db.patch(p!._id, {
      notifications: {
        revision: 1,
        email: false,
        weekly: false,
        research: true,
        inAppSummaries: true,
        timezone: "UTC",
        quiet: null,
      },
    }),
  );
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const first = await f.t.run((ctx) => ctx.db.get(p!._id));
  expect(first?.researchSummaries).toHaveLength(1);
  expect(first?.researchSummaries?.[0].deadline).toBeLessThanOrEqual(
    Date.now() + 26 * 3600000,
  );
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(p!._id)))?.researchSummaries,
  ).toEqual(first?.researchSummaries);
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const response = await f.signed.query(query, {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    expectedSessionId: (await f.signed.run((ctx) =>
      ctx.auth.getUserIdentity(),
    ))!.sessionId,
    requestKey: "original",
  });
  expect(response.rows[0].outcome).toBe("failed");
  expect(response.requestKey).toBe("original");
});

const save = makeFunctionReference<"mutation">("preferences:saveNotifications");
const dismiss = makeFunctionReference<"mutation">(
  "preferences:dismissResearchSummaries",
);
async function opted(
  operations: Parameters<typeof fixture>[0] = ["web-search"],
) {
  const f = await fixture(operations);
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    requestKey: "own",
  };
  const settings = {
    email: false,
    weekly: false,
    inAppSummaries: true,
    research: true,
    timezone: "UTC",
    quiet: null,
  };
  await f.signed.mutation(save, { ...args, expectedRevision: 0, settings });
  const sessionId = (await f.signed.run((ctx) => ctx.auth.getUserIdentity()))!
    .sessionId;
  return {
    ...f,
    args,
    summaryArgs: { ...args, expectedSessionId: sessionId },
    settings,
  };
}
test("OFF, five original entries, observed-only dismissal, and ON replay cannot resurrect", async () => {
  vi.useFakeTimers();
  const f = await opted();
  const ids = [];
  for (let i = 0; i < 6; i++) {
    const orderId = await f.start(`finish-${i}`);
    ids.push(orderId);
    await f.t.mutation(internal.research.native.finish, {
      orderId,
      generation: 1,
    });
  }
  const response = await f.signed.query(query, f.summaryArgs);
  expect(response.rows).toHaveLength(5);
  expect(response.coverage).toBe("bounded_unknown");
  await f.signed.mutation(dismiss, {
    ...f.summaryArgs,
    observed: [
      {
        orderId: ids[0],
        generation: 2,
        finishedAt: response.rows[0].finishedAt,
      },
    ],
  });
  expect((await f.signed.query(query, f.summaryArgs)).rows).toHaveLength(5);
  await f.signed.mutation(dismiss, {
    ...f.summaryArgs,
    observed: [
      {
        orderId: ids[0],
        generation: 1,
        finishedAt: response.rows[0].finishedAt,
      },
    ],
  });
  expect((await f.signed.query(query, f.summaryArgs)).rows).toHaveLength(4);
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 1,
    settings: { ...f.settings, research: false },
  });
  expect(
    (await f.t.run((ctx) => ctx.db.query("preferences").first()))
      ?.researchSummaries,
  ).toBeUndefined();
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 2,
    settings: f.settings,
  });
  for (const orderId of ids)
    await f.t.mutation(internal.research.native.finish, {
      orderId,
      generation: 1,
    });
  expect((await f.signed.query(query, f.summaryArgs)).rows).toEqual([]);
});
test("policy loss masks immediately and native expiry physically deletes original references", async () => {
  vi.useFakeTimers();
  const f = await opted();
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!,
    r = p.researchSummaries![0];
  await f.t.run((ctx) => ctx.db.patch(f.policies[0], { enabled: false }));
  expect((await f.signed.query(query, f.summaryArgs)).rows).toEqual([]);
  vi.setSystemTime(r.deadline);
  await f.t.mutation(internal.preferences.expireResearchSummary, {
    preferenceId: p._id,
    orderId,
    finishedAt: r.finishedAt,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(p._id)))?.researchSummaries,
  ).toBeUndefined();
});
test("quiet callbacks use original clocks and revision fencing", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-08T21:00Z"));
  const f = await opted();
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 1,
    settings: { ...f.settings, quiet: { start: "20:00", end: "08:00" } },
  });
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!,
    r = p.researchSummaries![0];
  expect((await f.signed.query(query, f.summaryArgs)).rows).toEqual([]);
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 2,
    settings: f.settings,
  });
  await f.t.mutation(internal.preferences.releaseResearchSummary, {
    preferenceId: p._id,
    orderId,
    epoch: p.summaryEpoch ?? 0,
  });
  const next = (await f.t.run((ctx) => ctx.db.get(p._id)))!;
  expect(next.researchSummaries![0].deadline).toBe(r.deadline);
  expect(next.researchSummaries![0].availableAt).toBe(Date.now());
  expect((await f.signed.query(query, f.summaryArgs)).rows).toHaveLength(1);
});

import { pipelineFixture, streamResponse } from "../../tests/research-fixture";
test("real pipeline finish and delivered native source support retained proof beyond execution deadline", async () => {
  vi.useFakeTimers();
  const f = await pipelineFixture();
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!,
    sessionId = (await f.signed.run((ctx) => ctx.auth.getUserIdentity()))!
      .sessionId;
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    requestKey: "pipeline",
  };
  await f.signed.mutation(save, {
    ...args,
    expectedRevision: 0,
    settings: {
      email: false,
      weekly: false,
      inAppSummaries: true,
      research: true,
      timezone: "UTC",
      quiet: null,
    },
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(streamResponse([]));
  const orderId = await f.start(),
    a = { orderId, generation: 1 };
  await f.t.mutation(internal.ai.researchTools.reserve, a);
  await f.t.mutation(internal.ai.researchTools.prepare, a);
  await f.t.action(internal.research.execute.operation, {
    ...a,
    operation: "web-search",
  });
  for (const fn of [
    internal.ai.researchTools.select,
    internal.ai.researchTools.bindModel,
    internal.ai.researchTools.cluster,
    internal.ai.researchTools.assess,
    internal.ai.researchTools.evidence,
    internal.ai.researchTools.inbox,
  ])
    await f.t.mutation(fn, a);
  const producer = await f.t.run(async (ctx) => {
    await ctx.runMutation(internal.ai.researchTools.finish, a);
    return ctx.meta.getTransactionMetrics();
  });
  console.info("summary-pipeline-producer", JSON.stringify(producer));
  expect(producer.documentsRead.used).toBeLessThan(1000);
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockRestore();
  const result = await f.signed.query(query, {
    ...args,
    expectedSessionId: sessionId,
  });
  expect(result.rows[0].outcome).toBe("empty");
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  await f.t.run((ctx) => ctx.db.patch(orderId, { deadline: Date.now() - 1 }));
  expect(
    (await f.signed.query(query, { ...args, expectedSessionId: sessionId }))
      .rows,
  ).toHaveLength(1);
  expect((await f.t.run((ctx) => ctx.db.get(orderId)))?.finishedAt).toBe(
    o.finishedAt,
  );
});
test("five real producer/query workload is bounded and has zero extra provider IO", async () => {
  vi.useFakeTimers();
  const f = await opted(),
    fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
  for (let i = 0; i < 5; i++) {
    const orderId = await f.start(`actual-${i}`),
      a = { orderId, generation: 1, operation: "web-search" as const };
    await f.t.action(internal.research.execute.execute, {
      orderId,
      generation: 1,
    });
  }
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockRestore();
  const forbidden = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(Error("No provider IO"));
  const result = await f.signed.run(async (ctx) => ({
    response: await ctx.runQuery(query, f.summaryArgs),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(result.response.rows).toHaveLength(5);
  expect(result.metrics.documentsRead.used).toBeLessThan(1000);
  expect(result.metrics.documentsWritten.used).toBe(0);
  expect(
    new TextEncoder().encode(JSON.stringify(result.response)).byteLength,
  ).toBeLessThan(65536);
  expect(forbidden).not.toHaveBeenCalled();
  console.info("summary-five-real", JSON.stringify(result.metrics));
  forbidden.mockRestore();
});
test("orphan preference cleanup drains more than a page without live proof blocking expired references", async () => {
  vi.useFakeTimers();
  const f = await opted(),
    orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!,
    r = p.researchSummaries![0];
  await f.t.run(async (ctx) => {
    await ctx.db.delete(f.workspaceId);
    for (let i = 0; i < 22; i++) {
      const { _id, _creationTime, ...row } = p;
      await ctx.db.insert("preferences", row);
    }
  });
  await f.t.mutation(internal.preferences.sweepResearchSummaries, {
    cursor: null,
  });
  // Continuations and scrub callbacks run before frozen original deadline.
  await f.t.finishInProgressScheduledFunctions();
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1), 100);
  expect(
    await f.t.run(async (ctx) =>
      (await ctx.db.query("preferences").collect()).some(
        (p) => p.researchSummaries?.length,
      ),
    ),
  ).toBe(false);
});
test("invalid finite entry clock propagates without cleanup cursor success or payload disclosure", async () => {
  vi.useFakeTimers();
  const f = await opted(),
    orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  await f.t.run((ctx) =>
    ctx.db.patch(p._id, {
      researchSummaries: p.researchSummaries!.map((r) => ({
        ...r,
        deadline: Infinity,
      })),
    }),
  );
  await expect(f.signed.query(query, f.summaryArgs)).rejects.toThrow(
    "RESEARCH_SUMMARY_CLOCK_INVALID",
  );
  await expect(
    f.t.mutation(internal.preferences.sweepResearchSummaries, { cursor: null }),
  ).rejects.toThrow("RESEARCH_SUMMARY_CLOCK_INVALID");
  expect(
    (await f.t.run((ctx) => ctx.db.get(p._id)))?.researchSummaries?.[0]
      .deadline,
  ).toBe(Infinity);
});

test("same-day quiet boundary and DST missing start expire cached proof before quiet begins", () => {
  expect(
    quietWindow(
      { timezone: "UTC", quiet: { start: "20:00", end: "21:00" } },
      Date.parse("2026-10-08T19:59:59Z"),
    ).boundary,
  ).toBe(Date.parse("2026-10-08T20:00Z"));
  expect(
    quietWindow(
      { timezone: "Europe/Berlin", quiet: { start: "02:30", end: "04:00" } },
      Date.parse("2026-03-29T00:50Z"),
    ).boundary,
  ).toBe(Date.parse("2026-03-29T01:00Z"));
});
test("missing preferences never backfill and exact session mismatches reject own summary mutations", async () => {
  vi.useFakeTimers();
  const f = await fixture(["web-search"]),
    orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  expect(p.researchSummaries).toBeUndefined();
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!,
    args = {
      workspaceId: f.workspaceId,
      expectedAuthId: user.authId,
      expectedSessionId: "wrong",
      requestKey: "session",
    };
  await expect(f.signed.query(query, args)).rejects.toThrow(
    "NOTIFICATION_SCOPE_CHANGED",
  );
  await expect(
    f.signed.mutation(dismiss, { ...args, observed: [] }),
  ).rejects.toThrow("NOTIFICATION_SCOPE_CHANGED");
});

import { ConvexError } from "convex/values";
import * as sourceAccess from "./providerAccess";
test.each([
  new Error("native resource failure"),
  new ConvexError("RESEARCH_PROOF_ANCESTRY_LIMIT"),
  new ConvexError("STYLE_ANCESTRY_LIMIT"),
])(
  "unexpected and ancestry proof failures roll back genuine completion: %s",
  async (failure) => {
    vi.useFakeTimers();
    const f = await opted(),
      orderId = await f.start();
    const proof = vi
      .spyOn(sourceAccess, "sourceAuthority")
      .mockRejectedValue(failure);
    await expect(
      f.t.mutation(internal.research.native.finish, { orderId, generation: 1 }),
    ).rejects.toThrow();
    expect((await f.t.run((ctx) => ctx.db.get(orderId)))?.state).toBe("queued");
    expect(
      (await f.t.run((ctx) => ctx.db.query("preferences").first()))
        ?.researchSummaries,
    ).toBeUndefined();
    proof.mockRestore();
  },
);

test.each(["cache", "source", "cache-sources"] as const)(
  "actual delivered completion masks and scrubs lost %s",
  async (loss) => {
    vi.useFakeTimers();
    const f = await opted();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamResponse());
    const orderId = await f.start();
    await f.t.action(internal.research.execute.execute, {
      orderId,
      generation: 1,
    });
    expect((await f.signed.query(query, f.summaryArgs)).rows[0].outcome).toBe(
      "completed",
    );
    const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!,
      cacheId = o.native!.cacheIds[0]!;
    await f.t.run(async (ctx) => {
      const c = (await ctx.db.get(cacheId))!;
      if (loss === "cache") await ctx.db.delete(cacheId);
      else if (loss === "source") await ctx.db.delete(c.sourceIds[0]);
      else await ctx.db.patch(cacheId, { sourceIds: [] });
    });
    expect((await f.signed.query(query, f.summaryArgs)).rows).toEqual([]);
    const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
    await f.t.mutation(internal.preferences.scrubResearchSummaries, {
      preferenceId: p._id,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(p._id)))?.researchSummaries,
    ).toBeUndefined();
    fetch.mockRestore();
  },
);
test("actual material partial native outcome remains partial", async () => {
  vi.useFakeTimers();
  const f = await opted();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(streamResponse());
  const orderId = await f.start();
  await f.t.action(internal.research.execute.execute, {
    orderId,
    generation: 1,
  });
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  await f.t.run((ctx) =>
    ctx.db.patch(orderId, {
      native: {
        ...o.native!,
        outcomes: o.native!.outcomes.map((x) => ({
          ...x,
          state: "partial" as const,
        })),
      },
    }),
  );
  expect((await f.signed.query(query, f.summaryArgs)).rows[0].outcome).toBe(
    "partial",
  );
  fetch.mockRestore();
});
test("real native team actor hook drains own summary references beyond one page", async () => {
  vi.useFakeTimers();
  const f = await opted();
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 55; i++) {
      const { _id, _creationTime, ...row } = p;
      await ctx.db.insert("preferences", row);
    }
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.delete(m!._id);
  });
  await f.t.mutation(internal.team.purgeActor, { actorId: f.userId });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1), 100);
  expect(
    await f.t.run(async (ctx) =>
      (await ctx.db.query("preferences").collect()).some(
        (p) => p.researchSummaries?.length,
      ),
    ),
  ).toBe(false);
});

test("actual native executor mixed material and unknown transport outcome displays partial", async () => {
  vi.useFakeTimers();
  const f = await opted(["x-recent", "web-search"]);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      String(url).includes("api.x.com")
        ? new Response("unavailable", { status: 503 })
        : streamResponse(),
    );
  const orderId = await f.start();
  await f.t.action(internal.research.execute.execute, {
    orderId,
    generation: 1,
  });
  const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
  expect(o.native!.outcomes.map((x) => x.state)).toEqual([
    "unknown",
    "completed",
  ]);
  expect((await f.signed.query(query, f.summaryArgs)).rows[0].outcome).toBe(
    "partial",
  );
  fetch.mockRestore();
});

test("native pre-quiet release schedules quiet-start then quiet-end without renewing originals", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-08T19:59Z"));
  const f = await opted();
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 1,
    settings: { ...f.settings, quiet: { start: "20:00", end: "21:00" } },
  });
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const initial = (await f.t.run((ctx) =>
      ctx.db.query("preferences").first(),
    ))!,
    original = initial.researchSummaries![0],
    a = {
      preferenceId: initial._id,
      orderId,
      epoch: initial.summaryEpoch ?? 0,
    };
  await f.t.mutation(internal.preferences.releaseResearchSummary, a);
  const before = (await f.t.run((ctx) => ctx.db.get(initial._id)))!;
  const startJob = (await f.t.run((ctx) =>
    ctx.db.system.get(before.researchSummaries![0].job),
  ))!;
  expect(startJob.scheduledTime).toBe(Date.parse("2026-10-08T20:00Z"));
  expect(before.researchSummaries![0].availableAt).toBe(Date.now());
  vi.setSystemTime(startJob.scheduledTime);
  await f.t.mutation(
    internal.preferences.releaseResearchSummary,
    startJob.args[0] as typeof a,
  );
  expect((await f.signed.query(query, f.summaryArgs)).rows).toEqual([]);
  const quiet = (await f.t.run((ctx) => ctx.db.get(initial._id)))!,
    endJob = (await f.t.run((ctx) =>
      ctx.db.system.get(quiet.researchSummaries![0].job),
    ))!;
  expect(endJob.scheduledTime).toBe(Date.parse("2026-10-08T21:00Z"));
  vi.setSystemTime(endJob.scheduledTime);
  await f.t.mutation(
    internal.preferences.releaseResearchSummary,
    endJob.args[0] as typeof a,
  );
  const after = (await f.t.run((ctx) => ctx.db.get(initial._id)))!;
  expect(after.researchSummaries![0].finishedAt).toBe(original.finishedAt);
  expect(after.researchSummaries![0].deadline).toBe(original.deadline);
  expect(after.researchSummaries![0].expiryJob).toBe(original.expiryJob);
  expect((await f.signed.query(query, f.summaryArgs)).rows).toHaveLength(1);
});

test.each([
  {
    now: "2026-10-08T20:01Z",
    timezone: "UTC",
    start: "20:00",
    end: "21:00",
    wake: "2026-10-08T21:00Z",
  },
  {
    now: "2026-03-29T00:45Z",
    timezone: "Europe/Berlin",
    start: "01:00",
    end: "02:30",
    wake: "2026-03-29T01:00Z",
  },
  {
    now: "2026-10-25T00:45Z",
    timezone: "Europe/Berlin",
    start: "01:00",
    end: "02:30",
    wake: "2026-10-25T01:30Z",
  },
])("native during-quiet admission wakes at actual $wake", async (time) => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse(time.now));
  const f = await opted();
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 1,
    settings: {
      ...f.settings,
      timezone: time.timezone,
      quiet: { start: time.start, end: time.end },
    },
  });
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!,
    r = p.researchSummaries![0];
  const job = (await f.t.run((ctx) => ctx.db.system.get(r.job)))!;
  expect(job.scheduledTime).toBe(Date.parse(time.wake));
  expect((await f.signed.query(query, f.summaryArgs)).rows).toEqual([]);
  vi.setSystemTime(job.scheduledTime);
  await f.t.mutation(
    internal.preferences.releaseResearchSummary,
    job.args[0] as {
      preferenceId: typeof p._id;
      orderId: typeof orderId;
      epoch: number;
    },
  );
  expect((await f.signed.query(query, f.summaryArgs)).rows).toHaveLength(1);
  expect(
    (await f.t.run((ctx) => ctx.db.get(p._id)))!.researchSummaries![0].deadline,
  ).toBe(r.deadline);
});
test("quiet boundary drops original whose source deadline precedes quiet end", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-08T19:59Z"));
  const f = await opted();
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 1,
    settings: { ...f.settings, quiet: { start: "20:00", end: "21:00" } },
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.policies[0], { expiresAt: Date.parse("2026-10-08T20:05Z") }),
  );
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!,
    a = { preferenceId: p._id, orderId, epoch: p.summaryEpoch ?? 0 };
  await f.t.mutation(internal.preferences.releaseResearchSummary, a);
  vi.setSystemTime(Date.parse("2026-10-08T20:00Z"));
  await f.t.mutation(internal.preferences.releaseResearchSummary, a);
  expect(
    (await f.t.run((ctx) => ctx.db.get(p._id)))!.researchSummaries,
  ).toBeUndefined();
  expect((await f.signed.query(query, f.summaryArgs)).rows).toEqual([]);
});

test("quiet-end native release schedules next interval and stops at frozen deadline", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-08T20:30Z"));
  const f = await opted();
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 1,
    settings: { ...f.settings, quiet: { start: "20:00", end: "21:00" } },
  });
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!,
    r = p.researchSummaries![0],
    a = { preferenceId: p._id, orderId, epoch: p.summaryEpoch ?? 0 };
  vi.setSystemTime(Date.parse("2026-10-08T21:00Z"));
  await f.t.mutation(internal.preferences.releaseResearchSummary, a);
  const next = (await f.t.run((ctx) => ctx.db.get(p._id)))!,
    job = (await f.t.run((ctx) =>
      ctx.db.system.get(next.researchSummaries![0].job),
    ))!;
  expect(job.scheduledTime).toBe(Date.parse("2026-10-09T20:00Z"));
  expect(next.researchSummaries![0].deadline).toBe(r.deadline);
  vi.setSystemTime(job.scheduledTime);
  await f.t.mutation(
    internal.preferences.releaseResearchSummary,
    job.args[0] as typeof a,
  );
  expect(
    (await f.t.run((ctx) => ctx.db.get(p._id)))!.researchSummaries,
  ).toBeUndefined();
});
test("quiet revision cancels old boundary job and stale callback cannot own replacement", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-08T19:59Z"));
  const f = await opted();
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 1,
    settings: { ...f.settings, quiet: { start: "20:00", end: "21:00" } },
  });
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!,
    a = { preferenceId: p._id, orderId, epoch: p.summaryEpoch ?? 0 };
  await f.t.mutation(internal.preferences.releaseResearchSummary, a);
  const before = (await f.t.run((ctx) => ctx.db.get(p._id)))!,
    oldJob = before.researchSummaries![0].job;
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 2,
    settings: { ...f.settings, quiet: { start: "20:30", end: "21:30" } },
  });
  const changed = (await f.t.run((ctx) => ctx.db.get(p._id)))!;
  expect((await f.t.run((ctx) => ctx.db.system.get(oldJob)))!.state.kind).toBe(
    "canceled",
  );
  await f.t.mutation(internal.preferences.releaseResearchSummary, a);
  expect(await f.t.run((ctx) => ctx.db.get(p._id))).toEqual(changed);
  await f.t.mutation(internal.preferences.releaseResearchSummary, {
    ...a,
    epoch: changed.summaryEpoch!,
  });
  const fresh = (await f.t.run((ctx) => ctx.db.get(p._id)))!,
    job = (await f.t.run((ctx) =>
      ctx.db.system.get(fresh.researchSummaries![0].job),
    ))!;
  expect(job.scheduledTime).toBe(Date.parse("2026-10-08T20:30Z"));
  expect(fresh.researchSummaries![0].deadline).toBe(
    before.researchSummaries![0].deadline,
  );
});

test.each([
  {
    now: "2026-03-29T00:50Z",
    start: "02:30",
    end: "04:00",
    boundary: "2026-03-29T01:00Z",
    wake: "2026-03-29T02:00Z",
  },
  {
    now: "2026-10-24T22:50Z",
    start: "01:00",
    end: "02:30",
    boundary: "2026-10-24T23:00Z",
    wake: "2026-10-25T01:30Z",
  },
])(
  "native pre-quiet DST boundary $boundary schedules actual end $wake",
  async (time) => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(time.now));
    const f = await opted();
    await f.signed.mutation(save, {
      ...f.args,
      expectedRevision: 1,
      settings: {
        ...f.settings,
        timezone: "Europe/Berlin",
        quiet: { start: time.start, end: time.end },
      },
    });
    const orderId = await f.start();
    await f.t.mutation(internal.research.native.finish, {
      orderId,
      generation: 1,
    });
    const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!,
      a = { preferenceId: p._id, orderId, epoch: p.summaryEpoch ?? 0 };
    await f.t.mutation(internal.preferences.releaseResearchSummary, a);
    const before = (await f.t.run((ctx) => ctx.db.get(p._id)))!,
      boundary = (await f.t.run((ctx) =>
        ctx.db.system.get(before.researchSummaries![0].job),
      ))!;
    expect(boundary.scheduledTime).toBe(Date.parse(time.boundary));
    vi.setSystemTime(boundary.scheduledTime);
    await f.t.mutation(
      internal.preferences.releaseResearchSummary,
      boundary.args[0] as typeof a,
    );
    const inside = (await f.t.run((ctx) => ctx.db.get(p._id)))!,
      end = (await f.t.run((ctx) =>
        ctx.db.system.get(inside.researchSummaries![0].job),
      ))!;
    expect(end.scheduledTime).toBe(Date.parse(time.wake));
    vi.setSystemTime(end.scheduledTime);
    await f.t.mutation(
      internal.preferences.releaseResearchSummary,
      end.args[0] as typeof a,
    );
    expect((await f.signed.query(query, f.summaryArgs)).rows).toHaveLength(1);
    expect(
      (await f.t.run((ctx) => ctx.db.get(p._id)))!.researchSummaries![0]
        .deadline,
    ).toBe(before.researchSummaries![0].deadline);
  },
);
