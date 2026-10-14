import { afterEach, expect, test, vi } from "vitest";
import { mediaFixture } from "./media-fixture";
import { sourceFixture, send } from "./github-fixture";
import { api, components, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test("accepted planning replay proves exact historical source without reactivating cancelled parents", async () => {
  const f = await workPlan();
  const args = {
    workspaceId: f.workspaceId,
    planId: f.planId,
    selections: choose(f.items),
    mode: "approve_and_schedule" as const,
  };
  const accepted = await f.signed.mutation(api.planning.accept.selected, args);
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: accepted[0].scheduleId,
    expectedGeneration: 1,
  });
  await f.signed.mutation(api.editorial.revoke, {
    workspaceId: f.workspaceId,
    approvalId: accepted[0].approvalId,
  });
  expect(await f.signed.mutation(api.planning.accept.selected, args)).toEqual(
    accepted,
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.items[0].versionId, { sourceUnavailable: true }),
  );
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow("REVIEW_SOURCE_UNAVAILABLE");
  expect(
    (await f.t.run((ctx) => ctx.db.get(accepted[0].scheduleId)))!.state,
  ).toBe("cancelled");
  expect(
    (await f.t.run((ctx) => ctx.db.get(accepted[0].approvalId)))!.revokedAt,
  ).not.toBeNull();
});

test("a new authorized human records their own approval when the former approver loses authority", async () => {
  const f = await mediaFixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "planning-acceptance",
      name: "Fixture",
      handle: "@fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image", "video"],
        publish: true,
      },
    }),
  );
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "Manual",
    content: {
      title: "Reviewed version",
      text: ["Actual approved text"],
      media: [],
      accountId,
      pillar: "Product",
      strategy: "generic",
    },
  });
  const versionId = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  }))!.versions[0]._id;
  const aApproval = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    accountId,
    versionId,
  });
  const oldAt = Math.ceil(Date.now() / 60000) * 60000 + 7200000;
  const oldScheduleId = await f.signed.mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    accountId,
    versionId,
    approvalId: aApproval,
    at: oldAt,
    timezone: "UTC",
    localTime: new Date(oldAt).toISOString().slice(0, 16),
  });
  const originalApproval = await f.t.run((ctx) => ctx.db.get(aApproval));
  const originalSchedule = await f.t.run((ctx) => ctx.db.get(oldScheduleId));
  const identityB = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Other Owner",
          email: "planning-b@example.test",
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: {
          userId: u._id,
          providerId: "credential",
          accountId: u._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          password: "synthetic-hash",
        },
      },
    });
    const s = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: u._id,
          token: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
      },
    });
    return { subject: u._id, sessionId: s._id };
  });
  const b = f.t.withIdentity(identityB);
  const userB = await b.mutation(api.users.bootstrap, {});
  await f.t.run(async (ctx) => {
    await ctx.db.insert("memberships", {
      userId: userB,
      workspaceId: f.workspaceId,
      role: "Owner",
    });
    const a = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(a!._id, { role: "Viewer" });
  });
  const bApproval = await b.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    accountId,
    versionId,
  });
  expect(bApproval).not.toBe(aApproval);
  expect((await f.t.run((ctx) => ctx.db.get(bApproval)))!.actorId).toBe(userB);
  expect(
    await b.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      accountId,
      versionId,
    }),
  ).toBe(bApproval);
  const at = Math.ceil(Date.now() / 60000) * 60000 + 3600000;
  const args = {
    workspaceId: f.workspaceId,
    accountId,
    versionId,
    at,
    timezone: "UTC",
    localTime: new Date(at).toISOString().slice(0, 16),
  };
  await expect(
    b.mutation(api.editorial.schedule, { ...args, approvalId: aApproval }),
  ).rejects.toThrow("APPROVER_AUTHORITY_CHANGED");
  const scheduleId = await b.mutation(api.editorial.schedule, {
    ...args,
    approvalId: bApproval,
  });
  expect((await f.t.run((ctx) => ctx.db.get(scheduleId)))!.approvalId).toBe(
    bApproval,
  );
  expect(await f.t.run((ctx) => ctx.db.get(aApproval))).toEqual(
    originalApproval,
  );
  expect(await f.t.run((ctx) => ctx.db.get(oldScheduleId))).toEqual(
    originalSchedule,
  );
});

async function workPlan(three = false) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T09:00:00Z"));
  const f = await sourceFixture();
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
  const { accountId, preferenceId } = await f.t.run(async (ctx) => ({
    accountId: await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "planning-accept",
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
  const drafts: Id<"drafts">[] = [];
  for (let i = 0; i < (three ? 3 : 1); i++) {
    const ideaId = await f.signed.mutation(api.content.ideas.create, {
      workspaceId: f.workspaceId,
      operationKey: `accept-idea-${i}`,
      title: `Actual idea ${i}`,
      note: "Explicit work note",
      perspective: "Product",
      priority: "normal",
      source: { kind: "signal", signalId: signal._id },
    });
    const handoff = await f.signed.mutation(api.content.ideas.handoff, {
      workspaceId: f.workspaceId,
      ideaId,
      expectedRevision: 1,
      accountId,
      intent: `Prepare reviewed draft ${i}`,
      draftText: `Actual work draft ${i}`,
      clarificationConfirmed: true,
    });
    drafts.push(handoff.draftId);
  }
  const planId = await f.signed.mutation(api.planning.plans.propose, {
    workspaceId: f.workspaceId,
    accountId,
    preferenceId,
    desiredCount: 3,
    start: "2026-10-06",
    end: "2026-10-06",
    timezone: "UTC",
    clock: "09:01",
    mode: "work",
    topics: "",
    commandKey: "accept-work-plan",
  });
  const first = (await f.t.run((ctx) =>
    ctx.db
      .query("contentPlanItems")
      .withIndex("by_planId", (q) => q.eq("planId", planId))
      .first(),
  ))!;
  expect(first).toBeTruthy();
  if (three) {
    // Controlled persisted three-item acceptance fixture. One daily HH:mm cannot produce three within the native 15-minute work proof.
    await f.t.run(async (ctx) => {
      for (let i = 1; i < 3; i++) {
        const draft = (await ctx.db.get(drafts[i]))!;
        const version = (await ctx.db.get(draft.currentVersionId!))!;
        await ctx.db.insert("contentPlanItems", {
          workspaceId: first.workspaceId,
          planId,
          accountId,
          draftId: draft._id,
          versionId: version._id,
          versionNumber: version.number,
          draftRevision: draft.revision,
          ideaVersionId: version.ideaVersionId!,
          sources: first.sources,
          families: first.families,
          rootEvidenceIds: first.rootEvidenceIds,
          at: first.at + i * 60000,
          timezone: "UTC",
          localTime: `2026-10-06T09:0${i + 1}`,
          proofUntil: first.proofUntil,
          validityUntil: first.validityUntil,
          historyVersionIds: [],
          contextProofUntil: null,
          reason: "Controlled valid source lineage",
          status: "proposed",
        });
      }
      await ctx.db.patch(planId, { selectedCount: 3 });
    });
  }
  const items = await f.t.run((ctx) =>
    ctx.db
      .query("contentPlanItems")
      .withIndex("by_planId", (q) => q.eq("planId", planId))
      .collect(),
  );
  return { ...f, accountId, planId, items };
}
function choose(
  items: Awaited<ReturnType<typeof workPlan>>["items"],
  approvalIds?: string[],
) {
  return items.map((item, i) => ({
    itemId: item._id,
    versionId: item.versionId,
    draftRevision: item.draftRevision,
    ...(approvalIds
      ? { approvalId: approvalIds[i] as typeof item.acceptedApprovalId }
      : {}),
  }));
}
test("registered proposal accepts one exact reviewed slot without extending its proof", async () => {
  const f = await workPlan();
  expect(f.items).toHaveLength(1);
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    versionId: f.items[0].versionId,
  });
  const result = await f.signed.mutation(api.planning.accept.selected, {
    workspaceId: f.workspaceId,
    planId: f.planId,
    selections: choose(f.items, [approvalId]),
    mode: "approved",
  });
  expect(result).toHaveLength(1);
  expect(result[0].approvalId).toBe(approvalId);
  expect((await f.t.run((ctx) => ctx.db.get(result[0].scheduleId)))!.at).toBe(
    f.items[0].at,
  );
  expect((await f.t.run((ctx) => ctx.db.get(f.items[0]._id)))!.status).toBe(
    "accepted",
  );
  await expect(
    f.signed.mutation(api.planning.plans.reject, {
      workspaceId: f.workspaceId,
      itemId: f.items[0]._id,
    }),
  ).rejects.toThrow("PLAN_ALREADY_ACCEPTED");
  expect(
    await f.signed.mutation(api.planning.accept.selected, {
      workspaceId: f.workspaceId,
      planId: f.planId,
      selections: choose(f.items, [approvalId]),
      mode: "approved",
    }),
  ).toEqual(result);
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(1);
  const view = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: f.planId,
  });
  expect(view.items[0].state).toBe("accepted");
  expect(view.items[0].item.acceptedScheduleId).toBe(result[0].scheduleId);
});

test("controlled three-item fixture accepts exactly selected two and keeps the third pending", async () => {
  const f = await workPlan(true);
  expect(f.items).toHaveLength(3);
  const selected = choose(f.items.slice(0, 2));
  const first = await f.signed.mutation(api.planning.accept.selected, {
    workspaceId: f.workspaceId,
    planId: f.planId,
    selections: selected,
    mode: "approve_and_schedule",
  });
  expect(first).toHaveLength(2);
  expect(new Set(first.map((r) => r.scheduleId)).size).toBe(2);
  expect((await f.t.run((ctx) => ctx.db.get(f.items[2]._id)))!.status).toBe(
    "proposed",
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(2);
  expect(
    await f.signed.mutation(api.planning.accept.selected, {
      workspaceId: f.workspaceId,
      planId: f.planId,
      selections: selected,
      mode: "approve_and_schedule",
    }),
  ).toEqual(first);
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      workspaceId: f.workspaceId,
      planId: f.planId,
      selections: [selected[0], selected[0]],
      mode: "approve_and_schedule",
    }),
  ).rejects.toThrow("INVALID_PLAN_SELECTION");
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      workspaceId: f.workspaceId,
      planId: f.planId,
      selections: [{ ...selected[0], draftRevision: 2 }],
      mode: "approve_and_schedule",
    }),
  ).rejects.toThrow("PLAN_SELECTION_CHANGED");
  await f.signed.mutation(api.planning.plans.reject, {
    workspaceId: f.workspaceId,
    itemId: f.items[2]._id,
  });
  await expect(
    f.signed.mutation(api.planning.plans.reject, {
      workspaceId: f.workspaceId,
      itemId: f.items[2]._id,
    }),
  ).resolves.toBeNull();
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      workspaceId: f.workspaceId,
      planId: f.planId,
      selections: choose([f.items[2]]),
      mode: "approve_and_schedule",
    }),
  ).rejects.toThrow("PLAN_ITEM_REJECTED");
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(2);
});

test("a conflicting later slot rolls back every new approval, event, schedule and item status", async () => {
  const f = await workPlan(true);
  const earlier = await f.signed.mutation(api.planning.accept.selected, {
    workspaceId: f.workspaceId,
    planId: f.planId,
    selections: choose([f.items[2]]),
    mode: "approve_and_schedule",
  });
  const competingDraft = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "Manual",
    content: {
      title: "Existing",
      text: ["Existing calendar entry"],
      media: [],
      accountId: f.accountId,
      pillar: "Other",
      strategy: "generic",
    },
  });
  const competingVersion = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: competingDraft,
  }))!.versions[0]._id;
  const competingApproval = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    versionId: competingVersion,
  });
  const occupied = f.items[1];
  const competingSchedule = await f.signed.mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    versionId: competingVersion,
    approvalId: competingApproval,
    at: occupied.at,
    timezone: occupied.timezone,
    localTime: occupied.localTime,
  });
  const before = await f.t.run(async (ctx) => ({
    approvals: await ctx.db.query("approvals").collect(),
    schedules: await ctx.db.query("schedules").collect(),
    events: await ctx.db.query("editorialEvents").collect(),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      workspaceId: f.workspaceId,
      planId: f.planId,
      selections: choose(f.items.slice(0, 2)),
      mode: "approve_and_schedule",
    }),
  ).rejects.toThrow(/SLOT_OCCUPIED|ALREADY_PLANNED/);
  expect(
    await f.t.run(async (ctx) => ({
      approvals: await ctx.db.query("approvals").collect(),
      schedules: await ctx.db.query("schedules").collect(),
      events: await ctx.db.query("editorialEvents").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    })),
  ).toEqual(before);
  expect((await f.t.run((ctx) => ctx.db.get(competingSchedule)))!.state).toBe(
    "scheduled",
  );
  expect((await f.t.run((ctx) => ctx.db.get(f.items[0]._id)))!.status).toBe(
    "proposed",
  );
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.items[2]._id)))!.acceptedScheduleId,
  ).toBe(earlier[0].scheduleId);
});

test.each(["context", "source"] as const)(
  "a later %s withdrawal rolls back the entire new batch",
  async (kind) => {
    const f = await workPlan(true);
    const second = f.items[1];
    if (kind === "context") {
      await f.t.run((ctx) =>
        ctx.db.patch(second._id, { contextProofUntil: second.at }),
      );
    } else {
      const ideaVersion = (await f.t.run((ctx) =>
        ctx.db.get(second.ideaVersionId),
      ))!;
      await f.t.run((ctx) =>
        ctx.db.patch(ideaVersion.ideaId, { status: "archived" }),
      );
    }
    const before = await f.t.run(async (ctx) => ({
      approvals: await ctx.db.query("approvals").collect(),
      schedules: await ctx.db.query("schedules").collect(),
      events: await ctx.db.query("editorialEvents").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    await expect(
      f.signed.mutation(api.planning.accept.selected, {
        workspaceId: f.workspaceId,
        planId: f.planId,
        selections: choose(f.items.slice(0, 2)),
        mode: "approve_and_schedule",
      }),
    ).rejects.toThrow();
    expect(
      await f.t.run(async (ctx) => ({
        approvals: await ctx.db.query("approvals").collect(),
        schedules: await ctx.db.query("schedules").collect(),
        events: await ctx.db.query("editorialEvents").collect(),
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      })),
    ).toEqual(before);
    expect((await f.t.run((ctx) => ctx.db.get(f.items[0]._id)))!.status).toBe(
      "proposed",
    );
  },
);

test("new acceptance refuses a Composer version change without side effects", async () => {
  const f = await workPlan();
  const item = f.items[0];
  const args = {
    workspaceId: f.workspaceId,
    planId: f.planId,
    selections: choose(f.items),
    mode: "approve_and_schedule" as const,
  };
  const draft = (await f.t.run((ctx) => ctx.db.get(item.draftId)))!;
  const version = (await f.t.run((ctx) => ctx.db.get(item.versionId)))!;
  await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: item.draftId,
    expectedRevision: draft.revision,
    content: { ...version.content, text: ["Changed text"] },
    reason: "Edit after proposal",
  });
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow("PLAN_VERSION_CHANGED");
  expect(
    await f.t.run((ctx) => ctx.db.query("approvals").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(0);
});

test("new acceptance enforces current role and refuses first-write approval purpose", async () => {
  const f = await workPlan();
  const item = f.items[0];
  const args = {
    workspaceId: f.workspaceId,
    planId: f.planId,
    selections: choose(f.items),
    mode: "approve_and_schedule" as const,
  };
  const foreignWorkspace = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Foreign", description: "" }),
  );
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      ...args,
      workspaceId: foreignWorkspace,
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  const member = (await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique(),
  ))!;
  await f.t.run((ctx) => ctx.db.patch(member._id, { role: "Editor" }));
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  await f.t.run((ctx) => ctx.db.patch(member._id, { role: "Viewer" }));
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  await f.t.run((ctx) => ctx.db.patch(member._id, { role: "Owner" }));
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    versionId: item.versionId,
  });
  await f.t.run((ctx) =>
    ctx.db.patch(approvalId, { purpose: "first_write_verification" }),
  );
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      ...args,
      mode: "approved",
      selections: choose(f.items, [approvalId]),
    }),
  ).rejects.toThrow("APPROVAL_PURPOSE_MISMATCH");
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(0);
});

test("renewed source proof preserves original horizon while shortened current proof blocks the slot", async () => {
  const f = await workPlan();
  const item = f.items[0];
  const original = item.proofUntil;
  const args = {
    workspaceId: f.workspaceId,
    planId: f.planId,
    selections: choose(f.items),
    mode: "approve_and_schedule" as const,
  };
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { proofExpiresAt: item.at }),
  );
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow();
  expect(
    await f.t.run((ctx) => ctx.db.query("approvals").collect()),
  ).toHaveLength(0);
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { proofExpiresAt: original + 86400000 }),
  );
  const result = await f.signed.mutation(api.planning.accept.selected, args);
  expect(result).toHaveLength(1);
  expect((await f.t.run((ctx) => ctx.db.get(item._id)))!.proofUntil).toBe(
    original,
  );
  vi.setSystemTime(original + 1);
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow("REVIEW_SOURCE_UNAVAILABLE");
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(1);
});

test("a cancelled unrelated slot with an unknown external attempt stays occupied at acceptance", async () => {
  const f = await workPlan();
  const item = f.items[0];
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "Manual",
    content: {
      title: "Existing",
      text: ["Uncertain external post"],
      media: [],
      accountId: f.accountId,
      pillar: "Other",
      strategy: "generic",
    },
  });
  const versionId = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  }))!.versions[0]._id;
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    versionId,
  });
  const existing = await f.t.run(async (ctx) => {
    const scheduleId = await ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      versionNumber: 1,
      accountId: f.accountId,
      approvalId,
      actorId: f.userId,
      generation: 1,
      at: item.at,
      timezone: item.timezone,
      localTime: item.localTime,
      state: "cancelled",
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    });
    await ctx.db.insert("xPostAttempts", {
      workspaceId: f.workspaceId,
      scheduleId,
      generation: 1,
      versionId,
      accountId: f.accountId,
      providerIdentity: "planning-accept",
      connectionSequence: 0,
      position: 0,
      attempt: 1,
      claimSequence: 1,
      leaseUntil: 0,
      deadline: 0,
      stage: "unknown",
      mediaIds: [],
      durationMs: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return scheduleId;
  });
  const before = await f.t.run((ctx) => ctx.db.get(existing));
  await expect(
    f.signed.mutation(api.planning.accept.selected, {
      workspaceId: f.workspaceId,
      planId: f.planId,
      selections: choose(f.items),
      mode: "approve_and_schedule",
    }),
  ).rejects.toThrow("SLOT_OCCUPIED");
  expect(await f.t.run((ctx) => ctx.db.get(existing))).toEqual(before);
  expect((await f.t.run((ctx) => ctx.db.get(item._id)))!.status).toBe(
    "proposed",
  );
});

test("concurrent exact acceptance returns one schedule and rejects wrong scope or changed context", async () => {
  const f = await workPlan();
  const args = {
    workspaceId: f.workspaceId,
    planId: f.planId,
    selections: choose(f.items),
    mode: "approve_and_schedule" as const,
  };
  const wrong = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "other-account",
      name: "Other",
      handle: "@other",
      connection: "connected",
      capability: {
        publish: true,
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image", "video"],
      },
    }),
  );
  await f.t.run((ctx) => ctx.db.patch(f.items[0]._id, { accountId: wrong }));
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow("PLAN_SELECTION_CHANGED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.items[0]._id, {
      accountId: f.accountId,
      contextProofUntil: f.items[0].at,
    }),
  );
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow("PLAN_CONTEXT_CHANGED");
  const contextView = await f.signed.query(api.planning.plans.get, {
    workspaceId: f.workspaceId,
    planId: f.planId,
  });
  expect(contextView.items[0].state).toBe("context_changed");
  await f.t.run((ctx) =>
    ctx.db.patch(f.items[0]._id, { contextProofUntil: null }),
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.items[0]._id, { localTime: "2026-10-06T09:04" }),
  );
  await expect(
    f.signed.mutation(api.planning.accept.selected, args),
  ).rejects.toThrow("LOCAL_TIME_REQUIRES_EXPLICIT_INSTANT");
  await f.t.run((ctx) =>
    ctx.db.patch(f.items[0]._id, { localTime: f.items[0].localTime }),
  );
  const [one, two] = await Promise.all([
    f.signed.mutation(api.planning.accept.selected, args),
    f.signed.mutation(api.planning.accept.selected, args),
  ]);
  expect(one).toEqual(two);
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(1);
});
test.each(["approved", "approve_and_schedule"] as const)(
  "TASK50 genuine two-of-three planning mode %s uses current stages and immutable accepted replay",
  async (mode) => {
    const f = await workPlan(true);
    const scope = { workspaceId: f.workspaceId },
      p = await f.signed.mutation(api.editorial.reviews.configure, {
        ...scope,
        accountId: null,
        expectedRevision: 0,
        commandKey: "planning-policy",
        policy: { editorial: true, brand: true },
      });
    const decisions = async (
      versionId: (typeof f.items)[number]["versionId"],
    ) => {
      for (const stage of ["editorial", "brand"] as const) {
        const state = await f.signed.query(api.editorial.reviews.get, {
          ...scope,
          versionId,
        });
        await f.signed.mutation(api.editorial.reviews.decide, {
          ...scope,
          versionId,
          stage,
          policyId: p.policyId,
          expectedRevision: state.revision,
          commandKey: crypto.randomUUID(),
        });
      }
    };
    await decisions(f.items[0].versionId);
    const old =
      mode === "approved"
        ? [
            await f.signed.mutation(api.editorial.approve, {
              ...scope,
              accountId: f.accountId,
              versionId: f.items[0].versionId,
            }),
          ]
        : undefined;
    if (mode === "approve_and_schedule") {
      await expect(
        f.signed.mutation(api.planning.accept.selected, {
          ...scope,
          planId: f.planId,
          selections: choose(f.items.slice(0, 2)),
          mode,
        }),
      ).rejects.toThrow("REVIEW_REQUIRED");
      expect(
        await f.t.run((ctx) => ctx.db.query("approvals").collect()),
      ).toHaveLength(0);
      expect(
        await f.t.run((ctx) => ctx.db.query("schedules").collect()),
      ).toHaveLength(0);
    }
    await decisions(f.items[1].versionId);
    const approvals =
      mode === "approved"
        ? [
            ...old!,
            await f.signed.mutation(api.editorial.approve, {
              ...scope,
              accountId: f.accountId,
              versionId: f.items[1].versionId,
            }),
          ]
        : undefined;
    const args = {
      ...scope,
      planId: f.planId,
      selections: choose(f.items.slice(0, 2), approvals),
      mode,
    };
    const accepted = await f.signed.mutation(
      api.planning.accept.selected,
      args,
    );
    expect(accepted).toHaveLength(2);
    expect((await f.t.run((ctx) => ctx.db.get(f.items[2]._id)))!.status).toBe(
      "proposed",
    );
    await f.signed.mutation(api.editorial.reviews.configure, {
      ...scope,
      accountId: null,
      expectedRevision: 1,
      commandKey: "planning-policy-P2",
      policy: { editorial: true, brand: false },
    });
    await f.signed.mutation(api.editorial.cancel, {
      ...scope,
      scheduleId: accepted[0].scheduleId,
      expectedGeneration: 1,
    });
    await f.signed.mutation(api.editorial.revoke, {
      ...scope,
      approvalId: accepted[0].approvalId,
    });
    expect(await f.signed.mutation(api.planning.accept.selected, args)).toEqual(
      accepted,
    );
    expect(
      (await f.t.run((ctx) => ctx.db.get(accepted[0].scheduleId)))!.state,
    ).toBe("cancelled");
  },
);
test("TASK50 planning usable approval projection follows current policy and reports bounded approval coverage", async () => {
  const f = await workPlan(),
    scope = { workspaceId: f.workspaceId },
    item = f.items[0];
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    ...scope,
    accountId: f.accountId,
    versionId: item.versionId,
  });
  const read = () =>
    f.signed.query(api.planning.plans.get, { ...scope, planId: f.planId });
  expect((await read())!.items[0].approvalId).toBe(approvalId);
  await f.signed.mutation(api.editorial.reviews.configure, {
    ...scope,
    accountId: null,
    expectedRevision: 0,
    commandKey: "badge-P2",
    policy: { editorial: true, brand: false },
  });
  expect((await read())!.items[0].approvalId).toBeNull();
  const state = await f.signed.query(api.editorial.reviews.get, {
    ...scope,
    versionId: item.versionId,
  });
  await f.signed.mutation(api.editorial.reviews.decide, {
    ...scope,
    versionId: item.versionId,
    stage: "editorial",
    policyId: state.policyId,
    expectedRevision: state.revision,
    commandKey: "badge-stage",
  });
  const current = await f.signed.mutation(api.editorial.approve, {
    ...scope,
    accountId: f.accountId,
    versionId: item.versionId,
  });
  expect((await read())!.items[0].approvalId).toBe(current);
  await f.t.run(async (ctx) => {
    const row = (await ctx.db.get(current))!,
      { _id, _creationTime, ...data } = row;
    for (let i = 0; i < 100; i++)
      await ctx.db.insert("approvals", { ...data, revokedAt: Date.now() });
  });
  expect((await read())!.items[0].approvalsLimited).toBe(true);
});

test.each([
  "empty-with-horizon",
  "unknown-ids",
  "unknown-horizon",
  "null-consumed-horizon",
  "overflow",
] as const)(
  "TASK50 accepted planning replay denies erased or unknown original context (%s)",
  async (kind) => {
    const f = await workPlan(),
      args = {
        workspaceId: f.workspaceId,
        planId: f.planId,
        selections: choose(f.items),
        mode: "approve_and_schedule" as const,
      };
    await f.signed.mutation(api.planning.accept.selected, args);
    await f.t.run((ctx) =>
      ctx.db.patch(
        f.items[0]._id,
        kind === "empty-with-horizon"
          ? { historyVersionIds: [], contextProofUntil: Date.now() + 60000 }
          : kind === "unknown-ids"
            ? { historyVersionIds: undefined }
            : kind === "unknown-horizon"
              ? {
                  historyVersionIds: [f.items[0].versionId],
                  contextProofUntil: undefined,
                }
              : kind === "null-consumed-horizon"
                ? {
                    historyVersionIds: [f.items[0].versionId],
                    contextProofUntil: null,
                  }
                : {
                    historyVersionIds: Array.from(
                      { length: 11 },
                      () => f.items[0].versionId,
                    ),
                    contextProofUntil: Date.now() + 60000,
                  },
      ),
    );
    const snapshot = () =>
        f.t.run(async (ctx) => ({
          items: await ctx.db.query("contentPlanItems").collect(),
          approvals: await ctx.db.query("approvals").collect(),
          schedules: await ctx.db.query("schedules").collect(),
          jobs: await ctx.db.system.query("_scheduled_functions").collect(),
        })),
      before = await snapshot();
    await expect(
      f.signed.mutation(api.planning.accept.selected, args),
    ).rejects.toThrow("PLAN_CONTEXT_CHANGED");
    expect(await snapshot()).toEqual(before);
  },
);
