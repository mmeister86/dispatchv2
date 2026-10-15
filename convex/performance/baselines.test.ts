import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { jevFixture } from "../../tests/jev-fixture";
const overview = makeFunctionReference<"query">(
  "performance/snapshots:overview",
);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
test("TASK42 own account baseline is explicitly partial and unavailable without actual observations", async () => {
  const f = await jevFixture(true);
  const result = await f.signed.query(overview, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
  });
  expect(result).toHaveProperty("baseline");
  expect(result.baseline).toMatchObject({
    version: "own-baseline-v1",
    coverage: { partial: true, nativeAttemptLimit: 20 },
    cohorts: [],
    followerGrowth: null,
  });
});

import { describe, type BaselinePost } from "./baselines";
import type { Doc } from "../_generated/dataModel";
const now = Date.parse("2026-10-06T12:00Z");
function post(
  id: string,
  value: number | null = 100,
  options: Record<string, unknown> = {},
): BaselinePost {
  const created = now - 86400000;
  return {
    scheduleId: id,
    versionId: `version-${id}`,
    externalId: id,
    position: 0,
    coverage: { confirmed: 1, total: 1 },
    mediaType: "none",
    topic: "Published topic",
    topicUntil: now + 10000,
    timezone: "Europe/Berlin",
    snapshots: [
      {
        _id: `snapshot-${id}`,
        windowHours: 24,
        state: "observed",
        observedAt: now,
        providerCreatedAt: created,
        expiresAt: now + 10000,
        definitionVersion: "v1",
        dialect: "post-fields-repost-v2",
        fields: [
          {
            name: "impressions",
            rawField: "public_metrics.impression_count",
            definition: "Repeated impressions",
            status: value === null ? "missing" : "measured",
            value,
          },
          ...["likes", "replies", "reposts", "quotes", "url_clicks"].map(
            (name) => ({
              name,
              rawField: `public_metrics.${name}`,
              definition: name,
              status: "measured",
              value: 0,
            }),
          ),
        ],
        ...options,
      } as unknown as Doc<"performanceSnapshots">,
    ],
  };
}
test("TASK42 distinct units exclude own target and preserve measured zero and exact weighted rate denominators", () => {
  const p = post("a", 100),
    q = post("b", 300),
    z = post("z", 0),
    m = post("missing", null);
  q.snapshots[0].fields[1].value = 40;
  const result = describe([p, q, p, z, m], now);
  expect(result.cohorts).toHaveLength(1);
  const c = result.cohorts[0];
  expect(c.n).toBe(3);
  expect(
    c.metrics.find((x: { name: string }) => x.name === "impressions"),
  ).toMatchObject({
    n: 3,
    sum: 400,
    mean: 400 / 3,
    missing: [{ reason: "missing", n: 1 }],
  });
  expect(c.units.find((x: { id: string }) => x.id === "a")).toMatchObject({
    peerN: 2,
    baseline: 150,
  });
  expect(
    c.rates.find((x: { name: string }) => x.name === "engagement"),
  ).toMatchObject({
    n: 2,
    numerator: 40,
    denominator: 400,
    value: 0.1,
    missing: [
      { reason: "zero-denominator", n: 1 },
      { reason: "missing", n: 1 },
    ],
  });
});
test("TASK42 provider age is required and late observations never become fixed age peers", () => {
  const result = describe(
    [
      post("a"),
      post("unknown", 100, { providerCreatedAt: null }),
      post("late", 100, { observedAt: now + 60001 }),
    ],
    now,
  );
  expect(result.cohorts[0].metrics[0]).toMatchObject({
    n: 1,
    missing: [
      { reason: "missing-provider-time", n: 1 },
      { reason: "outside-age-window", n: 1 },
    ],
  });
  expect(result.cohorts[0].units[0]).toMatchObject({
    peerN: 0,
    baseline: null,
  });
});
test("TASK42 whole thread requires every immutable position, counts once and excludes whole target", () => {
  const a = post("a"),
    b = post("b");
  a.scheduleId = b.scheduleId = "thread";
  b.versionId = a.versionId;
  a.coverage = b.coverage = { confirmed: 2, total: 2 };
  b.position = 1;
  const partial = post("partial");
  partial.coverage = { confirmed: 1, total: 2 };
  const result = describe([a, b, partial], now);
  expect(result.cohorts[0].n).toBe(1);
  expect(result.cohorts[0].metrics[0]).toMatchObject({
    n: 1,
    sum: 200,
    missing: [{ reason: "incomplete-thread", n: 1 }],
  });
  expect(result.cohorts[0].units[0]).toMatchObject({
    id: "thread",
    peerN: 0,
    baseline: null,
    covered: 2,
    total: 2,
  });
});
test("TASK42 sparse chart keeps absent days unknown and incompatible definition/media cohorts separate", () => {
  const a = post("a"),
    b = post("b");
  b.snapshots[0].providerCreatedAt! -= 2 * 86400000;
  b.snapshots[0].observedAt! -= 2 * 86400000;
  const changed = post("other", 20, { definitionVersion: "v2" });
  changed.mediaType = "unknown";
  const result = describe([a, b, changed], now);
  expect(result.cohorts).toHaveLength(2);
  const chart = result.cohorts[0].chart;
  expect(chart.map((x: { value: number | null }) => x.value)).toEqual([
    100,
    null,
    100,
  ]);
  expect(chart[1]).toMatchObject({ n: 0, value: null });
});

test("TASK42 live reader carries original source expiry, immutable topic and exact then knowledge ID", async () => {
  const f = await measuredFixture();
  const result = await f.signed.query(overview, f.args);
  expect(result.baseline.cohorts).toHaveLength(1);
  expect(result.baseline.cohorts[0]).toMatchObject({
    until: now + 10000,
    metrics: expect.arrayContaining([
      expect.objectContaining({ name: "impressions", n: 1, sum: 100 }),
    ]),
  });
  expect(result.baseline.cohorts[0].units[0]).toMatchObject({
    topic: "Original pillar",
    versionIds: [f.versionId],
    baseline: null,
  });
  expect(result.posts[0].knowledge).toMatchObject({
    id: f.knowledgeId,
    assessmentId: null,
  });
  await f.t.run(async (ctx) =>
    ctx.db.patch(f.versionId, {
      content: {
        ...(await ctx.db.get(f.versionId))!.content,
        pillar: "New unrelated draft edit",
      },
      sourceUnavailable: true,
    }),
  );
  const masked = await f.signed.query(overview, f.args);
  expect(masked.baseline.cohorts[0].units[0].topic).toBeNull();
  await f.t.run(async (ctx) => ctx.db.patch(f.budgetId, { expiresAt: now }));
  expect((await f.signed.query(overview, f.args)).baseline.cohorts).toEqual([]);
});
async function measuredFixture() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const f = await jevFixture(true),
    accountId = f.request.accountId,
    args = { workspaceId: f.workspaceId, accountId };
  const ids = await f.t.run(async (ctx) => {
    const common = {
      ...args,
      version: "test-v1",
      approvedBy: f.userId,
      expiresAt: now + 86400000,
      purpose: "own-post-descriptive-editorial-v1" as const,
      dialect: "post-fields-repost-v2" as const,
      accessEvidence: "synthetic",
      rightsEvidence: "synthetic",
      pricingEvidence: "synthetic",
      protocolEvidence: "synthetic",
      allocationEvidence: "synthetic",
      fields: [
        "impressions",
        "likes",
        "replies",
        "reposts",
        "quotes",
        "url_clicks",
      ],
      unit: "single-post-request" as const,
      unitMicros: 1,
      currency: "USD",
      retentionMs: 86400000,
      connectionSequence: 1,
      providerIdentity: "123",
      allocatedProviderLimitMicros: 1000,
    };
    await ctx.db.patch(accountId, {
      providerIdentity: "123",
      xEvidence: {
        scopes: ["tweet.read", "users.read"],
        identityVerifiedAt: now,
        connectionSequence: 1,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "unverified",
      },
    });
    await ctx.db.insert("xBindings", {
      ...args,
      providerIdentity: "123",
      changedAt: now,
    });
    await ctx.db.insert("xCredentials", {
      ...args,
      generation: 1,
      envelope: {
        version: 1,
        keyId: "synthetic",
        iv: "test",
        ciphertext: "test",
      },
      scopes: ["tweet.read", "users.read"],
      expiresAt: now + 86400000,
      leaseUntil: 0,
      cleanAfter: Number.MAX_SAFE_INTEGER,
    });
    const policyId = await ctx.db.insert("performancePolicies", common);
    await ctx.db.insert("performanceControls", {
      ...args,
      enabled: true,
      deleted: false,
      generation: 1,
      actorId: f.userId,
      connectionSequence: 1,
      updatedAt: now,
    });
    const budgetIds = [];
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      budgetIds.push(
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
          expiresAt: now + 86400000,
          limitMicros: 1000,
          heldMicros: 0,
          spentMicros: 1,
        }),
      );
    const versionId = f.request.draftVersionId,
      v = (await ctx.db.get(versionId))!;
    await ctx.db.patch(versionId, {
      content: {
        ...v.content,
        text: ["Published single post"],
        pillar: "Original pillar",
      },
    });
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: f.workspaceId,
      draftId: f.request.draftId,
      versionId,
      accountId,
      actorId: f.userId,
      createdAt: now - 86400000,
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      ...args,
      draftId: f.request.draftId,
      versionId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at: now - 86400000,
      timezone: "Europe/Berlin",
      localTime: "2026-10-05T14:00",
      state: "published",
      publishedCount: 1,
      errorCode: null,
      jobId: null,
    });
    const postAttemptId = await ctx.db.insert("xPostAttempts", {
      ...args,
      scheduleId,
      generation: 1,
      versionId,
      providerIdentity: "123",
      connectionSequence: 1,
      position: 0,
      attempt: 1,
      claimSequence: 1,
      leaseUntil: 0,
      deadline: now,
      stage: "confirmed",
      mediaIds: [],
      externalId: "101",
      confirmedAt: now - 86400000,
      durationMs: 1,
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
    });
    await ctx.db.patch(scheduleId, {
      externalPosts: [
        {
          position: 0,
          externalId: "101",
          url: "https://x.com/i/web/status/101",
          attemptId: postAttemptId,
          confirmedAt: now - 86400000,
        },
      ],
    });
    const knowledgeId = await ctx.db.insert("publicationKnowledge", {
      ...args,
      postAttemptId,
      scheduleId,
      generation: 1,
      versionId,
      providerIdentity: "123",
      network: "x",
      capturedAt: now - 86400000,
      assessmentId: null,
      applicable: false,
      reason: "NO_ASSESSMENT",
    });
    const snapshotId = await ctx.db.insert("performanceSnapshots", {
      ...args,
      postAttemptId,
      scheduleId,
      versionId,
      externalId: "101",
      position: 0,
      confirmedAt: now - 86400000,
      windowHours: 24,
      dueAt: now,
      generation: 1,
      state: "observed",
      attemptId: null,
      requestedAt: now,
      observedAt: now,
      providerCreatedAt: now - 86400000,
      definitionVersion: "test-v1",
      dialect: "post-fields-repost-v2",
      fields: post("seed").snapshots[0].fields,
      reason: null,
      expiresAt: now + 10000,
    });
    const { fingerprint } = await import("./capabilities");
    const attemptId = await ctx.db.insert("aiAttempts", {
      ...args,
      owner: "own-metrics",
      provider: "x",
      purpose: "own-post-descriptive-editorial-v1",
      snapshotId,
      policyId,
      policyFingerprint: await fingerprint((await ctx.db.get(policyId))!),
      policyVersion: "test-v1",
      generation: 1,
      credentialGeneration: 1,
      budgetIds,
      currency: "USD",
      unit: "single-post-request",
      unitMicros: 1,
      reservedMicros: 1,
      heldMicros: 0,
      estimatedMicros: 1,
      billedMicros: null,
      state: "settled",
      sentAt: now,
      settledAt: now,
      receiptFingerprint: "synthetic",
      errorCode: null,
    });
    await ctx.db.patch(snapshotId, { attemptId });
    return {
      versionId,
      knowledgeId,
      snapshotId,
      policyId,
      budgetId: budgetIds[2],
    };
  });
  return { ...f, ...ids, args };
}
const contextRead = makeFunctionReference<"query">(
  "content/performance:context",
);
const configureContext = makeFunctionReference<"mutation">(
  "content/performance:configure",
);
const consentContext = makeFunctionReference<"mutation">(
  "content/performance:consent",
);
test("TASK42 mounted Content contract is separately default off, exact purpose bound, no copies or TTL renewal", async () => {
  const f = await measuredFixture();
  expect(await f.signed.query(contextRead, f.args)).toMatchObject({
    reason: "PERFORMANCE_CONTENT_CONFIGURATION_REQUIRED",
    enabled: false,
    entries: [],
  });
  const policyId = await f.t.mutation(configureContext, {
    ...f.args,
    version: "context-v1",
    purpose: "own-performance-human-content-v1",
    rightsEvidence: "Synthetic human Content processing permission only",
    approvedBy: f.userId,
    expiresAt: now + 60000,
  });
  let context = await f.signed.query(contextRead, f.args);
  expect(context).toMatchObject({
    reason: "PERFORMANCE_CONTENT_PAUSED",
    enabled: false,
    entries: [],
  });
  await expect(
    f.signed.mutation(consentContext, {
      ...f.args,
      enabled: true,
      policyId,
      policyFingerprint: "stale",
    }),
  ).rejects.toThrow("PERFORMANCE_CONTENT_POLICY_CHANGED");
  await f.signed.mutation(consentContext, {
    ...f.args,
    enabled: true,
    policyId,
    policyFingerprint: context.configuration.fingerprint,
  });
  context = await f.signed.query(contextRead, f.args);
  expect(context.entries[0]).toMatchObject({
    kind: "performance_signal",
    expiresAt: now + 10000,
    snapshotIds: [f.snapshotId],
    knowledgeIds: [f.knowledgeId],
    assessmentIds: [],
    versionIds: [f.versionId],
    asOf: now,
  });
  const summary = context.entries[0].summary;
  expect(summary).toContain("n=1");
  expect(summary).toContain("deskriptiv");
  vi.setSystemTime(now + 10001);
  expect((await f.signed.query(contextRead, f.args)).entries).toEqual([]);
  vi.setSystemTime(now);
  await f.signed.mutation(
    makeFunctionReference<"mutation">("performance/capabilities:remove"),
    f.args,
  );
  expect((await f.signed.query(contextRead, f.args)).entries).toEqual([]);
});
test("TASK42 cohort warning counts eligible reference units and uses each thread member's own provider age", () => {
  const valid = post("valid"),
    unknown = post("unknown", 100, { providerCreatedAt: null }),
    late = post("late", 100, { observedAt: now + 60001 });
  const c = describe([valid, unknown, late], now).cohorts[0];
  expect(c).toMatchObject({ n: 1, attempted: 3, ineligible: 2, small: true });
  const a = post("a"),
    b = post("b");
  a.scheduleId = b.scheduleId = "thread";
  b.versionId = a.versionId;
  a.coverage = b.coverage = { confirmed: 2, total: 2 };
  b.position = 1;
  b.snapshots[0].observedAt! += 500;
  b.snapshots[0].providerCreatedAt! += 500;
  const unit = describe([b, a], now).cohorts[0].units[0];
  expect(unit.observedAgeMs).toBe(86400000);
  expect(unit.observedAgesMs).toEqual([
    { externalId: "b", ageMs: 86400000 },
    { externalId: "a", ageMs: 86400000 },
  ]);
});
test("TASK42 unknown media retains coverage but cannot become heterogeneous baseline support", () => {
  const p = post("unknown");
  p.mediaType = "unknown";
  const c = describe([p], now).cohorts[0];
  expect(c).toMatchObject({ n: 0, attempted: 1, ineligible: 1, small: true });
  expect(c.metrics[0].mean).toBeNull();
  expect(c.units[0].reason).toBe("unknown-media-format");
});
test("TASK42 finalized immutable media identity separates image and video cohorts", async () => {
  const f = await measuredFixture();
  await f.t.run(async (ctx) => {
    const assetId = await ctx.db.insert("mediaAssets", {
      workspaceId: f.workspaceId,
      storageProvider: "r2",
      objectKey: "synthetic-image",
      checksum: "synthetic-checksum",
      name: "Image",
      type: "image",
      size: 1,
      state: "ready",
      mime: "image/png",
    });
    const v = (await ctx.db.get(f.versionId))!;
    await ctx.db.patch(f.versionId, {
      content: { ...v.content, media: [{ assetId, alt: "Synthetic" }] },
      mediaChecksums: [
        {
          assetId,
          objectKey: "synthetic-image",
          checksum: "synthetic-checksum",
        },
      ],
    });
  });
  const read = await f.signed.query(overview, f.args);
  expect(read.baseline.cohorts[0].media).toBe("image");
  expect(read.baseline.cohorts[0].n).toBe(1);
});
async function enabledContext() {
  const f = await measuredFixture();
  const policyId = await f.t.mutation(configureContext, {
    ...f.args,
    version: "context-v1",
    purpose: "own-performance-human-content-v1",
    rightsEvidence: "Synthetic human read only",
    approvedBy: f.userId,
    expiresAt: now + 60000,
  });
  const r = await f.signed.query(contextRead, f.args);
  await f.signed.mutation(consentContext, {
    ...f.args,
    enabled: true,
    policyId,
    policyFingerprint: r.configuration.fingerprint,
  });
  return { ...f, contextPolicyId: policyId };
}
test("TASK42 Content read immediately masks numeric grant, connection and purpose revocation", async () => {
  const f = await enabledContext();
  expect((await f.signed.query(contextRead, f.args)).entries).toHaveLength(1);
  await f.t.run(async (ctx) => ctx.db.patch(f.budgetId, { purposes: [] }));
  expect((await f.signed.query(contextRead, f.args)).entries).toEqual([]);
  await f.t.run(async (ctx) =>
    ctx.db.patch(f.budgetId, { purposes: ["own-metrics"] }),
  );
  await f.signed.mutation(consentContext, { ...f.args, enabled: false });
  expect((await f.signed.query(contextRead, f.args)).entries).toEqual([]);
  const r = await f.signed.query(contextRead, f.args);
  await f.signed.mutation(consentContext, {
    ...f.args,
    enabled: true,
    policyId: f.contextPolicyId,
    policyFingerprint: r.configuration.fingerprint,
  });
  await f.t.run(async (ctx) =>
    ctx.db.patch(f.args.accountId, { connection: "disconnected" }),
  );
  expect((await f.signed.query(contextRead, f.args)).entries).toEqual([]);
});
test("TASK42 Content policy renewal needs fresh approval and never extends original snapshot deadline", async () => {
  const f = await enabledContext();
  const next = await f.t.mutation(configureContext, {
    ...f.args,
    version: "context-v2",
    purpose: "own-performance-human-content-v1",
    rightsEvidence: "Synthetic renewed human read only",
    approvedBy: f.userId,
    expiresAt: now + 86400000,
  });
  const r = await f.signed.query(contextRead, f.args);
  expect(r).toMatchObject({ enabled: false, entries: [] });
  await f.signed.mutation(consentContext, {
    ...f.args,
    enabled: true,
    policyId: next,
    policyFingerprint: r.configuration.fingerprint,
  });
  expect((await f.signed.query(contextRead, f.args)).entries[0].expiresAt).toBe(
    now + 10000,
  );
  vi.setSystemTime(now + 10000);
  expect((await f.signed.query(contextRead, f.args)).entries).toEqual([]);
});
test("TASK42 Content rejects cross-tenant references and source account removal, without persisted derivative copies", async () => {
  const f = await enabledContext();
  const foreign = await f.t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Other",
      description: "Other",
    });
    const a = (await ctx.db.get(f.args.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return ctx.db.insert("socialAccounts", { ...fields, workspaceId });
  });
  await expect(
    f.signed.query(contextRead, { ...f.args, accountId: foreign }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  const versions = await f.t.run((ctx) =>
    ctx.db.query("ideaVersions").collect(),
  );
  await f.signed.query(contextRead, f.args);
  expect(
    await f.t.run((ctx) => ctx.db.query("ideaVersions").collect()),
  ).toEqual(versions);
  await f.t.run((ctx) => ctx.db.delete(f.args.accountId));
  await expect(f.signed.query(contextRead, f.args)).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
});
test("TASK42 publication filters select actual provider time, age and structural format and preserve partial coverage", async () => {
  const f = await measuredFixture();
  const r = await f.signed.query(overview, {
    ...f.args,
    from: now - 86400000,
    to: now,
    windowHours: 24,
    format: "post",
  });
  expect(r.baseline.cohorts[0].n).toBe(1);
  expect(
    (await f.signed.query(overview, { ...f.args, from: now, windowHours: 24 }))
      .baseline.cohorts,
  ).toEqual([]);
  expect(
    (await f.signed.query(overview, { ...f.args, windowHours: 48 })).baseline
      .cohorts,
  ).toEqual([]);
  expect(
    (await f.signed.query(overview, { ...f.args, format: "thread" })).baseline
      .cohorts,
  ).toEqual([]);
  await expect(
    f.signed.query(overview, { ...f.args, from: now, to: now - 1 }),
  ).rejects.toThrow("BASELINE_FILTER_INVALID");
});
test("TASK42 unsafe derived count sums fail closed for cohort, rates, chart and peer references", () => {
  const rows = ["a", "b", "c"].map((id) => post(id, Number.MAX_SAFE_INTEGER));
  for (const p of rows) {
    p.snapshots[0].fields[1].value = Number.MAX_SAFE_INTEGER;
    p.snapshots[0].fields[2].value = 1;
  }
  const c = describe(rows, now).cohorts[0];
  expect(c.metrics[0]).toMatchObject({ sum: null, mean: null });
  expect(c.rates[0]).toMatchObject({
    numerator: null,
    denominator: null,
    value: null,
  });
  expect(c.chart[0].value).toBeNull();
  expect(c.units[0].baseline).toBeNull();
});
test("TASK42 topic and saved-zone publication-hour summaries stay inside exact cohorts with unknowns separate", () => {
  const a = post("a", 100),
    b = post("b", 300),
    unknown = post("unknown", null);
  unknown.topic = null;
  unknown.timezone = null;
  const c = describe([a, b, unknown], now).cohorts[0];
  expect(c).toHaveProperty("segments");
  expect(c.segments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        dimension: "topic",
        label: "Published topic",
        n: 2,
        attempted: 2,
        mean: 200,
        missing: 0,
      }),
      expect.objectContaining({
        dimension: "topic",
        label: null,
        n: 0,
        attempted: 1,
        mean: null,
        missing: 1,
      }),
      expect.objectContaining({
        dimension: "publication-hour",
        label: "Mo, 14 Uhr (Europe/Berlin)",
        n: 2,
        mean: 200,
      }),
    ]),
  );
});
test("TASK42 compact actual Content rate proof retains exact components and unavailable reasons", async () => {
  const f = await enabledContext();
  await f.t.run(async (ctx) => {
    const row = (await ctx.db.get(f.snapshotId))!,
      fields = row.fields.map((x) => ({ ...x }));
    fields.find((x) => x.name === "likes")!.value = Number.MAX_SAFE_INTEGER;
    fields.find((x) => x.name === "replies")!.value = 1;
    await ctx.db.patch(f.snapshotId, { fields });
  });
  const entry = (await f.signed.query(contextRead, f.args)).entries[0];
  expect(entry.denominators[0]).toMatchObject({
    components: ["likes", "replies", "reposts", "quotes"],
    n: 0,
    numerator: null,
    denominator: null,
    missing: [{ reason: "unsafe-numerator", n: 1 }],
  });
});
