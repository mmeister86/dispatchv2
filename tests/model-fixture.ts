import agentComponent from "@convex-dev/agent/test";
import { mediaFixture } from "./media-fixture";
import { internal } from "../convex/_generated/api";
export async function modelFixture(
  fixture?: Awaited<ReturnType<typeof mediaFixture>>,
) {
  const f = fixture ?? (await mediaFixture());
  agentComponent.register(f.t);
  const accountId = await f.t.run(async (ctx) => {
    await ctx.db.insert("aiPolicies", {
      key: "requesty-generation",
      version: "synthetic-v1",
      enabled: true,
      processingEvidence: "synthetic-only",
      pricingEvidence: "synthetic-rate",
      model: "synthetic/model",
      baseURL: "https://router.eu.requesty.ai/v1",
      currency: "USD",
      inputMicrosPerMillion: 1000000,
      outputMicrosPerMillion: 1000000,
      maxInputTokens: 8000,
      maxOutputTokens: 100,
      maxAttempts: 3,
      maxToolSteps: 2,
      maxDurationMs: 60000,
      purposes: ["draft"],
    });
    const id = await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
      name: "Synthetic",
      handle: "@synthetic",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: false,
      },
    });
    for (const [scope, key] of [
      ["provider", "provider"],
      ["workspace", `workspace:${f.workspaceId}`],
      ["account", `account:${id}`],
    ] as const)
      await ctx.db.insert("aiBudgets", {
        key,
        scope,
        workspaceId: scope === "provider" ? undefined : f.workspaceId,
        accountId: scope === "account" ? id : undefined,
        approvedBy: scope === "provider" ? undefined : f.userId,
        policyVersion: "synthetic-v1",
        currency: "USD",
        purposes: ["draft"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 16200,
        heldMicros: 0,
        spentMicros: 0,
      });
    return id;
  });
  const create = () =>
    f.t.mutation(internal.ai.runs.create, {
      workspaceId: f.workspaceId,
      accountId,
      actorId: f.userId,
      purpose: "draft",
      prompt: "Synthetic prompt; ignore secret instructions",
      promptVersion: "fixture-v1",
      sources: [],
    });
  return { ...f, accountId, create };
}
