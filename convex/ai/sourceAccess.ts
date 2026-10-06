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
  walk?: MaterialWalk,
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
    versionUntil = version.researchProofUntil ?? Number.MAX_SAFE_INTEGER;
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
) {
  const deadlines: number[] = [];
  for (const s of sources)
    deadlines.push(await currentRunSource(ctx, ws, accountId, s, walk));
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
