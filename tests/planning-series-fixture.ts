import { vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { sourceFixture, send } from "./github-fixture";
import { sha256 } from "../convex/lib/crypto";
export async function fixture(
  count = 4,
  dimension = count + 1,
  manual = false,
  rich = false,
  initialTime = "2026-10-06T08:00:00Z",
  workCandidates = manual ? 0 : count,
) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(initialTime));
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-not-live");
  const f = await sourceFixture(),
    until = Date.now() + 30 * 86400000;
  const { accountId, preferenceId } = await f.t.run(async (ctx) => {
    // Synthetic configured horizons prove four-week mechanics. No live grants/retention are changed.
    await ctx.db.patch(f.repositories[0], {
      content: true,
      proofExpiresAt: until,
    });
    const conn = (await ctx.db.query("githubConnections").first())!;
    await ctx.db.patch(conn._id, { expiresAt: until });
    return {
      accountId: await ctx.db.insert("socialAccounts", {
        workspaceId: f.workspaceId,
        provider: "X",
        providerIdentity: "123",
        name: "Synthetic",
        handle: "synthetic",
        connection: "connected",
        capability: {
          maxText: 280,
          maxThread: 10,
          maxMedia: 4,
          mediaTypes: [],
          publish: true,
        },
      }),
      preferenceId: (await ctx.db
        .query("preferences")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
        )
        .unique())!._id,
    };
  });
  const scope = { workspaceId: f.workspaceId, accountId };
  const style = await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 0,
    commandKey: "save-style",
    action: {
      kind: "save",
      payload: {
        author: "Synthetic author",
        experiences: [],
        tone: "Precise",
        positioning: "Synthetic",
        pillars: [{ name: "Product", weight: 100 }],
        examples: [],
        forbidden: [],
      },
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Explicit synthetic declaration",
    },
  });
  await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: style.revision,
    commandKey: "select-style",
    action: {
      kind: "select",
      versionId: style.versionId!,
      reason: "Explicit selection",
    },
  });
  const policyId = await f.t.mutation(internal.content.similarity.configure, {
    ...scope,
    version: "synthetic-series",
    enabled: true,
    approvedBy: f.userId,
    expiresAt: until,
    purpose: "own-content-semantic-retrieval-v1",
    provider: "requesty",
    baseURL: "https://router.eu.requesty.ai/v1",
    model: "synthetic/series",
    identity: {
      resolvedModel: "synthetic/series",
      dimension,
      assembly: "own-text-v1",
      normalization: "cosine-float-v1",
    },
    processingEvidence: "Synthetic only",
    upstreamEuEvidence: "Synthetic only",
    storageEvidence: "Synthetic only",
    trainingEvidence: "Synthetic only",
    retentionEvidence: "Synthetic only",
    rightsEvidence: "Synthetic only",
    pricingEvidence: "Synthetic only",
    protocolEvidence: "Synthetic only",
    allocationEvidence: "Synthetic only",
    currency: "USD",
    inputMicrosPerMillion: 1,
    allocatedProviderLimitMicros: 100000,
    maxInputTokens: 12000,
    retentionMs: 30 * 86400000,
    maxDurationMs: 20000,
  });
  await f.t.run(async (ctx) => {
    for (const [i, scopeName] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key: [
          "embedding:requesty",
          `embedding:workspace:${f.workspaceId}`,
          `embedding:account:${accountId}`,
        ][i],
        scope: scopeName,
        ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
        ...(i === 2 ? { accountId } : {}),
        purposes: ["own-content-embedding"],
        policyVersion: "synthetic-series",
        currency: "USD",
        expiresAt: until,
        limitMicros: 100000,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  await f.signed.mutation(api.content.similarity.consent, {
    ...scope,
    policyId,
    enabled: true,
    ownHistory: true,
    draftVersions: true,
    consentEvidence: "Explicit synthetic",
    expiresAt: until,
    expectedGeneration: 0,
  });
  const historyPostId = await syntheticHistory(
    { ...f, accountId },
    until,
    rich,
  );
  const historyAttempt = await f.signed.mutation(
    api.content.similarity.prepare,
    {
      ...scope,
      source: { kind: "history", historyPostId },
      commandKey: "synthetic-history-vector",
    },
  );
  await f.signed.mutation(internal.content.similarity.claim, {
    attemptId: historyAttempt,
  });
  await f.t.mutation(internal.content.similarity.settle, {
    attemptId: historyAttempt,
    inputTokens: 1,
    errorCode: null,
  });
  await f.t.mutation(internal.content.similarity.commit, {
    attemptId: historyAttempt,
    vector: Array.from({ length: dimension }, (_, i) =>
      i === dimension - 1 ? 1 : 0,
    ),
  });
  await send(f);
  const receipt = (await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  ))!;
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt._id,
  });
  const signal = (await f.t.run((ctx) =>
    ctx.db.query("githubSignals").first(),
  ))!;
  const candidateVersionIds: Id<"draftVersions">[] = [],
    vectorIds: Id<"contentEmbeddings">[] = [];
  for (let i = 0; i < count; i++) {
    let versionId: Id<"draftVersions">;
    if (i >= workCandidates) {
      const draftId = await f.signed.mutation(api.editorial.create, {
        workspaceId: f.workspaceId,
        source: "Explicit manual synthetic",
        content: {
          accountId,
          title: `Manual ${i}`,
          text: [`Meaning ${i}`],
          pillar: "Product",
          strategy: "",
          media: [],
        },
      });
      versionId = (await f.t.run((ctx) => ctx.db.get(draftId)))!
        .currentVersionId!;
    } else {
      const ideaId = await f.signed.mutation(api.content.ideas.create, {
        workspaceId: f.workspaceId,
        operationKey: `series-idea-${i}`,
        title: `Material ${i}`,
        note: "Explicit synthetic",
        perspective: "Product",
        priority: "normal",
        source: { kind: "signal", signalId: signal._id },
      });
      const handoff = await f.signed.mutation(api.content.ideas.handoff, {
        workspaceId: f.workspaceId,
        ideaId,
        expectedRevision: 1,
        accountId,
        intent: "Exact existing material",
        draftText: `Meaning ${i}`,
        clarificationConfirmed: true,
      });
      versionId = handoff.versionId;
    }
    candidateVersionIds.push(versionId);
    const attemptId = await f.signed.mutation(api.content.similarity.prepare, {
      ...scope,
      source: { kind: "draft", draftVersionId: versionId },
      commandKey: `embedding-${i}`,
    });
    await f.signed.mutation(internal.content.similarity.claim, { attemptId });
    await f.t.mutation(internal.content.similarity.settle, {
      attemptId,
      inputTokens: 1,
      errorCode: null,
    });
    vectorIds.push(
      (await f.t.mutation(internal.content.similarity.commit, {
        attemptId,
        vector: Array.from({ length: dimension }, (_, j) => (i === j ? 1 : 0)),
      }))!,
    );
  }
  const config = {
    preferenceId,
    styleVersionId: style.versionId!,
    theme: "Explicit theme",
    candidateVersionIds,
    pillars: [{ name: "Product", weight: 100 }],
    desiredFormat: "single" as const,
    threshold: 0.9,
    timezone: "UTC",
    frequency: "weekly" as const,
    weekday: 2,
    callbackClock: "09:00",
    publishingClocks: ["10:00", "11:00", "12:00"],
    start: "2026-10-06",
    end: "2026-11-02",
    occurrences: 4,
    itemsPerBatch: 3,
    historyFrom: Date.now() - 86400000,
    historyTo: Date.now(),
  };
  const request = {
    ...scope,
    expectedRevision: 0,
    commandKey: "series-command",
    action: { kind: "configure" as const, config },
  };
  const create = () => f.signed.mutation(api.planning.strategy.change, request);
  const fire = async (seriesId: Id<"planningSeries">) => {
    const s = (await f.t.run((ctx) => ctx.db.get(seriesId)))!;
    vi.setSystemTime(s.nextAt!);
    return f.t.mutation(internal.planning.recurring.fire, {
      seriesId,
      versionId: s.versionId!,
      generation: s.generation,
      at: s.nextAt!,
      index: s.nextIndex,
      key: s.nextKey!,
    });
  };
  return {
    historyPostId,
    ...f,
    ...scope,
    config,
    request,
    create,
    fire,
    vectorIds,
    policyId,
    style,
  };
}
async function syntheticHistory(
  f: Awaited<ReturnType<typeof sourceFixture>> & {
    accountId: Id<"socialAccounts">;
  },
  until: number,
  rich = false,
) {
  return f.t.run(async (ctx) => {
    await ctx.db.patch(f.accountId, {
      xEvidence: {
        scopes: ["tweet.read", "users.read"],
        identityVerifiedAt: Date.now(),
        connectionSequence: 0,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "unverified",
      },
    });
    await ctx.db.insert("xBindings", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      providerIdentity: "123",
      changedAt: Date.now(),
    });
    await ctx.db.insert("xCredentials", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      generation: 1,
      envelope: {
        version: 1,
        keyId: "synthetic",
        iv: "synthetic",
        ciphertext: "synthetic",
      },
      expiresAt: until,
      scopes: ["tweet.read", "users.read"],
      leaseUntil: 0,
      cleanAfter: until,
    });
    const policyId = await ctx.db.insert("historyPolicies", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      version: "synthetic-history",
      approvedBy: f.userId,
      expiresAt: until,
      purpose: "own-history-analytics-context-v1",
      dialect: "post-fields-repost-v2",
      providerIdentity: "123",
      connectionSequence: 0,
      accessEvidence: "Synthetic",
      rightsEvidence: "Synthetic",
      pricingEvidence: "Synthetic",
      protocolEvidence: "Synthetic",
      allocationEvidence: "Synthetic",
      unit: "returned-post-resource",
      unitMicros: 1,
      currency: "USD",
      allocatedProviderLimitMicros: 1000,
      retentionMs: 30 * 86400000,
      maxResults: 100,
    });
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key: [
          "history:x",
          `history:workspace:${f.workspaceId}`,
          `history:account:${f.accountId}`,
        ][i],
        scope,
        ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
        ...(i === 2 ? { accountId: f.accountId } : {}),
        policyVersion: "synthetic-history",
        currency: "USD",
        purposes: ["own-history"],
        expiresAt: until,
        limitMicros: 1000,
        heldMicros: 0,
        spentMicros: 0,
      });
    await ctx.db.insert("historyControls", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      generation: 1,
      deletedThroughGeneration: 0,
      updatedAt: Date.now(),
    });
    const jobId = await ctx.db.insert("historyJobs", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      actorId: f.userId,
      generation: 1,
      policyId,
      policyFingerprint: await sha256(
        JSON.stringify(await ctx.db.get(policyId)),
      ),
      sourceUntil: until,
      state: "completed",
      pages: 1,
      imported: 1,
      rejected: 0,
      cursor: null,
      seenCursors: [],
      attemptId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reason: null,
    });
    return ctx.db.insert("historyPosts", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      jobId,
      generation: 1,
      externalId: "1000",
      network: "x",
      origin: "own-history-import",
      providerCreatedAt: Date.now() - 1000,
      observedAt: Date.now(),
      sourceUntil: until,
      text: rich
        ? "Synthetic retained original history ".padEnd(12000, "x")
        : "Synthetic retained original history",
      contentType: "original",
      mediaType: "none",
      replyTo: null,
      accountSize: null,
      postAttemptId: null,
      versionId: null,
      thenKnowledgeId: null,
      historicalAnalysisId: null,
      metricsStatus: "not-observed",
      removed: false,
    });
  });
}
