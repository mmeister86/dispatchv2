import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { mediaFixture } from "../../tests/media-fixture";
const shared = makeFunctionReference<"query">("operations/exportShared:shared");
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function fixture() {
  const f = await mediaFixture();
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "archive",
    family: "drafts",
    cursor: null,
    creationUpperBound: null,
  };
  const ids = await f.t.run(async (ctx) => {
    const draftId = await ctx.db.insert("drafts", {
      workspaceId: f.workspaceId,
      revision: 1,
      currentVersionId: null,
      authorId: f.userId,
      source: "Handgeschrieben",
      updatedAt: Date.now(),
    });
    const versionId = await ctx.db.insert("draftVersions", {
      workspaceId: f.workspaceId,
      draftId,
      number: 1,
      authorId: f.userId,
      createdAt: Date.now(),
      reason: "Original",
      content: {
        title: "Geteilter Inhalt",
        text: ["Text 🧭"],
        media: [],
        accountId: null,
        pillar: "Wissen",
        strategy: "Informieren",
      },
    });
    await ctx.db.patch(draftId, { currentVersionId: versionId });
    return { draftId, versionId };
  });
  return { ...f, args, ...ids };
}
test("registered shared archive reads actual current draft with bounded correlated wire and explicit safe content", async () => {
  const f = await fixture();
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const { value: r, metrics } = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(shared, f.args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(r.data.selection.family).toBe("drafts");
  expect(r.data.selection.rows[0]).toMatchObject({
    id: f.draftId,
    currentVersionId: f.versionId,
    content: { title: "Geteilter Inhalt", text: ["Text 🧭"] },
  });
  expect(r.sessionId).toBe(f.args.expectedSessionId);
  expect(r.proofValidUntil).toBeLessThanOrEqual(r.observedAt + 30000);
  expect(JSON.stringify(r.data)).not.toMatch(
    /authId|sessionId|requestKey|checksum|objectKey|fingerprint/,
  );
  expect(metrics.documentsWritten.used).toBe(0);
  expect(metrics.functionsScheduled.used).toBe(0);
  expect(physical).not.toHaveBeenCalled();
});
test("shared archive rejects roles, obsolete session and foreign workspace before touching candidate rows", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, { researchProofUntil: NaN }),
  );
  await expect(
    f.signed.query(shared, { ...f.args, expectedSessionId: "obsolete" }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  for (const role of ["Viewer", "Editor"] as const) {
    await f.t.run(async (ctx) =>
      ctx.db.patch((await ctx.db.query("memberships").first())!._id, { role }),
    );
    await expect(f.signed.query(shared, f.args)).rejects.toThrow(
      "ROLE_ACCESS_DENIED",
    );
  }
});
test("shared archive paginates retained history beyond UI windows and excludes later creations", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await fixture();
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 28; i++)
      await ctx.db.insert("editorialComments", {
        workspaceId: f.workspaceId,
        draftId: f.draftId,
        versionId: f.versionId,
        authorId: f.userId,
        text: `Kommentar ${i}`,
        resolved: i % 2 === 0,
        createdAt: Date.now(),
      });
  });
  vi.advanceTimersByTime(1000);
  let r = await f.signed.query(shared, {
    ...f.args,
    family: "editorialComments",
  });
  const rows = [...r.data.selection.rows];
  const bound = r.creationUpperBound;
  vi.advanceTimersByTime(100);
  await f.t.run((ctx) =>
    ctx.db.insert("editorialComments", {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      versionId: f.versionId,
      authorId: f.userId,
      text: "Später",
      resolved: false,
      createdAt: Date.now(),
    }),
  );
  while (!r.isDone) {
    r = await f.signed.query(shared, {
      ...f.args,
      family: "editorialComments",
      cursor: r.cursor,
      creationUpperBound: bound,
    });
    rows.push(...r.data.selection.rows);
  }
  expect(rows).toHaveLength(28);
  expect(rows.map((r) => r.text)).not.toContain("Später");
  expect(rows.some((r) => r.resolved)).toBe(true);
});
test("shared archive omits lost roots and fails closed on foreign bindings, malformed numbers and oversized whole wire", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, { researchProofUntil: NaN }),
  );
  await expect(f.signed.query(shared, f.args)).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, {
      researchProofUntil: undefined,
      content: {
        title: "Large",
        text: ["x".repeat(66000)],
        media: [],
        accountId: null,
        pillar: "",
        strategy: "",
      },
    }),
  );
  await expect(f.signed.query(shared, f.args)).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
  await f.t.run((ctx) => ctx.db.delete(f.versionId));
  expect((await f.signed.query(shared, f.args)).data.selection.rows).toEqual(
    [],
  );
});
test("shared archive rejects invalid bounds and propagates native resource failures", async () => {
  const f = await fixture();
  for (const patch of [
    { cursor: "next" },
    { creationUpperBound: Date.now() },
    { cursor: "next", creationUpperBound: -0 },
    { cursor: "next", creationUpperBound: Infinity },
  ])
    await expect(
      f.signed.query(shared, { ...f.args, ...patch }),
    ).rejects.toThrow("EXPORT_REQUEST_INVALID");
  await expect(
    f.signed.run((ctx) =>
      ctx.runQuery(shared, f.args, {
        transactionLimits: { databaseQueries: 1 },
      }),
    ),
  ).rejects.toThrow();
});

test("archive retains archived ideas, every idea revision and feedback plus original planning and withdrawn editorial history", async () => {
  const f = await fixture();
  const ids = await f.t.run(async (ctx) => {
    const accountId = await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "safe",
      name: "Test",
      handle: "test",
      connection: "connected",
      capability: {
        publish: true,
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
      },
    });
    const version = (await ctx.db.get(f.versionId))!;
    await ctx.db.patch(f.versionId, {
      content: { ...version.content, accountId },
    });
    const ideaId = await ctx.db.insert("ideas", {
      workspaceId: f.workspaceId,
      actorId: f.userId,
      operationKey: "PRIVATE_COMMAND",
      fingerprint: "PRIVATE_FINGERPRINT",
      revision: 2,
      currentVersionId: null,
      status: "archived",
      updatedAt: Date.now(),
    });
    let versionId;
    for (let number = 1; number <= 2; number++)
      versionId = await ctx.db.insert("ideaVersions", {
        workspaceId: f.workspaceId,
        ideaId,
        number,
        actorId: f.userId,
        createdAt: Date.now(),
        title: `Idee ${number}`,
        perspective: "Perspektive",
        note: "Originalnotiz",
        priority: "normal",
        source: { kind: "note" },
        originals: ["Ursprung"],
        rationale: "Grund",
        questions: ["Frage?"],
      });
    await ctx.db.patch(ideaId, { currentVersionId: versionId! });
    await ctx.db.insert("ideaFeedback", {
      workspaceId: f.workspaceId,
      ideaId,
      versionId: versionId!,
      actorId: f.userId,
      kind: "reject",
      text: "Historischer Kommentar",
      createdAt: Date.now(),
    });
    await ctx.db.insert("contentFeedback", {
      workspaceId: f.workspaceId,
      accountId,
      versionId: f.versionId,
      resultingVersionId: null,
      actorId: f.userId,
      kind: "reject",
      createdAt: Date.now(),
      editExtent: null,
      definition: "changed-middle-codepoints-v1",
      sourceUntil: null,
      sourceUnavailable: false,
    });
    const preference = (await ctx.db.query("preferences").first())!;
    await ctx.db.insert("contentPlans", {
      workspaceId: f.workspaceId,
      actorId: f.userId,
      accountId,
      preferenceId: preference._id,
      commandKey: "PRIVATE_COMMAND",
      fingerprint: "PRIVATE_FINGERPRINT",
      createdAt: Date.now(),
      desiredCount: 1,
      start: "2026-10-01",
      end: "2026-10-02",
      timezone: "UTC",
      clock: "12:00",
      mode: "mixed",
      topics: "Geteilte Themen",
      preferences: {
        timezone: "UTC",
        language: "Deutsch",
        audience: "Publikum",
        tone: "Direkt",
        topics: "Themen",
      },
      selectedCount: 0,
      candidateCount: 999,
      coveragePartial: true,
      shortages: [{ code: "PRIVATE_COUNT", count: 999 }],
    });
    const policyId = await ctx.db.insert("editorialReviewPolicies", {
      workspaceId: f.workspaceId,
      accountId,
      editorial: true,
      brand: false,
      actorId: f.userId,
      revision: 1,
      createdAt: Date.now(),
    });
    await ctx.db.insert("editorialReviewControls", {
      workspaceId: f.workspaceId,
      accountId,
      policyId,
      revision: 1,
    });
    const decisionId = await ctx.db.insert("editorialReviewDecisions", {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      versionId: f.versionId,
      accountId,
      policyId,
      stage: "editorial",
      reviewerId: f.userId,
      createdAt: Date.now(),
      sourceUntil: null,
      withdrawnAt: Date.now(),
      withdrawnBy: f.userId,
      active: false,
      sourceUnavailable: false,
    });
    await ctx.db.insert("editorialReviewCommands", {
      workspaceId: f.workspaceId,
      accountId,
      actorId: f.userId,
      commandKey: "PRIVATE_COMMAND",
      kind: "editorial",
      draftId: f.draftId,
      versionId: f.versionId,
      fingerprint: "PRIVATE_FINGERPRINT",
      result: { revision: 1, policyId, decisionId },
      sourceUntil: null,
      sourceUnavailable: false,
    });
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      versionId: f.versionId,
      accountId,
      actorId: f.userId,
      createdAt: Date.now(),
      revokedAt: Date.now(),
      revokedBy: f.userId,
      reviewPin: { policyId, decisionIds: [decisionId], sourceUntil: null },
    });
    const scheduleId = await ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      versionId: f.versionId,
      accountId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at: Date.now() - 100,
      timezone: "UTC",
      localTime: "2026-10-01T12:00",
      state: "cancelled",
      publishedCount: 0,
      errorCode: "PRIVATE_PROVIDER_ERROR",
      jobId: null,
    });
    await ctx.db.insert("editorialEvents", {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      scheduleId,
      actorId: f.userId,
      code: "cancelled",
      createdAt: Date.now(),
    });
    return { ideaId, accountId, decisionId };
  });
  for (const family of [
    "ideas",
    "ideaVersions",
    "ideaFeedback",
    "contentFeedback",
    "contentPlans",
    "approvals",
    "schedules",
    "editorialEvents",
    "editorialReviewPolicies",
    "editorialReviewControls",
    "editorialReviewDecisions",
    "editorialReviewCommands",
  ]) {
    const r = await f.signed.query(shared, { ...f.args, family });
    expect(r.data.selection.rows, family).toHaveLength(1);
    expect(JSON.stringify(r.data)).not.toMatch(
      /PRIVATE_|fingerprint|commandKey|candidateCount|shortages|historyContext|preferenceId|providerIdentity|jobId/,
    );
    if (family === "ideas")
      expect(r.data.selection.rows[0].status).toBe("archived");
    if (family === "ideaVersions") {
      expect(r.data.selection.rows[0].number).toBe(1);
      const next = await f.signed.query(shared, {
        ...f.args,
        family,
        cursor: r.cursor,
        creationUpperBound: r.creationUpperBound,
      });
      expect(next.data.selection.rows[0].number).toBe(2);
    }
    if (family === "editorialReviewDecisions")
      expect(r.data.selection.rows[0].active).toBe(false);
  }
  await f.t.run(async (ctx) => {
    await ctx.db.delete((await ctx.db.query("memberships").first())!._id);
  });
  await expect(
    f.signed.query(shared, { ...f.args, family: "editorialReviewDecisions" }),
  ).rejects.toThrow();
});

test("foreign roots fail the whole page while missing original actors omit payload without skeletons", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await fixture();
  vi.advanceTimersByTime(1000);
  const foreign = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...workspace } = (await ctx.db.get(
      f.workspaceId,
    ))!;
    const workspaceId = await ctx.db.insert("workspaces", {
      ...workspace,
      name: "Other",
    });
    await ctx.db.patch(f.versionId, { workspaceId });
    return workspaceId;
  });
  await expect(f.signed.query(shared, f.args)).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, { workspaceId: f.workspaceId }),
  );
  const { policyId, membershipId } = await f.t.run(async (ctx) => {
    const actorId = await ctx.db.insert("users", {
      authId: "other-actor",
      activeWorkspaceId: f.workspaceId,
      defaultWorkspaceId: f.workspaceId,
    });
    const membershipId = await ctx.db.insert("memberships", {
      userId: actorId,
      workspaceId: f.workspaceId,
      role: "Admin",
    });
    const policyId = await ctx.db.insert("editorialReviewPolicies", {
      workspaceId: f.workspaceId,
      accountId: null,
      editorial: false,
      brand: false,
      actorId,
      revision: 1,
      createdAt: Date.now(),
    });
    return { policyId, membershipId };
  });
  vi.advanceTimersByTime(1000);
  expect(
    (
      await f.signed.query(shared, {
        ...f.args,
        family: "editorialReviewPolicies",
      })
    ).data.selection.rows,
  ).toHaveLength(1);
  await f.t.run((ctx) => ctx.db.delete(membershipId));
  const result = await f.signed.query(shared, {
    ...f.args,
    family: "editorialReviewPolicies",
  });
  expect(result.data.selection.rows).toEqual([]);
  expect(JSON.stringify(result)).not.toContain(policyId);
  expect(JSON.stringify(result)).not.toMatch(/omission|unavailableCount/);
  await expect(
    f.signed.query(shared, { ...f.args, workspaceId: foreign }),
  ).rejects.toThrow();
});

test("explicitly disabled planning controls and commands retain their legitimate versionless history", async () => {
  const f = await fixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "series",
      name: "Series",
      handle: "series",
      connection: "connected",
      capability: {
        publish: true,
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
      },
    }),
  );
  const change = makeFunctionReference<"mutation">("planning/strategy:change");
  await f.signed.mutation(change, {
    workspaceId: f.workspaceId,
    accountId,
    expectedRevision: 0,
    commandKey: "disable",
    action: { kind: "disable" },
  });
  for (const family of ["planningSeries", "planningSeriesCommands"]) {
    const r = await f.signed.query(shared, { ...f.args, family });
    expect(r.data.selection.rows).toHaveLength(1);
    expect(r.data.selection.rows[0].versionId).toBeNull();
  }
});

test("actual configured series, versions, commands, semantic bindings and retained items export original shared content without private history", async () => {
  const { fixture: seriesFixture } =
    await import("../../tests/planning-series-fixture");
  const f = await seriesFixture(2),
    series = await f.create(),
    planId = await f.fire(series.seriesId);
  vi.advanceTimersByTime(1000);
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!,
    identity = (await f.signed.run((ctx) => ctx.auth.getUserIdentity()))!;
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    expectedSessionId: identity.sessionId,
    requestKey: "series-archive",
    cursor: null,
    creationUpperBound: null,
  };
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  for (const family of [
    "planningSeries",
    "planningSeriesVersions",
    "planningSeriesCommands",
    "semanticPlanBindings",
    "contentPlans",
    "contentPlanItems",
  ]) {
    const r = await f.signed.query(shared, { ...args, family });
    expect(r.data.selection.rows, family).toHaveLength(1);
    expect(r.proofValidUntil).toBeLessThanOrEqual(r.observedAt + 30000);
    expect(JSON.stringify(r.data)).not.toMatch(
      /Synthetic retained original history|ciphertext|fingerprint|Fingerprint|commandKey|vectorCount|candidateCount|historyFrom|historyTo|preferenceId/,
    );
    if (family === "planningSeriesVersions")
      expect(r.data.selection.rows[0].config.theme).toBe("Explicit theme");
    if (family === "contentPlans")
      expect(r.data.selection.rows[0].id).toBe(planId);
    if (family === "contentPlanItems")
      expect(r.data.selection.rows[0].reason.length).toBeGreaterThan(0);
  }
  expect(physical).not.toHaveBeenCalled();
  await f.t.run((ctx) => ctx.db.delete(f.vectorIds[0]));
  for (const family of [
    "planningSeriesVersions",
    "semanticPlanBindings",
    "contentPlans",
    "contentPlanItems",
  ]) {
    const r = await f.signed.query(shared, { ...args, family });
    expect(r.data.selection.rows, family).toEqual([]);
  }
});

test("original idea source horizon expires between pages and cannot be renewed by continuing the same selection", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const ideaId = await ctx.db.insert("ideas", {
      workspaceId: f.workspaceId,
      actorId: f.userId,
      operationKey: "original",
      fingerprint: "private",
      revision: 2,
      currentVersionId: null,
      status: "new",
      updatedAt: Date.now(),
    });
    let id;
    for (let number = 1; number <= 2; number++)
      id = await ctx.db.insert("ideaVersions", {
        workspaceId: f.workspaceId,
        ideaId,
        number,
        actorId: f.userId,
        createdAt: Date.now(),
        title: "Original",
        perspective: "",
        note: "Original",
        priority: "normal",
        source: { kind: "note" },
        originals: [],
        rationale: "",
        questions: [],
        researchProofUntil: Date.now() + 5000,
      });
    await ctx.db.patch(ideaId, { currentVersionId: id! });
  });
  vi.advanceTimersByTime(1000);
  const first = await f.signed.query(shared, {
    ...f.args,
    family: "ideaVersions",
  });
  expect(first.data.selection.rows).toHaveLength(1);
  expect(first.proofValidUntil).toBe(1800000005000);
  vi.advanceTimersByTime(5000);
  const next = await f.signed.query(shared, {
    ...f.args,
    family: "ideaVersions",
    cursor: first.cursor,
    creationUpperBound: first.creationUpperBound,
  });
  expect(next.data.selection.rows).toEqual([]);
  expect(next.creationUpperBound).toBe(first.creationUpperBound);
});

test("whole shared envelope honors exactly 64KiB and foreign tenant growth cannot alter its page", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await fixture();
  vi.advanceTimersByTime(1000);
  const before = await f.signed.query(shared, f.args);
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...workspace } = (await ctx.db.get(
      f.workspaceId,
    ))!;
    const workspaceId = await ctx.db.insert("workspaces", {
      ...workspace,
      name: "Foreign",
    });
    for (let i = 0; i < 30; i++)
      await ctx.db.insert("drafts", {
        workspaceId,
        revision: 1,
        currentVersionId: null,
        authorId: f.userId,
        source: "PRIVATE_FOREIGN",
        updatedAt: Date.now(),
      });
  });
  expect(await f.signed.query(shared, f.args)).toEqual(before);
  const remaining =
    64 * 1024 - new TextEncoder().encode(JSON.stringify(before)).length;
  const ver = (await f.t.run((ctx) => ctx.db.get(f.versionId)))!;
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, {
      content: {
        ...ver.content,
        title: ver.content.title + "a".repeat(remaining),
      },
    }),
  );
  const exact = await f.signed.query(shared, f.args);
  expect(new TextEncoder().encode(JSON.stringify(exact)).length).toBe(
    64 * 1024,
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, {
      content: {
        ...ver.content,
        title: ver.content.title + "a".repeat(remaining + 1),
      },
    }),
  );
  await expect(f.signed.query(shared, f.args)).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
  for (const createdAt of [NaN, Infinity, -0]) {
    await f.t.run((ctx) =>
      ctx.db.patch(f.versionId, { content: ver.content, createdAt }),
    );
    await expect(f.signed.query(shared, f.args)).rejects.toThrow(
      "EXPORT_DATA_UNAVAILABLE",
    );
  }
});
