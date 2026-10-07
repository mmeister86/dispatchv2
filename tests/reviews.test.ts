import { afterEach, expect, test, vi } from "vitest";
import { mediaFixture } from "./media-fixture";
import { api, internal, components } from "../convex/_generated/api";
import { preflight } from "../convex/publishing";
import { localInput } from "../src/lib/time";
import { seal } from "../convex/lib/crypto";
import { association } from "../convex/integrations/x/fields";

const reviews = api.editorial.reviews;
test.each([false, true])(
  "separate public scheduler root loss blocks future sends and preserves started receipt %s",
  async (started) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T04:00Z"));
    vi.stubEnv(
      "INTEGRATION_ENCRYPTION_KEY",
      Buffer.alloc(32, 1).toString("base64"),
    );
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "fixture");
    const f = await fixture(),
      scheduler = await join(f, "Owner");
    await f.configure(true, false);
    await f.decide("editorial");
    const approvalId = await f.approve();
    await f.t.run(async (ctx) => {
      await ctx.db.insert("xBindings", {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        providerIdentity: "review-fixture",
        changedSequence: 1,
        changedAt: Date.now(),
      });
      await ctx.db.insert("xCredentials", {
        workspaceId: f.workspaceId,
        accountId: f.accountId,
        generation: 1,
        envelope: await seal(
          { accessToken: "synthetic-token" },
          association(f.workspaceId, f.accountId),
        ),
        scopes: ["tweet.read", "users.read", "tweet.write", "media.write"],
        expiresAt: Date.now() + 86400000,
        leaseUntil: 0,
        cleanAfter: Date.now() + 86400000,
      });
    });
    const at = Date.now() + 3600000;
    const scheduleId = await scheduler.signed.mutation(api.editorial.schedule, {
      ...f.scope,
      versionId: f.versionId,
      accountId: f.accountId,
      approvalId,
      at,
      timezone: "UTC",
      localTime: localInput(new Date(at).toISOString(), "UTC"),
    });
    const job = { scheduleId, generation: 1 };
    vi.setSystemTime(at);
    expect(await f.t.mutation(internal.publishing.claim, job)).not.toBeNull();
    const attempt = (await f.t.mutation(
      internal.publishing.attempts.claim,
      job,
    ))!;
    expect(attempt).not.toBeNull();
    expect(
      await f.t.query(internal.integrations.x.oauth.scheduleSource, {
        ...job,
        operation: "text",
      }),
    ).toHaveProperty("generation", 1);
    const send = {
      attemptId: attempt._id,
      claimSequence: attempt.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    };
    if (started)
      expect(
        await f.t.mutation(internal.publishing.attempts.beforeSend, send),
      ).toBe(true);
    const before = await f.t.run(async (ctx) => ({
      schedule: await ctx.db.get(scheduleId),
      approval: await ctx.db.get(approvalId),
      membership: await ctx.db.get(scheduler.membershipId),
      credentials: await ctx.db.query("xCredentials").collect(),
      finance: await ctx.db.query("aiAttempts").collect(),
      attempt: await ctx.db.get(attempt._id),
    }));
    expect(before.schedule!.actorId).toBe(scheduler.userId);
    expect(before.approval!.actorId).toBe(f.userId);
    await f.t.run((ctx) => ctx.db.delete(scheduler.userId));
    expect(await f.t.run((ctx) => ctx.db.get(scheduler.membershipId))).toEqual(
      before.membership,
    );
    await expect(
      f.t.run(async (ctx) => preflight(ctx, (await ctx.db.get(scheduleId))!)),
    ).rejects.toThrow("SCHEDULER_AUTHORITY_CHANGED");
    await expect(
      f.t.query(internal.integrations.x.oauth.scheduleSource, {
        ...job,
        operation: "text",
      }),
    ).rejects.toThrow("SCHEDULER_AUTHORITY_CHANGED");
    if (!started) {
      await expect(
        f.t.mutation(internal.publishing.attempts.beforeSend, send),
      ).rejects.toThrow("SCHEDULER_AUTHORITY_CHANGED");
      expect(await f.t.run((ctx) => ctx.db.get(attempt._id))).toEqual(
        before.attempt,
      );
    } else {
      const receipt = {
        attemptId: attempt._id,
        claimSequence: attempt.claimSequence,
        outcome: "confirmed" as const,
        externalId: "501",
        durationMs: 1,
      };
      await f.t.mutation(internal.publishing.attempts.receipt, receipt);
      const settled = await f.t.run(async (ctx) => ({
        schedule: await ctx.db.get(scheduleId),
        attempt: await ctx.db.get(attempt._id),
      }));
      expect(settled.attempt).toMatchObject({
        stage: "confirmed",
        externalId: "501",
        durationMs: before.attempt!.durationMs + 1,
      });
      expect(settled.schedule).toMatchObject({
        actorId: scheduler.userId,
        reviewPin: before.schedule!.reviewPin,
        generation: 1,
        state: "partially_published",
        publishedCount: 1,
      });
      expect(settled.schedule!.externalPosts).toHaveLength(1);
      await f.t.mutation(internal.publishing.attempts.receipt, receipt);
      expect(
        await f.t.run(async (ctx) => ({
          schedule: await ctx.db.get(scheduleId),
          attempt: await ctx.db.get(attempt._id),
        })),
      ).toEqual(settled);
    }
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(
        new Error("Unexpected physical HTTP after scheduler root loss"),
      );
    await f.t.action(internal.publishing.workflows.step, job);
    expect(fetch).toHaveBeenCalledTimes(0);
    expect(
      await f.t.run((ctx) => ctx.db.query("xPostAttempts").collect()),
    ).toHaveLength(1);
    expect(
      await f.t.run(async (ctx) => ({
        approval: await ctx.db.get(approvalId),
        credentials: await ctx.db.query("xCredentials").collect(),
        finance: await ctx.db.query("aiAttempts").collect(),
      })),
    ).toEqual({
      approval: before.approval,
      credentials: before.credentials,
      finance: before.finance,
    });
  },
);
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  const f = await mediaFixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "review-fixture",
      name: "Review fixture",
      handle: "review-fixture",
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
    title: "Exact review source",
    text: ["A native review fixture"],
    accountId,
    media: [],
    pillar: "Product",
    strategy: "manual",
  };
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content,
    source: "Manual",
  });
  const versionId = (await f.t.run((ctx) => ctx.db.get(draftId)))!
    .currentVersionId!;
  const scope = { workspaceId: f.workspaceId };
  const configure = async (
    editorial: boolean,
    brand: boolean,
    account: typeof accountId | null = null,
    commandKey = crypto.randomUUID(),
  ) => {
    const p = await f.signed.query(reviews.policy, {
      ...scope,
      accountId: account,
    });
    return f.signed.mutation(reviews.configure, {
      ...scope,
      accountId: account,
      expectedRevision: p.revision,
      commandKey,
      policy: { editorial, brand },
    });
  };
  const decide = async (stage: "editorial" | "brand") => {
    const state = await f.signed.query(reviews.get, { ...scope, versionId });
    return f.signed.mutation(reviews.decide, {
      ...scope,
      versionId,
      stage,
      policyId: state.policyId,
      expectedRevision: state.revision,
      commandKey: crypto.randomUUID(),
    });
  };
  const approve = () =>
    f.signed.mutation(api.editorial.approve, {
      ...scope,
      versionId,
      accountId,
    });
  const schedule = (approvalId: Awaited<ReturnType<typeof approve>>) => {
    const at = Math.floor(Date.now() / 60000) * 60000 + 3600000;
    return f.signed.mutation(api.editorial.schedule, {
      ...scope,
      versionId,
      accountId,
      approvalId,
      at,
      timezone: "UTC",
      localTime: localInput(new Date(at).toISOString(), "UTC"),
    });
  };
  return {
    ...f,
    scope,
    accountId,
    draftId,
    versionId,
    content,
    configure,
    decide,
    approve,
    schedule,
  };
}
test("default OFF preserves genuine single-owner approval and stored native preflight", async () => {
  const f = await fixture();
  const approvalId = await f.approve();
  const id = await f.schedule(approvalId);
  expect(
    await f.t.run(
      async (ctx) => (await preflight(ctx, (await ctx.db.get(id))!))._id,
    ),
  ).toBe(f.versionId);
});
test("enabled exact ordered stages require native public decisions and allow the same eligible actor", async () => {
  const f = await fixture();
  await f.configure(true, true);
  await expect(f.approve()).rejects.toThrow("REVIEW_REQUIRED");
  await expect(f.decide("brand")).rejects.toThrow("REVIEW_REQUIRED");
  await f.decide("editorial");
  await expect(f.approve()).rejects.toThrow("REVIEW_REQUIRED");
  await f.decide("brand");
  const approvalId = await f.approve();
  const id = await f.schedule(approvalId);
  const approval = await f.t.run((ctx) => ctx.db.get(approvalId));
  expect(approval).toHaveProperty("reviewPin.decisionIds.length", 2);
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.reviewPin).toEqual(
    approval!.reviewPin,
  );
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("contentFeedback")
        .withIndex("by_versionId_and_sourceUnavailable", (q) =>
          q.eq("versionId", f.versionId).eq("sourceUnavailable", false),
        )
        .take(10),
    ),
  ).toHaveLength(1);
});
test("old approval cannot newly schedule under P2 while stored P1 preflight and pure move remain frozen", async () => {
  const f = await fixture();
  await f.configure(true, false);
  await f.decide("editorial");
  const approvalId = await f.approve(),
    id = await f.schedule(approvalId);
  const original = (await f.t.run((ctx) => ctx.db.get(id)))!;
  await f.configure(true, true);
  await expect(f.schedule(approvalId)).rejects.toThrow("REVIEW_POLICY_CHANGED");
  expect(
    await f.t.run(
      async (ctx) => (await preflight(ctx, (await ctx.db.get(id))!))._id,
    ),
  ).toBe(f.versionId);
  const at = original.at + 3600000;
  await f.signed.mutation(api.editorial.reschedule, {
    ...f.scope,
    scheduleId: id,
    expectedGeneration: 1,
    versionId: original.versionId,
    approvalId: original.approvalId,
    at,
    timezone: "UTC",
    localTime: localInput(new Date(at).toISOString(), "UTC"),
  });
  const moved = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(moved.reviewPin).toEqual(original.reviewPin);
  expect(moved.actorId).toBe(original.actorId);
});

async function join(
  f: Awaited<ReturnType<typeof fixture>>,
  role: "Owner" | "Admin" | "Editor" | "Viewer",
) {
  const email = `${crypto.randomUUID()}@review.example.test`;
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Reviewer",
          email,
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
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
      },
    );
    return { subject: u._id, sessionId: session._id };
  });
  const signed = f.t.withIdentity(identity),
    state = await f.signed.query(api.team.list, f.scope);
  const issued = await f.signed.mutation(api.team.change, {
    ...f.scope,
    commandKey: crypto.randomUUID(),
    expectedRevision: state.revision,
    action: { kind: "invite", email, role, lifetimeDays: 1 },
  });
  if (!issued.invitationId)
    throw new Error("Expected actual public invitation");
  const preview = await signed.query(api.team.preview, {
    invitationId: issued.invitationId,
  });
  if (!preview) throw new Error("Expected verified actual recipient preview");
  const result = await signed.mutation(api.team.accept, {
    invitationId: issued.invitationId,
    expectedRevision: preview.revision,
    commandKey: crypto.randomUUID(),
  });
  if (!result.userId || !result.membershipId)
    throw new Error("Expected actual accepted membership");
  await signed.mutation(api.workspaces.select, f.scope);
  return { signed, userId: result.userId, membershipId: result.membershipId };
}
async function role(
  f: Awaited<ReturnType<typeof fixture>>,
  membershipId: Awaited<ReturnType<typeof join>>["membershipId"],
  value: "Owner" | "Admin" | "Editor" | "Viewer",
  signed = f.signed,
) {
  const state = await signed.query(api.team.list, f.scope);
  return signed.mutation(api.team.change, {
    ...f.scope,
    commandKey: crypto.randomUUID(),
    expectedRevision: state.revision,
    action: { kind: "role", membershipId, role: value },
  });
}
async function decision(
  f: Awaited<ReturnType<typeof fixture>>,
  signed = f.signed,
  stage: "editorial" | "brand" = "editorial",
  commandKey = crypto.randomUUID(),
) {
  const state = await signed.query(reviews.get, {
    ...f.scope,
    versionId: f.versionId,
  });
  const args = {
    ...f.scope,
    versionId: f.versionId,
    stage,
    policyId: state.policyId,
    expectedRevision: state.revision,
    commandKey,
  };
  return { args, result: await signed.mutation(reviews.decide, args) };
}
test("decision receipts are cleared after terminal decision source loss, including unexpired commands", async () => {
  const f = await fixture();
  await f.configure(true, false);
  const d = await decision(f);
  await f.t.run((ctx) =>
    ctx.db.patch(d.result.decisionId!, {
      sourceUnavailable: true,
      active: false,
      reviewerId: undefined,
    }),
  );
  await expect(f.signed.mutation(reviews.decide, d.args)).rejects.toThrow(
    "REVIEW_COMMAND_UNAVAILABLE",
  );
  await f.t.mutation(internal.editorial.reviews.sweep, {
    cursor: null,
    phase: "commands",
  });
  const command = await f.t.run((ctx) =>
    ctx.db
      .query("editorialReviewCommands")
      .withIndex("by_workspaceId_and_actorId_and_commandKey", (q) =>
        q
          .eq("workspaceId", f.workspaceId)
          .eq("actorId", f.userId)
          .eq("commandKey", d.args.commandKey),
      )
      .unique(),
  );
  expect(command).toMatchObject({ sourceUnavailable: true, sourceUntil: null });
  expect(command?.fingerprint).toBeUndefined();
  expect(command?.result).toBeUndefined();
});
test("actual verified Editor reviews, Viewer cannot, and role regrant restores only before physical cleanup", async () => {
  const f = await fixture(),
    editor = await join(f, "Editor"),
    viewer = await join(f, "Viewer");
  await f.configure(true, false);
  await expect(decision(f, viewer.signed)).rejects.toThrow(
    "ROLE_ACCESS_DENIED",
  );
  await expect(decision(f, editor.signed, "brand")).rejects.toThrow(
    "ROLE_ACCESS_DENIED",
  );
  const d = await decision(f, editor.signed),
    approvalId = await f.approve(),
    id = await f.schedule(approvalId);
  const proof = () =>
    f.t.run(async (ctx) => preflight(ctx, (await ctx.db.get(id))!));
  await role(f, editor.membershipId, "Viewer");
  expect(
    (await f.signed.query(reviews.get, { ...f.scope, versionId: f.versionId }))
      .editorialDecisionId,
  ).toBeNull();
  await expect(proof()).rejects.toThrow("REVIEW_REVIEWER_UNAVAILABLE");
  await role(f, editor.membershipId, "Editor");
  expect((await proof())._id).toBe(f.versionId);
  await role(f, editor.membershipId, "Viewer");
  vi.useFakeTimers();
  await f.t.mutation(internal.editorial.reviews.sweep, {
    cursor: null,
    phase: "decisions",
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  const terminal = await f.t.run((ctx) => ctx.db.get(d.result.decisionId!));
  expect(terminal).toMatchObject({ active: false, sourceUnavailable: true });
  expect(terminal?.reviewerId).toBeUndefined();
  await role(f, editor.membershipId, "Editor");
  await expect(proof()).rejects.toThrow("REVIEW_DECISION_WITHDRAWN");
  await expect(editor.signed.mutation(reviews.decide, d.args)).rejects.toThrow(
    "REVIEW_COMMAND_UNAVAILABLE",
  );
});
test("policy author demotion does not switch policy OFF; current reviewer and final owner remain independent", async () => {
  const f = await fixture(),
    owner = await join(f, "Owner");
  await f.configure(true, true);
  const originalMembership = await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique(),
  );
  await role(f, originalMembership!._id, "Viewer", owner.signed);
  await expect(
    owner.signed.mutation(api.editorial.approve, {
      ...f.scope,
      versionId: f.versionId,
      accountId: f.accountId,
    }),
  ).rejects.toThrow("REVIEW_REQUIRED");
  await decision(f, owner.signed);
  await decision(f, owner.signed, "brand");
  const approvalId = await owner.signed.mutation(api.editorial.approve, {
    ...f.scope,
    versionId: f.versionId,
    accountId: f.accountId,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(approvalId)))!.reviewPin?.decisionIds,
  ).toHaveLength(2);
  expect(
    (
      await owner.signed.query(reviews.get, {
        ...f.scope,
        versionId: f.versionId,
      })
    ).editorial,
  ).toBe(true);
});
test("policy CAS and actor-key immutable replay, explicit account OFF and clearing override to inherit", async () => {
  const f = await fixture();
  const args = {
    ...f.scope,
    accountId: null,
    expectedRevision: 0,
    commandKey: "policy-retry",
    policy: { editorial: true, brand: true },
  };
  const first = await f.signed.mutation(reviews.configure, args);
  expect(await f.signed.mutation(reviews.configure, args)).toEqual(first);
  await expect(
    f.signed.mutation(reviews.configure, {
      ...args,
      policy: { editorial: false, brand: true },
    }),
  ).rejects.toThrow("REVIEW_COMMAND_CONFLICT");
  await expect(
    f.signed.mutation(reviews.configure, {
      ...args,
      commandKey: "fresh-stale",
    }),
  ).rejects.toThrow("REVIEW_REVISION_CONFLICT");
  await f.configure(false, false, f.accountId);
  expect(await f.approve()).toBeTruthy();
  const local = await f.signed.query(reviews.policy, {
    ...f.scope,
    accountId: f.accountId,
  });
  await f.signed.mutation(reviews.configure, {
    ...f.scope,
    accountId: f.accountId,
    expectedRevision: local.revision,
    commandKey: "inherit",
    policy: null,
  });
  await expect(f.approve()).rejects.toThrow("REVIEW_REQUIRED");
  const row = await f.t.run((ctx) => ctx.db.get(first.policyId!));
  expect(row).toMatchObject({ editorial: true, brand: true, revision: 1 });
});
test("withdrawal is terminal, CAS and intent remain exact and new version/account never inherit review", async () => {
  const f = await fixture();
  await f.configure(true, false);
  const d = await decision(f);
  expect(await f.signed.mutation(reviews.decide, d.args)).toEqual(d.result);
  await expect(
    f.signed.mutation(reviews.decide, { ...d.args, stage: "brand" }),
  ).rejects.toThrow("REVIEW_COMMAND_CONFLICT");
  await expect(
    f.signed.mutation(reviews.withdraw, {
      ...f.scope,
      decisionId: d.result.decisionId!,
      expectedRevision: 0,
      commandKey: "stale-withdraw",
    }),
  ).rejects.toThrow("REVIEW_REVISION_CONFLICT");
  const withdrawal = {
    ...f.scope,
    decisionId: d.result.decisionId!,
    expectedRevision: 1,
    commandKey: "withdraw",
  };
  const done = await f.signed.mutation(reviews.withdraw, withdrawal);
  expect(await f.signed.mutation(reviews.withdraw, withdrawal)).toEqual(done);
  await expect(f.approve()).rejects.toThrow("REVIEW_REQUIRED");
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.result.decisionId!)))!.active,
  ).toBe(false);
  await decision(f);
  const approvalId = await f.approve(),
    id = await f.schedule(approvalId);
  const secondAccount = await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(f.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return ctx.db.insert("socialAccounts", {
      ...fields,
      providerIdentity: "other",
    });
  });
  const versionId = await f.signed.mutation(api.editorial.save, {
    ...f.scope,
    draftId: f.draftId,
    expectedRevision: 1,
    content: { ...f.content, accountId: secondAccount },
    reason: "Actual account change",
  });
  await expect(
    f.signed.mutation(api.editorial.approve, {
      ...f.scope,
      versionId,
      accountId: secondAccount,
    }),
  ).rejects.toThrow("REVIEW_REQUIRED");
  await expect(
    f.signed.mutation(reviews.decide, { ...d.args, versionId }),
  ).rejects.toThrow("REVIEW_COMMAND_CONFLICT");
  await expect(
    f.signed.mutation(api.editorial.reschedule, {
      ...f.scope,
      scheduleId: id,
      expectedGeneration: 1,
      versionId,
      at: Date.now() + 7200000,
      timezone: "UTC",
      localTime: localInput(
        new Date(Date.now() + 7200000).toISOString(),
        "UTC",
      ),
    }),
  ).rejects.toThrow();
  const foreign = await f.signed.mutation(api.workspaces.create, {
    name: "Foreign review scope",
    description: "",
  });
  await expect(
    f.signed.query(reviews.get, {
      workspaceId: foreign,
      versionId: f.versionId,
    }),
  ).rejects.toThrow("REVIEW_SOURCE_UNAVAILABLE");
});
test("exact old comment source guard ignores a healthy latest version and produces no review or feedback", async () => {
  const f = await fixture();
  await f.configure(true, true);
  const commentId = await f.signed.mutation(api.editorial.addComment, {
    ...f.scope,
    versionId: f.versionId,
    text: "Historical comment",
  });
  await f.signed.mutation(api.editorial.save, {
    ...f.scope,
    draftId: f.draftId,
    expectedRevision: 1,
    content: { ...f.content, title: "New" },
    reason: "New version",
  });
  const feedbackBefore = await f.t.run((ctx) =>
    ctx.db.query("contentFeedback").take(10),
  );
  await f.signed.mutation(api.editorial.resolveComment, {
    ...f.scope,
    commentId,
    expectedResolved: false,
  });
  await f.signed.mutation(api.editorial.assign, {
    ...f.scope,
    draftId: f.draftId,
    assigneeId: f.userId,
  });
  await expect(f.approve()).rejects.toThrow("REVIEW_REQUIRED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, { sourceUnavailable: true }),
  );
  await expect(
    f.signed.mutation(api.editorial.resolveComment, {
      ...f.scope,
      commentId,
      expectedResolved: true,
    }),
  ).rejects.toThrow("REVIEW_SOURCE_UNAVAILABLE");
  expect((await f.t.run((ctx) => ctx.db.get(commentId)))!.resolved).toBe(true);
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialReviewDecisions").take(10)),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("contentFeedback").take(10)),
  ).toEqual(feedbackBefore);
});
test("bounded indexed sweep traverses eligible first rows and root-gone null-horizon reviews beyond one page", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  await f.configure(true, false);
  const rows: {
    versionId: typeof f.versionId;
    decisionId: NonNullable<
      Awaited<ReturnType<typeof decision>>["result"]["decisionId"]
    >;
  }[] = [];
  for (let i = 0; i < 110; i++) {
    const draftId = await f.signed.mutation(api.editorial.create, {
      ...f.scope,
      content: { ...f.content, title: `Review ${i}` },
      source: "Manual",
    });
    const versionId = (await f.t.run((ctx) => ctx.db.get(draftId)))!
      .currentVersionId!;
    const state = await f.signed.query(reviews.get, { ...f.scope, versionId });
    const result = await f.signed.mutation(reviews.decide, {
      ...f.scope,
      versionId,
      stage: "editorial",
      policyId: state.policyId,
      expectedRevision: state.revision,
      commandKey: `review-${i}`,
    });
    rows.push({ versionId, decisionId: result.decisionId! });
  }
  await f.t.run(async (ctx) => {
    for (const r of rows.slice(55)) await ctx.db.delete(r.versionId);
  });
  await f.t.mutation(internal.editorial.reviews.sweep, {
    cursor: null,
    phase: "decisions",
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  const decisions = await f.t.run((ctx) =>
    Promise.all(rows.map((r) => ctx.db.get(r.decisionId))),
  );
  expect(
    decisions
      .slice(0, 55)
      .every(
        (d) => d?.active && !d.sourceUnavailable && d.sourceUntil === null,
      ),
  ).toBe(true);
  expect(
    decisions
      .slice(55)
      .every((d) => d?.sourceUnavailable && !d.reviewerId && !d.active),
  ).toBe(true);
  const commands = await f.t.run((ctx) =>
    ctx.db.query("editorialReviewCommands").take(120),
  );
  expect(
    commands.filter((c) => c.kind === "editorial" && c.sourceUnavailable),
  ).toHaveLength(55);
  expect(
    commands.filter((c) => c.kind === "editorial" && !c.sourceUnavailable),
  ).toHaveLength(55);
  expect(
    commands
      .filter((c) => c.sourceUnavailable)
      .every((c) => c.fingerprint === undefined && c.result === undefined),
  ).toBe(true);
});
async function noteSource(
  f: Awaited<ReturnType<typeof fixture>>,
  count = 1,
  until: number | null = null,
) {
  return f.t.run(async (ctx) => {
    let parent:
      import("../convex/_generated/dataModel").Id<"ideaVersions"> | undefined;
    for (let i = 0; i < count; i++) {
      const ideaId = await ctx.db.insert("ideas", {
        workspaceId: f.workspaceId,
        actorId: f.userId,
        operationKey: crypto.randomUUID(),
        fingerprint: "synthetic-source",
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
        title: "Exact consumed note",
        note: "Native source fixture",
        perspective: "",
        priority: "normal",
        source: { kind: "note" },
        originals: [],
        rationale: "",
        questions: [],
        ...(parent ? { inputVersionId: parent } : {}),
        ...(until === null ? {} : { researchProofUntil: until }),
      });
      await ctx.db.patch(ideaId, { currentVersionId: parent });
    }
    await ctx.db.patch(f.versionId, { ideaVersionId: parent });
    return parent!;
  });
}
test("exact reverse producer drains root-gone non-Research reviews without purging healthy note sources", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    root = await noteSource(f);
  await f.configure(true, false);
  const d = await decision(f);
  await f.t.mutation(internal.research.contentCleanup.version, {
    versionId: root,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.result.decisionId!)))!
      .sourceUnavailable,
  ).toBe(false);
  await f.t.run((ctx) => ctx.db.delete(root));
  await f.t.mutation(internal.research.contentCleanup.version, {
    versionId: root,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.result.decisionId!)))!
      .sourceUnavailable,
  ).toBe(true);
  const commands = await f.t.run((ctx) =>
    ctx.db
      .query("editorialReviewCommands")
      .withIndex("by_versionId_and_sourceUnavailable", (q) =>
        q.eq("versionId", f.versionId).eq("sourceUnavailable", true),
      )
      .take(10),
  );
  expect(commands).toHaveLength(1);
  expect(commands[0].fingerprint).toBeUndefined();
  expect(commands[0].result).toBeUndefined();
});
test("review cleanup propagates original ancestry ceiling and unknown failures atomically", async () => {
  const f = await fixture();
  await f.configure(true, false);
  await noteSource(f);
  await decision(f);
  const before = await f.t.run(async (ctx) => ({
    decisions: await ctx.db.query("editorialReviewDecisions").take(10),
    commands: await ctx.db.query("editorialReviewCommands").take(10),
  }));
  await noteSource(f, 40);
  await expect(
    f.t.mutation(internal.editorial.reviews.sweep, {
      cursor: null,
      phase: "decisions",
    }),
  ).rejects.toThrow("STYLE_ANCESTRY_LIMIT");
  expect(
    await f.t.run(async (ctx) => ({
      decisions: await ctx.db.query("editorialReviewDecisions").take(10),
      commands: await ctx.db.query("editorialReviewCommands").take(10),
    })),
  ).toEqual(before);
  const proof = await import("../convex/research/contentProof");
  vi.spyOn(proof, "draftResearchProof").mockRejectedValueOnce(
    new Error("synthetic native resource failure"),
  );
  await expect(
    f.t.mutation(internal.editorial.reviews.sweep, {
      cursor: null,
      phase: "commands",
    }),
  ).rejects.toThrow("synthetic native resource failure");
  expect(
    await f.t.run(async (ctx) => ({
      decisions: await ctx.db.query("editorialReviewDecisions").take(10),
      commands: await ctx.db.query("editorialReviewCommands").take(10),
    })),
  ).toEqual(before);
});
test("original decision source clock cannot renew after underlying note source renewal", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    original = Date.now() + 600000,
    root = await noteSource(f, 1, original);
  await f.configure(true, false);
  const d = await decision(f);
  await f.t.run((ctx) =>
    ctx.db.patch(root, { researchProofUntil: original + 86400000 }),
  );
  const approvalId = await f.approve();
  expect(
    (await f.t.run((ctx) => ctx.db.get(approvalId)))!.reviewPin?.sourceUntil,
  ).toBe(original);
  vi.setSystemTime(original + 1);
  await expect(f.approve()).rejects.toThrow("REVIEW_SOURCE_UNAVAILABLE");
  await f.t.mutation(internal.editorial.reviews.sweep, {
    cursor: null,
    phase: "decisions",
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.result.decisionId!)))!
      .sourceUnavailable,
  ).toBe(true);
});
test("consumed retained style stays valid after retirement and source erasure physically closes public review", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    { modelFixture } = await import("./model-fixture"),
    m = await modelFixture(f);
  const scope = { ...f.scope, accountId: m.accountId },
    payload = {
      author: "Human assertion",
      experiences: [],
      tone: "Clear",
      positioning: "",
      pillars: [{ name: "Product", weight: 100 }],
      examples: [],
      forbidden: [],
    };
  const saved = await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 0,
    commandKey: "style-save",
    action: {
      kind: "save",
      payload,
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Human declaration",
    },
  });
  await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 1,
    commandKey: "style-select",
    action: {
      kind: "select",
      versionId: saved.versionId!,
      reason: "Native consumed selection",
    },
  });
  const runId = await m.create();
  const content = { ...f.content, accountId: m.accountId };
  const versionId = await f.signed.mutation(api.editorial.save, {
    ...f.scope,
    draftId: f.draftId,
    expectedRevision: 1,
    content,
    reason: "Actual source account",
  });
  const styled = { ...f, versionId, accountId: m.accountId, content },
    root = await noteSource(styled);
  await f.t.run((ctx) => ctx.db.patch(root, { runId }));
  await f.configure(true, false);
  const d = await decision(styled);
  await f.signed.mutation(api.ai.styleProfiles.change, {
    ...scope,
    expectedRevision: 2,
    commandKey: "style-retire",
    action: {
      kind: "retire",
      versionId: saved.versionId!,
      reason: "Retain historical consumed source",
    },
  });
  expect(
    (await f.signed.query(reviews.get, { ...f.scope, versionId }))
      .editorialDecisionId,
  ).toBe(d.result.decisionId);
  await f.t.run((ctx) =>
    ctx.db.patch(saved.versionId!, {
      sourceUnavailable: true,
      payload: null,
      status: "erased",
    }),
  );
  await expect(
    f.signed.query(reviews.get, { ...f.scope, versionId }),
  ).rejects.toThrow("STYLE_SOURCE_UNAVAILABLE");
  await f.t.mutation(internal.editorial.reviews.sweep, {
    cursor: null,
    phase: "decisions",
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.result.decisionId!)))!
      .sourceUnavailable,
  ).toBe(true);
  expect(
    (await f.t.run((ctx) => ctx.db.get(runId)))!.styleContext?.versionId,
  ).toBe(saved.versionId);
});
test("legacy unpinned schedule remains honest pre-50 OFF while fresh admission follows enabled policy", async () => {
  const f = await fixture(),
    approvalId = await f.approve(),
    id = await f.schedule(approvalId);
  // Existing unpinned records represent pre-50 OFF, without synthetic decision or policy backfill.
  await f.t.run(async (ctx) => {
    await ctx.db.patch(approvalId, { reviewPin: undefined });
    await ctx.db.patch(id, { reviewPin: undefined });
  });
  await f.configure(true, true);
  expect(
    (await f.t.run(async (ctx) => preflight(ctx, (await ctx.db.get(id))!)))._id,
  ).toBe(f.versionId);
  await expect(f.schedule(approvalId)).rejects.toThrow("REVIEW_POLICY_CHANGED");
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.reviewPin).toBeUndefined();
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialReviewDecisions").take(10)),
  ).toHaveLength(0);
});
test("known missing immutable policy cannot project OFF or retain executable stage receipts", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    p = await f.configure(true, false),
    d = await decision(f);
  await f.t.run((ctx) => ctx.db.delete(p.policyId!));
  await expect(
    f.signed.query(reviews.policy, { ...f.scope, accountId: null }),
  ).rejects.toThrow("REVIEW_POLICY_CHANGED");
  await expect(f.signed.mutation(reviews.decide, d.args)).rejects.toThrow(
    "REVIEW_COMMAND_UNAVAILABLE",
  );
  await f.t.mutation(internal.editorial.reviews.sweep, {
    cursor: null,
    phase: "decisions",
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  expect(
    (await f.t.run((ctx) => ctx.db.get(d.result.decisionId!)))!
      .sourceUnavailable,
  ).toBe(true);
  expect(
    (
      await f.t.run((ctx) => ctx.db.query("editorialReviewCommands").take(10))
    ).every((c) => c.sourceUnavailable && !c.result && !c.fingerprint),
  ).toBe(true);
});
test("concurrent native stage commands serialize one CAS decision without changing content revision", async () => {
  const f = await fixture(),
    p = await f.configure(true, false);
  const args = {
    ...f.scope,
    versionId: f.versionId,
    policyId: p.policyId,
    stage: "editorial" as const,
    expectedRevision: 0,
  };
  const results = await Promise.allSettled([
    f.signed.mutation(reviews.decide, { ...args, commandKey: "race-one" }),
    f.signed.mutation(reviews.decide, { ...args, commandKey: "race-two" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  const rejected = results.find((r) => r.status === "rejected");
  if (rejected?.status === "rejected")
    expect(String(rejected.reason)).toContain("REVIEW_REVISION_CONFLICT");
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialReviewDecisions").take(10)),
  ).toHaveLength(1);
  expect((await f.t.run((ctx) => ctx.db.get(f.draftId)))!.revision).toBe(1);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.versionId)))!.reviewRevision,
  ).toBe(1);
});
test("actual replacement captures new authorized scheduler while pure move never transfers original scheduler authority", async () => {
  const f = await fixture(),
    owner = await join(f, "Owner");
  const approvalId = await owner.signed.mutation(api.editorial.approve, {
    ...f.scope,
    versionId: f.versionId,
    accountId: f.accountId,
  });
  const id = await f.schedule(approvalId),
    original = (await f.t.run((ctx) => ctx.db.get(id)))!;
  const move = {
    ...f.scope,
    scheduleId: id,
    expectedGeneration: 1,
    versionId: f.versionId,
    approvalId,
    at: original.at + 3600000,
    timezone: "UTC",
    localTime: localInput(new Date(original.at + 3600000).toISOString(), "UTC"),
  };
  await owner.signed.mutation(api.editorial.reschedule, move);
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.actorId).toBe(f.userId);
  const oldMembership = (await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique(),
  ))!;
  await role(f, oldMembership._id, "Viewer", owner.signed);
  await expect(
    f.t.run(async (ctx) => preflight(ctx, (await ctx.db.get(id))!)),
  ).rejects.toThrow("SCHEDULER_AUTHORITY_CHANGED");
  const versionId = await owner.signed.mutation(api.editorial.save, {
    ...f.scope,
    draftId: f.draftId,
    expectedRevision: 1,
    content: { ...f.content, title: "Current replacement" },
    reason: "Explicit new admission",
  });
  const p = await owner.signed.mutation(reviews.configure, {
    ...f.scope,
    accountId: null,
    expectedRevision: 0,
    commandKey: "replacement-policy",
    policy: { editorial: true, brand: false },
  });
  await owner.signed.mutation(reviews.decide, {
    ...f.scope,
    versionId,
    policyId: p.policyId,
    stage: "editorial",
    expectedRevision: 0,
    commandKey: "replacement-stage",
  });
  const fresh = await owner.signed.mutation(api.editorial.approve, {
    ...f.scope,
    versionId,
    accountId: f.accountId,
  });
  const before = await f.t.run(async (ctx) => ({
    oldApproval: await ctx.db.get(approvalId),
    attempts: await ctx.db.query("xPostAttempts").collect(),
    finance: await ctx.db.query("aiAttempts").collect(),
  }));
  await owner.signed.mutation(api.editorial.reschedule, {
    ...move,
    expectedGeneration: 2,
    versionId,
    approvalId: fresh,
    at: move.at + 3600000,
    localTime: localInput(new Date(move.at + 3600000).toISOString(), "UTC"),
  });
  const replaced = (await f.t.run((ctx) => ctx.db.get(id)))!;
  expect(replaced.actorId).toBe(owner.userId);
  expect(replaced.reviewPin?.policyId).toBe(p.policyId);
  expect((await f.t.run((ctx) => preflight(ctx, replaced)))._id).toBe(
    versionId,
  );
  expect(
    await f.t.run(async (ctx) => ({
      oldApproval: await ctx.db.get(approvalId),
      attempts: await ctx.db.query("xPostAttempts").collect(),
      finance: await ctx.db.query("aiAttempts").collect(),
    })),
  ).toEqual(before);
});
