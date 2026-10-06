import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import { currentRunSources } from "../ai/sourceAccess";
import { materialWalk, type MaterialWalk } from "./pipelineAccess";
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
  const idea = await draftIdeaVersion(ctx, ver);
  if (!idea) return null;
  if (
    idea.source.kind !== "research" &&
    (idea.source.kind !== "context-set" ||
      !idea.source.sources.some((s) => "kind" in s))
  ) {
    return ideaProofUntil(ctx, idea, walk);
  }
  if (
    ver.sourceUnavailable ||
    (ver.researchProofUntil ?? 0) <= Date.now() ||
    (idea.source.kind === "research"
      ? ver.content.accountId !== idea.source.accountId
      : idea.source.sources.some(
          (s) => "kind" in s && s.accountId !== ver.content.accountId,
        ))
  )
    throw new ConvexError("RESEARCH_CONTENT_SOURCE_CHANGED");
  return Math.min(
    ver.researchProofUntil!,
    idea.source.kind === "research"
      ? await researchSourceProof(ctx, ver.workspaceId, idea.source, walk)
      : Math.min(
          ...(await currentRunSources(
            ctx,
            ver.workspaceId,
            null,
            idea.source.sources,
            walk,
          )),
        ),
  );
}
export async function ideaProofUntil(
  ctx: QueryCtx,
  ver: Doc<"ideaVersions">,
  walk: MaterialWalk = materialWalk(),
) {
  await currentIdeaSource(ctx, ver.workspaceId, ver.source, walk);
  if (ver.source.kind === "context-set")
    return Math.min(
      ...(await currentRunSources(
        ctx,
        ver.workspaceId,
        null,
        ver.source.sources,
        walk,
      )),
    );
  if (ver.source.kind === "research")
    return researchSourceProof(ctx, ver.workspaceId, ver.source, walk);
  if (ver.source.kind === "note") return null;
  const repositoryId =
    ver.source.kind === "signal"
      ? ver.source.repositoryId
      : (await ctx.db.get(ver.source.contextId))!.repositoryId;
  return (await ctx.db.get(repositoryId))!.proofExpiresAt;
}
export async function projectIdea(ctx: QueryCtx, ver: Doc<"ideaVersions">) {
  if (ver.source.kind === "note") return ver;
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
