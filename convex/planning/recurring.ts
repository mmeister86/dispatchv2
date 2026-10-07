import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { civilDate } from "../../src/lib/time";
import { proposeTransaction } from "./plans";
import {
  seriesAuthority,
  seriesVersionProof,
  seriesPlanProof,
  sourceLoss,
} from "./strategy";

export async function stopSeries(
  ctx: MutationCtx,
  s: Doc<"planningSeries">,
  reason: string,
) {
  if (s.scheduledJobId) await ctx.scheduler.cancel(s.scheduledJobId);
  await ctx.db.patch(s._id, {
    enabled: false,
    nextAt: null,
    nextKey: null,
    scheduledJobId: null,
    reason,
    updatedAt: Date.now(),
  });
}
export async function scheduleNext(
  ctx: MutationCtx,
  s: Doc<"planningSeries">,
  version: Doc<"planningSeriesVersions">,
) {
  const index = s.nextIndex,
    at = version.sequence[index];
  if (!s.enabled || at === undefined || s.remaining <= 0) {
    await ctx.db.patch(s._id, {
      nextAt: null,
      nextKey: null,
      scheduledJobId: null,
      remaining: 0,
    });
    return;
  }
  const key = `series-${s._id}-${s.generation}-${index}-${at}`;
  const scheduledJobId = await ctx.scheduler.runAt(
    at,
    internal.planning.recurring.fire,
    {
      seriesId: s._id,
      versionId: version._id,
      generation: s.generation,
      index,
      at,
      key,
    },
  );
  await ctx.db.patch(s._id, { nextAt: at, nextKey: key, scheduledJobId });
}
export async function scrubPlan(ctx: MutationCtx, plan: Doc<"contentPlans">) {
  if (plan.series)
    await ctx.scheduler.runAfter(
      0,
      internal.performance.experiments.purgeSeries,
      { versionId: plan.series.versionId },
    );
  await ctx.db.patch(plan._id, {
    sourceUnavailable: true,
    semantic: undefined,
    fingerprint: "",
    topics: "",
    preferences: {
      timezone: plan.preferences.timezone,
      language: "",
      audience: "",
      tone: "",
      topics: "",
    },
  });
  const items = await ctx.db
    .query("contentPlanItems")
    .withIndex("by_planId", (q) => q.eq("planId", plan._id))
    .take(8);
  if (items.length > 7) throw new ConvexError("PLAN_ITEM_LIMIT");
  for (const item of items)
    await ctx.db.patch(item._id, {
      sourceUnavailable: true,
      sources: [],
      families: [],
      rootEvidenceIds: [],
      historyVersionIds:
        item.status === "accepted" ? item.historyVersionIds : [],
      reason: "",
    });
  const bindings = await ctx.db
    .query("semanticPlanBindings")
    .withIndex("by_planId", (q) => q.eq("planId", plan._id))
    .take(126);
  if (bindings.length > 125)
    throw new ConvexError("EMBEDDING_FRAME_RESOURCE_CEILING");
  for (const b of bindings)
    await ctx.db.patch(b._id, {
      sourceUnavailable: true,
      fingerprint: null,
      receiptFingerprint: null,
      materialFingerprint: null,
      sourcePin: null,
    });
}
export async function invalidateVersion(
  ctx: MutationCtx,
  versionId: Id<"planningSeriesVersions">,
  erase: boolean,
) {
  const version = await ctx.db.get(versionId);
  if (erase && version && !version.sourceUnavailable)
    await ctx.db.patch(versionId, {
      config: null,
      style: null,
      frameFingerprint: null,
      intentFingerprint: null,
      sourceUnavailable: true,
    });
  await ctx.scheduler.runAfter(
    0,
    internal.performance.experiments.purgeSeries,
    { versionId },
  );
  await ctx.scheduler.runAfter(0, internal.planning.recurring.purgeVersion, {
    versionId,
    cursor: null,
    family: "plans",
  });
}
export const purgeVersion = internalMutation({
  args: {
    versionId: v.id("planningSeriesVersions"),
    cursor: v.union(v.string(), v.null()),
    family: v.union(v.literal("plans"), v.literal("commands")),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.family === "plans") {
      const page = await ctx.db
        .query("contentPlans")
        .withIndex("by_series_versionId", (q) =>
          q.eq("series.versionId", a.versionId),
        )
        .paginate({ cursor: a.cursor, numItems: 1 });
      for (const plan of page.page) await scrubPlan(ctx, plan);
      await ctx.scheduler.runAfter(
        0,
        internal.planning.recurring.purgeVersion,
        page.isDone
          ? { ...a, family: "commands", cursor: null }
          : { ...a, cursor: page.continueCursor },
      );
    } else {
      const page = await ctx.db
        .query("planningSeriesCommands")
        .withIndex("by_versionId", (q) => q.eq("versionId", a.versionId))
        .paginate({ cursor: a.cursor, numItems: 25 });
      for (const c of page.page)
        await ctx.db.patch(c._id, {
          fingerprint: null,
          sourceUnavailable: true,
        });
      if (!page.isDone)
        await ctx.scheduler.runAfter(
          0,
          internal.planning.recurring.purgeVersion,
          { ...a, cursor: page.continueCursor },
        );
    }
    return null;
  },
});
export const purgeVector = internalMutation({
  args: {
    vectorId: v.id("contentEmbeddings"),
    fingerprint: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.scheduler.runAfter(
      0,
      internal.performance.experiments.purgeVector,
      a,
    );
    // The immutable fingerprint targets old receipts even after deletion/replacement; fresh same-ID bindings survive.
    const page = await ctx.db
      .query("semanticPlanBindings")
      .withIndex("by_vectorId_and_fingerprint", (q) =>
        q.eq("vectorId", a.vectorId).eq("fingerprint", a.fingerprint),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const binding of page.page) {
      const plan = await ctx.db.get(binding.planId);
      if (plan) {
        await scrubPlan(ctx, plan);
        if (plan.series) {
          const s = await ctx.db.get(plan.series.seriesId);
          if (s?.versionId === plan.series.versionId)
            await stopSeries(ctx, s, "SERIES_SOURCE_UNAVAILABLE");
          await invalidateVersion(ctx, plan.series.versionId, true);
        }
      } else
        await ctx.db.patch(binding._id, {
          sourceUnavailable: true,
          fingerprint: null,
          receiptFingerprint: null,
          materialFingerprint: null,
          sourcePin: null,
        });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.planning.recurring.purgeVector, {
        ...a,
        cursor: page.continueCursor,
      });
    return null;
  },
});
export const purgeStyle = internalMutation({
  args: {
    versionId: v.id("styleProfileVersions"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("planningSeriesVersions")
      .withIndex("by_style_versionId", (q) =>
        q.eq("style.versionId", a.versionId),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const version of page.page) {
      const s = await ctx.db.get(version.seriesId);
      if (s?.versionId === version._id)
        await stopSeries(ctx, s, "STYLE_SOURCE_UNAVAILABLE");
      await invalidateVersion(ctx, version._id, true);
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.planning.recurring.purgeStyle, {
        ...a,
        cursor: page.continueCursor,
      });
    return null;
  },
});
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("planningSeriesVersions")
      .withIndex("by_sourceUnavailable", (q) =>
        q.eq("sourceUnavailable", false),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const version of page.page) {
      const s = await ctx.db.get(version.seriesId);
      try {
        if (!s) throw new ConvexError("SERIES_SOURCE_UNAVAILABLE");
        const x = await seriesVersionProof(
          ctx,
          s,
          version,
          s.versionId === version._id,
        );
        if (x.until <= Date.now())
          throw new ConvexError("SERIES_SOURCE_UNAVAILABLE");
        if (s.enabled && s.nextAt !== null && s.nextAt >= x.until)
          await stopSeries(ctx, s, "SERIES_SOURCE_UNAVAILABLE");
        if (x.until < version.sourceUntil)
          await ctx.db.patch(version._id, { sourceUntil: x.until });
        const plans = await ctx.db
          .query("contentPlans")
          .withIndex("by_series_versionId", (q) =>
            q.eq("series.versionId", version._id),
          )
          .take(5);
        if (plans.length > 4)
          throw new ConvexError("EMBEDDING_FRAME_RESOURCE_CEILING");
        for (const plan of plans) {
          const items = await ctx.db
            .query("contentPlanItems")
            .withIndex("by_planId", (q) => q.eq("planId", plan._id))
            .take(8);
          if (items.length > 7) throw new ConvexError("PLAN_ITEM_LIMIT");
          if (plan.sourceUnavailable) continue;
          if (
            !s.enabled ||
            s.versionId !== version._id ||
            s.generation !== plan.series!.generation ||
            items.some((i) => i.at >= x.until)
          )
            await scrubPlan(ctx, plan);
          else if (x.until < plan.series!.sourceUntil)
            await ctx.db.patch(plan._id, {
              series: { ...plan.series!, sourceUntil: x.until },
              semantic: plan.semantic
                ? {
                    ...plan.semantic,
                    sourceUntil: Math.min(plan.semantic.sourceUntil, x.until),
                  }
                : undefined,
            });
        }
      } catch (e) {
        sourceLoss(e);
        let erase = true;
        if (
          s &&
          e instanceof ConvexError &&
          e.data === "STYLE_SELECTION_CHANGED"
        ) {
          try {
            await seriesVersionProof(ctx, s, version, false);
            erase = false;
          } catch (retainedError) {
            sourceLoss(retainedError);
          }
        }
        if (s?.versionId === version._id)
          await stopSeries(
            ctx,
            s,
            e instanceof ConvexError
              ? String(e.data)
              : "SERIES_SOURCE_UNAVAILABLE",
          );
        await invalidateVersion(ctx, version._id, erase);
      }
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.planning.recurring.sweep, {
        cursor: page.continueCursor,
      });
    return null;
  },
});
export const fire = internalMutation({
  args: {
    seriesId: v.id("planningSeries"),
    versionId: v.id("planningSeriesVersions"),
    generation: v.number(),
    at: v.number(),
    index: v.number(),
    key: v.string(),
  },
  returns: v.union(v.id("contentPlans"), v.null()),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.seriesId),
      version = await ctx.db.get(a.versionId);
    if (
      !s ||
      !version ||
      !s.enabled ||
      s.versionId !== a.versionId ||
      s.generation !== a.generation ||
      !Number.isSafeInteger(a.generation) ||
      !Number.isSafeInteger(a.index) ||
      a.index < 0 ||
      a.index >= 4 ||
      !Number.isSafeInteger(a.at) ||
      a.at > Date.now() ||
      version.sequence[a.index] !== a.at ||
      a.key !== `series-${s._id}-${a.generation}-${a.index}-${a.at}`
    )
      return null;
    // Read exact replay only after current durable actor/source admission; no counters/jobs are changed by replay.
    let proof;
    try {
      await seriesAuthority(ctx, s);
      proof = await seriesVersionProof(ctx, s, version);
    } catch (e) {
      sourceLoss(e);
      let erase = true;
      if (e instanceof ConvexError && e.data === "STYLE_SELECTION_CHANGED") {
        try {
          await seriesVersionProof(ctx, s, version, false);
          erase = false;
        } catch (retainedError) {
          sourceLoss(retainedError);
        }
      }
      await stopSeries(
        ctx,
        s,
        e instanceof ConvexError ? String(e.data) : "SERIES_SOURCE_UNAVAILABLE",
      );
      await invalidateVersion(ctx, version._id, erase);
      return null;
    }
    const old = await ctx.db
      .query("contentPlans")
      .withIndex(
        "by_series_seriesId_and_series_generation_and_series_at",
        (q) =>
          q
            .eq("series.seriesId", s._id)
            .eq("series.generation", a.generation)
            .eq("series.at", a.at),
      )
      .unique();
    if (old) return old._id;
    if (
      s.nextIndex !== a.index ||
      s.nextAt !== a.at ||
      s.nextKey !== a.key ||
      s.remaining <= 0
    )
      return null;
    const c = version.config!;
    // A missed civil callback day is skipped. Finite original indices alone determine the next future callback.
    if (
      civilDate(new Date(Date.now()).toISOString(), c.timezone) !==
      civilDate(new Date(a.at).toISOString(), c.timezone)
    ) {
      let next = a.index + 1;
      while (
        next < version.sequence.length &&
        version.sequence[next] <= Date.now()
      )
        next++;
      await ctx.db.patch(s._id, {
        nextIndex: next,
        remaining: version.sequence.length - next,
        nextAt: null,
        nextKey: null,
        scheduledJobId: null,
      });
      await scheduleNext(ctx, (await ctx.db.get(s._id))!, version);
      return null;
    }
    const previous = await ctx.db
      .query("contentPlans")
      .withIndex("by_series_versionId", (q) =>
        q.eq("series.versionId", version._id),
      )
      .take(5);
    if (previous.length > 4)
      throw new ConvexError("EMBEDDING_FRAME_RESOURCE_CEILING");
    const previousVersionIds: Id<"draftVersions">[] = [];
    for (const p of previous) {
      if (p.sourceUnavailable)
        throw new ConvexError("SERIES_SOURCE_UNAVAILABLE");
      const items = await ctx.db
        .query("contentPlanItems")
        .withIndex("by_planId", (q) => q.eq("planId", p._id))
        .take(8);
      if (items.length > 7) throw new ConvexError("PLAN_ITEM_LIMIT");
      previousVersionIds.push(...items.map((i) => i.versionId));
    }
    const date = civilDate(new Date(a.at).toISOString(), c.timezone),
      series = {
        seriesId: s._id,
        versionId: version._id,
        generation: a.generation,
        at: a.at,
        index: a.index,
        key: a.key,
        sourceUntil: proof.until,
      };
    const id = await proposeTransaction(
      ctx,
      s.workspaceId,
      s.actorId,
      {
        accountId: s.accountId,
        preferenceId: c.preferenceId,
        desiredCount: c.itemsPerBatch,
        start: date,
        end: date,
        timezone: c.timezone,
        clock: c.publishingClocks[0],
        mode: "mixed",
        topics: c.theme,
        commandKey: a.key,
      },
      {
        series,
        semantic: {
          identity: proof.frame.identity!,
          vectorCount: proof.frame.native.rows.length,
          sourceUntil: proof.until,
          threshold: c.threshold,
          style: version.style!,
          desiredFormat: c.desiredFormat,
          formatProven: false,
          timingProven: false,
        },
        frame: proof.frame,
        candidateVersionIds: c.candidateVersionIds,
        previousVersionIds,
        slots: c.publishingClocks.map((clock) => `${date}T${clock}`),
      },
    );
    const next = a.index + 1;
    await ctx.db.patch(s._id, {
      nextIndex: next,
      remaining: version.sequence.length - next,
      nextAt: null,
      nextKey: null,
      scheduledJobId: null,
    });
    await scheduleNext(ctx, (await ctx.db.get(s._id))!, version);
    return id;
  },
});
