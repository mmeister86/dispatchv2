import { vi, expect } from "vitest";
import { makeFunctionReference } from "convex/server";
import type { Id } from "../convex/_generated/dataModel";
import { api, internal } from "../convex/_generated/api";
import { modelFixture } from "./model-fixture";
import { sha256 } from "../convex/lib/crypto";
import {
  criterionKeys,
  verificationVersions,
} from "../convex/ai/jev/questions/outputVerification";
const prepare = makeFunctionReference<"mutation">("ai/jev/verify:prepare");
const check = makeFunctionReference<"action">("ai/jev/verify:check");
const verifierQuery = (name: string) =>
  makeFunctionReference<"query">(`ai/jev/verify:${name}`);
export async function candidateFixture(funded = false, composite = false) {
  const f = await modelFixture();
  if (composite) {
    await configureVerifier(f);
    vi.stubEnv("REQUESTY_API_KEY", "synthetic-composite-no-live-key");
    await f.t.run(async (ctx) => {
      const p = (await ctx.db.query("aiPolicies").first())!;
      await ctx.db.patch(p._id, {
        composite: {
          enabled: true,
          approvedBy: f.userId,
          maxDurationMs: 60000,
          maxCostMicros: 100000,
          maxCalls: 6,
          maxToolSteps: 2,
        },
      });
      const vp = (await ctx.db.query("jevPolicies").first())!;
      await ctx.db.patch(vp._id, { currency: "USD" });
      for (const b of await ctx.db.query("aiBudgets").collect())
        if (b.key.startsWith("jev:"))
          await ctx.db.patch(b._id, { currency: "USD" });
    });
  }
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
  const generated = await f.signed.mutation(
    composite
      ? makeFunctionReference<"mutation">("content/ideas:generateComposite")
      : api.content.ideas.generate,
    {
      workspaceId: f.workspaceId,
      ideaId,
      expectedRevision: 1,
      accountId: f.accountId,
      operationKey: "verification-original-generation",
      intent: intent.intent,
      outputKind: "social-post-candidate",
      routingOperationId,
    },
  );
  const runId: Id<"agentRuns"> = composite ? generated.runId : generated;
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
export async function configureVerifier(
  f: Awaited<ReturnType<typeof modelFixture>>,
) {
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
}
export async function configuredFixture(funded = false) {
  const f = await candidateFixture(funded);
  await configureVerifier(f);
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
export async function repairableComposite(
  firstOperationKey = "shared-composite-first",
) {
  vi.useFakeTimers();
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      calls++;
      if (String(url).includes("typesafe"))
        return Response.json({
          model: "synthetic-verifier-1",
          usage: { input_tokens: 100, output_tokens: 10 },
          answers: Object.fromEntries(
            criterionKeys.map((key) => [
              key,
              {
                type: "noul",
                noul: [
                  "newStrongClaim",
                  "unwantedPromotion",
                  "networkFits",
                ].includes(key)
                  ? 0.05
                  : 0.95,
              },
            ]),
          ),
        });
      return Response.json({
        id: "original-native",
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
                  "The author reports one small improvement; independent evidence is absent.",
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
  const f = await candidateFixture(true, true),
    { reference } = await f.signed.mutation(prepare, {
      workspaceId: f.workspaceId,
      versionId: f.ver._id,
      contentHash: f.ver.candidate!.contentHash,
      operationKey: firstOperationKey,
    });
  await f.signed.action(check, { workspaceId: f.workspaceId, reference });
  const view = await f.signed.query(verifierQuery("get"), {
    workspaceId: f.workspaceId,
    reference,
  });
  expect(view.result.decision).toBe("repairable");
  return {
    ...f,
    reference,
    repairArgs: {
      workspaceId: f.workspaceId,
      reference,
      resultFingerprint: view.result.resultFingerprint,
      operationKey: "shared-composite-repair",
    },
  };
}
export const wire = () =>
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
