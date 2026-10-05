import { ConvexError, v } from "convex/values";
import type { QueryCtx, MutationCtx } from "../../_generated/server";
import { internalQuery, internalMutation } from "../../_generated/server";
import type { Id, Doc } from "../../_generated/dataModel";
import { barrierSequence } from "./barriers";
import {
  workspaceQuery,
  workspaceMutation,
  workspaceInternalQuery,
  workspaceInternalMutation,
  requireWorkspace,
  requireRole,
  requireReference,
  requireActiveWorkspace,
} from "../../lib/authorization";
import {
  connectionDoc,
  stateDoc,
  repository,
  envelope,
  publicRepo,
  publicConnection,
  PROOF_TTL,
} from "./fields";
async function manage(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const a = await requireWorkspace(ctx, workspaceId);
  requireRole(a.membership, ["Owner", "Admin"]);
  if (a.user.activeWorkspaceId !== workspaceId)
    throw new ConvexError("GITHUB_WORKSPACE_CHANGED");
  return a;
}
async function connection(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("githubConnections")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .unique();
}
async function connected(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const c = await connection(ctx, workspaceId);
  if (!c || c.status !== "connected" || !c.envelope)
    throw new ConvexError("GITHUB_REAUTH_REQUIRED");
  if (
    (await barrierSequence(ctx, [`user:${c.identity}`])) >
    (c.authorizedSequence ?? 0)
  )
    throw new ConvexError("GITHUB_AUTHORIZATION_REVOKED");
  return c;
}
async function selected(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const rows = await ctx.db
    .query("githubRepositories")
    .withIndex("by_workspaceId_and_selected", (q) =>
      q.eq("workspaceId", workspaceId).eq("selected", true),
    )
    .take(101);
  if (rows.length > 100) throw new ConvexError("GITHUB_SELECTION_CAPACITY");
  return rows;
}
async function actorValid(ctx: QueryCtx, c: Doc<"githubConnections">) {
  const role = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", c.actorId).eq("workspaceId", c.workspaceId),
    )
    .unique();
  return Boolean(role && ["Owner", "Admin"].includes(role.role));
}
function authorized(
  r: Doc<"githubRepositories">,
  c: Doc<"githubConnections"> | null,
) {
  return Boolean(
    r.selected &&
    r.access &&
    c?.status === "connected" &&
    c.envelope &&
    c.generation === r.connectionGeneration &&
    r.proofExpiresAt > Date.now() &&
    c.installations.some((i) => i.id === r.installationId),
  );
}
function projection(
  r: Doc<"githubRepositories">,
  c: Doc<"githubConnections"> | null,
) {
  return {
    _id: r._id,
    providerId: r.providerId,
    installationId: r.installationId,
    fullName: r.fullName,
    private: r.private,
    access: r.access,
    monitoring: r.monitoring,
    content: r.content,
    communicableContext: r.communicableContext,
    generation: r.generation,
    verifiedAt: r.verifiedAt,
    proofExpiresAt: r.proofExpiresAt,
    authorized: authorized(r, c),
    purposeAt: r.purposeAt,
  };
}
const viewReturns = v.object({
  connection: v.union(publicConnection, v.null()),
  repositories: v.array(publicRepo),
});
async function view(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  settings: boolean,
) {
  const c = await connection(ctx, workspaceId),
    valid = c ? await actorValid(ctx, c) : false;
  const rows = await selected(ctx, workspaceId);
  const safe = new Set<string>();
  for (const r of rows)
    if (c && valid && (await proofCurrent(ctx, r, c))) safe.add(r._id);
  return {
    connection: c
      ? {
          status: c.status,
          identity: c.identity,
          login: c.login,
          installations: settings ? c.installations : [],
          inventoryLimited: settings ? c.inventoryLimited : false,
          generation: c.generation,
          updatedAt: c.updatedAt,
          errorCode: c.errorCode ?? null,
        }
      : null,
    repositories: rows
      .map((r) => projection(r, safe.has(r._id) ? c : null))
      .filter((r) => settings || r.authorized),
  };
}
export const list = workspaceQuery({
  args: {},
  returns: viewReturns,
  handler: async (ctx) => view(ctx, ctx.workspace._id, false),
});
export const settings = workspaceQuery({
  args: {},
  returns: viewReturns,
  handler: async (ctx) => {
    await manage(ctx, ctx.workspace._id);
    return view(ctx, ctx.workspace._id, true);
  },
});
export const authorize = workspaceQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await manage(ctx, ctx.workspace._id);
    return null;
  },
});
export const reserve = workspaceInternalMutation({
  args: { digest: v.string(), verifier: envelope, redirectUri: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const c = await connection(ctx, ctx.workspace._id),
      generation = (c?.generation ?? 0) + 1;
    const fields = {
      actorId: ctx.user._id,
      generation,
      status: "reauth_required" as const,
      envelope: undefined,
      leaseUntil: 0,
      updatedAt: Date.now(),
    };
    if (c) await ctx.db.patch(c._id, fields);
    else
      await ctx.db.insert("githubConnections", {
        workspaceId: ctx.workspace._id,
        ...fields,
        credentialGeneration: 0,
        syncSequence: 0,
        identity: "",
        login: "",
        installations: [],
        inventoryLimited: false,
        expiresAt: 0,
        refreshExpiresAt: 0,
      });
    const states = await ctx.db
      .query("githubOAuthStates")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .take(10);
    for (const s of states) await ctx.db.delete(s._id);
    await ctx.db.insert("githubOAuthStates", {
      workspaceId: ctx.workspace._id,
      userId: ctx.user._id,
      digest: a.digest,
      generation,
      verifier: a.verifier,
      redirectUri: a.redirectUri,
      expiresAt: Date.now() + 600000,
      status: "pending",
      revocationSequence: await barrierSequence(ctx, ["*"]),
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
        .query("githubOAuthStates")
        .withIndex("by_digest", (q) => q.eq("digest", a.digest))
        .unique(),
      c = await connection(ctx, ctx.workspace._id);
    if (
      !s ||
      s.workspaceId !== ctx.workspace._id ||
      s.userId !== ctx.user._id ||
      s.status !== "pending" ||
      s.expiresAt <= Date.now() ||
      s.generation !== c?.generation ||
      !s.verifier
    )
      throw new ConvexError("GITHUB_OAUTH_STATE_INVALID");
    await ctx.db.patch(s._id, {
      status: a.denied ? "denied" : "claimed",
      verifier: undefined,
    });
    return s;
  },
});
export const complete = workspaceInternalMutation({
  args: {
    stateId: v.id("githubOAuthStates"),
    identity: v.string(),
    login: v.string(),
    installations: v.array(
      v.object({
        id: v.string(),
        owner: v.string(),
        kind: v.union(v.literal("User"), v.literal("Organization")),
      }),
    ),
    inventoryLimited: v.boolean(),
    envelope,
    expiresAt: v.number(),
    refreshExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const s = await ctx.db.get(a.stateId),
      c = await connection(ctx, ctx.workspace._id);
    if (
      !s ||
      s.workspaceId !== ctx.workspace._id ||
      s.userId !== ctx.user._id ||
      s.status !== "claimed" ||
      s.expiresAt <= Date.now() ||
      !c ||
      c.generation !== s.generation
    )
      throw new ConvexError("GITHUB_CONNECTION_CHANGED");
    if (
      (await barrierSequence(ctx, [`user:${a.identity}`])) >
      (s.revocationSequence ?? 0)
    )
      throw new ConvexError("GITHUB_AUTHORIZATION_REVOKED");
    await ctx.db.patch(c._id, {
      identity: a.identity,
      login: a.login,
      installations: a.installations,
      inventoryLimited: a.inventoryLimited,
      envelope: a.envelope,
      expiresAt: a.expiresAt,
      refreshExpiresAt: a.refreshExpiresAt,
      status: "connected",
      authorizedSequence: s.revocationSequence ?? 0,
      credentialGeneration: c.credentialGeneration + 1,
      errorCode: undefined,
      updatedAt: Date.now(),
    });
    for (const r of await selected(ctx, ctx.workspace._id))
      await ctx.db.patch(r._id, {
        selected: c.identity === a.identity,
        access: false,
        monitoring: false,
        content: false,
        generation: r.generation + 1,
        proofExpiresAt: 0,
        updatedAt: Date.now(),
      });
    await ctx.db.patch(s._id, { status: "connected" });
    return null;
  },
});
export const failState = workspaceInternalMutation({
  args: { stateId: v.id("githubOAuthStates") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.stateId);
    if (s?.workspaceId === ctx.workspace._id && s.status === "claimed")
      await ctx.db.patch(s._id, { status: "failed", verifier: undefined });
    return null;
  },
});
export const credential = workspaceInternalQuery({
  args: {},
  returns: connectionDoc,
  handler: async (ctx) => {
    await manage(ctx, ctx.workspace._id);
    const c = await connected(ctx, ctx.workspace._id);
    if (!(await actorValid(ctx, c)))
      throw new ConvexError("GITHUB_REAUTH_REQUIRED");
    return c;
  },
});
export const beginDiscovery = workspaceInternalMutation({
  args: {
    generation: v.number(),
    credentialGeneration: v.number(),
    installationId: v.string(),
    selectId: v.optional(v.string()),
  },
  returns: v.object({
    syncSequence: v.number(),
    observed: v.array(
      v.object({ id: v.id("githubRepositories"), generation: v.number() }),
    ),
  }),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const c = await connected(ctx, ctx.workspace._id);
    if (
      c.generation !== a.generation ||
      c.credentialGeneration !== a.credentialGeneration
    )
      throw new ConvexError("GITHUB_CONNECTION_CHANGED");
    const rows = (await selected(ctx, ctx.workspace._id)).filter(
      (r) => r.installationId === a.installationId,
    );
    if (a.selectId) {
      const old = await ctx.db
        .query("githubRepositories")
        .withIndex("by_workspaceId_and_providerId", (q) =>
          q.eq("workspaceId", ctx.workspace._id).eq("providerId", a.selectId!),
        )
        .unique();
      if (old && !rows.some((r) => r._id === old._id)) rows.push(old);
    }
    const syncSequence = c.syncSequence + 1;
    await ctx.db.patch(c._id, {
      syncSequence,
      discoverySequence: await barrierSequence(ctx, ["*"]),
    });
    return {
      syncSequence,
      observed: rows.map((r) => ({ id: r._id, generation: r.generation })),
    };
  },
});
export const verify = workspaceInternalMutation({
  args: {
    generation: v.number(),
    credentialGeneration: v.number(),
    syncSequence: v.number(),
    observed: v.array(
      v.object({ id: v.id("githubRepositories"), generation: v.number() }),
    ),
    installationId: v.string(),
    repositories: v.array(repository),
    complete: v.boolean(),
    selectId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const c = await connected(ctx, ctx.workspace._id);
    if (
      c.generation !== a.generation ||
      c.credentialGeneration !== a.credentialGeneration ||
      c.syncSequence !== a.syncSequence ||
      c.leaseUntil ||
      c.expiresAt <= Date.now() + 30000 ||
      !c.installations.some((i) => i.id === a.installationId)
    )
      throw new ConvexError("GITHUB_CONNECTION_CHANGED");
    const keys = [
      `user:${c.identity}`,
      `install:${a.installationId}`,
      ...(a.selectId ? [`repo:${a.installationId}:${a.selectId}`] : []),
    ];
    for (const seen of a.observed) {
      const old = await ctx.db.get(seen.id);
      if (
        !old ||
        old.workspaceId !== ctx.workspace._id ||
        old.generation !== seen.generation
      )
        throw new ConvexError("GITHUB_SOURCE_CHANGED");
      keys.push(`repo:${old.installationId}:${old.providerId}`);
    }
    if ((await barrierSequence(ctx, keys)) > (c.discoverySequence ?? 0))
      throw new ConvexError("GITHUB_SOURCE_CHANGED");
    const rows = await selected(ctx, ctx.workspace._id);
    for (const r of rows.filter((r) => r.installationId === a.installationId)) {
      const fresh = a.repositories.find((x) => x.providerId === r.providerId);
      if (fresh)
        await ctx.db.patch(r._id, {
          ...fresh,
          ...(fresh.private !== r.private
            ? {
                monitoring: false,
                content: false,
                generation: r.generation + 1,
              }
            : {}),
          connectionGeneration: c.generation,
          verifiedAt: Date.now(),
          verifiedSequence: c.discoverySequence ?? 0,
          proofExpiresAt: Date.now() + PROOF_TTL,
          updatedAt: Date.now(),
        });
      else if (r.access || r.monitoring || r.content || r.proofExpiresAt !== 0)
        await ctx.db.patch(r._id, {
          access: false,
          monitoring: false,
          content: false,
          proofExpiresAt: 0,
          generation: r.generation + 1,
          updatedAt: Date.now(),
        });
    }
    if (a.selectId) {
      const fresh = a.repositories.find((r) => r.providerId === a.selectId);
      if (!fresh) throw new ConvexError("GITHUB_REPOSITORY_DENIED");
      const old = await ctx.db
        .query("githubRepositories")
        .withIndex("by_workspaceId_and_providerId", (q) =>
          q.eq("workspaceId", ctx.workspace._id).eq("providerId", a.selectId!),
        )
        .unique();
      if ((!old || !old.selected) && rows.length >= 100)
        throw new ConvexError("GITHUB_SELECTION_CAPACITY");
      const fields = {
        ...fresh,
        selected: true,
        access: true,
        monitoring: false,
        content: false,
        communicableContext: old?.communicableContext ?? "",
        purposeActorId: ctx.user._id,
        purposeAt: Date.now(),
        purposeVersion: 1 as const,
        connectionGeneration: c.generation,
        generation: (old?.generation ?? 0) + 1,
        verifiedAt: Date.now(),
        verifiedSequence: c.discoverySequence ?? 0,
        proofExpiresAt: Date.now() + PROOF_TTL,
        updatedAt: Date.now(),
      };
      if (old) await ctx.db.patch(old._id, fields);
      else
        await ctx.db.insert("githubRepositories", {
          workspaceId: ctx.workspace._id,
          ...fields,
        });
    }
    return null;
  },
});
export const configure = workspaceMutation({
  args: {
    repositoryId: v.id("githubRepositories"),
    expectedGeneration: v.number(),
    access: v.boolean(),
    monitoring: v.boolean(),
    content: v.boolean(),
    communicableContext: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const r = await ctx.db.get(a.repositoryId);
    requireReference(ctx.workspace._id, r);
    if (!r!.selected || r!.generation !== a.expectedGeneration)
      throw new ConvexError("GITHUB_SOURCE_CHANGED");
    if (
      a.communicableContext.length > 4000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(a.communicableContext)
    )
      throw new ConvexError("GITHUB_CONTEXT_INVALID");
    if (
      (a.monitoring && !a.access) ||
      (a.content && (!a.access || !a.monitoring))
    )
      throw new ConvexError("GITHUB_PURPOSE_REQUIRED");
    const c = await connection(ctx, ctx.workspace._id);
    if (
      (a.access || a.monitoring || a.content) &&
      (!authorized(r!, c) ||
        !c ||
        !(await actorValid(ctx, c)) ||
        !(await proofCurrent(ctx, r!, c)))
    )
      throw new ConvexError("GITHUB_SOURCE_PROOF_EXPIRED");
    await ctx.db.patch(r!._id, {
      access: a.access,
      monitoring: a.monitoring,
      content: a.content,
      communicableContext: a.communicableContext.trim(),
      purposeActorId: ctx.user._id,
      purposeAt: Date.now(),
      generation: r!.generation + 1,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const remove = workspaceMutation({
  args: {
    repositoryId: v.id("githubRepositories"),
    expectedGeneration: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const r = await ctx.db.get(a.repositoryId);
    requireReference(ctx.workspace._id, r);
    if (r!.generation !== a.expectedGeneration)
      throw new ConvexError("GITHUB_SOURCE_CHANGED");
    await ctx.db.patch(r!._id, {
      selected: false,
      access: false,
      monitoring: false,
      content: false,
      generation: r!.generation + 1,
      proofExpiresAt: 0,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const disconnect = workspaceMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await manage(ctx, ctx.workspace._id);
    const c = await connection(ctx, ctx.workspace._id);
    if (c)
      await ctx.db.patch(c._id, {
        status: "disconnected",
        envelope: undefined,
        generation: c.generation + 1,
        credentialGeneration: c.credentialGeneration + 1,
        installations: [],
        leaseUntil: 0,
        errorCode: undefined,
        updatedAt: Date.now(),
      });
    for (const r of await selected(ctx, ctx.workspace._id))
      await ctx.db.patch(r._id, {
        access: false,
        monitoring: false,
        content: false,
        proofExpiresAt: 0,
        generation: r.generation + 1,
        updatedAt: Date.now(),
      });
    for (const s of await ctx.db
      .query("githubOAuthStates")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .take(10))
      await ctx.db.delete(s._id);
    return null;
  },
});
export const refreshClaim = workspaceInternalMutation({
  args: {},
  returns: v.object({
    connection: v.union(connectionDoc, v.null()),
    code: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    await manage(ctx, ctx.workspace._id);
    const c = await connected(ctx, ctx.workspace._id);
    if (c.leaseUntil) {
      if (c.leaseUntil > Date.now())
        return { connection: null, code: "GITHUB_REFRESH_IN_PROGRESS" };
      await ctx.db.patch(c._id, {
        status: "reauth_required",
        envelope: undefined,
        leaseUntil: 0,
        credentialGeneration: c.credentialGeneration + 1,
        errorCode: "GITHUB_REFRESH_OUTCOME_UNKNOWN",
      });
      return { connection: null, code: "GITHUB_REFRESH_OUTCOME_UNKNOWN" };
    }
    const fields = {
      credentialGeneration: c.credentialGeneration + 1,
      leaseUntil: Date.now() + 60000,
    };
    await ctx.db.patch(c._id, fields);
    return { connection: { ...c, ...fields }, code: null };
  },
});
export const refreshed = workspaceInternalMutation({
  args: {
    generation: v.number(),
    credentialGeneration: v.number(),
    envelope,
    expiresAt: v.number(),
    refreshExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const c = await connected(ctx, ctx.workspace._id);
    if (
      c.generation !== a.generation ||
      c.credentialGeneration !== a.credentialGeneration ||
      !c.leaseUntil ||
      c.leaseUntil <= Date.now()
    )
      throw new ConvexError("GITHUB_CONNECTION_CHANGED");
    await ctx.db.patch(c._id, {
      envelope: a.envelope,
      expiresAt: a.expiresAt,
      refreshExpiresAt: a.refreshExpiresAt,
      leaseUntil: 0,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const block = workspaceInternalMutation({
  args: {
    generation: v.number(),
    credentialGeneration: v.number(),
    code: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await connection(ctx, ctx.workspace._id);
    if (
      c &&
      c.generation === a.generation &&
      c.credentialGeneration === a.credentialGeneration
    )
      await ctx.db.patch(c._id, {
        status: "reauth_required",
        envelope: undefined,
        leaseUntil: 0,
        credentialGeneration: c.credentialGeneration + 1,
        errorCode: a.code,
        updatedAt: Date.now(),
      });
    return null;
  },
});
// Called before enqueue AND before committing derived work. Background authority is not the actor's selected UI workspace.
export async function checkSource(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  repositoryId: Id<"githubRepositories">,
  generation: number,
  purpose: "monitoring" | "content",
) {
  requireActiveWorkspace(await ctx.db.get(workspaceId));
  const r = await ctx.db.get(repositoryId),
    c = await connection(ctx, workspaceId);
  if (
    !r ||
    r.workspaceId !== workspaceId ||
    r.generation !== generation ||
    !authorized(r, c) ||
    !r.monitoring ||
    (purpose === "content" && !r.content) ||
    !c ||
    !(await actorValid(ctx, c))
  )
    throw new ConvexError("GITHUB_SOURCE_DISABLED");
  if (!(await proofCurrent(ctx, r, c)))
    throw new ConvexError("GITHUB_SOURCE_DISABLED");
  const actor = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", r.purposeActorId).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!actor || !["Owner", "Admin"].includes(actor.role))
    throw new ConvexError("GITHUB_SOURCE_DISABLED");
  return r;
}
async function proofCurrent(
  ctx: QueryCtx,
  r: Doc<"githubRepositories">,
  c: Doc<"githubConnections">,
) {
  const userRevoked = await barrierSequence(ctx, [`user:${c.identity}`]);
  const sourceRevoked = await barrierSequence(ctx, [
    `install:${r.installationId}`,
    `repo:${r.installationId}:${r.providerId}`,
  ]);
  return (
    (c.authorizedSequence ?? 0) >= userRevoked &&
    (r.verifiedSequence ?? 0) >= sourceRevoked
  );
}
export const source = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    repositoryId: v.id("githubRepositories"),
    generation: v.number(),
    purpose: v.union(v.literal("monitoring"), v.literal("content")),
  },
  returns: v.object({
    ...repository.fields,
    communicableContext: v.string(),
    purposeAt: v.number(),
    purposeVersion: v.literal(1),
  }),
  handler: async (ctx, a) => {
    const r = await checkSource(
      ctx,
      a.workspaceId,
      a.repositoryId,
      a.generation,
      a.purpose,
    );
    return {
      providerId: r.providerId,
      installationId: r.installationId,
      fullName: r.fullName,
      private: r.private,
      communicableContext: r.communicableContext,
      purposeAt: r.purposeAt,
      purposeVersion: r.purposeVersion,
    };
  },
});
export const installationProof = workspaceInternalMutation({
  args: {
    generation: v.number(),
    credentialGeneration: v.number(),
    syncSequence: v.number(),
    installations: v.array(
      v.object({
        id: v.string(),
        owner: v.string(),
        kind: v.union(v.literal("User"), v.literal("Organization")),
      }),
    ),
    inventoryLimited: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await manage(ctx, ctx.workspace._id);
    const c = await connected(ctx, ctx.workspace._id);
    if (
      c.generation !== a.generation ||
      c.credentialGeneration !== a.credentialGeneration ||
      c.syncSequence !== a.syncSequence
    )
      throw new ConvexError("GITHUB_CONNECTION_CHANGED");
    await ctx.db.patch(c._id, {
      installations: a.installations,
      inventoryLimited: a.inventoryLimited,
      updatedAt: Date.now(),
    });
    for (const r of await selected(ctx, ctx.workspace._id)) {
      if (
        !a.installations.some((i) => i.id === r.installationId) &&
        (r.access || r.monitoring || r.content || r.proofExpiresAt !== 0)
      )
        await ctx.db.patch(r._id, {
          access: false,
          monitoring: false,
          content: false,
          proofExpiresAt: 0,
          generation: r.generation + 1,
          updatedAt: Date.now(),
        });
    }
    return null;
  },
});

export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for (const s of await ctx.db
      .query("githubOAuthStates")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(50))
      await ctx.db.delete(s._id);
    for (const c of await ctx.db
      .query("githubConnections")
      .withIndex("by_leaseUntil", (q) =>
        q.gt("leaseUntil", 0).lte("leaseUntil", now),
      )
      .take(50))
      await ctx.db.patch(c._id, {
        status: "reauth_required",
        envelope: undefined,
        credentialGeneration: c.credentialGeneration + 1,
        leaseUntil: 0,
        errorCode: "GITHUB_REFRESH_OUTCOME_UNKNOWN",
        updatedAt: now,
      });
    return null;
  },
});
