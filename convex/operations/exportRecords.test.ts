import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  makeFunctionReference,
  type ApiFromModules,
  type FunctionArgs,
  type FunctionReturnType,
} from "convex/server";
import type { page as pageFunction } from "./exportRecords";
import { mediaFixture } from "../../tests/media-fixture";
import { api } from "../_generated/api";
type Page = ApiFromModules<{
  module: { page: typeof pageFunction };
}>["module"]["page"];
const page = makeFunctionReference<
  "query",
  FunctionArgs<Page>,
  FunctionReturnType<Page>
>("operations/exportRecords:page");
beforeEach(() => vi.stubEnv("R2_MEDIA_BUCKET", "export-tests"));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function args(f: Awaited<ReturnType<typeof mediaFixture>>) {
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  const user = await f.t.run((ctx) => ctx.db.get(f.userId));
  return {
    workspaceId: f.workspaceId,
    expectedAuthId: user!.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "records",
    cursor: null,
    creationUpperBound: null,
  };
}
test("native own upload sessions paginate all lifecycle states without keys or foreign actors", async () => {
  const f = await mediaFixture();
  await f.reserve();
  await f.ready();
  const a = await args(f);
  const first = await f.signed.query(page, {
    ...a,
    family: "ownUploadSessions",
  });
  // One batched page emits every lifecycle state; the tail page is empty.
  expect(first.isDone).toBe(true);
  expect(first.data.selection.rows).toHaveLength(2);
  expect(JSON.stringify(first.data)).not.toMatch(
    /requestId|temporaryKey|objectKey|checksum|bucket|userId/,
  );
  const second = await f.signed.query(page, {
    ...a,
    family: "ownUploadSessions",
    cursor: first.cursor,
    creationUpperBound: first.creationUpperBound,
  });
  expect(second.isDone).toBe(true);
  expect(second.data.selection.rows).toEqual([]);
  const session = await f.t.run((ctx) =>
    ctx.db.query("mediaUploadSessions").first(),
  );
  await f.t.run((ctx) => ctx.db.delete(session!.assetId));
  await expect(
    f.signed.query(page, { ...a, family: "ownUploadSessions" }),
  ).rejects.toThrow();
});
test("native invitations and own commands export selected metadata without contact or command secrets", async () => {
  const f = await mediaFixture(),
    a = await args(f);
  const invitation = await f.signed.mutation(api.team.change, {
    workspaceId: f.workspaceId,
    expectedRevision: 0,
    commandKey: "export-invite-key",
    action: {
      kind: "invite",
      email: "private-invite@example.test",
      role: "Viewer",
      lifetimeDays: 1,
    },
  });
  const r = await f.signed.query(page, {
    ...a,
    family: "teamInvitationRecords",
  });
  expect(r.data.selection.rows[0].id).toBe(invitation.invitationId);
  expect(JSON.stringify(r.data)).not.toMatch(
    /email|private-invite|createdBy|body|commandKey|fingerprint|claim/,
  );
  const c = await f.signed.query(page, { ...a, family: "ownTeamCommands" });
  expect(c.data.selection.rows).toHaveLength(1);
  expect(JSON.stringify(c.data)).not.toMatch(
    /export-invite-key|fingerprint|cleanAfter/,
  );
  await f.t.run(async (ctx) => {
    const m = await ctx.db.query("memberships").first();
    await ctx.db.patch(m!._id, { role: "Viewer" });
  });
  await expect(
    f.signed.query(page, { ...a, family: "teamInvitationRecords" }),
  ).rejects.toThrow();
  const revoked = await f.signed.query(page, {
    ...a,
    family: "ownTeamCommands",
  });
  expect(revoked.data.selection.rows[0]).toMatchObject({
    materialAvailability: "unavailable",
    result: null,
  });
});
test("records reject session switches malformed continuation and future upper bounds", async () => {
  const f = await mediaFixture(),
    a = await args(f);
  await expect(
    f.signed.query(page, {
      ...a,
      family: "ownUploadSessions",
      expectedSessionId: "foreign",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  await expect(
    f.signed.query(page, {
      ...a,
      family: "ownUploadSessions",
      cursor: "invalid",
    }),
  ).rejects.toThrow("EXPORT_REQUEST_INVALID");
  await expect(
    f.signed.query(page, {
      ...a,
      family: "ownUploadSessions",
      cursor: "invalid",
      creationUpperBound: Date.now() + 100000,
    }),
  ).rejects.toThrow("EXPORT_REQUEST_INVALID");
});
test("native manual idea handoff preserves original text and joins immutable draft source", async () => {
  const f = await mediaFixture(),
    a = await args(f);
  const id = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    title: "Own idea",
    perspective: "Manual observation",
    note: "",
    priority: "normal",
    source: { kind: "note" },
    operationKey: "export-own-idea",
  });
  const h = await f.signed.mutation(api.content.ideas.handoff, {
    workspaceId: f.workspaceId,
    ideaId: id,
    expectedRevision: 1,
    accountId: null,
    intent: "Original intent",
    draftText: "Original handed off text",
    clarificationConfirmed: true,
  });
  const r = await f.signed.query(page, { ...a, family: "ownIdeaHandoffs" });
  expect(r.data.selection.rows[0]).toMatchObject({
    id,
    handoff: {
      text: "Original handed off text",
      intent: "Original intent",
      draftVersionId: h.versionId,
    },
  });
  expect(JSON.stringify(r.data)).not.toMatch(
    /candidateCommand|fingerprint|operationKey|contentHash/,
  );
  await f.t.run((ctx) =>
    ctx.db.patch(h.versionId, { ideaVersionId: undefined }),
  );
  await expect(
    f.signed.query(page, { ...a, family: "ownIdeaHandoffs" }),
  ).rejects.toThrow();
});
test("own verified contact prefix returns invitations without foreign contact in rows or cursors", async () => {
  const f = await mediaFixture(),
    a = await args(f);
  for (const [i, email] of [
    "media@example.test",
    "foreign-contact@example.test",
    "media@example.test",
  ].entries())
    await f.signed.mutation(api.team.change, {
      workspaceId: f.workspaceId,
      expectedRevision: i,
      commandKey: `own-email-${i}`,
      action: { kind: "invite", email, role: "Viewer", lifetimeDays: 1 },
    });
  const r = await f.signed.query(page, {
    ...a,
    family: "ownReceivedInvitations",
  });
  // One batched page emits both own invitations; the foreign contact stays out.
  expect(r.data.selection.rows).toHaveLength(2);
  expect(r.isDone).toBe(true);
  expect(JSON.stringify(r)).not.toContain("foreign-contact");
  const next = await f.signed.query(page, {
    ...a,
    family: "ownReceivedInvitations",
    cursor: r.cursor,
    creationUpperBound: r.creationUpperBound,
  });
  expect(next.isDone).toBe(true);
  expect(next.data.selection.rows).toEqual([]);
  expect(JSON.stringify(next)).not.toContain("foreign-contact");
});
test("native draft media references preserve ordered original alt and fail unrelated selectors", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  const f = await mediaFixture(),
    a = await args(f),
    asset = await f.ready();
  const d = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    source: "Manual",
    content: {
      title: "Media",
      text: ["Body"],
      media: [{ assetId: asset.assetId, alt: "Original ordered alt" }],
      accountId: null,
      pillar: "Product",
      strategy: "manual",
    },
  });
  const draft = await f.t.run((ctx) => ctx.db.get(d));
  const version = { kind: "draft" as const, id: draft!.currentVersionId! };
  vi.advanceTimersByTime(1);
  const r = await f.signed.query(page, {
    ...a,
    family: "mediaVersionReferences",
    version,
  });
  expect(r.data.selection.rows[0]).toMatchObject({
    assetId: asset.assetId,
    positions: [{ position: 0, alt: "Original ordered alt" }],
  });
  expect(JSON.stringify(r.data)).not.toMatch(/checksum|objectKey|temporaryKey/);
  await expect(
    f.signed.query(page, { ...a, family: "ownUploadSessions", version }),
  ).rejects.toThrow("EXPORT_REQUEST_INVALID");
});
test("native public GitHub signal validates original receipt and source horizon", async () => {
  const { sourceFixture, send, push } =
    await import("../../tests/github-fixture");
  const { internal } = await import("../_generated/api");
  const f = await sourceFixture();
  await f.t.run((ctx) => ctx.db.patch(f.repositories[0], { private: false }));
  await send(
    f,
    { ...push, repository: { ...push.repository, private: false } },
    "push",
  );
  const receipt = await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  );
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt!._id,
  });
  const a = await args(f);
  const r = await f.signed.query(page, { ...a, family: "publicGithubSignals" });
  expect(r.data.selection.rows).toHaveLength(1);
  expect(JSON.stringify(r.data)).not.toMatch(
    /digest|guid|eventKey|admissionSequence|private secret|head_commit/,
  );
  const signal = await f.t.run((ctx) => ctx.db.query("githubSignals").first());
  await f.t.run((ctx) =>
    ctx.db.patch(signal!._id, { after: "foreign-receipt-value" }),
  );
  await expect(
    f.signed.query(page, { ...a, family: "publicGithubSignals" }),
  ).rejects.toThrow();
});
test("native research handoff exports ordered evidence result lineage and rechecks source", async () => {
  vi.useFakeTimers();
  const { fixture } = await import("../../tests/research-fixture");
  const { internal } = await import("../_generated/api");
  const f = await fixture(["x-recent"]);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      data: [
        {
          id: "123456789",
          text: "Original research fact",
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
    commandKey: "export-evidence",
    annotation: {
      claim: "Original research fact",
      quote: "Original research fact",
      interpretation: "Original research fact",
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
  const results = await f.signed.mutation(api.research.handoff.consume, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    evidenceIds: [evidenceId],
    intent: "Prepare original unapproved draft",
    target: "draft",
    requestedCount: 1,
    commandKey: "export-handoff",
  });
  vi.advanceTimersByTime(1);
  const a = await args(f),
    r = await f.signed.query(page, { ...a, family: "ownResearchHandoffs" });
  expect(r.data.selection.rows[0]).toMatchObject({
    selection: [evidenceId],
    results,
  });
  expect(JSON.stringify(r.data)).not.toMatch(
    /requestHash|commandKey|fingerprint|materialHash/,
  );
  await f.t.run((ctx) =>
    ctx.db.patch(results[0].draftVersionId!, { ideaVersionId: undefined }),
  );
  await expect(
    f.signed.query(page, { ...a, family: "ownResearchHandoffs" }),
  ).rejects.toThrow();
});
