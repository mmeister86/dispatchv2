import { v } from "convex/values";
import { operation } from "./providerFields";
import { annotation } from "./evidenceFields";
export const sourceCoverage = v.object({
  operation,
  delivered: v.number(),
  selected: v.number(),
  omitted: v.number(),
});
export const sourcePin = v.object({
  sourceId: v.id("researchSources"),
  materialHash: v.string(),
  until: v.number(),
});
export const historyPin = v.object({
  scheduleId: v.id("schedules"),
  versionId: v.id("draftVersions"),
  attemptId: v.id("xPostAttempts"),
  position: v.number(),
  externalId: v.string(),
  confirmedAt: v.number(),
  materialHash: v.string(),
});
export const proposedItem = v.object({
  title: v.string(),
  sourceId: v.id("researchSources"),
  materialHash: v.string(),
  annotation,
  topicKey: v.optional(v.union(v.string(), v.null())),
  perspective: v.string(),
  dynamics: v.string(),
  clusterId: v.union(v.id("researchClusters"), v.null()),
  clusterRevision: v.union(v.number(), v.null()),
  historyIds: v.array(v.id("xPostAttempts")),
  copySourceIds: v.array(v.id("researchSources")),
  eventAt: v.union(v.number(), v.null()),
  eventQuote: v.union(v.string(), v.null()),
});
export const disposition = v.union(
  ...(
    [
      "pending",
      "completed",
      "empty",
      "partial",
      "budget_exhausted",
      "failed",
      "cancelled",
      "configuration_required",
    ] as const
  ).map(v.literal),
);
export const pipeline = v.object({
  kind: v.literal("research-workflow-v1"),
  materialGeneration: v.number(),
  workflowId: v.union(v.string(), v.null()),
  step: v.number(),
  outcome: disposition,
  sourcePins: v.array(sourcePin),
  sourceCoverage: v.optional(v.array(sourceCoverage)),
  contextPins: v.optional(
    v.array(
      v.object({
        orderId: v.id("researchOrders"),
        sourceId: v.id("researchSources"),
        materialHash: v.string(),
        until: v.number(),
      }),
    ),
  ),
  contextEvidence: v.optional(
    v.array(
      v.object({
        orderId: v.id("researchOrders"),
        evidenceId: v.id("researchEvidence"),
        outputHash: v.string(),
      }),
    ),
  ),
  history: v.array(historyPin),
  historyTruncated: v.boolean(),
  clusterPins: v.array(
    v.object({ id: v.id("researchClusters"), revision: v.number() }),
  ),
  clustersTruncated: v.boolean(),
  duplicateGroups: v.array(v.array(v.id("researchSources"))),
  runId: v.union(v.id("agentRuns"), v.null()),
  executionKey: v.union(v.string(), v.null()),
  proposalHash: v.union(v.string(), v.null()),
  pending: v.union(v.array(proposedItem), v.null()),
  clusterIds: v.array(v.id("researchClusters")),
  evidenceIds: v.array(v.id("researchEvidence")),
  inboxReady: v.boolean(),
  retentionUntil: v.union(v.number(), v.null()),
  cleanupState: v.union(
    v.literal("retained"),
    v.literal("pending"),
    v.literal("complete"),
  ),
  workflowCleaned: v.boolean(),
  agentCleaned: v.boolean(),
  usagePending: v.boolean(),
  nextAt: v.union(v.number(), v.null()),
  handoff: v.literal("disabled"),
});
export const clusterFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  key: v.string(),
  revision: v.number(),
  evidenceIds: v.array(v.id("researchEvidence")),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const bindingFields = {
  orderId: v.id("researchOrders"),
  sourceId: v.id("researchSources"),
  materialHash: v.string(),
  state: v.union(v.literal("retained"), v.literal("removed")),
};
