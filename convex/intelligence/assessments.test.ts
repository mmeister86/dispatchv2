import type { Id } from "../_generated/dataModel";
import { fixture as researchFixture } from "../../tests/research-fixture";
import { api, internal } from "../_generated/api";
import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { jevFixture } from "../../tests/jev-fixture";
import { POST_ANALYSIS } from "../ai/jev/questions/postAnalysis";
import { dispatchScore } from "../ai/scoring/dispatchScore";
import { preflight } from "../publishing";
const analyze = makeFunctionReference<"action">(
  "intelligence/assessments:analyze",
);
const prepare = makeFunctionReference<"mutation">(
  "intelligence/assessments:prepare",
);
const finish = makeFunctionReference<"mutation">(
  "intelligence/assessments:finish",
);
const get = makeFunctionReference<"query">("intelligence/assessments:get");
const history = makeFunctionReference<"query">(
  "intelligence/assessments:history",
);
const run = makeFunctionReference<"action">("ai/jev/analyzePost:analyze");
const sweep = makeFunctionReference<"mutation">(
  "intelligence/assessments:sweep",
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function response() {
  return new Response(
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
                  probabilities: { 0: 0.2, 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.2 },
                  legend: Object.fromEntries(
                    q.criteria.map((s, i) => [String(i), s]),
                  ),
                }
              : { type: "noul", noul: 0.2 },
        ]),
      ),
    }),
  );
}
function target(f: Awaited<ReturnType<typeof jevFixture>>) {
  const { workspaceId, accountId, draftId, draftVersionId } = f.request;
  return { workspaceId, accountId, draftId, draftVersionId };
}
test("analyzed scheduled A remains historical A after manual B save; B inherits no approval or assessment", async () => {
  const f = await jevFixture(true);
  await f.t.run(async (ctx) => {
    const account = (await ctx.db.get(f.request.accountId))!;
    await ctx.db.patch(account._id, {
      capability: { ...account.capability, publish: true },
    });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  await f.signed.action(analyze, {
    ...target(f),
    operationKey: "analysis-before-move",
  });
  const old = (await f.signed.query(get, target(f))).assessment;
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId: f.request.draftVersionId,
    accountId: f.request.accountId,
  });
  const at = Math.ceil((Date.now() + 3600000) / 60000) * 60000;
  const scheduleId = await f.signed.mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    versionId: f.request.draftVersionId,
    accountId: f.request.accountId,
    approvalId,
    at,
    timezone: "UTC",
    localTime: new Date(at).toISOString().slice(0, 16),
  });
  const accountId = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...account } = (await ctx.db.get(
      f.request.accountId,
    ))!;
    return ctx.db.insert("socialAccounts", {
      ...account,
      providerIdentity: "second",
      handle: "@second",
    });
  });
  const before = (await f.t.run((ctx) =>
    ctx.db.get(f.request.draftVersionId),
  ))!;
  const draftVersionId = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: f.request.draftId,
    expectedRevision: 1,
    content: { ...before.content, accountId, text: ["New B text"] },
    reason: "Move",
  });
  const current = await f.signed.query(get, {
    ...target(f),
    accountId,
    draftVersionId,
  });
  expect(current.assessment).toBeNull();
  expect(current.applicable).toBe(false);
  expect(await f.t.run((ctx) => ctx.db.get(old._id))).toEqual(old);
  expect(
    await f.t.run(
      async (ctx) =>
        (await preflight(ctx, (await ctx.db.get(scheduleId))!))._id,
    ),
  ).toBe(before._id);
  await expect(
    f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId: draftVersionId,
      accountId: f.request.accountId,
    }),
  ).rejects.toThrow("APPROVAL_ACCOUNT_MISMATCH");
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("approvals")
        .withIndex("by_versionId_and_accountId", (q) =>
          q.eq("versionId", draftVersionId).eq("accountId", accountId),
        )
        .take(1),
    ),
  ).toEqual([]);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
test("TASK29 current assessment exposes genuine bounded recommendations without changing saved text", async () => {
  const f = await jevFixture(true);
  const original = [
    "Exact paragraph\n\nExact paragraph",
    "A second unchanged segment",
  ];
  await f.t.run(async (ctx) => {
    const v = (await ctx.db.get(f.request.draftVersionId))!;
    await ctx.db.patch(v._id, { content: { ...v.content, text: original } });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  await f.signed.action(analyze, {
    ...target(f),
    operationKey: "task29-analysis-red",
  });
  const row = await f.signed.query(get, target(f));
  expect(row.recommendations?.candidates).toEqual([
    expect.objectContaining({ kind: "duplicate", segment: 0 }),
  ]);
  expect(
    await f.t.run(
      async (ctx) => (await ctx.db.get(f.request.draftVersionId))!.content.text,
    ),
  ).toEqual(original);
});
test("authorized exact-version cache is stable across operation/actor/selection revision and stores no text; normalized math reproduces", async () => {
  const f = await jevFixture(true);
  const transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  expect(
    await f.signed.action(analyze, {
      ...target(f),
      operationKey: "first-analysis-key",
    }),
  ).toEqual({ outcome: "success", cached: false });
  const row = await f.signed.query(get, target(f));
  expect(row.applicable).toBe(true);
  expect(row.assessment.result.score.aggregate).toBe(
    dispatchScore(
      row.assessment.result.answers,
      row.assessment.result.deterministic.structure,
    ).aggregate,
  );
  expect(JSON.stringify(row.assessment)).not.toContain(
    "Synthetic first segment",
  );
  expect(row.assessment.result.deterministic.segments[0]).not.toHaveProperty(
    "text",
  );
  await f.t.run(async (ctx) => {
    const s = await ctx.db.query("intelligenceSelections").first();
    await ctx.db.patch(s!._id, { revision: 2 });
  });
  expect(
    await f.signed.action(analyze, {
      ...target(f),
      operationKey: "second-analysis-key",
    }),
  ).toEqual({ outcome: "success", cached: true });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(
    (
      await f.signed.query(history, {
        workspaceId: f.workspaceId,
        accountId: f.request.accountId,
        draftId: f.request.draftId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page,
  ).toHaveLength(1);
});
test("cache cannot bypass disabled configuration, withdrawn grants, role or source; retained history is separate", async () => {
  for (const kind of ["disabled", "grant", "role", "source"]) {
    const f = await jevFixture(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    await f.signed.action(analyze, {
      ...target(f),
      operationKey: "first-analysis-key",
    });
    await f.t.run(async (ctx) => {
      if (kind === "disabled") {
        const c = await ctx.db.query("jevControls").first();
        await ctx.db.patch(c!._id, { enabled: false });
      } else if (kind === "grant") {
        const b = await ctx.db.query("aiBudgets").first();
        await ctx.db.patch(b!._id, { expiresAt: 0 });
      } else if (kind === "role") {
        const m = await ctx.db.query("memberships").first();
        await ctx.db.patch(m!._id, { role: "Viewer" });
      } else
        await ctx.db.patch(f.request.draftVersionId, {
          sourceUnavailable: true,
        });
    });
    await expect(
      f.signed.action(analyze, {
        ...target(f),
        operationKey: "second-analysis-key",
      }),
    ).rejects.toThrow();
    const row = await f.signed.query(get, target(f));
    expect(row.applicable).toBe(false);
    expect(!!row.assessment).toBe(kind !== "source");
  }
});
test("semantic meaning changes miss: objective, audience, account capability, profile and exact saved version", async () => {
  for (const kind of ["objective", "audience", "capability", "version"]) {
    const f = await jevFixture(true);
    const transport = vi.fn(async () => response());
    vi.stubGlobal("fetch", transport);
    await f.signed.action(analyze, {
      ...target(f),
      operationKey: "first-analysis-key",
    });
    let draftVersionId = f.request.draftVersionId;
    await f.t.run(async (ctx) => {
      const ver = (await ctx.db.get(draftVersionId))!;
      if (kind === "objective")
        await ctx.db.patch(ver._id, {
          content: { ...ver.content, strategy: "specific objective" },
        });
      else if (kind === "audience") {
        const aud = (await ctx.db.get(f.request.audienceId))!;
        await ctx.db.patch(aud._id, {
          payload: { ...aud.payload, description: "changed audience" },
        });
      } else if (kind === "capability") {
        const acc = (await ctx.db.get(f.request.accountId))!;
        await ctx.db.patch(acc._id, {
          capability: { ...acc.capability, maxText: 10 },
        });
      } else {
        const { _id, _creationTime, ...fields } = ver;
        draftVersionId = await ctx.db.insert("draftVersions", {
          ...fields,
          number: 2,
        });
        await ctx.db.patch(f.request.draftId, {
          currentVersionId: draftVersionId,
          revision: 2,
        });
      }
    });
    expect(
      (
        await f.signed.action(analyze, {
          ...target(f),
          draftVersionId,
          operationKey: "second-analysis-key",
        })
      ).cached,
    ).toBe(false);
    expect(transport).toHaveBeenCalledTimes(2);
  }
});
test("atomic fence refuses old result after a newer request or missing parent, retaining legitimate costs", async () => {
  for (const kind of [
    "new-request",
    "draft",
    "account",
    "workspace",
    "version",
  ]) {
    const f = await jevFixture(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    const captured = await f.signed.mutation(prepare, {
      ...target(f),
      operationKey: "older-analysis-key",
    });
    const result = await f.t.action(run, captured.request);
    if (kind === "new-request")
      await f.signed.mutation(prepare, {
        ...target(f),
        operationKey: "newer-analysis-key",
      });
    else
      await f.t.run((ctx) =>
        ctx.db.delete(
          kind === "draft"
            ? f.request.draftId
            : kind === "account"
              ? f.request.accountId
              : kind === "workspace"
                ? f.workspaceId
                : f.request.draftVersionId,
        ),
      );
    expect(
      await f.t.mutation(finish, { request: captured.request, result }),
    ).toBeNull();
    expect(
      await f.t.run((ctx) => ctx.db.query("jevAssessments").collect()),
    ).toHaveLength(0);
    expect(
      await f.t.run((ctx) => ctx.db.query("aiAttempts").first()),
    ).toMatchObject({ state: "settled", estimatedMicros: 20 });
  }
});
test("tenant/account/exact-version read and cache negatives; protected purge preserves financial receipts", async () => {
  const f = await jevFixture(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  await f.signed.action(analyze, {
    ...target(f),
    operationKey: "first-analysis-key",
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.request.draftVersionId, { sourceUnavailable: true });
    const row = await ctx.db.query("jevAssessments").first();
    await ctx.db.patch(row!._id, { sourceUntil: Date.now() + 10000 });
  });
  expect((await f.signed.query(get, target(f))).assessment).toBeNull();
  await f.t.mutation(sweep, { cursor: null });
  expect(
    await f.t.run((ctx) => ctx.db.query("jevAssessments").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
});
test("immutable operation replay cannot renew deadline or reclaim a newer fence", async () => {
  const f = await jevFixture(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  const a = { ...target(f), operationKey: "first-analysis-key" };
  const first = await f.signed.mutation(prepare, a);
  const replay = await f.signed.mutation(prepare, a);
  expect(replay.request).toEqual(first.request);
  await f.signed.mutation(prepare, {
    ...target(f),
    operationKey: "newer-analysis-key",
  });
  await expect(f.signed.mutation(prepare, a)).rejects.toThrow(
    "JEV_REQUEST_SUPERSEDED",
  );
});

async function protectedFixture() {
  const r = await researchFixture(["x-recent"]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        data: [
          {
            id: "123456789",
            text: "Protected exact quote",
            created_at: new Date(Date.now() - 1000).toISOString(),
          },
        ],
      }),
    ),
  );
  const orderId = await r.start();
  await r.t.action(internal.research.execute.execute, {
    orderId,
    generation: 1,
  });
  const material = (
    await r.signed.query(api.research.native.results, {
      workspaceId: r.workspaceId,
      orderId,
    })
  )[0].sources[0];
  const evidenceId = await r.signed.mutation(api.research.evidence.create, {
    workspaceId: r.workspaceId,
    orderId,
    sourceId: material.sourceId,
    expectedMaterialHash: material.materialHash,
    commandKey: "protected-evidence",
    annotation: {
      claim: "Protected exact quote",
      quote: "Protected exact quote",
      interpretation: "Protected exact quote",
      gaps: [],
      relevance: "Relevant",
      novelty: "Unknown",
      uncertainty: "Unverified",
      freshness: "context-dependent",
      validityReason: "Bounded",
      consequentialOrContested: false,
      eventBased: false,
    },
  });
  const [handoff] = await r.signed.mutation(api.research.handoff.consume, {
    workspaceId: r.workspaceId,
    accountId: r.accountId,
    evidenceIds: [evidenceId],
    intent: "Prepare protected draft",
    target: "draft",
    requestedCount: 1,
    commandKey: "protected-draft",
  });
  const f = await jevFixture(true, r, r.accountId);
  f.request.draftId = handoff.draftId!;
  f.request.draftVersionId = handoff.draftVersionId!;
  return { ...f, material };
}
test.each(["withdraw", "expire"])(
  "full protected provenance %s hides current/history and physically removes derived assessments/descriptors while preserving manual content and finance",
  async (kind) => {
    vi.useFakeTimers();
    try {
      const f = await protectedFixture();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response()),
      );
      await f.signed.action(analyze, {
        ...target(f),
        operationKey: "protected-analysis-key",
      });
      const row = await f.signed.query(get, target(f));
      expect(row.assessment).not.toBeNull();
      if (kind === "withdraw")
        await f.signed.mutation(api.research.cache.invalidate, {
          workspaceId: f.workspaceId,
          sourceId: f.material.sourceId,
          reason: "blocked",
        });
      else await vi.advanceTimersByTimeAsync(row.sourceUntil! - Date.now() + 1);
      expect((await f.signed.query(get, target(f))).assessment).toBeNull();
      expect(
        (
          await f.signed.query(history, {
            workspaceId: f.workspaceId,
            accountId: f.request.accountId,
            draftId: f.request.draftId,
            paginationOpts: { cursor: null, numItems: 10 },
          })
        ).page,
      ).toEqual([]);
      await expect(
        f.signed.action(analyze, {
          ...target(f),
          operationKey: "withdrawn-analysis-key",
        }),
      ).rejects.toThrow();
      await f.t.mutation(sweep, { cursor: null });
      await f.t.mutation(
        makeFunctionReference<"mutation">(
          "intelligence/assessments:sweepRequests",
        ),
        { cursor: null },
      );
      expect(
        await f.t.run((ctx) => ctx.db.query("jevAssessments").collect()),
      ).toHaveLength(0);
      expect(
        await f.t.run((ctx) => ctx.db.query("jevAssessmentRequests").collect()),
      ).toHaveLength(0);
      expect(
        await f.t.run((ctx) =>
          ctx.db
            .query("aiAttempts")
            .withIndex("by_jev_operation", (q) => q.eq("owner", "jev-analyzer"))
            .first(),
        ),
      ).toMatchObject({ state: "settled", estimatedMicros: 20 });
      const manual = await f.t.run((ctx) =>
        ctx.db.query("draftVersions").collect(),
      );
      expect(
        manual.some((v) => v.content.text.includes("Synthetic first segment")),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  },
);
test("withdrawal during actual model transport rejects output persistence while once-only usage settles", async () => {
  const f = await protectedFixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await f.signed.mutation(api.research.cache.invalidate, {
        workspaceId: f.workspaceId,
        sourceId: f.material.sourceId,
        reason: "blocked",
      });
      return response();
    }),
  );
  expect(
    (
      await f.signed.action(analyze, {
        ...target(f),
        operationKey: "protected-analysis-key",
      })
    ).outcome,
  ).toBe("unavailable");
  expect(
    await f.t.run((ctx) => ctx.db.query("jevAssessments").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("aiAttempts")
        .withIndex("by_jev_operation", (q) => q.eq("owner", "jev-analyzer"))
        .first(),
    ),
  ).toMatchObject({ state: "settled", estimatedMicros: 20 });
});
test("real tenant, wrong account and mixed exact-version bindings cannot read or hit cache", async () => {
  const f = await jevFixture(true),
    transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  await f.signed.action(analyze, {
    ...target(f),
    operationKey: "first-analysis-key",
  });
  const other = await f.t.run(async (ctx) => {
    const ws = await ctx.db.insert("workspaces", {
      name: "Other tenant",
      description: "",
    });
    const acc = (await ctx.db.get(f.request.accountId))!;
    const { _id, _creationTime, ...fields } = acc;
    const accountId = await ctx.db.insert("socialAccounts", {
      ...fields,
      workspaceId: ws,
    });
    const draftId = await ctx.db.insert("drafts", {
      workspaceId: f.workspaceId,
      currentVersionId: null,
      authorId: f.userId,
      source: "manual",
      revision: 1,
      updatedAt: Date.now(),
    });
    return { ws, accountId, draftId };
  });
  await expect(
    f.signed.query(get, { ...target(f), workspaceId: other.ws }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  for (const a of [
    { ...target(f), accountId: other.accountId },
    { ...target(f), draftId: other.draftId },
  ]) {
    expect((await f.signed.query(get, a)).assessment).toBeNull();
    await expect(
      f.signed.action(analyze, { ...a, operationKey: "negative-analysis-key" }),
    ).rejects.toThrow();
  }
  expect(transport).toHaveBeenCalledTimes(1);
});
test("same completed key replays only its immutable intent; selected profile change retains old normalized math", async () => {
  const f = await jevFixture(true),
    transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  const a = { ...target(f), operationKey: "first-analysis-key" };
  await f.signed.action(analyze, a);
  expect((await f.signed.action(analyze, a)).cached).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
  const old = (await f.signed.query(get, target(f))).assessment;
  const algorithmId = await f.t.run(async (ctx) => {
    const original = (await ctx.db.get(f.request.algorithmId))!;
    const { _id, _creationTime, ...fields } = original;
    return ctx.db.insert("algorithmProfiles", fields);
  });
  await f.signed.mutation(api.intelligence.profiles.change, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    expectedRevision: 1,
    commandKey: "select-new-profile",
    action: {
      kind: "select",
      algorithmId,
      audienceId: f.request.audienceId,
      reason: "Explicit profile change",
    },
  });
  await expect(f.signed.action(analyze, a)).rejects.toThrow(
    "JEV_REQUEST_CONFLICT",
  );
  expect((await f.signed.query(get, target(f))).applicable).toBe(false);
  await f.signed.action(analyze, {
    ...target(f),
    operationKey: "new-profile-analysis-key",
  });
  const retained = await f.t.run((ctx) =>
    ctx.db.get(old!._id as Id<"jevAssessments">),
  );
  expect(retained!.result).toEqual(old!.result);
  expect(transport).toHaveBeenCalledTimes(2);
});
test("missing usage retains its financial hold and no cache; retry or changed meaning never silently repeats that liability", async () => {
  const f = await jevFixture(true),
    transport = vi.fn(async () => {
      const raw = await response().json();
      delete raw.usage;
      return Response.json(raw);
    });
  vi.stubGlobal("fetch", transport);
  await f.signed.action(analyze, {
    ...target(f),
    operationKey: "unknown-usage-analysis",
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").first()),
  ).toMatchObject({
    state: "unknown",
    heldMicros: 16000,
    estimatedMicros: null,
  });
  expect(
    (
      await f.signed.action(analyze, {
        ...target(f),
        operationKey: "reuse-output-key",
      })
    ).cached,
  ).toBe(false);
  expect(
    await f.t.run((ctx) => ctx.db.query("jevAssessments").collect()),
  ).toHaveLength(0);
  await f.t.run(async (ctx) => {
    const ver = (await ctx.db.get(f.request.draftVersionId))!;
    await ctx.db.patch(ver._id, {
      content: { ...ver.content, strategy: "new objective" },
    });
  });
  expect(
    (
      await f.signed.action(analyze, {
        ...target(f),
        operationKey: "changed-meaning-key",
      })
    ).outcome,
  ).toBe("provider_error");
  expect(transport).toHaveBeenCalledTimes(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
});
test("history projects the freshly shortened full-proof horizon instead of stored stale retention metadata", async () => {
  const f = await protectedFixture();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  await f.signed.action(analyze, {
    ...target(f),
    operationKey: "protected-analysis-key",
  });
  const shorter = Date.now() + 10000;
  await f.t.run((ctx) =>
    ctx.db.patch(f.request.draftVersionId, { researchProofUntil: shorter }),
  );
  const projected = await f.signed.query(history, {
    workspaceId: f.workspaceId,
    accountId: f.request.accountId,
    draftId: f.request.draftId,
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(projected.page[0].sourceUntil).toBe(shorter);
});
test("semantic identity excludes a different currently authorized editable actor but retains current authority", async () => {
  const f = await jevFixture(true);
  const actorId = await f.t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {
      authId: "synthetic-other-editor",
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    });
    await ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId: user,
      role: "Editor",
    });
    return user;
  });
  const original = await f.t.query(internal.ai.jev.access.context, f.request),
    other = await f.t.query(internal.ai.jev.access.context, {
      ...f.request,
      actorId,
      operationKey: "other-editor-key",
    });
  expect(other.semanticKey).toBe(original.semanticKey);
  expect(other.requestFingerprint).not.toBe(original.requestFingerprint);
  await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", actorId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(membership!._id, { role: "Viewer" });
  });
  await expect(
    f.t.query(internal.ai.jev.access.context, { ...f.request, actorId }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
});

test("bounded descriptor sweep removes a missing workspace parent without deleting retained financial evidence", async () => {
  const f = await jevFixture(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  await f.signed.action(analyze, {
    ...target(f),
    operationKey: "first-analysis-key",
  });
  await f.t.run((ctx) => ctx.db.delete(f.workspaceId));
  await f.t.mutation(
    makeFunctionReference<"mutation">("intelligence/assessments:sweepRequests"),
    { cursor: null },
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("jevAssessmentRequests").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("aiAttempts").collect()),
  ).toHaveLength(1);
});

test("TASK29 minimum processing input uses 20 non-whitespace Unicode codepoints over whole thread and never calls provider below threshold", async () => {
  const f = await jevFixture(true);
  const transport = vi.fn(async () => response());
  vi.stubGlobal("fetch", transport);
  await f.t.run(async (ctx) => {
    const v = (await ctx.db.get(f.request.draftVersionId))!;
    await ctx.db.patch(v._id, {
      content: {
        ...v.content,
        text: ["😀".repeat(9), " \n " + "a".repeat(10)],
      },
    });
  });
  await expect(
    f.signed.action(analyze, {
      ...target(f),
      operationKey: "minimum-below-boundary",
    }),
  ).rejects.toThrow(/JEV_INPUT_LIMIT/);
  expect(transport).not.toHaveBeenCalled();
  await f.t.run(async (ctx) => {
    const v = (await ctx.db.get(f.request.draftVersionId))!;
    await ctx.db.patch(v._id, {
      content: { ...v.content, text: ["😀".repeat(10), "a".repeat(10)] },
    });
  });
  expect(
    await f.signed.action(analyze, {
      ...target(f),
      operationKey: "minimum-at-boundary",
    }),
  ).toEqual({ outcome: "success", cached: false });
  expect(transport).toHaveBeenCalledTimes(1);
});
