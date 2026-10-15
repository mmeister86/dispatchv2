import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture } from "../../tests/research-fixture";
import { api, internal, components } from "../_generated/api";
import { ConvexError } from "convex/values";
import { currentEvidence, projectEvidence } from "./evidence";
import { projectIdea, projectDraft } from "./contentProof";
const secret = "Distinctive protected research quote 231";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function setup() {
  const f = await fixture(["x-recent"]);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: [
        {
          id: "123456789",
          text: secret,
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ],
    }),
  );
  const orderId = await f.start();
  await f.t.action(internal.research.execute.execute, {
    orderId,
    generation: 1,
  });
  const source = (
    await f.signed.query(api.research.native.results, {
      workspaceId: f.workspaceId,
      orderId,
    })
  )[0].sources[0];
  const evidenceId = await f.signed.mutation(api.research.evidence.create, {
    workspaceId: f.workspaceId,
    orderId,
    sourceId: source.sourceId,
    expectedMaterialHash: source.materialHash,
    commandKey: "copy-evidence",
    annotation: {
      claim: secret,
      quote: secret,
      interpretation: secret,
      gaps: [secret],
      relevance: "Relevant",
      novelty: "Unknown",
      uncertainty: "Unverified",
      freshness: "context-dependent",
      validityReason: "Bounded",
      consequentialOrContested: false,
      eventBased: false,
    },
  });
  const args = {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    evidenceIds: [evidenceId],
    intent: "Prepare one unapproved proposal",
    target: "draft" as const,
    requestedCount: 1,
    commandKey: "copy-handoff",
  };
  return { ...f, orderId, source, evidenceId, args };
}
test("explicit bounded replay creates genuine unapproved content once across concurrent retry keys", async () => {
  const f = await setup();
  const [a, b] = await Promise.all([
    f.signed.mutation(api.research.handoff.consume, f.args),
    f.signed.mutation(api.research.handoff.consume, {
      ...f.args,
      commandKey: "different-retry",
    }),
  ]);
  expect(a).toEqual(b);
  expect(a).toHaveLength(1);
  const draft = await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: a[0].draftId!,
  });
  expect(draft!.versions[0].ideaVersionId).toBe(a[0].ideaVersionId);
  expect(draft!.versions[0].content.text).toContain(secret);
  expect(draft!.approvals).toEqual([]);
  expect(draft!.schedules).toEqual([]);
  for (const count of [0, -1, 6])
    await expect(
      f.signed.mutation(api.research.handoff.consume, {
        ...f.args,
        requestedCount: count,
        commandKey: `count-invalid-${count}`,
      }),
    ).rejects.toThrow("INTENT_INVALID");
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  await expect(
    f.signed.mutation(api.research.handoff.consume, {
      ...f.args,
      commandKey: "different-retry",
      intent: "Changed retry intent",
    }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  const changed = await f.signed.mutation(api.research.handoff.consume, {
    ...f.args,
    intent: "Prepare a genuinely different request",
    commandKey: "different-intent",
  });
  expect(changed[0].ideaId).not.toBe(a[0].ideaId);
});

test("research-derived draft cannot move to another account or drop its original proof", async () => {
  const f = await setup();
  const [result] = await f.signed.mutation(
    api.research.handoff.consume,
    f.args,
  );
  const original = (await f.t.run((ctx) =>
    ctx.db.get(result.draftVersionId!),
  ))!;
  const accountId = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...account } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", {
      ...account,
      providerIdentity: "other",
      handle: "@other",
    });
  });
  await expect(
    f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: result.draftId!,
      expectedRevision: 1,
      content: { ...original.content, accountId },
      reason: "Move",
    }),
  ).rejects.toThrow("RESEARCH_CONTENT_ACCOUNT_CHANGED");
  expect(await f.t.run((ctx) => ctx.db.get(result.draftVersionId!))).toEqual(
    original,
  );
  expect(
    (await f.t.run((ctx) => ctx.db.get(result.draftId!)))!.currentVersionId,
  ).toBe(original._id);
});
test.each(["withdraw", "expire", "reviewer", "author"])(
  "%s hides all concrete copied reads and blocks replay/writes; physical erasure keeps technical receipts",
  async (kind) => {
    const f = await setup();
    const reviewed = await f.signed.mutation(api.research.evidence.review, {
      workspaceId: f.workspaceId,
      evidenceId: f.evidenceId,
      commandKey: "copy-review",
      maxAgeMs: 86400000,
      validUntil: Date.now() + 86400000,
      reason: secret,
      substantiveSupportAttested: true,
      eventAt: null,
      eventQuote: null,
    });
    const args = { ...f.args, evidenceIds: [reviewed] };
    const [result] = await f.signed.mutation(
      api.research.handoff.consume,
      args,
    );
    const original = await f.t.run((ctx) => ctx.db.get(result.ideaVersionId));
    expect(original!.source.kind).toBe("research");
    expect(JSON.stringify(original!.source)).not.toContain(secret);
    await f.signed.mutation(api.content.ideas.edit, {
      workspaceId: f.workspaceId,
      ideaId: result.ideaId,
      expectedRevision: 1,
      title: secret,
      perspective: secret,
      note: secret,
      priority: "normal",
      feedback: secret,
    });
    const draft = (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: result.draftId!,
    }))!;
    const saved = await f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: result.draftId!,
      expectedRevision: 1,
      content: { ...draft.versions[0].content, title: secret },
      reason: secret,
    });
    await f.signed.mutation(api.editorial.addComment, {
      workspaceId: f.workspaceId,
      versionId: saved,
      text: secret,
    });
    if (kind === "withdraw")
      await f.signed.mutation(api.research.cache.invalidate, {
        workspaceId: f.workspaceId,
        sourceId: f.source.sourceId,
        reason: "blocked",
      });
    if (kind === "expire")
      await vi.advanceTimersByTimeAsync(
        original!.researchProofUntil! - Date.now() + 1,
      );
    if (kind === "reviewer" || kind === "author")
      await f.t.run(async (ctx) => {
        const member = await ctx.db.query("memberships").first();
        await ctx.db.patch(member!._id, {
          role: kind === "reviewer" ? "Editor" : "Viewer",
        });
      });
    const projections = [
      await f.signed.query(api.content.ideas.get, {
        workspaceId: f.workspaceId,
        ideaId: result.ideaId,
      }),
      await f.signed.query(api.content.ideas.list, {
        workspaceId: f.workspaceId,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
      await f.signed.query(api.content.ideas.history, {
        workspaceId: f.workspaceId,
        ideaId: result.ideaId,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
      await f.signed.query(api.content.ideas.feedback, {
        workspaceId: f.workspaceId,
        ideaId: result.ideaId,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
      await f.signed.query(api.editorial.get, {
        workspaceId: f.workspaceId,
        draftId: result.draftId!,
      }),
      await f.signed.query(api.editorial.list, {
        workspaceId: f.workspaceId,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
      await f.signed.query(api.editorial.history, {
        workspaceId: f.workspaceId,
        draftId: result.draftId!,
        paginationOpts: { cursor: null, numItems: 25 },
      }),
    ];
    expect(JSON.stringify(projections)).not.toContain(secret);
    await expect(
      f.signed.mutation(api.research.handoff.consume, {
        ...args,
        commandKey: "expired-retry",
      }),
    ).rejects.toThrow();
    await expect(
      f.signed.mutation(api.editorial.save, {
        workspaceId: f.workspaceId,
        draftId: result.draftId!,
        expectedRevision: 2,
        content: draft.versions[0].content,
        reason: "edit",
      }),
    ).rejects.toThrow();
    if (kind === "withdraw" || kind === "expire") {
      await f.t.finishInProgressScheduledFunctions();
      // Drain only already-due cleanup, never renew retained copies.
      await f.t.finishAllScheduledFunctions(
        () => vi.advanceTimersByTime(1),
        1000,
      );
      const copies = await f.t.run(async (ctx) => [
        await ctx.db.query("ideaVersions").collect(),
        await ctx.db.query("draftVersions").collect(),
        await ctx.db.query("ideaFeedback").collect(),
        await ctx.db.query("editorialComments").collect(),
        await ctx.db.query("ideas").collect(),
      ]);
      expect(JSON.stringify(copies)).not.toContain(secret);
      expect(
        await f.t.run((ctx) =>
          ctx.db.query("researchContentHandoffs").collect(),
        ),
      ).toHaveLength(1);
      expect(
        (await f.t.run((ctx) => ctx.db.query("aiAttempts").first()))!.state,
      ).toBe("settled");
    }
  },
);
test("review copies cannot pad requested proposals; disposition is role/revision-bound and separate from evidence outcome", async () => {
  const f = await setup();
  const reviewed = await f.signed.mutation(api.research.evidence.review, {
    workspaceId: f.workspaceId,
    evidenceId: f.evidenceId,
    commandKey: "new-review",
    maxAgeMs: 86400000,
    validUntil: Date.now() + 86400000,
    reason: "Review",
    substantiveSupportAttested: true,
    eventAt: null,
    eventQuote: null,
  });
  await expect(
    f.signed.mutation(api.research.handoff.consume, {
      ...f.args,
      evidenceIds: [f.evidenceId, reviewed],
      requestedCount: 2,
    }),
  ).rejects.toThrow("DUPLICATE_PROPOSAL");
  expect(
    await f.signed.mutation(api.research.evidence.disposition, {
      workspaceId: f.workspaceId,
      evidenceId: f.evidenceId,
      expectedRevision: 0,
      disposition: "ignored",
    }),
  ).toBe(1);
  await expect(
    f.signed.mutation(api.research.evidence.disposition, {
      workspaceId: f.workspaceId,
      evidenceId: f.evidenceId,
      expectedRevision: 0,
      disposition: "archived",
    }),
  ).rejects.toThrow("REVISION_CONFLICT");
  expect(await f.t.run((ctx) => ctx.db.get(f.evidenceId))).toMatchObject({
    state: "review",
    inboxDisposition: "ignored",
    inboxRevision: 1,
  });
});

test("explicit requested cap allows honest underfill without padding or generation", async () => {
  const f = await setup();
  const results = await f.signed.mutation(api.research.handoff.consume, {
    ...f.args,
    requestedCount: 5,
  });
  expect(results).toHaveLength(1);
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toHaveLength(
    1,
  );
  expect(
    (await f.t.run((ctx) => ctx.db.query("researchContentHandoffs").first()))!
      .count,
  ).toBe(5);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

test("withdrawal guards calendar/approval/dispatch content while late registered confirmation keeps technical positions and exact receipts", async () => {
  const f = await setup();
  const [result] = await f.signed.mutation(
    api.research.handoff.consume,
    f.args,
  );
  await f.t.run(async (ctx) => {
    const account = (await ctx.db.get(f.accountId))!;
    await ctx.db.patch(account._id, {
      capability: { ...account.capability, publish: true },
    });
  });
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId: result.draftVersionId!,
    accountId: f.accountId,
  });
  const at = Math.ceil((Date.now() + 60000) / 60000) * 60000;
  const scheduleId = await f.signed.mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    versionId: result.draftVersionId!,
    accountId: f.accountId,
    approvalId,
    at,
    timezone: "UTC",
    localTime: new Date(at).toISOString().slice(0, 16),
  });
  expect(
    JSON.stringify(
      await f.signed.query(api.editorial.calendar, {
        workspaceId: f.workspaceId,
        start: at - 1,
        end: at + 1,
      }),
    ),
  ).toContain(secret);
  vi.setSystemTime(at + 1);
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId,
      generation: 1,
    }),
  ).not.toBeNull();
  const attempt = await f.t.mutation(internal.publishing.attempts.claim, {
    scheduleId,
    generation: 1,
  });
  expect(attempt).not.toBeNull();
  // Controlled outstanding transport boundary: no actual X POST is made by this fixture.
  await f.t.run((ctx) => ctx.db.patch(attempt!._id, { stage: "sending" }));
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: f.source.sourceId,
    reason: "blocked",
  });
  expect(
    JSON.stringify(
      await f.signed.query(api.editorial.calendar, {
        workspaceId: f.workspaceId,
        start: at - 1,
        end: at + 1,
      }),
    ),
  ).not.toContain(secret);
  await expect(
    f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId: result.draftVersionId!,
      accountId: f.accountId,
    }),
  ).rejects.toThrow("SOURCE");
  await expect(
    f.t.query(internal.publishing.version, {
      versionId: result.draftVersionId!,
    }),
  ).rejects.toThrow("SOURCE");
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1), 1000);
  const erased = (await f.t.run((ctx) => ctx.db.get(result.draftVersionId!)))!;
  expect(erased.content.text).toEqual(["", ""]);
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: attempt!._id,
    claimSequence: attempt!.claimSequence,
    outcome: "confirmed",
    externalId: "999123",
    durationMs: 12,
  });
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: attempt!._id,
    claimSequence: attempt!.claimSequence,
    outcome: "confirmed",
    externalId: "999123",
    durationMs: 12,
  });
  const schedule = (await f.t.run((ctx) => ctx.db.get(scheduleId)))!;
  expect(schedule.externalPosts).toHaveLength(1);
  expect(schedule.publishedCount).toBe(1);
  expect(schedule.state).not.toBe("published");
  const inspect = await f.signed.query(api.publishing.reconcile.inspect, {
    workspaceId: f.workspaceId,
    scheduleId,
  });
  expect(inspect.positions).toHaveLength(2);
  expect(inspect.positions[0].stage).toBe("confirmed");
  expect((await f.t.run((ctx) => ctx.db.get(attempt!._id)))!.durationMs).toBe(
    12,
  );
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

test("account inbox paginates current evidence and dispositions replay without erasing Review", async () => {
  const f = await setup();
  const page = await f.signed.query(api.research.evidence.inbox, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(page.page).toHaveLength(1);
  expect(page.page[0].evidenceId).toBe(f.evidenceId);
  expect(page.page[0].source?.text).toBe(secret);
  expect(page.page[0].orderId).toBe(f.orderId);
  const command = {
    workspaceId: f.workspaceId,
    evidenceId: f.evidenceId,
    expectedRevision: 0,
    disposition: "ignored" as const,
    commandKey: "ignore-inbox-one",
  };
  expect(
    await f.signed.mutation(api.research.evidence.disposition, command),
  ).toBe(1);
  expect(
    await f.signed.mutation(api.research.evidence.disposition, command),
  ).toBe(1);
  const rows = await f.signed.query(api.research.evidence.inbox, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    paginationOpts: { cursor: null, numItems: 5 },
  });
  expect(rows.page[0].inboxDisposition).toBe("ignored");
  expect(rows.page[0].state).toBe("review");
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: f.source.sourceId,
    reason: "blocked",
  });
  await expect(
    f.signed.mutation(api.research.evidence.disposition, command),
  ).rejects.toThrow();
});

test("existing Inbox attaches exact current proof to an actual native owned thread once", async () => {
  const f = await setup();
  const agent = await import("@convex-dev/agent/test");
  agent.default.register(f.t);
  const conversationId = await f.signed.mutation(api.ai.conversations.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    operationKey: "inbox-agent-thread",
  });
  const args = {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    conversationId,
    evidenceId: f.evidenceId,
    intent: "Discuss current source uncertainty",
    operationKey: "inbox-agent-attach",
  };
  const receipt = await f.signed.mutation(
    api.ai.conversations.attachEvidence,
    args,
  );
  expect(receipt.conversationId).toBe(conversationId);
  expect(receipt.messageId).toBeTruthy();
  expect(
    await f.signed.mutation(api.ai.conversations.attachEvidence, args),
  ).toEqual(receipt);
  expect(
    await f.signed.mutation(api.ai.conversations.attachEvidence, {
      ...args,
      operationKey: "inbox-rotated-attach",
    }),
  ).toEqual(receipt);
  await expect(
    f.signed.mutation(api.ai.conversations.attachEvidence, {
      ...args,
      intent: "Changed intent",
    }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  const c = (await f.t.run((ctx) => ctx.db.get(conversationId)))!;
  expect(c.sources[0]).toMatchObject({
    kind: "research",
    evidenceId: f.evidenceId,
  });
  const messages = await f.t.query(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: c.threadId,
      order: "asc",
      paginationOpts: { cursor: null, numItems: 10 },
    },
  );
  expect(messages.page).toHaveLength(1);
  expect(JSON.stringify(messages.page[0])).toContain(secret);
  expect(JSON.stringify(messages.page[0])).toContain("Ungeprüfte Review");
  await f.signed.mutation(api.research.cache.invalidate, {
    workspaceId: f.workspaceId,
    sourceId: f.source.sourceId,
    reason: "blocked",
  });
  await expect(
    f.signed.mutation(api.ai.conversations.attachEvidence, args),
  ).rejects.toThrow();
});

test.each([
  new Error("Unexpected reviewer database failure"),
  new ConvexError("RESEARCH_UNKNOWN_SOURCE"),
  new ConvexError({ code: "ROLE_ACCESS_DENIED" }),
])(
  "reviewer database failures propagate through every shared projection (%s)",
  async (error) => {
    const f = await setup();
    const reviewed = await f.signed.mutation(api.research.evidence.review, {
      workspaceId: f.workspaceId,
      evidenceId: f.evidenceId,
      commandKey: "review-error",
      maxAgeMs: 86400000,
      validUntil: Date.now() + 86400000,
      reason: "Actual review",
      substantiveSupportAttested: true,
      eventAt: null,
      eventQuote: null,
    });
    const [result] = await f.signed.mutation(api.research.handoff.consume, {
      ...f.args,
      evidenceIds: [reviewed],
    });
    const before = await f.t.run(async (ctx) => ({
      evidence: await ctx.db.get(reviewed),
      idea: await ctx.db.get(result.ideaVersionId),
      draft: await ctx.db.get(result.draftVersionId!),
    }));
    for (const kind of ["proof", "evidence", "idea", "draft"] as const) {
      await expect(
        f.t.run(async (ctx) => {
          let userReads = 0;
          const db = new Proxy(ctx.db, {
            get(target, key) {
              if (key !== "get") return Reflect.get(target, key);
              return async (id: typeof f.userId) => {
                if (
                  id === before.evidence!.assessment!.reviewerId &&
                  ++userReads === 2
                )
                  throw error;
                return target.get(id);
              };
            },
          });
          const proofCtx = { ...ctx, db };
          if (kind === "proof")
            return currentEvidence(proofCtx, f.workspaceId, reviewed);
          if (kind === "evidence")
            return projectEvidence(proofCtx, f.workspaceId, before.evidence!);
          if (kind === "idea") return projectIdea(proofCtx, before.idea!);
          return projectDraft(proofCtx, before.draft!);
        }),
      ).rejects.toThrow();
    }
    expect(
      await f.t.run(async (ctx) => ({
        evidence: await ctx.db.get(reviewed),
        idea: await ctx.db.get(result.ideaVersionId),
        draft: await ctx.db.get(result.draftVersionId!),
      })),
    ).toEqual(before);
  },
);
