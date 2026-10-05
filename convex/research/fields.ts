import { v } from "convex/values";
import { nativeOrder } from "./providerFields";
export const configFields = {
  topics: v.string(),
  project: v.string(),
  audience: v.string(),
  languages: v.array(v.string()),
  regions: v.array(v.string()),
  preferredSources: v.array(v.string()),
  exclusions: v.string(),
  freshnessDays: v.number(),
  topicCount: v.number(),
  frequency: v.union(
    v.literal("manual"),
    v.literal("daily"),
    v.literal("weekly"),
  ),
  timeZone: v.string(),
  clock: v.string(),
  weekday: v.number(),
  cap: v.union(
    v.object({ limitMicros: v.number(), currency: v.string() }),
    v.null(),
  ),
  autoHandoff: v.literal(false),
};
export const config = v.object(configFields);
export const approval = v.union(
  v.object({
    kind: v.literal("generation-prerequisites-only"),
    policyVersion: v.string(),
    policyFingerprint: v.string(),
    budgetIds: v.array(v.id("aiBudgets")),
  }),
  v.null(),
);
export const profileFields = {
  scheduleApproval: approval,
  scheduleReason: v.union(v.string(), v.null()),
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  currentVersionId: v.union(v.id("researchProfileVersions"), v.null()),
  revision: v.number(),
  paused: v.boolean(),
  deleted: v.boolean(),
  scheduleActive: v.boolean(),
  scheduleGeneration: v.number(),
  scheduleActorId: v.union(v.id("users"), v.null()),
  scheduleAccountSequence: v.union(v.number(), v.null()),
  scheduledJobId: v.union(v.id("_scheduled_functions"), v.null()),
  nextAt: v.union(v.number(), v.null()),
  activeOrderId: v.union(v.id("researchOrders"), v.null()),
};
export const versionFields = {
  workspaceId: v.id("workspaces"),
  profileId: v.id("researchProfiles"),
  actorId: v.id("users"),
  number: v.number(),
  config,
  commandKey: v.string(),
  fingerprint: v.string(),
  createdAt: v.number(),
};
export const orderFields = {
  native: v.optional(nativeOrder),
  approval,
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  profileId: v.id("researchProfiles"),
  profileVersionId: v.id("researchProfileVersions"),
  actorId: v.id("users"),
  occasion: v.union(
    v.literal("manual"),
    v.literal("scheduled"),
    v.literal("agent"),
  ),
  operationKey: v.string(),
  fingerprint: v.string(),
  occurrence: v.union(
    v.object({ generation: v.number(), at: v.number() }),
    v.null(),
  ),
  accountSequence: v.number(),
  config,
  windowStart: v.number(),
  windowEnd: v.number(),
  deadline: v.number(),
  state: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("blocked"),
    v.literal("cancelled"),
    v.literal("completed"),
  ),
  generation: v.number(),
  createdAt: v.number(),
  finishedAt: v.union(v.number(), v.null()),
  reason: v.union(v.string(), v.null()),
  usageMicros: v.null(),
};
const {
  scheduleApproval: _approval,
  scheduleActorId: _actor,
  scheduleAccountSequence: _sequence,
  scheduledJobId: _job,
  ...publicProfileFields
} = profileFields;
export const profileDoc = v.object({
  _id: v.id("researchProfiles"),
  _creationTime: v.number(),
  ...publicProfileFields,
});
export const versionDoc = v.object({
  _id: v.id("researchProfileVersions"),
  _creationTime: v.number(),
  ...versionFields,
});
const {
  native: _native,
  approval: _orderApproval,
  actorId: _orderActor,
  accountSequence: _orderSequence,
  fingerprint: _fingerprint,
  operationKey: _key,
  ...publicOrderFields
} = orderFields;
export const orderDoc = v.object({
  _id: v.id("researchOrders"),
  _creationTime: v.number(),
  ...publicOrderFields,
});
