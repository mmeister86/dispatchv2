import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import {
  requireReference,
  requireWorkspace,
  requireRole,
} from "../lib/authorization";
import { validPolicy } from "../ai/runs";
import { sha256 } from "../lib/crypto";
import { policy as nativePolicy } from "./providerAccess";
import { validateClock } from "./time";
export function operationKey(k: string) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(k))
    throw new ConvexError("RESEARCH_OPERATION_INVALID");
}
export function validateConfig(c: Doc<"researchProfileVersions">["config"]) {
  for (const [value, max, required] of [
    [c.topics, 2000, true],
    [c.project, 2000, false],
    [c.audience, 1000, true],
    [c.exclusions, 2000, false],
  ] as const)
    if (
      value.length > max ||
      (required && !value.trim()) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    )
      throw new ConvexError("RESEARCH_INPUT_INVALID");
  if (
    c.languages.length < 1 ||
    c.languages.length > 5 ||
    c.languages.some((s) => !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(s)) ||
    c.regions.length > 10 ||
    c.regions.some((s) => !/^(?:global|EU|[A-Z]{2})$/.test(s)) ||
    c.preferredSources.length > 10
  )
    throw new ConvexError("RESEARCH_INPUT_INVALID");
  for (const s of c.preferredSources) {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      throw new ConvexError("RESEARCH_INPUT_INVALID");
    }
    if (
      s.length > 500 ||
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.hash
    )
      throw new ConvexError("RESEARCH_INPUT_INVALID");
  }
  if (
    !Number.isSafeInteger(c.freshnessDays) ||
    c.freshnessDays < 1 ||
    c.freshnessDays > 90 ||
    !Number.isSafeInteger(c.topicCount) ||
    c.topicCount < 1 ||
    c.topicCount > 20 ||
    (c.cap &&
      (!Number.isSafeInteger(c.cap.limitMicros) ||
        c.cap.limitMicros <= 0 ||
        c.cap.limitMicros > 1e12 ||
        !/^[A-Z]{3}$/.test(c.cap.currency)))
  )
    throw new ConvexError("RESEARCH_INPUT_INVALID");
  validateClock(c);
}
export async function currentProfile(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  profileId: Id<"researchProfiles">,
) {
  const profile = await ctx.db.get(profileId);
  requireReference(ws, profile);
  const version = profile!.currentVersionId
    ? await ctx.db.get(profile!.currentVersionId)
    : null;
  if (!version || version.profileId !== profileId || version.workspaceId !== ws)
    throw new ConvexError("RESEARCH_VERSION_MISSING");
  return { profile: profile!, version };
}
export async function account(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
) {
  const a = await ctx.db.get(accountId);
  requireReference(ws, a);
  return a!;
}
export async function liveAuthority(
  ctx: QueryCtx,
  p: Doc<"researchProfiles">,
  actorId: Id<"users">,
  sequence: number,
) {
  const actor = await ctx.db.get(actorId);
  if (!actor) throw new ConvexError("RESEARCH_ACTOR_UNAVAILABLE");
  const { membership } = await requireWorkspace(ctx, p.workspaceId, actor);
  requireRole(membership, ["Owner", "Admin", "Editor"]);
  const a = await account(ctx, p.workspaceId, p.accountId);
  if (
    a.connection !== "connected" ||
    (a.xEvidence?.connectionSequence ?? 0) !== sequence
  )
    throw new ConvexError("RESEARCH_ACCOUNT_CHANGED");
  if (p.deleted || p.paused) throw new ConvexError("RESEARCH_PROFILE_INACTIVE");
}
export async function pricing(ctx: QueryCtx) {
  return ctx.db
    .query("aiPolicies")
    .withIndex("by_key", (q) => q.eq("key", "requesty-generation"))
    .unique();
}
export async function validateCurrency(
  ctx: QueryCtx,
  c: Doc<"researchProfileVersions">["config"],
  ws?: Id<"workspaces">,
  accountId?: Id<"socialAccounts">,
) {
  if (!c.cap) return;
  const p = await pricing(ctx);
  if (
    validPolicy(p) &&
    p!.purposes.includes("research") &&
    p!.currency === c.cap.currency
  )
    return;
  if (ws && accountId)
    for (const op of ["x-recent", "x-trends", "web-search"] as const) {
      try {
        if (
          (await nativePolicy(ctx, ws, accountId, op)).currency ===
          c.cap.currency
        )
          return;
      } catch {
        /* A missing source never grants pricing. */
      }
    }
  throw new ConvexError("RESEARCH_PRICING_CONFIGURATION_REQUIRED");
}
// Reads existing generation grants only. This is neither search permission nor a reservation.
export async function prerequisites(
  ctx: QueryCtx | MutationCtx,
  p: Doc<"researchProfiles">,
  c: Doc<"researchProfileVersions">["config"],
  requireCoverage = true,
) {
  const policy = await pricing(ctx);
  if (
    !validPolicy(policy) ||
    !policy!.purposes.includes("research") ||
    !c.cap ||
    c.cap.currency !== policy!.currency
  )
    throw new ConvexError("RESEARCH_PRICING_CONFIGURATION_REQUIRED");
  const budgetIds: Id<"aiBudgets">[] = [];
  for (const [scope, key] of [
    ["provider", "provider"],
    ["workspace", `workspace:${p.workspaceId}`],
    ["account", `account:${p.accountId}`],
  ] as const) {
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (
      !b ||
      b.scope !== scope ||
      (scope !== "provider" &&
        (b.workspaceId !== p.workspaceId || !b.approvedBy)) ||
      (scope === "account" && b.accountId !== p.accountId) ||
      b.policyVersion !== policy!.version ||
      b.currency !== c.cap.currency ||
      !b.purposes.includes("research") ||
      b.expiresAt <= Date.now() ||
      !Number.isSafeInteger(b.limitMicros) ||
      b.limitMicros <= 0 ||
      b.limitMicros > 1e12 ||
      !Number.isSafeInteger(b.heldMicros) ||
      b.heldMicros < 0 ||
      !Number.isSafeInteger(b.spentMicros) ||
      b.spentMicros < 0 ||
      (requireCoverage &&
        b.limitMicros - b.heldMicros - b.spentMicros < c.cap.limitMicros)
    )
      throw new ConvexError("RESEARCH_BUDGET_CONFIGURATION_REQUIRED");
    if (b.approvedBy) {
      const approver = await ctx.db.get(b.approvedBy);
      if (!approver)
        throw new ConvexError("RESEARCH_BUDGET_CONFIGURATION_REQUIRED");
      const { membership } = await requireWorkspace(
        ctx,
        p.workspaceId,
        approver,
      );
      requireRole(membership, ["Owner", "Admin"]);
    }
    budgetIds.push(b._id);
  }
  return {
    kind: "generation-prerequisites-only" as const,
    policyVersion: policy!.version,
    policyFingerprint: await sha256(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(policy!).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    ),
    budgetIds,
  };
}

export function sameApproval(
  a: Doc<"researchProfiles">["scheduleApproval"],
  b: Doc<"researchProfiles">["scheduleApproval"],
) {
  return (
    !!a &&
    !!b &&
    a.kind === b.kind &&
    a.policyVersion === b.policyVersion &&
    a.policyFingerprint === b.policyFingerprint &&
    a.budgetIds.length === b.budgetIds.length &&
    a.budgetIds.every((id, i) => id === b.budgetIds[i])
  );
}
