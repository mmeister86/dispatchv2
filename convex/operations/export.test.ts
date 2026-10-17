import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { mediaFixture } from "../../tests/media-fixture";
import { components } from "../_generated/api";
const artifactDir = mkdtempSync(join(tmpdir(), "dispatch-tests-"));
const self = makeFunctionReference<"query">("operations/export:self");
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function fixture() {
  const f = await mediaFixture();
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  return {
    ...f,
    args: {
      workspaceId: f.workspaceId,
      expectedAuthId: user.authId,
      requestKey: crypto.randomUUID(),
    },
  };
}
test("registered self export preserves original finite profile fields and grants all four own roles without private data or correlation in download", async () => {
  const f = await fixture();
  const profile = await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("preferences").first())!;
    await ctx.db.patch(p._id, {
      audience: "Eigenes Publikum 🧭",
      onboardingStep: 17,
    });
    const { _id, _creationTime, userId, workspaceId, ...profile } =
      (await ctx.db.get(p._id))!;
    return profile;
  });
  for (const role of ["Owner", "Admin", "Editor", "Viewer"] as const) {
    await f.t.run(async (ctx) => {
      const m = (await ctx.db.query("memberships").first())!;
      await ctx.db.patch(m._id, { role });
    });
    const r = await f.signed.query(self, {
      ...f.args,
      requestKey: crypto.randomUUID(),
    });
    expect(r.data.profile).toEqual(profile);
    expect(r.data.membership).toEqual({ role });
    expect(r.data.workspace.id).toBe(f.workspaceId);
    expect(Object.keys(r.data.workspace).sort()).toEqual(["id", "name"]);
    expect(r.data.workspace).not.toHaveProperty("description");
    expect(r.data.user.id).toBe(f.userId);
    expect(r.data.coverage.kind).toBe("selected_workspace_self_profile");
    expect(r.data.coverage.complete).toBe(true);
    expect(r.data.coverage.unsupported).toContain(
      "private_content_and_components",
    );
    expect(r.authId).toBe(f.args.expectedAuthId);
    expect(r.sessionId).toBeTruthy();
    expect(Object.keys(r).sort()).toEqual([
      "authId",
      "data",
      "requestKey",
      "sessionId",
    ]);
    expect(Object.keys(r.data).sort()).toEqual([
      "coverage",
      "format",
      "membership",
      "observedAt",
      "profile",
      "user",
      "version",
      "workspace",
    ]);
    expect(JSON.stringify(r.data)).not.toMatch(
      /authId|sessionId|requestKey|token|ownerId|media@example.test/,
    );
    expect(
      new TextEncoder().encode(JSON.stringify(r)).length,
    ).toBeLessThanOrEqual(64 * 1024);
  }
});
test("registered export denies auth mismatch inactive or unselected workspace and invalid selectors", async () => {
  const f = await fixture();
  await expect(
    f.signed.query(self, { ...f.args, expectedAuthId: "foreign" }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  for (const requestKey of ["", "x".repeat(65)])
    await expect(
      f.signed.query(self, { ...f.args, requestKey }),
    ).rejects.toThrow("EXPORT_REQUEST_INVALID");
  await expect(
    f.signed.query(self, { ...f.args, userId: f.userId }),
  ).rejects.toThrow();
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(f.signed.query(self, f.args)).rejects.toThrow(
    "WORKSPACE_INACTIVE",
  );
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.workspaceId, { lifecycle: "active" });
    const other = await ctx.db.insert("workspaces", {
      name: "Other",
      description: "",
    });
    await ctx.db.patch(f.userId, { activeWorkspaceId: other });
  });
  await expect(f.signed.query(self, f.args)).rejects.toThrow(
    "EXPORT_SCOPE_CHANGED",
  );
});
test("registered export rejects absent oversized and nonfinite legacy profile without manufacturing a successful archive", async () => {
  const f = await fixture();
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  for (const onboardingStep of [NaN, Infinity, -Infinity, -0]) {
    await f.t.run((ctx) => ctx.db.patch(p._id, { onboardingStep }));
    await expect(
      f.signed.query(self, { ...f.args, requestKey: crypto.randomUUID() }),
    ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
  }
  await f.t.run((ctx) =>
    ctx.db.patch(p._id, { onboardingStep: 3, audience: "🧭".repeat(20000) }),
  );
  await expect(f.signed.query(self, f.args)).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
  await f.t.run((ctx) => ctx.db.delete(p._id));
  await expect(f.signed.query(self, f.args)).rejects.toThrow(
    "EXPORT_PROFILE_UNAVAILABLE",
  );
});
test("actual native export is bounded including auth and returns real native session without writes scheduling or HTTP", async () => {
  const f = await fixture();
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const r = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(self, f.args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  console.info(
    "native-export-proof-cost",
    JSON.stringify({
      queries: r.metrics.databaseQueries.used,
      documents: r.metrics.documentsRead.used,
      bytes: r.metrics.bytesRead.used,
      writes: r.metrics.documentsWritten.used,
      schedules: r.metrics.functionsScheduled.used,
    }),
  );
  expect(r.metrics.databaseQueries.used).toBeLessThanOrEqual(10);
  expect(r.metrics.documentsRead.used).toBeLessThanOrEqual(8);
  expect(r.metrics.documentsWritten.used).toBe(0);
  expect(r.metrics.functionsScheduled.used).toBe(0);
  expect(physical).not.toHaveBeenCalled();
  const sessionId = await f.t.run(
    async (ctx) =>
      (
        await ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: "session",
            data: {
              userId: f.args.expectedAuthId,
              token: crypto.randomUUID(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              expiresAt: Date.now() + 60000,
            },
          },
        })
      )._id,
  );
  const signed = f.t.withIdentity({
    subject: f.args.expectedAuthId,
    sessionId,
  });
  expect((await signed.query(self, f.args)).sessionId).toBe(sessionId);
  await expect(
    f.t
      .withIdentity({
        subject: f.args.expectedAuthId,
        sessionId: "missing-session",
      })
      .query(self, f.args),
  ).rejects.toThrow("Unauthenticated");
  await expect(f.t.query(self, f.args)).rejects.toThrow("Unauthenticated");
});

test("self export whole envelope stays invariant under foreign private profile rows and propagates native read failures", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await fixture();
  const before = await f.signed.query(self, f.args);
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("preferences").first())!;
    const { _id, _creationTime, ...profile } = p;
    for (let i = 0; i < 20; i++) {
      const userId = await ctx.db.insert("users", {
        authId: `private-${i}`,
        activeWorkspaceId: f.workspaceId,
        defaultWorkspaceId: f.workspaceId,
      });
      await ctx.db.insert("preferences", {
        ...profile,
        userId,
        audience: "PRIVATE_PROTECTED_TEXT",
      });
    }
  });
  expect(await f.signed.query(self, f.args)).toEqual(before);
  await expect(
    f.signed.run((ctx) =>
      ctx.runQuery(self, f.args, { transactionLimits: { databaseQueries: 1 } }),
    ),
  ).rejects.toThrow();
  // Actual duplicate index failure propagates; it is not a synthetic successful or partial archive.
  await f.t.run(async (ctx) => {
    const p = (await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    const { _id, _creationTime, ...profile } = p;
    await ctx.db.insert("preferences", profile);
  });
  await expect(f.signed.query(self, f.args)).rejects.toThrow(/unique/i);
});

test("real native membership withdrawal foreign workspace and expired or unverified session cannot export", async () => {
  const f = await fixture();
  const foreign = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "PRIVATE_WORKSPACE",
    }),
  );
  await expect(
    f.signed.query(self, { ...f.args, workspaceId: foreign }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  const expired = await f.t.run(
    async (ctx) =>
      (
        await ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: "session",
            data: {
              userId: f.args.expectedAuthId,
              token: crypto.randomUUID(),
              createdAt: Date.now() - 60000,
              updatedAt: Date.now(),
              expiresAt: Date.now() - 1,
            },
          },
        })
      )._id,
  );
  await expect(
    f.t
      .withIdentity({ subject: f.args.expectedAuthId, sessionId: expired })
      .query(self, f.args),
  ).rejects.toThrow("Unauthenticated");
  const unverified = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Unverified",
          email: "unverified-export@example.test",
          emailVerified: false,
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
          expiresAt: Date.now() + 60000,
        },
      },
    });
    return { subject: u._id, sessionId: s._id };
  });
  await expect(
    f.t.withIdentity(unverified).query(self, f.args),
  ).rejects.toThrow("EMAIL_NOT_VERIFIED");
  await f.t.run(async (ctx) => {
    const m = (await ctx.db.query("memberships").first())!;
    await ctx.db.delete(m._id);
  });
  await expect(f.signed.query(self, f.args)).rejects.toThrow(
    "WORKSPACE_ACCESS_DENIED",
  );
});

test("complete native wire boundary includes correlation overhead and preserves representable legacy profile values exactly", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await fixture();
  const original = await f.signed.query(self, f.args);
  const remaining =
    64 * 1024 - new TextEncoder().encode(JSON.stringify(original)).length;
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  const audience = "a".repeat(remaining);
  await f.t.run((ctx) => ctx.db.patch(p._id, { audience }));
  const exact = await f.signed.query(self, f.args);
  expect(exact.data.profile.audience).toBe(audience);
  expect(new TextEncoder().encode(JSON.stringify(exact)).length).toBe(
    64 * 1024,
  );
  await f.t.run((ctx) => ctx.db.patch(p._id, { audience: audience + "a" }));
  await expect(f.signed.query(self, f.args)).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
});

const versions = makeFunctionReference<"query">("operations/export:versions");
async function versionFixture() {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await fixture();
  const { api } = await import("../_generated/api");
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: {
      title: "Shared 🧭",
      text: ["First", "Second"],
      media: [],
      accountId: null,
      pillar: "Pillar",
      strategy: "Strategy",
    },
    source: "PRIVATE_PROVENANCE",
  });
  const version = (await f.t.run((ctx) =>
    ctx.db
      .query("draftVersions")
      .withIndex("by_draftId_and_number", (q) => q.eq("draftId", draftId))
      .first(),
  ))!;
  vi.setSystemTime(1800000000100);
  return {
    ...f,
    draftId,
    version,
    pageArgs: { ...f.args, cursor: null, creationUpperBound: null },
  };
}
test("registered shared version export allows only business fields and measures actual whole transaction", async () => {
  const f = await versionFixture();
  const r = await f.signed.query(versions, f.pageArgs);
  expect(r.data.versions).toHaveLength(1);
  expect(r.data.versions[0]).toEqual({
    versionId: f.version._id,
    draftId: f.draftId,
    versionNumber: 1,
    createdAt: f.version.createdAt,
    title: "Shared 🧭",
    text: ["First", "Second"],
    accountId: null,
    pillar: "Pillar",
    strategy: "Strategy",
    reason: "Erster Entwurf",
  });
  expect(JSON.stringify(r.data)).not.toMatch(
    /author|source|media|requestKey|session|PRIVATE_PROVENANCE/,
  );
  expect(r.proofValidUntil - r.observedAt).toBe(30000);
  const measured = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(versions, f.pageArgs),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  console.info(
    "native-workspace-version-proof-cost",
    JSON.stringify(measured.metrics),
  );
  expect(measured.metrics.documentsWritten.used).toBe(0);
  expect(measured.metrics.functionsScheduled.used).toBe(0);
});
test("registered versions rejects role identity selectors and preserves all original self roles", async () => {
  const f = await versionFixture();
  for (const role of ["Owner", "Admin", "Editor", "Viewer"] as const) {
    await f.t.run(async (ctx) => {
      const m = (await ctx.db.query("memberships").first())!;
      await ctx.db.patch(m._id, { role });
    });
    if (role === "Owner" || role === "Admin")
      expect((await f.signed.query(versions, f.pageArgs)).role).toBe(role);
    else
      await expect(f.signed.query(versions, f.pageArgs)).rejects.toThrow(
        "ROLE_ACCESS_DENIED",
      );
  }
  await f.t.run(async (ctx) => {
    const m = (await ctx.db.query("memberships").first())!;
    await ctx.db.patch(m._id, { role: "Owner" });
  });
  await expect(
    f.signed.query(versions, { ...f.pageArgs, expectedAuthId: "foreign" }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  for (const patch of [
    { requestKey: "x".repeat(65) },
    { expectedAuthId: "x".repeat(257) },
    { cursor: "" },
    { cursor: "bad", creationUpperBound: Date.now() },
    { creationUpperBound: Infinity },
    { creationUpperBound: Date.now() + 10000 },
    { creationUpperBound: 1 },
  ])
    await expect(
      f.signed.query(versions, { ...f.pageArgs, ...patch }),
    ).rejects.toThrow();
});
test("registered versions omits whole missing withdrawn expired rows but foreign binding and ambiguous proof errors fail the page", async () => {
  const f = await versionFixture();
  for (const patch of [
    { sourceUnavailable: true },
    { sourceUnavailable: false, researchProofUntil: Date.now() - 1 },
  ]) {
    await f.t.run((ctx) => ctx.db.patch(f.version._id, patch));
    expect((await f.signed.query(versions, f.pageArgs)).data.versions).toEqual(
      [],
    );
  }
  await f.t.run((ctx) =>
    ctx.db.patch(f.version._id, { researchProofUntil: undefined }),
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.version._id, { researchCleanupPending: true }),
  );
  await expect(f.signed.query(versions, f.pageArgs)).rejects.toThrow(
    "RESEARCH_CONTENT_SOURCE_CHANGED",
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.version._id, { researchCleanupPending: undefined }),
  );
  const other = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Foreign", description: "" }),
  );
  await f.t.run((ctx) => ctx.db.patch(f.draftId, { workspaceId: other }));
  await expect(f.signed.query(versions, f.pageArgs)).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
  await f.t.run((ctx) => ctx.db.delete(f.draftId));
  const absent = await f.signed.query(versions, f.pageArgs);
  expect(absent.data.versions).toEqual([]);
  expect(Object.keys(absent.data).sort()).toEqual([
    "format",
    "version",
    "versions",
    "workspaceId",
  ]);
});
test("batched cursor skips withdrawn rows in-page, excludes later insertions, and propagates native resource failure", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await versionFixture();
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...v } = f.version;
    await ctx.db.insert("draftVersions", {
      ...v,
      number: 2,
      sourceUnavailable: true,
    });
    await ctx.db.insert("draftVersions", { ...v, number: 3 });
  });
  vi.setSystemTime(1800000000200);
  const first = await f.signed.query(versions, f.pageArgs);
  // One authenticated round-trip emits every in-ceiling row: the withdrawn
  // v2 is skipped inside the page instead of consuming a whole page.
  expect(
    first.data.versions.map((v: { versionNumber: number }) => v.versionNumber),
  ).toEqual([1, 3]);
  expect(first.isDone).toBe(true);
  vi.setSystemTime(1800000001000);
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...v } = f.version;
    await ctx.db.insert("draftVersions", { ...v, number: 4 });
  });
  const second = await f.signed.query(versions, {
    ...f.pageArgs,
    cursor: first.cursor,
    creationUpperBound: first.creationUpperBound,
  });
  expect(second.data.versions).toEqual([]);
  expect(second.isDone).toBe(true);
  await expect(
    f.signed.run((ctx) =>
      ctx.runQuery(versions, f.pageArgs, {
        transactionLimits: { databaseQueries: 1 },
      }),
    ),
  ).rejects.toThrow();
});
test("batched versions page caps raw candidates per request and drains in two round-trips", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await versionFixture();
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...v } = f.version;
    for (let number = 2; number <= 30; number++)
      await ctx.db.insert("draftVersions", { ...v, number });
  });
  vi.setSystemTime(1800000000200);
  // A full 25-row batched page fits in a bounded per-request query budget
  // (measured ~57 database queries for this fixture).
  const first = await f.signed.run((ctx) =>
    ctx.runQuery(versions, f.pageArgs, {
      transactionLimits: { databaseQueries: 100 },
    }),
  );
  // Per-request candidate cap: 30 rows take exactly two round-trips, not 30.
  expect(first.data.versions).toHaveLength(25);
  expect(
    first.data.versions.map((v: { versionNumber: number }) => v.versionNumber),
  ).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  expect(first.isDone).toBe(false);
  const second = await f.signed.query(versions, {
    ...f.pageArgs,
    cursor: first.cursor,
    creationUpperBound: first.creationUpperBound,
  });
  expect(
    second.data.versions.map((v: { versionNumber: number }) => v.versionNumber),
  ).toEqual([26, 27, 28, 29, 30]);
  expect(second.isDone).toBe(true);
});
test("batched versions page truncates on raw byte budget and resumes without loss", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await versionFixture();
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...v } = f.version;
    for (let number = 2; number <= 10; number++)
      await ctx.db.insert("draftVersions", {
        ...v,
        number,
        content: {
          ...v.content,
          text: [`payload-${number}-` + "x".repeat(5000)],
        },
      });
  });
  vi.setSystemTime(1800000000200);
  const seen: number[] = [];
  let cursor: string | null = null,
    bound: number | null = null,
    isDone = false,
    pages = 0;
  while (!isDone && pages < 8) {
    const r: {
      data: { versions: { versionNumber: number }[] };
      cursor: string;
      creationUpperBound: number;
      isDone: boolean;
    } = await f.signed.query(versions, {
      ...f.pageArgs,
      cursor,
      creationUpperBound: bound,
    });
    pages++;
    seen.push(...r.data.versions.map((v) => v.versionNumber));
    cursor = r.cursor;
    bound = r.creationUpperBound;
    isDone = r.isDone;
  }
  // The byte budget splits the export across pages, but every row arrives once, in order.
  expect(pages).toBeGreaterThan(1);
  expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(isDone).toBe(true);
});
test("batched oversize window fails with a retryable code and drains completely one row at a time", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await versionFixture();
  await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...v } = f.version;
    for (let number = 2; number <= 8; number++)
      await ctx.db.insert("draftVersions", {
        ...v,
        number,
        content: { ...v.content, text: ["x".repeat(3000)] },
      });
    await ctx.db.insert("draftVersions", {
      ...v,
      number: 9,
      content: { ...v.content, text: ["x".repeat(45000)] },
    });
  });
  vi.setSystemTime(1800000000200);
  // Individually healthy rows whose combination overflows the DTO cannot
  // advance with wide pages: the same cursor throws identically.
  await expect(f.signed.query(versions, f.pageArgs)).rejects.toThrow(
    "EXPORT_PAGE_OVERSIZED",
  );
  // Opt-in narrow pages (the old one-row behavior for this window only)
  // export every row exactly once, in order.
  const seen: number[] = [];
  let cursor: string | null = null,
    bound: number | null = null,
    isDone = false,
    pages = 0;
  while (!isDone && pages < 16) {
    const r: {
      data: { versions: { versionNumber: number }[] };
      cursor: string;
      creationUpperBound: number;
      isDone: boolean;
    } = await f.signed.query(versions, {
      ...f.pageArgs,
      narrowPage: true,
      cursor,
      creationUpperBound: bound,
    });
    pages++;
    expect(r.data.versions.length).toBeLessThanOrEqual(1);
    seen.push(...r.data.versions.map((v) => v.versionNumber));
    cursor = r.cursor;
    bound = r.creationUpperBound;
    isDone = r.isDone;
  }
  expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(isDone).toBe(true);
  // A lone oversized row keeps the terminal error, narrow or not: bloat the
  // last row past the wire limit, re-export the healthy prefix one row at a
  // time, then watch the poisoned tail fail exactly as before.
  await f.t.run(async (ctx) => {
    const last = (await ctx.db
      .query("draftVersions")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", f.workspaceId))
      .order("desc")
      .first())!;
    await ctx.db.patch(last._id, {
      content: { ...last.content, text: ["y".repeat(70000)] },
    });
  });
  const prefix: number[] = [];
  let c2: string | null = null,
    b2: number | null = null;
  for (let i = 0; i < 8; i++) {
    const r: {
      data: { versions: { versionNumber: number }[] };
      cursor: string;
      creationUpperBound: number;
      isDone: boolean;
    } = await f.signed.query(versions, {
      ...f.pageArgs,
      narrowPage: true,
      cursor: c2,
      creationUpperBound: b2,
    });
    prefix.push(...r.data.versions.map((v) => v.versionNumber));
    c2 = r.cursor;
    b2 = r.creationUpperBound;
  }
  expect(prefix).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  await expect(
    f.signed.query(versions, {
      ...f.pageArgs,
      narrowPage: true,
      cursor: c2,
      creationUpperBound: b2,
    }),
  ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
});
test("shared versions rejects nonfinite legacy numbers and entire oversized UTF8 wire without truncation", async () => {
  const f = await versionFixture();
  for (const number of [NaN, Infinity, -Infinity, -0]) {
    await f.t.run((ctx) => ctx.db.patch(f.version._id, { number }));
    await expect(f.signed.query(versions, f.pageArgs)).rejects.toThrow(
      "EXPORT_DATA_UNAVAILABLE",
    );
  }
  await f.t.run((ctx) =>
    ctx.db.patch(f.version._id, { number: 1, reason: "🧭".repeat(20000) }),
  );
  await expect(f.signed.query(versions, f.pageArgs)).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
});

test("registered shared export measures twelve retained run-input edges through the standard 32-node walker (injected retained graph)", async () => {
  const f = await versionFixture();
  const { captureRunInputs } = await import("../ai/contentCopies");
  const { draftResearchProof } = await import("../research/contentProof");
  const { materialWalk } = await import("../research/pipelineAccess");
  const graph = await f.t.run(async (ctx) => {
    const accountId = await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
      name: "Synthetic",
      handle: "synthetic",
      connection: "connected",
      capability: {
        maxText: 25000,
        maxThread: 100,
        maxMedia: 4,
        mediaTypes: [],
        publish: false,
      },
    });
    let parent:
      import("../_generated/dataModel").Id<"ideaVersions"> | undefined;
    for (let i = 0; i <= 12; i++) {
      const ideaId = await ctx.db.insert("ideas", {
        workspaceId: f.workspaceId,
        actorId: f.userId,
        operationKey: `native-graph-${i}`,
        fingerprint: "synthetic",
        revision: 1,
        currentVersionId: null,
        status: "accepted",
        updatedAt: Date.now(),
      });
      let runId: import("../_generated/dataModel").Id<"agentRuns"> | undefined;
      if (parent) {
        runId = await ctx.db.insert("agentRuns", {
          workspaceId: f.workspaceId,
          accountId,
          actorId: f.userId,
          purpose: "draft",
          policyVersion: "synthetic",
          promptVersion: "synthetic",
          policyFingerprint: "synthetic",
          accountConnectionSequence: 0,
          sources: [],
          threadId: "synthetic",
          promptMessageId: "synthetic",
          generation: 1,
          state: "completed",
          executionKey: null,
          deadline: Date.now() + 60000,
          attempts: 1,
          toolSteps: 0,
          budgetIds: [],
          createdAt: Date.now(),
          errorCode: null,
        });
        // The existing producer's capture helper creates the concrete retained edge; run completion is synthetic.
        await captureRunInputs(ctx, runId, [parent]);
      }
      parent = await ctx.db.insert("ideaVersions", {
        workspaceId: f.workspaceId,
        ideaId,
        number: 1,
        actorId: f.userId,
        createdAt: Date.now(),
        title: "Inherited",
        note: "PRIVATE_NOTE",
        perspective: "",
        priority: "normal",
        source: { kind: "note" },
        originals: [],
        rationale: "",
        questions: [],
        ...(parent ? { inputVersionId: parent } : {}),
        ...(runId ? { runId } : {}),
      });
      await ctx.db.patch(ideaId, { currentVersionId: parent });
    }
    await ctx.db.patch(f.version._id, {
      ideaVersionId: parent,
      content: { ...f.version.content, accountId },
    });
    return { accountId, parent };
  });
  const walk = materialWalk();
  await f.t.run(async (ctx) =>
    draftResearchProof(ctx, (await ctx.db.get(f.version._id))!, walk),
  );
  expect(walk.budget.counted.size).toBeLessThanOrEqual(32);
  const measured = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(versions, f.pageArgs),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(measured.value.data.versions).toHaveLength(1);
  expect(measured.value.data.versions[0].accountId).toBe(graph.accountId);
  expect(measured.metrics.databaseQueries.used).toBeGreaterThan(128);
  expect(measured.metrics.documentsWritten.used).toBe(0);
  expect(measured.metrics.functionsScheduled.used).toBe(0);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    `${artifactDir}/dispatch-33.1.3-native-graph-cost.json`,
    JSON.stringify(
      {
        fixture:
          "Injected completed runs and generated idea lineage with actual captureRunInputs producer helper; not a full generation producer run",
        nodes: walk.budget.counted.size,
        metrics: measured.metrics,
        wireBytes: new TextEncoder().encode(JSON.stringify(measured.value))
          .length,
      },
      null,
      2,
    ),
  );
  await f.t.run((ctx) =>
    ctx.db.patch(graph.parent!, { inputVersionId: graph.parent }),
  );
  await expect(f.signed.query(versions, f.pageArgs)).rejects.toThrow(
    "STYLE_ANCESTRY_LIMIT",
  );
});

test("actual editorial producer max text snapshot stays within the export wire and rejects nonfinite proof clocks", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  const f = await fixture();
  const { api } = await import("../_generated/api");
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: {
      title: "T".repeat(200),
      text: ["a".repeat(25000), "b".repeat(7000)],
      media: [],
      accountId: null,
      pillar: "p".repeat(200),
      strategy: "s".repeat(100),
    },
    source: "producer",
  });
  const ver = (await f.t.run((ctx) =>
    ctx.db
      .query("draftVersions")
      .withIndex("by_draftId_and_number", (q) => q.eq("draftId", draftId))
      .first(),
  ))!;
  vi.setSystemTime(1800000000100);
  const r = await f.signed.query(versions, {
    ...f.args,
    cursor: null,
    creationUpperBound: null,
  });
  expect(r.data.versions[0].text).toEqual(ver.content.text);
  expect(
    new TextEncoder().encode(JSON.stringify(r)).length,
  ).toBeLessThanOrEqual(64 * 1024);
  for (const researchProofUntil of [NaN, Infinity, -0]) {
    await f.t.run((ctx) => ctx.db.patch(ver._id, { researchProofUntil }));
    await expect(
      f.signed.query(versions, {
        ...f.args,
        cursor: null,
        creationUpperBound: null,
      }),
    ).rejects.toThrow("EXPORT_DATA_UNAVAILABLE");
  }
});

test("actual native Idea generation commit and handoff produce twelve legal run-input links exceeding 128 query reads", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-key");
  const { modelFixture } = await import("../../tests/model-fixture");
  const { api, internal } = await import("../_generated/api");
  const { draftResearchProof } = await import("../research/contentProof");
  const { materialWalk } = await import("../research/pipelineAccess");
  const f = await modelFixture();
  await f.t.run(async (ctx) => {
    for (const b of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(b._id, { limitMicros: 100000000 });
  });
  let ideaId = await f.signed.mutation(api.content.ideas.create, {
    workspaceId: f.workspaceId,
    title: "Synthetic idea",
    note: "Own unverified account",
    perspective: "Why?",
    priority: "normal",
    source: { kind: "note" },
    operationKey: "export-native-origin",
  });
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  for (let i = 0; i < 12; i++) {
    const runId = await f.signed.mutation(api.content.ideas.generate, {
      workspaceId: f.workspaceId,
      ideaId,
      expectedRevision: 1,
      accountId: f.accountId,
      intent: "Prepare a perspective",
      operationKey: `export-native-generation-${i}`,
    });
    const executionKey = `export-native-output-${i}`;
    await f.t.mutation(internal.ai.runs.claim, { runId, executionKey });
    const next = await f.t.mutation(internal.content.ideas.commitProposal, {
      runId,
      executionKey,
      output: JSON.stringify({
        title: "Possible perspective",
        perspective: "Question?",
        rationale: "Unproven",
        questions: ["What changed?"],
      }),
    });
    expect(next).not.toBeNull();
    ideaId = next!;
    await f.t.mutation(internal.ai.runs.finish, {
      runId,
      generation: 1,
      executionKey,
      failed: false,
    });
  }
  const handed = await f.signed.mutation(api.content.ideas.handoff, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: f.accountId,
    intent: "Prepare editable draft",
    clarificationConfirmed: true,
    draftText: "Synthetic draft",
  });
  const walk = materialWalk();
  await f.t.run(async (ctx) =>
    draftResearchProof(ctx, (await ctx.db.get(handed.versionId))!, walk),
  );
  expect(walk.budget.counted.size).toBe(25);
  vi.setSystemTime(1800000000100);
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    requestKey: crypto.randomUUID(),
    cursor: null,
    creationUpperBound: null,
  };
  const measured = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(versions, args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(measured.value.data.versions).toHaveLength(1);
  expect(measured.metrics.databaseQueries.used).toBeGreaterThan(128);
  expect(measured.metrics.documentsWritten.used).toBe(0);
  expect(measured.metrics.functionsScheduled.used).toBe(0);
  expect(physical).not.toHaveBeenCalled();
  const finalIdea = (await f.t.run((ctx) => ctx.db.get(ideaId)))!;
  const sourceDeadline = Date.now() + 5000;
  await f.t.run((ctx) =>
    ctx.db.patch(finalIdea.currentVersionId!, {
      researchProofUntil: sourceDeadline,
    }),
  );
  expect((await f.signed.query(versions, args)).proofValidUntil).toBe(
    sourceDeadline,
  );
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    `${artifactDir}/dispatch-33.1.3-native-producer-cost.json`,
    JSON.stringify(
      {
        fixture:
          "Actual create + 12 generate/claim/commitProposal/finish + handoff; synthetic initial policy/account/budgets and synthetic validated model output; scheduled provider functions not executed",
        nodes: walk.budget.counted.size,
        metrics: measured.metrics,
        wireBytes: new TextEncoder().encode(JSON.stringify(measured.value))
          .length,
      },
      null,
      2,
    ),
  );
});

test("registered version role and identity gates perform only native auth workspace reads and no source proof", async () => {
  const f = await versionFixture();
  const { requireWorkspace } = await import("../lib/authorization");
  const proof = vi.spyOn(
    await import("../research/contentProof"),
    "draftResearchProof",
  );
  const baseline = await f.signed.run(async (ctx) => {
    await requireWorkspace(ctx, f.workspaceId);
    return ctx.meta.getTransactionMetrics();
  });
  const outcomes = [];
  for (const kind of ["role", "identity"] as const) {
    await f.t.run(async (ctx) => {
      const m = (await ctx.db.query("memberships").first())!;
      await ctx.db.patch(m._id, { role: kind === "role" ? "Viewer" : "Owner" });
    });
    const denied = await f.signed.run(async (ctx) => {
      let error = "";
      try {
        await ctx.runQuery(versions, {
          ...f.pageArgs,
          expectedAuthId:
            kind === "identity" ? "foreign" : f.args.expectedAuthId,
        });
      } catch (e) {
        error = String(e);
      }
      return { error, metrics: await ctx.meta.getTransactionMetrics() };
    });
    expect(denied.error).toContain(
      kind === "role" ? "ROLE_ACCESS_DENIED" : "EXPORT_SCOPE_CHANGED",
    );
    expect(denied.metrics.databaseQueries.used).toBe(
      baseline.databaseQueries.used,
    );
    expect(denied.metrics.documentsRead.used).toBe(baseline.documentsRead.used);
    expect(denied.metrics.documentsWritten.used).toBe(0);
    outcomes.push({ kind, ...denied });
  }
  expect(proof).not.toHaveBeenCalled();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    `${artifactDir}/dispatch-33.1.3-native-denial-cost.json`,
    JSON.stringify({ baseline, outcomes }, null, 2),
  );
});

test("shared account current existence and exact workspace bind fail closed while unrelated tenant versions do not change envelope", async () => {
  const f = await versionFixture();
  const before = await f.signed.query(versions, f.pageArgs);
  const other = await f.t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Private",
      description: "",
    });
    const { _id, _creationTime, ...version } = f.version;
    await ctx.db.insert("draftVersions", {
      ...version,
      workspaceId,
      content: { ...version.content, title: "PRIVATE_FOREIGN" },
    });
    return workspaceId;
  });
  expect(await f.signed.query(versions, f.pageArgs)).toEqual(before);
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "synthetic",
      name: "Synthetic",
      handle: "Synthetic",
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
  await f.t.run((ctx) =>
    ctx.db.patch(f.version._id, {
      content: { ...f.version.content, accountId },
    }),
  );
  expect(
    (await f.signed.query(versions, f.pageArgs)).data.versions[0].accountId,
  ).toBe(accountId);
  await f.t.run((ctx) => ctx.db.patch(accountId, { workspaceId: other }));
  await expect(f.signed.query(versions, f.pageArgs)).rejects.toThrow(
    "REFERENCE_ACCESS_DENIED",
  );
  await f.t.run((ctx) => ctx.db.delete(accountId));
  expect((await f.signed.query(versions, f.pageArgs)).data.versions).toEqual(
    [],
  );
});

const preferencesExport = makeFunctionReference<"query">(
  "operations/export:preferences",
);
async function preferenceFixture() {
  const f = await fixture();
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  return {
    ...f,
    args: { ...f.args, expectedSessionId: identity!.sessionId as string },
  };
}
test("preferences export preserves absent versus stored OFF notifications for every own role", async () => {
  const f = await preferenceFixture();
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  for (const role of ["Owner", "Admin", "Editor", "Viewer"] as const) {
    await f.t.run(async (ctx) => {
      const m = (await ctx.db.query("memberships").first())!;
      await ctx.db.patch(m._id, { role });
    });
    const r = await f.signed.query(preferencesExport, f.args);
    expect(r.data.format).toBe("dispatch-self-preferences");
    expect(r.data.notifications).toBeNull();
    expect(r.data.researchSummaries).toEqual([]);
    expect(r.data.coverage.complete).toBe(false);
    expect(r.sessionId).toBe(f.args.expectedSessionId);
    expect(r.workspaceId).toBe(f.workspaceId);
    expect(r.proofValidUntil).toBeGreaterThan(r.observedAt);
    expect(JSON.stringify(r.data)).not.toMatch(
      /authId|sessionId|requestKey|summaryEpoch|activeSummary|expiryJob|"job"|token/,
    );
  }
  const notifications = {
    revision: 2,
    email: false,
    weekly: false,
    research: false,
    inAppSummaries: false,
    timezone: "UTC",
    quiet: null,
  };
  await f.t.run((ctx) => ctx.db.patch(p._id, { notifications }));
  expect(
    (await f.signed.query(preferencesExport, f.args)).data.notifications,
  ).toEqual(notifications);
});
test("preferences export rejects wrong session scope selectors and invalid wire", async () => {
  const f = await preferenceFixture();
  await expect(
    f.signed.query(preferencesExport, {
      ...f.args,
      expectedSessionId: "foreign",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  await expect(
    f.signed.query(preferencesExport, { ...f.args, expectedAuthId: "foreign" }),
  ).rejects.toThrow();
  await expect(
    f.signed.query(preferencesExport, { ...f.args, userId: f.userId }),
  ).rejects.toThrow();
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  for (const onboardingStep of [NaN, Infinity, -Infinity, -0]) {
    await f.t.run((ctx) => ctx.db.patch(p._id, { onboardingStep }));
    await expect(f.signed.query(preferencesExport, f.args)).rejects.toThrow(
      "EXPORT_DATA_UNAVAILABLE",
    );
  }
  await f.t.run((ctx) =>
    ctx.db.patch(p._id, { onboardingStep: 1, topics: "🧭".repeat(20000) }),
  );
  await expect(f.signed.query(preferencesExport, f.args)).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(f.signed.query(preferencesExport, f.args)).rejects.toThrow(
    "WORKSPACE_INACTIVE",
  );
});

import { fixture as researchFixture } from "../../tests/research-fixture";
import { internal } from "../_generated/api";
import { ConvexError } from "convex/values";
import * as sourceAccess from "../research/providerAccess";
async function summaryExportFixture() {
  vi.useFakeTimers();
  const f = await researchFixture(["web-search"]);
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  await f.t.run((ctx) =>
    ctx.db.patch(p._id, {
      notifications: {
        revision: 1,
        email: false,
        weekly: false,
        research: true,
        inAppSummaries: true,
        timezone: "UTC",
        quiet: null,
      },
    }),
  );
  const orderId = await f.start();
  await f.t.mutation(internal.research.native.finish, {
    orderId,
    generation: 1,
  });
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const identity = (await f.signed.run((ctx) => ctx.auth.getUserIdentity()))!;
  return {
    ...f,
    p: (await f.t.run((ctx) => ctx.db.get(p._id)))!,
    orderId,
    args: {
      workspaceId: f.workspaceId,
      expectedAuthId: user.authId,
      expectedSessionId: identity.sessionId as string,
      requestKey: "summary-export",
    },
  };
}
test("preferences export includes only exact own producer summary metadata with current proof and bounded read-only wire", async () => {
  const f = await summaryExportFixture();
  const forbidden = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(Error("No provider IO"));
  const r = await f.signed.run(async (ctx) => ({
    result: await ctx.runQuery(preferencesExport, f.args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  const { job, expiryJob, ...stored } = f.p.researchSummaries![0];
  expect(r.result.data.researchSummaries).toEqual([
    { ...stored, proofValidUntil: expect.any(Number) },
  ]);
  expect(r.result.proofValidUntil).toBeLessThanOrEqual(
    r.result.data.researchSummaries[0].proofValidUntil,
  );
  expect(JSON.stringify(r.result.data)).not.toContain(job);
  expect(JSON.stringify(r.result.data)).not.toContain(expiryJob);
  expect(r.metrics.documentsWritten.used).toBe(0);
  expect(r.metrics.functionsScheduled.used).toBe(0);
  expect(r.metrics.documentsRead.used).toBeLessThan(1000);
  expect(forbidden).not.toHaveBeenCalled();
  const foreign = await f.t.run((ctx) =>
    ctx.db.insert("users", {
      authId: "another",
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    }),
  );
  await f.t.run((ctx) => ctx.db.patch(f.orderId, { actorId: foreign }));
  expect(
    (await f.signed.query(preferencesExport, f.args)).data.researchSummaries,
  ).toEqual([]);
});
test("preferences export rejects oversized legacy producer lists and invalid original clocks without truncation", async () => {
  const f = await summaryExportFixture(),
    r = f.p.researchSummaries![0];
  await f.t.run((ctx) =>
    ctx.db.patch(f.p._id, { researchSummaries: Array(6).fill(r) }),
  );
  await expect(f.signed.query(preferencesExport, f.args)).rejects.toThrow(
    "EXPORT_DATA_UNAVAILABLE",
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.p._id, {
      researchSummaries: [{ ...r, finishedAt: Infinity }],
    }),
  );
  await expect(f.signed.query(preferencesExport, f.args)).rejects.toThrow(
    "RESEARCH_SUMMARY_CLOCK_INVALID",
  );
});
test.each([
  new Error("database resource failure"),
  new ConvexError("RESEARCH_PROOF_ANCESTRY_LIMIT"),
  new ConvexError("STYLE_ANCESTRY_LIMIT"),
])(
  "preferences export propagates unexpected proof failures %s",
  async (failure) => {
    const f = await summaryExportFixture();
    vi.spyOn(sourceAccess, "sourceAuthority").mockRejectedValue(failure);
    await expect(f.signed.query(preferencesExport, f.args)).rejects.toThrow(
      failure.message,
    );
  },
);
test("preferences export omits lost source proof without skeleton or counts and checks session before proof access", async () => {
  const f = await summaryExportFixture();
  const proof = vi
    .spyOn(sourceAccess, "sourceAuthority")
    .mockRejectedValue(new ConvexError("RESEARCH_SOURCE_CHANGED"));
  await expect(
    f.signed.query(preferencesExport, {
      ...f.args,
      expectedSessionId: "obsolete",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  expect(proof).not.toHaveBeenCalled();
  const r = await f.signed.query(preferencesExport, f.args);
  expect(r.data.researchSummaries).toEqual([]);
  expect(r.data).not.toHaveProperty("summaryCount");
  proof.mockRestore();
  await f.t.run((ctx) =>
    ctx.db.patch(f.p._id, {
      researchSummaries: [
        {
          ...f.p.researchSummaries![0],
          sourceUntil: Date.now() - 1,
          deadline: Date.now() - 1,
        },
      ],
    }),
  );
  expect(
    (await f.signed.query(preferencesExport, f.args)).data.researchSummaries,
  ).toEqual([]);
});

test("preferences export refuses a foreign or unselected workspace and validates stored settings", async () => {
  const f = await preferenceFixture();
  const other = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Other", description: "" }),
  );
  await expect(
    f.signed.query(preferencesExport, { ...f.args, workspaceId: other }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  await f.t.run((ctx) =>
    ctx.db.insert("memberships", {
      userId: f.userId,
      workspaceId: other,
      role: "Viewer",
    }),
  );
  await expect(
    f.signed.query(preferencesExport, { ...f.args, workspaceId: other }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  const p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  await f.t.run((ctx) =>
    ctx.db.patch(p._id, {
      notifications: {
        revision: Infinity,
        email: false,
        weekly: false,
        research: false,
        inAppSummaries: false,
        timezone: "UTC",
        quiet: null,
      },
    }),
  );
  await expect(f.signed.query(preferencesExport, f.args)).rejects.toThrow(
    "NOTIFICATION_REVISION_INVALID",
  );
  await f.t.run((ctx) => ctx.db.delete(p._id));
  await expect(f.signed.query(preferencesExport, f.args)).rejects.toThrow(
    "NOTIFICATION_PROFILE_UNAVAILABLE",
  );
});
test("five genuine producer summaries remain bounded and omit changed source authority", async () => {
  const f = await summaryExportFixture();
  for (let i = 1; i < 5; i++) {
    const orderId = await f.start(`export-${i}`);
    await f.t.mutation(internal.research.native.finish, {
      orderId,
      generation: 1,
    });
  }
  const r = await f.signed.run(async (ctx) => ({
    value: await ctx.runQuery(preferencesExport, f.args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(r.value.data.researchSummaries).toHaveLength(5);
  expect(
    r.value.data.researchSummaries.every(
      (row: { proofValidUntil: number }) =>
        row.proofValidUntil >= r.value.proofValidUntil,
    ),
  ).toBe(true);
  expect(r.metrics.documentsRead.used).toBeLessThan(1000);
  expect(r.metrics.documentsWritten.used).toBe(0);
  expect(r.metrics.functionsScheduled.used).toBe(0);
  expect(
    new TextEncoder().encode(JSON.stringify(r.value)).length,
  ).toBeLessThanOrEqual(64 * 1024);
  await f.t.run((ctx) =>
    ctx.db.patch(f.policies[0], { lifecycleValidUntil: Date.now() + 1000 }),
  );
  expect(
    (await f.signed.query(preferencesExport, f.args)).data.researchSummaries,
  ).toEqual([]);
});
