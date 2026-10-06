import { insertIdea, currentIdeaSource } from "../convex/content/ideas";
import { afterEach, expect, test, vi } from "vitest";
import { mediaFixture } from "./media-fixture";
import { sourceFixture, send } from "./github-fixture";
import { fixture as researchFixture } from "./research-fixture";
import { internal } from "../convex/_generated/api";
import { api } from "../convex/_generated/api";
const propose = api.planning.plans.propose;
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function fixture() {
  const f = await mediaFixture();
  const { accountId, preferenceId } = await f.t.run(async (ctx) => ({
    accountId: await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "planning-fixture",
      name: "Fixture",
      handle: "@fixture",
      connection: "connected",
      capability: {
        publish: true,
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image", "video"],
      },
    }),
    preferenceId: (await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!._id,
  }));
  const start = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const args = {
    workspaceId: f.workspaceId,
    accountId,
    preferenceId,
    desiredCount: 3,
    start,
    end: start,
    timezone: "UTC",
    clock: "10:00",
    mode: "mixed" as const,
    topics: "",
    commandKey: "proposal-one",
  };
  return { ...f, accountId, preferenceId, args };
}
test("native planning persists an honest zero plan for a draft without verified lineage", async () => {
  const f = await fixture();
  await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "GitHub research",
    content: {
      title: "Unverified",
      text: ["Not authority"],
      media: [],
      accountId: f.accountId,
      pillar: "Product",
      strategy: "generic",
    },
  });
  const id = await f.signed.mutation(propose, f.args);
  const row = await f.t.run((ctx) => ctx.db.get(id));
  expect(row).toMatchObject({
    desiredCount: 3,
    selectedCount: 0,
    candidateCount: 1,
  });
  expect(row!.shortages).toContainEqual(
    expect.objectContaining({ code: "UNVERIFIED_LINEAGE", count: 1 }),
  );
  expect(await f.signed.mutation(propose, f.args)).toBe(id);
  await expect(
    f.signed.mutation(propose, { ...f.args, desiredCount: 2 }),
  ).rejects.toThrow("PLAN_OPERATION_CONFLICT");
});
test("native scheduling blocks cancelled slots with durable external posts", async () => {
  const f = await fixture();
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "Test",
    content: {
      title: "Draft",
      text: ["Actual post"],
      media: [],
      accountId: f.accountId,
      pillar: "Product",
      strategy: "generic",
    },
  });
  const versionId = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  }))!.versions[0]._id;
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId,
    accountId: f.accountId,
  });
  const at = Date.parse(`${f.args.start}T10:00Z`);
  await f.t.run((ctx) =>
    ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      accountId: f.accountId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at,
      timezone: "UTC",
      localTime: `${f.args.start}T10:00`,
      state: "cancelled",
      publishedCount: 1,
      errorCode: null,
      jobId: null,
    }),
  );
  await expect(
    f.signed.mutation(api.editorial.schedule, {
      workspaceId: f.workspaceId,
      versionId,
      accountId: f.accountId,
      approvalId,
      at,
      timezone: "UTC",
      localTime: `${f.args.start}T10:00`,
    }),
  ).rejects.toThrow("SLOT_OCCUPIED");
});
async function workDraft(
  f: Awaited<ReturnType<typeof sourceFixture>>,
  accountId: Awaited<ReturnType<typeof fixture>>["accountId"],
  key = "work-one",
) {
  await f.t.run((ctx) => ctx.db.patch(f.repositories[0], { content: true }));
  await send(f);
  const receipt = (await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  ))!;
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt._id,
  });
  const signal = (await f.t.run((ctx) =>
    ctx.db.query("githubSignals").first(),
  ))!;
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    operationKey: key,
    title: key,
    note: "Explicit work note",
    perspective: "Product",
    priority: "normal",
    source: { kind: "signal", signalId: signal._id },
  });
  const draftId = await f.signed.mutation(api.content.ideas.handoff, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId,
    intent: "Prepare unapproved exact text",
    draftText: "Actual work draft",
    clarificationConfirmed: true,
  });
  return { ideaId, draftId };
}
async function unified() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T09:00:00Z"));
  const base = await sourceFixture();
  const r = await researchFixture(["x-recent"], 300, base);
  await r.t.run((ctx) =>
    ctx.db.patch(r.accountId, {
      capability: {
        publish: true,
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image", "video"],
      },
    }),
  );
  const preferenceId = (await r.t.run((ctx) =>
    ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", r.userId).eq("workspaceId", r.workspaceId),
      )
      .unique(),
  ))!._id;
  return {
    ...base,
    ...r,
    args: {
      workspaceId: r.workspaceId,
      accountId: r.accountId,
      preferenceId,
      desiredCount: 3,
      start: "2026-10-06",
      end: "2026-10-06",
      clock: "09:01",
      timezone: "UTC",
      mode: "mixed" as const,
      topics: "",
      commandKey: "unified-plan",
    },
  };
}
async function researchDraft(
  f: Awaited<ReturnType<typeof unified>>,
  review = true,
  freshness: "context-dependent" | "unknown" = "context-dependent",
  supported = true,
) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: [
        {
          id: "123456789",
          text: "Exact public supporting material",
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
  let evidenceId = await f.signed.mutation(api.research.evidence.create, {
    workspaceId: f.workspaceId,
    orderId,
    sourceId: source.sourceId,
    expectedMaterialHash: source.materialHash,
    commandKey: "planning-evidence",
    annotation: {
      claim: "Exact public supporting material",
      quote: "Exact public supporting material",
      interpretation: "Bounded context",
      gaps: [],
      relevance: "Product",
      novelty: "Unproven",
      uncertainty: "Human reviewed",
      freshness,
      validityReason: "Bounded",
      consequentialOrContested: false,
      eventBased: false,
    },
  });
  if (review)
    evidenceId = await f.signed.mutation(api.research.evidence.review, {
      workspaceId: f.workspaceId,
      evidenceId,
      commandKey: "planning-review",
      maxAgeMs: 86400000,
      validUntil: Date.now() + 600000,
      reason: "Publication basis",
      substantiveSupportAttested: supported,
      eventAt: null,
      eventQuote: null,
    });
  const [result] = await f.signed.mutation(api.research.handoff.consume, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    evidenceIds: [evidenceId],
    target: "draft",
    intent: "Prepare reviewed draft only",
    requestedCount: 1,
    commandKey: "planning-handoff",
  });
  return { ...result, evidenceId };
}
test("actual work/research/mixed selection keeps immutable version, source and timezone pins without generating anything", async () => {
  const f = await unified();
  const work = await workDraft(f, f.accountId);
  const research = await researchDraft(f);
  const get = api.planning.plans.get;
  for (const mode of ["work", "research", "mixed"] as const) {
    const id = await f.signed.mutation(propose, {
      ...f.args,
      mode,
      commandKey: `mode-${mode}`,
    });
    const data = await f.signed.query(get, {
      workspaceId: f.workspaceId,
      planId: id,
    });
    expect(
      data.plan.selectedCount,
      JSON.stringify(data.plan.shortages) + mode,
    ).toBe(1);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].item.at).toBe(Date.parse("2026-10-06T09:01Z"));
    expect(data.items[0].item.draftId).toEqual(
      mode === "work" ? work.draftId.draftId : expect.any(String),
    );
    expect(data.items[0].item.versionNumber).toBe(1);
    expect(data.items[0].item.sources.length).toBeGreaterThan(0);
    if (mode === "research")
      expect(data.items[0].item.rootEvidenceIds).toHaveLength(1);
    await f.signed.mutation(api.planning.plans.reject, {
      workspaceId: f.workspaceId,
      itemId: data.items[0].item._id,
    });
  }
  expect(await f.t.run((ctx) => ctx.db.query("approvals").collect())).toEqual(
    [],
  );
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});
test("D08 missing assessment, ignored evidence, future validity and original proof horizon exclude candidates", async () => {
  const f = await unified();
  const r = await researchDraft(f, false);
  let id = await f.signed.mutation(propose, { ...f.args, mode: "research" });
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.selectedCount).toBe(0);
  await f.t.run((ctx) =>
    ctx.db.patch(r.evidenceId, { inboxDisposition: "ignored" }),
  );
  id = await f.signed.mutation(propose, { ...f.args, commandKey: "ignored" });
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.selectedCount).toBe(0);
  const w = await workDraft(f, f.accountId);
  const first = await f.signed.mutation(propose, {
    ...f.args,
    mode: "work",
    commandKey: "capture",
  });
  const item = (await f.t.run((ctx) =>
    ctx.db
      .query("contentPlanItems")
      .withIndex("by_planId", (q) => q.eq("planId", first))
      .first(),
  ))!;
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { proofExpiresAt: Date.now() + 86400000 }),
  );
  id = await f.signed.mutation(propose, {
    ...f.args,
    mode: "work",
    clock: "09:20",
    commandKey: "renewed",
  });
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.selectedCount).toBe(0);
  expect(item.proofUntil).toBe(Date.parse("2026-10-06T09:15Z"));
  expect(item.draftId).toBe(w.draftId.draftId);
});
test("strict request bounds, current role, lifecycle and cross-workspace references fail before plan writes", async () => {
  const f = await fixture();
  for (const desiredCount of [0, 8, 1.5])
    await expect(
      f.signed.mutation(propose, { ...f.args, desiredCount }),
    ).rejects.toThrow("INVALID_PLAN_REQUEST");
  await expect(
    f.signed.mutation(propose, {
      ...f.args,
      start: "2026-02-30",
      end: "2026-03-01",
    }),
  ).rejects.toThrow("INVALID_PLAN_REQUEST");
  await expect(
    f.signed.mutation(propose, {
      ...f.args,
      start: "2026-10-06",
      end: "2027-02-01",
    }),
  ).rejects.toThrow("INVALID_PLAN_PERIOD");
  await expect(
    f.signed.mutation(propose, { ...f.args, timezone: "Invented/Zone" }),
  ).rejects.toThrow("INVALID_TIMEZONE");
  const member = (await f.t.run((ctx) => ctx.db.query("memberships").first()))!;
  await f.t.run((ctx) => ctx.db.patch(member._id, { role: "Viewer" }));
  await expect(f.signed.mutation(propose, f.args)).rejects.toThrow(
    "ROLE_ACCESS_DENIED",
  );
  await f.t.run((ctx) => ctx.db.patch(member._id, { role: "Editor" }));
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(f.signed.mutation(propose, f.args)).rejects.toThrow(
    "WORKSPACE_INACTIVE",
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("contentPlans").collect()),
  ).toEqual([]);
});
test("civil DST gaps and overlaps yield explicit shortages instead of selected first instants", async () => {
  const f = await fixture();
  for (const [start, code] of [
    ["2027-03-28", "NONEXISTENT_LOCAL_TIME"],
    ["2027-10-31", "AMBIGUOUS_LOCAL_TIME"],
  ]) {
    const id = await f.signed.mutation(propose, {
      ...f.args,
      start,
      end: start,
      timezone: "Europe/Berlin",
      clock: "02:30",
      commandKey: code,
    });
    expect((await f.t.run((ctx) => ctx.db.get(id)))!.shortages).toContainEqual({
      code,
      count: 1,
    });
  }
});
test("proposal projection masks expired source text and marks composer edits without retargeting exact pins", async () => {
  const f = await unified();
  const w = await workDraft(f, f.accountId);
  const id = await f.signed.mutation(propose, { ...f.args, mode: "work" });
  const get = api.planning.plans.get;
  const before = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    planId: id,
  });
  const item = before.items[0].item;
  const b = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: w.draftId.draftId,
  }))!;
  await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: w.draftId.draftId,
    expectedRevision: 1,
    content: { ...b.versions[0].content, title: "Changed current draft" },
    reason: "Human edit",
  });
  const edited = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    planId: id,
  });
  expect(edited.items[0].state).toBe("version_changed");
  expect(edited.items[0].item.versionId).toBe(item.versionId);
  expect(edited.items[0].title).toBe(before.items[0].title);
  vi.setSystemTime(item.proofUntil + 1);
  const expired = await f.signed.query(get, {
    workspaceId: f.workspaceId,
    planId: id,
  });
  expect(expired.items[0].text).toEqual([]);
});
test("pending exact versions are not proposed again and source withdrawal never returns copied topic or body", async () => {
  const f = await unified();
  await workDraft(f, f.accountId);
  const first = await f.signed.mutation(propose, { ...f.args, mode: "work" });
  const repeated = await f.signed.mutation(propose, {
    ...f.args,
    mode: "work",
    commandKey: "new-pending-request",
  });
  expect((await f.t.run((ctx) => ctx.db.get(repeated)))!.selectedCount).toBe(0);
  await f.t.run((ctx) => ctx.db.patch(f.repositories[0], { content: false }));
  const data = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: first,
  });
  expect(data.items[0].text).toEqual([]);
  expect(data.items[0].title).toBe("");
  expect("topic" in data.items[0].item).toBe(false);
});
async function slotFixture() {
  const f = await fixture();
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "Slot fixture",
    content: {
      title: "Slots",
      text: ["Actual post"],
      media: [],
      accountId: f.accountId,
      pillar: "Product",
      strategy: "generic",
    },
  });
  const versionId = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  }))!.versions[0]._id;
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId,
    accountId: f.accountId,
  });
  const at = Date.parse(`${f.args.start}T10:00Z`);
  const row = {
    workspaceId: f.workspaceId,
    draftId,
    versionId,
    accountId: f.accountId,
    approvalId,
    actorId: f.userId,
    generation: 1,
    at,
    timezone: "UTC",
    localTime: `${f.args.start}T10:00`,
    state: "cancelled" as const,
    publishedCount: 0,
    errorCode: null,
    jobId: null,
  };
  return { ...f, row, versionId, approvalId, at };
}
test.each([
  "partially_published",
  "reconciliation_required",
  "published",
  "sending",
  "unknown",
  "confirmed",
  "external",
  "untouched",
] as const)(
  "both native schedule/reschedule reuse %s barriers",
  async (kind) => {
    const f = await slotFixture();
    await f.t.run(async (ctx) => {
      const id = await ctx.db.insert("schedules", {
        ...f.row,
        ...([
          "partially_published",
          "reconciliation_required",
          "published",
        ].includes(kind)
          ? { state: kind as "published" }
          : {}),
      });
      if (["sending", "unknown", "confirmed", "external"].includes(kind))
        await ctx.db.insert("xPostAttempts", {
          workspaceId: f.workspaceId,
          scheduleId: id,
          generation: 1,
          versionId: f.versionId,
          accountId: f.accountId,
          providerIdentity: "synthetic",
          connectionSequence: 0,
          position: 0,
          attempt: 1,
          claimSequence: 1,
          leaseUntil: 0,
          deadline: 0,
          stage: kind === "external" ? "rejected" : (kind as "sending"),
          mediaIds: [],
          durationMs: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...(kind === "external" ? { externalId: "durable-external" } : {}),
        });
    });
    const moving = await f.t.run((ctx) =>
      ctx.db.insert("schedules", {
        ...f.row,
        state: "scheduled",
        at: f.at + 3600000,
        localTime: `${f.args.start}T11:00`,
      }),
    );
    const schedule = () =>
      f.signed.mutation(api.editorial.schedule, {
        workspaceId: f.workspaceId,
        versionId: f.versionId,
        accountId: f.accountId,
        approvalId: f.approvalId,
        at: f.at,
        timezone: "UTC",
        localTime: f.row.localTime,
      });
    const reschedule = () =>
      f.signed.mutation(api.editorial.reschedule, {
        workspaceId: f.workspaceId,
        scheduleId: moving,
        expectedGeneration: 1,
        at: f.at,
        timezone: "UTC",
        localTime: f.row.localTime,
      });
    if (kind === "untouched") {
      await expect(schedule()).resolves.toEqual(expect.any(String));
      await f.t.run(async (ctx) => {
        for (const r of await ctx.db
          .query("schedules")
          .withIndex("by_workspaceId_and_accountId_and_at", (q) =>
            q
              .eq("workspaceId", f.workspaceId)
              .eq("accountId", f.accountId)
              .eq("at", f.at),
          )
          .collect())
          await ctx.db.patch(r._id, { state: "cancelled" });
      });
      await expect(reschedule()).resolves.toBeNull();
    } else {
      await expect(schedule()).rejects.toThrow("SLOT_OCCUPIED");
      await expect(reschedule()).rejects.toThrow("SLOT_OCCUPIED");
    }
  },
);
test("occupied has one total attempt budget across cancelled rows and fails closed", async () => {
  const f = await slotFixture();
  await f.t.run(async (ctx) => {
    for (let n = 0; n < 2; n++) {
      const id = await ctx.db.insert("schedules", f.row);
      for (let i = 0; i < 60; i++)
        await ctx.db.insert("xPostAttempts", {
          workspaceId: f.workspaceId,
          scheduleId: id,
          generation: 1,
          versionId: f.versionId,
          accountId: f.accountId,
          providerIdentity: "synthetic",
          connectionSequence: 0,
          position: i,
          attempt: 1,
          claimSequence: 1,
          leaseUntil: 0,
          deadline: 0,
          stage: "rejected",
          mediaIds: [],
          durationMs: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
    }
  });
  await expect(
    f.signed.mutation(api.editorial.schedule, {
      workspaceId: f.workspaceId,
      versionId: f.versionId,
      accountId: f.accountId,
      approvalId: f.approvalId,
      at: f.at,
      timezone: "UTC",
      localTime: f.row.localTime,
    }),
  ).rejects.toThrow("SLOT_SCAN_LIMIT");
});
test("a safely cancelled own draft stays eligible when another draft occupies its former slot", async () => {
  const f = await unified();
  const w = await workDraft(f, f.accountId);
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId: w.draftId.versionId,
    accountId: f.accountId,
  });
  await f.t.run(async (ctx) => {
    const own = {
      workspaceId: f.workspaceId,
      draftId: w.draftId.draftId,
      versionId: w.draftId.versionId,
      accountId: f.accountId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at: Date.parse("2026-10-06T09:03Z"),
      timezone: "UTC",
      localTime: "2026-10-06T09:03",
      state: "cancelled" as const,
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    };
    await ctx.db.insert("schedules", own);
    const other = await ctx.db.insert("drafts", {
      workspaceId: f.workspaceId,
      revision: 0,
      currentVersionId: null,
      authorId: f.userId,
      source: "Fixture",
      updatedAt: Date.now() - 1,
    });
    await ctx.db.insert("schedules", {
      ...own,
      draftId: other,
      state: "published",
      publishedCount: 1,
    });
  });
  const plan = await f.signed.mutation(propose, { ...f.args, mode: "work" });
  expect((await f.t.run((ctx) => ctx.db.get(plan)))!.selectedCount).toBe(1);
});
test("one cumulative planner history budget fails closed across individually bounded candidate histories", async () => {
  const f = await unified();
  for (let n = 0; n < 3; n++) {
    const w = await workDraft(f, f.accountId, `budget-work-${n}`);
    const approvalId = await f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId: w.draftId.versionId,
      accountId: f.accountId,
    });
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 86; i++)
        await ctx.db.insert("schedules", {
          workspaceId: f.workspaceId,
          draftId: w.draftId.draftId,
          versionId: w.draftId.versionId,
          accountId: f.accountId,
          approvalId,
          actorId: f.userId,
          generation: 1,
          at: Date.parse("2026-10-06T09:03Z") + i * 60000,
          timezone: "UTC",
          localTime: "2026-10-06T09:03",
          state: "cancelled",
          publishedCount: 0,
          errorCode: null,
          jobId: null,
        });
    });
  }
  await expect(
    f.signed.mutation(propose, { ...f.args, mode: "work" }),
  ).rejects.toThrow("SLOT_SCAN_LIMIT");
});
test.each(["untouched", "sending", "unknown"] as const)(
  "human acknowledged cancelled first-write %s has no fictitious external receipt",
  async (kind) => {
    const f = await slotFixture();
    await f.t.run(async (ctx) => {
      const id = await ctx.db.insert("schedules", {
        ...f.row,
        purpose: "first_write_verification",
        confirmedAt: Date.now(),
        intentExpiresAt: Date.now() + 600000,
      });
      if (kind !== "untouched")
        await ctx.db.insert("xPostAttempts", {
          workspaceId: f.workspaceId,
          scheduleId: id,
          generation: 1,
          versionId: f.versionId,
          accountId: f.accountId,
          providerIdentity: "synthetic",
          connectionSequence: 0,
          position: 0,
          attempt: 1,
          claimSequence: 1,
          leaseUntil: 0,
          deadline: 0,
          stage: kind,
          mediaIds: [],
          durationMs: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
    });
    const command = f.signed.mutation(api.editorial.schedule, {
      workspaceId: f.workspaceId,
      versionId: f.versionId,
      accountId: f.accountId,
      approvalId: f.approvalId,
      at: f.at,
      timezone: "UTC",
      localTime: f.row.localTime,
    });
    if (kind === "untouched")
      await expect(command).resolves.toEqual(expect.any(String));
    else await expect(command).rejects.toThrow("SLOT_OCCUPIED");
  },
);
test("actual mixed immutable lineage is excluded from pure modes, accepted mixed, and native missing configuration stays visible", async () => {
  const f = await unified();
  const work = await workDraft(f, f.accountId);
  const research = await researchDraft(f);
  const ideaId = await f.t.run(async (ctx) => {
    const workIdea = (await ctx.db.get(work.ideaId))!;
    const workVersion = (await ctx.db.get(workIdea.currentVersionId!))!;
    const researchVersion = (await ctx.db.get(research.ideaVersionId))!;
    const sources = [
      ...(await currentIdeaSource(ctx, f.workspaceId, workVersion.source)),
      ...(await currentIdeaSource(ctx, f.workspaceId, researchVersion.source)),
    ];
    return insertIdea(
      ctx,
      f.workspaceId,
      f.userId,
      "mixed-fixture",
      "mixed-fixture",
      {
        title: "Mixed actual lineage",
        perspective: "Product",
        note: "Reviewed material",
        priority: "normal",
        source: { kind: "context-set", sources },
        originals: [],
        rationale: "Native fixture exact sources",
        questions: [],
      },
    );
  });
  const mixed = await f.signed.mutation(api.content.ideas.handoff, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    intent: "Explicit mixed handoff",
    draftText: "Actual mixed work and research",
    clarificationConfirmed: true,
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(work.draftId.draftId, { updatedAt: 1 });
    await ctx.db.patch(research.draftId!, { updatedAt: 1 });
  });
  for (const mode of ["work", "research"] as const) {
    const id = await f.signed.mutation(propose, {
      ...f.args,
      mode,
      commandKey: `pure-excludes-${mode}`,
    });
    const data = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId: id,
    });
    expect(data.items.every((i) => i.item.draftId !== mixed.draftId)).toBe(
      true,
    );
    for (const { item } of data.items)
      await f.signed.mutation(api.planning.plans.reject, {
        workspaceId: f.workspaceId,
        itemId: item._id,
      });
  }
  const id = await f.signed.mutation(propose, {
    ...f.args,
    commandKey: "mixed-actual",
  });
  const data = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: id,
  });
  expect(data.items[0].item.draftId).toBe(mixed.draftId);
  expect(data.items[0].item.sources).toHaveLength(2);
  await f.t.run((ctx) =>
    ctx.db.patch(f.accountId, { connection: "disconnected" }),
  );
  const empty = await f.signed.mutation(propose, {
    ...f.args,
    commandKey: "missing-connection",
  });
  const row = (await f.t.run((ctx) => ctx.db.get(empty)))!;
  expect(row.selectedCount).toBe(0);
  expect(row.shortages).toContainEqual(
    expect.objectContaining({ code: "ACCOUNT_REAUTH_OR_CAPABILITY_REQUIRED" }),
  );
});
test.each(["ignored", "archived", "reviewer", "identity", "expired"] as const)(
  "supported research %s exclusion uses live assessment, inbox and original proof",
  async (kind) => {
    const f = await unified();
    const r = await researchDraft(f);
    await f.t.run(async (ctx) => {
      if (kind === "ignored" || kind === "archived")
        await ctx.db.patch(r.evidenceId, { inboxDisposition: kind });
      if (kind === "reviewer") {
        const member = (await ctx.db.query("memberships").first())!;
        await ctx.db.patch(member._id, { role: "Editor" });
      }
      if (kind === "identity")
        await ctx.db.patch(r.evidenceId, { fingerprint: "changed-identity" });
      if (kind === "expired") vi.setSystemTime(Date.now() + 600000);
    });
    const id = await f.signed.mutation(propose, {
      ...f.args,
      mode: "research",
    });
    expect((await f.t.run((ctx) => ctx.db.get(id)))!.selectedCount).toBe(0);
  },
);
test("native ready media checksum identity cannot be substituted after immutable draft save", async () => {
  vi.stubEnv("R2_MEDIA_BUCKET", "synthetic-planning-fixture");
  const f = await unified();
  const w = await workDraft(f, f.accountId);
  const ready = await f.ready();
  const b = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: w.draftId.draftId,
  }))!;
  await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: w.draftId.draftId,
    expectedRevision: 1,
    content: {
      ...b.versions[0].content,
      media: [
        { assetId: ready.assetId, alt: "Meaningful native media description" },
      ],
    },
    reason: "Attach native ready media",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(ready.assetId, { checksum: "changed-after-immutable-save" }),
  );
  const id = await f.signed.mutation(propose, { ...f.args, mode: "work" });
  const row = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(row.selectedCount).toBe(0);
  expect(row.shortages).toContainEqual({
    code: "MEDIA_SNAPSHOT_CHANGED",
    count: 1,
  });
});
test("concurrent exact proposal retries yield one durable receipt, no new contents or effects", async () => {
  const f = await unified();
  await workDraft(f, f.accountId);
  const ids = await Promise.all([
    f.signed.mutation(propose, f.args),
    f.signed.mutation(propose, f.args),
  ]);
  expect(ids[0]).toBe(ids[1]);
  expect(
    await f.t.run((ctx) => ctx.db.query("contentPlans").collect()),
  ).toHaveLength(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("contentPlanItems").collect()),
  ).toHaveLength(1);
});
test.each(["unknown", "unsupported"] as const)(
  "native human review cannot promote %s research into eligible planning material",
  async (kind) => {
    const f = await unified();
    await researchDraft(
      f,
      true,
      kind === "unknown" ? "unknown" : "context-dependent",
      kind !== "unsupported",
    );
    const id = await f.signed.mutation(propose, {
      ...f.args,
      mode: "research",
    });
    expect((await f.t.run((ctx) => ctx.db.get(id)))!.selectedCount).toBe(0);
  },
);
test("candidate probe26 reports partial workspace coverage and does not create fillers", async () => {
  const f = await fixture();
  for (let n = 0; n < 26; n++)
    await f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      source: "Unverified note",
      content: {
        title: `Note ${n}`,
        text: ["Own note"],
        media: [],
        accountId: f.accountId,
        pillar: "Product",
        strategy: "generic",
      },
    });
  const id = await f.signed.mutation(propose, f.args);
  expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
    candidateCount: 25,
    coveragePartial: true,
    selectedCount: 0,
  });
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toHaveLength(
    26,
  );
});
test("account indexed plan history cannot be crowded out by another account", async () => {
  const f = await fixture();
  const first = await f.signed.mutation(propose, f.args);
  const accountId = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...row } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", {
      ...row,
      providerIdentity: "second-fixture",
    });
  });
  for (let n = 0; n < 26; n++)
    await f.signed.mutation(propose, {
      ...f.args,
      accountId,
      commandKey: `other-account-${n}`,
    });
  expect(
    (
      await f.signed.query(api.planning.plans.list, {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
      })
    ).map((p) => p._id),
  ).toEqual([first]);
});
test("foreign account cannot be referenced by proposal or bounded history query", async () => {
  const f = await fixture();
  const accountId = await f.t.run(async (ctx) => {
    const ws = await ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "",
    });
    const { _id, _creationTime, ...row } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", {
      ...row,
      workspaceId: ws,
      providerIdentity: "foreign-fixture",
    });
  });
  await expect(
    f.signed.mutation(propose, { ...f.args, accountId }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await expect(
    f.signed.query(api.planning.plans.list, {
      workspaceId: f.workspaceId,
      accountId,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
});
test("fixed UTC offsets are not accepted as named IANA planning zones", async () => {
  const f = await fixture();
  await expect(
    f.signed.mutation(propose, { ...f.args, timezone: "+01:00" }),
  ).rejects.toThrow("INVALID_TIMEZONE");
});
test.each(["current", "foreign", "expired"] as const)(
  "bounded previous %s scheduled topic context prefers only authorized unseen topics",
  async (kind) => {
    const f = await unified();
    const known = await workDraft(f, f.accountId, "known-topic"),
      fresh = await workDraft(f, f.accountId, "fresh-topic"),
      recent = await workDraft(f, f.accountId, "recent-topic"),
      prior = await workDraft(f, f.accountId, "previous-topic");
    for (const [w, pillar] of [
      [known, "Known"],
      [fresh, "Fresh"],
      [recent, "Known"],
      [prior, "Known"],
    ] as const) {
      const b = (await f.signed.query(api.editorial.get, {
        workspaceId: f.workspaceId,
        draftId: w.draftId.draftId,
      }))!;
      await f.signed.mutation(api.editorial.save, {
        workspaceId: f.workspaceId,
        draftId: w.draftId.draftId,
        expectedRevision: 1,
        content: { ...b.versions[0].content, pillar },
        reason: "Human topic selection",
      });
    }
    const b = (await f.signed.query(api.editorial.get, {
      workspaceId: f.workspaceId,
      draftId: prior.draftId.draftId,
    }))!;
    const versionId = b.versions.at(-1)!._id;
    const approvalId = await f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId,
      accountId: f.accountId,
    });
    const scheduleId = await f.signed.mutation(api.editorial.schedule, {
      workspaceId: f.workspaceId,
      versionId,
      accountId: f.accountId,
      approvalId,
      at: Date.parse("2026-10-06T09:04Z"),
      timezone: "UTC",
      localTime: "2026-10-06T09:04",
    });
    await f.t.run(async (ctx) => {
      await ctx.db.patch(recent.draftId.draftId, { updatedAt: Date.now() + 1 });
      if (kind === "foreign") {
        const ws = await ctx.db.insert("workspaces", {
          name: "Foreign context",
          description: "",
        });
        await ctx.db.patch(scheduleId, { workspaceId: ws });
      }
      if (kind === "expired")
        await ctx.db.patch(versionId, { sourceUnavailable: true });
    });
    const id = await f.signed.mutation(propose, { ...f.args, mode: "work" });
    const data = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId: id,
    });
    expect(data.items[0].item.draftId).toBe(
      kind === "current" ? fresh.draftId.draftId : recent.draftId.draftId,
    );
  },
);
test("historical influence has exact immutable refs, independent horizon and fail closed context withdrawal", async () => {
  const f = await unified();
  const w = await workDraft(f, f.accountId);
  const r = await researchDraft(f);
  const b = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: r.draftId!,
  }))!;
  const versionId = b.versions[0]._id;
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId,
    accountId: f.accountId,
  });
  await f.signed.mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    versionId,
    accountId: f.accountId,
    approvalId,
    at: Date.parse("2026-10-06T09:04Z"),
    timezone: "UTC",
    localTime: "2026-10-06T09:04",
  });
  const planId = await f.signed.mutation(propose, { ...f.args, mode: "work" });
  const before = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId,
  });
  const item = before.items[0].item;
  expect(item.historyVersionIds).toContain(versionId);
  expect(item.contextProofUntil).toBeLessThan(item.proofUntil);
  await f.t.run((ctx) =>
    ctx.db.patch(r.evidenceId, { inboxDisposition: "ignored" }),
  );
  const after = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId,
  });
  expect(after.items[0].state).toBe("context_changed");
  expect(after.items[0].text).toEqual([]);
  expect(after.items[0].item.proofUntil).toBe(item.proofUntil);
  expect(after.items[0].item.draftId).toBe(w.draftId.draftId);
  await f.signed.mutation(api.planning.plans.reject, {
    workspaceId: f.workspaceId,
    itemId: item._id,
  });
  vi.setSystemTime(Date.parse("2026-10-06T09:03Z"));
  const renewed = await f.signed.mutation(propose, {
    ...f.args,
    mode: "work",
    clock: "09:05",
    commandKey: "independent-context-horizon",
  });
  const next = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: renewed,
  });
  expect(next.items).toHaveLength(1);
  expect(next.items[0].item.proofUntil).toBe(item.proofUntil);
  expect(next.items[0].item.historyVersionIds).toEqual([]);
  expect(next.items[0].item.contextProofUntil).toBeNull();
});
test("current work proof shortened before the pinned future slot masks the proposal", async () => {
  const f = await unified();
  await workDraft(f, f.accountId);
  const planId = await f.signed.mutation(propose, {
    ...f.args,
    mode: "work",
    clock: "09:05",
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], {
      proofExpiresAt: Date.parse("2026-10-06T09:03Z"),
    }),
  );
  const data = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId,
  });
  expect(data.items[0].state).toBe("source_unavailable");
  expect(data.items[0].text).toEqual([]);
});
test("the twenty-sixth proposal cannot overflow the bounded exact-version history", async () => {
  const f = await unified();
  await workDraft(f, f.accountId);
  let last: string | undefined;
  for (let i = 0; i < 25; i++) {
    const planId = await f.signed.mutation(propose, {
      ...f.args,
      mode: "work",
      commandKey: `history-bound-${i}`,
    });
    const detail = await f.signed.query(api.planning.plans.get, {
      workspaceId: f.workspaceId,
      planId,
    });
    expect(detail.items[0].state).toBe("proposed");
    await f.signed.mutation(api.planning.plans.reject, {
      workspaceId: f.workspaceId,
      itemId: detail.items[0].item._id,
    });
    last = planId;
  }
  const blocked = await f.signed.mutation(propose, {
    ...f.args,
    mode: "work",
    commandKey: "history-bound-26",
  });
  const plan = await f.t.run((ctx) => ctx.db.get(blocked));
  expect(plan!.selectedCount).toBe(0);
  expect(plan!.shortages).toContainEqual({
    code: "VERSION_PROPOSAL_LIMIT",
    count: 1,
  });
  const previous = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: last as typeof blocked,
  });
  expect(previous.items[0].text.length).toBeGreaterThan(0);
});
