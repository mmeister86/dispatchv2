import { v } from "convex/values";
import { identity, pin } from "../content/similarityFields";
export const stylePin = v.object({
  versionId: v.id("styleProfileVersions"),
  fingerprint: v.string(),
  selectedBy: v.id("users"),
  selectionReceiptId: v.id("styleProfileCommands"),
  sourceUntil: v.union(v.number(), v.null()),
});
export const config = v.object({
  preferenceId: v.id("preferences"),
  styleVersionId: v.id("styleProfileVersions"),
  theme: v.string(),
  candidateVersionIds: v.array(v.id("draftVersions")),
  pillars: v.array(v.object({ name: v.string(), weight: v.number() })),
  desiredFormat: v.union(v.literal("single"), v.literal("thread")),
  threshold: v.number(),
  timezone: v.string(),
  frequency: v.literal("weekly"),
  weekday: v.number(),
  callbackClock: v.string(),
  publishingClocks: v.array(v.string()),
  start: v.string(),
  end: v.string(),
  occurrences: v.number(),
  itemsPerBatch: v.number(),
  historyFrom: v.number(),
  historyTo: v.number(),
});
export const scope = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
};
export const controlFields = {
  ...scope,
  revision: v.number(),
  generation: v.number(),
  enabled: v.boolean(),
  versionId: v.union(v.id("planningSeriesVersions"), v.null()),
  actorId: v.id("users"),
  membershipId: v.id("memberships"),
  actorFingerprint: v.string(),
  providerIdentity: v.string(),
  connectionSequence: v.number(),
  nextAt: v.union(v.number(), v.null()),
  nextIndex: v.number(),
  remaining: v.number(),
  nextKey: v.union(v.string(), v.null()),
  scheduledJobId: v.union(v.id("_scheduled_functions"), v.null()),
  reason: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const versionFields = {
  ...scope,
  seriesId: v.id("planningSeries"),
  revision: v.number(),
  actorId: v.id("users"),
  config: v.union(config, v.null()),
  style: v.union(stylePin, v.null()),
  frameFingerprint: v.union(v.string(), v.null()),
  intentFingerprint: v.union(v.string(), v.null()),
  sourceUntil: v.number(),
  embeddingControlId: v.id("embeddingControls"),
  embeddingGeneration: v.number(),
  sequence: v.array(v.number()),
  sourceUnavailable: v.boolean(),
  createdAt: v.number(),
};
export const commandFields = {
  ...scope,
  seriesId: v.id("planningSeries"),
  actorId: v.id("users"),
  commandKey: v.string(),
  fingerprint: v.union(v.string(), v.null()),
  expectedRevision: v.number(),
  revision: v.number(),
  versionId: v.union(v.id("planningSeriesVersions"), v.null()),
  generation: v.number(),
  sourceUnavailable: v.boolean(),
  createdAt: v.number(),
};
export const occurrence = v.object({
  seriesId: v.id("planningSeries"),
  versionId: v.id("planningSeriesVersions"),
  generation: v.number(),
  at: v.number(),
  index: v.number(),
  key: v.string(),
  sourceUntil: v.number(),
});
export const semantic = v.object({
  identity,
  vectorCount: v.number(),
  sourceUntil: v.number(),
  threshold: v.number(),
  style: stylePin,
  desiredFormat: v.union(v.literal("single"), v.literal("thread")),
  formatProven: v.literal(false),
  timingProven: v.literal(false),
});
export const bindingFields = {
  ...scope,
  planId: v.id("contentPlans"),
  vectorId: v.id("contentEmbeddings"),
  fingerprint: v.union(v.string(), v.null()),
  attemptId: v.id("aiAttempts"),
  receiptFingerprint: v.union(v.string(), v.null()),
  materialFingerprint: v.union(v.string(), v.null()),
  sourcePin: v.union(pin, v.null()),
  sourceUntil: v.number(),
  sourceUnavailable: v.boolean(),
};
export const controlDoc = v.object({
  _id: v.id("planningSeries"),
  _creationTime: v.number(),
  ...controlFields,
});
export const versionDoc = v.object({
  _id: v.id("planningSeriesVersions"),
  _creationTime: v.number(),
  ...versionFields,
});
export const result = v.object({
  seriesId: v.id("planningSeries"),
  revision: v.number(),
  versionId: v.union(v.id("planningSeriesVersions"), v.null()),
  receiptId: v.id("planningSeriesCommands"),
});
