import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { performance as realPerformance } from "node:perf_hooks";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import * as hashing from "../lib/crypto";
import * as contentProof from "../research/contentProof";
import type { Id } from "../_generated/dataModel";
import { api, internal, components } from "../_generated/api";
import { mediaFixture } from "../../tests/media-fixture";
import { sourceFixture, send } from "../../tests/github-fixture";
import { modelFixture } from "../../tests/model-fixture";
const change = makeFunctionReference<"mutation">("ai/styleProfiles:change");
const get = makeFunctionReference<"query">("ai/styleProfiles:get");
const sweep = makeFunctionReference<"mutation">("ai/styleProfiles:sweep");
const payload = {
  author: "Human assertion",
  experiences: ["User statement"],
  tone: "Clear",
  positioning: "Useful",
  pillars: [{ name: "Product", weight: 100 }],
  examples: ["I raised €10m — quoted example, not biography"],
  forbidden: ["guaranteed"],
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture(base?: Awaited<ReturnType<typeof mediaFixture>>) {
  const f = base ?? (await mediaFixture());
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "style",
      name: "Style",
      handle: "@style",
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
  const command = async (action: unknown) => {
    const r = await f.signed.mutation(change, {
      ...scope,
      expectedRevision: revision,
      commandKey: crypto.randomUUID(),
      action,
    });
    revision = r.revision;
    return r;
  };
  const save = () =>
    command({
      kind: "save",
      payload,
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Fresh authorized self declaration",
    });
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "Manual",
    content: {
      title: "Original",
      text: ["Before"],
      media: [],
      accountId,
      pillar: "",
      strategy: "",
    },
  });
  const before = (await f.t.run((ctx) => ctx.db.get(draftId)))!
    .currentVersionId!;
  const after = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId,
    expectedRevision: 1,
    content: {
      title: "Result",
      text: ["After"],
      media: [],
      accountId,
      pillar: "",
      strategy: "",
    },
    reason: "Human edit",
  });
  const feedback = (
    await f.signed.query(api.content.feedback.list, scope)
  ).find((r) => r.kind === "edit")!;
  return {
    ...f,
    scope,
    accountId,
    command,
    save,
    revision: () => revision,
    draftId,
    before,
    after,
    feedback,
  };
}
async function profile(f: Awaited<ReturnType<typeof fixture>>) {
  const row = await f.signed.query(api.ai.styleProfiles.get, f.scope);
  return {
    ...row,
    versions: await Promise.all(
      row.versions.map((v) =>
        f.signed.query(api.ai.styleProfiles.version, {
          ...f.scope,
          versionId: v._id,
        }),
      ),
    ),
    proposals: await Promise.all(
      row.proposals.map((p) =>
        f.signed.query(api.ai.styleProfiles.proposal, {
          ...f.scope,
          proposalId: p._id,
        }),
      ),
    ),
  };
}
async function decisions(
  f: Awaited<ReturnType<typeof fixture>>,
  cursor: string | null,
  numItems = 25,
) {
  const row = await f.signed.query(api.ai.styleProfiles.history, {
    ...f.scope,
    paginationOpts: { numItems, cursor },
  });
  return {
    ...row,
    page: await Promise.all(
      row.page.map((r) =>
        f.signed.query(api.ai.styleProfiles.receipt, {
          ...f.scope,
          receiptId: r._id,
        }),
      ),
    ),
  };
}
test("registered empty account and save/select/replay keep declaration and selection distinct", async () => {
  const f = await fixture();
  expect((await profile(f)).control).toBeNull();
  const r = await f.save();
  let row = await profile(f);
  expect(row.control!.selectedVersionId).toBeNull();
  expect(row.versions[0].payload).toEqual(payload);
  await f.command({
    kind: "select",
    versionId: r.versionId,
    reason: "Explicit",
  });
  const selected = (await profile(f)).control!;
  await f.save();
  row = await profile(f);
  expect(row.control!.selectedVersionId).toBe(r.versionId);
  expect(row.control!.selectionReceiptId).toBe(selected.selectionReceiptId);
  expect(row.control!.selectedBy).toBe(selected.selectedBy);
  expect(row.versions).toHaveLength(2);
});
test("registered source cleanup follows exact resulting feedback version", async () => {
  const f = await fixture();
  await f.t.mutation(internal.content.feedback.purgeVersion, {
    versionId: f.after,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.feedback._id)))!.editExtent,
  ).toBeNull();
});
test("registered null-horizon legacy feedback still gets current result proof and physical sweep", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.after, { sourceUnavailable: true }));
  await f.t.mutation(internal.content.feedback.sweep, { cursor: null });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.feedback._id)))!.sourceUnavailable,
  ).toBe(true);
});
test("human correction creates a source-bound version without selecting or inferring identity", async () => {
  const f = await fixture();
  const r = await f.save();
  await f.command({
    kind: "select",
    versionId: r.versionId,
    reason: "Explicit",
  });
  const p = await f.command({
    kind: "propose",
    baseVersionId: r.versionId,
    feedbackId: f.feedback._id,
    preferences: {
      tone: "Short",
      positioning: "",
      pillars: payload.pillars,
      examples: ["I founded ten companies"],
      forbidden: [],
    },
    ownExamples: true,
    reason: "Exact human correction",
  });
  const a = await f.command({
    kind: "accept",
    proposalId: p.proposalId,
    reason: "Human confirmed",
  });
  let row = await profile(f);
  expect(row.control!.selectedVersionId).toBe(r.versionId);
  expect(
    row.versions.find((x: { _id: string }) => x._id === a.versionId)!.payload!
      .experiences,
  ).toEqual(payload.experiences);
  await f.t.run((ctx) => ctx.db.patch(f.after, { sourceUnavailable: true }));
  row = await profile(f);
  expect(
    row.versions.find((x: { _id: string }) => x._id === a.versionId)!.payload,
  ).toBeNull();
  await f.t.mutation(sweep, { cursor: null, table: "proposals" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const stored = await f.t.run((ctx) =>
    ctx.db.get(a.versionId as Id<"styleProfileVersions">),
  );
  expect(stored!.payload).toBeNull();
});
async function prefs() {
  const { author, experiences, ...preferences } = payload;
  return preferences;
}
async function propose(
  f: Awaited<ReturnType<typeof fixture>>,
  baseVersionId: Id<"styleProfileVersions">,
) {
  return f.command({
    kind: "propose",
    baseVersionId,
    feedbackId: f.feedback._id,
    preferences: await prefs(),
    ownExamples: true,
    reason: "Protected correction sentinel",
  });
}
test("all declaration bounds, controls and unknown references fail before any style write", async () => {
  const f = await fixture();
  const invalid = [
    { ...payload, pillars: [] },
    { ...payload, pillars: [{ name: " ", weight: 100 }] },
    {
      ...payload,
      pillars: [
        { name: " Product ", weight: 50 },
        { name: "Product", weight: 50 },
      ],
    },
    { ...payload, pillars: [{ name: "Product", weight: 99 }] },
    { ...payload, pillars: [{ name: "Product", weight: 100.5 }] },
    { ...payload, pillars: [{ name: "Product", weight: NaN }] },
    {
      ...payload,
      pillars: Array.from({ length: 13 }, (_, i) => ({
        name: String(i),
        weight: i === 0 ? 100 : 0,
      })),
    },
    { ...payload, pillars: [{ name: "a".repeat(101), weight: 100 }] },
    { ...payload, author: "a".repeat(101) },
    { ...payload, tone: "a".repeat(1001) },
    { ...payload, positioning: "a".repeat(2001) },
    { ...payload, experiences: Array(11).fill("x") },
    { ...payload, experiences: ["x".repeat(501)] },
    { ...payload, examples: Array(6).fill("x") },
    { ...payload, examples: ["x".repeat(4001)] },
    { ...payload, forbidden: Array(31).fill("x") },
    { ...payload, forbidden: ["x".repeat(201)] },
    { ...payload, tone: "text\u0000hidden" },
    { ...payload, tone: "text\u0085hidden" },
    { ...payload, examples: Array(5).fill("🧠".repeat(4000)) },
  ];
  for (const value of invalid)
    await expect(
      f.command({
        kind: "save",
        payload: value,
        freshDeclaration: true,
        baseVersionId: null,
        reason: "Check",
      }),
    ).rejects.toThrow("STYLE_INPUT_INVALID");
  await expect(
    f.command({
      kind: "save",
      payload: { ...payload, actorId: f.userId },
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Foreign actor",
    }),
  ).rejects.toThrow();
  await expect(
    f.command({
      kind: "save",
      payload,
      freshDeclaration: false,
      baseVersionId: null,
      reason: "No declaration",
    }),
  ).rejects.toThrow("FRESH_DECLARATION_REQUIRED");
  expect((await profile(f)).control).toBeNull();
  const accepted = await f.command({
    kind: "save",
    payload: {
      ...payload,
      tone: "Unicode 🧠\nOrdinary\ttext",
      pillars: [{ name: " Product ", weight: 100 }],
    },
    freshDeclaration: true,
    baseVersionId: null,
    reason: "Unicode",
  });
  const value = (await profile(f)).versions.find(
    (x: { _id: string }) => x._id === accepted.versionId,
  )!.payload;
  expect(value!.tone).toContain("\nOrdinary\ttext");
  expect(value!.pillars[0].name).toBe("Product");
});
test("exact replay after later selection/retirement and reordered keys cannot reapply or alter original intent", async () => {
  const f = await fixture();
  const input = {
    ...f.scope,
    expectedRevision: 0,
    commandKey: "original-save",
    action: {
      kind: "save",
      payload,
      freshDeclaration: true,
      baseVersionId: null,
      reason: "Fresh",
    },
  };
  const first = await f.signed.mutation(change, input);
  const next = await f.signed.mutation(change, {
    ...f.scope,
    expectedRevision: 1,
    commandKey: "explicit-select",
    action: { kind: "select", versionId: first.versionId, reason: "Select" },
  });
  await f.signed.mutation(change, {
    ...f.scope,
    expectedRevision: 2,
    commandKey: "explicit-retire",
    action: { kind: "retire", versionId: first.versionId, reason: "Retire" },
  });
  expect(
    await f.signed.mutation(change, {
      action: {
        reason: "Fresh",
        baseVersionId: null,
        freshDeclaration: true,
        payload: {
          forbidden: payload.forbidden,
          examples: payload.examples,
          pillars: payload.pillars,
          positioning: payload.positioning,
          tone: payload.tone,
          experiences: payload.experiences,
          author: payload.author,
        },
        kind: "save",
      },
      commandKey: input.commandKey,
      expectedRevision: 0,
      accountId: f.accountId,
      workspaceId: f.workspaceId,
    }),
  ).toEqual(first);
  expect(
    await f.signed.mutation(change, {
      ...f.scope,
      expectedRevision: 1,
      commandKey: "explicit-select",
      action: { kind: "select", versionId: first.versionId, reason: "Select" },
    }),
  ).toEqual(next);
  await expect(
    f.signed.mutation(change, {
      ...input,
      action: { ...input.action, reason: "Changed" },
    }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  expect((await profile(f)).control!.selectedVersionId).toBeNull();
});
test("native CAS race commits one control revision and one successful receipt", async () => {
  const f = await fixture(),
    r = await f.save();
  const results = await Promise.allSettled(
    ["race-one", "race-two"].map((commandKey) =>
      f.signed.mutation(change, {
        ...f.scope,
        commandKey,
        expectedRevision: 1,
        action: { kind: "select", versionId: r.versionId, reason: "Race" },
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect((await profile(f)).control!.revision).toBe(2);
  expect(
    (await f.t.run((ctx) => ctx.db.query("styleProfileCommands").collect()))
      .length,
  ).toBe(2);
});
test("current roles, account/tenant and lifecycle guard commands and exact replay", async () => {
  const f = await fixture(),
    r = await f.save();
  const member = (await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique(),
  ))!;
  for (const role of ["Viewer", "Editor"] as const) {
    await f.t.run((ctx) => ctx.db.patch(member._id, { role }));
    await expect(f.save()).rejects.toThrow("ROLE_ACCESS_DENIED");
    expect((await profile(f)).versions[0].payload).toBeNull();
  }
  await f.t.run((ctx) => ctx.db.patch(member._id, { role: "Owner" }));
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Foreign",
          email: "foreign@example.test",
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
  const other = f.t.withIdentity(identity);
  await other.mutation(api.users.bootstrap, {});
  await expect(other.query(get, f.scope)).rejects.toThrow(
    "WORKSPACE_ACCESS_DENIED",
  );
  const otherAccount = await fixture(f);
  await expect(
    otherAccount.command({
      kind: "select",
      versionId: r.versionId,
      reason: "Foreign",
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(f.save()).rejects.toThrow("WORKSPACE_INACTIVE");
  await f.t.mutation(sweep, { cursor: null, table: "versions" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(r.versionId as Id<"styleProfileVersions">),
    ))!.payload,
  ).toBeNull();
});
test("proposal cannot infer biography, needs own-example permission and rejection does not select", async () => {
  const f = await fixture(),
    r = await f.save();
  await f.command({
    kind: "select",
    versionId: r.versionId,
    reason: "Explicit",
  });
  const action = {
    kind: "propose",
    baseVersionId: r.versionId,
    feedbackId: f.feedback._id,
    preferences: await prefs(),
    ownExamples: false,
    reason: "Own sample",
  };
  await expect(f.command(action)).rejects.toThrow("OWN_EXAMPLES_REQUIRED");
  await expect(
    f.command({
      ...action,
      ownExamples: true,
      preferences: {
        ...(await prefs()),
        author: "Inferred identity",
        experiences: ["Inferred success"],
      },
    }),
  ).rejects.toThrow();
  const before = (await profile(f)).control!;
  const p = await propose(f, r.versionId);
  await f.command({
    kind: "reject",
    proposalId: p.proposalId,
    reason: "Decline",
  });
  const row = await profile(f);
  expect(row.versions).toHaveLength(1);
  expect(row.control!.selectionReceiptId).toBe(before.selectionReceiptId);
  expect(row.proposals[0].state).toBe("rejected");
});
test("feedback wrong adjacent result/draft/account/actor edges and unavailable event cannot become style sources", async () => {
  const f = await fixture(),
    r = await f.save();
  await f.command({
    kind: "select",
    versionId: r.versionId,
    reason: "Explicit",
  });
  const saved = await f.t.run((ctx) => ctx.db.get(f.feedback._id));
  const another = await fixture(f);
  const cases = [
    { resultingVersionId: f.before },
    { accountId: another.accountId },
    { resultingVersionId: null },
    { sourceUnavailable: true },
  ];
  for (const bad of cases) {
    await f.t.run((ctx) => ctx.db.patch(f.feedback._id, bad as never));
    await expect(propose(f, r.versionId)).rejects.toThrow();
    await f.t.run((ctx) =>
      ctx.db.patch(f.feedback._id, {
        resultingVersionId: saved!.resultingVersionId,
        accountId: saved!.accountId,
        sourceUnavailable: false,
      }),
    );
  }
  const result = (await f.t.run((ctx) => ctx.db.get(f.after)))!,
    admin = await secondAdmin(f);
  for (const bad of [
    { draftId: another.draftId },
    { authorId: admin.userId },
    { content: { ...result.content, accountId: another.accountId } },
  ]) {
    await f.t.run((ctx) => ctx.db.patch(f.after, bad));
    await expect(propose(f, r.versionId)).rejects.toThrow(
      "FEEDBACK_SOURCE_UNAVAILABLE",
    );
    await f.t.run((ctx) =>
      ctx.db.patch(f.after, {
        draftId: result.draftId,
        authorId: result.authorId,
        content: result.content,
      }),
    );
  }
  await f.t.run((ctx) => ctx.db.patch(f.after, { number: 4 }));
  await expect(propose(f, r.versionId)).rejects.toThrow(
    "FEEDBACK_SOURCE_UNAVAILABLE",
  );
  expect((await profile(f)).proposals).toHaveLength(0);
});
test("source-bound copies cannot change declarations or shed ancestry; actual reset/retire/rollback stay explicit", async () => {
  const f = await fixture(),
    r = await f.save();
  await expect(
    f.command({
      kind: "rollback",
      receiptId: r.receiptId,
      reason: "Never selected",
    }),
  ).rejects.toThrow("ROLLBACK_TARGET_INVALID");
  const selection = await f.command({
    kind: "select",
    versionId: r.versionId,
    reason: "Original selection",
  });
  await f.command({ kind: "reset", reason: "Explicit no style" });
  expect((await profile(f)).control!.selectedVersionId).toBeNull();
  await f.command({
    kind: "rollback",
    receiptId: selection.receiptId,
    reason: "Actual history",
  });
  await expect(
    f.command({
      kind: "save",
      baseVersionId: r.versionId,
      freshDeclaration: false,
      payload: { ...payload, author: "Other person" },
      reason: "Copy cannot change author",
    }),
  ).rejects.toThrow("FRESH_DECLARATION_REQUIRED");
  const p = await propose(f, r.versionId),
    accepted = await f.command({
      kind: "accept",
      proposalId: p.proposalId,
      reason: "Accept protected sentinel",
    });
  const copy = await f.command({
    kind: "save",
    baseVersionId: accepted.versionId,
    freshDeclaration: false,
    payload: { ...payload, tone: "Copied correction" },
    reason: "Copy protected sentinel",
  });
  await f.command({
    kind: "select",
    versionId: copy.versionId,
    reason: "Select protected sentinel",
  });
  await f.command({ kind: "reset", reason: "Reset protected sentinel" });
  await f.t.mutation(internal.content.feedback.purgeVersion, {
    versionId: f.after,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of [accepted.versionId, copy.versionId]) {
    const row = await f.t.run((ctx) =>
      ctx.db.get(id as Id<"styleProfileVersions">),
    );
    expect(row!.payload).toBeNull();
    expect(row!.reason).toBe("");
  }
  const receipts = await f.t.run((ctx) =>
    ctx.db.query("styleProfileCommands").collect(),
  );
  expect(
    receipts.filter((x) => x.reason.includes("protected sentinel")),
  ).toHaveLength(0);
  await expect(
    f.command({
      kind: "select",
      versionId: copy.versionId,
      reason: "No resurrection",
    }),
  ).rejects.toThrow("SOURCE_UNAVAILABLE");
  const fresh = await f.save();
  expect(
    (await profile(f)).versions.find(
      (x: { _id: string }) => x._id === fresh.versionId,
    )!.payload,
  ).not.toBeNull();
});
test("new copied version cannot exceed the actual 32-node ancestry bound or leave partial rows", async () => {
  const f = await fixture();
  let r = await f.save();
  for (let n = 1; n < 32; n++)
    r = await f.command({
      kind: "save",
      baseVersionId: r.versionId,
      freshDeclaration: false,
      payload,
      reason: "Inherited copy",
    });
  const revision = f.revision();
  await expect(
    f.command({
      kind: "save",
      baseVersionId: r.versionId,
      freshDeclaration: false,
      payload,
      reason: "Overflow",
    }),
  ).rejects.toThrow("ANCESTRY_LIMIT");
  expect((await profile(f)).control!.revision).toBe(revision);
  expect(
    await f.t.run((ctx) => ctx.db.query("styleProfileVersions").collect()),
  ).toHaveLength(32);
});

test("new proposal and acceptance reserve their own ancestry nodes before writes", async () => {
  const f = await fixture();
  let r = await f.save();
  for (let n = 1; n < 31; n++)
    r = await f.command({
      kind: "save",
      baseVersionId: r.versionId,
      freshDeclaration: false,
      payload,
      reason: "Inherited copy",
    });
  await f.command({
    kind: "select",
    versionId: r.versionId,
    reason: "Actual base",
  });
  const p = await propose(f, r.versionId);
  await expect(
    f.command({ kind: "accept", proposalId: p.proposalId, reason: "Overflow" }),
  ).rejects.toThrow("ANCESTRY_LIMIT");
  const copy = await f.command({
    kind: "save",
    baseVersionId: r.versionId,
    freshDeclaration: false,
    payload,
    reason: "32nd node",
  });
  await f.command({
    kind: "select",
    versionId: copy.versionId,
    reason: "Actual longest base",
  });
  await expect(propose(f, copy.versionId)).rejects.toThrow("ANCESTRY_LIMIT");
  expect(
    await f.t.run((ctx) => ctx.db.query("learningProposals").collect()),
  ).toHaveLength(1);
});
async function githubCorrection() {
  const source = await sourceFixture();
  await source.t.run((ctx) =>
    ctx.db.patch(source.repositories[0], { content: true }),
  );
  expect((await send(source)).status).toBe(202);
  const delivery = (await source.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  ))!;
  await source.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: delivery._id,
  });
  const signal = (await source.t.run((ctx) =>
    ctx.db.query("githubSignals").first(),
  ))!;
  const f = await fixture(source);
  const ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    title: "GitHub idea",
    note: "Human note",
    perspective: "Human perspective",
    priority: "normal",
    source: { kind: "signal", signalId: signal._id },
    operationKey: crypto.randomUUID(),
  });
  const handed = await f.signed.mutation(api.content.ideas.handoff, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    intent: "Human draft intent",
    draftText: "Before GitHub correction",
    clarificationConfirmed: false,
  });
  const after = await f.signed.mutation(api.editorial.save, {
    workspaceId: f.workspaceId,
    draftId: handed.draftId,
    expectedRevision: 1,
    content: {
      title: "GitHub idea",
      text: ["After GitHub correction"],
      media: [],
      accountId: f.accountId,
      pillar: "",
      strategy: "",
    },
    reason: "Actual correction",
  });
  const feedback = (
    await f.signed.query(api.content.feedback.list, f.scope)
  ).find(
    (x) => x.versionId === handed.versionId && x.resultingVersionId === after,
  )!;
  return {
    ...f,
    repositoryId: source.repositories[0],
    feedback,
    before: handed.versionId,
    after,
    draftId: handed.draftId,
  };
}
test("actual signed GitHub idea handoff has bilateral original/current horizons and immediate protected masks", async () => {
  const f = await githubCorrection(),
    r = await f.save();
  await f.command({ kind: "select", versionId: r.versionId, reason: "Base" });
  const p = await propose(f, r.versionId),
    accepted = await f.command({
      kind: "accept",
      proposalId: p.proposalId,
      reason: "GitHub protected",
    });
  const stored = (await f.t.run((ctx) =>
    ctx.db.get(p.proposalId as Id<"learningProposals">),
  ))!;
  expect(stored.beforeUntil).toBeGreaterThan(Date.now());
  expect(stored.resultUntil).toBe(stored.beforeUntil);
  // Renewed current repository proof cannot extend the immutable feedback/proposal capture.
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositoryId, { proofExpiresAt: Date.now() + 3600000 }),
  );
  vi.setSystemTime(stored.beforeUntil! + 1);
  expect(
    (await profile(f)).versions.find(
      (x: { _id: string }) => x._id === accepted.versionId,
    )!.payload,
  ).toBeNull();
  await expect(
    f.command({
      kind: "select",
      versionId: accepted.versionId,
      reason: "Expired",
    }),
  ).rejects.toThrow();
  await f.t.mutation(internal.content.feedback.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(accepted.versionId as Id<"styleProfileVersions">),
    ))!.payload,
  ).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(f.draftId))).not.toBeNull();
});
test("null-horizon GitHub derivatives and more than one indexed cleanup batch drain while financial and publishing parents survive", async () => {
  const f = await githubCorrection(),
    r = await f.save();
  await f.command({ kind: "select", versionId: r.versionId, reason: "Base" });
  const p = await propose(f, r.versionId),
    accepted = await f.command({
      kind: "accept",
      proposalId: p.proposalId,
      reason: "Protected accepted",
    });
  const copies = [];
  for (let n = 0; n < 56; n++)
    copies.push(
      await f.command({
        kind: "save",
        baseVersionId: accepted.versionId,
        freshDeclaration: false,
        payload: { ...payload, tone: "Copied GitHub" },
        reason: "Protected copy",
      }),
    );
  const finance = await modelFixture(f),
    runId = await finance.create();
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: "fixture-finance",
  });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    runId,
    generation: 1,
    executionKey: "fixture-finance",
    key: "fixture-finance-attempt",
  });
  await f.t.mutation(internal.ai.runs.settle, {
    attemptId,
    inputTokens: 10,
    outputTokens: 0,
    errorCode: null,
  });
  const financialBefore = await f.t.run(async (ctx) => ({
    attempt: await ctx.db.get(attemptId),
    budgets: await ctx.db.query("aiBudgets").collect(),
  }));
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.accountId, {
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
        publish: true,
      },
    });
    for (const v of await ctx.db.query("styleProfileVersions").collect())
      await ctx.db.patch(v._id, { sourceUntil: null });
    await ctx.db.patch(p.proposalId as Id<"learningProposals">, {
      sourceUntil: null,
      beforeUntil: null,
      resultUntil: null,
    });
    await ctx.db.patch(f.feedback._id, { sourceUntil: null });
  });
  const approvalId = await f.signed.mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    versionId: f.after,
    accountId: f.accountId,
  });
  const approvalBefore = await f.t.run((ctx) => ctx.db.get(approvalId));
  await f.t.run((ctx) => ctx.db.patch(f.repositoryId, { monitoring: false }));
  const masked = await profile(f);
  expect(
    masked.versions.every(
      (x: { baseVersionId: string | null; payload: unknown }) =>
        !x.baseVersionId || x.payload === null,
    ),
  ).toBe(true);
  await f.t.mutation(internal.content.feedback.sweep, { cursor: null });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of [accepted.versionId, ...copies.map((x) => x.versionId)]) {
    const row = (await f.t.run((ctx) =>
      ctx.db.get(id as Id<"styleProfileVersions">),
    ))!;
    expect(row.payload).toBeNull();
    expect(row.reason).toBe("");
  }
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(p.proposalId as Id<"learningProposals">),
    ))!.preferences,
  ).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(approvalId))).toEqual(
    approvalBefore,
  );
  expect(
    await f.t.run(async (ctx) => ({
      attempt: await ctx.db.get(attemptId),
      budgets: await ctx.db.query("aiBudgets").collect(),
    })),
  ).toEqual(financialBefore);
});
test("retiring an unselected ancestor retains history but fences copied selection and rollback without erasure", async () => {
  const f = await fixture(),
    v1 = await f.save();
  const v2 = await f.command({
    kind: "save",
    baseVersionId: v1.versionId,
    freshDeclaration: false,
    payload,
    reason: "Copied retained history",
  });
  const selection = await f.command({
    kind: "select",
    versionId: v2.versionId,
    reason: "Historical copy selection",
  });
  await f.command({
    kind: "retire",
    versionId: v1.versionId,
    reason: "Ordinary retirement",
  });
  const before = await profile(f);
  expect(before.usable).toBe(false);
  expect(before.control!.selectedVersionId).toBe(v2.versionId);
  expect(
    before.versions.every((x: { payload: unknown }) => x.payload !== null),
  ).toBe(true);
  await expect(
    f.command({
      kind: "rollback",
      receiptId: selection.receiptId,
      reason: "Retired dependency",
    }),
  ).rejects.toThrow("SOURCE_UNAVAILABLE");
  await f.t.mutation(sweep, { cursor: null, table: "versions" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of [v1.versionId, v2.versionId]) {
    const row = (await f.t.run((ctx) =>
      ctx.db.get(id as Id<"styleProfileVersions">),
    ))!;
    expect(row.payload).not.toBeNull();
    expect(row.sourceUnavailable).toBe(false);
  }
});
async function secondAdmin(f: Awaited<ReturnType<typeof fixture>>) {
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Style selector",
          email: "selector@example.test",
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
    userId = await signed.mutation(api.users.bootstrap, {});
  const memberId = await f.t.run((ctx) =>
    ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId,
      role: "Admin",
    }),
  );
  return { signed, userId, memberId };
}
test("correction ancestry keeps the original selector's current authority even after an unrelated fresh selection", async () => {
  const f = await fixture(),
    r = await f.save(),
    admin = await secondAdmin(f);
  await admin.signed.mutation(change, {
    ...f.scope,
    expectedRevision: 1,
    commandKey: "admin-original-selector",
    action: {
      kind: "select",
      versionId: r.versionId,
      reason: "Admin selected original base",
    },
  });
  // The owner's command counter deliberately catches the independently committed native revision.
  const p = await f.signed.mutation(change, {
    ...f.scope,
    expectedRevision: 2,
    commandKey: "owner-proposal",
    action: {
      kind: "propose",
      baseVersionId: r.versionId,
      feedbackId: f.feedback._id,
      preferences: await prefs(),
      ownExamples: true,
      reason: "Actual correction",
    },
  });
  const accepted = await f.signed.mutation(change, {
    ...f.scope,
    expectedRevision: 3,
    commandKey: "owner-accept",
    action: {
      kind: "accept",
      proposalId: p.proposalId,
      reason: "Actual acceptance",
    },
  });
  const copy = await f.signed.mutation(change, {
    ...f.scope,
    expectedRevision: 4,
    commandKey: "owner-copy-derived",
    action: {
      kind: "save",
      baseVersionId: accepted.versionId,
      freshDeclaration: false,
      payload: { ...payload, tone: "Another copied preference" },
      reason: "Copied protected selection ancestry",
    },
  });
  await f.signed.mutation(change, {
    ...f.scope,
    expectedRevision: 5,
    commandKey: "owner-select-derived",
    action: {
      kind: "select",
      versionId: copy.versionId,
      reason: "Owner chooses derivative",
    },
  });
  await f.t.run((ctx) => ctx.db.patch(admin.memberId, { role: "Viewer" }));
  const row = await profile(f);
  expect(row.usable).toBe(false);
  expect(
    row.versions.find((x: { _id: string }) => x._id === accepted.versionId)!
      .payload,
  ).toBeNull();
  await f.t.mutation(sweep, { cursor: null, table: "proposals" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(accepted.versionId as Id<"styleProfileVersions">),
    ))!.payload,
  ).toBeNull();
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(copy.versionId as Id<"styleProfileVersions">),
    ))!.payload,
  ).toBeNull();
  const originalSelection = (await f.t.run((ctx) =>
    ctx.db
      .query("styleProfileCommands")
      .withIndex(
        "by_workspaceId_and_accountId_and_actorId_and_commandKey",
        (q) =>
          q
            .eq("workspaceId", f.workspaceId)
            .eq("accountId", f.accountId)
            .eq("actorId", admin.userId)
            .eq("commandKey", "admin-original-selector"),
      )
      .unique(),
  ))!;
  expect(originalSelection.reason).toBe("");
  expect(originalSelection.sourceUnavailable).toBe(true);
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(r.versionId as Id<"styleProfileVersions">),
    ))!.payload,
  ).not.toBeNull();
});
test("registered repeated decisions and proposals drain both feedback indexes and proposal continuations", async () => {
  const f = await fixture(),
    base = await f.save();
  await f.command({
    kind: "select",
    versionId: base.versionId,
    reason: "Actual base",
  });
  const accepted = [];
  for (let n = 0; n < 51; n++) {
    await f.signed.mutation(api.content.feedback.decide, {
      workspaceId: f.workspaceId,
      versionId: f.after,
      kind: "reject",
    });
    const p = await propose(f, base.versionId);
    accepted.push(
      await f.command({
        kind: "accept",
        proposalId: p.proposalId,
        reason: "Independent human decision on repeated event",
      }),
    );
  }
  await f.t.mutation(internal.content.feedback.purgeVersion, {
    versionId: f.after,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const events = await f.t.run((ctx) =>
    ctx.db.query("contentFeedback").collect(),
  );
  expect(
    events
      .filter(
        (x) => x.versionId === f.after || x.resultingVersionId === f.after,
      )
      .every((x) => x.sourceUnavailable && x.editExtent === null),
  ).toBe(true);
  expect(
    (await f.t.run((ctx) => ctx.db.query("learningProposals").collect())).every(
      (x) => x.sourceUnavailable && x.preferences === null,
    ),
  ).toBe(true);
  for (const r of accepted)
    expect(
      (await f.t.run((ctx) =>
        ctx.db.get(r.versionId as Id<"styleProfileVersions">),
      ))!.payload,
    ).toBeNull();
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(base.versionId as Id<"styleProfileVersions">),
    ))!.payload,
  ).not.toBeNull();
});
test("exact version ancestry cycles fail closed and are physically scrubbed without a partial command", async () => {
  const f = await fixture(),
    r = await f.save();
  await f.t.run((ctx) =>
    ctx.db.patch(r.versionId as Id<"styleProfileVersions">, {
      baseVersionId: r.versionId as Id<"styleProfileVersions">,
    }),
  );
  await expect(
    f.command({ kind: "select", versionId: r.versionId, reason: "Cycle" }),
  ).rejects.toThrow("ANCESTRY_LIMIT");
  expect((await profile(f)).versions[0].payload).toBeNull();
  expect(
    await f.t.run((ctx) => ctx.db.query("styleProfileCommands").collect()),
  ).toHaveLength(1);
  await f.t.mutation(sweep, { cursor: null, table: "versions" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    (await f.t.run((ctx) =>
      ctx.db.get(r.versionId as Id<"styleProfileVersions">),
    ))!.payload,
  ).toBeNull();
});
test("registered history returns its exact empty and continued pages with masked later receipts", async () => {
  const f = await fixture();
  const history = (cursor: string | null) => decisions(f, cursor);
  const empty = await history(null);
  expect(Object.keys(empty).sort()).toEqual([
    "continueCursor",
    "isDone",
    "page",
  ]);
  expect(empty.page).toEqual([]);
  expect(empty.isDone).toBe(true);
  const created = [];
  for (let n = 1; n <= 31; n++)
    created.push(
      await f.command({
        kind: "save",
        payload,
        freshDeclaration: true,
        baseVersionId: null,
        reason: `Receipt ${n}`,
      }),
    );
  await f.t.mutation(internal.ai.styleProfiles.purge, {
    versionId: created[0].versionId,
    proposalId: null,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = await history(cursor);
    pages++;
    expect(Object.keys(page).sort()).toEqual([
      "continueCursor",
      "isDone",
      "page",
    ]);
    expect(typeof page.continueCursor).toBe("string");
    expect(page.page).toHaveLength(pages === 1 ? 25 : 6);
    expect(page.isDone).toBe(pages === 2);
    rows.push(...page.page);
    cursor = page.isDone ? null : page.continueCursor;
    expect(pages).toBeLessThanOrEqual(2);
  } while (cursor !== null);
  expect(rows.map((x) => x.revision)).toEqual(
    Array.from({ length: 31 }, (_, n) => 31 - n),
  );
  expect(new Set(rows.map((x) => x._id)).size).toBe(31);
  const oldest = rows.at(-1)!;
  expect(oldest._id).toBe(created[0].receiptId);
  expect(oldest.sourceUnavailable).toBe(true);
  expect(oldest.reason).toBe("");
  expect(rows[0].reason).toBe("Receipt 31");
});

test.each([
  { name: "small", large: false, edges: 1 },
  { name: "large", large: true, edges: 1 },
  { name: "mixed", large: true, edges: 15 },
])(
  "native read limits preserve every authorized32-node row ($name)",
  async ({ name, large, edges }) => {
    const f = await fixture();
    const value = large
      ? {
          author: "a".repeat(100),
          experiences: Array(10).fill("e".repeat(500)),
          tone: "t".repeat(1000),
          positioning: "p".repeat(2000),
          pillars: [{ name: "n".repeat(100), weight: 100 }],
          examples: Array(5).fill("x".repeat(3030)),
          forbidden: ["f".repeat(200)],
        }
      : payload;
    if (large) {
      value.examples[0] += "x".repeat(
        23990 - new TextEncoder().encode(JSON.stringify(value)).byteLength,
      );
      expect(new TextEncoder().encode(JSON.stringify(value)).byteLength).toBe(
        23990,
      );
    }
    let branch = await f.command({
      kind: "save",
      payload: value,
      baseVersionId: null,
      freshDeclaration: true,
      reason: "Original",
    });

    const { author, experiences, ...preferences } = value;
    for (let n = 0; n < edges; n++) {
      await f.command({
        kind: "select",
        versionId: branch.versionId,
        reason: "Base",
      });
      const p = await f.command({
        kind: "propose",
        baseVersionId: branch.versionId,
        feedbackId: f.feedback._id,
        preferences,
        ownExamples: true,
        reason: "Proposal",
      });
      branch = await f.command({
        kind: "accept",
        proposalId: p.proposalId,
        reason: "Accept",
      });
    }
    for (let n = 1 + 2 * edges; n < 31; n++)
      branch = await f.command({
        kind: "save",
        baseVersionId: branch.versionId,
        freshDeclaration: false,
        payload: value,
        reason: "Copy",
      });
    const max = await f.command({
      kind: "save",
      baseVersionId: branch.versionId,
      freshDeclaration: false,
      payload: value,
      reason: "Selected32",
    });
    const siblings = [];
    for (let n = 0; n < 26; n++)
      siblings.push(
        await f.command({
          kind: "save",
          baseVersionId: branch.versionId,
          freshDeclaration: false,
          payload: { ...value, tone: "Sibling " + n },
          reason: "Sibling32",
        }),
      );
    for (let n = 0; n < 25; n++)
      await f.command({
        kind: "select",
        versionId: max.versionId,
        reason: "Selected32 " + n,
      });
    const limits = {
      databaseQueries: 4096,
      bytesRead: 16 * 1024 * 1024,
      documentsRead: 32000,
    };
    const single = await f.signed.run(async (ctx) => ({
      view: await ctx.runQuery(
        api.ai.styleProfiles.history,
        { ...f.scope, paginationOpts: { numItems: 1, cursor: null } },
        { transactionLimits: limits },
      ),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    const history = await f.signed.run(async (ctx) => ({
      view: await ctx.runQuery(
        api.ai.styleProfiles.history,
        { ...f.scope, paginationOpts: { numItems: 25, cursor: null } },
        { transactionLimits: limits },
      ),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    const projected = await f.signed.run(async (ctx) => ({
      view: await ctx.runQuery(api.ai.styleProfiles.get, f.scope, {
        transactionLimits: limits,
      }),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    const singleDetail = await f.signed.run(async (ctx) => ({
      view: await ctx.runQuery(
        api.ai.styleProfiles.receipt,
        { ...f.scope, receiptId: single.view.page[0]._id },
        { transactionLimits: limits },
      ),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    const receiptDetails = await Promise.all(
      history.view.page.map((r) =>
        f.signed.run(async (ctx) => ({
          view: await ctx.runQuery(
            api.ai.styleProfiles.receipt,
            { ...f.scope, receiptId: r._id },
            { transactionLimits: limits },
          ),
          metrics: await ctx.meta.getTransactionMetrics(),
        })),
      ),
    );
    const versionDetails = await Promise.all(
      projected.view.versions.map((v) =>
        f.signed.run(async (ctx) => ({
          view: await ctx.runQuery(
            api.ai.styleProfiles.version,
            { ...f.scope, versionId: v._id },
            { transactionLimits: limits },
          ),
          metrics: await ctx.meta.getTransactionMetrics(),
        })),
      ),
    );
    console.log(
      "Native style read metrics",
      JSON.stringify({
        name,
        single: single.metrics,
        history: history.metrics,
        get: projected.metrics,
        singleDetail: singleDetail.metrics,
        receipts: receiptDetails.map((x) => x.metrics),
        versions: versionDetails.map((x) => x.metrics),
      }),
    );
    expect(singleDetail.view.sourceUnavailable).toBe(false);
    expect(history.view.page).toHaveLength(25);
    expect(
      receiptDetails
        .map((x) => x.view)
        .every(
          (x) =>
            x.versionId === max.versionId &&
            !x.sourceUnavailable &&
            x.reason.startsWith("Selected32"),
        ),
    ).toBe(true);
    expect(projected.view.versions).toHaveLength(26);
    expect(
      versionDetails
        .map((x) => x.view)
        .every(
          (x) => x.payload !== null && !x.sourceUnavailable && x.reason !== "",
        ),
    ).toBe(true);
    expect(projected.view.usable).toBe(true);
    if (!large) {
      const foreign = await fixture(f),
        foreignVersion = await foreign.save();
      const invalid = siblings.slice(-3);
      await f.t.run(async (ctx) => {
        await ctx.db.patch(invalid[0].versionId, {
          baseVersionId: max.versionId,
        });
        await ctx.db.patch(invalid[1].versionId, {
          baseVersionId: invalid[1].versionId,
        });
        await ctx.db.patch(invalid[2].versionId, {
          baseVersionId: foreignVersion.versionId,
        });
      });
      const checked = await profile(f);
      expect(
        checked.versions
          .filter((x) => x.payload === null)
          .map((x) => x._id)
          .sort(),
      ).toEqual(invalid.map((x) => x.versionId).sort());
      expect(checked.usable).toBe(true);
      await f.t.run((ctx) =>
        ctx.db.patch(f.after, { sourceUnavailable: true }),
      );
      const withdrawn = await profile(f);
      expect(withdrawn.usable).toBe(false);
      expect(withdrawn.versions.every((x) => x.payload === null)).toBe(true);
      const withdrawnHistory = await decisions(f, null);
      expect(
        withdrawnHistory.page.every(
          (x) => x.sourceUnavailable && x.reason === "",
        ),
      ).toBe(true);
    }
  },
);

test.each([
  new Error("Unexpected proof failure"),
  new ConvexError("STYLE_UNKNOWN_PROOF_CODE"),
  new ConvexError("STYLE_COMMAND_INVALID"),
  new ConvexError("RESEARCH_ORDER_INACTIVE"),
  new ConvexError({ code: "STYLE_SOURCE_UNAVAILABLE" }),
])(
  "unknown proof failures propagate without false masking or erasure (%s)",
  async (error) => {
    const f = await fixture(),
      saved = await f.save();
    await f.command({
      kind: "select",
      versionId: saved.versionId,
      reason: "Selected",
    });
    const proposal = await propose(
      f,
      saved.versionId as Id<"styleProfileVersions">,
    );
    const before = await f.t.run(async (ctx) => ({
      versions: await ctx.db.query("styleProfileVersions").collect(),
      commands: await ctx.db.query("styleProfileCommands").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    const spy = vi.spyOn(hashing, "sha256").mockRejectedValue(error);
    try {
      await expect(profile(f)).rejects.toThrow();
      await expect(
        f.signed.query(api.ai.styleProfiles.proposal, {
          ...f.scope,
          proposalId: proposal.proposalId as Id<"learningProposals">,
        }),
      ).rejects.toThrow();
      await expect(
        f.signed.query(api.ai.styleProfiles.receipt, {
          ...f.scope,
          receiptId: saved.receiptId as Id<"styleProfileCommands">,
        }),
      ).rejects.toThrow();
      await expect(
        f.signed.query(api.ai.styleProfiles.inspect, {
          ...f.scope,
          proposalId: proposal.proposalId as Id<"learningProposals">,
        }),
      ).rejects.toThrow();
      await expect(
        f.t.mutation(sweep, { cursor: null, table: "proposals" }),
      ).rejects.toThrow();
      await expect(
        f.t.mutation(sweep, { cursor: null, table: "versions" }),
      ).rejects.toThrow();
      await expect(
        f.t.mutation(sweep, { cursor: null, table: "commands" }),
      ).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(
      await f.t.run(async (ctx) => ({
        versions: await ctx.db.query("styleProfileVersions").collect(),
        commands: await ctx.db.query("styleProfileCommands").collect(),
        scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      })),
    ).toEqual(before);
    expect(
      (await f.t.run((ctx) =>
        ctx.db.get(saved.versionId as Id<"styleProfileVersions">),
      ))!.payload,
    ).not.toBeNull();
  },
);

test.each([false, true])(
  "disjoint26 native catalogs, exact32-node details and bounded cleanup retain physical evidence (mixed=%s)",
  async (mixed) => {
    const started = realPerformance.now();
    const f = await fixture();
    const value = {
      author: "a".repeat(100),
      experiences: Array(10).fill("e".repeat(500)),
      tone: "t".repeat(1000),
      positioning: "p".repeat(2000),
      pillars: [{ name: "n".repeat(100), weight: 100 }],
      examples: Array(5).fill("x".repeat(3030)),
      forbidden: ["f".repeat(200)],
    };
    value.examples[0] += "x".repeat(
      23990 - new TextEncoder().encode(JSON.stringify(value)).byteLength,
    );
    const { author, experiences, ...preferences } = value;
    const parents = [];
    for (let i = 0; i < 26; i++) {
      let branch = await f.command({
        kind: "save",
        payload: value,
        baseVersionId: null,
        freshDeclaration: true,
        reason: "Independent root " + i,
      });
      if (mixed) {
        for (let n = 0; n < 15; n++) {
          const draftId = await f.signed.mutation(api.editorial.create, {
            workspaceId: f.workspaceId,
            source: "Manual",
            content: {
              title: "Before",
              text: Array(10).fill("b".repeat(280)),
              media: [],
              accountId: f.accountId,
              pillar: "",
              strategy: "",
            },
          });
          const resultingVersionId = await f.signed.mutation(
            api.editorial.save,
            {
              workspaceId: f.workspaceId,
              draftId,
              expectedRevision: 1,
              content: {
                title: "After",
                text: Array(10).fill("a".repeat(280)),
                media: [],
                accountId: f.accountId,
                pillar: "",
                strategy: "",
              },
              reason: "Actual independent edit",
            },
          );
          const feedback = (await f.t.run((ctx) =>
            ctx.db
              .query("contentFeedback")
              .withIndex("by_resultingVersionId_and_sourceUnavailable", (q) =>
                q
                  .eq("resultingVersionId", resultingVersionId)
                  .eq("sourceUnavailable", false),
              )
              .unique(),
          ))!;
          await f.command({
            kind: "select",
            versionId: branch.versionId,
            reason: "Independent base",
          });
          const proposed = await f.command({
            kind: "propose",
            baseVersionId: branch.versionId,
            feedbackId: feedback._id,
            preferences,
            ownExamples: true,
            reason: "Independent proposal",
          });
          branch = await f.command({
            kind: "accept",
            proposalId: proposed.proposalId,
            reason: "Independent accepted",
          });
        }
      } else
        for (let n = 1; n < 31; n++)
          branch = await f.command({
            kind: "save",
            payload: value,
            baseVersionId: branch.versionId,
            freshDeclaration: false,
            reason: "Independent parent",
          });
      parents.push(branch);
      console.log(
        "DISJOINT PRODUCER",
        JSON.stringify({ mixed, roots: parents.length, nodesPerRoot: 31 }),
      );
    }
    const leaves = [];
    for (let i = 0; i < 26; i++)
      leaves.push(
        await f.command({
          kind: "save",
          payload: value,
          baseVersionId: parents[i].versionId,
          freshDeclaration: false,
          reason: "Independent leaf32 " + i,
        }),
      );
    for (let i = 0; i < 26; i++)
      await f.command({
        kind: "select",
        versionId: leaves[i].versionId,
        reason: "Independent selection32 " + i,
      });
    await f.command({
      kind: "select",
      versionId: leaves[0].versionId,
      reason: "Older selected leaf32",
    });
    const limits = {
      databaseQueries: 4096,
      bytesRead: 16 * 1024 * 1024,
      documentsRead: 32000,
    };
    const catalog = await f.signed.run(async (ctx) => ({
      view: await ctx.runQuery(api.ai.styleProfiles.get, f.scope, {
        transactionLimits: limits,
      }),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    const history = await f.signed.run(async (ctx) => ({
      view: await ctx.runQuery(
        api.ai.styleProfiles.history,
        { ...f.scope, paginationOpts: { numItems: 25, cursor: null } },
        { transactionLimits: limits },
      ),
      metrics: await ctx.meta.getTransactionMetrics(),
    }));
    expect(catalog.view.versions).toHaveLength(26);
    expect(catalog.view.usable).toBe(true);
    expect(history.view.page).toHaveLength(25);
    expect(
      catalog.view.versions.every((v) => !("payload" in v) && !("reason" in v)),
    ).toBe(true);
    expect(
      history.view.page.every(
        (r) => !("reason" in r) && !("sourceUnavailable" in r),
      ),
    ).toBe(true);
    const details = await Promise.all(
      catalog.view.versions.map((v) =>
        f.signed.run(async (ctx) => ({
          view: await ctx.runQuery(
            api.ai.styleProfiles.version,
            { ...f.scope, versionId: v._id },
            { transactionLimits: limits },
          ),
          metrics: await ctx.meta.getTransactionMetrics(),
        })),
      ),
    );
    const receipts = await Promise.all(
      history.view.page.map((r) =>
        f.signed.run(async (ctx) => ({
          view: await ctx.runQuery(
            api.ai.styleProfiles.receipt,
            { ...f.scope, receiptId: r._id },
            { transactionLimits: limits },
          ),
          metrics: await ctx.meta.getTransactionMetrics(),
        })),
      ),
    );
    const proposals = await Promise.all(
      catalog.view.proposals.map((p) =>
        f.signed.run(async (ctx) => ({
          view: await ctx.runQuery(
            api.ai.styleProfiles.proposal,
            { ...f.scope, proposalId: p._id },
            { transactionLimits: limits },
          ),
          metrics: await ctx.meta.getTransactionMetrics(),
        })),
      ),
    );
    expect(
      details.every((v) => !v.view.sourceUnavailable && v.view.reason !== ""),
    ).toBe(true);
    expect(
      receipts.every((r) => !r.view.sourceUnavailable && r.view.reason !== ""),
    ).toBe(true);
    expect(
      proposals.every(
        (p) =>
          !p.view.sourceUnavailable &&
          p.view.preferences !== null &&
          p.view.reason !== "",
      ),
    ).toBe(true);
    for (const v of details) expect(v.view.payload).toEqual(value);
    // Raw simulator snapshots assert committed state; each proof callback below has native limits independently.
    const snapshot = () =>
      f.t.run(async (ctx) => ({
        versions: await ctx.db.query("styleProfileVersions").collect(),
        proposals: await ctx.db.query("learningProposals").collect(),
        commands: await ctx.db.query("styleProfileCommands").collect(),
      }));
    const before = await snapshot();
    const maintenance = [];
    for (const table of ["versions", "proposals", "commands"] as const) {
      const ids =
        table === "versions"
          ? leaves.map((x) => x.versionId)
          : table === "proposals"
            ? catalog.view.proposals.map((x) => x._id)
            : history.view.page.map((x) => x._id);
      if (!ids.length) continue;
      const target = ids[0];
      let cursor: string | null = null;
      while (true) {
        const page = await f.t.run((ctx) =>
          ctx.db
            .query(
              table === "versions"
                ? "styleProfileVersions"
                : table === "proposals"
                  ? "learningProposals"
                  : "styleProfileCommands",
            )
            .withIndex("by_sourceUnavailable", (q) =>
              q.eq("sourceUnavailable", false),
            )
            .paginate({ numItems: 1, cursor }),
        );
        if (page.page[0]._id === target) break;
        cursor = page.continueCursor;
        expect(page.isDone).toBe(false);
      }
      maintenance.push(
        await f.t.run(async (ctx) => ({
          table,
          metrics:
            (await ctx.runMutation(
              sweep,
              { table, cursor },
              { transactionLimits: limits },
            ),
            await ctx.meta.getTransactionMetrics()),
        })),
      );
    }
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers(), 5000);
    expect(await snapshot()).toEqual(before);
    const scheduled = await f.t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(scheduled.every((job) => job.state.kind === "success")).toBe(true);
    const callbackCounts = scheduled.reduce<Record<string, number>>(
      (counts, job) => {
        const table = (job.args[0] as { table: string }).table;
        counts[table] = (counts[table] ?? 0) + 1;
        return counts;
      },
      {},
    );
    console.log(
      "DISJOINT SPLIT NATIVE",
      JSON.stringify({
        mixed,
        elapsedMs: realPerformance.now() - started,
        callbackCounts,
        callbacksTotal: scheduled.length,
        terminated: true,
        payloadBytes: 23990,
        catalog: catalog.metrics,
        history: history.metrics,
        versions: details.map((x) => x.metrics),
        receipts: receipts.map((x) => x.metrics),
        proposals: proposals.map((x) => x.metrics),
        maintenance,
      }),
    );
  },
  900000,
);

test("actual native resource errors abort reads and cleanup without committed masks or continuations", async () => {
  const f = await fixture(),
    saved = await f.save();
  await f.command({
    kind: "select",
    versionId: saved.versionId,
    reason: "Selected",
  });
  const snapshot = () =>
    f.t.run(async (ctx) => ({
      version: await ctx.db.get(saved.versionId as Id<"styleProfileVersions">),
      commands: await ctx.db.query("styleProfileCommands").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
  const before = await snapshot();
  const limits = {
    databaseQueries: 3,
    bytesRead: 16 * 1024 * 1024,
    documentsRead: 32000,
  };
  const failures = [];
  for (const kind of ["version", "versions", "commands"] as const) {
    const failure = await (kind === "version" ? f.signed : f.t).run(
      async (ctx) => {
        try {
          if (kind === "version")
            await ctx.runQuery(
              api.ai.styleProfiles.version,
              { ...f.scope, versionId: saved.versionId },
              { transactionLimits: limits },
            );
          else
            await ctx.runMutation(
              sweep,
              { table: kind, cursor: null },
              { transactionLimits: limits },
            );
          return null;
        } catch (error) {
          return {
            kind,
            error: String(error),
            typed: error instanceof ConvexError,
            data: error instanceof ConvexError ? error.data : null,
            metrics: await ctx.meta.getTransactionMetrics(),
          };
        }
      },
    );
    expect(failure).not.toBeNull();
    expect(failure!.typed).toBe(false);
    expect(failure!.metrics.databaseQueries.used).toBeGreaterThan(
      limits.databaseQueries,
    );
    failures.push(failure);
  }
  console.log("NATIVE RESOURCE PROPAGATION", JSON.stringify(failures));
  expect(await snapshot()).toEqual(before);
});

test.each([
  new Error("Unexpected feedback database failure"),
  new ConvexError("CONTENT_UNKNOWN_PROOF"),
])(
  "style feedback purge propagates unknown evidence failure without scheduling removal (%s)",
  async (error) => {
    const f = await fixture(),
      saved = await f.save();
    await f.command({
      kind: "select",
      versionId: saved.versionId,
      reason: "Selected",
    });
    await propose(f, saved.versionId as Id<"styleProfileVersions">);
    const snapshot = () =>
      f.t.run(async (ctx) => ({
        proposals: await ctx.db.query("learningProposals").collect(),
        scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      }));
    const before = await snapshot();
    const spy = vi
      .spyOn(contentProof, "draftResearchProof")
      .mockRejectedValue(error);
    try {
      await expect(
        f.t.mutation(internal.ai.styleProfiles.purgeFeedback, {
          feedbackId: f.feedback._id,
        }),
      ).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(await snapshot()).toEqual(before);
  },
);
