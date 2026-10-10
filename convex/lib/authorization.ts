import { ConvexError, v } from "convex/values";
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { authComponent } from "../auth";
import { requireAdmittedIdentity } from "../operations/authAdmission";

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await authComponent.getAuthUser(ctx);
  await requireAdmittedIdentity(ctx, identity._id);
  if (!identity.emailVerified) throw new ConvexError("EMAIL_NOT_VERIFIED");
  return identity;
}
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity._id))
    .unique();
  if (!user) throw new ConvexError("PROFILE_NOT_INITIALIZED");
  requireActiveUser(user);
  return user;
}
export async function requireWorkspace(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  user?: Doc<"users">,
) {
  const currentUser = user
    ? await ctx.db.get(user._id)
    : await requireUser(ctx);
  requireActiveUser(currentUser);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", currentUser._id).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!membership) throw new ConvexError("WORKSPACE_ACCESS_DENIED");
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new ConvexError("WORKSPACE_ACCESS_DENIED");
  requireActiveWorkspace(workspace);
  return { user: currentUser, workspace, membership };
}
export function requireRole(
  membership: Pick<Doc<"memberships">, "role">,
  roles: Doc<"memberships">["role"][],
) {
  if (!roles.includes(membership.role))
    throw new ConvexError("ROLE_ACCESS_DENIED");
}
export function requireReference(
  workspaceId: Id<"workspaces">,
  reference: { workspaceId: Id<"workspaces"> } | null,
) {
  if (!reference || reference.workspaceId !== workspaceId)
    throw new ConvexError("REFERENCE_ACCESS_DENIED");
  return reference;
}
const userInput = {
  args: {},
  input: async (ctx: QueryCtx | MutationCtx) => ({
    ctx: { user: await requireUser(ctx) },
    args: {},
  }),
};
const workspaceInput = {
  args: { workspaceId: v.id("workspaces") },
  input: async (
    ctx: QueryCtx | MutationCtx,
    { workspaceId }: { workspaceId: Id<"workspaces"> },
  ) => ({ ctx: await requireWorkspace(ctx, workspaceId), args: {} }),
};
export const userQuery = customQuery(query, userInput);
export const userMutation = customMutation(mutation, userInput);
export const workspaceQuery = customQuery(query, workspaceInput);
export const workspaceMutation = customMutation(mutation, workspaceInput);

export function requireActiveWorkspace(workspace: Doc<"workspaces"> | null) {
  if (!workspace || (workspace.lifecycle && workspace.lifecycle !== "active"))
    throw new ConvexError("WORKSPACE_INACTIVE");
}

export const workspaceInternalMutation = customMutation(
  internalMutation,
  workspaceInput,
);
export const workspaceInternalQuery = customQuery(
  internalQuery,
  workspaceInput,
);

export function requireActiveUser(
  user: Doc<"users"> | null,
): asserts user is Doc<"users"> {
  if (!user || (user.lifecycle && user.lifecycle !== "active"))
    throw new ConvexError("ACCOUNT_INACTIVE");
}
