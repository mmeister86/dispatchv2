import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { mediaFixture } from "../tests/media-fixture";
import { api, components } from "./_generated/api";
const read = makeFunctionReference<"query">("preferences:notifications");
const save = makeFunctionReference<"mutation">("preferences:saveNotifications");
const defaults = {
  revision: 0,
  email: false,
  inAppSummaries: false,
  weekly: false,
  research: false,
  timezone: "UTC",
  quiet: null,
};
const desired = {
  email: true,
  inAppSummaries: true,
  weekly: true,
  research: true,
  timezone: "Europe/Berlin",
  quiet: { start: "20:00", end: "08:00" },
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function fixture() {
  const f = await mediaFixture(),
    user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  return {
    ...f,
    args: {
      workspaceId: f.workspaceId,
      expectedAuthId: user.authId,
      requestKey: crypto.randomUUID(),
    },
  };
}
test("registered own notification query defaults OFF without writing or creating consent", async () => {
  const f = await fixture(),
    before = await f.t.run((ctx) => ctx.db.query("preferences").first());
  const r = await f.signed.run(async (ctx) => ({
    result: await ctx.runQuery(read, f.args),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(r.result.settings).toEqual(defaults);
  expect(r.result.authId).toBe(f.args.expectedAuthId);
  expect(r.result.workspaceId).toBe(f.workspaceId);
  expect(r.result.requestKey).toBe(f.args.requestKey);
  expect(r.result.sessionId).toBeTruthy();
  expect(r.metrics.documentsWritten.used).toBe(0);
  expect(r.metrics.functionsScheduled.used).toBe(0);
  expect(await f.t.run((ctx) => ctx.db.query("preferences").first())).toEqual(
    before,
  );
});
test("registered setter persists own fixed intent and fresh reads without contaminating original profile", async () => {
  const f = await fixture(),
    before = await f.signed.query(api.users.current, {});
  const r = await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 0,
    settings: desired,
  });
  expect(r.settings).toEqual({ ...desired, revision: 1 });
  expect(
    (await f.signed.query(read, { ...f.args, requestKey: crypto.randomUUID() }))
      .settings,
  ).toEqual(r.settings);
  expect(await f.signed.query(api.users.current, {})).toEqual(before);
});

async function person(
  f: Awaited<ReturnType<typeof fixture>>,
  email: string,
  verified = true,
) {
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Recipient",
          email,
          emailVerified: verified,
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
          expiresAt: Date.now() + 86400000,
        },
      },
    });
    return { subject: u._id, sessionId: s._id };
  });
  return { signed: f.t.withIdentity(identity), identity };
}
test("all four actual self roles persist choices while original Viewer profile and project restrictions remain", async () => {
  const f = await fixture();
  let revision = 0;
  for (const role of ["Owner", "Admin", "Editor", "Viewer"] as const) {
    await f.t.run(async (ctx) => {
      const m = (await ctx.db.query("memberships").first())!;
      await ctx.db.patch(m._id, { role });
    });
    const settings = { ...desired, email: role !== "Owner" };
    const r = await f.signed.mutation(save, {
      ...f.args,
      requestKey: crypto.randomUUID(),
      expectedRevision: revision,
      settings,
    });
    revision = r.settings.revision;
    expect((await f.signed.query(read, f.args)).settings).toEqual(r.settings);
    if (role === "Viewer") {
      const snapshot = await f.signed.query(api.users.current, {});
      if (snapshot.state !== "ready") throw Error("Missing profile");
      await expect(
        f.signed.mutation(api.preferences.save, {
          workspaceId: f.workspaceId,
          profile: snapshot.preferences,
        }),
      ).rejects.toThrow("ROLE_ACCESS_DENIED");
    }
  }
});
test("actual public invitation provisions Viewer own preferences without changing the inviter or granting Admin recipient override", async () => {
  const f = await fixture(),
    recipient = await person(f, "viewer-notifications@example.test");
  const team = await f.signed.query(api.team.list, {
    workspaceId: f.workspaceId,
  });
  const issued = await f.signed.mutation(api.team.change, {
    workspaceId: f.workspaceId,
    commandKey: crypto.randomUUID(),
    expectedRevision: team.revision,
    action: {
      kind: "invite",
      email: "viewer-notifications@example.test",
      role: "Viewer",
      lifetimeDays: 1,
    },
  });
  if (!issued.invitationId) throw Error("Missing actual invitation");
  const preview = await recipient.signed.query(api.team.preview, {
    invitationId: issued.invitationId,
  });
  if (!preview) throw Error("Missing invitation proof");
  await recipient.signed.mutation(api.team.accept, {
    invitationId: issued.invitationId,
    expectedRevision: preview.revision,
    commandKey: crypto.randomUUID(),
  });
  await recipient.signed.mutation(api.workspaces.select, {
    workspaceId: f.workspaceId,
  });
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: recipient.identity.subject,
    requestKey: crypto.randomUUID(),
  };
  expect((await recipient.signed.query(read, args)).settings).toEqual(defaults);
  expect(
    (
      await recipient.signed.mutation(save, {
        ...args,
        expectedRevision: 0,
        settings: desired,
      })
    ).settings.revision,
  ).toBe(1);
  expect((await f.signed.query(read, f.args)).settings).toEqual(defaults);
  await expect(
    f.signed.query(read, {
      ...f.args,
      expectedAuthId: recipient.identity.subject,
    }),
  ).rejects.toThrow("NOTIFICATION_SCOPE_CHANGED");
  await expect(
    f.signed.mutation(save, {
      ...f.args,
      expectedRevision: 0,
      settings: desired,
      userId: f.userId,
    }),
  ).rejects.toThrow();
});
test("CAS accepts identical current intent without writes, conflicts on stale different intent, and serializes actual concurrent intents", async () => {
  const f = await fixture(),
    args = { ...f.args, expectedRevision: 0, settings: desired };
  const first = await f.signed.mutation(save, args);
  const replay = await f.signed.run(async (ctx) => ({
    result: await ctx.runMutation(save, {
      ...args,
      requestKey: crypto.randomUUID(),
    }),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
  expect(replay.result.settings).toEqual(first.settings);
  expect(replay.metrics.documentsWritten.used).toBe(0);
  expect(replay.metrics.functionsScheduled.used).toBe(0);
  await expect(
    f.signed.mutation(save, {
      ...args,
      settings: { ...desired, email: false },
    }),
  ).rejects.toThrow("NOTIFICATION_REVISION_CONFLICT");
  const outcomes = await Promise.allSettled([
    f.signed.mutation(save, {
      ...args,
      expectedRevision: 1,
      settings: { ...desired, weekly: false },
    }),
    f.signed.mutation(save, {
      ...args,
      expectedRevision: 1,
      settings: { ...desired, research: false },
    }),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect((await f.signed.query(read, f.args)).settings.revision).toBe(2);
});
test("strict fixed intent, timezone, quiet clocks and request selectors reject invalid input without provider or native effects", async () => {
  const f = await fixture(),
    http = vi.fn(() => {
      throw Error("No provider IO");
    });
  vi.stubGlobal("fetch", http);
  const before = await f.t.run((ctx) => ctx.db.query("preferences").first());
  for (const settings of [
    { ...desired, timezone: "" },
    { ...desired, timezone: "x".repeat(101) },
    { ...desired, timezone: "Invalid/Timezone" },
    { ...desired, quiet: { start: "24:00", end: "08:00" } },
    { ...desired, quiet: { start: "8:00", end: "08:00" } },
    { ...desired, quiet: { start: "08:00", end: "08:00" } },
    { ...desired, recipientId: f.userId },
  ])
    await expect(
      f.signed.mutation(save, { ...f.args, expectedRevision: 0, settings }),
    ).rejects.toThrow();
  for (const expectedRevision of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    await expect(
      f.signed.mutation(save, {
        ...f.args,
        expectedRevision,
        settings: desired,
      }),
    ).rejects.toThrow("NOTIFICATION_REVISION_INVALID");
  for (const requestKey of ["", "x".repeat(65)])
    await expect(
      f.signed.query(read, { ...f.args, requestKey }),
    ).rejects.toThrow("NOTIFICATION_REQUEST_INVALID");
  expect(await f.t.run((ctx) => ctx.db.query("preferences").first())).toEqual(
    before,
  );
  expect(http).not.toHaveBeenCalled();
});
test("corrupt stored revisions and settings fail closed; overflow cannot change intent", async () => {
  const f = await fixture(),
    p = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  for (const revision of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    await f.t.run((ctx) =>
      ctx.db.patch(p._id, { notifications: { ...desired, revision } }),
    );
    await expect(f.signed.query(read, f.args)).rejects.toThrow(
      "NOTIFICATION_REVISION_INVALID",
    );
  }
  await f.t.run((ctx) =>
    ctx.db.patch(p._id, {
      notifications: {
        ...desired,
        revision: 0,
        quiet: { start: "20:00", end: "20:00" },
      },
    }),
  );
  await expect(f.signed.query(read, f.args)).rejects.toThrow(
    "INVALID_NOTIFICATION_SETTINGS",
  );
  await f.t.run((ctx) =>
    ctx.db.patch(p._id, {
      notifications: { ...desired, revision: Number.MAX_SAFE_INTEGER },
    }),
  );
  await expect(
    f.signed.mutation(save, {
      ...f.args,
      expectedRevision: Number.MAX_SAFE_INTEGER,
      settings: { ...desired, email: false },
    }),
  ).rejects.toThrow("NOTIFICATION_REVISION_OVERFLOW");
  expect(
    (
      await f.signed.mutation(save, {
        ...f.args,
        expectedRevision: 0,
        settings: desired,
      })
    ).settings.revision,
  ).toBe(Number.MAX_SAFE_INTEGER);
});
test("own active workspace and verified native session are mandatory, including future query and profile-source loss", async () => {
  const f = await fixture();
  await expect(f.t.query(read, f.args)).rejects.toThrow();
  await expect(
    f.t
      .withIdentity({
        subject: f.args.expectedAuthId,
        sessionId: "foreign-session",
      })
      .query(read, f.args),
  ).rejects.toThrow();
  const unverified = await person(
    f,
    "unverified-notifications@example.test",
    false,
  );
  await expect(unverified.signed.query(read, f.args)).rejects.toThrow(
    "EMAIL_NOT_VERIFIED",
  );
  const foreign = await person(f, "foreign-notifications@example.test");
  await foreign.signed.mutation(api.users.bootstrap, {});
  await expect(
    foreign.signed.query(read, {
      ...f.args,
      expectedAuthId: foreign.identity.subject,
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  const other = await f.signed.mutation(api.workspaces.create, {
    name: "Other",
    description: "",
  });
  await expect(f.signed.query(read, f.args)).rejects.toThrow(
    "NOTIFICATION_SCOPE_CHANGED",
  );
  await f.signed.mutation(api.workspaces.select, {
    workspaceId: f.workspaceId,
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(f.signed.query(read, f.args)).rejects.toThrow(
    "WORKSPACE_INACTIVE",
  );
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.workspaceId, { lifecycle: "active" });
    const p = (await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique())!;
    await ctx.db.delete(p._id);
  });
  await expect(f.signed.query(read, f.args)).rejects.toThrow(
    "NOTIFICATION_PROFILE_UNAVAILABLE",
  );
  expect(other).not.toBe(f.workspaceId);
});
test("original profile saves preserve choices and strict current/export profile expose exactly original eight fields", async () => {
  const f = await fixture();
  await f.signed.mutation(save, {
    ...f.args,
    expectedRevision: 0,
    settings: desired,
  });
  const before = await f.signed.query(api.users.current, {});
  if (before.state !== "ready") throw Error("Missing original profile");
  expect(Object.keys(before.preferences).sort()).toEqual([
    "audience",
    "language",
    "name",
    "onboardingDone",
    "onboardingStep",
    "timezone",
    "tone",
    "topics",
  ]);
  await f.signed.mutation(api.preferences.save, {
    workspaceId: f.workspaceId,
    profile: { ...before.preferences, tone: "Original native tone" },
  });
  expect((await f.signed.query(read, f.args)).settings).toEqual({
    ...desired,
    revision: 1,
  });
  const archive = await f.signed.query(api.operations.export.self, f.args);
  expect(archive.data.profile).not.toHaveProperty("notifications");
  expect(archive.data.profile.tone).toBe("Original native tone");
});

test("notification zones reject fixed offsets on write and stored read while preserving named aliases", async () => {
  const f = await fixture(),
    http = vi.fn(() => {
      throw Error("No provider IO");
    });
  vi.stubGlobal("fetch", http);
  const before = (await f.t.run((ctx) => ctx.db.query("preferences").first()))!;
  for (const timezone of ["+01:00", "-04:30", "+00:00", "+0100", "+01"]) {
    await expect(
      f.signed.mutation(save, {
        ...f.args,
        expectedRevision: 0,
        settings: { ...desired, timezone },
      }),
    ).rejects.toThrow("INVALID_NOTIFICATION_SETTINGS");
    expect(await f.t.run((ctx) => ctx.db.get(before._id))).toEqual(before);
    await f.t.run((ctx) =>
      ctx.db.patch(before._id, {
        notifications: { ...desired, timezone, revision: 0 },
      }),
    );
    await expect(f.signed.query(read, f.args)).rejects.toThrow(
      "INVALID_NOTIFICATION_SETTINGS",
    );
    await f.t.run((ctx) =>
      ctx.db.patch(before._id, { notifications: undefined }),
    );
  }
  let revision = 0;
  for (const timezone of [
    "UTC",
    "Etc/UTC",
    "Etc/GMT+1",
    "Etc/GMT-1",
    "US/Eastern",
    "Europe/Berlin",
  ]) {
    const result = await f.signed.mutation(save, {
      ...f.args,
      expectedRevision: revision,
      settings: { ...desired, timezone },
    });
    revision = result.settings.revision;
    expect(result.settings.timezone).toBe(timezone);
    expect((await f.signed.query(read, f.args)).settings.timezone).toBe(
      timezone,
    );
  }
  expect(http).not.toHaveBeenCalled();
});
