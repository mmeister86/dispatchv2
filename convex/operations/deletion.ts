import { ConvexError, v, type Infer } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { authComponent } from "../auth";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  requireIdentity,
  requireUser,
  requireWorkspace,
  requireRole,
  requireActiveUser,
} from "../lib/authorization";
const choice = v.object({
  workspaceId: v.id("workspaces"),
  expectedTeamRevision: v.number(),
});
const jobStatus = v.object({
  id: v.id("deletionJobs"),
  scope: v.union(v.literal("account"), v.literal("workspace")),
  state: v.union(
    v.literal("running"),
    v.literal("waiting"),
    v.literal("blocked"),
    v.literal("complete"),
  ),
  phase: v.union(
    v.literal("fence"),
    v.literal("stop"),
    v.literal("components"),
    v.literal("objects"),
    v.literal("rows"),
    v.literal("auth"),
    v.literal("verify"),
    v.literal("complete"),
  ),
  processed: v.number(),
  updatedAt: v.number(),
  retentionDays: v.literal(30),
  reason: v.union(
    v.null(),
    v.literal("in-flight"),
    v.literal("external-outcome"),
    v.literal("object-cleanup"),
    v.literal("component-proof"),
    v.literal("scope-discovery"),
    v.literal("retry-required"),
  ),
  canResume: v.boolean(),
});
function present(j: Doc<"deletionJobs">) {
  return {
    id: j._id,
    scope: j.scope,
    state: j.state,
    phase: j.phase,
    processed: j.processed,
    updatedAt: j.updatedAt,
    retentionDays: 30 as const,
    reason:
      j.state === "complete"
        ? null
        : (j.reason ??
          (j.state === "blocked" ? ("scope-discovery" as const) : null)),
    canResume: j.state === "blocked" || j.state === "waiting",
  };
}
function revision(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ConvexError("DELETION_COMMAND_INVALID");
}
async function roster(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const rows = await ctx.db
    .query("memberships")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .take(101);
  if (rows.length > 100)
    throw new ConvexError("MEMBER_LIMIT_REQUIRES_PAGINATION");
  return rows;
}
async function ownMemberships(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const rows = await ctx.db
    .query("memberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(101);
  if (rows.length > 100)
    throw new ConvexError("WORKSPACE_LIMIT_REQUIRES_PAGINATION");
  return rows;
}
async function soleOwner(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
) {
  for (const m of await roster(ctx, workspaceId)) {
    if (m.role !== "Owner" || m.userId === actorId) continue;
    const other = await ctx.db.get(m.userId);
    if (other && (!other.lifecycle || other.lifecycle === "active"))
      return false;
  }
  return true;
}
export const workspacePreview = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    teamRevision: v.number(),
    memberCount: v.number(),
    canDelete: v.boolean(),
  }),
  handler: async (ctx, a) => {
    const proof = await requireWorkspace(ctx, a.workspaceId);
    requireRole(proof.membership, ["Owner"]);
    return {
      workspaceId: a.workspaceId,
      name: proof.workspace.name,
      teamRevision: proof.workspace.teamRevision ?? 0,
      memberCount: (await roster(ctx, a.workspaceId)).length,
      canDelete: true,
    };
  },
});
export const accountPreview = query({
  args: {},
  returns: v.object({
    workspaces: v.array(
      v.object({
        workspaceId: v.id("workspaces"),
        name: v.string(),
        role: v.union(
          v.literal("Owner"),
          v.literal("Admin"),
          v.literal("Editor"),
          v.literal("Viewer"),
        ),
        teamRevision: v.number(),
        soleOwner: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const workspaces = [];
    for (const m of await ownMemberships(ctx, user._id)) {
      const w = await ctx.db.get(m.workspaceId);
      if (!w) throw new ConvexError("WORKSPACE_ACCESS_DENIED");
      workspaces.push({
        workspaceId: w._id,
        name: w.name,
        role: m.role,
        teamRevision: w.teamRevision ?? 0,
        soleOwner:
          m.role === "Owner" && (await soleOwner(ctx, w._id, user._id)),
      });
    }
    return { workspaces };
  },
});
// Preparation is internal until admission and a working deletion executor exist.
async function authority(ctx: MutationCtx, key: string, intent: string) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key))
    throw new ConvexError("DELETION_COMMAND_INVALID");
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity._id))
    .unique();
  if (!user) throw new ConvexError("PROFILE_NOT_INITIALIZED");
  const old = await ctx.db
    .query("deletionJobs")
    .withIndex("by_actorId_and_commandKey", (q) =>
      q.eq("actorId", user._id).eq("commandKey", key),
    )
    .unique();
  if (old) {
    if (old.authId !== identity._id || old.intent !== intent)
      throw new ConvexError("DELETION_COMMAND_CONFLICT");
    return { user, identity, old };
  }
  requireActiveUser(user);
  return { user, identity, old: null };
}
async function available(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const jobs = await ctx.db
    .query("deletionJobs")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .take(101);
  if (jobs.length > 100 || jobs.some((j) => j.state !== "complete"))
    throw new ConvexError("DELETION_TARGET_BUSY");
}
async function insert(
  ctx: MutationCtx,
  user: Doc<"users">,
  commandKey: string,
  intent: string,
  scope: "workspace" | "account",
  choices: { workspaceId: Id<"workspaces">; expectedTeamRevision: number }[],
) {
  const now = Date.now();
  const id = await ctx.db.insert("deletionJobs", {
    scope,
    actorId: user._id,
    authId: user.authId,
    workspaceId: scope === "workspace" ? choices[0].workspaceId : undefined,
    userId: scope === "account" ? user._id : undefined,
    deleteWorkspaces: choices,
    commandKey,
    intent,
    state: "blocked",
    phase: "fence",
    processed: 0,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    retentionUntil: now + 30 * 86400000,
  });
  return present((await ctx.db.get(id))!);
}
export const prepareWorkspace = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    expectedTeamRevision: v.number(),
    commandKey: v.string(),
    confirmation: v.literal("delete-workspace"),
  },
  returns: jobStatus,
  handler: async (ctx, a) => {
    revision(a.expectedTeamRevision);
    const intent = JSON.stringify([
      "workspace",
      a.workspaceId,
      a.expectedTeamRevision,
    ]);
    const { user, old } = await authority(ctx, a.commandKey, intent);
    if (old) return present(old);
    await available(ctx, a.workspaceId);
    const proof = await requireWorkspace(ctx, a.workspaceId, user);
    requireRole(proof.membership, ["Owner"]);
    if ((proof.workspace.teamRevision ?? 0) !== a.expectedTeamRevision)
      throw new ConvexError("TEAM_REVISION_CONFLICT");
    await ctx.db.patch(a.workspaceId, { lifecycle: "deleting" });
    return insert(ctx, user, a.commandKey, intent, "workspace", [
      {
        workspaceId: a.workspaceId,
        expectedTeamRevision: a.expectedTeamRevision,
      },
    ]);
  },
});
export const prepareAccount = internalMutation({
  args: {
    commandKey: v.string(),
    confirmation: v.literal("delete-account"),
    deleteWorkspaces: v.array(choice),
  },
  returns: jobStatus,
  handler: async (ctx, a) => {
    if (a.deleteWorkspaces.length > 100)
      throw new ConvexError("WORKSPACE_LIMIT_REQUIRES_PAGINATION");
    for (const c of a.deleteWorkspaces) revision(c.expectedTeamRevision);
    const choices = [...a.deleteWorkspaces].sort((a, b) =>
      a.workspaceId.localeCompare(b.workspaceId),
    );
    if (new Set(choices.map((c) => c.workspaceId)).size !== choices.length)
      throw new ConvexError("DELETION_SELECTION_INVALID");
    const intent = JSON.stringify(["account", choices]);
    const { user, old } = await authority(ctx, a.commandKey, intent);
    if (old) return present(old);
    const memberships = await ownMemberships(ctx, user._id);
    for (const c of choices) {
      const m = memberships.find((m) => m.workspaceId === c.workspaceId);
      if (
        !m ||
        m.role !== "Owner" ||
        !(await soleOwner(ctx, c.workspaceId, user._id))
      )
        throw new ConvexError("DELETION_SELECTION_INVALID");
      await available(ctx, c.workspaceId);
      const proof = await requireWorkspace(ctx, c.workspaceId, user);
      if ((proof.workspace.teamRevision ?? 0) !== c.expectedTeamRevision)
        throw new ConvexError("TEAM_REVISION_CONFLICT");
    }
    for (const m of memberships) {
      const w = await ctx.db.get(m.workspaceId);
      if (!w || (w.lifecycle && w.lifecycle !== "active"))
        throw new ConvexError("WORKSPACE_INACTIVE");
      if (
        m.role === "Owner" &&
        (await soleOwner(ctx, m.workspaceId, user._id)) &&
        !choices.some((c) => c.workspaceId === m.workspaceId)
      )
        throw new ConvexError("SOLE_OWNER_REQUIRES_SELECTION");
      // Read/write the team revision so two departing owners cannot both retain a stale owner proof.
      await ctx.db.patch(w._id, { teamRevision: (w.teamRevision ?? 0) + 1 });
    }
    for (const c of choices)
      await ctx.db.patch(c.workspaceId, { lifecycle: "deleting" });
    await ctx.db.patch(user._id, { lifecycle: "deleting" });
    return insert(ctx, user, a.commandKey, intent, "account", choices);
  },
});
export const status = query({
  args: { jobId: v.id("deletionJobs") },
  returns: jobStatus,
  handler: async (ctx, a) => {
    const authId = await statusIdentity(ctx);
    const job = await ctx.db.get(a.jobId);
    if (!job || job.authId !== authId)
      throw new ConvexError("DELETION_ACCESS_DENIED");
    return present(job);
  },
});

async function statusIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await authComponent.getAuthUser(ctx);
  if (!identity.emailVerified) throw new ConvexError("EMAIL_NOT_VERIFIED");
  const claims = await ctx.auth.getUserIdentity();
  if (!claims || typeof claims.sessionId !== "string")
    throw new ConvexError("DELETION_ACCESS_DENIED");
  const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [{ field: "_id", value: claims.sessionId }],
  });
  const admission = await ctx.db
    .query("authRoots")
    .withIndex("by_authId", (q) => q.eq("authId", identity._id))
    .unique();
  if (
    !session ||
    session.userId !== identity._id ||
    session.expiresAt <= Date.now() ||
    admission?.neverAdmitted
  )
    throw new ConvexError("DELETION_ACCESS_DENIED");
  return identity._id;
}

async function start(
  ctx: MutationCtx,
  id: Id<"deletionJobs">,
): Promise<Infer<typeof jobStatus>> {
  const job = (await ctx.db.get(id))!;
  if (job.state === "complete" || job.state === "running") return present(job);
  if (job.scope === "account" && job.phase === "fence")
    await ctx.runMutation(
      internal.operations.authAdmission.fencePreparedAccount,
      { jobId: id },
    );
  await ctx.db.patch(id, {
    state: "running",
    phase: job.phase === "fence" ? "stop" : job.phase,
    reason: undefined,
    retryCount: 0,
    updatedAt: Date.now(),
    revision: job.revision + 1,
  });
  await ctx.scheduler.runAfter(0, internal.operations.deletionExecutor.step, {
    jobId: id,
    revision: job.revision + 1,
  });
  return present((await ctx.db.get(id))!);
}
async function replay(ctx: MutationCtx, commandKey: string, intent: string) {
  const authId = await statusIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authId))
    .unique();
  if (!user) return null;
  const job = await ctx.db
    .query("deletionJobs")
    .withIndex("by_actorId_and_commandKey", (q) =>
      q.eq("actorId", user._id).eq("commandKey", commandKey),
    )
    .unique();
  if (job && (job.authId !== authId || job.intent !== intent))
    throw new ConvexError("DELETION_COMMAND_CONFLICT");
  return job;
}
export const beginWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    expectedTeamRevision: v.number(),
    commandKey: v.string(),
    confirmation: v.literal("delete-workspace"),
  },
  returns: jobStatus,
  handler: async (ctx, args): Promise<Infer<typeof jobStatus>> => {
    const eligibility = await ctx.runQuery(
      internal.operations.authAdmission.eligibility,
      {},
    );
    if (!eligibility.eligible) throw new ConvexError("FIXED_GUARD_REQUIRED");
    const old = await replay(
      ctx,
      args.commandKey,
      JSON.stringify([
        "workspace",
        args.workspaceId,
        args.expectedTeamRevision,
      ]),
    );
    if (old) return present(old);
    const result = await ctx.runMutation(
      internal.operations.deletion.prepareWorkspace,
      args,
    );
    return start(ctx, result.id);
  },
});
export const beginAccount = mutation({
  args: {
    commandKey: v.string(),
    confirmation: v.literal("delete-account"),
    deleteWorkspaces: v.array(choice),
  },
  returns: jobStatus,
  handler: async (ctx, args): Promise<Infer<typeof jobStatus>> => {
    const eligibility = await ctx.runQuery(
      internal.operations.authAdmission.eligibility,
      {},
    );
    if (!eligibility.eligible) throw new ConvexError("FIXED_GUARD_REQUIRED");
    const choices = [...args.deleteWorkspaces].sort((a, b) =>
      a.workspaceId.localeCompare(b.workspaceId),
    );
    const old = await replay(
      ctx,
      args.commandKey,
      JSON.stringify(["account", choices]),
    );
    if (old) return present(old);
    const result = await ctx.runMutation(
      internal.operations.deletion.prepareAccount,
      args,
    );
    return start(ctx, result.id);
  },
});
export const resume = mutation({
  args: { jobId: v.id("deletionJobs") },
  returns: jobStatus,
  handler: async (ctx, args): Promise<Infer<typeof jobStatus>> => {
    const authId = await statusIdentity(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.authId !== authId)
      throw new ConvexError("DELETION_ACCESS_DENIED");
    return start(ctx, job._id);
  },
});
export const mine = query({
  args: {},
  returns: v.array(jobStatus),
  handler: async (ctx) => {
    const authId = await statusIdentity(ctx);
    return (
      await ctx.db
        .query("deletionJobs")
        .withIndex("by_authId", (q) => q.eq("authId", authId))
        .order("desc")
        .take(10)
    ).map(present);
  },
});
