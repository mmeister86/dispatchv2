import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { jevFixture } from "../../jev-fixture";
const get = makeFunctionReference<"query">("performance/calibration:get");
const configure = makeFunctionReference<"mutation">(
  "performance/calibration:configurePurpose",
);
const consent = makeFunctionReference<"mutation">(
  "performance/calibration:consent",
);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("registered local purpose is default OFF; numeric and Jev rights are not inherited", async () => {
  const f = await jevFixture(true);
  const args = { workspaceId: f.workspaceId, accountId: f.request.accountId };
  expect(await f.signed.query(get, args)).toMatchObject({
    enabled: false,
    reason: "CALIBRATION_CONFIGURATION_REQUIRED",
    configuration: null,
    specs: [],
    snapshots: [],
  });
  await expect(
    f.signed.mutation(consent, {
      ...args,
      purposeId: f.request.accountId,
      purposeFingerprint: "fake",
      enabled: true,
      commandKey: "not-consented",
    }),
  ).rejects.toThrow();
});
test("inert immutable configuration needs exact separate consent; revoked version never re-enables", async () => {
  const f = await jevFixture(true);
  const args = { workspaceId: f.workspaceId, accountId: f.request.accountId };
  const input = {
    ...args,
    version: "synthetic-local-v1",
    target: "dispatch-local-reply-ordering-v1",
    providerIdentity: "synthetic",
    rightsEvidence:
      "Synthetic isolated DB permission covers analysis derivatives and measured outcomes",
    explanation: "Local reply ordering only; no Jev training",
    approvedBy: f.userId,
    expiresAt: Date.now() + 86400000,
    retentionMs: 86400000,
  };
  const id = await f.t.mutation(configure, input);
  expect(await f.t.mutation(configure, input)).toBe(id);
  await expect(
    f.t.mutation(configure, { ...input, explanation: "conflict" }),
  ).rejects.toThrow("CALIBRATION_PURPOSE_VERSION_CONFLICT");
  const view = await f.signed.query(get, args);
  expect(view.enabled).toBe(false);
  const command = {
    ...args,
    purposeId: id,
    purposeFingerprint: view.configuration.fingerprint,
    enabled: true,
    commandKey: "consent-one",
  };
  await expect(
    f.signed.mutation(consent, { ...command, purposeFingerprint: "wrong" }),
  ).rejects.toThrow("CALIBRATION_PURPOSE_CHANGED");
  await f.signed.mutation(consent, command);
  await f.signed.mutation(consent, command);
  expect((await f.signed.query(get, args)).enabled).toBe(true);
  await f.signed.mutation(consent, {
    ...command,
    enabled: false,
    commandKey: "revoke-one",
  });
  await expect(f.signed.mutation(consent, command)).rejects.toThrow(
    "CALIBRATION_PURPOSE_REVOKED",
  );
});

import { api, internal } from "../../../convex/_generated/api";
import { corpus, DAY, NOW } from "./fixture";
const specFn = makeFunctionReference<"mutation">(
  "performance/calibration:createSpec",
);
const buildFn = makeFunctionReference<"mutation">(
  "performance/calibration:build",
);
test("native complete exact stratum freezes chronological train/two later blocks without training or activation", async () => {
  const f = await corpus();
  const id = await f.signed.mutation(buildFn, f.buildInput);
  expect(await f.signed.mutation(buildFn, f.buildInput)).toBe(id);
  await expect(
    f.signed.mutation(buildFn, { ...f.buildInput, asOf: Date.now() - 1 }),
  ).rejects.toThrow("CALIBRATION_REPLAY_CONFLICT");
  const view = await f.signed.query(get, f.args),
    snapshot = view.snapshots[0];
  expect(snapshot.row.payload).toMatchObject({
    counts: { n: 3, train: 1, block1: 1, block2: 1 },
    frameComplete: true,
    populationTotal: 3,
    engineeringScreen: false,
    empiricalStatus: "unconfigured",
    activationEligible: false,
    exclusions: [],
  });
  expect(snapshot.measurements[0]).toMatchObject({
    replies: 2,
    impressions: 100,
    rate: 0.02,
  });
  expect(view.specs[0].payload).toMatchObject({
    empiricalPolicy: null,
    prospectiveStatus: "retrospective-diagnostic",
    activationEligible: false,
  });
  expect(view.specs[0].payload.transfers).toEqual([
    -0.1, -0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.1,
  ]);
  expect(view.specs[0].payload.anchor.sourceUntil).toBeNull();
  // Collection is paused and all budget units spent; retained read does not reserve or admit a new Jev request.
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.setup.budgetIds[0])))!.spentMicros,
  ).toBe(1000);
  await f.t.run(async (ctx) => {
    const algorithm = (await ctx.db.get(f.request.algorithmId))!;
    await ctx.db.patch(algorithm._id, {
      payload: { ...algorithm.payload, reviewDueAt: NOW - 2 * DAY },
    });
  });
  // Profile payload change breaks exact identity, even a review deadline change; no silent pooling.
  expect((await f.signed.query(get, f.args)).snapshots).toEqual([]);
});
test.each([
  "null-pointer",
  "late-capture",
  "missing-send",
  "unknown-model",
  "zero",
  "unsafe",
  "late-age",
  "future-observation",
  "incompatible",
  "thread",
  "media",
  "straddling",
] as const)(
  "native exclusion %s remains visible without score repair",
  async (kind) => {
    const f = await corpus(),
      u = f.units[1];
    await f.t.run(async (ctx) => {
      const a = (await ctx.db.get(u.assessmentId))!,
        snap = (await ctx.db.get(u.snapshotId))!;
      if (kind === "null-pointer")
        await ctx.db.patch(u.knowledgeId, { assessmentId: null });
      if (kind === "late-capture")
        await ctx.db.patch(u.knowledgeId, { capturedAt: NOW });
      if (kind === "missing-send")
        await ctx.db.patch(u.postAttemptId, { requestStartedAt: undefined });
      if (kind === "unknown-model") {
        await ctx.db.patch(u.analysisReceiptId, { resolvedModel: null });
        await ctx.db.patch(u.assessmentId, {
          provenance: { ...a.provenance, resolvedModel: null },
        });
      }
      if (kind === "zero" || kind === "unsafe")
        await ctx.db.patch(u.snapshotId, {
          fields: snap.fields.map((x) =>
            x.name === "impressions"
              ? {
                  ...x,
                  value: kind === "zero" ? 0 : Number.MAX_SAFE_INTEGER + 1,
                }
              : x,
          ),
        });
      if (kind === "late-age")
        await ctx.db.patch(u.snapshotId, {
          observedAt: snap.observedAt! + 60001,
        });
      if (kind === "future-observation")
        await ctx.db.patch(u.snapshotId, { observedAt: NOW + DAY });
      if (kind === "incompatible") {
        await ctx.db.patch(u.analysisReceiptId, {
          resolvedModel: "other-model",
        });
        await ctx.db.patch(u.assessmentId, {
          provenance: { ...a.provenance, resolvedModel: "other-model" },
        });
      }
      if (kind === "thread" || kind === "media") {
        const ver = (await ctx.db.get(u.versionId))!;
        await ctx.db.patch(ver._id, {
          content: {
            ...ver.content,
            ...(kind === "thread"
              ? { text: ["one", "two"] }
              : {
                  media: [
                    {
                      assetId: await ctx.db.insert("mediaAssets", {
                        workspaceId: f.workspaceId,
                        name: "synthetic",
                        mime: "image/png",
                        type: "image",
                        state: "deleted",
                        size: 0,
                        storageProvider: "r2",
                        objectKey: "synthetic",
                        checksum: "synthetic",
                      }),
                      alt: "",
                    },
                  ],
                }),
          },
        });
      }
      if (kind === "straddling")
        await ctx.db.patch(u.snapshotId, {
          observedAt: snap.observedAt! + 2000,
        });
    });
    await f.signed.mutation(buildFn, f.buildInput);
    const row = (await f.signed.query(get, f.args)).snapshots[0].row;
    expect(row.payload.counts.n).toBe(2);
    expect(row.payload.exclusions).toHaveLength(1);
    expect(row.payload.exclusions[0].reason).not.toBe("");
  },
);
test("201st native attempt is an incomplete frame with unknown population; dedup never multiplies independent n", async () => {
  const f = await corpus();
  await f.t.run(async (ctx) => {
    const c = (await ctx.db.get(f.units[1].postAttemptId))!;
    const { _id, _creationTime, ...fields } = c;
    for (let i = 0; i < 199; i++)
      await ctx.db.insert("xPostAttempts", { ...fields, attempt: i + 2 });
  });
  await f.signed.mutation(buildFn, f.buildInput);
  const row = (await f.signed.query(get, f.args)).snapshots[0].row;
  expect(row.payload).toMatchObject({
    frameComplete: false,
    scanned: 200,
    populationTotal: null,
    populationLowerBound: 201,
    engineeringScreen: false,
    activationEligible: false,
  });
  expect(row.payload.counts.n).toBeLessThanOrEqual(3);
  expect(
    row.payload.exclusions.some(
      (x: { reason: string }) => x.reason === "duplicate-publication",
    ),
  ).toBe(true);
});
test("asOf cannot resurrect future, immature, or later-ingested labels and immutable spec is after its own consent", async () => {
  const f = await corpus();
  await expect(
    f.signed.mutation(buildFn, { ...f.buildInput, asOf: NOW + DAY }),
  ).rejects.toThrow("CALIBRATION_AS_OF_INVALID");
  await expect(
    f.signed.mutation(buildFn, { ...f.buildInput, asOf: NOW - 3 * DAY }),
  ).rejects.toThrow("CALIBRATION_SPEC_AFTER_AS_OF");
  // Same-label observation backfilled after asOf is not historical input.
  vi.setSystemTime(NOW + 4000);
  await f.t.run(async (ctx) => {
    const original = (await ctx.db.get(f.units[1].snapshotId))!;
    await ctx.db.delete(original._id);
    const { _id, _creationTime, ...fields } = original;
    const snapshotId = await ctx.db.insert("performanceSnapshots", fields);
    const t = (await ctx.db.get(original.attemptId!))!;
    if (t.owner !== "own-metrics") throw Error("wrong synthetic receipt");
    await ctx.db.patch(t._id, { snapshotId });
  });
  await f.signed.mutation(buildFn, f.buildInput);
  const row = (await f.signed.query(get, f.args)).snapshots[0].row;
  expect(row.payload.exclusions).toContainEqual({
    postAttemptId: f.units[1].postAttemptId,
    reason: "future-or-backfilled-artifact",
  });
});
test("current role and exact scope govern every command; withdrawal needs no provider credential and physically removes only own derivatives", async () => {
  const f = await corpus();
  await f.signed.mutation(buildFn, f.buildInput);
  await f.t.run(async (ctx) => {
    const m = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.patch(m._id, { role: "Viewer" });
  });
  await expect(
    f.signed.mutation(buildFn, { ...f.buildInput, commandKey: "denied" }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  expect((await f.signed.query(get, f.args)).enabled).toBe(false);
  await f.t.run(async (ctx) => {
    const m = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.patch(m._id, { role: "Owner" });
    await ctx.db.delete(f.setup.credentialId);
  });
  await f.signed.mutation(consent, {
    ...f.args,
    purposeId: f.purposeId,
    purposeFingerprint: f.purposeFingerprint,
    enabled: false,
    commandKey: "withdrawal-no-provider",
  });
  const withdrawn = await f.signed.query(get, f.args);
  expect(withdrawn.snapshots).toEqual([]);
  expect(withdrawn.configuration).toMatchObject({
    fingerprint: "",
    rightsEvidence: "",
    explanation: "",
  });
  await f.t.mutation(internal.performance.calibration.clear, {
    purposeId: f.purposeId,
    generation: 2,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("calibrationReferences").collect()),
  ).toEqual([]);
  expect(
    await f.t.run((ctx) => ctx.db.get(f.units[0].metricReceiptId)),
  ).not.toBeNull();
  await expect(
    f.signed.mutation(buildFn, { ...f.buildInput, commandKey: "after-revoke" }),
  ).rejects.toThrow();
});
test("original source/reference horizon never extends on credential renewal and sweep works with inactive workspace", async () => {
  const f = await corpus();
  await f.signed.mutation(buildFn, f.buildInput);
  const frozen = (await f.signed.query(get, f.args)).snapshots[0].row.expiresAt;
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.setup.credentialId, { expiresAt: NOW + 25 * DAY });
  });
  expect((await f.signed.query(get, f.args)).snapshots[0].row.expiresAt).toBe(
    frozen,
  );
  vi.setSystemTime(frozen + 1);
  expect((await f.signed.query(get, f.args)).snapshots).toEqual([]);
  vi.setSystemTime(NOW + 20 * DAY + 1);
  expect((await f.signed.query(get, f.args)).configuration).toMatchObject({
    fingerprint: "",
    rightsEvidence: "",
    explanation: "",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await f.t.mutation(internal.performance.calibration.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await f.t.run((ctx) => ctx.db.query("calibrationReferences").collect()),
  ).toEqual([]);
});
test("prospective spec is permanently candidate-not-frozen and no empirical policy is synthesized", async () => {
  const f = await corpus();
  const input = {
    ...f.specInput,
    commandKey: "future-spec",
    mode: "prospective" as const,
    holdout1Start: NOW + DAY,
    holdout1End: NOW + 8 * DAY,
    holdout2Start: NOW + 8 * DAY,
    holdout2End: NOW + 15 * DAY,
  };
  await f.signed.mutation(specFn, input);
  expect((await f.signed.query(get, f.args)).specs[0].payload).toMatchObject({
    prospectiveStatus: "candidate-not-frozen",
    empiricalPolicy: null,
    activationEligible: false,
  });
  await expect(
    f.signed.mutation(specFn, {
      ...input,
      commandKey: "past-prospective",
      holdout1Start: NOW - DAY,
    }),
  ).rejects.toThrow("CALIBRATION_UTC_BOUNDS_INVALID");
});

test("native read-capacity guard aborts materialization and never treats capacity as source invalidation", async () => {
  const f = await corpus();
  await expect(
    f.signed.run((ctx) =>
      ctx.runMutation(api.performance.calibration.build, f.buildInput, {
        transactionLimits: { databaseQueries: 500 },
      }),
    ),
  ).rejects.toThrow("CALIBRATION_READ_CAPACITY");
  expect(
    (
      await f.t.run((ctx) => ctx.db.query("calibrationReferences").collect())
    ).filter((r) => r.kind === "snapshot"),
  ).toEqual([]);
  await f.signed.mutation(buildFn, f.buildInput);
  await expect(
    f.t.run((ctx) =>
      ctx.runMutation(
        internal.performance.calibration.sweep,
        { cursor: null },
        { transactionLimits: { databaseQueries: 500 } },
      ),
    ),
  ).rejects.toThrow("CALIBRATION_READ_CAPACITY");
  expect((await f.signed.query(get, f.args)).snapshots).toHaveLength(1);
});
test("200-pair ceiling fails honestly; a narrower immutable native frame fits enforced platform read limits", async () => {
  const f = await corpus();
  for (let i = 0; i < 197; i++) await f.publication(NOW - 4 * DAY + i * 100);
  vi.setSystemTime(NOW + 5000);
  const args = { ...f.buildInput, asOf: Date.now() };
  await expect(
    f.signed.run((ctx) =>
      ctx.runMutation(api.performance.calibration.build, args, {
        transactionLimits: {
          databaseQueries: 4096,
          bytesRead: 16 * 1024 * 1024,
          documentsRead: 32000,
        },
      }),
    ),
  ).rejects.toThrow("CALIBRATION_READ_CAPACITY");
  expect(
    (
      await f.t.run((ctx) => ctx.db.query("calibrationReferences").collect())
    ).filter((r) => r.kind === "snapshot"),
  ).toHaveLength(0);
  const narrow = {
    ...f.specInput,
    commandKey: "narrow-spec",
    from: NOW - 4 * DAY + 157 * 100,
    fitCutoff: NOW - 3 * DAY + 20000,
    holdout1Start: NOW - 2 * DAY,
    holdout1End: NOW - DAY + 1000,
    holdout2Start: NOW + DAY,
    holdout2End: NOW + 2 * DAY,
  };
  const specId = await f.signed.mutation(specFn, narrow);
  vi.setSystemTime(NOW + 6000);
  const receipt = await f.signed.run(async (ctx) => {
    const id = await ctx.runMutation(
      api.performance.calibration.build,
      { ...args, specId, asOf: Date.now(), commandKey: "narrow-build" },
      {
        transactionLimits: {
          databaseQueries: 4096,
          bytesRead: 16 * 1024 * 1024,
          documentsRead: 32000,
        },
      },
    );
    return { id, metrics: await ctx.meta.getTransactionMetrics() };
  });
  process.stdout.write(
    "TASK43.1 enforced narrower native build transaction metrics " +
      JSON.stringify(receipt.metrics) +
      "\n",
  );
  const projected = await f.signed.run(async (ctx) => {
    const view = await ctx.runQuery(api.performance.calibration.get, f.args, {
      transactionLimits: {
        databaseQueries: 4096,
        bytesRead: 16 * 1024 * 1024,
        documentsRead: 32000,
      },
    });
    return { view, metrics: await ctx.meta.getTransactionMetrics() };
  });
  process.stdout.write(
    "TASK43.1 bounded latest-snapshot query transaction metrics " +
      JSON.stringify(projected.metrics) +
      "\n",
  );
  expect(projected.view.snapshots[0].row.payload).toMatchObject({
    frameComplete: true,
    populationTotal: 42,
    counts: { n: 41 },
    activationEligible: false,
  });
}, 20000);
test("foreign account cannot read, replay, or build an otherwise known spec", async () => {
  const f = await corpus();
  const accountId = await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(f.request.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return ctx.db.insert("socialAccounts", {
      ...fields,
      providerIdentity: "another-account",
    });
  });
  await expect(
    f.signed.mutation(buildFn, {
      ...f.buildInput,
      accountId,
      commandKey: "foreign",
    }),
  ).rejects.toThrow("CALIBRATION_SPEC_CHANGED");
  expect((await f.signed.query(get, { ...f.args, accountId })).specs).toEqual(
    [],
  );
});
