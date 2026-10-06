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

import { api, internal, components } from "../../../convex/_generated/api";
import { sha256 } from "../../../convex/lib/crypto";
import {
  describeThread,
  dispatchScore,
} from "../../../convex/ai/scoring/dispatchScore";
import { POST_ANALYSIS } from "../../../convex/ai/jev/questions/postAnalysis";
import { definitions } from "../../../convex/performance/normalize";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
const DAY = 86400000,
  NOW = Date.parse("2026-10-06T12:00:00Z");
const specFn = makeFunctionReference<"mutation">(
  "performance/calibration:createSpec",
);
const buildFn = makeFunctionReference<"mutation">(
  "performance/calibration:build",
);
// Reuse only the authenticated isolated DB/profile fixture. Native publication pairs below are original cases.
async function corpus() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW - 8 * DAY);
  const f = await jevFixture(true),
    args = { workspaceId: f.workspaceId, accountId: f.request.accountId };
  const setup = await f.t.run(async (ctx) => {
    const algorithm = (await ctx.db.get(f.request.algorithmId))!;
    await ctx.db.patch(algorithm._id, {
      payload: { ...algorithm.payload, reviewDueAt: NOW - DAY },
    });
    const jevPolicy = (await ctx.db.query("jevPolicies").first())!,
      control = (await ctx.db
        .query("jevControls")
        .withIndex("by_key", (q) => q.eq("key", `account:${args.accountId}`))
        .unique())!;
    const policyId = await ctx.db.insert("performancePolicies", {
      ...args,
      version: "synthetic-reply-v1",
      approvedBy: f.userId,
      expiresAt: NOW + 20 * DAY,
      purpose: "own-post-descriptive-editorial-v1",
      dialect: "post-fields-repost-v2",
      accessEvidence: "Synthetic only",
      rightsEvidence: "Synthetic only",
      pricingEvidence: "Synthetic only",
      protocolEvidence: "Synthetic only",
      allocationEvidence: "Synthetic only",
      fields: ["impressions", "replies"],
      unit: "single-post-request",
      unitMicros: 1,
      currency: "USD",
      retentionMs: 30 * DAY,
      connectionSequence: 0,
      providerIdentity: "synthetic",
      allocatedProviderLimitMicros: 1000,
    });
    await ctx.db.insert("performanceControls", {
      ...args,
      enabled: false,
      deleted: false,
      generation: 1,
      actorId: f.userId,
      connectionSequence: 0,
      updatedAt: Date.now(),
    });
    const credentialId = await ctx.db.insert("xCredentials", {
      ...args,
      generation: 1,
      envelope: {
        version: 1,
        keyId: "test",
        iv: "synthetic",
        ciphertext: "not-a-live-token",
      },
      expiresAt: NOW + 20 * DAY,
      scopes: ["tweet.read", "users.read"],
      leaseUntil: 0,
      cleanAfter: NOW + 20 * DAY,
    });
    await ctx.db.insert("xBindings", {
      ...args,
      providerIdentity: "synthetic",
      changedAt: Date.now(),
    });
    const budgetIds: Id<"aiBudgets">[] = [];
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      budgetIds.push(
        await ctx.db.insert("aiBudgets", {
          key: [
            "metrics:x",
            `metrics:workspace:${args.workspaceId}`,
            `metrics:account:${args.accountId}`,
          ][i],
          scope,
          ...(i ? { workspaceId: args.workspaceId, approvedBy: f.userId } : {}),
          ...(i === 2 ? { accountId: args.accountId } : {}),
          policyVersion: "synthetic-reply-v1",
          currency: "USD",
          purposes: ["own-metrics"],
          expiresAt: NOW + 20 * DAY,
          limitMicros: 1000,
          heldMicros: 0,
          spentMicros: 1000,
        }),
      );
    return { jevPolicy, control, policyId, credentialId, budgetIds };
  });
  let sequence = 100;
  async function publication(publishedAt: number) {
    const id = String(++sequence);
    vi.setSystemTime(publishedAt - 2000);
    const native = await f.t.run(async (ctx) => {
      const draftId = await ctx.db.insert("drafts", {
        workspaceId: args.workspaceId,
        revision: 1,
        currentVersionId: null,
        authorId: f.userId,
        source: "manual",
        updatedAt: Date.now(),
      });
      const versionId = await ctx.db.insert("draftVersions", {
        workspaceId: args.workspaceId,
        draftId,
        number: 1,
        content: {
          title: "Synthetic independent text",
          text: ["A measured fixture only"],
          media: [],
          accountId: args.accountId,
          pillar: "",
          strategy: "",
        },
        authorId: f.userId,
        createdAt: Date.now(),
        reason: "Synthetic",
      });
      await ctx.db.patch(draftId, { currentVersionId: versionId });
      const analysisReceiptId = await ctx.db.insert("aiAttempts", {
        ...f.request,
        draftId,
        draftVersionId: versionId,
        operationKey: `synthetic-${id}`,
        owner: "jev-analyzer",
        provider: "typesafe",
        purpose: "analyzer",
        operation: "systemone",
        policyId: setup.jevPolicy._id,
        policyFingerprint: await sha256(JSON.stringify(setup.jevPolicy)),
        policyVersion: setup.jevPolicy.version,
        currency: "USD",
        controlId: setup.control._id,
        requestFingerprint: `synthetic-input-${id}`,
        questionVersion: POST_ANALYSIS.version,
        normalizationVersion: "jev-normalization-v1",
        model: "jev-1.13.0",
        resolvedModel: "jev-1.13.0",
        inputMicrosPerMillion: 1000000,
        outputMicrosPerMillion: 0,
        maxInputTokens: 16000,
        maxOutputTokens: 1000,
        budgetIds: [],
        reservedMicros: 1,
        heldMicros: 0,
        estimatedMicros: 1,
        billedMicros: null,
        state: "settled",
        sentAt: publishedAt - 2000,
        settledAt: publishedAt - 1500,
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 500,
        outcome: "success",
        fallback: "none",
      });
      const answers: NonNullable<Doc<"jevAssessments">["result"]["answers"]> =
        Object.fromEntries(
          Object.entries(POST_ANALYSIS.questions).map(([key, q]) => [
            key,
            q.type === "choice"
              ? { type: "choice", value: "educational", confidence: 1 }
              : q.type === "score"
                ? { type: "score", value: 0.5, confidence: 1 }
                : { type: "noul", probability: 0.1 },
          ]),
        );
      const described = describeThread(
        [{ position: 0, text: "A measured fixture only" }],
        [],
        { maxText: 280 },
      );
      const assessmentId = await ctx.db.insert("jevAssessments", {
        ...args,
        draftId,
        draftVersionId: versionId,
        versionNumber: 1,
        algorithmId: f.request.algorithmId,
        audienceId: f.request.audienceId,
        semanticKey: `synthetic-semantic-${id}`,
        inputVersion: "dispatch-assessment-input-v1",
        attemptId: analysisReceiptId,
        provenance: {
          policyId: setup.jevPolicy._id,
          policyVersion: setup.jevPolicy.version,
          requestedModel: "jev-1.13.0",
          resolvedModel: "jev-1.13.0",
          sentAt: publishedAt - 2000,
          settledAt: publishedAt - 1500,
          inputTokens: 1,
          outputTokens: 1,
          latencyMs: 500,
          selectionRevision: 1,
        },
        createdAt: publishedAt - 1000,
        sourceUntil: null,
        result: {
          outcome: "success",
          answers,
          score: dispatchScore(answers, described.structure),
          questionVersion: "jev-post-analysis-v1",
          normalizationVersion: "jev-normalization-v1",
          deterministic: {
            ...described,
            segments: described.segments.map(({ text: _text, ...s }) => s),
          },
        },
      });
      const approvalId = await ctx.db.insert("approvals", {
        ...args,
        draftId,
        versionId,
        actorId: f.userId,
        createdAt: Date.now(),
        revokedAt: null,
        revokedBy: null,
      });
      const scheduleId = await ctx.db.insert("schedules", {
        ...args,
        draftId,
        versionId,
        versionNumber: 1,
        approvalId,
        actorId: f.userId,
        generation: 1,
        at: publishedAt,
        timezone: "UTC",
        localTime: new Date(publishedAt).toISOString().slice(0, 16),
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
        providerIdentity: "synthetic",
        connectionSequence: 0,
        position: 0,
        attempt: 1,
        claimSequence: 1,
        leaseUntil: 0,
        deadline: publishedAt + 10000,
        stage: "confirmed",
        mediaIds: [],
        externalId: id,
        requestStartedAt: publishedAt - 500,
        confirmedAt: publishedAt + 100,
        createdAt: publishedAt - 500,
        updatedAt: publishedAt + 100,
        durationMs: 100,
      });
      await ctx.db.patch(scheduleId, {
        externalPosts: [
          {
            position: 0,
            externalId: id,
            url: `https://x.com/i/status/${id}`,
            attemptId: postAttemptId,
            confirmedAt: publishedAt + 100,
          },
        ],
      });
      const knowledgeId = await ctx.db.insert("publicationKnowledge", {
        ...args,
        scheduleId,
        postAttemptId,
        generation: 1,
        versionId,
        providerIdentity: "synthetic",
        network: "x",
        capturedAt: publishedAt - 750,
        assessmentId,
        applicable: true,
        reason: null,
      });
      return {
        postAttemptId,
        assessmentId,
        analysisReceiptId,
        knowledgeId,
        versionId,
        scheduleId,
      };
    });
    vi.setSystemTime(publishedAt + DAY);
    const observed = await f.t.run(async (ctx) => {
      const snapshotId = await ctx.db.insert("performanceSnapshots", {
        ...args,
        ...{
          postAttemptId: native.postAttemptId,
          scheduleId: native.scheduleId,
          versionId: native.versionId,
        },
        externalId: id,
        position: 0,
        confirmedAt: publishedAt + 100,
        windowHours: 24,
        dueAt: publishedAt + DAY + 100,
        generation: 1,
        state: "observed",
        attemptId: null,
        requestedAt: publishedAt + DAY - 100,
        observedAt: publishedAt + DAY,
        providerCreatedAt: publishedAt,
        definitionVersion: "synthetic-reply-v1",
        dialect: "post-fields-repost-v2",
        fields: [
          {
            name: "replies",
            rawField: "public_metrics.reply_count",
            definition: definitions.replies,
            status: "measured",
            value: 2,
          },
          {
            name: "impressions",
            rawField: "public_metrics.impression_count",
            definition: definitions.impressions,
            status: "measured",
            value: 100,
          },
        ],
        reason: null,
        expiresAt: publishedAt + DAY + 30 * DAY,
      });
      const policy = (await ctx.db.get(setup.policyId))!;
      const metricReceiptId = await ctx.db.insert("aiAttempts", {
        ...args,
        owner: "own-metrics",
        provider: "x",
        purpose: "own-post-descriptive-editorial-v1",
        snapshotId,
        policyId: policy._id,
        policyFingerprint: await sha256(JSON.stringify(policy)),
        policyVersion: policy.version,
        generation: 1,
        credentialGeneration: 1,
        budgetIds: setup.budgetIds,
        currency: "USD",
        unit: "single-post-request",
        unitMicros: 1,
        reservedMicros: 1,
        heldMicros: 0,
        estimatedMicros: 1,
        billedMicros: null,
        state: "settled",
        sentAt: publishedAt + DAY - 100,
        settledAt: publishedAt + DAY - 50,
        receiptFingerprint: `synthetic-outcome-${id}`,
        errorCode: null,
      });
      await ctx.db.patch(snapshotId, { attemptId: metricReceiptId });
      return { snapshotId, metricReceiptId };
    });
    vi.setSystemTime(NOW);
    return { ...native, ...observed };
  }
  const units = [];
  for (const days of [6, 4, 2]) units.push(await publication(NOW - days * DAY));
  vi.setSystemTime(NOW + 1000);
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
            expiresAt: NOW + 30 * DAY,
          },
        },
      },
    );
    return { subject: user.authId, sessionId: session._id };
  });
  f.signed = f.t.withIdentity(identity);
  const purposeId = await f.t.mutation(configure, {
    ...args,
    version: "synthetic-native-local-v1",
    target: "dispatch-local-reply-ordering-v1",
    providerIdentity: "synthetic",
    rightsEvidence:
      "Synthetic test only: native analysis derivatives and measured event/impression outcomes",
    explanation: "Independent native text; local only",
    approvedBy: f.userId,
    expiresAt: NOW + 20 * DAY,
    retentionMs: 30 * DAY,
  });
  const view = await f.signed.query(get, args);
  await f.signed.mutation(consent, {
    ...args,
    purposeId,
    purposeFingerprint: view.configuration.fingerprint,
    enabled: true,
    commandKey: "native-consent",
  });
  vi.setSystemTime(NOW + 2000);
  const specInput = {
    ...args,
    purposeId,
    commandKey: "spec-one",
    mode: "retrospective" as const,
    from: NOW - 7 * DAY,
    fitCutoff: NOW - 5 * DAY + 1000,
    holdout1Start: NOW - 4 * DAY,
    holdout1End: NOW - 3 * DAY + 1000,
    holdout2Start: NOW - 2 * DAY,
    holdout2End: NOW - DAY + 1000,
    referencePostAttemptId: units[0].postAttemptId,
    referenceAssessmentId: units[0].assessmentId,
  };
  const specId = await f.signed.mutation(specFn, specInput);
  vi.setSystemTime(NOW + 3000);
  const buildInput = {
    ...args,
    specId,
    asOf: Date.now(),
    commandKey: "build-one",
  };
  return {
    ...f,
    args,
    setup,
    publication,
    units,
    purposeId,
    purposeFingerprint: view.configuration.fingerprint,
    specInput,
    specId,
    buildInput,
  };
}
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
