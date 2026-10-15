import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  workspaceMutation,
  workspaceQuery,
  requireWorkspace,
  requireReference,
  requireRole,
} from "../lib/authorization";
import { sha256 } from "../lib/crypto";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import { captureStyle, scopedStyleProof } from "../ai/styleProfiles";
import { materialWalk } from "../research/pipelineAccess";
import { preparedFrame, vectorFingerprint } from "../content/similarity";
import { nextOccurrence, validateClock } from "../research/time";
import { addCivilDays, civilDate } from "../../src/lib/time";
import { config, controlDoc, versionDoc, result } from "./strategyFields";
import { scheduleNext, stopSeries, invalidateVersion } from "./recurring";
type Ctx = QueryCtx | MutationCtx;
export type Config = Infer<typeof config>;
function fail(code: string): never {
  throw new ConvexError(code);
}
export function sourceLoss(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === "string") {
    if (
      [
        "STYLE_ANCESTRY_LIMIT",
        "RESEARCH_PROOF_ANCESTRY_LIMIT",
        "EMBEDDING_FRAME_RESOURCE_CEILING",
      ].includes(e.data)
    )
      throw e;
    if (
      [
        "SERIES_SOURCE_UNAVAILABLE",
        "SERIES_AUTHORITY_CHANGED",
        "SERIES_VERSION_CHANGED",
        "SERIES_FRAME_CHANGED",
        "SERIES_HISTORY_SUPPORT_REQUIRED",
      ].includes(e.data)
    )
      return;
  }
  rethrowUnexpectedSourceError(e);
}
export function finiteSequence(c: Config, now: number) {
  validateClock({
    timeZone: c.timezone,
    clock: c.callbackClock,
    weekday: c.weekday,
  });
  const validDate = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(`${s}T12:00Z`)) &&
    new Date(`${s}T12:00Z`).toISOString().slice(0, 10) === s;
  if (
    !validDate(c.start) ||
    !validDate(c.end) ||
    c.start > c.end ||
    (Date.parse(`${c.end}T12:00Z`) - Date.parse(`${c.start}T12:00Z`)) /
      86400000 >=
      28 ||
    !Number.isSafeInteger(c.occurrences) ||
    c.occurrences < 1 ||
    c.occurrences > 4 ||
    !Number.isSafeInteger(c.itemsPerBatch) ||
    c.itemsPerBatch < 1 ||
    c.itemsPerBatch > 7 ||
    !c.theme.trim() ||
    c.theme.length > 200 ||
    !Number.isFinite(c.threshold) ||
    c.threshold <= -1 ||
    c.threshold > 1 ||
    !c.candidateVersionIds.length ||
    c.candidateVersionIds.length > 25 ||
    new Set(c.candidateVersionIds).size !== c.candidateVersionIds.length ||
    !c.pillars.length ||
    c.pillars.length > 10 ||
    new Set(c.pillars.map((p) => p.name)).size !== c.pillars.length ||
    !c.publishingClocks.length ||
    c.publishingClocks.length > 7 ||
    new Set(c.publishingClocks).size !== c.publishingClocks.length ||
    !Number.isSafeInteger(c.historyFrom) ||
    !Number.isSafeInteger(c.historyTo) ||
    c.historyFrom < 0 ||
    c.historyTo < c.historyFrom ||
    c.historyTo > now
  )
    fail("SERIES_INPUT_INVALID");
  for (const clock of c.publishingClocks)
    validateClock({ timeZone: c.timezone, clock, weekday: c.weekday });
  const sequence: number[] = [];
  let after = Date.parse(`${addCivilDays(c.start, -2)}T12:00Z`);
  // Reuse callback policy: first overlap, skip gaps. Exactly one match is still required for publishing slots.
  for (let probe = 0; probe < 7 && sequence.length < c.occurrences; probe++) {
    const at = nextOccurrence(
      {
        frequency: "weekly",
        timeZone: c.timezone,
        clock: c.callbackClock,
        weekday: c.weekday,
      },
      after,
    )!;
    const date = civilDate(new Date(at).toISOString(), c.timezone);
    if (date > c.end) break;
    if (date >= c.start) sequence.push(at);
    after = at;
  }
  if (sequence.length !== c.occurrences || sequence[0] <= now)
    fail("SERIES_PERIOD_INVALID");
  return sequence;
}
async function actorFingerprint(
  user: Doc<"users">,
  membership: Doc<"memberships">,
) {
  return sha256(
    JSON.stringify([
      user._id,
      user._creationTime,
      user.authId,
      membership._id,
      membership._creationTime,
    ]),
  );
}
export async function seriesAuthority(ctx: Ctx, s: Doc<"planningSeries">) {
  const user = await ctx.db.get(s.actorId);
  if (!user) fail("SERIES_AUTHORITY_CHANGED");
  const scope = await requireWorkspace(ctx, s.workspaceId, user!);
  requireRole(scope.membership, ["Owner", "Admin", "Editor"]);
  if (
    scope.membership._id !== s.membershipId ||
    (await actorFingerprint(user!, scope.membership)) !== s.actorFingerprint
  )
    fail("SERIES_AUTHORITY_CHANGED");
  const account = requireReference(
    s.workspaceId,
    await ctx.db.get(s.accountId),
  ) as Doc<"socialAccounts">;
  if (
    account.connection !== "connected" ||
    account.providerIdentity !== s.providerIdentity ||
    (account.xEvidence?.connectionSequence ?? 0) !== s.connectionSequence
  )
    fail("SERIES_AUTHORITY_CHANGED");
  return scope;
}
async function versionFingerprint(
  v: Pick<
    Doc<"planningSeriesVersions">,
    | "seriesId"
    | "revision"
    | "actorId"
    | "config"
    | "style"
    | "frameFingerprint"
    | "sequence"
    | "embeddingControlId"
    | "embeddingGeneration"
  >,
) {
  const c = v.config!,
    p = v.style!;
  return sha256(
    JSON.stringify([
      v.seriesId,
      v.revision,
      v.actorId,
      c.preferenceId,
      c.styleVersionId,
      c.theme,
      c.candidateVersionIds,
      c.pillars.map((p) => [p.name, p.weight]),
      c.desiredFormat,
      c.threshold,
      c.timezone,
      c.frequency,
      c.weekday,
      c.callbackClock,
      c.publishingClocks,
      c.start,
      c.end,
      c.occurrences,
      c.itemsPerBatch,
      c.historyFrom,
      c.historyTo,
      p.versionId,
      p.fingerprint,
      p.selectedBy,
      p.selectionReceiptId,
      p.sourceUntil,
      v.frameFingerprint,
      v.sequence,
      v.embeddingControlId,
      v.embeddingGeneration,
    ]),
  );
}
export async function seriesVersionProof(
  ctx: Ctx,
  s: Doc<"planningSeries">,
  version: Doc<"planningSeriesVersions">,
  current = true,
  walk = materialWalk(),
) {
  await seriesAuthority(ctx, s);
  if (
    version.workspaceId !== s.workspaceId ||
    version.accountId !== s.accountId ||
    version.seriesId !== s._id ||
    version.actorId !== s.actorId ||
    version.sourceUnavailable ||
    !version.config ||
    !version.style ||
    !version.frameFingerprint ||
    version.sourceUntil <= Date.now()
  )
    fail("SERIES_SOURCE_UNAVAILABLE");
  if (version.intentFingerprint !== (await versionFingerprint(version)))
    fail("SERIES_VERSION_CHANGED");
  const style = await scopedStyleProof(ctx, s, version.style!, current, walk);
  if (
    !style.payload ||
    JSON.stringify(version.config!.pillars) !==
      JSON.stringify(
        style.payload.pillars.filter((p) =>
          version.config!.pillars.some((q) => q.name === p.name),
        ),
      )
  )
    fail("SERIES_SOURCE_UNAVAILABLE");
  const c = version.config!,
    frame = await preparedFrame(
      ctx,
      s.workspaceId,
      {
        accountId: s.accountId,
        source: { kind: "draft", draftVersionId: c.candidateVersionIds[0] },
        from: c.historyFrom,
        to: c.historyTo,
        candidateVersionIds: c.candidateVersionIds,
        topK: 1,
      },
      walk.budget.counted,
    );
  walk.budget.remaining = 32 - walk.budget.counted.size;
  if (frame.reason === "EMBEDDING_FRAME_RESOURCE_CEILING") fail(frame.reason);
  if (
    !frame.complete ||
    !frame.identity ||
    !frame.native.control ||
    !frame.native.rows.length
  )
    fail("SERIES_SOURCE_UNAVAILABLE");
  if (
    frame.native.control._id !== version.embeddingControlId ||
    frame.native.control.generation !== version.embeddingGeneration ||
    (await frameFingerprint(frame)) !== version.frameFingerprint
  )
    fail("SERIES_FRAME_CHANGED");
  return {
    frame,
    until: Math.min(
      version.sourceUntil,
      style.sourceUntil ?? Infinity,
      frame.sourceUntil!,
    ),
  };
}
export async function frameFingerprint(
  frame: Awaited<ReturnType<typeof preparedFrame>>,
) {
  const manifest = [];
  for (const p of frame.native.rows) {
    const t = p.attempt;
    if (
      t.state !== "settled" ||
      t.inputTokens === null ||
      !Number.isSafeInteger(t.inputTokens) ||
      t.inputTokens < 0 ||
      t.inputTokens > 1e9 ||
      t.receiptFingerprint !==
        (await sha256(JSON.stringify([t.inputTokens, t.model, t.identity]))) ||
      t.estimatedMicros !==
        Number(
          (BigInt(t.inputTokens) * BigInt(t.inputMicrosPerMillion) + 999999n) /
            1000000n,
        )
    )
      fail("SERIES_SOURCE_UNAVAILABLE");
    manifest.push([
      p.row._id,
      await vectorFingerprint(p.row),
      p.receiptFingerprint,
    ]);
  }
  return sha256(JSON.stringify(manifest));
}
export async function seriesPlanProof(
  ctx: Ctx,
  plan: Doc<"contentPlans">,
  current = true,
  walk = materialWalk(),
  versions?: Map<
    Id<"planningSeriesVersions">,
    Awaited<ReturnType<typeof seriesVersionProof>>
  >,
) {
  if (!plan.series) return null;
  const s = await ctx.db.get(plan.series.seriesId),
    version = await ctx.db.get(plan.series.versionId);
  if (
    !s ||
    !version ||
    (current &&
      (!s.enabled ||
        s.generation !== plan.series.generation ||
        s.versionId !== version._id)) ||
    plan.sourceUnavailable ||
    !plan.semantic
  )
    fail("SERIES_VERSION_CHANGED");
  const x =
    versions?.get(version._id) ??
    (await seriesVersionProof(ctx, s, version, current, walk));
  versions?.set(version._id, x);
  const bindings = await ctx.db
    .query("semanticPlanBindings")
    .withIndex("by_planId", (q) => q.eq("planId", plan._id))
    .take(126);
  if (bindings.length > 125) fail("EMBEDDING_FRAME_RESOURCE_CEILING");
  if (
    bindings.length !== plan.semantic!.vectorCount ||
    bindings.length !== x.frame.native.rows.length
  )
    fail("SERIES_FRAME_CHANGED");
  let until = Math.min(
    plan.series.sourceUntil,
    plan.semantic!.sourceUntil,
    x.until,
  );
  for (const b of bindings) {
    const p = x.frame.native.rows.find((p) => p.row._id === b.vectorId);
    if (
      !p ||
      b.sourceUnavailable ||
      b.fingerprint !== (await vectorFingerprint(p.row)) ||
      b.attemptId !== p.row.attemptId ||
      b.receiptFingerprint !== p.receiptFingerprint ||
      b.materialFingerprint !== p.row.materialFingerprint ||
      JSON.stringify(b.sourcePin) !== JSON.stringify(p.row.sourcePin)
    )
      fail("SERIES_FRAME_CHANGED");
    until = Math.min(until, b.sourceUntil, p.until);
  }
  return until;
}
export const change = workspaceMutation({
  args: {
    accountId: v.id("socialAccounts"),
    seriesId: v.optional(v.id("planningSeries")),
    expectedRevision: v.number(),
    commandKey: v.string(),
    action: v.union(
      v.object({ kind: v.literal("configure"), config }),
      v.object({ kind: v.literal("disable") }),
    ),
  },
  returns: result,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(a.commandKey) ||
      !Number.isSafeInteger(a.expectedRevision) ||
      a.expectedRevision < 0
    )
      fail("SERIES_INPUT_INVALID");
    const account = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.accountId),
    ) as Doc<"socialAccounts">;
    let s = a.seriesId
      ? await ctx.db.get(a.seriesId)
      : await ctx.db
          .query("planningSeries")
          .withIndex("by_workspaceId_and_accountId", (q) =>
            q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
          )
          .unique();
    if (
      s &&
      (s.workspaceId !== ctx.workspace._id || s.accountId !== a.accountId)
    )
      fail("REFERENCE_ACCESS_DENIED");
    const fingerprint = await sha256(
      JSON.stringify([a.accountId, a.expectedRevision, a.action]),
    );
    if (s) {
      const old = await ctx.db
        .query("planningSeriesCommands")
        .withIndex("by_seriesId_and_actorId_and_commandKey", (q) =>
          q
            .eq("seriesId", s!._id)
            .eq("actorId", ctx.user._id)
            .eq("commandKey", a.commandKey),
        )
        .unique();
      if (old) {
        if (old.sourceUnavailable || old.fingerprint !== fingerprint)
          fail("SERIES_OPERATION_CONFLICT");
        await seriesAuthority(ctx, s);
        return {
          seriesId: s._id,
          revision: old.revision,
          versionId: old.versionId,
          receiptId: old._id,
        };
      }
    }
    if (
      (s?.generation ?? 0) >= Number.MAX_SAFE_INTEGER ||
      a.expectedRevision >= Number.MAX_SAFE_INTEGER
    )
      fail("SERIES_INPUT_INVALID");
    if ((s?.revision ?? 0) !== a.expectedRevision)
      fail("SERIES_REVISION_CONFLICT");
    if (s && s.actorId !== ctx.user._id) fail("SERIES_AUTHORITY_CHANGED");
    let prepared:
      | {
          style: NonNullable<Awaited<ReturnType<typeof captureStyle>>>;
          frame: Awaited<ReturnType<typeof preparedFrame>>;
          sequence: number[];
          until: number;
        }
      | undefined;
    if (a.action.kind === "configure") {
      const c = a.action.config,
        sequence = finiteSequence(c, Date.now());
      const preference = await ctx.db.get(c.preferenceId);
      if (
        !preference ||
        preference.workspaceId !== ctx.workspace._id ||
        preference.userId !== ctx.user._id
      )
        fail("REFERENCE_ACCESS_DENIED");
      if (account.connection !== "connected" || !account.providerIdentity)
        fail("SERIES_AUTHORITY_CHANGED");
      const style = await captureStyle(ctx, ctx.workspace._id, a.accountId);
      if (!style) fail("STYLE_SELECTION_REQUIRED");
      if (style.versionId !== c.styleVersionId) fail("STYLE_SELECTION_CHANGED");
      const walk = materialWalk(),
        proof = await scopedStyleProof(
          ctx,
          { workspaceId: ctx.workspace._id, accountId: a.accountId },
          style,
          true,
          walk,
        );
      if (
        JSON.stringify(c.pillars) !==
        JSON.stringify(
          proof.payload.pillars.filter((p) =>
            c.pillars.some((q) => q.name === p.name),
          ),
        )
      )
        fail("SERIES_INPUT_INVALID");
      const frame = await preparedFrame(
        ctx,
        ctx.workspace._id,
        {
          accountId: a.accountId,
          source: { kind: "draft", draftVersionId: c.candidateVersionIds[0] },
          from: c.historyFrom,
          to: c.historyTo,
          candidateVersionIds: c.candidateVersionIds,
          topK: 1,
        },
        walk.budget.counted,
      );
      if (!frame.complete || !frame.native.control || !frame.identity)
        fail(frame.reason ?? "SERIES_SOURCE_UNAVAILABLE");
      if (!frame.native.rows.some((p) => p.row.sourcePin.kind === "history"))
        fail("SERIES_HISTORY_SUPPORT_REQUIRED");
      prepared = {
        style,
        frame,
        sequence,
        until: Math.min(style.sourceUntil ?? Infinity, frame.sourceUntil!),
      };
      if (prepared.until <= sequence[0]) fail("SERIES_SOURCE_UNAVAILABLE");
    }
    const revision = (s?.revision ?? 0) + 1,
      generation = (s?.generation ?? 0) + 1;
    if (s) {
      await stopSeries(ctx, s, "SERIES_VERSION_CHANGED");
      if (s.versionId) await invalidateVersion(ctx, s.versionId, false);
    } else {
      const id = await ctx.db.insert("planningSeries", {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        revision: 0,
        generation: 0,
        enabled: false,
        versionId: null,
        actorId: ctx.user._id,
        membershipId: ctx.membership._id,
        actorFingerprint: await actorFingerprint(ctx.user, ctx.membership),
        providerIdentity: account.providerIdentity ?? "",
        connectionSequence: account.xEvidence?.connectionSequence ?? 0,
        nextAt: null,
        nextIndex: 0,
        nextKey: null,
        remaining: 0,
        scheduledJobId: null,
        reason: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      s = (await ctx.db.get(id))!;
    }
    let versionId: Id<"planningSeriesVersions"> | null = null;
    if (prepared && a.action.kind === "configure") {
      const data = {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        seriesId: s._id,
        revision,
        actorId: ctx.user._id,
        config: a.action.config,
        style: prepared.style,
        frameFingerprint: await frameFingerprint(prepared.frame),
        sourceUntil: prepared.until,
        embeddingControlId: prepared.frame.native.control!._id,
        embeddingGeneration: prepared.frame.native.control!.generation,
        sequence: prepared.sequence,
        sourceUnavailable: false,
        createdAt: Date.now(),
      };
      versionId = await ctx.db.insert("planningSeriesVersions", {
        ...data,
        intentFingerprint: await versionFingerprint(data),
      });
    }
    await ctx.db.patch(s._id, {
      revision,
      generation,
      versionId,
      enabled: !!versionId,
      nextIndex: 0,
      remaining: prepared?.sequence.length ?? 0,
      reason: versionId ? null : "SERIES_DISABLED",
      updatedAt: Date.now(),
      ...(versionId
        ? {
            membershipId: ctx.membership._id,
            actorFingerprint: await actorFingerprint(ctx.user, ctx.membership),
            providerIdentity: account.providerIdentity!,
            connectionSequence: account.xEvidence?.connectionSequence ?? 0,
          }
        : {}),
    });
    if (versionId)
      await scheduleNext(
        ctx,
        (await ctx.db.get(s._id))!,
        (await ctx.db.get(versionId))!,
      );
    const receiptId = await ctx.db.insert("planningSeriesCommands", {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      seriesId: s._id,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      fingerprint,
      expectedRevision: a.expectedRevision,
      revision,
      versionId,
      generation,
      sourceUnavailable: false,
      createdAt: Date.now(),
    });
    return { seriesId: s._id, revision, versionId, receiptId };
  },
});
export const get = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.object({
    control: v.union(controlDoc, v.null()),
    version: v.union(versionDoc, v.null()),
    reason: v.union(v.string(), v.null()),
    candidates: v.array(
      v.object({
        versionId: v.id("draftVersions"),
        title: v.string(),
        sourceUntil: v.union(v.number(), v.null()),
      }),
    ),
    pillars: v.array(v.object({ name: v.string(), weight: v.number() })),
    styleUntil: v.union(v.number(), v.null()),
    selectedStyleVersionId: v.union(v.id("styleProfileVersions"), v.null()),
  }),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const s = await ctx.db
      .query("planningSeries")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .unique();
    let version = s?.versionId ? await ctx.db.get(s.versionId) : null,
      reason = s?.reason ?? null;
    if (version)
      try {
        const proof = await seriesVersionProof(ctx, s!, version);
        version = { ...version, sourceUntil: proof.until };
      } catch (e) {
        sourceLoss(e);
        reason =
          e instanceof ConvexError
            ? String(e.data)
            : "SERIES_SOURCE_UNAVAILABLE";
        version = {
          ...version,
          config: null,
          style: null,
          frameFingerprint: null,
          intentFingerprint: null,
          sourceUnavailable: true,
        };
      }
    const candidates: {
      versionId: Id<"draftVersions">;
      title: string;
      sourceUntil: number | null;
    }[] = [];
    const rows = await ctx.db
      .query("drafts")
      .withIndex("by_workspaceId_and_updatedAt", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .order("desc")
      .take(26);
    const { projectDraft } = await import("../research/contentProof");
    for (const d of rows.slice(0, 25))
      if (d.currentVersionId) {
        const v = await ctx.db.get(d.currentVersionId);
        if (v?.content.accountId !== a.accountId) continue;
        const p = await projectDraft(ctx, v);
        if (!p.sourceUnavailable)
          candidates.push({
            versionId: v._id,
            title: p.content.title,
            sourceUntil:
              "sourceProofUntil" in p ? (p.sourceProofUntil as number) : null,
          });
      }
    let pillars: { name: string; weight: number }[] = [],
      styleUntil: number | null = null,
      selectedStyleVersionId: Id<"styleProfileVersions"> | null = null;
    try {
      const style = await captureStyle(ctx, ctx.workspace._id, a.accountId);
      if (style) {
        const proof = await scopedStyleProof(
          ctx,
          { workspaceId: ctx.workspace._id, accountId: a.accountId },
          style,
          true,
        );
        selectedStyleVersionId = style.versionId;
        pillars = proof.payload.pillars;
        styleUntil = proof.sourceUntil;
      }
    } catch (e) {
      sourceLoss(e);
      reason ??=
        e instanceof ConvexError ? String(e.data) : "SERIES_SOURCE_UNAVAILABLE";
    }
    return {
      control: s ? { ...s, actorFingerprint: "" } : null,
      version,
      reason,
      candidates,
      pillars,
      styleUntil,
      selectedStyleVersionId,
    };
  },
});
