import { internal } from "../_generated/api";
import { captureWorkflowApproval } from "./pipeline";
import { operation } from "./providerFields";
import { ConvexError, v } from "convex/values";
import {
  workspaceMutation,
  workspaceQuery,
  requireRole,
} from "../lib/authorization";
import { config, profileDoc, versionDoc } from "./fields";
import {
  account,
  currentProfile,
  liveAuthority,
  operationKey,
  pricing,
  prerequisites,
  validateConfig,
  validateCurrency,
} from "./access";
import { sha256 } from "../lib/crypto";
import { validPolicy } from "../ai/runs";
import { policy as nativePolicy } from "./providerAccess";
import { cancelSchedule, planSchedule } from "./schedules";
const editable = ["Owner", "Admin", "Editor"] as const;
export const get = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.union(
    v.object({ profile: profileDoc, version: versionDoc }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    await account(ctx, ctx.workspace._id, a.accountId);
    const p = await ctx.db
      .query("researchProfiles")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .unique();
    if (!p) return null;
    const { profile, version } = await currentProfile(
      ctx,
      ctx.workspace._id,
      p._id,
    );
    const {
      workflowActivation,
      scheduleApproval,
      scheduleActorId,
      scheduleAccountSequence,
      scheduledJobId,
      ...safe
    } = profile;
    return {
      profile: {
        ...safe,
        scheduleKind: profile.scheduleActive
          ? profile.workflowActivation
            ? ("workflow" as const)
            : ("prepared" as const)
          : null,
      },
      version,
    };
  },
});
export const configuration = workspaceQuery({
  args: { accountId: v.optional(v.id("socialAccounts")) },
  returns: v.object({
    currencies: v.optional(v.array(v.string())),
    currency: v.union(v.string(), v.null()),
    downstreamAvailable: v.literal(false),
  }),
  handler: async (ctx, a) => {
    const p = await pricing(ctx);
    const currencies =
      validPolicy(p) && p!.purposes.includes("research") ? [p!.currency] : [];
    if (a.accountId) {
      await account(ctx, ctx.workspace._id, a.accountId);
      for (const op of ["x-recent", "x-trends", "web-search"] as const) {
        try {
          const native = await nativePolicy(
            ctx,
            ctx.workspace._id,
            a.accountId,
            op,
          );
          if (!currencies.includes(native.currency))
            currencies.push(native.currency);
        } catch {
          /* Missing native permission stays unavailable. */
        }
      }
    }
    return {
      currencies,
      currency: currencies.length === 1 ? currencies[0] : null,
      downstreamAvailable: false as const,
    };
  },
});
export const create = workspaceMutation({
  args: { accountId: v.id("socialAccounts"), config, commandKey: v.string() },
  returns: v.id("researchProfiles"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, [...editable]);
    operationKey(a.commandKey);
    validateConfig(a.config);
    await account(ctx, ctx.workspace._id, a.accountId);
    if (a.config.frequency !== "manual" || a.config.cap !== null)
      throw new ConvexError("RESEARCH_INITIAL_MANUAL_REQUIRED");
    const fingerprint = await sha256(JSON.stringify(a));
    const old = await ctx.db
      .query("researchProfiles")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .unique();
    if (old) {
      const receipt = await ctx.db
        .query("researchProfileVersions")
        .withIndex("by_profileId_and_actorId_and_commandKey", (q) =>
          q
            .eq("profileId", old._id)
            .eq("actorId", ctx.user._id)
            .eq("commandKey", a.commandKey),
        )
        .unique();
      if (receipt?.fingerprint === fingerprint) return old._id;
      throw new ConvexError("RESEARCH_PROFILE_EXISTS_OR_OPERATION_CONFLICT");
    }
    const id = await ctx.db.insert("researchProfiles", {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      revision: 1,
      currentVersionId: null,
      paused: false,
      deleted: false,
      scheduleActive: false,
      scheduleGeneration: 1,
      scheduleActorId: null,
      scheduleAccountSequence: null,
      scheduleApproval: null,
      scheduleReason: null,
      scheduledJobId: null,
      nextAt: null,
      activeOrderId: null,
    });
    const versionId = await ctx.db.insert("researchProfileVersions", {
      workspaceId: ctx.workspace._id,
      profileId: id,
      actorId: ctx.user._id,
      number: 1,
      config: a.config,
      commandKey: a.commandKey,
      fingerprint,
      createdAt: Date.now(),
    });
    await ctx.db.patch(id, { currentVersionId: versionId });
    return id;
  },
});
export const change = workspaceMutation({
  args: {
    profileId: v.id("researchProfiles"),
    expectedRevision: v.number(),
    commandKey: v.string(),
    action: v.union(
      v.object({ kind: v.literal("save"), config }),
      v.object({ kind: v.literal("pause"), paused: v.boolean() }),
      v.object({ kind: v.literal("activate") }),
      v.object({
        kind: v.literal("activate-workflow"),
        language: v.string(),
        operations: v.array(operation),
      }),
      v.object({ kind: v.literal("deactivate") }),
      v.object({ kind: v.literal("delete") }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, [...editable]);
    if (a.action.kind === "activate-workflow")
      requireRole(ctx.membership, ["Owner", "Admin"]);
    operationKey(a.commandKey);
    const { profile: p, version } = await currentProfile(
      ctx,
      ctx.workspace._id,
      a.profileId,
    );
    const fingerprint = await sha256(JSON.stringify(a));
    const receipt = await ctx.db
      .query("researchProfileVersions")
      .withIndex("by_profileId_and_actorId_and_commandKey", (q) =>
        q
          .eq("profileId", p._id)
          .eq("actorId", ctx.user._id)
          .eq("commandKey", a.commandKey),
      )
      .unique();
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        throw new ConvexError("RESEARCH_OPERATION_CONFLICT");
      return receipt.number;
    }
    if (p.deleted) throw new ConvexError("RESEARCH_PROFILE_INACTIVE");
    if (
      !Number.isSafeInteger(a.expectedRevision) ||
      a.expectedRevision !== p.revision
    )
      throw new ConvexError("RESEARCH_REVISION_CONFLICT");
    const nextConfig =
      a.action.kind === "save" ? a.action.config : version.config;
    validateConfig(nextConfig);
    if (
      a.action.kind === "save" &&
      (nextConfig.cap?.currency !== version.config.cap?.currency ||
        nextConfig.cap?.limitMicros !== version.config.cap?.limitMicros)
    )
      await validateCurrency(ctx, nextConfig, p.workspaceId, p.accountId);
    let approval = null,
      sequence = null;
    if (a.action.kind === "activate" || a.action.kind === "activate-workflow") {
      const acc = await account(ctx, p.workspaceId, p.accountId);
      sequence = acc.xEvidence?.connectionSequence ?? 0;
      await liveAuthority(ctx, p, ctx.user._id, sequence);
      if (nextConfig.frequency === "manual")
        throw new ConvexError("RESEARCH_SCHEDULE_MANUAL");
      approval = await prerequisites(ctx, p, nextConfig);
    }
    // Every explicit profile command fences the previous future schedule. Jobs retain their own immutable version.
    await cancelSchedule(ctx, p);
    const revision = p.revision + 1;
    const versionId = await ctx.db.insert("researchProfileVersions", {
      workspaceId: p.workspaceId,
      profileId: p._id,
      actorId: ctx.user._id,
      number: revision,
      config: nextConfig,
      commandKey: a.commandKey,
      fingerprint,
      createdAt: Date.now(),
    });
    const workflowActivation =
      a.action.kind === "activate-workflow"
        ? await captureWorkflowApproval(
            ctx,
            p,
            nextConfig,
            a.action.language,
            a.action.operations,
          )
        : null;
    const materialWithdrawn =
      a.action.kind === "delete" ||
      (a.action.kind === "pause" && a.action.paused);
    const patch = {
      workflowActivation,
      researchMaterialGeneration: materialWithdrawn
        ? (p.researchMaterialGeneration ?? 0) + 1
        : (p.researchMaterialGeneration ?? 0),
      revision,
      currentVersionId: versionId,
      scheduleGeneration: p.scheduleGeneration + 1,
      scheduleActive:
        a.action.kind === "activate" || a.action.kind === "activate-workflow",
      scheduleActorId:
        a.action.kind === "activate" || a.action.kind === "activate-workflow"
          ? ctx.user._id
          : null,
      scheduleAccountSequence: sequence,
      scheduleApproval: approval,
      scheduleReason: null,
      nextAt: null,
      scheduledJobId: null,
      paused: a.action.kind === "pause" ? a.action.paused : p.paused,
      deleted: a.action.kind === "delete",
    };
    await ctx.db.patch(p._id, patch);
    if (materialWithdrawn)
      await ctx.scheduler.runAfter(0, internal.research.pipeline.purgeProfile, {
        profileId: p._id,
        cursor: null,
      });
    if (materialWithdrawn && p.activeOrderId) {
      const order = await ctx.db.get(p.activeOrderId);
      if (
        order &&
        (patch.deleted || order.pipeline) &&
        (order.state === "queued" || order.state === "running")
      )
        await ctx.db.patch(order._id, {
          state: "cancelled",
          generation: order.generation + 1,
          reason: patch.deleted
            ? "RESEARCH_PROFILE_DELETED"
            : "RESEARCH_PROFILE_PAUSED",
          finishedAt: Date.now(),
        });
      await ctx.db.patch(p._id, { activeOrderId: null });
    }
    if (patch.scheduleActive)
      await planSchedule(ctx, { ...p, ...patch }, nextConfig);
    return revision;
  },
});
