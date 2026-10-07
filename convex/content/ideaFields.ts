import { source as agentSource } from "../ai/fields";
import { v } from "convex/values";
import {
  researchContentSource,
  researchCopyFields,
} from "../research/contentFields";
export const ideaSource = v.union(
  v.object({ kind: v.literal("context-set"), sources: v.array(agentSource) }),
  researchContentSource,
  v.object({ kind: v.literal("context"), contextId: v.id("githubContexts") }),
  v.object({ kind: v.literal("note") }),
  v.object({
    kind: v.literal("signal"),
    signalId: v.id("githubSignals"),
    repositoryId: v.id("githubRepositories"),
    generation: v.number(),
  }),
);
export const inputSource = v.union(
  v.object({ kind: v.literal("note") }),
  v.object({ kind: v.literal("signal"), signalId: v.id("githubSignals") }),
);
export const ideaInput = {
  title: v.string(),
  perspective: v.string(),
  note: v.string(),
  priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
};
export const ideaFields = {
  workspaceId: v.id("workspaces"),
  actorId: v.id("users"),
  operationKey: v.string(),
  fingerprint: v.string(),
  revision: v.number(),
  currentVersionId: v.union(v.id("ideaVersions"), v.null()),
  status: v.union(
    v.literal("new"),
    v.literal("accepted"),
    v.literal("archived"),
  ),
  updatedAt: v.number(),
  handoff: v.optional(
    v.object({
      ideaVersionId: v.id("ideaVersions"),
      ideaRevision: v.number(),
      accountId: v.union(v.id("socialAccounts"), v.null()),
      draftId: v.id("drafts"),
      draftVersionId: v.id("draftVersions"),
      actorId: v.id("users"),
      intent: v.string(),
      clarificationConfirmed: v.boolean(),
      text: v.string(),
      at: v.number(),
    }),
  ),
};
export const ideaVersionFields = {
  ...researchCopyFields,
  workspaceId: v.id("workspaces"),
  ideaId: v.id("ideas"),
  number: v.number(),
  actorId: v.id("users"),
  createdAt: v.number(),
  ...ideaInput,
  source: ideaSource,
  originals: v.array(v.string()),
  rationale: v.string(),
  questions: v.array(v.string()),
  runId: v.optional(v.id("agentRuns")),
  inputVersionId: v.optional(v.id("ideaVersions")),
};
export const feedbackFields = {
  ...researchCopyFields,
  workspaceId: v.id("workspaces"),
  ideaId: v.id("ideas"),
  versionId: v.id("ideaVersions"),
  actorId: v.id("users"),
  kind: v.union(v.literal("edit"), v.literal("reject"), v.literal("restore")),
  text: v.string(),
  createdAt: v.number(),
  resultingVersionId: v.optional(v.id("ideaVersions")),
};
export const requestFields = {
  routingOperationId: v.optional(v.id("jevRoutingOperations")),
  workspaceId: v.id("workspaces"),
  actorId: v.id("users"),
  ideaId: v.id("ideas"),
  inputVersionId: v.id("ideaVersions"),
  inputRevision: v.number(),
  accountId: v.id("socialAccounts"),
  intent: v.string(),
  operationKey: v.string(),
  runId: v.id("agentRuns"),
  resultIdeaId: v.union(v.id("ideas"), v.null()),
  createdAt: v.number(),
};
