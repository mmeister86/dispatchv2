import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { mediaFixture } from "../../tests/media-fixture";
const createAlgorithm = makeFunctionReference<"mutation">(
  "intelligence/algorithmProfiles:create",
);
const createAudience = makeFunctionReference<"mutation">(
  "intelligence/audienceProfiles:create",
);
const change = makeFunctionReference<"mutation">(
  "intelligence/profiles:change",
);
const get = makeFunctionReference<"query">("intelligence/profiles:get");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  const f = await mediaFixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "profiles",
      name: "Profiles",
      handle: "@profiles",
      connection: "disconnected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
        publish: false,
      },
    }),
  );
  const scope = { workspaceId: f.workspaceId, accountId };
  let revision = 0;
  const create = async () => {
    const result = await f.signed.mutation(createAlgorithm, {
      ...scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
    });
    revision = result.revision;
    return result.algorithmId;
  };
  const audience = async (description = "Declared builders") => {
    const result = await f.signed.mutation(createAudience, {
      ...scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      description,
    });
    revision = result.revision;
    return result.audienceId;
  };
  const command = async (action: unknown) => {
    const result = await f.signed.mutation(change, {
      ...scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      action,
    });
    revision = result.revision;
    return result;
  };
  return { ...f, scope, create, audience, command, revision: () => revision };
}
test("registered profile selection captures immutable references and stays incomplete without audience or analyzer", async () => {
  const f = await fixture();
  expect((await f.signed.query(get, f.scope)).selection).toBeNull();
  const algorithmId = await f.create();
  let row = await f.signed.query(get, f.scope);
  expect(row.algorithms[0].status).toBe("draft");
  expect(row.capture.algorithmId).toBeNull();
  await expect(
    f.command({
      kind: "select",
      algorithmId,
      audienceId: null,
      reason: "unreviewed",
    }),
  ).rejects.toThrow("REVIEW_REQUIRED");
  await f.command({
    kind: "review-algorithm",
    algorithmId,
    reason: "Read pinned report and integrity manifest",
  });
  await f.command({
    kind: "select",
    algorithmId,
    audienceId: null,
    reason: "Explicit informational context",
  });
  row = await f.signed.query(get, f.scope);
  const captured = row.capture,
    original = row.algorithms[0].payload;
  expect(captured.algorithmId).toBe(algorithmId);
  expect(captured.refs).toEqual({
    questionSet: "unavailable-until-task28",
    normalization: "unavailable-until-task28",
    formula: "dispatch-score-v1",
    routing: "disabled-v1",
    verification: "disabled-v1",
  });
  expect(captured.missing).toEqual(
    expect.arrayContaining(["audience", "embedding", "analysis"]),
  );
  expect(captured.aggregate).toBeNull();
  const audienceId = await f.audience();
  await f.command({
    kind: "review-audience",
    audienceId,
    reason: "Declared authorized account context",
  });
  await f.command({
    kind: "select",
    algorithmId,
    audienceId,
    reason: "Use declared context",
  });
  const after = await f.signed.query(get, f.scope);
  expect(after.capture.audienceId).toBe(audienceId);
  expect(captured.audienceId).toBeNull();
  expect(after.algorithms[0].payload).toEqual(original);
  expect(after.capture.missing).toEqual(["embedding", "analysis"]);
});
test("exact replay survives later revisions and property order; changed intent conflicts", async () => {
  const f = await fixture();
  const input = {
    ...f.scope,
    expectedRevision: 0,
    commandKey: "stable-command-1",
    description: "Original context",
  };
  const first = await f.signed.mutation(createAudience, input);
  await f.signed.mutation(createAudience, {
    ...f.scope,
    expectedRevision: 1,
    commandKey: "stable-command-2",
    description: "New context",
  });
  const reordered = {
    description: input.description,
    commandKey: input.commandKey,
    expectedRevision: input.expectedRevision,
    accountId: input.accountId,
    workspaceId: input.workspaceId,
  };
  expect(await f.signed.mutation(createAudience, reordered)).toEqual(first);
  await expect(
    f.signed.mutation(createAudience, { ...input, description: "Different" }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  expect((await f.signed.query(get, f.scope)).capture.revision).toBe(2);
});
test("CAS races commit one selection and one immutable receipt, never mixed profile pairs", async () => {
  const f = await fixture();
  const algorithmId = await f.create();
  const audienceId = await f.audience();
  await f.command({
    kind: "review-algorithm",
    algorithmId,
    reason: "Pinned source reviewed",
  });
  await f.command({
    kind: "review-audience",
    audienceId,
    reason: "Declared context reviewed",
  });
  const revision = f.revision();
  const outcomes = await Promise.allSettled([
    f.signed.mutation(change, {
      ...f.scope,
      expectedRevision: revision,
      commandKey: "selection-race-1",
      action: {
        kind: "select",
        algorithmId,
        audienceId,
        reason: "Both versions",
      },
    }),
    f.signed.mutation(change, {
      ...f.scope,
      expectedRevision: revision,
      commandKey: "selection-race-2",
      action: {
        kind: "select",
        algorithmId: null,
        audienceId: null,
        reason: "Explicit no selection",
      },
    }),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
  const row = await f.signed.query(get, f.scope);
  expect(row.capture.revision).toBe(revision + 1);
  expect([
    JSON.stringify([algorithmId, audienceId]),
    JSON.stringify([null, null]),
  ]).toContain(
    JSON.stringify([row.capture.algorithmId, row.capture.audienceId]),
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("intelligenceSelections").collect()),
  ).toHaveLength(1);
  const receipts = await f.t.run((ctx) =>
    ctx.db.query("intelligenceProfileReceipts").collect(),
  );
  expect(receipts.filter((r) => r.action === "select")).toHaveLength(1);
});
test("rollback uses a previous actual selection; retire preserves payload/history and forbids restoration", async () => {
  const f = await fixture();
  const algorithmId = await f.create();
  const audienceId = await f.audience();
  await f.command({ kind: "review-algorithm", algorithmId, reason: "Review" });
  await f.command({ kind: "review-audience", audienceId, reason: "Review" });
  await expect(
    f.command({
      kind: "rollback",
      algorithmId,
      audienceId,
      reason: "Never selected",
    }),
  ).rejects.toThrow("ROLLBACK_TARGET_INVALID");
  await f.command({
    kind: "select",
    algorithmId,
    audienceId,
    reason: "Initial selection",
  });
  const payload = (await f.signed.query(get, f.scope)).audiences[0].payload;
  await f.command({
    kind: "select",
    algorithmId: null,
    audienceId: null,
    reason: "Withdraw current selection",
  });
  await f.command({
    kind: "rollback",
    algorithmId,
    audienceId,
    reason: "Fresh explicit rollback",
  });
  expect((await f.signed.query(get, f.scope)).capture.usable).toBe(true);
  await f.command({
    kind: "retire-audience",
    audienceId,
    reason: "Retain only historical context",
  });
  const after = await f.signed.query(get, f.scope);
  expect(after.capture.audienceId).toBeNull();
  expect(after.audiences[0].payload).toEqual(payload);
  expect(after.audiences[0].status).toBe("retired");
  await expect(
    f.command({ kind: "review-audience", audienceId, reason: "Resurrect" }),
  ).rejects.toThrow("PROFILE_RETIRED");
  await expect(
    f.command({
      kind: "rollback",
      algorithmId,
      audienceId,
      reason: "Stale resurrection",
    }),
  ).rejects.toThrow("CURRENT_REVIEW_REQUIRED");
  const history = await f.signed.query(
    makeFunctionReference<"query">("intelligence/profiles:history"),
    { ...f.scope, paginationOpts: { numItems: 2, cursor: null } },
  );
  expect(history.page).toHaveLength(2);
  expect(history.isDone).toBe(false);
  const next = await f.signed.query(
    makeFunctionReference<"query">("intelligence/profiles:history"),
    {
      ...f.scope,
      paginationOpts: { numItems: 2, cursor: history.continueCursor },
    },
  );
  expect(next.page[0]._id).not.toBe(history.page[0]._id);
});
test("current creator/reviewer/activation authority and source expiry fence capture and rollback", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
  const f = await fixture();
  const algorithmId = await f.create();
  const audienceId = await f.audience();
  await f.command({
    kind: "review-algorithm",
    algorithmId,
    reason: "Current review",
  });
  await f.command({
    kind: "review-audience",
    audienceId,
    reason: "Current review",
  });
  await f.command({
    kind: "select",
    algorithmId,
    audienceId,
    reason: "Current activation",
  });
  const before = await f.signed.query(get, f.scope);
  await f.t.run(async (ctx) => {
    const member = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.patch(member._id, { role: "Editor" });
  });
  const withdrawn = await f.signed.query(get, f.scope);
  expect(withdrawn.capture.usable).toBe(false);
  expect(withdrawn.capture.missing).toEqual(
    expect.arrayContaining([
      "algorithm-review",
      "audience-review",
      "selection-authority",
    ]),
  );
  expect(withdrawn.capture.algorithmId).toBe(before.capture.algorithmId);
  expect(withdrawn.algorithms[0].payload).toEqual(before.algorithms[0].payload);
  await expect(
    f.command({
      kind: "rollback",
      algorithmId,
      audienceId,
      reason: "Role withdrawn",
    }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  await f.t.run(async (ctx) => {
    const member = (await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.patch(member._id, { role: "Owner" });
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T01:00:00Z"));
  const expired = await f.signed.query(get, f.scope);
  expect(expired.capture.usable).toBe(false);
  expect(expired.capture.missing).toContain("algorithm-review");
  expect(expired.algorithms[0].payload).toEqual(before.algorithms[0].payload);
  await expect(
    f.command({
      kind: "rollback",
      algorithmId,
      audienceId,
      reason: "Expired snapshot",
    }),
  ).rejects.toThrow("CURRENT_REVIEW_REQUIRED");
  await expect(
    f.command({
      kind: "review-algorithm",
      algorithmId,
      reason: "Reset old deadline",
    }),
  ).rejects.toThrow("SOURCE_REVIEW_EXPIRED");
});
test("unauthenticated, foreign account/version, invalid inputs and inactive workspace fail before writes", async () => {
  const f = await fixture();
  await expect(f.t.query(get, f.scope)).rejects.toThrow();
  const foreign = await f.t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "Foreign",
    });
    const a = (await ctx.db.get(f.scope.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return ctx.db.insert("socialAccounts", { ...fields, workspaceId });
  });
  await expect(
    f.signed.query(get, { ...f.scope, accountId: foreign }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await expect(
    f.signed.mutation(createAudience, {
      ...f.scope,
      expectedRevision: 0,
      commandKey: "valid-key-1",
      description: "",
    }),
  ).rejects.toThrow("INPUT_INVALID");
  await expect(
    f.signed.mutation(createAudience, {
      ...f.scope,
      expectedRevision: 0,
      commandKey: "bad",
      description: "context",
    }),
  ).rejects.toThrow("COMMAND_INVALID");
  await expect(
    f.signed.mutation(createAlgorithm, {
      ...f.scope,
      expectedRevision: NaN,
      commandKey: "valid-key-2",
    }),
  ).rejects.toThrow("REVISION_CONFLICT");
  const algorithmId = await f.create();
  const another = await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(f.scope.accountId))!;
    const { _id, _creationTime, ...fields } = a;
    return ctx.db.insert("socialAccounts", {
      ...fields,
      providerIdentity: "another",
    });
  });
  await expect(
    f.signed.mutation(change, {
      ...f.scope,
      accountId: another,
      expectedRevision: 0,
      commandKey: "valid-key-3",
      action: {
        kind: "review-algorithm",
        algorithmId,
        reason: "Foreign account",
      },
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await expect(
    f.signed.mutation(createAlgorithm, {
      ...f.scope,
      expectedRevision: f.revision(),
      commandKey: "valid-key-4",
      version: "fake-version",
    }),
  ).rejects.toThrow();
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(f.signed.query(get, f.scope)).rejects.toThrow(
    "WORKSPACE_INACTIVE",
  );
  await expect(
    f.signed.mutation(createAlgorithm, {
      ...f.scope,
      expectedRevision: f.revision(),
      commandKey: "valid-key-5",
    }),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
});
test("a separate reviewer or activation actor loses current authority without changing immutable captures", async () => {
  const f = await fixture();
  const { components, api } = await import("../_generated/api");
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Profile Admin",
          email: "profiles-admin@example.test",
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
  const admin = f.t.withIdentity(identity);
  const adminId = await admin.mutation(api.users.bootstrap, {});
  const memberId = await f.t.run((ctx) =>
    ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId: adminId,
      role: "Admin",
    }),
  );
  const algorithmId = await f.create(),
    audienceId = await f.audience();
  let revision = f.revision();
  for (const action of [
    { kind: "review-algorithm", algorithmId, reason: "Admin reviewed source" },
    {
      kind: "review-audience",
      audienceId,
      reason: "Admin reviewed declaration",
    },
  ])
    revision = (
      await admin.mutation(change, {
        ...f.scope,
        expectedRevision: revision,
        commandKey: crypto.randomUUID(),
        action,
      })
    ).revision;
  revision = (
    await f.signed.mutation(change, {
      ...f.scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      action: {
        kind: "select",
        algorithmId,
        audienceId,
        reason: "Owner activation",
      },
    })
  ).revision;
  const before = await f.signed.query(get, f.scope);
  await f.t.run((ctx) => ctx.db.patch(memberId, { role: "Editor" }));
  let row = await f.signed.query(get, f.scope);
  expect(row.capture.usable).toBe(false);
  expect(row.capture.missing).toContain("algorithm-review");
  expect(row.capture.missing).not.toContain("selection-authority");
  expect(row.capture.refs).toEqual(before.capture.refs);
  await expect(
    f.signed.mutation(change, {
      ...f.scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      action: {
        kind: "rollback",
        algorithmId,
        audienceId,
        reason: "Reviewer revoked",
      },
    }),
  ).rejects.toThrow("CURRENT_REVIEW_REQUIRED");
  for (const action of [
    { kind: "review-algorithm", algorithmId, reason: "Fresh Owner review" },
    { kind: "review-audience", audienceId, reason: "Fresh Owner review" },
  ])
    revision = (
      await f.signed.mutation(change, {
        ...f.scope,
        expectedRevision: revision,
        commandKey: crypto.randomUUID(),
        action,
      })
    ).revision;
  await f.t.run((ctx) => ctx.db.patch(memberId, { role: "Admin" }));
  revision = (
    await admin.mutation(change, {
      ...f.scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      action: {
        kind: "select",
        algorithmId,
        audienceId,
        reason: "Current admin activation",
      },
    })
  ).revision;
  await f.t.run((ctx) => ctx.db.delete(memberId));
  row = await f.signed.query(get, f.scope);
  expect(row.capture.usable).toBe(false);
  expect(row.capture.missing).toContain("selection-authority");
  expect(row.capture.missing).not.toContain("algorithm-review");
  expect(row.algorithms[0].payload).toEqual(before.algorithms[0].payload);
  await expect(
    admin.mutation(createAudience, {
      ...f.scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      description: "No member",
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
});
test("declared context preserves multiline text and rejects non-text controls", async () => {
  const f = await fixture();
  const description = "Builders\nMaintainers and operators";
  const audienceId = await f.audience(description);
  expect(
    (await f.signed.query(get, f.scope)).audiences.find(
      (p: { _id: string }) => p._id === audienceId,
    ).payload.description,
  ).toBe(description);
  await expect(f.audience("Builders\u0000hidden")).rejects.toThrow(
    "INPUT_INVALID",
  );
});
test("rollback finds the old exact pair after many unrelated receipts and retains older selected versions", async () => {
  const f = await fixture();
  const algorithmId = await f.create(),
    audienceId = await f.audience("Original declared context");
  await f.command({
    kind: "review-algorithm",
    algorithmId,
    reason: "Review exact source",
  });
  await f.command({
    kind: "review-audience",
    audienceId,
    reason: "Review original context",
  });
  await f.command({
    kind: "select",
    algorithmId,
    audienceId,
    reason: "Original exact pair",
  });
  await f.command({
    kind: "select",
    algorithmId: null,
    audienceId: null,
    reason: "Withdraw pair",
  });
  for (let i = 0; i < 55; i++) await f.audience(`Unrelated declaration ${i}`);
  const before = await f.signed.query(get, f.scope);
  expect(before.audiences).toHaveLength(50);
  expect(
    before.audiences.some((p: { _id: string }) => p._id === audienceId),
  ).toBe(false);
  const neverSelected = before.audiences[0]._id;
  await f.command({
    kind: "review-audience",
    audienceId: neverSelected,
    reason: "Another reviewed declaration",
  });
  await expect(
    f.command({
      kind: "rollback",
      algorithmId,
      audienceId: neverSelected,
      reason: "Wrong exact pair",
    }),
  ).rejects.toThrow("ROLLBACK_TARGET_INVALID");
  await f.command({
    kind: "rollback",
    algorithmId,
    audienceId,
    reason: "Fresh return to original exact pair",
  });
  const after = await f.signed.query(get, f.scope);
  expect(after.capture.algorithmId).toBe(algorithmId);
  expect(after.capture.audienceId).toBe(audienceId);
  expect(after.capture.usable).toBe(true);
  expect(after.audiences).toHaveLength(51);
  expect(
    after.audiences.find((p: { _id: string }) => p._id === audienceId).payload
      .description,
  ).toBe("Original declared context");
});
