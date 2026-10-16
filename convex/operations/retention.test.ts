import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { internal, components } from "../_generated/api";
import { modelFixture } from "../../tests/model-fixture";
import { retainedRunProof } from "../ai/sourceAccess";
import { historyAuthority } from "../ai/conversationAccess";
import {
  operationalUntil,
  OPERATIONAL_RETENTION_MS,
} from "../lib/operationalRetention";
import {
  sweepReference,
  nativeCleanupReference,
  workflowCleanupReference,
} from "./retention";
const policy = makeFunctionReference<"query">("operations/retention:policy");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test("30-day maximum uses original creation and earlier source deadlines win", () => {
  expect(OPERATIONAL_RETENTION_MS).toBe(30 * 86400000);
  expect(operationalUntil(100, 200)).toBe(200);
  expect(operationalUntil(100, null)).toBe(100 + OPERATIONAL_RETENTION_MS);
  expect(operationalUntil(100, Number.MAX_SAFE_INTEGER)).toBe(
    100 + OPERATIONAL_RETENTION_MS,
  );
});

test("restored run cannot renew a future source deadline; native Agent cleanup preserves its replay header", async () => {
  vi.useFakeTimers();
  const f = await modelFixture();
  const runId = await f.create();
  const original = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  await f.t.run((ctx) =>
    ctx.db.patch(runId, {
      createdAt: Date.now() - OPERATIONAL_RETENTION_MS,
      sourceUntil: Date.now() + OPERATIONAL_RETENTION_MS,
    }),
  );
  await expect(
    f.t.run(async (ctx) => retainedRunProof(ctx, (await ctx.db.get(runId))!)),
  ).rejects.toThrow("MODEL_SOURCE_EXPIRED");
  await f.t.mutation(internal.ai.runs.purgeSource, { runId });
  expect(await f.t.run((ctx) => ctx.db.get(runId))).toMatchObject({
    sourceCleanupState: "complete",
    state: "stopped",
    threadId: original.threadId,
    promptMessageId: original.promptMessageId,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
});

test("restored chat expires from thread creation even after recent activity", async () => {
  const f = await modelFixture();
  const c = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("conversations", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      actorId: f.userId,
      operationKey: "restored",
      threadId: "synthetic",
      title: "private",
      revision: 1,
      sources: [],
      ideaVersionIds: [],
      turns: 0,
      activeRunId: null,
      updatedAt: Date.now(),
      state: "active",
      cleanupAfter: 0,
    });
    return (await ctx.db.get(id))!;
  });
  await expect(
    f.t.run((ctx) =>
      historyAuthority(ctx, {
        ...c,
        _creationTime: Date.now() - OPERATIONAL_RETENTION_MS,
      }),
    ),
  ).rejects.toThrow("CHAT_HISTORY_SOURCE_WITHDRAWN");
});

test("bounded source expiry scrubs restored raw source and preserves policy/status privacy", async () => {
  vi.useFakeTimers();
  const f = await modelFixture();
  const sourceId = await f.t.run(async (ctx) => {
    const policyId = await ctx.db.insert("researchSourcePolicies", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      operation: "web-search",
      enabled: true,
      version: "v1",
      generation: 1,
      approvedBy: f.userId,
      expiresAt: Date.now() + OPERATIONAL_RETENTION_MS,
      accessEvidence: "e",
      processingEvidence: "e",
      pricingEvidence: "e",
      rightsEvidence: "e",
      protocolEvidence: "e",
      lifecycleEvidence: "e",
      lifecycleValidUntil: Date.now() + OPERATIONAL_RETENTION_MS,
      retentionMs: OPERATIONAL_RETENTION_MS,
      authMode: "app-only",
      credentialFingerprint: "e",
      protocol: "requesty-chat-web-search-v1",
      currency: "USD",
      unit: "total-request",
      unitMicros: 1,
      totalChargeBoundEvidence: "e",
      allocationEvidence: "e",
      allocatedProviderLimitMicros: 1,
      costCurrencyEvidence: "e",
      model: "m",
      woeid: null,
    });
    return ctx.db.insert("researchSources", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      operation: "web-search",
      providerIdentity: "source",
      policyId,
      policyFingerprint: "e",
      generation: 1,
      observedAt: Date.now() - OPERATIONAL_RETENTION_MS,
      usableUntil: Date.now() + OPERATIONAL_RETENTION_MS,
      status: "usable",
      reason: null,
      removedAt: null,
      url: "https://private.test",
      title: "private",
      text: "private",
      publishedAt: null,
      count: null,
    });
  });
  await f.t.mutation(sweepReference, { phase: "sources", cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.db.get(sourceId))).toMatchObject({
    status: "blocked",
    generation: 2,
    url: null,
    title: null,
    text: null,
    usableUntil: 0,
  });
  expect(
    await f.signed.query(policy, { workspaceId: f.workspaceId }),
  ).toMatchObject({
    maximumDays: 30,
    sourceExpiryWins: true,
    debugRawResponsesEnabled: false,
  });
  await expect(
    f.t.query(policy, { workspaceId: f.workspaceId }),
  ).rejects.toThrow();
});

test("independent declared style payload is physically erased at 30days, preserving the receipt header", async () => {
  vi.useFakeTimers();
  const f = await modelFixture();
  const id = await f.t.run((ctx) =>
    ctx.db.insert("styleProfileVersions", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      createdBy: f.userId,
      declaredBy: f.userId,
      createdAt: Date.now() - OPERATIONAL_RETENTION_MS,
      declaredAt: Date.now() - OPERATIONAL_RETENTION_MS,
      selfDeclaration: true,
      fingerprint: "unused-expired-proof",
      payload: {
        author: "Private",
        experiences: [],
        tone: "private",
        positioning: "private",
        pillars: [],
        examples: [],
        forbidden: [],
      },
      baseVersionId: null,
      proposalId: null,
      sourceUntil: null,
      sourceUnavailable: false,
      reason: "",
      status: "active",
    }),
  );
  await f.t.mutation(internal.ai.styleProfiles.sweep, {
    cursor: null,
    table: "versions",
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
    payload: null,
    sourceUnavailable: true,
    status: "erased",
  });
});

test("saved calibration spec is physically deleted at its explicit expiry by the bounded sweep", async () => {
  const { corpus } = await import("../../tests/evals/calibration/fixture");
  const f = await corpus();
  await f.t.run((ctx) =>
    ctx.db.patch(f.specId, {
      createdAt: Date.now() - OPERATIONAL_RETENTION_MS,
      expiresAt: Date.now() - 1,
    }),
  );
  await f.t.mutation(internal.performance.calibration.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.db.get(f.specId))).toBeNull();
});

test("restored numeric metrics use original creation despite renewed expiry and preserve settlement pointers", async () => {
  const { corpus } = await import("../../tests/evals/calibration/fixture");
  const f = await corpus();
  const id = f.units[0].snapshotId;
  const original = (await f.t.run((ctx) => ctx.db.get(id)))!;
  vi.setSystemTime(original._creationTime + OPERATIONAL_RETENTION_MS);
  await f.t.run((ctx) =>
    ctx.db.patch(id, { expiresAt: Date.now() + OPERATIONAL_RETENTION_MS }),
  );
  await f.t.mutation(internal.performance.snapshots.expire, {});
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
    state: "removed",
    fields: [],
    observedAt: null,
    attemptId: original.attemptId,
  });
});

test("retention reuses exact native claims and hash proof to remove physical Agent bytes", async () => {
  vi.useFakeTimers();
  const f = await modelFixture();
  const runId = await f.create();
  const run = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  const storageId = await f.t.run((ctx) =>
    ctx.storage.store(new Blob(["private Agent file"], { type: "text/plain" })),
  );
  const metadata = (await f.t.run((ctx) => ctx.db.system.get(storageId)))!;
  const file = await f.t.mutation(components.agent.files.addFile, {
    storageId,
    hash: metadata.sha256,
    filename: "private.txt",
    mediaType: "text/plain",
  });
  await f.t.mutation(components.agent.messages.updateMessage, {
    messageId: run.promptMessageId,
    patch: { fileIds: [file.fileId] },
  });
  await f.t.run((ctx) =>
    ctx.db.patch(runId, {
      createdAt: Date.now() - OPERATIONAL_RETENTION_MS,
      sourceUntil: Date.now() + OPERATIONAL_RETENTION_MS,
    }),
  );
  await f.t.mutation(internal.ai.runs.purgeSource, { runId });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await f.t.mutation(nativeCleanupReference, {
    kind: "run",
    id: runId,
    phase: 0,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  expect(
    await f.t.query(components.agent.erasure.listForThread, {
      threadId: run.threadId,
      expectedUserId: String(f.userId),
      paginationOpts: { numItems: 25, cursor: null },
    }),
  ).toMatchObject({ page: [], isDone: true });
  expect(await f.t.run((ctx) => ctx.db.get(runId))).toMatchObject({
    sourceCleanupState: "complete",
    threadId: run.threadId,
  });
});

test("retention drains scoped Workflow cleanup after the native root was already removed", async () => {
  vi.useFakeTimers();
  const { pipelineFixture, streamResponse } =
    await import("../../tests/research-fixture");
  const { workflow } = await import("../ai/researchAgent");
  const f = await pipelineFixture();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(streamResponse([]));
  try {
    const orderId = await f.start();
    await f.t.finishAllScheduledFunctions(
      () => vi.advanceTimersByTime(100),
      1000,
    );
    const o = (await f.t.run((ctx) => ctx.db.get(orderId)))!;
    expect(
      await f.t.run((ctx) =>
        workflow.cleanup(
          ctx,
          o.pipeline!.workflowId as import("@convex-dev/workflow").WorkflowId,
        ),
      ),
    ).toBe(true);
    await f.t.run((ctx) =>
      ctx.db.patch(orderId, {
        pipeline: {
          ...o.pipeline!,
          cleanupState: "complete",
          workflowCleaned: true,
        },
      }),
    );
    await f.t.mutation(workflowCleanupReference, { orderId });
    expect(
      await f.t.query(components.workflow.erasure.scopeStatus, {
        workflowId: o.pipeline!.workflowId!,
      }),
    ).toBe("missing");
  } finally {
    fetchMock.mockRestore();
  }
});

test("drained run is marked so the retention sweep never restarts nativeCleanup", async () => {
  vi.useFakeTimers();
  const f = await modelFixture();
  const runId = await f.create();
  await f.t.run((ctx) =>
    ctx.db.patch(runId, {
      createdAt: Date.now() - OPERATIONAL_RETENTION_MS,
    }),
  );
  await f.t.mutation(internal.ai.runs.purgeSource, { runId });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.db.get(runId))).toMatchObject({
    sourceCleanupState: "complete",
    nativeCleanupAt: expect.any(Number),
  });
  // Marked row: re-entry returns cleanly instead of restarting the chain.
  await f.t.mutation(nativeCleanupReference, {
    kind: "run",
    id: runId,
    phase: 99,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
});

test("source cleanup refuses a restored native thread with foreign current ownership before deletion", async () => {
  vi.useFakeTimers();
  const f = await modelFixture();
  const runId = await f.create();
  const r = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  await f.t.mutation(components.agent.threads.updateThread, {
    threadId: r.threadId,
    patch: { userId: "foreign", title: "Foreign context" },
  });
  await f.t.run((ctx) =>
    ctx.db.patch(runId, { createdAt: Date.now() - OPERATIONAL_RETENTION_MS }),
  );
  await expect(
    f.t.mutation(internal.ai.runs.purgeSource, { runId }),
  ).rejects.toThrow("ERASURE_OWNER_CHANGED");
  expect(
    await f.t.query(components.agent.threads.getThread, {
      threadId: r.threadId,
    }),
  ).toMatchObject({ userId: "foreign", title: "Foreign context" });
  expect(
    await f.t.query(components.agent.messages.getMessagesByIds, {
      messageIds: [r.promptMessageId],
    }),
  ).toMatchObject([{ _id: r.promptMessageId }]);
});
