import { v } from "convex/values";
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
