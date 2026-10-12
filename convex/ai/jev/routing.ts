import { operationalUntil } from "../../lib/operationalRetention";
import { ConvexError, v, type Infer } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  workspaceMutation,
  workspaceQuery,
  workspaceInternalQuery,
  requireRole,
  requireReference,
  requireWorkspace,
} from "../../lib/authorization";
import { rethrowUnexpectedSourceError } from "../../lib/sourceProof";
import { sha256 } from "../../lib/crypto";
import { ideaProofUntil } from "../../research/contentProof";
import {
  materialWalk,
  enterMaterial,
  type MaterialWalk,
} from "../../research/pipelineAccess";
import { currentContext } from "../../integrations/github/contextAccess";
import { captureStyle, scopedStyleProof } from "../styleProfiles";
import { changeLiability } from "../accounting";
import { estimate } from "./access";
import {
  routingIntent,
  routingStateContract as stateContract,
  routingResult,
  routingPolicyFields,
  routingControlFields,
  strategies,
  outcome,
  answer,
} from "./types";
import { resolveRoutingQuestions } from "./questions/intentRouting";
import {
  BACKGROUND_TIMEOUT_MS,
  COMPOSER_TIMEOUT_MS,
  CIRCUIT_FAILURES,
  CIRCUIT_COOLDOWN_MS,
} from "./thresholds";

type Ctx = QueryCtx | MutationCtx;
type Operation = Doc<"jevRoutingOperations">;
type Policy = Extract<Doc<"jevPolicies">, { purpose: "intent-routing" }>;
type Control = Extract<Doc<"jevControls">, { purpose: "intent-routing" }>;
type Intent = Infer<typeof routingIntent>;
type SourcePin = Pick<
  Operation,
  | "createdAt"
  | "workspaceId"
  | "actorId"
  | "accountId"
  | "accountIdentity"
  | "accountConnectionSequence"
  | "capabilityFingerprint"
  | "ideaId"
  | "inputVersionId"
  | "inputRevision"
  | "intent"
  | "style"
  | "sourceUntil"
  | "sourceUnavailable"
  | "candidateMediaChecksums"
>;
const request = { operationId: v.id("jevRoutingOperations") };
const cursor = v.union(v.string(), v.null());
const fingerprint = (p: Doc<"jevPolicies">) => sha256(JSON.stringify(p));
const bounded = (n: number, max: number, zero = false) =>
  Number.isSafeInteger(n) && n >= (zero ? 0 : 1) && n <= max;
const minimum = (...values: (number | null)[]) => {
  const n = Math.min(...values.map((x) => x ?? Infinity));
  return Number.isFinite(n) ? n : null;
};
function fail(code: string): never {
  throw new ConvexError(code);
}
export function routingLoss(error: unknown) {
  if (
    error instanceof ConvexError &&
    typeof error.data === "string" &&
    [
      "ROUTING_SOURCE_UNAVAILABLE",
      "ROUTING_ACCOUNT_CHANGED",
      "ROUTING_AUTHORITY_UNAVAILABLE",
      "ROUTING_PURPOSE_WITHDRAWN",
      "ROUTING_CONFIGURATION_REQUIRED",
      "ROUTING_CIRCUIT_OPEN",
      "ROUTING_SUPERSEDED",
      "ROUTING_EXPIRED",
      "ROUTING_INPUT_LIMIT",
      "MODEL_BUDGET_EXHAUSTED",
    ].includes(error.data)
  )
    return;
  if (
    error instanceof ConvexError &&
    typeof error.data === "string" &&
    error.data.endsWith("ANCESTRY_LIMIT")
  )
    throw error;
  rethrowUnexpectedSourceError(error);
}
async function admin(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
) {
  const actor = await ctx.db.get(actorId);
  if (!actor) fail("ROUTING_AUTHORITY_UNAVAILABLE");
  requireRole((await requireWorkspace(ctx, workspaceId, actor)).membership, [
    "Owner",
    "Admin",
  ]);
}
async function configuration(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
  probe: Id<"aiAttempts"> | null = null,
  circuit = true,
): Promise<{
  p: Policy;
  c: Control;
  budgetIds: Id<"aiBudgets">[];
  authorityUntil: number;
}> {
  const global = await ctx.db
    .query("jevControls")
    .withIndex("by_key", (q) => q.eq("key", "routing:global"))
    .unique();
  const c = await ctx.db
    .query("jevControls")
    .withIndex("by_key", (q) => q.eq("key", `routing:account:${accountId}`))
    .unique();
  if (
    !global ||
    !("purpose" in global) ||
    global.purpose !== "intent-routing" ||
    global.workspaceId !== undefined ||
    global.accountId !== undefined ||
    global.withdrawn ||
    !global.enabled ||
    !global.routing ||
    !c ||
    !("purpose" in c) ||
    c.purpose !== "intent-routing" ||
    c.workspaceId !== workspaceId ||
    c.accountId !== accountId ||
    c.withdrawn ||
    !c.enabled ||
    !c.routing
  )
    fail("ROUTING_PURPOSE_WITHDRAWN");
  if (
    !bounded(c.composerTimeoutMs, COMPOSER_TIMEOUT_MS) ||
    !bounded(c.backgroundTimeoutMs, BACKGROUND_TIMEOUT_MS) ||
    !bounded(c.failures, CIRCUIT_FAILURES, true) ||
    !bounded(c.openUntil, Number.MAX_SAFE_INTEGER, true)
  )
    fail("ROUTING_CONFIGURATION_REQUIRED");
  if (
    circuit &&
    (c.openUntil > Date.now() ||
      (c.probeAttemptId !== null && c.probeAttemptId !== probe))
  )
    fail("ROUTING_CIRCUIT_OPEN");
  const p = c.policyId ? await ctx.db.get(c.policyId) : null;
  if (
    !p ||
    !("purpose" in p) ||
    p.purpose !== "intent-routing" ||
    p.workspaceId !== workspaceId ||
    p.accountId !== accountId ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(p.version) ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(p.model) ||
    p.model.includes("latest") ||
    !bounded(p.expiresAt, Number.MAX_SAFE_INTEGER) ||
    p.expiresAt <= Date.now() ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !bounded(p.inputMicrosPerMillion, 1e9, true) ||
    !bounded(p.outputMicrosPerMillion, 1e9, true) ||
    !bounded(p.maxInputTokens, 32000) ||
    !bounded(p.maxOutputTokens, 8000) ||
    [
      p.pricingEvidence,
      ...Object.values(p.euEvidence),
      ...Object.values(p.processingRights),
    ].some((s) => !s.trim() || s.length > 2000)
  )
    fail("ROUTING_CONFIGURATION_REQUIRED");
  await admin(ctx, workspaceId, p.approvedBy);
  resolveRoutingQuestions(p.questionVersion, p.normalizationVersion);
  if (
    p.thresholdVersion !== "jev-routing-hypotheses-v1" ||
    !process.env.TYPESAFE_API_KEY?.trim() ||
    (await sha256(process.env.TYPESAFE_API_KEY)) !== p.credentialFingerprint
  )
    fail("ROUTING_CONFIGURATION_REQUIRED");
  const budgetIds: Id<"aiBudgets">[] = [];
  let authorityUntil = p.expiresAt;
  for (const [i, scope] of (
    ["provider", "workspace", "account"] as const
  ).entries()) {
    const key =
      i === 0
        ? "jev:provider"
        : i === 1
          ? `jev:workspace:${workspaceId}`
          : `jev:account:${accountId}`;
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (
      !b ||
      b.scope !== scope ||
      b.policyVersion !== p.version ||
      b.currency !== p.currency ||
      !b.purposes.includes("intent-routing") ||
      !bounded(b.expiresAt, Number.MAX_SAFE_INTEGER) ||
      b.expiresAt <= Date.now() ||
      !bounded(b.limitMicros, 1e12) ||
      !bounded(b.heldMicros, Number.MAX_SAFE_INTEGER, true) ||
      !bounded(b.spentMicros, Number.MAX_SAFE_INTEGER, true) ||
      (i === 0 && (b.workspaceId !== undefined || b.accountId !== undefined)) ||
      (i === 1 &&
        (b.workspaceId !== workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== workspaceId || b.accountId !== accountId)) ||
      (i > 0 && !b.approvedBy)
    )
      fail("ROUTING_PURPOSE_WITHDRAWN");
    if (b.approvedBy) await admin(ctx, workspaceId, b.approvedBy);
    budgetIds.push(b._id);
    authorityUntil = Math.min(authorityUntil, b.expiresAt);
  }
  return { p, c, budgetIds, authorityUntil };
}
export const contextContract = v.object({
  state: stateContract,
  deadline: v.number(),
  authorityUntil: v.number(),
  requestFingerprint: v.string(),
  sourceUntil: v.union(v.number(), v.null()),
  p: v.object({
    ...routingPolicyFields,
    _id: v.id("jevPolicies"),
    _creationTime: v.number(),
  }),
  c: v.object({
    ...routingControlFields,
    _id: v.id("jevControls"),
    _creationTime: v.number(),
  }),
  budgetIds: v.array(v.id("aiBudgets")),
});
type Context = Infer<typeof contextContract>;
export async function routingSourceProof(
  ctx: Ctx,
  o: SourcePin,
  current = false,
  walk: MaterialWalk = materialWalk(),
) {
  for (const key of ["routing:global", `routing:account:${o.accountId}`]) {
    const c = await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (c && "purpose" in c && c.purpose === "intent-routing" && c.withdrawn)
      fail("ROUTING_PURPOSE_WITHDRAWN");
  }
  if (o.sourceUnavailable || !o.intent) fail("ROUTING_SOURCE_UNAVAILABLE");
  const actor = await ctx.db.get(o.actorId);
  if (!actor) fail("ROUTING_AUTHORITY_UNAVAILABLE");
  requireRole((await requireWorkspace(ctx, o.workspaceId, actor)).membership, [
    "Owner",
    "Admin",
    "Editor",
  ]);
  const acc = await ctx.db.get(o.accountId);
  if (
    !acc ||
    acc.workspaceId !== o.workspaceId ||
    acc.provider !== "X" ||
    acc.connection !== "connected" ||
    (acc.providerIdentity ?? null) !== o.accountIdentity ||
    (acc.xEvidence?.connectionSequence ?? 0) !== o.accountConnectionSequence ||
    (await sha256(JSON.stringify(acc.capability))) !== o.capabilityFingerprint
  )
    fail("ROUTING_ACCOUNT_CHANGED");
  const ver = await ctx.db.get(o.inputVersionId),
    idea = await ctx.db.get(o.ideaId);
  if (
    !ver ||
    !idea ||
    idea.workspaceId !== o.workspaceId ||
    ver.workspaceId !== o.workspaceId ||
    ver.ideaId !== o.ideaId ||
    ver.sourceUnavailable ||
    idea.status === "archived"
  )
    fail("ROUTING_SOURCE_UNAVAILABLE");
  if (o.intent.outputKind === "social-post-candidate") {
    if (!o.intent.media || !o.candidateMediaChecksums)
      fail("ROUTING_SOURCE_UNAVAILABLE");
    const { validateContent, immutableMedia } = await import("../../editorial");
    const content = {
      title: ver.title,
      text: [""],
      media: o.intent.media,
      accountId: o.accountId,
      pillar: "Building in public",
      strategy: o.intent.strategy ?? "generic",
    };
    try {
      await validateContent(ctx, o.workspaceId, content);
      await immutableMedia(ctx, {
        content,
        mediaChecksums: o.candidateMediaChecksums,
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
        fail("ROUTING_SOURCE_UNAVAILABLE");
      throw error;
    }
    for (const m of content.media) {
      const key = `candidate-media:${m.assetId}`;
      if (!walk.done.has(key)) {
        enterMaterial(walk, key, "ROUTING_MATERIAL_LIMIT");
        walk.active.delete(key);
        walk.done.set(key, null);
      }
    }
  }
  const until = await ideaProofUntil(ctx, ver, walk, o.accountId);
  const style = o.style
    ? await scopedStyleProof(ctx, o, o.style, current, walk)
    : { payload: null, sourceUntil: null };
  if (current) {
    if (
      idea.revision !== o.inputRevision ||
      idea.currentVersionId !== o.inputVersionId
    )
      fail("ROUTING_SUPERSEDED");
    if (!o.style) {
      const c = await ctx.db
        .query("styleProfileControls")
        .withIndex("by_workspaceId_and_accountId", (q) =>
          q.eq("workspaceId", o.workspaceId).eq("accountId", o.accountId),
        )
        .unique();
      if (c?.selectedVersionId) fail("ROUTING_SUPERSEDED");
    }
  }
  const sourceUntil = minimum(
    operationalUntil(o.createdAt, o.sourceUntil),
    until,
    style.sourceUntil,
  );
  if (sourceUntil !== null && sourceUntil <= Date.now())
    fail("ROUTING_SOURCE_UNAVAILABLE");
  const state = {
    input: {
      title: ver.title,
      originalFacts: ver.originals,
      userClaims: ver.note,
      previousPerspective: ver.perspective,
      interpretationRationale: ver.rationale,
      questions: ver.questions,
      approvedPatchEvidence:
        ver.source.kind === "context"
          ? (await currentContext(ctx, ver.source.contextId, true)).c.excerpts
          : [],
    },
    intent: o.intent,
    style: style.payload,
  };
  return { state, sourceUntil, sourcePin: ver.source };
}
async function semantic(
  o: Pick<
    Operation,
    | "workspaceId"
    | "actorId"
    | "ideaId"
    | "inputRevision"
    | "accountId"
    | "inputVersionId"
    | "accountIdentity"
    | "accountConnectionSequence"
    | "capabilityFingerprint"
    | "style"
    | "candidateMediaChecksums"
  >,
  state: Infer<typeof stateContract>,
  sourcePin: Doc<"ideaVersions">["source"],
  policyFingerprint: string | null,
) {
  return sha256(
    JSON.stringify({
      version: "jev-native-routing-input-v1",
      workspaceId: o.workspaceId,
      actorId: o.actorId,
      ideaId: o.ideaId,
      inputRevision: o.inputRevision,
      accountId: o.accountId,
      inputVersionId: o.inputVersionId,
      accountIdentity: o.accountIdentity,
      accountConnectionSequence: o.accountConnectionSequence,
      capabilityFingerprint: o.capabilityFingerprint,
      style: o.style
        ? {
            versionId: o.style.versionId,
            fingerprint: o.style.fingerprint,
            selectedBy: o.style.selectedBy,
            selectionReceiptId: o.style.selectionReceiptId,
            sourceUntil: o.style.sourceUntil,
          }
        : null,
      ...(o.candidateMediaChecksums !== undefined
        ? { candidateMediaChecksums: o.candidateMediaChecksums }
        : {}),
      state,
      sourcePin,
      policyFingerprint,
      questionVersion: "jev-intent-routing-v1",
      normalizationVersion: "jev-routing-normalization-v1",
      thresholdVersion: "jev-routing-hypotheses-v1",
    }),
  );
}
const source = routingSourceProof;
export async function retainedRoutingProof(
  ctx: Ctx,
  o: Operation,
  walk: MaterialWalk = materialWalk(),
) {
  const x = await source(ctx, o, false, walk);
  if (o.policyId) {
    const p = await ctx.db.get(o.policyId);
    if (
      !p ||
      !("purpose" in p) ||
      p.purpose !== "intent-routing" ||
      p.expiresAt <= Date.now() ||
      Object.values(p.processingRights).some((s) => !s.trim())
    )
      fail("ROUTING_PURPOSE_WITHDRAWN");
    x.sourceUntil = minimum(x.sourceUntil, p.expiresAt);
    await admin(ctx, o.workspaceId, p.approvedBy);
    if ((await fingerprint(p)) !== o.policyFingerprint)
      fail("ROUTING_RECEIPT_INVALID");
    for (const key of ["routing:global", `routing:account:${o.accountId}`]) {
      const c = await ctx.db
        .query("jevControls")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (!c || !("purpose" in c) || !c.enabled || !c.routing || c.withdrawn)
        fail("ROUTING_PURPOSE_WITHDRAWN");
    }
    for (const key of [
      "jev:provider",
      `jev:workspace:${o.workspaceId}`,
      `jev:account:${o.accountId}`,
    ]) {
      const b = await ctx.db
        .query("aiBudgets")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (
        !b ||
        !b.purposes.includes("intent-routing") ||
        b.expiresAt <= Date.now()
      )
        fail("ROUTING_PURPOSE_WITHDRAWN");
      if (!bounded(b.expiresAt, Number.MAX_SAFE_INTEGER))
        fail("ROUTING_RECEIPT_INVALID");
      x.sourceUntil = minimum(x.sourceUntil, b.expiresAt);
      if (b.approvedBy) await admin(ctx, o.workspaceId, b.approvedBy);
    }
  }
  return x;
}
async function current(
  ctx: Ctx,
  o: Operation,
  execution = true,
  walk: MaterialWalk = materialWalk(),
): Promise<Context> {
  const x = await source(ctx, o, true, walk);
  if (execution && o.deadline <= Date.now()) fail("ROUTING_EXPIRED");
  const c = await configuration(ctx, o.workspaceId, o.accountId, o.attemptId);
  if (
    c.p._id !== o.policyId ||
    c.c._id !== o.controlId ||
    (await fingerprint(c.p)) !== o.policyFingerprint ||
    (await semantic(o, x.state, x.sourcePin, o.policyFingerprint)) !==
      o.semanticKey
  )
    fail("ROUTING_SUPERSEDED");
  x.sourceUntil = minimum(x.sourceUntil, c.authorityUntil);
  if (execution && x.sourceUntil !== null && x.sourceUntil <= o.deadline)
    fail("ROUTING_SOURCE_UNAVAILABLE");
  const def = resolveRoutingQuestions(
    o.questionVersion,
    o.normalizationVersion,
  );
  const body = JSON.stringify({
    state: x.state,
    questions: def.questions,
    model: c.p.model,
  });
  if (new TextEncoder().encode(body).length > c.p.maxInputTokens)
    fail("ROUTING_INPUT_LIMIT");
  return {
    ...c,
    state: x.state,
    deadline: o.deadline,
    sourceUntil: x.sourceUntil,
    requestFingerprint: o.semanticKey,
  };
}
async function operation(ctx: Ctx, id: Id<"jevRoutingOperations">) {
  const o = await ctx.db.get(id);
  if (!o) fail("ROUTING_SOURCE_UNAVAILABLE");
  return o;
}
function fallback(
  status: "configuration_required" | "fallback" = "fallback",
): Infer<typeof routingResult> {
  return {
    status,
    category: null,
    choiceConfidence: null,
    suggestion: null,
    effectiveStrategy: "generic",
    generatorKind: "generic",
    thresholdVersion: "jev-routing-hypotheses-v1",
  };
}
// The existing generation consumer rejoins this operation, not its physical classifier deadline.
export async function routingProof(
  ctx: Ctx,
  id: Id<"jevRoutingOperations">,
  pin: Pick<
    Doc<"contentRequests">,
    | "workspaceId"
    | "actorId"
    | "accountId"
    | "ideaId"
    | "inputVersionId"
    | "inputRevision"
    | "intent"
    | "outputKind"
    | "routingCommandFingerprint"
  >,
  fresh = true,
  walk: MaterialWalk = materialWalk(),
  run?: Doc<"agentRuns">,
) {
  const o = await operation(ctx, id),
    key = `routing:${id}`;
  enterMaterial(walk, key, "STYLE_ANCESTRY_LIMIT");
  try {
    if (
      o.workspaceId !== pin.workspaceId ||
      o.actorId !== pin.actorId ||
      o.accountId !== pin.accountId ||
      o.ideaId !== pin.ideaId ||
      o.inputVersionId !== pin.inputVersionId ||
      o.inputRevision !== pin.inputRevision
    )
      fail("ROUTING_RECEIPT_INVALID");
    const kept = await retainedRoutingProof(ctx, o, walk);
    if (
      !o.intent ||
      o.intent.intent !== pin.intent ||
      (o.intent.outputKind === "social-post-candidate"
        ? pin.outputKind !== "social-post-candidate" ||
          pin.routingCommandFingerprint !== o.commandFingerprint
        : pin.outputKind !== undefined)
    )
      fail("ROUTING_RECEIPT_INVALID");
    if (!o.result) fail("ROUTING_PENDING");
    if (run) {
      const a = o.style,
        b = run.styleContext;
      if (
        a
          ? !b ||
            a.versionId !== b.versionId ||
            a.fingerprint !== b.fingerprint ||
            a.selectedBy !== b.selectedBy ||
            a.selectionReceiptId !== b.selectionReceiptId
          : !!b
      )
        fail("ROUTING_RECEIPT_INVALID");
    }
    const now = fresh
      ? o.policyId
        ? await current(ctx, o, false, walk)
        : await source(ctx, o, true, walk)
      : kept;
    return {
      operation: o,
      sourceUntil: minimum(o.sourceUntil, kept.sourceUntil, now.sourceUntil),
    };
  } finally {
    walk.active.delete(key);
  }
}

export const prepare = workspaceMutation({
  args: {
    ideaId: v.id("ideas"),
    expectedRevision: v.number(),
    accountId: v.id("socialAccounts"),
    operationKey: v.string(),
    intent: v.object({
      ...routingIntent.fields,
      strategy: v.union(v.string(), v.null()),
    }),
  },
  returns: v.id("jevRoutingOperations"),
  handler: async (ctx, a): Promise<Id<"jevRoutingOperations">> => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    if (
      !/^[A-Za-z0-9_-]{8,100}$/.test(a.operationKey) ||
      !Number.isSafeInteger(a.expectedRevision) ||
      !a.intent.intent.trim() ||
      a.intent.intent.length > 1000 ||
      [a.intent.objective, a.intent.tone, a.intent.cta].some(
        (s) => s !== null && s.length > 1000,
      )
    )
      fail("ROUTING_INPUT_INVALID");
    if (
      a.intent.outputKind === "social-post-candidate"
        ? !a.intent.media || a.intent.media.length > 20
        : a.intent.media !== undefined
    )
      fail("ROUTING_INPUT_INVALID");
    const strategy =
      a.intent.strategy === "thought-leadership"
        ? "thoughtLeadership"
        : a.intent.strategy;
    if (strategy !== null && !strategies.some((x) => x === strategy))
      fail("ROUTING_INPUT_INVALID");
    const canonical =
      strategy === null ? null : strategies.find((x) => x === strategy);
    if (canonical === undefined) fail("ROUTING_INPUT_INVALID");
    const intent: Intent = { ...a.intent, strategy: canonical };
    const commandFingerprint = await sha256(
      JSON.stringify([
        a.ideaId,
        a.accountId,
        a.expectedRevision,
        { ...a.intent, strategy },
      ]),
    );
    const old = await ctx.db
      .query("jevRoutingOperations")
      .withIndex("by_command", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("actorId", ctx.user._id)
          .eq("operationKey", a.operationKey),
      )
      .unique();
    if (old) {
      if (old.commandFingerprint !== commandFingerprint)
        fail("ROUTING_OPERATION_CONFLICT");
      await retainedRoutingProof(ctx, old);
      await source(ctx, old, true);
      return old._id;
    }
    const idea = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.ideaId),
    ) as Doc<"ideas">;
    if (
      idea.revision !== a.expectedRevision ||
      !idea.currentVersionId ||
      idea.status === "archived"
    )
      fail("ROUTING_SUPERSEDED");
    const acc = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.accountId),
    ) as Doc<"socialAccounts">;
    const style =
      (await captureStyle(ctx, ctx.workspace._id, a.accountId)) ?? null;
    let candidateMediaChecksums: Doc<"jevRoutingOperations">["candidateMediaChecksums"];
    if (intent.outputKind === "social-post-candidate") {
      const { validateContent, mediaSnapshot } =
        await import("../../editorial");
      const input = (await ctx.db.get(idea.currentVersionId))!;
      const content = {
        title: input.title,
        text: [""],
        media: intent.media!,
        accountId: a.accountId,
        pillar: "Building in public",
        strategy: canonical ?? "generic",
      };
      await validateContent(ctx, ctx.workspace._id, content);
      candidateMediaChecksums = await mediaSnapshot(ctx, content);
    }
    const base = {
      ...(candidateMediaChecksums !== undefined
        ? { candidateMediaChecksums }
        : {}),
      workspaceId: ctx.workspace._id,
      actorId: ctx.user._id,
      accountId: a.accountId,
      ideaId: a.ideaId,
      inputVersionId: idea.currentVersionId,
      inputRevision: a.expectedRevision,
      operationKey: a.operationKey,
      commandFingerprint,
      intent,
      accountIdentity: acc.providerIdentity ?? null,
      accountConnectionSequence: acc.xEvidence?.connectionSequence ?? 0,
      capabilityFingerprint: await sha256(JSON.stringify(acc.capability)),
      style,
      sourceUntil: null,
      sourceUnavailable: false,
      questionVersion: "jev-intent-routing-v1" as const,
      normalizationVersion: "jev-routing-normalization-v1" as const,
      deadline: Date.now() + BACKGROUND_TIMEOUT_MS,
      createdAt: Date.now(),
      attemptId: null,
    };
    // Check the real shared source/style graph before inserting any operation.
    const x = await source(ctx, base, true);
    let config: Awaited<ReturnType<typeof configuration>> | null = null,
      result: Infer<typeof routingResult> | null = null;
    if (canonical !== null)
      result = {
        ...fallback(),
        status: "human_choice",
        category: canonical,
        effectiveStrategy: canonical,
      };
    else
      try {
        config = await configuration(ctx, base.workspaceId, base.accountId);
      } catch (error) {
        routingLoss(error);
        result = fallback("configuration_required");
      }
    const policyFingerprint = config ? await fingerprint(config.p) : null;
    const sourceUntil = minimum(x.sourceUntil, config?.authorityUntil ?? null);
    const row = {
      ...base,
      sourceUntil,
      deadline: Math.min(base.deadline, (sourceUntil ?? Infinity) - 1),
      policyId: config?.p._id ?? null,
      policyFingerprint,
      controlId: config?.c._id ?? null,
      semanticKey: await semantic(
        base,
        x.state,
        x.sourcePin,
        policyFingerprint,
      ),
      result,
    };
    if (config) {
      const body = JSON.stringify({
        state: x.state,
        questions: resolveRoutingQuestions(
          row.questionVersion,
          row.normalizationVersion,
        ).questions,
        model: config.p.model,
      });
      if (new TextEncoder().encode(body).length > config.p.maxInputTokens)
        fail("ROUTING_INPUT_LIMIT");
    }
    const id = await ctx.db.insert("jevRoutingOperations", row);
    if (row.sourceUntil !== null)
      await ctx.scheduler.runAt(
        row.sourceUntil,
        internal.ai.jev.routing.scrub,
        { operationId: id },
      );
    return id;
  },
});
export const context = internalQuery({
  args: request,
  returns: contextContract,
  handler: async (ctx, a): Promise<Context> =>
    current(ctx, await operation(ctx, a.operationId)),
});
export const get = workspaceQuery({
  args: request,
  returns: v.object({
    applicability: v.union(
      v.literal("current"),
      v.literal("historical"),
      v.literal("unavailable"),
    ),
    result: v.union(routingResult, v.null()),
    sourceUntil: v.union(v.number(), v.null()),
    deadline: v.number(),
    usage: v.union(
      v.null(),
      v.object({
        state: v.union(
          v.literal("sent"),
          v.literal("unknown"),
          v.literal("settled"),
        ),
        heldMicros: v.number(),
        estimatedMicros: v.union(v.number(), v.null()),
        currency: v.string(),
      }),
    ),
  }),
  handler: async (ctx, a) => {
    const o = await operation(ctx, a.operationId);
    requireReference(ctx.workspace._id, o);
    const t = o.attemptId
      ? await routingReceipt(ctx, o.attemptId, o._id)
      : null;
    const money = {
      deadline: o.deadline,
      usage: t
        ? {
            state: t.state,
            heldMicros: t.heldMicros,
            estimatedMicros: t.estimatedMicros,
            currency: t.currency,
          }
        : null,
    };
    try {
      const x = await retainedRoutingProof(ctx, o);
      try {
        await source(ctx, o, true);
        if (o.policyId) await current(ctx, o, false);
        return {
          ...money,
          applicability: "current" as const,
          result: o.result,
          sourceUntil: x.sourceUntil,
        };
      } catch (error) {
        routingLoss(error);
        return {
          ...money,
          applicability: "historical" as const,
          result: o.result,
          sourceUntil: x.sourceUntil,
        };
      }
    } catch (error) {
      routingLoss(error);
      return {
        ...money,
        applicability: "unavailable" as const,
        result: null,
        sourceUntil: null,
      };
    }
  },
});
export const fund = internalMutation({
  args: { ...request, expectedFingerprint: v.string() },
  returns: v.id("aiAttempts"),
  handler: async (ctx, a): Promise<Id<"aiAttempts">> => {
    const o = await operation(ctx, a.operationId),
      x = await current(ctx, o);
    if (
      o.result ||
      o.attemptId ||
      x.requestFingerprint !== a.expectedFingerprint ||
      (await ctx.db
        .query("aiAttempts")
        .withIndex("by_routing_operation", (q) =>
          q.eq("owner", "jev-intent-router").eq("routingOperationId", o._id),
        )
        .first())
    )
      fail("ROUTING_ALREADY_ADMITTED");
    for (const state of ["sent", "unknown"] as const)
      if (
        await ctx.db
          .query("aiAttempts")
          .withIndex("by_routing_pending", (q) =>
            q
              .eq("owner", "jev-intent-router")
              .eq("workspaceId", o.workspaceId)
              .eq("accountId", o.accountId)
              .eq("inputVersionId", o.inputVersionId)
              .eq("state", state),
          )
          .first()
      )
        fail("ROUTING_USAGE_UNRESOLVED");
    const reservedMicros =
      estimate(x.p.maxInputTokens, x.p.inputMicrosPerMillion) +
      estimate(x.p.maxOutputTokens, x.p.outputMicrosPerMillion);
    if (!Number.isSafeInteger(reservedMicros)) fail("ROUTING_RECEIPT_INVALID");
    await changeLiability(ctx, x.budgetIds, reservedMicros, 0, true);
    const id = await ctx.db.insert("aiAttempts", {
      owner: "jev-intent-router",
      provider: "typesafe",
      purpose: "intent-routing",
      operation: "systemone",
      routingOperationId: o._id,
      workspaceId: o.workspaceId,
      accountId: o.accountId,
      actorId: o.actorId,
      inputVersionId: o.inputVersionId,
      operationKey: o.operationKey,
      policyId: x.p._id,
      policyFingerprint: o.policyFingerprint!,
      policyVersion: x.p.version,
      controlId: x.c._id,
      requestFingerprint: o.semanticKey,
      questionVersion: o.questionVersion,
      normalizationVersion: o.normalizationVersion,
      model: x.p.model,
      resolvedModel: null,
      currency: x.p.currency,
      inputMicrosPerMillion: x.p.inputMicrosPerMillion,
      outputMicrosPerMillion: x.p.outputMicrosPerMillion,
      maxInputTokens: x.p.maxInputTokens,
      maxOutputTokens: x.p.maxOutputTokens,
      budgetIds: x.budgetIds,
      reservedMicros,
      heldMicros: reservedMicros,
      estimatedMicros: null,
      billedMicros: null,
      state: "sent",
      sentAt: Date.now(),
      settledAt: null,
      inputTokens: null,
      outputTokens: null,
      latencyMs: null,
      outcome: null,
      fallback: "none",
    });
    await ctx.db.patch(o._id, { attemptId: id });
    if (x.c.failures >= CIRCUIT_FAILURES)
      await ctx.db.patch(x.c._id, { probeAttemptId: id });
    return id;
  },
});
export const authorizeFetch = internalQuery({
  args: {
    ...request,
    attemptId: v.id("aiAttempts"),
    expectedFingerprint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await operation(ctx, a.operationId),
      x = await current(ctx, o),
      t = await routingReceipt(ctx, a.attemptId);
    if (
      o.attemptId !== t._id ||
      t.routingOperationId !== o._id ||
      t.state !== "sent" ||
      x.requestFingerprint !== a.expectedFingerprint
    )
      fail("ROUTING_RECEIPT_INVALID");
    return null;
  },
});
export async function routingReceipt(
  ctx: Ctx,
  id: Id<"aiAttempts">,
  expectedOperationId?: Id<"jevRoutingOperations">,
) {
  const t = await ctx.db.get(id);
  if (
    !t ||
    t.owner !== "jev-intent-router" ||
    (expectedOperationId !== undefined &&
      t.routingOperationId !== expectedOperationId) ||
    t.runId !== undefined ||
    t.researchOrderId !== undefined ||
    t.logicalIntent !== undefined ||
    t.budgetIds.length !== 3 ||
    new Set(t.budgetIds).size !== 3
  )
    fail("ROUTING_RECEIPT_INVALID");
  const own = await ctx.db
    .query("aiAttempts")
    .withIndex("by_routing_operation", (q) =>
      q
        .eq("owner", "jev-intent-router")
        .eq("routingOperationId", t.routingOperationId),
    )
    .unique();
  if (own?._id !== id) fail("ROUTING_RECEIPT_INVALID");
  const o = await ctx.db.get(t.routingOperationId),
    p = await ctx.db.get(t.policyId);
  if (
    !o ||
    o.attemptId !== id ||
    o.actorId !== t.actorId ||
    o.workspaceId !== t.workspaceId ||
    o.accountId !== t.accountId ||
    o.inputVersionId !== t.inputVersionId ||
    o.operationKey !== t.operationKey ||
    o.semanticKey !== t.requestFingerprint ||
    o.policyId !== t.policyId ||
    o.controlId !== t.controlId ||
    o.questionVersion !== t.questionVersion ||
    o.normalizationVersion !== t.normalizationVersion ||
    !p ||
    !("purpose" in p) ||
    p.purpose !== "intent-routing" ||
    (await fingerprint(p)) !== t.policyFingerprint ||
    p.version !== t.policyVersion ||
    p.model !== t.model ||
    p.currency !== t.currency ||
    p.workspaceId !== t.workspaceId ||
    p.accountId !== t.accountId ||
    p.inputMicrosPerMillion !== t.inputMicrosPerMillion ||
    p.outputMicrosPerMillion !== t.outputMicrosPerMillion ||
    p.maxInputTokens !== t.maxInputTokens ||
    p.maxOutputTokens !== t.maxOutputTokens ||
    t.reservedMicros !==
      estimate(p.maxInputTokens, p.inputMicrosPerMillion) +
        estimate(p.maxOutputTokens, p.outputMicrosPerMillion) ||
    t.heldMicros !== (t.state === "settled" ? 0 : t.reservedMicros)
  )
    fail("ROUTING_RECEIPT_INVALID");
  for (const [i, id] of t.budgetIds.entries()) {
    const b = await ctx.db.get(id);
    if (
      !b ||
      b.currency !== t.currency ||
      b.scope !== (["provider", "workspace", "account"] as const)[i] ||
      b.key !==
        (i === 0
          ? "jev:provider"
          : i === 1
            ? `jev:workspace:${t.workspaceId}`
            : `jev:account:${t.accountId}`) ||
      (i === 0 && (b.workspaceId !== undefined || b.accountId !== undefined)) ||
      (i === 1 &&
        (b.workspaceId !== t.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== t.workspaceId || b.accountId !== t.accountId))
    )
      fail("ROUTING_RECEIPT_INVALID");
  }
  return t;
}
export const settle = internalMutation({
  args: {
    attemptId: v.id("aiAttempts"),
    inputTokens: v.union(v.number(), v.null()),
    outputTokens: v.union(v.number(), v.null()),
    resolvedModel: v.union(v.string(), v.null()),
    outcome: v.union(outcome, v.literal("unavailable")),
    latencyMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const t = await routingReceipt(ctx, a.attemptId),
      known =
        a.inputTokens !== null &&
        a.outputTokens !== null &&
        bounded(a.inputTokens, 1e9, true) &&
        bounded(a.outputTokens, 1e9, true);
    if (
      (a.inputTokens !== null && !bounded(a.inputTokens, 1e9, true)) ||
      (a.outputTokens !== null && !bounded(a.outputTokens, 1e9, true))
    )
      fail("ROUTING_RECEIPT_INVALID");
    if (
      !bounded(a.latencyMs, 600000, true) ||
      (a.resolvedModel !== null &&
        !/^[A-Za-z0-9_.-]{1,100}$/.test(a.resolvedModel))
    )
      fail("ROUTING_RECEIPT_INVALID");
    if (t.state === "settled") {
      if (
        known &&
        (t.inputTokens !== a.inputTokens ||
          t.outputTokens !== a.outputTokens ||
          t.resolvedModel !== a.resolvedModel)
      )
        fail("ROUTING_RECEIPT_CONFLICT");
      return null;
    }
    const cost = known
      ? estimate(a.inputTokens!, t.inputMicrosPerMillion) +
        estimate(a.outputTokens!, t.outputMicrosPerMillion)
      : null;
    if (cost !== null) {
      if (!Number.isSafeInteger(cost)) fail("ROUTING_RECEIPT_INVALID");
      await changeLiability(ctx, t.budgetIds, -t.heldMicros, cost);
    }
    await ctx.db.patch(t._id, {
      state: known ? "settled" : "unknown",
      heldMicros: known ? 0 : t.heldMicros,
      estimatedMicros: cost,
      inputTokens: known ? a.inputTokens : null,
      outputTokens: known ? a.outputTokens : null,
      resolvedModel: a.resolvedModel,
      outcome: a.outcome,
      latencyMs: a.latencyMs,
      settledAt: known ? Date.now() : null,
      fallback: a.outcome === "success" ? "none" : "unavailable",
    });
    if (t.outcome === null) {
      const c = await ctx.db.get(t.controlId);
      if (
        c &&
        "purpose" in c &&
        c.purpose === "intent-routing" &&
        c.key === `routing:account:${t.accountId}` &&
        c.workspaceId === t.workspaceId &&
        c.accountId === t.accountId
      ) {
        if (a.outcome === "unavailable") {
          if (c.probeAttemptId === t._id)
            await ctx.db.patch(c._id, { probeAttemptId: null });
        } else if (
          c.enabled &&
          c.routing &&
          !c.withdrawn &&
          c.policyId === t.policyId &&
          (c.probeAttemptId === null || c.probeAttemptId === t._id)
        ) {
          const failed = [
              "timeout",
              "rate_limit",
              "provider_error",
              "invalid_response",
            ].includes(a.outcome),
            failures = failed ? Math.min(CIRCUIT_FAILURES, c.failures + 1) : 0;
          await ctx.db.patch(c._id, {
            failures,
            openUntil:
              failures >= CIRCUIT_FAILURES
                ? Date.now() + CIRCUIT_COOLDOWN_MS
                : 0,
            probeAttemptId:
              c.probeAttemptId === t._id ? null : c.probeAttemptId,
          });
        }
      }
    }
    return null;
  },
});
export const finish = internalMutation({
  args: {
    ...request,
    outcome: v.union(outcome, v.literal("unavailable")),
    answers: v.union(v.record(v.string(), answer), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await operation(ctx, a.operationId);
    if (o.result || o.sourceUnavailable) return null;
    try {
      await current(ctx, o);
    } catch (error) {
      routingLoss(error);
      await cleanup(ctx, o);
      const kept = await operation(ctx, o._id);
      if (!kept.sourceUnavailable)
        await ctx.db.patch(o._id, { result: fallback() });
      return null;
    }
    let result = fallback();
    const choice = a.answers?.intent;
    if (
      a.outcome === "success" &&
      choice?.type === "choice" &&
      strategies.some((x) => x === choice.value) &&
      Number.isFinite(choice.confidence) &&
      choice.confidence >= 0 &&
      choice.confidence <= 1
    ) {
      const category = choice.value as (typeof strategies)[number],
        confidence = choice.confidence;
      result = {
        ...fallback(),
        status:
          confidence < 0.5
            ? "fallback"
            : confidence < 0.9
              ? "suggestion"
              : "routed",
        category,
        choiceConfidence: confidence,
        suggestion: confidence >= 0.5 ? category : null,
        effectiveStrategy: confidence >= 0.9 ? category : "generic",
      };
    }
    if (o.attemptId) {
      const t = await routingReceipt(ctx, o.attemptId, o._id);
      if (t.outcome !== a.outcome) fail("ROUTING_RECEIPT_INVALID");
    } else if (a.outcome !== "unavailable") fail("ROUTING_RECEIPT_INVALID");
    await ctx.db.patch(o._id, { result });
    return null;
  },
});
export const classifyAction = internalAction({
  args: request,
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    const o = await ctx.runQuery(internal.ai.jev.routing.status, a);
    if (o) return null;
    const result = await ctx.runAction(
      internal.ai.jev.client.executeRouting,
      a,
    );
    await ctx.runMutation(internal.ai.jev.routing.finish, { ...a, ...result });
    return null;
  },
});
export const status = internalQuery({
  args: request,
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const o = await operation(ctx, a.operationId);
    return o.result !== null || o.sourceUnavailable || o.attemptId !== null;
  },
});
async function erase(ctx: MutationCtx, o: Operation) {
  await ctx.scheduler.runAfter(0, internal.content.ideas.purgeRouting, {
    operationId: o._id,
    cursor: null,
  });
  if (!o.sourceUnavailable)
    await ctx.db.patch(o._id, {
      sourceUnavailable: true,
      intent: null,
      candidateMediaChecksums: undefined,
      result: null,
    });
}
async function cleanup(ctx: MutationCtx, o: Operation, force = false) {
  if (force) return erase(ctx, o);
  try {
    await retainedRoutingProof(ctx, o);
  } catch (error) {
    routingLoss(error);
    await erase(ctx, o);
  }
}
export const scrub = internalMutation({
  args: request,
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.operationId);
    if (o) {
      if (o.sourceUnavailable)
        await ctx.scheduler.runAfter(0, internal.content.ideas.purgeRouting, {
          operationId: a.operationId,
          cursor: null,
        });
      await cleanup(ctx, o);
    } else
      await ctx.scheduler.runAfter(0, internal.content.ideas.purgeRouting, {
        operationId: a.operationId,
        cursor: null,
      });
    return null;
  },
});
export const purge = internalMutation({
  args: {
    inputVersionId: v.optional(v.id("ideaVersions")),
    ideaId: v.optional(v.id("ideas")),
    styleVersionId: v.optional(v.id("styleProfileVersions")),
    actorId: v.optional(v.id("users")),
    workspaceId: v.optional(v.id("workspaces")),
    accountId: v.optional(v.id("socialAccounts")),
    cursor,
    force: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.cursor === null)
      await ctx.scheduler.runAfter(0, internal.ai.jev.verify.purge, {
        ...(a.actorId ? { actorId: a.actorId } : {}),
        ...(a.workspaceId && a.accountId
          ? { workspaceId: a.workspaceId, accountId: a.accountId }
          : {}),
        cursor: null,
        force: false,
      });
    const query = ctx.db.query("jevRoutingOperations");
    const rows = a.inputVersionId
      ? query.withIndex("by_input", (q) =>
          q
            .eq("inputVersionId", a.inputVersionId!)
            .eq("sourceUnavailable", false),
        )
      : a.ideaId
        ? query.withIndex("by_idea", (q) =>
            q.eq("ideaId", a.ideaId!).eq("sourceUnavailable", false),
          )
        : a.styleVersionId
          ? query.withIndex("by_style", (q) =>
              q
                .eq("style.versionId", a.styleVersionId!)
                .eq("sourceUnavailable", false),
            )
          : a.actorId
            ? query.withIndex("by_actor", (q) =>
                q.eq("actorId", a.actorId!).eq("sourceUnavailable", false),
              )
            : a.workspaceId && a.accountId
              ? query.withIndex("by_scope", (q) =>
                  q
                    .eq("workspaceId", a.workspaceId!)
                    .eq("accountId", a.accountId!)
                    .eq("sourceUnavailable", false),
                )
              : query.withIndex("by_source", (q) =>
                  q.eq("sourceUnavailable", false),
                );
    const page = await rows.paginate({
      cursor: a.cursor,
      numItems: a.force ? 25 : 1,
    });
    for (const o of page.page) await cleanup(ctx, o, a.force);
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.ai.jev.routing.purge, {
        ...a,
        cursor: page.continueCursor,
      });
    return null;
  },
});
export const disable = workspaceMutation({
  args: { accountId: v.id("socialAccounts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const c = await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", `routing:account:${a.accountId}`))
      .unique();
    if (c && "purpose" in c && c.workspaceId === ctx.workspace._id)
      await ctx.db.patch(c._id, {
        enabled: false,
        routing: false,
        withdrawn: true,
      });
    else if (c) fail("ROUTING_CONFIGURATION_REQUIRED");
    else
      await ctx.db.insert("jevControls", {
        purpose: "intent-routing",
        key: `routing:account:${a.accountId}`,
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        enabled: false,
        analyzer: false,
        routing: false,
        withdrawn: true,
        verification: false,
        networkFit: false,
        policyId: null,
        composerTimeoutMs: COMPOSER_TIMEOUT_MS,
        backgroundTimeoutMs: BACKGROUND_TIMEOUT_MS,
        failures: 0,
        openUntil: 0,
        probeAttemptId: null,
      });
    await ctx.scheduler.runAfter(0, internal.ai.jev.routing.purge, {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      cursor: null,
      force: true,
    });
    return null;
  },
});
export const disableGlobal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const c = await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", "routing:global"))
      .unique();
    if (c && "purpose" in c)
      await ctx.db.patch(c._id, {
        enabled: false,
        routing: false,
        withdrawn: true,
      });
    else if (c) fail("ROUTING_CONFIGURATION_REQUIRED");
    else
      await ctx.db.insert("jevControls", {
        purpose: "intent-routing",
        key: "routing:global",
        enabled: false,
        analyzer: false,
        routing: false,
        withdrawn: true,
        verification: false,
        networkFit: false,
        policyId: null,
        composerTimeoutMs: COMPOSER_TIMEOUT_MS,
        backgroundTimeoutMs: BACKGROUND_TIMEOUT_MS,
        failures: 0,
        openUntil: 0,
        probeAttemptId: null,
      });
    await ctx.scheduler.runAfter(0, internal.ai.jev.routing.purge, {
      cursor: null,
      force: true,
    });
    return null;
  },
});
export const availability = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.object({
    status: v.union(v.literal("ready"), v.literal("configuration_required")),
  }),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const account = await ctx.db.get(a.accountId);
    requireReference(ctx.workspace._id, account);
    try {
      if (
        !account ||
        account.provider !== "X" ||
        account.connection !== "connected"
      )
        fail("ROUTING_ACCOUNT_CHANGED");
      await configuration(ctx, ctx.workspace._id, a.accountId);
      return { status: "ready" as const };
    } catch (error) {
      routingLoss(error);
      return { status: "configuration_required" as const };
    }
  },
});

export const classify = action({
  args: { workspaceId: v.id("workspaces"), ...request },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    await ctx.runQuery(internal.ai.jev.routing.admitConsumer, a);
    await ctx.runAction(internal.ai.jev.routing.classifyAction, {
      operationId: a.operationId,
    });
    return null;
  },
});
export const admitConsumer = workspaceInternalQuery({
  args: request,
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const o = await operation(ctx, a.operationId);
    requireReference(ctx.workspace._id, o);
    if (o.actorId !== ctx.user._id) fail("ROUTING_AUTHORITY_UNAVAILABLE");
    await retainedRoutingProof(ctx, o);
    await source(ctx, o, true);
    return null;
  },
});
