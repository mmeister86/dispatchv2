import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { jevFixture } from "../../../tests/jev-fixture";
import { POST_ANALYSIS } from "./questions/postAnalysis";
import { api, internal } from "../../_generated/api";
const analyze = makeFunctionReference<"action">("ai/jev/analyzePost:analyze");
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function response(confidence = 0.9) {
  const answers = Object.fromEntries(
    Object.entries(POST_ANALYSIS.questions).map(([key, q]) => [
      key,
      q.type === "choice"
        ? {
            type: "choice",
            choice: "educational",
            confidence,
            probabilities: Object.fromEntries(
              Object.keys(q.criteria).map((k) => [k, 0.125]),
            ),
          }
        : q.type === "score"
          ? {
              type: "score",
              score: 2.123456789,
              confidence,
              probabilities: { 0: 0.2, 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.2 },
              legend: Object.fromEntries(
                q.criteria.map((s, i) => [String(i), s]),
              ),
            }
          : { type: "noul", noul: 0.2 },
    ]),
  );
  return new Response(
    JSON.stringify({
      model: "jev-1.13.0",
      usage: { input_tokens: 20, output_tokens: 10 },
      answers,
    }),
    { status: 200 },
  );
}
test("registered analyzer consumes actual immutable rubric via pinned SDK and one funding path", async () => {
  const f = await jevFixture(true);
  const transport = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    expect(body.questions).toEqual(POST_ANALYSIS.questions);
    expect(body.state.thread).toEqual([
      { position: 0, text: "Synthetic first segment" },
      { position: 1, text: "Synthetic second segment" },
    ]);
    expect(body.state.network).toBe("x");
    expect(Object.keys(body.state).sort()).toEqual([
      "audience",
      "media",
      "network",
      "thread",
    ]);
    for (const value of [
      f.request.accountId,
      f.request.draftId,
      f.request.draftVersionId,
      f.request.workspaceId,
      f.request.actorId,
      String(f.request.deadline),
    ])
      expect(JSON.stringify(body.state)).not.toContain(value);
    expect(body.state).not.toHaveProperty("sourceUntil");
    expect(body.state).not.toHaveProperty("capability");
    expect(body.state.media).toEqual([]);
    return response();
  });
  vi.stubGlobal("fetch", transport);
  const result = await f.t.action(analyze, f.request);
  expect(result.outcome).toBe("success");
  expect(result.questionVersion).toBe("jev-post-analysis-v1");
  expect(result.score.aggregate).toBeCloseTo(
    ((2.123456789 / 4) * 0.8 + 0.1 + 0.05) * 100,
    12,
  );
  expect(result.score.audienceFit).toBe("unavailable");
  expect(transport).toHaveBeenCalledTimes(1);
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({
    questionVersion: "jev-post-analysis-v1",
    normalizationVersion: "jev-normalization-v1",
    model: "jev-1.13.0",
    resolvedModel: "jev-1.13.0",
    state: "settled",
    estimatedMicros: 20,
  });
});
test("low confidence has preserved semantic values but no aggregate; old refs and full input overflow fail before funding", async () => {
  const f = await jevFixture(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response(0.2)),
  );
  const result = await f.t.action(analyze, f.request);
  expect(result.outcome).toBe("low_confidence");
  expect(result.answers.hookStrength.value).toBe(2.123456789 / 4);
  expect(result.score.aggregate).toBeNull();
  for (const kind of ["old", "overflow"]) {
    const g = await jevFixture(kind !== "old");
    const transport = vi.fn(async () => response());
    vi.stubGlobal("fetch", transport);
    if (kind === "overflow")
      await g.t.run(async (ctx) => {
        const v = (await ctx.db.get(g.request.draftVersionId))!;
        await ctx.db.patch(v._id, {
          content: {
            ...v.content,
            text: ["x".repeat(17000), "retained second"],
          },
        });
      });
    expect((await g.t.action(analyze, g.request)).outcome).toBe("unavailable");
    expect(transport).not.toHaveBeenCalled();
    expect(
      await g.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
    ).toHaveLength(0);
  }
});
test("changed selected profile suppresses semantic and deterministic exposure, but settles receipt", async () => {
  const f = await jevFixture(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await f.signed.mutation(api.intelligence.profiles.change, {
        workspaceId: f.workspaceId,
        accountId: f.request.accountId,
        expectedRevision: 1,
        commandKey: "synthetic-change-selection",
        action: {
          kind: "select",
          algorithmId: null,
          audienceId: null,
          reason: "Explicit withdrawal",
        },
      });
      return response();
    }),
  );
  const r = await f.t.action(analyze, f.request);
  expect(r).toMatchObject({
    outcome: "unavailable",
    answers: null,
    score: null,
    deterministic: null,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").first()),
  ).toMatchObject({ state: "settled", estimatedMicros: 20 });
});
test("new profile candidates retain old API meaning and require explicit review/select with exact dedup", async () => {
  const f = await jevFixture(false);
  const input = {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    expectedRevision: 1,
    commandKey: "explicit-new-candidate",
    variant: "post-analysis" as const,
  };
  const first = await f.signed.mutation(
    api.intelligence.algorithmProfiles.create,
    input,
  );
  expect(
    await f.signed.mutation(api.intelligence.algorithmProfiles.create, input),
  ).toEqual(first);
  const alg = await f.t.run(async (ctx) => {
    const id = first.algorithmId!;
    await ctx.db.patch(id, {
      payload: {
        ...(await ctx.db.get(id))!.payload,
        reviewDueAt: Date.now() + 86400000,
      },
    });
    return ctx.db.get(id);
  });
  expect(alg).toMatchObject({
    status: "draft",
    payload: {
      version: "x-post-analysis-v1",
      refs: {
        questionSet: "jev-post-analysis-v1",
        normalization: "jev-normalization-v1",
      },
    },
  });
  const row = await f.signed.query(api.intelligence.profiles.get, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
  });
  expect(row.capture.algorithmId).toBe(f.request.algorithmId);
  await expect(
    f.signed.mutation(api.intelligence.profiles.change, {
      workspaceId: f.workspaceId,
      accountId: f.request.accountId,
      commandKey: "unreviewed-select",
      expectedRevision: 2,
      action: {
        kind: "select",
        algorithmId: first.algorithmId,
        audienceId: f.request.audienceId,
        reason: "must review",
      },
    }),
  ).rejects.toThrow("REVIEW_REQUIRED");
  await f.signed.mutation(api.intelligence.profiles.change, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    commandKey: "review-new-rubric",
    expectedRevision: 2,
    action: {
      kind: "review-algorithm",
      algorithmId: first.algorithmId!,
      reason: "Explicit rubric review",
    },
  });
  await f.signed.mutation(api.intelligence.profiles.change, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    commandKey: "select-new-rubric",
    expectedRevision: 3,
    action: {
      kind: "select",
      algorithmId: first.algorithmId!,
      audienceId: f.request.audienceId,
      reason: "Explicit selection",
    },
  });
  const captured = await f.t.query(internal.ai.jev.access.context, {
    ...f.request,
    algorithmId: first.algorithmId!,
    selectionRevision: 4,
  });
  expect(captured.questionVersion).toBe("jev-post-analysis-v1");
});
