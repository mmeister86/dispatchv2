import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import { retainedRunProof, currentRunSources } from "../ai/sourceAccess";
import {
  enterMaterial,
  materialWalk,
  type MaterialWalk,
} from "./pipelineAccess";
import { sha256 } from "../lib/crypto";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { currentEvidence } from "./evidence";
import { currentIdeaSource } from "../content/ideas";
import { requireReference } from "../lib/authorization";
export async function researchSourceProof(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  source: Extract<Doc<"ideaVersions">["source"], { kind: "research" }>,
  walk: MaterialWalk = materialWalk(),
) {
  const p = await currentEvidence(
    ctx,
    ws,
    source.evidenceId,
    source.accountId,
    walk,
  );
  if (
    source.proofUntil <= Date.now() ||
    p.e.fingerprint !== source.evidenceFingerprint ||
    p.e.orderId !== source.orderId ||
    p.e.sourceId !== source.sourceId ||
    p.e.materialHash !== source.materialHash ||
    p.e.sourceGeneration !== source.sourceGeneration ||
    JSON.stringify(p.e.modelOrigin) !== JSON.stringify(source.modelOrigin) ||
    (p.e.assessment
      ? await sha256(JSON.stringify(p.e.assessment))
      : undefined) !== source.assessmentFingerprint
  )
    throw new ConvexError("RESEARCH_CONTENT_SOURCE_CHANGED");
  return Math.min(source.proofUntil, p.proofUntil);
}
export async function draftIdeaVersion(
  ctx: QueryCtx,
  ver: Doc<"draftVersions">,
) {
  // Known pre-migration handoffs have an exact reverse relation; source strings are never authority.
  const legacy = !ver.ideaVersionId
    ? await ctx.db
        .query("ideas")
        .withIndex("by_handoff_draftId", (q) =>
          q.eq("handoff.draftId", ver.draftId),
        )
        .unique()
    : null;
  const id = ver.ideaVersionId ?? legacy?.handoff?.ideaVersionId;
  return id
    ? (requireReference(
        ver.workspaceId,
        await ctx.db.get(id),
      ) as Doc<"ideaVersions">)
    : null;
}
export async function draftResearchProof(
  ctx: QueryCtx,
  ver: Doc<"draftVersions">,
  walk: MaterialWalk = materialWalk(),
) {
  if (ver.sourceUnavailable)
    throw new ConvexError("RESEARCH_CONTENT_SOURCE_CHANGED");
  const idea = await draftIdeaVersion(ctx, ver);
  if (!idea) {
    if (ver.researchCleanupPending || ver.researchProofUntil !== undefined)
      throw new ConvexError("RESEARCH_CONTENT_SOURCE_CHANGED");
    return null;
  }
  const key = `draft:${ver._id}`;
  if (walk.active.has(key)) throw new ConvexError("STYLE_ANCESTRY_LIMIT");
  if (walk.done.has(key)) return walk.done.get(key)!;
  enterMaterial(walk, key, "STYLE_ANCESTRY_LIMIT");
  try {
    const until = await ideaProofUntil(ctx, idea, walk, ver.content.accountId);
    if (
      idea.source.kind === "research" ||
      (idea.source.kind === "context-set" &&
        idea.source.sources.some((s) => "kind" in s))
    ) {
      if (
        (ver.researchProofUntil ?? 0) <= Date.now() ||
        (idea.source.kind === "research"
          ? ver.content.accountId !== idea.source.accountId
          : idea.source.sources.some(
              (s) => "kind" in s && s.accountId !== ver.content.accountId,
            ))
      )
        throw new ConvexError("RESEARCH_CONTENT_SOURCE_CHANGED");
    }
    const n = Math.min(until ?? Infinity, ver.researchProofUntil ?? Infinity);
    const horizon = Number.isFinite(n) ? n : null;
    walk.done.set(key, horizon);
    return horizon;
  } finally {
    walk.active.delete(key);
  }
}
export async function ideaProofUntil(
  ctx: QueryCtx,
  ver: Doc<"ideaVersions">,
  walk: MaterialWalk = materialWalk(),
  accountId?: Id<"socialAccounts"> | null,
): Promise<number | null> {
  const key = `idea:${ver._id}`;
  if (walk.active.has(key)) throw new ConvexError("STYLE_ANCESTRY_LIMIT");
  const memo = `${key}:${accountId === undefined ? "workspace" : (accountId ?? "none")}`;
  if (walk.done.has(memo)) return walk.done.get(memo)!;
  const idea = await ctx.db.get(ver.ideaId);
  if (!idea || idea.workspaceId !== ver.workspaceId || ver.sourceUnavailable)
    throw new ConvexError("IDEA_SOURCE_CHANGED");
  const recursive = !!(
    ver.runId ||
    ver.inputVersionId ||
    ver.source.kind !== "note"
  );
  if (recursive) enterMaterial(walk, key, "STYLE_ANCESTRY_LIMIT");
  try {
    const sources = await currentIdeaSource(
      ctx,
      ver.workspaceId,
      ver.source,
      walk,
    );
    const horizons: (number | null | undefined)[] = [
      ver.researchProofUntil,
      ...(await currentRunSources(
        ctx,
        ver.workspaceId,
        accountId ?? null,
        sources,
        walk,
      )),
    ];
    if (ver.runId) {
      const run = await ctx.db.get(ver.runId);
      if (!run || run.workspaceId !== ver.workspaceId)
        throw new ConvexError("IDEA_SOURCE_CHANGED");
      horizons.push(await retainedRunProof(ctx, run, walk, accountId));
    }
    if (ver.inputVersionId) {
      const parent = await ctx.db.get(ver.inputVersionId);
      if (!parent || parent.workspaceId !== ver.workspaceId)
        throw new ConvexError("IDEA_SOURCE_CHANGED");
      const owner = await ctx.db.get(parent.ideaId);
      if (!owner || owner.status === "archived")
        throw new ConvexError("IDEA_SOURCE_CHANGED");
      horizons.push(await ideaProofUntil(ctx, parent, walk, accountId));
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
export async function projectIdea(ctx: QueryCtx, ver: Doc<"ideaVersions">) {
  try {
    const until = await ideaProofUntil(ctx, ver);
    if (!ver.sourceUnavailable)
      return until === null ? ver : { ...ver, sourceProofUntil: until };
  } catch (error) {
    rethrowUnexpectedSourceError(error);
    /* fail closed without changing history */
  }
  return {
    ...ver,
    sourceUnavailable: true,
    title: "",
    note: "",
    perspective: "",
    originals: [],
    rationale: "",
    questions: [],
  };
}
export async function projectDraft(ctx: QueryCtx, ver: Doc<"draftVersions">) {
  try {
    const until = await draftResearchProof(ctx, ver);
    return until === null ? ver : { ...ver, sourceProofUntil: until };
  } catch (error) {
    rethrowUnexpectedSourceError(error);
    return {
      ...ver,
      sourceUnavailable: true,
      content: {
        ...ver.content,
        title: "",
        text: ver.content.text.map(() => ""),
        media: ver.content.media.map((ref) => ({ ...ref, alt: "" })),
        pillar: "",
        strategy: "",
      },
      reason: "",
    };
  }
}

export async function evidenceSource(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  id: Id<"researchEvidence">,
  accountId: Id<"socialAccounts">,
) {
  const proof = await currentEvidence(ctx, ws, id, accountId),
    { e, proofUntil } = proof;
  return {
    ...proof,
    source: {
      kind: "research" as const,
      evidenceId: e._id,
      evidenceFingerprint: e.fingerprint,
      accountId: e.accountId,
      orderId: e.orderId,
      sourceId: e.sourceId,
      materialHash: e.materialHash,
      sourceGeneration: e.sourceGeneration,
      ...(e.modelOrigin ? { modelOrigin: e.modelOrigin } : {}),
      ...(e.assessment
        ? { assessmentFingerprint: await sha256(JSON.stringify(e.assessment)) }
        : {}),
      proofUntil,
    },
  };
}
