import { fixture } from "../../tests/planning-series-fixture";
import { writeFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { sourceFixture, send } from "../../tests/github-fixture";
import { finiteSequence } from "./strategy";
import { vectorFingerprint } from "../content/similarity";
import { sha256 } from "../lib/crypto";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("four native finite callbacks, exact replay, fifth/stale/disable have zero transport or native appointments", async () => {
  const f = await fixture(),
    transport = vi.fn();
  vi.stubGlobal("fetch", transport);
  const r = await f.create();
  expect(await f.create()).toEqual(r);
  const ids = [];
  for (let i = 0; i < 4; i++) {
    const before = (await f.t.run((ctx) => ctx.db.get(r.seriesId)))!;
    const id = await f.fire(r.seriesId);
    ids.push(id);
    const after = await f.t.run((ctx) => ctx.db.get(r.seriesId));
    expect(after!.remaining).toBe(3 - i);
    expect(
      await f.t.mutation(internal.planning.recurring.fire, {
        seriesId: r.seriesId,
        versionId: r.versionId!,
        generation: before.generation,
        at: before.nextAt!,
        index: i,
        key: before.nextKey!,
      }),
    ).toBe(id);
    expect(await f.t.run((ctx) => ctx.db.get(r.seriesId))).toEqual(after);
  }
  expect(new Set(ids).size).toBe(4);
  expect(
    await f.t.run((ctx) => ctx.db.query("contentPlans").collect()),
  ).toHaveLength(4);
  expect(
    await f.t.run((ctx) => ctx.db.query("contentPlanItems").collect()),
  ).toHaveLength(4);
  const s = (await f.t.run((ctx) => ctx.db.get(r.seriesId)))!;
  expect(s.nextAt).toBeNull();
  expect(s.scheduledJobId).toBeNull();
  expect(
    await f.t.mutation(internal.planning.recurring.fire, {
      seriesId: r.seriesId,
      versionId: r.versionId!,
      generation: 1,
      index: 4,
      at: Date.now(),
      key: "fifth",
    }),
  ).toBeNull();
  expect(transport).not.toHaveBeenCalled();
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(0);
});
test("real propose then select two of three creates exactly two native schedules; disable masks before physical cleanup and acceptance replay remains inert", async () => {
  const f = await fixture(),
    r = await f.create(),
    id = (await f.fire(r.seriesId))!;
  const p = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: id,
  });
  expect(p.items).toHaveLength(3);
  const args = {
    workspaceId: f.workspaceId,
    planId: id,
    mode: "approve_and_schedule" as const,
    selections: p.items.slice(0, 2).map(({ item }) => ({
      itemId: item._id,
      versionId: item.versionId,
      draftRevision: item.draftRevision,
    })),
  };
  const accepted = await f.signed.mutation(api.planning.accept.selected, args);
  const financial = await f.t.run(async (ctx) => ({
    schedules: await ctx.db.query("schedules").collect(),
    approvals: await ctx.db.query("approvals").collect(),
    budgets: await ctx.db.query("aiBudgets").collect(),
    attempts: await ctx.db.query("aiAttempts").collect(),
  }));
  expect(financial.schedules).toHaveLength(2);
  expect(await f.signed.mutation(api.planning.accept.selected, args)).toEqual(
    accepted,
  );
  await f.signed.mutation(api.planning.strategy.change, {
    ...f.request,
    seriesId: r.seriesId,
    expectedRevision: 1,
    commandKey: "disable",
    action: { kind: "disable" },
  });
  const masked = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: id,
  });
  expect(masked.plan.semantic).toBeUndefined();
  expect(
    masked.items.every(
      (i) => !i.title && !i.item.reason && !i.item.sources.length,
    ),
  ).toBe(true);
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      ...args,
      selections: [
        {
          itemId: p.items[2].item._id,
          versionId: p.items[2].item.versionId,
          draftRevision: p.items[2].item.draftRevision,
        },
      ],
    }),
  ).rejects.toThrow("SERIES_VERSION_CHANGED");
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect(
    (
      await f.t.run((ctx) => ctx.db.query("semanticPlanBindings").collect())
    ).every((b) => b.fingerprint === null && b.sourcePin === null),
  ).toBe(true);
  expect(await f.signed.mutation(api.planning.accept.selected, args)).toEqual(
    accepted,
  );
  expect(
    await f.t.run(async (ctx) => ({
      schedules: await ctx.db.query("schedules").collect(),
      approvals: await ctx.db.query("approvals").collect(),
      budgets: await ctx.db.query("aiBudgets").collect(),
      attempts: await ctx.db.query("aiAttempts").collect(),
    })),
  ).toEqual(financial);
});
test("CAS, changed command intent, original membership identity and partial semantic frame fail closed", async () => {
  const f = await fixture(),
    r = await f.create();
  await expect(
    f.signed.mutation(api.planning.strategy.change, {
      ...f.request,
      action: {
        ...f.request.action,
        config: { ...f.config, theme: "Changed" },
      },
    }),
  ).rejects.toThrow("SERIES_OPERATION_CONFLICT");
  await expect(
    f.signed.mutation(api.planning.strategy.change, {
      ...f.request,
      commandKey: "stale",
    }),
  ).rejects.toThrow("SERIES_REVISION_CONFLICT");
  const s = (await f.t.run((ctx) => ctx.db.get(r.seriesId)))!;
  await f.t.run(async (ctx) => {
    const m = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.delete(m._id);
    await ctx.db.insert("memberships", {
      userId: f.userId,
      workspaceId: f.workspaceId,
      role: "Owner",
    });
  });
  vi.setSystemTime(s.nextAt!);
  expect(
    await f.t.mutation(internal.planning.recurring.fire, {
      seriesId: r.seriesId,
      versionId: r.versionId!,
      generation: s.generation,
      index: 0,
      at: s.nextAt!,
      key: s.nextKey!,
    }),
  ).toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(r.seriesId)))!.enabled).toBe(false);
  expect(
    await f.t.run((ctx) => ctx.db.query("contentPlans").collect()),
  ).toHaveLength(0);
});
test("Berlin callback overlap is first, gap is skipped, period/count invalid; delayed finite callback skips missed indices without backfill", async () => {
  const f = await fixture();
  const c = {
    ...f.config,
    timezone: "Europe/Berlin",
    weekday: 0,
    callbackClock: "02:30",
    start: "2026-10-18",
    end: "2026-11-14",
    occurrences: 4,
  };
  expect(finiteSequence(c, Date.parse("2026-10-06T08:00Z"))[1]).toBe(
    Date.parse("2026-10-25T00:30Z"),
  );
  expect(
    finiteSequence(
      {
        ...c,
        start: "2026-03-22",
        end: "2026-04-18",
        occurrences: 3,
        historyFrom: 0,
        historyTo: Date.parse("2026-03-01T00:00Z"),
      },
      Date.parse("2026-03-01T00:00Z"),
    ),
  ).toEqual(
    ["2026-03-22T01:30Z", "2026-04-05T00:30Z", "2026-04-12T00:30Z"].map(
      Date.parse,
    ),
  );
  expect(() =>
    finiteSequence({ ...f.config, occurrences: 5 }, Date.now()),
  ).toThrow("SERIES_INPUT_INVALID");
  const r = await f.create(),
    s = (await f.t.run((ctx) => ctx.db.get(r.seriesId)))!;
  vi.setSystemTime(Date.parse("2026-10-22T09:00Z"));
  expect(
    await f.t.mutation(internal.planning.recurring.fire, {
      seriesId: r.seriesId,
      versionId: r.versionId!,
      generation: s.generation,
      index: 0,
      at: s.nextAt!,
      key: s.nextKey!,
    }),
  ).toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(r.seriesId)))!).toMatchObject({
    nextIndex: 3,
    remaining: 1,
    nextAt: Date.parse("2026-10-27T09:00Z"),
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("contentPlans").collect()),
  ).toHaveLength(0);
});
test("deleted/replaced vector cleanup targets original identity and reaches every plan after root is gone", async () => {
  const f = await fixture(),
    r = await f.create(),
    planId = (await f.fire(r.seriesId))!;
  const original = (await f.t.run((ctx) => ctx.db.get(f.vectorIds[0])))!,
    fingerprint = await vectorFingerprint(original);
  const replacement = {
    ...original,
    createdAt: original.createdAt + 1,
    vector: [0, 0, 0, 1],
  };
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...data } = replacement;
    await ctx.db.replace(_id, data);
    const old = (
      await ctx.db
        .query("semanticPlanBindings")
        .withIndex("by_planId", (q) => q.eq("planId", planId))
        .take(125)
    )[0];
    await ctx.db.insert("semanticPlanBindings", {
      ...Object.fromEntries(
        Object.entries(old).filter(([k]) => !k.startsWith("_")),
      ),
      planId,
      vectorId: original._id,
      fingerprint: await vectorFingerprint(replacement),
    } as never);
  });
  expect(
    (
      await f.signed.query(api.planning.plans.get, {
        workspaceId: f.workspaceId,
        planId,
      })
    ).plan.sourceUnavailable,
  ).toBe(true);
  await f.t.mutation(internal.planning.recurring.purgeVector, {
    vectorId: original._id,
    fingerprint,
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect((await f.t.run((ctx) => ctx.db.get(planId)))!.sourceUnavailable).toBe(
    true,
  );
  // Fresh same-ID dependencies on other valid plans are checked below using an independent original plan skeleton.
});

test("native same-ID vector replacement scrubs original proposals and leaves freshly captured native bindings readable", async () => {
  const f = await fixture(),
    r = await f.create(),
    oldPlan = (await f.fire(r.seriesId))!;
  const original = (await f.t.run((ctx) => ctx.db.get(f.vectorIds[0])))!,
    fingerprint = await vectorFingerprint(original);
  const attemptId = await f.signed.mutation(api.content.similarity.prepare, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    source: { kind: "draft", draftVersionId: f.config.candidateVersionIds[0] },
    commandKey: "fresh-explicit-vector",
  });
  await f.signed.mutation(internal.content.similarity.claim, { attemptId });
  await f.t.mutation(internal.content.similarity.settle, {
    attemptId,
    inputTokens: 1,
    errorCode: null,
  });
  expect(
    await f.t.mutation(internal.content.similarity.commit, {
      attemptId,
      vector: original.vector,
    }),
  ).toBe(original._id);
  const fresh = await f.signed.mutation(api.planning.strategy.change, {
    ...f.request,
    seriesId: r.seriesId,
    expectedRevision: 1,
    commandKey: "fresh-config",
    action: {
      kind: "configure",
      config: { ...f.config, callbackClock: "09:30" },
    },
  });
  const freshPlan = (await f.fire(fresh.seriesId))!;
  await f.t.mutation(internal.planning.recurring.purgeVector, {
    vectorId: original._id,
    fingerprint,
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect((await f.t.run((ctx) => ctx.db.get(oldPlan)))!.sourceUnavailable).toBe(
    true,
  );
  const view = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: freshPlan,
  });
  expect(view.plan.sourceUnavailable).toBe(false);
  expect(view.items).toHaveLength(3);
  expect(view.items.every((i) => !!i.title)).toBe(true);
  const current = await f.t.run((ctx) =>
    ctx.db
      .query("semanticPlanBindings")
      .withIndex("by_planId", (q) => q.eq("planId", freshPlan))
      .take(126),
  );
  expect(
    current.every(
      (b) => !b.sourceUnavailable && !!b.fingerprint && !!b.materialFingerprint,
    ),
  ).toBe(true);
});
test("declared threshold compares all proven history and pairwise candidates; later batches exclude earlier same-series choices", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const history = (await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_sourcePin_historyPostId", (q) =>
        q.eq("sourcePin.historyPostId", f.historyPostId),
      )
      .unique())!;
    const first = (await ctx.db.get(f.vectorIds[0]))!;
    await ctx.db.patch(history._id, { vector: first.vector });
    await ctx.db.patch(f.vectorIds[2], {
      vector: (await ctx.db.get(f.vectorIds[1]))!.vector,
    });
  });
  const r = await f.create(),
    id = (await f.fire(r.seriesId))!;
  const plan = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(plan.selectedCount).toBe(2);
  expect(plan.shortages.some((s) => s.code === "SEMANTIC_REPEAT")).toBe(true);
  const items = await f.t.run((ctx) =>
    ctx.db
      .query("contentPlanItems")
      .withIndex("by_planId", (q) => q.eq("planId", id))
      .take(8),
  );
  expect(items.map((i) => i.versionId)).not.toContain(
    f.config.candidateVersionIds[0],
  );
  const next = (await f.fire(r.seriesId))!;
  expect((await f.t.run((ctx) => ctx.db.get(next)))!.selectedCount).toBe(0);
});
test.each([
  "missing",
  "incompatible",
  "receipt",
  "history-support",
  "overflow",
])(
  "incomplete semantic admission is explicit and creates no series or transport (%s)",
  async (kind) => {
    const f = await fixture(),
      fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    if (kind === "missing")
      await f.t.run((ctx) => ctx.db.delete(f.vectorIds[0]));
    if (kind === "incompatible")
      await f.t.run(async (ctx) => {
        const row = (await ctx.db.get(f.vectorIds[0]))!;
        await ctx.db.patch(row._id, {
          identity: { ...row.identity, resolvedModel: "wrong/identity" },
        });
      });
    if (kind === "receipt")
      await f.t.run(async (ctx) => {
        const row = (await ctx.db.get(f.vectorIds[0]))!;
        await ctx.db.patch(row.attemptId, { receiptFingerprint: "forged" });
      });
    if (kind === "history-support")
      f.request.action.config = {
        ...f.config,
        historyFrom: Date.now(),
        historyTo: Date.now(),
      };
    if (kind === "overflow")
      await f.t.run(async (ctx) => {
        const history = (await ctx.db.get(f.historyPostId))!;
        const { _id, _creationTime, ...row } = history;
        for (let i = 0; i < 100; i++)
          await ctx.db.insert("historyPosts", {
            ...row,
            externalId: `overflow-${i}`,
          });
      });
    await expect(f.create()).rejects.toThrow(
      kind === "receipt"
        ? "SERIES_SOURCE_UNAVAILABLE"
        : kind === "history-support"
          ? "SERIES_HISTORY_SUPPORT_REQUIRED"
          : kind === "overflow"
            ? "EMBEDDING_FRAME_OVERFLOW"
            : "EMBEDDING_QUERY_UNAVAILABLE",
    );
    expect(
      await f.t.run((ctx) => ctx.db.query("planningSeries").collect()),
    ).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  },
);
test.each(["purpose", "actor", "connection", "style", "ancestor"])(
  "source loss immediately masks and physically scrubs series/proposals while native financial parents survive (%s)",
  async (kind) => {
    const f = await fixture(),
      r = await f.create(),
      planId = (await f.fire(r.seriesId))!;
    const unknown = await f.signed.mutation(api.content.similarity.prepare, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      source: {
        kind: "draft",
        draftVersionId: f.config.candidateVersionIds[0],
      },
      commandKey: "unknown-extra",
    });
    await f.signed.mutation(internal.content.similarity.claim, {
      attemptId: unknown,
    });
    await f.t.mutation(internal.content.similarity.settle, {
      attemptId: unknown,
      inputTokens: null,
      errorCode: "synthetic-unknown",
    });
    const money = () =>
      f.t.run(async (ctx) => ({
        budgets: await ctx.db.query("aiBudgets").collect(),
        attempts: (await ctx.db.query("aiAttempts").collect()).map((t) => ({
          id: t._id,
          state: t.state,
          heldMicros: t.heldMicros,
          estimatedMicros: "estimatedMicros" in t ? t.estimatedMicros : null,
        })),
      }));
    const before = await money(),
      fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await f.t.run(async (ctx) => {
      if (kind === "purpose") {
        const c = (await ctx.db.query("embeddingControls").first())!;
        await ctx.db.patch(c._id, { enabled: false });
      }
      if (kind === "actor") {
        const m = (await ctx.db.query("memberships").first())!;
        await ctx.db.patch(m._id, { role: "Viewer" });
      }
      if (kind === "connection")
        await ctx.db.patch(f.accountId, {
          xEvidence: {
            ...(await ctx.db.get(f.accountId))!.xEvidence!,
            connectionSequence: 1,
          },
        });
      if (kind === "ancestor")
        await ctx.db.patch(f.repositories[0], { content: false });
    });
    if (kind === "style")
      await f.t.mutation(internal.ai.styleProfiles.purge, {
        versionId: f.style.versionId!,
        proposalId: null,
      });
    const seriesView = await f.signed.query(api.planning.strategy.get, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
    });
    expect(seriesView.version).toMatchObject({
      config: null,
      style: null,
      frameFingerprint: null,
      intentFingerprint: null,
      sourceUnavailable: true,
    });
    const masked = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId,
    });
    expect(masked.plan.semantic).toBeUndefined();
    expect(
      masked.items.every(
        (i) => !i.title && !i.item.reason && !i.item.sources.length,
      ),
    ).toBe(true);
    await f.t.mutation(internal.planning.recurring.sweep, { cursor: null });
    await f.t.finishAllScheduledFunctions(
      () => vi.advanceTimersByTime(0),
      1000,
    );
    const version = await f.t.run((ctx) => ctx.db.get(r.versionId!));
    expect(version).toMatchObject({
      config: null,
      style: null,
      frameFingerprint: null,
      sourceUnavailable: true,
    });
    expect(
      (
        await f.t.run((ctx) =>
          ctx.db
            .query("semanticPlanBindings")
            .withIndex("by_planId", (q) => q.eq("planId", planId))
            .take(126),
        )
      ).every((b) => b.sourcePin === null && b.fingerprint === null),
    ).toBe(true);
    expect(await money()).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
  },
);
test("shorter current horizon clamps downward, invalidates proof through slot, and cannot renew after policy restoration", async () => {
  const f = await fixture(),
    r = await f.create(),
    planId = (await f.fire(r.seriesId))!;
  const until = Date.now() + 30 * 60000;
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("historyPolicies").first())!,
      { _id, _creationTime, ...fields } = p;
    await ctx.db.insert("historyPolicies", {
      ...fields,
      version: "shorter-current",
      retentionMs: until - (await ctx.db.get(f.historyPostId))!.observedAt,
    });
    for (const b of await ctx.db.query("aiBudgets").collect())
      if (b.key.startsWith("history:"))
        await ctx.db.patch(b._id, { policyVersion: "shorter-current" });
  });
  const view = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId,
  });
  expect(view.items.every((i) => !i.title)).toBe(true);
  expect(view.plan).toMatchObject({
    sourceUnavailable: true,
    topics: "",
    fingerprint: "",
  });
  expect(view.plan.semantic).toBeUndefined();
  await f.t.mutation(internal.planning.recurring.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect(
    (await f.t.run((ctx) => ctx.db.get(r.versionId!)))!.sourceUntil,
  ).toBeLessThanOrEqual(until);
  expect((await f.t.run((ctx) => ctx.db.get(planId)))!.sourceUnavailable).toBe(
    true,
  );
  const stopped = (await f.t.run((ctx) => ctx.db.get(r.seriesId)))!;
  expect(stopped.nextAt).toBeNull();
  await f.t.run(async (ctx) => {
    const current = (await ctx.db
      .query("historyPolicies")
      .order("desc")
      .first())!;
    await ctx.db.patch(current._id, { retentionMs: 30 * 86400000 });
  });
  await f.t.mutation(internal.planning.recurring.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect(
    (await f.t.run((ctx) => ctx.db.get(r.versionId!)))!.sourceUntil,
  ).toBeLessThanOrEqual(until);
  expect((await f.t.run((ctx) => ctx.db.get(r.seriesId)))!.nextAt).toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(planId)))!.sourceUnavailable).toBe(
    true,
  );
});
test("series selected-set acceptance rolls back atomically on occupied second slot and preserves possible external effects", async () => {
  const f = await fixture(),
    r = await f.create(),
    id = (await f.fire(r.seriesId))!,
    items = await f.t.run((ctx) =>
      ctx.db
        .query("contentPlanItems")
        .withIndex("by_planId", (q) => q.eq("planId", id))
        .take(8),
    );
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId: items[1].versionId,
    accountId: f.accountId,
  });
  const scheduleId = await f.t.run((ctx) =>
    ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      draftId: items[1].draftId,
      versionId: items[1].versionId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at: items[1].at,
      timezone: items[1].timezone,
      localTime: items[1].localTime,
      state: "cancelled",
      publishedCount: 1,
      errorCode: null,
      jobId: null,
    }),
  );
  const before = await f.t.run(async (ctx) => ({
    s: await ctx.db.query("schedules").collect(),
    a: await ctx.db.query("approvals").collect(),
  }));
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      workspaceId: f.workspaceId,
      planId: id,
      mode: "approve_and_schedule",
      selections: items.slice(0, 2).map((i) => ({
        itemId: i._id,
        versionId: i.versionId,
        draftRevision: i.draftRevision,
      })),
    }),
  ).rejects.toThrow();
  expect(
    await f.t.run(async (ctx) => ({
      s: await ctx.db.query("schedules").collect(),
      a: await ctx.db.query("approvals").collect(),
    })),
  ).toEqual(before);
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.publishedCount).toBe(
    1,
  );
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db
          .query("contentPlanItems")
          .withIndex("by_planId", (q) => q.eq("planId", id))
          .take(8),
      )
    ).every((i) => i.status === "proposed"),
  ).toBe(true);
});

async function fillHistory(
  f: Awaited<ReturnType<typeof fixture>>,
  count = 100,
) {
  const first = (await f.t.run((ctx) => ctx.db.get(f.historyPostId)))!,
    ids: Id<"historyPosts">[] = [];
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...row } = first;
    for (let i = 1; i < count; i++)
      ids.push(
        await ctx.db.insert("historyPosts", {
          ...row,
          externalId: `history-${1000 + i}`,
        }),
      );
    await ctx.db.patch(first.jobId, { imported: count });
  });
  for (const historyPostId of ids) {
    const attemptId = await f.signed.mutation(api.content.similarity.prepare, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      source: { kind: "history", historyPostId },
      commandKey: `history-vector-${historyPostId}`,
    });
    await f.signed.mutation(internal.content.similarity.claim, { attemptId });
    await f.t.mutation(internal.content.similarity.settle, {
      attemptId,
      inputTokens: 1,
      errorCode: null,
    });
    const history = (await f.t.run((ctx) =>
      ctx.db
        .query("contentEmbeddings")
        .withIndex("by_sourcePin_historyPostId", (q) =>
          q.eq("sourcePin.historyPostId", f.historyPostId),
        )
        .unique(),
    ))!;
    await f.t.mutation(internal.content.similarity.commit, {
      attemptId,
      vector: history.vector,
    });
  }
}
test("maximum complete manifest 100 history plus 25 drafts and 4096-dimensional vectors stays inside original native budgets; cleanup is bounded", async () => {
  const f = await fixture(25, 4096, true, true);
  await fillHistory(f);
  const limits = {
    databaseQueries: 4096,
    bytesRead: 16 * 1024 * 1024,
    documentsRead: 32000,
  };
  const configure = await f.signed.run(async (ctx) => ({
    value: await ctx.runMutation(api.planning.strategy.change, f.request, {
      transactionLimits: limits,
    }),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  const s = (await f.t.run((ctx) => ctx.db.get(configure.value.seriesId)))!;
  vi.setSystemTime(s.nextAt!);
  const checked = await f.t.run(async (ctx) => ({
    value: await ctx.runMutation(
      internal.planning.recurring.fire,
      {
        seriesId: s._id,
        versionId: s.versionId!,
        generation: s.generation,
        index: s.nextIndex,
        at: s.nextAt!,
        key: s.nextKey!,
      },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  const plan = (await f.t.run((ctx) => ctx.db.get(checked.value!)))!;
  expect(plan.semantic!.vectorCount).toBe(125);
  expect(plan.selectedCount).toBe(0);
  const get = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(
      api.planning.plans.get,
      { workspaceId: f.workspaceId, planId: plan._id },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(get.value.plan.semantic!.vectorCount).toBe(125);
  const old = (await f.t.run((ctx) => ctx.db.get(f.vectorIds[0])))!,
    hash = await vectorFingerprint(old);
  await f.t.run((ctx) => ctx.db.delete(old._id));
  const cleanup = await f.t.run(async (ctx) => ({
    value: await ctx.runMutation(
      internal.planning.recurring.purgeVector,
      { vectorId: old._id, fingerprint: hash, cursor: null },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  console.log(
    "FINITE SERIES NATIVE BUDGETS",
    JSON.stringify({
      configure: configure.metrics,
      callback: checked.metrics,
      get: get.metrics,
      cleanup: cleanup.metrics,
    }),
  );
  writeFileSync(
    "/tmp/dispatch-46.2-native-frame-metrics.json",
    JSON.stringify(
      {
        configure: configure.metrics,
        callback: checked.metrics,
        get: get.metrics,
        cleanup: cleanup.metrics,
      },
      null,
      2,
    ),
  );
}, 900000);
test.each([7, 25])(
  "seven-item native selective acceptance reuses full 100+%i semantic frame within original read budget",
  async (count) => {
    const f = await fixture(
      count,
      4096,
      false,
      true,
      "2026-10-06T08:00:00Z",
      7,
    );
    await fillHistory(f);
    f.request.action.config = {
      ...f.config,
      itemsPerBatch: 7,
      publishingClocks: [
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
      ],
    };
    const r = await f.create(),
      planId = (await f.fire(r.seriesId))!,
      items = await f.t.run((ctx) =>
        ctx.db
          .query("contentPlanItems")
          .withIndex("by_planId", (q) => q.eq("planId", planId))
          .take(8),
      );
    expect(items).toHaveLength(7);
    expect(
      (await f.t.run((ctx) => ctx.db.get(planId)))!.semantic!.vectorCount,
    ).toBe(100 + count);
    const checked = await f.signed.run(async (ctx) => ({
      value: await ctx.runMutation(
        api.planning.accept.selected,
        {
          workspaceId: f.workspaceId,
          planId,
          mode: "approve_and_schedule",
          selections: items.map((i) => ({
            itemId: i._id,
            versionId: i.versionId,
            draftRevision: i.draftRevision,
          })),
        },
        {
          transactionLimits: {
            databaseQueries: 4096,
            bytesRead: 16 * 1024 * 1024,
            documentsRead: 32000,
          },
        },
      ),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    expect(checked.value).toHaveLength(7);
    console.log(
      "FINITE SERIES SEVEN ACCEPT NATIVE BUDGET",
      JSON.stringify(checked.metrics),
    );
    writeFileSync(
      count === 7
        ? "/tmp/dispatch-46.2-native-accept-metrics.json"
        : "/tmp/dispatch-46.2-native-accept-125-metrics.json",
      JSON.stringify(checked.metrics, null, 2),
    );
  },
  900000,
);
test("aggregate protected ancestry and unknown native capacity errors propagate without erasing source/finance", async () => {
  const large = await fixture(17);
  await expect(large.create()).rejects.toThrow(
    "EMBEDDING_FRAME_RESOURCE_CEILING",
  );
  expect(
    await large.t.run((ctx) => ctx.db.query("contentEmbeddings").collect()),
  ).toHaveLength(18);
  const f = await fixture(),
    r = await f.create(),
    s = (await f.t.run((ctx) => ctx.db.get(r.seriesId)))!;
  vi.setSystemTime(s.nextAt!);
  const snapshot = () =>
    f.t.run(async (ctx) => ({
      series: await ctx.db.get(s._id),
      version: await ctx.db.get(r.versionId!),
      vectors: await ctx.db.query("contentEmbeddings").collect(),
      budgets: await ctx.db.query("aiBudgets").collect(),
    }));
  const before = await snapshot();
  await expect(
    f.t.run((ctx) =>
      ctx.runMutation(
        internal.planning.recurring.fire,
        {
          seriesId: s._id,
          versionId: s.versionId!,
          generation: s.generation,
          index: 0,
          at: s.nextAt!,
          key: s.nextKey!,
        },
        {
          transactionLimits: {
            databaseQueries: 3,
            bytesRead: 16 * 1024 * 1024,
            documentsRead: 32000,
          },
        },
      ),
    ),
  ).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});
test("more than one dependency page is physically scrubbed with original vector root already deleted", async () => {
  const f = await fixture(),
    r = await f.create(),
    id = (await f.fire(r.seriesId))!,
    plan = (await f.t.run((ctx) => ctx.db.get(id)))!;
  const b = (
      await f.t.run((ctx) =>
        ctx.db
          .query("semanticPlanBindings")
          .withIndex("by_planId", (q) => q.eq("planId", id))
          .take(126),
      )
    )[0],
    vector = (await f.t.run((ctx) => ctx.db.get(b.vectorId)))!,
    hash = await vectorFingerprint(vector);
  // Controlled persisted dependency fan-out checks cleanup, separately from registered finite-admission tests.
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...p } = plan;
    const { _id: bid, _creationTime: bc, ...binding } = b;
    for (let i = 0; i < 26; i++) {
      const planId = await ctx.db.insert("contentPlans", {
        ...p,
        commandKey: `cleanup-fanout-${i}`,
        series: undefined,
      });
      await ctx.db.insert("semanticPlanBindings", { ...binding, planId });
    }
    await ctx.db.delete(vector._id);
  });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("semanticPlanBindings")
        .withIndex("by_vectorId_and_fingerprint", (q) =>
          q.eq("vectorId", vector._id).eq("fingerprint", hash),
        )
        .take(28),
    ),
  ).toHaveLength(27);
  await f.t.mutation(internal.planning.recurring.purgeVector, {
    vectorId: vector._id,
    fingerprint: hash,
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("semanticPlanBindings")
        .withIndex("by_vectorId_and_fingerprint", (q) =>
          q.eq("vectorId", vector._id).eq("fingerprint", hash),
        )
        .take(28),
    ),
  ).toHaveLength(0);
  expect(
    (await f.t.run((ctx) => ctx.db.query("contentPlans").collect())).every(
      (p) => p.sourceUnavailable && !p.semantic && !p.fingerprint && !p.topics,
    ),
  ).toBe(true);
});

test.each(["gap", "overlap"])(
  "native publishing windows require exactly one DST match and record honest shortage (%s)",
  async (kind) => {
    const f = await fixture(
        4,
        5,
        false,
        false,
        kind === "gap" ? "2026-03-10T08:00Z" : "2026-10-06T08:00Z",
      ),
      date = kind === "gap" ? "2026-03-29" : "2026-10-25";
    f.request.action.config = {
      ...f.config,
      start: date,
      end: date,
      occurrences: 1,
      weekday: 0,
      timezone: "Europe/Berlin",
      callbackClock: "01:30",
      publishingClocks: ["02:30"],
    };
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    const r = await f.create(),
      id = (await f.fire(r.seriesId))!,
      plan = (await f.t.run((ctx) => ctx.db.get(id)))!;
    expect(plan.selectedCount).toBe(0);
    expect(plan.shortages).toContainEqual({
      code: kind === "gap" ? "NONEXISTENT_LOCAL_TIME" : "AMBIGUOUS_LOCAL_TIME",
      count: 1,
    });
    expect(transport).not.toHaveBeenCalled();
  },
);
test("stale version, key, generation and disabled callback are inert; foreign account and role cannot rebind native series", async () => {
  const f = await fixture(),
    r = await f.create(),
    s = (await f.t.run((ctx) => ctx.db.get(r.seriesId)))!,
    args = {
      seriesId: s._id,
      versionId: s.versionId!,
      generation: s.generation,
      index: 0,
      at: s.nextAt!,
      key: s.nextKey!,
    },
    transport = vi.fn();
  vi.stubGlobal("fetch", transport);
  vi.setSystemTime(s.nextAt!);
  expect(
    await f.t.mutation(internal.planning.recurring.fire, {
      ...args,
      key: "changed",
    }),
  ).toBeNull();
  expect(
    await f.t.mutation(internal.planning.recurring.fire, {
      ...args,
      generation: 0,
    }),
  ).toBeNull();
  const fresh = await f.signed.mutation(api.planning.strategy.change, {
    ...f.request,
    seriesId: r.seriesId,
    expectedRevision: 1,
    commandKey: "new-version",
    action: {
      kind: "configure",
      config: { ...f.config, callbackClock: "09:30" },
    },
  });
  expect(await f.t.mutation(internal.planning.recurring.fire, args)).toBeNull();
  await f.signed.mutation(api.planning.strategy.change, {
    ...f.request,
    seriesId: r.seriesId,
    expectedRevision: 2,
    commandKey: "disable-future",
    action: { kind: "disable" },
  });
  const v = (await f.t.run((ctx) => ctx.db.get(fresh.versionId!)))!;
  expect(
    await f.t.mutation(internal.planning.recurring.fire, {
      ...args,
      versionId: v._id,
      generation: 2,
      at: v.sequence[0],
      key: `series-${s._id}-2-0-${v.sequence[0]}`,
    }),
  ).toBeNull();
  const foreign = await f.t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "",
    });
    return ctx.db.insert("socialAccounts", {
      ...(await ctx.db.get(f.accountId))!,
      _id: undefined,
      _creationTime: undefined,
      workspaceId,
    } as never);
  });
  await expect(
    f.signed.mutation(api.planning.strategy.change, {
      ...f.request,
      accountId: foreign,
      seriesId: r.seriesId,
      expectedRevision: 3,
      commandKey: "foreign",
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  expect(
    await f.t.run((ctx) => ctx.db.query("contentPlans").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(0);
  expect(transport).not.toHaveBeenCalled();
});

test.each(["sweep", "fire-replay"])(
  "selection-only %s fences current work, retains original immutable proof and never resumes; accepted native parents stay unchanged",
  async (path) => {
    const f = await fixture(),
      r = await f.create(),
      planId = (await f.fire(r.seriesId))!;
    const plan = (await f.t.run((ctx) => ctx.db.get(planId)))!;
    const view = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId,
    });
    const acceptedArgs = {
      workspaceId: f.workspaceId,
      planId,
      mode: "approve_and_schedule" as const,
      selections: view.items.slice(0, 1).map(({ item }) => ({
        itemId: item._id,
        versionId: item.versionId,
        draftRevision: item.draftRevision,
      })),
    };
    const accepted = await f.signed.mutation(
      api.planning.accept.selected,
      acceptedArgs,
    );
    const parents = () =>
      f.t.run(async (ctx) => ({
        schedules: await ctx.db.query("schedules").collect(),
        approvals: await ctx.db.query("approvals").collect(),
        budgets: await ctx.db.query("aiBudgets").collect(),
        attempts: await ctx.db.query("aiAttempts").collect(),
      }));
    const before = await parents(),
      original = (await f.t.run((ctx) => ctx.db.get(r.versionId!)))!;
    const saved = await f.signed.mutation(api.ai.styleProfiles.change, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      expectedRevision: 2,
      commandKey: "alternative-save",
      action: {
        kind: "save",
        payload: {
          author: "Another synthetic",
          experiences: [],
          tone: "Precise",
          positioning: "Another",
          pillars: [{ name: "Product", weight: 100 }],
          examples: [],
          forbidden: [],
        },
        freshDeclaration: true,
        baseVersionId: null,
        reason: "Explicit independent synthetic declaration",
      },
    });
    const switched = await f.signed.mutation(api.ai.styleProfiles.change, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      expectedRevision: saved.revision,
      commandKey: "alternative-select",
      action: {
        kind: "select",
        versionId: saved.versionId!,
        reason: "Explicit alternative",
      },
    });
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    if (path === "sweep")
      await f.t.mutation(internal.planning.recurring.sweep, { cursor: null });
    else
      expect(
        await f.t.mutation(internal.planning.recurring.fire, {
          seriesId: r.seriesId,
          versionId: r.versionId!,
          generation: plan.series!.generation,
          index: plan.series!.index,
          at: plan.series!.at,
          key: plan.series!.key,
        }),
      ).toBeNull();
    await f.t.finishAllScheduledFunctions(
      () => vi.advanceTimersByTime(0),
      1000,
    );
    const control = (await f.t.run((ctx) => ctx.db.get(r.seriesId)))!;
    expect(control).toMatchObject({
      enabled: false,
      nextAt: null,
      scheduledJobId: null,
      reason: "STYLE_SELECTION_CHANGED",
    });
    expect(await f.t.run((ctx) => ctx.db.get(r.versionId!))).toEqual(original);
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.style.versionId!)))!.payload,
    ).not.toBeNull();
    expect(
      (await f.t.run((ctx) => ctx.db.get(planId)))!.sourceUnavailable,
    ).toBe(true);
    expect(await parents()).toEqual(before);
    expect(
      await f.signed.mutation(api.planning.accept.selected, acceptedArgs),
    ).toEqual(accepted);
    await f.signed.mutation(api.ai.styleProfiles.change, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      expectedRevision: switched.revision,
      commandKey: "restore-original",
      action: {
        kind: "select",
        versionId: f.style.versionId!,
        reason: "Explicit original selection restoration",
      },
    });
    await f.t.mutation(internal.planning.recurring.sweep, { cursor: null });
    await f.t.finishAllScheduledFunctions(
      () => vi.advanceTimersByTime(0),
      1000,
    );
    expect((await f.t.run((ctx) => ctx.db.get(r.seriesId)))!.enabled).toBe(
      false,
    );
    expect(
      (await f.t.run((ctx) => ctx.db.get(planId)))!.sourceUnavailable,
    ).toBe(true);
    expect(await f.t.run((ctx) => ctx.db.get(r.versionId!))).toEqual(original);
    expect(await parents()).toEqual(before);
    expect(transport).not.toHaveBeenCalled();
  },
);

test("ordinary native style retirement fences current work while preserving retained historical series proof", async () => {
  const f = await fixture(),
    r = await f.create();
  const original = await f.t.run((ctx) => ctx.db.get(r.versionId!));
  const planId = (await f.fire(r.seriesId))!;
  await f.signed.mutation(api.ai.styleProfiles.change, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    expectedRevision: 2,
    commandKey: "retire-original",
    action: {
      kind: "retire",
      versionId: f.style.versionId!,
      reason: "Explicit retirement",
    },
  });
  await f.t.mutation(internal.planning.recurring.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect(await f.t.run((ctx) => ctx.db.get(r.versionId!))).toEqual(original);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.style.versionId!)))!,
  ).toMatchObject({ status: "retired", sourceUnavailable: false });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.style.versionId!)))!.payload,
  ).not.toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(r.seriesId)))!).toMatchObject({
    enabled: false,
    nextAt: null,
  });
  expect((await f.t.run((ctx) => ctx.db.get(planId)))!.sourceUnavailable).toBe(
    true,
  );
});

test("valid shorter current horizon clamps both projected metadata proofs and remains clamped after original policy restoration", async () => {
  const f = await fixture(),
    r = await f.create(),
    planId = (await f.fire(r.seriesId))!;
  const until = Date.now() + 4 * 3600000;
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("historyPolicies").first())!,
      { _id, _creationTime, ...fields } = p;
    await ctx.db.insert("historyPolicies", {
      ...fields,
      version: "valid-shorter",
      retentionMs: until - (await ctx.db.get(f.historyPostId))!.observedAt,
    });
    for (const b of await ctx.db.query("aiBudgets").collect())
      if (b.key.startsWith("history:"))
        await ctx.db.patch(b._id, { policyVersion: "valid-shorter" });
  });
  const view = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId,
  });
  expect(view.plan.sourceUnavailable).not.toBe(true);
  expect(view.plan.topics).toBe("Explicit theme");
  expect(view.items.every((i) => !!i.title)).toBe(true);
  expect(view.plan.series!.sourceUntil).toBe(until);
  expect(view.plan.semantic!.sourceUntil).toBe(until);
  await f.t.mutation(internal.planning.recurring.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("historyPolicies").order("desc").first())!;
    await ctx.db.patch(p._id, { retentionMs: 30 * 86400000 });
  });
  const restored = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId,
  });
  // Sweep stopped the next weekly callback, so original proposals remain fenced and cannot regain raw metadata.
  expect((await f.t.run((ctx) => ctx.db.get(r.versionId!)))!.sourceUntil).toBe(
    until,
  );
  expect((await f.t.run((ctx) => ctx.db.get(r.seriesId)))!.enabled).toBe(false);
  expect(restored.plan.semantic).toBeUndefined();
});

test("native canonical two-pillar subset retains actual immutable order and weights", async () => {
  const f = await fixture();
  const pillars = [
    { name: "Product", weight: 60 },
    { name: "Engineering", weight: 40 },
  ];
  const saved = await f.signed.mutation(api.ai.styleProfiles.change, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    expectedRevision: 2,
    commandKey: "two-pillars-save",
    action: {
      kind: "save",
      payload: {
        author: "Synthetic author",
        experiences: [],
        tone: "Precise",
        positioning: "Synthetic",
        pillars,
        examples: [],
        forbidden: [],
      },
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Explicit multi-pillar declaration",
    },
  });
  await f.signed.mutation(api.ai.styleProfiles.change, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    expectedRevision: saved.revision,
    commandKey: "two-pillars-select",
    action: {
      kind: "select",
      versionId: saved.versionId!,
      reason: "Explicit multi-pillar selection",
    },
  });
  f.request.action.config = {
    ...f.config,
    styleVersionId: saved.versionId!,
    pillars,
  };
  const r = await f.create();
  expect(
    (await f.t.run((ctx) => ctx.db.get(r.versionId!)))!.config!.pillars,
  ).toEqual(pillars);
  await expect(
    f.signed.mutation(api.planning.strategy.change, {
      ...f.request,
      seriesId: r.seriesId,
      expectedRevision: 1,
      commandKey: "wrong-weight",
      action: {
        kind: "configure",
        config: {
          ...f.request.action.config,
          pillars: [{ name: "Product", weight: 100 }],
        },
      },
    }),
  ).rejects.toThrow("SERIES_INPUT_INVALID");
});

test("definitive native CAS conflict recovers only with fresh reviewed revision/key and exact retry remains inert", async () => {
  const f = await fixture(),
    initial = await f.create();
  const stale = {
    ...f.request,
    seriesId: initial.seriesId,
    commandKey: "stale-input",
  };
  await expect(
    f.signed.mutation(api.planning.strategy.change, stale),
  ).rejects.toThrow("SERIES_REVISION_CONFLICT");
  const reviewed = {
    ...stale,
    expectedRevision: initial.revision,
    commandKey: "fresh-reviewed-input",
  };
  const receipt = await f.signed.mutation(
    api.planning.strategy.change,
    reviewed,
  );
  expect(receipt.revision).toBe(2);
  expect(
    await f.signed.mutation(api.planning.strategy.change, reviewed),
  ).toEqual(receipt);
  expect(
    await f.t.run((ctx) => ctx.db.query("planningSeriesCommands").collect()),
  ).toHaveLength(2);
  expect(
    await f.t.run((ctx) => ctx.db.query("planningSeriesVersions").collect()),
  ).toHaveLength(2);
  expect((await f.t.run((ctx) => ctx.db.get(initial.seriesId)))!).toMatchObject(
    { revision: 2, generation: 2, versionId: receipt.versionId },
  );
});

test("experiment native two-of-three approval transaction assigns distinct feedback sequences and finite boundaries", async () => {
  const f = await fixture(),
    series = await f.create(),
    planId = (await f.fire(series.seriesId))!;
  const plan = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId,
  });
  const accepted = await f.signed.mutation(api.planning.accept.selected, {
    workspaceId: f.workspaceId,
    planId,
    mode: "approve_and_schedule",
    selections: plan.items.slice(0, 2).map(({ item }) => ({
      itemId: item._id,
      versionId: item.versionId,
      draftRevision: item.draftRevision,
    })),
  });
  expect(accepted).toBeDefined();
  const feedback = await f.t.run((ctx) =>
    ctx.db.query("contentFeedback").collect(),
  );
  expect(feedback).toHaveLength(2);
  expect(feedback.map((e) => e.sequence).sort()).toEqual([1, 2]);
  expect(new Set(feedback.map((e) => e.createdAt)).size).toBe(1);
  const manualDraft = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "Manual exact experiment unit",
    content: {
      accountId: f.accountId,
      title: "Manual",
      text: ["Explicit manual unit"],
      media: [],
      pillar: "Product",
      strategy: "",
    },
  });
  const manual = (await f.t.run((ctx) => ctx.db.get(manualDraft)))!
      .currentVersionId!,
    item = plan.items[2].item;
  const scope = { workspaceId: f.workspaceId, accountId: f.accountId };
  const declared = await f.signed.mutation(api.performance.experiments.change, {
    ...scope,
    expectedRevision: 0,
    commandKey: "sequence-exp",
    action: {
      kind: "declare",
      spec: {
        hypothesis: "Synthetic native sequence",
        dimension: "hook",
        a: "Question",
        b: "Observation",
        outcome: "editorial-decision-v1",
        startsAt: Date.now(),
        endsAt: Date.now() + 3600000,
        sampleCap: 2,
        stopCondition: "Explicit hour end",
        context: "Human explicitly binds exact third native series item",
        frequency: "Actual finite series frequency, no new publishing",
      },
      units: [
        {
          versionId: item.versionId,
          reviewerId: f.userId,
          arm: "A",
          planItemId: item._id,
        },
        { versionId: manual, reviewerId: f.userId, arm: "B", planItemId: null },
      ],
    },
  });
  const command = (kind: "start" | "stop", expectedRevision: number) =>
    f.signed.mutation(api.performance.experiments.change, {
      ...scope,
      experimentId: declared.experimentId,
      expectedRevision,
      commandKey: `sequence-${kind}`,
      action: { kind },
    });
  await command("start", 1);
  await f.signed.mutation(api.content.feedback.decide, {
    workspaceId: f.workspaceId,
    versionId: item.versionId,
    kind: "accept",
  });
  await command("stop", 2);
  await f.signed.mutation(api.content.feedback.decide, {
    workspaceId: f.workspaceId,
    versionId: item.versionId,
    kind: "reject",
  });
  const experiment = (await f.t.run((ctx) =>
    ctx.db.get(declared.experimentId),
  ))!;
  expect(experiment.startSequence).toBe(2);
  expect(experiment.stopSequence).toBe(3);
  const detail = await f.signed.query(api.performance.experiments.get, {
    ...scope,
    experimentId: declared.experimentId,
  });
  expect(detail.counts).toMatchObject({
    enrolled: 2,
    accept: 1,
    conflict: 0,
    noFeedback: 1,
  });
  expect(detail.arms.A.accept).toBe(1);
  const evidence = await f.t.run(async (ctx) => ({
    schedules: await ctx.db.query("schedules").collect(),
    approvals: await ctx.db.query("approvals").collect(),
    budgets: await ctx.db.query("aiBudgets").collect(),
    attempts: await ctx.db.query("aiAttempts").collect(),
  }));
  expect(evidence.schedules).toHaveLength(2);
  expect(evidence.approvals).toHaveLength(2);
  const bindings = await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentBindings").collect(),
  );
  expect(bindings).toHaveLength(5);
  const vector = (await f.t.run((ctx) => ctx.db.get(bindings[0].vectorId!)))!;
  await f.t.run((ctx) => ctx.db.delete(vector._id));
  expect(
    (
      await f.signed.query(api.performance.experiments.get, {
        ...scope,
        experimentId: declared.experimentId,
      })
    ).spec,
  ).toBeNull();
  await f.t.mutation(internal.planning.recurring.purgeVector, {
    vectorId: vector._id,
    fingerprint: await vectorFingerprint(vector),
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentBindings").collect(),
      )
    ).every((b) => b.fingerprint === null),
  ).toBe(true);
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentAssignments").collect(),
      )
    ).every((a) => a.arm === null && a.style === null && a.planItemId === null),
  ).toBe(true);
  expect(
    await f.t.run(async (ctx) => ({
      schedules: await ctx.db.query("schedules").collect(),
      approvals: await ctx.db.query("approvals").collect(),
      budgets: await ctx.db.query("aiBudgets").collect(),
      attempts: await ctx.db.query("aiAttempts").collect(),
    })),
  ).toEqual(evidence);
});

test("experiment optional native plan provenance preserves retained original style until actual plan scrub; draft-only units remain valid", async () => {
  const f = await fixture(),
    series = await f.create(),
    planId = (await f.fire(series.seriesId))!;
  const plan = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId,
    }),
    scope = { workspaceId: f.workspaceId, accountId: f.accountId };
  const spec = {
    hypothesis: "Explicit exact context comparison",
    dimension: "hook" as const,
    a: "Question",
    b: "Observation",
    outcome: "editorial-decision-v1" as const,
    startsAt: Date.now(),
    endsAt: Date.now() + 3600000,
    sampleCap: 2,
    stopCondition: "Declared hour",
    context: "Actual native reviewed context",
    frequency: "Actual finite series reference without new publishing",
  };
  const create = (bound: boolean) =>
    f.signed.mutation(api.performance.experiments.change, {
      ...scope,
      expectedRevision: 0,
      commandKey: bound ? "bound-provenance" : "draft-only",
      action: {
        kind: "declare",
        spec,
        units: plan.items.slice(0, 2).map(({ item }, i) => ({
          versionId: item.versionId,
          reviewerId: f.userId,
          arm: i ? ("B" as const) : ("A" as const),
          planItemId: bound ? item._id : null,
        })),
      },
    });
  const bound = await create(true),
    independent = await create(false),
    get = (experimentId: Id<"editorialExperiments">) =>
      f.signed.query(api.performance.experiments.get, {
        ...scope,
        experimentId,
      });
  const original = (await f.t.run((ctx) => ctx.db.get(f.style.versionId!)))!;
  await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 2,
    commandKey: "experiment-retire-style",
    action: {
      kind: "retire",
      versionId: f.style.versionId!,
      reason: "Explicit ordinary retirement",
    },
  });
  expect((await get(bound.experimentId)).spec).not.toBeNull();
  expect((await get(independent.experimentId)).spec).not.toBeNull();
  await f.t.mutation(internal.planning.recurring.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect((await get(bound.experimentId)).spec).toBeNull();
  expect((await get(independent.experimentId)).spec).not.toBeNull();
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.style.versionId!)))!.payload,
  ).toEqual(original.payload);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.style.versionId!)))!.sourceUnavailable,
  ).toBe(false);
  const rows = await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentAssignments").collect(),
  );
  expect(
    rows
      .filter((a) => a.experimentId === bound.experimentId)
      .every((a) => a.arm === null && a.style === null),
  ).toBe(true);
  expect(
    rows
      .filter((a) => a.experimentId === independent.experimentId)
      .every((a) => a.arm !== null && !a.sourceUnavailable),
  ).toBe(true);
});

test("experiment indexed original vector/style/series descendants exceed one page and drain after roots are gone", async () => {
  const f = await fixture(),
    series = await f.create(),
    planId = (await f.fire(series.seriesId))!;
  const plan = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId,
    }),
    scope = { workspaceId: f.workspaceId, accountId: f.accountId };
  const declared = await f.signed.mutation(api.performance.experiments.change, {
    ...scope,
    expectedRevision: 0,
    commandKey: "many-bound",
    action: {
      kind: "declare",
      spec: {
        hypothesis: "Explicit bound descendants",
        dimension: "hook",
        a: "Question",
        b: "Observation",
        outcome: "editorial-decision-v1",
        startsAt: Date.now(),
        endsAt: Date.now() + 3600000,
        sampleCap: 2,
        stopCondition: "Declared hour",
        context: "Exact native plan source",
        frequency: "Actual series frequency",
      },
      units: plan.items.slice(0, 2).map(({ item }, i) => ({
        versionId: item.versionId,
        reviewerId: f.userId,
        arm: i ? ("B" as const) : ("A" as const),
        planItemId: item._id,
      })),
    },
  });
  const originalVector = (await f.t.run((ctx) => ctx.db.get(f.vectorIds[0])))!,
    fingerprint = await vectorFingerprint(originalVector);
  await f.t.run(async (ctx) => {
    const e = (await ctx.db.get(declared.experimentId))!,
      assignment = (await ctx.db
        .query("editorialExperimentAssignments")
        .first())!,
      binding = (await ctx.db
        .query("editorialExperimentBindings")
        .withIndex("by_vectorId_and_fingerprint", (q) =>
          q.eq("vectorId", originalVector._id).eq("fingerprint", fingerprint),
        )
        .first())!;
    for (let n = 0; n < 55; n++) {
      const { _id: ei, _creationTime: ec, ...ef } = e,
        { _id: ai, _creationTime: ac, ...af } = assignment,
        { _id: bi, _creationTime: bc, ...bf } = binding;
      const experimentId = await ctx.db.insert("editorialExperiments", ef);
      const assignmentId = await ctx.db.insert(
        "editorialExperimentAssignments",
        { ...af, experimentId },
      );
      await ctx.db.insert("editorialExperimentBindings", {
        ...bf,
        assignmentId,
      });
    }
    await ctx.db.delete(originalVector._id);
  });
  await f.t.mutation(internal.performance.experiments.purgeVector, {
    vectorId: originalVector._id,
    fingerprint,
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentBindings").collect(),
      )
    ).every((b) => b.sourceUnavailable && b.fingerprint === null),
  ).toBe(true);
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentAssignments").collect(),
      )
    ).every(
      (a) =>
        a.sourceUnavailable &&
        a.arm === null &&
        a.style === null &&
        a.planItemId === null &&
        a.seriesVersionId === null,
    ),
  ).toBe(true);
  expect(
    (
      await f.t.run((ctx) => ctx.db.query("editorialExperiments").collect())
    ).every((e) => e.spec === null),
  ).toBe(true);
});

test("experiment actually consumed recent native schedule context has exact history-version proof and root-gone indexed cleanup", async () => {
  const f = await fixture(6),
    series = await f.create(),
    firstId = (await f.fire(series.seriesId))!;
  const first = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId: firstId,
    }),
    initial = first.items[0].item;
  await f.signed.mutation(api.planning.accept.selected, {
    workspaceId: f.workspaceId,
    planId: firstId,
    mode: "approve_and_schedule",
    selections: [
      {
        itemId: initial._id,
        versionId: initial.versionId,
        draftRevision: initial.draftRevision,
      },
    ],
  });
  await f.t.run(async (ctx) => {
    const sessions = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      { model: "session", paginationOpts: { numItems: 100, cursor: null } },
    );
    for (const session of sessions.page)
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "session",
          where: [{ field: "_id", value: session._id }],
          update: { expiresAt: Date.now() + 30 * 86400000 },
        },
      });
  });
  const secondId = (await f.fire(series.seriesId))!,
    second = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId: secondId,
    });
  expect(second.items.length).toBeGreaterThanOrEqual(2);
  expect(second.items[0].item.historyVersionIds).toContain(initial.versionId);
  const scope = { workspaceId: f.workspaceId, accountId: f.accountId },
    spec = {
      hypothesis: "Actual native recent context",
      dimension: "hook" as const,
      a: "Question",
      b: "Observation",
      outcome: "editorial-decision-v1" as const,
      startsAt: Date.now(),
      endsAt: Date.now() + 3600000,
      sampleCap: 2,
      stopCondition: "Declared hour",
      context:
        "Human binds actual second weekly plan and recent schedule context",
      frequency: "Actual finite weekly series",
    };
  const create = (bound: boolean) =>
    f.signed.mutation(api.performance.experiments.change, {
      ...scope,
      expectedRevision: 0,
      commandKey: bound ? "recent-bound" : "recent-independent",
      action: {
        kind: "declare",
        spec,
        units: second.items.slice(0, 2).map(({ item }, i) => ({
          versionId: item.versionId,
          reviewerId: f.userId,
          arm: i ? ("B" as const) : ("A" as const),
          planItemId: bound ? item._id : null,
        })),
      },
    });
  const bound = await create(true),
    independent = await create(false),
    get = (experimentId: Id<"editorialExperiments">) =>
      f.signed.query(api.performance.experiments.get, {
        ...scope,
        experimentId,
      });
  const bindings = await f.t.run((ctx) =>
    ctx.db
      .query("editorialExperimentBindings")
      .withIndex("by_draftVersionId_and_sourceUnavailable", (q) =>
        q
          .eq("draftVersionId", initial.versionId)
          .eq("sourceUnavailable", false),
      )
      .collect(),
  );
  expect(bindings).toHaveLength(2);
  expect((await get(bound.experimentId)).spec).not.toBeNull();
  const parents = await f.t.run(async (ctx) => ({
    schedules: await ctx.db.query("schedules").collect(),
    approvals: await ctx.db.query("approvals").collect(),
    budgets: await ctx.db.query("aiBudgets").collect(),
    attempts: await ctx.db.query("aiAttempts").collect(),
  }));
  await f.t.run((ctx) => ctx.db.delete(initial.versionId));
  expect((await get(bound.experimentId)).spec).toBeNull();
  expect((await get(independent.experimentId)).spec).not.toBeNull();
  await f.t.mutation(internal.content.feedback.purgeVersion, {
    versionId: initial.versionId,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("editorialExperimentBindings")
        .withIndex("by_draftVersionId_and_sourceUnavailable", (q) =>
          q
            .eq("draftVersionId", initial.versionId)
            .eq("sourceUnavailable", true),
        )
        .collect(),
    ),
  ).toHaveLength(2);
  expect((await get(independent.experimentId)).spec).not.toBeNull();
  expect(
    await f.t.run(async (ctx) => ({
      schedules: await ctx.db.query("schedules").collect(),
      approvals: await ctx.db.query("approvals").collect(),
      budgets: await ctx.db.query("aiBudgets").collect(),
      attempts: await ctx.db.query("aiAttempts").collect(),
    })),
  ).toEqual(parents);
});

test("experiment actual 32 units reuse one complete 125-vector native frame inside unchanged read ceilings", async () => {
  const f = await fixture(25, 4096, false, true, "2026-10-06T08:00:00Z", 7);
  await fillHistory(f);
  const series = await f.create(),
    planId = (await f.fire(series.seriesId))!,
    plan = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId,
    });
  expect(plan.items.length).toBeGreaterThanOrEqual(2);
  expect(plan.plan.semantic!.vectorCount).toBe(125);
  const reviewers = await f.t.run(async (ctx) => {
    const ids: Id<"users">[] = [];
    for (let n = 0; n < 16; n++) {
      const userId = await ctx.db.insert("users", {
        authId: `synthetic-native-reviewer-${n}`,
        defaultWorkspaceId: f.workspaceId,
        activeWorkspaceId: f.workspaceId,
      });
      await ctx.db.insert("memberships", {
        workspaceId: f.workspaceId,
        userId,
        role: "Editor",
      });
      ids.push(userId);
    }
    return ids;
  });
  const units = plan.items.slice(0, 2).flatMap(({ item }, i) =>
    reviewers.map((reviewerId) => ({
      versionId: item.versionId,
      reviewerId,
      arm: i ? ("B" as const) : ("A" as const),
      planItemId: item._id,
    })),
  );
  const scope = { workspaceId: f.workspaceId, accountId: f.accountId },
    args = {
      ...scope,
      expectedRevision: 0,
      commandKey: "max-native-experiment",
      action: {
        kind: "declare" as const,
        spec: {
          hypothesis: "Synthetic finite 32 exact human review units",
          dimension: "hook" as const,
          a: "Question",
          b: "Observation",
          outcome: "editorial-decision-v1" as const,
          startsAt: Date.now(),
          endsAt: Date.now() + 3600000,
          sampleCap: 32,
          stopCondition: "Explicit hour",
          context: "Human declares exact native 125-vector series context",
          frequency: "Actual configured weekly series; no new publishing",
        },
        units,
      },
    };
  const limits = {
    databaseQueries: 4096,
    bytesRead: 16 * 1024 * 1024,
    documentsRead: 32000,
  };
  const declaration = await f.signed.run(async (ctx) => ({
    value: await ctx.runMutation(api.performance.experiments.change, args, {
      transactionLimits: limits,
    }),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  const start = await f.signed.run(async (ctx) => ({
    value: await ctx.runMutation(
      api.performance.experiments.change,
      {
        ...scope,
        experimentId: declaration.value.experimentId,
        expectedRevision: 1,
        commandKey: "max-native-start",
        action: { kind: "start" },
      },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  const detail = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(
      api.performance.experiments.get,
      { ...scope, experimentId: declaration.value.experimentId },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(detail.value.counts).toMatchObject({
    enrolled: 32,
    withdrawn: 0,
    noFeedback: 32,
  });
  expect(detail.value.enrollmentCapped).toBe(true);
  writeFileSync(
    "/tmp/dispatch-47.1-native-frame-budget.json",
    JSON.stringify(
      {
        qualification:
          "32 native version+reviewer units: two exact eligible original GitHub drafts reviewed by16 actual synthetic native Editor membership rows each, one actual plan,125 native vectors with100 rich12000-byte injected history records/25 draft vectors,4096 dimensions,14 GitHub draft/idea nodes plus one fresh declared style; short synthetic policy/rights markers. This is not32 independent disjoint max ancestry roots or empirical independent samples.",
        declaration: declaration.metrics,
        start: start.metrics,
        detail: detail.metrics,
      },
      null,
      2,
    ),
  );
}, 900000);

async function acceptedRecurringReplay(
  mode: "approved" | "approve_and_schedule",
  outsideHistory = false,
) {
  const f = await fixture(outsideHistory ? 6 : 4);
  let historyScheduleId: Id<"schedules"> | undefined;
  let historyVersionId: Id<"draftVersions"> | undefined;
  if (outsideHistory) {
    historyVersionId = f.config.candidateVersionIds[5];
    f.request.action.config = {
      ...f.config,
      candidateVersionIds: f.config.candidateVersionIds.slice(0, 5),
    };
    const approvalId = await f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      versionId: historyVersionId,
    });
    const at = Date.now() + 30 * 60000;
    historyScheduleId = await f.signed.mutation(api.editorial.schedule, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      versionId: historyVersionId,
      approvalId,
      at,
      timezone: "UTC",
      localTime: new Date(at).toISOString().slice(0, 16),
    });
  }
  const series = await f.create(),
    planId = (await f.fire(series.seriesId))!,
    view = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId,
    }),
    item = view.items[0].item;
  const approvalId =
    mode === "approved"
      ? await f.signed.mutation(api.editorial.approve, {
          workspaceId: f.workspaceId,
          accountId: f.accountId,
          versionId: item.versionId,
        })
      : undefined;
  const args = {
    workspaceId: f.workspaceId,
    planId,
    mode,
    selections: [
      {
        itemId: item._id,
        versionId: item.versionId,
        draftRevision: item.draftRevision,
        ...(approvalId ? { approvalId } : {}),
      },
    ],
  };
  const accepted = await f.signed.mutation(api.planning.accept.selected, args);
  for (const scheduleId of [accepted[0].scheduleId, historyScheduleId])
    if (scheduleId)
      await f.signed.mutation(api.editorial.cancel, {
        workspaceId: f.workspaceId,
        scheduleId,
        expectedGeneration: 1,
      });
  await f.signed.mutation(api.editorial.revoke, {
    workspaceId: f.workspaceId,
    approvalId: accepted[0].approvalId,
  });
  await f.signed.mutation(api.planning.strategy.change, {
    ...f.request,
    seriesId: series.seriesId,
    expectedRevision: 1,
    commandKey: "historical-disable",
    action: { kind: "disable" },
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  const transport = vi.fn();
  vi.stubGlobal("fetch", transport);
  const snapshot = () =>
    f.t.run(async (ctx) => ({
      schedules: await ctx.db.query("schedules").collect(),
      approvals: await ctx.db.query("approvals").collect(),
      budgets: await ctx.db.query("aiBudgets").collect(),
      attempts: await ctx.db.query("aiAttempts").collect(),
      series: await ctx.db.query("planningSeries").collect(),
      versions: await ctx.db.query("planningSeriesVersions").collect(),
      plans: await ctx.db.query("contentPlans").collect(),
      items: await ctx.db.query("contentPlanItems").collect(),
      bindings: await ctx.db.query("semanticPlanBindings").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
  return {
    ...f,
    series,
    planId,
    item,
    args,
    accepted,
    historyVersionId,
    snapshot,
    transport,
  };
}

test.each(["approved", "approve_and_schedule"] as const)(
  "TASK50 recurring historical replay %s survives proposal scrub with cancelled parents and a past slot",
  async (mode) => {
    const f = await acceptedRecurringReplay(mode);
    vi.setSystemTime(f.item.at + 60000);
    const before = await f.snapshot();
    expect(
      await f.signed.mutation(api.planning.accept.selected, f.args),
    ).toEqual(f.accepted);
    expect(await f.snapshot()).toEqual(before);
    expect(before.items.find((i) => i._id === f.item._id)).toMatchObject({
      sourceUnavailable: true,
      sources: [],
      reason: "",
    });
    expect(before.schedules[0].state).toBe("cancelled");
    expect(before.approvals[0].revokedAt).not.toBeNull();
    expect(f.transport).not.toHaveBeenCalled();
  },
);

const recurringReplayLosses = [
  ["draft-root", "REVIEW_SOURCE_UNAVAILABLE"],
  ["version-root", "REFERENCE_ACCESS_DENIED"],
  ["draft-source", "REVIEW_SOURCE_UNAVAILABLE"],
  ["series-root", "SERIES_VERSION_CHANGED"],
  ["series-version-root", "SERIES_VERSION_CHANGED"],
  ["style-root", "STYLE_REFERENCE_ACCESS_DENIED"],
  ["original-membership", "SERIES_AUTHORITY_CHANGED"],
  ["actor-root", "PROFILE_NOT_INITIALIZED"],
  ["account-connection", "SERIES_AUTHORITY_CHANGED"],
  ["caller-role", "ROLE_ACCESS_DENIED"],
  ["item-proof", "REVIEW_SOURCE_UNAVAILABLE"],
  ["item-validity", "REVIEW_SOURCE_UNAVAILABLE"],
  ["plan-series-horizon", "REVIEW_SOURCE_UNAVAILABLE"],
  ["series-horizon", "SERIES_SOURCE_UNAVAILABLE"],
  ["style-horizon", "STYLE_SOURCE_UNAVAILABLE"],
  ["approval-horizon", "REVIEW_SOURCE_UNAVAILABLE"],
  ["schedule-horizon", "REVIEW_SOURCE_UNAVAILABLE"],
] as const;
test.each(
  (["approved", "approve_and_schedule"] as const).flatMap((mode) =>
    recurringReplayLosses.map(([kind, error]) => ({ mode, kind, error })),
  ),
)(
  "TASK50 recurring historical replay $mode denies actual $kind after scrub",
  async ({ mode, kind, error }) => {
    const f = await acceptedRecurringReplay(mode);
    expect(
      await f.signed.mutation(api.planning.accept.selected, f.args),
    ).toEqual(f.accepted);
    await f.t.run(async (ctx) => {
      if (kind === "draft-root") await ctx.db.delete(f.item.draftId);
      if (kind === "version-root") await ctx.db.delete(f.item.versionId);
      if (kind === "draft-source")
        await ctx.db.patch(f.item.versionId, { sourceUnavailable: true });
      if (kind === "series-root") await ctx.db.delete(f.series.seriesId);
      if (kind === "series-version-root")
        await ctx.db.delete(f.series.versionId!);
      if (kind === "style-root") await ctx.db.delete(f.style.versionId!);
      if (kind === "actor-root") await ctx.db.delete(f.userId);
      if (kind === "original-membership" || kind === "caller-role") {
        const member = (await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique())!;
        if (kind === "caller-role")
          await ctx.db.patch(member._id, { role: "Viewer" });
        else {
          await ctx.db.delete(member._id);
          await ctx.db.insert("memberships", {
            userId: f.userId,
            workspaceId: f.workspaceId,
            role: "Owner",
          });
        }
      }
      if (kind === "account-connection")
        await ctx.db.patch(f.accountId, { connection: "disconnected" });
      if (kind === "item-proof")
        await ctx.db.patch(f.item._id, { proofUntil: Date.now() - 1 });
      if (kind === "item-validity")
        await ctx.db.patch(f.item._id, { validityUntil: Date.now() - 1 });
      if (kind === "plan-series-horizon") {
        const p = (await ctx.db.get(f.planId))!;
        await ctx.db.patch(p._id, {
          series: { ...p.series!, sourceUntil: Date.now() - 1 },
        });
      }
      if (kind === "series-horizon")
        await ctx.db.patch(f.series.versionId!, {
          sourceUntil: Date.now() - 1,
        });
      if (kind === "style-horizon")
        await ctx.db.patch(f.style.versionId!, { sourceUntil: Date.now() - 1 });
      if (kind === "approval-horizon") {
        const a = (await ctx.db.get(f.accepted[0].approvalId))!;
        await ctx.db.patch(a._id, {
          reviewPin: { ...a.reviewPin!, sourceUntil: Date.now() - 1 },
        });
      }
      if (kind === "schedule-horizon") {
        const s = (await ctx.db.get(f.accepted[0].scheduleId))!;
        await ctx.db.patch(s._id, {
          reviewPin: { ...s.reviewPin!, sourceUntil: Date.now() - 1 },
        });
      }
    });
    const before = await f.snapshot();
    await expect(
      f.signed.mutation(api.planning.accept.selected, f.args),
    ).rejects.toThrow(error);
    expect(await f.snapshot()).toEqual(before);
    expect(f.transport).not.toHaveBeenCalled();
  },
);

test.each(["approved", "approve_and_schedule"] as const)(
  "TASK50 recurring historical replay %s retains consumed history outside the original candidate frame",
  async (mode) => {
    const f = await acceptedRecurringReplay(mode, true),
      item = (await f.t.run((ctx) => ctx.db.get(f.item._id)))!;
    expect(f.request.action.config.candidateVersionIds).not.toContain(
      f.historyVersionId,
    );
    expect(f.item.historyVersionIds).toContain(f.historyVersionId);
    expect(item.historyVersionIds).toEqual(f.item.historyVersionIds);
    expect(item.contextProofUntil).toBe(f.item.contextProofUntil);
    const view = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId: f.planId,
    });
    expect(
      view.items.every(
        (i) =>
          !i.title &&
          !i.item.reason &&
          !i.item.historyVersionIds?.length &&
          !i.item.sources.length,
      ),
    ).toBe(true);
    const before = await f.snapshot();
    expect(
      await f.signed.mutation(api.planning.accept.selected, f.args),
    ).toEqual(f.accepted);
    expect(await f.snapshot()).toEqual(before);
    await f.t.run((ctx) =>
      ctx.db.patch(item._id, { contextProofUntil: Date.now() - 1 }),
    );
    const expired = await f.snapshot();
    await expect(
      f.signed.mutation(api.planning.accept.selected, f.args),
    ).rejects.toThrow("REVIEW_SOURCE_UNAVAILABLE");
    expect(await f.snapshot()).toEqual(expired);
    await f.t.run(async (ctx) => {
      await ctx.db.patch(item._id, {
        contextProofUntil: item.contextProofUntil,
      });
      await ctx.db.delete(f.historyVersionId!);
    });
    const deleted = await f.snapshot();
    await expect(
      f.signed.mutation(api.planning.accept.selected, f.args),
    ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
    expect(await f.snapshot()).toEqual(deleted);
    expect(f.transport).not.toHaveBeenCalled();
  },
);

test("TASK50 recurring historical replay preserves actually consumed second-occurrence IDs while proposed context scrubs", async () => {
  const f = await fixture(6),
    series = await f.create(),
    firstId = (await f.fire(series.seriesId))!,
    first = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId: firstId,
    }),
    initial = first.items[0].item;
  const one = await f.signed.mutation(api.planning.accept.selected, {
    workspaceId: f.workspaceId,
    planId: firstId,
    mode: "approve_and_schedule",
    selections: [
      {
        itemId: initial._id,
        versionId: initial.versionId,
        draftRevision: initial.draftRevision,
      },
    ],
  });
  await f.t.run(async (ctx) => {
    const sessions = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      { model: "session", paginationOpts: { numItems: 100, cursor: null } },
    );
    for (const session of sessions.page)
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "session",
          where: [{ field: "_id", value: session._id }],
          update: { expiresAt: Date.now() + 30 * 86400000 },
        },
      });
  });
  const secondId = (await f.fire(series.seriesId))!,
    second = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId: secondId,
    }),
    item = second.items[0].item;
  expect(item.historyVersionIds).toContain(initial.versionId);
  const args = {
      workspaceId: f.workspaceId,
      planId: secondId,
      mode: "approve_and_schedule" as const,
      selections: [
        {
          itemId: item._id,
          versionId: item.versionId,
          draftRevision: item.draftRevision,
        },
      ],
    },
    accepted = await f.signed.mutation(api.planning.accept.selected, args);
  for (const result of [...one, ...accepted])
    await f.signed.mutation(api.editorial.cancel, {
      workspaceId: f.workspaceId,
      scheduleId: result.scheduleId,
      expectedGeneration: 1,
    });
  await f.signed.mutation(api.planning.strategy.change, {
    ...f.request,
    seriesId: series.seriesId,
    expectedRevision: 1,
    commandKey: "second-disable",
    action: { kind: "disable" },
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0), 1000);
  const rows = await f.t.run((ctx) =>
    ctx.db
      .query("contentPlanItems")
      .withIndex("by_planId", (q) => q.eq("planId", secondId))
      .take(8),
  );
  expect(rows.find((i) => i._id === item._id)?.historyVersionIds).toEqual(
    item.historyVersionIds,
  );
  expect(
    rows
      .filter((i) => i.status === "proposed")
      .every(
        (i) =>
          i.historyVersionIds?.length === 0 &&
          i.sources.length === 0 &&
          !i.reason,
      ),
  ).toBe(true);
  expect(await f.signed.mutation(api.planning.accept.selected, args)).toEqual(
    accepted,
  );
});

test("TASK50 recurring historical replay propagates native capacity errors without source or financial writes", async () => {
  const f = await acceptedRecurringReplay("approve_and_schedule"),
    before = await f.snapshot();
  const measured = await f.signed.run(async (ctx) => {
    await ctx.runMutation(api.planning.accept.selected, f.args);
    return ctx.meta.getTransactionMetrics();
  });
  expect(measured.databaseQueries.used).toBeGreaterThan(20);
  await expect(
    f.signed.run((ctx) =>
      ctx.runMutation(api.planning.accept.selected, f.args, {
        transactionLimits: {
          databaseQueries: measured.databaseQueries.used - 1,
          bytesRead: 16 * 1024 * 1024,
          documentsRead: 32000,
        },
      }),
    ),
  ).rejects.toThrow(/limit/i);
  expect(await f.snapshot()).toEqual(before);
  expect(f.transport).not.toHaveBeenCalled();
});

test.each(
  (["approved", "approve_and_schedule"] as const).flatMap((mode) =>
    (["disable", "style"] as const).map((path) => ({ mode, path })),
  ),
)(
  "TASK50 historical replay cannot admit a proposed sibling from its cached proof before $path cleanup ($mode)",
  async ({ mode, path }) => {
    const f = await fixture(),
      series = await f.create(),
      planId = (await f.fire(series.seriesId))!,
      view = await f.signed.query(api.planning.plans.get, {
        workspaceId: f.workspaceId,
        planId,
      });
    const selections: {
      itemId: Id<"contentPlanItems">;
      versionId: Id<"draftVersions">;
      draftRevision: number;
      approvalId?: Id<"approvals">;
    }[] = [];
    for (const { item } of view.items.slice(0, 2)) {
      const approvalId =
        mode === "approved"
          ? await f.signed.mutation(api.editorial.approve, {
              workspaceId: f.workspaceId,
              accountId: f.accountId,
              versionId: item.versionId,
            })
          : undefined;
      selections.push({
        itemId: item._id,
        versionId: item.versionId,
        draftRevision: item.draftRevision,
        ...(approvalId ? { approvalId } : {}),
      });
    }
    const args = { workspaceId: f.workspaceId, planId, mode, selections };
    const accepted = await f.signed.mutation(api.planning.accept.selected, {
      ...args,
      selections: selections.slice(0, 1),
    });
    if (path === "disable")
      await f.signed.mutation(api.planning.strategy.change, {
        ...f.request,
        seriesId: series.seriesId,
        expectedRevision: 1,
        commandKey: "mixed-selection-disable",
        action: { kind: "disable" },
      });
    else {
      const saved = await f.signed.mutation(api.ai.styleProfiles.change, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        expectedRevision: 2,
        commandKey: "mixed-selection-style-save",
        action: {
          kind: "save",
          payload: {
            author: "Alternative declared author",
            experiences: [],
            tone: "Precise",
            positioning: "Alternative",
            pillars: [{ name: "Product", weight: 100 }],
            examples: [],
            forbidden: [],
          },
          freshDeclaration: true,
          baseVersionId: null,
          reason: "Explicit alternative declaration",
        },
      });
      await f.signed.mutation(api.ai.styleProfiles.change, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        expectedRevision: saved.revision,
        commandKey: "mixed-selection-style-select",
        action: {
          kind: "select",
          versionId: saved.versionId!,
          reason: "Explicit alternative selection",
        },
      });
    }
    expect(
      (await f.t.run((ctx) => ctx.db.get(selections[1].itemId)))!
        .sourceUnavailable,
    ).not.toBe(true);
    const snapshot = () =>
      f.t.run(async (ctx) => ({
        schedules: await ctx.db.query("schedules").collect(),
        approvals: await ctx.db.query("approvals").collect(),
        items: await ctx.db.query("contentPlanItems").collect(),
        series: await ctx.db.get(series.seriesId),
        budgets: await ctx.db.query("aiBudgets").collect(),
        attempts: await ctx.db.query("aiAttempts").collect(),
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      }));
    const before = await snapshot();
    await expect(
      f.signed.mutation(api.planning.accept.selected, args),
    ).rejects.toThrow(
      path === "disable" ? "SERIES_VERSION_CHANGED" : "STYLE_SELECTION_CHANGED",
    );
    expect(await snapshot()).toEqual(before);
    expect(
      await f.signed.mutation(api.planning.accept.selected, {
        ...args,
        selections: selections.slice(0, 1),
      }),
    ).toEqual(accepted);
  },
);
