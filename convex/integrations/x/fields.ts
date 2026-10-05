import { v } from "convex/values";
export const envelope = v.object({
  version: v.literal(1),
  keyId: v.string(),
  iv: v.string(),
  ciphertext: v.string(),
});
export const xEvidence = v.object({
  scopes: v.array(v.string()),
  identityVerifiedAt: v.number(),
  connectionSequence: v.optional(v.number()),
  textScopeEligible: v.boolean(),
  mediaScopeEligible: v.boolean(),
  liveWrite: v.union(
    v.literal("unverified"),
    v.literal("verified"),
    v.literal("blocked"),
  ),
  errorCode: v.optional(v.string()),
  remoteRevocation: v.optional(v.literal("not_attempted")),
});
export const credentialFields = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  generation: v.number(),
  envelope: v.optional(envelope),
  expiresAt: v.number(),
  scopes: v.array(v.string()),
  leaseUntil: v.number(),
  cleanAfter: v.number(),
};
export const credentialDoc = v.object({
  _id: v.id("xCredentials"),
  _creationTime: v.number(),
  ...credentialFields,
});
export const stateFields = {
  workspaceId: v.id("workspaces"),
  userId: v.id("users"),
  digest: v.string(),
  startedSequence: v.optional(v.number()),
  verifier: v.optional(envelope),
  redirectUri: v.string(),
  expiresAt: v.number(),
  accountId: v.optional(v.id("socialAccounts")),
  generation: v.optional(v.number()),
  status: v.union(
    v.literal("pending"),
    v.literal("claimed"),
    v.literal("connected"),
    v.literal("denied"),
    v.literal("failed"),
  ),
};
export const stateDoc = v.object({
  _id: v.id("xOAuthStates"),
  _creationTime: v.number(),
  ...stateFields,
});
export const accountArgs = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
};
export function association(workspaceId: string, accountId: string) {
  return `x-token:${workspaceId}:${accountId}`;
}
