import { currentMaterialProof } from "./pipelineAccess";
import { historyAuthority } from "../ai/conversationAccess";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import {
  requireReference,
  requireRole,
  requireWorkspace,
} from "../lib/authorization";
import { sha256 } from "../lib/crypto";
type Ctx = QueryCtx | MutationCtx;
export type Operation = Doc<"researchSourcePolicies">["operation"];
export function provider(op: Operation) {
  return op === "web-search" ? "requesty" : "x";
}
export const fingerprint = (p: Doc<"researchSourcePolicies">) =>
  sha256(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(p).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  );
export function credential(op: Operation) {
  return op === "web-search"
    ? process.env.REQUESTY_API_KEY
    : process.env.X_APP_BEARER_TOKEN;
}
const finite = (n: number, max: number) =>
  Number.isSafeInteger(n) && n > 0 && n <= max;
export async function policy(
  ctx: Ctx,
  ws: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
  op: Operation,
) {
  const p = await ctx.db
    .query("researchSourcePolicies")
    .withIndex("by_workspaceId_and_accountId_and_operation", (q) =>
      q.eq("workspaceId", ws).eq("accountId", accountId).eq("operation", op),
    )
    .unique();
  const now = Date.now(),
    key = credential(op);
  if (
    !p ||
    !p.enabled ||
    !finite(p.generation, 1e9) ||
    !p.version ||
    p.version.length > 100 ||
    p.authMode !== "app-only" ||
    p.expiresAt <= now ||
    p.lifecycleValidUntil <= now ||
    !finite(p.retentionMs, 86400000) ||
    !finite(p.unitMicros, 1e12) ||
    !finite(p.allocatedProviderLimitMicros, 1e12) ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !key ||
    (await sha256(key)) !== p.credentialFingerprint ||
    [
      p.accessEvidence,
      p.processingEvidence,
      p.pricingEvidence,
      p.rightsEvidence,
      p.protocolEvidence,
      p.lifecycleEvidence,
      p.totalChargeBoundEvidence,
      p.allocationEvidence,
    ].some((s) => !s.trim() || s.length > 2000)
  )
    throw new ConvexError("RESEARCH_SOURCE_CONFIGURATION_REQUIRED");
  if (
    op === "web-search"
      ? p.protocol !== "requesty-chat-web-search-v1" ||
        p.unit !== "total-request" ||
        !p.model ||
        !/^[A-Za-z0-9_.:/-]{1,200}$/.test(p.model)
      : op === "x-recent"
        ? p.protocol !== "x-post-fields-v2" || p.unit !== "post"
        : p.protocol !== "x-woeid-v2" ||
          p.unit !== "request" ||
          p.woeid === null ||
          !finite(p.woeid, 2147483647)
  )
    throw new ConvexError("RESEARCH_SOURCE_CONFIGURATION_REQUIRED");
  const approver = await ctx.db.get(p.approvedBy);
  if (!approver)
    throw new ConvexError("RESEARCH_SOURCE_CONFIGURATION_REQUIRED");
  requireRole((await requireWorkspace(ctx, ws, approver)).membership, [
    "Owner",
    "Admin",
  ]);
  requireReference(ws, await ctx.db.get(accountId));
  return p;
}
export async function grants(
  ctx: Ctx,
  p: Doc<"researchSourcePolicies">,
  ids?: Id<"aiBudgets">[],
) {
  const result: Id<"aiBudgets">[] = [];
  const keys = [
    `native:${provider(p.operation)}`,
    `native:workspace:${p.workspaceId}`,
    `native:account:${p.accountId}`,
  ];
  for (const [i, scope] of (
    ["provider", "workspace", "account"] as const
  ).entries()) {
    const b = ids
      ? await ctx.db.get(ids[i])
      : await ctx.db
          .query("aiBudgets")
          .withIndex("by_key", (q) => q.eq("key", keys[i]))
          .unique();
    if (
      !b ||
      b.key !== keys[i] ||
      (scope === "provider" &&
        b.limitMicros !== p.allocatedProviderLimitMicros) ||
      b.scope !== scope ||
      (scope !== "provider" &&
        (b.workspaceId !== p.workspaceId || !b.approvedBy)) ||
      (scope === "account" && b.accountId !== p.accountId) ||
      b.policyVersion !== p.version ||
      b.currency !== p.currency ||
      !b.purposes.includes("native-search") ||
      b.expiresAt <= Date.now() ||
      !finite(b.limitMicros, 1e12) ||
      !Number.isSafeInteger(b.heldMicros) ||
      b.heldMicros < 0 ||
      !Number.isSafeInteger(b.spentMicros) ||
      b.spentMicros < 0
    )
      throw new ConvexError("RESEARCH_BUDGET_CONFIGURATION_REQUIRED");
    if (b.approvedBy) {
      const u = await ctx.db.get(b.approvedBy);
      if (!u) throw new ConvexError("RESEARCH_BUDGET_CONFIGURATION_REQUIRED");
      requireRole((await requireWorkspace(ctx, p.workspaceId, u)).membership, [
        "Owner",
        "Admin",
      ]);
    }
    result.push(b._id);
  }
  return result;
}
export async function orderAuthority(
  ctx: Ctx,
  orderId: Id<"researchOrders">,
  generation?: number,
) {
  const o = await ctx.db.get(orderId);
  if (
    !o?.native ||
    (o.state !== "queued" && o.state !== "running") ||
    o.deadline <= Date.now() ||
    (generation !== undefined && generation !== o.generation)
  )
    throw new ConvexError("RESEARCH_ORDER_INACTIVE");
  if (o.reResearch) await currentMaterialProof(ctx, o);
  if (o.targetedChat) {
    const c = await ctx.db.get(o.targetedChat.conversationId);
    if (
      !c ||
      c.state !== "active" ||
      c.workspaceId !== o.workspaceId ||
      c.accountId !== o.accountId ||
      c.actorId !== o.actorId
    )
      throw new ConvexError("RESEARCH_CHAT_OWNER_UNAVAILABLE");
    await historyAuthority(ctx, c);
  }
  const p = await ctx.db.get(o.profileId),
    version = await ctx.db.get(o.profileVersionId),
    actor = await ctx.db.get(o.actorId);
  requireReference(o.workspaceId, p);
  requireReference(o.workspaceId, version);
  const account = await ctx.db.get(o.accountId);
  requireReference(o.workspaceId, account);
  if (account!.providerIdentity !== o.native.accountIdentity)
    throw new ConvexError("RESEARCH_ACCOUNT_CHANGED");
  if (
    !actor ||
    p!.paused ||
    p!.deleted ||
    p!.accountId !== o.accountId ||
    p!.activeOrderId !== o._id ||
    version!.profileId !== p!._id
  )
    throw new ConvexError("RESEARCH_ORDER_INACTIVE");
  requireRole(
    (await requireWorkspace(ctx, o.workspaceId, actor)).membership,
    o.pipeline && o.occasion === "scheduled"
      ? ["Owner", "Admin"]
      : ["Owner", "Admin", "Editor"],
  );
  return o;
}
export async function sourceAuthority(
  ctx: Ctx,
  o: Doc<"researchOrders">,
  op: Operation,
) {
  const actor = await ctx.db.get(o.actorId);
  if (!actor) throw new ConvexError("RESEARCH_ACTOR_UNAVAILABLE");
  requireRole(
    (await requireWorkspace(ctx, o.workspaceId, actor)).membership,
    o.pipeline && o.occasion === "scheduled"
      ? ["Owner", "Admin"]
      : ["Owner", "Admin", "Editor"],
  );
  const account = await ctx.db.get(o.accountId);
  requireReference(o.workspaceId, account);
  if (account!.providerIdentity !== o.native!.accountIdentity)
    throw new ConvexError("RESEARCH_ACCOUNT_CHANGED");
  const i = o.native!.operations.indexOf(op),
    captured = o.native!.approvals[i];
  if (i < 0 || !captured)
    throw new ConvexError("RESEARCH_SOURCE_CONFIGURATION_REQUIRED");
  const p = await policy(ctx, o.workspaceId, o.accountId, op);
  if (
    p._id !== captured.policyId ||
    (await fingerprint(p)) !== captured.fingerprint
  )
    throw new ConvexError("RESEARCH_SOURCE_CHANGED");
  if (op !== "web-search") {
    const a = await ctx.db.get(o.accountId);
    if (
      a!.provider !== "X" ||
      a!.connection !== "connected" ||
      (a!.xEvidence?.connectionSequence ?? 0) !== o.accountSequence
    )
      throw new ConvexError("RESEARCH_X_ACCOUNT_CHANGED");
  }
  await grants(ctx, p, captured.budgetIds);
  return { p, captured };
}

// Validate the immutable filling-owner graph, independently of current source permission or grant expiry.
export async function nativeAttempt(ctx: Ctx, attemptId: Id<"aiAttempts">) {
  const t = await ctx.db.get(attemptId);
  if (!t || t.owner !== "native-search" || t.runId !== undefined)
    throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
  const o = await ctx.db.get(t.researchOrderId),
    c = await ctx.db.get(t.cacheId);
  const captured =
    o?.native?.approvals[o.native.operations.indexOf(t.operation)];
  if (
    !captured ||
    captured.policyId !== t.policyId ||
    captured.fingerprint !== t.policyFingerprint ||
    t.budgetIds.length !== 3 ||
    new Set(t.budgetIds).size !== 3 ||
    captured.budgetIds.length !== t.budgetIds.length ||
    captured.budgetIds.some((id, i) => id !== t.budgetIds[i]) ||
    c?.operation !== t.operation ||
    c?.generation !== t.generation ||
    o?.config.cap?.currency !== t.currency ||
    !o?.native ||
    !c ||
    o.workspaceId !== t.workspaceId ||
    o.accountId !== t.accountId ||
    c.workspaceId !== t.workspaceId ||
    c.accountId !== t.accountId ||
    c.orderId !== o._id ||
    c.attemptId !== t._id ||
    c.logicalIntent !== t.logicalIntent ||
    c.policyId !== t.policyId ||
    c.policyFingerprint !== t.policyFingerprint ||
    !o.native.operations.includes(t.operation)
  )
    throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
  for (const [i, id] of t.budgetIds.entries()) {
    const b = await ctx.db.get(id);
    if (
      !b ||
      b.currency !== t.currency ||
      (i === 0 &&
        (b.scope !== "provider" ||
          b.workspaceId !== undefined ||
          b.accountId !== undefined)) ||
      (i === 1 &&
        (b.scope !== "workspace" ||
          b.workspaceId !== t.workspaceId ||
          b.accountId !== undefined)) ||
      (i === 2 &&
        (b.scope !== "account" ||
          b.workspaceId !== t.workspaceId ||
          b.accountId !== t.accountId))
    )
      throw new ConvexError("RESEARCH_ATTEMPT_OWNER_INVALID");
  }
  return { t, o, c };
}
