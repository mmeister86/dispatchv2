import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  workspaceQuery,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import { preflight } from "../publishing";
import { checkImmutableMediaSource } from "../editorial";
import { historicalReviewSource } from "../editorial/reviews";
import { checkRecoverySource } from "../integrations/github/recoveryState";
import { projectRecovery } from "../content/signals";
import { currentProfile, liveAuthority } from "../research/access";
import { resultState } from "../research/providerFields";
import { disposition } from "../research/pipelineFields";
import { ideaProofUntil } from "../research/contentProof";
import { nativeAttempt } from "../research/providerAccess";
import { materialWalk } from "../research/pipelineAccess";
import { retainedRunProof } from "../ai/sourceAccess";
import { runStyleProof } from "../ai/styleProfiles";
import { generationAttempt } from "../ai/accounting";
import { reservation } from "../ai/jev/composite";

const nullableNumber = v.union(v.number(), v.null());
const familyName = v.union(
  ...(
    [
      "publishing",
      "github",
      "media",
      "research",
      "generation",
      "own_metrics",
      "own_history",
      "jev_analyzer",
      "intent_routing",
      "embedding",
      "output_verification",
    ] as const
  ).map(v.literal),
);
const parentRef = v.union(
  v.object({ kind: v.literal("publishing"), id: v.id("schedules") }),
  v.object({ kind: v.literal("github"), id: v.id("githubRecoveries") }),
  v.object({ kind: v.literal("media"), id: v.id("mediaAssets") }),
  v.object({ kind: v.literal("research"), id: v.id("researchOrders") }),
  v.object({ kind: v.literal("generation"), id: v.id("agentRuns") }),
);
const recoveryRef = v.union(
  v.object({ kind: v.literal("draft"), id: v.id("drafts") }),
  v.object({ kind: v.literal("signals") }),
  v.object({ kind: v.literal("media") }),
  v.object({ kind: v.literal("research"), id: v.id("researchProfiles") }),
  v.object({ kind: v.literal("ideas") }),
  v.object({ kind: v.literal("plans") }),
);
const safeState = v.union(
  ...(
    [
      "queued",
      "running",
      "blocked",
      "cancelled",
      "completed",
      "ready",
      "stopped",
      "failed",
      "uploading",
      "validating",
      "deleting",
      "missing",
      "requesting",
      "accepted",
      "unknown",
      "processed",
      "scheduled",
      "publishing",
      "published",
      "partial",
      "aborting",
      "aborted",
      "sending",
      "draft",
      "confirmed",
      "partially_published",
      "reconciliation_required",
      "deleted",
    ] as const
  ).map(v.literal),
);
const safeCode = v.union(
  v.literal("attention"),
  v.literal("waiting"),
  v.literal("usage_unresolved"),
  v.literal("source_unavailable"),
  v.null(),
);
const receipt = v.object({
  attemptId: v.id("aiAttempts"),
  owner: v.union(
    v.literal("generation"),
    v.literal("generation-reservation"),
    v.literal("native-search"),
  ),
  state: v.union(
    v.literal("sent"),
    v.literal("settled"),
    v.literal("unknown"),
    v.literal("reserved"),
    v.literal("cancelled"),
  ),
  currency: v.string(),
  heldMicros: v.number(),
  estimatedMicros: nullableNumber,
  settledAt: nullableNumber,
});
const row = v.object({
  parent: parentRef,
  accountId: v.union(v.id("socialAccounts"), v.null()),
  state: safeState,
  code: safeCode,
  recordedAt: nullableNumber,
  deadline: nullableNumber,
  leaseUntil: nullableNumber,
  notBefore: nullableNumber,
  proofUntil: nullableNumber,
  overdue: v.boolean(),
  localReceipt: v.union(v.boolean(), v.null()),
  outcomes: v.array(v.union(resultState, disposition)),
  recovery: v.union(recoveryRef, v.null()),
  receiptCoverage: v.union(
    v.literal("complete_for_parent"),
    v.literal("bounded"),
    v.literal("not_evaluated"),
  ),
  moreReceipts: v.union(v.boolean(), v.null()),
  receipts: v.array(receipt),
});
const family = v.object({
  family: familyName,
  coverage: v.union(v.literal("bounded"), v.literal("not_evaluated")),
  sampledRows: v.number(),
  moreEligibleRows: v.union(v.boolean(), v.null()),
  total: v.null(),
  configuration: v.literal("not_evaluated"),
  remoteCheck: v.literal("not_performed"),
  reason: v.union(
    v.literal("parent_cap"),
    v.literal("child_cap"),
    v.literal("read_budget"),
    v.literal("family_not_implemented"),
    v.null(),
  ),
  rows: v.array(row),
});
const health = v.object({
  workspaceId: v.id("workspaces"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  authId: v.string(),
  sessionId: v.string(),
  observedAt: v.number(),
  validUntil: v.number(),
  coverage: v.object({
    kind: v.literal("bounded_receipt_sample"),
    accountsLoaded: v.number(),
    moreEligibleAccounts: v.boolean(),
    total: v.null(),
    reasons: v.array(
      v.union(
        v.literal("parent_cap"),
        v.literal("child_cap"),
        v.literal("read_budget"),
        v.literal("family_not_implemented"),
      ),
    ),
  }),
  families: v.array(family),
});
export type Health = Infer<typeof health>;
type Row = Infer<typeof row>;
type Family = Infer<typeof family>;
const limits = {
  databaseQueries: 128,
  documentsRead: 512,
  bytesRead: 512 * 1024,
};
const capacityStop = {};
// Only this local identity denotes deliberate work not started; native failures always escape.
async function boundedReader(ctx: QueryCtx) {
  const initial = await ctx.meta.getTransactionMetrics();
  let queries = 0,
    exhausted = false;
  const pending = new Set<Promise<unknown>>(),
    failures: unknown[] = [];
  const execute = (read: () => unknown): Promise<unknown> => {
    // Reserve synchronously: native owner proofs may start parallel reads.
    if (exhausted || ++queries >= initial.databaseQueries.remaining) {
      exhausted = true;
      return Promise.reject(capacityStop);
    }
    const work = (async () => {
      const m = await ctx.meta.getTransactionMetrics();
      if (m.documentsRead.remaining <= 7 || m.bytesRead.remaining <= 4096) {
        exhausted = true;
        throw capacityStop;
      }
      return read();
    })();
    pending.add(work);
    work.then(
      () => pending.delete(work),
      (error) => {
        pending.delete(work);
        if (error !== capacityStop) failures.push(error);
      },
    );
    return work;
  };
  const wrap = (target: object): object =>
    new Proxy(target, {
      get(t, key) {
        const value = Reflect.get(t, key, t);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          if (
            ["take", "first", "unique", "collect", "paginate"].includes(
              String(key),
            )
          )
            return execute(() => Reflect.apply(value, t, args));
          const next = Reflect.apply(value, t, args);
          return next && typeof next === "object" ? wrap(next) : next;
        };
      },
    });
  const db = new Proxy(ctx.db, {
    get(t, key) {
      const value = Reflect.get(t, key, t);
      if (key === "get")
        return (...args: unknown[]) =>
          execute(() => Reflect.apply(value, t, args));
      if (key === "query")
        return (...args: unknown[]) => wrap(Reflect.apply(value, t, args));
      return typeof value === "function" ? value.bind(t) : value;
    },
  });
  return {
    ctx: { ...ctx, db },
    drain: async () => {
      while (pending.size) await Promise.allSettled([...pending]);
      // A real DB error wins over a deliberate stop in a parallel proof.
      if (failures.length) throw failures[0];
    },
  };
}
function expectedLoss(error: unknown) {
  if (error === capacityStop) throw error;
  if (
    error instanceof ConvexError &&
    typeof error.data === "string" &&
    [
      "SCHEDULER_AUTHORITY_CHANGED",
      "X_SCHEDULE_CHANGED",
      "SCHEDULE_ABORT_REQUESTED",
      "APPROVAL_REQUIRED",
      "APPROVAL_CHANGED",
      "APPROVAL_EXPIRED",
      "REVIEW_SOURCE_UNAVAILABLE",
      "MEDIA_SOURCE_CHANGED",
      "MEDIA_NOT_READY",
      "MEDIA_CONFIGURATION_REQUIRED",
      "MEDIA_SNAPSHOT_CHANGED",
      "APPROVER_AUTHORITY_CHANGED",
      "ACCOUNT_CONNECTION_CHANGED",
      "APPROVAL_PURPOSE_MISMATCH",
      "FIRST_WRITE_INTENT_EXPIRED",
      "REVIEW_REVIEWER_UNAVAILABLE",
      "REVIEW_POLICY_CHANGED",
      "REVIEW_DECISION_WITHDRAWN",
      "REVIEW_REQUIRED",
      "RESEARCH_VERSION_MISSING",
    ].includes(error.data)
  )
    return;
  rethrowUnexpectedSourceError(error);
}
function base(
  parent: Row["parent"],
  state: Row["state"],
  accountId: Row["accountId"],
  recordedAt: number | null,
): Row {
  return {
    parent,
    state,
    accountId,
    recordedAt,
    code: null,
    deadline: null,
    leaseUntil: null,
    notBefore: null,
    proofUntil: null,
    overdue: false,
    localReceipt: null,
    outcomes: [],
    recovery: null,
    receiptCoverage: "not_evaluated",
    moreReceipts: null,
    receipts: [],
  };
}
function clocks(r: Row, now: number) {
  const pending = ![
    "completed",
    "published",
    "cancelled",
    "stopped",
    "failed",
    "processed",
    "aborted",
  ].includes(r.state);
  r.overdue =
    pending &&
    ((r.deadline !== null && r.deadline <= now) ||
      (r.leaseUntil !== null && r.leaseUntil > 0 && r.leaseUntil <= now));
  r.code = r.receipts.some((t) => t.state === "unknown" || t.state === "sent")
    ? "usage_unresolved"
    : r.code === "attention" || r.overdue
      ? "attention"
      : pending && r.notBefore !== null && r.notBefore > now
        ? "waiting"
        : null;
  return r;
}
function finance(t: Doc<"aiAttempts">): Infer<typeof receipt> {
  if (
    t.owner !== undefined &&
    t.owner !== "generation" &&
    t.owner !== "generation-reservation" &&
    t.owner !== "native-search"
  )
    throw new ConvexError("HEALTH_RECEIPT_OWNER_INVALID");
  if (
    !/^[A-Z]{3}$/.test(t.currency) ||
    !Number.isSafeInteger(t.heldMicros) ||
    t.heldMicros < 0 ||
    (t.estimatedMicros !== null &&
      (!Number.isSafeInteger(t.estimatedMicros) || t.estimatedMicros < 0))
  )
    throw new ConvexError("HEALTH_RECEIPT_INVALID");
  return {
    attemptId: t._id,
    owner: t.owner ?? "generation",
    state: t.state,
    currency: t.currency,
    heldMicros: t.heldMicros,
    estimatedMicros: t.estimatedMicros,
    settledAt: t.settledAt,
  };
}
const familyNames: Family["family"][] = [
  "publishing",
  "github",
  "media",
  "research",
  "generation",
  "own_metrics",
  "own_history",
  "jev_analyzer",
  "intent_routing",
  "embedding",
  "output_verification",
];
function empty(name: Family["family"], implemented: boolean): Family {
  return {
    family: name,
    coverage: implemented ? "bounded" : "not_evaluated",
    sampledRows: 0,
    moreEligibleRows: implemented ? false : null,
    total: null,
    configuration: "not_evaluated",
    remoteCheck: "not_performed",
    reason: implemented ? null : "family_not_implemented",
    rows: [],
  };
}
const sampleArgs = {
  workspaceId: v.id("workspaces"),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  authId: v.string(),
  sessionId: v.string(),
  observedAt: v.number(),
};
export const get = workspaceQuery({
  args: {
    accountId: v.optional(v.id("socialAccounts")),
    refreshKey: v.string(),
  },
  returns: health,
  handler: async (ctx, a): Promise<Health> => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    if (ctx.user.activeWorkspaceId !== ctx.workspace._id)
      throw new ConvexError("WORKSPACE_ACCESS_DENIED");
    if (a.refreshKey.length < 1 || a.refreshKey.length > 64)
      throw new ConvexError("HEALTH_REFRESH_KEY_INVALID");
    if (a.accountId)
      requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string") throw new ConvexError("Unauthenticated");
    const m = await ctx.meta.getTransactionMetrics();
    const remaining = {
      databaseQueries: limits.databaseQueries - m.databaseQueries.used - 1,
      documentsRead: limits.documentsRead - m.documentsRead.used,
      bytesRead: limits.bytesRead - m.bytesRead.used,
    };
    if (Object.values(remaining).some((n) => n <= 0))
      throw new ConvexError("HEALTH_AUTH_READ_LIMIT");
    const result = await ctx.runQuery(
      internal.operations.health.sample,
      {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId ?? null,
        authId: ctx.user.authId,
        sessionId,
        observedAt: Date.now(),
      },
      { transactionLimits: remaining },
    );
    if (new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024)
      throw new ConvexError("HEALTH_DTO_LIMIT");
    return result;
  },
});
export const sample = internalQuery({
  args: sampleArgs,
  returns: health,
  handler: async (native, a): Promise<Health> => {
    const reader = await boundedReader(native),
      ctx = reader.ctx,
      families = familyNames.map((name, i) => empty(name, i < 5));
    let accounts: Doc<"socialAccounts">[] = [];
    let moreAccounts = false,
      stopped = false;
    const within = (accountId: Id<"socialAccounts">) =>
      !a.accountId || a.accountId === accountId;
    try {
      const found = a.accountId
        ? [await ctx.db.get(a.accountId)]
        : await ctx.db
            .query("socialAccounts")
            .withIndex("by_workspaceId", (q) =>
              q.eq("workspaceId", a.workspaceId),
            )
            .take(4);
      accounts = found
        .filter(
          (x): x is Doc<"socialAccounts"> =>
            !!x && x.workspaceId === a.workspaceId,
        )
        .slice(0, 3);
      moreAccounts = found.length > 3;
    } catch (e) {
      if (e !== capacityStop) throw e;
      stopped = true;
    }
    function window<T>(f: Family, parents: T[]) {
      // A full search window does not prove exhaustion after source omissions.
      if (parents.length >= 7) f.moreEligibleRows = null;
      return parents.slice(0, 7);
    }
    async function admit(f: Family, build: () => Promise<Row | null>) {
      try {
        const r = await build();
        if (!r) return;
        if (f.rows.length < 6) f.rows.push(clocks(r, a.observedAt));
        else {
          f.moreEligibleRows = true;
          f.reason = "parent_cap";
        }
      } catch (e) {
        await reader.drain();
        if (e === capacityStop) {
          stopped = true;
          f.reason = "read_budget";
          f.moreEligibleRows = null;
        } else expectedLoss(e);
      }
    }
    for (const f of families.slice(0, 5)) {
      if (stopped) {
        f.coverage = "not_evaluated";
        f.reason = "read_budget";
        f.moreEligibleRows = null;
        continue;
      }
      try {
        if (f.family === "publishing") {
          const parents = a.accountId
            ? await ctx.db
                .query("schedules")
                .withIndex("by_workspaceId_and_accountId_and_at", (q) =>
                  q
                    .eq("workspaceId", a.workspaceId)
                    .eq("accountId", a.accountId!),
                )
                .order("desc")
                .take(7)
            : await ctx.db
                .query("schedules")
                .withIndex("by_workspaceId_and_at", (q) =>
                  q.eq("workspaceId", a.workspaceId),
                )
                .order("desc")
                .take(7);
          for (const s of window(f, parents)) {
            if (stopped) break;
            await admit(f, async () => {
              const children = await ctx.db
                .query("xPostAttempts")
                .withIndex("by_scheduleId_and_generation_and_position", (q) =>
                  q.eq("scheduleId", s._id),
                )
                .take(7);
              const media = await ctx.db
                .query("xMediaCheckpoints")
                .withIndex(
                  "by_scheduleId_and_generation_and_mediaPosition",
                  (q) => q.eq("scheduleId", s._id),
                )
                .take(7);
              for (const t of [...children, ...media])
                if (
                  s.workspaceId !== a.workspaceId ||
                  t.scheduleId !== s._id ||
                  t.workspaceId !== s.workspaceId ||
                  t.accountId !== s.accountId ||
                  t.versionId !== s.versionId ||
                  !Number.isSafeInteger(t.generation) ||
                  t.generation < 1 ||
                  t.generation > s.generation ||
                  ("connectionSequence" in t &&
                    t.connectionSequence !== (s.accountConnectionSequence ?? 0))
                )
                  throw new ConvexError("HEALTH_PUBLISH_OWNER_INVALID");
              const unresolved =
                children.some(
                  (t) => t.stage === "unknown" || t.stage === "sending",
                ) || media.some((t) => t.phase === "uncertain");
              let until: number | null = null,
                recovery = false;
              try {
                const ver = await preflight(ctx, s);
                await checkImmutableMediaSource(ctx, ver);
                until = await historicalReviewSource(
                  ctx,
                  ver,
                  s.reviewPin?.sourceUntil,
                );
                recovery = true;
              } catch (e) {
                // Execution/source authority gates a link, not an owned physical effect.
                expectedLoss(e);
              }
              if (!recovery && !unresolved) {
                // A capped physical window cannot prove there are no later unresolved effects.
                if (children.length >= 7 || media.length >= 7)
                  f.moreEligibleRows = null;
                return null;
              }
              const r = base(
                { kind: "publishing", id: s._id },
                s.state,
                s.accountId,
                s.at,
              );
              r.proofUntil = until;
              r.deadline = children[0]?.deadline ?? s.intentExpiresAt ?? null;
              r.leaseUntil = children[0]?.leaseUntil ?? null;
              r.notBefore =
                children[0]?.reconcileNotBefore ??
                children[0]?.rateResetAt ??
                null;
              if (recovery) r.recovery = { kind: "draft", id: s.draftId };
              if (unresolved) r.code = "attention";
              r.receiptCoverage =
                children.length > 6 || media.length > 6
                  ? "bounded"
                  : "complete_for_parent";
              r.moreReceipts = children.length > 6 || media.length > 6;
              return r;
            });
          }
        } else if (f.family === "github") {
          if (!a.accountId) {
            const parents = await ctx.db
              .query("githubRecoveries")
              .withIndex("by_workspaceId_and_updatedAt", (q) =>
                q.eq("workspaceId", a.workspaceId),
              )
              .order("desc")
              .take(7);
            for (const r of window(f, parents)) {
              if (stopped) break;
              await admit(f, async () => {
                const repo = await ctx.db.get(r.repositoryId);
                if (!repo) return null;
                const source = await checkRecoverySource(
                  ctx,
                  r,
                  repo.generation,
                );
                const projected = await projectRecovery(ctx, r);
                const row = base(
                  { kind: "github", id: r._id },
                  projected.state,
                  null,
                  r.updatedAt,
                );
                row.leaseUntil = r.leaseUntil;
                row.notBefore = projected.notBefore;
                row.localReceipt = projected.localReceipt;
                row.proofUntil = source.proofExpiresAt;
                row.recovery = { kind: "signals" };
                return row;
              });
            }
          } else {
            f.coverage = "not_evaluated";
            f.moreEligibleRows = null;
          }
        } else if (f.family === "media") {
          if (!a.accountId) {
            const parents: Doc<"mediaAssets">[] = [];
            for (const state of [
              "uploading",
              "validating",
              "deleting",
              "failed",
            ] as const)
              parents.push(
                ...(await ctx.db
                  .query("mediaAssets")
                  .withIndex("by_workspaceId_and_state", (q) =>
                    q.eq("workspaceId", a.workspaceId).eq("state", state),
                  )
                  .take(7)),
              );
            parents.sort(
              (x, y) =>
                y._creationTime - x._creationTime || x._id.localeCompare(y._id),
            );
            for (const asset of window(f, parents)) {
              if (stopped) break;
              await admit(f, async () => {
                const session = await ctx.db
                  .query("mediaUploadSessions")
                  .withIndex("by_assetId", (q) => q.eq("assetId", asset._id))
                  .unique();
                if (
                  session &&
                  (session.workspaceId !== asset.workspaceId ||
                    session.assetId !== asset._id ||
                    asset.uploadSessionId !== session._id)
                )
                  throw new ConvexError("HEALTH_MEDIA_OWNER_INVALID");
                const r = base(
                  { kind: "media", id: asset._id },
                  asset.state,
                  null,
                  asset._creationTime,
                );
                if (session) {
                  r.deadline =
                    session.state === "validating"
                      ? session.expiresAt + 86400000
                      : session.expiresAt + 60000;
                  r.leaseUntil = session.leaseUntil;
                  r.notBefore = session.cleanAfter;
                  r.recovery = { kind: "media" };
                }
                return r;
              });
            }
          } else {
            f.coverage = "not_evaluated";
            f.moreEligibleRows = null;
          }
        } else if (f.family === "research") {
          const parents: Doc<"researchOrders">[] = [];
          for (const account of accounts) {
            const p = await ctx.db
              .query("researchProfiles")
              .withIndex("by_workspaceId_and_accountId", (q) =>
                q.eq("workspaceId", a.workspaceId).eq("accountId", account._id),
              )
              .unique();
            if (!p || p.deleted || p.paused) continue;
            try {
              await currentProfile(ctx, a.workspaceId, p._id);
            } catch (e) {
              expectedLoss(e);
              continue;
            }
            parents.push(
              ...(await ctx.db
                .query("researchOrders")
                .withIndex("by_public_profile_createdAt", (q) =>
                  q
                    .eq("profileId", p._id)
                    .eq("targetedChat.conversationId", undefined),
                )
                .order("desc")
                .take(7)),
            );
          }
          parents.sort(
            (x, y) => y.createdAt - x.createdAt || x._id.localeCompare(y._id),
          );
          for (const o of window(f, parents)) {
            if (stopped) break;
            await admit(f, async () => {
              if (
                o.targetedChat ||
                o.workspaceId !== a.workspaceId ||
                !within(o.accountId)
              )
                return null;
              const { profile } = await currentProfile(
                ctx,
                a.workspaceId,
                o.profileId,
              );
              await liveAuthority(ctx, profile, o.actorId, o.accountSequence);
              const children = await ctx.db
                .query("aiAttempts")
                .withIndex("by_researchOrderId_and_key", (q) =>
                  q.eq("researchOrderId", o._id),
                )
                .take(7);
              const receipts = [];
              for (const t of children) {
                const proved = await nativeAttempt(ctx, t._id);
                if (proved.o._id !== o._id)
                  throw new ConvexError("HEALTH_RESEARCH_OWNER_INVALID");
                const header = finance(proved.t);
                if (receipts.length < 6) receipts.push(header);
              }
              let more = children.length > 6;
              if (o.pipeline?.runId && !more) {
                const run = await ctx.db.get(o.pipeline.runId);
                if (
                  !run ||
                  run.research?.orderId !== o._id ||
                  run.accountId !== o.accountId ||
                  run.workspaceId !== o.workspaceId ||
                  run.actorId !== o.actorId ||
                  run.conversationId ||
                  run.chatOperationId
                )
                  throw new ConvexError("HEALTH_RESEARCH_OWNER_INVALID");
                const generation = await ctx.db
                  .query("aiAttempts")
                  .withIndex("by_runId_and_key", (q) => q.eq("runId", run._id))
                  .take(7 - receipts.length);
                more = generation.length > 6 - receipts.length;
                for (const t of generation) {
                  const header = finance(await generationAttempt(ctx, t, run));
                  if (receipts.length < 6) receipts.push(header);
                }
              }
              const r = base(
                { kind: "research", id: o._id },
                o.state,
                o.accountId,
                o.createdAt,
              );
              r.deadline = o.deadline;
              if ((o.native?.outcomes.length ?? 0) > 3)
                throw new ConvexError("HEALTH_RESEARCH_OWNER_INVALID");
              r.outcomes = [
                ...(o.pipeline ? [o.pipeline.outcome] : []),
                ...(o.native?.outcomes.map((x) => x.state) ?? []),
              ];
              r.recovery = { kind: "research", id: o.profileId };
              r.receipts = receipts;
              r.moreReceipts = more;
              r.receiptCoverage = more ? "bounded" : "complete_for_parent";
              return r;
            });
          }
        } else {
          const parents: Doc<"agentRuns">[] = [];
          for (const account of accounts)
            for (const purpose of ["draft", "summary", "plan"] as const)
              parents.push(
                ...(await ctx.db
                  .query("agentRuns")
                  .withIndex("by_public_purpose_createdAt", (q) =>
                    q
                      .eq("workspaceId", a.workspaceId)
                      .eq("accountId", account._id)
                      .eq("purpose", purpose)
                      .eq("conversationId", undefined)
                      .eq("chatOperationId", undefined)
                      .eq("research.orderId", undefined),
                  )
                  .order("desc")
                  .take(7)),
              );
          parents.sort(
            (x, y) => y.createdAt - x.createdAt || x._id.localeCompare(y._id),
          );
          for (const run of window(f, parents)) {
            if (stopped) break;
            await admit(f, async () => {
              if (
                run.conversationId ||
                run.chatOperationId ||
                run.research ||
                !within(run.accountId)
              )
                return null;
              const walk = materialWalk(),
                until = await retainedRunProof(ctx, run, walk, run.accountId);
              await runStyleProof(ctx, run, true, walk);
              const children = await ctx.db
                .query("aiAttempts")
                .withIndex("by_runId_and_key", (q) => q.eq("runId", run._id))
                .take(7);
              const receipts = [];
              for (const t of children) {
                const header = finance(
                  t.owner === "generation-reservation"
                    ? await reservation(ctx, t)
                    : await generationAttempt(ctx, t, run),
                );
                if (receipts.length < 6) receipts.push(header);
              }
              const r = base(
                { kind: "generation", id: run._id },
                run.state,
                run.accountId,
                run.createdAt,
              );
              r.deadline = run.deadline;
              r.proofUntil = until;
              r.receipts = receipts;
              r.moreReceipts = children.length > 6;
              r.receiptCoverage =
                children.length > 6 ? "bounded" : "complete_for_parent";
              const request = await ctx.db
                .query("contentRequests")
                .withIndex("by_runId", (q) => q.eq("runId", run._id))
                .unique();
              if (request?.resultIdeaId) {
                const idea = await ctx.db.get(request.resultIdeaId),
                  version = idea?.currentVersionId
                    ? await ctx.db.get(idea.currentVersionId)
                    : null;
                if (
                  idea &&
                  version &&
                  idea.workspaceId === run.workspaceId &&
                  idea.status !== "archived" &&
                  version.runId === run._id &&
                  version.workspaceId === run.workspaceId &&
                  request.accountId === run.accountId &&
                  request.actorId === run.actorId
                ) {
                  const resultUntil = await ideaProofUntil(
                    ctx,
                    version,
                    walk,
                    run.accountId,
                  );
                  r.proofUntil = Math.min(
                    until ?? Infinity,
                    resultUntil ?? Infinity,
                  );
                  if (!Number.isFinite(r.proofUntil)) r.proofUntil = null;
                  r.recovery = { kind: "ideas" };
                }
              } else if (
                run.purpose === "summary" &&
                run.sources.some(
                  (source) => !("kind" in source) && source.signalId,
                )
              )
                r.recovery = { kind: "signals" };
              return r;
            });
          }
        }
      } catch (e) {
        await reader.drain();
        if (e === capacityStop) {
          stopped = true;
          f.reason = "read_budget";
          f.moreEligibleRows = null;
        } else expectedLoss(e);
      }
      await reader.drain();
      f.sampledRows = f.rows.length;
      if (f.rows.some((r) => r.moreReceipts) && f.reason === null)
        f.reason = "child_cap";
    }
    await reader.drain();
    const horizons = families.flatMap((f) =>
      f.rows.flatMap((r) => (r.proofUntil === null ? [] : [r.proofUntil])),
    );
    const reasons = [
      ...new Set(families.flatMap((f) => (f.reason ? [f.reason] : []))),
    ];
    if (moreAccounts && !reasons.includes("parent_cap"))
      reasons.push("parent_cap");
    return {
      workspaceId: a.workspaceId,
      accountId: a.accountId,
      authId: a.authId,
      sessionId: a.sessionId,
      observedAt: a.observedAt,
      validUntil: Math.min(a.observedAt + 30000, ...horizons),
      coverage: {
        kind: "bounded_receipt_sample",
        accountsLoaded: accounts.length,
        moreEligibleAccounts: moreAccounts,
        total: null,
        reasons,
      },
      families,
    };
  },
});
