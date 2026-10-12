import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  makeFunctionReference,
  type ApiFromModules,
  type FunctionArgs,
  type FunctionReturnType,
} from "convex/server";
import type { page as pageFunction } from "./exportRemaining";
import { mediaFixture } from "../../tests/media-fixture";
import { corpus } from "../../tests/evals/calibration/fixture";
const page = makeFunctionReference<
  "query",
  FunctionArgs<
    ApiFromModules<{ module: { page: typeof pageFunction } }>["module"]["page"]
  >,
  FunctionReturnType<
    ApiFromModules<{ module: { page: typeof pageFunction } }>["module"]["page"]
  >
>("operations/exportRemaining:page");
beforeEach(() => vi.stubEnv("R2_MEDIA_BUCKET", "export-tests"));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function args(f: Awaited<ReturnType<typeof mediaFixture>>) {
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  const user = await f.t.run((ctx) => ctx.db.get(f.userId));
  if (!user) throw Error("fixture");
  return {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "remaining",
    cursor: null,
    creationUpperBound: null,
  };
}
test("native media manifest includes every lifecycle row across continuation without storage secrets", async () => {
  const f = await mediaFixture();
  await f.reserve();
  await f.ready();
  await f.reserve();
  const a = await args(f);
  let cursor: string | null = null,
    bound: number | null = null;
  const ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    const r: FunctionReturnType<
      ApiFromModules<{
        module: { page: typeof pageFunction };
      }>["module"]["page"]
    > = await f.signed.query(page, {
      ...a,
      family: "mediaManifest",
      cursor,
      creationUpperBound: bound,
    });
    expect(r.data.selection.rows.length).toBeLessThanOrEqual(1);
    for (const row of r.data.selection.rows) ids.push(row.id);
    expect(JSON.stringify(r)).not.toMatch(
      /objectKey|checksum|temporaryKey|bucket|r2AccountId|lease|media@example.test/,
    );
    if (r.isDone) break;
    cursor = r.cursor;
    bound = r.creationUpperBound;
  }
  expect(new Set(ids).size).toBe(3);
});
test("native records reject scope/session/role and malformed continuation or irrelevant selectors", async () => {
  const f = await mediaFixture(),
    a = await args(f);
  await expect(
    f.signed.query(page, {
      ...a,
      family: "workspaceRecord",
      expectedSessionId: "foreign",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  await expect(
    f.signed.query(page, { ...a, family: "memberRecords", cursor: "invalid" }),
  ).rejects.toThrow("EXPORT_REQUEST_INVALID");
  await expect(
    f.signed.query(page, { ...a, family: "memberRecords", kind: "spec" }),
  ).rejects.toThrow("EXPORT_REQUEST_INVALID");
  await f.t.run(async (ctx) => {
    const m = await ctx.db.query("memberships").first();
    await ctx.db.patch(m!._id, { role: "Viewer" });
  });
  await expect(
    f.signed.query(page, { ...a, family: "mediaManifest" }),
  ).rejects.toThrow();
});
test("native workspace and roster disclose only selected workspace and role facts", async () => {
  const f = await mediaFixture(),
    a = await args(f);
  const r = await f.signed.query(page, { ...a, family: "memberRecords" });
  expect(Object.keys(r.data.selection.rows[0]).sort()).toEqual([
    "createdInDatabaseAt",
    "id",
    "role",
    "userId",
  ]);
  expect(JSON.stringify(r.data)).not.toMatch(
    /authId|sessionId|email|preferences|profile/,
  );
  const w = await f.signed.query(page, { ...a, family: "workspaceRecord" });
  expect(w.data.selection.rows[0].id).toBe(f.workspaceId);
  expect(w.isDone).toBe(true);
});
test("nonfinite original metadata and oversized selected rows fail whole page", async () => {
  const f = await mediaFixture();
  const session = await f.ready(),
    a = await args(f);
  await f.t.run((ctx) => ctx.db.patch(session.assetId, { size: NaN }));
  await expect(
    f.signed.query(page, { ...a, family: "mediaManifest" }),
  ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
  await f.t.run((ctx) =>
    ctx.db.patch(session.assetId, { size: 70, name: "x".repeat(70000) }),
  );
  await expect(
    f.signed.query(page, { ...a, family: "mediaManifest" }),
  ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
});
test("native calibration spec and snapshot preserve stored facts and strip every private fingerprint", async () => {
  const f = await corpus(),
    a = await args(f);
  const spec = await f.signed.query(page, {
    ...a,
    family: "calibrationReferences",
    accountId: f.args.accountId,
    kind: "spec",
  });
  expect(spec.data.selection.rows[0].id).toBe(f.specId);
  expect(JSON.stringify(spec)).not.toMatch(
    /fingerprint|Fingerprint|commandKey|budgetIds/,
  );
  expect(spec.proofValidUntil).toBeLessThanOrEqual(spec.observedAt + 30000);
  await f.signed.mutation(
    makeFunctionReference<"mutation">("performance/calibration:build"),
    f.buildInput,
  );
  const snapshot = await f.signed.query(page, {
    ...a,
    family: "calibrationReferences",
    accountId: f.args.accountId,
    kind: "snapshot",
  });
  expect(snapshot.data.selection.rows).toHaveLength(1);
  expect(JSON.stringify(snapshot)).not.toMatch(
    /fingerprint|Fingerprint|commandKey|measurements/,
  );
  await f.t.run((ctx) => ctx.db.patch(f.specId, { generation: 999 }));
  await expect(
    f.signed.query(page, {
      ...a,
      family: "calibrationReferences",
      accountId: f.args.accountId,
      kind: "snapshot",
    }),
  ).rejects.toThrow();
});
test("native experiment declaration and assignments export original protected spec without command identities", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  const { api } = await import("../_generated/api");
  const f = await mediaFixture(),
    a = await args(f);
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "experiment-fixture",
      name: "Experiment",
      handle: "experiment",
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
  const versions = [];
  for (let i = 0; i < 2; i++) {
    const d = await f.signed.mutation(api.editorial.create, {
      workspaceId: f.workspaceId,
      source: "Manual",
      content: {
        title: "Original",
        text: ["Original experiment text"],
        media: [],
        accountId,
        pillar: "Product",
        strategy: "manual",
      },
    });
    versions.push((await f.t.run((ctx) => ctx.db.get(d)))!.currentVersionId!);
  }
  const result = await f.signed.mutation(api.performance.experiments.change, {
    workspaceId: f.workspaceId,
    accountId,
    expectedRevision: 0,
    commandKey: "experiment-export",
    action: {
      kind: "declare",
      spec: {
        hypothesis: "Original declared hypothesis",
        dimension: "hook",
        a: "Question",
        b: "Observation",
        outcome: "editorial-decision-v1",
        startsAt: Date.now(),
        endsAt: Date.now() + 3600000,
        sampleCap: 2,
        stopCondition: "End of hour",
        context: "Manual context",
        frequency: "Once per unit",
      },
      units: versions.map((versionId, i) => ({
        versionId,
        reviewerId: f.userId,
        arm: i ? ("B" as const) : ("A" as const),
        planItemId: null,
      })),
    },
  });
  vi.advanceTimersByTime(1);
  const r = await f.signed.query(page, {
    ...a,
    family: "editorialExperiments",
    accountId,
  });
  expect(r.data.selection.rows[0]).toMatchObject({
    spec: { hypothesis: "Original declared hypothesis" },
  });
  expect(JSON.stringify(r.data)).not.toMatch(
    /commandKey|fingerprint|requestHash|approvedHash/,
  );
  const experimentId = await f.t.run(
    async (ctx) => (await ctx.db.query("editorialExperiments").first())!._id,
  );
  const assignment = await f.signed.query(page, {
    ...a,
    family: "experimentAssignments",
    accountId,
    experimentId,
  });
  expect(assignment.data.selection.rows).toHaveLength(1);
  expect(assignment.isDone).toBe(false);
  const next = await f.signed.query(page, {
    ...a,
    family: "experimentAssignments",
    accountId,
    experimentId,
    cursor: assignment.cursor,
    creationUpperBound: assignment.creationUpperBound,
  });
  expect(next.isDone).toBe(true);
  expect(result).toBeDefined();
});
