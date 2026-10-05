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
import { conversationAccess, historyAuthority } from "./conversationAccess";
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
    } catch {
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
  for (const id of op.runIds)
    for (const state of ["sent", "unknown"] as const)
      if (
        await ctx.db
          .query("aiAttempts")
          .withIndex("by_runId_and_state", (q) =>
            q.eq("runId", id).eq("state", state),
          )
          .first()
      )
        throw new ConvexError("CHAT_USAGE_RECONCILIATION_REQUIRED");
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
      await currentIdeaSource(ctx, c.workspaceId, version!.source);
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
    const sources: Doc<"agentRuns">["sources"] = [];
    for (const id of versions) {
      const version = (await ctx.db.get(id))!;
      for (const s of await currentIdeaSource(
        ctx,
        c.workspaceId,
        version.source,
      ))
        if (!sources.some((x) => JSON.stringify(x) === JSON.stringify(s)))
          sources.push(s);
    }
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
    });
    await ctx.db.patch(opId, { runIds: [runId] });
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
    const result = await ctx.runMutation(
      components.agent.threads.deleteAllForThreadIdAsync,
      { threadId: c.threadId, limit: 100 },
    );
    if (result.isDone)
      await ctx.db.patch(c._id, {
        state: "deleted",
        ideaVersionIds: [],
        sources: [],
        title: "Gelöschte Unterhaltung",
        updatedAt: Date.now(),
      });
    else
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
    const rows = await Promise.all(
      operations.map(async (op) => {
        const runs = await Promise.all(
          [...op.runIds].reverse().map(async (id) => ({
            r: (await ctx.db.get(id))!,
            attempts: (
              await ctx.db
                .query("aiAttempts")
                .withIndex("by_runId_and_key", (q) => q.eq("runId", id))
                .take(10)
            ).map((attempt) => {
              if (
                attempt.owner === "native-search" ||
                attempt.researchOrderId ||
                attempt.logicalIntent ||
                attempt.workspaceId !== c.workspaceId
              )
                throw new ConvexError("MODEL_ATTEMPT_OWNER_INVALID");
              return attempt;
            }),
          })),
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
          resultIdeaId: op.resultIdeaId,
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
        source: version?.source ?? { kind: "note" },
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
      await historyAuthority(ctx, c);
      let proofExpiresAt = Number.MAX_SAFE_INTEGER;
      for (const s of c.sources) {
        const repo = await ctx.db.get(s.repositoryId);
        if (!repo) throw new ConvexError("CHAT_HISTORY_SOURCE_WITHDRAWN");
        proofExpiresAt = Math.min(proofExpiresAt, repo.proofExpiresAt);
      }
      return { authorized: true, proofExpiresAt };
    } catch {
      return { authorized: false, proofExpiresAt: 0 };
    }
  },
});
