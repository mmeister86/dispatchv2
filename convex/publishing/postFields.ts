import { v } from "convex/values";
export const job = { scheduleId: v.id("schedules"), generation: v.number() };
export const outcome = v.union(
  v.literal("confirmed"),
  v.literal("rejected"),
  v.literal("unknown"),
);
export const attemptFields = {
  reconcileSequence: v.optional(v.number()),
  reconcileReads: v.optional(v.number()),
  reconcileLeaseUntil: v.optional(v.number()),
  reconcileDeadline: v.optional(v.number()),
  reconcileNotBefore: v.optional(v.number()),
  reconciledAt: v.optional(v.number()),
  reconciledBy: v.optional(v.id("users")),
  workspaceId: v.id("workspaces"),
  ...job,
  versionId: v.id("draftVersions"),
  accountId: v.id("socialAccounts"),
  providerIdentity: v.string(),
  connectionSequence: v.number(),
  position: v.number(),
  attempt: v.number(),
  claimSequence: v.number(),
  leaseUntil: v.number(),
  deadline: v.number(),
  stage: v.union(v.literal("preparing"), v.literal("sending"), outcome),
  credentialGeneration: v.optional(v.number()),
  mediaIds: v.array(v.string()),
  mediaKeys: v.optional(v.array(v.union(v.string(), v.null()))),
  parentId: v.optional(v.string()),
  externalId: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  httpStatus: v.optional(v.number()),
  rateResetAt: v.optional(v.number()),
  requestStartedAt: v.optional(v.number()),
  confirmedAt: v.optional(v.number()),
  durationMs: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const attemptDoc = v.object({
  _id: v.id("xPostAttempts"),
  _creationTime: v.number(),
  ...attemptFields,
});
// ponytail: one immediate proof intent expires after 45 minutes, covering bounded media processing. Longer jobs need fresh human consent.
export const FIRST_WRITE_MS = 45 * 60 * 1000;
export const POST_BUDGET_MS = 45 * 60 * 1000;
