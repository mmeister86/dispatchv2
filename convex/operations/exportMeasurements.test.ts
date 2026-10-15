import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { api, internal } from "../_generated/api";
import {
  historyFixture,
  publishingFixture,
} from "../../tests/performance-export-fixture";
const page = makeFunctionReference<"query">(
  "operations/exportIntelligence:page",
);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
type Fixture = Pick<
  Awaited<ReturnType<typeof historyFixture>>,
  "t" | "signed" | "userId" | "args"
>;
async function args(f: Fixture, family: string) {
  vi.setSystemTime(Date.now() + 1);
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  return {
    ...f.args,
    family,
    expectedAuthId: user.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "measurements",
    cursor: null,
    creationUpperBound: null,
  };
}
async function pages(f: Fixture, family: string) {
  const a = await args(f, family),
    rows: any[] = [];
  let cursor: string | null = null,
    creationUpperBound: number | null = null;
  for (let i = 0; i < 150; i++) {
    const p: any = await f.signed.query(page, {
      ...a,
      cursor,
      creationUpperBound,
    });
    expect(p.data.selection.rows.length).toBeLessThanOrEqual(1);
    expect(
      new TextEncoder().encode(JSON.stringify(p)).length,
    ).toBeLessThanOrEqual(65536);
    expect(JSON.stringify(p)).not.toMatch(
      /synthetic-only|policyFingerprint|providerIdentity|connectionSequence|seenCursors|SECRET_PROVIDER_CURSOR/,
    );
    rows.push(...p.data.selection.rows);
    if (p.isDone) return rows;
    expect(p.cursor).not.toBe(cursor);
    cursor = p.cursor;
    creationUpperBound = p.creationUpperBound;
  }
  throw Error("nonterminating page");
}
async function imported() {
  const f = await historyFixture(10000, 100),
    jobId = await f.start();
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: Array.from({ length: 25 }, (_, i) => ({
              id: String(100 + n * 25 + i),
              author_id: "123",
              text: `Original imported ${n}:${i}`,
              created_at: "2026-07-01T12:00:00Z",
            })),
            meta: {
              result_count: 25,
              next_token: `SECRET_PROVIDER_CURSOR_${++n}`,
            },
          }),
        ),
    ),
  );
  for (let i = 0; i < 3; i++)
    await f.t.action(internal.performance.backfill.read, {
      jobId,
      generation: 1,
    });
  return { ...f, jobId };
}
test("native three-page history exports every retained record beyond old UI limits and original null fields", async () => {
  const f = await imported();
  const posts = await pages(f, "historyPosts");
  expect(posts).toHaveLength(75);
  expect(posts[0]).toMatchObject({
    text: "Original imported 0:0",
    thenKnowledgeId: null,
    accountSize: null,
    historicalAnalysisId: null,
    metricsStatus: "not-observed",
    materialAvailability: "retained",
  });
  expect((await pages(f, "historyJobs"))[0]).toMatchObject({
    state: "partial",
    pages: 3,
    imported: 75,
    reason: "OWN_HISTORY_PAGE_LIMIT",
  });
  expect((await pages(f, "historyPolicies"))[0]).toMatchObject({
    version: "history-test-v1",
    unitMicros: 10,
  });
  expect((await pages(f, "historyControls"))[0]).toMatchObject({
    generation: 1,
    deletedThroughGeneration: 0,
  });
});
test("native first-send unknown admission preserves saved null projection without requiring confirmation", async () => {
  const f = await publishingFixture();
  await f.send();
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: f.first._id,
    claimSequence: f.first.claimSequence,
    outcome: "unknown",
    durationMs: 1,
  });
  const [k] = await pages(f, "publicationKnowledge");
  expect(k).toMatchObject({
    postAttemptId: f.first._id,
    assessmentId: null,
    applicable: false,
    projection: { state: "unavailable", score: null, pin: null },
  });
});
async function measured() {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const snap = (await f.t.run((ctx) =>
    ctx.db.query("performanceSnapshots").first(),
  ))!;
  vi.setSystemTime(snap.dueAt);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: "101",
              author_id: "123",
              public_metrics: {
                impression_count: 0,
                like_count: 3,
                repost_count: 1,
              },
              created_at: "2026-10-06T12:01:00.000Z",
            },
          }),
        ),
    ),
  );
  await f.t.action(internal.performance.collect.read, {
    snapshotId: snap._id,
    generation: snap.generation,
  });
  return { ...f, snap };
}
test("native measured zero and missing null survive, queued sibling keeps original null timestamps", async () => {
  const f = await measured();
  const r = await pages(f, "performanceSnapshots");
  expect(r).toHaveLength(2);
  expect(r[0]).toMatchObject({
    state: "observed",
    materialAvailability: "retained",
  });
  expect(r[0].fields[0]).toMatchObject({
    name: "impressions",
    rawField: "public_metrics.impression_count",
    value: 0,
    status: "measured",
  });
  expect(r[0].fields.find((x: any) => x.name === "url_clicks")).toMatchObject({
    value: null,
    status: "missing",
  });
  expect(r[1]).toMatchObject({
    state: "queued",
    observedAt: null,
    requestedAt: null,
    fields: null,
    materialAvailability: "unavailable",
  });
  expect(r[1]).not.toHaveProperty("observedAgeMs");
  expect((await pages(f, "performancePolicies"))[0]).toMatchObject({
    version: "test-v1",
    fields: ["impressions", "likes", "reposts", "url_clicks"],
  });
  expect((await pages(f, "performanceControls"))[0]).toMatchObject({
    enabled: true,
    deleted: false,
  });
});

test("all eight fixed shared families enforce session, selectors, account and four-role policy before discovery", async () => {
  const f = await historyFixture(),
    a = await args(f, "historyPosts");
  const families = [
    "historyPosts",
    "historyJobs",
    "historyPolicies",
    "historyControls",
    "performanceSnapshots",
    "performancePolicies",
    "performanceControls",
    "publicationKnowledge",
  ];
  for (const family of families) {
    await expect(
      f.signed.query(page, { ...a, family, expectedSessionId: "old" }),
    ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
    await expect(
      f.signed.query(page, { ...a, family, accountId: undefined }),
    ).rejects.toThrow("EXPORT_REQUEST_INVALID");
    await expect(
      f.signed.query(page, { ...a, family, kind: "check" }),
    ).rejects.toThrow("EXPORT_REQUEST_INVALID");
  }
  const member = (await f.t.run((ctx) => ctx.db.query("memberships").first()))!;
  for (const role of ["Editor", "Viewer"] as const) {
    await f.t.run((ctx) => ctx.db.patch(member._id, { role }));
    for (const family of families)
      await expect(f.signed.query(page, { ...a, family })).rejects.toThrow(
        "ROLE_ACCESS_DENIED",
      );
  }
  await f.t.run((ctx) => ctx.db.patch(member._id, { role: "Admin" }));
  expect((await pages(f, "historyPolicies")).length).toBe(1);
});
test("original bound excludes later native records and preserved paused/removed jobs omit provider checkpoints", async () => {
  const f = await historyFixture();
  const job = await f.start();
  await f.t.run((ctx) => ctx.db.patch(job, { state: "paused" }));
  const a = await args(f, "historyJobs"),
    first: any = await f.signed.query(page, a);
  expect(first.data.selection.rows[0].state).toBe("paused");
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...r } = (await ctx.db.get(job))!;
    await ctx.db.insert("historyJobs", { ...r, state: "removed" });
  });
  vi.advanceTimersByTime(5);
  const after: any = await f.signed.query(page, {
    ...a,
    cursor: first.cursor,
    creationUpperBound: first.creationUpperBound,
  });
  expect(after.data.selection.rows).toEqual([]);
  expect((await pages(f, "historyJobs")).map((r) => r.state)).toEqual([
    "paused",
    "removed",
  ]);
});
test("history direct expiry and withdrawal preserve headers, corrupted original fingerprint fails even expired", async () => {
  const f = await imported();
  const r = (await f.t.run((ctx) => ctx.db.query("historyPosts").first()))!;
  await f.t.run((ctx) => ctx.db.patch(r._id, { sourceUntil: Date.now() - 1 }));
  expect((await pages(f, "historyPosts"))[0]).toMatchObject({
    text: null,
    removed: false,
    materialAvailability: "unavailable",
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(r._id, { sourceUntil: r.sourceUntil });
    const b = (await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `history:account:${f.accountId}`))
      .unique())!;
    await ctx.db.patch(b._id, { purposes: [] });
  });
  expect((await pages(f, "historyPosts"))[0].text).toBeNull();
  await f.t.run((ctx) =>
    ctx.db.patch(f.jobId, { policyFingerprint: "CORRUPTION" }),
  );
  await expect(pages(f, "historyPosts")).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
});
test("numeric sources remain independent of withdrawn Draft context; expired snapshots keep actual observed state", async () => {
  const f = await measured();
  await f.t.run((ctx) =>
    ctx.db.patch(f.request.draftVersionId, { sourceUnavailable: true }),
  );
  expect((await pages(f, "performanceSnapshots"))[0].fields[0].value).toBe(0);
  await f.t.run((ctx) =>
    ctx.db.patch(f.snap._id, { expiresAt: Date.now() - 1 }),
  );
  expect((await pages(f, "performanceSnapshots"))[0]).toMatchObject({
    state: "observed",
    fields: null,
    materialAvailability: "unavailable",
  });
  const snap = (await f.t.run((ctx) => ctx.db.get(f.snap._id)))!;
  await f.t.run((ctx) =>
    ctx.db.patch(snap.attemptId!, { policyFingerprint: "WRONG" }),
  );
  await expect(pages(f, "performanceSnapshots")).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
});
test("all five native window values and original optional absence survive queued exports", async () => {
  const f = await publishingFixture(true);
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("performancePolicies").first())!;
    await ctx.db.patch(p._id, {
      windows: [0.25, 1, 6, 24, 48],
      windowsEvidence: "Explicit five windows",
    });
  });
  await f.send();
  await f.confirm();
  const rows = await pages(f, "performanceSnapshots");
  expect(rows.map((r) => r.windowHours)).toEqual([0.25, 1, 6, 24, 48]);
  for (const r of rows) {
    expect(r).not.toHaveProperty("late");
    expect(r).not.toHaveProperty("observedAgeMs");
    expect(r.fields).toBeNull();
  }
});
test("inert expired declarations and default-OFF/withdrawn controls retain human configuration", async () => {
  const f = await publishingFixture(true);
  await f.signed.mutation(api.performance.capabilities.consent, {
    ...f.args,
    enabled: false,
  });
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("performancePolicies").first())!;
    await ctx.db.patch(p._id, { expiresAt: 1 });
  });
  expect((await pages(f, "performancePolicies"))[0].expiresAt).toBe(1);
  expect((await pages(f, "performanceControls"))[0].enabled).toBe(false);
});
test("nonfinite, negative-zero, unsafe counts and oversized UTF8 records fail whole pages", async () => {
  const f = await historyFixture(),
    jobId = await f.start();
  for (const pagesValue of [NaN, Infinity, -0, Number.MAX_SAFE_INTEGER + 1]) {
    await f.t.run((ctx) => ctx.db.patch(jobId, { pages: pagesValue }));
    await expect(pages(f, "historyJobs")).rejects.toThrow();
  }
  await f.t.run((ctx) =>
    ctx.db.patch(jobId, { pages: 0, reason: "界".repeat(30000) }),
  );
  await expect(pages(f, "historyJobs")).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
});

import { qualifiedCorpus } from "../../tests/evals/calibration/fixture";
import { POST_ANALYSIS } from "../ai/jev/questions/postAnalysis";
function nativeAnalysisResponse() {
  return new Response(
    JSON.stringify({
      model: "jev-1.13.0",
      usage: { input_tokens: 20, output_tokens: 10 },
      answers: Object.fromEntries(
        Object.entries(POST_ANALYSIS.questions).map(([key, q]) => [
          key,
          q.type === "choice"
            ? {
                type: "choice",
                choice: "educational",
                confidence: 0.9,
                probabilities: Object.fromEntries(
                  Object.keys(q.criteria).map((k) => [k, 0.125]),
                ),
              }
            : q.type === "score"
              ? {
                  type: "score",
                  score:
                    key === "clarity"
                      ? 4
                      : key === "discussionPotential"
                        ? 0
                        : 2.5,
                  confidence: 0.9,
                  probabilities: { 0: 0.2, 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.2 },
                  legend: Object.fromEntries(
                    q.criteria.map((s, i) => [String(i), s]),
                  ),
                }
              : { type: "noul", noul: 0.2 },
        ]),
      ),
    }),
  );
}
async function targetSchedule(f: Awaited<ReturnType<typeof qualifiedCorpus>>) {
  const versionId = f.request.draftVersionId;
  await f.t.run(async (ctx) => {
    const ver = (await ctx.db.get(versionId))!;
    await ctx.db.patch(versionId, {
      content: {
        ...ver.content,
        text: ["Synthetic new single text question?"],
      },
    });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => nativeAnalysisResponse()),
  );
  const args = {
    ...f.args,
    draftId: f.request.draftId,
    draftVersionId: versionId,
  };
  expect(
    await f.signed.action(api.intelligence.assessments.analyze, {
      ...args,
      operationKey: crypto.randomUUID(),
    }),
  ).toMatchObject({ outcome: "success" });
  const assessment = (
    await f.signed.query(api.intelligence.assessments.get, args)
  ).assessment!;
  expect(assessment).not.toBeNull();
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    ...f.args,
    versionId,
  });
  const at = Math.ceil((Date.now() + 60000) / 60000) * 60000;
  const scheduleId = await f.signed.mutation(api.editorial.schedule, {
    ...f.args,
    versionId,
    approvalId,
    at,
    timezone: "UTC",
    localTime: new Date(at).toISOString().slice(0, 16),
  });
  vi.setSystemTime(at);
  const job = { scheduleId, generation: 1 };
  await f.t.mutation(internal.publishing.claim, job);
  const attempt = await f.t.mutation(internal.publishing.attempts.claim, job);
  expect(attempt).not.toBeNull();
  return {
    args,
    assessment,
    scheduleId,
    attempt: attempt!,
    send: {
      attemptId: attempt!._id,
      claimSequence: attempt!.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    },
  };
}
test("genuine native first-send candidate keeps its original pin after rollback and fails expired corruption", async () => {
  const f = await qualifiedCorpus();
  const { monitoringSnapshotId } = await f.mature();
  const checkId = await f.signed.mutation(
    api.performance.models.checkMonitoring,
    {
      ...f.args,
      declarationId: f.declarationId,
      snapshotId: monitoringSnapshotId,
      block: 1,
      commandKey: "archive-pass",
    },
  );
  const decisionId = await f.signed.mutation(api.performance.models.activate, {
    ...f.args,
    evaluationId: f.evaluationId,
    declarationId: f.declarationId,
    checkId,
    expectedRevision: 0,
    commandKey: "archive-activate",
  });
  const target = await targetSchedule(f);
  await f.t.mutation(internal.publishing.attempts.beforeSend, target.send);
  const saved = (await f.t.run((ctx) =>
    ctx.db
      .query("publicationKnowledge")
      .withIndex("by_postAttemptId", (q) =>
        q.eq("postAttemptId", target.attempt._id),
      )
      .unique(),
  ))!;
  expect(saved.projection?.state).toBe("candidate");
  await f.signed.mutation(api.performance.models.rollback, {
    ...f.args,
    expectedRevision: 1,
    commandKey: "archive-rollback",
  });
  let rows = await pages(f, "publicationKnowledge");
  let k = rows.find((r) => r.id === saved._id);
  expect(k.projection).toMatchObject({
    state: "candidate",
    score: saved.projection!.score,
    pin: { decisionId, checkId, candidateId: f.candidateId },
  });
  expect(JSON.stringify(rows)).not.toMatch(/Fingerprint|semanticKey/);
  const a = await args(f, "publicationKnowledge");
  const previous = await f.t.run((ctx) =>
    ctx.db
      .query("publicationKnowledge")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q
          .eq("workspaceId", f.args.workspaceId)
          .eq("accountId", f.args.accountId),
      )
      .paginate({ numItems: rows.length - 1, cursor: null }),
  );
  await expect(
    f.signed.run((ctx) =>
      ctx.runQuery(
        page,
        {
          ...a,
          cursor: previous.continueCursor,
          creationUpperBound: Date.now(),
        },
        { transactionLimits: { databaseQueries: 512 } },
      ),
    ),
  ).rejects.toThrow(/CALIBRATION_READ_CAPACITY/);
  await expect(
    f.signed.run((ctx) =>
      ctx.runQuery(page, a, { transactionLimits: { databaseQueries: 1 } }),
    ),
  ).rejects.toThrow();
  await f.t.run((ctx) =>
    ctx.db.patch(saved._id, {
      projection: { ...saved.projection!, proofUntil: Date.now() - 1 },
    }),
  );
  rows = await pages(f, "publicationKnowledge");
  expect(rows.find((r) => r.id === saved._id)).toMatchObject({
    projection: null,
    materialAvailability: "unavailable",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(saved._id, {
      projection: {
        ...saved.projection!,
        proofUntil: Date.now() - 1,
        pin: { ...saved.projection!.pin!, assessmentFingerprint: "WRONG" },
      },
    }),
  );
  await expect(pages(f, "publicationKnowledge")).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
});

import { retainedHorizon } from "../performance/history";
import { retainedSnapshotHorizon } from "../performance/snapshots";
test("native history denies expired source and archive explicitly removes protected material", async () => {
  const f = await imported();
  const original = (await f.t.run((ctx) =>
    ctx.db.query("historyPosts").first(),
  ))!;
  await f.t.run((ctx) =>
    ctx.db.patch(original._id, { sourceUntil: Date.now() - 1 }),
  );
  await expect(
    f.t.run(async (ctx) =>
      retainedHorizon(ctx, (await ctx.db.get(original._id))!),
    ),
  ).rejects.toThrow("OWN_HISTORY_SOURCE_UNAVAILABLE");
  expect((await pages(f, "historyPosts"))[0].text).toBeNull();
  const g = await measured();
  await g.t.run((ctx) =>
    ctx.db.patch(g.snap._id, { expiresAt: Date.now() - 1 }),
  );
  expect(
    await g.t.run(async (ctx) =>
      retainedSnapshotHorizon(ctx, (await ctx.db.get(g.snap._id))!),
    ),
  ).toBeLessThan(Date.now());
  expect((await pages(g, "performanceSnapshots"))[0].fields).toBeNull();
});
test("first-send saves static null score even with a genuine current assessment and rejected write", async () => {
  const f = await qualifiedCorpus(),
    target = await targetSchedule(f);
  await f.t.mutation(internal.publishing.attempts.beforeSend, target.send);
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: target.attempt._id,
    claimSequence: target.attempt.claimSequence,
    outcome: "rejected",
    durationMs: 1,
  });
  const rows = await pages(f, "publicationKnowledge"),
    k = rows.find((r) => r.postAttemptId === target.attempt._id);
  expect(k).toMatchObject({
    applicable: true,
    projection: { state: "static", score: null, pin: null },
  });
  expect(k.assessmentId).not.toBeNull();
});
test("foreign account, root, version and duplicate original knowledge references fail closed", async () => {
  const f = await publishingFixture();
  await f.send();
  const k = (await f.t.run((ctx) =>
    ctx.db.query("publicationKnowledge").first(),
  ))!;
  const other = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...a } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", { ...a, providerIdentity: "other" });
  });
  await f.t.run((ctx) => ctx.db.patch(k._id, { accountId: other }));
  await expect(
    f.signed.query(page, {
      ...(await args(f, "publicationKnowledge")),
      accountId: other,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run((ctx) => ctx.db.patch(k._id, { accountId: f.accountId }));
  const original = (await f.t.run((ctx) =>
    ctx.db.get(f.request.draftVersionId),
  ))!;
  await f.t.run((ctx) =>
    ctx.db.patch(original._id, {
      content: { ...original.content, accountId: other },
    }),
  );
  await expect(pages(f, "publicationKnowledge")).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
  await f.t.run((ctx) =>
    ctx.db.patch(original._id, { content: original.content }),
  );
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...r } = k;
    await ctx.db.insert("publicationKnowledge", r);
  });
  await expect(pages(f, "publicationKnowledge")).rejects.toThrow();
});
test("original history actor loss leaves headers for an independently authorized requester", async () => {
  const f = await imported();
  const originalActor = await f.t.run(async (ctx) => {
    const original = (await ctx.db.get(f.userId))!;
    const { _id, _creationTime, ...u } = original;
    const userId = await ctx.db.insert("users", {
      ...u,
      authId: "former-actor",
    });
    await ctx.db.insert("memberships", {
      workspaceId: f.args.workspaceId,
      userId,
      role: "Editor",
    });
    await ctx.db.patch(f.jobId, { actorId: userId });
    return userId;
  });
  const rows = await pages(f, "historyPosts");
  expect(rows[0]).toMatchObject({
    text: null,
    materialAvailability: "unavailable",
  });
  expect((await pages(f, "historyJobs"))[0].actorId).toBe(originalActor);
});
test("native pause during funded I/O preserves actual job generation and original receipt reference", async () => {
  const f = await historyFixture(),
    jobId = await f.start();
  const prepared = await f.t.mutation(internal.performance.history.begin, {
    jobId,
    generation: 1,
    credentialGeneration: 1,
  });
  expect(prepared).not.toBeNull();
  await f.signed.mutation(api.performance.history.manage, {
    workspaceId: f.args.workspaceId,
    jobId,
    operation: "pause",
  });
  const [job] = await pages(f, "historyJobs");
  expect(job).toMatchObject({
    state: "paused",
    generation: 2,
    attemptId: prepared!.attemptId,
    pages: 0,
    imported: 0,
  });
});
test("native pause/resume/cancel advances the fence and exposes old import headers only; impossible generations fail", async () => {
  const f = await historyFixture(),
    jobId = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "101",
                author_id: "123",
                text: "Before pause",
                created_at: "2026-07-01T12:00:00Z",
              },
            ],
            meta: { result_count: 1, next_token: "SECRET_PROVIDER_CURSOR" },
          }),
        ),
    ),
  );
  await f.t.action(internal.performance.backfill.read, {
    jobId,
    generation: 1,
  });
  expect((await pages(f, "historyPosts"))[0].text).toBe("Before pause");
  for (const operation of ["pause", "resume", "cancel"] as const) {
    await f.signed.mutation(api.performance.history.manage, {
      workspaceId: f.args.workspaceId,
      jobId,
      operation,
    });
    expect((await pages(f, "historyPosts"))[0]).toMatchObject({
      generation: 1,
      text: null,
      removed: false,
      materialAvailability: "unavailable",
    });
  }
  const post = (await f.t.run((ctx) => ctx.db.query("historyPosts").first()))!;
  for (const generation of [0, 5]) {
    await f.t.run((ctx) => ctx.db.patch(post._id, { generation }));
    await expect(pages(f, "historyPosts")).rejects.toThrow(
      "REFERENCE_ACCESS_DENIED",
    );
  }
  await f.t.run(async (ctx) => {
    await ctx.db.patch(post._id, { generation: 1 });
    await ctx.db.patch(jobId, { generation: 99 });
  });
  await expect(pages(f, "historyPosts")).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
});
import { jevFixture } from "../../tests/jev-fixture";
test("native imported latest text retains original published version and original null assessment after later Draft edit", async () => {
  const f = await historyFixture(),
    e = await jevFixture(true, f, f.accountId),
    versionId = e.request.draftVersionId;
  const approvalId = await e.signed.mutation(api.editorial.approve, {
    ...f.args,
    versionId,
  });
  const scheduleId = await e.signed.mutation(api.editorial.schedule, {
    ...f.args,
    versionId,
    approvalId,
    at: Date.now() + 60000,
    timezone: "UTC",
    localTime: "2026-10-06T12:01",
  });
  vi.setSystemTime(Date.now() + 60000);
  const job = { scheduleId, generation: 1 };
  await f.t.mutation(internal.publishing.claim, job);
  const attempt = (await f.t.mutation(
    internal.publishing.attempts.claim,
    job,
  ))!;
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: attempt._id,
    claimSequence: attempt.claimSequence,
    credentialGeneration: 1,
    mediaIds: [],
  });
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: attempt._id,
    claimSequence: attempt.claimSequence,
    outcome: "confirmed",
    externalId: "101",
    durationMs: 1,
  });
  const knowledge = (await f.t.run((ctx) =>
      ctx.db.query("publicationKnowledge").first(),
    ))!,
    original = (await f.t.run((ctx) => ctx.db.get(versionId)))!,
    draft = (await f.t.run((ctx) => ctx.db.get(e.request.draftId)))!;
  const newVersion = await e.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: draft._id,
    expectedRevision: draft.revision,
    content: { ...original.content, text: ["New Draft text"] },
    reason: "Later human edit",
  });
  expect(newVersion).not.toBe(versionId);
  const jobId = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "101",
                author_id: "123",
                text: "Latest provider text",
                created_at: "2026-10-06T12:01:00Z",
              },
            ],
            meta: { result_count: 1 },
          }),
        ),
    ),
  );
  await f.t.action(internal.performance.backfill.read, {
    jobId,
    generation: 1,
  });
  expect((await pages(f, "historyPosts"))[0]).toMatchObject({
    text: "Latest provider text",
    versionId,
    thenKnowledgeId: knowledge._id,
    historicalAnalysisId: null,
  });
  expect((await pages(f, "publicationKnowledge"))[0]).toMatchObject({
    versionId,
    assessmentId: null,
    applicable: false,
  });
  expect(await f.t.run((ctx) => ctx.db.get(versionId))).toEqual(original);
});

test("original metric receipt rejects duplicate, reordered, missing and foreign grants before live or expired material", async () => {
  const f = await measured();
  const snapshot = (await f.t.run((ctx) => ctx.db.get(f.snap._id)))!;
  const receipt = (await f.t.run((ctx) => ctx.db.get(snapshot.attemptId!)))!;
  if (receipt.owner !== "own-metrics") throw Error("native metric fixture");
  const foreignGrant = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...account } = (await ctx.db.get(f.accountId))!;
    const accountId = await ctx.db.insert("socialAccounts", {
      ...account,
      providerIdentity: "another-account",
    });
    const {
      _id: grantId,
      _creationTime: created,
      ...grant
    } = (await ctx.db.get(receipt.budgetIds[2]))!;
    return ctx.db.insert("aiBudgets", {
      ...grant,
      accountId,
      key: `metrics:account:${accountId}`,
    });
  });
  for (const budgetIds of [
    [receipt.budgetIds[0], receipt.budgetIds[0], receipt.budgetIds[0]],
    [receipt.budgetIds[1], receipt.budgetIds[0], receipt.budgetIds[2]],
    receipt.budgetIds.slice(0, 2),
    [receipt.budgetIds[0], receipt.budgetIds[1], foreignGrant],
  ]) {
    await f.t.run((ctx) => ctx.db.patch(receipt._id, { budgetIds }));
    for (const expiresAt of [snapshot.expiresAt, Date.now() - 1]) {
      await f.t.run((ctx) => ctx.db.patch(snapshot._id, { expiresAt }));
      await expect(pages(f, "performanceSnapshots")).rejects.toThrow(
        "REFERENCE_ACCESS_DENIED",
      );
    }
  }
  await f.t.run(async (ctx) => {
    await ctx.db.patch(receipt._id, { budgetIds: receipt.budgetIds });
    await ctx.db.patch(snapshot._id, { expiresAt: snapshot.expiresAt });
  });
  expect((await pages(f, "performanceSnapshots"))[0].fields[0].value).toBe(0);
});

test("original experiment policy, spec and purpose corruption rejects both live and expired saved candidate pins", async () => {
  const f = await qualifiedCorpus();
  const { monitoringSnapshotId } = await f.mature();
  const checkId = await f.signed.mutation(
    api.performance.models.checkMonitoring,
    {
      ...f.args,
      declarationId: f.declarationId,
      snapshotId: monitoringSnapshotId,
      block: 1,
      commandKey: "repair-check",
    },
  );
  await f.signed.mutation(api.performance.models.activate, {
    ...f.args,
    evaluationId: f.evaluationId,
    declarationId: f.declarationId,
    checkId,
    expectedRevision: 0,
    commandKey: "repair-activate",
  });
  const target = await targetSchedule(f);
  await f.t.mutation(internal.publishing.attempts.beforeSend, target.send);
  const saved = (await f.t.run((ctx) =>
    ctx.db
      .query("publicationKnowledge")
      .withIndex("by_postAttemptId", (q) =>
        q.eq("postAttemptId", target.attempt._id),
      )
      .unique(),
  ))!;
  expect(saved.projection!.state).toBe("candidate");
  const experiment = (await f.t.run((ctx) => ctx.db.get(f.experimentId)))!;
  if (experiment.kind !== "experiment")
    throw Error("native experiment fixture");
  for (const key of [
    "policyFingerprint",
    "specFingerprint",
    "purposeFingerprint",
  ] as const) {
    await f.t.run((ctx) =>
      ctx.db.patch(experiment._id, {
        payload: { ...experiment.payload, [key]: "WRONG" },
      }),
    );
    for (const proofUntil of [saved.projection!.proofUntil, Date.now() - 1]) {
      await f.t.run((ctx) =>
        ctx.db.patch(saved._id, {
          projection: { ...saved.projection!, proofUntil },
        }),
      );
      await expect(pages(f, "publicationKnowledge")).rejects.toThrow();
    }
  }
  await f.t.run(async (ctx) => {
    await ctx.db.patch(experiment._id, { payload: experiment.payload });
    await ctx.db.patch(saved._id, {
      projection: { ...saved.projection!, proofUntil: Date.now() - 1 },
    });
  });
  expect(
    (await pages(f, "publicationKnowledge")).find((r) => r.id === saved._id),
  ).toMatchObject({ projection: null, materialAvailability: "unavailable" });
}, 30000);

test.each(["logicalIntent", "runId", "researchOrderId"] as const)(
  "native metric receipt rejects mixed union %s before live or expired material",
  async (key) => {
    const f = await measured();
    const snapshot = (await f.t.run((ctx) => ctx.db.get(f.snap._id)))!;
    const receipt = (await f.t.run((ctx) => ctx.db.get(snapshot.attemptId!)))!;
    await f.t.run((ctx) =>
      ctx.db.patch(receipt._id, {
        [key]:
          key === "logicalIntent"
            ? "foreign-owner-intent"
            : f.userId.replace(
                /users$/,
                key === "runId" ? "agentRuns" : "researchOrders",
              ),
      }),
    );
    for (const expiresAt of [snapshot.expiresAt, Date.now() - 1]) {
      await f.t.run((ctx) => ctx.db.patch(snapshot._id, { expiresAt }));
      await expect(pages(f, "performanceSnapshots")).rejects.toThrow(
        "REFERENCE_ACCESS_DENIED",
      );
    }
  },
);

async function importingHistory() {
  const f = await historyFixture(10000, 100),
    jobId = await f.start();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "101",
                author_id: "123",
                text: "Original first page",
                created_at: "2026-07-01T12:00:00Z",
              },
            ],
            meta: {
              result_count: 1,
              next_token: "SECRET_PROVIDER_CURSOR_NEXT",
            },
          }),
        ),
    ),
  );
  await f.t.action(internal.performance.backfill.read, {
    jobId,
    generation: 1,
  });
  await f.t.mutation(internal.performance.history.begin, {
    jobId,
    generation: 1,
    credentialGeneration: 1,
  });
  const job = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
  const post = (await f.t.run((ctx) => ctx.db.query("historyPosts").first()))!;
  const receipt = (await f.t.run((ctx) => ctx.db.get(job.attemptId!)))!;
  expect(receipt.owner).toBe("own-history");
  expect((await pages(f, "historyPosts"))[0].text).toBe("Original first page");
  expect((await pages(f, "historyJobs"))[0].attemptId).toBe(receipt._id);
  return { ...f, job, post, receipt };
}

test.each(["logicalIntent", "runId", "researchOrderId"] as const)(
  "native history receipt rejects mixed union %s before live or expired material",
  async (key) => {
    const f = await importingHistory();
    await f.t.run((ctx) =>
      ctx.db.patch(f.receipt._id, {
        [key]:
          key === "logicalIntent"
            ? "foreign-owner-intent"
            : f.userId.replace(
                /users$/,
                key === "runId" ? "agentRuns" : "researchOrders",
              ),
      }),
    );
    for (const sourceUntil of [f.post.sourceUntil, Date.now() - 1]) {
      await f.t.run(async (ctx) => {
        await ctx.db.patch(f.post._id, { sourceUntil });
        await ctx.db.patch(f.job._id, { sourceUntil });
      });
      for (const family of ["historyPosts", "historyJobs"])
        await expect(pages(f, family)).rejects.toThrow(
          "REFERENCE_ACCESS_DENIED",
        );
    }
  },
);

test("native history original receipt mandatory bindings reject before live or expired material", async () => {
  const f = await importingHistory(),
    receipt = f.receipt;
  if (receipt.owner !== "own-history") throw Error("native history fixture");
  for (const patch of [
    { page: -1 },
    { page: 3 },
    { page: 0 },
    { policyVersion: "corrupt" },
    { currency: "corrupt" },
    { unitMicros: receipt.unitMicros + 1 },
    { maxResults: receipt.maxResults + 1 },
    { reservedMicros: receipt.reservedMicros + 1 },
    { budgetIds: receipt.budgetIds.slice(0, 2) },
    {
      budgetIds: [
        receipt.budgetIds[0],
        receipt.budgetIds[0],
        receipt.budgetIds[2],
      ],
    },
    {
      budgetIds: [
        receipt.budgetIds[1],
        receipt.budgetIds[0],
        receipt.budgetIds[2],
      ],
    },
  ]) {
    const { _id, _creationTime, ...original } = receipt;
    await f.t.run((ctx) =>
      ctx.db.replace(_id, { ...original, ...patch } as typeof original),
    );
    for (const sourceUntil of [f.post.sourceUntil, Date.now() - 1]) {
      await f.t.run(async (ctx) => {
        await ctx.db.patch(f.post._id, { sourceUntil });
        await ctx.db.patch(f.job._id, { sourceUntil });
      });
      for (const family of ["historyPosts", "historyJobs"])
        await expect(pages(f, family)).rejects.toThrow(
          "REFERENCE_ACCESS_DENIED",
        );
    }
  }
});

test("history job generation cannot exceed its account control", async () => {
  const f = await historyFixture(),
    jobId = await f.start();
  expect((await pages(f, "historyJobs"))[0].generation).toBe(1);
  await f.t.run((ctx) => ctx.db.patch(jobId, { generation: 999 }));
  await expect(pages(f, "historyJobs")).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
});

test("original prospective qualification is required after saved candidate expiry", async () => {
  const f = await qualifiedCorpus();
  const { monitoringSnapshotId } = await f.mature();
  const checkId = await f.signed.mutation(
    api.performance.models.checkMonitoring,
    {
      ...f.args,
      declarationId: f.declarationId,
      snapshotId: monitoringSnapshotId,
      block: 1,
      commandKey: "expired-candidate-qualification",
    },
  );
  await f.signed.mutation(api.performance.models.activate, {
    ...f.args,
    evaluationId: f.evaluationId,
    declarationId: f.declarationId,
    checkId,
    expectedRevision: 0,
    commandKey: "expired-candidate-activation",
  });
  const target = await targetSchedule(f);
  await f.t.mutation(internal.publishing.attempts.beforeSend, target.send);
  const saved = (await f.t.run((ctx) =>
    ctx.db
      .query("publicationKnowledge")
      .withIndex("by_postAttemptId", (q) =>
        q.eq("postAttemptId", target.attempt._id),
      )
      .unique(),
  ))!;
  expect(saved.projection?.state).toBe("candidate");
  const experiment = (await f.t.run((ctx) => ctx.db.get(f.experimentId)))!;
  if (experiment.kind !== "experiment") throw Error("bad setup");
  await f.t.run((ctx) =>
    ctx.db.patch(experiment._id, {
      payload: { ...experiment.payload, mode: "retrospective" },
    }),
  );
  await expect(pages(f, "publicationKnowledge")).rejects.toThrow(
    "CALIBRATION_PROSPECTIVE_CANDIDATE_REQUIRED",
  );
  await f.t.run((ctx) =>
    ctx.db.patch(saved._id, {
      projection: { ...saved.projection!, proofUntil: Date.now() - 1 },
    }),
  );
  await expect(pages(f, "publicationKnowledge")).rejects.toThrow(
    "CALIBRATION_PROSPECTIVE_CANDIDATE_REQUIRED",
  );
});
