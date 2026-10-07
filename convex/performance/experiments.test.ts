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
  f: Pick<
    Awaited<ReturnType<typeof fixture>>,
    "t" | "workspaceId" | "userId" | "versions" | "content"
  >,
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

async function publicationFixture(
  count = 2,
  positions = 1,
  mediaCount = 0,
  review = false,
) {
  const f = await fixture(count);
  const reviewUntil = review ? await mixedAncestry(f, 0) : null;
  if (mediaCount) {
    vi.stubEnv("R2_MEDIA_BUCKET", "fixture");
    vi.stubEnv("R2_MEDIA_EU_CONFIRMED", "true");
    vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "synthetic");
  }
  const { seal } = await import("../lib/crypto");
  const { association } = await import("../integrations/x/fields");
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "synthetic");
  await f.t.run(async (ctx) => {
    const account = (await ctx.db.get(f.accountId))!;
    await ctx.db.patch(f.accountId, {
      providerIdentity: "123",
      capability: {
        ...account.capability,
        mediaTypes: mediaCount ? ["image"] : [],
      },
      xEvidence: {
        scopes: [
          "tweet.read",
          "users.read",
          "tweet.write",
          ...(mediaCount ? ["media.write"] : []),
        ],
        identityVerifiedAt: Date.now(),
        connectionSequence: 1,
        textScopeEligible: true,
        mediaScopeEligible: !!mediaCount,
        liveWrite: "verified",
      },
    });
    await ctx.db.insert("xBindings", {
      ...f.scope,
      providerIdentity: "123",
      changedAt: Date.now(),
    });
    await ctx.db.insert("xCredentials", {
      ...f.scope,
      generation: 1,
      envelope: await seal(
        { accessToken: "synthetic-only" },
        association(f.workspaceId, f.accountId),
      ),
      scopes: [
        "tweet.read",
        "users.read",
        "tweet.write",
        ...(mediaCount ? ["media.write"] : []),
      ],
      expiresAt: Date.now() + 5 * 86400000,
      leaseUntil: 0,
      cleanAfter: Number.MAX_SAFE_INTEGER,
    });
    const media = [];
    for (let i = 0; i < mediaCount; i++) {
      const assetId = await ctx.db.insert("mediaAssets", {
        workspaceId: f.workspaceId,
        storageProvider: "r2",
        objectKey: "pending",
        checksum: "a".repeat(64),
        name: "Synthetic",
        type: "image",
        size: 70,
        mime: "image/png",
        state: "ready",
        bucket: "fixture",
        r2AccountId: "0".repeat(32),
        defaultAlt: "Synthetic",
      });
      const objectKey = `final/${f.workspaceId}/${assetId}`;
      const uploadSessionId = await ctx.db.insert("mediaUploadSessions", {
        workspaceId: f.workspaceId,
        assetId,
        temporaryKey: `temporary/${f.workspaceId}/${assetId}`,
        finalKey: objectKey,
        bucket: "fixture",
        r2AccountId: "0".repeat(32),
        expectedSize: 70,
        expectedMime: "image/png",
        expiresAt: Date.now() + 3600000,
        state: "ready",
        leaseUntil: 0,
        generation: 1,
        cleanAfter: Number.MAX_SAFE_INTEGER,
      });
      await ctx.db.patch(assetId, { objectKey, uploadSessionId });
      media.push({ assetId, alt: "Explicit approved synthetic image" });
    }
    for (const versionId of f.versions) {
      const ver = (await ctx.db.get(versionId))!;
      await ctx.db.patch(versionId, {
        content: {
          ...ver.content,
          text: Array.from(
            { length: positions },
            (_, i) => `Explicit position ${i}`,
          ),
          media,
        },
        mediaChecksums: await Promise.all(
          media.map(async (m) => {
            const a = (await ctx.db.get(m.assetId))!;
            return {
              assetId: m.assetId,
              checksum: a.checksum,
              objectKey: a.objectKey,
            };
          }),
        ),
      });
    }
  });
  const policyId = await f.t.mutation(
    internal.performance.capabilities.configure,
    {
      ...f.scope,
      version: "publication-test-v1",
      approvedBy: f.userId,
      expiresAt: Date.now() + 5 * 86400000,
      purpose: "own-post-descriptive-editorial-v1",
      dialect: "post-fields-repost-v2",
      accessEvidence: "Synthetic access",
      rightsEvidence: "Synthetic collection rights",
      pricingEvidence: "Synthetic price",
      protocolEvidence: "Synthetic protocol",
      allocationEvidence: "Synthetic allocation",
      fields: ["impressions", "likes", "replies"],
      windows: [0.25],
      windowsEvidence: "Synthetic selected window",
      unit: "single-post-request",
      unitMicros: 1,
      currency: "USD",
      retentionMs: 3 * 86400000,
      connectionSequence: 1,
      providerIdentity: "123",
      allocatedProviderLimitMicros: 10000,
    },
  );
  await f.t.run(async (ctx) => {
    for (const [i, scope] of (
      ["provider", "workspace", "account"] as const
    ).entries())
      await ctx.db.insert("aiBudgets", {
        key: [
          "metrics:x",
          `metrics:workspace:${f.workspaceId}`,
          `metrics:account:${f.accountId}`,
        ][i],
        scope,
        ...(i ? { workspaceId: f.workspaceId, approvedBy: f.userId } : {}),
        ...(i === 2 ? { accountId: f.accountId } : {}),
        policyVersion: "publication-test-v1",
        currency: "USD",
        purposes: ["own-metrics"],
        expiresAt: Date.now() + 5 * 86400000,
        limitMicros: 10000,
        heldMicros: 0,
        spentMicros: 0,
      });
  });
  const { fingerprint } = await import("./capabilities");
  const policyFingerprint = await f.t.run(async (ctx) =>
    fingerprint((await ctx.db.get(policyId))!),
  );
  await f.signed.mutation(api.performance.capabilities.consent, {
    ...f.scope,
    enabled: true,
    policyId,
    policyFingerprint,
  });
  const reviewDecisionIds: Id<"editorialReviewDecisions">[] = [];
  if (review) {
    const p = await f.signed.mutation(api.editorial.reviews.configure, {
      workspaceId: f.workspaceId,
      accountId: null,
      expectedRevision: 0,
      commandKey: "publication-review-policy",
      policy: { editorial: true, brand: false },
    });
    for (const versionId of f.versions) {
      const d = await f.signed.mutation(api.editorial.reviews.decide, {
        workspaceId: f.workspaceId,
        versionId,
        policyId: p.policyId,
        stage: "editorial",
        expectedRevision: 0,
        commandKey: crypto.randomUUID(),
      });
      reviewDecisionIds.push(d.decisionId!);
    }
    // Renew only the underlying readable source before approval; original stage horizon remains immutable.
    await f.t.run(async (ctx) => {
      for (const idea of await ctx.db.query("ideaVersions").take(10))
        await ctx.db.patch(idea._id, {
          researchProofUntil: Date.now() + 5 * 86400000,
        });
    });
  }
  const schedules: Id<"schedules">[] = [];
  for (const [i, versionId] of f.versions.entries()) {
    const approvalId = await f.signed.mutation(api.editorial.approve, {
      ...f.scope,
      versionId,
    });
    const at = Date.now() + (i + 1) * 60000;
    schedules.push(
      await f.signed.mutation(api.editorial.schedule, {
        ...f.scope,
        versionId,
        approvalId,
        at,
        timezone: "UTC",
        localTime: new Date(at).toISOString().slice(0, 16),
      }),
    );
  }
  const spec = {
    ...f.spec,
    outcome: "publication-count-v1" as const,
    publication: {
      metric: "likes" as const,
      windowHours: 0.25 as const,
      policyId,
      policyFingerprint,
      rightsEvidence: "Explicit synthetic local experiment use rights",
      explanation:
        "Compare prospective exact native scheduled publication counts",
      expiresAt: Date.now() + 4 * 86400000,
    },
  };
  const declareArgs = {
    ...f.declareArgs,
    action: {
      kind: "declarePublication" as const,
      spec,
      units: schedules.map((scheduleId, i) => ({
        scheduleId,
        arm: i % 2 ? ("B" as const) : ("A" as const),
        planItemId: null,
      })),
    },
  };
  const declare = () =>
    f.signed.mutation(api.performance.experiments.change, declareArgs);
  return {
    ...f,
    policyId,
    policyFingerprint,
    schedules,
    reviewUntil,
    reviewDecisionIds,
    spec,
    declareArgs,
    declare,
  };
}
test("TASK47.2 explicit publication declaration freezes exact schedules before any effect and creates no publishing or metrics IO", async () => {
  const f = await publicationFixture();
  const fetch = vi.fn(() => {
    throw Error("Experiment initiated IO");
  });
  vi.stubGlobal("fetch", fetch);
  const before = await f.t.run(async (ctx) => ({
    s: await ctx.db.query("schedules").collect(),
    a: await ctx.db.query("approvals").collect(),
    b: await ctx.db.query("aiBudgets").collect(),
  }));
  const e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const detail = await f.get(e.experimentId);
  expect(detail.spec?.outcome).toBe("publication-count-v1");
  expect(detail.publication?.counts).toMatchObject({
    assigned: 2,
    measured: 0,
    confirmed: 0,
    missing: 2,
  });
  expect(
    await f.t.run(async (ctx) => ({
      s: await ctx.db.query("schedules").collect(),
      a: await ctx.db.query("approvals").collect(),
      b: await ctx.db.query("aiBudgets").collect(),
    })),
  ).toEqual(before);
  expect(
    await f.t.run((ctx) => ctx.db.query("performanceSnapshots").collect()),
  ).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
  expect(fetch).not.toHaveBeenCalled();
});
async function publishPublication(
  f: Awaited<ReturnType<typeof publicationFixture>>,
  i: number,
  confirmedPositions?: number,
) {
  const scheduleId = f.schedules[i],
    s = (await f.t.run((ctx) => ctx.db.get(scheduleId)))!;
  vi.setSystemTime(Math.max(Date.now(), s.at));
  const job = { scheduleId, generation: s.generation };
  await f.t.mutation(internal.publishing.claim, job);
  const ver = (await f.t.run((ctx) => ctx.db.get(s.versionId)))!,
    posts = [];
  for (let p = 0; p < (confirmedPositions ?? ver.content.text.length); p++) {
    const c = (await f.t.mutation(internal.publishing.attempts.claim, job))!;
    expect(c).not.toBeNull();
    expect(
      await f.t.mutation(internal.publishing.attempts.beforeSend, {
        attemptId: c._id,
        claimSequence: c.claimSequence,
        credentialGeneration: 1,
        mediaIds: [],
      }),
    ).toBe(true);
    await f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      outcome: "confirmed",
      externalId: String(1000 + i * 10 + p),
      durationMs: 1,
    });
    posts.push(c._id);
  }
  await f.t.mutation(internal.performance.experiments.bindSnapshots, {
    scheduleId,
    cursor: null,
  });
  return posts;
}
async function measurePublication(
  f: Awaited<ReturnType<typeof publicationFixture>>,
  posts: Id<"xPostAttempts">[],
  values: (number | null)[],
  patch?: Partial<Doc<"performanceSnapshots">>,
) {
  const snapshots = [];
  for (const [i, postAttemptId] of posts.entries()) {
    const row = (await f.t.run((ctx) =>
      ctx.db
        .query("performanceSnapshots")
        .withIndex("by_postAttemptId_and_windowHours", (q) =>
          q.eq("postAttemptId", postAttemptId).eq("windowHours", 0.25),
        )
        .unique(),
    ))!;
    vi.setSystemTime(Math.max(Date.now(), row.dueAt));
    const t = await f.t.mutation(internal.performance.snapshots.begin, {
      snapshotId: row._id,
      generation: row.generation,
      credentialGeneration: 1,
    });
    expect(t).not.toBeNull();
    const { normalize } = await import("./normalize");
    const fields = normalize(
      {
        data: {
          id: row.externalId,
          author_id: "123",
          public_metrics: {
            like_count: values[i],
            impression_count: values[i],
            reply_count: values[i],
          },
        },
      },
      row.externalId,
      "123",
      ["impressions", "likes", "replies"],
      "post-fields-repost-v2",
    ).fields;
    await f.t.mutation(internal.performance.snapshots.finish, {
      attemptId: t!.attemptId,
      knownCharge: true,
      fields,
      providerCreatedAt: row.confirmedAt,
      reason: null,
    });
    if (patch) await f.t.run((ctx) => ctx.db.patch(row._id, patch));
    snapshots.push(row._id);
  }
  return snapshots;
}
test.each(["initial", "replay"])(
  "TASK47.2 genuine producer %s binding captures shorter proof and cannot renew",
  async (kind) => {
    const f = await publicationFixture(),
      e = await f.declare();
    await f.command(e.experimentId, "start", 1);
    const s = (await f.t.run((ctx) => ctx.db.get(f.schedules[0])))!;
    vi.setSystemTime(s.at);
    const job = { scheduleId: s._id, generation: s.generation };
    await f.t.mutation(internal.publishing.claim, job);
    const post = (await f.t.mutation(internal.publishing.attempts.claim, job))!;
    expect(
      await f.t.mutation(internal.publishing.attempts.beforeSend, {
        attemptId: post._id,
        claimSequence: post.claimSequence,
        credentialGeneration: 1,
        mediaIds: [],
      }),
    ).toBe(true);
    await f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: post._id,
      claimSequence: post.claimSequence,
      outcome: "confirmed",
      externalId: "1000",
      durationMs: 1,
    });
    expect(
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentBindings").collect(),
      ),
    ).toEqual([]);
    expect(
      (
        await f.t.run((ctx) =>
          ctx.db.system.query("_scheduled_functions").collect(),
        )
      ).some((j) => j.name.includes("bindSnapshots")),
    ).toBe(true);
    const callback = () =>
      f.t.mutation(internal.performance.experiments.bindSnapshots, {
        scheduleId: s._id,
        cursor: null,
      });
    if (kind === "replay") await callback();
    const credential = (
        await f.t.run((ctx) => ctx.db.query("xCredentials").collect())
      )[0],
      shortened = Date.now() + 300000;
    await f.t.run((ctx) =>
      ctx.db.patch(credential._id, { expiresAt: shortened }),
    );
    await callback();
    const binding = (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentBindings").collect(),
      )
    )[0];
    expect(binding.sourceUntil).toBe(shortened - 15000);
    const furtherShortened = Date.now() + 180000;
    await f.t.run((ctx) =>
      ctx.db.patch(credential._id, { expiresAt: furtherShortened }),
    );
    await callback();
    expect((await f.t.run((ctx) => ctx.db.get(binding._id)))!.sourceUntil).toBe(
      furtherShortened - 15000,
    );
    await f.t.run((ctx) =>
      ctx.db.patch(credential._id, { expiresAt: credential.expiresAt }),
    );
    await callback();
    expect((await f.t.run((ctx) => ctx.db.get(binding._id)))!.sourceUntil).toBe(
      furtherShortened - 15000,
    );
    await measurePublication(f, [post._id], [3]);
    expect(await f.get(e.experimentId)).toMatchObject({
      state: "withdrawn",
      spec: null,
      publication: null,
    });
  },
);
test.each([500, -500, 120000])(
  "TASK47.2 native collector provider offset %s uses the configured age tolerance",
  async (offset) => {
    const f = await publicationFixture(),
      e = await f.declare();
    await f.command(e.experimentId, "start", 1);
    const A = await publishPublication(f, 0),
      B = await publishPublication(f, 1);
    const snap = (await f.t.run((ctx) =>
      ctx.db
        .query("performanceSnapshots")
        .withIndex("by_postAttemptId_and_windowHours", (q) =>
          q.eq("postAttemptId", A[0]).eq("windowHours", 0.25),
        )
        .unique(),
    ))!;
    vi.setSystemTime(snap.dueAt);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                id: snap.externalId,
                author_id: "123",
                created_at: new Date(snap.confirmedAt - offset).toISOString(),
                public_metrics: {
                  like_count: 2,
                  impression_count: 2,
                  reply_count: 2,
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    await f.t.action(internal.performance.collect.read, {
      snapshotId: snap._id,
      generation: snap.generation,
    });
    const collected = (await f.t.run((ctx) => ctx.db.get(snap._id)))!;
    expect(collected).toMatchObject({
      state: "observed",
      providerCreatedAt: snap.confirmedAt - offset,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(collected.attemptId!)))!.state,
    ).toBe("settled");
    const { retainedSnapshotHorizon } = await import("./snapshots");
    expect(
      await f.t.run((ctx) => retainedSnapshotHorizon(ctx, collected)),
    ).toBeGreaterThan(Date.now());
    await measurePublication(f, B, [4]);
    const detail = await f.get(e.experimentId);
    expect(detail.spec).not.toBeNull();
    expect(detail.publication!.units[0]).toMatchObject(
      Math.abs(offset) <= 60000
        ? { outcome: "measured", value: 2 }
        : { outcome: "confirmed", reason: "outside-age-window", value: null },
    );
  },
);
test("TASK47.2 three-position thread is one measured publication and valid zero differs from unavailable", async () => {
  const f = await publicationFixture(2, 3),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1);
  await measurePublication(f, A, [0, 0, 0]);
  await measurePublication(f, B, [2, 3, 4]);
  const d = await f.get(e.experimentId);
  expect(d.publication!.counts).toMatchObject({
    assigned: 2,
    confirmed: 2,
    measured: 2,
  });
  expect(d.publication!.cohorts).toHaveLength(1);
  expect(d.publication!.cohorts[0]).toMatchObject({
    format: "thread",
    media: "none",
    A: { n: 1, sum: 0, mean: 0 },
    B: { n: 1, sum: 9, mean: 9 },
    difference: 9,
  });
});
test.each(["requestStartedAt", "sending", "unknown", "confirmed", "preparing"])(
  "TASK47.2 historical %s prevents prospective all-generation admission",
  async (fact) => {
    const f = await publicationFixture();
    await f.t.run((ctx) =>
      ctx.db.insert("xPostAttempts", {
        ...f.scope,
        scheduleId: f.schedules[0],
        versionId: f.versions[0],
        generation: 0,
        providerIdentity: "123",
        connectionSequence: 1,
        position: 0,
        attempt: 1,
        claimSequence: 0,
        leaseUntil: 0,
        deadline: Date.now() + 10000,
        stage: (fact === "requestStartedAt" ? "rejected" : fact) as "rejected",
        ...(fact === "requestStartedAt"
          ? { requestStartedAt: Date.now() - 1 }
          : {}),
        mediaIds: [],
        durationMs: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    await expect(f.declare()).rejects.toThrow("PUBLICATION_ALREADY_STARTED");
    expect(
      await f.t.run((ctx) => ctx.db.query("editorialExperiments").collect()),
    ).toHaveLength(0);
  },
);
test("TASK47.2 explicit end and stop exclude later native send without cancelling real schedules", async () => {
  const f = await publicationFixture(),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  await f.command(e.experimentId, "stop", 2);
  const before = await f.t.run((ctx) => ctx.db.get(f.schedules[0]));
  await publishPublication(f, 0);
  const d = await f.get(e.experimentId);
  expect(d.publication!.units[0]).toMatchObject({
    outcome: "excluded",
    reason: "send-outside-observation-window",
    value: null,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.schedules[0])))!.approvalId).toBe(
    before!.approvalId,
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("performanceSnapshots").collect()),
  ).toHaveLength(1);
});
test("TASK47.2 duplicate/changed arm, wrong account and changed approved schedule reject immutable admission", async () => {
  const f = await publicationFixture();
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      action: {
        ...f.declareArgs.action,
        units: [
          f.declareArgs.action.units[0],
          { ...f.declareArgs.action.units[0], arm: "B" },
        ],
      },
    }),
  ).rejects.toThrow("INPUT_INVALID");
  const e = await f.declare();
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      action: {
        ...f.declareArgs.action,
        units: f.declareArgs.action.units.map((u) => ({
          ...u,
          arm: u.arm === "A" ? ("B" as const) : ("A" as const),
        })),
      },
    }),
  ).rejects.toThrow("COMMAND_CONFLICT");
  const approval = (await f.t.run((ctx) => ctx.db.get(f.schedules[0])))!
    .approvalId;
  await f.signed.mutation(api.editorial.revoke, {
    workspaceId: f.workspaceId,
    approvalId: approval,
  });
  await expect(f.command(e.experimentId, "start", 1)).rejects.toThrow(
    "APPROVAL_REQUIRED",
  );
  expect((await f.get(e.experimentId)).spec).toBeNull();
});
test("TASK47.2 missing/null measurements and partially published thread stay unavailable rather than zero", async () => {
  const f = await publicationFixture(2, 3),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1, 1);
  await measurePublication(f, A, [null, 0, 0]);
  const d = await f.get(e.experimentId);
  expect(d.publication!.counts).toMatchObject({
    assigned: 2,
    confirmed: 1,
    measured: 0,
    partial: 1,
  });
  expect(d.publication!.cohorts).toEqual([]);
  expect(d.publication!.units.every((u) => u.value === null)).toBe(true);
  expect(d.publication!.units[1].reason).toBe("incomplete-thread");
});
test("TASK47.2 independent pause preserves retained measurements; local withdrawal masks everything and purges exact references", async () => {
  const f = await publicationFixture(),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1);
  const snapshots = [
    ...(await measurePublication(f, A, [0])),
    ...(await measurePublication(f, B, [2])),
  ];
  await f.signed.mutation(api.performance.capabilities.consent, {
    ...f.scope,
    enabled: false,
  });
  expect((await f.get(e.experimentId)).publication!.counts.measured).toBe(2);
  const before = await f.t.run(async (ctx) => ({
    s: await ctx.db.query("schedules").collect(),
    a: await ctx.db.query("approvals").collect(),
    t: await ctx.db.query("aiAttempts").collect(),
    b: await ctx.db.query("aiBudgets").collect(),
  }));
  await f.signed.mutation(api.performance.experiments.change, {
    ...f.scope,
    experimentId: e.experimentId,
    expectedRevision: 2,
    commandKey: "withdraw",
    action: { kind: "withdraw" },
  });
  const d = await f.get(e.experimentId);
  expect(d).toMatchObject({
    state: "withdrawn",
    spec: null,
    publication: null,
  });
  expect(
    d.units.every((u) => u.arm === null && u.outcome === "withdrawn"),
  ).toBe(true);
  expect(
    await f.t.run(async (ctx) => ({
      s: await ctx.db.query("schedules").collect(),
      a: await ctx.db.query("approvals").collect(),
      t: await ctx.db.query("aiAttempts").collect(),
      b: await ctx.db.query("aiBudgets").collect(),
    })),
  ).toEqual(before);
  expect(
    await f.t.run((ctx) =>
      ctx.db.query("editorialExperimentBindings").collect(),
    ),
  ).toEqual(
    expect.arrayContaining(
      snapshots.map(() =>
        expect.objectContaining({ snapshotId: null, sourceUnavailable: true }),
      ),
    ),
  );
});
test("TASK47.2 snapshot loss masks sibling measured outcome before physical cleanup and preserves financial/publishing parents", async () => {
  const f = await publicationFixture(),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1);
  const [snapshot] = await measurePublication(f, A, [0]);
  await measurePublication(f, B, [4]);
  const before = await f.t.run(async (ctx) => ({
    s: await ctx.db.query("schedules").collect(),
    a: await ctx.db.query("aiAttempts").collect(),
    b: await ctx.db.query("aiBudgets").collect(),
  }));
  await f.t.run((ctx) =>
    ctx.db.patch(snapshot, {
      state: "removed",
      fields: [],
      providerCreatedAt: null,
      observedAt: null,
    }),
  );
  const d = await f.get(e.experimentId);
  expect(d.spec).toBeNull();
  expect(d.publication).toBeNull();
  expect(d.arms.A.accept).toBe(0);
  await f.t.mutation(internal.performance.experiments.purgeSnapshot, {
    snapshotId: snapshot,
  });
  const rows = await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentAssignments").collect(),
  );
  expect(rows.some((r) => r.sourceUnavailable)).toBe(true);
  expect(
    await f.t.run(async (ctx) => ({
      s: await ctx.db.query("schedules").collect(),
      a: await ctx.db.query("aiAttempts").collect(),
      b: await ctx.db.query("aiBudgets").collect(),
    })),
  ).toEqual(before);
});
test("TASK47.2 native text beforeSend race cannot retroactively admit a preparing/sending publication", async () => {
  const f = await publicationFixture();
  const job = { scheduleId: f.schedules[0], generation: 1 };
  vi.setSystemTime(Date.now() + 60000);
  f.declareArgs.action.spec.startsAt = Date.now();
  const attempts = await Promise.allSettled([
    f.declare(),
    (async () => {
      await f.t.mutation(internal.publishing.claim, job);
      const c = (await f.t.mutation(internal.publishing.attempts.claim, job))!;
      if (c)
        await f.t.mutation(internal.publishing.attempts.beforeSend, {
          attemptId: c._id,
          claimSequence: c.claimSequence,
          credentialGeneration: 1,
          mediaIds: [],
        });
    })(),
  ]);
  expect(attempts[1].status).toBe("fulfilled");
  const history = await f.t.run((ctx) =>
    ctx.db.query("xPostAttempts").collect(),
  );
  expect(history[0]).toMatchObject({
    stage: "sending",
    requestStartedAt: Date.now(),
  });
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      commandKey: "late-new",
    }),
  ).rejects.toThrow();
  if (attempts[0].status === "fulfilled") {
    // The deterministic native harness may serialize declaration first; start still rejoins the actual changed state.
    await expect(
      f.command(attempts[0].value.experimentId, "start", 1),
    ).rejects.toThrow("PUBLICATION_ALREADY_STARTED");
  }
});
test("TASK47.2 every native media beforeRequest prevents retrospective admission, including media-only original generations", async () => {
  const f = await publicationFixture(2, 1, 2),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  vi.setSystemTime(Date.now() + 60000);
  const job = { scheduleId: f.schedules[0], generation: 1 };
  await f.t.mutation(internal.publishing.claim, job);
  for (let mediaPosition = 0; mediaPosition < 2; mediaPosition++) {
    const c = (await f.t.mutation(internal.publishing.media.claim, {
      ...job,
      mediaPosition,
    }))!;
    expect(
      await f.t.mutation(internal.publishing.media.beforeRequest, {
        checkpointId: c._id,
        claimSequence: c.claimSequence,
        credentialGeneration: 1,
        bytesRead: 70,
        durationMs: 1,
      }),
    ).toBe(true);
  }
  const d = await f.get(e.experimentId);
  expect(d.publication!.units[0]).toMatchObject({
    outcome: "unknown",
    reason: "media-only-no-confirmed-publication",
    value: null,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("xPostAttempts").collect()),
  ).toHaveLength(0);
  await f.t.run((ctx) =>
    ctx.db.patch(f.schedules[0], { state: "scheduled", generation: 2 }),
  );
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      commandKey: "new-declaration",
      action: {
        ...f.declareArgs.action,
        spec: { ...f.spec, startsAt: Date.now() },
      },
    }),
  ).rejects.toThrow("PUBLICATION_ALREADY_STARTED");
});
test.each(["deleted", "checksum", "transient"])(
  "TASK47.2 native media %s keeps semantic source loss distinct from transient readiness",
  async (kind) => {
    const f = await publicationFixture(2, 1, 1),
      e = await f.declare();
    await f.command(e.experimentId, "start", 1);
    const parents = await f.t.run(async (ctx) => ({
      schedules: await ctx.db.query("schedules").collect(),
      approvals: await ctx.db.query("approvals").collect(),
      attempts: await ctx.db.query("aiAttempts").collect(),
      budgets: await ctx.db.query("aiBudgets").collect(),
    }));
    await f.t.run(async (ctx) => {
      const version = (await ctx.db.get(f.versions[0]))!;
      await ctx.db.patch(
        version.content.media[0].assetId,
        kind === "checksum"
          ? { checksum: "b".repeat(64) }
          : { state: kind === "deleted" ? "deleted" : "validating" },
      );
    });
    if (kind === "transient") {
      await expect(f.get(e.experimentId)).rejects.toThrow("MEDIA_NOT_READY");
      await expect(
        f.t.mutation(internal.performance.experiments.sweep, {
          cursor: null,
        }),
      ).rejects.toThrow("MEDIA_NOT_READY");
      expect(
        (await f.t.run((ctx) => ctx.db.get(e.experimentId)))!.spec,
      ).not.toBeNull();
    } else {
      expect(await f.get(e.experimentId)).toMatchObject({
        state: "withdrawn",
        spec: null,
        publication: null,
      });
      await f.t.mutation(internal.performance.experiments.sweep, {
        cursor: null,
      });
      expect(
        (await f.t.run((ctx) => ctx.db.get(e.experimentId)))!.spec,
      ).toBeNull();
    }
    expect(
      await f.t.run(async (ctx) => ({
        schedules: await ctx.db.query("schedules").collect(),
        approvals: await ctx.db.query("approvals").collect(),
        attempts: await ctx.db.query("aiAttempts").collect(),
        budgets: await ctx.db.query("aiBudgets").collect(),
      })),
    ).toEqual(parents);
  },
);
test("TASK47.2 original expiry cannot renew, malformed receipts withdraw, and unknown native failures do not erase", async () => {
  const f = await publicationFixture(),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1);
  const [id] = await measurePublication(f, A, [0]);
  await measurePublication(f, B, [1]);
  const original = (await f.t.run((ctx) => ctx.db.get(e.experimentId)))!
    .sourceUntil!;
  await f.t.run((ctx) =>
    ctx.db.patch(f.policyId, { expiresAt: original + 2 * 86400000 }),
  );
  expect((await f.get(e.experimentId)).spec).toBeNull();
  const before = await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentAssignments").collect(),
  );
  vi.spyOn(
    await import("./snapshots"),
    "retainedSnapshotHorizon",
  ).mockRejectedValueOnce(new Error("synthetic native resource failure"));
  // Original fingerprint loss masks first; restore only fixture policy, without extending any captured assignment horizon.
  await f.t.run((ctx) =>
    ctx.db.patch(f.policyId, {
      expiresAt: Date.parse("2026-10-07T08:00:00Z") + 5 * 86400000,
    }),
  );
  await expect(
    f.t.mutation(internal.performance.experiments.sweep, { cursor: null }),
  ).rejects.toThrow("synthetic native resource failure");
  expect(
    await f.t.run((ctx) =>
      ctx.db.query("editorialExperimentAssignments").collect(),
    ),
  ).toEqual(before);
  vi.restoreAllMocks();
  const snap = (await f.t.run((ctx) => ctx.db.get(id)))!;
  await f.t.run((ctx) =>
    ctx.db.patch(snap.attemptId!, { receiptFingerprint: "forged" }),
  );
  expect((await f.get(e.experimentId)).spec).toBeNull();
});
test("TASK47.2 removed snapshot before delayed binding never recreates a derivative and root-gone references drain beyond one page", async () => {
  const f = await publicationFixture(),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0);
  const [snapshotId] = await measurePublication(f, A, [2]);
  await f.t.run(async (ctx) => {
    const first = (await ctx.db
      .query("editorialExperimentAssignments")
      .withIndex("by_experimentId", (q) => q.eq("experimentId", e.experimentId))
      .first())!;
    const b = (await ctx.db.query("editorialExperimentBindings").first())!;
    for (let i = 0; i < 27; i++) {
      const { _id, _creationTime, ...fields } = first;
      const assignmentId = await ctx.db.insert(
        "editorialExperimentAssignments",
        fields,
      );
      const { _id: bid, _creationTime: bt, ...pins } = b;
      await ctx.db.insert("editorialExperimentBindings", {
        ...pins,
        assignmentId,
      });
    }
    await ctx.db.delete(e.experimentId);
    await ctx.db.patch(snapshotId, {
      state: "removed",
      fields: [],
      observedAt: null,
      providerCreatedAt: null,
    });
  });
  for (let i = 0; i < 29; i++)
    await f.t.mutation(internal.performance.experiments.purgeSnapshot, {
      snapshotId,
    });
  const b = await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentBindings").collect(),
  );
  expect(b.every((b) => b.sourceUnavailable && b.snapshotId === null)).toBe(
    true,
  );
  await f.t.mutation(internal.performance.experiments.bindSnapshots, {
    scheduleId: f.schedules[0],
    cursor: null,
  });
  expect(
    await f.t.run((ctx) =>
      ctx.db.query("editorialExperimentBindings").collect(),
    ),
  ).toEqual(b);
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()))[0].state,
  ).toBe("settled");
});
test("TASK47.2 actual 32-unit mixed ancestry and exact retained measurement stay within original native ceilings", async () => {
  const f = await publicationFixture(32);
  await mixedAncestry(f);
  await f.t.run(async (ctx) => {
    for (const versionId of f.versions.slice(0, 2)) {
      const ver = (await ctx.db.get(versionId))!;
      await ctx.db.patch(versionId, {
        content: { ...ver.content, text: ["Explicit position 0"] },
      });
    }
  });
  const limits = {
    databaseQueries: 4096,
    bytesRead: 16 * 1024 * 1024,
    documentsRead: 32000,
  };
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
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1);
  await measurePublication(f, A, [0]);
  await measurePublication(f, B, [2]);
  const read = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(
      api.performance.experiments.get,
      { ...f.scope, experimentId: declared.value.experimentId },
      { transactionLimits: limits },
    ),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(read.value.publication!.counts).toMatchObject({
    assigned: 32,
    measured: 2,
    missing: 30,
  });
  writeFileSync(
    "/tmp/dispatch-47.2-native-budget.json",
    JSON.stringify(
      {
        fixture:
          "32 real schedules; two short actual approved publications share 30 recursive 12000-byte notes, 30 manual scheduled units; two native confirmed/settled retained measurements; synthetic rights and no provider IO",
        limits,
        declare: declared.metrics,
        start: start.metrics,
        read: read.metrics,
      },
      null,
      2,
    ),
  );
});
test("TASK47.2 deleted exact snapshot root masks all sibling comparisons before indexed root-gone purge", async () => {
  const f = await publicationFixture(),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1);
  const [id] = await measurePublication(f, A, [0]);
  await measurePublication(f, B, [1]);
  expect((await f.get(e.experimentId)).publication!.counts.measured).toBe(2);
  await f.t.run((ctx) => ctx.db.delete(id));
  expect((await f.get(e.experimentId)).spec).toBeNull();
  await f.t.mutation(internal.performance.experiments.purgeSnapshot, {
    snapshotId: id,
  });
  expect((await f.get(e.experimentId)).publication).toBeNull();
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(2);
});
test.each(["grant", "credential", "actor", "local-expiry", "source-expiry"])(
  "TASK47.2 actual %s loss immediately masks the whole experiment and sweeps derivatives",
  async (kind) => {
    const f = await publicationFixture(),
      e = await f.declare();
    await f.command(e.experimentId, "start", 1);
    const A = await publishPublication(f, 0),
      B = await publishPublication(f, 1);
    await measurePublication(f, A, [0]);
    await measurePublication(f, B, [3]);
    const parents = await f.t.run(async (ctx) => ({
      s: await ctx.db.query("schedules").collect(),
      t: await ctx.db.query("aiAttempts").collect(),
    }));
    await f.t.run(async (ctx) => {
      if (kind === "grant") {
        const b = (await ctx.db
          .query("aiBudgets")
          .withIndex("by_key", (q) =>
            q.eq("key", `metrics:account:${f.accountId}`),
          )
          .unique())!;
        await ctx.db.patch(b._id, { purposes: [] });
      }
      if (kind === "credential") {
        const c = (await ctx.db
          .query("xCredentials")
          .withIndex("by_accountId", (q) => q.eq("accountId", f.accountId))
          .unique())!;
        await ctx.db.patch(c._id, { envelope: undefined });
      }
      if (kind === "actor") {
        const m = (await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique())!;
        await ctx.db.patch(m._id, { role: "Editor" });
      }
      if (kind === "local-expiry") {
        const r = (await ctx.db.get(e.experimentId))!;
        await ctx.db.patch(r._id, { sourceUntil: Date.now() });
      }
      if (kind === "source-expiry")
        await ctx.db.patch(f.versions[0], { sourceUnavailable: true });
    });
    const d = await f.get(e.experimentId);
    expect(d).toMatchObject({
      state: "withdrawn",
      spec: null,
      publication: null,
    });
    expect(d.units.every((u) => u.arm === null)).toBe(true);
    await f.t.mutation(internal.performance.experiments.sweep, {
      cursor: null,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(e.experimentId)))!.spec,
    ).toBeNull();
    expect(
      await f.t.run(async (ctx) => ({
        s: await ctx.db.query("schedules").collect(),
        t: await ctx.db.query("aiAttempts").collect(),
      })),
    ).toEqual(parents);
  },
);
test("TASK47.2 prospective manifest is exact across wrong account/version and finite history cap+1", async () => {
  const f = await publicationFixture();
  const s = (await f.t.run((ctx) => ctx.db.get(f.schedules[0])))!;
  await f.t.run((ctx) => ctx.db.patch(s._id, { versionId: f.versions[1] }));
  await expect(f.declare()).rejects.toThrow("APPROVAL_REQUIRED");
  await f.t.run((ctx) => ctx.db.patch(s._id, { versionId: s.versionId }));
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 101; i++)
      await ctx.db.insert("xPostAttempts", {
        ...f.scope,
        scheduleId: s._id,
        versionId: s.versionId,
        generation: 0,
        providerIdentity: "123",
        connectionSequence: 1,
        position: 0,
        attempt: i + 1,
        claimSequence: 0,
        leaseUntil: 0,
        deadline: Date.now(),
        stage: "rejected",
        mediaIds: [],
        durationMs: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
  });
  await expect(f.declare()).rejects.toThrow("EXPERIMENT_RESOURCE_CEILING");
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialExperiments").collect()),
  ).toEqual([]);
});
test("TASK47.2 original captured horizon survives actual policy renewal and source shortening but never restores", async () => {
  const f = await publicationFixture();
  f.spec.publication.expiresAt = Date.now() + 600000;
  const e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const original = (await f.t.run((ctx) => ctx.db.get(e.experimentId)))!
    .sourceUntil!;
  const p = (await f.t.run((ctx) => ctx.db.get(f.policyId)))!;
  const { _id, _creationTime, ...fields } = p;
  await f.t.mutation(internal.performance.capabilities.configure, {
    ...fields,
    version: "publication-test-v2",
    expiresAt: p.expiresAt + 86400000,
  });
  await f.t.run(async (ctx) => {
    for (const b of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(b._id, {
        policyVersion: "publication-test-v2",
        expiresAt: b.expiresAt + 86400000,
      });
  });
  expect((await f.get(e.experimentId)).sourceUntil).toBe(original);
  vi.setSystemTime(original);
  expect((await f.get(e.experimentId)).spec).toBeNull();
  await f.t.mutation(internal.performance.experiments.sweep, { cursor: null });
  vi.setSystemTime(Date.parse("2026-10-07T08:00:00Z"));
  expect((await f.get(e.experimentId)).spec).toBeNull();
});
test.each([
  "missing-provider-time",
  "wrong-provider-age",
  "wrong-definition",
  "unsafe-thread-sum",
])(
  "TASK47.2 %s remains unavailable, never a measured zero or pooled comparison",
  async (reason) => {
    const f = await publicationFixture(
        2,
        reason === "unsafe-thread-sum" ? 2 : 1,
      ),
      e = await f.declare();
    await f.command(e.experimentId, "start", 1);
    const A = await publishPublication(f, 0),
      B = await publishPublication(f, 1);
    await measurePublication(
      f,
      A,
      reason === "unsafe-thread-sum" ? [Number.MAX_SAFE_INTEGER, 1] : [0],
    );
    await measurePublication(
      f,
      B,
      reason === "unsafe-thread-sum" ? [1, 1] : [2],
    );
    if (reason === "wrong-provider-age") vi.setSystemTime(Date.now() + 120000);
    if (reason !== "unsafe-thread-sum")
      await f.t.run(async (ctx) => {
        const snap = (await ctx.db
          .query("performanceSnapshots")
          .withIndex("by_postAttemptId_and_windowHours", (q) =>
            q.eq("postAttemptId", A[0]).eq("windowHours", 0.25),
          )
          .unique())!;
        const providerCreatedAt =
          reason === "missing-provider-time" ? null : snap.providerCreatedAt;
        const fields =
          reason === "wrong-definition"
            ? snap.fields.map((f) =>
                f.name === "likes"
                  ? { ...f, definition: "unsupported changed definition" }
                  : f,
              )
            : snap.fields;
        await ctx.db.patch(snap._id, {
          providerCreatedAt,
          fields,
          ...(reason === "wrong-provider-age"
            ? { observedAt: snap.observedAt! + 120000 }
            : {}),
        });
        const { sha256 } = await import("../lib/crypto");
        await ctx.db.patch(snap.attemptId!, {
          receiptFingerprint: await sha256(
            JSON.stringify({
              knownCharge: true,
              fields,
              providerCreatedAt,
              reason: snap.reason,
            }),
          ),
        });
      });
    const d = await f.get(e.experimentId);
    if (reason === "missing-provider-time") {
      expect(d.spec).toBeNull();
      expect(d.publication).toBeNull();
    } else {
      expect(d.publication!.units[0].value).toBeNull();
      expect(d.publication!.units[0].outcome).toBe("confirmed");
      expect(d.publication!.cohorts.every((c) => c.difference === null)).toBe(
        true,
      );
      expect(d.publication!.counts.measured).toBe(1);
    }
  },
);
test("TASK47.2 native snapshot removal callback clears matching purpose descendants and cannot rebind", async () => {
  const f = await publicationFixture(),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0);
  const [snapshotId] = await measurePublication(f, A, [0]);
  await f.signed.mutation(api.performance.capabilities.remove, f.scope);
  const control = (await f.t.run((ctx) =>
    ctx.db
      .query("performanceControls")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", f.workspaceId).eq("accountId", f.accountId),
      )
      .unique(),
  ))!;
  await f.t.mutation(internal.performance.snapshots.clear, {
    ...f.scope,
    generation: control.generation,
    remove: true,
  });
  expect((await f.t.run((ctx) => ctx.db.get(snapshotId)))!).toMatchObject({
    state: "removed",
    fields: [],
    observedAt: null,
  });
  expect((await f.get(e.experimentId)).publication).toBeNull();
  await f.t.mutation(internal.performance.experiments.purgeSnapshot, {
    snapshotId,
  });
  await f.t.mutation(internal.performance.experiments.bindSnapshots, {
    scheduleId: f.schedules[0],
    cursor: null,
  });
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentBindings").collect(),
      )
    ).every((b) => b.sourceUnavailable && b.snapshotId === null),
  ).toBe(true);
  expect(
    (await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()))[0].state,
  ).toBe("settled");
});
test("TASK47.2 actual schedule-account drift and missing explicit local rights fail without writes", async () => {
  const f = await publicationFixture();
  await expect(
    f.signed.mutation(api.performance.experiments.change, {
      ...f.declareArgs,
      action: {
        ...f.declareArgs.action,
        spec: {
          ...f.spec,
          publication: { ...f.spec.publication, rightsEvidence: " " },
        },
      },
    }),
  ).rejects.toThrow("SOURCE_UNAVAILABLE");
  const other = await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(f.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return ctx.db.insert("socialAccounts", {
      ...fields,
      providerIdentity: "456",
    });
  });
  await f.t.run((ctx) => ctx.db.patch(f.schedules[0], { accountId: other }));
  await expect(f.declare()).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialExperiments").collect()),
  ).toEqual([]);
});

test("TASK50 publication original and cached minimum includes immutable frozen review horizon after source renewal", async () => {
  const f = await publicationFixture(2, 1, 0, true),
    e = await f.declare();
  expect(
    (await f.t.run((ctx) => ctx.db.get(e.experimentId)))!.sourceUntil,
  ).toBe(f.reviewUntil);
  const assignments = await f.t.run((ctx) =>
    ctx.db.query("editorialExperimentAssignments").collect(),
  );
  expect(assignments.every((r) => r.sourceUntil === f.reviewUntil)).toBe(true);
  await f.command(e.experimentId, "start", 1);
  await f.signed.mutation(api.editorial.reviews.configure, {
    workspaceId: f.workspaceId,
    accountId: null,
    expectedRevision: 1,
    commandKey: "new-policy-alone",
    policy: { editorial: true, brand: true },
  });
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1);
  await measurePublication(f, A, [2]);
  await measurePublication(f, B, [3]);
  const detail = await f.get(e.experimentId);
  expect(detail.publication?.arms.A.measured).toBe(1);
  expect(detail.sourceUntil).toBe(f.reviewUntil);
  expect(
    detail.publication?.units.every((u) => u.until === f.reviewUntil),
  ).toBe(true);
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db.query("editorialExperimentBindings").collect(),
      )
    ).every((b) => b.sourceUntil === f.reviewUntil),
  ).toBe(true);
  vi.setSystemTime(f.reviewUntil! + 1);
  expect(await f.get(e.experimentId)).toMatchObject({
    state: "withdrawn",
    spec: null,
    publication: null,
  });
});
test("TASK50 current frozen review loss masks publication cache and drains derivative without erasing confirmed effect or finance", async () => {
  const f = await publicationFixture(2, 1, 0, true),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const A = await publishPublication(f, 0),
    B = await publishPublication(f, 1);
  await measurePublication(f, A, [2]);
  await measurePublication(f, B, [3]);
  const before = await f.t.run(async (ctx) => ({
    posts: await ctx.db.query("xPostAttempts").collect(),
    finance: await ctx.db.query("aiAttempts").collect(),
    schedules: await ctx.db.query("schedules").collect(),
  }));
  const state = await f.signed.query(api.editorial.reviews.get, {
    workspaceId: f.workspaceId,
    versionId: f.versions[0],
  });
  await f.signed.mutation(api.editorial.reviews.withdraw, {
    workspaceId: f.workspaceId,
    decisionId: f.reviewDecisionIds[0],
    expectedRevision: state.revision,
    commandKey: "withdraw-publication-review",
  });
  expect(await f.get(e.experimentId)).toMatchObject({
    state: "withdrawn",
    spec: null,
    publication: null,
  });
  await f.t.mutation(internal.performance.experiments.sweep, { cursor: null });
  await f.t.mutation(internal.performance.experiments.bindSnapshots, {
    scheduleId: f.schedules[0],
    cursor: null,
  });
  const assignmentId = (
    await f.t.run((ctx) =>
      ctx.db.query("editorialExperimentAssignments").collect(),
    )
  ).find((r) => r.versionId === f.versions[0])!._id;
  const bindings = (
    await f.t.run((ctx) =>
      ctx.db.query("editorialExperimentBindings").collect(),
    )
  ).filter((b) => b.assignmentId === assignmentId);
  expect(bindings).toHaveLength(1);
  expect(
    bindings.every((b) => b.sourceUnavailable && b.snapshotId === null),
  ).toBe(true);
  expect(
    await f.t.run(async (ctx) => ({
      posts: await ctx.db.query("xPostAttempts").collect(),
      finance: await ctx.db.query("aiAttempts").collect(),
      schedules: await ctx.db.query("schedules").collect(),
    })),
  ).toEqual(before);
});
test("TASK50 current shorter review proof clamps existing publication assignment and cannot renew after sweep", async () => {
  const f = await publicationFixture(2, 1, 0, true),
    e = await f.declare();
  await f.command(e.experimentId, "start", 1);
  const shortened = Date.now() + 300000;
  await f.t.run(async (ctx) => {
    for (const root of await ctx.db.query("ideaVersions").take(10))
      await ctx.db.patch(root._id, { researchProofUntil: shortened });
  });
  expect((await f.get(e.experimentId)).sourceUntil).toBe(shortened);
  await f.t.mutation(internal.performance.experiments.sweep, { cursor: null });
  await f.t.run(async (ctx) => {
    for (const root of await ctx.db.query("ideaVersions").take(10))
      await ctx.db.patch(root._id, {
        researchProofUntil: Date.now() + 5 * 86400000,
      });
  });
  vi.setSystemTime(shortened + 1);
  expect((await f.get(e.experimentId)).spec).toBeNull();
});
