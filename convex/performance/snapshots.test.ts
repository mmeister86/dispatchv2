import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { jevFixture } from "../../tests/jev-fixture";
const overview = makeFunctionReference<"query">(
  "performance/snapshots:overview",
);
const consent = makeFunctionReference<"mutation">(
  "performance/capabilities:consent",
);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("TASK30 real Analytics is default off and cannot activate without separate approved metrics capability", async () => {
  const f = await jevFixture(true);
  const args = { workspaceId: f.workspaceId, accountId: f.request.accountId };
  expect(await f.signed.query(overview, args)).toMatchObject({
    enabled: false,
    reason: "OWN_METRICS_CONFIGURATION_REQUIRED",
    posts: [],
  });
  await expect(
    f.signed.mutation(consent, { ...args, enabled: true }),
  ).rejects.toThrow("OWN_METRICS_CONFIGURATION_REQUIRED");
});

import { api, internal, components } from "../_generated/api";
import { seal } from "../lib/crypto";
import { association } from "../integrations/x/fields";
import { normalize } from "./normalize";
import { POST_ANALYSIS } from "../ai/jev/questions/postAnalysis";
import { extent } from "../content/feedback";
afterEach(() => vi.useRealTimers());
async function publishingFixture(
  metrics = false,
  base?: Parameters<typeof jevFixture>[1],
  existingAccountId?: Parameters<typeof jevFixture>[2],
  original?: {
    draftId: NonNullable<
      Awaited<ReturnType<typeof jevFixture>>
    >["request"]["draftId"];
    draftVersionId: NonNullable<
      Awaited<ReturnType<typeof jevFixture>>
    >["request"]["draftVersionId"];
  },
) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00Z"));
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "synthetic");
  const f = await jevFixture(true, base, existingAccountId),
    accountId = f.request.accountId;
  await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(accountId))!;
    await ctx.db.patch(a._id, {
      providerIdentity: "123",
      capability: { ...a.capability, publish: true },
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
      expiresAt: Date.now() + 5 * 86400000,
      leaseUntil: 0,
      cleanAfter: Number.MAX_SAFE_INTEGER,
    });
  });
  const identity = await f.t.run(async (ctx) => {
    const user = (await ctx.db.get(f.userId))!;
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: user.authId,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 5 * 86400000,
          },
        },
      },
    );
    return { subject: user.authId, sessionId: session._id };
  });
  f.signed = f.t.withIdentity(identity);
  const args = { workspaceId: f.workspaceId, accountId };
  if (metrics) {
    await f.t.mutation(internal.performance.capabilities.configure, {
      ...args,
      version: "test-v1",
      approvedBy: f.userId,
      expiresAt: Date.now() + 5 * 86400000,
      purpose: "own-post-descriptive-editorial-v1",
      dialect: "post-fields-repost-v2",
      accessEvidence: "Synthetic field entitlement only",
      rightsEvidence: "Synthetic own count rights only",
      pricingEvidence: "Synthetic single request rate",
      protocolEvidence: "Synthetic dialect receipt",
      allocationEvidence: "Synthetic approved total allocation",
      fields: ["impressions", "likes", "reposts", "url_clicks"],
      unit: "single-post-request",
      unitMicros: 10,
      currency: "USD",
      retentionMs: 3 * 86400000,
      connectionSequence: 1,
      providerIdentity: "123",
      allocatedProviderLimitMicros: 1000,
    });
    await f.t.run(async (ctx) => {
      for (const [i, scope] of (
        ["provider", "workspace", "account"] as const
      ).entries())
        await ctx.db.insert("aiBudgets", {
          key: [
            "metrics:x",
            `metrics:workspace:${f.workspaceId}`,
            `metrics:account:${accountId}`,
          ][i],
          scope,
          ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
          ...(i === 2 ? { accountId } : {}),
          policyVersion: "test-v1",
          currency: "USD",
          purposes: ["own-metrics"],
          expiresAt: Date.now() + 5 * 86400000,
          limitMicros: 1000,
          heldMicros: 0,
          spentMicros: 0,
        });
    });
    await f.signed.mutation(api.performance.capabilities.consent, {
      ...args,
      enabled: true,
    });
  }
  if (original) {
    f.request.draftId = original.draftId;
    f.request.draftVersionId = original.draftVersionId;
  }
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    ...args,
    versionId: f.request.draftVersionId,
  });
  const scheduleId = await f.signed.mutation(api.editorial.schedule, {
    ...args,
    versionId: f.request.draftVersionId,
    approvalId,
    at: Date.now() + 60000,
    timezone: "UTC",
    localTime: "2026-10-06T12:01",
  });
  vi.setSystemTime(Date.now() + 60000);
  const job = { scheduleId, generation: 1 };
  await f.t.mutation(internal.publishing.claim, job);
  const first = await f.t.mutation(internal.publishing.attempts.claim, job);
  expect(first).not.toBeNull();
  const send = () =>
    f.t.mutation(internal.publishing.attempts.beforeSend, {
      attemptId: first!._id,
      claimSequence: first!.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    });
  const confirm = () =>
    f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: first!._id,
      claimSequence: first!.claimSequence,
      outcome: "confirmed",
      externalId: "101",
      durationMs: 1,
    });
  return {
    ...f,
    args,
    accountId,
    scheduleId,
    job,
    first: first!,
    send,
    confirm,
  };
}
function analysisResponse() {
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
                  score: 2.5,
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
async function analyze(
  f: Awaited<ReturnType<typeof publishingFixture>>,
  key: string,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => analysisResponse()),
  );
  return f.signed.action(api.intelligence.assessments.analyze, {
    ...f.args,
    draftId: f.request.draftId,
    draftVersionId: f.request.draftVersionId,
    operationKey: key,
  });
}
const knowledge = (f: Awaited<ReturnType<typeof publishingFixture>>) =>
  f.t.run((ctx) =>
    ctx.db
      .query("publicationKnowledge")
      .withIndex("by_postAttemptId", (q) => q.eq("postAttemptId", f.first._id))
      .unique(),
  );
const snapshot = (f: Awaited<ReturnType<typeof publishingFixture>>) =>
  f.t.run((ctx) =>
    ctx.db
      .query("performanceSnapshots")
      .withIndex("by_postAttemptId_and_windowHours", (q) =>
        q.eq("postAttemptId", f.first._id).eq("windowHours", 24),
      )
      .unique(),
  );
function metricsResponse() {
  return new Response(
    JSON.stringify({
      data: {
        id: "101",
        author_id: "123",
        public_metrics: { impression_count: 0, like_count: 3, repost_count: 1 },
        created_at: "2026-10-06T12:01:00.000Z",
      },
    }),
  );
}
test("registered first-send admits no-analysis publishing and freezes explicit null before later analysis or receipts", async () => {
  const f = await publishingFixture();
  expect(await knowledge(f)).toBeNull();
  expect(await f.send()).toBe(true);
  const captured = await knowledge(f);
  expect(captured).toMatchObject({
    assessmentId: null,
    reason: "NO_ASSESSMENT_AT_PUBLISH",
    versionId: f.request.draftVersionId,
  });
  await analyze(f, "after-original-send");
  await f.confirm();
  expect(await knowledge(f)).toEqual(captured);
  const next = await f.t.mutation(internal.publishing.attempts.claim, f.job);
  expect(next?.position).toBe(1);
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: next!._id,
    claimSequence: next!.claimSequence,
    credentialGeneration: 1,
    mediaIds: [],
  });
  expect(await knowledge(f)).toEqual(captured);
});
test("registered current assessment is frozen once and missing protected row never resolves to a later assessment", async () => {
  const f = await publishingFixture();
  await analyze(f, "analysis-before-firstsend");
  const assessed = await f.signed.query(api.intelligence.assessments.get, {
    ...f.args,
    draftId: f.request.draftId,
    draftVersionId: f.request.draftVersionId,
  });
  expect(assessed.assessment).not.toBeNull();
  await f.send();
  await f.confirm();
  expect(await knowledge(f)).toMatchObject({
    assessmentId: assessed.assessment!._id,
    applicable: true,
  });
  await f.t.mutation(internal.intelligence.assessments.purgeVersion, {
    versionId: f.request.draftVersionId,
  });
  await analyze(f, "later-after-row-removal");
  const page = await f.signed.query(api.performance.snapshots.overview, f.args);
  expect(page.posts[0].knowledge).toMatchObject({
    assessmentId: assessed.assessment!._id,
    assessment: null,
    reason: "ASSESSMENT_SOURCE_UNAVAILABLE",
  });
});
test("explicit raw definition preserves genuine public zero, missing fields, invalid counts and selected repost dialect without aliases", () => {
  const row = normalize(
    {
      data: {
        id: "101",
        author_id: "123",
        public_metrics: {
          impression_count: 0,
          like_count: -1,
          repost_count: 4,
        },
        non_public_metrics: { url_link_clicks: "3" },
      },
    },
    "101",
    "123",
    ["impressions", "likes", "reposts", "url_clicks", "profile_clicks"],
    "post-fields-repost-v2",
  );
  expect(row.fields.map((f) => [f.status, f.value])).toEqual([
    ["measured", 0],
    ["invalid", null],
    ["measured", 4],
    ["invalid", null],
    ["missing", null],
  ]);
  expect(row.fields[0].rawField).toBe("public_metrics.impression_count");
  expect(
    normalize(
      {
        data: {
          id: "101",
          author_id: "123",
          public_metrics: "malformed",
          created_at: "1",
        },
      },
      "101",
      "123",
      ["impressions"],
      "post-fields-repost-v2",
    ),
  ).toMatchObject({
    providerCreatedAt: null,
    fields: [{ status: "invalid", value: null }],
  });
  expect(
    normalize(
      {
        data: {
          id: "101",
          author_id: "123",
          public_metrics: { retweet_count: 4 },
        },
      },
      "101",
      "123",
      ["reposts"],
      "post-fields-repost-v2",
    ).fields[0],
  ).toMatchObject({ status: "missing", value: null });
  expect(
    normalize(
      {
        data: {
          id: "101",
          author_id: "999",
          public_metrics: { impression_count: 0 },
        },
      },
      "101",
      "123",
      ["impressions"],
      "post-fields-repost-v2",
    ).fields[0],
  ).toMatchObject({ status: "invalid", value: null });
});
test("receipt schedules exactly24/48 own post windows idempotently, funded once and renders real0 separately from missing", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  await f.confirm();
  const rows = await f.t.run((ctx) =>
    ctx.db.query("performanceSnapshots").collect(),
  );
  expect(rows.map((r) => r.windowHours).sort()).toEqual([24, 48]);
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    metricsResponse(),
  );
  vi.stubGlobal("fetch", fetch);
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    new URL(fetch.mock.calls[0][0] as string).searchParams.get("post.fields"),
  ).not.toContain("text");
  const observed = (await snapshot(f))!;
  expect(observed.fields[0]).toMatchObject({ value: 0, status: "measured" });
  expect(observed.fields.find((f) => f.name === "url_clicks")).toMatchObject({
    value: null,
    status: "missing",
  });
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts.filter((t) => t.owner === "own-metrics")).toHaveLength(1);
  const budgets = await f.t.run((ctx) => ctx.db.query("aiBudgets").collect());
  expect(
    budgets
      .filter((b) => b.purposes.includes("own-metrics"))
      .map((b) => [b.heldMicros, b.spentMicros]),
  ).toEqual([
    [0, 10],
    [0, 10],
    [0, 10],
  ]);
});
test("pause/delete generation during I/O suppresses payload but settles one legitimate cost; bounded cleanup retains financial owner", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  let release!: (r: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>((r) => (release = r)));
  vi.stubGlobal("fetch", fetch);
  const pending = f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  await f.signed.mutation(api.performance.capabilities.remove, f.args);
  release(metricsResponse());
  await pending;
  const control = await f.t.run((ctx) =>
    ctx.db.query("performanceControls").first(),
  );
  await f.t.mutation(internal.performance.snapshots.clear, {
    ...f.args,
    generation: control!.generation,
    remove: true,
  });
  expect(await snapshot(f)).toMatchObject({ state: "removed", fields: [] });
  const t = await f.t.run((ctx) => ctx.db.query("aiAttempts").first());
  expect(t).toMatchObject({
    owner: "own-metrics",
    state: "settled",
    heldMicros: 0,
    estimatedMicros: 10,
  });
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("expired credential is visibly blocked before funding/IO and budget refusal performs no free provider read", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  await f.t.run(async (ctx) => {
    const c = (await ctx.db.query("xCredentials").first())!;
    await ctx.db.patch(c._id, { expiresAt: Date.now() });
  });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(await snapshot(f)).toMatchObject({
    state: "blocked",
    reason: "OWN_METRICS_REAUTH_OR_READ_SCOPE_REQUIRED",
  });
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
});
test("cancellation-ignoring transport resolves action at deadline, holds unknown liability and never retries or restores late payload", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  let release!: (r: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>((r) => (release = r)));
  vi.stubGlobal("fetch", fetch);
  const pending = f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(15001);
  await pending;
  expect(await snapshot(f)).toMatchObject({
    state: "blocked",
    reason: "OWN_METRICS_READ_OUTCOME_UNKNOWN",
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").first()),
  ).toMatchObject({ state: "unknown", heldMicros: 10 });
  release(metricsResponse());
  await Promise.resolve();
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await snapshot(f))!.fields.every((f) => f.value === null)).toBe(true);
});
test("independent editorial acceptance/rejection and edit extent require no X metrics grant", async () => {
  const f = await publishingFixture();
  await f.signed.mutation(api.content.feedback.decide, {
    workspaceId: f.workspaceId,
    versionId: f.request.draftVersionId,
    kind: "reject",
  });
  const ver = (await f.t.run((ctx) => ctx.db.get(f.request.draftVersionId)))!,
    d = (await f.t.run((ctx) => ctx.db.get(f.request.draftId)))!;
  await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: d._id,
    expectedRevision: d.revision,
    content: { ...ver.content, text: ["Edited first"] },
    reason: "Synthetic edit",
  });
  const feedback = await f.signed.query(api.content.feedback.list, f.args);
  expect(feedback.map((r) => r.kind)).toContain("edit");
  expect(feedback.map((r) => r.kind)).toContain("reject");
  expect(feedback.map((r) => r.kind)).toContain("accept");
  expect(extent(["a😀z"], ["a🥲z"])).toBe(1);
});

test("proven rejected first write plus explicit human restart captures newer then-knowledge for the actual published admission", async () => {
  const f = await publishingFixture();
  await f.send();
  const old = await knowledge(f);
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: f.first._id,
    claimSequence: f.first.claimSequence,
    outcome: "rejected",
    httpStatus: 429,
    errorCode: "X_POST_REJECTED",
    durationMs: 1,
  });
  await analyze(f, "after-proven-no-effect");
  await f.signed.mutation(api.publishing.reconcile.continueThread, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  });
  const next = await f.t.mutation(internal.publishing.attempts.claim, {
    scheduleId: f.scheduleId,
    generation: 2,
  });
  expect(next?.position).toBe(0);
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: next!._id,
    claimSequence: next!.claimSequence,
    credentialGeneration: 1,
    mediaIds: [],
  });
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: next!._id,
    claimSequence: next!.claimSequence,
    outcome: "confirmed",
    externalId: "102",
    durationMs: 1,
  });
  expect(await knowledge(f)).toEqual(old);
  const view = await f.signed.query(api.performance.snapshots.overview, f.args);
  expect(view.posts[0].knowledge?.assessmentId).not.toBeNull();
  expect(view.posts[0].knowledge?.applicable).toBe(true);
});
test("unknown read reconciliation retains original no-analysis admission even when current analysis arrives later", async () => {
  const f = await publishingFixture();
  await f.send();
  const old = await knowledge(f);
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: f.first._id,
    claimSequence: f.first.claimSequence,
    outcome: "unknown",
    errorCode: "X_POST_OUTCOME_UNKNOWN",
    durationMs: 1,
  });
  await analyze(f, "after-unknown-publish");
  const ver = (await f.t.run((ctx) => ctx.db.get(f.request.draftVersionId)))!;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        data: {
          id: "101",
          author_id: "123",
          text: ver.content.text[0],
          created_at: new Date(old!.capturedAt).toISOString(),
          edit_history_post_ids: ["101"],
          referenced_posts: [],
          attachments: { media_keys: [] },
        },
      }),
    ),
  );
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    }),
  ).toBe("confirmed");
  expect(await knowledge(f)).toEqual(old);
  expect(
    (await f.signed.query(api.performance.snapshots.overview, f.args)).posts[0]
      .knowledge?.assessmentId,
  ).toBeNull();
});
test("new immutable policy stops old consent while old successful read settles once against its original price", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  let release!: (r: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>((r) => (release = r)));
  vi.stubGlobal("fetch", fetch);
  const pending = f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const old = (await f.t.run((ctx) =>
    ctx.db.query("performancePolicies").first(),
  ))!;
  const { _id, _creationTime, ...p } = old;
  vi.setSystemTime(Date.now() + 1);
  await f.t.mutation(internal.performance.capabilities.configure, {
    ...p,
    version: "test-v2",
    unitMicros: 20,
  });
  expect(await f.t.run((ctx) => ctx.db.get(_id))).toEqual(old);
  expect(
    (await f.signed.query(api.performance.snapshots.overview, f.args)).enabled,
  ).toBe(false);
  release(metricsResponse());
  await pending;
  expect(await snapshot(f)).toMatchObject({ fields: [] });
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").first()),
  ).toMatchObject({ policyId: _id, state: "settled", estimatedMicros: 10 });
  await expect(
    f.signed.mutation(api.performance.capabilities.consent, {
      ...f.args,
      enabled: true,
    }),
  ).rejects.toThrow("OWN_METRICS_BUDGET_CONFIGURATION_REQUIRED");
  await expect(
    f.t.mutation(internal.performance.capabilities.configure, {
      ...p,
      unitMicros: 11,
    }),
  ).rejects.toThrow("OWN_METRICS_POLICY_VERSION_CONFLICT");
});
test("budget exhausted before funding marks blocked and does not partially reserve sibling scopes", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  await f.t.run(async (ctx) => {
    const b = (await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `metrics:account:${f.accountId}`))
      .unique())!;
    await ctx.db.patch(b._id, { spentMicros: 1000 });
  });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(await snapshot(f)).toMatchObject({
    state: "blocked",
    reason: "OWN_METRICS_BUDGET_EXHAUSTED",
  });
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiBudgets").collect())).every(
      (b) => b.heldMicros === 0,
    ),
  ).toBe(true);
});

test("withdrawn protected context does not revoke independently approved own numeric count collection", async () => {
  const f = await publishingFixture(true);
  await analyze(f, "before-protected-withdrawal");
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  await f.t.run((ctx) =>
    ctx.db.patch(f.request.draftVersionId, { sourceUnavailable: true }),
  );
  vi.setSystemTime(row.dueAt);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => metricsResponse()),
  );
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  expect((await snapshot(f))!.fields[0]).toMatchObject({
    value: 0,
    status: "measured",
  });
  const page = await f.signed.query(api.performance.snapshots.overview, f.args);
  expect(page.posts[0].knowledge).toMatchObject({
    assessment: null,
    reason: "ASSESSMENT_SOURCE_UNAVAILABLE",
  });
  expect(page.posts[0].coverage).toEqual({ confirmed: 1, total: 2 });
});
test("cancellation-ignoring response body is deadline-bounded, preserving unknown cost without late writes", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  let release!: (r: { done: boolean; value?: Uint8Array }) => void;
  const read = vi.fn(
      () =>
        new Promise<{ done: boolean; value?: Uint8Array }>(
          (r) => (release = r),
        ),
    ),
    cancel = vi.fn(async () => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      body: { getReader: () => ({ read, cancel }) },
    })),
  );
  const pending = f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(15001);
  await pending;
  expect(await snapshot(f)).toMatchObject({
    state: "blocked",
    reason: "OWN_METRICS_READ_OUTCOME_UNKNOWN",
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  release({ done: true });
  await Promise.resolve();
  expect((await snapshot(f))!.fields.every((f) => f.value === null)).toBe(true);
});

test("delete tombstone survives immediate new consent before asynchronous physical cleanup and cannot resurrect old observations", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => metricsResponse()),
  );
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  await f.signed.mutation(api.performance.capabilities.remove, f.args);
  const deleted = (await f.t.run((ctx) =>
    ctx.db.query("performanceControls").first(),
  ))!;
  await f.signed.mutation(api.performance.capabilities.consent, {
    ...f.args,
    enabled: true,
  });
  expect(
    (await f.signed.query(api.performance.snapshots.overview, f.args)).posts[0]
      .snapshots,
  ).toEqual([]);
  await f.t.mutation(internal.performance.snapshots.clear, {
    ...f.args,
    generation: deleted.generation,
    remove: true,
  });
  expect(await snapshot(f)).toMatchObject({ state: "removed", fields: [] });
});

test("HTTP404 is unavailable/not-found rather than proven deletion or measured0, retaining uncertain charge", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 404 })),
  );
  await f.t.action(internal.performance.collect.read, {
    snapshotId: row._id,
    generation: row.generation,
  });
  const unavailable = (await snapshot(f))!;
  expect(unavailable.reason).toBe("OWN_METRICS_POST_NOT_FOUND");
  expect(
    unavailable.fields.every(
      (f) => f.status === "unavailable" && f.value === null,
    ),
  ).toBe(true);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").first()),
  ).toMatchObject({ state: "unknown", heldMicros: 10 });
});

test("registered native20s crash watchdog keeps one funded unknown hold and cannot resurrect a late successful payload", async () => {
  const f = await publishingFixture(true);
  await f.send();
  await f.confirm();
  const row = (await snapshot(f))!;
  vi.setSystemTime(row.dueAt);
  const admitted = await f.t.mutation(internal.performance.snapshots.begin, {
    snapshotId: row._id,
    generation: row.generation,
    credentialGeneration: 1,
  });
  expect(admitted).not.toBeNull();
  await f.t.mutation(internal.performance.snapshots.timeout, {
    attemptId: admitted!.attemptId,
  });
  expect(await snapshot(f)).toMatchObject({ state: "reading" });
  vi.setSystemTime(Date.now() + 20001);
  await f.t.mutation(internal.performance.snapshots.timeout, {
    attemptId: admitted!.attemptId,
  });
  expect(await snapshot(f)).toMatchObject({
    state: "blocked",
    reason: "OWN_METRICS_READ_OUTCOME_UNKNOWN",
  });
  expect(await f.t.run((ctx) => ctx.db.get(admitted!.attemptId))).toMatchObject(
    { state: "unknown", heldMicros: 10 },
  );
  const real = normalize(
    await metricsResponse().json(),
    "101",
    "123",
    admitted!.fields,
    admitted!.dialect,
  );
  await f.t.mutation(internal.performance.snapshots.finish, {
    attemptId: admitted!.attemptId,
    knownCharge: true,
    fields: real.fields,
    providerCreatedAt: real.providerCreatedAt,
    reason: null,
  });
  expect((await snapshot(f))!.fields).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.get(admitted!.attemptId))).toMatchObject(
    { state: "settled", heldMicros: 0, estimatedMicros: 10 },
  );
});

import { fixture as researchFixture } from "../../tests/research-fixture";
async function protectedDraft(
  f: Awaited<ReturnType<typeof publishingFixture>>,
) {
  const r = await researchFixture(["x-recent"], 300, f);
  await r.t.run(async (ctx) =>
    ctx.db.patch(r.accountId, {
      providerIdentity: "123",
      xEvidence: (await ctx.db.get(f.accountId))!.xEvidence,
    }),
  );
  // Use the real source/evidence/handoff chain, attaching to the metrics account's draft below.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        data: [
          {
            id: "876543",
            text: "Controlled protected source",
            created_at: new Date(Date.now() - 60000).toISOString(),
          },
        ],
      }),
    ),
  );
  const orderId = await r.start();
  await r.t.action(internal.research.execute.execute, {
    orderId,
    generation: 1,
  });
  const source = (
    await r.signed.query(api.research.native.results, {
      workspaceId: r.workspaceId,
      orderId,
    })
  )[0].sources[0];
  const evidenceId = await r.signed.mutation(api.research.evidence.create, {
    workspaceId: r.workspaceId,
    orderId,
    sourceId: source.sourceId,
    expectedMaterialHash: source.materialHash,
    commandKey: "spec-evidence",
    annotation: {
      claim: "Controlled source",
      quote: "Controlled protected source",
      interpretation: "Controlled",
      gaps: [],
      relevance: "Relevant",
      novelty: "Unknown",
      uncertainty: "Unverified",
      freshness: "context-dependent",
      validityReason: "Bounded",
      consequentialOrContested: false,
      eventBased: false,
    },
  });
  const [copy] = await r.signed.mutation(api.research.handoff.consume, {
    workspaceId: r.workspaceId,
    accountId: r.accountId,
    evidenceIds: [evidenceId],
    intent: "Controlled copy",
    target: "draft",
    requestedCount: 1,
    commandKey: "spec-copy",
  });
  return { ...r, source, copy };
}
test("TASK30 original feedback horizon is enforced server-side and physically cleared after current budget renewal", async () => {
  const f = await publishingFixture();
  const r = await protectedDraft(f);
  const ver = (await r.t.run((ctx) => ctx.db.get(r.copy.draftVersionId!)))!;
  const before = Date.now();
  // Budget expiry is a genuine current-proof horizon, independent from retained source/copy horizon.
  const budget = await r.t.run(async (ctx) => {
    const b = (await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `native:account:${r.accountId}`))
      .unique())!;
    await ctx.db.patch(b._id, { expiresAt: before + 10000 });
    return b;
  });
  const d = (await r.t.run((ctx) => ctx.db.get(r.copy.draftId!)))!;
  await r.signed.mutation(api.editorial.save, {
    workspaceId: r.workspaceId,
    draftId: d._id,
    expectedRevision: d.revision,
    content: { ...ver.content, text: ["Changed protected text"] },
    reason: "Spec edit",
  });
  const feedback = (
    await r.signed.query(api.content.feedback.list, {
      workspaceId: r.workspaceId,
      accountId: r.accountId,
    })
  ).find((x) => x.kind === "edit")!;
  expect(feedback.sourceUntil).toBe(before + 10000);
  expect(feedback.editExtent).toBeGreaterThan(0);
  await r.t.run((ctx) =>
    ctx.db.patch(budget._id, { expiresAt: budget.expiresAt }),
  );
  vi.setSystemTime(before + 10000);
  const expired = (
    await r.signed.query(api.content.feedback.list, {
      workspaceId: r.workspaceId,
      accountId: r.accountId,
    })
  ).find((x) => x._id === feedback._id)!;
  expect(expired).toMatchObject({ editExtent: null, sourceUnavailable: true });
  expect(
    (await r.t.run((ctx) => ctx.db.get(feedback._id)))?.editExtent,
  ).toBeGreaterThan(0);
  await r.t.mutation(internal.content.feedback.sweep, { cursor: null });
  const stored = await r.t.run((ctx) => ctx.db.get(feedback._id));
  const projected = (
    await r.signed.query(api.content.feedback.list, {
      workspaceId: r.workspaceId,
      accountId: r.accountId,
    })
  ).find((x) => x._id === feedback._id)!;

  expect
    .soft(
      stored?.editExtent,
      "expired derived extent must be physically cleared",
    )
    .toBeNull();
  expect
    .soft(
      projected.editExtent,
      "fresh server query must not return expired original derived extent",
    )
    .toBeNull();
});

test("TASK30 original assessment horizon remains binding after renewal across reads, history, cache and fresh analysis", async () => {
  const f = await publishingFixture();
  const r = await protectedDraft(f);
  // Release the first fixture's identity binding so this separate owned account can use the same synthetic provider identity.
  await r.t.run(async (ctx) => {
    for (const b of await ctx.db.query("xBindings").collect())
      await ctx.db.delete(b._id);
    const c = await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    await ctx.db.delete(c!._id);
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", "jev:provider"))
      .unique();
    await ctx.db.delete(b!._id);
    const w = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `jev:workspace:${f.workspaceId}`))
      .unique();
    await ctx.db.delete(w!._id);
  });
  const g = await publishingFixture(true, r, r.accountId, {
    draftId: r.copy.draftId!,
    draftVersionId: r.copy.draftVersionId!,
  });
  const before = Date.now();
  const budget = await g.t.run(async (ctx) => {
    const b = (await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `native:account:${r.accountId}`))
      .unique())!;
    await ctx.db.patch(b._id, { expiresAt: before + 10000 });
    return b;
  });
  await analyze(g, "spec-original-horizon");
  await g.send();
  await g.confirm();
  const k = (await knowledge(g))!;
  expect(k.assessmentId).not.toBeNull();
  const a = (await g.t.run((ctx) => ctx.db.get(k.assessmentId!)))!;
  expect(a.sourceUntil).toBe(before + 10000);
  await g.t.run((ctx) =>
    ctx.db.patch(budget._id, { expiresAt: budget.expiresAt }),
  );
  vi.setSystemTime(before + 10001);
  const view = await g.signed.query(api.performance.snapshots.overview, g.args);
  const current = view.posts.find((x) => x.postAttemptId === g.first._id)!;
  expect
    .soft(
      current.knowledge?.assessment,
      "expired original assessment must be unavailable even if current proof renewed",
    )
    .toBeNull();
  const target = {
    ...g.args,
    draftId: g.request.draftId,
    draftVersionId: g.request.draftVersionId,
  };
  expect(
    (await g.signed.query(api.intelligence.assessments.get, target)).assessment,
  ).toBeNull();
  expect(
    (
      await g.signed.query(api.intelligence.assessments.history, {
        ...g.args,
        draftId: g.request.draftId,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page,
  ).toEqual([]);
  expect(
    (
      await g.signed.mutation(internal.intelligence.assessments.prepare, {
        ...target,
        operationKey: "new-expired-cache-probe",
      })
    ).cached,
  ).toBeNull();
  await expect(
    g.signed.mutation(internal.intelligence.assessments.prepare, {
      ...target,
      operationKey: "spec-original-horizon",
    }),
  ).rejects.toThrow("JEV_SOURCE_CHANGED");
  await analyze(g, "fresh-authorized-renewed-analysis");
  const fresh = (await g.signed.query(api.intelligence.assessments.get, target))
    .assessment!;
  expect(fresh).not.toBeNull();
  expect(fresh._id).not.toBe(a._id);
  expect(fresh.sourceUntil).toBeGreaterThan(Date.now());
  expect(await analyze(g, "fresh-authorized-renewed-analysis")).toMatchObject({
    cached: true,
  });
  expect(
    (await g.signed.query(api.performance.snapshots.overview, g.args)).posts[0]
      .knowledge,
  ).toMatchObject({ assessmentId: a._id, assessment: null });
  await g.t.mutation(internal.intelligence.assessments.sweep, { cursor: null });
  expect
    .soft(
      await g.t.run((ctx) => ctx.db.get(a._id)),
      "expired original assessment must be physically removed",
    )
    .toBeNull();
});

test("TASK30 renewed permission cannot make expired assessment available at a new first send", async () => {
  const f = await publishingFixture();
  const r = await protectedDraft(f);
  // Release the first fixture's identity binding so this separate owned account can use the same synthetic provider identity.
  await r.t.run(async (ctx) => {
    for (const b of await ctx.db.query("xBindings").collect())
      await ctx.db.delete(b._id);
    const c = await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    await ctx.db.delete(c!._id);
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", "jev:provider"))
      .unique();
    await ctx.db.delete(b!._id);
    const w = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `jev:workspace:${f.workspaceId}`))
      .unique();
    await ctx.db.delete(w!._id);
  });
  const g = await publishingFixture(true, r, r.accountId, {
    draftId: r.copy.draftId!,
    draftVersionId: r.copy.draftVersionId!,
  });
  const before = Date.now();
  const budget = await g.t.run(async (ctx) => {
    const b = (await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `native:account:${r.accountId}`))
      .unique())!;
    await ctx.db.patch(b._id, { expiresAt: before + 10000 });
    return b;
  });
  await analyze(g, "spec-original-horizon");
  const a = (
    await g.signed.query(api.intelligence.assessments.get, {
      ...g.args,
      draftId: g.request.draftId,
      draftVersionId: g.request.draftVersionId,
    })
  ).assessment!;
  expect(a.sourceUntil).toBe(before + 10000);
  await g.t.run((ctx) =>
    ctx.db.patch(budget._id, { expiresAt: budget.expiresAt }),
  );
  vi.setSystemTime(before + 10001);
  expect(await g.send()).toBe(true);
  await g.confirm();
  expect(await knowledge(g)).toMatchObject({
    assessmentId: null,
    applicable: false,
    reason: "NO_ASSESSMENT_AT_PUBLISH",
  });
});
