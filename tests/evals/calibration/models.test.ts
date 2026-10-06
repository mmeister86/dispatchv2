import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { corpus } from "./fixture";
import {
  orderingLoss,
  chooseTransfer,
} from "../../../convex/performance/models";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const feature = (
  score: number,
  clarity: number,
  discussion: number,
  replies: number,
  impressions = 100,
) => ({ score, clarity, discussion, replies, impressions });
test("exact event ordering counts independent observations separately from correlated pairs", () => {
  const x = [feature(50, 1, 0, 1), feature(50, 0, 1, 2), feature(50, 0, 1, 2)];
  expect(orderingLoss(x, 0)).toMatchObject({
    twiceLoss: 2,
    pairs: 2,
    targetTies: 1,
    predictionTies: 2,
    loss: 0.5,
    n: 3,
  });
  expect(chooseTransfer(x).transfer).toBe(0.025);
  expect(
    orderingLoss(
      [
        feature(1, 0, 1, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER),
        feature(
          2,
          0,
          1,
          Number.MAX_SAFE_INTEGER - 2,
          Number.MAX_SAFE_INTEGER - 1,
        ),
      ],
      0,
    ).twiceLoss,
  ).toBe(2);
  expect(
    chooseTransfer([feature(1, 0.5, 0.5, 1), feature(2, 0.5, 0.5, 2)]).transfer,
  ).toBe(0);
  expect(
    chooseTransfer([feature(1, 0.5, 0.5, 1), feature(2, 0.5, 0.5, 1)]).transfer,
  ).toBe(null);
});
test("native diagnostic experiment is immutable and a no-pairs fit cannot pretend to be perfect", async () => {
  const f = await corpus();
  const snapshotId = await f.signed.mutation(
    makeFunctionReference<"mutation">("performance/calibration:build"),
    f.buildInput,
  );
  const input = {
    ...f.args,
    specId: f.specId,
    policy: null,
    commandKey: "experiment-one",
  };
  const id = await f.signed.mutation(
    makeFunctionReference<"mutation">("performance/models:predeclare"),
    input,
  );
  expect(
    await f.signed.mutation(
      makeFunctionReference<"mutation">("performance/models:predeclare"),
      input,
    ),
  ).toBe(id);
  const candidateId = await f.signed.mutation(
    makeFunctionReference<"mutation">("performance/models:fit"),
    { ...f.args, experimentId: id, snapshotId, commandKey: "fit-one" },
  );
  const candidate = await f.t.run((ctx) =>
    ctx.db.get(candidateId as Id<"calibrationModels">),
  );
  expect(candidate?.kind).toBe("candidate");
  expect(candidate?.payload).toMatchObject({
    transfer: null,
    n: 1,
    status: "no-comparable-pairs",
    activationEligible: false,
  });
});

import { api, internal } from "../../../convex/_generated/api";
import { modelProof } from "../../../convex/performance/calibration";
import { dispatchScore } from "../../../convex/ai/scoring/dispatchScore";
import { DAY, NOW } from "./fixture";
const predeclare = makeFunctionReference<"mutation">(
    "performance/models:predeclare",
  ),
  fit = makeFunctionReference<"mutation">("performance/models:fit"),
  compare = makeFunctionReference<"mutation">("performance/models:compare"),
  getModel = makeFunctionReference<"query">("performance/models:get");
async function nativePair() {
  const f = await corpus(),
    second = f.units[1];
  await f.t.run(async (ctx) => {
    for (const [unit, clarity, discussion, replies] of [
      [f.units[0], 0.9, 0.1, 1],
      [second, 0.1, 0.9, 4],
    ] as const) {
      const a = (await ctx.db.get(unit.assessmentId))!,
        snapshot = (await ctx.db.get(unit.snapshotId))!;
      const answers = {
        ...a.result.answers!,
        clarity: { type: "score" as const, value: clarity, confidence: 1 },
        discussionPotential: {
          type: "score" as const,
          value: discussion,
          confidence: 1,
        },
      };
      await ctx.db.patch(a._id, {
        result: {
          ...a.result,
          answers,
          score: dispatchScore(answers, a.result.deterministic.structure),
        },
      });
      await ctx.db.patch(snapshot._id, {
        fields: snapshot.fields.map((x) =>
          x.name === "replies" ? { ...x, value: replies } : x,
        ),
      });
    }
  });
  vi.setSystemTime(NOW + 4000);
  const specId = await f.signed.mutation(
    api.performance.calibration.createSpec,
    {
      ...f.specInput,
      fitCutoff: NOW - 3 * DAY + 1000,
      holdout1Start: NOW - 2 * DAY,
      holdout1End: NOW - DAY + 1000,
      holdout2Start: NOW + DAY,
      holdout2End: NOW + 4 * DAY,
      commandKey: "fresh-native-model-spec",
    },
  );
  vi.setSystemTime(NOW + 5000);
  const snapshotId = await f.signed.mutation(
    api.performance.calibration.build,
    {
      ...f.buildInput,
      specId,
      asOf: Date.now(),
      commandKey: "fresh-native-model-snapshot",
    },
  );
  const experimentId = await f.signed.mutation(predeclare, {
    ...f.args,
    specId,
    policy: null,
    commandKey: "native-model-experiment",
  });
  return { ...f, second, specId, snapshotId, experimentId };
}
test("native train proof never reads heldout labels, and a heldout anchor fails before every native join", async () => {
  const f = await nativePair();
  await f.t.run(async (ctx) => {
    const reads: string[] = [],
      queries: string[] = [],
      db = ctx.db;
    const instrumented = {
      ...ctx,
      db: new Proxy(db, {
        get(target, key) {
          if (key === "get")
            return async (id: Id<"jevAssessments">) => {
              reads.push(String(id));
              return target.get(id);
            };
          if (key === "query")
            return (name: string) => {
              queries.push(name);
              return target.query(name as "performanceSnapshots");
            };
          return Reflect.get(target, key);
        },
      }),
    };
    await modelProof(instrumented, f.args, f.specId, f.snapshotId, "train");
    for (const u of f.units.slice(2))
      for (const id of [u.assessmentId, u.metricReceiptId, u.snapshotId])
        expect(reads).not.toContain(String(id));
    expect(queries.filter((x) => x === "performanceSnapshots")).toHaveLength(2);
    const spec = (await ctx.db.get(f.specId))!;
    if (spec.kind !== "spec") throw Error("fixture");
    const snapshot = (await ctx.db.get(f.snapshotId))!;
    if (snapshot.kind !== "snapshot") throw Error("fixture");
    const heldout = snapshot.payload.refs.find(
      (x) => x.membership === "block1",
    )!;
    await ctx.db.patch(spec._id, {
      payload: {
        ...spec.payload,
        anchor: { ...heldout, membership: "compatibility-anchor" },
      },
    });
    queries.length = 0;
    await expect(
      modelProof(instrumented, f.args, f.specId, f.snapshotId, "train"),
    ).rejects.toThrow("CALIBRATION_TRAIN_ANCHOR_REQUIRED");
    expect(queries).not.toContain("performanceSnapshots");
  });
});
test("corrupt heldout cannot select the native winner; exact replay and original static results remain unchanged", async () => {
  const f = await nativePair();
  const before = await f.t.run(async (ctx) => ({
    analysis: await ctx.db.get(f.units[0].assessmentId),
    financial: await ctx.db.get(f.setup.budgetIds[0]),
    receipt: await ctx.db.get(f.units[0].analysisReceiptId),
  }));
  await f.t.run((ctx) =>
    ctx.db.patch(f.units[2].snapshotId, { observedAt: NOW + DAY }),
  );
  const args = {
    ...f.args,
    experimentId: f.experimentId,
    snapshotId: f.snapshotId,
    commandKey: "native-fit",
  };
  const candidateId = await f.signed.mutation(fit, args);
  expect(await f.signed.mutation(fit, args)).toBe(candidateId);
  const candidate = await f.t.run((ctx) =>
    ctx.db.get(candidateId as Id<"calibrationModels">),
  );
  if (!candidate || candidate.kind !== "candidate")
    throw Error("candidate required");
  expect(candidate.payload).toMatchObject({
    transfer: 0.025,
    n: 2,
    spanMs: 2 * DAY,
    baseline: { loss: 0.5, pairs: 1 },
    selected: { loss: 0 },
    activationEligible: false,
  });
  const view = await f.signed.query(getModel, f.args);
  expect(view.candidate?._id).toBe(candidateId);
  await expect(
    f.signed.mutation(compare, { ...args, commandKey: "corrupt-compare" }),
  ).rejects.toThrow("fixed-24h-observation-missing");
  const after = await f.t.run(async (ctx) => ({
    analysis: await ctx.db.get(f.units[0].assessmentId),
    financial: await ctx.db.get(f.setup.budgetIds[0]),
    receipt: await ctx.db.get(f.units[0].analysisReceiptId),
  }));
  expect(after).toEqual(before);
});
test("chronological evaluation compares the frozen winner only; null policy and retrospective remain inactive", async () => {
  const f = await nativePair();
  const args = {
    ...f.args,
    experimentId: f.experimentId,
    snapshotId: f.snapshotId,
  };
  await f.signed.mutation(fit, { ...args, commandKey: "native-fit" });
  const id = await f.signed.mutation(compare, {
    ...args,
    commandKey: "native-evaluation",
  });
  const row = await f.t.run((ctx) => ctx.db.get(id as Id<"calibrationModels">));
  expect(row?.kind).toBe("evaluation");
  if (!row || row.kind !== "evaluation") throw Error("evaluation required");
  expect(row.payload).toMatchObject({
    trainN: 2,
    block1: { n: 1, baseline: { pairs: 0, loss: null } },
    block2: { n: 0 },
    evidenceQualified: false,
    activationEligible: false,
  });
  expect(row.payload.reasons).toEqual(
    expect.arrayContaining([
      "empirical-policy-unset",
      "retrospective-diagnostic",
      "insufficient-independent-blocks",
    ]),
  );
  expect(row.payload.unknownSegments).toContain("topic");
  expect((await f.signed.query(getModel, f.args)).evaluation?._id).toBe(id);
  await expect(
    f.signed.mutation(predeclare, {
      ...f.args,
      specId: f.specId,
      policy: null,
      commandKey: "another-experiment",
    }),
  ).rejects.toThrow("CALIBRATION_EXPERIMENT_EXISTS");
});
test("manifest mutations, incomplete frame, and native read capacity abort without partial candidate", async () => {
  const f = await nativePair();
  await f.t.run(async (ctx) => {
    const r = (await ctx.db.get(f.snapshotId))!;
    if (r.kind !== "snapshot") throw Error("snapshot");
    await ctx.db.patch(r._id, {
      payload: { ...r.payload, frameComplete: false },
    });
  });
  await expect(
    f.signed.mutation(fit, {
      ...f.args,
      experimentId: f.experimentId,
      snapshotId: f.snapshotId,
      commandKey: "incomplete",
    }),
  ).rejects.toThrow("CALIBRATION_FRAME_INCOMPLETE");
  await f.t.run(async (ctx) => {
    const r = (await ctx.db.get(f.snapshotId))!;
    if (r.kind !== "snapshot") throw Error("snapshot");
    await ctx.db.patch(r._id, {
      payload: { ...r.payload, frameComplete: true },
    });
  });
  await expect(
    f.signed.run((ctx) =>
      ctx.runMutation(
        api.performance.models.fit,
        {
          ...f.args,
          experimentId: f.experimentId as Id<"calibrationModels">,
          snapshotId: f.snapshotId,
          commandKey: "limited",
        },
        { transactionLimits: { databaseQueries: 511 } },
      ),
    ),
  ).rejects.toThrow("CALIBRATION_READ_CAPACITY");
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("calibrationModels")
        .withIndex("by_experimentId_and_kind", (q) =>
          q
            .eq("experimentId", f.experimentId as Id<"calibrationModels">)
            .eq("kind", "candidate"),
        )
        .first(),
    ),
  ).toBe(null);
});
test("changed frozen training membership cannot enter a comparison and original train expiry cannot renew", async () => {
  const f = await nativePair(),
    args = {
      ...f.args,
      experimentId: f.experimentId,
      snapshotId: f.snapshotId,
    };
  await f.signed.mutation(fit, { ...args, commandKey: "native-fit" });

  vi.setSystemTime(NOW + 7000);
  const evaluationSnapshotId = await f.signed.mutation(
    api.performance.calibration.build,
    {
      ...f.buildInput,
      specId: f.specId,
      asOf: Date.now(),
      commandKey: "new-frame",
    },
  );
  await f.t.run(async (ctx) => {
    const row = (await ctx.db.get(evaluationSnapshotId))!;
    if (row.kind !== "snapshot") throw Error("snapshot");
    await ctx.db.patch(row._id, {
      payload: {
        ...row.payload,
        refs: row.payload.refs.filter(
          (r) => r.postAttemptId !== f.second.postAttemptId,
        ),
      },
    });
  });
  await expect(
    f.signed.mutation(compare, {
      ...args,
      snapshotId: evaluationSnapshotId,
      commandKey: "changed-train",
    }),
  ).rejects.toThrow("CALIBRATION_FROZEN_TRAIN_CHANGED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.snapshotId, { expiresAt: Date.now() - 1 }),
  );
  await expect(
    f.signed.mutation(compare, {
      ...args,
      snapshotId: evaluationSnapshotId,
      commandKey: "expired-train",
    }),
  ).rejects.toThrow("CALIBRATION_ORIGINAL_TRAIN_CHANGED");
});
test("withdrawal immediately masks protected models and bounded model clear preserves financial parents", async () => {
  const f = await nativePair();
  await f.signed.mutation(fit, {
    ...f.args,
    experimentId: f.experimentId,
    snapshotId: f.snapshotId,
    commandKey: "native-fit",
  });
  await f.signed.mutation(api.performance.calibration.consent, {
    ...f.args,
    purposeId: f.purposeId,
    purposeFingerprint: f.purposeFingerprint,
    enabled: false,
    commandKey: "withdraw-models",
  });
  expect(await f.signed.query(getModel, f.args)).toMatchObject({
    experiment: null,
    candidate: null,
    evaluation: null,
    reason: "CALIBRATION_PURPOSE_REVOKED",
  });
  await f.t.mutation(internal.performance.models.clear, {
    purposeId: f.purposeId,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("calibrationModels").first()),
  ).toBe(null);
  expect(
    await f.t.run((ctx) => ctx.db.get(f.units[0].metricReceiptId)),
  ).not.toBe(null);
});
test("foreign scope and current role never disclose protected model details", async () => {
  const f = await nativePair();
  const foreign = await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(f.args.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return ctx.db.insert("socialAccounts", {
      ...fields,
      providerIdentity: "foreign",
    });
  });
  await expect(
    f.signed.mutation(fit, {
      ...f.args,
      accountId: foreign,
      experimentId: f.experimentId,
      snapshotId: f.snapshotId,
      commandKey: "foreign",
    }),
  ).rejects.toThrow("CALIBRATION_EXPERIMENT_CHANGED");
  await f.t.run(async (ctx) => {
    const membership = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.patch(membership._id, { role: "Viewer" });
  });
  await expect(f.signed.query(getModel, f.args)).rejects.toThrow(
    "ROLE_ACCESS_DENIED",
  );
});
const declaredPolicy = () => ({
  minTrainN: 2,
  minTrainSpanMs: DAY,
  minBlockN: 2,
  maxExcludedFraction: 1,
  minImprovement: 0,
  maxVariation: 1,
  maxClarityDrift: 1,
  maxDiscussionDrift: 1,
  maxReplyRateDrift: 100,
  reviewUntil: NOW + 10 * DAY,
  evidence: "Isolated synthetic operator declaration; no empirical approval",
  rationale: "Synthetic mechanics only, not actual deployment policy",
});
async function prospective() {
  const f = await nativePair();
  vi.setSystemTime(NOW + 6000);
  const specId = await f.signed.mutation(
    api.performance.calibration.createSpec,
    {
      ...f.specInput,
      fitCutoff: NOW - 3 * DAY + 1000,
      mode: "prospective",
      holdout1Start: NOW + DAY,
      holdout1End: NOW + 4 * DAY,
      holdout2Start: NOW + 4 * DAY,
      holdout2End: NOW + 7 * DAY,
      commandKey: "future-spec",
    },
  );
  vi.setSystemTime(NOW + 7000);
  const experimentId = await f.signed.mutation(predeclare, {
    ...f.args,
    specId,
    policy: declaredPolicy(),
    commandKey: "future-policy",
  });
  vi.setSystemTime(NOW + 8000);
  const snapshotId = await f.signed.mutation(
    api.performance.calibration.build,
    { ...f.buildInput, specId, asOf: Date.now(), commandKey: "future-train" },
  );
  const candidateId = await f.signed.mutation(fit, {
    ...f.args,
    experimentId,
    snapshotId,
    commandKey: "future-freeze",
  });
  return { ...f, specId, experimentId, snapshotId, candidateId };
}
test("prospective policy and candidate use real server timestamps; early evaluation is immature, matured winner only is preparatory evidence", async () => {
  const f = await prospective();
  const e = await f.t.run((ctx) =>
    ctx.db.get(f.experimentId as Id<"calibrationModels">),
  );
  if (!e || e.kind !== "experiment") throw Error("experiment");
  expect(e.payload.predeclaredAt).toBe(NOW + 7000);
  expect(e.payload.policy).toMatchObject({
    reviewerId: f.userId,
    reviewedAt: NOW + 7000,
  });
  const earlyId = await f.signed.mutation(compare, {
    ...f.args,
    experimentId: f.experimentId,
    snapshotId: f.snapshotId,
    commandKey: "early",
  });
  const early = await f.t.run((ctx) =>
    ctx.db.get(earlyId as Id<"calibrationModels">),
  );
  if (!early || early.kind !== "evaluation") throw Error("evaluation");
  expect(early.payload.reasons).toContain("immature-or-incomplete-frame");
  expect(early.payload.block1.drift.replyRate).toBe(null);
  const units: Awaited<ReturnType<typeof f.publication>>[] = [];
  for (const day of [1, 2, 4, 5])
    units.push(await f.publication(NOW + day * DAY + day * 3600000));
  await f.t.run(async (ctx) => {
    for (const [i, u] of units.entries()) {
      const a = (await ctx.db.get(u.assessmentId))!,
        snap = (await ctx.db.get(u.snapshotId))!,
        even = i % 2 === 0;
      const answers = {
        ...a.result.answers!,
        clarity: {
          type: "score" as const,
          value: even ? 0.9 : 0.1,
          confidence: 1,
        },
        discussionPotential: {
          type: "score" as const,
          value: even ? 0.1 : 0.9,
          confidence: 1,
        },
      };
      await ctx.db.patch(a._id, {
        result: {
          ...a.result,
          answers,
          score: dispatchScore(answers, a.result.deterministic.structure),
        },
      });
      await ctx.db.patch(snap._id, {
        fields: snap.fields.map((x) =>
          x.name === "replies" ? { ...x, value: even ? 1 : 4 } : x,
        ),
      });
    }
  });
  vi.setSystemTime(NOW + 7 * DAY);
  const snapshotId = await f.signed.mutation(
    api.performance.calibration.build,
    {
      ...f.buildInput,
      specId: f.specId,
      asOf: Date.now(),
      commandKey: "mature-frame",
    },
  );
  const id = await f.signed.mutation(compare, {
    ...f.args,
    experimentId: f.experimentId,
    snapshotId,
    commandKey: "mature-compare",
  });
  const row = await f.t.run((ctx) => ctx.db.get(id as Id<"calibrationModels">));
  if (!row || row.kind !== "evaluation") throw Error("evaluation");
  expect(row.payload).toMatchObject({
    evidenceQualified: false,
    activationEligible: false,
    engineeringScreen: false,
    engineeringScreenBasis: "unvalidated-30-posts-28-days",
    trainN: 2,
    block1: {
      n: 2,
      improvement: 0.5,
      candidate: { loss: 0 },
      baseline: { loss: 0.5 },
    },
    block2: { n: 2, improvement: 0.5 },
    stability: 0,
    reasons: ["unvalidated-30-posts-28-days-screen-not-met"],
  });
  const counts = await f.signed.run(async (ctx) => {
    await ctx.runQuery(api.performance.models.get, f.args, {
      transactionLimits: {
        databaseQueries: 4096,
        documentsRead: 32000,
        bytesRead: 16 * 1024 * 1024,
      },
    });
    return await ctx.meta.getTransactionMetrics();
  });
  console.log(
    "TASK43.2 selected mature native proof metrics",
    JSON.stringify(counts),
  );
});
test("late prospective freeze cannot rehabilitate the holdout; policy ranges have no invented defaults", async () => {
  const f = await nativePair();
  vi.setSystemTime(NOW + 6000);
  const specId = await f.signed.mutation(
    api.performance.calibration.createSpec,
    {
      ...f.specInput,
      fitCutoff: NOW - 3 * DAY + 1000,
      mode: "prospective",
      holdout1Start: NOW + DAY,
      holdout1End: NOW + 4 * DAY,
      holdout2Start: NOW + 4 * DAY,
      holdout2End: NOW + 7 * DAY,
      commandKey: "late-spec",
    },
  );
  await expect(
    f.signed.mutation(predeclare, {
      ...f.args,
      specId,
      policy: { ...declaredPolicy(), maxVariation: 2 },
      commandKey: "bad-policy",
    }),
  ).rejects.toThrow("CALIBRATION_POLICY_INVALID");
  const experimentId = await f.signed.mutation(predeclare, {
    ...f.args,
    specId,
    policy: null,
    commandKey: "late-declare",
  });
  const snapshotId = await f.signed.mutation(
    api.performance.calibration.build,
    { ...f.buildInput, specId, asOf: Date.now(), commandKey: "late-train" },
  );
  vi.setSystemTime(NOW + DAY);
  await expect(
    f.signed.mutation(fit, {
      ...f.args,
      experimentId,
      snapshotId,
      commandKey: "late-freeze",
    }),
  ).rejects.toThrow("CALIBRATION_FREEZE_TOO_LATE");
  await expect(
    f.signed.mutation(predeclare, {
      ...f.args,
      specId,
      policy: declaredPolicy(),
      commandKey: "late-new-policy",
    }),
  ).rejects.toThrow("CALIBRATION_PREDECLARE_TOO_LATE");
});
test("current reviewer demotion masks immutable evidence and sweep capacity failures preserve every row", async () => {
  const f = await prospective();
  const before = await f.t.run((ctx) =>
    ctx.db.query("calibrationModels").collect(),
  );
  await expect(
    f.t.run((ctx) =>
      ctx.runMutation(
        internal.performance.models.sweep,
        { cursor: null },
        { transactionLimits: { databaseQueries: 500 } },
      ),
    ),
  ).rejects.toThrow("CALIBRATION_READ_CAPACITY");
  expect(
    await f.t.run((ctx) => ctx.db.query("calibrationModels").collect()),
  ).toEqual(before);
  const other = await f.t.run(async (ctx) => {
    const u = (await ctx.db.get(f.userId))!;
    const { _id: oldUserId, _creationTime: userTime, ...userFields } = u;
    const userId = await ctx.db.insert("users", {
      ...userFields,
      authId: "synthetic-reviewer",
    });
    const member = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    const { _id, _creationTime, ...fields } = member;
    const membershipId = await ctx.db.insert("memberships", {
      ...fields,
      userId,
    });
    const e = (await ctx.db.get(f.experimentId as Id<"calibrationModels">))!;
    if (e.kind !== "experiment" || !e.payload.policy)
      throw Error("fixture policy");
    await ctx.db.patch(e._id, {
      payload: {
        ...e.payload,
        policy: { ...e.payload.policy, reviewerId: userId },
      },
    });
    return membershipId;
  });
  await f.t.run((ctx) => ctx.db.patch(other, { role: "Viewer" }));
  expect(
    await f.signed.query(getModel, {
      ...f.args,
      selectedExperimentId: f.experimentId,
    }),
  ).toMatchObject({
    experiment: null,
    candidate: null,
    reason: "ROLE_ACCESS_DENIED",
  });
});
test("renewed current credential never extends a frozen original horizon or resurrects an expired training reference", async () => {
  const f = await nativePair();
  await f.signed.mutation(fit, {
    ...f.args,
    experimentId: f.experimentId,
    snapshotId: f.snapshotId,
    commandKey: "fit-horizon",
  });
  const before = await f.signed.query(getModel, f.args);
  await f.t.run((ctx) =>
    ctx.db.patch(f.setup.credentialId, { expiresAt: NOW + 25 * DAY }),
  );
  const after = await f.signed.query(getModel, f.args);
  expect(after.proofUntil).toBe(before.proofUntil);
  vi.setSystemTime(before.proofUntil! + 1);
  const expired = await f.signed.query(getModel, f.args);
  expect(expired.experiment).toBe(null);
  expect(expired.candidate).toBe(null);
  expect(expired.reason).toMatch(/EXPIRED/);
});
test("unexpected platform failure preserves valid models; current source withdrawal masks and physically cleans derivatives", async () => {
  const f = await nativePair();
  const before = await f.t.run((ctx) =>
    ctx.db.query("calibrationModels").collect(),
  );
  const transient = vi
    .spyOn(crypto.subtle, "digest")
    .mockRejectedValueOnce(new Error("unexpected-platform"));
  await expect(
    f.t.mutation(internal.performance.models.sweep, { cursor: null }),
  ).rejects.toThrow("unexpected-platform");
  transient.mockRestore();
  expect(
    await f.t.run((ctx) => ctx.db.query("calibrationModels").collect()),
  ).toEqual(before);
  await f.t.run((ctx) =>
    ctx.db.patch(f.units[0].versionId, { sourceUnavailable: true }),
  );
  expect(await f.signed.query(getModel, f.args)).toMatchObject({
    experiment: null,
    candidate: null,
    reason: "JEV_SOURCE_CHANGED",
  });
  await f.t.mutation(internal.performance.models.sweep, { cursor: null });
  expect(
    await f.t.run((ctx) =>
      ctx.db.get(f.experimentId as Id<"calibrationModels">),
    ),
  ).toBe(null);
  expect(
    await f.t.run((ctx) => ctx.db.get(f.units[0].analysisReceiptId)),
  ).not.toBe(null);
});
