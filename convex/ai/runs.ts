import { changeLiability } from "./accounting";
import {
  conversationAccess,
  conversationAuthority,
} from "./conversationAccess";
import { currentContext } from "../integrations/github/contextAccess";
import { ConvexError, v } from "convex/values";
import { createThread, saveMessage } from "@convex-dev/agent";
import {
  internalMutation,
  internalQuery,
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  requireActiveWorkspace,
  requireWorkspace,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { checkSource } from "../integrations/github/repositories";
import { sha256 } from "../lib/crypto";
import { generationPurpose, source, runFields, policyFields } from "./fields";

function bounded(n: number, ceiling: number) {
  return Number.isSafeInteger(n) && n > 0 && n <= ceiling;
}
function tokenEstimate(
  input: number,
  output: number,
  inputRate: number,
  outputRate: number,
) {
  return Number(
    (BigInt(input) * BigInt(inputRate) +
      BigInt(output) * BigInt(outputRate) +
      999999n) /
      1000000n,
  );
}
export function validPolicy(p: Doc<"aiPolicies"> | null) {
  return (
    !!p &&
    p.enabled &&
    p.processingEvidence.trim().length > 0 &&
    p.pricingEvidence.trim().length > 0 &&
    p.version.length > 0 &&
    p.version.length <= 100 &&
    /^[A-Za-z0-9_.:/-]{1,200}$/.test(p.model) &&
    /^[A-Z]{3}$/.test(p.currency) &&
    p.baseURL === "https://router.eu.requesty.ai/v1" &&
    bounded(p.inputMicrosPerMillion, 1e9) &&
    bounded(p.outputMicrosPerMillion, 1e9) &&
    bounded(p.maxInputTokens, 32000) &&
    bounded(p.maxOutputTokens, 8000) &&
    bounded(p.maxAttempts, 10) &&
    bounded(p.maxToolSteps, 20) &&
    bounded(p.maxDurationMs, 120000)
  );
}
export async function policy(ctx: QueryCtx | MutationCtx) {
  const p = await ctx.db
    .query("aiPolicies")
    .withIndex("by_key", (q) => q.eq("key", "requesty-generation"))
    .unique();
  if (!validPolicy(p))
    throw new ConvexError("MODEL_PROCESSING_CONFIGURATION_REQUIRED");
  return p!;
}
function policyFingerprint(p: Doc<"aiPolicies">) {
  return sha256(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(p).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  );
}
async function authority(
  ctx: QueryCtx | MutationCtx,
  r: Pick<
    Doc<"agentRuns">,
    | "workspaceId"
    | "accountId"
    | "actorId"
    | "sources"
    | "accountConnectionSequence"
  >,
) {
  requireActiveWorkspace(await ctx.db.get(r.workspaceId));
  const actor = await ctx.db.get(r.actorId);
  if (!actor) throw new ConvexError("MODEL_ACTOR_UNAVAILABLE");
  const { membership } = await requireWorkspace(ctx, r.workspaceId, actor);
  requireRole(membership, ["Owner", "Admin", "Editor"]);
  const account = await ctx.db.get(r.accountId);
  requireReference(r.workspaceId, account);
  if (
    account!.connection !== "connected" ||
    (account!.xEvidence?.connectionSequence ?? 0) !==
      r.accountConnectionSequence
  )
    throw new ConvexError("MODEL_ACCOUNT_CHANGED");
  for (const s of r.sources) {
    if (s.contextId) {
      const { c } = await currentContext(ctx, s.contextId, true);
      if (
        c.workspaceId !== r.workspaceId ||
        c.repositoryId !== s.repositoryId ||
        c.generation !== s.generation
      )
        throw new ConvexError("GITHUB_CONTEXT_CHANGED");
    }
    await checkSource(
      ctx,
      r.workspaceId,
      s.repositoryId,
      s.generation,
      "content",
    );
  }
}
export async function active(
  ctx: QueryCtx | MutationCtx,
  runId: Id<"agentRuns">,
  generation?: number,
  executionKey?: string,
) {
  const r = await ctx.db.get(runId);
  if (
    !r ||
    (r.state !== "ready" && r.state !== "running") ||
    r.deadline <= Date.now() ||
    (generation !== undefined && r.generation !== generation) ||
    (executionKey !== undefined && r.executionKey !== executionKey)
  )
    throw new ConvexError("MODEL_RUN_INACTIVE");
  await authority(ctx, r);
  if (r.conversationId) await conversationAuthority(ctx, r);
  const contentRequest = await ctx.db
    .query("contentRequests")
    .withIndex("by_runId", (q) => q.eq("runId", runId))
    .unique();
  if (contentRequest) {
    const idea = await ctx.db.get(contentRequest.ideaId);
    if (
      contentRequest.workspaceId !== r.workspaceId ||
      contentRequest.actorId !== r.actorId ||
      contentRequest.accountId !== r.accountId ||
      !idea ||
      idea.workspaceId !== r.workspaceId ||
      idea.revision !== contentRequest.inputRevision ||
      idea.currentVersionId !== contentRequest.inputVersionId ||
      idea.status === "archived"
    )
      throw new ConvexError("IDEA_SOURCE_CHANGED");
  }
  const p = await policy(ctx);
  if (
    p.version !== r.policyVersion ||
    (await policyFingerprint(p)) !== r.policyFingerprint ||
    !p.purposes.includes(r.purpose)
  )
    throw new ConvexError("MODEL_POLICY_CHANGED");
  for (const [index, id] of r.budgetIds.entries()) {
    const b = await ctx.db.get(id);
    const scope = (["provider", "workspace", "account"] as const)[index];
    if (
      !b ||
      b.scope !== scope ||
      (scope !== "provider" && !b.approvedBy) ||
      (scope !== "provider" && b.workspaceId !== r.workspaceId) ||
      (scope === "account" && b.accountId !== r.accountId) ||
      b.expiresAt <= Date.now() ||
      b.policyVersion !== p.version ||
      b.currency !== p.currency ||
      !b.purposes.includes(r.purpose) ||
      !bounded(b.limitMicros, 1e12) ||
      !Number.isSafeInteger(b.heldMicros) ||
      !Number.isSafeInteger(b.spentMicros) ||
      b.heldMicros < 0 ||
      b.spentMicros < 0
    )
      throw new ConvexError("MODEL_BUDGET_GRANT_EXPIRED");
    if (b.approvedBy) {
      const user = await ctx.db.get(b.approvedBy);
      if (!user) throw new ConvexError("MODEL_BUDGET_GRANT_EXPIRED");
      const { membership } = await requireWorkspace(ctx, r.workspaceId, user);
      requireRole(membership, ["Owner", "Admin"]);
    }
  }
  if (r.budgetIds.length !== 3)
    throw new ConvexError("MODEL_BUDGET_GRANT_EXPIRED");
  return { r, p };
}
export async function createRun(
  ctx: MutationCtx,
  a: {
    workspaceId: Id<"workspaces">;
    accountId: Id<"socialAccounts">;
    actorId: Id<"users">;
    purpose: Doc<"agentRuns">["purpose"];
    prompt: string;
    promptVersion: string;
    sources: Doc<"agentRuns">["sources"];
    conversationId?: Id<"conversations">;
    chatOperationId?: Id<"chatOperations">;
    existingPrompt?: { threadId: string; messageId: string };
  },
) {
  const p = await policy(ctx);
  if (!p.purposes.includes(a.purpose))
    throw new ConvexError("MODEL_PURPOSE_NOT_APPROVED");
  if (
    !a.prompt.trim() ||
    new TextEncoder().encode(a.prompt).length >
      Math.min(16000, p.maxInputTokens) ||
    !a.promptVersion.trim() ||
    a.promptVersion.length > 100 ||
    a.sources.length > 10
  )
    throw new ConvexError("MODEL_INPUT_INVALID");
  const account = await ctx.db.get(a.accountId);
  requireReference(a.workspaceId, account);
  const accountConnectionSequence = account!.xEvidence?.connectionSequence ?? 0;
  await authority(ctx, { ...a, accountConnectionSequence });
  const budgetIds: Id<"aiBudgets">[] = [];
  for (const [scope, key] of [
    ["provider", "provider"],
    ["workspace", `workspace:${a.workspaceId}`],
    ["account", `account:${a.accountId}`],
  ] as const) {
    const b = await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (
      !b ||
      b.scope !== scope ||
      (scope !== "provider" &&
        (b.workspaceId !== a.workspaceId || !b.approvedBy)) ||
      (scope === "account" && b.accountId !== a.accountId) ||
      b.policyVersion !== p.version ||
      b.currency !== p.currency ||
      !b.purposes.includes(a.purpose) ||
      b.expiresAt <= Date.now() ||
      !bounded(b.limitMicros, 1e12) ||
      !Number.isSafeInteger(b.heldMicros) ||
      !Number.isSafeInteger(b.spentMicros) ||
      b.heldMicros < 0 ||
      b.spentMicros < 0
    )
      throw new ConvexError("MODEL_BUDGET_CONFIGURATION_REQUIRED");
    budgetIds.push(b._id);
  }
  const threadId =
    a.existingPrompt?.threadId ??
    (await createThread(ctx, components.agent, {
      userId: a.actorId,
    }));
  const saved = a.existingPrompt
    ? { messageId: a.existingPrompt.messageId }
    : await saveMessage(ctx, components.agent, {
        threadId,
        userId: a.actorId,
        message: { role: "user", content: a.prompt },
      });
  const { prompt, existingPrompt, ...rest } = a;
  const runId = await ctx.db.insert("agentRuns", {
    ...rest,
    accountConnectionSequence,
    policyVersion: p.version,
    policyFingerprint: await policyFingerprint(p),
    threadId,
    promptMessageId: saved.messageId,
    generation: 1,
    state: "ready",
    executionKey: null,
    deadline: Date.now() + p.maxDurationMs,
    attempts: 0,
    toolSteps: 0,
    budgetIds,
    createdAt: Date.now(),
    errorCode: null,
  });
  if (!a.conversationId) await active(ctx, runId);
  return runId;
}
export const create = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    accountId: v.id("socialAccounts"),
    actorId: v.id("users"),
    purpose: generationPurpose,
    prompt: v.string(),
    promptVersion: v.string(),
    sources: v.array(source),
  },
  returns: v.id("agentRuns"),
  handler: async (ctx, a) => {
    return createRun(ctx, a);
  },
});
export const claim = internalMutation({
  args: { runId: v.id("agentRuns"), executionKey: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { r } = await active(ctx, a.runId);
    if (r.state !== "ready" || !a.executionKey || a.executionKey.length > 100)
      throw new ConvexError("MODEL_RUN_ALREADY_CLAIMED");
    await ctx.db.patch(r._id, {
      state: "running",
      executionKey: a.executionKey,
    });
    return null;
  },
});
export const context = internalQuery({
  args: {
    runId: v.id("agentRuns"),
    generation: v.number(),
    executionKey: v.string(),
  },
  returns: v.object({
    run: v.object({ _id: v.id("agentRuns"), ...runFields }),
    chat: v.optional(
      v.object({
        allowIdeaCreation: v.boolean(),
        resultIdeaId: v.union(v.id("ideas"), v.null()),
      }),
    ),
    policy: v.object({
      _id: v.id("aiPolicies"),
      _creationTime: v.number(),
      ...policyFields,
    }),
  }),
  handler: async (ctx, a) => {
    const { r, p } = await active(ctx, a.runId, a.generation, a.executionKey);
    const { _creationTime, ...run } = r;
    const op = r.chatOperationId ? await ctx.db.get(r.chatOperationId) : null;
    return {
      run,
      policy: p,
      ...(op
        ? {
            chat: {
              allowIdeaCreation: op.allowIdeaCreation,
              resultIdeaId: op.resultIdeaId,
            },
          }
        : {}),
    };
  },
});
export const fund = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    generation: v.number(),
    executionKey: v.string(),
    key: v.string(),
  },
  returns: v.id("aiAttempts"),
  handler: async (ctx, a) => {
    const { r, p } = await active(ctx, a.runId, a.generation, a.executionKey);
    if (r.state !== "running" || !a.key || a.key.length > 100)
      throw new ConvexError("MODEL_RUN_INACTIVE");
    if (
      await ctx.db
        .query("aiAttempts")
        .withIndex("by_runId_and_key", (q) =>
          q.eq("runId", r._id).eq("key", a.key),
        )
        .unique()
    )
      throw new ConvexError("MODEL_ATTEMPT_ALREADY_ADMITTED");
    for (const state of ["sent", "unknown"] as const)
      if (
        await ctx.db
          .query("aiAttempts")
          .withIndex("by_runId_and_state", (q) =>
            q.eq("runId", r._id).eq("state", state),
          )
          .first()
      )
        throw new ConvexError("MODEL_PREVIOUS_ATTEMPT_UNRESOLVED");
    if (r.attempts >= p.maxAttempts)
      throw new ConvexError("MODEL_ATTEMPT_LIMIT");
    const reservedMicros = tokenEstimate(
      p.maxInputTokens,
      p.maxOutputTokens,
      p.inputMicrosPerMillion,
      p.outputMicrosPerMillion,
    );
    await changeLiability(ctx, r.budgetIds, reservedMicros, 0, true);
    await ctx.db.patch(r._id, { attempts: r.attempts + 1 });
    return ctx.db.insert("aiAttempts", {
      runId: r._id,
      workspaceId: r.workspaceId,
      key: a.key,
      generation: r.generation,
      budgetIds: r.budgetIds,
      reservedMicros,
      heldMicros: reservedMicros,
      currency: p.currency,
      policyVersion: p.version,
      model: p.model,
      provider: "requesty",
      inputMicrosPerMillion: p.inputMicrosPerMillion,
      outputMicrosPerMillion: p.outputMicrosPerMillion,
      state: "sent",
      sentAt: Date.now(),
      settledAt: null,
      inputTokens: null,
      outputTokens: null,
      estimatedMicros: null,
      billedMicros: null,
      reportedCost: null,
      reportedCurrency: null,
      reportedCostInvalid: false,
      errorCode: null,
    });
  },
});
export const settle = internalMutation({
  args: {
    attemptId: v.id("aiAttempts"),
    inputTokens: v.union(v.number(), v.null()),
    outputTokens: v.union(v.number(), v.null()),
    reportedCost: v.optional(v.union(v.number(), v.null())),
    reportedCostInvalid: v.optional(v.boolean()),
    errorCode: v.union(
      v.literal("MODEL_PROVIDER_UNAVAILABLE"),
      v.literal("MODEL_OUTPUT_INVALID"),
      v.literal("MODEL_STREAM_INCOMPLETE"),
      v.null(),
    ),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const attempt = await ctx.db.get(a.attemptId);
    if (!attempt) throw new ConvexError("MODEL_ATTEMPT_NOT_FOUND");
    if (
      attempt.owner === "native-search" ||
      attempt.researchOrderId ||
      attempt.logicalIntent
    )
      throw new ConvexError("MODEL_ATTEMPT_OWNER_INVALID");
    const ownerRun = await ctx.db.get(attempt.runId);
    if (!ownerRun || ownerRun.workspaceId !== attempt.workspaceId)
      throw new ConvexError("MODEL_ATTEMPT_OWNER_INVALID");
    const newCostEvidence =
      (!!a.reportedCostInvalid && !attempt.reportedCostInvalid) ||
      (a.reportedCost !== undefined &&
        a.reportedCost !== null &&
        attempt.reportedCost === null);
    if (a.reportedCostInvalid && !attempt.reportedCostInvalid)
      await ctx.db.patch(attempt._id, { reportedCostInvalid: true });
    if (a.reportedCost !== undefined && a.reportedCost !== null) {
      if (
        !Number.isFinite(a.reportedCost) ||
        a.reportedCost < 0 ||
        a.reportedCost > 1e9
      )
        throw new ConvexError("MODEL_COST_RECEIPT_INVALID");
      if (
        attempt.reportedCost !== null &&
        attempt.reportedCost !== a.reportedCost
      )
        throw new ConvexError("MODEL_RECEIPT_CONFLICT");
      if (attempt.reportedCost === null) {
        await ctx.db.patch(attempt._id, { reportedCost: a.reportedCost });
      }
    }
    if (attempt.state === "settled" && newCostEvidence) {
      // ponytail: late unverified cost reholds the conservative ceiling; release only after operator currency reconciliation.
      const heldMicros = Math.max(
        attempt.reservedMicros,
        attempt.estimatedMicros ?? 0,
      );
      await changeLiability(ctx, attempt.budgetIds, heldMicros);
      await ctx.db.patch(attempt._id, {
        state: "unknown",
        heldMicros,
        errorCode: "MODEL_COST_CURRENCY_UNVERIFIED",
      });
    }
    const known =
      a.inputTokens !== null &&
      a.outputTokens !== null &&
      Number.isSafeInteger(a.inputTokens) &&
      Number.isSafeInteger(a.outputTokens) &&
      a.inputTokens >= 0 &&
      a.outputTokens >= 0 &&
      a.inputTokens <= 1e9 &&
      a.outputTokens <= 1e9;
    if (attempt.state === "settled") {
      if (
        known &&
        (attempt.inputTokens !== a.inputTokens ||
          attempt.outputTokens !== a.outputTokens)
      )
        throw new ConvexError("MODEL_RECEIPT_CONFLICT");
      return null;
    }
    if (!known) {
      await ctx.db.patch(attempt._id, {
        state: "unknown",
        errorCode: a.errorCode ?? "MODEL_STREAM_INCOMPLETE",
      });
      return null;
    }
    const estimatedMicros = tokenEstimate(
      a.inputTokens!,
      a.outputTokens!,
      attempt.inputMicrosPerMillion,
      attempt.outputMicrosPerMillion,
    );
    if (
      attempt.inputTokens !== null &&
      attempt.outputTokens !== null &&
      (attempt.inputTokens !== a.inputTokens ||
        attempt.outputTokens !== a.outputTokens)
    )
      throw new ConvexError("MODEL_RECEIPT_CONFLICT");
    if (estimatedMicros > attempt.reservedMicros) {
      const run = await ctx.db.get(attempt.runId);
      if (run && (run.state === "running" || run.state === "ready"))
        await ctx.db.patch(run._id, {
          state: "failed",
          generation: run.generation + 1,
          errorCode: "MODEL_BUDGET_OVERRUN",
        });
    }
    if (
      (a.reportedCost ?? attempt.reportedCost) !== null ||
      a.reportedCostInvalid ||
      attempt.reportedCostInvalid
    ) {
      const heldMicros = Math.max(attempt.reservedMicros, estimatedMicros);
      await changeLiability(
        ctx,
        attempt.budgetIds,
        heldMicros - attempt.heldMicros,
      );
      await ctx.db.patch(attempt._id, {
        state: "unknown",
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        estimatedMicros,
        heldMicros,
        errorCode: "MODEL_COST_CURRENCY_UNVERIFIED",
      });
      return null;
    }
    await changeLiability(
      ctx,
      attempt.budgetIds,
      -attempt.heldMicros,
      estimatedMicros,
    );
    await ctx.db.patch(attempt._id, {
      state: "settled",
      settledAt: Date.now(),
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      estimatedMicros,
      heldMicros: 0,
      errorCode: a.errorCode,
    });
    return null;
  },
});
export const toolContext = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    generation: v.number(),
    executionKey: v.string(),
  },
  returns: v.object({
    name: v.string(),
    description: v.string(),
    audience: v.string(),
    tone: v.string(),
  }),
  handler: async (ctx, a) => {
    const { r, p } = await active(ctx, a.runId, a.generation, a.executionKey);
    if (r.toolSteps >= p.maxToolSteps)
      throw new ConvexError("MODEL_TOOL_LIMIT");
    await ctx.db.patch(r._id, { toolSteps: r.toolSteps + 1 });
    const w = (await ctx.db.get(r.workspaceId))!;
    const prefs = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", r.actorId).eq("workspaceId", r.workspaceId),
      )
      .unique();
    return {
      name: w.name.slice(0, 100),
      description: w.description.slice(0, 2000),
      audience: prefs?.audience.slice(0, 1000) ?? "",
      tone: prefs?.tone.slice(0, 1000) ?? "",
    };
  },
});
export const finish = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    generation: v.number(),
    executionKey: v.string(),
    failed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.runId);
    if (r?.executionKey === a.executionKey)
      await ctx.db.patch(r._id, { executionFinishedAt: Date.now() });
    if (
      !r ||
      r.generation !== a.generation ||
      r.executionKey !== a.executionKey ||
      r.state !== "running"
    )
      return null;
    let failed = a.failed;
    if (!failed) {
      try {
        await active(ctx, a.runId, a.generation, a.executionKey);
      } catch {
        failed = true;
      }
    }
    await ctx.db.patch(r._id, {
      state: failed ? "failed" : "completed",
      errorCode: failed ? "MODEL_RUN_FAILED" : null,
    });
    return null;
  },
});
export const stop = mutation({
  args: { workspaceId: v.id("workspaces"), runId: v.id("agentRuns") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { membership } = await requireWorkspace(ctx, a.workspaceId);
    requireRole(membership, ["Owner", "Admin", "Editor"]);
    const r = await ctx.db.get(a.runId);
    requireReference(a.workspaceId, r);
    if (r!.conversationId || r!.purpose === "chat") {
      if (!r!.conversationId || !r!.accountId)
        throw new ConvexError("CHAT_RUN_CHANGED");
      const { c } = await conversationAccess(
        ctx,
        a.workspaceId,
        r!.accountId,
        r!.conversationId,
        true,
      );
      if (c.actorId !== r!.actorId || c.threadId !== r!.threadId)
        throw new ConvexError("CHAT_RUN_CHANGED");
    }
    if (r!.state === "ready" || r!.state === "running")
      await ctx.db.patch(r!._id, {
        state: "stopped",
        generation: r!.generation + 1,
      });
    if (r!.conversationId)
      await ctx.scheduler.runAfter(0, internal.ai.conversations.abortStreams, {
        conversationId: r!.conversationId,
        expectedRunId: r!._id,
      });
    return null;
  },
});
export const availability = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    generation: v.literal("configuration_required"),
    embedding: v.literal("disabled"),
    semantic: v.literal("disabled"),
    providerConfigured: v.boolean(),
    processingApproved: v.boolean(),
    pricingApproved: v.boolean(),
  }),
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspaceId);
    const p = await ctx.db
      .query("aiPolicies")
      .withIndex("by_key", (q) => q.eq("key", "requesty-generation"))
      .unique();
    return {
      generation: "configuration_required" as const,
      embedding: "disabled" as const,
      semantic: "disabled" as const,
      providerConfigured: !!process.env.REQUESTY_API_KEY,
      processingApproved: !!p?.processingEvidence && !!p?.enabled,
      pricingApproved: !!p?.pricingEvidence,
    };
  },
});
export const recent = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(
    v.object({
      runId: v.id("agentRuns"),
      purpose: generationPurpose,
      state: runFields.state,
      createdAt: v.number(),
      attempts: v.number(),
      estimatedMicros: v.union(v.number(), v.null()),
      currency: v.union(v.string(), v.null()),
      usagePending: v.boolean(),
    }),
  ),
  handler: async (ctx, a) => {
    await requireWorkspace(ctx, a.workspaceId);
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_workspaceId_and_createdAt", (q) =>
        q.eq("workspaceId", a.workspaceId),
      )
      .order("desc")
      .take(10);
    return Promise.all(
      runs.map(async (r) => {
        const attempts = await ctx.db
          .query("aiAttempts")
          .withIndex("by_runId_and_key", (q) => q.eq("runId", r._id))
          .take(10);
        const observed = attempts.filter(
          (attempt) => attempt.estimatedMicros !== null,
        );
        return {
          runId: r._id,
          purpose: r.purpose,
          state: r.state,
          createdAt: r.createdAt,
          attempts: r.attempts,
          estimatedMicros: observed.length
            ? observed.reduce(
                (sum, attempt) => sum + attempt.estimatedMicros!,
                0,
              )
            : null,
          currency: attempts[0]?.currency ?? null,
          usagePending: attempts.some((attempt) => attempt.state !== "settled"),
        };
      }),
    );
  },
});

export const rejectUnclaimed = internalMutation({
  args: { runId: v.id("agentRuns") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.runId);
    if (r?.state === "ready" && !r.executionKey)
      await ctx.db.patch(r._id, {
        state: "failed",
        generation: r.generation + 1,
        errorCode: "MODEL_RUN_UNAVAILABLE",
        executionFinishedAt: Date.now(),
      });
    return null;
  },
});
