import { checkApproval, checkAccountConnection } from "../../editorial";
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  workspaceQuery,
  workspaceInternalMutation,
  workspaceMutation,
  requireWorkspace,
  requireRole,
  requireReference,
} from "../../lib/authorization";
import { accountArgs, credentialDoc, envelope, stateDoc } from "./fields";

// ponytail: singleton OAuth ordering counter; split only if measured connect/disconnect contention requires it.
async function nextSequence(ctx: MutationCtx) {
  const fence = await ctx.db
    .query("xOAuthFence")
    .withIndex("by_key", (q) => q.eq("key", "oauth"))
    .unique();
  const sequence = (fence?.sequence ?? 0) + 1;
  if (fence) await ctx.db.patch(fence._id, { sequence });
  else await ctx.db.insert("xOAuthFence", { key: "oauth", sequence });
  return sequence;
}
const TTL = 10 * 60000;
async function manage(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const auth = await requireWorkspace(ctx, workspaceId);
  requireRole(auth.membership, ["Owner", "Admin"]);
  if (auth.user.activeWorkspaceId !== workspaceId)
    throw new ConvexError("X_WORKSPACE_CHANGED");
  return auth;
}
async function credential(ctx: QueryCtx, accountId: Id<"socialAccounts">) {
  return ctx.db
    .query("xCredentials")
    .withIndex("by_accountId", (q) => q.eq("accountId", accountId))
    .unique();
}
async function account(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
) {
  const a = requireReference(
    workspaceId,
    await ctx.db.get(accountId),
  ) as Doc<"socialAccounts">;
  if (a.provider !== "X") throw new ConvexError("X_ACCOUNT_REQUIRED");
  return a;
}
export const authorize = workspaceQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await manage(ctx, ctx.workspace._id);
    return null;
  },
});
export const reserve = workspaceInternalMutation({
  args: {
    digest: v.string(),
    verifier: envelope,
    redirectUri: v.string(),
    accountId: v.optional(v.id("socialAccounts")),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    let generation: number | undefined;
    if (a.accountId) {
      await account(ctx, ctx.workspace._id, a.accountId);
      generation = (await credential(ctx, a.accountId))?.generation ?? 0;
    }
    // One pending attempt per initiator/workspace. A new explicit attempt invalidates older callbacks.
    const old = await ctx.db
      .query("xOAuthStates")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("userId", ctx.user._id),
      )
      .take(10);
    for (const s of old) await ctx.db.delete(s._id);
    await ctx.db.insert("xOAuthStates", {
      workspaceId: ctx.workspace._id,
      userId: ctx.user._id,
      digest: a.digest,
      startedSequence: await nextSequence(ctx),
      verifier: a.verifier,
      redirectUri: a.redirectUri,
      expiresAt: Date.now() + TTL,
      accountId: a.accountId,
      generation,
      status: "pending",
    });
    return null;
  },
});
export const claim = workspaceInternalMutation({
  args: { digest: v.string(), denied: v.boolean() },
  returns: stateDoc,
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const s = await ctx.db
      .query("xOAuthStates")
      .withIndex("by_digest", (q) => q.eq("digest", a.digest))
      .unique();
    if (
      !s ||
      s.userId !== ctx.user._id ||
      s.workspaceId !== ctx.workspace._id ||
      s.expiresAt <= Date.now() ||
      s.status !== "pending" ||
      s.startedSequence === undefined ||
      !s.verifier
    )
      throw new ConvexError("X_OAUTH_STATE_INVALID");
    await ctx.db.patch(s._id, {
      status: a.denied ? "denied" : "claimed",
      verifier: undefined,
    });
    return s;
  },
});
export const finish = workspaceInternalMutation({
  args: {
    stateId: v.id("xOAuthStates"),
    identity: v.string(),
    name: v.string(),
    handle: v.string(),
  },
  returns: v.object({
    accountId: v.id("socialAccounts"),
    generation: v.number(),
  }),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const s = await ctx.db.get(a.stateId);
    if (
      !s ||
      s.workspaceId !== ctx.workspace._id ||
      s.userId !== ctx.user._id ||
      s.status !== "claimed" ||
      s.expiresAt <= Date.now()
    )
      throw new ConvexError("X_OAUTH_STATE_INVALID");
    const binding = await ctx.db
      .query("xBindings")
      .withIndex("by_providerIdentity", (q) =>
        q.eq("providerIdentity", a.identity),
      )
      .unique();
    if (
      binding &&
      (binding.changedSequence ?? Number.MAX_SAFE_INTEGER) >
        (s.startedSequence ?? -1) &&
      (!s.accountId || binding.accountId !== s.accountId)
    )
      throw new ConvexError("X_ACCOUNT_BINDING_CONFLICT");
    if (binding?.workspaceId && binding.workspaceId !== ctx.workspace._id)
      throw new ConvexError("X_ACCOUNT_BINDING_CONFLICT");
    // Legacy bound accounts also reserve the identity. Reauth is still bound; no migration steals it.
    const legacy = await ctx.db
      .query("socialAccounts")
      .withIndex("by_provider_and_providerIdentity", (q) =>
        q.eq("provider", "X").eq("providerIdentity", a.identity),
      )
      .take(101);
    if (
      legacy.length > 100 ||
      legacy.some(
        (x) =>
          x.connection !== "disconnected" &&
          x.workspaceId !== ctx.workspace._id,
      )
    )
      throw new ConvexError("X_ACCOUNT_BINDING_CONFLICT");
    let target: Doc<"socialAccounts"> | null = null;
    if (s.accountId) {
      target = await account(ctx, ctx.workspace._id, s.accountId);
      if (target.providerIdentity !== a.identity)
        throw new ConvexError("X_RECONNECT_IDENTITY_MISMATCH");
      if (
        ((await credential(ctx, target._id))?.generation ?? 0) !== s.generation
      )
        throw new ConvexError("X_CONNECTION_CHANGED");
    } else {
      target = legacy.find((x) => x.workspaceId === ctx.workspace._id) ?? null;
      if (target && target.connection !== "disconnected")
        throw new ConvexError("X_USE_RECONNECT");
    }
    if (!target) {
      // ponytail: retain at most100 account rows until TASK-48 paginates the shared account inventory.
      if (
        (
          await ctx.db
            .query("socialAccounts")
            .withIndex("by_workspaceId", (q) =>
              q.eq("workspaceId", ctx.workspace._id),
            )
            .take(100)
        ).length >= 100
      )
        throw new ConvexError("X_ACCOUNT_CAPACITY_REACHED");
      const id = await ctx.db.insert("socialAccounts", {
        workspaceId: ctx.workspace._id,
        provider: "X",
        providerIdentity: a.identity,
        name: a.name,
        handle: a.handle,
        connection: "reauth_required",
        capability: {
          maxText: 280,
          maxThread: 25,
          maxMedia: 4,
          mediaTypes: ["image", "video"],
          publish: false,
        },
      });
      target = (await ctx.db.get(id))!;
    }
    const old = await credential(ctx, target._id),
      generation = (old?.generation ?? 0) + 1;
    const fields = {
      workspaceId: ctx.workspace._id,
      accountId: target._id,
      generation,
      envelope: undefined,
      expiresAt: 0,
      scopes: [],
      leaseUntil: 0,
      cleanAfter: Date.now() + TTL,
    };
    if (old) await ctx.db.patch(old._id, fields);
    else await ctx.db.insert("xCredentials", fields);
    if (binding)
      await ctx.db.patch(binding._id, {
        accountId: target._id,
        workspaceId: ctx.workspace._id,
        changedAt: Date.now(),
        changedSequence: await nextSequence(ctx),
      });
    else
      await ctx.db.insert("xBindings", {
        providerIdentity: a.identity,
        accountId: target._id,
        workspaceId: ctx.workspace._id,
        changedAt: Date.now(),
        changedSequence: await nextSequence(ctx),
      });
    await ctx.db.patch(target._id, {
      name: a.name,
      handle: a.handle,
      connection: "reauth_required",
      capability: { ...target.capability, publish: false },
    });
    return { accountId: target._id, generation };
  },
});
export const complete = workspaceInternalMutation({
  args: {
    stateId: v.id("xOAuthStates"),
    accountId: v.id("socialAccounts"),
    generation: v.number(),
    envelope,
    expiresAt: v.number(),
    scopes: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const s = await ctx.db.get(a.stateId),
      c = await credential(ctx, a.accountId),
      target = await account(ctx, ctx.workspace._id, a.accountId);
    const binding = await ctx.db
      .query("xBindings")
      .withIndex("by_providerIdentity", (q) =>
        q.eq("providerIdentity", target.providerIdentity),
      )
      .unique();
    if (
      !s ||
      s.status !== "claimed" ||
      s.userId !== ctx.user._id ||
      s.workspaceId !== ctx.workspace._id ||
      s.expiresAt <= Date.now() ||
      !c ||
      c.generation !== a.generation ||
      binding?.accountId !== a.accountId
    )
      throw new ConvexError("X_CONNECTION_CHANGED");
    await ctx.db.patch(c._id, {
      envelope: a.envelope,
      expiresAt: a.expiresAt,
      scopes: a.scopes,
      leaseUntil: 0,
      cleanAfter: Number.MAX_SAFE_INTEGER,
    });
    await ctx.db.patch(target._id, {
      connection: "connected",
      xEvidence: {
        scopes: a.scopes,
        identityVerifiedAt: Date.now(),
        connectionSequence: s.startedSequence,
        textScopeEligible: a.scopes.includes("tweet.write"),
        mediaScopeEligible: a.scopes.includes("media.write"),
        liveWrite: "unverified",
      },
      capability: { ...target.capability, publish: false },
    });
    await ctx.db.patch(s._id, { status: "connected" });
    return null;
  },
});
export const failState = internalMutation({
  args: { stateId: v.id("xOAuthStates") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.stateId);
    if (s?.status === "claimed")
      await ctx.db.patch(s._id, { status: "failed", verifier: undefined });
    return null;
  },
});
export const disconnect = workspaceMutation({
  args: { accountId: v.id("socialAccounts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const target = await account(ctx, ctx.workspace._id, a.accountId),
      c = await credential(ctx, a.accountId);
    if (c)
      await ctx.db.patch(c._id, {
        generation: c.generation + 1,
        envelope: undefined,
        scopes: [],
        expiresAt: 0,
        leaseUntil: 0,
        cleanAfter: Number.MAX_SAFE_INTEGER,
      });
    else
      await ctx.db.insert("xCredentials", {
        workspaceId: ctx.workspace._id,
        accountId: target._id,
        generation: 1,
        expiresAt: 0,
        scopes: [],
        leaseUntil: 0,
        cleanAfter: Number.MAX_SAFE_INTEGER,
      });
    const binding = await ctx.db
      .query("xBindings")
      .withIndex("by_providerIdentity", (q) =>
        q.eq("providerIdentity", target.providerIdentity),
      )
      .unique();
    if (binding?.accountId === target._id)
      await ctx.db.patch(binding._id, {
        accountId: undefined,
        workspaceId: undefined,
        changedAt: Date.now(),
        changedSequence: await nextSequence(ctx),
      });
    else if (!binding)
      await ctx.db.insert("xBindings", {
        providerIdentity: target.providerIdentity,
        changedAt: Date.now(),
        changedSequence: await nextSequence(ctx),
      });
    await ctx.db.patch(target._id, {
      connection: "disconnected",
      capability: { ...target.capability, publish: false },
      xEvidence: target.xEvidence
        ? {
            ...target.xEvidence,
            liveWrite: "blocked",
            remoteRevocation: "not_attempted",
          }
        : undefined,
    });
    const states = await ctx.db
      .query("xOAuthStates")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("userId", ctx.user._id),
      )
      .take(10);
    for (const s of states) await ctx.db.delete(s._id);
    return null;
  },
});
async function gate(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
) {
  const target = await account(ctx, workspaceId, accountId),
    c = await credential(ctx, accountId);
  const binding = await ctx.db
    .query("xBindings")
    .withIndex("by_providerIdentity", (q) =>
      q.eq("providerIdentity", target.providerIdentity),
    )
    .unique();
  if (
    target.connection !== "connected" ||
    !c?.envelope ||
    c.workspaceId !== workspaceId ||
    binding?.accountId !== accountId ||
    binding.workspaceId !== workspaceId
  )
    throw new ConvexError("X_REAUTH_REQUIRED");
  return c;
}
async function block(ctx: MutationCtx, c: Doc<"xCredentials">, code: string) {
  const target = await ctx.db.get(c.accountId);
  await ctx.db.patch(c._id, {
    generation: c.generation + 1,
    envelope: undefined,
    leaseUntil: 0,
    cleanAfter: Number.MAX_SAFE_INTEGER,
  });
  if (target)
    await ctx.db.patch(target._id, {
      connection: "reauth_required",
      capability: { ...target.capability, publish: false },
      xEvidence: target.xEvidence
        ? { ...target.xEvidence, liveWrite: "blocked", errorCode: code }
        : undefined,
    });
}
export const refreshClaim = workspaceInternalMutation({
  args: { accountId: v.id("socialAccounts") },
  returns: v.object({
    credential: v.union(credentialDoc, v.null()),
    code: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const c = await gate(ctx, ctx.workspace._id, a.accountId);
    if (c.leaseUntil) {
      if (c.leaseUntil > Date.now())
        return { credential: null, code: "X_REFRESH_IN_PROGRESS" };
      await block(ctx, c, "X_REFRESH_OUTCOME_UNKNOWN");
      return { credential: null, code: "X_REFRESH_OUTCOME_UNKNOWN" };
    }
    const generation = c.generation + 1,
      leaseUntil = Date.now() + 60000;
    await ctx.db.patch(c._id, {
      generation,
      leaseUntil,
      cleanAfter: leaseUntil,
    });
    return { credential: { ...c, generation, leaseUntil }, code: null };
  },
});
export const refreshComplete = workspaceInternalMutation({
  args: {
    accountId: v.id("socialAccounts"),
    generation: v.number(),
    envelope,
    expiresAt: v.number(),
    scopes: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const c = await gate(ctx, ctx.workspace._id, a.accountId);
    if (
      c.generation !== a.generation ||
      !c.leaseUntil ||
      c.leaseUntil <= Date.now()
    )
      throw new ConvexError("X_CONNECTION_CHANGED");
    await ctx.db.patch(c._id, {
      envelope: a.envelope,
      expiresAt: a.expiresAt,
      scopes: a.scopes,
      leaseUntil: 0,
      cleanAfter: Number.MAX_SAFE_INTEGER,
    });
    const target = await account(ctx, ctx.workspace._id, a.accountId);
    await ctx.db.patch(target._id, {
      xEvidence: {
        ...target.xEvidence!,
        scopes: a.scopes,
        textScopeEligible: a.scopes.includes("tweet.write"),
        mediaScopeEligible: a.scopes.includes("media.write"),
      },
    });
    return null;
  },
});
export const refreshFailed = internalMutation({
  args: {
    ...accountArgs,
    generation: v.number(),
    code: v.union(
      v.literal("X_REAUTH_REQUIRED"),
      v.literal("X_REFRESH_OUTCOME_UNKNOWN"),
      v.literal("X_ENCRYPTION_KEY_UNAVAILABLE"),
      v.literal("X_CREDENTIAL_UNREADABLE"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await credential(ctx, a.accountId);
    if (c && c.workspaceId === a.workspaceId && c.generation === a.generation)
      await block(ctx, c, a.code);
    return null;
  },
});
export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const states = await ctx.db
      .query("xOAuthStates")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", Date.now()))
      .take(50);
    for (const s of states) await ctx.db.delete(s._id);
    const due = await ctx.db
      .query("xCredentials")
      .withIndex("by_cleanAfter", (q) => q.lte("cleanAfter", Date.now()))
      .take(50);
    for (const c of due) await block(ctx, c, "X_REFRESH_OUTCOME_UNKNOWN");
    return null;
  },
});

// The future publisher can request credentials only for an exact authorized in-flight schedule.
export const scheduleSource = internalQuery({
  args: {
    scheduleId: v.id("schedules"),
    generation: v.number(),
    operation: v.union(v.literal("text"), v.literal("media")),
  },
  returns: credentialDoc,
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.scheduleId);
    if (!s || s.generation !== a.generation || s.state !== "publishing")
      throw new ConvexError("X_SCHEDULE_CHANGED");
    const actor = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", s.actorId).eq("workspaceId", s.workspaceId),
      )
      .unique();
    if (!actor || !["Owner", "Admin"].includes(actor.role))
      throw new ConvexError("SCHEDULER_AUTHORITY_CHANGED");
    await checkApproval(
      ctx,
      s.workspaceId,
      s.versionId,
      s.accountId,
      s.approvalId,
    );
    await checkAccountConnection(ctx, s);
    const c = await gate(ctx, s.workspaceId, s.accountId);
    if (
      !c.scopes.includes(
        a.operation === "media" ? "media.write" : "tweet.write",
      )
    )
      throw new ConvexError("X_SCOPE_REQUIRED");
    if (c.leaseUntil || c.expiresAt <= Date.now() + 30000)
      throw new ConvexError("X_REAUTH_REQUIRED");
    return c;
  },
});
