import { vi } from "vitest";
import { mediaFixture } from "./media-fixture";
import { sha256 } from "../convex/lib/crypto";
export async function jevFixture(executable = false) {
  vi.stubEnv("TYPESAFE_API_KEY", "synthetic-secret-no-live-key");
  const f = await mediaFixture();
  const request = await f.t.run(async (ctx) => {
    const accountId = await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
      name: "Fixture",
      handle: "fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: false,
      },
    });
    const common = {
      workspaceId: f.workspaceId,
      accountId,
      network: "x" as const,
      surface: "for_you" as const,
      createdBy: f.userId,
      createdAt: Date.now(),
      status: "reviewed" as const,
      review: {
        actorId: f.userId,
        at: Date.now(),
        reason: "Synthetic test only",
      },
      retiredAt: null,
    };
    const algorithmId = await ctx.db.insert("algorithmProfiles", {
      ...common,
      payload: {
        version: executable ? "x-post-analysis-v1" : "x-public-context-v1",
        repository: "xai-org/x-algorithm",
        commit: "b412112d03f27acbfd668e0cc040abcafa1080c1",
        commitAt: 0,
        observedAt: 0,
        reviewDueAt: Date.now() + 86400000,
        validityBasis: "operational_assumption",
        sourceScope: "public_code",
        productionState: "unknown",
        scoringInfluence: "none",
        evidence: [],
        report: "Synthetic only",
        refs: {
          questionSet: executable
            ? "jev-post-analysis-v1"
            : "unavailable-until-task28",
          normalization: executable
            ? "jev-normalization-v1"
            : "unavailable-until-task28",
          formula: "dispatch-score-v1",
          routing: "disabled-v1",
          verification: "disabled-v1",
        },
      } as import("../convex/_generated/dataModel").Doc<"algorithmProfiles">["payload"],
    });
    const audienceId = await ctx.db.insert("audienceProfiles", {
      ...common,
      payload: {
        version: "declared-audience-v1",
        description: "Synthetic audience",
        source: "authorized_declaration",
        measurement: "unavailable",
        embedding: "unavailable",
      },
    });
    await ctx.db.insert("intelligenceSelections", {
      workspaceId: f.workspaceId,
      accountId,
      network: "x",
      surface: "for_you",
      revision: 1,
      algorithmId,
      audienceId,
      selectedBy: f.userId,
      updatedAt: Date.now(),
    });
    const draftId = await ctx.db.insert("drafts", {
      workspaceId: f.workspaceId,
      revision: 1,
      currentVersionId: null,
      authorId: f.userId,
      source: "manual",
      updatedAt: Date.now(),
    });
    const draftVersionId = await ctx.db.insert("draftVersions", {
      workspaceId: f.workspaceId,
      draftId,
      number: 1,
      content: {
        title: "Private fixture",
        text: ["Synthetic first segment", "Synthetic second segment"],
        media: [],
        accountId,
        pillar: "",
        strategy: "",
      },
      authorId: f.userId,
      createdAt: Date.now(),
      reason: "synthetic",
    });
    await ctx.db.patch(draftId, { currentVersionId: draftVersionId });
    const policyId = await ctx.db.insert("jevPolicies", {
      workspaceId: f.workspaceId,
      accountId,
      version: "synthetic-price-v1",
      credentialFingerprint: await sha256("synthetic-secret-no-live-key"),
      approvedBy: f.userId,
      expiresAt: Date.now() + 86400000,
      model: "jev-1.13.0",
      currency: "USD",
      pricingEvidence: "synthetic only",
      inputMicrosPerMillion: 1000000,
      outputMicrosPerMillion: 0,
      maxInputTokens: executable ? 16000 : 8000,
      maxOutputTokens: 1000,
      euEvidence: {
        gateway: "synthetic",
        inference: "synthetic",
        logs: "synthetic",
        cache: "synthetic",
        storage: "synthetic",
        subprocessors: "synthetic",
      },
    });
    const flags = {
      enabled: true,
      analyzer: true,
      routing: false as const,
      verification: false as const,
      networkFit: false as const,
      policyId,
      composerTimeoutMs: 2500,
      backgroundTimeoutMs: 5000,
      failures: 0,
      openUntil: 0,
      probeAttemptId: null,
    };
    await ctx.db.insert("jevControls", {
      ...flags,
      key: "global",
      policyId: null,
    });
    await ctx.db.insert("jevControls", {
      ...flags,
      key: `account:${accountId}`,
      workspaceId: f.workspaceId,
      accountId,
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
        workspaceId: i ? f.workspaceId : undefined,
        accountId: i === 2 ? accountId : undefined,
        approvedBy: i ? f.userId : undefined,
        policyVersion: "synthetic-price-v1",
        currency: "USD",
        purposes: ["analyzer"],
        expiresAt: Date.now() + 86400000,
        limitMicros: 100000,
        heldMicros: 0,
        spentMicros: 0,
      });
    return {
      workspaceId: f.workspaceId,
      accountId,
      actorId: f.userId,
      draftId,
      draftVersionId,
      algorithmId,
      audienceId,
      selectionRevision: 1,
      operationKey: "synthetic-operation-one",
      mode: "composer" as const,
      deadline: Date.now() + 2500,
    };
  });
  return { ...f, request };
}
