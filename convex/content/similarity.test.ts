import { afterEach, expect, test, vi } from "vitest";
import { mediaFixture } from "../../tests/media-fixture";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { sha256 } from "../lib/crypto";
async function history(
  f: Awaited<ReturnType<typeof fixture>>,
  count: number,
  rich = false,
) {
  const until = Date.now() + 86400000;
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.accountId, {
      providerIdentity: "123",
      xEvidence: {
        scopes: ["tweet.read", "users.read"],
        identityVerifiedAt: Date.now(),
        connectionSequence: 0,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "unverified",
      },
    });
    const c = (await ctx.db.query("embeddingControls").first())!;
    await ctx.db.patch(c._id, { providerIdentity: "123" });
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
    const pId = await ctx.db.insert("historyPolicies", {
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
      retentionMs: 86400000,
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
    const p = (await ctx.db.get(pId))!,
      jobId = await ctx.db.insert("historyJobs", {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        actorId: f.userId,
        generation: 1,
        policyId: pId,
        policyFingerprint: await sha256(JSON.stringify(p)),
        sourceUntil: until,
        state: "completed",
        pages: 1,
        imported: count,
        rejected: 0,
        cursor: null,
        seenCursors: [],
        attemptId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reason: null,
      });
    for (let i = 0; i < count; i++)
      await ctx.db.insert("historyPosts", {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        jobId,
        generation: 1,
        externalId: `${1000 + i}`,
        network: "x",
        origin: "own-history-import",
        providerCreatedAt: Date.now() - i,
        observedAt: Date.now(),
        sourceUntil: until,
        text: rich
          ? `Historical ${i} `.padEnd(12000, "x")
          : `Historical own meaning ${i}`,
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
  return f.t.run((ctx) => ctx.db.query("historyPosts").collect());
}

const availability = api.content.similarity.availability,
  configure = internal.content.similarity.configure,
  consent = api.content.similarity.consent,
  prepare = api.content.similarity.prepare,
  settle = internal.content.similarity.settle,
  sweep = internal.content.similarity.sweep,
  frame = api.content.similarity.frame,
  execute = api.ai.embeddings.execute;
async function fixture(dimension = 3, rich = false, ttl = 86400000) {
  const f = await mediaFixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic-own",
      name: "Own",
      handle: "own",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: false,
      },
    }),
  );
  const evidence = rich
    ? "Synthetic only ".padEnd(2000, "x")
    : "Synthetic only";
  const args = { workspaceId: f.workspaceId, accountId },
    expiresAt = Date.now() + ttl;
  const policyId = (await f.t.mutation(configure, {
    ...args,
    version: "synthetic-v1",
    enabled: true,
    approvedBy: f.userId,
    expiresAt,
    purpose: "own-content-semantic-retrieval-v1",
    provider: "requesty",
    baseURL: "https://router.eu.requesty.ai/v1",
    model: "synthetic/embedding",
    identity: {
      resolvedModel: "synthetic/embedding",
      dimension,
      assembly: "own-text-v1",
      normalization: "cosine-float-v1",
    },
    processingEvidence: evidence,
    upstreamEuEvidence: evidence,
    storageEvidence: evidence,
    trainingEvidence: evidence,
    retentionEvidence: evidence,
    rightsEvidence: evidence,
    pricingEvidence: evidence,
    protocolEvidence: rich
      ? evidence
      : "Synthetic prompt and total token estimate only",
    allocationEvidence: evidence,
    currency: "USD",
    inputMicrosPerMillion: 1000000,
    allocatedProviderLimitMicros: 100000,
    maxInputTokens: 12000,
    retentionMs: 86400000,
    maxDurationMs: 20000,
  })) as Id<"embeddingPolicies">;
  await f.t.run(async (ctx) => {
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key: [
          "embedding:requesty",
          `embedding:workspace:${f.workspaceId}`,
          `embedding:account:${accountId}`,
        ][i],
        scope,
        ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
        ...(i === 2 ? { accountId } : {}),
        purposes: ["own-content-embedding"],
        policyVersion: "synthetic-v1",
        currency: "USD",
        expiresAt: Date.now() + 86400000,
        limitMicros: 100000,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  const change = (enabled = true, expectedGeneration = 0) =>
    f.signed.mutation(consent, {
      ...args,
      policyId,
      enabled,
      ownHistory: true,
      draftVersions: true,
      consentEvidence: "Synthetic explicit forwarding consent",
      expiresAt,
      expectedGeneration,
    });
  await change();
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "manual",
    content: {
      title: "Synthetic",
      text: rich
        ? Array.from({ length: 10 }, (_, i) =>
            `Small decisions ${i} `.padEnd(280, "x"),
          )
        : ["Small decisions improve the product."],
      accountId,
      media: [],
      pillar: "Product",
      strategy: "",
    },
  });
  const versionId = (await f.t.run((ctx) => ctx.db.get(draftId)))!
    .currentVersionId!;
  const request = {
    ...args,
    source: { kind: "draft" as const, draftVersionId: versionId },
    commandKey: "synthetic-command",
  };
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-not-live");
  return { ...f, ...args, policyId, draftId, versionId, request, change };
}
const response = (vector = [1, 0, 0], extra = {}) =>
  new Response(
    JSON.stringify({
      model: "synthetic/embedding",
      data: [{ index: 0, embedding: vector }],
      usage: { prompt_tokens: 40, total_tokens: 40 },
      ...extra,
    }),
    { headers: { "content-type": "application/json" } },
  );
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("registered semantic boundary is default OFF without a concrete policy or forwarding consent", async () => {
  const f = await mediaFixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic-own",
      name: "Own",
      handle: "own",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: false,
      },
    }),
  );
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(
    await f.signed.query(availability, {
      workspaceId: f.workspaceId,
      accountId,
    }),
  ).toMatchObject({
    enabled: false,
    reason: "EMBEDDING_CONFIGURATION_REQUIRED",
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(0);
});
test("registered prepare reserves three grants, sent precedes exactly one SDK transport, replay cannot resend", async () => {
  const f = await fixture(),
    attemptId = await f.signed.mutation(prepare, f.request);
  expect(await f.signed.mutation(prepare, f.request)).toBe(attemptId);
  const transport = vi.fn(async (url, init) => {
    expect(String(url)).toBe("https://router.eu.requesty.ai/v1/embeddings");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toEqual({
      model: "synthetic/embedding",
      input: ["Small decisions improve the product."],
      encoding_format: "float",
      dimensions: 3,
    });
    expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
      state: "sent",
      heldMicros: 12000,
    });
    for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
      expect(b.heldMicros).toBe(12000);
    return response();
  });
  vi.stubGlobal("fetch", transport);
  expect(await f.signed.action(execute, { attemptId })).toMatchObject({
    outcome: "prepared",
  });
  expect(await f.signed.action(execute, { attemptId })).toMatchObject({
    outcome: "replay",
  });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    state: "settled",
    inputTokens: 40,
    estimatedMicros: 40,
    billedMicros: null,
    heldMicros: 0,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(1);
  expect(
    JSON.stringify(
      await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
    ),
  ).not.toContain("Small decisions");
  await expect(
    f.signed.mutation(prepare, {
      ...f.request,
      source: {
        kind: "draft",
        draftVersionId: await f.signed.mutation(api.editorial.save, {
          workspaceId: f.workspaceId,
          draftId: f.draftId,
          expectedRevision: 1,
          content: {
            title: "Changed",
            text: ["Changed"],
            accountId: f.accountId,
            media: [],
            pillar: "Product",
            strategy: "",
          },
          reason: "test",
        }),
      },
    }),
  ).rejects.toThrow("EMBEDDING_COMMAND_CONFLICT");
});
test("malformed raw model, vector index, dimension, norm and usage never commit; unknown usage holds funds", async () => {
  for (const extra of [
    { model: "foreign-model" },
    { data: [{ index: 1, embedding: [1, 0, 0] }] },
    { data: [{ index: 0, embedding: [1, 0] }] },
    { data: [{ index: 0, embedding: [0, 0, 0] }] },
    { data: [{ index: 0, embedding: [1e308, 1e308, 1e308] }] },
    {
      data: [
        { index: 0, embedding: [1, 0, 0] },
        { index: 1, embedding: [0, 1, 0] },
      ],
    },
    { usage: { prompt_tokens: -1, total_tokens: -1 } },
    { usage: { prompt_tokens: 40, total_tokens: 41 } },
  ]) {
    const f = await fixture(),
      attemptId = await f.signed.mutation(prepare, f.request);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response([1, 0, 0], extra)),
    );
    expect(await f.signed.action(execute, { attemptId })).toMatchObject({
      outcome: "unavailable",
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
    ).toHaveLength(0);
    const t = await f.t.run((ctx) => ctx.db.get(attemptId));
    expect(t?.billedMicros).toBeNull();
    if ("usage" in extra)
      expect(t).toMatchObject({
        state: "unknown",
        heldMicros: 12000,
        estimatedMicros: null,
      });
  }
});
test("source and purpose loss during I/O discard coordinates but settle original usage once, purge preserves finance", async () => {
  for (const loss of ["purpose", "source", "actor"] as const) {
    const f = await fixture(),
      attemptId = await f.signed.mutation(prepare, f.request);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await f.t.run(async (ctx) => {
          if (loss === "source")
            await ctx.db.patch(f.versionId, { sourceUnavailable: true });
          if (loss === "purpose") {
            const c = (await ctx.db.query("embeddingControls").first())!;
            await ctx.db.patch(c._id, {
              enabled: false,
              generation: c.generation + 1,
            });
          }
          if (loss === "actor") {
            const m = (await ctx.db.query("memberships").first())!;
            await ctx.db.patch(m._id, { role: "Viewer" });
          }
        });
        return response();
      }),
    );
    expect(await f.signed.action(execute, { attemptId })).toMatchObject({
      outcome: "unavailable",
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
    ).toHaveLength(0);
    await f.t.mutation(settle, { attemptId, inputTokens: 40, errorCode: null });
    await f.t.mutation(sweep, { cursor: null, family: "attempts" });
    expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
      state: "settled",
      sourcePin: null,
      materialFingerprint: null,
      heldMicros: 0,
      estimatedMicros: 40,
    });
    for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
      expect(b).toMatchObject({ heldMicros: 0, spentMicros: 40 });
  }
});
test("network uncertainty and original late settlement keep exact financial ownership after purge", async () => {
  const f = await fixture(),
    attemptId = await f.signed.mutation(prepare, f.request);
  const transport = vi.fn(async () => {
    throw new Error("network lost");
  });
  vi.stubGlobal("fetch", transport);
  expect(await f.signed.action(execute, { attemptId })).toMatchObject({
    outcome: "unavailable",
  });
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    state: "unknown",
    heldMicros: 12000,
  });
  await f.change(false, 1);
  await f.t.mutation(sweep, { cursor: null, family: "attempts" });
  await f.t.mutation(settle, { attemptId, inputTokens: 40, errorCode: null });
  await f.t.mutation(settle, { attemptId, inputTokens: 40, errorCode: null });
  await expect(
    f.t.mutation(settle, { attemptId, inputTokens: 41, errorCode: null }),
  ).rejects.toThrow("EMBEDDING_RECEIPT_CONFLICT");
  for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 40 });
  expect(transport).toHaveBeenCalledTimes(1);
});
test("registered bounded frame uses cosine instead of lexical labels and masks/purges withdrawn vectors", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  const candidates = [f.versionId];
  for (const text of [
    "Different words, same meaning",
    "Small decisions improve the product unrelated",
  ]) {
    const id = await f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      source: "manual",
      content: {
        title: text,
        text: [text],
        accountId: f.accountId,
        media: [],
        pillar: "Product",
        strategy: "",
      },
    });
    candidates.push(
      (await f.t.run((ctx) => ctx.db.get(id)))!.currentVersionId!,
    );
  }
  const controlled = [
    [1, 0, 0],
    [0.99, 0.01, 0],
    [0, 1, 0],
  ];
  for (const [i, id] of candidates.entries()) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(controlled[i])),
    );
    const attemptId = await f.signed.mutation(prepare, {
      ...f.request,
      commandKey: `vector-${i}`,
      source: { kind: "draft", draftVersionId: id },
    });
    await f.signed.action(execute, { attemptId });
  }
  const args = {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    source: f.request.source,
    from: 0,
    to: Date.now(),
    candidateVersionIds: candidates,
    topK: 5,
  };
  const result = await f.signed.query(frame, args);
  expect(result).toMatchObject({
    eligible: 3,
    prepared: 3,
    missing: 0,
    complete: true,
  });
  expect(
    result.matches.map((m) =>
      m.source.kind === "draft" ? m.source.draftVersionId : null,
    ),
  ).toEqual([candidates[1], candidates[2]]);
  await f.t.run((ctx) =>
    ctx.db.patch(candidates[1], { sourceUnavailable: true }),
  );
  expect((await f.signed.query(frame, args)).matches).toHaveLength(1);
  await f.t.mutation(sweep, { cursor: null, family: "vectors" });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(2);
});
test("explicit 26 candidate frame and invalid date range return overflow rather than sampling", async () => {
  const f = await fixture();
  const ids: Id<"draftVersions">[] = [];
  for (let i = 0; i < 26; i++) {
    const id = await f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      source: "manual",
      content: {
        title: `D${i}`,
        text: [`D${i}`],
        accountId: f.accountId,
        media: [],
        pillar: "Product",
        strategy: "",
      },
    });
    ids.push((await f.t.run((ctx) => ctx.db.get(id)))!.currentVersionId!);
  }
  expect(
    await f.signed.query(frame, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      source: f.request.source,
      from: 0,
      to: Date.now(),
      candidateVersionIds: ids,
      topK: 5,
    }),
  ).toMatchObject({ overflow: true, complete: false, matches: [] });
});
test("full 100 imported-history plus 25 exact drafts frame fits native limits and cap+1 is explicit", async () => {
  const f = await fixture(4096, true),
    rows = await history(f, 100, true),
    ids = [f.versionId];
  for (let i = 1; i < 25; i++) {
    const id = await f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      source: "manual",
      content: {
        title: `D${i}`,
        text: Array.from({ length: 10 }, (_, j) =>
          `Own meaning ${i} ${j} `.padEnd(280, "x"),
        ),
        accountId: f.accountId,
        media: [],
        pillar: "Product",
        strategy: "",
      },
    });
    ids.push((await f.t.run((ctx) => ctx.db.get(id)))!.currentVersionId!);
  }
  // 32 exact idea nodes include 31 recursive protected ancestors; this draft root consumes the existing protected-ancestor cap of 32.
  let parent: Id<"ideaVersions"> | undefined;
  for (let i = 0; i < 32; i++) {
    parent = await noteVersion(f, parent);
    await f.t.run((ctx) =>
      ctx.db.patch(parent!, {
        note: "Synthetic retained note ".padEnd(12000, "x"),
      }),
    );
  }
  await f.t.run((ctx) => ctx.db.patch(ids[24], { ideaVersionId: parent }));
  // Genuine registered receipts/settlement, intercepted transport; these controlled vectors prove mechanics only.
  const sources = [
    ...rows.map((r) => ({ kind: "history" as const, historyPostId: r._id })),
    ...ids.map((id) => ({ kind: "draft" as const, draftVersionId: id })),
  ];
  // Raise only the synthetic financial grants; leave native Convex limits unchanged.
  await f.t.run(async (ctx) => {
    for (const b of await ctx.db.query("aiBudgets").collect())
      if (b.purposes.includes("own-content-embedding"))
        await ctx.db.patch(b._id, { limitMicros: 100000 });
  });
  for (const [i, s] of sources.entries()) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response([1, i / 125, ...Array(4094).fill(0)])),
    );
    const attemptId = await f.signed.mutation(prepare, {
      ...f.request,
      source: s,
      commandKey: `full-${i}`,
    });
    expect(await f.signed.action(execute, { attemptId })).toMatchObject({
      outcome: "prepared",
    });
  }
  const args = {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    source: f.request.source,
    from: 0,
    to: Date.now(),
    candidateVersionIds: ids,
    topK: 5,
  };
  const checked = await f.signed.run(async (ctx) => ({
    view: await ctx.runQuery(frame, args, {
      transactionLimits: {
        databaseQueries: 4096,
        bytesRead: 16 * 1024 * 1024,
        documentsRead: 32000,
      },
    }),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  console.log(
    "SEMANTIC MAX FRAME NATIVE METRICS",
    JSON.stringify(checked.metrics),
  );
  expect(checked.view).toMatchObject({
    scanned: 125,
    eligible: 125,
    prepared: 125,
    missing: 0,
    complete: true,
    overflow: false,
  });
  const cleanup = await f.t.run(async (ctx) => ({
    result: await ctx.runMutation(
      internal.content.similarity.purge,
      { draftVersionId: ids[24] },
      {
        transactionLimits: {
          databaseQueries: 4096,
          bytesRead: 16 * 1024 * 1024,
          documentsRead: 32000,
        },
      },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  console.log(
    "SEMANTIC MAX CLEANUP NATIVE METRICS",
    JSON.stringify(cleanup.metrics),
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(125);
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...r } = rows[0];
    await ctx.db.insert("historyPosts", { ...r, externalId: "99999" });
  });
  expect(
    await f.signed.query(frame, { ...args, to: Date.now() }),
  ).toMatchObject({
    scanned: 126,
    overflow: true,
    complete: false,
    matches: [],
  });
});
test("reconnect, foreign source, changed grants and unsafe costs cannot authorize a provider call", async () => {
  for (const corrupt of ["epoch", "foreign", "grant", "secret"] as const) {
    const f = await fixture(),
      attemptId = await f.signed.mutation(prepare, f.request);
    if (corrupt === "secret") vi.stubEnv("REQUESTY_API_KEY", "");
    await f.t.run(async (ctx) => {
      if (corrupt === "epoch") {
        await ctx.db.patch(f.accountId, {
          xEvidence: {
            scopes: [],
            identityVerifiedAt: Date.now(),
            connectionSequence: 1,
            textScopeEligible: false,
            mediaScopeEligible: false,
            liveWrite: "unverified",
          },
        });
      }
      if (corrupt === "foreign") {
        const foreign = await ctx.db.insert("workspaces", {
          name: "foreign",
          description: "",
        });
        await ctx.db.patch(f.versionId, { workspaceId: foreign });
      }
      if (corrupt === "grant") {
        const b = (await ctx.db.query("aiBudgets").first())!;
        await ctx.db.patch(b._id, { purposes: ["draft"] });
      }
    });
    const transport = vi.fn(async () => response());
    vi.stubGlobal("fetch", transport);
    expect(await f.signed.action(execute, { attemptId })).toMatchObject({
      outcome: "unavailable",
    });
    expect(transport).not.toHaveBeenCalled();
  }
});
test("observed safe token overrun settles original estimated liability once and refuses coordinates", async () => {
  const f = await fixture(),
    attemptId = await f.signed.mutation(prepare, f.request);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      response([1, 0, 0], {
        usage: { prompt_tokens: 12001, total_tokens: 12001 },
      }),
    ),
  );
  expect(await f.signed.action(execute, { attemptId })).toMatchObject({
    outcome: "unavailable",
  });
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    state: "settled",
    heldMicros: 0,
    estimatedMicros: 12001,
    billedMicros: null,
  });
  await f.t.mutation(settle, {
    attemptId,
    inputTokens: 12001,
    errorCode: null,
  });
  for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 12001 });
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(0);
});

test("withdrawal remains available after disconnected account, expired policy and lost budget without releasing sent holds", async () => {
  vi.useFakeTimers();
  for (const loss of ["connection", "expiry", "budget"] as const) {
    const f = await fixture(3, false, loss === "expiry" ? 1000 : 86400000),
      attemptId = await f.signed.mutation(prepare, f.request);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("unknown");
      }),
    );
    await f.signed.action(execute, { attemptId });
    await f.t.run(async (ctx) => {
      if (loss === "connection")
        await ctx.db.patch(f.accountId, { connection: "disconnected" });
      if (loss === "expiry") vi.setSystemTime(Date.now() + 1001);
      if (loss === "budget") {
        const b = (await ctx.db.query("aiBudgets").first())!;
        await ctx.db.patch(b._id, { purposes: [] });
      }
    });
    expect(
      await f.signed.query(availability, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
      }),
    ).toMatchObject({
      enabled: false,
      storedEnabled: true,
      controlPolicyId: f.policyId,
    });
    expect(await f.change(false, 1)).toBe(2);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
      state: "unknown",
      heldMicros: 12000,
    });
    await f.t.run((ctx) =>
      ctx.db.patch(f.accountId, { connection: "connected" }),
    );
    expect(
      await f.signed.query(availability, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
      }),
    ).toMatchObject({ enabled: false, storedEnabled: false });
  }
});

async function noteVersion(
  f: Awaited<ReturnType<typeof fixture>>,
  parent?: Id<"ideaVersions">,
) {
  return f.t.run(async (ctx) => {
    const ideaId = await ctx.db.insert("ideas", {
      workspaceId: f.workspaceId,
      actorId: f.userId,
      operationKey: crypto.randomUUID(),
      fingerprint: "synthetic",
      revision: 1,
      currentVersionId: null,
      status: "new",
      updatedAt: Date.now(),
    });
    const id = await ctx.db.insert("ideaVersions", {
      workspaceId: f.workspaceId,
      ideaId,
      number: 1,
      actorId: f.userId,
      createdAt: Date.now(),
      title: "Note",
      perspective: "Note",
      note: "Note",
      priority: "normal",
      source: { kind: "note" },
      originals: [],
      rationale: "",
      questions: [],
      ...(parent ? { inputVersionId: parent } : {}),
    });
    await ctx.db.patch(ideaId, { currentVersionId: id });
    return id;
  });
}
test("disjoint valid per-source ancestors produce an explicit aggregate frame resource ceiling without erasure", async () => {
  const f = await fixture(),
    ids: Id<"draftVersions">[] = [];
  for (let i = 0; i < 17; i++) {
    const parent = await noteVersion(f),
      ideaVersionId = await noteVersion(f, parent),
      draftId = await f.signed.mutation(api.editorial.create, {
        workspaceId: f.workspaceId,
        source: "manual",
        content: {
          title: `D${i}`,
          text: [`Meaning ${i}`],
          accountId: f.accountId,
          media: [],
          pillar: "Product",
          strategy: "",
        },
      });
    const versionId = (await f.t.run((ctx) => ctx.db.get(draftId)))!
      .currentVersionId!;
    await f.t.run((ctx) => ctx.db.patch(versionId, { ideaVersionId }));
    ids.push(versionId);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    const attemptId = await f.signed.mutation(prepare, {
      ...f.request,
      source: { kind: "draft", draftVersionId: versionId },
      commandKey: `chain-${i}`,
    });
    expect(await f.signed.action(execute, { attemptId })).toMatchObject({
      outcome: "prepared",
    });
  }
  expect(
    await f.signed.query(frame, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      source: { kind: "draft", draftVersionId: ids[0] },
      from: 0,
      to: Date.now(),
      candidateVersionIds: ids,
      topK: 5,
    }),
  ).toMatchObject({
    reason: "EMBEDDING_FRAME_RESOURCE_CEILING",
    complete: false,
    matches: [],
    items: [],
  });
  await f.t.mutation(sweep, { cursor: null, family: "vectors" });
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(17);
});
test("already-scrubbed idea roots drain more than one indexed semantic descendant batch while finance survives", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    ideaVersionId = await noteVersion(f);
  for (let i = 0; i < 26; i++) {
    const draftId = await f.signed.mutation(api.editorial.create, {
        workspaceId: f.workspaceId,
        source: "manual",
        content: {
          title: `D${i}`,
          text: [`Meaning ${i}`],
          accountId: f.accountId,
          media: [],
          pillar: "Product",
          strategy: "",
        },
      }),
      versionId = (await f.t.run((ctx) => ctx.db.get(draftId)))!
        .currentVersionId!;
    await f.t.run((ctx) => ctx.db.patch(versionId, { ideaVersionId }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    const attemptId = await f.signed.mutation(prepare, {
      ...f.request,
      source: { kind: "draft", draftVersionId: versionId },
      commandKey: `child-${i}`,
    });
    await f.signed.action(execute, { attemptId });
  }
  await f.t.run((ctx) =>
    ctx.db.patch(ideaVersionId, {
      sourceUnavailable: true,
      sourceCleanupState: "complete",
    }),
  );
  await f.t.mutation(internal.research.contentCleanup.version, {
    versionId: ideaVersionId,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(0);
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts).toHaveLength(26);
  for (const row of attempts)
    expect(row).toMatchObject({
      state: "settled",
      sourcePin: null,
      materialFingerprint: null,
      intentFingerprint: null,
      estimatedMicros: 40,
      heldMicros: 0,
    });
  expect(await f.t.run((ctx) => ctx.db.get(ideaVersionId))).toBeTruthy();
  vi.useRealTimers();
});
test("history removal drains numerical derivatives and protected attempt pins without erasing original finance", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    rows = await history(f, 26);
  for (const [i, row] of rows.entries()) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    const attemptId = await f.signed.mutation(prepare, {
      ...f.request,
      source: { kind: "history", historyPostId: row._id },
      commandKey: `history-${i}`,
    });
    await f.signed.action(execute, { attemptId });
  }
  await f.signed.mutation(api.performance.history.remove, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("historyPosts").collect()),
  ).toHaveLength(0);
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts).toHaveLength(26);
  for (const row of attempts)
    expect(row).toMatchObject({
      state: "settled",
      sourcePin: null,
      estimatedMicros: 40,
    });
  vi.useRealTimers();
});
test("other financial owners reject embedding receipts and errors never become destructive cleanup signals", async () => {
  const f = await fixture(),
    attemptId = await f.signed.mutation(prepare, f.request);
  await expect(
    f.t.mutation(internal.ai.runs.settle, {
      attemptId,
      inputTokens: 0,
      outputTokens: 0,
      errorCode: null,
    }),
  ).rejects.toThrow("MODEL_ATTEMPT_OWNER_INVALID");
  await expect(
    f.t.mutation(internal.ai.jev.access.settle, {
      attemptId,
      inputTokens: 0,
      outputTokens: 0,
      resolvedModel: null,
      outcome: "success",
      latencyMs: 0,
    }),
  ).rejects.toThrow("JEV_ATTEMPT_OWNER_INVALID");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  await f.signed.action(execute, { attemptId });
  await f.t.run(async (ctx) => {
    const t = (await ctx.db.get(attemptId))!;
    await ctx.db.patch(t.budgetIds[0], { scope: "account" });
  });
  await expect(
    f.t.mutation(sweep, { cursor: null, family: "vectors" }),
  ).rejects.toThrow("EMBEDDING_ATTEMPT_OWNER_INVALID");
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(1);
});

test("SDK rate/server errors, oversized responses and malformed cost metadata never retry or free unknown liability", async () => {
  for (const mode of ["rate", "server", "oversize", "cost"] as const) {
    const f = await fixture(),
      attemptId = await f.signed.mutation(prepare, f.request),
      transport = vi.fn(async () =>
        mode === "rate" || mode === "server"
          ? new Response("{}", {
              status: mode === "rate" ? 429 : 503,
              headers: { "content-type": "application/json" },
            })
          : mode === "oversize"
            ? new Response("x".repeat(256 * 1024 + 1))
            : response([1, 0, 0], {
                usage: {
                  prompt_tokens: 40,
                  total_tokens: 40,
                  cost: "unknown currency amount",
                },
              }),
      );
    vi.stubGlobal("fetch", transport);
    expect(await f.signed.action(execute, { attemptId })).toMatchObject({
      outcome: "unavailable",
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
      state: "unknown",
      heldMicros: 12000,
      estimatedMicros: null,
      billedMicros: null,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
    ).toHaveLength(0);
  }
});
test("shortened current source horizon is never renewed, expiry masks and physically scrubs descendants", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    rows = await history(f, 1),
    request = {
      ...f.request,
      source: { kind: "history" as const, historyPostId: rows[0]._id },
    },
    attemptId = await f.signed.mutation(prepare, request);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  await f.signed.action(execute, { attemptId });
  await f.t.run((ctx) =>
    ctx.db.patch(rows[0]._id, { sourceUntil: Date.now() + 1000 }),
  );
  await f.t.mutation(sweep, { cursor: null, family: "vectors" });
  const row = (await f.t.run((ctx) =>
    ctx.db.query("contentEmbeddings").first(),
  ))!;
  expect(row.sourceUntil).toBe(Date.now() + 1000);
  vi.advanceTimersByTime(1001);
  expect(
    await f.signed.query(frame, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      source: request.source,
      from: 0,
      to: Date.now(),
      candidateVersionIds: [],
      topK: 5,
    }),
  ).toMatchObject({ prepared: 0, matches: [] });
  await f.t.mutation(sweep, { cursor: null, family: "vectors" });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(0);
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    sourcePin: null,
    materialFingerprint: null,
    estimatedMicros: 40,
    state: "settled",
  });
});

test("missing send configuration blocks reservation and cancels only an owned unsent hold", async () => {
  const f = await fixture();
  vi.stubEnv("REQUESTY_API_KEY", "");
  const transport = vi.fn();
  vi.stubGlobal("fetch", transport);
  await expect(f.signed.mutation(prepare, f.request)).rejects.toThrow(
    "EMBEDDING_SEND_CONFIGURATION_REQUIRED",
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(0);
  expect(
    await f.signed.query(availability, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
    }),
  ).toMatchObject({ sendConfigured: false });
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-not-live");
  const attemptId = await f.signed.mutation(prepare, f.request);
  vi.stubEnv("REQUESTY_API_KEY", "");
  expect(await f.signed.action(execute, { attemptId })).toMatchObject({
    outcome: "unavailable",
  });
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    state: "cancelled",
    heldMicros: 0,
    sentAt: null,
  });
  for (const b of await f.t.run((ctx) => ctx.db.query("aiBudgets").collect()))
    expect(b).toMatchObject({ heldMicros: 0, spentMicros: 0 });
  expect(transport).not.toHaveBeenCalled();
});

test("native frame and cleanup resource errors propagate without erasing source or financial receipts", async () => {
  const f = await fixture();
  const attemptId = await f.signed.mutation(prepare, f.request);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  await f.signed.action(execute, { attemptId });
  const snapshot = () =>
    f.t.run(async (ctx) => ({
      attempts: await ctx.db.query("aiAttempts").collect(),
      vectors: await ctx.db.query("contentEmbeddings").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
  const before = await snapshot();
  const transactionLimits = {
    databaseQueries: 3,
    bytesRead: 16 * 1024 * 1024,
    documentsRead: 32000,
  };
  await expect(
    f.signed.run((ctx) =>
      ctx.runQuery(
        frame,
        {
          workspaceId: f.workspaceId,
          accountId: f.accountId,
          source: f.request.source,
          from: 0,
          to: Date.now(),
          candidateVersionIds: [f.versionId],
          topK: 5,
        },
        { transactionLimits },
      ),
    ),
  ).rejects.toThrow();
  await expect(
    f.t.run((ctx) =>
      ctx.runMutation(
        internal.content.similarity.purge,
        { draftVersionId: f.versionId },
        { transactionLimits },
      ),
    ),
  ).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});

test("fresh reconnect consent cannot reopen an imported record retained under an earlier connection sequence", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  const rows = await history(f, 1);
  const source = { kind: "history" as const, historyPostId: rows[0]._id };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  const attemptId = await f.signed.mutation(prepare, { ...f.request, source });
  await f.signed.action(execute, { attemptId });
  await f.t.run(async (ctx) => {
    const acc = (await ctx.db.get(f.accountId))!;
    await ctx.db.patch(f.accountId, {
      xEvidence: { ...acc.xEvidence!, connectionSequence: 1 },
    });
    const old = (await ctx.db.query("historyPolicies").first())!;
    const { _id, _creationTime, ...fields } = old;
    await ctx.db.insert("historyPolicies", {
      ...fields,
      version: "synthetic-reconnect",
      connectionSequence: 1,
    });
    for (const b of await ctx.db.query("aiBudgets").collect())
      if (b.purposes.includes("own-history"))
        await ctx.db.patch(b._id, { policyVersion: "synthetic-reconnect" });
  });
  await f.change(true, 1);
  await expect(
    f.signed.mutation(prepare, {
      ...f.request,
      source,
      commandKey: "reconnect-fresh",
    }),
  ).rejects.toThrow("OWN_HISTORY_SOURCE_UNAVAILABLE");
  expect(
    await f.signed.query(frame, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      source,
      from: 0,
      to: Date.now(),
      candidateVersionIds: [],
      topK: 5,
    }),
  ).toMatchObject({ prepared: 0, eligible: 0, matches: [] });
  await f.t.mutation(internal.content.similarity.purge, {
    historyPostId: rows[0]._id,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(0);
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    state: "settled",
    estimatedMicros: 40,
    sourcePin: null,
    materialFingerprint: null,
  });
  expect(await f.t.run((ctx) => ctx.db.get(rows[0].jobId))).not.toBeNull();
});

test("withdrawn original import actor or policy approver masks and purges vectors while preserving financial parents", async () => {
  vi.useFakeTimers();
  for (const kind of ["actor", "approver"] as const) {
    const f = await fixture();
    const rows = await history(f, 1);
    const membership = await f.t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "synthetic-importer",
        defaultWorkspaceId: f.workspaceId,
        activeWorkspaceId: f.workspaceId,
      });
      const member = await ctx.db.insert("memberships", {
        userId,
        workspaceId: f.workspaceId,
        role: "Admin",
      });
      const job = (await ctx.db.get(rows[0].jobId))!;
      const policy = (await ctx.db.get(job.policyId))!;
      if (kind === "actor") await ctx.db.patch(job._id, { actorId: userId });
      else {
        await ctx.db.patch(policy._id, { approvedBy: userId });
        await ctx.db.patch(job._id, {
          policyFingerprint: await sha256(
            JSON.stringify((await ctx.db.get(policy._id))!),
          ),
        });
      }
      const { _id, _creationTime, ...fields } = policy;
      await ctx.db.insert("historyPolicies", {
        ...fields,
        version: "synthetic-current",
        approvedBy: f.userId,
      });
      for (const b of await ctx.db.query("aiBudgets").collect())
        if (b.purposes.includes("own-history"))
          await ctx.db.patch(b._id, { policyVersion: "synthetic-current" });
      return member;
    });
    const source = { kind: "history" as const, historyPostId: rows[0]._id };
    const attemptId = await f.signed.mutation(prepare, {
      ...f.request,
      source,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    await f.signed.action(execute, { attemptId });
    const jobBefore = await f.t.run((ctx) => ctx.db.get(rows[0].jobId));
    await f.t.run((ctx) => ctx.db.delete(membership));
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    await expect(
      f.signed.mutation(prepare, {
        ...f.request,
        source,
        commandKey: "lost-importer",
      }),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    expect(transport).not.toHaveBeenCalled();
    expect(
      await f.signed.query(frame, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        source,
        from: 0,
        to: Date.now(),
        candidateVersionIds: [],
        topK: 5,
      }),
    ).toMatchObject({ prepared: 0, eligible: 0, matches: [] });
    await f.t.mutation(internal.content.similarity.purge, {
      historyPostId: rows[0]._id,
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
    ).toHaveLength(0);
    expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
      state: "settled",
      estimatedMicros: 40,
      sourcePin: null,
      materialFingerprint: null,
    });
    expect(await f.t.run((ctx) => ctx.db.get(rows[0].jobId))).toEqual(
      jobBefore,
    );
  }
});

test("shorter current history policy clamps original capture, expires and purges without financial loss or resurrection", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  const rows = await history(f, 1);
  const source = { kind: "history" as const, historyPostId: rows[0]._id };
  const request = { ...f.request, source };
  const attemptId = await f.signed.mutation(prepare, request);
  const transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  expect(await f.signed.action(execute, { attemptId })).toMatchObject({
    outcome: "prepared",
  });
  const jobBefore = (await f.t.run((ctx) => ctx.db.get(rows[0].jobId)))!;
  const original = (await f.t.run((ctx) => ctx.db.get(jobBefore.policyId)))!;
  const { _id, _creationTime, ...fields } = original;
  const switchPolicy = async (version: string, retentionMs: number) => {
    await f.t.mutation(internal.performance.history.configure, {
      ...fields,
      version,
      retentionMs,
    });
    await f.t.run(async (ctx) => {
      for (const b of await ctx.db.query("aiBudgets").collect())
        if (b.purposes.includes("own-history"))
          await ctx.db.patch(b._id, { policyVersion: version });
    });
  };
  const queryFrame = () =>
    f.signed.query(frame, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      source,
      from: 0,
      to: Date.now(),
      candidateVersionIds: [],
      topK: 5,
    });
  const finance = () =>
    f.t.run(async (ctx) => {
      const job = (await ctx.db.get(rows[0].jobId))!;
      // Expiry drains only mutable recovery checkpoints; the original financial/job identity stays intact.
      const { updatedAt, checkpointUntil, ...originalJob } = job;
      return {
        job: originalJob,
        budgets: (await ctx.db.query("aiBudgets").collect()).filter((b) =>
          b.purposes.includes("own-content-embedding"),
        ),
      };
    });
  const financesBefore = await finance();
  vi.advanceTimersByTime(400);
  await switchPolicy("synthetic-shorter", 1000);
  const originalCaptureUntil = jobBefore.createdAt + 1000;
  const shortened = await queryFrame();
  expect(shortened).toMatchObject({
    prepared: 1,
    eligible: 1,
    sourceUntil: originalCaptureUntil,
  });
  expect(shortened.items[0].sourceUntil).toBe(originalCaptureUntil);
  expect(originalCaptureUntil).not.toBe(Date.now() + 1000);
  await f.t.mutation(sweep, { cursor: null, family: "vectors" });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").first()),
  ).toMatchObject({ sourceUntil: originalCaptureUntil });
  vi.advanceTimersByTime(601);
  expect(await queryFrame()).toMatchObject({
    prepared: 0,
    eligible: 0,
    matches: [],
  });
  transport.mockClear();
  await expect(
    f.signed.mutation(prepare, {
      ...request,
      commandKey: "expired-short-current",
    }),
  ).rejects.toThrow("EMBEDDING_SOURCE_UNAVAILABLE");
  expect(transport).not.toHaveBeenCalled();
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
  await f.t.mutation(internal.performance.history.expire, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.db.get(rows[0]._id))).toBeNull();
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(0);
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    state: "settled",
    estimatedMicros: 40,
    billedMicros: null,
    heldMicros: 0,
    sourcePin: null,
    materialFingerprint: null,
    intentFingerprint: null,
    sourceUntil: null,
    sourceUnavailable: true,
  });
  expect(await finance()).toEqual(financesBefore);
  await switchPolicy("synthetic-reexpanded", 86400000);
  expect(await queryFrame()).toMatchObject({
    prepared: 0,
    eligible: 0,
    matches: [],
  });
  await expect(
    f.signed.mutation(prepare, {
      ...request,
      commandKey: "reexpanded-old-source",
    }),
  ).rejects.toThrow("EMBEDDING_SOURCE_UNAVAILABLE");
  expect(transport).not.toHaveBeenCalled();
  expect(
    await f.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
  expect(await finance()).toEqual(financesBefore);
});
