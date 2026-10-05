import { v } from "convex/values";
import { envelope } from "../x/fields";
export { envelope };
export const installation = v.object({
  id: v.string(),
  owner: v.string(),
  kind: v.union(v.literal("User"), v.literal("Organization")),
});
export const repository = v.object({
  providerId: v.string(),
  installationId: v.string(),
  fullName: v.string(),
  private: v.boolean(),
});
export const connectionFields = {
  workspaceId: v.id("workspaces"),
  actorId: v.id("users"),
  generation: v.number(),
  credentialGeneration: v.number(),
  syncSequence: v.number(),
  status: v.union(
    v.literal("connected"),
    v.literal("disconnected"),
    v.literal("reauth_required"),
  ),
  identity: v.string(),
  login: v.string(),
  installations: v.array(installation),
  inventoryLimited: v.boolean(),
  envelope: v.optional(envelope),
  expiresAt: v.number(),
  refreshExpiresAt: v.number(),
  leaseUntil: v.number(),
  updatedAt: v.number(),
  errorCode: v.optional(v.string()),
  authorizedSequence: v.optional(v.number()),
  discoverySequence: v.optional(v.number()),
};
export const connectionDoc = v.object({
  _id: v.id("githubConnections"),
  _creationTime: v.number(),
  ...connectionFields,
});
export const stateFields = {
  workspaceId: v.id("workspaces"),
  userId: v.id("users"),
  digest: v.string(),
  generation: v.number(),
  verifier: v.optional(envelope),
  redirectUri: v.string(),
  expiresAt: v.number(),
  status: v.union(
    v.literal("pending"),
    v.literal("claimed"),
    v.literal("connected"),
    v.literal("denied"),
    v.literal("failed"),
  ),
  revocationSequence: v.optional(v.number()),
};
export const stateDoc = v.object({
  _id: v.id("githubOAuthStates"),
  _creationTime: v.number(),
  ...stateFields,
});
export const repoFields = {
  workspaceId: v.id("workspaces"),
  ...repository.fields,
  selected: v.boolean(),
  access: v.boolean(),
  monitoring: v.boolean(),
  content: v.boolean(),
  communicableContext: v.string(),
  purposeActorId: v.id("users"),
  purposeAt: v.number(),
  purposeSequence: v.optional(v.number()),
  purposeVersion: v.literal(1),
  connectionGeneration: v.number(),
  generation: v.number(),
  verifiedAt: v.number(),
  proofExpiresAt: v.number(),
  updatedAt: v.number(),
  verifiedSequence: v.optional(v.number()),
};
export const publicRepo = v.object({
  _id: v.id("githubRepositories"),
  ...repository.fields,
  access: v.boolean(),
  monitoring: v.boolean(),
  content: v.boolean(),
  communicableContext: v.string(),
  generation: v.number(),
  verifiedAt: v.number(),
  proofExpiresAt: v.number(),
  authorized: v.boolean(),
  purposeAt: v.number(),
});
export const publicConnection = v.object({
  status: connectionFields.status,
  identity: v.string(),
  login: v.string(),
  installations: v.array(installation),
  inventoryLimited: v.boolean(),
  generation: v.number(),
  updatedAt: v.number(),
  errorCode: v.union(v.string(), v.null()),
});
export const workspaceArgs = { workspaceId: v.id("workspaces") };
export function association(workspaceId: string) {
  return `github-user-token:${workspaceId}`;
}
// ponytail: entitlement snapshots last15min; explicit resync renews them. TASK15 may schedule verified resync, never treat a stale snapshot as permission.
export const PROOF_TTL = 15 * 60000;
