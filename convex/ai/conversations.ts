import { ideaProofUntil } from "../research/contentProof";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import {
  currentRunSources,
  runSourceKey,
  retainedRunProof,
} from "./sourceAccess";
import { orderLiability } from "../research/pipelineAccess";
import { registerResearchCopies } from "../research/contentCleanup";
import { admitPipeline } from "../research/pipeline";
import { operation } from "../research/providerFields";
import { currentProfile } from "../research/access";
import { evidenceSource } from "../research/contentProof";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  createThread,
  saveMessage,
  listUIMessages,
  listStreams,
  syncStreams,
  vStreamArgs,
  vPaginationResult,
} from "@convex-dev/agent";
import { vStreamMessage, vStreamDelta } from "@convex-dev/agent/validators";
import { components, internal } from "../_generated/api";
import {
  query,
  mutation,
  internalMutation,
  type MutationCtx,
} from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import {
  requireWorkspace,
  requireReference,
  requireRole,
} from "../lib/authorization";
import { generationAttempt } from "./accounting";
import {
  conversationAccess,
  historyAuthority,
  operationRun,
} from "./conversationAccess";
import { active, createRun } from "./runs";
import { currentIdeaSource, insertIdea } from "../content/ideas";
import { currentContext } from "../integrations/github/contextAccess";
import { sha256 } from "../lib/crypto";
const scope = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
};
const target = { ...scope, conversationId: v.id("conversations") };
function text(s: string, max: number) {
  if (
    !s.trim() ||
    s.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)
  )
    throw new ConvexError("CHAT_INPUT_INVALID");
}
function key(k: string) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(k))
    throw new ConvexError("CHAT_OPERATION_INVALID");
}
function integer(n: number) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new ConvexError("CHAT_CURSOR_INVALID");
}
const listItem = v.object({
  conversationId: v.id("conversations"),
  title: v.string(),
  revision: v.number(),
  state: v.union(
    v.literal("active"),
    v.literal("deleting"),
    v.literal("deleted"),
  ),
  updatedAt: v.number(),
  turns: v.number(),
});
export const list = query({
  args: { ...scope, paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(listItem),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, a) => {
    const { user } = await requireWorkspace(ctx, a.workspaceId);
    requireReference(a.workspaceId, await ctx.db.get(a.accountId));
    if (
      !Number.isSafeInteger(a.paginationOpts.numItems) ||
      a.paginationOpts.numItems < 1 ||
      a.paginationOpts.numItems > 25
    )
      throw new ConvexError("CHAT_PAGE_LIMIT");
    const p = await ctx.db
      .query("conversations")
      .withIndex(
        "by_workspaceId_and_accountId_and_actorId_and_updatedAt",
        (q) =>
          q
            .eq("workspaceId", a.workspaceId)
            .eq("accountId", a.accountId)
            .eq("actorId", user._id),
      )
      .order("desc")
      .paginate(a.paginationOpts);
    return {
      isDone: p.isDone,
      continueCursor: p.continueCursor,
      page: p.page
        .filter((c) => c.actorId === user._id)
        .map((c) => ({
          conversationId: c._id,
          title: c.title,
          revision: c.revision,
          state: c.state,
          updatedAt: c.updatedAt,
          turns: c.turns,
        })),
    };
  },
});
export const create = mutation({
  args: { ...scope, operationKey: v.string() },
  returns: v.id("conversations"),
  handler: async (ctx, a) => {
    const { user, membership } = await requireWorkspace(ctx, a.workspaceId);
    requireRole(membership, ["Owner", "Admin", "Editor"]);
    requireReference(a.workspaceId, await ctx.db.get(a.accountId));
    key(a.operationKey);
    const old = await ctx.db
      .query("conversations")
      .withIndex("by_workspaceId_and_actorId_and_operationKey", (q) =>
        q
          .eq("workspaceId", a.workspaceId)
          .eq("actorId", user._id)
          .eq("operationKey", a.operationKey),
      )
      .unique();
    if (old) {
      if (old.accountId !== a.accountId)
        throw new ConvexError("CHAT_OPERATION_CONFLICT");
      return old._id;
    }
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
    });
    return ctx.db.insert("conversations", {
      ...a,
      actorId: user._id,
      threadId,
      title: "Neue Unterhaltung",
      revision: 1,
      sources: [],
      ideaVersionIds: [],
      turns: 0,
      activeRunId: null,
      updatedAt: Date.now(),
      state: "active",
      cleanupAfter: 0,
    });
  },
});
export const rename = mutation({
  args: { ...target, title: v.string(), expectedRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { c } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
      true,
    );
    if (c.state !== "active") throw new ConvexError("CHAT_INACTIVE");
    text(a.title, 100);
    if (c.revision !== a.expectedRevision)
      throw new ConvexError("CHAT_REVISION_CONFLICT");
    await ctx.db.patch(c._id, {
      title: a.title.trim(),
      revision: c.revision + 1,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const messages = query({
  args: {
    ...scope,
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: v.object({
    ...vPaginationResult(
      v.object({
        id: v.string(),
        key: v.string(),
        order: v.number(),
        stepOrder: v.number(),
        status: v.union(
          v.literal("streaming"),
          v.literal("pending"),
          v.literal("success"),
          v.literal("failed"),
        ),
        role: v.union(
          v.literal("user"),
          v.literal("assistant"),
          v.literal("system"),
        ),
        parts: v.array(v.any()),
        text: v.string(),
        _creationTime: v.number(),
        agentName: v.optional(v.string()),
        userId: v.optional(v.string()),
        metadata: v.optional(v.any()),
      }),
    ).fields,
    streams: v.optional(
      v.union(
        v.object({
          kind: v.literal("list"),
          messages: v.array(vStreamMessage),
        }),
        v.object({ kind: v.literal("deltas"), deltas: v.array(vStreamDelta) }),
      ),
    ),
  }),
  handler: async (ctx, a) => {
    // The hook's threadId is a DOMAIN conversation ID, never an adopted component ID.
    const id = ctx.db.normalizeId("conversations", a.threadId);
    if (!id) throw new ConvexError("CHAT_ACCESS_DENIED");
    const { c } = await conversationAccess(ctx, a.workspaceId, a.accountId, id);
    try {
      await historyAuthority(ctx, c);
    } catch (error) {
      rethrowUnexpectedSourceError(error);
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        streams: a.streamArgs
          ? a.streamArgs.kind === "deltas"
            ? { kind: "deltas" as const, deltas: [] }
            : { kind: "list" as const, messages: [] }
          : undefined,
      };
    }
    integer(a.paginationOpts.numItems);
    if (a.paginationOpts.numItems > 50)
      throw new ConvexError("CHAT_PAGE_LIMIT");
    const s = a.streamArgs;
    if (s?.kind === "list" && s.startOrder !== undefined) integer(s.startOrder);
    let safe = s;
    if (s?.kind === "deltas") {
      if (
        s.cursors.length > 100 ||
        new Set(s.cursors.map((x) => x.streamId)).size !== s.cursors.length
      )
        throw new ConvexError("CHAT_CURSOR_INVALID");
      for (const cursor of s.cursors) {
        text(cursor.streamId, 100);
        integer(cursor.cursor);
      }
      const own = await listStreams(ctx, components.agent, {
        threadId: c.threadId,
        includeStatuses: ["streaming", "finished", "aborted"],
      });
      const ids = new Set(own.map((x) => x.streamId));
      // ponytail: native metadata window is 100 streams; unproven/older IDs resync through history, never a cross-thread delta probe.
      safe = {
        kind: "deltas",
        cursors: s.cursors.filter((x) => ids.has(x.streamId)),
      };
    }
    const p = await listUIMessages(ctx, components.agent, {
      threadId: c.threadId,
      paginationOpts: a.paginationOpts,
    });
    return {
      ...p,
      streams: await syncStreams(ctx, components.agent, {
        threadId: c.threadId,
        streamArgs: safe,
      }),
    };
  },
});
async function priorUnresolved(ctx: MutationCtx, op: Doc<"chatOperations">) {
  for (const id of op.runIds) {
    const owner = await operationRun(ctx, op, id);
    for (const state of ["sent", "unknown"] as const) {
      const receipt = await ctx.db
        .query("aiAttempts")
        .withIndex("by_runId_and_state", (q) =>
          q.eq("runId", id).eq("state", state),
        )
        .first();
      if (receipt) {
        await generationAttempt(ctx, receipt, owner);
        throw new ConvexError("CHAT_USAGE_RECONCILIATION_REQUIRED");
      }
    }
  }
}
export const send = mutation({
  args: {
    ...target,
    operationKey: v.string(),
    prompt: v.string(),
    allowIdeaCreation: v.boolean(),
    ideaId: v.optional(v.id("ideas")),
  },
  returns: v.id("agentRuns"),
  handler: async (ctx, a) => {
    const { c, user } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
      true,
    );
    key(a.operationKey);
    text(a.prompt, 4000);
    await historyAuthority(ctx, c);
    const fingerprint = await sha256(
      JSON.stringify({
        prompt: a.prompt,
        allowIdeaCreation: a.allowIdeaCreation,
        ideaId: a.ideaId ?? null,
      }),
    );
    const old = await ctx.db
      .query("chatOperations")
      .withIndex("by_conversationId_and_operationKey", (q) =>
        q.eq("conversationId", c._id).eq("operationKey", a.operationKey),
      )
      .unique();
    if (old) {
      if (old.fingerprint !== fingerprint)
        throw new ConvexError("CHAT_OPERATION_CONFLICT");
      return old.runIds[0];
    }
    if (c.activeRunId) {
      const r = await ctx.db.get(c.activeRunId);
      if (r?.state === "ready" || r?.state === "running")
        throw new ConvexError("CHAT_BUSY");
    }
    // ponytail: one bounded conversation supports 50 sends and 10 immutable source versions; start a new conversation beyond that ceiling.
    if (c.turns >= 50) throw new ConvexError("CHAT_CONVERSATION_LIMIT");
    const versions = [...c.ideaVersionIds];
    let inputVersionId: Id<"ideaVersions"> | null = null;
    let context: unknown = null;
    if (a.ideaId) {
      const idea = await ctx.db.get(a.ideaId);
      requireReference(c.workspaceId, idea);
      if (!idea!.currentVersionId || idea!.status === "archived")
        throw new ConvexError("CHAT_SOURCE_UNAVAILABLE");
      inputVersionId = idea!.currentVersionId;
      const version = await ctx.db.get(inputVersionId);
      requireReference(c.workspaceId, version);
      await ideaProofUntil(ctx, version!, undefined, c.accountId);
      if (!versions.includes(inputVersionId)) versions.push(inputVersionId);
      context = {
        title: version!.title,
        userClaims: version!.note,
        interpretation: version!.perspective,
        originalFacts: version!.originals,
        approvedPatchEvidence:
          version!.source.kind === "context"
            ? (await currentContext(ctx, version!.source.contextId, true)).c
                .excerpts
            : null,
      };
    }
    if (versions.length > 10) throw new ConvexError("CHAT_SOURCE_LIMIT");
    const sources: Doc<"agentRuns">["sources"] = [...c.sources];
    for (const id of versions) {
      const version = (await ctx.db.get(id))!;
      for (const s of await currentIdeaSource(
        ctx,
        c.workspaceId,
        version.source,
      ))
        for (const pin of s.ideaVersionId
          ? [s, { ...s, ideaVersionId: id }]
          : [{ ...s, ideaVersionId: id }])
          if (!sources.some((x) => runSourceKey(x) === runSourceKey(pin)))
            sources.push(pin);
    }
    const deadlines = await currentRunSources(
      ctx,
      c.workspaceId,
      c.accountId,
      sources,
    );
    for (let i = 0; i < sources.length; i++)
      sources[i] = { ...sources[i], proofUntil: deadlines[i] };
    sources.splice(
      0,
      sources.length,
      ...new Map(sources.map((s) => [runSourceKey(s), s])).values(),
    );
    if (sources.length > 10) throw new ConvexError("CHAT_SOURCE_LIMIT");
    // Save exactly once in the same transaction as the operation/run binding.
    const prompt =
      a.prompt +
      (context
        ? "\n\nUntrusted selected idea context: " + JSON.stringify(context)
        : "");
    const saved = await saveMessage(ctx, components.agent, {
      threadId: c.threadId,
      userId: user._id,
      message: { role: "user", content: prompt },
    });
    const opId = await ctx.db.insert("chatOperations", {
      workspaceId: c.workspaceId,
      accountId: c.accountId,
      actorId: user._id,
      conversationId: c._id,
      operationKey: a.operationKey,
      fingerprint,
      allowIdeaCreation: a.allowIdeaCreation,
      promptMessageId: saved.messageId,
      runIds: [],
      inputVersionId,
      resultIdeaId: null,
      resultFingerprint: null,
      createdAt: Date.now(),
    });
    const runId = await createRun(ctx, {
      workspaceId: c.workspaceId,
      accountId: c.accountId,
      actorId: user._id,
      purpose: "chat",
      prompt,
      promptVersion: "chat-v1",
      sources,
      conversationId: c._id,
      chatOperationId: opId,
      existingPrompt: { threadId: c.threadId, messageId: saved.messageId },
      inputVersionIds: versions,
    });
    await ctx.db.patch(opId, { runIds: [runId] });
    for (const s of sources)
      if (
        "kind" in s &&
        !c.sources.some((old) => runSourceKey(old) === runSourceKey(s))
      )
        await registerResearchCopies(ctx, s, { conversationId: c._id });
    await ctx.db.patch(c._id, {
      sources,
      ideaVersionIds: versions,
      activeRunId: runId,
      turns: c.turns + 1,
      updatedAt: Date.now(),
    });
    await active(ctx, runId);
    await ctx.scheduler.runAfter(0, internal.ai.provider.execute, { runId });
    return runId;
  },
});
export const resume = mutation({
  args: {
    ...target,
    operationId: v.id("chatOperations"),
    expectedRunId: v.id("agentRuns"),
  },
  returns: v.id("agentRuns"),
  handler: async (ctx, a) => {
    const { c, user } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
      true,
    );
    await historyAuthority(ctx, c);
    const op = await ctx.db.get(a.operationId);
    if (!op || op.conversationId !== c._id || op.actorId !== user._id)
      throw new ConvexError("CHAT_ACCESS_DENIED");
    const latest = op.runIds.at(-1)!;
    if (latest !== a.expectedRunId) {
      const previous = op.runIds.indexOf(a.expectedRunId);
      if (previous >= 0 && op.runIds[previous + 1] === latest) return latest;
      throw new ConvexError("CHAT_RUN_CHANGED");
    }
    const r = await ctx.db.get(latest);
    if (
      !r ||
      (r.state !== "stopped" && r.state !== "failed") ||
      c.activeRunId !== latest
    )
      throw new ConvexError("CHAT_RESUME_UNAVAILABLE");
    await priorUnresolved(ctx, op);
    if (op.runIds.length >= 5) throw new ConvexError("CHAT_CONTINUATION_LIMIT");
    const runId = await createRun(ctx, {
      workspaceId: c.workspaceId,
      accountId: c.accountId,
      actorId: user._id,
      purpose: "chat",
      prompt:
        "Continue the saved operation without repeating completed actions.",
      promptVersion: "chat-v1",
      sources: c.sources,
      conversationId: c._id,
      chatOperationId: op._id,
      existingPrompt: { threadId: c.threadId, messageId: op.promptMessageId },
      inputVersionIds: c.ideaVersionIds,
    });
    await ctx.db.patch(op._id, { runIds: [...op.runIds, runId] });
    await ctx.db.patch(c._id, { activeRunId: runId, updatedAt: Date.now() });
    await active(ctx, runId);
    await ctx.scheduler.runAfter(0, internal.ai.provider.execute, { runId });
    return runId;
  },
});
async function stopCurrent(ctx: MutationCtx, c: Doc<"conversations">) {
  if (c.activeRunId) {
    const r = await ctx.db.get(c.activeRunId);
    if (r && (r.state === "ready" || r.state === "running"))
      await ctx.db.patch(r._id, {
        state: "stopped",
        generation: r.generation + 1,
      });
  }
  await ctx.scheduler.runAfter(0, internal.ai.conversations.abortStreams, {
    conversationId: c._id,
    expectedRunId: c.activeRunId,
  });
}
export const abortStreams = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    expectedRunId: v.union(v.id("agentRuns"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.conversationId);
    if (!c || c.activeRunId !== a.expectedRunId) return null;
    for (const s of await listStreams(ctx, components.agent, {
      threadId: c.threadId,
      includeStatuses: ["streaming"],
    }))
      await ctx.runMutation(components.agent.streams.abort, {
        streamId: s.streamId,
        reason: "Stopped by authorized actor",
      });
    return null;
  },
});
export const stop = mutation({
  args: target,
  returns: v.null(),
  handler: async (ctx, a) => {
    const { c } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
      true,
    );
    await stopCurrent(ctx, c);
    return null;
  },
});
export const remove = mutation({
  args: target,
  returns: v.null(),
  handler: async (ctx, a) => {
    const { c } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
      true,
    );
    if (c.state !== "active") return null;
    await stopCurrent(ctx, c);
    // A separate execution-finished receipt is required before cleanup of an in-flight action.
    const cleanupAfter = Date.now() + 1000;
    await ctx.db.patch(c._id, {
      state: "deleting",
      cleanupAfter,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAt(cleanupAfter, internal.ai.conversations.cleanup, {
      conversationId: c._id,
    });
    return null;
  },
});
export const cleanup = internalMutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.conversationId);
    if (!c || c.state !== "deleting") return null;
    if (Date.now() < c.cleanupAfter) {
      await ctx.scheduler.runAt(
        c.cleanupAfter,
        internal.ai.conversations.cleanup,
        a,
      );
      return null;
    }
    const ops = await ctx.db
      .query("chatOperations")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", c._id),
      )
      .take(50);
    const runs = await Promise.all(
      ops.flatMap((op) => op.runIds).map((id) => ctx.db.get(id)),
    );
    if (runs.some((r) => r?.executionKey && !r.executionFinishedAt)) {
      await ctx.scheduler.runAfter(10000, internal.ai.conversations.cleanup, a);
      return null;
    }
    await ctx.runQuery(components.agent.erasure.listForThread, {
      threadId: c.threadId,
      expectedUserId: String(c.actorId),
      paginationOpts: { numItems: 1, cursor: null },
    });
    const result = await ctx.runMutation(
      components.agent.threads.deleteAllForThreadIdAsync,
      { threadId: c.threadId, limit: 100 },
    );
    if (result.isDone) {
      await ctx.db.patch(c._id, {
        state: "deleted",
        ideaVersionIds: [],
        sources: [],
        title: "Gelöschte Unterhaltung",
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.operations.retention.nativeCleanup,
        { kind: "conversation", id: c._id, phase: -1 },
      );
    } else
      await ctx.scheduler.runAfter(1000, internal.ai.conversations.cleanup, a);
    return null;
  },
});
export const status = query({
  args: target,
  returns: v.array(
    v.object({
      operationId: v.id("chatOperations"),
      runId: v.id("agentRuns"),
      state: v.union(
        v.literal("ready"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("stopped"),
        v.literal("failed"),
      ),
      errorCode: v.union(v.string(), v.null()),
      promptVersion: v.string(),
      policyVersion: v.string(),
      model: v.union(v.string(), v.null()),
      currency: v.union(v.string(), v.null()),
      inputTokens: v.union(v.number(), v.null()),
      outputTokens: v.union(v.number(), v.null()),
      estimatedMicros: v.union(v.number(), v.null()),
      heldMicros: v.number(),
      usagePending: v.boolean(),
      operationUsagePending: v.boolean(),
      resultIdeaId: v.union(v.id("ideas"), v.null()),
    }),
  ),
  handler: async (ctx, a) => {
    const { c } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
    );
    const operations = await ctx.db
      .query("chatOperations")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", c._id),
      )
      .order("desc")
      .take(50);
    let historyReadable = true;
    try {
      await historyAuthority(ctx, c);
    } catch (error) {
      rethrowUnexpectedSourceError(error);
      historyReadable = false;
    }
    const rows = await Promise.all(
      operations.map(async (op) => {
        if (
          op.workspaceId !== c.workspaceId ||
          op.accountId !== c.accountId ||
          op.actorId !== c.actorId
        )
          throw new ConvexError("MODEL_ATTEMPT_OWNER_INVALID");
        const runs = await Promise.all(
          [...op.runIds].reverse().map(async (id) => {
            const r = await operationRun(ctx, op, id);
            const receipts = await ctx.db
              .query("aiAttempts")
              .withIndex("by_runId_and_key", (q) => q.eq("runId", id))
              .take(10);
            return {
              r,
              attempts: await Promise.all(
                receipts.map((a) => generationAttempt(ctx, a, r)),
              ),
            };
          }),
        );
        const operationUsagePending = runs.some((x) =>
          x.attempts.some((a) => a.state !== "settled"),
        );
        return runs.map(({ r, attempts }) => ({
          operationId: op._id,
          runId: r!._id,
          state: r!.state,
          errorCode: r!.errorCode,
          promptVersion: r!.promptVersion,
          policyVersion: r!.policyVersion,
          model: attempts[0]?.model ?? null,
          currency: attempts[0]?.currency ?? null,
          inputTokens:
            attempts.length && attempts.every((x) => x.inputTokens !== null)
              ? attempts.reduce((n, x) => n + x.inputTokens!, 0)
              : null,
          outputTokens:
            attempts.length && attempts.every((x) => x.outputTokens !== null)
              ? attempts.reduce((n, x) => n + x.outputTokens!, 0)
              : null,
          estimatedMicros:
            attempts.length && attempts.every((x) => x.estimatedMicros !== null)
              ? attempts.reduce((n, x) => n + x.estimatedMicros!, 0)
              : null,
          heldMicros: attempts.reduce((n, x) => n + x.heldMicros, 0),
          usagePending: attempts.some((x) => x.state !== "settled"),
          operationUsagePending,
          resultIdeaId: historyReadable ? op.resultIdeaId : null,
        }));
      }),
    );
    return rows.flat();
  },
});
export const createIdea = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    generation: v.number(),
    executionKey: v.string(),
    title: v.string(),
    perspective: v.string(),
    rationale: v.string(),
    questions: v.array(v.string()),
  },
  returns: v.id("ideas"),
  handler: async (ctx, a) => {
    const { r, p } = await active(ctx, a.runId, a.generation, a.executionKey);
    if (!r.chatOperationId) throw new ConvexError("CHAT_RUN_CHANGED");
    const op = (await ctx.db.get(r.chatOperationId))!;
    if (!op.allowIdeaCreation)
      throw new ConvexError("CHAT_IDEA_PERMISSION_REQUIRED");
    text(a.title, 200);
    text(a.perspective, 2000);
    text(a.rationale, 1000);
    if (!a.questions.length || a.questions.length > 5)
      throw new ConvexError("CHAT_INPUT_INVALID");
    for (const q of a.questions) text(q, 300);
    const fingerprint = await sha256(
      JSON.stringify({
        title: a.title,
        perspective: a.perspective,
        rationale: a.rationale,
        questions: a.questions,
      }),
    );
    if (op.resultIdeaId) {
      if (op.resultFingerprint !== fingerprint)
        throw new ConvexError("CHAT_RESULT_ALREADY_CREATED");
      return op.resultIdeaId;
    }
    if (r.toolSteps >= p.maxToolSteps)
      throw new ConvexError("MODEL_TOOL_LIMIT");
    const version = op.inputVersionId
      ? await ctx.db.get(op.inputVersionId)
      : null;
    const source = r.sources.length
      ? { kind: "context-set" as const, sources: r.sources }
      : (version?.source ?? { kind: "note" as const });
    const id = await insertIdea(
      ctx,
      r.workspaceId,
      r.actorId,
      `chat_${op._id}`,
      fingerprint,
      {
        title: a.title,
        perspective: a.perspective,
        note: version?.note ?? "",
        priority: "normal",
        source,
        originals: version?.originals ?? [],
        rationale: a.rationale,
        questions: a.questions,
        runId: r._id,
        ...(version ? { inputVersionId: version._id } : {}),
      },
    );
    await ctx.db.patch(op._id, {
      resultIdeaId: id,
      resultFingerprint: fingerprint,
    });
    await ctx.db.patch(r._id, { toolSteps: r.toolSteps + 1 });
    return id;
  },
});

export const projection = query({
  args: target,
  returns: v.object({ authorized: v.boolean(), proofExpiresAt: v.number() }),
  handler: async (ctx, a) => {
    const { c } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
    );
    try {
      const historyUntil = await historyAuthority(ctx, c);
      let proofExpiresAt = historyUntil ?? Number.MAX_SAFE_INTEGER;
      proofExpiresAt = Math.min(
        proofExpiresAt,
        ...(await currentRunSources(
          ctx,
          c.workspaceId,
          c.accountId,
          c.sources,
        )),
      );
      return { authorized: true, proofExpiresAt };
    } catch (error) {
      rethrowUnexpectedSourceError(error);
      return { authorized: false, proofExpiresAt: 0 };
    }
  },
});

// Explicit domain command; the model cannot acquire research authority from text or a tool call.
export const research = mutation({
  args: {
    ...target,
    profileId: v.id("researchProfiles"),
    expectedRevision: v.number(),
    operationKey: v.string(),
    topic: v.string(),
    language: v.string(),
    operations: v.array(operation),
  },
  returns: v.id("researchOrders"),
  handler: async (ctx, a) => {
    const { c, user } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
      true,
    );
    await historyAuthority(ctx, c);
    key(a.operationKey);
    text(a.topic, 450);
    const { profile } = await currentProfile(ctx, c.workspaceId, a.profileId);
    if (profile.accountId !== c.accountId)
      throw new ConvexError("CHAT_ACCESS_DENIED");
    const old = await ctx.db
      .query("researchOrders")
      .withIndex("by_profileId_and_actorId_and_operationKey", (q) =>
        q
          .eq("profileId", a.profileId)
          .eq("actorId", user._id)
          .eq("operationKey", a.operationKey),
      )
      .unique();
    if (!old) {
      if (c.turns >= 50) throw new ConvexError("CHAT_CONVERSATION_LIMIT");
      if (c.activeRunId) {
        const run = await ctx.db.get(c.activeRunId);
        if (run?.state === "ready" || run?.state === "running")
          throw new ConvexError("CHAT_BUSY");
      }
    }
    const id = await admitPipeline(
      ctx,
      {
        profileId: a.profileId,
        expectedRevision: a.expectedRevision,
        operationKey: a.operationKey,
        language: a.language,
        operations: a.operations,
        targetedChat: {
          conversationId: c._id,
          topic: a.topic,
          messageId: null,
        },
      },
      c.workspaceId,
      user._id,
      "agent",
    );
    if (!old)
      await ctx.db.patch(c._id, { turns: c.turns + 1, updatedAt: Date.now() });
    return id;
  },
});
export const researchResult = internalMutation({
  args: { orderId: v.id("researchOrders") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o = await ctx.db.get(a.orderId);
    if (
      !o?.targetedChat ||
      o.targetedChat.messageId ||
      !o.finishedAt ||
      !o.pipeline
    )
      return null;
    const c = await ctx.db.get(o.targetedChat.conversationId);
    if (
      !c ||
      c.state !== "active" ||
      c.actorId !== o.actorId ||
      c.accountId !== o.accountId ||
      c.workspaceId !== o.workspaceId
    )
      return null;
    try {
      const actor = await ctx.db.get(o.actorId);
      if (!actor) return null;
      requireRole(
        (await requireWorkspace(ctx, c.workspaceId, actor)).membership,
        ["Owner", "Admin", "Editor"],
      );
      await historyAuthority(ctx, c);
    } catch (error) {
      rethrowUnexpectedSourceError(error);
      return null;
    }
    // Wait for every native incarnation, including a stopped older run that can still finish SDK persistence.
    const ops = await ctx.db
      .query("chatOperations")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", c._id),
      )
      .take(50);
    const runs = await Promise.all(
      ops.flatMap((op) => op.runIds).map((id) => ctx.db.get(id)),
    );
    if (
      runs.some(
        (run) =>
          run &&
          (["ready", "running"].includes(run.state) ||
            (run.executionKey && !run.executionFinishedAt)),
      )
    ) {
      await ctx.scheduler.runAfter(
        1000,
        internal.ai.conversations.researchResult,
        a,
      );
      return null;
    }
    let content = `Rechercheauftrag ${o._id}: ${o.pipeline.outcome}. Keine belegte Zusammenfassung verfügbar.`,
      sources = [...c.sources];
    if (
      o.pipeline.inboxReady &&
      o.pipeline.cleanupState === "retained" &&
      o.pipeline.evidenceIds.length
    ) {
      try {
        const proofs = await Promise.all(
          o.pipeline.evidenceIds.map((id) =>
            evidenceSource(ctx, c.workspaceId, id, c.accountId),
          ),
        );
        if (sources.length + proofs.length > 10)
          throw new ConvexError("CHAT_SOURCE_LIMIT");
        content =
          `Rechercheauftrag ${o._id}: ${o.pipeline.outcome}. Ungeprüfte Review; keine Wahrheits- oder Veröffentlichungsfreigabe.\n` +
          proofs.map(researchSummary).join("\n");
        sources.push(...proofs.map((p) => p.source));
      } catch (error) {
        if (!(
          error instanceof ConvexError && error.data === "CHAT_SOURCE_LIMIT"
        ))
          rethrowUnexpectedSourceError(error);
        content = `Rechercheauftrag ${o._id}: Quelle nicht mehr aktuell oder Kontextgrenze erreicht. Keine belegte Zusammenfassung übernommen.`;
      }
    }
    const deadlines = await currentRunSources(
      ctx,
      c.workspaceId,
      c.accountId,
      sources,
    );
    for (let i = 0; i < sources.length; i++)
      sources[i] = { ...sources[i], proofUntil: deadlines[i] };
    sources.splice(
      0,
      sources.length,
      ...new Map(sources.map((s) => [runSourceKey(s), s])).values(),
    );
    const saved = await saveMessage(ctx, components.agent, {
      threadId: c.threadId,
      userId: c.actorId,
      message: { role: "assistant", content },
    });
    await ctx.db.patch(o._id, {
      targetedChat: { ...o.targetedChat, messageId: saved.messageId },
    });
    for (const s of sources)
      if (
        "kind" in s &&
        !c.sources.some((old) => runSourceKey(old) === runSourceKey(s))
      )
        await registerResearchCopies(ctx, s, { conversationId: c._id });
    await ctx.db.patch(c._id, { sources, updatedAt: Date.now() });
    if (sources.some((s) => "kind" in s)) {
      const until = Math.min(
        ...(await currentRunSources(ctx, c.workspaceId, c.accountId, sources)),
      );
      await ctx.scheduler.runAt(until, internal.ai.conversations.expireSource, {
        conversationId: c._id,
      });
    }
    return null;
  },
});
export const expireSource = internalMutation({
  args: { conversationId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.conversationId);
    if (!c || c.state !== "active") return null;
    try {
      await historyAuthority(ctx, c);
      const run = c.activeRunId ? await ctx.db.get(c.activeRunId) : null;
      if (run) await retainedRunProof(ctx, run);
      return null;
    } catch (error) {
      rethrowUnexpectedSourceError(error);
      /* conservative whole-history fence */
    }
    await stopCurrent(ctx, c);
    await ctx.db.patch(c._id, {
      state: "deleting",
      cleanupAfter: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.ai.conversations.cleanup, a);
    return null;
  },
});

export const researchStatus = query({
  args: target,
  returns: v.array(
    v.object({
      orderId: v.id("researchOrders"),
      state: v.string(),
      outcome: v.string(),
      usagePending: v.boolean(),
      messageSaved: v.boolean(),
    }),
  ),
  handler: async (ctx, a) => {
    const { c } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
    );
    const orders = await ctx.db
      .query("researchOrders")
      .withIndex("by_targetedChat_conversationId_and_createdAt", (q) =>
        q.eq("targetedChat.conversationId", c._id),
      )
      .order("desc")
      .take(5);
    return Promise.all(
      orders.map(async (o) => {
        if (
          o.workspaceId !== c.workspaceId ||
          o.accountId !== c.accountId ||
          o.actorId !== c.actorId
        )
          throw new ConvexError("CHAT_ACCESS_DENIED");
        return {
          orderId: o._id,
          state: o.state,
          outcome: o.pipeline?.outcome ?? "pending",
          usagePending: (await orderLiability(ctx, o)).usagePending,
          messageSaved: !!o.targetedChat?.messageId,
        };
      }),
    );
  },
});

// A read-only member may request erasure of their own history after its source fence closes.
export const cleanupUnavailable = mutation({
  args: target,
  returns: v.null(),
  handler: async (ctx, a) => {
    const { c } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
    );
    if (c.state === "active")
      await ctx.runMutation(internal.ai.conversations.expireSource, {
        conversationId: c._id,
      });
    return null;
  },
});

export const attachEvidence = mutation({
  args: {
    ...target,
    evidenceId: v.id("researchEvidence"),
    intent: v.string(),
    operationKey: v.string(),
  },
  returns: v.object({
    conversationId: v.id("conversations"),
    messageId: v.string(),
  }),
  handler: async (ctx, a) => {
    key(a.operationKey);
    text(a.intent, 1000);
    const { c } = await conversationAccess(
      ctx,
      a.workspaceId,
      a.accountId,
      a.conversationId,
      true,
    );
    await historyAuthority(ctx, c);
    const proof = await evidenceSource(
      ctx,
      a.workspaceId,
      a.evidenceId,
      a.accountId,
    );
    const fingerprint = await sha256(
      JSON.stringify([
        a.evidenceId,
        runSourceKey(proof.source, false),
        a.intent.trim(),
      ]),
    );
    const keyed = c.evidenceAttachments?.find(
      (r) => r.operationKey === a.operationKey,
    );
    const prior =
      keyed ??
      c.evidenceAttachments?.find((r) => r.fingerprint === fingerprint);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ConvexError("CHAT_OPERATION_CONFLICT");
      if (!keyed) {
        if ((c.evidenceAttachments?.length ?? 0) >= 50)
          throw new ConvexError("CHAT_TURN_LIMIT");
        await ctx.db.patch(c._id, {
          evidenceAttachments: [
            ...(c.evidenceAttachments ?? []),
            { ...prior, operationKey: a.operationKey },
          ],
        });
      }
      return { conversationId: c._id, messageId: prior.messageId };
    }
    const ops = await ctx.db
      .query("chatOperations")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", c._id),
      )
      .take(50);
    for (const op of ops)
      for (const id of op.runIds) {
        const run = await ctx.db.get(id);
        if (
          run &&
          (["ready", "running"].includes(run.state) ||
            (run.executionKey && !run.executionFinishedAt))
        )
          throw new ConvexError("CHAT_NATIVE_EXECUTION_PENDING");
      }
    if ((c.evidenceAttachments?.length ?? 0) >= 50)
      throw new ConvexError("CHAT_TURN_LIMIT");
    const sources = [...c.sources];
    const existing = sources.findIndex(
      (s) => runSourceKey(s, false) === runSourceKey(proof.source, false),
    );
    if (existing < 0) sources.push(proof.source);
    else
      sources[existing] = {
        ...sources[existing],
        proofUntil: Math.min(
          sources[existing].proofUntil ?? proof.proofUntil,
          proof.proofUntil,
        ),
      };
    if (sources.length > 10) throw new ConvexError("CHAT_SOURCE_LIMIT");
    const deadlines = await currentRunSources(
      ctx,
      c.workspaceId,
      c.accountId,
      sources,
    );
    for (let i = 0; i < sources.length; i++)
      sources[i] = { ...sources[i], proofUntil: deadlines[i] };
    const saved = await saveMessage(ctx, components.agent, {
      threadId: c.threadId,
      userId: c.actorId,
      message: {
        role: "assistant",
        content: `Ungeprüfte Review; keine Wahrheits- oder Veröffentlichungsfreigabe. Auftrag: ${a.intent.trim()}\n${researchSummary(proof)}`,
      },
    });
    await registerResearchCopies(ctx, proof.source, { conversationId: c._id });
    await ctx.db.patch(c._id, {
      sources,
      updatedAt: Date.now(),
      evidenceAttachments: [
        ...(c.evidenceAttachments ?? []),
        {
          operationKey: a.operationKey,
          fingerprint,
          messageId: saved.messageId,
        },
      ],
    });
    await ctx.scheduler.runAt(
      Math.min(...deadlines),
      internal.ai.conversations.expireSource,
      { conversationId: c._id },
    );
    return { conversationId: c._id, messageId: saved.messageId };
  },
});

function researchSummary({ e, s }: Awaited<ReturnType<typeof evidenceSource>>) {
  const p = e.payload!;
  return JSON.stringify({
    evidenceId: e._id,
    source: s.url,
    sourceSupport:
      s.text === null
        ? "metadata only; cannot support factual claims"
        : "unverified source text",
    sourceAssertion: p.annotation.claim,
    literalQuote: p.annotation.quote,
    interpretation: p.annotation.interpretation,
    perspective: p.model?.perspective ?? null,
    gaps: p.annotation.gaps,
    uncertainty: p.annotation.uncertainty,
    publication: s.publishedAt ?? "unknown",
    event: p.model?.eventAt ?? "unknown",
    observedAt: s.observedAt,
  });
}
