import { ConvexError, v, type Infer } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import {
  workspaceQuery,
  workspaceMutation,
  requireReference,
  requireRole,
  requireWorkspace,
  requireUser,
} from "../lib/authorization";
import {
  scope,
  source,
  pin,
  policyFields,
  policyDoc,
  attemptDoc,
  identity,
} from "./similarityFields";
import type { Doc, Id } from "../_generated/dataModel";
import { sha256 } from "../lib/crypto";
import { changeLiability } from "../ai/accounting";
import { retainedHorizon } from "../performance/history";
import { draftResearchProof } from "../research/contentProof";
import { materialWalk, type MaterialWalk } from "../research/pipelineAccess";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
type Ctx = QueryCtx | MutationCtx;
type EmbeddingAttempt = Extract<
  Doc<"aiAttempts">,
  { owner: "own-content-embedding" }
>;
function fail(code: string): never {
  throw new ConvexError(code);
}
function resourceLimit(error: unknown) {
  return (
    error instanceof ConvexError &&
    (error.data === "STYLE_ANCESTRY_LIMIT" ||
      error.data === "RESEARCH_PROOF_ANCESTRY_LIMIT")
  );
}
function sourceLoss(error: unknown) {
  if (resourceLimit(error)) throw error;
  rethrowUnexpectedSourceError(error);
}
const positive = (n: number, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(n) && n > 0 && n <= max;
const keys = (a: Infer<typeof scopeValidator>) => [
  "embedding:requesty",
  `embedding:workspace:${a.workspaceId}`,
  `embedding:account:${a.accountId}`,
];
const scopeValidator = v.object(scope);
const hash = (p: Doc<"embeddingPolicies">) => sha256(JSON.stringify(p));
const sameIdentity = (a: Infer<typeof identity>, b: Infer<typeof identity>) =>
  a.resolvedModel === b.resolvedModel &&
  a.dimension === b.dimension &&
  a.assembly === b.assembly &&
  a.normalization === b.normalization;
const pinKey = (p: Infer<typeof pin>) =>
  JSON.stringify(
    p.kind === "history"
      ? [p.kind, p.historyPostId, p.jobId, p.generation, p.externalId]
      : [p.kind, p.draftVersionId, p.draftId, p.number],
  );
const sourceKey = (s: Infer<typeof source>) =>
  JSON.stringify(
    s.kind === "history"
      ? [s.kind, s.historyPostId]
      : [s.kind, s.draftVersionId],
  );
const estimate = (tokens: number, rate: number) => {
  if (!Number.isSafeInteger(tokens) || tokens < 0 || !positive(rate, 1e12))
    fail("EMBEDDING_RECEIPT_INVALID");
  const n = Number((BigInt(tokens) * BigInt(rate) + 999999n) / 1000000n);
  if (!Number.isSafeInteger(n)) fail("EMBEDDING_RECEIPT_INVALID");
  return n;
};
async function actor(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  admin = false,
) {
  const u = await ctx.db.get(actorId);
  if (!u) fail("EMBEDDING_ACTOR_UNAVAILABLE");
  requireRole(
    (await requireWorkspace(ctx, workspaceId, u!)).membership,
    admin ? ["Owner", "Admin"] : ["Owner", "Admin", "Editor"],
  );
}
async function account(ctx: Ctx, a: Infer<typeof scopeValidator>) {
  const row = await ctx.db.get(a.accountId);
  requireReference(a.workspaceId, row);
  if (row!.connection !== "connected" || !row!.providerIdentity)
    fail("EMBEDDING_ACCOUNT_CHANGED");
  return row!;
}
function validPolicy(p: Infer<typeof vPolicy>) {
  if (
    !/^[A-Za-z0-9_-]{1,100}$/.test(p.version) ||
    !/^[A-Za-z0-9_./:-]{1,200}$/.test(p.model) ||
    !/^[A-Za-z0-9_./:-]{1,200}$/.test(p.identity.resolvedModel) ||
    !positive(p.identity.dimension, 4096) ||
    !positive(p.expiresAt) ||
    p.expiresAt <= Date.now() ||
    !/^[A-Z]{3}$/.test(p.currency) ||
    !positive(p.inputMicrosPerMillion, 1e12) ||
    !positive(p.allocatedProviderLimitMicros, 1e15) ||
    !positive(p.maxInputTokens, 12000) ||
    !positive(p.retentionMs, 30 * 86400000) ||
    !positive(p.maxDurationMs, 20000) ||
    [
      p.processingEvidence,
      p.upstreamEuEvidence,
      p.storageEvidence,
      p.trainingEvidence,
      p.retentionEvidence,
      p.rightsEvidence,
      p.pricingEvidence,
      p.protocolEvidence,
      p.allocationEvidence,
    ].some((x) => !x.trim() || x.length > 2000)
  )
    fail("EMBEDDING_CONFIGURATION_REQUIRED");
  estimate(p.maxInputTokens, p.inputMicrosPerMillion);
}
const vPolicy = v.object(policyFields);
async function policy(ctx: Ctx, a: Infer<typeof scopeValidator>) {
  await account(ctx, a);
  const p = await ctx.db
    .query("embeddingPolicies")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
    )
    .order("desc")
    .first();
  if (!p || !p.enabled) fail("EMBEDDING_CONFIGURATION_REQUIRED");
  validPolicy(p!);
  await actor(ctx, a.workspaceId, p!.approvedBy, true);
  return p!;
}
async function grants(ctx: Ctx, p: Doc<"embeddingPolicies">) {
  const ids: Id<"aiBudgets">[] = [];
  let until = p.expiresAt;
  for (const [i, key] of keys(p).entries()) {
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (
      !b ||
      b.scope !== (["provider", "workspace", "account"] as const)[i] ||
      b.policyVersion !== p.version ||
      b.currency !== p.currency ||
      !b.purposes.includes("own-content-embedding") ||
      b.expiresAt <= Date.now() ||
      !positive(b.limitMicros) ||
      !Number.isSafeInteger(b.heldMicros) ||
      b.heldMicros < 0 ||
      !Number.isSafeInteger(b.spentMicros) ||
      b.spentMicros < 0 ||
      (i === 0 &&
        (b.workspaceId !== undefined ||
          b.accountId !== undefined ||
          b.limitMicros !== p.allocatedProviderLimitMicros)) ||
      (i === 1 &&
        (b.workspaceId !== p.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== p.workspaceId || b.accountId !== p.accountId)) ||
      (i > 0 && !b.approvedBy)
    )
      fail("EMBEDDING_BUDGET_CONFIGURATION_REQUIRED");
    if (b!.approvedBy) await actor(ctx, p.workspaceId, b!.approvedBy, true);
    ids.push(b!._id);
    until = Math.min(until, b!.expiresAt);
  }
  return { ids, until };
}
async function control(ctx: Ctx, a: Infer<typeof scopeValidator>) {
  return ctx.db
    .query("embeddingControls")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
    )
    .unique();
}
async function authority(
  ctx: Ctx,
  a: Infer<typeof scopeValidator>,
  actorId?: Id<"users">,
) {
  const p = await policy(ctx, a),
    c = await control(ctx, a),
    acc = await account(ctx, a),
    fingerprint = await hash(p);
  if (
    !c ||
    !c.enabled ||
    c.expiresAt <= Date.now() ||
    c.policyId !== p._id ||
    c.policyFingerprint !== fingerprint ||
    c.providerIdentity !== acc.providerIdentity ||
    c.connectionSequence !== (acc.xEvidence?.connectionSequence ?? 0)
  )
    fail("EMBEDDING_CONSENT_REQUIRED");
  await actor(ctx, a.workspaceId, c!.approvedBy, true);
  if (actorId) await actor(ctx, a.workspaceId, actorId);
  const g = await grants(ctx, p);
  return {
    p,
    c: c!,
    acc,
    fingerprint,
    budgetIds: g.ids,
    until: Math.min(c!.expiresAt, g.until),
  };
}
export async function sourceProof(
  ctx: Ctx,
  a: Infer<typeof scopeValidator>,
  s: Infer<typeof source>,
  walk: MaterialWalk = materialWalk(),
  historyMemo?: Map<string, number>,
) {
  let text: string, sourcePin: Infer<typeof pin>, until: number | null;
  if (s.kind === "history") {
    const row = await ctx.db.get(s.historyPostId);
    if (
      !row ||
      row.workspaceId !== a.workspaceId ||
      row.accountId !== a.accountId ||
      row.origin !== "own-history-import"
    )
      fail("EMBEDDING_SOURCE_UNAVAILABLE");
    until = await retainedHorizon(ctx, row!, historyMemo);
    text = row!.text!;
    sourcePin = {
      kind: "history",
      historyPostId: row!._id,
      jobId: row!.jobId,
      generation: row!.generation,
      externalId: row!.externalId,
    };
  } else {
    const row = await ctx.db.get(s.draftVersionId),
      d = row ? await ctx.db.get(row.draftId) : null;
    if (
      !row ||
      !d ||
      row.workspaceId !== a.workspaceId ||
      d.workspaceId !== a.workspaceId ||
      row.content.accountId !== a.accountId ||
      d.currentVersionId !== row._id ||
      row.sourceUnavailable
    )
      fail("EMBEDDING_SOURCE_UNAVAILABLE");
    until = await draftResearchProof(ctx, row!, walk);
    text = row!.content.text.join("\n\n");
    sourcePin = {
      kind: "draft",
      draftVersionId: row!._id,
      draftId: row!.draftId,
      number: row!.number,
    };
  }
  if (
    !text.trim() ||
    new TextEncoder().encode(text).length > 12000 ||
    (until !== null && until <= Date.now())
  )
    fail("EMBEDDING_SOURCE_UNAVAILABLE");
  return {
    text,
    sourcePin,
    materialFingerprint: await sha256(JSON.stringify([sourcePin, text])),
    until,
  };
}
function asSource(p: Infer<typeof pin>): Infer<typeof source> {
  return p.kind === "history"
    ? { kind: "history", historyPostId: p.historyPostId }
    : { kind: "draft", draftVersionId: p.draftVersionId };
}
async function currentAttempt(
  ctx: Ctx,
  t: EmbeddingAttempt,
  walk?: MaterialWalk,
) {
  if (
    t.sourceUnavailable ||
    !t.sourcePin ||
    !t.materialFingerprint ||
    t.sourceUntil === null ||
    t.sourceUntil <= Date.now()
  )
    fail("EMBEDDING_SOURCE_UNAVAILABLE");
  const a = await authority(ctx, t, t.actorId);
  if (
    a.c._id !== t.controlId ||
    a.c.generation !== t.generation ||
    a.p._id !== t.policyId ||
    a.fingerprint !== t.policyFingerprint ||
    a.acc.providerIdentity !== t.providerIdentity ||
    (a.acc.xEvidence?.connectionSequence ?? 0) !== t.connectionSequence ||
    !sameIdentity(a.p.identity, t.identity) ||
    a.budgetIds.some((id, i) => t.budgetIds[i] !== id)
  )
    fail("EMBEDDING_AUTHORITY_CHANGED");
  if (t.sourcePin!.kind === "history" ? !a.c.ownHistory : !a.c.draftVersions)
    fail("EMBEDDING_CONSENT_REQUIRED");
  const s = await sourceProof(ctx, t, asSource(t.sourcePin!), walk);
  if (
    s.materialFingerprint !== t.materialFingerprint ||
    pinKey(s.sourcePin) !== pinKey(t.sourcePin!)
  )
    fail("EMBEDDING_SOURCE_UNAVAILABLE");
  return {
    ...a,
    ...s,
    until: Math.min(t.sourceUntil!, a.until, s.until ?? Infinity),
  };
}
type ReceiptMemo = {
  policies: Map<Id<"embeddingPolicies">, Doc<"embeddingPolicies"> | null>;
  budgets: Map<Id<"aiBudgets">, Doc<"aiBudgets"> | null>;
};
export async function embeddingAttempt(
  ctx: Ctx,
  id: Id<"aiAttempts">,
  memo?: ReceiptMemo,
) {
  const t = await ctx.db.get(id);
  if (!t || t.owner !== "own-content-embedding")
    fail("EMBEDDING_ATTEMPT_OWNER_INVALID");
  const r = t as EmbeddingAttempt,
    p = memo?.policies.has(r.policyId)
      ? memo.policies.get(r.policyId)!
      : await ctx.db.get(r.policyId);
  memo?.policies.set(r.policyId, p);
  if (
    !p ||
    p.workspaceId !== r.workspaceId ||
    p.accountId !== r.accountId ||
    p.version !== r.policyVersion ||
    p.currency !== r.currency ||
    p.inputMicrosPerMillion !== r.inputMicrosPerMillion ||
    p.maxInputTokens !== r.maxInputTokens ||
    p.model !== r.model ||
    !sameIdentity(p.identity, r.identity) ||
    (await hash(p)) !== r.policyFingerprint ||
    r.budgetIds.length !== 3 ||
    new Set(r.budgetIds).size !== 3 ||
    r.reservedMicros !== estimate(r.maxInputTokens, r.inputMicrosPerMillion)
  )
    fail("EMBEDDING_ATTEMPT_OWNER_INVALID");
  for (const [i, id] of r.budgetIds.entries()) {
    const b = memo?.budgets.has(id)
      ? memo.budgets.get(id)!
      : await ctx.db.get(id);
    memo?.budgets.set(id, b);
    if (
      !b ||
      b.key !== keys(r)[i] ||
      b.currency !== r.currency ||
      b.scope !== (["provider", "workspace", "account"] as const)[i] ||
      (i === 0 && (b.workspaceId !== undefined || b.accountId !== undefined)) ||
      (i === 1 &&
        (b.workspaceId !== r.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== r.workspaceId || b.accountId !== r.accountId))
    )
      fail("EMBEDDING_ATTEMPT_OWNER_INVALID");
  }
  return r;
}
export const configure = internalMutation({
  args: policyFields,
  returns: v.id("embeddingPolicies"),
  handler: async (ctx, a) => {
    validPolicy(a);
    await actor(ctx, a.workspaceId, a.approvedBy, true);
    await account(ctx, a);
    const old = await ctx.db
      .query("embeddingPolicies")
      .withIndex("by_workspaceId_and_accountId_and_version", (q) =>
        q
          .eq("workspaceId", a.workspaceId)
          .eq("accountId", a.accountId)
          .eq("version", a.version),
      )
      .unique();
    if (old) {
      if (
        Object.keys(a).some(
          (key) =>
            JSON.stringify(old[key as keyof typeof old]) !==
            JSON.stringify(a[key as keyof typeof a]),
        )
      )
        fail("EMBEDDING_POLICY_VERSION_CONFLICT");
      return old._id;
    }
    return ctx.db.insert("embeddingPolicies", a);
  },
});
export const consent = workspaceMutation({
  args: {
    accountId: scope.accountId,
    policyId: v.id("embeddingPolicies"),
    expectedGeneration: v.number(),
    enabled: v.boolean(),
    ownHistory: v.boolean(),
    draftVersions: v.boolean(),
    consentEvidence: v.string(),
    expiresAt: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      old = await control(ctx, args);
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    if (
      !Number.isSafeInteger(a.expectedGeneration) ||
      (old?.generation ?? 0) !== a.expectedGeneration
    )
      fail("EMBEDDING_CONSENT_CONFLICT");
    if (!a.enabled) {
      if (!old || old.policyId !== a.policyId)
        fail("EMBEDDING_CONSENT_CONFLICT");
      const generation = old.generation + 1;
      await ctx.db.patch(old._id, {
        enabled: false,
        generation,
        approvedBy: ctx.user._id,
        ownHistory: false,
        draftVersions: false,
        consentEvidence: "",
        expiresAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.content.similarity.purge, {
        controlId: old._id,
      });
      return generation;
    }
    const acc = await account(ctx, args);
    const p = await ctx.db.get(a.policyId);
    if (
      !p ||
      p.workspaceId !== args.workspaceId ||
      p.accountId !== args.accountId
    )
      fail("EMBEDDING_CONFIGURATION_REQUIRED");
    if (a.enabled) {
      const current = await policy(ctx, args);
      if (
        current._id !== p!._id ||
        !positive(a.expiresAt) ||
        a.expiresAt <= Date.now() ||
        a.expiresAt > p!.expiresAt ||
        !a.consentEvidence.trim() ||
        a.consentEvidence.length > 2000 ||
        (!a.ownHistory && !a.draftVersions)
      )
        fail("EMBEDDING_CONSENT_REQUIRED");
    }
    const generation = (old?.generation ?? 0) + 1,
      data = {
        ...args,
        generation,
        enabled: a.enabled,
        approvedBy: ctx.user._id,
        providerIdentity: acc.providerIdentity,
        connectionSequence: acc.xEvidence?.connectionSequence ?? 0,
        policyId: p!._id,
        policyFingerprint: await hash(p!),
        purpose: "own-content-semantic-retrieval-v1" as const,
        ownHistory: a.ownHistory,
        draftVersions: a.draftVersions,
        consentEvidence: a.enabled ? a.consentEvidence : "",
        expiresAt: a.enabled ? a.expiresAt : Date.now(),
        updatedAt: Date.now(),
      };
    if (old) {
      await ctx.db.replace(old._id, data);
      await ctx.scheduler.runAfter(0, internal.content.similarity.purge, {
        controlId: old._id,
      });
    } else await ctx.db.insert("embeddingControls", data);
    return generation;
  },
});
export const availability = workspaceQuery({
  args: { accountId: scope.accountId },
  returns: v.object({
    enabled: v.boolean(),
    sendConfigured: v.boolean(),
    storedEnabled: v.boolean(),
    controlPolicyId: v.union(v.id("embeddingPolicies"), v.null()),
    reason: v.union(v.string(), v.null()),
    generation: v.number(),
    policyId: v.union(v.id("embeddingPolicies"), v.null()),
    policyFingerprint: v.union(v.string(), v.null()),
    expiresAt: v.union(v.number(), v.null()),
    identity: v.union(identity, v.null()),
  }),
  handler: async (ctx, a) => {
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    try {
      const x = await authority(ctx, args);
      return {
        enabled: true,
        sendConfigured: !!process.env.REQUESTY_API_KEY,
        storedEnabled: x.c.enabled,
        controlPolicyId: x.c.policyId,
        reason: null,
        generation: x.c.generation,
        policyId: x.p._id,
        policyFingerprint: x.fingerprint,
        expiresAt: x.until,
        identity: x.p.identity,
      };
    } catch (e) {
      sourceLoss(e);
      const c = await control(ctx, args);
      let p: Doc<"embeddingPolicies"> | null = null;
      try {
        p = await policy(ctx, args);
      } catch (error) {
        rethrowUnexpectedSourceError(error);
      }
      return {
        enabled: false,
        sendConfigured: !!process.env.REQUESTY_API_KEY,
        storedEnabled: c?.enabled ?? false,
        controlPolicyId: c?.policyId ?? null,
        reason: String((e as ConvexError<string>).data),
        generation: c?.generation ?? 0,
        policyId: p?._id ?? null,
        policyFingerprint: p ? await hash(p) : null,
        expiresAt: p?.expiresAt ?? null,
        identity: p?.identity ?? null,
      };
    }
  },
});
export const prepare = workspaceMutation({
  args: { accountId: scope.accountId, source, commandKey: v.string() },
  returns: v.id("aiAttempts"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(a.commandKey))
      fail("EMBEDDING_COMMAND_INVALID");
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId },
      intentFingerprint = await sha256(JSON.stringify([args, a.source]));
    const old = await ctx.db
      .query("aiAttempts")
      .withIndex("by_embedding_command", (q) =>
        q
          .eq("owner", "own-content-embedding")
          .eq("workspaceId", args.workspaceId)
          .eq("accountId", args.accountId)
          .eq("actorId", ctx.user._id)
          .eq("commandKey", a.commandKey),
      )
      .unique();
    if (old) {
      if (
        old.owner !== "own-content-embedding" ||
        old.intentFingerprint !== intentFingerprint
      )
        fail("EMBEDDING_COMMAND_CONFLICT");
      await currentAttempt(ctx, old);
      return old._id;
    }
    if (!process.env.REQUESTY_API_KEY)
      fail("EMBEDDING_SEND_CONFIGURATION_REQUIRED");
    const x = await authority(ctx, args, ctx.user._id);
    if (a.source.kind === "history" ? !x.c.ownHistory : !x.c.draftVersions)
      fail("EMBEDDING_CONSENT_REQUIRED");
    const s = await sourceProof(ctx, args, a.source);
    if (new TextEncoder().encode(s.text).length > x.p.maxInputTokens)
      fail("EMBEDDING_INPUT_LIMIT");
    const reservedMicros = estimate(
      x.p.maxInputTokens,
      x.p.inputMicrosPerMillion,
    );
    await changeLiability(ctx, x.budgetIds, reservedMicros, 0, true);
    return ctx.db.insert("aiAttempts", {
      owner: "own-content-embedding",
      ...args,
      actorId: ctx.user._id,
      providerIdentity: x.acc.providerIdentity,
      connectionSequence: x.acc.xEvidence?.connectionSequence ?? 0,
      commandKey: a.commandKey,
      intentFingerprint,
      sourcePin: s.sourcePin,
      materialFingerprint: s.materialFingerprint,
      sourceUntil: Math.min(
        x.until,
        s.until ?? Infinity,
        Date.now() + x.p.retentionMs,
      ),
      sourceUnavailable: false,
      controlId: x.c._id,
      generation: x.c.generation,
      purpose: "own-content-semantic-retrieval-v1",
      policyId: x.p._id,
      policyFingerprint: x.fingerprint,
      policyVersion: x.p.version,
      model: x.p.model,
      identity: x.p.identity,
      provider: "requesty",
      budgetIds: x.budgetIds,
      currency: x.p.currency,
      inputMicrosPerMillion: x.p.inputMicrosPerMillion,
      maxInputTokens: x.p.maxInputTokens,
      reservedMicros,
      heldMicros: reservedMicros,
      estimatedMicros: null,
      billedMicros: null,
      inputTokens: null,
      receiptFingerprint: null,
      state: "reserved",
      createdAt: Date.now(),
      deadline: Math.min(
        Date.now() + x.p.maxDurationMs,
        x.until,
        s.until ?? Infinity,
      ),
      sentAt: null,
      settledAt: null,
      errorCode: null,
    });
  },
});
export const claim = internalMutation({
  args: { attemptId: v.id("aiAttempts") },
  returns: v.union(
    v.object({ attempt: attemptDoc, policy: policyDoc, text: v.string() }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    const t = await embeddingAttempt(ctx, a.attemptId),
      u = await requireUser(ctx);
    if (u._id !== t.actorId) fail("EMBEDDING_ATTEMPT_OWNER_INVALID");
    if (!process.env.REQUESTY_API_KEY) {
      await actor(ctx, t.workspaceId, u._id);
      if (t.state === "reserved") {
        await changeLiability(ctx, t.budgetIds, -t.heldMicros);
        await ctx.db.patch(t._id, {
          state: "cancelled",
          heldMicros: 0,
          errorCode: "EMBEDDING_SEND_CONFIGURATION_REQUIRED",
        });
      }
      return null;
    }
    const x = await currentAttempt(ctx, t);
    if (t.state !== "reserved") return null;
    if (Date.now() >= t.deadline) {
      await changeLiability(ctx, t.budgetIds, -t.heldMicros);
      await ctx.db.patch(t._id, {
        state: "cancelled",
        heldMicros: 0,
        errorCode: "EMBEDDING_DEADLINE",
      });
      return null;
    }
    if (new TextEncoder().encode(x.text).length > t.maxInputTokens)
      fail("EMBEDDING_INPUT_LIMIT");
    await ctx.db.patch(t._id, { state: "sent", sentAt: Date.now() });
    return {
      attempt: { ...t, state: "sent" as const, sentAt: Date.now() },
      policy: x.p,
      text: x.text,
    };
  },
});
export const context = internalQuery({
  args: { attemptId: v.id("aiAttempts") },
  returns: v.number(),
  handler: async (ctx, a) => {
    const t = await embeddingAttempt(ctx, a.attemptId);
    return (await currentAttempt(ctx, t)).until;
  },
});
export const settle = internalMutation({
  args: {
    attemptId: v.id("aiAttempts"),
    inputTokens: v.union(v.number(), v.null()),
    errorCode: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const t = await embeddingAttempt(ctx, a.attemptId);
    if (t.state === "reserved" || t.state === "cancelled" || t.sentAt === null)
      fail("EMBEDDING_ATTEMPT_OWNER_INVALID");
    const known =
      a.inputTokens !== null &&
      Number.isSafeInteger(a.inputTokens) &&
      a.inputTokens >= 0 &&
      a.inputTokens <= 1e9;
    if (t.state === "settled") {
      if (known && t.inputTokens !== a.inputTokens)
        fail("EMBEDDING_RECEIPT_CONFLICT");
      return null;
    }
    if (!known) {
      await ctx.db.patch(t._id, {
        state: "unknown",
        errorCode: a.errorCode ?? "EMBEDDING_USAGE_UNKNOWN",
      });
      return null;
    }
    const cost = estimate(a.inputTokens!, t.inputMicrosPerMillion);
    await changeLiability(ctx, t.budgetIds, -t.heldMicros, cost);
    await ctx.db.patch(t._id, {
      state: "settled",
      heldMicros: 0,
      estimatedMicros: cost,
      inputTokens: a.inputTokens,
      receiptFingerprint: await sha256(
        JSON.stringify([a.inputTokens, t.model, t.identity]),
      ),
      settledAt: Date.now(),
      errorCode: a.errorCode,
    });
    return null;
  },
});
export function validVector(vector: number[], dimension: number) {
  if (vector.length !== dimension || vector.some((n) => !Number.isFinite(n)))
    return false;
  const squared = vector.reduce((sum, n) => sum + n * n, 0);
  return Number.isFinite(squared) && squared > 0;
}
export const commit = internalMutation({
  args: { attemptId: v.id("aiAttempts"), vector: v.array(v.number()) },
  returns: v.union(v.id("contentEmbeddings"), v.null()),
  handler: async (ctx, a) => {
    const t = await embeddingAttempt(ctx, a.attemptId);
    if (
      t.state !== "settled" ||
      t.estimatedMicros === null ||
      !validVector(a.vector, t.identity.dimension)
    )
      fail("EMBEDDING_VECTOR_INVALID");
    let x;
    try {
      x = await currentAttempt(ctx, t);
    } catch (e) {
      sourceLoss(e);
      await scrubAttempt(ctx, t);
      return null;
    }
    if (Date.now() >= t.deadline) return null;
    const old =
      t.sourcePin!.kind === "history"
        ? await ctx.db
            .query("contentEmbeddings")
            .withIndex("by_sourcePin_historyPostId", (q) =>
              q.eq(
                "sourcePin.historyPostId",
                t.sourcePin!.kind === "history"
                  ? t.sourcePin!.historyPostId
                  : undefined,
              ),
            )
            .unique()
        : await ctx.db
            .query("contentEmbeddings")
            .withIndex("by_sourcePin_draftVersionId", (q) =>
              q.eq(
                "sourcePin.draftVersionId",
                t.sourcePin!.kind === "draft"
                  ? t.sourcePin!.draftVersionId
                  : undefined,
              ),
            )
            .unique();
    const data = {
      workspaceId: t.workspaceId,
      accountId: t.accountId,
      actorId: t.actorId,
      sourcePin: t.sourcePin!,
      materialFingerprint: t.materialFingerprint!,
      controlId: t.controlId,
      generation: t.generation,
      policyId: t.policyId,
      policyFingerprint: t.policyFingerprint,
      identity: t.identity,
      attemptId: t._id,
      createdAt: Date.now(),
      sourceUntil: x.until,
      vector: a.vector,
    };
    if (old) {
      await ctx.scheduler.runAfter(0, internal.planning.recurring.purgeVector, {
        vectorId: old._id,
        fingerprint: await vectorFingerprint(old),
        cursor: null,
      });
      await ctx.db.replace(old._id, data);
      return old._id;
    }
    return ctx.db.insert("contentEmbeddings", data);
  },
});
async function scrubAttempt(ctx: MutationCtx, t: EmbeddingAttempt) {
  t = await embeddingAttempt(ctx, t._id);
  if (t.state === "reserved") {
    await changeLiability(ctx, t.budgetIds, -t.heldMicros);
    await ctx.db.patch(t._id, { state: "cancelled", heldMicros: 0 });
  }
  await ctx.db.patch(t._id, {
    sourcePin: null,
    materialFingerprint: null,
    intentFingerprint: null,
    sourceUntil: null,
    sourceUnavailable: true,
  });
}
export async function currentVector(
  ctx: Ctx,
  row: Doc<"contentEmbeddings">,
  walk?: MaterialWalk,
) {
  const t = await embeddingAttempt(ctx, row.attemptId),
    x = await currentAttempt(ctx, t, walk);
  if (
    t.state !== "settled" ||
    row.workspaceId !== t.workspaceId ||
    row.accountId !== t.accountId ||
    row.actorId !== t.actorId ||
    row.controlId !== t.controlId ||
    row.generation !== t.generation ||
    row.policyId !== t.policyId ||
    row.policyFingerprint !== t.policyFingerprint ||
    row.materialFingerprint !== t.materialFingerprint ||
    pinKey(row.sourcePin) !== pinKey(t.sourcePin!) ||
    !sameIdentity(row.identity, t.identity) ||
    !validVector(row.vector, row.identity.dimension)
  )
    fail("EMBEDDING_SOURCE_UNAVAILABLE");
  return Math.min(row.sourceUntil, x.until);
}
const cleanupTarget = {
  historyPostId: v.optional(v.id("historyPosts")),
  draftVersionId: v.optional(v.id("draftVersions")),
  controlId: v.optional(v.id("embeddingControls")),
};
export const purge = internalMutation({
  args: {
    ...cleanupTarget,
    cursor: v.optional(v.union(v.string(), v.null())),
    family: v.optional(v.union(v.literal("vectors"), v.literal("attempts"))),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (
      [a.historyPostId, a.draftVersionId, a.controlId].filter(Boolean)
        .length !== 1
    )
      fail("EMBEDDING_CLEANUP_TARGET_INVALID");
    if (a.family === "attempts") {
      const q = ctx.db.query("aiAttempts");
      const query = a.historyPostId
        ? q.withIndex("by_embedding_source_history", (q) =>
            q
              .eq("owner", "own-content-embedding")
              .eq("sourcePin.historyPostId", a.historyPostId),
          )
        : a.draftVersionId
          ? q.withIndex("by_embedding_source_draft", (q) =>
              q
                .eq("owner", "own-content-embedding")
                .eq("sourcePin.draftVersionId", a.draftVersionId),
            )
          : q.withIndex("by_embedding_control", (q) =>
              q
                .eq("owner", "own-content-embedding")
                .eq("controlId", a.controlId),
            );
      const page = await query.paginate({
        cursor: a.cursor ?? null,
        numItems: 1,
      });
      for (const row of page.page) {
        if (row.owner !== "own-content-embedding")
          fail("EMBEDDING_ATTEMPT_OWNER_INVALID");
        if (row.sourceUnavailable) continue;
        try {
          await currentAttempt(ctx, row);
        } catch (e) {
          sourceLoss(e);
          await scrubAttempt(ctx, row);
        }
      }
      if (!page.isDone)
        await ctx.scheduler.runAfter(0, internal.content.similarity.purge, {
          ...a,
          cursor: page.continueCursor,
        });
      return null;
    }
    const q = ctx.db.query("contentEmbeddings");
    const query = a.historyPostId
      ? q.withIndex("by_sourcePin_historyPostId", (q) =>
          q.eq("sourcePin.historyPostId", a.historyPostId),
        )
      : a.draftVersionId
        ? q.withIndex("by_sourcePin_draftVersionId", (q) =>
            q.eq("sourcePin.draftVersionId", a.draftVersionId),
          )
        : q.withIndex("by_controlId", (q) => q.eq("controlId", a.controlId!));
    const page = await query.paginate({
      cursor: a.cursor ?? null,
      numItems: 1,
    });
    for (const row of page.page) {
      try {
        const until = await currentVector(ctx, row);
        if (until <= Date.now()) fail("EMBEDDING_SOURCE_UNAVAILABLE");
        if (until < row.sourceUntil)
          await ctx.db.patch(row._id, { sourceUntil: until });
      } catch (e) {
        sourceLoss(e);
        await ctx.scheduler.runAfter(
          0,
          internal.planning.recurring.purgeVector,
          {
            vectorId: row._id,
            fingerprint: await vectorFingerprint(row),
            cursor: null,
          },
        );
        await ctx.db.delete(row._id);
      }
    }
    await ctx.scheduler.runAfter(
      0,
      internal.content.similarity.purge,
      page.isDone
        ? { ...a, family: "attempts", cursor: null }
        : { ...a, cursor: page.continueCursor },
    );
    return null;
  },
});
export const sweep = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    family: v.union(v.literal("vectors"), v.literal("attempts")),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.family === "attempts") {
      const page = await ctx.db
        .query("aiAttempts")
        .withIndex("by_embedding_cleanup", (q) =>
          q.eq("owner", "own-content-embedding").eq("sourceUnavailable", false),
        )
        .paginate({ cursor: a.cursor, numItems: 1 });
      for (const row of page.page) {
        if (row.owner !== "own-content-embedding")
          fail("EMBEDDING_ATTEMPT_OWNER_INVALID");
        try {
          const x = await currentAttempt(ctx, row);
          if (row.state === "reserved" && row.deadline <= Date.now())
            fail("EMBEDDING_SOURCE_UNAVAILABLE");
          if (x.until < row.sourceUntil!)
            await ctx.db.patch(row._id, { sourceUntil: x.until });
        } catch (e) {
          sourceLoss(e);
          await scrubAttempt(ctx, row);
        }
      }
      if (!page.isDone)
        await ctx.scheduler.runAfter(0, internal.content.similarity.sweep, {
          ...a,
          cursor: page.continueCursor,
        });
      return null;
    }
    const page = await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_sourceUntil")
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const row of page.page) {
      try {
        const until = await currentVector(ctx, row);
        if (until <= Date.now()) fail("EMBEDDING_SOURCE_UNAVAILABLE");
        if (until < row.sourceUntil)
          await ctx.db.patch(row._id, { sourceUntil: until });
      } catch (e) {
        sourceLoss(e);
        await ctx.scheduler.runAfter(
          0,
          internal.planning.recurring.purgeVector,
          {
            vectorId: row._id,
            fingerprint: await vectorFingerprint(row),
            cursor: null,
          },
        );
        await ctx.db.delete(row._id);
      }
    }
    await ctx.scheduler.runAfter(
      0,
      internal.content.similarity.sweep,
      page.isDone
        ? { family: "attempts", cursor: null }
        : { ...a, cursor: page.continueCursor },
    );
    return null;
  },
});
export function cosine(a: number[], b: number[]) {
  return (
    a.reduce((sum, n, i) => sum + n * b[i], 0) /
    Math.sqrt(a.reduce((sum, n) => sum + n * n, 0)) /
    Math.sqrt(b.reduce((sum, n) => sum + n * n, 0))
  );
}
const frameItem = v.object({
  source,
  pin,
  vectorId: v.union(v.id("contentEmbeddings"), v.null()),
  sourceUntil: v.number(),
  text: v.string(),
  score: v.union(v.number(), v.null()),
});
export const frame = workspaceQuery({
  args: {
    accountId: scope.accountId,
    source,
    from: v.number(),
    to: v.number(),
    candidateVersionIds: v.array(v.id("draftVersions")),
    topK: v.number(),
  },
  returns: v.object({
    reason: v.union(v.string(), v.null()),
    overflow: v.boolean(),
    complete: v.boolean(),
    partial: v.boolean(),
    from: v.number(),
    to: v.number(),
    scanned: v.number(),
    eligible: v.number(),
    prepared: v.number(),
    missing: v.number(),
    unavailable: v.number(),
    identity: v.union(identity, v.null()),
    sourceUntil: v.union(v.number(), v.null()),
    items: v.array(frameItem),
    matches: v.array(frameItem),
  }),
  handler: async (ctx, a) => {
    const { native: _native, ...view } = await preparedFrame(
      ctx,
      ctx.workspace._id,
      a,
    );
    return view;
  },
});
export async function vectorFingerprint(row: Doc<"contentEmbeddings">) {
  const { sourceUntil: _until, ...immutable } = row;
  return sha256(JSON.stringify(immutable));
}
export async function preparedFrame(
  ctx: Ctx,
  workspaceId: Id<"workspaces">,
  a: {
    accountId: Id<"socialAccounts">;
    source: Infer<typeof source>;
    from: number;
    to: number;
    candidateVersionIds: Id<"draftVersions">[];
    topK: number;
  },
  protectedNodes: Iterable<string> = [],
) {
  const args = { workspaceId: workspaceId, accountId: a.accountId };
  requireReference(args.workspaceId, await ctx.db.get(a.accountId));
  const base = {
    native: {
      rows: [] as {
        row: Doc<"contentEmbeddings">;
        receiptFingerprint: string;
        attempt: EmbeddingAttempt;
        until: number;
      }[],
      control: null as Doc<"embeddingControls"> | null,
    },
    reason: null as string | null,
    overflow: false,
    complete: false,
    partial: true,
    from: a.from,
    to: a.to,
    scanned: 0,
    eligible: 0,
    prepared: 0,
    missing: 0,
    unavailable: 0,
    identity: null as Infer<typeof identity> | null,
    sourceUntil: null as number | null,
    items: [] as Infer<typeof frameItem>[],
    matches: [] as Infer<typeof frameItem>[],
  };
  if (
    !Number.isSafeInteger(a.from) ||
    !Number.isSafeInteger(a.to) ||
    a.from < 0 ||
    a.to < a.from ||
    !positive(a.topK, 5) ||
    new Set(a.candidateVersionIds).size !== a.candidateVersionIds.length
  )
    fail("EMBEDDING_FRAME_INVALID");
  if (a.candidateVersionIds.length > 25)
    return { ...base, overflow: true, reason: "EMBEDDING_FRAME_OVERFLOW" };
  const rows = await ctx.db
    .query("historyPosts")
    .withIndex("by_workspaceId_and_accountId_and_providerCreatedAt", (q) =>
      q
        .eq("workspaceId", args.workspaceId)
        .eq("accountId", args.accountId)
        .gte("providerCreatedAt", a.from)
        .lte("providerCreatedAt", a.to),
    )
    .take(101);
  if (rows.length > 100)
    return {
      ...base,
      scanned: 101 + a.candidateVersionIds.length,
      overflow: true,
      reason: "EMBEDDING_FRAME_OVERFLOW",
    };
  let auth;
  try {
    auth = await authority(ctx, args);
  } catch (e) {
    sourceLoss(e);
    return { ...base, reason: String((e as ConvexError<string>).data) };
  }
  const protectedAncestors = new Set<string>(protectedNodes),
    candidates: Infer<typeof source>[] = [
      ...rows.map((r) => ({
        kind: "history" as const,
        historyPostId: r._id,
      })),
      ...a.candidateVersionIds.map((id) => ({
        kind: "draft" as const,
        draftVersionId: id,
      })),
    ];
  const vectors = new Map<string, number[]>(),
    receipts: ReceiptMemo = { policies: new Map(), budgets: new Map() },
    historyRights = new Map<string, number>();
  base.native.control = auth.c;
  base.identity = auth.p.identity;
  base.scanned = candidates.length;
  base.sourceUntil = auth.until;
  // Each source retains its own 32-ancestor proof. A larger aggregate frame is explicitly unavailable, never declared a source loss.
  for (const s of candidates) {
    if (s.kind === "history" ? !auth.c.ownHistory : !auth.c.draftVersions) {
      base.unavailable++;
      continue;
    }
    let material;
    try {
      const walk = materialWalk();
      material = await sourceProof(ctx, args, s, walk, historyRights);
      for (const id of walk.budget.counted) protectedAncestors.add(id);
      if (protectedAncestors.size > 32)
        return {
          ...base,
          reason: "EMBEDDING_FRAME_RESOURCE_CEILING",
          items: [],
          matches: [],
          complete: false,
          partial: true,
        };
    } catch (e) {
      if (resourceLimit(e))
        return {
          ...base,
          reason: "EMBEDDING_FRAME_RESOURCE_CEILING",
          items: [],
          matches: [],
          complete: false,
          partial: true,
        };
      sourceLoss(e);
      base.unavailable++;
      continue;
    }
    base.eligible++;
    const row =
      s.kind === "history"
        ? await ctx.db
            .query("contentEmbeddings")
            .withIndex("by_sourcePin_historyPostId", (q) =>
              q.eq("sourcePin.historyPostId", s.historyPostId),
            )
            .unique()
        : await ctx.db
            .query("contentEmbeddings")
            .withIndex("by_sourcePin_draftVersionId", (q) =>
              q.eq("sourcePin.draftVersionId", s.draftVersionId),
            )
            .unique();
    let ready = false,
      until = Math.min(auth.until, material.until ?? Infinity),
      id: Id<"contentEmbeddings"> | null = null;
    if (row) {
      const t = await embeddingAttempt(ctx, row.attemptId, receipts);
      // Immutable native settlement plus current scope/source are required; each actor is checked even in a shared frame.
      if (
        t?.owner === "own-content-embedding" &&
        t.state === "settled" &&
        !t.sourceUnavailable &&
        t.estimatedMicros !== null &&
        t.sourceUntil !== null &&
        row.workspaceId === args.workspaceId &&
        row.accountId === args.accountId &&
        row.actorId === t.actorId &&
        t.workspaceId === args.workspaceId &&
        t.accountId === args.accountId &&
        t.providerIdentity === auth.acc.providerIdentity &&
        t.connectionSequence ===
          (auth.acc.xEvidence?.connectionSequence ?? 0) &&
        t.controlId === auth.c._id &&
        row.controlId === auth.c._id &&
        t.generation === auth.c.generation &&
        row.generation === auth.c.generation &&
        t.policyId === auth.p._id &&
        row.policyId === auth.p._id &&
        t.policyFingerprint === auth.fingerprint &&
        row.policyFingerprint === auth.fingerprint &&
        t.materialFingerprint === material.materialFingerprint &&
        row.materialFingerprint === material.materialFingerprint &&
        t.sourcePin !== null &&
        pinKey(t.sourcePin) === pinKey(material.sourcePin) &&
        pinKey(row.sourcePin) === pinKey(material.sourcePin) &&
        sameIdentity(t.identity, auth.p.identity) &&
        sameIdentity(row.identity, auth.p.identity) &&
        validVector(row.vector, auth.p.identity.dimension)
      ) {
        try {
          await actor(ctx, args.workspaceId, t.actorId);
          until = Math.min(until, row.sourceUntil, t.sourceUntil);
          ready = until > Date.now();
        } catch (e) {
          sourceLoss(e);
        }
      }
      if (ready) {
        id = row._id;
        vectors.set(sourceKey(s), row.vector);
        base.native.rows.push({
          row,
          receiptFingerprint: t.receiptFingerprint!,
          attempt: t,
          until,
        });
      }
    }
    if (ready) base.prepared++;
    else base.missing++;
    base.sourceUntil = Math.min(base.sourceUntil!, until);
    base.items.push({
      source: s,
      pin: material.sourcePin,
      vectorId: id,
      sourceUntil: until,
      text: material.text.slice(0, 240),
      score: null,
    });
  }
  const query = vectors.get(sourceKey(a.source));
  if (!query) {
    base.reason = "EMBEDDING_QUERY_UNAVAILABLE";
    return base;
  }
  base.matches = base.items
    .filter(
      (item) =>
        sourceKey(item.source) !== sourceKey(a.source) &&
        item.vectorId !== null,
    )
    .map((item) => ({
      ...item,
      score: cosine(query, vectors.get(sourceKey(item.source))!),
    }))
    .sort(
      (a, b) =>
        b.score! - a.score! ||
        sourceKey(a.source).localeCompare(sourceKey(b.source)),
    )
    .slice(0, a.topK);
  base.complete = base.missing === 0 && base.unavailable === 0;
  base.partial = !base.complete;
  base.reason = base.complete ? null : "EMBEDDING_PARTIAL_COVERAGE";
  return base;
}
