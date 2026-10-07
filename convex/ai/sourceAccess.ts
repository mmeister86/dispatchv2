import { runStyleProof } from "./styleProfiles";
import { runInputs } from "./contentCopies";
import { ideaProofUntil } from "../research/contentProof";
import {
  requireWorkspace,
  requireRole,
  requireActiveWorkspace,
} from "../lib/authorization";
import {
  enterMaterial,
  currentMaterialProof,
} from "../research/pipelineAccess";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { researchSourceProof } from "../research/contentProof";
import { currentContext } from "../integrations/github/contextAccess";
import { checkSource } from "../integrations/github/repositories";
import { materialWalk, type MaterialWalk } from "../research/pipelineAccess";
export async function currentRunSource(
  ctx: QueryCtx | MutationCtx,
  ws: Id<"workspaces">,
  accountId: Id<"socialAccounts"> | null,
  s: Doc<"agentRuns">["sources"][number],
  walk: MaterialWalk = materialWalk(),
  expectedAccountId?: Id<"socialAccounts"> | null,
) {
  let versionUntil = Number.MAX_SAFE_INTEGER;
  if (s.ideaVersionId) {
    const version = await ctx.db.get(s.ideaVersionId),
      idea = version ? await ctx.db.get(version.ideaId) : null;
    if (
      !version ||
      version.workspaceId !== ws ||
      version.sourceUnavailable ||
      !idea ||
      idea.workspaceId !== ws ||
      idea.status === "archived"
    )
      throw new ConvexError("IDEA_SOURCE_CHANGED");
    const origin = version.source;
    const matches =
      origin.kind === "context-set"
        ? origin.sources.some(
            (pin) => runSourceKey(pin, false) === runSourceKey(s, false),
          )
        : origin.kind === "research"
          ? "kind" in s &&
            runSourceKey(origin, false) === runSourceKey(s, false)
          : origin.kind === "context"
            ? !("kind" in s) && s.contextId === origin.contextId
            : origin.kind === "signal"
              ? !("kind" in s) &&
                s.signalId === origin.signalId &&
                s.repositoryId === origin.repositoryId &&
                s.generation === origin.generation
              : false;
    if (!matches) throw new ConvexError("IDEA_SOURCE_CHANGED");
    versionUntil =
      (await ideaProofUntil(
        ctx,
        version,
        walk,
        expectedAccountId === undefined
          ? (accountId ?? undefined)
          : expectedAccountId,
      )) ?? Number.MAX_SAFE_INTEGER;
  }
  let until: number;
  if ("kind" in s) {
    if (accountId && s.accountId !== accountId)
      throw new ConvexError("RESEARCH_CONTENT_ACCOUNT_CHANGED");
    until = await researchSourceProof(ctx, ws, s, walk);
  } else {
    if (s.contextId) {
      const { c } = await currentContext(ctx, s.contextId, true);
      if (
        c.workspaceId !== ws ||
        c.repositoryId !== s.repositoryId ||
        c.generation !== s.generation ||
        (s.signalId && c.signalId !== s.signalId)
      )
        throw new ConvexError("GITHUB_CONTEXT_CHANGED");
    }
    if (s.signalId) {
      const signal = await ctx.db.get(s.signalId);
      if (
        !signal ||
        signal.workspaceId !== ws ||
        signal.repositoryId !== s.repositoryId ||
        (!s.contextId && signal.generation !== s.generation)
      )
        throw new ConvexError("GITHUB_SOURCE_DISABLED");
    }
    until = Math.min(
      (await checkSource(ctx, ws, s.repositoryId, s.generation, "content"))
        .proofExpiresAt,
      s.proofUntil ?? Number.MAX_SAFE_INTEGER,
    );
  }
  until = Math.min(until, versionUntil);
  if (!Number.isFinite(until) || until <= Date.now())
    throw new ConvexError("MODEL_SOURCE_EXPIRED");
  return until;
}
export async function currentRunSources(
  ctx: QueryCtx | MutationCtx,
  ws: Id<"workspaces">,
  accountId: Id<"socialAccounts"> | null,
  sources: Doc<"agentRuns">["sources"],
  walk: MaterialWalk = materialWalk(),
  expectedAccountId?: Id<"socialAccounts"> | null,
) {
  const deadlines: number[] = [];
  for (const s of sources)
    deadlines.push(
      await currentRunSource(ctx, ws, accountId, s, walk, expectedAccountId),
    );
  return deadlines;
}
export function runSourceKey(
  s: Doc<"agentRuns">["sources"][number],
  lineage = true,
) {
  return JSON.stringify([
    "kind" in s
      ? [
          s.kind,
          s.evidenceId,
          s.evidenceFingerprint,
          s.accountId,
          s.orderId,
          s.sourceId,
          s.materialHash,
          s.sourceGeneration,
          s.modelOrigin
            ? [
                s.modelOrigin.runId,
                s.modelOrigin.promptMessageId,
                s.modelOrigin.promptVersion,
                s.modelOrigin.policyVersion,
                s.modelOrigin.outputHash,
              ]
            : null,
          s.assessmentFingerprint ?? null,
        ]
      : [s.repositoryId, s.generation, s.contextId ?? null, s.signalId ?? null],
    ...(lineage ? [s.ideaVersionId ?? null, s.proofUntil ?? null] : []),
  ]);
}

export async function retainedRunProof(
  ctx: QueryCtx,
  r: Doc<"agentRuns">,
  walk: MaterialWalk = materialWalk(),
  expectedAccountId?: Id<"socialAccounts"> | null,
): Promise<number | null> {
  const key = `run:${r._id}`;
  if (walk.active.has(key)) throw new ConvexError("STYLE_ANCESTRY_LIMIT");
  const memo = `${key}:${expectedAccountId === undefined ? "workspace" : (expectedAccountId ?? "none")}`;
  if (walk.done.has(memo)) return walk.done.get(memo)!;
  const inputs = await runInputs(ctx, r);
  const request = await ctx.db
    .query("contentRequests")
    .withIndex("by_runId", (q) => q.eq("runId", r._id))
    .unique();
  const recursive = !!(
    r.styleContext ||
    r.research ||
    r.sources.length ||
    inputs.length ||
    request
  );
  if (recursive) enterMaterial(walk, key, "STYLE_ANCESTRY_LIMIT");
  try {
    if (
      r.sourceCleanupState ||
      (r.sourceUntil != null && r.sourceUntil <= Date.now())
    )
      throw new ConvexError("MODEL_SOURCE_EXPIRED");
    requireActiveWorkspace(await ctx.db.get(r.workspaceId));
    const actor = await ctx.db.get(r.actorId);
    if (!actor) throw new ConvexError("MODEL_ACTOR_UNAVAILABLE");
    requireRole(
      (await requireWorkspace(ctx, r.workspaceId, actor)).membership,
      ["Owner", "Admin", "Editor"],
    );
    const account = await ctx.db.get(r.accountId);
    if (
      !account ||
      account.workspaceId !== r.workspaceId ||
      account.connection !== "connected" ||
      (account.xEvidence?.connectionSequence ?? 0) !==
        r.accountConnectionSequence
    )
      throw new ConvexError("MODEL_ACCOUNT_CHANGED");
    if (
      expectedAccountId !== undefined &&
      (((r.styleContext || r.research) && r.accountId !== expectedAccountId) ||
        r.sources.some((s) => "kind" in s && s.accountId !== expectedAccountId))
    )
      throw new ConvexError("RESEARCH_CONTENT_ACCOUNT_CHANGED");
    const inputAccount =
      expectedAccountId === undefined ? r.accountId : expectedAccountId;
    const horizons = [
      r.sourceUntil,
      (await runStyleProof(ctx, r, false, walk)).sourceUntil,
      ...(await currentRunSources(
        ctx,
        r.workspaceId,
        r.accountId,
        r.sources,
        walk,
        inputAccount,
      )),
    ];
    if (r.research) {
      const order = await ctx.db.get(r.research.orderId);
      if (
        !order ||
        order.workspaceId !== r.workspaceId ||
        order.accountId !== r.accountId ||
        order.pipeline?.runId !== r._id
      )
        throw new ConvexError("RESEARCH_RUN_OWNER_INVALID");
      horizons.push((await currentMaterialProof(ctx, order, walk)).proofUntil);
    }
    const ids = new Set(inputs.map((x) => x.ideaVersionId));
    if (request) {
      if (
        request.workspaceId !== r.workspaceId ||
        request.accountId !== r.accountId ||
        request.actorId !== r.actorId
      )
        throw new ConvexError("IDEA_SOURCE_CHANGED");
      if (request.outputKind && !request.routingOperationId)
        throw new ConvexError("ROUTING_RECEIPT_INVALID");
      if (request.routingOperationId) {
        const { routingProof } = await import("./jev/routing");
        horizons.push(
          (
            await routingProof(
              ctx,
              request.routingOperationId,
              request,
              false,
              walk,
              r,
            )
          ).sourceUntil,
        );
      }
      ids.add(request.inputVersionId);
    }
    for (const row of inputs)
      if (row.state !== "retained")
        throw new ConvexError("IDEA_SOURCE_CHANGED");
    for (const id of ids) {
      const v = await ctx.db.get(id);
      if (!v || v.workspaceId !== r.workspaceId)
        throw new ConvexError("IDEA_SOURCE_CHANGED");
      const owner = await ctx.db.get(v.ideaId);
      if (!owner || owner.status === "archived")
        throw new ConvexError("IDEA_SOURCE_CHANGED");
      horizons.push(await ideaProofUntil(ctx, v, walk, inputAccount));
    }
    const n = Math.min(...horizons.map((x) => x ?? Infinity));
    if (n <= Date.now()) throw new ConvexError("MODEL_SOURCE_EXPIRED");
    const until = Number.isFinite(n) ? n : null;
    walk.done.set(memo, until);
    return until;
  } finally {
    if (recursive) walk.active.delete(key);
  }
}
