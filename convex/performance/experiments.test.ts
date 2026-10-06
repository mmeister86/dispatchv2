import { writeFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { mediaFixture } from "../../tests/media-fixture";
import { draftResearchProof } from "../research/contentProof";
import { materialWalk } from "../research/pipelineAccess";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function fixture(count = 2) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T08:00:00Z"));
  const f = await mediaFixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
      name: "Synthetic",
      handle: "synthetic",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
        publish: true,
      },
    }),
  );
  const content = {
    title: "Synthetic",
    text: ["Before text"],
    media: [],
    accountId,
    pillar: "Product",
    strategy: "manual",
  };
  const versions: Id<"draftVersions">[] = [],
    drafts: Id<"drafts">[] = [];
  for (let i = 0; i < count; i++) {
    const d = await f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      source: "Manual synthetic",
      content,
    });
    drafts.push(d);
    versions.push((await f.t.run((ctx) => ctx.db.get(d)))!.currentVersionId!);
  }
  const scope = { workspaceId: f.workspaceId, accountId };
  const units = versions.map((versionId, i) => ({
    versionId,
    reviewerId: f.userId,
    arm: i % 2 ? ("B" as const) : ("A" as const),
    planItemId: null,
  }));
  const spec = {
    hypothesis: "Explicit synthetic hypothesis",
    dimension: "hook" as const,
    a: "Question",
    b: "Observation",
    outcome: "editorial-decision-v1" as const,
    startsAt: Date.now(),
    endsAt: Date.now() + 3600000,
    sampleCap: count,
    stopCondition: "End of declared hour",
    context: "Manual synthetic reviewed draft context",
    frequency: "No publishing; one explicit editorial review per unit",
  };
  const declareArgs = {
    ...scope,
    expectedRevision: 0,
    commandKey: "declare",
    action: { kind: "declare" as const, spec, units },
  };
  const declare = () =>
    f.signed.mutation(api.performance.experiments.change, declareArgs);
  const command = (
    id: Id<"editorialExperiments">,
    kind: "start" | "stop",
    revision: number,
    key: string = kind,
  ) =>
    f.signed.mutation(api.performance.experiments.change, {
      ...scope,
      experimentId: id,
      expectedRevision: revision,
      commandKey: key,
      action: { kind },
    });
  const get = (id: Id<"editorialExperiments">) =>
    f.signed.query(api.performance.experiments.get, {
      ...scope,
      experimentId: id,
    });
  const decide = (i: number, kind: "accept" | "reject") =>
    f.signed.mutation(api.content.feedback.decide, {
      workspaceId: f.workspaceId,
      versionId: versions[i],
      kind,
    });
  return {
    ...f,
    accountId,
    scope,
    content,
    versions,
    drafts,
    units,
    spec,
    declareArgs,
    declare,
    command,
    get,
    decide,
  };
}
test.each([
  "hypothesis",
  "a",
  "b",
  "stopCondition",
  "context",
  "frequency",
] as const)("declaration requires human %s", async (field) => {
  const f = await fixture();
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      action: { ...f.declareArgs.action, spec: { ...f.spec, [field]: " " } },
    }),
  ).rejects.toThrow("INPUT_INVALID");
});
test.each([
  { sampleCap: 33 },
  { sampleCap: 1 },
  { sampleCap: 2.5 },
  { endsAt: 0 },
  { endsAt: Date.parse("2026-11-07T08:00Z") },
  { a: "Observation" },
])("invalid finite declaration %j leaves no experiment", async (patch) => {
  const f = await fixture();
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      action: { ...f.declareArgs.action, spec: { ...f.spec, ...patch } },
    }),
  ).rejects.toThrow("INPUT_INVALID");
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialExperiments").collect()),
  ).toHaveLength(0);
});
test("one dimension and exact supported outcome are runtime validated", async () => {
  const f = await fixture();
  for (const patch of [
    { dimension: "hook+format" },
    { outcome: "generator-success" },
  ])
    await expect(
      f.signed.mutation(api.performance.experiments.change, {
        ...f.declareArgs,
        action: {
          ...f.declareArgs.action,
          spec: { ...f.spec, ...patch } as typeof f.spec,
        },
      }),
    ).rejects.toThrow();
});
test("current roles, exact account and actual reviewer scope reject forged declarations", async () => {
  const f = await fixture();
  const membership = (await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique(),
  ))!;
  for (const role of ["Editor", "Viewer"] as const) {
    await f.t.run((ctx) => ctx.db.patch(membership._id, { role }));
    await expect(f.declare()).rejects.toThrow("ROLE_ACCESS_DENIED");
  }
  await f.t.run((ctx) => ctx.db.patch(membership._id, { role: "Owner" }));
  const other = await f.t.run(async (ctx) => {
    const ws = await ctx.db.insert("workspaces", {
      name: "Other",
      description: "",
    });
    const u = await ctx.db.insert("users", {
      authId: "other",
      defaultWorkspaceId: ws,
      activeWorkspaceId: ws,
    });
    const a = (await ctx.db.get(f.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return {
      account: await ctx.db.insert("socialAccounts", {
        ...fields,
        workspaceId: ws,
      }),
      user: u,
    };
  });
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      accountId: other.account,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      action: {
        ...f.declareArgs.action,
        units: f.units.map((u) => ({ ...u, reviewerId: other.user })),
      },
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.versions[0], {
      content: { ...f.content, accountId: other.account },
    }),
  );
  await expect(f.declare()).rejects.toThrow("REFERENCE_ACCESS_DENIED");
});
test("exact replay, changed intent, stale CAS, immutable manifest and terminal end", async () => {
  const f = await fixture(),
    d = await f.declare();
  expect(await f.declare()).toEqual(d);
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      action: {
        ...f.declareArgs.action,
        spec: { ...f.spec, hypothesis: "Different" },
      },
    }),
  ).rejects.toThrow("COMMAND_CONFLICT");
  const start = await f.command(d.experimentId, "start", 1);
  expect(await f.command(d.experimentId, "start", 1)).toEqual(start);
  await expect(f.command(d.experimentId, "stop", 1)).rejects.toThrow(
    "REVISION_CONFLICT",
  );
  const stopped = await f.command(d.experimentId, "stop", 2);
  expect(stopped.revision).toBe(3);
  expect(await f.command(d.experimentId, "start", 1)).toEqual(start);
  expect((await f.get(d.experimentId)).state).toBe("stopped");
  await expect(f.command(d.experimentId, "start", 3, "resume")).rejects.toThrow(
    "TERMINAL",
  );
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      experimentId: d.experimentId,
      commandKey: "replace",
      expectedRevision: 3,
    }),
  ).rejects.toThrow("REVISION_CONFLICT");
  const g = await fixture(),
    e = await g.declare();
  vi.setSystemTime(g.spec.endsAt);
  expect((await g.get(e.experimentId)).state).toBe("ended");
  await expect(g.command(e.experimentId, "start", 1)).rejects.toThrow(
    "TERMINAL",
  );
});
test("same millisecond before/start/after/stop is ordered by actual atomic native sequence", async () => {
  const f = await fixture();
  await f.decide(0, "accept");
  await expect(f.declare()).rejects.toThrow("PREDECIDED_UNIT");
  const g = await fixture(),
    d = await g.declare();
  await g.decide(0, "reject");
  await expect(g.command(d.experimentId, "start", 1)).rejects.toThrow(
    "PREDECIDED_UNIT",
  );
  const h = await fixture();
  // A prior edit at the same clock instant is not a prospective event; its exact source version remains assigned.
  await h.signed.mutation(api.editorial.save, {
    workspaceId: h.workspaceId,
    draftId: h.drafts[0],
    expectedRevision: 1,
    content: { ...h.content, text: ["Prior edit"] },
    reason: "Before start",
  });
  const e = await h.declare();
  await h.command(e.experimentId, "start", 1);
  await h.decide(0, "accept");
  await h.command(e.experimentId, "stop", 2);
  await h.decide(0, "reject");
  await h.decide(1, "accept");
  const detail = await h.get(e.experimentId);
  expect(detail.counts).toMatchObject({
    enrolled: 2,
    decided: 1,
    accept: 1,
    reject: 0,
    conflict: 0,
    noFeedback: 1,
    edited: 0,
  });
  const [experiment, events, ws] = await h.t.run(
    async (ctx) =>
      [
        await ctx.db.get(e.experimentId),
        await ctx.db.query("contentFeedback").collect(),
        await ctx.db.get(h.workspaceId),
      ] as const,
  );
  expect(experiment!.startSequence).toBe(1);
  expect(experiment!.stopSequence).toBe(2);
  expect(events.map((x) => x.createdAt)).toEqual(Array(4).fill(Date.now()));
  expect(events.map((x) => x.sequence)).toEqual([1, 2, 3, 4]);
  expect(ws!.feedbackSequence).toBe(4);
});
test("concurrent native sequence/start and decision/stop races have only serializable outcomes", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  const result = await Promise.allSettled([
    f.decide(0, "accept"),
    f.command(d.experimentId, "stop", 2),
  ]);
  expect(result.every((r) => r.status === "fulfilled")).toBe(true);
  const [e, event] = await f.t.run(
    async (ctx) =>
      [
        await ctx.db.get(d.experimentId),
        await ctx.db.query("contentFeedback").first(),
      ] as const,
  );
  expect((await f.get(d.experimentId)).counts.accept).toBe(
    event!.sequence! <= e!.stopSequence! ? 1 : 0,
  );
});
test("explicit accepts and approval accepts dedupe; contradictory native decisions remain conflict", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  await f.decide(0, "accept");
  await f.decide(0, "accept");
  await f.signed.mutation(api.editorial.approve, {
    ...f.scope,
    versionId: f.versions[0],
  });
  let detail = await f.get(d.experimentId);
  expect(detail.counts).toMatchObject({ accept: 1, decided: 1, enrolled: 2 });
  await f.decide(0, "reject");
  detail = await f.get(d.experimentId);
  expect(detail.counts).toMatchObject({
    accept: 0,
    reject: 0,
    decided: 0,
    conflict: 1,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("approvals").collect()),
  ).toHaveLength(1);
});
test("actual v1→v2 edit stays one exact before unit; null extent and result loss are missing data", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  const v2 = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.drafts[0],
    expectedRevision: 1,
    content: { ...f.content, text: ["After text"] },
    reason: "Actual edit",
  });
  let detail = await f.get(d.experimentId);
  expect(detail.counts).toMatchObject({ enrolled: 2, decided: 0, edited: 1 });
  expect(detail.units[0].versionId).toBe(f.versions[0]);
  expect(detail.units[0].editExtent).toBeGreaterThan(0);
  const feedback = (await f.t.run((ctx) =>
    ctx.db.query("contentFeedback").first(),
  ))!;
  await f.t.run((ctx) => ctx.db.patch(feedback._id, { editExtent: null }));
  detail = await f.get(d.experimentId);
  expect(detail.counts.missingEdits).toBe(1);
  expect(detail.units[0].editExtent).toBeNull();
  await f.t.run(async (ctx) => {
    const authorId = await ctx.db.insert("users", {
      authId: "other-author",
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    });
    await ctx.db.patch(v2, { authorId });
  });
  detail = await f.get(d.experimentId);
  expect(detail.counts.missingEdits).toBe(1);
  expect(detail.counts.decided).toBe(0);
  await f.decide(0, "accept");
  expect((await f.get(d.experimentId)).counts.accept).toBe(1);
});
test.each(["account", "draft", "adjacent", "author", "expired"])(
  "bilateral edit %s mismatch is unavailable, never fabricated zero",
  async (mode) => {
    const f = await fixture(),
      d = await f.declare();
    await f.command(d.experimentId, "start", 1);
    const v2 = await f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.drafts[0],
      expectedRevision: 1,
      content: { ...f.content, text: ["After"] },
      reason: "Edit",
    });
    await f.t.run(async (ctx) => {
      if (mode === "account")
        await ctx.db.patch(v2, { content: { ...f.content, accountId: null } });
      if (mode === "draft") await ctx.db.patch(v2, { draftId: f.drafts[1] });
      if (mode === "adjacent") await ctx.db.patch(v2, { number: 3 });
      if (mode === "author") {
        const authorId = await ctx.db.insert("users", {
          authId: "other-author",
          defaultWorkspaceId: f.workspaceId,
          activeWorkspaceId: f.workspaceId,
        });
        await ctx.db.patch(v2, { authorId });
      }
      if (mode === "expired") {
        const row = (await ctx.db.query("contentFeedback").first())!;
        await ctx.db.patch(row._id, { sourceUntil: Date.now() });
      }
    });
    const detail = await f.get(d.experimentId);
    expect(detail.counts).toMatchObject({ decided: 0, missingEdits: 1 });
    expect(detail.units[0].editExtent).toBeNull();
  },
);
test("legacy rows never backfill into prospective decisions and end excludes exact deadline", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  await f.t.run((ctx) =>
    ctx.db.insert("contentFeedback", {
      ...f.scope,
      versionId: f.versions[0],
      actorId: f.userId,
      resultingVersionId: null,
      kind: "accept",
      createdAt: Date.now(),
      sourceUntil: null,
      sourceUnavailable: false,
      editExtent: null,
      definition: "changed-middle-codepoints-v1",
    }),
  );
  expect((await f.get(d.experimentId)).counts.accept).toBe(0);
  vi.setSystemTime(f.spec.endsAt);
  await f.decide(1, "accept");
  expect((await f.get(d.experimentId)).counts.accept).toBe(0);
});
test("current proof precedes receipts; actor loss masks immediately and physically clears arms/intent without resurrection", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  const membership = (await f.t.run((ctx) =>
    ctx.db.query("memberships").first(),
  ))!;
  await f.t.run((ctx) => ctx.db.patch(membership._id, { role: "Viewer" }));
  const detail = await f.get(d.experimentId);
  expect(detail.spec).toBeNull();
  expect(detail.counts.withdrawn).toBe(2);
  await expect(f.declare()).rejects.toThrow("ROLE_ACCESS_DENIED");
  await f.t.mutation(internal.performance.experiments.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentAssignments").collect(),
  );
  expect(
    rows.every((r) => r.arm === null && r.reviewerFingerprint === ""),
  ).toBe(true);
  expect((await f.t.run((ctx) => ctx.db.get(d.experimentId)))!.spec).toBeNull();
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentCommands").collect(),
      )
    ).every((r) => r.fingerprint === null),
  ).toBe(true);
  await f.t.run((ctx) => ctx.db.patch(membership._id, { role: "Owner" }));
  await expect(f.declare()).rejects.toThrow("SOURCE_UNAVAILABLE");
});
test("indexed version cleanup crosses 50 descendants with root gone and preserves independent publishing/financial parents", async () => {
  const f = await fixture();
  const first = await f.declare();
  const template = (await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentAssignments").first(),
  ))!;
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 55; i++) {
      const { _id, _creationTime, ...fields } = template;
      const e = (await ctx.db.get(first.experimentId))!;
      const { _id: eid, _creationTime: et, ...ef } = e;
      const id = await ctx.db.insert("editorialExperiments", ef);
      await ctx.db.insert("editorialExperimentAssignments", {
        ...fields,
        experimentId: id,
      });
    }
    await ctx.db.delete(f.versions[0]);
  });
  await f.t.mutation(internal.content.feedback.purgeVersion, {
    versionId: f.versions[0],
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentAssignments").collect(),
  );
  expect(rows).toHaveLength(57);
  expect(rows.every((r) => r.sourceUnavailable && r.arm === null)).toBe(true);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(0);
});
async function mixedAncestry(
  f: Awaited<ReturnType<typeof fixture>>,
  recursive = 30,
) {
  const horizon = Date.now() + 1800000;
  await f.t.run(async (ctx) => {
    let parent: Id<"ideaVersions"> | undefined;
    for (let i = 0; i <= recursive; i++) {
      const ideaId = await ctx.db.insert("ideas", {
        workspaceId: f.workspaceId,
        actorId: f.userId,
        operationKey: `ancestry-${i}`,
        fingerprint: "synthetic",
        revision: 1,
        currentVersionId: null,
        status: "accepted",
        updatedAt: Date.now(),
      });
      parent = await ctx.db.insert("ideaVersions", {
        workspaceId: f.workspaceId,
        ideaId,
        number: 1,
        actorId: f.userId,
        createdAt: Date.now(),
        title: "Synthetic inherited note",
        note: "n".repeat(12000),
        perspective: "Synthetic",
        priority: "normal",
        source: { kind: "note" },
        originals: [],
        rationale: "",
        questions: [],
        ...(parent ? { inputVersionId: parent } : {}),
        researchProofUntil: horizon,
      });
      await ctx.db.patch(ideaId, { currentVersionId: parent });
    }
    for (const id of f.versions.slice(0, 2))
      await ctx.db.patch(id, {
        ideaVersionId: parent,
        content: { ...f.content, text: ["x".repeat(12000)] },
      });
  });
  return horizon;
}
test("actual 32-unit mixed ancestry start/detail/sweep retains original 32-node and native budgets", async () => {
  const f = await fixture(32),
    horizon = await mixedAncestry(f);
  const limits = {
    databaseQueries: 4096,
    bytesRead: 16 * 1024 * 1024,
    documentsRead: 32000,
  };
  const walk = materialWalk();
  await f.t.run(async (ctx) => {
    for (const id of f.versions)
      await draftResearchProof(ctx, (await ctx.db.get(id))!, walk);
  });
  expect(walk.budget.counted.size).toBe(32);
  const declared = await f.signed.run(async (ctx) => ({
    value: await ctx.runMutation(
      api.performance.experiments.change,
      f.declareArgs,
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  const start = await f.signed.run(async (ctx) => ({
    value: await ctx.runMutation(
      api.performance.experiments.change,
      {
        ...f.scope,
        experimentId: declared.value.experimentId,
        expectedRevision: 1,
        commandKey: "start",
        action: { kind: "start" },
      },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  await f.decide(2, "accept");
  const detail = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(
      api.performance.experiments.get,
      { ...f.scope, experimentId: declared.value.experimentId },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(detail.value.counts).toMatchObject({
    enrolled: 32,
    decided: 1,
    noFeedback: 31,
    withdrawn: 0,
  });
  expect(detail.value.sourceUntil).toBe(horizon);
  const sweep = await f.t.run(async (ctx) => ({
    value: await ctx.runMutation(
      internal.performance.experiments.sweep,
      { cursor: null },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  writeFileSync(
    "/tmp/dispatch-47.1-native-budget.json",
    JSON.stringify(
      {
        qualification:
          "32 actual units: two 12,000-byte inherited drafts sharing 30 recursive note ancestors, thirty independent manual drafts; exactly 32 protected ancestors, one native manual decision; short synthetic identity/rights markers, no real policies, no 32 disjoint roots",
        declared: declared.metrics,
        start: start.metrics,
        detail: detail.metrics,
        sweep: sweep.metrics,
      },
      null,
      2,
    ),
  );
});
test("aggregate ancestry overflow and native capacity failure propagate without erasure or new effects", async () => {
  const f = await fixture(32);
  await mixedAncestry(f, 31);
  await expect(f.declare()).rejects.toThrow("ANCESTRY_LIMIT");
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialExperiments").collect()),
  ).toHaveLength(0);
  const g = await fixture(),
    d = await g.declare();
  await expect(
    g.signed.run((ctx) =>
      ctx.runMutation(
        api.performance.experiments.change,
        {
          ...g.scope,
          experimentId: d.experimentId,
          commandKey: "limited-start",
          expectedRevision: 1,
          action: { kind: "start" },
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
  expect(
    (await g.t.run((ctx) => ctx.db.get(d.experimentId)))!.sourceUnavailable,
  ).toBe(false);
  const spy = vi.fn();
  vi.stubGlobal("fetch", spy);
  await g.command(d.experimentId, "start", 1);
  await g.command(d.experimentId, "stop", 2);
  await g.get(d.experimentId);
  expect(spy).not.toHaveBeenCalled();
  for (const table of [
    "approvals",
    "schedules",
    "aiAttempts",
    "aiBudgets",
  ] as const)
    expect(await g.t.run((ctx) => ctx.db.query(table).collect())).toHaveLength(
      0,
    );
});
test("shorter original horizon clamps and restoration never renews protected assignment", async () => {
  const f = await fixture(2),
    horizon = await mixedAncestry(f, 2),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  const idea = (await f.t.run((ctx) => ctx.db.query("ideaVersions").first()))!,
    shortened = Date.now() + 1000;
  await f.t.run((ctx) =>
    ctx.db.patch(idea._id, { researchProofUntil: shortened }),
  );
  expect((await f.get(d.experimentId)).sourceUntil).toBe(shortened);
  await f.t.mutation(internal.performance.experiments.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  await f.t.run((ctx) =>
    ctx.db.patch(idea._id, { researchProofUntil: horizon }),
  );
  vi.setSystemTime(shortened + 1);
  const detail = await f.get(d.experimentId);
  expect(detail.spec).toBeNull();
  expect(detail.counts.withdrawn).toBe(2);
});

test("frozen enrollment cap remains stable while later contradictory events stay visible", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  await f.decide(0, "accept");
  await f.decide(1, "accept");
  expect((await f.get(d.experimentId)).enrollmentCapped).toBe(true);
  await f.decide(0, "reject");
  const detail = await f.get(d.experimentId);
  expect(detail.enrollmentCapped).toBe(true);
  expect(detail.counts).toMatchObject({
    enrolled: 2,
    decided: 1,
    accept: 1,
    conflict: 1,
  });
  expect(detail.arms.A.conflict).toBe(1);
  await expect(
    f.command(d.experimentId, "start", 2, "resume-after-cap"),
  ).rejects.toThrow("TERMINAL");
});
test("same-millisecond start/decision race either excludes prior terminal feedback or freezes a true later event", async () => {
  const f = await fixture(),
    d = await f.declare();
  const raced = await Promise.allSettled([
    f.command(d.experimentId, "start", 1),
    f.decide(0, "accept"),
  ]);
  expect(raced[1].status).toBe("fulfilled");
  const detail = await f.get(d.experimentId),
    e = (await f.t.run((ctx) => ctx.db.get(d.experimentId)))!,
    event = (await f.t.run((ctx) => ctx.db.query("contentFeedback").first()))!;
  if (raced[0].status === "fulfilled") {
    expect(e.startSequence).toBeLessThan(event.sequence!);
    expect(detail.counts.accept).toBe(1);
  } else {
    expect(String(raced[0].reason)).toContain("PREDECIDED_UNIT");
    expect(e.startSequence).toBeNull();
    expect(detail.counts.accept).toBe(0);
  }
});
test("result-side feedback cleanup strips exact edit extent while keeping independent before-version proof and unobserved after-stop events inert", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  const result = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.drafts[0],
    expectedRevision: 1,
    content: { ...f.content, text: ["Changed"] },
    reason: "Bilateral edit",
  });
  await f.command(d.experimentId, "stop", 2);
  await f.decide(0, "accept");
  await f.t.run((ctx) => ctx.db.patch(result, { sourceUnavailable: true }));
  let detail = await f.get(d.experimentId);
  expect(detail.counts).toMatchObject({
    missingEdits: 1,
    accept: 0,
    decided: 0,
  });
  await f.t.mutation(internal.content.feedback.purgeVersion, {
    versionId: result,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  detail = await f.get(d.experimentId);
  expect(detail.counts).toMatchObject({
    missingEdits: 1,
    accept: 0,
    withdrawn: 0,
  });
  expect(detail.units[0].editExtent).toBeNull();
  expect(
    (await f.t.run((ctx) =>
      ctx.db
        .query("contentFeedback")
        .withIndex("by_resultingVersionId_and_sourceUnavailable", (q) =>
          q.eq("resultingVersionId", result).eq("sourceUnavailable", true),
        )
        .first(),
    ))!.editExtent,
  ).toBeNull();
});
test("prospective feedback resource overflow is explicit and leaves receipts and authority intact", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  await f.decide(0, "accept");
  await f.t.run(async (ctx) => {
    const event = (await ctx.db.query("contentFeedback").first())!;
    const { _id, _creationTime, ...fields } = event;
    for (let n = 2; n <= 129; n++)
      await ctx.db.insert("contentFeedback", { ...fields, sequence: n });
    await ctx.db.patch(f.workspaceId, { feedbackSequence: 129 });
  });
  await expect(f.get(d.experimentId)).rejects.toThrow("RESOURCE_CEILING");
  await expect(
    f.t.mutation(internal.performance.experiments.sweep, { cursor: null }),
  ).rejects.toThrow("RESOURCE_CEILING");
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.experimentId)))!.sourceUnavailable,
  ).toBe(false);
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentCommands").collect(),
      )
    ).every((c) => c.fingerprint !== null),
  ).toBe(true);
});

test("repeated exact edit edges dedupe missingness as well as observed extent", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.drafts[0],
    expectedRevision: 1,
    content: { ...f.content, text: ["Changed"] },
    reason: "Exact native edit",
  });
  await f.t.run(async (ctx) => {
    const e = (await ctx.db.query("contentFeedback").first())!;
    await ctx.db.patch(e._id, { editExtent: null });
    const { _id, _creationTime, ...fields } = e;
    await ctx.db.insert("contentFeedback", {
      ...fields,
      sequence: 2,
      editExtent: null,
    });
    await ctx.db.patch(f.workspaceId, { feedbackSequence: 2 });
  });
  const detail = await f.get(d.experimentId);
  expect(detail.counts).toMatchObject({
    enrolled: 2,
    edited: 1,
    missingEdits: 1,
  });
  expect(detail.units[0].editCount).toBe(1);
  expect(detail.units[0].editExtent).toBeNull();
});

test("whole experiment source loss immediately masks surviving sibling derivatives before scrub", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  await f.decide(1, "accept");
  await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.drafts[1],
    expectedRevision: 1,
    content: { ...f.content, text: ["Actual sibling edit"] },
    reason: "Native edit before source loss",
  });
  const before = await f.get(d.experimentId);
  expect(before.counts).toMatchObject({ accept: 1, edited: 1 });
  await f.t.run((ctx) =>
    ctx.db.patch(f.versions[0], { sourceUnavailable: true }),
  );
  const detail = await f.get(d.experimentId);
  expect(detail.state).toBe("withdrawn");
  expect(detail.spec).toBeNull();
  expect(detail.counts).toEqual({
    enrolled: 2,
    withdrawn: 2,
    decided: 0,
    accept: 0,
    reject: 0,
    conflict: 0,
    noFeedback: 0,
    edited: 0,
    missingEdits: 0,
  });
  for (const unit of detail.units)
    expect(unit).toMatchObject({
      arm: null,
      outcome: "withdrawn",
      editCount: 0,
      editExtent: null,
      missingEdits: 0,
    });
  expect(detail.units.map((u) => u.versionId)).toEqual(f.versions);
  for (const arm of Object.values(detail.arms))
    expect(Object.values(arm).every((n) => n === 0)).toBe(true);
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.experimentId)))!.sourceUnavailable,
  ).toBe(false);
  expect(
    (await f.t.run((ctx) => ctx.db.query("contentFeedback").collect())).length,
  ).toBe(2);
});

test("historical exact receipt replay requires its root while valid ended root replay stays terminal", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  vi.setSystemTime(f.spec.endsAt);
  expect(await f.declare()).toEqual(d);
  expect((await f.get(d.experimentId)).state).toBe("ended");
  await f.t.run((ctx) => ctx.db.delete(d.experimentId));
  await expect(f.declare()).rejects.toThrow("EXPERIMENT_SOURCE_UNAVAILABLE");
  expect(
    await f.t.run((ctx) =>
      ctx.db.query("editorialExperimentCommands").collect(),
    ),
  ).toHaveLength(2);
});

test("declared timestamp window precedes native feedback cap for ended observations and cleanup proof", async () => {
  const f = await fixture(),
    d = await f.declare();
  await f.command(d.experimentId, "start", 1);
  await f.decide(0, "accept");
  vi.setSystemTime(f.spec.endsAt);
  await f.decide(0, "reject");
  vi.setSystemTime(f.spec.endsAt + 1);
  for (let n = 0; n < 128; n++) await f.decide(0, "accept");
  const detail = await f.get(d.experimentId);
  expect(detail.state).toBe("ended");
  expect(detail.counts).toMatchObject({
    accept: 1,
    decided: 1,
    reject: 0,
    conflict: 0,
    noFeedback: 1,
  });
  expect(detail.arms.A.accept).toBe(1);
  expect(detail.arms.B.noFeedback).toBe(1);
  await f.t.mutation(internal.performance.experiments.sweep, { cursor: null });
  await f.t.mutation(internal.performance.experiments.purgeFeedback, {
    versionId: f.versions[0],
    reviewerId: f.userId,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.experimentId)))!.sourceUnavailable,
  ).toBe(false);
  expect((await f.get(d.experimentId)).counts.accept).toBe(1);
});
