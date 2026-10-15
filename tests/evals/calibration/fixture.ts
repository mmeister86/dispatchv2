import { vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { jevFixture } from "../../jev-fixture";
import { components, api, internal } from "../../../convex/_generated/api";
import { sha256 } from "../../../convex/lib/crypto";
import {
  describeThread,
  dispatchScore,
} from "../../../convex/ai/scoring/dispatchScore";
import { POST_ANALYSIS } from "../../../convex/ai/jev/questions/postAnalysis";
import { definitions } from "../../../convex/performance/normalize";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
export const DAY = 86400000,
  NOW = Date.parse("2026-10-06T12:00:00Z");
const get = makeFunctionReference<"query">("performance/calibration:get");
const configure = makeFunctionReference<"mutation">(
  "performance/calibration:configurePurpose",
);
const consent = makeFunctionReference<"mutation">(
  "performance/calibration:consent",
);
const specFn = makeFunctionReference<"mutation">(
  "performance/calibration:createSpec",
);
// Reuse only the authenticated isolated DB/profile fixture. Native publication pairs below are original cases.
export async function corpus() {
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
    vi.setSystemTime(publishedAt + DAY + 300);
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
        requestedAt: publishedAt + DAY + 150,
        observedAt: publishedAt + DAY + 300,
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
        sentAt: publishedAt + DAY + 100,
        settledAt: publishedAt + DAY + 250,
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

// A genuine native 30-post/28-day prospective screen. Synthetic mechanics only, never live rights or empirical defaults.
export async function qualifiedCorpus() {
  const f = await corpus();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.setup.policyId, { expiresAt: NOW + 60 * DAY });
    const metrics = (await ctx.db.get(f.setup.policyId))!,
      fingerprint = await sha256(JSON.stringify(metrics));
    await ctx.db.patch(f.setup.jevPolicy._id, { expiresAt: NOW + 60 * DAY });
    const jev = (await ctx.db.get(f.setup.jevPolicy._id))!;
    Object.assign(f.setup.jevPolicy, jev);
    for (const u of f.units) {
      await ctx.db.patch(u.metricReceiptId, { policyFingerprint: fingerprint });
      await ctx.db.patch(u.analysisReceiptId, {
        policyFingerprint: await sha256(JSON.stringify(jev)),
      });
    }
    await ctx.db.patch(f.setup.credentialId, {
      expiresAt: NOW + 60 * DAY,
      scopes: ["tweet.read", "users.read", "tweet.write"],
    });
    const account = (await ctx.db.get(f.args.accountId))!;
    await ctx.db.patch(account._id, {
      capability: { ...account.capability, publish: true },
      xEvidence: {
        scopes: ["tweet.read", "users.read", "tweet.write"],
        identityVerifiedAt: NOW,
        connectionSequence: 0,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "verified",
      },
    });
    for (const b of await ctx.db.query("aiBudgets").take(10))
      await ctx.db.patch(b._id, { expiresAt: NOW + 60 * DAY });
    const alg = (await ctx.db.get(f.request.algorithmId))!;
    await ctx.db.patch(alg._id, {
      payload: { ...alg.payload, reviewDueAt: NOW + 60 * DAY },
    });
  });
  async function features(units: Awaited<ReturnType<typeof f.publication>>[]) {
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
  }
  const train = [...f.units];
  for (let i = 0; i < 23; i++) train.push(await f.publication(NOW + 60000 * i));
  await features(train);
  vi.setSystemTime(NOW + 2 * DAY + 6000);
  const purposeId = await f.t.mutation(
    internal.performance.calibration.configurePurpose,
    {
      ...f.args,
      version: "finite-native-purpose",
      target: "dispatch-local-reply-ordering-v1",
      providerIdentity: "synthetic",
      rightsEvidence: "Synthetic native test only; no real permission",
      explanation: "Synthetic mechanics only",
      approvedBy: f.userId,
      expiresAt: NOW + 60 * DAY,
      retentionMs: 30 * DAY,
    },
  );
  const view = await f.signed.query(api.performance.calibration.get, f.args);
  await f.signed.mutation(api.performance.calibration.consent, {
    ...f.args,
    purposeId,
    purposeFingerprint: view.configuration!.fingerprint,
    enabled: true,
    commandKey: "finite-consent",
  });
  const specId = await f.signed.mutation(
    api.performance.calibration.createSpec,
    {
      ...f.specInput,
      purposeId,
      commandKey: "finite-original-spec",
      mode: "prospective",
      fitCutoff: NOW + 2 * DAY,
      holdout1Start: NOW + 3 * DAY,
      holdout1End: NOW + 6 * DAY,
      holdout2Start: NOW + 20 * DAY,
      holdout2End: NOW + 23 * DAY + 1000,
    },
  );
  const experimentId = await f.signed.mutation(
    api.performance.models.predeclare,
    {
      ...f.args,
      specId,
      commandKey: "finite-original-experiment",
      policy: {
        minTrainN: 2,
        minTrainSpanMs: DAY,
        minBlockN: 2,
        maxExcludedFraction: 1,
        minImprovement: 0,
        maxVariation: 1,
        maxClarityDrift: 1,
        maxDiscussionDrift: 1,
        maxReplyRateDrift: 100,
        reviewUntil: NOW + 60 * DAY,
        evidence: "Synthetic engineering mechanics",
        rationale: "No actual thresholds or empirical suitability claim",
      },
    },
  );
  const trainSnapshotId = await f.signed.mutation(
    api.performance.calibration.build,
    {
      ...f.args,
      specId,
      asOf: Date.now(),
      commandKey: "finite-train",
    },
  );
  const candidateId = await f.signed.mutation(api.performance.models.fit, {
    ...f.args,
    experimentId,
    snapshotId: trainSnapshotId,
    commandKey: "finite-freeze",
  });
  const held = [];
  for (const day of [3, 4, 21, 22])
    held.push(await f.publication(NOW + day * DAY));
  await features(held);
  vi.setSystemTime(NOW + 23 * DAY + 1000);
  const snapshotId = await f.signed.mutation(
    api.performance.calibration.build,
    {
      ...f.args,
      specId,
      asOf: Date.now(),
      commandKey: "finite-original-mature",
    },
  );
  const evaluationId = await f.signed.mutation(api.performance.models.compare, {
    ...f.args,
    experimentId,
    snapshotId,
    commandKey: "finite-original-compare",
  });
  const monitoringSpecId = await f.signed.mutation(
    api.performance.calibration.createSpec,
    {
      ...f.specInput,
      purposeId,
      referencePostAttemptId: held[3].postAttemptId,
      referenceAssessmentId: held[3].assessmentId,
      commandKey: "finite-monitor-spec",
      mode: "prospective",
      from: NOW + 22 * DAY - 1,
      fitCutoff: NOW + 23 * DAY + 500,
      holdout1Start: NOW + 23 * DAY + 4000,
      holdout1End: NOW + 24 * DAY + 8000,
      holdout2Start: NOW + 24 * DAY + 3600000,
      holdout2End: NOW + 25 * DAY,
    },
  );
  const monitoringPolicy = {
    minBlockN: 2,
    minBlockSpanMs: 500,
    maxExcludedFraction: 1,
    minImprovement: 0,
    maxClarityDrift: 1,
    maxDiscussionDrift: 1,
    maxReplyRateDrift: 100,
    reviewUntil: NOW + 25 * DAY,
    finalValidUntil: NOW + 24 * DAY + 3600000,
    evidence: "Synthetic engineering mechanics only",
    rationale: "One measured checkpoint; no empirical adequacy claim",
  };
  const declarationId = await f.signed.mutation(
    api.performance.models.declareMonitoring,
    {
      ...f.args,
      candidateId,
      evaluationId,
      monitoringSpecId,
      policy: monitoringPolicy,
      commandKey: "finite-monitor-declare",
    },
  );
  async function mature(pass = true) {
    const units: Awaited<ReturnType<typeof f.publication>>[] = [];
    for (const offset of [5000, 6000])
      units.push(await f.publication(NOW + 23 * DAY + offset));
    await features(units);
    if (!pass)
      await f.t.run(async (ctx) => {
        for (const u of units) {
          const snap = (await ctx.db.get(u.snapshotId))!;
          await ctx.db.patch(u.snapshotId, {
            fields: snap.fields.map((x) =>
              x.name === "replies" ? { ...x, value: 1 } : x,
            ),
          });
        }
      });
    vi.setSystemTime(NOW + 24 * DAY + 8000);
    const monitoringSnapshotId = await f.signed.mutation(
      api.performance.calibration.build,
      {
        ...f.args,
        specId: monitoringSpecId,
        asOf: Date.now(),
        commandKey: "finite-monitor-mature",
      },
    );
    return { units, monitoringSnapshotId };
  }
  return {
    ...f,
    train,
    features,
    held,
    purposeId,
    specId,
    experimentId,
    candidateId,
    evaluationId,
    monitoringSpecId,
    monitoringPolicy,
    declarationId,
    mature,
  };
}
