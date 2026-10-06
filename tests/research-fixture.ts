import { vi } from "vitest";
import { mediaFixture } from "./media-fixture";
import { api } from "../convex/_generated/api";
import { sha256 } from "../convex/lib/crypto";
import workflowComponent from "@convex-dev/workflow/test";
import agentComponent from "@convex-dev/agent/test";
import type { Doc, Id } from "../convex/_generated/dataModel";
export const config = {
  topics: "Product",
  project: "",
  audience: "Builders",
  languages: ["de"],
  regions: ["DE"],
  preferredSources: [],
  exclusions: "",
  freshnessDays: 30,
  topicCount: 5,
  frequency: "manual" as const,
  timeZone: "Europe/Berlin",
  clock: "09:00",
  weekday: 1,
  cap: null,
  autoHandoff: false as const,
};
export async function fixture(
  operations: ("x-recent" | "x-trends" | "web-search")[] = [
    "x-recent",
    "web-search",
  ],
  cap = 300,
  base?: Awaited<ReturnType<typeof mediaFixture>>,
) {
  const f = base ?? (await mediaFixture());
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key");
  vi.stubEnv("X_APP_BEARER_TOKEN", "synthetic-x-key");
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
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
        mediaTypes: [],
        publish: false,
      },
    }),
  );
  const policies: Id<"researchSourcePolicies">[] = [];
  await f.t.run(async (ctx) => {
    for (const operation of operations)
      policies.push(
        await ctx.db.insert("researchSourcePolicies", {
          workspaceId: f.workspaceId,
          accountId,
          operation,
          enabled: true,
          version: "synthetic-v1",
          generation: 1,
          approvedBy: f.userId,
          expiresAt: Date.now() + 86400000,
          accessEvidence: "synthetic-own-access",
          processingEvidence: "synthetic-complete-chain",
          pricingEvidence: "synthetic-priced",
          rightsEvidence: "synthetic-public-only",
          protocolEvidence: "synthetic-exact-mode",
          lifecycleEvidence: "synthetic-current-removal-coverage",
          lifecycleValidUntil: Date.now() + 86400000,
          retentionMs: 600000,
          authMode: "app-only",
          credentialFingerprint: await sha256(
            operation === "web-search" ? "synthetic-key" : "synthetic-x-key",
          ),
          protocol:
            operation === "web-search"
              ? "requesty-chat-web-search-v1"
              : operation === "x-recent"
                ? "x-post-fields-v2"
                : "x-woeid-v2",
          currency: "USD",
          unit:
            operation === "web-search"
              ? "total-request"
              : operation === "x-recent"
                ? "post"
                : "request",
          unitMicros: operation === "web-search" ? 100 : 10,
          totalChargeBoundEvidence:
            "synthetic-hard-search-and-generation-total",
          allocationEvidence:
            "synthetic-native-slice-excludes-generation-and-publishing",
          allocatedProviderLimitMicros: 1000,
          costCurrencyEvidence: "synthetic-cost-field-exact-USD",
          model: operation === "web-search" ? "synthetic/model" : null,
          woeid: operation === "x-trends" ? 23424829 : null,
        }),
      );
    for (const [scope, key] of [
      ["provider", "native:x"],
      ["provider", "native:requesty"],
      ["workspace", `native:workspace:${f.workspaceId}`],
      ["account", `native:account:${accountId}`],
    ] as const)
      await ctx.db.insert("aiBudgets", {
        key,
        scope,
        workspaceId: scope === "provider" ? undefined : f.workspaceId,
        accountId: scope === "account" ? accountId : undefined,
        approvedBy: scope === "provider" ? undefined : f.userId,
        policyVersion: "synthetic-v1",
        currency: "USD",
        purposes: ["native-search"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 1000,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  const profileId = await f.signed.mutation(api.research.profiles.create, {
    workspaceId: f.workspaceId,
    accountId,
    config,
    commandKey: "create-native",
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId,
    expectedRevision: 1,
    commandKey: "native-cap",
    action: {
      kind: "save",
      config: { ...config, cap: { currency: "USD", limitMicros: cap } },
    },
  });
  const start = (key = "native-one", ops = operations) =>
    f.signed.mutation(api.research.native.start, {
      workspaceId: f.workspaceId,
      profileId,
      expectedRevision: 2,
      operationKey: key,
      query: "Product news",
      language: "de",
      operations: ops,
    });
  return { ...f, accountId, profileId, policies, start };
}
export const frame = (value: unknown) =>
  `data: ${JSON.stringify(value)}\r\n\r\n`;
export function streamResponse(
  sources = [
    { url: "https://example.test/news", title: "Öffentliche Nachricht" },
  ],
  cost: unknown = 0.00002,
) {
  return new Response(
    frame({
      choices: [
        {
          index: 0,
          delta: {
            content: "Invented https://fake.test",
            web_search: { content: sources },
          },
        },
      ],
    }) +
      frame({ choices: [{ delta: {}, finish_reason: "stop" }] }) +
      frame({
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cost,
        },
      }) +
      "data: [DONE]\r\n\r\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}

export async function pipelineFixture(
  cap = 20000,
  operations: Doc<"researchSourcePolicies">["operation"][] = ["web-search"],
  topicCount?: number,
  base?: Awaited<ReturnType<typeof mediaFixture>>,
) {
  const f = await fixture(operations, cap, base);
  workflowComponent.register(f.t);
  agentComponent.register(f.t);
  await f.t.run(async (ctx) => {
    await ctx.db.insert("aiPolicies", {
      key: "requesty-generation",
      version: "synthetic-v1",
      enabled: true,
      processingEvidence: "synthetic",
      pricingEvidence: "synthetic",
      model: "synthetic/model",
      baseURL: "https://router.eu.requesty.ai/v1",
      currency: "USD",
      inputMicrosPerMillion: 1000000,
      outputMicrosPerMillion: 1000000,
      maxInputTokens: 16000,
      maxOutputTokens: 3000,
      maxAttempts: 3,
      maxToolSteps: 2,
      maxDurationMs: 120000,
      purposes: ["research"],
    });
    for (const [scope, key] of [
      ["provider", "provider"],
      ["workspace", `workspace:${f.workspaceId}`],
      ["account", `account:${f.accountId}`],
    ] as const)
      await ctx.db.insert("aiBudgets", {
        key,
        scope,
        workspaceId: scope === "provider" ? undefined : f.workspaceId,
        accountId: scope === "account" ? f.accountId : undefined,
        approvedBy: scope === "provider" ? undefined : f.userId,
        policyVersion: "synthetic-v1",
        currency: "USD",
        purposes: ["research"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 100000,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  if (topicCount !== undefined) {
    const p = (await f.t.run((ctx) => ctx.db.get(f.profileId)))!,
      version = (await f.t.run((ctx) => ctx.db.get(p.currentVersionId!)))!;
    await f.signed.mutation(api.research.profiles.change, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 2,
      commandKey: "pipeline-topics",
      action: { kind: "save", config: { ...version.config, topicCount } },
    });
  }
  const start = (key = "pipeline-one") =>
    f.signed.mutation(api.research.pipeline.start, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: topicCount === undefined ? 2 : 3,
      operationKey: key,
      language: "de",
      operations,
    });
  return { ...f, start };
}
