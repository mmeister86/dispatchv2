import { vi } from "vitest";
import { mediaFixture } from "./media-fixture";
import { api } from "../convex/_generated/api";
import { sha256 } from "../convex/lib/crypto";
export async function fixture(configured = true) {
  const f = await mediaFixture();
  vi.stubEnv("TYPESAFE_API_KEY", "synthetic-routing-only-no-live-key");
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic-routing",
      name: "Synthetic",
      handle: "synthetic",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
        publish: false,
      },
    }),
  );
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    title: "Native original",
    note: "Unverified human assertion",
    perspective: "Possible interpretation",
    priority: "normal",
    source: { kind: "note" },
    operationKey: "routing-original-idea",
  });
  if (configured)
    await f.t.run(async (ctx) => {
      const policyId = await ctx.db.insert("jevPolicies", {
        purpose: "intent-routing",
        workspaceId: f.workspaceId,
        accountId,
        version: "synthetic-routing-price-v1",
        approvedBy: f.userId,
        expiresAt: Date.now() + 86400000,
        credentialFingerprint: await sha256(
          "synthetic-routing-only-no-live-key",
        ),
        model: "synthetic-routing-1.0",
        currency: "USD",
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
        questionVersion: "jev-intent-routing-v1",
        normalizationVersion: "jev-routing-normalization-v1",
        thresholdVersion: "jev-routing-hypotheses-v1",
      });
      for (const global of [true, false])
        await ctx.db.insert("jevControls", {
          purpose: "intent-routing",
          key: global ? "routing:global" : `routing:account:${accountId}`,
          ...(global ? {} : { workspaceId: f.workspaceId, accountId }),
          enabled: true,
          analyzer: false,
          routing: true,
          verification: false,
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
                : `jev:account:${accountId}`,
          scope,
          ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
          ...(i === 2 ? { accountId } : {}),
          policyVersion: "synthetic-routing-price-v1",
          currency: "USD",
          purposes: ["intent-routing"],
          expiresAt: Date.now() + 86400000,
          limitMicros: 1000000,
          heldMicros: 0,
          spentMicros: 0,
        });
    });
  const command = {
    workspaceId: f.workspaceId,
    accountId,
    ideaId,
    expectedRevision: 1,
    operationKey: "native-routing-command",
    intent: {
      intent: "Explore this exact native input",
      outputKind: "perspective" as const,
      strategy: null,
      network: "x" as const,
      objective: "Explain the implications",
      tone: "Clear",
      cta: null,
    },
  };
  return { ...f, accountId, ideaId, command };
}
export function response(category = "educational", confidence = 0.9) {
  const names = [
    "announcement",
    "milestone",
    "launch",
    "educational",
    "thoughtLeadership",
    "conversation",
    "story",
    "promotional",
    "generic",
  ];
  return new Response(
    JSON.stringify({
      model: "synthetic-routing-1.0",
      usage: { input_tokens: 20, output_tokens: 10 },
      answers: {
        intent: {
          type: "choice",
          choice: category,
          confidence,
          probabilities: Object.fromEntries(
            names.map((x) => [x, x === category ? 1 : 0]),
          ),
        },
      },
    }),
    { status: 200 },
  );
}
