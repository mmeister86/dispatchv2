import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { mediaFixture } from "../../tests/media-fixture";
import { components } from "../_generated/api";
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
