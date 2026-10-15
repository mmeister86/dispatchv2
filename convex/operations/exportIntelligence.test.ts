import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { makeFunctionReference, type FunctionReturnType } from "convex/server";
import { api, internal, components } from "../_generated/api";
import { jevFixture } from "../../tests/jev-fixture";
const page = makeFunctionReference<"query">(
  "operations/exportIntelligence:page",
);
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function fixture() {
  const f = await jevFixture(true);
  vi.advanceTimersByTime(1);
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "archive-intelligence",
    cursor: null,
    creationUpperBound: null,
  };
  return { ...f, args };
}
async function pages(
  f: Awaited<ReturnType<typeof fixture>>,
  selection: Record<string, unknown>,
) {
  const tables = {
    ownAssessmentRequests: "jevAssessmentRequests",
    ownRecommendationReceipts: "recommendationReceipts",
    ownRoutingOperations: "jevRoutingOperations",
    ownContentRequests: "contentRequests",
  } as const;
  const table = tables[selection.family as keyof typeof tables];
  const privateKeys = table
    ? await f.t.run(async (ctx) =>
        (await ctx.db.query(table).collect()).map((r) => r.operationKey),
      )
    : [];
  const rows: any[] = [];
  let cursor: string | null = null,
    creationUpperBound: number | null = null;
  for (let i = 0; i < 100; i++) {
    const p: any = await f.signed.query(page, {
      ...f.args,
      ...selection,
      cursor,
      creationUpperBound,
    });
    for (const key of privateKeys) {
      expect(JSON.stringify(p)).not.toContain(key);
      expect(Buffer.from(p.cursor, "base64").toString("utf8")).not.toContain(
        key,
      );
    }
    rows.push(...p.data.selection.rows);
    if (p.isDone) return rows;
    expect(p.cursor).not.toBe(cursor);
    cursor = p.cursor;
    creationUpperBound = p.creationUpperBound;
  }
  throw Error("nonterminating native cursor");
}
test("retired and review-expired algorithm declarations retain both original variants across native pages", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const original = (await ctx.db.get(f.request.algorithmId))!;
    const { _id, _creationTime, ...r } = original;
    await ctx.db.patch(_id, {
      status: "retired",
      retiredAt: 123,
      payload: { ...r.payload, reviewDueAt: 1 },
    });
    await ctx.db.insert("algorithmProfiles", {
      ...r,
      payload: {
        ...r.payload,
        version: "x-public-context-v1",
        refs: {
          ...r.payload.refs,
          questionSet: "unavailable-until-task28",
          normalization: "unavailable-until-task28",
        },
      },
    });
  });
  vi.advanceTimersByTime(1);
  const rows = await pages(f, {
    family: "algorithmProfiles",
    accountId: f.request.accountId,
  });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    status: "retired",
    retiredAt: 123,
    payload: { reviewDueAt: 1, version: "x-post-analysis-v1" },
  });
  expect(rows[1].payload.version).toBe("x-public-context-v1");
});
test("own assessment request pages preserve original intent after selection changes and expose no keys", async () => {
  const f = await fixture();
  for (let i = 0; i < 2; i++)
    await f.signed.mutation(internal.intelligence.assessments.prepare, {
      workspaceId: f.workspaceId,
      accountId: f.request.accountId,
      draftId: f.request.draftId,
      draftVersionId: f.request.draftVersionId,
      operationKey: `secret-operation-${i}`,
    });
  await f.t.run(async (ctx) => {
    const s = (await ctx.db.query("intelligenceSelections").first())!;
    await ctx.db.patch(s._id, { algorithmId: null, audienceId: null });
  });
  vi.advanceTimersByTime(1);
  const rows = await pages(f, { family: "ownAssessmentRequests" });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    accountId: f.request.accountId,
    draftVersionId: f.request.draftVersionId,
    algorithmId: f.request.algorithmId,
  });
  expect(JSON.stringify(rows)).not.toMatch(
    /operationKey|semanticKey|secret-operation/,
  );
});
test("session and shared role boundaries fail before selection, own Viewer headers remain", async () => {
  const f = await fixture();
  await f.signed.mutation(internal.intelligence.assessments.prepare, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    draftId: f.request.draftId,
    draftVersionId: f.request.draftVersionId,
    operationKey: "private-operation",
  });
  vi.advanceTimersByTime(1);
  await expect(
    f.signed.query(page, {
      ...f.args,
      family: "algorithmProfiles",
      accountId: f.request.accountId,
      expectedSessionId: "old",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  await f.t.run(async (ctx) =>
    ctx.db.patch((await ctx.db.query("memberships").first())!._id, {
      role: "Viewer",
    }),
  );
  await expect(
    f.signed.query(page, {
      ...f.args,
      family: "algorithmProfiles",
      accountId: f.request.accountId,
    }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  expect(await pages(f, { family: "ownAssessmentRequests" })).toHaveLength(1);
});
test("own native default-OFF routing pages preserve intent and Viewer source loss retains only headers", async () => {
  const f = await fixture();
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    title: "Original",
    note: "Human",
    perspective: "Possible",
    priority: "normal",
    source: { kind: "note" },
    operationKey: "idea-operation",
  });
  for (let i = 0; i < 2; i++)
    await f.signed.mutation(api.ai.jev.routing.prepare, {
      workspaceId: f.workspaceId,
      accountId: f.request.accountId,
      ideaId,
      expectedRevision: 1,
      operationKey: `routing-secret-${i}`,
      intent: {
        intent: "Original instruction",
        outputKind: "perspective",
        strategy: i === 0 ? null : "generic",
        network: "x",
        objective: null,
        tone: null,
        cta: null,
      },
    });
  vi.advanceTimersByTime(1);
  let rows = await pages(f, { family: "ownRoutingOperations" });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    intent: { intent: "Original instruction" },
    result: { status: "configuration_required" },
    materialAvailability: "retained",
    policyId: null,
    attemptId: null,
    provenance: null,
  });
  expect(rows[1]).toMatchObject({
    policyId: null,
    attemptId: null,
    provenance: null,
    result: { status: "human_choice" },
  });
  expect(JSON.stringify(rows)).not.toMatch(
    /fingerprint|operationKey|routing-secret/i,
  );
  await f.t.run(async (ctx) =>
    ctx.db.patch((await ctx.db.query("memberships").first())!._id, {
      role: "Viewer",
    }),
  );
  rows = await pages(f, { family: "ownRoutingOperations" });
  expect(rows[0]).toMatchObject({
    intent: null,
    result: null,
    materialAvailability: "unavailable",
  });
  expect(rows[0].id).toBeTruthy();
});
import {
  configuredFixture,
  wire,
  repairableComposite,
} from "../../tests/jev-verification-fixture";
async function authArgs(f: {
  signed: Awaited<ReturnType<typeof fixture>>["signed"];
  t: Awaited<ReturnType<typeof fixture>>["t"];
  userId: Awaited<ReturnType<typeof fixture>>["userId"];
  workspaceId: Awaited<ReturnType<typeof fixture>>["workspaceId"];
}) {
  const u = (await f.t.run((ctx) => ctx.db.get(f.userId)))!,
    identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  return {
    workspaceId: f.workspaceId,
    expectedAuthId: u.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "archive-verification",
    cursor: null,
    creationUpperBound: null,
  };
}
test("native standalone verification exports all retained criteria after its dispatch deadline", async () => {
  const f = await configuredFixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => wire()),
  );
  const prepared = await f.signed.mutation(api.ai.jev.verify.prepare, f.args);
  await f.signed.action(api.ai.jev.verify.check, {
    workspaceId: f.workspaceId,
    reference: prepared.reference!,
  });
  vi.advanceTimersByTime(5001);
  const args = await authArgs(f);
  const p: any = await f.signed.query(page, {
    ...args,
    family: "ownStandaloneVerifications",
  });
  expect(p.data.selection.rows).toHaveLength(1);
  const r = p.data.selection.rows[0];
  expect(r).toMatchObject({
    kind: "standalone",
    actorId: f.userId,
    materialAvailability: "retained",
    result: { decision: "accept_with_warning" },
  });
  expect(Object.keys(r.result.criteria)).toHaveLength(7);
  expect(JSON.stringify(p.data)).not.toMatch(
    /Hash|Fingerprint|operationKey|policyFingerprint|"intent":/,
  );
  const content = await f.signed.query(page, {
    ...args,
    family: "ownContentRequests",
  });
  expect(content.data.selection.rows[0]).toMatchObject({
    runId: f.runId,
    intent: "Discuss the supplied qualified claim without promotion",
  });
  const request = (await f.t.run((ctx) =>
    ctx.db.get(prepared.reference!.contentRequestId),
  ))!;
  await f.t.mutation(internal.content.ideas.purgeRouting, {
    operationId: request.routingOperationId!,
    runId: f.runId,
    cursor: null,
  });
  const erased = await f.signed.query(page, {
    ...args,
    family: "ownStandaloneVerifications",
  });
  expect(erased.data.selection.rows[0]).toMatchObject({
    actorId: f.userId,
    candidateVersionId: f.ver._id,
    materialAvailability: "unavailable",
    result: null,
    stickyRisk: null,
  });
});
test("style declarations, reset controls and command history preserve original values", async () => {
  const f = await fixture(),
    scope = { workspaceId: f.workspaceId, accountId: f.request.accountId };
  let revision = 0;
  const command = async (action: unknown) => {
    const r = await f.signed.mutation(api.ai.styleProfiles.change, {
      ...scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      action,
    } as never);
    revision = r.revision;
    return r;
  };
  const payload = {
    author: "Original human",
    experiences: ["First experience"],
    tone: "Clear",
    positioning: "Useful",
    pillars: [{ name: "Product", weight: 100 }],
    examples: ["An example"],
    forbidden: ["guaranteed"],
  };
  const first = await command({
    kind: "save",
    payload,
    freshDeclaration: true,
    baseVersionId: null,
    reason: "Original declaration",
  });
  await command({
    kind: "save",
    payload: { ...payload, tone: "Other" },
    freshDeclaration: true,
    baseVersionId: null,
    reason: "Unselected declaration",
  });
  await command({
    kind: "retire",
    versionId: first.versionId,
    reason: "Historical",
  });
  await command({ kind: "reset", reason: "Reset history" });
  vi.advanceTimersByTime(1);
  const rows = await pages(f, {
    family: "styleVersions",
    accountId: scope.accountId,
  });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ status: "retired", payload });
  expect(
    await pages(f, { family: "styleCommands", accountId: scope.accountId }),
  ).toHaveLength(4);
  expect(
    (await pages(f, { family: "styleControls", accountId: scope.accountId }))[0]
      .selectedVersionId,
  ).toBeNull();
});
test("native audience and intelligence selection receipts retain multiline original reasons", async () => {
  const f = await fixture();
  const scope = { workspaceId: f.workspaceId, accountId: f.request.accountId };
  await f.signed.mutation(api.intelligence.audienceProfiles.create, {
    ...scope,
    expectedRevision: 1,
    commandKey: "audience-archive",
    description: "Original\nAudience",
  });
  await f.signed.mutation(api.intelligence.audienceProfiles.create, {
    ...scope,
    expectedRevision: 2,
    commandKey: "audience-archive2",
    description: "Second\nAudience",
  });
  vi.advanceTimersByTime(1);
  expect(
    await pages(f, { family: "audienceProfiles", accountId: scope.accountId }),
  ).toHaveLength(3);
  expect(
    await pages(f, {
      family: "intelligenceProfileReceipts",
      accountId: scope.accountId,
    }),
  ).toHaveLength(2);
  expect(
    (
      await pages(f, {
        family: "intelligenceSelections",
        accountId: scope.accountId,
      })
    )[0].revision,
  ).toBe(3);
});
import { POST_ANALYSIS } from "../ai/jev/questions/postAnalysis";
import {
  fixture as updateFixture,
  transport as updateTransport,
  independent,
  input as updateInput,
} from "../../tests/intelligence-update-fixture";
function analysisResponse() {
  return Response.json({
    model: "jev-1.13.0",
    usage: { input_tokens: 20, output_tokens: 10 },
    answers: Object.fromEntries(
      Object.entries(POST_ANALYSIS.questions).map(([key, q]) => [
        key,
        q.type === "choice"
          ? {
              type: "choice",
              choice: "educational",
              confidence: 0.9,
              probabilities: Object.fromEntries(
                Object.keys(q.criteria).map((k) => [k, 0.125]),
              ),
            }
          : q.type === "score"
            ? {
                type: "score",
                score: 2.5,
                confidence: 0.9,
                probabilities: { 0: 0.2, 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.2 },
                legend: Object.fromEntries(
                  q.criteria.map((s, i) => [String(i), s]),
                ),
              }
            : { type: "noul", noul: 0.2 },
      ]),
    ),
  });
}
test("native assessments and recommendation adoption receipts export original stored semantics", async () => {
  const f = await fixture();
  const target = {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    draftId: f.request.draftId,
    draftVersionId: f.request.draftVersionId,
  };
  await f.t.run(async (ctx) => {
    const v = (await ctx.db.get(target.draftVersionId))!;
    await ctx.db.patch(v._id, {
      content: {
        ...v.content,
        text: [
          "Exact paragraph\n\nExact paragraph",
          "Body\n\n#one #two #three #four",
        ],
      },
    });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => analysisResponse()),
  );
  await f.signed.action(api.intelligence.assessments.analyze, {
    ...target,
    operationKey: "archive-native-analysis",
  });
  const current = await f.signed.query(
    api.intelligence.assessments.get,
    target,
  );
  const p = current.recommendations!;
  const adopted = await f.signed.mutation(
    api.intelligence.recommendations.adopt,
    {
      ...target,
      assessmentId: p.assessmentId,
      revision: p.revision,
      proof: p.proof,
      ruleVersion: p.ruleVersion,
      candidateIndex: 0,
      tokenIndices: [],
      alt: "",
      operationKey: "archive-native-adopt",
    },
  );
  const nextTarget = { ...target, draftVersionId: adopted.versionId };
  await f.signed.action(api.intelligence.assessments.analyze, {
    ...nextTarget,
    operationKey: "archive-native-analysis-two",
  });
  const next = await f.signed.query(
    api.intelligence.assessments.get,
    nextTarget,
  );
  const nextProposal = next.recommendations!;
  await f.signed.mutation(api.intelligence.recommendations.adopt, {
    ...nextTarget,
    assessmentId: nextProposal.assessmentId,
    revision: nextProposal.revision,
    proof: nextProposal.proof,
    ruleVersion: nextProposal.ruleVersion,
    candidateIndex: 0,
    tokenIndices: [3],
    alt: "",
    operationKey: "archive-native-adopt-two",
  });
  vi.advanceTimersByTime(1);
  const rows = await pages(f, {
    family: "assessments",
    accountId: target.accountId,
    draftId: target.draftId,
  });
  expect(rows).toHaveLength(2);
  expect(rows[1].result).toEqual(next.assessment!.result);
  expect(rows[0].result).toEqual(current.assessment!.result);
  const receipts = await pages(f, { family: "ownRecommendationReceipts" });
  expect(receipts).toHaveLength(2);
  const native = (await f.t.run((ctx) =>
    ctx.db.query("recommendationReceipts").first(),
  ))!;
  expect(receipts[0]).toEqual({
    id: native._id,
    accountId: native.accountId,
    actorId: native.actorId,
    baseVersionId: native.baseVersionId,
    versionId: native.versionId,
    revision: native.revision,
    createdAt: native._creationTime,
  });
});
test("native public source check, proposal and independent evaluation remain exact saved history", async () => {
  const f = await updateFixture();
  updateTransport({ patch: "original public patch" });
  const checked = await f.signed.action(
    api.intelligence.profileUpdates.check,
    updateInput(f),
  );
  const reviewer = await independent(f);
  const evaluationId = await reviewer.signed.mutation(
    api.intelligence.profileUpdates.evaluate,
    {
      ...f.scope,
      proposalId: checked.proposalId!,
      commandKey: crypto.randomUUID(),
      variant: "post-analysis",
      interpretation: "Reviewed public source changes",
      impact: "Source context only",
      rationale: "Full immutable compare inspected",
      fullSourceReview: true,
    },
  );
  const draft = await f.signed.mutation(
    api.intelligence.algorithmProfiles.create,
    {
      ...f.scope,
      expectedRevision: 1,
      commandKey: crypto.randomUUID(),
      variant: "post-analysis",
      proposalId: checked.proposalId!,
      evaluationId,
    },
  );
  await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(draft.algorithmId!))!;
    await ctx.db.patch(a._id, { status: "retired", retiredAt: Date.now() });
  });
  vi.advanceTimersByTime(1);
  const args = await authArgs(f);
  for (const kind of ["check", "proposal", "evaluation"]) {
    const p = await f.signed.query(page, {
      ...args,
      family: "intelligenceSourceUpdates",
      accountId: f.scope.accountId,
      kind,
    });
    expect(p.data.selection.rows).toHaveLength(1);
    const r = p.data.selection.rows[0];
    expect(r.kind).toBe(kind);
    expect(JSON.stringify(r)).not.toMatch(
      /contract|commandKey|fingerprint|baseIdentity/,
    );
    if (kind === "proposal")
      expect(r.observation.changes[0].patch).toBe("original public patch");
    if (kind === "evaluation") expect(r.reference.outcomes).toHaveLength(3);
  }
  const profiles = await f.signed.query(page, {
    ...args,
    family: "algorithmProfiles",
    accountId: f.scope.accountId,
  });
  // One batched page already emits the retired draft profile; the tail page
  // is empty.
  expect(
    profiles.data.selection.rows.find(
      (r: { id: string }) => r.id === draft.algorithmId,
    ),
  ).toMatchObject({ id: draft.algorithmId, status: "retired" });
  expect(profiles.isDone).toBe(true);
  const next = await f.signed.query(page, {
    ...args,
    family: "algorithmProfiles",
    accountId: f.scope.accountId,
    cursor: profiles.cursor,
    creationUpperBound: profiles.creationUpperBound,
  });
  expect(next.data.selection.rows).toEqual([]);
  expect(next.isDone).toBe(true);
});
test("native composite first, repair child and final results keep original envelope after deadline", async () => {
  const f = await repairableComposite(),
    repair = await f.signed.mutation(api.ai.jev.composite.repair, f.repairArgs);
  await f.t.action(internal.ai.provider.execute, { runId: repair.runId });
  const root = (await f.t.run((ctx) =>
    ctx.db.get(
      f.reference
        .contentRequestId as import("../_generated/dataModel").Id<"contentRequests">,
    ),
  ))!;
  const s = root.composite!.final!;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => wire()),
  );
  await f.signed.action(api.ai.jev.verify.check, {
    workspaceId: f.workspaceId,
    reference: {
      contentRequestId: root._id,
      candidateVersionId: s.candidateVersionId,
      contentHash: s.contentHash,
      commandFingerprint: s.commandFingerprint,
      compositeStage: "final-verification",
    },
  });
  vi.setSystemTime(root.composite!.deadline + 1);
  const args = await authArgs(f);
  const all = await pages({ ...f, args } as never, {
    family: "ownContentRequests",
  });
  expect(all).toHaveLength(2);
  const main = all.find((r) => r.id === root._id)!;
  expect(main.composite).toMatchObject({
    kind: root.composite!.kind,
    actorId: f.userId,
    startedAt: root.composite!.startedAt,
    deadline: root.composite!.deadline,
    maxCostMicros: root.composite!.maxCostMicros,
    repairRequestId: repair.contentRequestId,
    repairRunId: repair.runId,
    materialAvailability: "retained",
    first: { kind: "first", result: { decision: "repairable" } },
    final: { kind: "final", result: { decision: "accept_with_warning" } },
  });
  expect(JSON.stringify(main)).not.toMatch(
    /Fingerprint|operationKey|reservationId|heldMicros|spentMicros|contentHash/,
  );
  const foreignActor = await f.t.run((ctx) =>
    ctx.db.insert("users", {
      authId: "foreign-actor",
      activeWorkspaceId: f.workspaceId,
      defaultWorkspaceId: f.workspaceId,
    }),
  );
  await f.t.run((ctx) =>
    ctx.db.patch(root._id, {
      composite: {
        ...root.composite!,
        first: { ...root.composite!.first!, actorId: foreignActor },
      },
    }),
  );
  await expect(
    f.signed.query(page, { ...args, family: "ownContentRequests" }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run((ctx) =>
    ctx.db.patch(root._id, {
      composite: {
        ...root.composite!,
        sourceUnavailable: true,
        state: "stopped",
      },
    }),
  );
  const stopped = await pages({ ...f, args } as never, {
    family: "ownContentRequests",
  });
  expect(stopped).toHaveLength(2);
  for (const record of stopped) {
    expect(record).toMatchObject({
      materialAvailability: "unavailable",
      intent: null,
    });
    if (record.composite) expect(record.composite.first.result).toBeNull();
  }
});
test("distinct verifier discovers own standalone slot without foreign producer intent", async () => {
  const f = await configuredFixture();
  const reviewer = await independent(f as never);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => wire()),
  );
  const prepared = await reviewer.signed.mutation(api.ai.jev.verify.prepare, {
    ...f.args,
    operationKey: "distinct-verifier-operation",
  });
  await reviewer.signed.action(api.ai.jev.verify.check, {
    workspaceId: f.workspaceId,
    reference: prepared.reference!,
  });
  vi.advanceTimersByTime(1);
  const own = { ...f, signed: reviewer.signed, userId: reviewer.userId };
  const args = await authArgs(own);
  const p = await own.signed.query(page, {
    ...args,
    family: "ownStandaloneVerifications",
  });
  expect(p.data.selection.rows).toHaveLength(1);
  expect(p.data.selection.rows[0].actorId).toBe(reviewer.userId);
  expect(JSON.stringify(p.data)).not.toContain(
    "Discuss the supplied qualified claim",
  );
  expect(
    (await own.signed.query(page, { ...args, family: "ownContentRequests" }))
      .data.selection.rows,
  ).toEqual([]);
  const producer = await f.signed.query(page, {
    ...(await authArgs(f)),
    family: "ownContentRequests",
  });
  expect(producer.data.selection.rows[0].verification).toBeNull();
  await f.t.run(async (ctx) => {
    const m = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", reviewer.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.patch(m._id, { role: "Viewer" });
  });
  const lost = await own.signed.query(page, {
    ...args,
    family: "ownStandaloneVerifications",
  });
  expect(lost.data.selection.rows[0]).toMatchObject({
    materialAvailability: "unavailable",
    result: null,
  });
});
test("rejected native style proposals preserve decision and original retained preferences", async () => {
  const f = await fixture(),
    scope = { workspaceId: f.workspaceId, accountId: f.request.accountId };
  let revision = 0;
  const command = async (action: unknown) => {
    const r = await f.signed.mutation(api.ai.styleProfiles.change, {
      ...scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      action,
    } as never);
    revision = r.revision;
    return r;
  };
  const payload = {
    author: "Human",
    experiences: ["Own"],
    tone: "Clear",
    positioning: "Useful",
    pillars: [{ name: "Product", weight: 100 }],
    examples: ["Own example"],
    forbidden: [],
  };
  const saved = await command({
    kind: "save",
    payload,
    freshDeclaration: true,
    baseVersionId: null,
    reason: "Own declaration",
  });
  await command({
    kind: "select",
    versionId: saved.versionId,
    reason: "Selected",
  });
  const v = (await f.t.run((ctx) => ctx.db.get(f.request.draftVersionId)))!;
  await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.request.draftId,
    expectedRevision: 1,
    content: {
      ...v.content,
      title: "Changed",
      text: ["Original edited human text"],
    },
    reason: "Human edit",
  });
  const feedback = (
    await f.signed.query(api.content.feedback.list, scope)
  ).find((x) => x.kind === "edit")!;
  const { author, experiences, ...preferences } = payload;
  for (let i = 0; i < 2; i++) {
    const proposed = await command({
      kind: "propose",
      baseVersionId: saved.versionId,
      feedbackId: feedback._id,
      preferences: { ...preferences, tone: `Tone ${i}` },
      ownExamples: true,
      reason: `Proposal ${i}`,
    });
    await command({
      kind: "reject",
      proposalId: proposed.proposalId,
      reason: `Declined ${i}`,
    });
  }
  vi.advanceTimersByTime(1);
  const rows = await pages(f, {
    family: "learningProposals",
    accountId: scope.accountId,
  });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    state: "rejected",
    preferences: { tone: "Tone 0" },
    decisionReason: "Declined 0",
    materialAvailability: "retained",
  });
  const before = rows[0];
  await f.t.run((ctx) =>
    ctx.db.patch(before.id, { sourceUnavailable: true, preferences: null }),
  );
  const unavailable = (
    await pages(f, { family: "learningProposals", accountId: scope.accountId })
  )[0];
  expect(unavailable).toMatchObject({
    id: before.id,
    state: "rejected",
    materialAvailability: "unavailable",
    preferences: null,
    reason: null,
    decisionReason: null,
  });
});
test("native creation bound excludes records added between pages", async () => {
  const f = await fixture();
  for (let i = 0; i < 2; i++)
    await f.signed.mutation(internal.intelligence.assessments.prepare, {
      workspaceId: f.workspaceId,
      accountId: f.request.accountId,
      draftId: f.request.draftId,
      draftVersionId: f.request.draftVersionId,
      operationKey: `a-operation-${i}`,
    });
  vi.advanceTimersByTime(1);
  const first = await f.signed.query(page, {
    ...f.args,
    family: "ownAssessmentRequests",
  });
  // One batched page emits both in-ceiling requests.
  expect(first.data.selection.rows).toHaveLength(2);
  expect(first.isDone).toBe(true);
  vi.advanceTimersByTime(100);
  await f.signed.mutation(internal.intelligence.assessments.prepare, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    draftId: f.request.draftId,
    draftVersionId: f.request.draftVersionId,
    operationKey: "z-operation-later",
  });
  const second = await f.signed.query(page, {
    ...f.args,
    family: "ownAssessmentRequests",
    cursor: first.cursor,
    creationUpperBound: first.creationUpperBound,
  });
  // The record added between pages stays outside the original ceiling; the
  // drained tail page is empty.
  expect(second.data.selection.rows).toEqual([]);
  expect(second.isDone).toBe(true);
});
test.each([NaN, Infinity, -0])(
  "whole candidate fails on non-JSON numeric value %s",
  async (bad) => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.patch(f.request.algorithmId, { createdAt: bad }),
    );
    await expect(
      f.signed.query(page, {
        ...f.args,
        family: "algorithmProfiles",
        accountId: f.request.accountId,
      }),
    ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
  },
);
test("whole UTF8 envelope fails without truncating oversized public declaration", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const r = (await ctx.db.get(f.request.algorithmId))!;
    await ctx.db.patch(r._id, {
      payload: { ...r.payload, report: "ä".repeat(34000) },
    });
  });
  await expect(
    f.signed.query(page, {
      ...f.args,
      family: "algorithmProfiles",
      accountId: f.request.accountId,
    }),
  ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
});
test("own request nested actor corruption and foreign draft binding fail complete page", async () => {
  const f = await fixture();
  await f.signed.mutation(internal.intelligence.assessments.prepare, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    draftId: f.request.draftId,
    draftVersionId: f.request.draftVersionId,
    operationKey: "nested-request",
  });
  const r = (await f.t.run((ctx) =>
    ctx.db.query("jevAssessmentRequests").first(),
  ))!;
  vi.advanceTimersByTime(1);
  await f.t.run((ctx) =>
    ctx.db.patch(r._id, {
      request: { ...r.request, operationKey: "other-secret-key" },
    }),
  );
  await expect(
    f.signed.query(page, { ...f.args, family: "ownAssessmentRequests" }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
});
test("archive queries perform no writes, schedules or provider transport", async () => {
  const f = await fixture();
  const transport = vi.fn();
  vi.stubGlobal("fetch", transport);
  const result = await f.signed.run(async (ctx) => {
    const value = await ctx.runQuery(page, {
      ...f.args,
      family: "algorithmProfiles",
      accountId: f.request.accountId,
    });
    return { value, metrics: await ctx.meta.getTransactionMetrics() };
  });
  expect(result.value.data.selection.rows).toHaveLength(1);
  expect(result.metrics.documentsWritten.used).toBe(0);
  expect(result.metrics.functionsScheduled.used).toBe(0);
  expect(transport).not.toHaveBeenCalled();
});
test("assessment-request owned header survives direct known source erasure", async () => {
  const f = await fixture();
  await f.signed.mutation(internal.intelligence.assessments.prepare, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    draftId: f.request.draftId,
    draftVersionId: f.request.draftVersionId,
    operationKey: "erased-request",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.request.draftVersionId, { sourceUnavailable: true }),
  );
  vi.advanceTimersByTime(1);
  const p = await f.signed.query(page, {
    ...f.args,
    family: "ownAssessmentRequests",
  });
  expect(p.data.selection.rows[0]).toMatchObject({
    draftVersionId: f.request.draftVersionId,
    materialAvailability: "unavailable",
  });
});
test("retained routing source corruption and unknown resource errors fail the whole page", async () => {
  const f = await configuredFixture();
  const request = (await f.t.run((ctx) =>
    ctx.db.query("contentRequests").first(),
  ))!;
  const op = (await f.t.run((ctx) => ctx.db.get(request.routingOperationId!)))!;
  const original = (await f.t.run((ctx) => ctx.db.get(op.inputVersionId)))!;
  await f.t.run((ctx) =>
    ctx.db.patch(op._id, {
      inputVersionId: f.ver._id,
      sourceUnavailable: true,
    }),
  );
  vi.advanceTimersByTime(1);
  const args = await authArgs(f);
  await expect(
    f.signed.query(page, { ...args, family: "ownRoutingOperations" }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run((ctx) =>
    ctx.db.patch(op._id, {
      inputVersionId: original._id,
      sourceUnavailable: false,
    }),
  );
  const helper = await import("../ai/jev/routing");
  vi.spyOn(helper, "retainedRoutingProof").mockRejectedValueOnce(
    new Error("synthetic database read limit"),
  );
  await expect(
    f.signed.query(page, { ...args, family: "ownRoutingOperations" }),
  ).rejects.toThrow("synthetic database read limit");
});
test("standalone receipt original command mismatch is not treated as source loss", async () => {
  const f = await configuredFixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => wire()),
  );
  const prepared = await f.signed.mutation(api.ai.jev.verify.prepare, f.args);
  await f.signed.action(api.ai.jev.verify.check, {
    workspaceId: f.workspaceId,
    reference: prepared.reference!,
  });
  const r = (await f.t.run((ctx) => ctx.db.query("contentRequests").first()))!;
  await f.t.run((ctx) =>
    ctx.db.patch(r._id, {
      verification: {
        ...r.verification!,
        operationKey: "foreign-original-operation",
        sourceUnavailable: true,
      },
    }),
  );
  vi.advanceTimersByTime(1);
  await expect(
    f.signed.query(page, {
      ...(await authArgs(f)),
      family: "ownStandaloneVerifications",
    }),
  ).rejects.toThrow("VERIFICATION_RECEIPT_INVALID");
});
test("style ancestry cycle cannot be silently omitted from archive", async () => {
  const f = await fixture();
  const saved = await f.signed.mutation(api.ai.styleProfiles.change, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    expectedRevision: 0,
    commandKey: "style-cycle-native",
    action: {
      kind: "save",
      payload: {
        author: "Human",
        experiences: [],
        tone: "Clear",
        positioning: "",
        pillars: [{ name: "Product", weight: 100 }],
        examples: [],
        forbidden: [],
      },
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Original",
    },
  });
  await f.t.run((ctx) =>
    ctx.db.patch(saved.versionId!, { baseVersionId: saved.versionId! }),
  );
  vi.advanceTimersByTime(1);
  await expect(
    f.signed.query(page, {
      ...f.args,
      family: "styleVersions",
      accountId: f.request.accountId,
    }),
  ).rejects.toThrow("STYLE_ANCESTRY_LIMIT");
});
test("native verifier discovery traverses two original producers and headers survive current actor downgrade", async () => {
  const f = await configuredFixture();
  const root = (await f.t.run((ctx) =>
    ctx.db.query("contentRequests").first(),
  ))!;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => wire()),
  );
  let p = await f.signed.mutation(api.ai.jev.verify.prepare, f.args);
  await f.signed.action(api.ai.jev.verify.check, {
    workspaceId: f.workspaceId,
    reference: p.reference!,
  });
  const runId = await f.signed.mutation(api.content.ideas.generate, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    ideaId: root.ideaId,
    expectedRevision: root.inputRevision,
    operationKey: "second-native-generation",
    intent: root.intent,
    outputKind: "social-post-candidate",
    routingOperationId: root.routingOperationId,
  });
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "second-native-execution",
  });
  const result = await f.t.mutation(internal.content.ideas.commitProposal, {
    runId,
    executionKey: "second-native-execution",
    output: JSON.stringify(["Another qualified candidate."]),
  });
  const ver = (await f.t.run(async (ctx) =>
    ctx.db.get((await ctx.db.get(result!))!.currentVersionId!),
  ))!;
  p = await f.signed.mutation(api.ai.jev.verify.prepare, {
    workspaceId: f.workspaceId,
    versionId: ver._id,
    contentHash: ver.candidate!.contentHash,
    operationKey: "second-native-verification",
  });
  await f.signed.action(api.ai.jev.verify.check, {
    workspaceId: f.workspaceId,
    reference: p.reference!,
  });
  vi.advanceTimersByTime(1);
  const args = await authArgs(f);
  const rows = await pages({ ...f, args } as never, {
    family: "ownStandaloneVerifications",
  });
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => r.producerRunId)).toContain(runId);
  await f.t.run(async (ctx) =>
    ctx.db.patch((await ctx.db.query("memberships").first())!._id, {
      role: "Viewer",
    }),
  );
  const lost = await pages({ ...f, args } as never, {
    family: "ownStandaloneVerifications",
  });
  expect(lost.map((r) => r.materialAvailability)).toEqual([
    "unavailable",
    "unavailable",
  ]);
  expect(lost.every((r) => r.result === null)).toBe(true);
});
test("native history exceeds old list caps without relying on current selection", async () => {
  const f = await fixture(),
    scope = { workspaceId: f.workspaceId, accountId: f.request.accountId };
  let revision = 0;
  for (let i = 0; i < 27; i++) {
    const r = await f.signed.mutation(api.ai.styleProfiles.change, {
      ...scope,
      expectedRevision: revision,
      commandKey: `history-style-${i}`,
      action: {
        kind: "save",
        payload: {
          author: "Human",
          experiences: [],
          tone: `Original ${i}`,
          positioning: "",
          pillars: [{ name: "Product", weight: 100 }],
          examples: [],
          forbidden: [],
        },
        freshDeclaration: true,
        baseVersionId: null,
        reason: `Declaration ${i}`,
      },
    });
    revision = r.revision;
  }
  vi.advanceTimersByTime(1);
  const versions = await pages(f, {
      family: "styleVersions",
      accountId: scope.accountId,
    }),
    commands = await pages(f, {
      family: "styleCommands",
      accountId: scope.accountId,
    });
  expect(versions).toHaveLength(27);
  expect(commands).toHaveLength(27);
  expect(versions[0].payload.tone).toBe("Original 0");
  expect(versions[26].payload.tone).toBe("Original 26");
  expect(commands[0].reason).toBe("Declaration 0");
});
test("public check history advances beyond 15 and preserves saved expired pending state", async () => {
  const f = await updateFixture();
  for (let i = 0; i < 17; i++) {
    const r = await f.signed.mutation(
      internal.intelligence.profileUpdates.reserve,
      {
        ...f.scope,
        baseProfileId: f.baseProfileId,
        full: false,
        commandKey: `history-check-${i}`,
      },
    );
    vi.setSystemTime(r.check.notBefore + 1);
  }
  const args = await authArgs(f);
  const rows = await pages({ ...f, args } as never, {
    family: "intelligenceSourceUpdates",
    accountId: f.scope.accountId,
    kind: "check",
  });
  expect(rows).toHaveLength(17);
  const originals = await f.t.run((ctx) =>
    ctx.db
      .query("intelligenceSourceUpdates")
      .withIndex("by_scope_kind", (q) =>
        q
          .eq("workspaceId", f.workspaceId)
          .eq("accountId", f.scope.accountId)
          .eq("network", "x")
          .eq("surface", "for_you")
          .eq("kind", "check"),
      )
      .collect(),
  );
  expect(
    rows.map((r) => ({ id: r.id, state: r.state, finishedAt: r.finishedAt })),
  ).toEqual(
    originals.map((r) => ({
      id: r._id,
      state: r.kind === "check" ? r.state : null,
      finishedAt: r.kind === "check" ? r.finishedAt : null,
    })),
  );
});
import {
  fixture as routingFixture,
  response as routingResponse,
} from "../../tests/jev-routing-fixture";
test("native funded routing keeps original result and proof horizon when today's policy selection changes", async () => {
  const f = await routingFixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => routingResponse()),
  );
  const ids: import("../_generated/dataModel").Id<"jevRoutingOperations">[] =
    [];
  for (let i = 0; i < 2; i++) {
    const id = await f.signed.mutation(api.ai.jev.routing.prepare, {
      ...f.command,
      operationKey: `funded-archive-${i}`,
    });
    vi.advanceTimersByTime(1);
    const pending = (
      await pages({ ...f, args: await authArgs(f) } as never, {
        family: "ownRoutingOperations",
      })
    ).find((r) => r.id === id)!;
    expect(pending).toMatchObject({
      attemptId: null,
      provenance: null,
      result: null,
    });
    expect(pending.policyId).not.toBeNull();
    await f.t.action(internal.ai.jev.routing.classifyAction, {
      operationId: id,
    });
    ids.push(id);
  }
  const originals = await f.t.run(async (ctx) =>
    Promise.all(ids.map((id) => ctx.db.get(id))),
  );
  vi.advanceTimersByTime(1);
  const args = await authArgs(f);
  let rows = await pages({ ...f, args } as never, {
    family: "ownRoutingOperations",
  });
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => r.result)).toEqual(originals.map((r) => r!.result));
  const provenance = await f.t.run(async (ctx) =>
    Promise.all(
      originals.map(async (r) => {
        const t = (await ctx.db.get(r!.attemptId!))!;
        if (t.owner !== "jev-intent-router")
          throw Error("native router fixture owner");
        return {
          policyId: r!.policyId,
          attemptId: t._id,
          provenance: {
            policyVersion: t.policyVersion,
            requestedModel: t.model,
            resolvedModel: t.resolvedModel ?? null,
          },
        };
      }),
    ),
  );
  for (let i = 0; i < rows.length; i++)
    expect(rows[i]).toMatchObject(provenance[i]);

  await f.t.run(async (ctx) => {
    const p = (await ctx.db.get(originals[0]!.policyId!))!;
    const { _id, _creationTime, ...data } = p;
    const id = await ctx.db.insert("jevPolicies", {
      ...data,
      version: "later-policy",
    });
    await ctx.db.patch(originals[0]!.controlId!, { policyId: id });
  });
  rows = await pages({ ...f, args } as never, {
    family: "ownRoutingOperations",
  });
  expect(rows.map((r) => r.result)).toEqual(originals.map((r) => r!.result));
  for (let i = 0; i < rows.length; i++)
    expect(rows[i]).toMatchObject(provenance[i]);
  await f.t.run(async (ctx) => {
    const b = (await ctx.db
      .query("aiBudgets")
      .withIndex("by_key", (q) => q.eq("key", `jev:account:${f.accountId}`))
      .unique())!;
    await ctx.db.patch(b._id, { expiresAt: Date.now() - 1 });
  });
  rows = await pages({ ...f, args } as never, {
    family: "ownRoutingOperations",
  });
  expect(rows[0]).toMatchObject({
    id: ids[0],
    materialAvailability: "unavailable",
    intent: null,
    result: null,
    status: originals[0]!.result!.status,
  });
});
test("all native public update kinds have multiple pages and historical derived declarations survive review expiry", async () => {
  const f = await updateFixture(),
    reviewer = await independent(f);
  let derived:
    import("../_generated/dataModel").Id<"algorithmProfiles"> | undefined;
  for (let i = 0; i < 2; i++) {
    updateTransport({
      sha:
        i === 0
          ? "e62790c99484b51424c2eccc488ed4e7517e8778"
          : "f62790c99484b51424c2eccc488ed4e7517e8778",
    });
    const c = await f.signed.action(
      api.intelligence.profileUpdates.check,
      updateInput(f),
    );
    const evaluationId = await reviewer.signed.mutation(
      api.intelligence.profileUpdates.evaluate,
      {
        ...f.scope,
        proposalId: c.proposalId!,
        commandKey: crypto.randomUUID(),
        variant: "post-analysis",
        interpretation: "Original interpretation",
        impact: "Public code context",
        rationale: "Original review rationale",
        fullSourceReview: true,
      },
    );
    if (i === 0) {
      const p = await f.signed.mutation(
        api.intelligence.algorithmProfiles.create,
        {
          ...f.scope,
          expectedRevision: 1,
          commandKey: crypto.randomUUID(),
          variant: "post-analysis",
          proposalId: c.proposalId!,
          evaluationId,
        },
      );
      derived = p.algorithmId!;
    }
    vi.setSystemTime(c.notBefore + 1);
  }
  const args = await authArgs(f);
  for (const kind of ["check", "proposal", "evaluation"]) {
    const rows = await pages({ ...f, args } as never, {
      family: "intelligenceSourceUpdates",
      accountId: f.scope.accountId,
      kind,
    });
    expect(rows).toHaveLength(2);
  }
  const p = (await f.t.run((ctx) => ctx.db.get(derived!)))!;
  const future = p.payload.reviewDueAt + 1;
  await f.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "session",
        where: [{ field: "_id", value: args.expectedSessionId }],
        update: { expiresAt: future + 86400000 },
      },
    }),
  );
  vi.setSystemTime(future);
  const all = await pages({ ...f, args } as never, {
    family: "algorithmProfiles",
    accountId: f.scope.accountId,
  });
  expect(all.find((r) => r.id === derived)!.payload).toEqual(p.payload);
});
test("native 103-path clipped public observation is exported verbatim within the whole-page limit", async () => {
  const f = await updateFixture();
  updateTransport({
    compare: {
      files: Array.from({ length: 103 }, (_, i) => ({
        filename: `home-mixer/source-${i}.rs`,
        status: "modified",
        patch: "x".repeat(6000),
      })),
    },
  });
  const original = await f.signed.action(
    api.intelligence.profileUpdates.check,
    updateInput(f),
  );
  vi.advanceTimersByTime(1);
  const p = await f.signed.query(page, {
    ...(await authArgs(f)),
    family: "intelligenceSourceUpdates",
    accountId: f.scope.accountId,
    kind: "check",
  });
  expect(p.data.selection.rows[0].observation).toEqual(original.observation);
  expect(p.data.selection.rows[0].observation.changes).toHaveLength(103);
  expect(
    p.data.selection.rows[0].observation.changes.every(
      (c: { patchState: string }) => c.patchState === "clipped",
    ),
  ).toBe(true);
});
test("native retained style maximum graph sentinel fails the final candidate instead of dropping it", async () => {
  const f = await fixture();
  let revision = 0,
    baseVersionId:
      import("../_generated/dataModel").Id<"styleProfileVersions"> | null =
      null;
  const payload = {
    author: "Human",
    experiences: ["Own"],
    tone: "Clear",
    positioning: "",
    pillars: [{ name: "Product", weight: 100 }],
    examples: [],
    forbidden: [],
  };
  for (let i = 0; i < 32; i++) {
    const r: FunctionReturnType<typeof api.ai.styleProfiles.change> =
      await f.signed.mutation(api.ai.styleProfiles.change, {
        workspaceId: f.workspaceId,
        accountId: f.request.accountId,
        expectedRevision: revision,
        commandKey: `native-chain-${i}`,
        action: {
          kind: "save",
          payload,
          freshDeclaration: i === 0,
          baseVersionId,
          reason: "Retained ancestor",
        },
      });
    revision = r.revision;
    baseVersionId = r.versionId;
  }
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...r } = (await ctx.db.get(baseVersionId!))!;
    await ctx.db.insert("styleProfileVersions", { ...r, baseVersionId: _id });
  });
  vi.advanceTimersByTime(1);
  const first: any = await f.signed.query(page, {
    ...f.args,
    family: "styleVersions",
    accountId: f.request.accountId,
    cursor: null,
    creationUpperBound: null,
  });
  // The per-request candidate cap emits the first 25 revisions; walking the
  // over-limit duplicate on the next page still fails closed.
  expect(first.data.selection.rows).toHaveLength(25);
  expect(first.isDone).toBe(false);
  await expect(
    f.signed.query(page, {
      ...f.args,
      family: "styleVersions",
      accountId: f.request.accountId,
      cursor: first.cursor,
      creationUpperBound: first.creationUpperBound,
    }),
  ).rejects.toThrow("STYLE_ANCESTRY_LIMIT");
});

test.each(
  (["algorithmId", "audienceId"] as const).flatMap((profile) =>
    (["workspace", "account"] as const).flatMap((boundary) =>
      [false, true].map((unavailable) => ({ profile, boundary, unavailable })),
    ),
  ),
)(
  "saved request rejects $profile $boundary mismatch before unavailable=$unavailable header",
  async ({ profile, boundary, unavailable }) => {
    const f = await fixture();
    await f.signed.mutation(internal.intelligence.assessments.prepare, {
      workspaceId: f.workspaceId,
      accountId: f.request.accountId,
      draftId: f.request.draftId,
      draftVersionId: f.request.draftVersionId,
      operationKey: "repair-native-request",
    });
    await f.t.run(async (ctx) => {
      const r = (await ctx.db.query("jevAssessmentRequests").first())!;
      const original = (await ctx.db.get(f.request[profile]))!;
      if (boundary === "workspace") {
        const { _id, _creationTime, ...ws } = (await ctx.db.get(
          f.workspaceId,
        ))!;
        const foreign = await ctx.db.insert("workspaces", ws);
        await ctx.db.patch(original._id, { workspaceId: foreign });
      } else {
        const { _id, _creationTime, ...account } = (await ctx.db.get(
          f.request.accountId,
        ))!;
        const foreign = await ctx.db.insert("socialAccounts", account);
        await ctx.db.patch(original._id, { accountId: foreign });
      }
      expect(r.request[profile]).toBe(original._id);
      if (unavailable)
        await ctx.db.patch(f.request.draftVersionId, {
          sourceUnavailable: true,
        });
    });
    vi.advanceTimersByTime(1);
    await expect(
      f.signed.query(page, { ...f.args, family: "ownAssessmentRequests" }),
    ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  },
);

test.each([
  "workspace",
  "account",
  "version",
  "matchingModel",
  "fingerprint",
] as const)(
  "native assessment rejects corrupted original analyzer policy/receipt %s",
  async (corruption) => {
    const f = await fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => analysisResponse()),
    );
    await f.signed.action(api.intelligence.assessments.analyze, {
      workspaceId: f.workspaceId,
      accountId: f.request.accountId,
      draftId: f.request.draftId,
      draftVersionId: f.request.draftVersionId,
      operationKey: "repair-native-assessment",
    });
    vi.advanceTimersByTime(1);
    const selection = {
      ...f.args,
      family: "assessments",
      accountId: f.request.accountId,
      draftId: f.request.draftId,
    };
    expect(
      (await f.signed.query(page, selection)).data.selection.rows,
    ).toHaveLength(1);
    await f.t.run(async (ctx) => {
      const r = (await ctx.db.query("jevAssessments").first())!;
      const p = (await ctx.db.get(r.provenance.policyId))!;
      if (corruption === "workspace") {
        const { _id, _creationTime, ...ws } = (await ctx.db.get(
          f.workspaceId,
        ))!;
        await ctx.db.patch(p._id, {
          workspaceId: await ctx.db.insert("workspaces", ws),
        });
      } else if (corruption === "account") {
        const { _id, _creationTime, ...account } = (await ctx.db.get(
          f.request.accountId,
        ))!;
        await ctx.db.patch(p._id, {
          accountId: await ctx.db.insert("socialAccounts", account),
        });
      } else if (corruption === "version") {
        await ctx.db.patch(p._id, { version: "changed-original-version" });
      } else if (corruption === "matchingModel") {
        await ctx.db.patch(r.attemptId, { model: "different-original-model" });
        await ctx.db.patch(r._id, {
          provenance: {
            ...r.provenance,
            requestedModel: "different-original-model",
          },
        });
      } else
        await ctx.db.patch(r.attemptId, {
          policyFingerprint: "invalid-original-fingerprint",
        });
    });
    await expect(f.signed.query(page, selection)).rejects.toThrow(
      corruption === "workspace" || corruption === "account"
        ? "REFERENCE_ACCESS_DENIED"
        : "JEV_ATTEMPT_OWNER_INVALID",
    );
  },
);
