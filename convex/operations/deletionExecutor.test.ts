import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthComponent from "@convex-dev/better-auth/test";
import schema from "../schema";
import { api, internal, components } from "../_generated/api";
import { mediaFixture } from "../../tests/media-fixture";
import agentComponent from "@convex-dev/agent/test";
import { S3Client } from "@aws-sdk/client-s3";
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).map(
    ([path, load]) => [new URL(path, import.meta.url).pathname, load],
  ),
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-deletion-executor-secret");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  const f = await mediaFixture();
  agentComponent.register(f.t);
  await f.t.mutation(internal.operations.authAdmission.initialize, {});
  return f;
}
async function drain(
  f: Awaited<ReturnType<typeof fixture>>,
  id: import("../_generated/dataModel").Id<"deletionJobs">,
  limit = 600,
) {
  for (let n = 0; n < limit; n++) {
    const j = (await f.t.run((ctx) => ctx.db.get(id)))!;
    if (
      j.state === "complete" ||
      j.state === "blocked" ||
      j.state === "waiting"
    )
      return j;
    await f.t.mutation(internal.operations.deletionExecutor.advance, {
      jobId: id,
      revision: j.revision,
    });
  }
  throw new Error("Bounded deletion did not converge");
}
function begin(
  f: Awaited<ReturnType<typeof fixture>>,
  key = "executor-workspace",
) {
  return f.signed.mutation(api.operations.deletion.beginWorkspace, {
    workspaceId: f.workspaceId,
    expectedTeamRevision: 0,
    commandKey: key,
    confirmation: "delete-workspace",
  });
}
test("public deletion requires fixed native guard and cannot start a partially prepared fence", async () => {
  const t = convexTest(schema, modules);
  betterAuthComponent.register(t);
  const workspaceId = await t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Unconfigured", description: "" }),
  );
  await expect(
    t.mutation(api.operations.deletion.beginWorkspace, {
      workspaceId,
      expectedTeamRevision: 0,
      commandKey: "executor-workspace",
      confirmation: "delete-workspace",
    }),
  ).rejects.toThrow("FIXED_GUARD_REQUIRED");
  expect((await t.run((ctx) => ctx.db.get(workspaceId)))!.lifecycle).toBeUndefined();
});
test("bounded populated workspace deletion removes drafts and descendants and preserves another tenant", async () => {
  const f = await fixture();
  for (let n = 0; n < 25; n++)
    await f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      content: {
        title: `Private ${n}`,
        text: ["Private body"],
        media: [],
        accountId: null,
        pillar: "",
        strategy: "",
      },
      source: "test",
    });
  const foreign = await f.t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Other",
      description: "survives",
    });
    await ctx.db.insert("memberships", {
      userId: f.userId,
      workspaceId,
      role: "Owner",
    });
    return workspaceId;
  });
  const other = await f.signed.mutation(api.editorial.create, {
    workspaceId: foreign,
    content: {
      title: "Shared survives",
      text: ["Keep"],
      media: [],
      accountId: null,
      pillar: "",
      strategy: "",
    },
    source: "test",
  });
  const job = await begin(f);
  expect((await f.signed.query(api.operations.deletion.mine, {}))[0].id).toBe(
    job.id,
  );
  const final = await drain(f, job.id);
  expect(final.state).toBe("complete");
  expect(final.processed).toBeGreaterThan(50);
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("drafts")
        .withIndex("by_workspaceId_and_updatedAt", (q) =>
          q.eq("workspaceId", f.workspaceId),
        )
        .take(1),
    ),
  ).toEqual([]);
  expect((await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.name).toBe("");
  expect((await f.t.run((ctx) => ctx.db.get(foreign)))!.name).toBe("Other");
  expect(await f.t.run((ctx) => ctx.db.get(other))).not.toBeNull();
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.userId)))!.lifecycle,
  ).toBeUndefined();
  expect(
    (await f.signed.query(api.operations.deletion.status, { jobId: job.id }))
      .state,
  ).toBe("complete");
});
test("minimal account deletion drains native identity last and retains replay barriers", async () => {
  const f = await fixture();
  const actor = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const job = await f.signed.mutation(api.operations.deletion.beginAccount, {
    commandKey: "executor-account",
    confirmation: "delete-account",
    deleteWorkspaces: [{ workspaceId: f.workspaceId, expectedTeamRevision: 0 }],
  });
  const final = await drain(f, job.id);
  expect(final.state).toBe("complete");
  expect((await f.t.run((ctx) => ctx.db.get(f.userId)))!.lifecycle).toBe(
    "deleted",
  );
  expect(
    await f.t.query(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", value: actor.authId }],
    }),
  ).toBeNull();
  expect(
    (await f.t.run((ctx) => ctx.db.query("authReplayFences").take(10))).length,
  ).toBeGreaterThan(0);
});
test("credential envelopes are removed during stop; late callback and duplicate revision do not advance job", async () => {
  const f = await fixture();
  const account = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      name: "Synthetic",
      providerIdentity: "synthetic-identity",
      handle: "synthetic",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 25,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
    }),
  );
  const credential = await f.t.run((ctx) =>
    ctx.db.insert("xCredentials", {
      workspaceId: f.workspaceId,
      accountId: account,
      generation: 1,
      envelope: {
        version: 1,
        keyId: "synthetic",
        iv: "synthetic",
        ciphertext: "synthetic",
      },
      expiresAt: Date.now() + 60000,
      scopes: [],
      leaseUntil: Date.now() + 60000,
      cleanAfter: Date.now() + 60000,
    }),
  );
  const job = await begin(f);
  const blocked = await drain(f, job.id);
  expect(blocked.reason).toBe("in-flight");
  expect(
    (await f.t.run((ctx) => ctx.db.get(credential)))!.envelope,
  ).toBeUndefined();
  await f.t.mutation(internal.operations.deletionExecutor.advance, {
    jobId: job.id,
    revision: 1,
  });
  expect((await f.t.run((ctx) => ctx.db.get(job.id)))!.revision).toBe(
    blocked.revision,
  );
  await expect(
    f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      content: {
        title: "late",
        text: ["late"],
        media: [],
        accountId: null,
        pillar: "",
        strategy: "",
      },
      source: "test",
    }),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
});
test("R2 exact object deletion requires expired PUT and two successful deletes before receipt", async () => {
  vi.stubEnv("R2_MEDIA_BUCKET", "synthetic-eu");
  vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "synthetic");
  vi.stubEnv("R2_MEDIA_EU_CONFIRMED", "true");
  const f = await fixture(),
    session = await f.reserve();
  const source = (await f.t.run((ctx) => ctx.db.get(session._id)))!;
  await f.t.run((ctx) =>
    ctx.db.patch(source._id, { expiresAt: Date.now() - 60001, leaseUntil: 0 }),
  );
  const job = await begin(f);
  const waiting = await drain(f, job.id);
  expect(waiting.reason).toBe("object-cleanup");
  const send = vi
    .spyOn(S3Client.prototype, "send")
    .mockResolvedValue({} as never);
  await f.t.action(internal.operations.deletionObjects.remove, {
    jobId: job.id,
    sessionId: source._id,
  });
  expect(send.mock.calls).toHaveLength(2);
  expect(
    send.mock.calls.map(([c]) => (c as { input: { Key: string } }).input.Key),
  ).toEqual([source.temporaryKey, source.finalKey]);
  expect((await f.t.run((ctx) => ctx.db.get(source._id)))!.state).toBe(
    "deleted",
  );
  await f.signed.mutation(api.operations.deletion.resume, { jobId: job.id });
  expect((await drain(f, job.id)).state).toBe("complete");
  expect(await f.t.run((ctx) => ctx.db.get(source._id))).toBeNull();
});

test("sealed account command replays after native admission revoked without renewing horizon", async () => {
  const f = await fixture();
  const args = {
    commandKey: "replay-auth-fence",
    confirmation: "delete-account" as const,
    deleteWorkspaces: [{ workspaceId: f.workspaceId, expectedTeamRevision: 0 }],
  };
  const job = await f.signed.mutation(
    api.operations.deletion.beginAccount,
    args,
  );
  const before = (await f.t.run((ctx) => ctx.db.get(job.id)))!;
  expect(
    await f.signed.mutation(api.operations.deletion.beginAccount, args),
  ).toEqual(job);
  await expect(
    f.signed.mutation(api.operations.deletion.beginAccount, {
      ...args,
      deleteWorkspaces: [],
    }),
  ).rejects.toThrow("DELETION_COMMAND_CONFLICT");
  expect((await f.t.run((ctx) => ctx.db.get(job.id)))!.retentionUntil).toBe(
    before.retentionUntil,
  );
  await expect(
    f.t.mutation(api.operations.deletion.resume, { jobId: job.id }),
  ).rejects.toThrow();
});
test("failed R2 deletion preserves exact namespace and cannot manufacture a receipt", async () => {
  vi.stubEnv("R2_MEDIA_BUCKET", "synthetic-eu");
  vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "synthetic");
  vi.stubEnv("R2_MEDIA_EU_CONFIRMED", "true");
  const f = await fixture(),
    s = await f.reserve();
  await f.t.run((ctx) =>
    ctx.db.patch(s._id, { expiresAt: Date.now() - 60001, leaseUntil: 0 }),
  );
  const job = await begin(f);
  await drain(f, job.id);
  vi.spyOn(S3Client.prototype, "send").mockRejectedValue(
    new Error("synthetic outage"),
  );
  await f.t.action(internal.operations.deletionObjects.remove, {
    jobId: job.id,
    sessionId: s._id,
  });
  const pending = (await f.t.run((ctx) => ctx.db.get(s._id)))!;
  expect(pending.state).toBe("cancelled");
  expect(pending.temporaryKey).toBe(s.temporaryKey);
  expect(pending.finalKey).toBe(s.finalKey);
  expect((await f.t.run((ctx) => ctx.db.get(job.id)))!.state).not.toBe(
    "complete",
  );
});

test("unknown publishing effect blocks completion and retains original liability tuple", async () => {
  const f = await fixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "effect-fixture",
      name: "Fixture",
      handle: "@fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
    }),
  );
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: {
      title: "Private",
      text: ["Private"],
      media: [],
      accountId,
      pillar: "",
      strategy: "",
    },
    source: "test",
  });
  const versionId = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  }))!.versions[0]._id;
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId,
    accountId,
  });
  const scheduleId = await f.t.run((ctx) =>
    ctx.db.insert("schedules", {
      workspaceId: f.workspaceId,
      draftId,
      versionId,
      accountId,
      approvalId,
      actorId: f.userId,
      generation: 7,
      at: Date.now(),
      timezone: "UTC",
      localTime: "2026-10-10T12:00",
      state: "reconciliation_required",
      publishedCount: 0,
      errorCode: "X_UNKNOWN",
      jobId: null,
    }),
  );
  const job = await begin(f);
  const blocked = await drain(f, job.id);
  expect(blocked.state).toBe("blocked");
  expect(blocked.reason).toBe("external-outcome");
  const effect = (await f.t.run((ctx) => ctx.db.get(scheduleId)))!;
  expect(effect.generation).toBe(7);
  expect(effect.state).toBe("reconciliation_required");
  expect(await f.t.run((ctx) => ctx.db.get(versionId))).not.toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.lifecycle).toBe(
    "deleting",
  );
});

test("populated Agent deletion captures files before native thread erasure and removes app storage bytes", async () => {
  const { modelFixture } = await import("../../tests/model-fixture");
  const f = await modelFixture();
  await f.t.mutation(internal.operations.authAdmission.initialize, {});
  const runId = await f.create();
  const run = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  const storageId = await f.t.run((ctx) =>
    ctx.storage.store(new Blob(["private Agent file"], { type: "text/plain" })),
  );
  const metadata = (await f.t.run((ctx) => ctx.db.system.get(storageId)))!;
  const file = await f.t.mutation(components.agent.files.addFile, {
    storageId,
    hash: metadata.sha256,
    filename: "private.txt",
    mediaType: "text/plain",
  });
  await f.t.mutation(components.agent.messages.updateMessage, {
    messageId: run.promptMessageId,
    patch: { fileIds: [file.fileId] },
  });
  const job = await begin(f);
  const final = await drain(f, job.id);
  expect(final.state).toBe("complete");
  expect(await f.t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(runId))).toBeNull();
  const claims = await f.t.query(components.agent.erasure.listForThread, {
    threadId: run.threadId,
    expectedUserId: String(f.userId),
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(claims.page).toEqual([]);
});

test("account erasure removes personal comments and optional references while preserving shared business content", async () => {
  const f = await fixture();
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: {
      title: "Shared",
      text: ["Keep business content"],
      media: [],
      accountId: null,
      pillar: "",
      strategy: "",
    },
    source: "test",
  });
  const ids = await f.t.run(async (ctx) => {
    const otherId = await ctx.db.insert("users", {
      authId: "other-identity",
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    });
    await ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId: otherId,
      role: "Owner",
    });
    const draft = (await ctx.db.get(draftId))!;
    await ctx.db.patch(draftId, { assigneeId: f.userId });
    const commentId = await ctx.db.insert("editorialComments", {
      workspaceId: f.workspaceId,
      draftId,
      versionId: draft.currentVersionId!,
      authorId: f.userId,
      text: "My private comment",
      resolved: false,
      createdAt: Date.now(),
    });
    const eventId = await ctx.db.insert("editorialEvents", {
      workspaceId: f.workspaceId,
      draftId,
      scheduleId: null,
      actorId: f.userId,
      code: "created",
      createdAt: Date.now(),
    });
    return { otherId, commentId, eventId, versionId: draft.currentVersionId! };
  });
  const job = await f.signed.mutation(api.operations.deletion.beginAccount, {
    commandKey: "shared-account",
    confirmation: "delete-account",
    deleteWorkspaces: [],
  });
  expect((await drain(f, job.id)).state).toBe("complete");
  const result = await f.t.run(async (ctx) => ({
    draft: await ctx.db.get(draftId),
    version: await ctx.db.get(ids.versionId),
    comment: await ctx.db.get(ids.commentId),
    event: await ctx.db.get(ids.eventId),
    workspace: await ctx.db.get(f.workspaceId),
    memberships: await ctx.db.query("memberships").collect(),
    preferences: await ctx.db.query("preferences").collect(),
  }));
  expect(result.draft?.authorId).toBe(f.userId);
  expect(result.draft?.assigneeId).toBeUndefined();
  expect(result.version?.content.text).toEqual(["Keep business content"]);
  expect(result.comment).toBeNull();
  expect(result.event?.actorId).toBeNull();
  expect(result.workspace?.lifecycle).toBeUndefined();
  expect(result.memberships.map((m) => m.userId)).toEqual([ids.otherId]);
  expect(result.preferences.some((p) => p.userId === f.userId)).toBe(false);
});

test("missing native Workflow root still drains exact bounded residuals without invoking root cleanup", async () => {
  const { convexTest } = await import("convex-test");
  const { makeFunctionReference } = await import("convex/server");
  const { default: workflowComponent } =
    await import("@convex-dev/workflow/test");
  const { componentRow } = await import("./deletionExecutor");
  const native = convexTest(
    workflowComponent.schema,
    workflowComponent.modules,
  );
  const ids = await native.run(async (ctx) => {
    const owned = await ctx.db.insert("workflows", {
      workflowHandle: "h",
      args: {},
      generationNumber: 1,
      runResult: { kind: "success", returnValue: null },
    });
    const foreign = await ctx.db.insert("workflows", {
      workflowHandle: "h",
      args: {},
      generationNumber: 1,
    });
    for (let n = 0; n < 26; n++)
      await ctx.db.insert("events", {
        workflowId: owned,
        name: "owned",
        state: { kind: "created" },
      });
    await ctx.db.insert("events", {
      workflowId: foreign,
      name: "foreign",
      state: { kind: "created" },
    });
    await ctx.db.delete(owned);
    return { owned, foreign };
  });
  const f = await fixture();
  const prepared = await begin(f, "missing-workflow");
  const job = (await f.t.run((ctx) => ctx.db.get(prepared.id)))!;
  const runQuery = vi.fn(async (ref: unknown, args: { workflowId: string }) => {
    expect(ref).toEqual(components.workflow.erasure.scopeStatus);
    return native.query(
      makeFunctionReference<"query">("erasure:scopeStatus"),
      args,
    );
  });
  const runMutation = vi.fn(
    async (ref: unknown, args: { workflowId: string }) => {
      expect(ref).toEqual(components.workflow.erasure.deleteResiduals);
      return native.mutation(
        makeFunctionReference<"mutation">("erasure:deleteResiduals"),
        args,
      );
    },
  );
  const ctx = {
    runQuery,
    runMutation,
  } as unknown as import("../_generated/server").MutationCtx;
  const row = { pipeline: { workflowId: ids.owned } };
  expect(await componentRow(ctx, job, "researchOrders", row)).toBe("continue");
  expect(await componentRow(ctx, job, "researchOrders", row)).toBeNull();
  expect(runMutation).toHaveBeenCalledTimes(2);
  expect(
    await native.run((ctx) => ctx.db.query("events").collect()),
  ).toMatchObject([{ workflowId: ids.foreign, name: "foreign" }]);
});
test("components phase erases every owned thread in one page, not just the first", async () => {
  const { modelFixture } = await import("../../tests/model-fixture");
  const f = await modelFixture();
  await f.t.mutation(internal.operations.authAdmission.initialize, {});
  const runId1 = await f.create();
  const runId2 = await f.create();
  const run1 = (await f.t.run((ctx) => ctx.db.get(runId1)))!;
  const run2 = (await f.t.run((ctx) => ctx.db.get(runId2)))!;
  expect(run1.threadId).not.toBe(run2.threadId);
  const job = await begin(f, "executor-two-threads");
  const final = await drain(f, job.id);
  expect(final.state).toBe("complete");
  expect(await f.t.run((ctx) => ctx.db.get(runId1))).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(runId2))).toBeNull();
  for (const threadId of [run1.threadId, run2.threadId]) {
    expect(
      await f.t.query(components.agent.threads.getThread, {
        threadId: threadId as never,
      }),
    ).toBeNull();
    const messages = await f.t.query(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: threadId as never,
        order: "asc",
        paginationOpts: { numItems: 25, cursor: null },
      },
    );
    expect(messages.page).toEqual([]);
  }
});

test("components phase serializes rows one per step and preserves foreign rows", async () => {
  const f = await fixture();
  const foreign = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Foreign", description: "survives" }),
  );
  const foreignActor = await f.t.run((ctx) =>
    ctx.db.insert("users", {
      authId: "foreign-components-page",
      defaultWorkspaceId: foreign,
      activeWorkspaceId: foreign,
    }),
  );
  const account = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: foreign,
      provider: "X",
      name: "Foreign",
      providerIdentity: "foreign-components-page",
      handle: "foreign",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 25,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
    }),
  );
  await f.t.run(async (ctx) => {
    const ids = [];
    for (let i = 0; i < 5; i++)
      ids.push(
        await ctx.db.insert("agentRuns", {
          workspaceId: foreign,
          accountId: account,
          actorId: foreignActor,
          purpose: "chat",
          policyVersion: "test",
          promptVersion: "test",
          policyFingerprint: "test",
          accountConnectionSequence: 0,
          sources: [],
          threadId: `foreign-thread-${i}`,
          promptMessageId: `foreign-prompt-${i}`,
          generation: 1,
          state: "completed",
          executionKey: null,
          deadline: Date.now(),
          attempts: 1,
          toolSteps: 0,
          budgetIds: [],
          createdAt: Date.now() + i,
          errorCode: null,
        }),
      );
    return ids;
  });
  // Account scope scans the whole table, so foreign rows enter the page and
  // are skipped. The components stage machine is job-global but tracks one
  // row's thread at a time, so owned rows must serialize one per step;
  // widening this page would let a later owned row inherit a stale stage and
  // skip native thread erasure.
  const jobId = await f.t.run((ctx) =>
    ctx.db.insert("deletionJobs", {
      scope: "account",
      actorId: f.userId,
      authId: "test-components-page",
      workspaceId: f.workspaceId,
      userId: f.userId,
      deleteWorkspaces: [
        { workspaceId: f.workspaceId, expectedTeamRevision: 0 },
      ],
      commandKey: "test-components-page",
      intent: "test",
      state: "running",
      phase: "components",
      processed: 0,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retentionUntil: Date.now() + 86400000,
      tableIndex: 0,
    }),
  );
  const read = () => f.t.run((ctx) => ctx.db.get(jobId));
  const step = async () => {
    const before = (await read())!;
    await f.t.mutation(internal.operations.deletionExecutor.advance, {
      jobId,
      revision: before.revision,
    });
    return read();
  };
  // Drain the whole components phase: every step takes at most one row, so
  // each of the 5 foreign agentRuns rows advances the cursor behind it.
  let sawCursor = false;
  for (let n = 0; n < 300; n++) {
    const job = (await read())!;
    if (job.phase !== "components" || job.state !== "running") break;
    const after = (await step())!;
    if (after.phase === "components" && after.cursor) sawCursor = true;
  }
  const done = (await read())!;
  expect(done.phase).not.toBe("components");
  expect(sawCursor).toBe(true);
  // Foreign rows are skipped, never deleted, by the components phase.
  expect(
    await f.t.run((ctx) => ctx.db.query("agentRuns").collect()),
  ).toHaveLength(5);
});
