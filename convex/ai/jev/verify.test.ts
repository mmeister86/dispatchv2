import type { Id } from "../../_generated/dataModel";
import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { modelFixture } from "../../../tests/model-fixture";
import { api, internal } from "../../_generated/api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function candidateFixture(funded = false) {
  const f = await modelFixture();
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    title: "Original supplied claim",
    note: "The author reports one small improvement; independent evidence is absent.",
    perspective: "Could this improve the experience?",
    priority: "normal",
    source: { kind: "note" },
    operationKey: "verification-original",
  });
  const intent = {
    intent: "Discuss the supplied qualified claim without promotion",
    outputKind: "social-post-candidate" as const,
    strategy: "generic" as const,
    network: "x" as const,
    objective: null,
    tone: null,
    cta: null,
    media: [],
  };
  const routingOperationId = await f.signed.mutation(
    api.ai.jev.routing.prepare,
    {
      workspaceId: f.workspaceId,
      ideaId,
      expectedRevision: 1,
      accountId: f.accountId,
      operationKey: "verification-original-routing",
      intent,
    },
  );
  const runId = await f.signed.mutation(api.content.ideas.generate, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    operationKey: "verification-original-generation",
    intent: intent.intent,
    outputKind: "social-post-candidate",
    routingOperationId,
  });
  let resultIdeaId: Id<"ideas"> | null;
  if (funded) {
    await f.t.action(internal.ai.provider.execute, { runId });
    resultIdeaId = (await f.t.run((ctx) =>
      ctx.db
        .query("contentRequests")
        .withIndex("by_runId", (q) => q.eq("runId", runId))
        .unique(),
    ))!.resultIdeaId;
  } else {
    const executionKey = "verification-original-execution";
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    resultIdeaId = await f.t.mutation(internal.content.ideas.commitProposal, {
      runId,
      executionKey,
      output: JSON.stringify([
        "The author reports one small improvement.",
        "Its effect remains an open question.",
      ]),
    });
  }
  const ver = await f.t.run(async (ctx) =>
    ctx.db.get((await ctx.db.get(resultIdeaId!))!.currentVersionId!),
  );
  if (!ver?.candidate) throw new Error("native candidate fixture");
  return { ...f, ver, runId };
}

const prepare = makeFunctionReference<"mutation">("ai/jev/verify:prepare");
test("standalone verifier configuration required leaves its native producer slot absent and never funds or schedules a check", async () => {
  vi.useFakeTimers();
  const f = await candidateFixture();
  const before = await f.t.run(async (ctx) => ({
    requests: await ctx.db.query("contentRequests").collect(),
    attempts: await ctx.db.query("aiAttempts").collect(),
    scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  expect(before.scheduled.length).toBeGreaterThan(0);
  const args = {
    workspaceId: f.workspaceId,
    versionId: f.ver._id,
    contentHash: f.ver.candidate!.contentHash,
    operationKey: "verification-only-command",
  };
  expect(await f.signed.mutation(prepare, args)).toEqual({
    status: "configuration_required",
    reference: null,
  });
  expect(await f.signed.mutation(prepare, args)).toEqual({
    status: "configuration_required",
    reference: null,
  });
  expect(
    await f.t.run(async (ctx) => ({
      requests: await ctx.db.query("contentRequests").collect(),
      attempts: await ctx.db.query("aiAttempts").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    })),
  ).toEqual(before);
  expect(
    (await f.signed.query(api.content.ideas.candidate, {
      workspaceId: f.workspaceId,
      versionId: f.ver._id,
    }))!.applicability,
  ).toBe("current");
});

import { sha256 } from "../../lib/crypto";
import {
  criterionKeys,
  verificationVersions,
} from "./questions/outputVerification";
async function configuredFixture(funded = false) {
  const f = await candidateFixture(funded);
  vi.stubEnv("TYPESAFE_API_KEY", "synthetic-verifier-only-no-live-key");
  await f.t.run(async (ctx) => {
    const policyId = await ctx.db.insert("jevPolicies", {
      purpose: "output-verification",
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      version: "synthetic-verifier-price-v1",
      approvedBy: f.userId,
      expiresAt: Date.now() + 86400000,
      credentialFingerprint: await sha256(
        "synthetic-verifier-only-no-live-key",
      ),
      model: "synthetic-verifier-1",
      currency: "EUR",
      pricingEvidence: "synthetic test only",
      inputMicrosPerMillion: 1000000,
      outputMicrosPerMillion: 1000000,
      maxInputTokens: 16000,
      maxOutputTokens: 1000,
      euEvidence: {
        gateway: "synthetic",
        inference: "synthetic",
        logs: "synthetic",
        cache: "synthetic",
        storage: "synthetic",
        subprocessors: "synthetic",
      },
      processingRights: {
        processing: "synthetic",
        storage: "synthetic",
        training: "synthetic",
      },
      questionVersion: verificationVersions.question,
      normalizationVersion: verificationVersions.normalization,
      thresholdVersion: verificationVersions.threshold,
    });
    for (const global of [true, false])
      await ctx.db.insert("jevControls", {
        purpose: "output-verification",
        key: global
          ? "verification:global"
          : `verification:account:${f.accountId}`,
        ...(global
          ? {}
          : { workspaceId: f.workspaceId, accountId: f.accountId }),
        enabled: true,
        analyzer: false,
        routing: false,
        verification: true,
        networkFit: false,
        policyId: global ? null : policyId,
        composerTimeoutMs: 2500,
        backgroundTimeoutMs: 5000,
        failures: 0,
        openUntil: 0,
        probeAttemptId: null,
      });
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key:
          i === 0
            ? "jev:provider"
            : i === 1
              ? `jev:workspace:${f.workspaceId}`
              : `jev:account:${f.accountId}`,
        scope,
        ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
        ...(i === 2 ? { accountId: f.accountId } : {}),
        policyVersion: "synthetic-verifier-price-v1",
        currency: "EUR",
        purposes: ["output-verification"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 1000000,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  return {
    ...f,
    args: {
      workspaceId: f.workspaceId,
      versionId: f.ver._id,
      contentHash: f.ver.candidate!.contentHash,
      operationKey: "verification-command",
    },
  };
}
const verifierQuery = (name: string) =>
  makeFunctionReference<"query">(`ai/jev/verify:${name}`);
const verifierMutation = (name: string) =>
  makeFunctionReference<"mutation">(`ai/jev/verify:${name}`);
test("configured native admission pins one immutable whole command and key conflict never replaces clocks or pays", async () => {
  const f = await configuredFixture(),
    result = await f.signed.mutation(prepare, f.args);
  expect(result.status).toBe("ready");
  expect(result.reference).not.toBeNull();
  const before = await f.t.run((ctx) =>
    ctx.db.get(result.reference.contentRequestId),
  );
  expect(await f.signed.mutation(prepare, f.args)).toEqual(result);
  await expect(
    f.signed.mutation(prepare, { ...f.args, operationKey: "other-command" }),
  ).rejects.toThrow("VERIFICATION_ALREADY_BOUND");
  expect(
    await f.t.run((ctx) => ctx.db.get(result.reference.contentRequestId)),
  ).toEqual(before);
  const context = await f.t.query(verifierQuery("context"), {
    reference: result.reference,
  });
  expect(context.state.input.title).toBe("Original supplied claim");
  expect(context.state.input.userClaims).toContain("independent evidence");
  expect(context.state.candidate.posts).toEqual([
    { position: 0, text: "The author reports one small improvement." },
    { position: 1, text: "Its effect remains an open question." },
  ]);
  expect(context.state.intent.tone).toBeNull();
  expect(context.state.intent.cta).toBeNull();
  expect(context.state.style).toBeNull();
  expect(JSON.stringify(context.state)).not.toMatch(/checksum|objectKey/);
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("aiAttempts")
        .filter((q) => q.eq(q.field("owner"), "jev-output-verifier"))
        .collect(),
    ),
  ).toEqual([]);
});
test("native fund owns all three held scopes and duplicate funding is atomically denied; exact authoritative EUR settlement remains once-only", async () => {
  const f = await configuredFixture(),
    { reference } = await f.signed.mutation(prepare, f.args),
    x = await f.t.query(verifierQuery("context"), { reference });
  const attemptId = await f.t.mutation(verifierMutation("fund"), {
    reference,
    expectedFingerprint: x.requestFingerprint,
  });
  const receipt = await f.t.run((ctx) =>
    ctx.db.get(attemptId as Id<"aiAttempts">),
  );
  if (!receipt) throw new Error("missing original receipt");
  expect(receipt).toMatchObject({
    owner: "jev-output-verifier",
    contentRequestId: reference.contentRequestId,
    candidateVersionId: f.ver._id,
    producerRunId: f.runId,
    currency: "EUR",
    state: "sent",
    heldMicros: 17000,
  });
  expect(receipt).not.toHaveProperty("runId");
  const scopes = await f.t.run(async (ctx) =>
    Promise.all(receipt.budgetIds.map((id: any) => ctx.db.get(id))),
  );
  expect(
    scopes.map((b: any) => [b.scope, b.heldMicros, b.spentMicros]),
  ).toEqual([
    ["provider", 17000, 0],
    ["workspace", 17000, 0],
    ["account", 17000, 0],
  ]);
  await expect(
    f.t.mutation(verifierMutation("fund"), {
      reference,
      expectedFingerprint: x.requestFingerprint,
    }),
  ).rejects.toThrow("VERIFICATION_ALREADY_ADMITTED");
  await f.t.query(verifierQuery("authorizeFetch"), {
    reference,
    attemptId,
    expectedFingerprint: x.requestFingerprint,
  });
  const settlement = {
    reference,
    attemptId,
    inputTokens: 100,
    outputTokens: 10,
    resolvedModel: "synthetic-verifier-1",
    outcome: "success",
    latencyMs: 1,
  };
  await f.t.mutation(verifierMutation("settle"), settlement);
  await f.t.mutation(verifierMutation("settle"), settlement);
  expect(
    await f.t.run(async (ctx) =>
      Promise.all(receipt.budgetIds.map((id: any) => ctx.db.get(id))),
    ),
  ).toMatchObject([
    { heldMicros: 0, spentMicros: 110 },
    { heldMicros: 0, spentMicros: 110 },
    { heldMicros: 0, spentMicros: 110 },
  ]);
  const answers = Object.fromEntries(
    criterionKeys.map((key) => [
      key,
      {
        type: "noul",
        probability:
          key === "newStrongClaim"
            ? 0.8
            : key === "unwantedPromotion"
              ? 0.9
              : 0.9,
      },
    ]),
  );
  const finish = { reference, attemptId, outcome: "success", answers };
  await f.t.mutation(verifierMutation("finish"), finish);
  await f.t.mutation(verifierMutation("finish"), finish);
  const view = await f.signed.query(verifierQuery("get"), {
    workspaceId: f.workspaceId,
    reference,
  });
  expect(view.result).toMatchObject({
    decision: "manual_review",
    reasonKeys: ["newStrongClaim"],
    criteria: {
      toneFits: { applicability: "unspecified" },
      ctaFits: { applicability: "unspecified" },
    },
  });
  expect(view.stickyRisk).toMatchObject({
    candidateVersionId: f.ver._id,
    contentHash: f.ver.candidate!.contentHash,
    reasonKeys: ["newStrongClaim"],
  });
  await expect(
    f.t.mutation(verifierMutation("finish"), {
      reference,
      attemptId,
      outcome: "invalid_response",
      answers: null,
    }),
  ).rejects.toThrow("VERIFICATION_RESULT_CONFLICT");
  expect(
    (
      await f.signed.query(verifierQuery("get"), {
        workspaceId: f.workspaceId,
        reference,
      })
    ).stickyRisk,
  ).toEqual(view.stickyRisk);
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});

test("registered standalone action uses installed SDK with all original seven criteria and durably owned three holds before its sole physical fetch", async () => {
  const f = await configuredFixture(),
    { reference } = await f.signed.mutation(prepare, f.args);
  const observed: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      expect(url).toBe("https://api.typesafe.ai/v1/systemone");
      const request = JSON.parse(init.body);
      expect(Object.keys(request.questions)).toEqual([...criterionKeys]);
      expect(request.state.input.userClaims).toContain(
        "independent evidence is absent",
      );
      expect(request.state.candidate.posts).toHaveLength(2);
      const durable = await f.t.run(async (ctx) => {
        const r = await ctx.db.get(
            reference.contentRequestId as Id<"contentRequests">,
          ),
          t = await ctx.db.get(r!.verification!.attemptId!);
        return {
          t,
          scopes: await Promise.all(t!.budgetIds.map((id) => ctx.db.get(id))),
        };
      });
      expect(durable.t).toMatchObject({
        owner: "jev-output-verifier",
        state: "sent",
        heldMicros: 17000,
      });
      expect(
        durable.scopes.map((b) => [b!.scope, b!.heldMicros, b!.spentMicros]),
      ).toEqual([
        ["provider", 17000, 0],
        ["workspace", 17000, 0],
        ["account", 17000, 0],
      ]);
      observed.push(durable);
      return new Response(
        JSON.stringify({
          model: "synthetic-verifier-1",
          usage: { input_tokens: 100, output_tokens: 10 },
          answers: Object.fromEntries(
            criterionKeys.map((key) => [
              key,
              {
                type: "noul",
                noul:
                  key === "newStrongClaim" || key === "unwantedPromotion"
                    ? 0.05
                    : 0.95,
              },
            ]),
          ),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  const check = makeFunctionReference<"action">("ai/jev/verify:check");
  await f.signed.action(check, { workspaceId: f.workspaceId, reference });
  const view = await f.signed.query(verifierQuery("get"), {
    workspaceId: f.workspaceId,
    reference,
  });
  expect(view.result).toMatchObject({
    decision: "accept_with_warning",
    model: "synthetic-verifier-1",
  });
  expect(view.usage).toMatchObject({
    state: "settled",
    estimatedMicros: 110,
    currency: "EUR",
  });
  expect(observed).toHaveLength(1);
  await f.signed.action(check, { workspaceId: f.workspaceId, reference });
  expect(observed).toHaveLength(1);
});

import { TypeSafeClient, APIPromise } from "@typesafe-ai/sdk";
const check = makeFunctionReference<"action">("ai/jev/verify:check");
const wire = () =>
  new Response(
    JSON.stringify({
      model: "synthetic-verifier-1",
      usage: { input_tokens: 100, output_tokens: 10 },
      answers: Object.fromEntries(
        criterionKeys.map((key) => [
          key,
          {
            type: "noul",
            noul:
              key === "newStrongClaim" || key === "unwantedPromotion"
                ? 0.05
                : 0.95,
          },
        ]),
      ),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
async function nativeHeld(
  f: Awaited<ReturnType<typeof configuredFixture>>,
  reference: any,
) {
  const state = await f.t.run(async (ctx) => {
    const r = await ctx.db.get(
        reference.contentRequestId as Id<"contentRequests">,
      ),
      t = await ctx.db.get(r!.verification!.attemptId!);
    return {
      t,
      scopes: await Promise.all(t!.budgetIds.map((id) => ctx.db.get(id))),
    };
  });
  expect(state.t).toMatchObject({
    owner: "jev-output-verifier",
    state: "sent",
    heldMicros: 17000,
    producerRunId: f.runId,
  });
  expect(state.t).not.toHaveProperty("runId");
  expect(
    state.scopes.map((b) => [b!.scope, b!.heldMicros, b!.spentMicros]),
  ).toEqual([
    ["provider", 17000, 0],
    ["workspace", 17000, 0],
    ["account", 17000, 0],
  ]);
  return state.t!;
}
async function admitted(f: Awaited<ReturnType<typeof configuredFixture>>) {
  const { reference } = await f.signed.mutation(prepare, f.args),
    x = await f.t.query(verifierQuery("context"), { reference }),
    attemptId = await f.t.mutation(verifierMutation("fund"), {
      reference,
      expectedFingerprint: x.requestFingerprint,
    });
  await nativeHeld(f, reference);
  return { reference, attemptId };
}

test.each(["purpose", "candidate", "actor"] as const)(
  "registered SDK reproof after durable fund denies %s loss with zero physical HTTP, truthful zero tokens and released holds",
  async (kind) => {
    const f = await configuredFixture(),
      { reference } = await f.signed.mutation(prepare, f.args);
    const physical = vi.fn(async () => wire());
    vi.stubGlobal("fetch", physical);
    const sdk = TypeSafeClient.prototype.systemOne;
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockImplementationOnce(
      function (this: TypeSafeClient, ...args: Parameters<typeof sdk>) {
        let actual: ReturnType<typeof sdk> | undefined;
        const response = (async () => {
          await nativeHeld(f, reference);
          await f.t.run(async (ctx) => {
            if (kind === "purpose") {
              const c = await ctx.db
                .query("jevControls")
                .withIndex("by_key", (q) =>
                  q.eq("key", `verification:account:${f.accountId}`),
                )
                .unique();
              await ctx.db.patch(c!._id, { withdrawn: true });
            } else if (kind === "candidate") await ctx.db.delete(f.ver._id);
            else {
              const m = await ctx.db
                .query("memberships")
                .withIndex("by_userId_and_workspaceId", (q) =>
                  q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
                )
                .unique();
              await ctx.db.patch(m!._id, { role: "Viewer" });
            }
          });
          actual = sdk.apply(this, args);
          return actual.asResponse();
        })();
        return new APIPromise(response, async () => {
          if (!actual) throw new Error("Native SDK gate did not admit");
          return actual;
        });
      },
    );
    await f.signed.action(check, { workspaceId: f.workspaceId, reference });
    expect(physical).not.toHaveBeenCalled();
    const t = await f.t.run((ctx) =>
      ctx.db
        .query("aiAttempts")
        .withIndex("by_verification_pending", (q) =>
          q
            .eq("owner", "jev-output-verifier")
            .eq("workspaceId", f.workspaceId)
            .eq("accountId", f.accountId)
            .eq("candidateVersionId", f.ver._id),
        )
        .unique(),
    );
    expect(t).toMatchObject({
      state: "settled",
      heldMicros: 0,
      estimatedMicros: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(
      await f.t.run(async (ctx) =>
        Promise.all(t!.budgetIds.map((id) => ctx.db.get(id))),
      ),
    ).toMatchObject([
      { heldMicros: 0, spentMicros: 0 },
      { heldMicros: 0, spentMicros: 0 },
      { heldMicros: 0, spentMicros: 0 },
    ]);
    expect(
      (await f.t.run((ctx) =>
        ctx.db.get(reference.contentRequestId as Id<"contentRequests">),
      ))!.verification,
    ).toMatchObject({
      sourceUnavailable: true,
      state: "stopped",
      result: null,
    });
    expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
      [],
    );
  },
);

test("entered ambiguous SDK I/O keeps the original hold, duplicate check never resends, and authoritative original settlement survives own withdrawal once", async () => {
  const f = await configuredFixture(),
    { reference } = await f.signed.mutation(prepare, f.args);
  const physical = vi.fn(async () => {
    await nativeHeld(f, reference);
    throw new Error(
      "synthetic physical connection lost after entering transport",
    );
  });
  vi.stubGlobal("fetch", physical);
  await f.signed.action(check, { workspaceId: f.workspaceId, reference });
  const unknown = await f.signed.query(verifierQuery("get"), {
    workspaceId: f.workspaceId,
    reference,
  });
  expect(unknown).toMatchObject({
    state: "finished",
    result: null,
    usage: {
      state: "unknown",
      heldMicros: 17000,
      estimatedMicros: null,
      currency: "EUR",
    },
  });
  await f.signed.action(check, { workspaceId: f.workspaceId, reference });
  expect(physical).toHaveBeenCalledTimes(1);
  await f.signed.mutation(api.ai.jev.verify.disable, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
  });
  await f.t.mutation(internal.ai.jev.verify.purge, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    force: true,
    cursor: null,
  });
  expect(
    await f.signed.query(api.content.ideas.candidate, {
      workspaceId: f.workspaceId,
      versionId: f.ver._id,
    }),
  ).toMatchObject({
    applicability: "current",
    candidate: { contentHash: f.ver.candidate!.contentHash },
    verification: {
      applicability: "unavailable",
      result: null,
      usage: { state: "unknown", heldMicros: 17000 },
    },
  });
  const a = {
    reference,
    attemptId: unknown.usage.attemptId,
    inputTokens: 80,
    outputTokens: 20,
    resolvedModel: "synthetic-verifier-1",
    outcome: "success",
    latencyMs: 2,
  };
  await f.t.mutation(verifierMutation("settle"), a);
  await f.t.mutation(verifierMutation("settle"), a);
  const t = await f.t.run((ctx) => ctx.db.get(a.attemptId as Id<"aiAttempts">));
  expect(t).toMatchObject({
    state: "settled",
    estimatedMicros: 100,
    heldMicros: 0,
  });
  expect(
    await f.t.run(async (ctx) =>
      Promise.all(t!.budgetIds.map((id) => ctx.db.get(id))),
    ),
  ).toMatchObject([
    { heldMicros: 0, spentMicros: 100 },
    { heldMicros: 0, spentMicros: 100 },
    { heldMicros: 0, spentMicros: 100 },
  ]);
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(reference.contentRequestId as Id<"contentRequests">),
    ))!.verification,
  ).toMatchObject({ result: null, sourceUnavailable: true });
});

test("same-workspace corrupted pointer or foreign reference cannot project, finish or settle someone else's original monetary receipt", async () => {
  const f = await configuredFixture(),
    { reference, attemptId } = await admitted(f);
  const original = await f.t.run((ctx) =>
    ctx.db.get(attemptId as Id<"aiAttempts">),
  );
  const foreign = await f.t.run(async (ctx) => {
    const r = (await ctx.db.get(
        reference.contentRequestId as Id<"contentRequests">,
      ))!,
      { _id, _creationTime, ...base } = r;
    return ctx.db.insert("contentRequests", {
      ...base,
      verification: {
        ...r.verification!,
        commandFingerprint: "other-whole-command",
        operationKey: "other-command",
      },
    });
  });
  const other = {
    ...reference,
    contentRequestId: foreign,
    commandFingerprint: "other-whole-command",
  };
  await expect(
    f.signed.query(verifierQuery("get"), {
      workspaceId: f.workspaceId,
      reference: other,
    }),
  ).rejects.toThrow("VERIFICATION_RECEIPT_INVALID");
  await expect(
    f.t.mutation(verifierMutation("finish"), {
      reference: other,
      attemptId,
      outcome: "invalid_response",
      answers: null,
    }),
  ).rejects.toThrow("VERIFICATION_RECEIPT_INVALID");
  await expect(
    f.t.mutation(verifierMutation("settle"), {
      reference: other,
      attemptId,
      inputTokens: 1,
      outputTokens: 1,
      resolvedModel: "synthetic-verifier-1",
      outcome: "success",
      latencyMs: 1,
    }),
  ).rejects.toThrow("VERIFICATION_RECEIPT_INVALID");
  expect(
    await f.t.run((ctx) => ctx.db.get(attemptId as Id<"aiAttempts">)),
  ).toEqual(original);
  expect(
    await f.t.run(async (ctx) =>
      Promise.all(original!.budgetIds.map((id) => ctx.db.get(id))),
    ),
  ).toMatchObject([
    { heldMicros: 17000, spentMicros: 0 },
    { heldMicros: 17000, spentMicros: 0 },
    { heldMicros: 17000, spentMicros: 0 },
  ]);
});

test.each([false, true])(
  "human application %s retains the exact optional verification reference without any approval or automatic retrospective upgrade",
  async (checked) => {
    const f = await configuredFixture();
    const initial = checked
      ? null
      : await f.signed.mutation(api.content.ideas.applyCandidate, {
          workspaceId: f.workspaceId,
          versionId: f.ver._id,
          contentHash: f.ver.candidate!.contentHash,
          operationKey: "unchecked-before-check",
          intent: "Explicit human unchecked transfer",
          claimsReviewed: true,
          target: null,
        });
    const { reference } = await f.signed.mutation(prepare, f.args);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => wire()),
    );
    await f.signed.action(check, { workspaceId: f.workspaceId, reference });
    const view = await f.signed.query(verifierQuery("get"), {
      workspaceId: f.workspaceId,
      reference,
    });
    expect(view.result.decision).toBe("accept_with_warning");
    let result = initial;
    if (checked)
      result = await f.signed.mutation(api.content.ideas.applyCandidate, {
        workspaceId: f.workspaceId,
        versionId: f.ver._id,
        contentHash: f.ver.candidate!.contentHash,
        operationKey: "human-checked-transfer",
        intent: "Explicit human selected exact verification result",
        claimsReviewed: true,
        target: null,
        verification: {
          reference,
          resultFingerprint: view.result.resultFingerprint,
        },
      });
    const before = await f.t.run(async (ctx) => ({
      idea: await ctx.db.get(f.ver.ideaId),
      draft: await ctx.db.get(result!.draftId),
      version: await ctx.db.get(result!.versionId),
      approvals: await ctx.db.query("approvals").collect(),
      schedules: await ctx.db.query("schedules").collect(),
    }));
    if (checked)
      expect(before.idea!.handoff!.candidateCommand!.verification).toEqual({
        reference,
        resultFingerprint: view.result.resultFingerprint,
      });
    else
      expect(before.idea!.handoff!.candidateCommand).not.toHaveProperty(
        "verification",
      );
    expect(before.approvals).toEqual([]);
    expect(before.schedules).toEqual([]);
    await f.signed.mutation(api.ai.jev.verify.disable, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
    });
    await f.t.mutation(internal.ai.jev.verify.purge, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      force: true,
      cursor: null,
    });
    const after = await f.t.run(async (ctx) => ({
      idea: await ctx.db.get(f.ver.ideaId),
      draft: await ctx.db.get(result!.draftId),
      version: await ctx.db.get(result!.versionId),
    }));
    expect(after.idea!.handoff!.candidateCommand).not.toHaveProperty(
      "verification",
    );
    expect(after.draft).toEqual(before.draft);
    expect(after.version).toEqual(before.version);
    expect(
      await f.signed.query(api.content.ideas.candidate, {
        workspaceId: f.workspaceId,
        versionId: f.ver._id,
      }),
    ).toMatchObject({
      candidate: { contentHash: f.ver.candidate!.contentHash },
      verification: { applicability: "unavailable", result: null },
    });
  },
);

test("native resource errors propagate and roll back instead of scrubbing a healthy candidate or its admitted slot", async () => {
  vi.useFakeTimers();
  const f = await configuredFixture(),
    { reference } = await f.signed.mutation(prepare, f.args);
  const before = await f.t.run(async (ctx) => ({
    request: await ctx.db.get(
      reference.contentRequestId as Id<"contentRequests">,
    ),
    candidate: await ctx.db.get(f.ver._id),
    queue: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  const limits = {
    databaseQueries: 3,
    bytesRead: 16 * 1024 * 1024,
    documentsRead: 32000,
  };
  for (const mode of ["get", "cleanup"] as const) {
    const out = await f.signed.run(async (ctx) => {
      try {
        if (mode === "get")
          await ctx.runQuery(
            api.ai.jev.verify.get,
            { workspaceId: f.workspaceId, reference },
            { transactionLimits: limits },
          );
        else
          await ctx.runMutation(
            internal.ai.jev.verify.purgeCandidate,
            { versionId: f.ver._id, cursor: null },
            { transactionLimits: limits },
          );
        return "unexpected success";
      } catch (error) {
        return String(error);
      }
    });
    expect(out).toMatch(/limit|queries/i);
    expect(
      await f.t.run(async (ctx) => ({
        request: await ctx.db.get(
          reference.contentRequestId as Id<"contentRequests">,
        ),
        candidate: await ctx.db.get(f.ver._id),
        queue: await ctx.db.system.query("_scheduled_functions").collect(),
      })),
    ).toEqual(before);
  }
});

import { components } from "../../_generated/api";
test("verifying actor differs from producer; its own membership withdrawal scrubs only verification via the native team hook, including null source horizon", async () => {
  vi.useFakeTimers();
  const f = await configuredFixture();
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Verifier Editor",
          email: "verifier@example.test",
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: u._id,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        },
      },
    );
    return { subject: u._id, sessionId: session._id };
  });
  const editor = f.t.withIdentity(identity),
    actorId = await editor.mutation(api.users.bootstrap, {});
  const membership = await f.t.run((ctx) =>
    ctx.db.insert("memberships", {
      userId: actorId,
      workspaceId: f.workspaceId,
      role: "Editor",
    }),
  );
  const { reference } = await editor.mutation(prepare, f.args);
  const r = await f.t.run((ctx) =>
    ctx.db.get(reference.contentRequestId as Id<"contentRequests">),
  );
  expect(r!.actorId).toBe(f.userId);
  expect(r!.verification!.actorId).toBe(actorId);
  await f.t.run((ctx) =>
    ctx.db.patch(r!._id, {
      verification: { ...r!.verification!, sourceUntil: null },
    }),
  );
  await f.t.run((ctx) => ctx.db.delete(membership));
  await f.t.mutation(internal.team.purgeActor, { actorId });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    (await f.t.run((ctx) => ctx.db.get(r!._id)))!.verification,
  ).toMatchObject({
    actorId,
    sourceUnavailable: true,
    result: null,
    state: "stopped",
  });
  expect(
    await f.signed.query(api.content.ideas.candidate, {
      workspaceId: f.workspaceId,
      versionId: f.ver._id,
    }),
  ).toMatchObject({
    applicability: "current",
    candidate: { contentHash: f.ver.candidate!.contentHash },
    verification: { applicability: "unavailable" },
  });
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
});

test.each(["missing", "terminal"] as const)(
  "generation run %s and missing candidate root scrub verification before old root guards",
  async (kind) => {
    vi.useFakeTimers();
    const f = await configuredFixture(),
      { reference } = await f.signed.mutation(prepare, f.args);
    await f.t.run(async (ctx) => {
      await ctx.db.delete(f.ver._id);
      if (kind === "missing") await ctx.db.delete(f.runId);
      else await ctx.db.patch(f.runId, { sourceCleanupState: "complete" });
    });
    await f.t.mutation(internal.research.contentCleanup.candidateRun, {
      runId: f.runId,
      cursor: null,
    });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(
      (await f.t.run((ctx) =>
        ctx.db.get(reference.contentRequestId as Id<"contentRequests">),
      ))!.verification,
    ).toMatchObject({
      sourceUnavailable: true,
      result: null,
      stickyRisk: null,
    });
  },
);

test("indexed actor withdrawal drains 27 distinct retained slot headers across pages even with missing candidate roots and null horizons", async () => {
  vi.useFakeTimers();
  const f = await configuredFixture(),
    { reference } = await f.signed.mutation(prepare, f.args);
  const ids = await f.t.run(async (ctx) => {
    const r = (await ctx.db.get(
        reference.contentRequestId as Id<"contentRequests">,
      ))!,
      { _id, _creationTime, ...base } = r;
    const ids = [r._id];
    // Historical retained headers exercise indexed cleanup, not extra admissions for one candidate.
    for (let i = 0; i < 26; i++) {
      const { _id: vId, _creationTime: vTime, ...v } = f.ver;
      const candidateVersionId = await ctx.db.insert("ideaVersions", {
        ...v,
        number: i + 2,
      });
      const id = await ctx.db.insert("contentRequests", {
        ...base,
        operationKey: `retained-request-${i}`,
        verification: {
          ...r.verification!,
          candidateVersionId,
          operationKey: `retained-verifier-${i}`,
          commandFingerprint: `retained-command-${i}`,
          sourceUntil: null,
        },
      });
      ids.push(id);
      await ctx.db.delete(candidateVersionId);
    }
    await ctx.db.patch(r._id, {
      verification: { ...r.verification!, sourceUntil: null },
    });
    await ctx.db.delete(f.ver._id);
    return ids;
  });
  await f.t.mutation(internal.ai.jev.verify.purge, {
    actorId: f.userId,
    force: false,
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  const rows = await f.t.run((ctx) =>
    Promise.all(ids.map((id) => ctx.db.get(id))),
  );
  expect(rows).toHaveLength(27);
  expect(
    rows.every(
      (r) =>
        r!.verification!.sourceUnavailable && r!.verification!.result === null,
    ),
  ).toBe(true);
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});

test("completed result remains readable after dispatch deadline while actual source expiry masks only its original verification and clears checked reference eligibility", async () => {
  const f = await configuredFixture(),
    { reference } = await f.signed.mutation(prepare, f.args);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => wire()),
  );
  await f.signed.action(check, { workspaceId: f.workspaceId, reference });
  const original = await f.signed.query(verifierQuery("get"), {
    workspaceId: f.workspaceId,
    reference,
  });
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now + 6000);
  expect(
    await f.signed.query(verifierQuery("get"), {
      workspaceId: f.workspaceId,
      reference,
    }),
  ).toMatchObject({
    applicability: "current",
    result: original.result,
    deadline: original.deadline,
  });
  await f.t.run(async (ctx) => {
    const r = (await ctx.db.get(
      reference.contentRequestId as Id<"contentRequests">,
    ))!;
    await ctx.db.patch(r._id, {
      verification: { ...r.verification!, sourceUntil: now + 5000 },
    });
  });
  expect(
    await f.signed.query(api.content.ideas.candidate, {
      workspaceId: f.workspaceId,
      versionId: f.ver._id,
    }),
  ).toMatchObject({
    applicability: "current",
    candidate: { contentHash: f.ver.candidate!.contentHash },
    verification: {
      applicability: "unavailable",
      result: null,
      usage: original.usage,
    },
  });
  await expect(
    f.signed.mutation(api.content.ideas.applyCandidate, {
      workspaceId: f.workspaceId,
      versionId: f.ver._id,
      contentHash: f.ver.candidate!.contentHash,
      operationKey: "expired-checked-transfer",
      intent: "Explicit human",
      claimsReviewed: true,
      target: null,
      verification: {
        reference,
        resultFingerprint: original.result.resultFingerprint,
      },
    }),
  ).rejects.toThrow("VERIFICATION_RESULT_UNAVAILABLE");
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toEqual([]);
});

test("generation root and protected request can be absent while exact original unknown attempt settles once without semantic resurrection", async () => {
  const f = await configuredFixture(),
    { reference, attemptId } = await admitted(f);
  const a = {
    reference,
    attemptId,
    inputTokens: null,
    outputTokens: null,
    resolvedModel: null,
    outcome: "timeout",
    latencyMs: 5000,
  };
  await f.t.mutation(verifierMutation("settle"), a);
  await f.t.run(async (ctx) => {
    await ctx.db.delete(f.runId);
    await ctx.db.delete(reference.contentRequestId as Id<"contentRequests">);
    await ctx.db.delete(f.ver._id);
  });
  const late = {
    ...a,
    inputTokens: 75,
    outputTokens: 25,
    resolvedModel: "synthetic-verifier-1",
    outcome: "success",
  };
  await f.t.mutation(verifierMutation("settle"), late);
  await f.t.mutation(verifierMutation("settle"), late);
  const t = await f.t.run((ctx) => ctx.db.get(attemptId as Id<"aiAttempts">));
  expect(t).toMatchObject({
    state: "settled",
    heldMicros: 0,
    estimatedMicros: 100,
  });
  expect(
    await f.t.run(async (ctx) =>
      Promise.all(t!.budgetIds.map((id) => ctx.db.get(id))),
    ),
  ).toMatchObject([
    { heldMicros: 0, spentMicros: 100 },
    { heldMicros: 0, spentMicros: 100 },
    { heldMicros: 0, spentMicros: 100 },
  ]);
  expect(
    await f.t.run((ctx) => ctx.db.query("contentRequests").collect()),
  ).toEqual([]);
});

test("superseded original input remains historical with its sticky result; retained-source deletion physically erases introduced verification before consumption", async () => {
  vi.useFakeTimers();
  const f = await configuredFixture(),
    { reference, attemptId } = await admitted(f);
  await f.t.mutation(verifierMutation("settle"), {
    reference,
    attemptId,
    inputTokens: 100,
    outputTokens: 10,
    resolvedModel: "synthetic-verifier-1",
    outcome: "success",
    latencyMs: 1,
  });
  await f.t.mutation(verifierMutation("finish"), {
    reference,
    attemptId,
    outcome: "success",
    answers: Object.fromEntries(
      criterionKeys.map((k) => [
        k,
        { type: "noul", probability: k === "newStrongClaim" ? 0.8 : 0.95 },
      ]),
    ),
  });
  const original = await f.signed.query(verifierQuery("get"), {
    workspaceId: f.workspaceId,
    reference,
  });
  const r = (await f.t.run((ctx) =>
    ctx.db.get(reference.contentRequestId as Id<"contentRequests">),
  ))!;
  await f.signed.mutation(api.content.ideas.edit, {
    workspaceId: f.workspaceId,
    ideaId: r.ideaId,
    expectedRevision: 1,
    title: "Later human input",
    note: "Later note",
    perspective: "Later perspective",
    priority: "normal",
    feedback: "Current supersession",
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  const history = await f.signed.query(verifierQuery("get"), {
    workspaceId: f.workspaceId,
    reference,
  });
  expect(history).toMatchObject({
    applicability: "historical",
    result: original.result,
    stickyRisk: original.stickyRisk,
    usage: original.usage,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(r._id)))!.verification!
      .sourceUnavailable,
  ).toBe(false);
  await expect(f.signed.mutation(prepare, f.args)).rejects.toThrow();
  await f.t.run((ctx) =>
    ctx.db.patch(r.inputVersionId, {
      sourceUnavailable: true,
      sourceCleanupState: "complete",
    }),
  );
  expect(
    await f.signed.query(verifierQuery("get"), {
      workspaceId: f.workspaceId,
      reference,
    }),
  ).toMatchObject({
    applicability: "unavailable",
    result: null,
    stickyRisk: null,
    usage: original.usage,
  });
  await f.t.mutation(internal.ai.jev.verify.purgeCandidate, {
    versionId: f.ver._id,
    cursor: null,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(r._id)))!.verification,
  ).toMatchObject({
    sourceUnavailable: true,
    state: "stopped",
    result: null,
    stickyRisk: null,
  });
  await f.t.run((ctx) =>
    ctx.db.patch(r.inputVersionId, {
      sourceUnavailable: undefined,
      sourceCleanupState: undefined,
    }),
  );
  expect(
    await f.signed.query(verifierQuery("get"), {
      workspaceId: f.workspaceId,
      reference,
    }),
  ).toMatchObject({ applicability: "unavailable", result: null });
});

test("the verifier uses the original shared32 material walk; excessive real input ancestry propagates atomically without slot/funding/schedule replacement", async () => {
  vi.useFakeTimers();
  const f = await configuredFixture();
  const r = (await f.t.run((ctx) =>
    ctx.db
      .query("contentRequests")
      .withIndex("by_runId", (q) => q.eq("runId", f.runId))
      .unique(),
  ))!;
  await f.t.run(async (ctx) => {
    const root = (await ctx.db.get(r.inputVersionId))!,
      { _id, _creationTime, ...base } = root;
    let parent = await ctx.db.insert("ideaVersions", { ...base, number: 2 });
    for (let n = 0; n < 33; n++)
      parent = await ctx.db.insert("ideaVersions", {
        ...base,
        inputVersionId: parent,
        number: n + 2,
      });
    await ctx.db.patch(root._id, { inputVersionId: parent });
  });
  const before = await f.t.run(async (ctx) => ({
    request: await ctx.db.get(r._id),
    attempts: await ctx.db.query("aiAttempts").collect(),
    queue: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  await expect(f.signed.mutation(prepare, f.args)).rejects.toThrow(
    "STYLE_ANCESTRY_LIMIT",
  );
  expect(
    await f.t.run(async (ctx) => ({
      request: await ctx.db.get(r._id),
      attempts: await ctx.db.query("aiAttempts").collect(),
      queue: await ctx.db.system.query("_scheduled_functions").collect(),
    })),
  ).toEqual(before);
});

test.each(["budget", "rights", "price"] as const)(
  "partial own %s configuration refuses before slot admission and leaves original generation grants untouched",
  async (kind) => {
    vi.useFakeTimers();
    const f = await configuredFixture();
    await f.t.run(async (ctx) => {
      if (kind === "budget") {
        const b = await ctx.db
          .query("aiBudgets")
          .withIndex("by_key", (q) => q.eq("key", `jev:account:${f.accountId}`))
          .unique();
        await ctx.db.patch(b!._id, { purposes: ["draft"] });
      } else {
        const p = await ctx.db
          .query("jevPolicies")
          .filter((q) => q.eq(q.field("purpose"), "output-verification"))
          .unique();
        await ctx.db.patch(
          p!._id,
          kind === "rights"
            ? {
                processingRights: {
                  processing: "",
                  storage: "synthetic",
                  training: "synthetic",
                },
              }
            : { inputMicrosPerMillion: -1 },
        );
      }
    });
    const before = await f.t.run(async (ctx) => ({
      requests: await ctx.db.query("contentRequests").collect(),
      budgets: await ctx.db.query("aiBudgets").collect(),
      attempts: await ctx.db.query("aiAttempts").collect(),
      queue: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(await f.signed.mutation(prepare, f.args)).toEqual({
      status: "configuration_required",
      reference: null,
    });
    expect(
      await f.t.run(async (ctx) => ({
        requests: await ctx.db.query("contentRequests").collect(),
        budgets: await ctx.db.query("aiBudgets").collect(),
        attempts: await ctx.db.query("aiAttempts").collect(),
        queue: await ctx.db.system.query("_scheduled_functions").collect(),
      })),
    ).toEqual(before);
  },
);

test("unexpected native duplicate-row proof after owned fund propagates without erasing healthy semantic source, while proven never-entered transport releases its original money", async () => {
  const f = await configuredFixture(),
    { reference } = await f.signed.mutation(prepare, f.args),
    sdk = TypeSafeClient.prototype.systemOne;
  const physical = vi.fn(async () => wire());
  vi.stubGlobal("fetch", physical);
  vi.spyOn(TypeSafeClient.prototype, "systemOne").mockImplementationOnce(
    function (this: TypeSafeClient, ...args: Parameters<typeof sdk>) {
      let actual: ReturnType<typeof sdk> | undefined;
      const response = (async () => {
        await nativeHeld(f, reference);
        await f.t.run(async (ctx) => {
          const c = (await ctx.db
              .query("jevControls")
              .withIndex("by_key", (q) =>
                q.eq("key", `verification:account:${f.accountId}`),
              )
              .unique())!,
            { _id, _creationTime, ...base } = c;
          await ctx.db.insert("jevControls", base);
        });
        actual = sdk.apply(this, args);
        return actual.asResponse();
      })();
      return new APIPromise(response, async () => {
        if (!actual) throw new Error("SDK gate did not admit");
        return actual;
      });
    },
  );
  await expect(
    f.signed.action(check, { workspaceId: f.workspaceId, reference }),
  ).rejects.toThrow(/unique|more than one/i);
  expect(physical).not.toHaveBeenCalled();
  const r = (await f.t.run((ctx) =>
    ctx.db.get(reference.contentRequestId as Id<"contentRequests">),
  ))!;
  expect(r.verification).toMatchObject({
    state: "admitted",
    sourceUnavailable: false,
    result: null,
  });
  const t = await f.t.run((ctx) => ctx.db.get(r.verification!.attemptId!));
  expect(t).toMatchObject({
    state: "settled",
    heldMicros: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedMicros: 0,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.ver._id)))!.candidate).toEqual(
    f.ver.candidate,
  );
});

test("genuine installed generation SDK USD receipt and standalone verifier EUR receipt remain separate and charge each original three-scope owner once without FX", async () => {
  vi.useFakeTimers();
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-generation-no-live-key");
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      calls.push(String(url));
      if (String(url) === "https://api.typesafe.ai/v1/systemone") return wire();
      expect(String(url)).toBe(
        "https://router.eu.requesty.ai/v1/chat/completions",
      );
      return Response.json({
        id: "verification-producer-native",
        object: "chat.completion",
        created: 1791210000,
        model: "synthetic/model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({
                text: JSON.stringify([
                  "The author reports one small improvement.",
                  "Its effect remains an open question.",
                ]),
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    }),
  );
  const f = await configuredFixture(true),
    { reference } = await f.signed.mutation(prepare, f.args);
  await f.signed.action(check, { workspaceId: f.workspaceId, reference });
  await f.signed.action(check, { workspaceId: f.workspaceId, reference });
  expect(calls).toEqual([
    "https://router.eu.requesty.ai/v1/chat/completions",
    "https://api.typesafe.ai/v1/systemone",
  ]);
  const receipts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(receipts).toHaveLength(2);
  const generation = receipts.find((t) => "runId" in t && t.runId === f.runId)!,
    verifier = receipts.find((t) => t.owner === "jev-output-verifier")!;
  expect(generation).toMatchObject({
    runId: f.runId,
    state: "settled",
    currency: "USD",
    estimatedMicros: 30,
    heldMicros: 0,
  });
  expect(verifier).toMatchObject({
    producerRunId: f.runId,
    state: "settled",
    currency: "EUR",
    estimatedMicros: 110,
    heldMicros: 0,
  });
  expect(verifier).not.toHaveProperty("runId");
  expect(new Set([...generation.budgetIds, ...verifier.budgetIds]).size).toBe(
    6,
  );
  expect(
    await f.t.run(async (ctx) =>
      Promise.all(generation.budgetIds.map((id) => ctx.db.get(id))),
    ),
  ).toMatchObject([
    { heldMicros: 0, spentMicros: 30, currency: "USD" },
    { heldMicros: 0, spentMicros: 30, currency: "USD" },
    { heldMicros: 0, spentMicros: 30, currency: "USD" },
  ]);
  expect(
    await f.t.run(async (ctx) =>
      Promise.all(verifier.budgetIds.map((id) => ctx.db.get(id))),
    ),
  ).toMatchObject([
    { heldMicros: 0, spentMicros: 110, currency: "EUR" },
    { heldMicros: 0, spentMicros: 110, currency: "EUR" },
    { heldMicros: 0, spentMicros: 110, currency: "EUR" },
  ]);
  expect(
    await f.signed.query(api.ai.runs.recent, { workspaceId: f.workspaceId }),
  ).toMatchObject([
    {
      runId: f.runId,
      currency: "USD",
      estimatedMicros: 30,
      usagePending: false,
    },
  ]);
  expect(
    await f.signed.query(verifierQuery("get"), {
      workspaceId: f.workspaceId,
      reference,
    }),
  ).toMatchObject({
    usage: { currency: "EUR", estimatedMicros: 110, state: "settled" },
    result: { decision: "accept_with_warning" },
  });
  expect(await f.t.run((ctx) => ctx.db.query("approvals").collect())).toEqual(
    [],
  );
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});
