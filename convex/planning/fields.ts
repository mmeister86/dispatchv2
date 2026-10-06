import { v } from "convex/values";
import { source } from "../ai/fields";
export const requestFields = {
  accountId: v.id("socialAccounts"),
  preferenceId: v.id("preferences"),
  desiredCount: v.number(),
  start: v.string(),
  end: v.string(),
  timezone: v.string(),
  clock: v.string(),
  mode: v.union(v.literal("work"), v.literal("research"), v.literal("mixed")),
  topics: v.string(),
};
export const shortage = v.object({ code: v.string(), count: v.number() });
export const planFields = {
  workspaceId: v.id("workspaces"),
  actorId: v.id("users"),
  commandKey: v.string(),
  fingerprint: v.string(),
  createdAt: v.number(),
  ...requestFields,
  preferences: v.object({
    timezone: v.string(),
    language: v.string(),
    audience: v.string(),
    tone: v.string(),
    topics: v.string(),
  }),
  historyContext: v.optional(
    v.object({
      scanned: v.number(),
      available: v.number(),
      unavailable: v.number(),
      partial: v.boolean(),
    }),
  ),
  selectedCount: v.number(),
  candidateCount: v.number(),
  coveragePartial: v.boolean(),
  shortages: v.array(shortage),
};
export const itemFields = {
  workspaceId: v.id("workspaces"),
  planId: v.id("contentPlans"),
  accountId: v.id("socialAccounts"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  versionNumber: v.number(),
  draftRevision: v.number(),
  ideaVersionId: v.id("ideaVersions"),
  sources: v.array(source),
  families: v.array(v.string()),
  rootEvidenceIds: v.array(v.id("researchEvidence")),
  at: v.number(),
  timezone: v.string(),
  localTime: v.string(),
  proofUntil: v.number(),
  validityUntil: v.number(),
  historyVersionIds: v.optional(v.array(v.id("draftVersions"))),
  contextProofUntil: v.optional(v.union(v.number(), v.null())),
  reason: v.string(),
  status: v.union(v.literal("proposed"), v.literal("rejected")),
};
