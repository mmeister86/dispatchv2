import { produce as notice } from "./notices";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceQuery,
  workspaceMutation,
  requireWorkspace,
  requireUser,
  requireRole,
  requireReference,
  requireActiveWorkspace,
} from "../lib/authorization";
import { sha256 } from "../lib/crypto";
import { draftResearchProof } from "../research/contentProof";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import {
  policyValue,
  stages,
  commandResult,
  assignmentResult,
  type reviewPin,
} from "./reviewFields";

type Ctx = QueryCtx | MutationCtx;
type Pin = Infer<typeof reviewPin>;
type Stage = Infer<typeof stages>;
const minimum = (...values: (number | null | undefined)[]) => {
  const n = Math.min(...values.map((x) => x ?? Infinity));
  return Number.isFinite(n) ? n : null;
};
const stageRoles = (stage: Stage) =>
  stage === "editorial"
    ? (["Owner", "Admin", "Editor"] as const)
    : (["Owner", "Admin"] as const);
export function isReviewLoss(error: unknown) {
  return (
    error instanceof ConvexError &&
    [
      "REVIEW_REQUIRED",
      "REVIEW_SOURCE_UNAVAILABLE",
      "REVIEW_REVIEWER_UNAVAILABLE",
      "REVIEW_DECISION_WITHDRAWN",
      "REVIEW_POLICY_CHANGED",
    ].includes(String(error.data))
  );
}
export function loss(error: unknown) {
  if (isReviewLoss(error)) return;
  if (
    error instanceof ConvexError &&
    ["STYLE_ANCESTRY_LIMIT", "RESEARCH_PROOF_ANCESTRY_LIMIT"].includes(
      String(error.data),
    )
  )
    throw error;
  rethrowUnexpectedSourceError(error);
}
export async function reviewer(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  roles: readonly string[],
) {
  const user = await ctx.db.get(userId),
    workspace = await ctx.db.get(workspaceId);
  requireActiveWorkspace(workspace);
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!user || !m || !roles.includes(m.role))
    throw new ConvexError("REVIEW_REVIEWER_UNAVAILABLE");
  return user;
}
export async function currentReviewActor(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
) {
  const user = await requireUser(ctx);
  if (user._id !== actorId) throw new ConvexError("ROLE_ACCESS_DENIED");
  const scope = await requireWorkspace(ctx, workspaceId, user);
  requireRole(scope.membership, ["Owner", "Admin"]);
}
async function exactVersion(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  id: Id<"draftVersions">,
) {
  requireActiveWorkspace(await ctx.db.get(workspaceId));
  const ver = await ctx.db.get(id),
    draft = ver ? await ctx.db.get(ver.draftId) : null;
  if (
    !ver ||
    !draft ||
    ver.workspaceId !== workspaceId ||
    draft.workspaceId !== workspaceId ||
    ver.sourceUnavailable
  )
    throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
  if (ver.content.accountId)
    requireReference(workspaceId, await ctx.db.get(ver.content.accountId));
  return { ver, until: await draftResearchProof(ctx, ver) };
}
async function control(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts"> | null,
) {
  return ctx.db
    .query("editorialReviewControls")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", workspaceId).eq("accountId", accountId),
    )
    .unique();
}
export async function effective(ctx: Ctx, ver: Doc<"draftVersions">) {
  const local = ver.content.accountId
    ? await control(ctx, ver.workspaceId, ver.content.accountId)
    : null;
  const c = local?.policyId ? local : await control(ctx, ver.workspaceId, null);
  const p = c?.policyId ? await ctx.db.get(c.policyId) : null;
  if (
    c?.policyId &&
    (!p ||
      p.workspaceId !== ver.workspaceId ||
      (p.accountId !== null && p.accountId !== ver.content.accountId))
  )
    throw new ConvexError("REVIEW_POLICY_CHANGED");
  return p;
}
async function activeDecision(
  ctx: Ctx,
  ver: Doc<"draftVersions">,
  policyId: Id<"editorialReviewPolicies">,
  stage: Stage,
) {
  // ponytail: one OCC-serialized active decision per exact policy/version/stage; history is never capped to discover truth.
  return ctx.db
    .query("editorialReviewDecisions")
    .withIndex("by_versionId_and_policyId_and_stage_and_active", (q) =>
      q
        .eq("versionId", ver._id)
        .eq("policyId", policyId)
        .eq("stage", stage)
        .eq("active", true),
    )
    .unique();
}
async function decisionProof(
  ctx: Ctx,
  ver: Doc<"draftVersions">,
  policyId: Id<"editorialReviewPolicies">,
  stage: Stage,
  id: Id<"editorialReviewDecisions">,
  prior: Id<"editorialReviewDecisions"> | null,
  until: number | null,
) {
  const d = await ctx.db.get(id);
  if (!d || !d.active || d.withdrawnAt !== null)
    throw new ConvexError("REVIEW_DECISION_WITHDRAWN");
  if (
    d.sourceUnavailable ||
    !d.reviewerId ||
    d.workspaceId !== ver.workspaceId ||
    d.draftId !== ver.draftId ||
    d.versionId !== ver._id ||
    d.accountId !== ver.content.accountId ||
    d.policyId !== policyId ||
    d.stage !== stage ||
    (d.priorDecisionId ?? null) !== prior ||
    (d.sourceUntil !== null && d.sourceUntil <= Date.now())
  )
    throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
  await reviewer(ctx, ver.workspaceId, d.reviewerId, stageRoles(stage));
  return minimum(until, d.sourceUntil);
}
export async function frozenReview(
  ctx: Ctx,
  ver: Doc<"draftVersions">,
  pin: Pin | undefined,
  sourceUntil?: number | null,
): Promise<Pin> {
  const until =
    sourceUntil === undefined
      ? (await exactVersion(ctx, ver.workspaceId, ver._id)).until
      : sourceUntil;
  if (!pin) return { policyId: null, decisionIds: [], sourceUntil: until };
  if (
    pin.decisionIds.length > 2 ||
    (pin.sourceUntil !== null && pin.sourceUntil <= Date.now())
  )
    throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
  const p = pin.policyId ? await ctx.db.get(pin.policyId) : null;
  if (
    pin.policyId &&
    (!p ||
      p.workspaceId !== ver.workspaceId ||
      (p.accountId !== null && p.accountId !== ver.content.accountId))
  )
    throw new ConvexError("REVIEW_POLICY_CHANGED");
  const expected = [
    p?.editorial ? "editorial" : null,
    p?.brand ? "brand" : null,
  ].filter((s): s is Stage => s !== null);
  if (expected.length !== pin.decisionIds.length)
    throw new ConvexError("REVIEW_REQUIRED");
  let horizon = minimum(until, pin.sourceUntil),
    prior: Id<"editorialReviewDecisions"> | null = null;
  for (let i = 0; i < expected.length; i++) {
    horizon = await decisionProof(
      ctx,
      ver,
      p!._id,
      expected[i],
      pin.decisionIds[i],
      prior,
      horizon,
    );
    if (expected[i] === "editorial") prior = pin.decisionIds[i];
  }
  return { ...pin, sourceUntil: horizon };
}
export async function currentReview(
  ctx: Ctx,
  ver: Doc<"draftVersions">,
  sourceUntil?: number | null,
): Promise<Pin> {
  const p = await effective(ctx, ver),
    ids: Id<"editorialReviewDecisions">[] = [];
  if (p)
    for (const stage of ["editorial", "brand"] as const)
      if (p[stage]) {
        const d = await activeDecision(ctx, ver, p._id, stage);
        if (!d) throw new ConvexError("REVIEW_REQUIRED");
        ids.push(d._id);
      }
  return frozenReview(
    ctx,
    ver,
    { policyId: p?._id ?? null, decisionIds: ids, sourceUntil: null },
    sourceUntil,
  );
}
export function sameReview(a: Pin | undefined, b: Pin) {
  return (
    !!a &&
    a.policyId === b.policyId &&
    JSON.stringify(a.decisionIds) === JSON.stringify(b.decisionIds)
  );
}
export async function approvalReview(
  ctx: Ctx,
  ver: Doc<"draftVersions">,
  approval: Doc<"approvals">,
  schedule?: Doc<"schedules">,
  sourceUntil?: number | null,
): Promise<Pin> {
  if (schedule) {
    if (
      schedule.reviewPin &&
      approval.reviewPin &&
      !sameReview(approval.reviewPin, schedule.reviewPin)
    )
      throw new ConvexError("REVIEW_POLICY_CHANGED");
    if (!schedule.reviewPin && approval.reviewPin?.decisionIds.length)
      throw new ConvexError("REVIEW_POLICY_CHANGED");
    return frozenReview(ctx, ver, schedule.reviewPin, sourceUntil);
  }
  const policy = await effective(ctx, ver);
  if (
    approval.reviewPin
      ? approval.reviewPin.policyId !== (policy?._id ?? null)
      : !!(policy?.editorial || policy?.brand)
  )
    throw new ConvexError("REVIEW_POLICY_CHANGED");
  const pin = await currentReview(ctx, ver, sourceUntil);
  if (
    approval.reviewPin
      ? !sameReview(approval.reviewPin, pin)
      : pin.decisionIds.length !== 0
  )
    throw new ConvexError("REVIEW_POLICY_CHANGED");
  const horizon = minimum(pin.sourceUntil, approval.reviewPin?.sourceUntil);
  if (horizon !== null && horizon <= Date.now())
    throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
  return { ...pin, sourceUntil: horizon };
}
export async function historicalReviewSource(
  ctx: Ctx,
  ver: Doc<"draftVersions">,
  ...horizons: (number | null | undefined)[]
) {
  const { until } = await exactVersion(ctx, ver.workspaceId, ver._id);
  const horizon = minimum(until, ...horizons);
  if (horizon !== null && horizon <= Date.now())
    throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
  return horizon;
}
export function commandInput(key: string, revision: number) {
  if (
    !/^[a-zA-Z0-9_-]{1,128}$/.test(key) ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new ConvexError("REVIEW_COMMAND_INVALID");
}
export async function commandSource(
  ctx: Ctx,
  c: Doc<"editorialReviewCommands">,
) {
  await reviewer(
    ctx,
    c.workspaceId,
    c.actorId,
    c.kind === "policy"
      ? ["Owner", "Admin"]
      : c.kind === "assignment" || c.kind === "request"
        ? ["Owner", "Admin", "Editor"]
        : stageRoles(c.kind),
  );
  if (c.accountId)
    requireReference(c.workspaceId, await ctx.db.get(c.accountId));
  let horizon = minimum(
    c.sourceUntil,
    c.versionId
      ? (await exactVersion(ctx, c.workspaceId, c.versionId)).until
      : null,
  );
  if (c.kind === "assignment" || c.kind === "request") {
    if (!c.assignmentResult || !c.versionId || !c.draftId)
      throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
    const draft = await ctx.db.get(c.draftId),
      ver = await ctx.db.get(c.versionId);
    if (
      !draft ||
      !ver ||
      ver.draftId !== draft._id ||
      draft.workspaceId !== c.workspaceId ||
      ver.content.accountId !== c.accountId
    )
      throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
    if (c.assigneeId)
      await reviewer(
        ctx,
        c.workspaceId,
        c.assigneeId,
        c.kind === "request" && c.requestStage
          ? stageRoles(c.requestStage)
          : ["Owner", "Admin", "Editor", "Viewer"],
      );
    if (horizon !== null && horizon <= Date.now())
      throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
    return horizon;
  }
  if (!c.result) throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
  if (c.result.policyId) {
    const p = await ctx.db.get(c.result.policyId);
    if (
      !p ||
      p.workspaceId !== c.workspaceId ||
      (p.accountId !== null && p.accountId !== c.accountId) ||
      (c.kind === "policy"
        ? p.accountId !== c.accountId ||
          p.actorId !== c.actorId ||
          p.revision !== c.result.revision
        : !p[c.kind])
    )
      throw new ConvexError("REVIEW_POLICY_CHANGED");
  }
  if (c.result.decisionId) {
    const d = await ctx.db.get(c.result.decisionId);
    if (
      !d ||
      d.sourceUnavailable ||
      !d.reviewerId ||
      d.workspaceId !== c.workspaceId ||
      d.versionId !== c.versionId ||
      d.accountId !== c.accountId ||
      d.policyId !== c.result.policyId ||
      d.stage !== c.kind
    )
      throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
    await reviewer(ctx, d.workspaceId, d.reviewerId, stageRoles(d.stage));
    horizon = minimum(horizon, d.sourceUntil);
    // A historical receipt never reactivates a withdrawn decision. Physical source loss still closes it.
    if (d.priorDecisionId) {
      const prior = await ctx.db.get(d.priorDecisionId);
      if (
        !prior ||
        prior.sourceUnavailable ||
        !prior.reviewerId ||
        prior.versionId !== d.versionId ||
        prior.policyId !== d.policyId ||
        prior.stage !== "editorial"
      )
        throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
      await reviewer(
        ctx,
        prior.workspaceId,
        prior.reviewerId,
        stageRoles("editorial"),
      );
      horizon = minimum(horizon, prior.sourceUntil);
    }
  }
  if (horizon !== null && horizon <= Date.now())
    throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
  return horizon;
}
export async function command(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  key: string,
  intent: unknown,
) {
  const fingerprint = await sha256(JSON.stringify(intent));
  const old = await ctx.db
    .query("editorialReviewCommands")
    .withIndex("by_workspaceId_and_actorId_and_commandKey", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .eq("actorId", actorId)
        .eq("commandKey", key),
    )
    .unique();
  if (old) {
    if (
      old.sourceUnavailable ||
      (!old.result && !old.assignmentResult) ||
      (old.sourceUntil !== null && old.sourceUntil <= Date.now())
    )
      throw new ConvexError("REVIEW_COMMAND_UNAVAILABLE");
    if (old.fingerprint !== fingerprint)
      throw new ConvexError("REVIEW_COMMAND_CONFLICT");
    try {
      await commandSource(ctx, old);
    } catch (error) {
      loss(error);
      throw new ConvexError("REVIEW_COMMAND_UNAVAILABLE");
    }
  }
  return { old, fingerprint };
}
export const policy = workspaceQuery({
  args: { accountId: v.union(v.id("socialAccounts"), v.null()) },
  returns: v.object({
    revision: v.number(),
    policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
    editorial: v.boolean(),
    brand: v.boolean(),
  }),
  handler: async (ctx, a) => {
    if (a.accountId)
      requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const c = await control(ctx, ctx.workspace._id, a.accountId),
      p = c?.policyId ? await ctx.db.get(c.policyId) : null;
    if (
      c?.policyId &&
      (!p || p.workspaceId !== ctx.workspace._id || p.accountId !== a.accountId)
    )
      throw new ConvexError("REVIEW_POLICY_CHANGED");
    return {
      revision: c?.revision ?? 0,
      policyId: p?._id ?? null,
      editorial: p?.editorial ?? false,
      brand: p?.brand ?? false,
    };
  },
});
export const configure = workspaceMutation({
  args: {
    accountId: v.union(v.id("socialAccounts"), v.null()),
    expectedRevision: v.number(),
    commandKey: v.string(),
    policy: v.union(policyValue, v.null()),
  },
  returns: commandResult,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    commandInput(a.commandKey, a.expectedRevision);
    if (a.accountId)
      requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const { old, fingerprint } = await command(
      ctx,
      ctx.workspace._id,
      ctx.user._id,
      a.commandKey,
      [
        "policy",
        a.accountId,
        a.expectedRevision,
        a.policy ? [a.policy.editorial, a.policy.brand] : null,
      ],
    );
    if (old) return old.result!;
    const c = await control(ctx, ctx.workspace._id, a.accountId);
    if ((c?.revision ?? 0) !== a.expectedRevision)
      throw new ConvexError("REVIEW_REVISION_CONFLICT");
    const revision = a.expectedRevision + 1;
    const policyId = a.policy
      ? await ctx.db.insert("editorialReviewPolicies", {
          workspaceId: ctx.workspace._id,
          accountId: a.accountId,
          ...a.policy,
          revision,
          actorId: ctx.user._id,
          createdAt: Date.now(),
        })
      : null;
    const fields = {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      policyId,
      revision,
    };
    if (c) await ctx.db.patch(c._id, fields);
    else await ctx.db.insert("editorialReviewControls", fields);
    const result = { revision, policyId, decisionId: null };
    await ctx.db.insert("editorialReviewCommands", {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      kind: "policy",
      fingerprint,
      result,
      sourceUntil: null,
      sourceUnavailable: false,
    });
    return result;
  },
});
export const get = workspaceQuery({
  args: { versionId: v.id("draftVersions") },
  returns: v.object({
    revision: v.number(),
    policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
    editorial: v.boolean(),
    brand: v.boolean(),
    editorialDecisionId: v.union(v.id("editorialReviewDecisions"), v.null()),
    brandDecisionId: v.union(v.id("editorialReviewDecisions"), v.null()),
    sourceUntil: v.union(v.number(), v.null()),
    authId: v.string(),
    sessionId: v.string(),
  }),
  handler: async (ctx, a) => {
    const projection = await presentation(ctx, ctx.workspace._id, a.versionId);
    const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string") throw new ConvexError("Unauthenticated");
    return {
      ...projection,
      authId: ctx.user.authId,
      sessionId,
    };
  },
});
export const decide = workspaceMutation({
  args: {
    versionId: v.id("draftVersions"),
    stage: stages,
    policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
    expectedRevision: v.number(),
    commandKey: v.string(),
  },
  returns: commandResult,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, [...stageRoles(a.stage)]);
    commandInput(a.commandKey, a.expectedRevision);
    const { ver, until } = await exactVersion(
      ctx,
      ctx.workspace._id,
      a.versionId,
    );
    const { old, fingerprint } = await command(
      ctx,
      ctx.workspace._id,
      ctx.user._id,
      a.commandKey,
      [
        "decide",
        ver._id,
        ver.content.accountId,
        a.policyId,
        a.stage,
        a.expectedRevision,
      ],
    );
    if (old) return old.result!;
    const p = await effective(ctx, ver);
    if (!p || p._id !== a.policyId || !p[a.stage])
      throw new ConvexError("REVIEW_POLICY_CHANGED");
    if ((ver.reviewRevision ?? 0) !== a.expectedRevision)
      throw new ConvexError("REVIEW_REVISION_CONFLICT");
    const previous =
      p.editorial && a.stage === "brand"
        ? await activeDecision(ctx, ver, p._id, "editorial")
        : null;
    let horizon = until;
    if (p.editorial && a.stage === "brand") {
      if (!previous) throw new ConvexError("REVIEW_REQUIRED");
      horizon = await decisionProof(
        ctx,
        ver,
        p._id,
        "editorial",
        previous._id,
        null,
        horizon,
      );
    }
    const existing = await activeDecision(ctx, ver, p._id, a.stage);
    if (existing) {
      await decisionProof(
        ctx,
        ver,
        p._id,
        a.stage,
        existing._id,
        previous?._id ?? null,
        horizon,
      );
      throw new ConvexError("REVIEW_ALREADY_DECIDED");
    }
    const revision = a.expectedRevision + 1;
    const decisionId = await ctx.db.insert("editorialReviewDecisions", {
      workspaceId: ctx.workspace._id,
      draftId: ver.draftId,
      versionId: ver._id,
      accountId: ver.content.accountId,
      policyId: p._id,
      stage: a.stage,
      reviewerId: ctx.user._id,
      ...(previous ? { priorDecisionId: previous._id } : {}),
      createdAt: Date.now(),
      sourceUntil: horizon,
      withdrawnAt: null,
      active: true,
      sourceUnavailable: false,
    });
    await ctx.db.patch(ver._id, { reviewRevision: revision });
    await notice(
      ctx,
      ver,
      ctx.user._id,
      { kind: "decision", decisionId, withdrawn: false },
      horizon,
    );
    const result = { revision, policyId: p._id, decisionId };
    await ctx.db.insert("editorialReviewCommands", {
      workspaceId: ctx.workspace._id,
      accountId: ver.content.accountId,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      kind: a.stage,
      versionId: ver._id,
      fingerprint,
      result,
      sourceUntil: horizon,
      sourceUnavailable: false,
    });
    return result;
  },
});
export const withdraw = workspaceMutation({
  args: {
    decisionId: v.id("editorialReviewDecisions"),
    expectedRevision: v.number(),
    commandKey: v.string(),
  },
  returns: commandResult,
  handler: async (ctx, a) => {
    commandInput(a.commandKey, a.expectedRevision);
    const d = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.decisionId),
    ) as Doc<"editorialReviewDecisions">;
    requireRole(ctx.membership, [...stageRoles(d.stage)]);
    if (
      !d.reviewerId ||
      (d.reviewerId !== ctx.user._id &&
        !["Owner", "Admin"].includes(ctx.membership.role))
    )
      throw new ConvexError("ROLE_ACCESS_DENIED");
    const { ver, until } = await exactVersion(
      ctx,
      ctx.workspace._id,
      d.versionId,
    );
    const { old, fingerprint } = await command(
      ctx,
      ctx.workspace._id,
      ctx.user._id,
      a.commandKey,
      ["withdraw", d._id, a.expectedRevision],
    );
    if (old) return old.result!;
    if (d.sourceUnavailable || !d.active || d.withdrawnAt !== null)
      throw new ConvexError("REVIEW_DECISION_WITHDRAWN");
    if ((ver.reviewRevision ?? 0) !== a.expectedRevision)
      throw new ConvexError("REVIEW_REVISION_CONFLICT");
    const revision = a.expectedRevision + 1,
      result = { revision, policyId: d.policyId, decisionId: d._id };
    await ctx.db.patch(d._id, {
      active: false,
      withdrawnAt: Date.now(),
      withdrawnBy: ctx.user._id,
    });
    await notice(
      ctx,
      ver,
      ctx.user._id,
      { kind: "decision", decisionId: d._id, withdrawn: true },
      minimum(until, d.sourceUntil),
    );
    await ctx.db.patch(ver._id, { reviewRevision: revision });
    await ctx.db.insert("editorialReviewCommands", {
      workspaceId: ctx.workspace._id,
      accountId: ver.content.accountId,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      kind: d.stage,
      versionId: ver._id,
      fingerprint,
      result,
      sourceUntil: minimum(until, d.sourceUntil),
      sourceUnavailable: false,
    });
    return result;
  },
});
async function scrubDecision(
  ctx: MutationCtx,
  d: Doc<"editorialReviewDecisions">,
) {
  await ctx.scheduler.runAfter(0, internal.editorial.notices.cleanupVersion, {
    versionId: d.versionId,
    cursor: null,
  });
  await ctx.db.patch(d._id, {
    active: false,
    sourceUnavailable: true,
    reviewerId: undefined,
    withdrawnBy: undefined,
    priorDecisionId: undefined,
    sourceUntil: null,
  });
}
async function scrubCommand(
  ctx: MutationCtx,
  c: Doc<"editorialReviewCommands">,
) {
  if (c.versionId)
    await ctx.scheduler.runAfter(0, internal.editorial.notices.cleanupVersion, {
      versionId: c.versionId,
      cursor: null,
    });
  await ctx.db.patch(c._id, {
    fingerprint: undefined,
    result: undefined,
    assignmentResult: undefined,
    assigneeId: undefined,
    sourceUnavailable: true,
    sourceUntil: null,
  });
}
export const purgeVersion = internalMutation({
  args: { versionId: v.id("draftVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.scheduler.runAfter(0, internal.editorial.notices.purgeVersion, a);
    const decisions = await ctx.db
      .query("editorialReviewDecisions")
      .withIndex("by_versionId_and_sourceUnavailable", (q) =>
        q.eq("versionId", a.versionId).eq("sourceUnavailable", false),
      )
      .take(50);
    const commands = await ctx.db
      .query("editorialReviewCommands")
      .withIndex("by_versionId_and_sourceUnavailable", (q) =>
        q.eq("versionId", a.versionId).eq("sourceUnavailable", false),
      )
      .take(50);
    for (const d of decisions) await scrubDecision(ctx, d);
    for (const c of commands) await scrubCommand(ctx, c);
    if (decisions.length === 50 || commands.length === 50)
      await ctx.scheduler.runAfter(
        0,
        internal.editorial.reviews.purgeVersion,
        a,
      );
    return null;
  },
});
export const purgeReviewer = internalMutation({
  args: { reviewerId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("editorialReviewDecisions")
      .withIndex("by_reviewerId_and_sourceUnavailable", (q) =>
        q.eq("reviewerId", a.reviewerId).eq("sourceUnavailable", false),
      )
      .take(50);
    for (const d of rows) await scrubDecision(ctx, d);
    const commands = await ctx.db
      .query("editorialReviewCommands")
      .withIndex("by_actorId_and_sourceUnavailable", (q) =>
        q.eq("actorId", a.reviewerId).eq("sourceUnavailable", false),
      )
      .take(50);
    for (const c of commands) await scrubCommand(ctx, c);
    if (rows.length === 50 || commands.length === 50)
      await ctx.scheduler.runAfter(
        0,
        internal.editorial.reviews.purgeReviewer,
        a,
      );
    return null;
  },
});
export const sweep = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    phase: v.union(v.literal("decisions"), v.literal("commands")),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.phase === "decisions") {
      const page = await ctx.db
        .query("editorialReviewDecisions")
        .withIndex("by_sourceUnavailable_and_sourceUntil", (q) =>
          q.eq("sourceUnavailable", false),
        )
        .paginate({ cursor: a.cursor, numItems: 25 });
      for (const d of page.page)
        try {
          const { ver, until } = await exactVersion(
            ctx,
            d.workspaceId,
            d.versionId,
          );
          const p = await ctx.db.get(d.policyId);
          if (
            !p ||
            p.workspaceId !== d.workspaceId ||
            (p.accountId !== null && p.accountId !== ver.content.accountId) ||
            !p[d.stage]
          )
            throw new ConvexError("REVIEW_POLICY_CHANGED");
          if (d.stage === "brand" && p.editorial && !d.priorDecisionId)
            throw new ConvexError("REVIEW_REQUIRED");
          let horizon = await decisionProof(
            ctx,
            ver,
            d.policyId,
            d.stage,
            d._id,
            d.priorDecisionId ?? null,
            until,
          );
          if (d.priorDecisionId)
            horizon = await decisionProof(
              ctx,
              ver,
              d.policyId,
              "editorial",
              d.priorDecisionId,
              null,
              horizon,
            );
          if (horizon !== null && horizon <= Date.now())
            throw new ConvexError("REVIEW_SOURCE_UNAVAILABLE");
          if (horizon !== d.sourceUntil)
            await ctx.db.patch(d._id, { sourceUntil: horizon });
        } catch (error) {
          loss(error);
          await scrubDecision(ctx, d);
        }
      await ctx.scheduler.runAfter(0, internal.editorial.reviews.sweep, {
        cursor: page.isDone ? null : page.continueCursor,
        phase: page.isDone ? "commands" : "decisions",
      });
    } else {
      const page = await ctx.db
        .query("editorialReviewCommands")
        .withIndex("by_sourceUnavailable_and_sourceUntil", (q) =>
          q.eq("sourceUnavailable", false),
        )
        .paginate({ cursor: a.cursor, numItems: 50 });
      for (const c of page.page)
        try {
          const horizon = await commandSource(ctx, c);
          if (horizon !== c.sourceUntil)
            await ctx.db.patch(c._id, { sourceUntil: horizon });
        } catch (error) {
          loss(error);
          await scrubCommand(ctx, c);
        }
      if (!page.isDone)
        await ctx.scheduler.runAfter(0, internal.editorial.reviews.sweep, {
          cursor: page.continueCursor,
          phase: "commands",
        });
    }
    return null;
  },
});

export const request = workspaceMutation({
  args: {
    versionId: v.id("draftVersions"),
    stage: stages,
    policyId: v.union(v.id("editorialReviewPolicies"), v.null()),
    expectedRevision: v.number(),
    commandKey: v.string(),
  },
  returns: assignmentResult,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    commandInput(a.commandKey, a.expectedRevision);
    const { ver, until } = await exactVersion(
      ctx,
      ctx.workspace._id,
      a.versionId,
    );
    const { old, fingerprint } = await command(
      ctx,
      ctx.workspace._id,
      ctx.user._id,
      a.commandKey,
      [
        "request",
        ver._id,
        ver.content.accountId,
        a.stage,
        a.policyId,
        a.expectedRevision,
      ],
    );
    if (old) return old.assignmentResult!;
    const p = await effective(ctx, ver),
      draft = await ctx.db.get(ver.draftId);
    if (!p || p._id !== a.policyId || !p[a.stage])
      throw new ConvexError("REVIEW_POLICY_CHANGED");
    if (
      (ver.reviewRevision ?? 0) !== a.expectedRevision ||
      draft?.currentVersionId !== ver._id
    )
      throw new ConvexError("REVIEW_REVISION_CONFLICT");
    if (!draft.assigneeId) throw new ConvexError("REVIEW_RECIPIENT_REQUIRED");
    await reviewer(
      ctx,
      ctx.workspace._id,
      draft.assigneeId,
      stageRoles(a.stage),
    );
    const result = {
      revision: a.expectedRevision,
      assigneeId: draft.assigneeId,
      versionId: ver._id,
    };
    const commandId = await ctx.db.insert("editorialReviewCommands", {
      workspaceId: ctx.workspace._id,
      accountId: ver.content.accountId,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      kind: "request",
      draftId: draft._id,
      versionId: ver._id,
      assigneeId: draft.assigneeId,
      requestStage: a.stage,
      fingerprint,
      result: {
        revision: a.expectedRevision,
        policyId: p._id,
        decisionId: null,
      },
      assignmentResult: result,
      sourceUntil: until,
      sourceUnavailable: false,
    });
    await notice(
      ctx,
      ver,
      ctx.user._id,
      { kind: "request", commandId, stage: a.stage },
      until,
    );
    return result;
  },
});

export async function presentation(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  versionId: Id<"draftVersions">,
) {
  const { ver, until } = await exactVersion(ctx, workspaceId, versionId),
    p = await effective(ctx, ver);
  let horizon = until,
    prior: Id<"editorialReviewDecisions"> | null = null,
    brand: Id<"editorialReviewDecisions"> | null = null;
  if (p)
    for (const stage of ["editorial", "brand"] as const)
      if (p[stage]) {
        const d = await activeDecision(ctx, ver, p._id, stage);
        if (d)
          try {
            if (stage === "brand" && p.editorial && !prior)
              throw new ConvexError("REVIEW_REQUIRED");
            horizon = await decisionProof(
              ctx,
              ver,
              p._id,
              stage,
              d._id,
              prior,
              horizon,
            );
            if (stage === "editorial") prior = d._id;
            else brand = d._id;
          } catch (error) {
            loss(error);
          }
      }
  return {
    revision: ver.reviewRevision ?? 0,
    policyId: p?._id ?? null,
    editorial: p?.editorial ?? false,
    brand: p?.brand ?? false,
    editorialDecisionId: prior,
    brandDecisionId: brand,
    sourceUntil: horizon,
  };
}
