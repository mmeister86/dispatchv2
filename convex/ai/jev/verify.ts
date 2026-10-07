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
  requireWorkspace,
  requireReference,
} from "../../lib/authorization";
import { sha256 } from "../../lib/crypto";
import { materialWalk, type MaterialWalk } from "../../research/pipelineAccess";
import { candidateProof, ideaProofUntil } from "../../research/contentProof";
import { routingSourceProof, routingLoss } from "./routing";
import { changeLiability } from "../accounting";
import { capability } from "../../lib/editorialFields";
import { estimate } from "./access";
import {
  routingStateContract,
  verificationRef,
  verificationView,
  verificationPolicyFields,
  verificationControlFields,
  outcome,
  answer,
  checkedVerification,
} from "./types";
import {
  resolveVerificationQuestions,
  verificationDecision,
  verificationVersions,
} from "./questions/outputVerification";
import {
  BACKGROUND_TIMEOUT_MS,
  COMPOSER_TIMEOUT_MS,
  CIRCUIT_FAILURES,
  CIRCUIT_COOLDOWN_MS,
} from "./thresholds";
type Ctx = QueryCtx | MutationCtx;
type Ref = Infer<typeof verificationRef>;
type Slot = NonNullable<Doc<"contentRequests">["verification"]>;
type Policy = Extract<Doc<"jevPolicies">, { purpose: "output-verification" }>;
type Control = Extract<Doc<"jevControls">, { purpose: "output-verification" }>;
const request = { reference: verificationRef };
const cursor = v.union(v.string(), v.null());
const fingerprint = (p: Doc<"jevPolicies">) => sha256(JSON.stringify(p));
const bounded = (n: number, max: number, zero = false) =>
  Number.isSafeInteger(n) && n >= (zero ? 0 : 1) && n <= max;
const minimum = (...values: (number | null)[]) => {
  const n = Math.min(...values.map((n) => n ?? Infinity));
  return Number.isFinite(n) ? n : null;
};
function fail(code: string): never {
  throw new ConvexError(code);
}
export function verificationLoss(error: unknown) {
  if (
    error instanceof ConvexError &&
    typeof error.data === "string" &&
    [
      "VERIFICATION_SOURCE_UNAVAILABLE",
      "VERIFICATION_AUTHORITY_UNAVAILABLE",
      "VERIFICATION_PURPOSE_WITHDRAWN",
      "VERIFICATION_CONFIGURATION_REQUIRED",
      "VERIFICATION_CIRCUIT_OPEN",
      "VERIFICATION_EXPIRED",
      "VERIFICATION_ALREADY_ADMITTED",
      "VERIFICATION_USAGE_UNRESOLVED",
      "MODEL_BUDGET_EXHAUSTED",
    ].includes(error.data)
  )
    return;
  routingLoss(error);
}
async function admin(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
) {
  const actor = await ctx.db.get(actorId);
  if (!actor) fail("VERIFICATION_AUTHORITY_UNAVAILABLE");
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
    .withIndex("by_key", (q) => q.eq("key", "verification:global"))
    .unique();
  const c = await ctx.db
    .query("jevControls")
    .withIndex("by_key", (q) =>
      q.eq("key", `verification:account:${accountId}`),
    )
    .unique();
  if (
    !global ||
    !("purpose" in global) ||
    global.purpose !== "output-verification" ||
    global.workspaceId !== undefined ||
    global.accountId !== undefined ||
    global.withdrawn ||
    !global.enabled ||
    !global.verification ||
    !c ||
    !("purpose" in c) ||
    c.purpose !== "output-verification" ||
    c.workspaceId !== workspaceId ||
    c.accountId !== accountId ||
    c.withdrawn ||
    !c.enabled ||
    !c.verification
  )
    fail("VERIFICATION_PURPOSE_WITHDRAWN");
  if (
    !bounded(c.composerTimeoutMs, COMPOSER_TIMEOUT_MS) ||
    !bounded(c.backgroundTimeoutMs, BACKGROUND_TIMEOUT_MS) ||
    !bounded(c.failures, CIRCUIT_FAILURES, true) ||
    !bounded(c.openUntil, Number.MAX_SAFE_INTEGER, true)
  )
    fail("VERIFICATION_CONFIGURATION_REQUIRED");
  if (
    circuit &&
    (c.openUntil > Date.now() ||
      (c.probeAttemptId !== null && c.probeAttemptId !== probe))
  )
    fail("VERIFICATION_CIRCUIT_OPEN");
  const p = c.policyId ? await ctx.db.get(c.policyId) : null;
  if (
    !p ||
    !("purpose" in p) ||
    p.purpose !== "output-verification" ||
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
    fail("VERIFICATION_CONFIGURATION_REQUIRED");
  await admin(ctx, workspaceId, p.approvedBy);
  resolveVerificationQuestions(
    p.questionVersion,
    p.normalizationVersion,
    p.thresholdVersion,
  );
  if (
    p.thresholdVersion !== "jev-verification-hypotheses-v1" ||
    !process.env.TYPESAFE_API_KEY?.trim() ||
    (await sha256(process.env.TYPESAFE_API_KEY)) !== p.credentialFingerprint
  )
    fail("VERIFICATION_CONFIGURATION_REQUIRED");
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
      !b.purposes.includes("output-verification") ||
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
      fail("VERIFICATION_PURPOSE_WITHDRAWN");
    if (b.approvedBy) await admin(ctx, workspaceId, b.approvedBy);
    budgetIds.push(b._id);
    authorityUntil = Math.min(authorityUntil, b.expiresAt);
  }
  return { p, c, budgetIds, authorityUntil };
}
function reference(r: Doc<"contentRequests">, s: Slot): Ref {
  return {
    contentRequestId: r._id,
    candidateVersionId: s.candidateVersionId,
    contentHash: s.contentHash,
    commandFingerprint: s.commandFingerprint,
  };
}
async function slot(ctx: Ctx, ref: Ref) {
  const r = await ctx.db.get(ref.contentRequestId),
    s = r?.verification;
  if (
    !r ||
    !s ||
    s.candidateVersionId !== ref.candidateVersionId ||
    s.contentHash !== ref.contentHash ||
    s.commandFingerprint !== ref.commandFingerprint ||
    s.producerRunId !== r.runId ||
    s.inputVersionId !== r.inputVersionId
  )
    fail("VERIFICATION_RECEIPT_INVALID");
  return { r, s };
}
async function actor(
  ctx: Ctx,
  r: Doc<"contentRequests">,
  s: Pick<Slot, "actorId">,
) {
  const u = await ctx.db.get(s.actorId);
  if (!u) fail("VERIFICATION_AUTHORITY_UNAVAILABLE");
  requireRole((await requireWorkspace(ctx, r.workspaceId, u)).membership, [
    "Owner",
    "Admin",
    "Editor",
  ]);
}
async function purpose(ctx: Ctx, r: Doc<"contentRequests">) {
  for (const key of [
    "verification:global",
    `verification:account:${r.accountId}`,
  ]) {
    const c = await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (
      c &&
      "purpose" in c &&
      c.purpose === "output-verification" &&
      c.withdrawn
    )
      fail("VERIFICATION_PURPOSE_WITHDRAWN");
  }
}
async function packet(
  ctx: Ctx,
  r: Doc<"contentRequests">,
  s: Pick<Slot, "candidateVersionId" | "contentHash" | "actorId">,
  fresh: boolean,
  walk: MaterialWalk = materialWalk(),
) {
  await actor(ctx, r, s);
  await purpose(ctx, r);
  const ver = await ctx.db.get(s.candidateVersionId);
  if (
    !ver ||
    ver.workspaceId !== r.workspaceId ||
    ver.runId !== r.runId ||
    ver.candidate?.contentHash !== s.contentHash
  )
    fail("VERIFICATION_SOURCE_UNAVAILABLE");
  const p = await candidateProof(ctx, ver, fresh, walk),
    original = await routingSourceProof(ctx, p.operation, false, walk),
    until = await ideaProofUntil(ctx, ver, walk);
  const media = [];
  for (const m of ver.candidate!.content.media) {
    const a = await ctx.db.get(m.assetId);
    if (!a || a.workspaceId !== r.workspaceId)
      fail("VERIFICATION_SOURCE_UNAVAILABLE");
    media.push({
      type: a.type,
      mime: a.mime ?? null,
      width: a.width ?? null,
      height: a.height ?? null,
      duration: a.duration ?? null,
      alt: m.alt,
    });
  }
  const account = await ctx.db.get(r.accountId);
  if (!account) fail("VERIFICATION_SOURCE_UNAVAILABLE");
  const state = {
    ...original.state,
    candidate: {
      posts: ver.candidate!.content.text.map((text, position) => ({
        position,
        text,
      })),
      media,
      network: "x" as const,
      capability: account.capability,
    },
  };
  return {
    state,
    sourceUntil: minimum(p.sourceUntil, original.sourceUntil, until),
    provenanceHash: ver.candidate!.provenanceHash,
  };
}
async function current(ctx: Ctx, ref: Ref, execution = true) {
  const { r, s } = await slot(ctx, ref);
  if (s.sourceUnavailable) fail("VERIFICATION_SOURCE_UNAVAILABLE");
  const x = await packet(ctx, r, s, true),
    c = await configuration(
      ctx,
      r.workspaceId,
      r.accountId,
      s.attemptId,
      execution,
    );
  if (
    c.p._id !== s.policyId ||
    c.c._id !== s.controlId ||
    (await fingerprint(c.p)) !== s.policyFingerprint
  )
    fail("VERIFICATION_CONFIGURATION_REQUIRED");
  const fp = await sha256(
    JSON.stringify([
      x.state,
      x.provenanceHash,
      s.policyFingerprint,
      s.questionVersion,
      s.normalizationVersion,
      s.thresholdVersion,
    ]),
  );
  if (fp !== s.requestFingerprint || x.provenanceHash !== s.provenanceHash)
    fail("VERIFICATION_SOURCE_UNAVAILABLE");
  const sourceUntil = minimum(s.sourceUntil, x.sourceUntil, c.authorityUntil);
  if (sourceUntil !== null && sourceUntil <= Date.now())
    fail("VERIFICATION_SOURCE_UNAVAILABLE");
  if (execution && Date.now() >= s.deadline) fail("VERIFICATION_EXPIRED");
  return {
    ...x,
    ...c,
    sourceUntil,
    requestFingerprint: fp,
    deadline: s.deadline,
  };
}
export const prepare = workspaceMutation({
  args: {
    versionId: v.id("ideaVersions"),
    contentHash: v.string(),
    operationKey: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("ready"), v.literal("configuration_required")),
    reference: v.union(verificationRef, v.null()),
  }),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    if (!/^[A-Za-z0-9:_-]{1,160}$/.test(a.operationKey))
      fail("INVALID_OPERATION_KEY");
    const ver = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.versionId),
    ) as Doc<"ideaVersions">;
    if (!ver.runId) fail("VERIFICATION_SOURCE_UNAVAILABLE");
    const r = await ctx.db
      .query("contentRequests")
      .withIndex("by_runId", (q) => q.eq("runId", ver.runId!))
      .unique();
    if (!r || r.workspaceId !== ctx.workspace._id)
      fail("VERIFICATION_SOURCE_UNAVAILABLE");
    const commandFingerprint = await sha256(
      JSON.stringify([
        ctx.user._id,
        a.versionId,
        a.contentHash,
        a.operationKey,
      ]),
    );
    const x = await packet(
      ctx,
      r,
      {
        candidateVersionId: ver._id,
        contentHash: a.contentHash,
        actorId: ctx.user._id,
      },
      true,
    );
    if (r.verification) {
      const s = r.verification;
      if (
        s.actorId !== ctx.user._id ||
        s.commandFingerprint !== commandFingerprint ||
        s.operationKey !== a.operationKey ||
        s.candidateVersionId !== ver._id ||
        s.contentHash !== a.contentHash
      )
        fail("VERIFICATION_ALREADY_BOUND");
      if (s.sourceUnavailable) fail("VERIFICATION_SOURCE_UNAVAILABLE");
      return { status: "ready" as const, reference: reference(r, s) };
    }
    let c;
    try {
      c = await configuration(ctx, r.workspaceId, r.accountId);
    } catch (error) {
      verificationLoss(error);
      return { status: "configuration_required" as const, reference: null };
    }
    const body = JSON.stringify({
      state: x.state,
      questions: resolveVerificationQuestions(
        c.p.questionVersion,
        c.p.normalizationVersion,
        c.p.thresholdVersion,
      ).questions,
      model: c.p.model,
    });
    if (new TextEncoder().encode(body).length > c.p.maxInputTokens)
      fail("VERIFICATION_INPUT_LIMIT");
    const policyFingerprint = await fingerprint(c.p),
      startedAt = Date.now(),
      sourceUntil = minimum(x.sourceUntil, c.authorityUntil);
    const s: Slot = {
      kind: "standalone-verification-v1",
      candidateVersionId: ver._id,
      contentHash: a.contentHash,
      provenanceHash: x.provenanceHash,
      operationKey: a.operationKey,
      commandFingerprint,
      requestFingerprint: await sha256(
        JSON.stringify([
          x.state,
          x.provenanceHash,
          policyFingerprint,
          c.p.questionVersion,
          c.p.normalizationVersion,
          c.p.thresholdVersion,
        ]),
      ),
      actorId: ctx.user._id,
      producerRunId: r.runId,
      inputVersionId: r.inputVersionId,
      startedAt,
      deadline: Math.min(
        startedAt + c.c.backgroundTimeoutMs,
        sourceUntil ?? Infinity,
      ),
      sourceUntil,
      policyId: c.p._id,
      policyFingerprint,
      controlId: c.c._id,
      questionVersion: c.p.questionVersion,
      normalizationVersion: c.p.normalizationVersion,
      thresholdVersion: c.p.thresholdVersion,
      state: "ready",
      attemptId: null,
      sourceUnavailable: false,
      result: null,
      resultFingerprint: null,
      stickyRisk: null,
    };
    await ctx.db.patch(r._id, { verification: s });
    if (sourceUntil !== null)
      await ctx.scheduler.runAt(
        sourceUntil,
        internal.ai.jev.verify.purgeCandidate,
        { versionId: ver._id, cursor: null },
      );
    return { status: "ready" as const, reference: reference(r, s) };
  },
});
const contextContract = v.object({
  state: v.object({
    ...routingStateContract.fields,
    candidate: v.object({
      posts: v.array(v.object({ position: v.number(), text: v.string() })),
      media: v.array(
        v.object({
          type: v.union(v.literal("image"), v.literal("video")),
          mime: v.union(v.string(), v.null()),
          width: v.union(v.number(), v.null()),
          height: v.union(v.number(), v.null()),
          duration: v.union(v.number(), v.null()),
          alt: v.string(),
        }),
      ),
      network: v.literal("x"),
      capability,
    }),
  }),
  deadline: v.number(),
  authorityUntil: v.number(),
  requestFingerprint: v.string(),
  sourceUntil: v.union(v.number(), v.null()),
  provenanceHash: v.string(),
  budgetIds: v.array(v.id("aiBudgets")),
  p: v.object({
    ...verificationPolicyFields,
    _id: v.id("jevPolicies"),
    _creationTime: v.number(),
  }),
  c: v.object({
    ...verificationControlFields,
    _id: v.id("jevControls"),
    _creationTime: v.number(),
  }),
});
export const context = internalQuery({
  args: request,
  returns: contextContract,
  handler: async (ctx, a) => current(ctx, a.reference),
});
export const status = internalQuery({
  args: request,
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const { s } = await slot(ctx, a.reference);
    return (
      !s.sourceUnavailable &&
      s.state === "ready" &&
      s.attemptId === null &&
      s.result === null
    );
  },
});
export const fund = internalMutation({
  args: { ...request, expectedFingerprint: v.string() },
  returns: v.id("aiAttempts"),
  handler: async (ctx, a) => {
    const { r, s } = await slot(ctx, a.reference),
      x = await current(ctx, a.reference);
    if (
      s.state !== "ready" ||
      s.attemptId ||
      s.result ||
      x.requestFingerprint !== a.expectedFingerprint
    )
      fail("VERIFICATION_ALREADY_ADMITTED");
    for (const state of ["sent", "unknown"] as const)
      if (
        await ctx.db
          .query("aiAttempts")
          .withIndex("by_verification_pending", (q) =>
            q
              .eq("owner", "jev-output-verifier")
              .eq("workspaceId", r.workspaceId)
              .eq("accountId", r.accountId)
              .eq("candidateVersionId", s.candidateVersionId)
              .eq("state", state),
          )
          .first()
      )
        fail("VERIFICATION_USAGE_UNRESOLVED");
    if (
      await ctx.db
        .query("aiAttempts")
        .withIndex("by_jev_operation", (q) =>
          q
            .eq("owner", "jev-output-verifier")
            .eq("workspaceId", r.workspaceId)
            .eq("accountId", r.accountId)
            .eq("actorId", s.actorId)
            .eq("operationKey", s.operationKey),
        )
        .first()
    )
      fail("VERIFICATION_ALREADY_ADMITTED");
    const reservedMicros =
      estimate(x.p.maxInputTokens, x.p.inputMicrosPerMillion) +
      estimate(x.p.maxOutputTokens, x.p.outputMicrosPerMillion);
    if (!Number.isSafeInteger(reservedMicros))
      fail("VERIFICATION_RECEIPT_INVALID");
    await changeLiability(ctx, x.budgetIds, reservedMicros, 0, true);
    const id = await ctx.db.insert("aiAttempts", {
      owner: "jev-output-verifier",
      provider: "typesafe",
      purpose: "output-verification",
      operation: "systemone",
      contentRequestId: r._id,
      candidateVersionId: s.candidateVersionId,
      contentHash: s.contentHash,
      provenanceHash: s.provenanceHash,
      producerRunId: s.producerRunId,
      commandFingerprint: s.commandFingerprint,
      workspaceId: r.workspaceId,
      accountId: r.accountId,
      actorId: s.actorId,
      inputVersionId: s.inputVersionId,
      operationKey: s.operationKey,
      policyId: x.p._id,
      policyFingerprint: s.policyFingerprint,
      policyVersion: x.p.version,
      controlId: x.c._id,
      requestFingerprint: s.requestFingerprint,
      questionVersion: s.questionVersion,
      normalizationVersion: s.normalizationVersion,
      thresholdVersion: s.thresholdVersion,
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
    await ctx.db.patch(r._id, {
      verification: { ...s, attemptId: id, state: "admitted" },
    });
    if (x.c.failures >= CIRCUIT_FAILURES)
      await ctx.db.patch(x.c._id, { probeAttemptId: id });
    return id;
  },
});
async function receipt(ctx: Ctx, id: Id<"aiAttempts">, ref: Ref) {
  const t = await ctx.db.get(id);
  if (
    !t ||
    t.owner !== "jev-output-verifier" ||
    t.provider !== "typesafe" ||
    t.purpose !== "output-verification" ||
    t.operation !== "systemone" ||
    t.contentRequestId !== ref.contentRequestId ||
    t.candidateVersionId !== ref.candidateVersionId ||
    t.contentHash !== ref.contentHash ||
    t.commandFingerprint !== ref.commandFingerprint ||
    t.runId !== undefined ||
    t.routingOperationId !== undefined ||
    t.researchOrderId !== undefined ||
    t.logicalIntent !== undefined ||
    t.budgetIds.length !== 3 ||
    new Set(t.budgetIds).size !== 3
  )
    fail("VERIFICATION_RECEIPT_INVALID");
  const own = await ctx.db
    .query("aiAttempts")
    .withIndex("by_jev_operation", (q) =>
      q
        .eq("owner", "jev-output-verifier")
        .eq("workspaceId", t.workspaceId)
        .eq("accountId", t.accountId)
        .eq("actorId", t.actorId)
        .eq("operationKey", t.operationKey),
    )
    .unique();
  if (own?._id !== id) fail("VERIFICATION_RECEIPT_INVALID");
  const r = await ctx.db.get(t.contentRequestId),
    s = r?.verification,
    p = await ctx.db.get(t.policyId);
  if (
    r &&
    (!s ||
      s.attemptId !== id ||
      s.actorId !== t.actorId ||
      r.workspaceId !== t.workspaceId ||
      r.accountId !== t.accountId ||
      s.candidateVersionId !== t.candidateVersionId ||
      s.contentHash !== t.contentHash ||
      s.producerRunId !== t.producerRunId ||
      s.inputVersionId !== t.inputVersionId ||
      s.operationKey !== t.operationKey ||
      s.commandFingerprint !== t.commandFingerprint ||
      s.requestFingerprint !== t.requestFingerprint ||
      s.policyId !== t.policyId ||
      s.controlId !== t.controlId ||
      s.policyFingerprint !== t.policyFingerprint)
  )
    fail("VERIFICATION_RECEIPT_INVALID");
  if (
    !p ||
    !("purpose" in p) ||
    p.purpose !== "output-verification" ||
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
    p.questionVersion !== t.questionVersion ||
    p.normalizationVersion !== t.normalizationVersion ||
    p.thresholdVersion !== t.thresholdVersion ||
    t.reservedMicros !==
      estimate(p.maxInputTokens, p.inputMicrosPerMillion) +
        estimate(p.maxOutputTokens, p.outputMicrosPerMillion) ||
    t.heldMicros !== (t.state === "settled" ? 0 : t.reservedMicros)
  )
    fail("VERIFICATION_RECEIPT_INVALID");
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
      fail("VERIFICATION_RECEIPT_INVALID");
  }
  return t;
}
export const authorizeFetch = internalQuery({
  args: {
    ...request,
    attemptId: v.id("aiAttempts"),
    expectedFingerprint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { s } = await slot(ctx, a.reference),
      x = await current(ctx, a.reference),
      t = await receipt(ctx, a.attemptId, a.reference);
    if (
      s.attemptId !== t._id ||
      t.state !== "sent" ||
      x.requestFingerprint !== a.expectedFingerprint
    )
      fail("VERIFICATION_RECEIPT_INVALID");
    return null;
  },
});
export const settle = internalMutation({
  args: {
    ...request,
    attemptId: v.id("aiAttempts"),
    inputTokens: v.union(v.number(), v.null()),
    outputTokens: v.union(v.number(), v.null()),
    resolvedModel: v.union(v.string(), v.null()),
    outcome: v.union(outcome, v.literal("unavailable")),
    latencyMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const t = await receipt(ctx, a.attemptId, a.reference),
      known =
        a.inputTokens !== null &&
        a.outputTokens !== null &&
        bounded(a.inputTokens, 1e9, true) &&
        bounded(a.outputTokens, 1e9, true);
    if (
      (a.inputTokens !== null && !bounded(a.inputTokens, 1e9, true)) ||
      (a.outputTokens !== null && !bounded(a.outputTokens, 1e9, true))
    )
      fail("VERIFICATION_RECEIPT_INVALID");
    if (
      !bounded(a.latencyMs, 600000, true) ||
      (a.resolvedModel !== null &&
        !/^[A-Za-z0-9_.-]{1,100}$/.test(a.resolvedModel))
    )
      fail("VERIFICATION_RECEIPT_INVALID");
    if (t.state === "settled") {
      if (
        known &&
        (t.inputTokens !== a.inputTokens ||
          t.outputTokens !== a.outputTokens ||
          t.resolvedModel !== a.resolvedModel)
      )
        fail("VERIFICATION_RECEIPT_CONFLICT");
      return null;
    }
    const cost = known
      ? estimate(a.inputTokens!, t.inputMicrosPerMillion) +
        estimate(a.outputTokens!, t.outputMicrosPerMillion)
      : null;
    if (cost !== null) {
      if (!Number.isSafeInteger(cost)) fail("VERIFICATION_RECEIPT_INVALID");
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
        c.purpose === "output-verification" &&
        c.key === `verification:account:${t.accountId}` &&
        c.workspaceId === t.workspaceId &&
        c.accountId === t.accountId
      ) {
        if (a.outcome === "unavailable") {
          if (c.probeAttemptId === t._id)
            await ctx.db.patch(c._id, { probeAttemptId: null });
        } else if (
          c.enabled &&
          c.verification &&
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
    attemptId: v.id("aiAttempts"),
    outcome: v.union(outcome, v.literal("unavailable")),
    answers: v.union(v.record(v.string(), answer), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { r, s } = await slot(ctx, a.reference),
      t = await receipt(ctx, a.attemptId, a.reference);
    if (s.attemptId !== t._id) fail("VERIFICATION_RECEIPT_INVALID");
    if (s.sourceUnavailable) return null;
    let x;
    try {
      x = await current(ctx, a.reference, false);
    } catch (error) {
      verificationLoss(error);
      await erase(ctx, r);
      return null;
    }
    const resultFingerprint = await sha256(
      JSON.stringify([a.attemptId, a.outcome, a.answers]),
    );
    if (s.state === "finished" || s.state === "stopped") {
      if (s.resultFingerprint !== resultFingerprint)
        fail("VERIFICATION_RESULT_CONFLICT");
      return null;
    }
    let result: Slot["result"] = null,
      stickyRisk = s.stickyRisk;
    if (
      a.outcome === "success" &&
      a.answers &&
      Date.now() < s.deadline &&
      t.state === "settled" &&
      t.outcome === "success" &&
      t.resolvedModel === x.p.model &&
      t.inputTokens !== null &&
      t.outputTokens !== null &&
      t.inputTokens <= x.p.maxInputTokens &&
      t.outputTokens <= x.p.maxOutputTokens
    ) {
      const d = verificationDecision(a.answers, {
        tone: !!x.state.intent.tone || !!x.state.style,
        cta: !!x.state.intent.cta,
      });
      if (d.decision === "manual_review")
        stickyRisk = {
          candidateVersionId: s.candidateVersionId,
          contentHash: s.contentHash,
          reasonKeys: d.reasonKeys,
        };
      const base = {
        candidateVersionId: s.candidateVersionId,
        contentHash: s.contentHash,
        provenanceHash: s.provenanceHash,
        questionVersion: s.questionVersion,
        normalizationVersion: s.normalizationVersion,
        thresholdVersion: s.thresholdVersion,
        model: x.p.model,
        ...d,
      };
      result = {
        ...base,
        resultFingerprint: await sha256(JSON.stringify([a.reference, base])),
      };
    }
    await ctx.db.patch(r._id, {
      verification: {
        ...s,
        state: "finished",
        result,
        resultFingerprint,
        stickyRisk,
      },
    });
    return null;
  },
});
export async function verificationProjection(
  ctx: Ctx,
  ref: Ref,
): Promise<Infer<typeof verificationView>> {
  const { r, s } = await slot(ctx, ref),
    t = s.attemptId ? await receipt(ctx, s.attemptId, ref) : null;
  const base = {
    reference: ref,
    sourceUntil: null,
    deadline: s.deadline,
    state: s.state,
    result: null,
    stickyRisk: null,
    usage: t
      ? {
          attemptId: t._id,
          state: t.state,
          heldMicros: t.heldMicros,
          estimatedMicros: t.estimatedMicros,
          currency: t.currency,
        }
      : null,
  };
  try {
    if (s.sourceUnavailable) fail("VERIFICATION_SOURCE_UNAVAILABLE");
    const kept = await packet(ctx, r, s, false),
      sourceUntil = minimum(s.sourceUntil, kept.sourceUntil);
    if (sourceUntil !== null && sourceUntil <= Date.now())
      fail("VERIFICATION_SOURCE_UNAVAILABLE");
    let applicability: "current" | "historical" = "current";
    try {
      await current(ctx, ref, false);
    } catch (error) {
      verificationLoss(error);
      applicability = "historical";
    }
    return {
      ...base,
      applicability,
      sourceUntil,
      result: s.result,
      stickyRisk: s.stickyRisk,
    };
  } catch (error) {
    verificationLoss(error);
    return { ...base, applicability: "unavailable" };
  }
}
export async function candidateVerification(
  ctx: Ctx,
  ver: Doc<"ideaVersions">,
) {
  if (!ver.runId) return undefined;
  const r = await ctx.db
    .query("contentRequests")
    .withIndex("by_runId", (q) => q.eq("runId", ver.runId!))
    .unique();
  if (!r?.verification) return undefined;
  if (r.verification.candidateVersionId !== ver._id)
    fail("VERIFICATION_RECEIPT_INVALID");
  return verificationProjection(ctx, reference(r, r.verification));
}
export async function checkedApplication(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  versionId: Id<"ideaVersions">,
  contentHash: string,
  a: Infer<typeof checkedVerification>,
) {
  const { r } = await slot(ctx, a.reference);
  requireReference(workspaceId, r);
  if (
    a.reference.candidateVersionId !== versionId ||
    a.reference.contentHash !== contentHash
  )
    fail("VERIFICATION_RECEIPT_INVALID");
  const view = await verificationProjection(ctx, a.reference);
  if (
    view.applicability !== "current" ||
    !view.result ||
    view.result.resultFingerprint !== a.resultFingerprint
  )
    fail("VERIFICATION_RESULT_UNAVAILABLE");
}
export const get = workspaceQuery({
  args: request,
  returns: verificationView,
  handler: async (ctx, a) => {
    const { r } = await slot(ctx, a.reference);
    requireReference(ctx.workspace._id, r);
    return verificationProjection(ctx, a.reference);
  },
});
export const checkAccess = workspaceInternalQuery({
  args: request,
  returns: v.null(),
  handler: async (ctx, a) => {
    const { r, s } = await slot(ctx, a.reference);
    requireReference(ctx.workspace._id, r);
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    if (s.actorId !== ctx.user._id) fail("VERIFICATION_AUTHORITY_UNAVAILABLE");
    await current(ctx, a.reference, false);
    return null;
  },
});
export const check = action({
  args: { workspaceId: v.id("workspaces"), ...request },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    await ctx.runQuery(internal.ai.jev.verify.checkAccess, a);
    await ctx.runAction(
      internal.ai.jev.verify.checkAction,
      requestArgs(a.reference),
    );
    return null;
  },
});
const requestArgs = (reference: Ref) => ({ reference });
export const checkAction = internalAction({
  args: request,
  returns: v.null(),
  handler: async (ctx, a) => {
    if (!(await ctx.runQuery(internal.ai.jev.verify.status, a))) return null;
    const result = await ctx.runAction(
      internal.ai.jev.client.executeVerification,
      a,
    );
    if (result.attemptId)
      await ctx.runMutation(internal.ai.jev.verify.finish, {
        ...a,
        ...result,
        attemptId: result.attemptId,
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
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    try {
      await configuration(ctx, ctx.workspace._id, a.accountId);
      return { status: "ready" as const };
    } catch (error) {
      verificationLoss(error);
      return { status: "configuration_required" as const };
    }
  },
});
async function erase(ctx: MutationCtx, r: Doc<"contentRequests">) {
  if (!r.verification || r.verification.sourceUnavailable) return;
  await ctx.db.patch(r._id, {
    verification: {
      ...r.verification,
      sourceUnavailable: true,
      state: "stopped",
      result: null,
      stickyRisk: null,
    },
  });
  const idea = r.resultIdeaId ? await ctx.db.get(r.resultIdeaId) : null;
  if (
    idea?.handoff?.candidateCommand?.verification?.reference
      .contentRequestId === r._id
  )
    await ctx.db.patch(idea._id, {
      handoff: {
        ...idea.handoff,
        candidateCommand: {
          ...idea.handoff.candidateCommand,
          verification: undefined,
        },
      },
    });
}
async function cleanup(
  ctx: MutationCtx,
  r: Doc<"contentRequests">,
  force = false,
) {
  if (!r.verification || r.verification.sourceUnavailable) return;
  if (force) {
    await erase(ctx, r);
    return;
  }
  try {
    const s = r.verification;
    await packet(ctx, r, s, false);
    if (s.sourceUntil !== null && s.sourceUntil <= Date.now())
      fail("VERIFICATION_SOURCE_UNAVAILABLE");
  } catch (error) {
    verificationLoss(error);
    await erase(ctx, r);
  }
}
export const purgeCandidate = internalMutation({
  args: { versionId: v.id("ideaVersions"), cursor },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("contentRequests")
      .withIndex("by_verification_candidate", (q) =>
        q.eq("verification.candidateVersionId", a.versionId),
      )
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const r of page.page) await cleanup(ctx, r);
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.ai.jev.verify.purgeCandidate, {
        ...a,
        cursor: page.continueCursor,
      });
    return null;
  },
});
export const purgeProducer = internalMutation({
  args: { runId: v.id("agentRuns") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const r = await ctx.db
      .query("contentRequests")
      .withIndex("by_runId", (q) => q.eq("runId", a.runId))
      .unique();
    if (r) await cleanup(ctx, r);
    return null;
  },
});
export const purge = internalMutation({
  args: {
    actorId: v.optional(v.id("users")),
    workspaceId: v.optional(v.id("workspaces")),
    accountId: v.optional(v.id("socialAccounts")),
    cursor,
    force: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const query = ctx.db.query("contentRequests");
    const rows = a.actorId
      ? query.withIndex("by_verification_actor", (q) =>
          q
            .eq("verification.actorId", a.actorId!)
            .eq("verification.sourceUnavailable", false),
        )
      : a.workspaceId && a.accountId
        ? query.withIndex("by_verification_scope", (q) =>
            q
              .eq("workspaceId", a.workspaceId!)
              .eq("accountId", a.accountId!)
              .eq("verification.sourceUnavailable", false),
          )
        : query.withIndex("by_verification_source", (q) =>
            q.eq("verification.sourceUnavailable", false),
          );
    const page = await rows.paginate({
      cursor: a.cursor,
      numItems: a.force ? 25 : 1,
    });
    for (const r of page.page) await cleanup(ctx, r, a.force);
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.ai.jev.verify.purge, {
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
      .withIndex("by_key", (q) =>
        q.eq("key", `verification:account:${a.accountId}`),
      )
      .unique();
    if (
      c &&
      (!("purpose" in c) ||
        c.purpose !== "output-verification" ||
        c.workspaceId !== ctx.workspace._id)
    )
      fail("VERIFICATION_CONFIGURATION_REQUIRED");
    if (c)
      await ctx.db.patch(c._id, {
        enabled: false,
        verification: false,
        withdrawn: true,
      });
    else
      await ctx.db.insert("jevControls", {
        purpose: "output-verification",
        key: `verification:account:${a.accountId}`,
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        enabled: false,
        analyzer: false,
        routing: false,
        verification: false,
        networkFit: false,
        withdrawn: true,
        policyId: null,
        composerTimeoutMs: COMPOSER_TIMEOUT_MS,
        backgroundTimeoutMs: BACKGROUND_TIMEOUT_MS,
        failures: 0,
        openUntil: 0,
        probeAttemptId: null,
      });
    await ctx.scheduler.runAfter(0, internal.ai.jev.verify.purge, {
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
      .withIndex("by_key", (q) => q.eq("key", "verification:global"))
      .unique();
    if (c && (!("purpose" in c) || c.purpose !== "output-verification"))
      fail("VERIFICATION_CONFIGURATION_REQUIRED");
    if (c)
      await ctx.db.patch(c._id, {
        enabled: false,
        verification: false,
        withdrawn: true,
      });
    else
      await ctx.db.insert("jevControls", {
        purpose: "output-verification",
        key: "verification:global",
        enabled: false,
        analyzer: false,
        routing: false,
        verification: false,
        networkFit: false,
        withdrawn: true,
        policyId: null,
        composerTimeoutMs: COMPOSER_TIMEOUT_MS,
        backgroundTimeoutMs: BACKGROUND_TIMEOUT_MS,
        failures: 0,
        openUntil: 0,
        probeAttemptId: null,
      });
    await ctx.scheduler.runAfter(0, internal.ai.jev.verify.purge, {
      cursor: null,
      force: true,
    });
    return null;
  },
});
