import { ConvexError, v, type Infer, type Validator } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  requireReference,
  requireRole,
  requireWorkspace,
  workspaceQuery,
} from "../lib/authorization";
import {
  EXPORT_PAGE_CANDIDATES,
  EXPORT_PAGE_MAX_BYTES,
  exportRowsOverBudget,
  numeric,
  proofContext,
} from "./exportShared";
import { role } from "../schema";
import {
  conversationAccess,
  historyAuthority,
  operationRun,
} from "../ai/conversationAccess";
import { retainedRunProof } from "../ai/sourceAccess";
import {
  ideaProofUntil,
  draftResearchProof,
  researchSourceProof,
} from "../research/contentProof";
import { currentMaterialProof } from "../research/pipelineAccess";
import { sourceAuthority } from "../research/providerAccess";
import { currentEvidence, deliveredSource } from "../research/evidence";
import { operation, resultState } from "../research/providerFields";
import {
  automaticOption,
  handoffResults,
  automaticHandoff,
} from "../research/pipelineFields";
import { config, orderFields } from "../research/fields";
import {
  annotation,
  assessment,
  evidenceFields,
} from "../research/evidenceFields";

const correlation = {
  expectedAuthId: v.string(),
  expectedSessionId: v.string(),
  requestKey: v.string(),
};
const paging = { cursor: v.union(v.string(), v.null()) };
const bounded = {
  ...paging,
  selectionUpperBound: v.union(v.number(), v.null()),
};
const own = {
  accountId: v.id("socialAccounts"),
  conversationId: v.id("conversations"),
};
const order = { orderId: v.id("researchOrders") };
type Context = QueryCtx & Awaited<ReturnType<typeof requireWorkspace>>;
function binding(ok: unknown): asserts ok {
  if (!ok) throw new ConvexError("REFERENCE_ACCESS_DENIED");
}
function unavailable(): never {
  throw new ConvexError("EXPORT_SOURCE_UNAVAILABLE");
}
const conversationRow = v.object({
  conversationId: v.id("conversations"),
  accountId: v.id("socialAccounts"),
  createdAt: v.number(),
  title: v.string(),
  revision: v.number(),
  updatedAt: v.number(),
  turns: v.number(),
  state: v.literal("active"),
});
const messageRow = v.object({
  conversationId: v.optional(v.id("conversations")),
  orderId: v.optional(v.id("researchOrders")),
  messageId: v.string(),
  _creationTime: v.number(),
  order: v.number(),
  stepOrder: v.number(),
  status: v.union(
    v.literal("pending"),
    v.literal("success"),
    v.literal("failed"),
  ),
  role: v.union(v.literal("user"), v.literal("assistant")),
  text: v.string(),
});
const operationRow = v.object({
  operationId: v.id("chatOperations"),
  conversationId: v.id("conversations"),
  createdAt: v.number(),
  allowIdeaCreation: v.boolean(),
  inputVersionId: v.union(v.id("ideaVersions"), v.null()),
  resultIdeaId: v.union(v.id("ideas"), v.null()),
});
const runRow = v.object({
  runId: v.id("agentRuns"),
  operationId: v.id("chatOperations"),
  purpose: v.literal("chat"),
  state: v.string(),
  createdAt: v.number(),
  deadline: v.number(),
  executionFinishedAt: v.optional(v.number()),
  policyVersion: v.string(),
  promptVersion: v.string(),
  attempts: v.number(),
  toolSteps: v.number(),
});
const orderRow = v.object({
  orderId: v.id("researchOrders"),
  accountId: v.id("socialAccounts"),
  profileId: v.id("researchProfiles"),
  profileVersionId: v.id("researchProfileVersions"),
  occasion: orderFields.occasion,
  state: orderFields.state,
  generation: v.number(),
  createdAt: v.number(),
  finishedAt: orderFields.finishedAt,
  windowStart: v.number(),
  windowEnd: v.number(),
  deadline: v.number(),
  occurrence: orderFields.occurrence,
  config: v.optional(config),
  query: v.optional(v.string()),
  topic: v.optional(v.string()),
  language: v.optional(v.string()),
  operations: v.optional(v.array(operation)),
  outcomes: v.optional(
    v.array(v.object({ operation, state: resultState, cacheHit: v.boolean() })),
  ),
  reResearch: v.optional(
    v.object({
      topic: v.string(),
      parentEvidenceId: v.id("researchEvidence"),
      parentOrderId: v.id("researchOrders"),
      parentSourceId: v.id("researchSources"),
    }),
  ),
  automaticHandoff: v.optional(
    v.object({
      activationGeneration: v.number(),
      profileVersionId: v.id("researchProfileVersions"),
      option: automaticOption,
      state: automaticHandoff.fields.state,
      selection: automaticHandoff.fields.selection,
      results: v.optional(handoffResults),
    }),
  ),
});
const sourceRow = v.object({
  sourceId: v.id("researchSources"),
  operation,
  url: v.union(v.string(), v.null()),
  title: v.union(v.string(), v.null()),
  text: v.union(v.string(), v.null()),
  publishedAt: v.union(v.number(), v.null()),
  count: v.union(v.number(), v.null()),
  observedAt: v.number(),
  minusableUntil: v.number(),
});
const evidenceRow = v.object({
  evidenceId: v.id("researchEvidence"),
  actorId: v.optional(evidenceFields.actorId),
  annotationActorId: v.optional(evidenceFields.annotationActorId),
  orderId: v.id("researchOrders"),
  sourceId: v.id("researchSources"),
  observedAt: v.number(),
  sourceGeneration: v.number(),
  parentEvidenceId: evidenceFields.parentEvidenceId,
  perspective: evidenceFields.payload.members[0].fields.perspective,
  inboxRevision: evidenceFields.inboxRevision,
  inboxDisposition: evidenceFields.inboxDisposition,
  inboxActorId: evidenceFields.inboxActorId,
  createdAt: v.number(),
  annotation,
  model: v.optional(evidenceFields.payload.members[0].fields.model),
  assessment: v.optional(assessment),
  promptVersion: v.optional(v.string()),
  policyVersion: v.optional(v.string()),
  minretentionUntil: v.number(),
});
const stepRow = v.object({
  orderId: v.id("researchOrders"),
  stepNumber: v.number(),
  stage: v.string(),
  kind: v.literal("function"),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  resultKind: v.union(
    v.literal("success"),
    v.literal("failed"),
    v.literal("canceled"),
    v.literal("pending"),
  ),
});
function envelope<F extends string, T extends Validator<any, any, any>>(
  family: F,
  row: T,
) {
  return v.object({
    authId: v.string(),
    sessionId: v.string(),
    requestKey: v.string(),
    workspaceId: v.id("workspaces"),
    role,
    observedAt: v.number(),
    proofValidUntil: v.number(),
    selectionUpperBound: v.union(v.number(), v.null()),
    cursor: v.string(),
    isDone: v.boolean(),
    nextOffset: v.optional(v.number()),
    accountId: v.optional(v.id("socialAccounts")),
    conversationId: v.optional(v.id("conversations")),
    profileId: v.optional(v.id("researchProfiles")),
    orderId: v.optional(v.id("researchOrders")),
    operationId: v.optional(v.id("chatOperations")),
    operation: v.optional(operation),
    data: v.object({
      format: v.literal("dispatch-workspace-private"),
      version: v.literal(1),
      workspaceId: v.id("workspaces"),
      selection: v.object({ family: v.literal(family), rows: v.array(row) }),
    }),
  });
}
async function begin(
  original: Context,
  a: Infer<typeof vCorrelation> & {
    cursor?: string | null;
    selectionUpperBound?: number | null;
  },
) {
  const sessionId = (await original.auth.getUserIdentity())?.sessionId;
  if (typeof sessionId !== "string" || !sessionId)
    throw new ConvexError("Unauthenticated");
  if (
    !a.expectedAuthId ||
    a.expectedAuthId.length > 256 ||
    !a.expectedSessionId ||
    a.expectedSessionId.length > 256 ||
    !a.requestKey ||
    a.requestKey.length > 64
  )
    throw new ConvexError("EXPORT_REQUEST_INVALID");
  if (
    a.expectedAuthId !== original.user.authId ||
    a.expectedSessionId !== sessionId ||
    original.user.activeWorkspaceId !== original.workspace._id
  )
    throw new ConvexError("EXPORT_SCOPE_CHANGED");
  const observedAt = Date.now();
  numeric(observedAt);
  if (
    observedAt < 0 ||
    (a.cursor !== undefined &&
      a.cursor !== null &&
      (!a.cursor || a.cursor.length > 16384))
  )
    throw new ConvexError("EXPORT_REQUEST_INVALID");
  let selectionUpperBound: number | null = null;
  if ("selectionUpperBound" in a) {
    const bound = a.selectionUpperBound;
    if (
      (a.cursor === null) !== (bound === null) ||
      (bound !== null &&
        (bound === undefined ||
          !Number.isFinite(bound) ||
          Object.is(bound, -0) ||
          bound < 0 ||
          bound > observedAt))
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    selectionUpperBound = bound ?? observedAt;
  }
  const ctx = proofContext(original, original.workspace._id);
  let proofValidUntil = observedAt + 30000;
  let retainedUntil: number | null = null;
  const horizon = (until: number | null | undefined) => {
    if (until == null) return;
    numeric(until);
    if (until <= observedAt) unavailable();
    proofValidUntil = Math.min(proofValidUntil, until);
    retainedUntil = Math.min(retainedUntil ?? until, until);
  };
  return {
    ctx,
    original,
    horizon,
    selectionUpperBound,
    get retainedUntil() {
      return retainedUntil;
    },
    finish<F extends string, R>(
      family: F,
      rows: R[],
      page: { continueCursor: string; isDone: boolean },
      selectors: Partial<{
        accountId: Id<"socialAccounts">;
        conversationId: Id<"conversations">;
        profileId: Id<"researchProfiles">;
        orderId: Id<"researchOrders">;
        operationId: Id<"chatOperations">;
        operation: Infer<typeof operation>;
        nextOffset: number;
      }> = {},
    ) {
      const result = {
        authId: original.user.authId,
        sessionId,
        requestKey: a.requestKey,
        workspaceId: original.workspace._id,
        role: original.membership.role,
        observedAt,
        proofValidUntil,
        selectionUpperBound,
        cursor: page.continueCursor,
        isDone: page.isDone,
        ...selectors,
        data: {
          format: "dispatch-workspace-private" as const,
          version: 1 as const,
          workspaceId: original.workspace._id,
          selection: { family, rows },
        },
      };
      numeric(result);
      const now = Date.now();
      numeric(now);
      if (
        now < observedAt ||
        proofValidUntil <= now ||
        new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
      )
        throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
      return result;
    },
  };
}
const vCorrelation = v.object(correlation);
type Read = Awaited<ReturnType<typeof begin>>;
async function conversation(s: Read, a: Infer<typeof vOwn>) {
  const { c } = await conversationAccess(
    s.ctx,
    s.original.workspace._id,
    a.accountId,
    a.conversationId,
  );
  s.horizon(await historyAuthority(s.ctx, c));
  return c;
}
const vOwn = v.object(own);
async function operationProof(
  s: Read,
  c: Doc<"conversations">,
  op: Doc<"chatOperations">,
  discovery = false,
) {
  binding(
    op.workspaceId === c.workspaceId &&
      op.accountId === c.accountId &&
      op.actorId === c.actorId &&
      op.conversationId === c._id,
  );
  const versions: Doc<"ideaVersions">[] = [];
  let withdrawn = false,
    run: Doc<"agentRuns"> | undefined;
  if (op.inputVersionId) {
    const ver = await s.ctx.db.get(op.inputVersionId);
    binding(ver);
    const root = await s.ctx.db.get(ver.ideaId);
    binding(root);
    withdrawn = root.status === "archived";
    versions.push(ver);
  }
  if (op.resultIdeaId) {
    const idea = await s.ctx.db.get(op.resultIdeaId);
    binding(
      idea &&
        idea.currentVersionId &&
        idea.actorId === op.actorId &&
        idea.operationKey === `chat_${op._id}` &&
        idea.fingerprint === op.resultFingerprint,
    );
    const original = await s.ctx.db
      .query("ideaVersions")
      .withIndex("by_ideaId_and_number", (q) =>
        q.eq("ideaId", idea._id).eq("number", 1),
      )
      .unique();
    binding(
      original &&
        original.ideaId === idea._id &&
        original.runId &&
        (original.inputVersionId ?? null) === op.inputVersionId,
    );
    run = await operationRun(s.ctx, op, original.runId);
    const current = await s.ctx.db.get(idea.currentVersionId);
    binding(current && current.ideaId === idea._id);
    withdrawn ||= idea.status === "archived";
    versions.push(original, current);
  }
  // Exact native bindings above remain mandatory even for a withdrawn candidate.
  withdrawn ||= versions.some(
    (ver) =>
      ver.sourceUnavailable ||
      (ver.researchProofUntil !== undefined &&
        ver.researchProofUntil <= Date.now()),
  );
  if (withdrawn) {
    if (discovery) return false;
    unavailable();
  }
  if (run)
    s.horizon(await retainedRunProof(s.ctx, run, undefined, c.accountId));
  for (const ver of versions)
    s.horizon(await ideaProofUntil(s.ctx, ver, undefined, c.accountId));
  return true;
}

export const conversations = workspaceQuery({
  args: { ...correlation, accountId: own.accountId, ...bounded },
  returns: envelope("conversations", conversationRow),
  handler: async (original, a) => {
    const s = await begin(original, a);
    requireReference(original.workspace._id, await s.ctx.db.get(a.accountId));
    const rows: Infer<typeof conversationRow>[] = [];
    const p = await s.ctx.db
      .query("conversations")
      .withIndex("by_workspaceId_and_accountId_and_actorId", (q) =>
        q
          .eq("workspaceId", original.workspace._id)
          .eq("accountId", a.accountId)
          .eq("actorId", original.user._id)
          .lte("_creationTime", s.selectionUpperBound!),
      )
      .order("asc")
      .paginate({
        numItems: EXPORT_PAGE_CANDIDATES,
        cursor: a.cursor,
        maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
      });
    for (const c of p.page) {
      binding(c.accountId === a.accountId && c.actorId === original.user._id);
      if (c.state !== "active") continue;
      binding(c.ideaVersionIds.length <= 10 && c.sources.length <= 10);
      let withdrawn = false;
      for (const pin of c.sources) {
        if ("kind" in pin) {
          const evidence = await s.ctx.db.get(pin.evidenceId),
            source = await s.ctx.db.get(pin.sourceId),
            order = await s.ctx.db.get(pin.orderId);
          binding(
            pin.accountId === c.accountId &&
              evidence &&
              source &&
              order &&
              evidence.accountId === c.accountId &&
              source.accountId === c.accountId &&
              order.accountId === c.accountId &&
              evidence.orderId === order._id &&
              evidence.sourceId === source._id &&
              evidence.fingerprint === pin.evidenceFingerprint &&
              evidence.materialHash === pin.materialHash &&
              evidence.sourceGeneration === pin.sourceGeneration,
          );
          withdrawn ||=
            evidence.state === "removed" ||
            !evidence.payload ||
            source.status !== "usable" ||
            evidence.retentionUntil <= Date.now() ||
            source.usableUntil <= Date.now() ||
            pin.proofUntil <= Date.now() ||
            (order.pipeline !== undefined &&
              order.pipeline.cleanupState !== "retained");
        } else {
          const repository = await s.ctx.db.get(pin.repositoryId);
          binding(repository);
          if (pin.contextId) {
            const context = await s.ctx.db.get(pin.contextId);
            binding(
              context &&
                context.repositoryId === repository._id &&
                (!pin.signalId || context.signalId === pin.signalId),
            );
          }
          if (pin.signalId) {
            const signal = await s.ctx.db.get(pin.signalId);
            binding(signal && signal.repositoryId === repository._id);
          }
          withdrawn ||=
            !repository.selected ||
            !repository.access ||
            !repository.monitoring ||
            !repository.content ||
            repository.proofExpiresAt <= Date.now() ||
            (pin.proofUntil !== undefined && pin.proofUntil <= Date.now());
        }
      }
      for (const id of new Set([
        ...c.ideaVersionIds,
        ...c.sources.flatMap((pin) =>
          pin.ideaVersionId ? [pin.ideaVersionId] : [],
        ),
      ])) {
        const version = await s.ctx.db.get(id);
        binding(version);
        const idea = await s.ctx.db.get(version.ideaId);
        binding(
          idea &&
            (!version.candidate ||
              version.candidate.content.accountId === c.accountId),
        );
        withdrawn ||=
          version.sourceUnavailable === true ||
          idea.status === "archived" ||
          (version.researchProofUntil !== undefined &&
            version.researchProofUntil <= Date.now());
      }
      if (withdrawn) continue;
      await conversation(s, {
        accountId: a.accountId,
        conversationId: c._id,
      });
      rows.push({
        conversationId: c._id,
        accountId: c.accountId,
        createdAt: c._creationTime,
        title: c.title,
        revision: c.revision,
        updatedAt: c.updatedAt,
        turns: c.turns,
        state: c.state,
      });
    }
    return s.finish("conversations", rows, p, {
      accountId: a.accountId,
    });
  },
});
async function messages(
  s: Read,
  threadId: string,
  actorId: Id<"users">,
  cursor: string | null,
  research = false,
) {
  const thread = await s.ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  binding(thread && thread.userId === actorId);
  let fetchCursor: string | null = cursor;
  let selected: { continueCursor: string; isDone: boolean } | null = null;
  const rows: Omit<Infer<typeof messageRow>, "conversationId" | "orderId">[] =
    [];
  for (
    let candidates = 0;
    candidates < EXPORT_PAGE_CANDIDATES && !selected?.isDone;
    candidates++
  ) {
    const prior = selected;
    const mark = rows.length;
    const p = await s.ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId,
        order: "asc",
        paginationOpts: { numItems: 1, cursor: fetchCursor },
      },
    );
    fetchCursor = p.continueCursor;
    selected = p;
    for (const m of p.page) {
      numeric(m);
      binding(m.threadId === threadId && (!m.userId || m.userId === actorId));
      const role = m.message?.role;
      if (
        (role !== "user" && role !== "assistant") ||
        (research && role !== "assistant")
      )
        continue;
      const content = m.message!.content;
      const text =
        typeof content === "string"
          ? content
          : content
              .filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join("");
      if (!text) continue;
      rows.push({
        messageId: m._id,
        _creationTime: m._creationTime,
        order: m.order,
        stepOrder: m.stepOrder,
        status: m.status,
        role,
        text,
      });
    }
    if (mark > 0 && rows.length > mark && exportRowsOverBudget(rows)) {
      // Leave this candidate for the next page; the cursor stays at the last kept row.
      while (rows.length > mark) rows.pop();
      selected = prior;
      break;
    }
  }
  return { p: selected!, rows };
}
export const conversationMessages = workspaceQuery({
  args: { ...correlation, ...own, ...paging },
  returns: envelope("conversationMessages", messageRow),
  handler: async (original, a) => {
    const s = await begin(original, a),
      c = await conversation(s, a),
      { p, rows } = await messages(s, c.threadId, c.actorId, a.cursor);
    return s.finish(
      "conversationMessages",
      rows.map((r) => ({ ...r, conversationId: c._id })),
      p,
      { accountId: a.accountId, conversationId: a.conversationId },
    );
  },
});
export const conversationOperations = workspaceQuery({
  args: { ...correlation, ...own, ...bounded },
  returns: envelope("conversationOperations", operationRow),
  handler: async (original, a) => {
    const s = await begin(original, a),
      c = await conversation(s, a);
    const rows: Infer<typeof operationRow>[] = [];
    const p = await s.ctx.db
      .query("chatOperations")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", c._id).lte("createdAt", s.selectionUpperBound!),
      )
      .order("asc")
      .paginate({
        numItems: EXPORT_PAGE_CANDIDATES,
        cursor: a.cursor,
        maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
      });
    for (const op of p.page) {
      if (!(await operationProof(s, c, op, true))) continue;
      rows.push({
        operationId: op._id,
        conversationId: c._id,
        createdAt: op.createdAt,
        allowIdeaCreation: op.allowIdeaCreation,
        inputVersionId: op.inputVersionId,
        resultIdeaId: op.resultIdeaId,
      });
    }
    return s.finish("conversationOperations", rows, p, {
      accountId: a.accountId,
      conversationId: a.conversationId,
    });
  },
});
function offset(n: number) {
  if (!Number.isSafeInteger(n) || Object.is(n, -0) || n < 0 || n > 1000)
    throw new ConvexError("EXPORT_REQUEST_INVALID");
}
export const conversationRuns = workspaceQuery({
  args: {
    ...correlation,
    ...own,
    operationId: v.id("chatOperations"),
    offset: v.number(),
  },
  returns: envelope("conversationRuns", runRow),
  handler: async (original, a) => {
    const s = await begin(original, a);
    offset(a.offset);
    const c = await conversation(s, a),
      op = await s.ctx.db.get(a.operationId);
    binding(op);
    await operationProof(s, c, op);
    binding(op.runIds.length <= 1000);
    const rows: Infer<typeof runRow>[] = [];
    const id = op.runIds[a.offset];
    if (id) {
      const r = await operationRun(s.ctx, op, id);
      s.horizon(await retainedRunProof(s.ctx, r, undefined, c.accountId));
      rows.push({
        runId: r._id,
        operationId: op._id,
        purpose: "chat",
        state: r.state,
        createdAt: r.createdAt,
        deadline: r.deadline,
        executionFinishedAt: r.executionFinishedAt,
        policyVersion: r.policyVersion,
        promptVersion: r.promptVersion,
        attempts: r.attempts,
        toolSteps: r.toolSteps,
      });
    }
    return s.finish(
      "conversationRuns",
      rows,
      {
        continueCursor: String(a.offset + 1),
        isDone: a.offset + 1 >= op.runIds.length,
      },
      {
        accountId: a.accountId,
        conversationId: c._id,
        operationId: op._id,
        nextOffset: a.offset + 1,
      },
    );
  },
});
async function orderOwner(s: Read, id: Id<"researchOrders">) {
  const o = await s.ctx.db.get(id);
  binding(o);
  if (o.targetedChat) {
    binding(o.actorId === s.original.user._id);
    await conversation(s, {
      accountId: o.accountId,
      conversationId: o.targetedChat.conversationId,
    });
  } else requireRole(s.original.membership, ["Owner", "Admin"]);
  requireReference(o.workspaceId, await s.ctx.db.get(o.accountId));
  const profile = await s.ctx.db.get(o.profileId),
    version = await s.ctx.db.get(o.profileVersionId);
  binding(
    profile &&
      version &&
      profile.accountId === o.accountId &&
      version.profileId === profile._id,
  );
  // Only retention scrubbing rewrites an order's config snapshot after creation.
  if (JSON.stringify(version.config) !== JSON.stringify(o.config))
    unavailable();
  if (profile.deleted || profile.paused) unavailable();
  return o;
}
async function material(s: Read, o: Doc<"researchOrders">) {
  if (!o.native) unavailable();
  if (
    o.pipeline &&
    (o.pipeline.cleanupState !== "retained" ||
      (o.pipeline.retentionUntil !== null &&
        o.pipeline.retentionUntil <= Date.now()))
  )
    unavailable();
  const n = o.native;
  binding(
    n.operations.length > 0 &&
      n.operations.length <= 3 &&
      new Set(n.operations).size === n.operations.length &&
      n.approvals.length === n.operations.length &&
      n.cacheIds.length === n.operations.length &&
      n.outcomes.length === n.operations.length,
  );
  for (const op of n.operations) {
    const { p, captured } = await sourceAuthority(s.ctx, o, op);
    s.horizon(p.expiresAt);
    s.horizon(p.lifecycleValidUntil);
    for (const id of captured.budgetIds) {
      const b = await s.ctx.db.get(id);
      binding(b);
      s.horizon(b.expiresAt);
    }
  }
  if (o.pipeline) s.horizon((await currentMaterialProof(s.ctx, o)).proofUntil);
}
async function automaticProof(s: Read, o: Doc<"researchOrders">) {
  const a = o.automaticHandoff;
  if (!a) return undefined;
  binding(
    a.actorId === o.actorId &&
      a.profileVersionId === o.profileVersionId &&
      Number.isSafeInteger(a.activationGeneration) &&
      a.activationGeneration > 0 &&
      Number.isSafeInteger(a.option.count) &&
      a.option.count >= 1 &&
      a.option.count <= 5 &&
      JSON.stringify(a.option) === JSON.stringify(o.config.autoHandoff),
  );
  const selection = a.selection ?? [],
    results = a.results ?? [];
  binding(
    selection.length <= a.option.count &&
      new Set(selection).size === selection.length &&
      results.length <= a.option.count &&
      (a.state === "completed"
        ? selection.length > 0 && results.length === selection.length
        : !a.selection && !a.results),
  );
  for (const id of selection) {
    const e = await currentEvidence(s.ctx, o.workspaceId, id, o.accountId);
    binding(e.e.orderId === o._id);
    s.horizon(e.proofUntil);
  }
  if (a.state === "completed") {
    const receipt = await s.ctx.db
      .query("researchContentHandoffs")
      .withIndex("by_workspaceId_and_actorId_and_commandKey", (q) =>
        q
          .eq("workspaceId", o.workspaceId)
          .eq("actorId", a.actorId)
          .eq("commandKey", `automatic_${o._id}`),
      )
      .unique();
    binding(
      receipt &&
        receipt.accountId === o.accountId &&
        receipt.count === a.option.count &&
        receipt.target === a.option.target &&
        JSON.stringify(receipt.selection) === JSON.stringify(selection) &&
        JSON.stringify(receipt.results) === JSON.stringify(results),
    );
  }
  for (const [i, r] of results.entries()) {
    const idea = await s.ctx.db.get(r.ideaId),
      ver = await s.ctx.db.get(r.ideaVersionId);
    binding(
      idea &&
        ver &&
        idea.actorId === a.actorId &&
        ver.actorId === a.actorId &&
        ver.ideaId === idea._id &&
        ver.source.kind === "research" &&
        ver.source.orderId === o._id &&
        ver.source.evidenceId === selection[i] &&
        ver.source.accountId === o.accountId &&
        idea.currentVersionId,
    );
    if (idea.status === "archived" || ver.sourceUnavailable) unavailable();
    s.horizon(ver.researchProofUntil);
    s.horizon(await ideaProofUntil(s.ctx, ver, undefined, o.accountId));
    const current = await s.ctx.db.get(idea.currentVersionId);
    binding(current && current.ideaId === idea._id);
    if (current.sourceUnavailable) unavailable();
    s.horizon(current.researchProofUntil);
    s.horizon(await ideaProofUntil(s.ctx, current, undefined, o.accountId));
    binding(
      a.option.target === "draft"
        ? r.draftId && r.draftVersionId
        : !r.draftId && !r.draftVersionId,
    );
    if (r.draftId && r.draftVersionId) {
      const draft = await s.ctx.db.get(r.draftId),
        version = await s.ctx.db.get(r.draftVersionId);
      binding(
        draft &&
          version &&
          version.draftId === draft._id &&
          version.ideaVersionId === ver._id &&
          version.content.accountId === o.accountId &&
          draft.currentVersionId,
      );
      if (version.sourceUnavailable) unavailable();
      s.horizon(version.researchProofUntil);
      s.horizon(await draftResearchProof(s.ctx, version));
      const current = await s.ctx.db.get(draft.currentVersionId);
      binding(
        current &&
          current.draftId === draft._id &&
          current.content.accountId === o.accountId,
      );
      if (current.sourceUnavailable) unavailable();
      s.horizon(current.researchProofUntil);
      s.horizon(await draftResearchProof(s.ctx, current));
    }
  }
  return {
    activationGeneration: a.activationGeneration,
    profileVersionId: a.profileVersionId,
    option: a.option,
    state: a.state,
    selection: a.selection,
    results: a.results,
  };
}
async function projectOrder(
  s: Read,
  o: Doc<"researchOrders">,
): Promise<Infer<typeof orderRow>> {
  const header = {
    orderId: o._id,
    accountId: o.accountId,
    profileId: o.profileId,
    profileVersionId: o.profileVersionId,
    occasion: o.occasion,
    state: o.state,
    generation: o.generation,
    createdAt: o.createdAt,
    finishedAt: o.finishedAt,
    windowStart: o.windowStart,
    windowEnd: o.windowEnd,
    deadline: o.deadline,
    occurrence: o.occurrence,
  };
  if (!o.native && o.state === "blocked")
    return { ...header, config: o.config };
  await material(s, o);
  if (o.reResearch) {
    binding(o.reResearch.parent.accountId === o.accountId);
    await orderOwner(s, o.reResearch.parent.orderId);
    s.horizon(
      await researchSourceProof(s.ctx, o.workspaceId, o.reResearch.parent),
    );
  }
  const automatic = await automaticProof(s, o);
  return {
    ...header,
    language: o.native!.language,
    operations: o.native!.operations,
    outcomes: o.native!.outcomes.map((r, i) => ({
      operation: o.native!.operations[i],
      state: r.state,
      cacheHit: r.cacheHit,
    })),
    ...(o.reResearch
      ? {
          reResearch: {
            topic: o.reResearch.topic,
            parentEvidenceId: o.reResearch.parent.evidenceId,
            parentOrderId: o.reResearch.parent.orderId,
            parentSourceId: o.reResearch.parent.sourceId,
          },
        }
      : {}),
    ...(automatic ? { automaticHandoff: automatic } : {}),
    config: o.config,
    query: o.native!.query,
    ...(o.targetedChat ? { topic: o.targetedChat.topic } : {}),
  };
}
export const targetedOrders = workspaceQuery({
  args: { ...correlation, ...own, ...bounded },
  returns: envelope("targetedOrders", orderRow),
  handler: async (original, a) => {
    const s = await begin(original, a),
      c = await conversation(s, a);
    const rows: Infer<typeof orderRow>[] = [];
    const p = await s.ctx.db
      .query("researchOrders")
      .withIndex("by_targetedChat_conversationId_and_createdAt", (q) =>
        q
          .eq("targetedChat.conversationId", c._id)
          .lte("createdAt", s.selectionUpperBound!),
      )
      .order("asc")
      .paginate({
        numItems: EXPORT_PAGE_CANDIDATES,
        cursor: a.cursor,
        maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
      });
    for (const o of p.page) {
      binding(
        o.accountId === c.accountId &&
          o.actorId === c.actorId &&
          o.targetedChat?.conversationId === c._id,
      );
      try {
        await orderOwner(s, o._id);
        rows.push(await projectOrder(s, o));
      } catch (error) {
        // Only our positive retained-state/horizon checks permit an empty discovery page.
        if (
          !(error instanceof ConvexError) ||
          error.data !== "EXPORT_SOURCE_UNAVAILABLE"
        )
          throw error;
      }
    }
    return s.finish("targetedOrders", rows, p, {
      accountId: c.accountId,
      conversationId: c._id,
    });
  },
});
export const publicOrders = workspaceQuery({
  args: { ...correlation, profileId: v.id("researchProfiles"), ...bounded },
  returns: envelope("publicOrders", orderRow),
  handler: async (original, a) => {
    const s = await begin(original, a);
    requireRole(original.membership, ["Owner", "Admin"]);
    const profile = await s.ctx.db.get(a.profileId);
    binding(profile);
    requireReference(
      original.workspace._id,
      await s.ctx.db.get(profile.accountId),
    );
    const rows: Infer<typeof orderRow>[] = [];
    const p = await s.ctx.db
      .query("researchOrders")
      .withIndex("by_public_profile_createdAt", (q) =>
        q
          .eq("profileId", profile._id)
          .eq("targetedChat.conversationId", undefined)
          .lte("createdAt", s.selectionUpperBound!),
      )
      .order("asc")
      .paginate({
        numItems: EXPORT_PAGE_CANDIDATES,
        cursor: a.cursor,
        maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
      });
    for (const o of p.page) {
      binding(
        !o.targetedChat &&
          o.profileId === profile._id &&
          o.accountId === profile.accountId,
      );
      try {
        await orderOwner(s, o._id);
        rows.push(await projectOrder(s, o));
      } catch (error) {
        // Only our positive retained-state/horizon checks permit an empty discovery page.
        if (
          !(error instanceof ConvexError) ||
          error.data !== "EXPORT_SOURCE_UNAVAILABLE"
        )
          throw error;
      }
    }
    return s.finish("publicOrders", rows, p, {
      profileId: profile._id,
      accountId: profile.accountId,
    });
  },
});
export const orderSources = workspaceQuery({
  args: { ...correlation, ...order, operation, offset: v.number() },
  returns: envelope("orderSources", sourceRow),
  handler: async (original, a) => {
    const s = await begin(original, a);
    offset(a.offset);
    const o = await orderOwner(s, a.orderId);
    await material(s, o);
    const n = o.native!,
      i = n.operations.indexOf(a.operation);
    binding(i >= 0);
    const id = n.cacheIds[i];
    const cache = id ? await s.ctx.db.get(id) : null;
    if (id)
      binding(
        cache &&
          cache.accountId === o.accountId &&
          cache.operation === a.operation,
      );
    const ids = cache?.sourceIds ?? [];
    binding(ids.length <= 1000);
    const rows: Infer<typeof sourceRow>[] = [];
    if (ids[a.offset]) {
      const d = await deliveredSource(s.ctx, o._id, ids[a.offset]);
      s.horizon(d.until);
      const r = d.s;
      rows.push({
        sourceId: r._id,
        operation: r.operation,
        url: r.url,
        title: r.title,
        text: r.text,
        publishedAt: r.publishedAt,
        count: r.count,
        observedAt: r.observedAt,
        minusableUntil: Math.min(d.until, s.retainedUntil ?? d.until),
      });
    }
    return s.finish(
      "orderSources",
      rows,
      {
        continueCursor: String(a.offset + 1),
        isDone: a.offset + 1 >= ids.length,
      },
      {
        orderId: o._id,
        operation: a.operation,
        accountId: o.accountId,
        nextOffset: a.offset + 1,
      },
    );
  },
});
export const orderEvidence = workspaceQuery({
  args: { ...correlation, ...order, ...paging },
  returns: envelope("orderEvidence", evidenceRow),
  handler: async (original, a) => {
    const s = await begin(original, a),
      o = await orderOwner(s, a.orderId);
    await material(s, o);
    const rows: Infer<typeof evidenceRow>[] = [];
    const p = await s.ctx.db
      .query("researchEvidence")
      .withIndex("by_orderId_and_createdAt", (q) => q.eq("orderId", o._id))
      .order("asc")
      .paginate({
        numItems: EXPORT_PAGE_CANDIDATES,
        cursor: a.cursor,
        maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
      });
    for (const e of p.page) {
      binding(e.orderId === o._id && e.accountId === o.accountId);
      if (e.state === "removed" || !e.payload || e.retentionUntil <= Date.now())
        continue;
      const proof = await currentEvidence(
        s.ctx,
        o.workspaceId,
        e._id,
        o.accountId,
      );
      s.horizon(proof.proofUntil);
      if (e.parentEvidenceId) {
        const parent = await s.ctx.db.get(e.parentEvidenceId);
        binding(
          parent &&
            parent.orderId === o._id &&
            parent.accountId === o.accountId &&
            parent.sourceId === e.sourceId &&
            parent.materialHash === e.materialHash,
        );
      }
      if (e.modelOrigin) {
        const r = await researchRun(s, o);
        binding(r._id === e.modelOrigin.runId);
      }
      rows.push({
        evidenceId: e._id,
        actorId: e.actorId,
        annotationActorId: e.annotationActorId,
        orderId: o._id,
        sourceId: e.sourceId,
        observedAt: e.observedAt,
        sourceGeneration: e.sourceGeneration,
        parentEvidenceId: e.parentEvidenceId,
        perspective: e.payload.perspective,
        inboxRevision: e.inboxRevision,
        inboxDisposition: e.inboxDisposition,
        inboxActorId: e.inboxActorId,
        createdAt: e.createdAt,
        annotation: e.payload.annotation,
        model: e.payload.model,
        assessment: e.assessment,
        promptVersion: e.modelOrigin?.promptVersion,
        policyVersion: e.modelOrigin?.policyVersion,
        minretentionUntil: Math.min(
          e.retentionUntil,
          proof.proofUntil,
          s.retainedUntil ?? e.retentionUntil,
        ),
      });
    }
    return s.finish("orderEvidence", rows, p, {
      orderId: o._id,
      accountId: o.accountId,
    });
  },
});
async function researchRun(s: Read, o: Doc<"researchOrders">) {
  if (
    o.pipeline?.cleanupState !== "retained" ||
    o.pipeline.agentCleaned ||
    !o.pipeline.runId ||
    o.pipeline.retentionUntil === null
  )
    unavailable();
  s.horizon(o.pipeline.retentionUntil);
  const r = await s.ctx.db.get(o.pipeline.runId);
  binding(
    r &&
      r.research?.orderId === o._id &&
      r.workspaceId === o.workspaceId &&
      r.accountId === o.accountId &&
      r.actorId === o.actorId &&
      r.purpose === "research",
  );
  if (o.targetedChat)
    binding(
      (!r.conversationId ||
        r.conversationId === o.targetedChat.conversationId) &&
        !r.chatOperationId,
    );
  else binding(!r.conversationId && !r.chatOperationId);
  s.horizon(await retainedRunProof(s.ctx, r, undefined, o.accountId));
  return r;
}
export const researchMessages = workspaceQuery({
  args: { ...correlation, ...order, ...paging },
  returns: envelope("researchMessages", messageRow),
  handler: async (original, a) => {
    const s = await begin(original, a),
      o = await orderOwner(s, a.orderId);
    await material(s, o);
    const r = await researchRun(s, o);
    binding(r.threadId);
    const { p, rows } = await messages(
      s,
      r.threadId,
      r.actorId,
      a.cursor,
      true,
    );
    return s.finish(
      "researchMessages",
      rows.map((r) => ({ ...r, orderId: o._id })),
      p,
      { orderId: o._id, accountId: o.accountId },
    );
  },
});
export async function ownedAttachmentThread(
  original: Context,
  a: Infer<typeof vCorrelation> &
    (
      | {
          kind: "conversation";
          accountId: Id<"socialAccounts">;
          conversationId: Id<"conversations">;
        }
      | { kind: "research"; orderId: Id<"researchOrders"> }
    ),
) {
  const s = await begin(original, a);
  let threadId: string;
  if (a.kind === "conversation") {
    const c = await conversation(s, a);
    threadId = c.threadId;
  } else {
    const o = await orderOwner(s, a.orderId);
    binding(o.actorId === original.user._id);
    await material(s, o);
    const r = await researchRun(s, o);
    binding(r.threadId);
    threadId = r.threadId;
  }
  const thread = await s.ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  binding(thread && thread.userId === original.user._id);
  const proof = s.finish("attachmentProof", [], {
    continueCursor: "",
    isDone: true,
  });
  return { threadId, actorId: original.user._id, ...proof };
}
const stages: Record<string, string> = {
  "ai/researchTools:reserve": "reserve",
  "ai/researchTools:prepare": "prepare",
  "research/execute:operation": "execute.operation",
  "ai/researchTools:select": "select",
  "ai/researchTools:bindModel": "bindModel",
  "ai/provider:execute": "provider.execute",
  "ai/researchTools:cluster": "cluster",
  "ai/researchTools:assess": "assess",
  "ai/researchTools:evidence": "evidence",
  "ai/researchTools:inbox": "inbox",
  "ai/researchTools:finish": "finish",
};
export const workflowSteps = workspaceQuery({
  args: { ...correlation, ...order, ...paging },
  returns: envelope("workflowSteps", stepRow),
  handler: async (original, a) => {
    const s = await begin(original, a),
      o = await orderOwner(s, a.orderId);
    await material(s, o);
    const pipe = o.pipeline;
    if (
      !pipe ||
      pipe.cleanupState !== "retained" ||
      pipe.workflowCleaned ||
      !pipe.workflowId
    )
      unavailable();
    s.horizon(pipe.retentionUntil);
    let fetchCursor: string | null = a.cursor;
    let selected: { continueCursor: string; isDone: boolean } | null = null;
    const rows: Infer<typeof stepRow>[] = [];
    for (
      let candidates = 0;
      candidates < EXPORT_PAGE_CANDIDATES && !selected?.isDone;
      candidates++
    ) {
      const prior = selected;
      const mark = rows.length;
      // Annotate the component result: this call's generic inference does not
      // survive the accumulation loop below (TS7022), so pin it explicitly.
      const p: FunctionReturnType<
        typeof components.workflow.workflow.listSteps
      > = await s.ctx.runQuery(components.workflow.workflow.listSteps, {
        workflowId: pipe.workflowId,
        order: "asc",
        paginationOpts: { numItems: 1, cursor: fetchCursor },
      });
      fetchCursor = p.continueCursor;
      selected = p;
      for (const r of p.page) {
        numeric(r);
        const stage = stages[r.name];
        binding(
          r.workflowId === pipe.workflowId &&
            r.kind === "function" &&
            stage &&
            r.args &&
            typeof r.args === "object" &&
            !Array.isArray(r.args),
        );
        const args = r.args as Record<string, unknown>;
        if (stage === "provider.execute") {
          binding(Object.keys(args).length === 1 && args.runId === pipe.runId);
          await researchRun(s, o);
        } else {
          binding(
            args.orderId === o._id &&
              Number.isSafeInteger(args.generation) &&
              Number(args.generation) > 0 &&
              Object.keys(args).length ===
                (stage === "execute.operation" ? 3 : 2),
          );
          if (stage === "execute.operation")
            binding(
              o.native!.operations.includes(
                args.operation as Infer<typeof operation>,
              ),
            );
        }
        rows.push({
          orderId: o._id,
          stepNumber: r.stepNumber,
          stage,
          kind: "function",
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          resultKind: r.runResult?.kind ?? "pending",
        });
      }
      if (mark > 0 && rows.length > mark && exportRowsOverBudget(rows)) {
        while (rows.length > mark) rows.pop();
        selected = prior;
        break;
      }
    }
    const committed = selected!;
    return s.finish("workflowSteps", rows, committed, {
      orderId: o._id,
      accountId: o.accountId,
    });
  },
});
