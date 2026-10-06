import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { workspaceQuery, requireReference } from "../lib/authorization";
import type { Doc } from "../_generated/dataModel";
import { authority, policy, fingerprint } from "./capabilities";
import { scope, snapshotDoc, field, dialect } from "./fields";
import { changeLiability } from "../ai/accounting";
import { draftResearchProof } from "../research/contentProof";
import { assessmentDoc } from "../intelligence/assessmentFields";
import { sha256 } from "../lib/crypto";
import { credentialDoc } from "../integrations/x/fields";
export async function enqueue(ctx: MutationCtx, c: Doc<"xPostAttempts">) {
  if (
    c.stage !== "confirmed" ||
    !c.externalId ||
    !c.confirmedAt ||
    !/^[0-9]{1,19}$/.test(c.externalId)
  )
    return;
  const s = await ctx.db.get(c.scheduleId);
  if (!s || s.purpose === "first_write_verification") return;
  let control, p;
  try {
    ({ control, p } = await authority(ctx, c));
  } catch {
    return;
  }
  for (const windowHours of [24, 48] as const) {
    const old = await ctx.db
      .query("performanceSnapshots")
      .withIndex("by_postAttemptId_and_windowHours", (q) =>
        q.eq("postAttemptId", c._id).eq("windowHours", windowHours),
      )
      .unique();
    if (old) continue;
    const dueAt = c.confirmedAt + windowHours * 3600000;
    const id = await ctx.db.insert("performanceSnapshots", {
      workspaceId: c.workspaceId,
      accountId: c.accountId,
      postAttemptId: c._id,
      scheduleId: c.scheduleId,
      versionId: c.versionId,
      externalId: c.externalId,
      position: c.position,
      confirmedAt: c.confirmedAt,
      windowHours,
      dueAt,
      generation: control.generation,
      state: "queued",
      attemptId: null,
      requestedAt: null,
      observedAt: null,
      providerCreatedAt: null,
      definitionVersion: null,
      dialect: null,
      fields: [],
      reason: null,
      expiresAt: dueAt + p.retentionMs,
    });
    const jobId = await ctx.scheduler.runAt(
      dueAt,
      internal.performance.collect.read,
      { snapshotId: id, generation: control.generation },
    );
    await ctx.db.patch(id, { jobId });
  }
}
export async function source(
  ctx: QueryCtx | MutationCtx,
  a: { snapshotId: Doc<"performanceSnapshots">["_id"]; generation: number },
) {
  const row = await ctx.db.get(a.snapshotId);
  if (
    !row ||
    row.generation !== a.generation ||
    !["queued", "reading"].includes(row.state) ||
    row.expiresAt <= Date.now()
  )
    throw new ConvexError("OWN_METRICS_INTENT_INACTIVE");
  const x = await authority(ctx, row, a.generation),
    c = await ctx.db.get(row.postAttemptId),
    s = await ctx.db.get(row.scheduleId);
  if (
    !c ||
    !s ||
    c.workspaceId !== row.workspaceId ||
    c.accountId !== row.accountId ||
    c.scheduleId !== row.scheduleId ||
    c.versionId !== row.versionId ||
    c.position !== row.position ||
    c.externalId !== row.externalId ||
    c.stage !== "confirmed" ||
    c.confirmedAt !== row.confirmedAt ||
    c.providerIdentity !== x.p.providerIdentity ||
    s.workspaceId !== row.workspaceId ||
    s.accountId !== row.accountId ||
    s.versionId !== row.versionId ||
    !(s.externalPosts ?? []).some(
      (p) =>
        p.attemptId === c._id &&
        p.position === c.position &&
        p.externalId === c.externalId,
    )
  )
    throw new ConvexError("OWN_METRICS_OWNERSHIP_CHANGED");
  return { ...x, row };
}
export const credentialSource = internalQuery({
  args: { snapshotId: v.id("performanceSnapshots"), generation: v.number() },
  returns: credentialDoc,
  handler: async (ctx, a) => (await source(ctx, a)).credential,
});
export const begin = internalMutation({
  args: {
    snapshotId: v.id("performanceSnapshots"),
    generation: v.number(),
    credentialGeneration: v.number(),
  },
  returns: v.union(
    v.object({
      attemptId: v.id("aiAttempts"),
      externalId: v.string(),
      providerIdentity: v.string(),
      fields: v.array(v.string()),
      dialect,
      policyFingerprint: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    let x;
    try {
      x = await source(ctx, a);
    } catch (e) {
      const row = await ctx.db.get(a.snapshotId);
      if (row && row.state === "queued")
        await ctx.db.patch(row._id, {
          state: "blocked",
          reason:
            e instanceof ConvexError
              ? String(e.data)
              : "OWN_METRICS_UNAVAILABLE",
        });
      return null;
    }
    if (
      x.row.state !== "queued" ||
      x.row.attemptId !== null ||
      x.row.dueAt > Date.now()
    )
      return null;
    if (x.credential.generation !== a.credentialGeneration)
      throw new ConvexError("OWN_METRICS_CREDENTIAL_CHANGED");
    if (Date.now() - x.row.confirmedAt >= 30 * 86400000) {
      await ctx.db.patch(x.row._id, {
        state: "blocked",
        reason: "OWN_METRICS_PRIVATE_WINDOW_EXPIRED",
      });
      return null;
    }
    const hash = await fingerprint(x.p);
    await changeLiability(ctx, x.budgetIds, x.p.unitMicros, 0, true);
    const attemptId = await ctx.db.insert("aiAttempts", {
      owner: "own-metrics",
      provider: "x",
      purpose: "own-post-descriptive-editorial-v1",
      workspaceId: x.row.workspaceId,
      accountId: x.row.accountId,
      snapshotId: x.row._id,
      policyId: x.p._id,
      policyFingerprint: hash,
      policyVersion: x.p.version,
      generation: a.generation,
      credentialGeneration: a.credentialGeneration,
      budgetIds: x.budgetIds,
      currency: x.p.currency,
      unit: "single-post-request",
      unitMicros: x.p.unitMicros,
      reservedMicros: x.p.unitMicros,
      heldMicros: x.p.unitMicros,
      estimatedMicros: null,
      billedMicros: null,
      state: "sent",
      sentAt: Date.now(),
      settledAt: null,
      receiptFingerprint: null,
      errorCode: null,
    });
    await ctx.scheduler.runAfter(
      20000,
      internal.performance.snapshots.timeout,
      { attemptId },
    );
    await ctx.db.patch(x.row._id, {
      state: "reading",
      attemptId,
      requestedAt: Date.now(),
      definitionVersion: x.p.version,
      dialect: x.p.dialect,
    });
    return {
      attemptId,
      externalId: x.row.externalId,
      providerIdentity: x.p.providerIdentity,
      fields: x.p.fields,
      dialect: x.p.dialect,
      policyFingerprint: hash,
    };
  },
});
export const finish = internalMutation({
  args: {
    attemptId: v.id("aiAttempts"),
    knownCharge: v.boolean(),
    fields: v.array(field),
    providerCreatedAt: v.union(v.number(), v.null()),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.attemptId);
    if (
      !t ||
      t.owner !== "own-metrics" ||
      t.runId !== undefined ||
      t.researchOrderId !== undefined ||
      t.logicalIntent !== undefined
    )
      throw new ConvexError("OWN_METRICS_RECEIPT_OWNER_INVALID");
    const row = await ctx.db.get(t.snapshotId),
      p = await ctx.db.get(t.policyId);
    if (
      !row ||
      row.attemptId !== t._id ||
      row.workspaceId !== t.workspaceId ||
      row.accountId !== t.accountId ||
      row.generation !== t.generation ||
      !p ||
      t.budgetIds.length !== 3 ||
      new Set(t.budgetIds).size !== 3 ||
      t.unitMicros !== t.reservedMicros
    )
      throw new ConvexError("OWN_METRICS_RECEIPT_OWNER_INVALID");
    for (const [i, id] of t.budgetIds.entries()) {
      const b = await ctx.db.get(id);
      if (
        !b ||
        b.key !==
          [
            "metrics:x",
            `metrics:workspace:${t.workspaceId}`,
            `metrics:account:${t.accountId}`,
          ][i] ||
        b.scope !== (["provider", "workspace", "account"] as const)[i] ||
        b.currency !== t.currency ||
        (i === 0 &&
          (b.workspaceId !== undefined || b.accountId !== undefined)) ||
        (i === 1 &&
          (b.workspaceId !== t.workspaceId || b.accountId !== undefined)) ||
        (i === 2 &&
          (b.workspaceId !== t.workspaceId || b.accountId !== t.accountId))
      )
        throw new ConvexError("OWN_METRICS_RECEIPT_OWNER_INVALID");
    }
    if (
      p.workspaceId !== t.workspaceId ||
      p.accountId !== t.accountId ||
      p.version !== t.policyVersion ||
      p.unitMicros !== t.unitMicros ||
      p.currency !== t.currency ||
      (await fingerprint(p)) !== t.policyFingerprint
    )
      throw new ConvexError("OWN_METRICS_RECEIPT_OWNER_INVALID");
    const receipt = await sha256(
      JSON.stringify({
        knownCharge: a.knownCharge,
        fields: a.fields,
        providerCreatedAt: a.providerCreatedAt,
        reason: a.reason,
      }),
    );
    if (t.state === "settled") {
      if (t.receiptFingerprint !== receipt)
        throw new ConvexError("OWN_METRICS_RECEIPT_CONFLICT");
      return null;
    }
    if (a.knownCharge)
      await changeLiability(ctx, t.budgetIds, -t.heldMicros, t.unitMicros);
    await ctx.db.patch(t._id, {
      state: a.knownCharge ? "settled" : "unknown",
      heldMicros: a.knownCharge ? 0 : t.heldMicros,
      estimatedMicros: a.knownCharge ? t.unitMicros : null,
      settledAt: a.knownCharge ? Date.now() : null,
      receiptFingerprint: receipt,
      errorCode: a.reason,
    });
    let allowed = false;
    try {
      const x = await source(ctx, {
        snapshotId: row._id,
        generation: t.generation,
      });
      allowed =
        x.credential.generation === t.credentialGeneration &&
        (await fingerprint(x.p)) === t.policyFingerprint;
    } catch {
      /* Financial receipt survives consent withdrawal, payload does not. */
    }
    if (allowed)
      await ctx.db.patch(row._id, {
        state: a.knownCharge ? "observed" : "blocked",
        fields: a.fields,
        observedAt: Date.now(),
        providerCreatedAt: a.providerCreatedAt,
        reason: a.reason,
      });
    return null;
  },
});
export const clear = internalMutation({
  args: {
    ...scope,
    generation: v.number(),
    remove: v.boolean(),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const control = await ctx.db
      .query("performanceControls")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
      )
      .unique();
    if (
      !control ||
      (a.remove
        ? (control.deletedThroughGeneration ?? -1) < a.generation
        : control.generation !== a.generation)
    )
      return null;
    const batch = await ctx.db
      .query("performanceSnapshots")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
      )
      .paginate({ cursor: a.cursor ?? null, numItems: 25 });
    for (const row of batch.page) {
      if (a.remove && row.generation > a.generation) continue;
      if (row.jobId)
        try {
          await ctx.scheduler.cancel(row.jobId);
        } catch {
          /* An in-flight job is fenced by generation. */
        }
      if (a.remove)
        await ctx.db.patch(row._id, {
          state: "removed",
          fields: [],
          providerCreatedAt: null,
          observedAt: null,
          reason: "OWN_METRICS_REMOVED",
          jobId: undefined,
          expiresAt: Number.MAX_SAFE_INTEGER,
        });
      else if (["queued", "reading"].includes(row.state))
        await ctx.db.patch(row._id, {
          state: "blocked",
          reason: "OWN_METRICS_PAUSED",
          jobId: undefined,
        });
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(0, internal.performance.snapshots.clear, {
        ...a,
        cursor: batch.continueCursor,
      });
    return null;
  },
});
export const expire = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("performanceSnapshots")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", Date.now()))
      .take(25);
    for (const row of rows)
      await ctx.db.patch(row._id, {
        state: "removed",
        fields: [],
        providerCreatedAt: null,
        observedAt: null,
        reason: "OWN_METRICS_RETENTION_EXPIRED",
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
    if (rows.length === 25)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.snapshots.expire,
        {},
      );
    return null;
  },
});
const knowledgeView = v.object({
  capturedAt: v.number(),
  assessmentId: v.union(v.id("jevAssessments"), v.null()),
  applicable: v.boolean(),
  reason: v.union(v.string(), v.null()),
  assessment: v.union(assessmentDoc, v.null()),
});
export const overview = workspaceQuery({
  args: { accountId: scope.accountId },
  returns: v.object({
    enabled: v.boolean(),
    reason: v.union(v.string(), v.null()),
    posts: v.array(
      v.object({
        postAttemptId: v.id("xPostAttempts"),
        externalId: v.string(),
        position: v.number(),
        confirmedAt: v.number(),
        coverage: v.object({
          confirmed: v.number(),
          total: v.union(v.number(), v.null()),
        }),
        versionId: v.id("draftVersions"),
        knowledge: v.union(knowledgeView, v.null()),
        snapshots: v.array(snapshotDoc),
      }),
    ),
  }),
  handler: async (ctx, a) => {
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    const control = await ctx.db
      .query("performanceControls")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("accountId", args.accountId),
      )
      .unique();
    let reason: string | null = null;
    try {
      await policy(ctx, args);
      if (control?.enabled) await authority(ctx, args);
    } catch (e) {
      reason =
        e instanceof ConvexError ? String(e.data) : "OWN_METRICS_UNAVAILABLE";
    }
    const rows = await ctx.db
        .query("xPostAttempts")
        .withIndex("by_workspaceId_and_accountId_and_stage", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("accountId", args.accountId)
            .eq("stage", "confirmed"),
        )
        .order("desc")
        .take(20),
      posts = [];
    for (const c of rows) {
      if (!c.externalId || !c.confirmedAt) continue;
      const publication = await ctx.db.get(c.scheduleId);
      const prefix = publication?.externalPosts?.find((p) => p.position === 0);
      const k = prefix
        ? await ctx.db
            .query("publicationKnowledge")
            .withIndex("by_postAttemptId", (q) =>
              q.eq("postAttemptId", prefix.attemptId),
            )
            .unique()
        : null;
      let assessment = k?.assessmentId
        ? await ctx.db.get(k.assessmentId)
        : null;
      if (assessment) {
        try {
          const ver = await ctx.db.get(c.versionId);
          if (
            !ver ||
            ver.sourceUnavailable ||
            assessment.draftVersionId !== c.versionId ||
            assessment.workspaceId !== c.workspaceId ||
            assessment.accountId !== c.accountId
          )
            throw new Error();
          const horizon = Math.min(
            assessment.sourceUntil ?? Infinity,
            (await draftResearchProof(ctx, ver)) ?? Infinity,
          );
          assessment = {
            ...assessment,
            sourceUntil: Number.isFinite(horizon) ? horizon : null,
          };
        } catch {
          assessment = null;
        }
      }
      const snapshots = [];
      for (const windowHours of [24, 48] as const) {
        const r = await ctx.db
          .query("performanceSnapshots")
          .withIndex("by_postAttemptId_and_windowHours", (q) =>
            q.eq("postAttemptId", c._id).eq("windowHours", windowHours),
          )
          .unique();
        if (
          r &&
          r.state !== "removed" &&
          !control?.deleted &&
          r.generation > (control?.deletedThroughGeneration ?? -1)
        )
          snapshots.push(
            r.expiresAt > Date.now()
              ? r
              : {
                  ...r,
                  fields: [],
                  state: "removed" as const,
                  reason: "OWN_METRICS_RETENTION_EXPIRED",
                },
          );
      }
      posts.push({
        postAttemptId: c._id,
        externalId: c.externalId,
        position: c.position,
        confirmedAt: c.confirmedAt,
        coverage: {
          confirmed: publication?.externalPosts?.length ?? 0,
          total: (await ctx.db.get(c.versionId))?.content.text.length ?? null,
        },
        versionId: c.versionId,
        knowledge: k
          ? {
              capturedAt: k.capturedAt,
              assessmentId: k.assessmentId,
              applicable: k.applicable,
              reason:
                k.assessmentId && !assessment
                  ? "ASSESSMENT_SOURCE_UNAVAILABLE"
                  : k.reason,
              assessment,
            }
          : null,
        snapshots,
      });
    }
    return {
      enabled: control?.enabled ?? false,
      reason: reason ?? (control?.enabled ? null : "OWN_METRICS_PAUSED"),
      posts,
    };
  },
});

export const block = internalMutation({
  args: {
    snapshotId: v.id("performanceSnapshots"),
    generation: v.number(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.snapshotId);
    if (row && row.generation === a.generation && row.state === "queued")
      await ctx.db.patch(row._id, {
        state: "blocked",
        reason: a.reason.slice(0, 200),
      });
    return null;
  },
});

export const timeout = internalMutation({
  args: { attemptId: v.id("aiAttempts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.attemptId);
    if (
      !t ||
      t.owner !== "own-metrics" ||
      t.state !== "sent" ||
      t.sentAt + 20000 > Date.now()
    )
      return null;
    await ctx.db.patch(t._id, {
      state: "unknown",
      errorCode: "OWN_METRICS_READ_OUTCOME_UNKNOWN",
    });
    const row = await ctx.db.get(t.snapshotId);
    if (row?.state === "reading" && row.attemptId === t._id)
      await ctx.db.patch(row._id, {
        state: "blocked",
        reason: "OWN_METRICS_READ_OUTCOME_UNKNOWN",
      });
    return null;
  },
});
