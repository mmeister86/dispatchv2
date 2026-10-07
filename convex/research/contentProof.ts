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
  if (!idea && !ver.candidateVersionId) {
    if (ver.researchCleanupPending || ver.researchProofUntil !== undefined)
      throw new ConvexError("RESEARCH_CONTENT_SOURCE_CHANGED");
    return null;
  }
  const key = `draft:${ver._id}`;
  if (walk.active.has(key)) throw new ConvexError("STYLE_ANCESTRY_LIMIT");
  if (walk.done.has(key)) return walk.done.get(key)!;
  enterMaterial(walk, key, "STYLE_ANCESTRY_LIMIT");
  try {
    const until = idea
      ? await ideaProofUntil(ctx, idea, walk, ver.content.accountId)
      : null;
    const candidateParent = ver.candidateVersionId
      ? await ctx.db.get(ver.candidateVersionId)
      : null;
    if (
      ver.candidateVersionId &&
      (!candidateParent || candidateParent.workspaceId !== ver.workspaceId)
    )
      throw new ConvexError("IDEA_SOURCE_CHANGED");
    const candidateUntil = candidateParent
      ? await ideaProofUntil(ctx, candidateParent, walk, ver.content.accountId)
      : null;
    if (
      idea &&
      (idea.source.kind === "research" ||
        (idea.source.kind === "context-set" &&
          idea.source.sources.some((s) => "kind" in s)))
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
    const n = Math.min(
      until ?? Infinity,
      candidateUntil ?? Infinity,
      ver.researchProofUntil ?? Infinity,
    );
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
  if (
    ver.candidate &&
    accountId !== undefined &&
    ver.candidate.content.accountId !== accountId
  )
    throw new ConvexError("RESEARCH_CONTENT_ACCOUNT_CHANGED");
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
      if (ver.candidate)
        horizons.push(
          (await candidateProof(ctx, ver, false, walk)).sourceUntil,
        );
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
  const { candidateMediaChecksums: privateMedia, ...visible } = ver;
  try {
    const until = await ideaProofUntil(ctx, ver);
    if (!ver.sourceUnavailable)
      return until === null ? visible : { ...visible, sourceProofUntil: until };
  } catch (error) {
    rethrowUnexpectedSourceError(error);
    /* fail closed without changing history */
  }
  return {
    ...visible,
    candidate: undefined,
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

export async function candidateProof(
  ctx: QueryCtx,
  ver: Doc<"ideaVersions">,
  fresh = false,
  walk: MaterialWalk = materialWalk(),
) {
  const c = ver.candidate;
  if (
    !c ||
    ver.sourceUnavailable ||
    ver.sourceCleanupState ||
    !ver.runId ||
    !ver.inputVersionId ||
    !ver.candidateMediaChecksums ||
    !c.content.accountId
  )
    throw new ConvexError("IDEA_SOURCE_CHANGED");
  const run = await ctx.db.get(ver.runId);
  const request = await ctx.db
    .query("contentRequests")
    .withIndex("by_runId", (q) => q.eq("runId", ver.runId!))
    .unique();
  if (
    !run ||
    !request ||
    request.outputKind !== "social-post-candidate" ||
    request.routingOperationId !== c.routingOperationId ||
    request.routingCommandFingerprint !== c.commandFingerprint ||
    request.resultIdeaId !== ver.ideaId ||
    request.inputVersionId !== ver.inputVersionId ||
    request.workspaceId !== ver.workspaceId ||
    request.actorId !== ver.actorId ||
    request.accountId !== c.content.accountId ||
    run.actorId !== ver.actorId ||
    run.workspaceId !== ver.workspaceId ||
    run.accountId !== c.content.accountId
  )
    throw new ConvexError("IDEA_SOURCE_CHANGED");
  if (request.compositeParentId || request.composite)
    await (
      await import("../ai/jev/composite")
    ).parent(ctx, request.compositeParentId ?? request._id, fresh, walk);
  const { routingProof } = await import("../ai/jev/routing");
  const proof = await routingProof(
    ctx,
    c.routingOperationId,
    request,
    fresh,
    walk,
    run,
  );
  if (
    proof.operation.intent?.outputKind !== "social-post-candidate" ||
    JSON.stringify(proof.operation.intent.media) !==
      JSON.stringify(c.content.media) ||
    JSON.stringify(proof.operation.candidateMediaChecksums) !==
      JSON.stringify(ver.candidateMediaChecksums) ||
    !c.content.text.length ||
    c.content.text.some((t) => !t.trim()) ||
    (await candidateContentHash(c.content)) !== c.contentHash ||
    (await sha256(
      JSON.stringify([
        c.contentHash,
        c.commandFingerprint,
        ver.inputVersionId,
        run._id,
        ver.actorId,
        ver.workspaceId,
        request.accountId,
        run.styleContext ?? null,
        ver.candidateMediaChecksums,
      ]),
    )) !== c.provenanceHash
  )
    throw new ConvexError("IDEA_SOURCE_CHANGED");
  const { validateContent, immutableMedia } = await import("../editorial");
  try {
    await validateContent(ctx, ver.workspaceId, c.content);
    await immutableMedia(ctx, {
      content: c.content,
      mediaChecksums: ver.candidateMediaChecksums,
    });
  } catch (error) {
    if (
      error instanceof ConvexError &&
      [
        "MEDIA_NOT_READY",
        "MEDIA_SNAPSHOT_CHANGED",
        "CAPABILITY_VALIDATION_FAILED",
      ].includes(String(error.data))
    )
      throw new ConvexError("IDEA_SOURCE_CHANGED");
    throw error;
  }
  if (fresh) {
    const owner = await ctx.db.get(ver.ideaId);
    if (
      !owner ||
      owner.currentVersionId !== ver._id ||
      owner.status === "archived"
    )
      throw new ConvexError("ROUTING_SUPERSEDED");
  }
  const retained = await retainedRunProof(ctx, run, walk, c.content.accountId);
  const n = Math.min(
    proof.sourceUntil ?? Infinity,
    retained ?? Infinity,
    ver.researchProofUntil ?? Infinity,
  );
  return {
    operation: proof.operation,
    sourceUntil: Number.isFinite(n) ? n : null,
  };
}

export function candidateContentHash(c: Doc<"draftVersions">["content"]) {
  return sha256(
    JSON.stringify([
      c.title,
      c.text,
      c.media.map((m) => [m.assetId, m.alt]),
      c.accountId,
      c.pillar,
      c.strategy,
    ]),
  );
}
