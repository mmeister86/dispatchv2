import { resolveQuestions } from "../ai/jev/questions";
import { sha256 } from "../lib/crypto";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
} from "../lib/authorization";
import {
  algorithmDoc,
  audienceDoc,
  commandArgs,
  result,
  selectionDoc,
  receiptDoc,
  refs,
} from "./sharedFields";
export async function authorized(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  id: Id<"users">,
) {
  const user = await ctx.db.get(id);
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", id).eq("workspaceId", ws),
    )
    .unique();
  return !!user && !!m && (m.role === "Owner" || m.role === "Admin");
}
// Legacy profiles have no update provenance and retain their original contract.
export async function updateProof(ctx: QueryCtx, p: Doc<"algorithmProfiles">) {
  return profileUpdateProof(ctx, p, true);
}
// Archive declarations keep their exact structural provenance after the live review window.
export async function retainedUpdateProof(
  ctx: QueryCtx,
  p: Doc<"algorithmProfiles">,
) {
  return profileUpdateProof(ctx, p, false);
}
async function profileUpdateProof(
  ctx: QueryCtx,
  p: Doc<"algorithmProfiles">,
  live: boolean,
) {
  if (!p.update) return true;
  const proposal = await ctx.db.get(p.update.proposalId),
    evaluation = await ctx.db.get(p.update.evaluationId);
  if (
    !proposal ||
    proposal.kind !== "proposal" ||
    !evaluation ||
    evaluation.kind !== "evaluation"
  )
    return false;
  const original = await ctx.db.get(proposal.baseProfileId),
    receipt = await ctx.db.get(proposal.checkId);
  const variant =
    p.payload.version === "x-post-analysis-v1"
      ? "post-analysis"
      : "public-context";
  const scopeMatches = (r: typeof proposal | typeof evaluation) =>
    r.workspaceId === p.workspaceId &&
    r.accountId === p.accountId &&
    r.network === p.network &&
    r.surface === p.surface;
  if (
    !original ||
    !receipt ||
    receipt.kind !== "check" ||
    receipt.state !== "proposed" ||
    receipt.proposalId !== proposal._id ||
    receipt.workspaceId !== p.workspaceId ||
    receipt.accountId !== p.accountId ||
    receipt.baseIdentity !== proposal.baseIdentity ||
    receipt.baseProfileId !== proposal.baseProfileId ||
    JSON.stringify(receipt.observation) !==
      JSON.stringify(proposal.observation) ||
    (p.review !== null && p.review.actorId === evaluation.actorId) ||
    !scopeMatches(proposal) ||
    !scopeMatches(evaluation) ||
    original.workspaceId !== p.workspaceId ||
    original.accountId !== p.accountId ||
    original.network !== p.network ||
    original.surface !== p.surface ||
    evaluation.proposalId !== proposal._id ||
    evaluation.baseProfileId !== proposal.baseProfileId ||
    evaluation.baseIdentity !== proposal.baseIdentity ||
    evaluation.baseCommit !== proposal.baseCommit ||
    evaluation.headCommit !== proposal.headCommit ||
    evaluation.variant !== variant ||
    proposal.baseCommit !== original.payload.commit ||
    proposal.baseIdentity !==
      (await sha256(JSON.stringify(original.payload))) ||
    proposal.headCommit !== proposal.observation.commit ||
    !proposal.observation.complete ||
    proposal.observation.issues.length ||
    proposal.observation.evidence.length !== 13 ||
    proposal.observation.reviewDueAt !==
      proposal.observation.observedAt + 7 * 86400000 ||
    p.payload.commit !== proposal.observation.commit ||
    !/^[a-f0-9]{40}$/.test(p.payload.commit) ||
    p.payload.commitAt !== proposal.observation.commitAt ||
    p.payload.observedAt !== proposal.observation.observedAt ||
    p.payload.reviewDueAt !== proposal.observation.reviewDueAt ||
    (live && p.payload.reviewDueAt <= Date.now()) ||
    JSON.stringify(p.payload.evidence) !==
      JSON.stringify(proposal.observation.evidence) ||
    Object.entries(p.payload.refs).some(
      ([key, value]) =>
        evaluation.refs[key as keyof typeof evaluation.refs] !== value,
    ) ||
    !evaluation.fullSourceReview ||
    !evaluation.interpretation.trim() ||
    !evaluation.impact.trim() ||
    !evaluation.rationale.trim() ||
    evaluation.createdAt < proposal.createdAt ||
    evaluation.createdAt >= proposal.observation.reviewDueAt ||
    !evaluation.reference.passed ||
    evaluation.reference.version !== "source-compatibility-v1" ||
    (live && !(await authorized(ctx, p.workspaceId, evaluation.actorId)))
  )
    return false;
  const contract = await sourceReferenceContract(p);
  return evaluation.reference.contract === contract;
}
export async function sourceReferenceContract(p: Doc<"algorithmProfiles">) {
  const r = p.payload.refs;
  const refs = [
    r.questionSet,
    r.normalization,
    r.formula,
    r.routing,
    r.verification,
  ];
  return sha256(
    JSON.stringify({
      refs,
      definition:
        p.payload.version === "x-post-analysis-v1" ? resolveQuestions(p) : null,
      version: "source-compatibility-v1",
    }),
  );
}
async function usable(
  ctx: QueryCtx,
  p: Doc<"algorithmProfiles"> | Doc<"audienceProfiles">,
) {
  return (
    p.status === "reviewed" &&
    p.review !== null &&
    (await authorized(ctx, p.workspaceId, p.createdBy)) &&
    (await authorized(ctx, p.workspaceId, p.review.actorId)) &&
    (!("reviewDueAt" in p.payload) ||
      (fresh(p as Doc<"algorithmProfiles">) &&
        (await updateProof(ctx, p as Doc<"algorithmProfiles">))))
  );
}
async function version<T extends "algorithmProfiles" | "audienceProfiles">(
  ctx: QueryCtx,
  table: T,
  id: Id<T>,
  ws: Id<"workspaces">,
  acc: Id<"socialAccounts">,
) {
  const p = await ctx.db.get(id);
  if (
    !p ||
    p.workspaceId !== ws ||
    p.accountId !== acc ||
    p.network !== "x" ||
    p.surface !== "for_you"
  )
    throw new ConvexError("INTELLIGENCE_REFERENCE_ACCESS_DENIED");
  return p;
}
export const change = workspaceMutation({
  args: {
    ...commandArgs,
    action: v.union(
      v.object({
        kind: v.literal("review-algorithm"),
        algorithmId: v.id("algorithmProfiles"),
        reason: v.string(),
      }),
      v.object({
        kind: v.literal("review-audience"),
        audienceId: v.id("audienceProfiles"),
        reason: v.string(),
      }),
      v.object({
        kind: v.literal("retire-algorithm"),
        algorithmId: v.id("algorithmProfiles"),
        reason: v.string(),
      }),
      v.object({
        kind: v.literal("retire-audience"),
        audienceId: v.id("audienceProfiles"),
        reason: v.string(),
      }),
      v.object({
        kind: v.union(v.literal("select"), v.literal("rollback")),
        algorithmId: v.union(v.id("algorithmProfiles"), v.null()),
        audienceId: v.union(v.id("audienceProfiles"), v.null()),
        reason: v.string(),
      }),
    ),
  },
  returns: result,
  handler: async (ctx, a) => {
    const b = await begin(ctx, a, { kind: "change", ...a });
    if (b.receipt) return replay(b.receipt);
    const x = a.action;
    text(x.reason);
    const algorithmId = "algorithmId" in x ? x.algorithmId : null,
      audienceId = "audienceId" in x ? x.audienceId : null;
    const alg = algorithmId
      ? await version(
          ctx,
          "algorithmProfiles",
          algorithmId,
          ctx.workspace._id,
          a.accountId,
        )
      : null;
    const aud = audienceId
      ? await version(
          ctx,
          "audienceProfiles",
          audienceId,
          ctx.workspace._id,
          a.accountId,
        )
      : null;
    if (x.kind === "select" || x.kind === "rollback") {
      if (
        (alg && !(await usable(ctx, alg))) ||
        (aud && !(await usable(ctx, aud)))
      )
        throw new ConvexError("INTELLIGENCE_CURRENT_REVIEW_REQUIRED");
      if (x.kind === "rollback") {
        const history = await Promise.all(
          ["select", "rollback"].map((action) =>
            ctx.db
              .query("intelligenceProfileReceipts")
              .withIndex("by_selection", (q) =>
                q
                  .eq("workspaceId", ctx.workspace._id)
                  .eq("accountId", a.accountId)
                  .eq("network", "x")
                  .eq("surface", "for_you")
                  .eq("algorithmId", algorithmId)
                  .eq("audienceId", audienceId)
                  .eq("action", action),
              )
              .first(),
          ),
        );
        if (!history.some(Boolean))
          throw new ConvexError("INTELLIGENCE_ROLLBACK_TARGET_INVALID");
      }
      return finish(
        ctx,
        a,
        b,
        x.kind,
        x.reason,
        { algorithmId, audienceId },
        { algorithmId, audienceId },
      );
    }
    const p = alg ?? aud!;
    if (p.status === "retired")
      throw new ConvexError("INTELLIGENCE_PROFILE_RETIRED");
    if (x.kind === "review-algorithm" || x.kind === "review-audience") {
      if (alg && alg.payload.reviewDueAt <= Date.now())
        throw new ConvexError("INTELLIGENCE_SOURCE_REVIEW_EXPIRED");
      if (!(await authorized(ctx, p.workspaceId, p.createdBy)))
        throw new ConvexError("INTELLIGENCE_AUTHOR_REVIEW_REQUIRED");
      if (alg?.update) {
        const evaluation = await ctx.db.get(alg.update.evaluationId);
        if (
          !(await updateProof(ctx, alg)) ||
          !evaluation ||
          evaluation.actorId === ctx.user._id
        )
          throw new ConvexError("INTELLIGENCE_SOURCE_REVIEW_REQUIRED");
      }
      await ctx.db.patch(p._id, {
        status: "reviewed",
        review: { actorId: ctx.user._id, at: Date.now(), reason: x.reason },
      });
      return finish(ctx, a, b, x.kind, x.reason, { algorithmId, audienceId });
    }
    await ctx.db.patch(p._id, { status: "retired", retiredAt: Date.now() });
    return finish(
      ctx,
      a,
      b,
      x.kind,
      x.reason,
      { algorithmId, audienceId },
      {
        algorithmId:
          b.current?.algorithmId === algorithmId && alg
            ? null
            : (b.current?.algorithmId ?? null),
        audienceId:
          b.current?.audienceId === audienceId && aud
            ? null
            : (b.current?.audienceId ?? null),
      },
    );
  },
});
const capture = v.object({
  refs: v.union(refs, v.null()),
  revision: v.number(),
  algorithmId: v.union(v.id("algorithmProfiles"), v.null()),
  audienceId: v.union(v.id("audienceProfiles"), v.null()),
  usable: v.boolean(),
  missing: v.array(v.string()),
  aggregate: v.null(),
  audienceFit: v.literal("unavailable"),
  history: v.object({
    value: v.literal(0.5),
    basis: v.literal("assumed_cold_start_baseline"),
  }),
});
export const get = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.object({
    selection: v.union(selectionDoc, v.null()),
    algorithms: v.array(algorithmDoc),
    audiences: v.array(audienceDoc),
    capture,
  }),
  handler: async (ctx, a) => {
    await account(ctx, ctx.workspace._id, a.accountId);
    const current = await selection(ctx, ctx.workspace._id, a.accountId);
    // ponytail: bounded recent versions; paginate this history when accounts exceed 50 versions.
    const algorithms = await ctx.db
      .query("algorithmProfiles")
      .withIndex("by_scope", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("accountId", a.accountId)
          .eq("network", "x")
          .eq("surface", "for_you"),
      )
      .order("desc")
      .take(50);
    const audiences = await ctx.db
      .query("audienceProfiles")
      .withIndex("by_scope", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("accountId", a.accountId)
          .eq("network", "x")
          .eq("surface", "for_you"),
      )
      .order("desc")
      .take(50);
    const alg = current?.algorithmId
      ? await version(
          ctx,
          "algorithmProfiles",
          current.algorithmId,
          ctx.workspace._id,
          a.accountId,
        )
      : null;
    const aud = current?.audienceId
      ? await version(
          ctx,
          "audienceProfiles",
          current.audienceId,
          ctx.workspace._id,
          a.accountId,
        )
      : null;
    if (alg && !algorithms.some((p) => p._id === alg._id)) algorithms.push(alg);
    if (aud && !audiences.some((p) => p._id === aud._id)) audiences.push(aud);
    const activation = current?.selectedBy
      ? await authorized(ctx, ctx.workspace._id, current.selectedBy)
      : false;
    const algUsable = !!alg && (await usable(ctx, alg)),
      audUsable = !!aud && (await usable(ctx, aud));
    const missing = [
      ...(!alg ? ["algorithm"] : !algUsable ? ["algorithm-review"] : []),
      ...(!aud ? ["audience"] : !audUsable ? ["audience-review"] : []),
      ...(alg && !activation ? ["selection-authority"] : []),
      "embedding",
      "analysis",
    ];
    return {
      selection: current,
      algorithms,
      audiences,
      capture: {
        refs: alg?.payload.refs ?? null,
        revision: current?.revision ?? 0,
        algorithmId: current?.algorithmId ?? null,
        audienceId: current?.audienceId ?? null,
        usable: algUsable && audUsable && activation,
        missing,
        aggregate: null,
        audienceFit: "unavailable" as const,
        history: {
          value: 0.5 as const,
          basis: "assumed_cold_start_baseline" as const,
        },
      },
    };
  },
});

export async function account(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
) {
  const a = await ctx.db.get(accountId);
  requireReference(workspaceId, a);
  if (a!.provider !== "X")
    throw new ConvexError("INTELLIGENCE_NETWORK_UNAVAILABLE");
  return a!;
}
export async function selection(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
) {
  return ctx.db
    .query("intelligenceSelections")
    .withIndex("by_scope", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .eq("accountId", accountId)
        .eq("network", "x")
        .eq("surface", "for_you"),
    )
    .unique();
}
export function text(s: string, max = 1000) {
  if (
    !s.trim() ||
    s.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)
  )
    throw new ConvexError("INTELLIGENCE_INPUT_INVALID");
}
export async function begin(
  ctx: MutationCtx & {
    workspace: Doc<"workspaces">;
    membership: Doc<"memberships">;
    user: Doc<"users">;
  },
  a: {
    accountId: Id<"socialAccounts">;
    expectedRevision: number;
    commandKey: string;
  },
  input: unknown,
) {
  requireRole(ctx.membership, ["Owner", "Admin"]);
  await account(ctx, ctx.workspace._id, a.accountId);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(a.commandKey))
    throw new ConvexError("INTELLIGENCE_COMMAND_INVALID");
  const fingerprint = await sha256(JSON.stringify(input));
  const receipt = await ctx.db
    .query("intelligenceProfileReceipts")
    .withIndex("by_command", (q) =>
      q
        .eq("workspaceId", ctx.workspace._id)
        .eq("accountId", a.accountId)
        .eq("actorId", ctx.user._id)
        .eq("commandKey", a.commandKey),
    )
    .unique();
  if (receipt && receipt.fingerprint !== fingerprint)
    throw new ConvexError("INTELLIGENCE_OPERATION_CONFLICT");
  const current = await selection(ctx, ctx.workspace._id, a.accountId);
  if (
    !receipt &&
    (!Number.isSafeInteger(a.expectedRevision) ||
      a.expectedRevision !== (current?.revision ?? 0))
  )
    throw new ConvexError("INTELLIGENCE_REVISION_CONFLICT");
  return { fingerprint, receipt, current };
}
export async function finish(
  ctx: MutationCtx & { workspace: Doc<"workspaces">; user: Doc<"users"> },
  a: { accountId: Id<"socialAccounts">; commandKey: string },
  b: Awaited<ReturnType<typeof begin>>,
  action: string,
  reason: string,
  ids: {
    algorithmId: Id<"algorithmProfiles"> | null;
    audienceId: Id<"audienceProfiles"> | null;
  },
  selected?: typeof ids,
) {
  const revision = (b.current?.revision ?? 0) + 1;
  const fields = {
    workspaceId: ctx.workspace._id,
    accountId: a.accountId,
    network: "x" as const,
    surface: "for_you" as const,
  };
  const patch = {
    revision,
    selectedBy:
      action === "select" || action === "rollback"
        ? ctx.user._id
        : (b.current?.selectedBy ?? null),
    algorithmId: selected
      ? selected.algorithmId
      : (b.current?.algorithmId ?? null),
    audienceId: selected
      ? selected.audienceId
      : (b.current?.audienceId ?? null),
    updatedAt: Date.now(),
  };
  if (b.current) await ctx.db.patch(b.current._id, patch);
  else await ctx.db.insert("intelligenceSelections", { ...fields, ...patch });
  await ctx.db.insert("intelligenceProfileReceipts", {
    ...fields,
    actorId: ctx.user._id,
    commandKey: a.commandKey,
    fingerprint: b.fingerprint,
    revision,
    action,
    reason,
    ...ids,
    createdAt: Date.now(),
  });
  return { revision, ...ids };
}
export function replay(r: Doc<"intelligenceProfileReceipts">) {
  return {
    revision: r.revision,
    algorithmId: r.algorithmId,
    audienceId: r.audienceId,
  };
}
export function fresh(p: Doc<"algorithmProfiles">) {
  return (
    p.status === "reviewed" &&
    p.review !== null &&
    p.payload.reviewDueAt > Date.now()
  );
}

export const history = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(receiptDoc),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, a) => {
    await account(ctx, ctx.workspace._id, a.accountId);
    if (
      !Number.isSafeInteger(a.paginationOpts.numItems) ||
      a.paginationOpts.numItems < 1 ||
      a.paginationOpts.numItems > 25
    )
      throw new ConvexError("INTELLIGENCE_PAGE_LIMIT");
    const p = await ctx.db
      .query("intelligenceProfileReceipts")
      .withIndex("by_scope", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("accountId", a.accountId)
          .eq("network", "x")
          .eq("surface", "for_you"),
      )
      .order("desc")
      .paginate(a.paginationOpts);
    return { page: p.page, isDone: p.isDone, continueCursor: p.continueCursor };
  },
});
