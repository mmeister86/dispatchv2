import { makeFunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { jevFixture } from "../../tests/jev-fixture";
import { POST_ANALYSIS } from "../ai/jev/questions/postAnalysis";
import { api } from "../_generated/api";
import { edits, apply } from "./recommendationEdits";
const compare = api.intelligence.recommendations.compare;
const adopt = api.intelligence.recommendations.adopt;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function fixture(
  text = [
    "Exact paragraph\n\nExact paragraph",
    "Body\n\n#one #two #three #four",
  ],
  image = false,
) {
  const f = await jevFixture(true);
  await f.t.run(async (ctx) => {
    const ver = (await ctx.db.get(f.request.draftVersionId))!;
    await ctx.db.patch(ver._id, { content: { ...ver.content, text } });
  });
  if (image) {
    vi.stubEnv("R2_MEDIA_BUCKET", "synthetic-only");
    const upload = await f.ready();
    await f.t.run(async (ctx) => {
      const asset = (await ctx.db.get(upload.assetId))!;
      const ver = (await ctx.db.get(f.request.draftVersionId))!;
      await ctx.db.patch(ver._id, {
        content: { ...ver.content, media: [{ assetId: asset._id, alt: "" }] },
        mediaChecksums: [
          {
            assetId: asset._id,
            checksum: asset.checksum,
            objectKey: asset.objectKey,
          },
        ],
      });
    });
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
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
                        probabilities: {
                          0: 0.2,
                          1: 0.2,
                          2: 0.2,
                          3: 0.2,
                          4: 0.2,
                        },
                        legend: Object.fromEntries(
                          q.criteria.map((s, i) => [String(i), s]),
                        ),
                      }
                    : { type: "noul", noul: 0.2 },
              ]),
            ),
          }),
        ),
    ),
  );
  const { workspaceId, accountId, draftId, draftVersionId } = f.request;
  const target = { workspaceId, accountId, draftId, draftVersionId };
  await f.signed.action(api.intelligence.assessments.analyze, {
    ...target,
    operationKey: "recommendations-fixture-analysis",
  });
  const row = await f.signed.query(api.intelligence.assessments.get, target);
  const proposals = row.recommendations!;
  const args = {
    ...target,
    assessmentId: proposals.assessmentId,
    revision: proposals.revision,
    proof: proposals.proof,
    ruleVersion: proposals.ruleVersion,
    candidateIndex: 0,
    tokenIndices: [],
    alt: "",
    operationKey: "recommendations-adoption-one",
  };
  return { ...f, target, proposals, args };
}
test("full ordered compare changes only the exact second adjacent paragraph; adoption creates unapproved version, leaves existing plan and invalidates siblings; exact uncertain retry is immutable", async () => {
  const f = await fixture();
  expect(f.proposals.candidates.map((c) => c.kind)).toEqual([
    "duplicate",
    "tokens",
  ]);
  const { operationKey: _key, ...review } = f.args;
  const diff = await f.signed.query(compare, review);
  if (!diff) throw new Error("Expected current full comparison");
  expect(diff.before.text).toEqual([
    "Exact paragraph\n\nExact paragraph",
    "Body\n\n#one #two #three #four",
  ]);
  expect(diff.after.text).toEqual([
    "Exact paragraph",
    "Body\n\n#one #two #three #four",
  ]);
  const scheduled = await f.t.run(async (ctx) => {
    const approvalId = await ctx.db.insert("approvals", {
      workspaceId: f.workspaceId,
      draftId: f.request.draftId,
      versionId: f.request.draftVersionId,
      accountId: f.request.accountId,
      actorId: f.userId,
      createdAt: Date.now(),
      revokedAt: null,
      revokedBy: null,
    });
    const scheduleId = await ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      draftId: f.request.draftId,
      versionId: f.request.draftVersionId,
      accountId: f.request.accountId,
      approvalId,
      at: Date.now() + 86400000,
      timezone: "Europe/Berlin",
      state: "scheduled",
      generation: 1,
      actorId: f.userId,
      localTime: "synthetic",
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    });
    return {
      approval: await ctx.db.get(approvalId),
      schedule: await ctx.db.get(scheduleId),
    };
  });
  const ack = await f.signed.mutation(adopt, f.args);
  expect(ack.revision).toBe(2);
  expect(ack.versionId).not.toBe(f.request.draftVersionId);
  expect(await f.signed.mutation(adopt, f.args)).toEqual(ack);
  await expect(
    f.signed.mutation(adopt, { ...f.args, candidateIndex: 1 }),
  ).rejects.toThrow(/OPERATION_CONFLICT/);
  await expect(
    f.signed.mutation(adopt, {
      ...f.args,
      candidateIndex: 1,
      tokenIndices: [3],
      operationKey: "sibling-adoption-should-fail",
    }),
  ).rejects.toThrow();
  await f.t.run(async (ctx) => {
    expect((await ctx.db.get(ack.versionId))!.content).toEqual(diff.after);
    expect(await ctx.db.get(scheduled.approval!._id)).toEqual(
      scheduled.approval,
    );
    expect(await ctx.db.get(scheduled.schedule!._id)).toEqual(
      scheduled.schedule,
    );
    expect(
      await ctx.db
        .query("approvals")
        .withIndex("by_versionId_and_accountId", (q) =>
          q.eq("versionId", ack.versionId).eq("accountId", f.request.accountId),
        )
        .collect(),
    ).toHaveLength(0);
    expect(
      await ctx.db
        .query("draftVersions")
        .withIndex("by_draftId_and_number", (q) =>
          q.eq("draftId", f.request.draftId),
        )
        .collect(),
    ).toHaveLength(2);
    const receipts = await ctx.db.query("recommendationReceipts").collect();
    expect(receipts).toHaveLength(1);
    expect(JSON.stringify(receipts)).not.toMatch(
      /Exact paragraph|#one|tokenIndices|assessmentId|alt/,
    );
  });
  expect(
    (await f.signed.query(api.intelligence.assessments.get, f.target))
      .recommendations,
  ).toBeNull();
  await f.signed.action(api.intelligence.assessments.analyze, {
    ...f.target,
    draftVersionId: ack.versionId,
    operationKey: "fresh-analysis-after-adoption",
  });
  const next = await f.signed.query(api.intelligence.assessments.get, {
    ...f.target,
    draftVersionId: ack.versionId,
  });
  expect(next.recommendations!.candidates[0].kind).toBe("tokens");
  const second = await f.signed.mutation(adopt, {
    ...f.args,
    draftVersionId: ack.versionId,
    assessmentId: next.recommendations!.assessmentId,
    revision: 2,
    proof: next.recommendations!.proof,
    candidateIndex: 0,
    tokenIndices: [3],
    operationKey: "fresh-second-adoption",
  });
  expect(second.revision).toBe(3);
});
test.each([
  "profile",
  "selection",
  "policy",
  "version",
  "source",
  "role",
  "capability",
  "assessment",
  "workspace",
  "account",
])(
  "server rejects stale/foreign %s proof in the actual adoption transaction",
  async (kind) => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      if (kind === "profile")
        await ctx.db.patch(f.request.audienceId, {
          payload: {
            version: "declared-audience-v1",
            description: "changed",
            source: "authorized_declaration",
            measurement: "unavailable",
            embedding: "unavailable",
          },
        });
      if (kind === "selection") {
        const s = (await ctx.db.query("intelligenceSelections").first())!;
        await ctx.db.patch(s._id, { revision: 2 });
      }
      if (kind === "policy") {
        const p = (await ctx.db.query("jevPolicies").first())!;
        await ctx.db.patch(p._id, { inputMicrosPerMillion: 2000000 });
      }
      if (kind === "version")
        await ctx.db.patch(f.request.draftId, { revision: 2 });
      if (kind === "source")
        await ctx.db.patch(f.request.draftVersionId, {
          sourceUnavailable: true,
        });
      if (kind === "role") {
        const m = (await ctx.db.query("memberships").first())!;
        await ctx.db.patch(m._id, { role: "Viewer" });
      }
      if (kind === "capability") {
        const a = (await ctx.db.get(f.request.accountId))!;
        await ctx.db.patch(a._id, {
          capability: { ...a.capability, maxThread: 1 },
        });
      }
      if (kind === "assessment")
        await ctx.db.patch(f.proposals.assessmentId, {
          semanticKey: "foreign",
        });
      if (kind === "workspace")
        await ctx.db.patch(f.request.draftVersionId, {
          workspaceId: await ctx.db.insert("workspaces", {
            name: "foreign",
            description: "synthetic",
          }),
        });
      if (kind === "account") {
        const ver = (await ctx.db.get(f.request.draftVersionId))!;
        await ctx.db.patch(ver._id, {
          content: { ...ver.content, accountId: null },
        });
      }
    });
    await expect(f.signed.mutation(adopt, f.args)).rejects.toThrow();
    await f.t.run(async (ctx) => {
      expect(
        await ctx.db.query("recommendationReceipts").collect(),
      ).toHaveLength(0);
    });
  },
);
test.each([
  { candidateIndex: -1 },
  { candidateIndex: 4 },
  { tokenIndices: [0] },
  { alt: "fabricated" },
  { candidateIndex: 1, tokenIndices: [-1] },
  { candidateIndex: 1, tokenIndices: [3, 3] },
  { candidateIndex: 1, tokenIndices: [50] },
  { candidateIndex: 1, tokenIndices: [] },
])(
  "only derived edit and explicit bounded choices %j accepted",
  async (patch) => {
    const f = await fixture();
    await expect(
      f.signed.mutation(adopt, { ...f.args, ...patch }),
    ).rejects.toThrow(/INPUT_INVALID/);
  },
);
test("native UTF16 ranges remove only explicit trailing token; inline/code/quoted/attribution/list/URL blocks never become candidates; broad normalized duplicates are not permissions", () => {
  const c = {
    title: "test",
    accountId: null,
    pillar: "",
    strategy: "",
    media: [],
    text: ["😀 Body\n\n#one #two #three #four @alice"],
  };
  const item = edits(c, [])[0];
  expect(item.kind).toBe("tokens");
  expect(apply(c, item, { tokenIndices: [3], alt: "" }).text).toEqual([
    "😀 Body\n\n#one #two #three  @alice",
  ]);
  for (const text of [
    "Inline #one #two #three #four",
    "Body\n#one #two #three #four",
    "```\nBody\n\n#one #two #three #four",
    "> quoted body\n\n#one #two #three #four",
    "Attribution:\n\n@alice @bob @carol @dave",
    "Body\n\n- #one #two #three #four",
    "Body\n\nhttps://example.test/#one #two #three #four",
    "Body\n\n@alice/list #one #two #three #four",
    '"quoted\n\n#one #two #three #four',
  ])
    expect(edits({ ...c, text: [text] }, [])).toEqual([]);
  for (const text of [
    "Same\n\nsame",
    "Same\n\nOther\n\nSame",
    "Ｓame\n\nSame",
    "Same \n\nSame",
  ])
    expect(edits({ ...c, text: [text] }, [])).toEqual([]);
  expect(
    edits({ ...c, text: ["A\n\nA", "B\n\nB", "C\n\nC", "D\n\nD"] }, []),
  ).toHaveLength(3);
});
test("legacy alt recovery only for one actual image missing alt; normal posts and multiple missing refs expose no invented alt", () => {
  const c = {
    title: "test",
    accountId: null,
    pillar: "",
    strategy: "",
    text: ["body"],
    media: [{ assetId: "image" as never, alt: "" }],
  };
  expect(edits(c, [0])).toEqual([{ kind: "alt", mediaIndex: 0 }]);
  expect(edits(c, [])).toEqual([]);
  expect(
    edits(
      { ...c, media: [...c.media, { assetId: "other" as never, alt: "" }] },
      [0, 1],
    ),
  ).toEqual([]);
  expect(
    edits({ ...c, media: [{ ...c.media[0], alt: "human description" }] }, [0]),
  ).toEqual([]);
  expect(
    apply(
      c,
      { kind: "alt", mediaIndex: 0 },
      { alt: "human exact alt", tokenIndices: [] },
    ).media[0].alt,
  ).toBe("human exact alt");
});

test("actual legacy missing image alt needs human input, preserves asset/snapshot and adopts only its own alt", async () => {
  const f = await fixture(undefined, true);
  expect(f.proposals.candidates).toEqual([{ kind: "alt", mediaIndex: 0 }]);
  await expect(f.signed.mutation(adopt, f.args)).rejects.toThrow(
    /INPUT_INVALID/,
  );
  const { operationKey: _key, ...review } = {
    ...f.args,
    alt: "Human-entered image description",
  };
  const diff = await f.signed.query(compare, review);
  if (!diff) throw new Error("Expected legacy image comparison");
  expect(diff.after.text).toEqual(diff.before.text);
  expect(diff.after.media[0]).toEqual({
    ...diff.before.media[0],
    alt: "Human-entered image description",
  });
  const ack = await f.signed.mutation(adopt, {
    ...review,
    operationKey: f.args.operationKey,
  });
  await f.t.run(async (ctx) => {
    const before = (await ctx.db.get(f.request.draftVersionId))!,
      saved = (await ctx.db.get(ack.versionId))!;
    expect(saved.mediaChecksums).toEqual(before.mediaChecksums);
    expect(saved.content).toEqual(diff.after);
  });
});
test("adoption and assessment purge preserve unknown financial holds and permanent dedup; explicitly unavailable source-free base fixture denies replay", async () => {
  const f = await fixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 429 })),
  );
  await f.t.action(makeFunctionReference<"action">("ai/jev/client:execute"), {
    ...f.request,
    operationKey: "independent-failed-attempt",
    deadline: Date.now() + 2500,
  });
  const finance = await f.t.run(async (ctx) => ({
    attempts: await ctx.db.query("aiAttempts").collect(),
    budgets: await ctx.db.query("aiBudgets").collect(),
  }));
  expect(finance.attempts.some((a) => a.state === "unknown")).toBe(true);
  const ack = await f.signed.mutation(adopt, f.args);
  await f.t.run(async (ctx) => {
    expect(await ctx.db.query("aiAttempts").collect()).toEqual(
      finance.attempts,
    );
    expect(await ctx.db.query("aiBudgets").collect()).toEqual(finance.budgets);
    // Explicit unavailable flag on a source-free fixture; this does not simulate native Research/GitHub withdrawal.
    await ctx.db.patch(f.request.draftVersionId, { sourceUnavailable: true });
  });
  await f.t.mutation(
    makeFunctionReference<"mutation">("intelligence/assessments:purgeVersion"),
    { versionId: f.request.draftVersionId },
  );
  await expect(f.signed.mutation(adopt, f.args)).rejects.toThrow();
  await f.t.run(async (ctx) => {
    expect(await ctx.db.query("jevAssessments").collect()).toHaveLength(0);
    expect(await ctx.db.query("recommendationReceipts").collect()).toHaveLength(
      1,
    );
    expect(await ctx.db.query("aiAttempts").collect()).toEqual(
      finance.attempts,
    );
    expect(await ctx.db.query("aiBudgets").collect()).toEqual(finance.budgets);
    expect((await ctx.db.get(ack.versionId))!.number).toBe(2);
  });
});
