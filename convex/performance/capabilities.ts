import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import {
  workspaceMutation,
  requireReference,
  requireRole,
  requireWorkspace,
} from "../lib/authorization";
import { internal } from "../_generated/api";
import { scope, policyFields } from "./fields";
import { sha256 } from "../lib/crypto";
import type { Doc, Id } from "../_generated/dataModel";
type Ctx = QueryCtx | MutationCtx;
export const fingerprint = (p: Doc<"performancePolicies">) =>
  sha256(JSON.stringify(p));
const positive = (n: number, max = 1e12) =>
  Number.isSafeInteger(n) && n > 0 && n <= max;
export async function admin(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
) {
  const u = await ctx.db.get(actorId);
  if (!u) throw new ConvexError("OWN_METRICS_AUTHORITY_UNAVAILABLE");
  requireRole((await requireWorkspace(ctx, workspaceId, u)).membership, [
    "Owner",
    "Admin",
  ]);
}
export async function policy(
  ctx: Ctx,
  a: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
) {
  const account = await ctx.db.get(a.accountId);
  requireReference(a.workspaceId, account);
  const p = await ctx.db
    .query("performancePolicies")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
    )
    .order("desc")
    .first();
  if (
    !p ||
    account!.provider !== "X" ||
    account!.connection !== "connected" ||
    p.providerIdentity !== account!.providerIdentity ||
    p.connectionSequence !== (account!.xEvidence?.connectionSequence ?? 0) ||
    !positive(p.expiresAt, Number.MAX_SAFE_INTEGER) ||
    p.expiresAt <= Date.now() ||
    !positive(p.unitMicros) ||
    !positive(p.allocatedProviderLimitMicros) ||
    !positive(p.retentionMs, 30 * 86400000) ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(p.version) ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    [
      p.accessEvidence,
      p.rightsEvidence,
      p.pricingEvidence,
      p.protocolEvidence,
      p.allocationEvidence,
    ].some((x) => !x.trim() || x.length > 2000) ||
    (p.windows !== undefined &&
      (!p.windows.length ||
        new Set(p.windows).size !== p.windows.length ||
        !p.windowsEvidence?.trim() ||
        p.windowsEvidence.length > 2000)) ||
    !p.fields.length ||
    p.fields.length > 8 ||
    new Set(p.fields).size !== p.fields.length ||
    p.fields.some(
      (x) =>
        ![
          "impressions",
          "likes",
          "replies",
          "reposts",
          "quotes",
          "bookmarks",
          "url_clicks",
          "profile_clicks",
        ].includes(x),
    )
  )
    throw new ConvexError("OWN_METRICS_CONFIGURATION_REQUIRED");
  await admin(ctx, a.workspaceId, p.approvedBy);
  return p;
}
export async function grants(
  ctx: Ctx,
  p: Doc<"performancePolicies">,
  reserve = true,
) {
  const result: Id<"aiBudgets">[] = [];
  for (const [i, key] of [
    "metrics:x",
    `metrics:workspace:${p.workspaceId}`,
    `metrics:account:${p.accountId}`,
  ].entries()) {
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (
      !b ||
      b.scope !== (["provider", "workspace", "account"] as const)[i] ||
      b.policyVersion !== p.version ||
      b.currency !== p.currency ||
      !b.purposes.includes("own-metrics") ||
      b.expiresAt <= Date.now() ||
      !positive(b.limitMicros) ||
      !Number.isSafeInteger(b.heldMicros) ||
      b.heldMicros < 0 ||
      !Number.isSafeInteger(b.spentMicros) ||
      b.spentMicros < 0 ||
      (i === 0 &&
        (b.workspaceId !== undefined ||
          b.accountId !== undefined ||
          b.limitMicros !== p.allocatedProviderLimitMicros)) ||
      (i === 1 &&
        (b.workspaceId !== p.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== p.workspaceId || b.accountId !== p.accountId)) ||
      (i > 0 && !b.approvedBy)
    )
      throw new ConvexError("OWN_METRICS_BUDGET_CONFIGURATION_REQUIRED");
    if (reserve && b.heldMicros + b.spentMicros + p.unitMicros > b.limitMicros)
      throw new ConvexError("OWN_METRICS_BUDGET_EXHAUSTED");
    if (b.approvedBy) await admin(ctx, p.workspaceId, b.approvedBy);
    result.push(b._id);
  }
  return result;
}
export async function credential(
  ctx: Ctx,
  a: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
  p: Pick<Doc<"performancePolicies">, "providerIdentity">,
) {
  const c = await ctx.db
    .query("xCredentials")
    .withIndex("by_accountId", (q) => q.eq("accountId", a.accountId))
    .unique();
  const binding = await ctx.db
    .query("xBindings")
    .withIndex("by_providerIdentity", (q) =>
      q.eq("providerIdentity", p.providerIdentity),
    )
    .unique();
  if (
    !c ||
    c.workspaceId !== a.workspaceId ||
    !c.envelope ||
    c.leaseUntil ||
    c.expiresAt <= Date.now() + 15000 ||
    !["tweet.read", "users.read"].every((x) => c.scopes.includes(x)) ||
    binding?.workspaceId !== a.workspaceId ||
    binding.accountId !== a.accountId
  )
    throw new ConvexError("OWN_METRICS_REAUTH_OR_READ_SCOPE_REQUIRED");
  return c;
}
export async function authority(
  ctx: Ctx,
  a: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
  generation?: number,
  reserve = true,
) {
  const control = await ctx.db
    .query("performanceControls")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
    )
    .unique();
  if (
    !control ||
    !control.enabled ||
    control.deleted ||
    (generation !== undefined && control.generation !== generation)
  )
    throw new ConvexError("OWN_METRICS_PAUSED");
  await admin(ctx, a.workspaceId, control.actorId);
  const p = await policy(ctx, a);
  if (control.connectionSequence !== p.connectionSequence)
    throw new ConvexError("OWN_METRICS_CONNECTION_CHANGED");
  return {
    control,
    p,
    budgetIds: await grants(ctx, p, reserve),
    credential: await credential(ctx, a, p),
  };
}
// Operator configuration remains internal and inert; current Owner/Admin consent is separate.
export const configure = internalMutation({
  args: policyFields,
  returns: v.id("performancePolicies"),
  handler: async (ctx, a) => {
    const old = await ctx.db
      .query("performancePolicies")
      .withIndex("by_workspaceId_and_accountId_and_version", (q) =>
        q
          .eq("workspaceId", a.workspaceId)
          .eq("accountId", a.accountId)
          .eq("version", a.version),
      )
      .unique();
    if (old) {
      const same = Object.keys(a).every(
        (key) =>
          JSON.stringify(old[key as keyof typeof old]) ===
          JSON.stringify(a[key as keyof typeof a]),
      );
      if (!same) throw new ConvexError("OWN_METRICS_POLICY_VERSION_CONFLICT");
      return old._id;
    }
    const id = await ctx.db.insert("performancePolicies", a);
    await policy(ctx, a);
    const control = await ctx.db
      .query("performanceControls")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
      )
      .unique();
    if (control) {
      const generation = control.generation + 1;
      await ctx.db.patch(control._id, {
        enabled: false,
        generation,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.performance.snapshots.clear, {
        workspaceId: a.workspaceId,
        accountId: a.accountId,
        generation,
        remove: false,
      });
    }
    return id;
  },
});
export const consent = workspaceMutation({
  args: {
    accountId: scope.accountId,
    enabled: v.boolean(),
    policyId: v.optional(v.id("performancePolicies")),
    policyFingerprint: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    if (a.enabled) {
      const p = await policy(ctx, args);
      if (
        (p.windows !== undefined ||
          a.policyId !== undefined ||
          a.policyFingerprint !== undefined) &&
        (a.policyId !== p._id || a.policyFingerprint !== (await fingerprint(p)))
      )
        throw new ConvexError("OWN_METRICS_WINDOW_CONSENT_POLICY_CHANGED");
      await grants(ctx, p);
      await credential(ctx, args, p);
    }
    const old = await ctx.db
      .query("performanceControls")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("accountId", args.accountId),
      )
      .unique();
    const data = {
      ...args,
      enabled: a.enabled,
      deleted: false,
      ...(old?.deletedThroughGeneration !== undefined
        ? { deletedThroughGeneration: old.deletedThroughGeneration }
        : {}),
      generation: (old?.generation ?? 0) + 1,
      actorId: ctx.user._id,
      connectionSequence:
        (await ctx.db.get(a.accountId))?.xEvidence?.connectionSequence ?? 0,
      updatedAt: Date.now(),
    };
    if (old) await ctx.db.replace(old._id, data);
    else await ctx.db.insert("performanceControls", data);
    if (!a.enabled)
      await ctx.scheduler.runAfter(0, internal.performance.snapshots.clear, {
        ...args,
        generation: data.generation,
        remove: false,
      });
    return null;
  },
});
export const remove = workspaceMutation({
  args: { accountId: scope.accountId },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    const old = await ctx.db
      .query("performanceControls")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("accountId", args.accountId),
      )
      .unique();
    const data = {
      ...args,
      enabled: false,
      deleted: true,
      deletedThroughGeneration: (old?.generation ?? 0) + 1,
      generation: (old?.generation ?? 0) + 1,
      actorId: ctx.user._id,
      connectionSequence: 0,
      updatedAt: Date.now(),
    };
    if (old) await ctx.db.replace(old._id, data);
    else await ctx.db.insert("performanceControls", data);
    await ctx.scheduler.runAfter(0, internal.performance.snapshots.clear, {
      ...args,
      generation: data.generation,
      remove: true,
    });
    return null;
  },
});
