import { ConvexError, v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  requireIdentity,
  requireRole,
  workspaceMutation,
  workspaceQuery,
} from "./lib/authorization";
import { sha256 } from "./lib/crypto";
import { defaultProfile, provisionUser } from "./users";
import { teamResult } from "./teamFields";
import { role } from "./schema";
const teamAction = v.union(
  v.object({
    kind: v.literal("invite"),
    email: v.string(),
    role,
    lifetimeDays: v.number(),
  }),
  v.object({
    kind: v.literal("revoke"),
    invitationId: v.id("teamInvitations"),
  }),
  v.object({
    kind: v.literal("role"),
    membershipId: v.id("memberships"),
    role,
  }),
  v.object({ kind: v.literal("remove"), membershipId: v.id("memberships") }),
  v.object({ kind: v.literal("transfer"), membershipId: v.id("memberships") }),
  v.object({ kind: v.literal("leave") }),
);

const DAY = 86400000;
const cursor = v.union(v.string(), v.null());
function email(value: string) {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/.test(
      normalized,
    )
  )
    throw new ConvexError("INVALID_INVITATION_EMAIL");
  return normalized;
}
function command(key: string, revision: number) {
  if (
    !/^[A-Za-z0-9_-]{8,100}$/.test(key) ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new ConvexError("TEAM_COMMAND_INVALID");
}
async function members(
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
async function currentInviter(
  ctx: QueryCtx | MutationCtx,
  i: Doc<"teamInvitations">,
) {
  if (
    !i.createdBy ||
    !i.email ||
    !i.role ||
    i.status !== "pending" ||
    i.expiresAt <= Date.now()
  )
    return false;
  const user = await ctx.db.get(i.createdBy),
    w = await ctx.db.get(i.workspaceId);
  if (!user || !w || (w.lifecycle && w.lifecycle !== "active")) return false;
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", user._id).eq("workspaceId", i.workspaceId),
    )
    .unique();
  return (
    !!m &&
    (i.role === "Owner"
      ? m.role === "Owner"
      : ["Owner", "Admin"].includes(m.role))
  );
}
async function recipient(
  ctx: QueryCtx | MutationCtx,
  i: Doc<"teamInvitations">,
  identity: Awaited<ReturnType<typeof requireIdentity>>,
) {
  if (i.expiresAt <= Date.now()) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity._id))
    .unique();
  if (i.status === "accepted") {
    if (!user || user._id !== i.acceptedUserId) return null;
    const w = await ctx.db.get(i.workspaceId);
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", user._id).eq("workspaceId", i.workspaceId),
      )
      .unique();
    return w && (!w.lifecycle || w.lifecycle === "active") && m
      ? { user, workspace: w }
      : null;
  }
  if (
    !i.email ||
    email(identity.email) !== i.email ||
    !(await currentInviter(ctx, i))
  )
    return null;
  const workspace = await ctx.db.get(i.workspaceId);
  return workspace ? { user, workspace } : null;
}
async function close(
  ctx: MutationCtx,
  i: Doc<"teamInvitations">,
  status: "accepted" | "revoked" | "expired" | "unavailable",
) {
  await ctx.db.patch(i._id, {
    status,
    email: undefined,
    createdBy: undefined,
    role: undefined,
  });
}
async function receipt(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  key: string,
  fingerprint: string,
  ownerOperation: boolean,
  result: Doc<"teamCommands">["result"],
  cleanAfter: number,
) {
  await ctx.db.insert("teamCommands", {
    workspaceId,
    actorId,
    commandKey: key,
    fingerprint,
    ownerOperation,
    result,
    sourceUnavailable: false,
    cleanAfter,
  });
}
async function currentCommand(ctx: MutationCtx, c: Doc<"teamCommands">) {
  if (c.cleanAfter === null || c.cleanAfter <= Date.now()) return false;
  const user = await ctx.db.get(c.actorId),
    w = await ctx.db.get(c.workspaceId);
  if (!user || !w || (w.lifecycle && w.lifecycle !== "active")) return false;
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", c.actorId).eq("workspaceId", c.workspaceId),
    )
    .unique();
  const memberCommand =
    c.result &&
    ["joined", "already-member", "left"].includes(c.result.disposition);
  return (
    !!m &&
    (c.ownerOperation
      ? m.role === "Owner"
      : memberCommand || ["Owner", "Admin"].includes(m.role))
  );
}
async function clearCommand(ctx: MutationCtx, c: Doc<"teamCommands">) {
  await ctx.db.patch(c._id, {
    sourceUnavailable: true,
    fingerprint: undefined,
    result: undefined,
    cleanAfter: null,
  });
}
export const list = workspaceQuery({
  args: {},
  returns: v.object({
    revision: v.number(),
    members: v.array(
      v.object({
        membershipId: v.id("memberships"),
        userId: v.id("users"),
        role: v.string(),
        name: v.string(),
      }),
    ),
    invitations: v.array(
      v.object({
        id: v.id("teamInvitations"),
        email: v.union(v.string(), v.null()),
        role: v.union(v.string(), v.null()),
        status: v.string(),
        expiresAt: v.number(),
      }),
    ),
    invitationsLimited: v.boolean(),
  }),
  handler: async (ctx) => {
    const roster = await members(ctx, ctx.workspace._id);
    const invitations = await ctx.db
      .query("teamInvitations")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .order("desc")
      .take(101);
    const admin = ["Owner", "Admin"].includes(ctx.membership.role);
    return {
      revision: ctx.workspace.teamRevision ?? 0,
      members: await Promise.all(
        roster.map(async (m) => {
          const p = await ctx.db
            .query("preferences")
            .withIndex("by_userId_and_workspaceId", (q) =>
              q.eq("userId", m.userId).eq("workspaceId", ctx.workspace._id),
            )
            .unique();
          return {
            membershipId: m._id,
            userId: m.userId,
            role: m.role,
            name: p?.name || "Mitglied",
          };
        }),
      ),
      invitations: admin
        ? await Promise.all(
            invitations.slice(0, 100).map(async (i) => {
              const available = await currentInviter(ctx, i);
              return {
                id: i._id,
                email: available ? i.email! : null,
                role: available ? i.role! : null,
                status:
                  i.status === "pending" && !available
                    ? i.expiresAt <= Date.now()
                      ? "expired"
                      : "unavailable"
                    : i.status,
                expiresAt: i.expiresAt,
              };
            }),
          )
        : [],
      invitationsLimited: admin && invitations.length > 100,
    };
  },
});
export const change = workspaceMutation({
  args: {
    expectedRevision: v.number(),
    commandKey: v.string(),
    action: teamAction,
  },
  returns: teamResult,
  handler: async (ctx, a) => {
    const x = a.action,
      actor = ctx.membership,
      workspaceId = ctx.workspace._id;
    command(a.commandKey, a.expectedRevision);
    requireRole(
      actor,
      x.kind === "leave"
        ? ["Owner", "Admin", "Editor", "Viewer"]
        : ["Owner", "Admin"],
    );
    const normalized =
      x.kind === "invite"
        ? {
            kind: x.kind,
            email: email(x.email),
            role: x.role,
            lifetimeDays: x.lifetimeDays,
          }
        : x;
    if (
      x.kind === "invite" &&
      (!Number.isInteger(x.lifetimeDays) ||
        x.lifetimeDays < 1 ||
        x.lifetimeDays > 30)
    )
      throw new ConvexError("INVITATION_LIFETIME_INVALID");
    // A fixed action tuple avoids caller object-key ordering changing immutable intent.
    const intent =
      x.kind === "invite"
        ? [x.kind, email(x.email), x.role, x.lifetimeDays]
        : x.kind === "revoke"
          ? [x.kind, x.invitationId]
          : x.kind === "role"
            ? [x.kind, x.membershipId, x.role]
            : x.kind === "leave"
              ? [x.kind]
              : [x.kind, x.membershipId];
    const fingerprint = await sha256(
      JSON.stringify([workspaceId, a.expectedRevision, intent]),
    );
    const old = await ctx.db
      .query("teamCommands")
      .withIndex("by_workspaceId_and_actorId_and_commandKey", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("actorId", ctx.user._id)
          .eq("commandKey", a.commandKey),
      )
      .unique();
    let target: Doc<"memberships"> | null = null,
      invitation: Doc<"teamInvitations"> | null = null;
    if (x.kind === "role" || x.kind === "remove" || x.kind === "transfer") {
      target = await ctx.db.get(x.membershipId);
      if (target && target.workspaceId !== workspaceId)
        throw new ConvexError("TEAM_REFERENCE_DENIED");
    } else if (x.kind === "leave") target = actor;
    else if (x.kind === "revoke") {
      invitation = await ctx.db.get(x.invitationId);
      if (!invitation || invitation.workspaceId !== workspaceId)
        throw new ConvexError("TEAM_REFERENCE_DENIED");
    }
    const ownerOperation =
      (x.kind === "invite" && x.role === "Owner") ||
      (x.kind === "role" && x.role === "Owner") ||
      target?.role === "Owner" ||
      invitation?.role === "Owner" ||
      x.kind === "transfer" ||
      old?.ownerOperation === true;
    if (ownerOperation) requireRole(actor, ["Owner"]);
    if (old) {
      if (
        old.sourceUnavailable ||
        old.cleanAfter === null ||
        old.cleanAfter <= Date.now() ||
        !old.result
      )
        throw new ConvexError("TEAM_COMMAND_UNAVAILABLE");
      if (old.fingerprint !== fingerprint)
        throw new ConvexError("TEAM_COMMAND_CONFLICT");
      return old.result;
    }
    if ((ctx.workspace.teamRevision ?? 0) !== a.expectedRevision)
      throw new ConvexError("TEAM_REVISION_CONFLICT");
    const roster = await members(ctx, workspaceId),
      revision = a.expectedRevision + 1;
    const result: NonNullable<Doc<"teamCommands">["result"]> = {
      revision,
      invitationId: null,
      membershipId: target?._id ?? null,
      userId: target?.userId ?? null,
      disposition: "issued",
    };
    if (x.kind === "invite") {
      const pending = await ctx.db
        .query("teamInvitations")
        .withIndex("by_workspaceId_and_status_and_expiresAt", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("status", "pending")
            .gt("expiresAt", Date.now()),
        )
        .take(101);
      if (pending.length >= 100) throw new ConvexError("INVITATION_LIMIT");
      if (roster.length >= 100) throw new ConvexError("MEMBER_LIMIT");
      result.invitationId = await ctx.db.insert("teamInvitations", {
        workspaceId,
        createdBy: ctx.user._id,
        email: (normalized as { email: string }).email,
        role: x.role,
        createdAt: Date.now(),
        expiresAt: Date.now() + x.lifetimeDays * DAY,
        status: "pending",
      });
    } else if (x.kind === "revoke") {
      if (invitation!.status !== "pending")
        throw new ConvexError("INVITATION_UNAVAILABLE");
      await close(ctx, invitation!, "revoked");
      result.invitationId = invitation!._id;
      result.disposition = "revoked";
    } else {
      if (!target) throw new ConvexError("TEAM_REFERENCE_DENIED");
      if (
        (x.kind === "remove" ||
          x.kind === "leave" ||
          (x.kind === "role" && x.role !== "Owner")) &&
        target.role === "Owner" &&
        roster.filter((m) => m.role === "Owner").length <= 1
      )
        throw new ConvexError("LAST_OWNER_REQUIRED");
      if (x.kind === "transfer") {
        if (target._id === actor._id)
          throw new ConvexError("TEAM_TRANSFER_TARGET_INVALID");
        await ctx.db.patch(target._id, { role: "Owner" });
        await ctx.db.patch(actor._id, { role: "Admin" });
        result.disposition = "transferred";
        await ctx.scheduler.runAfter(0, internal.team.purgeActor, {
          actorId: ctx.user._id,
        });
      } else if (x.kind === "role") {
        await ctx.db.patch(target._id, { role: x.role });
        result.disposition = "role-changed";
        await ctx.scheduler.runAfter(0, internal.team.purgeActor, {
          actorId: target.userId,
        });
      } else {
        await ctx.db.delete(target._id);
        result.disposition = x.kind === "leave" ? "left" : "removed";
        await ctx.scheduler.runAfter(0, internal.team.purgeActor, {
          actorId: target.userId,
        });
      }
    }
    // ponytail: one revision serializes administration of <=100 members; split scopes if this bound grows.
    await ctx.db.patch(workspaceId, { teamRevision: revision });
    await receipt(
      ctx,
      workspaceId,
      ctx.user._id,
      a.commandKey,
      fingerprint,
      ownerOperation,
      result,
      Date.now() + 30 * DAY,
    );
    return result;
  },
});
export const preview = query({
  args: { invitationId: v.id("teamInvitations") },
  returns: v.union(
    v.null(),
    v.object({
      invitationId: v.id("teamInvitations"),
      workspaceId: v.id("workspaces"),
      workspaceName: v.string(),
      role: v.union(v.string(), v.null()),
      expiresAt: v.number(),
      revision: v.number(),
      status: v.string(),
    }),
  ),
  handler: async (ctx, a) => {
    const identity = await requireIdentity(ctx),
      i = await ctx.db.get(a.invitationId);
    if (!i) return null;
    const proof = await recipient(ctx, i, identity);
    return proof
      ? {
          invitationId: i._id,
          workspaceId: i.workspaceId,
          workspaceName: proof.workspace.name,
          role: i.role ?? null,
          expiresAt: i.expiresAt,
          revision: proof.workspace.teamRevision ?? 0,
          status: i.status,
        }
      : null;
  },
});
export const accept = mutation({
  args: {
    invitationId: v.id("teamInvitations"),
    commandKey: v.string(),
    expectedRevision: v.number(),
  },
  returns: teamResult,
  handler: async (ctx, a) => {
    const identity = await requireIdentity(ctx);
    command(a.commandKey, a.expectedRevision);
    const i = await ctx.db.get(a.invitationId);
    if (!i) throw new ConvexError("INVITATION_UNAVAILABLE");
    const proof = await recipient(ctx, i, identity);
    if (!proof) throw new ConvexError("INVITATION_UNAVAILABLE");
    const fingerprint = await sha256(
      JSON.stringify([i.workspaceId, a.expectedRevision, ["accept", i._id]]),
    );
    const old = proof.user
      ? await ctx.db
          .query("teamCommands")
          .withIndex("by_workspaceId_and_actorId_and_commandKey", (q) =>
            q
              .eq("workspaceId", i.workspaceId)
              .eq("actorId", proof.user!._id)
              .eq("commandKey", a.commandKey),
          )
          .unique()
      : null;
    if (old) {
      if (
        old.sourceUnavailable ||
        old.cleanAfter === null ||
        old.cleanAfter <= Date.now() ||
        !old.result
      )
        throw new ConvexError("TEAM_COMMAND_UNAVAILABLE");
      if (old.fingerprint !== fingerprint)
        throw new ConvexError("TEAM_COMMAND_CONFLICT");
      return old.result;
    }
    if (i.status !== "pending") throw new ConvexError("INVITATION_UNAVAILABLE");
    if ((proof.workspace.teamRevision ?? 0) !== a.expectedRevision)
      throw new ConvexError("TEAM_REVISION_CONFLICT");
    const roster = await members(ctx, i.workspaceId);
    const existing = proof.user
      ? roster.find((m) => m.userId === proof.user!._id)
      : null;
    if (!existing && roster.length >= 100)
      throw new ConvexError("MEMBER_LIMIT");
    if (proof.user && !existing) {
      const own = await ctx.db
        .query("memberships")
        .withIndex("by_userId", (q) => q.eq("userId", proof.user!._id))
        .take(101);
      if (own.length >= 100) throw new ConvexError("WORKSPACE_LIMIT");
    }
    const userId =
      proof.user?._id ??
      (await provisionUser(ctx, identity._id, identity.name));
    const membershipId =
      existing?._id ??
      (await ctx.db.insert("memberships", {
        workspaceId: i.workspaceId,
        userId,
        role: i.role!,
      }));
    const p = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", userId).eq("workspaceId", i.workspaceId),
      )
      .unique();
    if (!p)
      await ctx.db.insert("preferences", {
        workspaceId: i.workspaceId,
        userId,
        ...defaultProfile(identity.name),
        ...((existing?.role ?? i.role) === "Viewer"
          ? { onboardingDone: true, onboardingStep: 3 }
          : {}),
      });
    const result: NonNullable<Doc<"teamCommands">["result"]> = {
      revision: a.expectedRevision + 1,
      invitationId: i._id,
      membershipId,
      userId,
      disposition: existing ? "already-member" : "joined",
    };
    await close(ctx, i, "accepted");
    await ctx.db.patch(i._id, { acceptedUserId: userId, result });
    await ctx.db.patch(i.workspaceId, { teamRevision: result.revision });
    await receipt(
      ctx,
      i.workspaceId,
      userId,
      a.commandKey,
      fingerprint,
      false,
      result,
      i.expiresAt,
    );
    return result;
  },
});
export const purgeActor = internalMutation({
  args: {
    actorId: v.id("users"),
    cursor: v.optional(cursor),
    phase: v.optional(v.union(v.literal("invitations"), v.literal("commands"))),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (!a.phase || a.phase === "invitations") {
      const page = await ctx.db
        .query("teamInvitations")
        .withIndex("by_createdBy_and_status", (q) =>
          q.eq("createdBy", a.actorId).eq("status", "pending"),
        )
        .paginate({ cursor: a.cursor ?? null, numItems: 50 });
      for (const i of page.page)
        if (!(await currentInviter(ctx, i)))
          await close(
            ctx,
            i,
            i.expiresAt <= Date.now() ? "expired" : "unavailable",
          );
      await ctx.scheduler.runAfter(0, internal.team.purgeActor, {
        actorId: a.actorId,
        cursor: page.isDone ? null : page.continueCursor,
        phase: page.isDone ? "commands" : "invitations",
      });
    } else {
      const page = await ctx.db
        .query("teamCommands")
        .withIndex("by_actorId_and_sourceUnavailable", (q) =>
          q.eq("actorId", a.actorId).eq("sourceUnavailable", false),
        )
        .paginate({ cursor: a.cursor ?? null, numItems: 50 });
      for (const c of page.page) {
        if (!(await currentCommand(ctx, c))) await clearCommand(ctx, c);
      }
      if (!page.isDone)
        await ctx.scheduler.runAfter(0, internal.team.purgeActor, {
          actorId: a.actorId,
          cursor: page.continueCursor,
          phase: "commands",
        });
    }
    return null;
  },
});
export const sweep = internalMutation({
  args: {
    cursor,
    phase: v.union(v.literal("invitations"), v.literal("commands")),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.phase === "invitations") {
      const page = await ctx.db
        .query("teamInvitations")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .paginate({ cursor: a.cursor, numItems: 50 });
      for (const i of page.page)
        if (!(await currentInviter(ctx, i)))
          await close(
            ctx,
            i,
            i.expiresAt <= Date.now() ? "expired" : "unavailable",
          );
      await ctx.scheduler.runAfter(
        0,
        internal.team.sweep,
        page.isDone
          ? { cursor: null, phase: "commands" }
          : { cursor: page.continueCursor, phase: "invitations" },
      );
    } else {
      const page = await ctx.db
        .query("teamCommands")
        .withIndex("by_cleanAfter", (q) => q.gt("cleanAfter", null))
        .paginate({ cursor: a.cursor, numItems: 50 });
      for (const c of page.page)
        if (!(await currentCommand(ctx, c))) await clearCommand(ctx, c);
      if (!page.isDone)
        await ctx.scheduler.runAfter(0, internal.team.sweep, {
          cursor: page.continueCursor,
          phase: "commands",
        });
    }
    return null;
  },
});
