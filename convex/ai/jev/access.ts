import { ConvexError, v, type Infer } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  workspaceMutation,
  workspaceQuery,
  requireWorkspace,
  requireRole,
  requireReference,
} from "../../lib/authorization";
import { sha256 } from "../../lib/crypto";
import { draftResearchProof } from "../../research/contentProof";
import { selection } from "../../intelligence/profiles";
import { changeLiability } from "../accounting";
import { requestFields, outcome, contextResult } from "./types";
import { resolveQuestions } from "./questions";
import { validQuestions } from "./normalize";
import {
  COMPOSER_TIMEOUT_MS,
  BACKGROUND_TIMEOUT_MS,
  CIRCUIT_FAILURES,
  CIRCUIT_COOLDOWN_MS,
  NORMALIZATION_VERSION,
} from "./thresholds";
type Ctx = QueryCtx | MutationCtx;
const request = v.object(requestFields);
export type Request = Infer<typeof request>;
function fail(code: string): never {
  throw new ConvexError(code);
}
const bounded = (n: number, max: number) =>
  Number.isSafeInteger(n) && n > 0 && n <= max;
const fingerprint = (p: Doc<"jevPolicies">) => sha256(JSON.stringify(p));
export function estimate(input: number, rate: number) {
  const result = Number((BigInt(input) * BigInt(rate) + 999999n) / 1000000n);
  if (!Number.isSafeInteger(result)) fail("JEV_RECEIPT_INVALID");
  return result;
}
async function admin(ctx: Ctx, ws: Id<"workspaces">, id: Id<"users">) {
  const user = await ctx.db.get(id);
  if (!user) fail("JEV_AUTHORITY_UNAVAILABLE");
  requireRole((await requireWorkspace(ctx, ws, user!)).membership, [
    "Owner",
    "Admin",
  ]);
}
async function controls(
  ctx: Ctx,
  ws: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
) {
  const global = await ctx.db
    .query("jevControls")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  const local = await ctx.db
    .query("jevControls")
    .withIndex("by_key", (q) => q.eq("key", `account:${accountId}`))
    .unique();
  if (
    !global ||
    global.workspaceId !== undefined ||
    global.accountId !== undefined ||
    !global.enabled ||
    !global.analyzer ||
    !local ||
    local.workspaceId !== ws ||
    local.accountId !== accountId ||
    !local.enabled ||
    !local.analyzer
  )
    fail("JEV_DISABLED");
  if (
    !bounded(local!.composerTimeoutMs, COMPOSER_TIMEOUT_MS) ||
    !bounded(local!.backgroundTimeoutMs, BACKGROUND_TIMEOUT_MS) ||
    !Number.isSafeInteger(local!.failures) ||
    local!.failures < 0 ||
    !Number.isSafeInteger(local!.openUntil) ||
    local!.openUntil < 0
  )
    fail("JEV_CONFIGURATION_REQUIRED");
  if (local!.openUntil > Date.now() || local!.probeAttemptId)
    fail("JEV_CIRCUIT_OPEN");
  return local!;
}
async function policy(ctx: Ctx, c: Doc<"jevControls">) {
  const p = c.policyId ? await ctx.db.get(c.policyId) : null;
  if (
    !p ||
    p.workspaceId !== c.workspaceId ||
    p.accountId !== c.accountId ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(p.version) ||
    !Number.isSafeInteger(p.expiresAt) ||
    p.expiresAt <= Date.now() ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !p.pricingEvidence.trim() ||
    p.pricingEvidence.length > 2000 ||
    Object.values(p.euEvidence).some((s) => !s.trim() || s.length > 2000) ||
    !bounded(p.inputMicrosPerMillion, 1e9) ||
    !bounded(p.maxInputTokens, 32000) ||
    !bounded(p.maxOutputTokens, 8000)
  )
    fail("JEV_PROCESSING_CONFIGURATION_REQUIRED");
  await admin(ctx, p!.workspaceId, p!.approvedBy);
  if (
    !process.env.TYPESAFE_API_KEY?.trim() ||
    (await sha256(process.env.TYPESAFE_API_KEY)) !== p!.credentialFingerprint
  )
    fail("JEV_CREDENTIAL_CONFIGURATION_REQUIRED");
  return p!;
}
async function grants(ctx: Ctx, p: Doc<"jevPolicies">) {
  const ids: Id<"aiBudgets">[] = [];
  for (const [i, scope] of (
    ["provider", "workspace", "account"] as const
  ).entries()) {
    const key =
      i === 0
        ? "jev:provider"
        : i === 1
          ? `jev:workspace:${p.workspaceId}`
          : `jev:account:${p.accountId}`;
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (
      !b ||
      b.scope !== scope ||
      b.policyVersion !== p.version ||
      b.currency !== p.currency ||
      !b.purposes.includes("analyzer") ||
      b.expiresAt <= Date.now() ||
      !bounded(b.limitMicros, 1e12) ||
      !Number.isSafeInteger(b.heldMicros) ||
      b.heldMicros < 0 ||
      !Number.isSafeInteger(b.spentMicros) ||
      b.spentMicros < 0 ||
      (i === 0 && (b.workspaceId !== undefined || b.accountId !== undefined)) ||
      (i === 1 &&
        (b.workspaceId !== p.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== p.workspaceId || b.accountId !== p.accountId)) ||
      (i > 0 && !b.approvedBy)
    )
      fail("JEV_BUDGET_CONFIGURATION_REQUIRED");
    if (b!.approvedBy) await admin(ctx, p.workspaceId, b!.approvedBy);
    ids.push(b!._id);
  }
  return ids;
}
export async function current(ctx: Ctx, a: Request) {
  if (
    !/^[A-Za-z0-9_-]{8,100}$/.test(a.operationKey) ||
    !Number.isSafeInteger(a.deadline) ||
    a.deadline <= Date.now() ||
    a.deadline > Date.now() + BACKGROUND_TIMEOUT_MS ||
    !Number.isSafeInteger(a.selectionRevision)
  )
    fail("JEV_REQUEST_INVALID");
  const user = await ctx.db.get(a.actorId);
  if (!user) fail("JEV_AUTHORITY_UNAVAILABLE");
  requireRole((await requireWorkspace(ctx, a.workspaceId, user!)).membership, [
    "Owner",
    "Admin",
    "Editor",
  ]);
  const account = await ctx.db.get(a.accountId),
    draft = await ctx.db.get(a.draftId),
    version = await ctx.db.get(a.draftVersionId);
  for (const row of [account, draft, version])
    requireReference(a.workspaceId, row);
  if (
    account!.provider !== "X" ||
    draft!.currentVersionId !== a.draftVersionId ||
    version!.draftId !== a.draftId ||
    version!.content.accountId !== a.accountId ||
    version!.sourceUnavailable
  )
    fail("JEV_SOURCE_CHANGED");
  const sourceUntil = await draftResearchProof(ctx, version!);
  const selected = await selection(ctx, a.workspaceId, a.accountId);
  if (
    !selected ||
    selected.algorithmId !== a.algorithmId ||
    selected.audienceId !== a.audienceId ||
    selected.revision !== a.selectionRevision ||
    !selected.selectedBy
  )
    fail("JEV_PROFILE_CHANGED");
  await admin(ctx, a.workspaceId, selected!.selectedBy!);
  const alg = await ctx.db.get(a.algorithmId),
    aud = await ctx.db.get(a.audienceId);
  for (const p of [alg, aud]) {
    if (
      !p ||
      p.workspaceId !== a.workspaceId ||
      p.accountId !== a.accountId ||
      p.network !== "x" ||
      p.surface !== "for_you" ||
      p.status !== "reviewed" ||
      !p.review
    )
      fail("JEV_PROFILE_CHANGED");
    await admin(ctx, a.workspaceId, p!.createdBy);
    await admin(ctx, a.workspaceId, p!.review!.actorId);
  }
  if (alg!.payload.reviewDueAt <= Date.now()) fail("JEV_PROFILE_CHANGED");
  const c = await controls(ctx, a.workspaceId, a.accountId),
    p = await policy(ctx, c);
  const definition = resolveQuestions(alg!);
  validQuestions(definition.questions);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(definition.version))
    fail("JEV_QUESTION_CONFIGURATION_REQUIRED");
  const media = [];
  if (
    !version!.content.text.length ||
    version!.content.text.length > account!.capability.maxThread ||
    version!.content.media.length > account!.capability.maxMedia
  )
    fail("JEV_INPUT_LIMIT");
  for (const ref of version!.content.media) {
    const asset = await ctx.db.get(ref.assetId);
    requireReference(a.workspaceId, asset);
    const pin = version!.mediaChecksums?.find((m) => m.assetId === ref.assetId);
    if (
      !asset ||
      asset.state !== "ready" ||
      !pin ||
      pin.checksum !== asset.checksum ||
      pin.objectKey !== asset.objectKey
    )
      fail("JEV_MEDIA_CHANGED");
    media.push({
      type: asset.type,
      mime: asset.mime ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      duration: asset.duration ?? null,
      alt: ref.alt,
    });
  }
  // Only decision-relevant ordered content and declared audience; no credentials, reports or raw media bytes.
  const state = {
    thread: version!.content.text.map((text, position) => ({ position, text })),
    media,
    audience: aud!.payload.description,
  };
  const body = JSON.stringify({
    state,
    questions: definition.questions,
    model: p.model,
  });
  // ponytail: UTF-8 bytes conservatively bound tokens; replace only with a verified Jev tokenizer if restrictive.
  if (new TextEncoder().encode(body).length > p.maxInputTokens)
    fail("JEV_INPUT_LIMIT");
  const requestFingerprint = await sha256(
    JSON.stringify({
      a,
      state,
      refs: alg!.payload.refs,
      questionVersion: definition.version,
      questions: definition.questions,
      policyFingerprint: await fingerprint(p),
      accountIdentity: account!.providerIdentity,
      sourceUntil,
    }),
  );
  if (sourceUntil !== null && sourceUntil <= a.deadline)
    fail("JEV_SOURCE_EXPIRING");
  return {
    state,
    questions: definition.questions,
    questionVersion: definition.version,
    p,
    c,
    budgetIds: await grants(ctx, p),
    requestFingerprint,
  };
}
export const context = internalQuery({ args: requestFields, handler: current });
export const fund = internalMutation({
  args: { ...requestFields, expectedFingerprint: v.string() },
  returns: v.id("aiAttempts"),
  handler: async (ctx, a) => {
    const { expectedFingerprint, ...request } = a;
    const x = await current(ctx, request);
    if (x.requestFingerprint !== expectedFingerprint)
      fail("JEV_SOURCE_CHANGED");
    const old = await ctx.db
      .query("aiAttempts")
      .withIndex("by_jev_operation", (q) =>
        q
          .eq("owner", "jev-analyzer")
          .eq("workspaceId", a.workspaceId)
          .eq("accountId", a.accountId)
          .eq("actorId", a.actorId)
          .eq("operationKey", a.operationKey),
      )
      .first();
    if (old) fail("JEV_ATTEMPT_ALREADY_ADMITTED");
    for (const state of ["sent", "unknown"] as const) {
      const unresolved = await ctx.db
        .query("aiAttempts")
        .withIndex("by_jev_pending", (q) =>
          q
            .eq("owner", "jev-analyzer")
            .eq("workspaceId", a.workspaceId)
            .eq("accountId", a.accountId)
            .eq("draftVersionId", a.draftVersionId)
            .eq("state", state),
        )
        .first();
      if (unresolved) fail("JEV_PREVIOUS_USAGE_UNRESOLVED");
    }
    const reservedMicros = estimate(
      x.p.maxInputTokens,
      x.p.inputMicrosPerMillion,
    );
    await changeLiability(ctx, x.budgetIds, reservedMicros, 0, true);
    const attemptId = await ctx.db.insert("aiAttempts", {
      ...request,
      owner: "jev-analyzer",
      provider: "typesafe",
      purpose: "analyzer",
      operation: "systemone",
      policyId: x.p._id,
      controlId: x.c._id,
      policyFingerprint: await fingerprint(x.p),
      policyVersion: x.p.version,
      requestFingerprint: x.requestFingerprint,
      questionVersion: x.questionVersion,
      normalizationVersion: NORMALIZATION_VERSION,
      model: x.p.model,
      resolvedModel: null,
      currency: x.p.currency,
      inputMicrosPerMillion: x.p.inputMicrosPerMillion,
      outputMicrosPerMillion: 0,
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
    if (x.c.failures >= CIRCUIT_FAILURES)
      await ctx.db.patch(x.c._id, { probeAttemptId: attemptId });
    return attemptId;
  },
});
async function receipt(ctx: Ctx, id: Id<"aiAttempts">) {
  const t = await ctx.db.get(id);
  if (
    !t ||
    t.owner !== "jev-analyzer" ||
    t.runId !== undefined ||
    t.researchOrderId !== undefined ||
    t.logicalIntent !== undefined ||
    t.budgetIds.length !== 3 ||
    new Set(t.budgetIds).size !== 3
  )
    fail("JEV_ATTEMPT_OWNER_INVALID");
  const p = await ctx.db.get(t!.policyId);
  if (
    !p ||
    (await fingerprint(p)) !== t!.policyFingerprint ||
    p.workspaceId !== t!.workspaceId ||
    p.accountId !== t!.accountId ||
    p.version !== t!.policyVersion ||
    p.model !== t!.model ||
    p.currency !== t!.currency ||
    p.inputMicrosPerMillion !== t!.inputMicrosPerMillion ||
    p.maxInputTokens !== t!.maxInputTokens ||
    p.maxOutputTokens !== t!.maxOutputTokens ||
    t!.reservedMicros !== estimate(p.maxInputTokens, p.inputMicrosPerMillion) ||
    t!.heldMicros !== (t!.state === "settled" ? 0 : t!.reservedMicros)
  )
    fail("JEV_ATTEMPT_OWNER_INVALID");
  for (const [i, id] of t!.budgetIds.entries()) {
    const b = await ctx.db.get(id);
    if (
      !b ||
      b.key !==
        (i === 0
          ? "jev:provider"
          : i === 1
            ? `jev:workspace:${t!.workspaceId}`
            : `jev:account:${t!.accountId}`) ||
      b.currency !== t!.currency ||
      b.scope !== (["provider", "workspace", "account"] as const)[i] ||
      (i === 0 && (b.workspaceId !== undefined || b.accountId !== undefined)) ||
      (i === 1 &&
        (b.workspaceId !== t!.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== t!.workspaceId || b.accountId !== t!.accountId))
    )
      fail("JEV_ATTEMPT_OWNER_INVALID");
  }
  return t!;
}
export const settle = internalMutation({
  args: {
    attemptId: v.id("aiAttempts"),
    inputTokens: v.union(v.number(), v.null()),
    outputTokens: v.union(v.number(), v.null()),
    resolvedModel: v.union(v.string(), v.null()),
    outcome,
    latencyMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const t = await receipt(ctx, a.attemptId);
    const known =
      a.inputTokens !== null &&
      a.outputTokens !== null &&
      Number.isSafeInteger(a.inputTokens) &&
      Number.isSafeInteger(a.outputTokens) &&
      a.inputTokens >= 0 &&
      a.outputTokens >= 0 &&
      a.inputTokens <= 1e9 &&
      a.outputTokens <= 1e9;
    if (
      !Number.isSafeInteger(a.latencyMs) ||
      a.latencyMs < 0 ||
      a.latencyMs > 600000 ||
      (a.resolvedModel !== null &&
        !/^[A-Za-z0-9_.-]{1,100}$/.test(a.resolvedModel))
    )
      fail("JEV_RECEIPT_INVALID");
    if (t.state === "settled") {
      if (
        known &&
        (t.inputTokens !== a.inputTokens ||
          t.outputTokens !== a.outputTokens ||
          t.resolvedModel !== a.resolvedModel)
      )
        fail("JEV_RECEIPT_CONFLICT");
      return null;
    }
    const cost = known
      ? estimate(a.inputTokens!, t.inputMicrosPerMillion)
      : null;
    if (cost !== null)
      await changeLiability(ctx, t.budgetIds, -t.heldMicros, cost);
    await ctx.db.patch(t._id, {
      state: known ? "settled" : "unknown",
      heldMicros: known ? 0 : t.heldMicros,
      estimatedMicros: cost,
      inputTokens: known ? a.inputTokens : null,
      outputTokens: known ? a.outputTokens : null,
      resolvedModel: a.resolvedModel,
      outcome: a.outcome,
      fallback: a.outcome === "success" ? "none" : "unavailable",
      latencyMs: a.latencyMs,
      settledAt: known ? Date.now() : null,
    });
    // Each physical attempt affects the circuit once; late financial receipts do not replay failure counts.
    if (t.outcome === null) {
      const c = await ctx.db.get(t.controlId);
      if (c && c.workspaceId === t.workspaceId && c.accountId === t.accountId) {
        const failed = [
          "timeout",
          "rate_limit",
          "provider_error",
          "invalid_response",
        ].includes(a.outcome);
        const failures = failed
          ? Math.min(CIRCUIT_FAILURES, c.failures + 1)
          : 0;
        await ctx.db.patch(c._id, {
          failures,
          openUntil:
            failures >= CIRCUIT_FAILURES ? Date.now() + CIRCUIT_COOLDOWN_MS : 0,
          probeAttemptId: c.probeAttemptId === t._id ? null : c.probeAttemptId,
        });
      }
    }
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
      .withIndex("by_key", (q) => q.eq("key", `account:${a.accountId}`))
      .unique();
    if (c?.workspaceId === ctx.workspace._id)
      await ctx.db.patch(c._id, { enabled: false, analyzer: false });
    return null;
  },
});
export const disableGlobal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const c = await ctx.db
      .query("jevControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (c) await ctx.db.patch(c._id, { enabled: false, analyzer: false });
    return null;
  },
});
export const availability = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.object({
    status: v.union(
      v.literal("disabled"),
      v.literal("configuration_required"),
      v.literal("unavailable"),
    ),
    guidance: v.string(),
  }),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    try {
      const c = await controls(ctx, ctx.workspace._id, a.accountId);
      await policy(ctx, c);
    } catch (e) {
      return {
        status: String(e).includes("JEV_DISABLED")
          ? ("disabled" as const)
          : String(e).includes("JEV_CIRCUIT_OPEN")
            ? ("unavailable" as const)
            : ("configuration_required" as const),
        guidance:
          "Jev-Bewertung benötigt eine vollständige EU-Verarbeitungsfreigabe, versionierte Preise, getrennte Analysebudgets und Serverkonfiguration. Manuelles Veröffentlichen bleibt unabhängig möglich.",
      };
    }
    return {
      status: "configuration_required" as const,
      guidance:
        "Jev-Bewertung benötigt freigegebene Analysefragen und aktuelle geprüfte Profile. Routing, Verifikation und Netzwerk-Fit bleiben deaktiviert.",
    };
  },
});
