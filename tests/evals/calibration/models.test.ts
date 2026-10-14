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
  expect(
    candidate?.kind === "candidate" ? candidate.payload : null,
  ).toMatchObject({
    transfer: null,
    n: 1,
    status: "no-comparable-pairs",
    activationEligible: false,
  });
});

import { api, internal, components } from "../../../convex/_generated/api";
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

import { qualifiedCorpus } from "./fixture";
test("genuine qualified native lineage reaches one finite checkpoint, terminal unknown, and rollback beyond expiry", async () => {
  const f = await qualifiedCorpus();
  for (const policy of [
    { ...f.monitoringPolicy, minBlockN: 1 },
    { ...f.monitoringPolicy, maxReplyRateDrift: -1 },
    { ...f.monitoringPolicy, evidence: "" },
    { ...f.monitoringPolicy, finalValidUntil: NOW + 26 * DAY },
  ])
    await expect(
      f.signed.mutation(api.performance.models.declareMonitoring, {
        ...f.args,
        candidateId: f.candidateId,
        evaluationId: f.evaluationId,
        monitoringSpecId: f.monitoringSpecId,
        policy,
        commandKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/CALIBRATION_MONITORING_(POLICY|INTERVAL)_INVALID/);
  const original = await f.signed.query(api.performance.models.get, {
    ...f.args,
    selectedExperimentId: f.experimentId,
  });
  expect(original.evaluation?.payload).toMatchObject({
    engineeringScreen: true,
    evidenceQualified: true,
    activationEligible: false,
  });
  expect(original.evaluation?.payload.trainN).toBe(26);
  expect(
    (await f.signed.query(api.performance.models.control, f.args)).reason,
  ).toBe("CALIBRATION_MONITORING_FIRST_BLOCK_NOT_MATURE");
  await expect(
    f.signed.mutation(api.performance.models.checkMonitoring, {
      ...f.args,
      declarationId: f.declarationId,
      snapshotId: f.buildInput.specId,
      block: 1,
      commandKey: "premature-final",
    }),
  ).rejects.toThrow("CALIBRATION_MONITORING_NOT_MATURE");
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("calibrationModels")
        .withIndex("by_declarationId_and_blockNumber", (q) =>
          q.eq("declarationId", f.declarationId).eq("blockNumber", 1),
        )
        .take(2),
    ),
  ).toHaveLength(0);
  const { monitoringSnapshotId } = await f.mature(false);
  const checkId = await f.signed.mutation(
    api.performance.models.checkMonitoring,
    {
      ...f.args,
      declarationId: f.declarationId,
      snapshotId: monitoringSnapshotId,
      block: 1,
      commandKey: "unknown-final",
    },
  );
  const check = await f.t.run((ctx) => ctx.db.get(checkId));
  expect(check?.kind).toBe("monitoring-check");
  expect(
    check?.kind === "monitoring-check" ? check.payload : null,
  ).toMatchObject({
    status: "unknown",
    block: { n: 2 },
    coverageBasis: "whole-declared-frame",
  });
  await expect(
    f.signed.mutation(api.performance.models.checkMonitoring, {
      ...f.args,
      declarationId: f.declarationId,
      snapshotId: monitoringSnapshotId,
      block: 1,
      commandKey: "rescue-final",
    }),
  ).rejects.toThrow("CALIBRATION_MONITORING_CHECK_FINAL");
  await expect(
    f.signed.mutation(api.performance.models.activate, {
      ...f.args,
      evaluationId: f.evaluationId,
      declarationId: f.declarationId,
      checkId,
      expectedRevision: 0,
      commandKey: "unknown-activate",
    }),
  ).rejects.toThrow("CALIBRATION_MONITORING_TERMINAL_UNKNOWN");
  vi.setSystemTime(NOW + 26 * DAY);
  const input = {
    ...f.args,
    expectedRevision: 0,
    commandKey: "expired-static-rollback",
  };
  const rollbackId = await f.signed.mutation(
    api.performance.models.rollback,
    input,
  );
  expect(await f.signed.mutation(api.performance.models.rollback, input)).toBe(
    rollbackId,
  );
  expect(
    await f.signed.query(api.performance.models.control, f.args),
  ).toMatchObject({ revision: 1, activeDecisionId: null, state: "static" });
  await expect(
    f.signed.mutation(api.performance.models.rollback, {
      ...input,
      commandKey: "stale-rollback",
    }),
  ).rejects.toThrow("CALIBRATION_REVISION_CONFLICT");
});

import { POST_ANALYSIS } from "../../../convex/ai/jev/questions/postAnalysis";
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
test("registered beforeSend pins a genuinely qualified finite candidate, exact replay does not reactivate, and expiry removes only protected derivatives", async () => {
  const f = await qualifiedCorpus(),
    transfer = await f.t.run((ctx) => ctx.db.get(f.candidateId));
  const { monitoringSnapshotId } = await f.mature();
  const checkId = await f.signed.mutation(
    api.performance.models.checkMonitoring,
    {
      ...f.args,
      declarationId: f.declarationId,
      snapshotId: monitoringSnapshotId,
      block: 1,
      commandKey: "pass-final",
    },
  );
  const check = await f.t.run((ctx) => ctx.db.get(checkId));
  expect(
    check?.kind === "monitoring-check" ? check.payload : null,
  ).toMatchObject({
    status: "pass",
    block: { n: 2, spanMs: 1000 },
  });
  expect(await f.t.run((ctx) => ctx.db.get(f.candidateId))).toEqual(transfer);
  const activateInput = {
    ...f.args,
    evaluationId: f.evaluationId,
    declarationId: f.declarationId,
    checkId,
    expectedRevision: 0,
    commandKey: "finite-activate",
  };
  const decisionId = await f.signed.mutation(
    api.performance.models.activate,
    activateInput,
  );
  const operating = await f.signed.query(
    api.performance.models.control,
    f.args,
  );
  expect(operating).toMatchObject({
    state: "candidate",
    revision: 1,
    activeDecisionId: decisionId,
  });
  const t = await targetSchedule(f),
    baseline = t.assessment;
  const financialBefore = await f.t.run((ctx) =>
    ctx.db.query("aiBudgets").take(10),
  );
  const get = await f.signed.query(api.intelligence.assessments.get, t.args);
  const cappedGet = await f.signed.run((ctx) =>
    ctx.runQuery(api.intelligence.assessments.get, t.args, {
      transactionLimits: { databaseQueries: 160 },
    }),
  );
  expect(cappedGet.assessment).toEqual(baseline);
  expect(cappedGet.applicable).toBe(true);
  expect(cappedGet.projection).toBeNull();
  expect(get.assessment).toEqual(baseline);
  expect(get.projection).toMatchObject({
    state: "candidate",
    pin: { decisionId, candidateId: f.candidateId, checkId },
  });
  const metrics = await f.t.run(async (ctx) => {
    expect(
      await ctx.runMutation(internal.publishing.attempts.beforeSend, t.send),
    ).toBe(true);
    return ctx.meta.getTransactionMetrics();
  });
  expect(metrics.databaseQueries.used).toBeLessThan(4096);
  await import("node:fs").then(({ writeFileSync }) =>
    writeFileSync(
      "/tmp/dispatch43.3-native-beforeSend.json",
      JSON.stringify(
        {
          qualification:
            "Synthetic engineering mechanics only; no live rights, empirical adequacy, or CPU certificate",
          nativeCounts: { train: 26, block1: 2, block2: 2 },
          originalProofUntil: operating.proofUntil,
          operatingUntil: operating.operatingUntil,
          projection: get.projection,
          beforeSendMetrics: metrics,
        },
        null,
        2,
      ),
    ),
  );
  const k = (await f.t.run((ctx) =>
    ctx.db
      .query("publicationKnowledge")
      .withIndex("by_postAttemptId", (q) =>
        q.eq("postAttemptId", t.attempt._id),
      )
      .unique(),
  ))!;
  expect(k.projection).toMatchObject({
    state: "candidate",
    score: get.projection?.score,
    pin: {
      decisionId,
      candidateId: f.candidateId,
      evaluationId: f.evaluationId,
      declarationId: f.declarationId,
      checkId,
    },
  });
  const sent = await f.t.run((ctx) => ctx.db.get(t.attempt._id));
  expect(sent?.stage).toBe("sending");
  expect(k.capturedAt).toBeLessThanOrEqual(sent!.requestStartedAt!);
  expect(k.projection?.pin?.capturedAt).toBeLessThanOrEqual(
    sent!.requestStartedAt!,
  );
  const historical = await f.signed.query(
    api.performance.models.publicationProjection,
    { ...f.args, postAttemptId: t.attempt._id },
  );
  await f.signed.mutation(api.performance.models.rollback, {
    ...f.args,
    expectedRevision: 1,
    commandKey: "return-static",
  });
  expect(
    await f.signed.mutation(api.performance.models.activate, activateInput),
  ).toBe(decisionId);
  expect(
    await f.signed.query(api.performance.models.control, f.args),
  ).toMatchObject({ revision: 2, activeDecisionId: null, state: "static" });
  expect(
    await f.signed.query(api.performance.models.publicationProjection, {
      ...f.args,
      postAttemptId: t.attempt._id,
    }),
  ).toEqual(historical);
  expect(
    (await f.signed.query(api.intelligence.assessments.get, t.args)).assessment,
  ).toEqual(baseline);
  expect(await f.t.run((ctx) => ctx.db.query("aiBudgets").take(10))).toEqual(
    financialBefore,
  );
  expect(
    await f.t.mutation(internal.publishing.attempts.beforeSend, t.send),
  ).toBe(false);
  expect(await f.t.run((ctx) => ctx.db.get(k._id))).toEqual(k);
  await f.signed.mutation(api.performance.models.activate, {
    ...activateInput,
    expectedRevision: 2,
    commandKey: "fresh-same-finite-approval",
  });
  vi.setSystemTime(f.monitoringPolicy.finalValidUntil);
  expect(
    (await f.signed.query(api.intelligence.assessments.get, t.args)).projection,
  ).toMatchObject({ state: "static", reason: "CALIBRATION_OPERATING_EXPIRED" });
  await expect(
    f.signed.mutation(api.performance.models.activate, {
      ...activateInput,
      expectedRevision: 3,
      commandKey: "expired-renewal",
    }),
  ).rejects.toThrow("CALIBRATION_OPERATING_EXPIRED");

  expect(
    await f.signed.query(api.performance.models.publicationProjection, {
      ...f.args,
      postAttemptId: t.attempt._id,
    }),
  ).toEqual(historical);
  vi.setSystemTime(NOW + 26 * DAY);
  expect(
    await f.signed.query(api.performance.models.publicationProjection, {
      ...f.args,
      postAttemptId: t.attempt._id,
    }),
  ).toMatchObject({ state: "unavailable", score: null, pin: null });
  await f.t.mutation(internal.performance.models.sweep, {
    cursor: null,
    pins: true,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const removed = await f.t.run((ctx) => ctx.db.get(k._id));
  expect(removed?.projection).toMatchObject({
    state: "unavailable",
    score: null,
    pin: null,
  });
  expect(removed?.assessmentId).toBe(baseline._id);
  expect(await f.t.run((ctx) => ctx.db.get(t.attempt._id))).not.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(t.scheduleId))).not.toBeNull();
});

async function signedAdmin(f: Awaited<ReturnType<typeof qualifiedCorpus>>) {
  const identity = await f.t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Synthetic Admin",
          email: "calibration-admin@example.test",
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: {
          userId: user._id,
          providerId: "credential",
          accountId: user._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          password: "synthetic-hash",
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: user._id,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: NOW + 30 * DAY,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  const signed = f.t.withIdentity(identity),
    userId = await signed.mutation(api.users.bootstrap, {});
  await f.t.run((ctx) =>
    ctx.db.insert("memberships", {
      userId,
      workspaceId: f.workspaceId,
      role: "Admin",
    }),
  );
  return signed;
}
test("Owner/Admin split, capped proof abort, actual capped child fallback commits sending, and reviewer loss fails closed", async () => {
  const f = await qualifiedCorpus(),
    admin = await signedAdmin(f);
  await expect(
    admin.mutation(api.performance.models.declareMonitoring, {
      ...f.args,
      candidateId: f.candidateId,
      evaluationId: f.evaluationId,
      monitoringSpecId: f.monitoringSpecId,
      policy: f.monitoringPolicy,
      commandKey: "admin-declaration",
    }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  const { monitoringSnapshotId } = await f.mature();
  const checkInput = {
    ...f.args,
    declarationId: f.declarationId,
    snapshotId: monitoringSnapshotId,
    block: 1 as const,
    commandKey: "admin-final",
  };
  await expect(
    admin.run((ctx) =>
      ctx.runMutation(api.performance.models.checkMonitoring, checkInput, {
        transactionLimits: { databaseQueries: 900 },
      }),
    ),
  ).rejects.toThrow("CALIBRATION_READ_CAPACITY");
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("calibrationModels")
        .withIndex("by_declarationId_and_blockNumber", (q) =>
          q.eq("declarationId", f.declarationId).eq("blockNumber", 1),
        )
        .take(2),
    ),
  ).toHaveLength(0);
  const checkId = await admin.mutation(
    api.performance.models.checkMonitoring,
    checkInput,
  );
  const activateInput = {
    ...f.args,
    evaluationId: f.evaluationId,
    declarationId: f.declarationId,
    checkId,
    expectedRevision: 0,
    commandKey: "owner-real-activate",
  };
  await expect(
    admin.mutation(api.performance.models.activate, activateInput),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  await expect(
    admin.mutation(api.performance.models.rollback, {
      ...f.args,
      expectedRevision: 0,
      commandKey: "admin-rollback",
    }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  await f.signed.mutation(api.performance.models.activate, activateInput);
  await expect(
    f.signed.mutation(api.performance.models.activate, {
      ...activateInput,
      commandKey: "stale-cas",
    }),
  ).rejects.toThrow("CALIBRATION_REVISION_CONFLICT");
  const t = await targetSchedule(f),
    financial = await f.t.run((ctx) => ctx.db.query("aiBudgets").take(10));
  const metrics = await f.t.run(async (ctx) => {
    expect(
      await ctx.runMutation(internal.publishing.attempts.beforeSend, t.send, {
        transactionLimits: { databaseQueries: 160 },
      }),
    ).toBe(true);
    return ctx.meta.getTransactionMetrics();
  });
  expect(metrics.databaseQueries.used).toBeLessThanOrEqual(160);
  expect((await f.t.run((ctx) => ctx.db.get(t.attempt._id)))?.stage).toBe(
    "sending",
  );
  const pin = (await f.t.run((ctx) =>
    ctx.db
      .query("publicationKnowledge")
      .withIndex("by_postAttemptId", (q) =>
        q.eq("postAttemptId", t.attempt._id),
      )
      .unique(),
  ))!;
  expect(pin.projection).toMatchObject({
    state: "static",
    reason: "CALIBRATION_PROJECTION_PROOF_CAPACITY",
    score: null,
    pin: null,
  });
  expect(pin.assessmentId).toBe(t.assessment._id);
  expect(await f.t.run((ctx) => ctx.db.query("aiBudgets").take(10))).toEqual(
    financial,
  );
  expect(
    (
      await f.signed.query(api.performance.models.publicationProjection, {
        ...f.args,
        postAttemptId: t.attempt._id,
      })
    ).score,
  ).toBe(t.assessment.result.score?.aggregate);
  await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(membership!._id, { role: "Admin" });
  });
  expect(
    (await f.signed.query(api.intelligence.assessments.get, t.args)).projection,
  ).toMatchObject({ state: "static", reason: "ROLE_ACCESS_DENIED" });
  expect(
    (await f.signed.query(api.intelligence.assessments.get, t.args)).assessment,
  ).toEqual(t.assessment);
});

async function changeRole(
  f: Awaited<ReturnType<typeof qualifiedCorpus>>,
  userId: Id<"users">,
  role: "Owner" | "Admin" | "Viewer",
) {
  await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(membership!._id, { role });
  });
}
async function sweepModelsOnly(f: Awaited<ReturnType<typeof qualifiedCorpus>>) {
  await f.t.mutation(internal.performance.models.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
}
test("Owner restoration cannot redeclare a spent candidate after protected declaration cleanup", async () => {
  const f = await qualifiedCorpus(),
    before = await f.t.run((ctx) => ctx.db.get(f.candidateId));
  await changeRole(f, f.userId, "Admin");
  await sweepModelsOnly(f);
  const tombstone = await f.t.run((ctx) => ctx.db.get(f.declarationId));
  expect(tombstone).toMatchObject({
    kind: "monitoring-tombstone",
    candidateId: f.candidateId,
    declarationId: null,
    blockNumber: null,
  });
  expect(tombstone && "payload" in tombstone).toBe(false);
  expect(tombstone && "requestFingerprint" in tombstone).toBe(false);
  expect(
    tombstone?.kind === "monitoring-tombstone" ? tombstone.expiresAt : null,
  ).toBe(before?.kind === "candidate" ? before.expiresAt : null);
  expect(
    (
      await f.signed.query(api.performance.models.get, {
        ...f.args,
        selectedExperimentId: f.experimentId,
      })
    ).evaluation?.payload.evidenceQualified,
  ).toBe(true);
  await changeRole(f, f.userId, "Owner");
  await expect(
    f.signed.mutation(api.performance.models.declareMonitoring, {
      ...f.args,
      candidateId: f.candidateId,
      evaluationId: f.evaluationId,
      monitoringSpecId: f.monitoringSpecId,
      policy: f.monitoringPolicy,
      commandKey: "restored-owner-new-declaration",
    }),
  ).rejects.toThrow("CALIBRATION_DECLARATION_EXISTS");
});
test("Admin restoration cannot replace an unknown terminal check after protected cleanup", async () => {
  const f = await qualifiedCorpus(),
    admin = await signedAdmin(f),
    { monitoringSnapshotId } = await f.mature(false);
  const input = {
    ...f.args,
    declarationId: f.declarationId,
    snapshotId: monitoringSnapshotId,
    block: 1 as const,
    commandKey: "admin-unknown-terminal",
  };
  const checkId = await admin.mutation(
      api.performance.models.checkMonitoring,
      input,
    ),
    check = await f.t.run((ctx) => ctx.db.get(checkId));
  if (check?.kind !== "monitoring-check") throw Error("fixture");
  expect(check.payload.status).toBe("unknown");
  expect(
    await f.signed.query(api.performance.models.control, f.args),
  ).toMatchObject({
    checkFinal: true,
    check: { payload: { status: "unknown" } },
  });
  await changeRole(f, check.actorId, "Viewer");
  expect(
    await f.signed.query(api.performance.models.control, f.args),
  ).toMatchObject({ checkFinal: true, check: null, state: "static" });
  await sweepModelsOnly(f);
  const tombstone = await f.t.run((ctx) => ctx.db.get(checkId));
  expect(tombstone).toMatchObject({
    kind: "monitoring-tombstone",
    candidateId: f.candidateId,
    declarationId: f.declarationId,
    blockNumber: 1,
  });
  expect(tombstone && "payload" in tombstone).toBe(false);
  expect(tombstone && "requestFingerprint" in tombstone).toBe(false);
  expect(
    await f.signed.query(api.performance.models.control, f.args),
  ).toMatchObject({ checkFinal: true, check: null, state: "static" });
  await changeRole(f, check.actorId, "Admin");
  await expect(
    admin.mutation(api.performance.models.checkMonitoring, {
      ...input,
      commandKey: "restored-admin-replacement",
    }),
  ).rejects.toThrow("CALIBRATION_MONITORING_CHECK_FINAL");
});

test("TASK44 source-only observation preserves genuine active-model/publication/assessment state; new reviewed profile misses cache and falls back to static", async () => {
  const f = await qualifiedCorpus(),
    evaluator = await signedAdmin(f);
  const { monitoringSnapshotId } = await f.mature();
  const checkId = await f.signed.mutation(
    api.performance.models.checkMonitoring,
    {
      ...f.args,
      declarationId: f.declarationId,
      snapshotId: monitoringSnapshotId,
      block: 1,
      commandKey: "source-native-monitor",
    },
  );
  await f.signed.mutation(api.performance.models.activate, {
    ...f.args,
    evaluationId: f.evaluationId,
    declarationId: f.declarationId,
    checkId,
    expectedRevision: 0,
    commandKey: "source-native-activate",
  });
  const initial = await f.signed.query(api.intelligence.profiles.get, f.args);
  await f.signed.mutation(api.intelligence.profiles.change, {
    ...f.args,
    expectedRevision: initial.capture.revision,
    commandKey: "source-original-pair",
    action: {
      kind: "select",
      algorithmId: f.request.algorithmId,
      audienceId: f.request.audienceId,
      reason: "Record an actual historical pair before source observation",
    },
  });
  const t = await targetSchedule(f);
  expect(
    await f.t.mutation(internal.publishing.attempts.beforeSend, t.send),
  ).toBe(true);
  const snapshot = () =>
    f.t.run(async (ctx) => ({
      profiles: await ctx.db.query("algorithmProfiles").take(20),
      selections: await ctx.db.query("intelligenceSelections").take(20),
      assessments: await ctx.db.query("jevAssessments").take(100),
      models: await ctx.db.query("calibrationModels").take(100),
      knowledge: await ctx.db.query("publicationKnowledge").take(100),
      budgets: await ctx.db.query("aiBudgets").take(20),
      attempts: await ctx.db.query("aiAttempts").take(100),
      controls: await ctx.db.query("calibrationControls").take(20),
    }));
  const before = await snapshot();
  const baseCommit = "b412112d03f27acbfd668e0cc040abcafa1080c1",
    headCommit = "e62790c99484b51424c2eccc488ed4e7517e8778";
  const sourceFetch = vi.fn(async (url: string, init: RequestInit) => {
    expect(init.redirect).toBe("error");
    if (url.includes("commits/main"))
      return new Response(
        JSON.stringify({
          sha: headCommit,
          commit: { committer: { date: "2026-10-06T04:59:30Z" } },
        }),
      );
    if (url.includes("/compare/"))
      return new Response(
        JSON.stringify({
          status: "ahead",
          total_commits: 1,
          ahead_by: 1,
          behind_by: 0,
          base_commit: { sha: baseCommit },
          merge_base_commit: { sha: baseCommit },
          commits: [{ sha: headCommit }],
          files: [
            {
              filename: "README.md",
              status: "modified",
              patch: "Synthetic bounded source difference",
            },
          ],
        }),
      );
    expect(url).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/xai-org\/x-algorithm\//,
    );
    return new Response(
      "Synthetic public source bytes; no live source or empirical qualification",
    );
  });
  vi.stubGlobal("fetch", sourceFetch);
  const receipt = await f.signed.action(api.intelligence.profileUpdates.check, {
    ...f.args,
    baseProfileId: f.request.algorithmId,
    commandKey: "source-native-observation",
    full: false,
  });
  expect(receipt.state).toBe("proposed");
  expect(sourceFetch).toHaveBeenCalledTimes(15);
  expect(await snapshot()).toEqual(before);
  expect(
    await f.signed.action(api.intelligence.assessments.analyze, {
      ...t.args,
      operationKey: "source-still-original-cache",
    }),
  ).toMatchObject({ cached: true });
  expect(sourceFetch).toHaveBeenCalledTimes(15);
  const evaluationId = await evaluator.mutation(
    api.intelligence.profileUpdates.evaluate,
    {
      ...f.args,
      proposalId: receipt.proposalId!,
      commandKey: "source-native-evaluation",
      variant: "post-analysis",
      interpretation: "Synthetic full linked-source review",
      impact: "Source context maintenance only; exact Dispatch refs retained",
      rationale:
        "Synthetic human attestation of complete comparison and all 13 evidence files",
      fullSourceReview: true,
    },
  );
  const current = await f.signed.query(api.intelligence.profiles.get, f.args);
  const draft = await f.signed.mutation(
    api.intelligence.algorithmProfiles.create,
    {
      ...f.args,
      expectedRevision: current.capture.revision,
      commandKey: "source-native-draft",
      proposalId: receipt.proposalId!,
      evaluationId,
      variant: "post-analysis",
    },
  );
  const reviewed = await f.signed.mutation(api.intelligence.profiles.change, {
    ...f.args,
    expectedRevision: draft.revision,
    commandKey: "source-native-review",
    action: {
      kind: "review-algorithm",
      algorithmId: draft.algorithmId!,
      reason: "Independent source profile review; no empirical model claim",
    },
  });
  const selected = await f.signed.mutation(api.intelligence.profiles.change, {
    ...f.args,
    expectedRevision: reviewed.revision,
    commandKey: "source-native-select",
    action: {
      kind: "select",
      algorithmId: draft.algorithmId!,
      audienceId: f.request.audienceId,
      reason: "Explicit reviewed fresh source variant",
    },
  });
  const provider = vi.fn(async () => nativeAnalysisResponse());
  vi.stubGlobal("fetch", provider);
  expect(
    await f.signed.action(api.intelligence.assessments.analyze, {
      ...t.args,
      operationKey: "source-new-identity-cache-miss",
    }),
  ).toMatchObject({ cached: false, outcome: "success" });
  expect(provider).toHaveBeenCalledTimes(1);
  const after = await f.signed.query(api.intelligence.assessments.get, t.args);
  expect(after.assessment?.algorithmId).toBe(draft.algorithmId);
  expect(after.assessment?.semanticKey).not.toBe(t.assessment.semanticKey);
  const projection = await f.t.query(internal.performance.models.projection, {
    ...f.args,
    actorId: f.userId,
    assessmentId: after.assessment!._id,
  });
  expect(projection).toMatchObject({
    state: "static",
    reason: "CALIBRATION_TARGET_STRATUM_CHANGED",
    pin: null,
    score: after.assessment!.result.score!.aggregate,
  });
  const preserved = await snapshot();
  expect(preserved.models).toEqual(before.models);
  expect(preserved.knowledge).toEqual(before.knowledge);
  expect(preserved.controls).toEqual(before.controls);
  expect(await f.t.run((ctx) => ctx.db.get(t.assessment._id))).toEqual(
    t.assessment,
  );
  const ev = await f.t.run((ctx) => ctx.db.get(evaluationId));
  if (!ev || ev.kind !== "evaluation")
    throw new Error("Missing source evaluation");
  await changeRole(f, ev.actorId, "Viewer");
  await expect(
    f.t.query(internal.ai.jev.access.context, {
      ...f.request,
      algorithmId: draft.algorithmId!,
      selectionRevision: selected.revision,
      operationKey: "source-revoked-evaluator",
      deadline: Date.now() + 2500,
    }),
  ).rejects.toThrow("JEV_PROFILE_CHANGED");
  expect(
    (await f.signed.query(api.ai.jev.access.availability, f.args)).status,
  ).toBe("configuration_required");
  const rollback = await f.signed.mutation(api.intelligence.profiles.change, {
    ...f.args,
    expectedRevision: selected.revision,
    commandKey: "source-original-valid-rollback",
    action: {
      kind: "rollback",
      algorithmId: f.request.algorithmId,
      audienceId: f.request.audienceId,
      reason: "Restore exact valid historical pair",
    },
  });
  expect(rollback.algorithmId).toBe(f.request.algorithmId);
  await expect(
    f.signed.mutation(api.intelligence.profiles.change, {
      ...f.args,
      expectedRevision: rollback.revision,
      commandKey: "source-invalid-rollback",
      action: {
        kind: "rollback",
        algorithmId: draft.algorithmId!,
        audienceId: f.request.audienceId,
        reason: "Withdrawn evaluator cannot resurrect source candidate",
      },
    }),
  ).rejects.toThrow("CURRENT_REVIEW_REQUIRED");
});
