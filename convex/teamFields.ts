import { v } from "convex/values";
export const deliveryStatus = v.union(
  ...(
    [
      "notRequested",
      "configurationRequired",
      "sending",
      "providerAccepted",
      "failed",
      "unknown",
    ] as const
  ).map(v.literal),
);
export const deliveryFields = v.object({
  status: deliveryStatus,
  commandKey: v.optional(v.string()),
  actorId: v.optional(v.id("users")),
  body: v.optional(v.string()),
  configFingerprint: v.optional(v.string()),
  firstSendAt: v.optional(v.number()),
  retryUntil: v.optional(v.number()),
  sequence: v.number(),
  claim: v.optional(v.string()),
  claimUntil: v.optional(v.number()),
  providerId: v.optional(v.string()),
  sourceUnavailable: v.boolean(),
  cleanAfter: v.union(v.number(), v.null()),
});
export const deliveryResult = v.object({
  status: deliveryStatus,
  providerId: v.union(v.string(), v.null()),
});
export const teamResult = v.object({
  revision: v.number(),
  invitationId: v.union(v.id("teamInvitations"), v.null()),
  membershipId: v.union(v.id("memberships"), v.null()),
  userId: v.union(v.id("users"), v.null()),
  disposition: v.union(
    ...(
      [
        "issued",
        "revoked",
        "role-changed",
        "removed",
        "transferred",
        "left",
        "joined",
        "already-member",
      ] as const
    ).map(v.literal),
  ),
});
