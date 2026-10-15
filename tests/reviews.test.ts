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
    versionId: (await f.t.run((ctx) => ctx.db.get(f.draftId)))!
      .currentVersionId!,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
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

test("public J10 assignment uses independent CAS and original replay without overwriting later recipient", async () => {
  const f = await fixture(),
    viewer = await join(f, "Viewer"),
    editor = await join(f, "Editor");
  const args = {
    ...f.scope,
    draftId: f.draftId,
    versionId: f.versionId,
    assigneeId: viewer.userId,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
  };
  const result = await f.signed.mutation(api.editorial.assign, args);
  expect(result).toMatchObject({
    revision: 1,
    assigneeId: viewer.userId,
    versionId: f.versionId,
  });
  await f.signed.mutation(api.editorial.assign, {
    ...args,
    assigneeId: editor.userId,
    expectedAssignmentRevision: 1,
    commandKey: crypto.randomUUID(),
  });
  expect(await f.signed.mutation(api.editorial.assign, args)).toEqual(result);
  expect((await f.t.run((ctx) => ctx.db.get(f.draftId)))!).toMatchObject({
    assigneeId: editor.userId,
    assignmentRevision: 2,
    revision: 1,
  });
  await expect(
    f.signed.mutation(api.editorial.assign, {
      ...args,
      commandKey: crypto.randomUUID(),
    }),
  ).rejects.toThrow("ASSIGNMENT_CONFLICT");
  await expect(
    f.signed.mutation(api.editorial.assign, {
      ...args,
      assigneeId: editor.userId,
    }),
  ).rejects.toThrow("REVIEW_COMMAND_CONFLICT");
  const commentId = await editor.signed.mutation(api.editorial.addComment, {
    ...f.scope,
    versionId: f.versionId,
    text: "J10 exact comment",
  });
  await editor.signed.mutation(api.editorial.resolveComment, {
    ...f.scope,
    commentId,
    expectedResolved: false,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialReviewDecisions").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("approvals").collect()),
  ).toHaveLength(0);
  expect((await f.t.run((ctx) => ctx.db.get(commentId)))!.resolved).toBe(true);
  await f.configure(true, true);
  const p = await editor.signed.query(reviews.get, {
    ...f.scope,
    versionId: f.versionId,
  });
  await expect(
    viewer.signed.mutation(reviews.decide, {
      ...f.scope,
      versionId: f.versionId,
      stage: "editorial",
      policyId: p.policyId,
      expectedRevision: p.revision,
      commandKey: crypto.randomUUID(),
    }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  const editorial = await editor.signed.mutation(reviews.decide, {
    ...f.scope,
    versionId: f.versionId,
    stage: "editorial",
    policyId: p.policyId,
    expectedRevision: p.revision,
    commandKey: crypto.randomUUID(),
  });
  const brand = await f.decide("brand");
  const approvalId = await f.approve(),
    scheduleId = await f.schedule(approvalId);
  expect((await f.t.run((ctx) => ctx.db.get(approvalId)))!).toMatchObject({
    actorId: f.userId,
    versionId: f.versionId,
    accountId: f.accountId,
    reviewPin: {
      policyId: p.policyId,
      decisionIds: [editorial.decisionId!, brand.decisionId!],
    },
  });
  expect(
    await f.t.run(
      async (ctx) =>
        (await preflight(ctx, (await ctx.db.get(scheduleId))!))._id,
    ),
  ).toBe(f.versionId);
});

test("distinct authenticated Owner withdrawal records its actual actor and recipient outcome without approval", async () => {
  const f = await fixture(),
    editor = await join(f, "Editor");
  await f.configure(true, false);
  await f.signed.mutation(api.editorial.assign, {
    ...f.scope,
    draftId: f.draftId,
    versionId: f.versionId,
    assigneeId: editor.userId,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
  });
  const p = await editor.signed.query(reviews.get, {
    ...f.scope,
    versionId: f.versionId,
  });
  const decided = await editor.signed.mutation(reviews.decide, {
    ...f.scope,
    versionId: f.versionId,
    stage: "editorial",
    policyId: p.policyId,
    expectedRevision: p.revision,
    commandKey: crypto.randomUUID(),
  });
  await f.signed.mutation(reviews.withdraw, {
    ...f.scope,
    decisionId: decided.decisionId!,
    expectedRevision: decided.revision,
    commandKey: crypto.randomUUID(),
  });
  const rows = await f.t.run((ctx) =>
    ctx.db.query("editorialNotices").collect(),
  );
  const outcome = rows.find(
    (n) => n.parent.kind === "decision" && n.parent.withdrawn,
  );
  expect(outcome).toMatchObject({
    actorId: f.userId,
    recipientId: editor.userId,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("approvals").collect()),
  ).toHaveLength(0);
  expect(
    await editor.signed.query(api.editorial.notices.get, {
      ...f.scope,
      noticeId: outcome!._id,
    }),
  ).not.toBeNull();
  await f.t.run((ctx) => ctx.db.delete(f.userId));
  expect(
    await editor.signed.query(api.editorial.notices.get, {
      ...f.scope,
      noticeId: outcome!._id,
    }),
  ).toBeNull();
});

test("recipient notices dedupe exact occurrences, isolate owned readstate and clamp current policy/source", async () => {
  const f = await fixture(),
    editor = await join(f, "Editor"),
    other = await join(f, "Editor");
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("No transport in native review"));
  await f.signed.mutation(api.editorial.assign, {
    ...f.scope,
    draftId: f.draftId,
    versionId: f.versionId,
    assigneeId: editor.userId,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
  });
  await f.configure(true, false);
  const p = await f.signed.query(reviews.get, {
    ...f.scope,
    versionId: f.versionId,
  });
  const request = {
    ...f.scope,
    versionId: f.versionId,
    stage: "editorial" as const,
    policyId: p.policyId,
    expectedRevision: p.revision,
    commandKey: crypto.randomUUID(),
  };
  await f.signed.mutation(reviews.request, request);
  await f.signed.mutation(reviews.request, request);
  const own = await editor.signed.query(api.editorial.notices.list, {
    ...f.scope,
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(own.page).toHaveLength(2);
  expect(
    (
      await other.signed.query(api.editorial.notices.list, {
        ...f.scope,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toHaveLength(0);
  expect(
    await other.signed.query(api.editorial.notices.get, {
      ...f.scope,
      noticeId: own.page[0].id,
    }),
  ).toBeNull();
  await expect(
    other.signed.mutation(api.editorial.notices.read, {
      ...f.scope,
      noticeIds: [own.page[0].id],
    }),
  ).rejects.toThrow("NOTICE_UNAVAILABLE");
  await expect(
    editor.signed.mutation(api.editorial.notices.read, {
      ...f.scope,
      noticeIds: Array(26).fill(own.page[0].id),
    }),
  ).rejects.toThrow("NOTICE_READ_LIMIT");
  await editor.signed.mutation(api.editorial.notices.read, {
    ...f.scope,
    noticeIds: [own.page[0].id],
  });
  expect(
    (await editor.signed.query(api.editorial.notices.get, {
      ...f.scope,
      noticeId: own.page[0].id,
    }))!.readAt,
  ).not.toBeNull();
  await f.signed.mutation(reviews.request, {
    ...request,
    commandKey: crypto.randomUUID(),
  });
  expect(
    (
      await editor.signed.query(api.editorial.notices.list, {
        ...f.scope,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toHaveLength(3);
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialReviewDecisions").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("approvals").collect()),
  ).toHaveLength(0);
  await f.configure(false, false);
  expect(
    (
      await editor.signed.query(api.editorial.notices.list, {
        ...f.scope,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(0);
});

test("current vs historical vs frozen projections keep native queue pagination and unavailable holes", async () => {
  const f = await fixture();
  await f.configure(true, false);
  await f.decide("editorial");
  const approvalId = await f.approve(),
    scheduleId = await f.schedule(approvalId);
  const before = await f.signed.query(api.editorial.get, {
    ...f.scope,
    draftId: f.draftId,
  });
  expect(before!.review!.approvalId).toBe(approvalId);
  await f.configure(true, true);
  const after = await f.signed.query(api.editorial.get, {
    ...f.scope,
    draftId: f.draftId,
  });
  expect(after!.review!.approvalId).toBeNull();
  expect(
    after!.approvals.find((a) => a._id === approvalId)!.revokedAt,
  ).toBeNull();
  expect(
    after!.frozenReviews.find((s) => s.scheduleId === scheduleId)!.usable,
  ).toBe(true);
  for (let i = 0; i < 27; i++)
    await f.signed.mutation(api.editorial.create, {
      ...f.scope,
      content: { ...f.content, title: `Queue ${i}` },
      source: "Manual",
    });
  const missing = await f.t.run(
    async (ctx) =>
      (await ctx.db
        .query("drafts")
        .withIndex("by_workspaceId_and_updatedAt", (q) =>
          q.eq("workspaceId", f.workspaceId),
        )
        .order("desc")
        .first())!,
  );
  await f.t.run((ctx) =>
    ctx.db.patch(missing.currentVersionId!, { sourceUnavailable: true }),
  );
  const page = await f.signed.query(api.editorial.list, {
    ...f.scope,
    paginationOpts: { cursor: null, numItems: 1000 },
  });
  expect(page.page).toHaveLength(25);
  expect(page.isDone).toBe(false);
  expect(page.page.find((b) => b.draft._id === missing._id)!.review).toBeNull();
  const next = await f.signed.query(api.editorial.list, {
    ...f.scope,
    paginationOpts: { cursor: page.continueCursor, numItems: 25 },
  });
  expect(next.isDone).toBe(true);
  expect(next.page).toHaveLength(3);
});

test("root-gone null-horizon notice cleanup drains later pages and cannot restore receipts or publishing parents", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    editor = await join(f, "Editor");
  await f.configure(true, false);
  await f.signed.mutation(api.editorial.assign, {
    ...f.scope,
    draftId: f.draftId,
    versionId: f.versionId,
    assigneeId: editor.userId,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
  });
  const p = await f.signed.query(reviews.get, {
    ...f.scope,
    versionId: f.versionId,
  });
  for (let i = 0; i < 61; i++)
    await f.signed.mutation(reviews.request, {
      ...f.scope,
      versionId: f.versionId,
      stage: "editorial",
      policyId: p.policyId,
      expectedRevision: p.revision,
      commandKey: crypto.randomUUID(),
    });
  const rows = await f.t.run((ctx) =>
    ctx.db.query("editorialNotices").collect(),
  );
  expect(rows).toHaveLength(62);
  expect(rows.every((n) => n.sourceUntil === null)).toBe(true);
  const parent = await f.t.run((ctx) => ctx.db.get(f.versionId));
  await f.t.run((ctx) => ctx.db.delete(f.versionId));
  expect(
    (
      await editor.signed.query(api.editorial.notices.list, {
        ...f.scope,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toHaveLength(0);
  const before = await f.t.run(async (ctx) => ({
    approvals: await ctx.db.query("approvals").collect(),
    schedules: await ctx.db.query("schedules").collect(),
    finance: await ctx.db.query("aiAttempts").collect(),
  }));
  await f.t.mutation(internal.editorial.notices.purgeVersion, {
    versionId: f.versionId,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialNotices").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run(async (ctx) => ({
      approvals: await ctx.db.query("approvals").collect(),
      schedules: await ctx.db.query("schedules").collect(),
      finance: await ctx.db.query("aiAttempts").collect(),
    })),
  ).toEqual(before);
  expect(JSON.stringify(rows)).not.toContain(f.content.title);
  expect(JSON.stringify(rows)).not.toContain(f.content.text[0]);
  expect(parent).not.toBeNull();
});

test.each(["reviewer", "actor", "recipient", "source"] as const)(
  "withdrawal outcome separates original reviewer, actual actor, recipient and source loss: %s",
  async (lost) => {
    vi.useFakeTimers();
    const f = await fixture(),
      reviewer = await join(f, "Editor"),
      recipient = await join(f, "Editor");
    const root = await noteSource(f, 1, Date.now() + 600000);
    await f.configure(true, false);
    await f.signed.mutation(api.editorial.assign, {
      ...f.scope,
      draftId: f.draftId,
      versionId: f.versionId,
      assigneeId: recipient.userId,
      expectedAssignmentRevision: 0,
      commandKey: crypto.randomUUID(),
    });
    const p = await reviewer.signed.query(reviews.get, {
      ...f.scope,
      versionId: f.versionId,
    });
    const d = await reviewer.signed.mutation(reviews.decide, {
      ...f.scope,
      versionId: f.versionId,
      stage: "editorial",
      policyId: p.policyId,
      expectedRevision: p.revision,
      commandKey: crypto.randomUUID(),
    });
    await f.signed.mutation(reviews.withdraw, {
      ...f.scope,
      decisionId: d.decisionId!,
      expectedRevision: d.revision,
      commandKey: crypto.randomUUID(),
    });
    const n = (
      await f.t.run((ctx) => ctx.db.query("editorialNotices").collect())
    ).find((n) => n.parent.kind === "decision" && n.parent.withdrawn)!;
    expect(n).toMatchObject({
      actorId: f.userId,
      recipientId: recipient.userId,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(d.decisionId!)))!.reviewerId,
    ).toBe(reviewer.userId);
    expect(
      await recipient.signed.query(api.editorial.notices.get, {
        ...f.scope,
        noticeId: n._id,
      }),
    ).not.toBeNull();
    const userId =
      lost === "reviewer"
        ? reviewer.userId
        : lost === "actor"
          ? f.userId
          : recipient.userId;
    const membershipId =
      lost === "reviewer"
        ? reviewer.membershipId
        : lost === "actor"
          ? (await f.t.run((ctx) =>
              ctx.db
                .query("memberships")
                .withIndex("by_userId_and_workspaceId", (q) =>
                  q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
                )
                .unique(),
            ))!._id
          : recipient.membershipId;
    const saved = await f.t.run(async (ctx) =>
      lost === "source" ? ctx.db.get(root) : ctx.db.get(membershipId),
    );
    await f.t.run(async (ctx) => {
      await (lost === "source"
        ? ctx.db.patch(root, { researchProofUntil: 0 })
        : ctx.db.delete(membershipId));
    });
    if (lost !== "recipient")
      expect(
        await recipient.signed.query(api.editorial.notices.get, {
          ...f.scope,
          noticeId: n._id,
        }),
      ).toBeNull();
    const parentBefore = await f.t.run(async (ctx) => ({
      decisions: await ctx.db.query("editorialReviewDecisions").collect(),
      approvals: await ctx.db.query("approvals").collect(),
      schedules: await ctx.db.query("schedules").collect(),
    }));
    await f.t.mutation(internal.editorial.notices.sweep, { cursor: null });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(await f.t.run((ctx) => ctx.db.get(n._id))).toBeNull();
    // Fixture-only restoration of the same original source/role does not recreate a physically deleted occurrence.
    await f.t.run(async (ctx) => {
      await (lost === "source"
        ? ctx.db.patch(root, {
            researchProofUntil:
              (saved as import("../convex/_generated/dataModel").Doc<"ideaVersions">)!
                .researchProofUntil,
          })
        : ctx.db.insert(
            "memberships",
            Object.fromEntries(
              Object.entries(saved!).filter(
                ([k]) => !["_id", "_creationTime"].includes(k),
              ),
            ) as never,
          ));
    });
    expect(await f.t.run((ctx) => ctx.db.get(n._id))).toBeNull();
    expect(
      await f.t.run(async (ctx) => ({
        decisions: await ctx.db.query("editorialReviewDecisions").collect(),
        approvals: await ctx.db.query("approvals").collect(),
        schedules: await ctx.db.query("schedules").collect(),
      })),
    ).toEqual(parentBefore);
    expect(userId).toBeTruthy();
  },
);

test("notice cleanup propagates ancestry capacity and unknown proof failures atomically", async () => {
  const f = await fixture(),
    recipient = await join(f, "Editor");
  await noteSource(f);
  await f.signed.mutation(api.editorial.assign, {
    ...f.scope,
    draftId: f.draftId,
    versionId: f.versionId,
    assigneeId: recipient.userId,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
  });
  const before = await f.t.run((ctx) =>
    ctx.db.query("editorialNotices").collect(),
  );
  await noteSource(f, 40);
  await expect(
    f.t.mutation(internal.editorial.notices.sweep, { cursor: null }),
  ).rejects.toThrow("STYLE_ANCESTRY_LIMIT");
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialNotices").collect()),
  ).toEqual(before);
  const proof = await import("../convex/research/contentProof");
  vi.spyOn(proof, "draftResearchProof").mockRejectedValueOnce(
    new Error("synthetic notice resource failure"),
  );
  await expect(
    f.t.mutation(internal.editorial.notices.sweep, { cursor: null }),
  ).rejects.toThrow("synthetic notice resource failure");
  expect(
    await f.t.run((ctx) => ctx.db.query("editorialNotices").collect()),
  ).toEqual(before);
});

test.each(["reviewer", "withdrawer"] as const)(
  "withdrawal notices require the original %s user root before parent cleanup",
  async (lost) => {
    vi.useFakeTimers();
    const f = await fixture(),
      reviewer = await join(f, "Editor"),
      recipient = await join(f, "Editor");
    await f.configure(true, false);
    await f.signed.mutation(api.editorial.assign, {
      ...f.scope,
      draftId: f.draftId,
      versionId: f.versionId,
      assigneeId: recipient.userId,
      expectedAssignmentRevision: 0,
      commandKey: crypto.randomUUID(),
    });
    const p = await reviewer.signed.query(reviews.get, {
      ...f.scope,
      versionId: f.versionId,
    });
    const d = await reviewer.signed.mutation(reviews.decide, {
      ...f.scope,
      versionId: f.versionId,
      stage: "editorial",
      policyId: p.policyId,
      expectedRevision: p.revision,
      commandKey: crypto.randomUUID(),
    });
    await f.signed.mutation(reviews.withdraw, {
      ...f.scope,
      decisionId: d.decisionId!,
      expectedRevision: d.revision,
      commandKey: crypto.randomUUID(),
    });
    const n = (
      await f.t.run((ctx) => ctx.db.query("editorialNotices").collect())
    ).find((n) => n.parent.kind === "decision" && n.parent.withdrawn)!;
    await f.t.run((ctx) =>
      ctx.db.delete(lost === "reviewer" ? reviewer.userId : f.userId),
    );
    // The parent is not yet scrubbed: notice proof must independently check both truthful original roots.
    expect(
      (await f.t.run((ctx) => ctx.db.get(d.decisionId!)))!.sourceUnavailable,
    ).toBe(false);
    expect(
      await recipient.signed.query(api.editorial.notices.get, {
        ...f.scope,
        noticeId: n._id,
      }),
    ).toBeNull();
    await f.t.mutation(internal.editorial.notices.sweep, { cursor: null });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
    expect(await f.t.run((ctx) => ctx.db.get(n._id))).toBeNull();
    expect(
      await f.t.run((ctx) => ctx.db.query("approvals").collect()),
    ).toHaveLength(0);
  },
);

test("read and dismiss authorize every observed ID before changing any owned row", async () => {
  const f = await fixture(),
    recipient = await join(f, "Editor"),
    other = await join(f, "Editor");
  await f.signed.mutation(api.editorial.assign, {
    ...f.scope,
    draftId: f.draftId,
    versionId: f.versionId,
    assigneeId: recipient.userId,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
  });
  const second = await f.signed.mutation(api.editorial.create, {
    ...f.scope,
    content: { ...f.content, title: "Different recipient" },
    source: "Manual",
  });
  const versionId = (await f.t.run((ctx) => ctx.db.get(second)))!
    .currentVersionId!;
  await f.signed.mutation(api.editorial.assign, {
    ...f.scope,
    draftId: second,
    versionId,
    assigneeId: other.userId,
    expectedAssignmentRevision: 0,
    commandKey: crypto.randomUUID(),
  });
  const rows = await f.t.run((ctx) =>
      ctx.db.query("editorialNotices").collect(),
    ),
    own = rows.find((n) => n.recipientId === recipient.userId)!,
    foreign = rows.find((n) => n.recipientId === other.userId)!;
  for (const operation of [
    api.editorial.notices.read,
    api.editorial.notices.dismiss,
  ]) {
    await expect(
      recipient.signed.mutation(operation, {
        ...f.scope,
        noticeIds: [own._id, foreign._id],
      }),
    ).rejects.toThrow("NOTICE_UNAVAILABLE");
    expect(await f.t.run((ctx) => ctx.db.get(own._id))).toEqual(own);
    expect(await f.t.run((ctx) => ctx.db.get(foreign._id))).toEqual(foreign);
  }
});

test("native notices retain exact account parents and isolate a second current workspace", async () => {
  const f = await fixture(),
    foreignActor = await join(f, "Editor"),
    recipient = await join(f, "Editor");
  const foreignWorkspaceId = await foreignActor.signed.mutation(
    api.workspaces.create,
    { name: "Second workspace", description: "Native notice privacy" },
  );
  await foreignActor.signed.mutation(api.workspaces.select, {
    workspaceId: foreignWorkspaceId,
  });
  const foreign = {
    signed: foreignActor.signed,
    scope: { workspaceId: foreignWorkspaceId },
    workspaceId: foreignWorkspaceId,
  };
  expect(foreignWorkspaceId).not.toBe(f.workspaceId);
  const account = (await f.t.run((ctx) => ctx.db.get(f.accountId)))!;
  const secondAccountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      ...Object.fromEntries(
        Object.entries(account).filter(
          ([k]) => !["_id", "_creationTime"].includes(k),
        ),
      ),
      providerIdentity: "second-account",
    } as never),
  );
  const second = await f.signed.mutation(api.editorial.create, {
    ...f.scope,
    content: { ...f.content, accountId: secondAccountId },
    source: "Manual",
  });
  const secondVersion = (await f.t.run((ctx) => ctx.db.get(second)))!
    .currentVersionId!;
  for (const [draftId, versionId] of [
    [f.draftId, f.versionId],
    [second, secondVersion],
  ] as const)
    await f.signed.mutation(api.editorial.assign, {
      ...f.scope,
      draftId,
      versionId,
      assigneeId: recipient.userId,
      expectedAssignmentRevision: 0,
      commandKey: crypto.randomUUID(),
    });
  const own = await recipient.signed.query(api.editorial.notices.list, {
    ...f.scope,
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(new Set(own.page.map((n) => n.accountId))).toEqual(
    new Set([f.accountId, secondAccountId]),
  );
  expect(
    (
      await foreign.signed.query(api.editorial.notices.list, {
        ...foreign.scope,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toHaveLength(0);
  expect(
    await foreign.signed.query(api.editorial.notices.get, {
      ...foreign.scope,
      noticeId: own.page[0].id,
    }),
  ).toBeNull();
  await expect(
    foreign.signed.mutation(api.editorial.notices.read, {
      ...foreign.scope,
      noticeIds: [own.page[0].id],
    }),
  ).rejects.toThrow("NOTICE_UNAVAILABLE");
  await f.t.run((ctx) =>
    ctx.db.patch(secondAccountId, { workspaceId: foreign.workspaceId }),
  );
  expect(
    await recipient.signed.query(api.editorial.notices.get, {
      ...f.scope,
      noticeId: own.page.find((n) => n.accountId === secondAccountId)!.id,
    }),
  ).toBeNull();
  expect(
    await recipient.signed.query(api.editorial.notices.get, {
      ...f.scope,
      noticeId: own.page.find((n) => n.accountId === f.accountId)!.id,
    }),
  ).not.toBeNull();
});

test.each([false, true])(
  "selected publishing approval retains its original shorter source deadline stages=%s",
  async (enabled) => {
    vi.useFakeTimers();
    const f = await fixture(),
      short = Date.now() + 60000,
      long = Date.now() + 900000;
    const root = await noteSource(f, 1, long);
    await f.configure(enabled, enabled);
    if (enabled) {
      await f.decide("editorial");
      await f.decide("brand");
    }
    await f.t.run((ctx) => ctx.db.patch(root, { researchProofUntil: short }));
    const approvalId = await f.approve();
    const original = (await f.t.run((ctx) => ctx.db.get(approvalId)))!;
    expect(original.reviewPin?.sourceUntil).toBe(short);
    await f.t.run((ctx) => ctx.db.patch(root, { researchProofUntil: long }));
    const projected = await f.signed.query(api.editorial.get, {
      ...f.scope,
      draftId: f.draftId,
    });
    if (!projected) throw new Error("Expected current native draft projection");
    expect(projected.review?.approvalId).toBe(approvalId);
    expect(projected.review?.sourceUntil).toBe(short);
    vi.setSystemTime(short + 1);
    expect(projected.review!.sourceUntil! > Date.now()).toBe(false);
    const expired = await f.signed.query(api.editorial.get, {
      ...f.scope,
      draftId: f.draftId,
    });
    if (!expired) throw new Error("Expected current native draft after expiry");
    expect(expired.review?.approvalId).toBeNull();
    expect(expired.review?.sourceUntil).toBe(long);
    await expect(f.schedule(approvalId)).rejects.toThrow(
      "REVIEW_SOURCE_UNAVAILABLE",
    );
    expect(await f.t.run((ctx) => ctx.db.get(approvalId))).toEqual(original);
    expect(
      await f.t.run((ctx) => ctx.db.query("schedules").collect()),
    ).toHaveLength(0);
  },
);

test("first-write approval retains original source deadline after source extension", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    short = Date.now() + 60000,
    long = Date.now() + 900000;
  const root = await noteSource(f, 1, long);
  await f.configure(true, true);
  await f.decide("editorial");
  await f.decide("brand");
  await f.t.run(async (ctx) => {
    const account = (await ctx.db.get(f.accountId))!;
    await ctx.db.patch(f.accountId, {
      capability: { ...account.capability, publish: false },
      xEvidence: {
        scopes: ["tweet.read", "users.read", "tweet.write"],
        identityVerifiedAt: Date.now(),
        connectionSequence: 1,
        textScopeEligible: true,
        mediaScopeEligible: false,
        liveWrite: "unverified",
      },
    });
    await ctx.db.insert("xBindings", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      providerIdentity: account.providerIdentity,
      changedAt: Date.now(),
    });
    await ctx.db.insert("xCredentials", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      generation: 1,
      envelope: {
        version: 1,
        keyId: "synthetic",
        iv: "synthetic",
        ciphertext: "synthetic",
      },
      expiresAt: Date.now() + 86400000,
      scopes: ["tweet.read", "users.read", "tweet.write"],
      leaseUntil: 0,
      cleanAfter: Date.now() + 86400000,
    });
    await ctx.db.patch(root, { researchProofUntil: short });
  });
  const approvalId = await f.signed.mutation(api.editorial.approveFirstWrite, {
    ...f.scope,
    versionId: f.versionId,
    accountId: f.accountId,
  });
  const original = (await f.t.run((ctx) => ctx.db.get(approvalId)))!;
  expect(original.reviewPin?.sourceUntil).toBe(short);
  expect(original.expiresAt).toBeGreaterThan(long);
  await f.t.run((ctx) => ctx.db.patch(root, { researchProofUntil: long }));
  const projected = await f.signed.query(api.editorial.get, {
    ...f.scope,
    draftId: f.draftId,
  });
  if (!projected) throw new Error("Expected current native draft projection");
  expect(projected.review?.approvalId).toBeNull();
  expect(projected.review?.sourceUntil).toBe(long);
  vi.setSystemTime(short + 1);
  await expect(
    f.signed.mutation(api.editorial.confirmFirstWrite, {
      ...f.scope,
      versionId: f.versionId,
      approvalId,
      accountId: f.accountId,
    }),
  ).rejects.toThrow("REVIEW_SOURCE_UNAVAILABLE");
  expect(
    await f.t.run((ctx) => ctx.db.query("schedules").collect()),
  ).toHaveLength(0);
  expect(await f.t.run((ctx) => ctx.db.get(approvalId))).toEqual(original);
});

test.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])(
  "current stages survive ordinary approval expiry and admit fresh approval enabled=%s unbounded=%s",
  async (enabled, unbounded) => {
    vi.useFakeTimers();
    const f = await fixture(),
      short = Date.now() + 60000,
      long = unbounded ? null : Date.now() + 900000;
    const root = await noteSource(f, 1, long);
    await f.configure(enabled, enabled);
    const decisions = enabled
      ? [
          (await f.decide("editorial")).decisionId,
          (await f.decide("brand")).decisionId,
        ]
      : [];
    await f.t.run((ctx) => ctx.db.patch(root, { researchProofUntil: short }));
    const oldId = await f.approve(),
      original = await f.t.run((ctx) => ctx.db.get(oldId));
    await f.t.run((ctx) =>
      ctx.db.patch(root, { researchProofUntil: long ?? undefined }),
    );
    const cached = await f.signed.query(api.editorial.get, {
      ...f.scope,
      draftId: f.draftId,
    });
    expect(cached?.review).toMatchObject({
      approvalId: oldId,
      sourceUntil: short,
      stageSourceUntil: long,
    });
    vi.setSystemTime(short + 1);
    const freshId = await f.approve(),
      fresh = (await f.t.run((ctx) => ctx.db.get(freshId)))!;
    expect(freshId).not.toBe(oldId);
    expect(fresh.reviewPin).toMatchObject({
      sourceUntil: long,
      decisionIds: decisions,
    });
    expect(await f.t.run((ctx) => ctx.db.get(oldId))).toEqual(original);
    expect(
      await f.t.run((ctx) => ctx.db.query("schedules").collect()),
    ).toHaveLength(0);
  },
);

test.each([false, true])(
  "current stage/source expiry remains terminal enabled=%s",
  async (enabled) => {
    vi.useFakeTimers();
    const f = await fixture(),
      short = Date.now() + 60000;
    const root = await noteSource(f, 1, short);
    await f.configure(enabled, enabled);
    if (enabled) {
      await f.decide("editorial");
      await f.decide("brand");
    }
    const id = await f.approve();
    if (enabled)
      await f.t.run((ctx) =>
        ctx.db.patch(root, { researchProofUntil: short + 900000 }),
      );
    const cached = await f.signed.query(api.editorial.get, {
      ...f.scope,
      draftId: f.draftId,
    });
    expect(cached?.review).toMatchObject({
      approvalId: id,
      sourceUntil: short,
      stageSourceUntil: short,
    });
    vi.setSystemTime(short + 1);
    const after = await f.signed.query(api.editorial.get, {
      ...f.scope,
      draftId: f.draftId,
    });
    if (enabled)
      expect(after?.review).toMatchObject({
        approvalId: null,
        editorialDecisionId: null,
        brandDecisionId: null,
      });
    else expect(after?.review).toBeNull();
    await expect(f.approve()).rejects.toThrow(
      enabled ? "REVIEW_SOURCE_UNAVAILABLE" : "MODEL_SOURCE_EXPIRED",
    );
    expect(
      await f.t.run((ctx) => ctx.db.query("schedules").collect()),
    ).toHaveLength(0);
  },
);
