import { test, expect, beforeEach, afterEach, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { mediaFixture } from "../../tests/media-fixture";
import { modelFixture } from "../../tests/model-fixture";
import { nextOccurrence } from "./time";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const config = {
  topics: "Product",
  project: "Own project",
  audience: "Builders",
  languages: ["de"],
  regions: ["DE"],
  preferredSources: ["https://example.test"],
  exclusions: "",
  freshnessDays: 7,
  topicCount: 5,
  frequency: "manual" as const,
  timeZone: "Europe/Berlin",
  clock: "09:00",
  weekday: 1,
  cap: null,
  autoHandoff: false as const,
};
async function fixture(priced = false) {
  const f = await modelFixture(await mediaFixture());
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("aiPolicies").collect())[0];
    if (priced) {
      await ctx.db.patch(p._id, { purposes: ["research"] });
      for (const b of await ctx.db.query("aiBudgets").collect())
        await ctx.db.patch(b._id, {
          purposes: ["research"],
          expiresAt: Date.now() + 10 * 86400000,
        });
    } else await ctx.db.delete(p._id);
  });
  const profileId = await f.signed.mutation(api.research.profiles.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    config,
    commandKey: "create-one",
  });
  const get = () =>
    f.signed.query(api.research.profiles.get, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
    });
  return { ...f, profileId, get };
}
function startArgs(f: Awaited<ReturnType<typeof fixture>>, revision = 1) {
  return {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: revision,
    operationKey: "manual-one",
  };
}
test("saved recurrence skips gaps, chooses overlap earlier exactly once, uses future weekly dates and rejects unsafe inputs", () => {
  const c = { ...config, frequency: "daily" as const, clock: "02:30" };
  expect(nextOccurrence(c, Date.parse("2026-03-28T03:00Z"))).toBe(
    Date.parse("2026-03-30T00:30Z"),
  );
  expect(nextOccurrence(c, Date.parse("2026-10-24T03:00Z"))).toBe(
    Date.parse("2026-10-25T00:30Z"),
  );
  expect(nextOccurrence(c, Date.parse("2026-10-25T00:31Z"))).toBe(
    Date.parse("2026-10-26T01:30Z"),
  );
  expect(
    nextOccurrence(
      { ...c, frequency: "weekly", weekday: 1 },
      Date.parse("2026-10-05T03:00Z"),
    ),
  ).toBe(Date.parse("2026-10-12T00:30Z"));
  expect(
    nextOccurrence(
      { ...c, timeZone: "Etc/GMT+5", clock: "09:00" },
      Date.parse("2026-10-05T00:00Z"),
    ),
  ).toBe(Date.parse("2026-10-05T14:00Z"));
  for (const bad of [
    { clock: "24:00" },
    { timeZone: "+02:00" },
    { weekday: 1.5 },
  ])
    expect(() => nextOccurrence({ ...c, ...bad }, Date.now())).toThrow(
      "TIME_INVALID",
    );
});
test("real profiles begin manual/inactive with no budget, manual orders need no GitHub and finish honestly blocked", async () => {
  const f = await fixture();
  const row = (await f.get())!;
  expect(row.profile.scheduleActive).toBe(false);
  expect(row.profile.nextAt).toBeNull();
  expect(row.version.config.cap).toBeNull();
  const id = await f.signed.mutation(api.research.runs.start, startArgs(f));
  expect(await f.signed.mutation(api.research.runs.start, startArgs(f))).toBe(
    id,
  );
  await f.t.mutation(internal.research.runs.execute, {
    orderId: id,
    generation: 1,
  });
  const order = await f.t.run((ctx) => ctx.db.get(id));
  expect(order?.state).toBe("blocked");
  expect(order?.usageMicros).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("aiAttempts").collect())).toEqual(
    [],
  );
});
test("CAS edits retain actual queued snapshot and operation receipt, changed stable key conflicts", async () => {
  const f = await fixture();
  const id = await f.signed.mutation(api.research.runs.start, startArgs(f));
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 1,
    commandKey: "save-next",
    action: { kind: "save", config: { ...config, topics: "Different" } },
  });
  await expect(
    f.signed.mutation(api.research.profiles.change, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 1,
      commandKey: "stale-one",
      action: { kind: "save", config },
    }),
  ).rejects.toThrow("REVISION_CONFLICT");
  await f.t.mutation(internal.research.runs.execute, {
    orderId: id,
    generation: 1,
  });
  expect((await f.t.run((ctx) => ctx.db.get(id)))?.config.topics).toBe(
    "Product",
  );
  expect(await f.signed.mutation(api.research.runs.start, startArgs(f))).toBe(
    id,
  );
  await expect(
    f.signed.mutation(api.research.runs.start, startArgs(f, 2)),
  ).rejects.toThrow("OPERATION_CONFLICT");
});
test("pause and delete fence delayed admission/execution; stop preserves immutable receipt", async () => {
  const f = await fixture();
  const id = await f.signed.mutation(api.research.runs.start, startArgs(f));
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 1,
    commandKey: "pause-one",
    action: { kind: "pause", paused: true },
  });
  await expect(
    f.signed.mutation(api.research.runs.start, {
      ...startArgs(f, 2),
      operationKey: "manual-two",
    }),
  ).rejects.toThrow("INACTIVE");
  await f.t.mutation(internal.research.runs.execute, {
    orderId: id,
    generation: 1,
  });
  expect((await f.t.run((ctx) => ctx.db.get(id)))?.state).toBe("blocked");
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "delete-one",
    action: { kind: "delete" },
  });
  expect((await f.get())?.profile.deleted).toBe(true);
});
test("native scheduled occurrence survives terminal pointer clear; concurrent manual and scheduler do not queue unbounded work", async () => {
  const f = await fixture(true);
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 1,
    commandKey: "save-one",
    action: {
      kind: "save",
      config: {
        ...config,
        frequency: "daily",
        cap: { currency: "USD", limitMicros: 10000 },
      },
    },
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "activate-one",
    action: { kind: "activate" },
  });
  const row = (await f.get())!.profile;
  const callback = {
    profileId: f.profileId,
    generation: row.scheduleGeneration,
    at: row.nextAt!,
  };
  vi.setSystemTime(row.nextAt!);
  const [id, other] = await Promise.all([
    f.t.mutation(internal.research.schedules.fire, callback),
    f.t.mutation(internal.research.schedules.fire, callback),
  ]);
  expect(id).toBe(other);
  expect((await f.get())!.profile.scheduleReason).toBeNull();
  expect(id).not.toBeNull();
  await f.t.mutation(internal.research.runs.execute, {
    orderId: id!,
    generation: 1,
  });
  expect(await f.t.mutation(internal.research.schedules.fire, callback)).toBe(
    id,
  );
  expect((await f.t.run((ctx) => ctx.db.get(id!)))?.reason).toBe(
    "RESEARCH_DOWNSTREAM_UNAVAILABLE",
  );
  const next = (await f.get())!.profile;
  const manual = await f.signed.mutation(api.research.runs.start, {
    ...startArgs(f, 3),
    operationKey: "manual-new",
  });
  vi.setSystemTime(next.nextAt!);
  const overlap = await f.t.mutation(internal.research.schedules.fire, {
    profileId: f.profileId,
    generation: next.scheduleGeneration,
    at: next.nextAt!,
  });
  expect((await f.t.run((ctx) => ctx.db.get(overlap!)))?.reason).toBe(
    "RESEARCH_ORDER_ACTIVE",
  );
  expect((await f.t.run((ctx) => ctx.db.get(f.profileId)))!.activeOrderId).toBe(
    manual,
  );
});
async function prepared() {
  const f = await fixture(true);
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 1,
    commandKey: "save-plan",
    action: {
      kind: "save",
      config: {
        ...config,
        frequency: "daily",
        cap: { currency: "USD", limitMicros: 10000 },
      },
    },
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    commandKey: "activate-plan",
    action: { kind: "activate" },
  });
  const profile = (await f.get())!.profile;
  return {
    ...f,
    callback: {
      profileId: f.profileId,
      generation: profile.scheduleGeneration,
      at: profile.nextAt!,
    },
  };
}
test.each([
  "pause",
  "delete",
  "edit",
  "demote",
  "close",
  "disconnect",
  "policy",
  "grant",
] as const)("delayed native callback cannot admit after %s", async (kind) => {
  const f = await prepared();
  if (kind === "pause" || kind === "delete" || kind === "edit")
    await f.signed.mutation(api.research.profiles.change, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 3,
      commandKey: `change-${kind}`,
      action:
        kind === "pause"
          ? { kind: "pause", paused: true }
          : kind === "delete"
            ? { kind: "delete" }
            : {
                kind: "save",
                config: {
                  ...config,
                  topics: "New",
                  cap: { currency: "USD", limitMicros: 10000 },
                },
              },
    });
  else
    await f.t.run(async (ctx) => {
      if (kind === "demote") {
        const m = (await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique())!;
        await ctx.db.patch(m._id, { role: "Viewer" });
      }
      if (kind === "close")
        await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
      if (kind === "disconnect")
        await ctx.db.patch(f.accountId, { connection: "disconnected" });
      if (kind === "policy") {
        const p = (await ctx.db.query("aiPolicies").collect())[0];
        await ctx.db.patch(p._id, {
          processingEvidence: "changed same version",
        });
      }
      if (kind === "grant") {
        const b = (await ctx.db.query("aiBudgets").collect())[0];
        await ctx.db.patch(b._id, { heldMicros: b.limitMicros });
      }
    });
  vi.setSystemTime(f.callback.at);
  expect(
    await f.t.mutation(internal.research.schedules.fire, f.callback),
  ).toBeNull();
  expect(
    await f.t.run((ctx) => ctx.db.query("researchOrders").collect()),
  ).toEqual([]);
});
test("same millisecond replanning changes generation, native job cancellation persists and missed periods produce only one receipt", async () => {
  const f = await prepared();
  const old = await f.t.run((ctx) => ctx.db.get(f.profileId));
  const native = await f.t.run((ctx) =>
    ctx.db.system.get(old!.scheduledJobId!),
  );
  expect(native?.name).toBe("research/schedules:fire");
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    commandKey: "deactivate-one",
    action: { kind: "deactivate" },
  });
  expect(
    (await f.t.run((ctx) => ctx.db.system.get(old!.scheduledJobId!)))?.state
      .kind,
  ).toBe("canceled");
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 4,
    commandKey: "activate-again",
    action: { kind: "activate" },
  });
  const current = (await f.get())!.profile;
  expect(current.nextAt).toBe(old!.nextAt);
  expect(current.scheduleGeneration).toBeGreaterThan(old!.scheduleGeneration);
  vi.setSystemTime(f.callback.at + 3 * 86400000);
  expect(
    await f.t.mutation(internal.research.schedules.fire, f.callback),
  ).toBeNull();
  const id = await f.t.mutation(internal.research.schedules.fire, {
    profileId: f.profileId,
    generation: current.scheduleGeneration,
    at: current.nextAt!,
  });
  expect(id).not.toBeNull();
  const after = await f.t.run((ctx) => ctx.db.get(f.profileId));
  expect(after!.nextAt).toBeGreaterThan(Date.now());
  expect(
    await f.t.run((ctx) => ctx.db.query("researchOrders").collect()),
  ).toHaveLength(1);
});
test("immutable priced queued order stays independent of edited current version; future schedules need reactivation", async () => {
  const f = await prepared();
  const id = await f.signed.mutation(api.research.runs.start, {
    ...startArgs(f, 3),
    operationKey: "old-profile-run",
  });
  const original = await f.t.run((ctx) => ctx.db.get(id));
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    commandKey: "new-profile",
    action: {
      kind: "save",
      config: {
        ...config,
        topics: "Changed",
        cap: { currency: "USD", limitMicros: 10000 },
      },
    },
  });
  await f.t.mutation(internal.research.runs.execute, {
    orderId: id,
    generation: 1,
  });
  const executed = await f.t.run((ctx) => ctx.db.get(id));
  expect(executed?.profileVersionId).toBe(original!.profileVersionId);
  expect(executed?.config.topics).toBe("Product");
  expect(executed?.reason).toBe("RESEARCH_DOWNSTREAM_UNAVAILABLE");
  expect((await f.get())!.profile.scheduleActive).toBe(false);
});
test("trust boundary rejects unsupported money/config/reference and Viewer commands, no policy/grants are seeded", async () => {
  const f = await fixture();
  for (const c of [
    { ...config, topicCount: NaN },
    { ...config, freshnessDays: 1.5 },
    { ...config, preferredSources: ["https://user:secret@example.test"] },
    { ...config, languages: ["*"] },
  ])
    await expect(
      f.signed.mutation(api.research.profiles.change, {
        workspaceId: f.workspaceId,
        profileId: f.profileId,
        expectedRevision: 1,
        commandKey: "bad-config",
        action: { kind: "save", config: c },
      }),
    ).rejects.toThrow("INPUT_INVALID");
  await expect(
    f.signed.mutation(api.research.profiles.change, {
      workspaceId: f.workspaceId,
      profileId: f.profileId,
      expectedRevision: 1,
      commandKey: "bad-currency",
      action: {
        kind: "save",
        config: { ...config, cap: { currency: "EUR", limitMicros: 100 } },
      },
    }),
  ).rejects.toThrow("CONFIGURATION_REQUIRED");
  const foreign = await f.t.run(async (ctx) => {
    const ws = await ctx.db.insert("workspaces", {
      name: "Foreign",
      description: "",
    });
    const { _id, _creationTime, ...account } = (await ctx.db.get(f.accountId))!;
    return ctx.db.insert("socialAccounts", { ...account, workspaceId: ws });
  });
  await expect(
    f.signed.query(api.research.profiles.get, {
      workspaceId: f.workspaceId,
      accountId: foreign,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run(async (ctx) => {
    const m = (await ctx.db.query("memberships").collect())[0];
    await ctx.db.patch(m._id, { role: "Viewer" });
  });
  await expect(
    f.signed.mutation(api.research.runs.start, startArgs(f)),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  expect(
    await f.t.run((ctx) => ctx.db.query("aiPolicies").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("agentRuns").collect()),
  ).toHaveLength(0);
});
test("simultaneous manual requests admit one active order; durable stop fences its delayed execution", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([
    f.signed.mutation(api.research.runs.start, startArgs(f)),
    f.signed.mutation(api.research.runs.start, {
      ...startArgs(f),
      operationKey: "manual-other",
    }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const orders = await f.t.run((ctx) =>
    ctx.db.query("researchOrders").collect(),
  );
  expect(orders).toHaveLength(1);
  await f.signed.mutation(api.research.runs.stop, {
    workspaceId: f.workspaceId,
    orderId: orders[0]._id,
  });
  await f.t.mutation(internal.research.runs.execute, {
    orderId: orders[0]._id,
    generation: 1,
  });
  const stopped = await f.t.run((ctx) => ctx.db.get(orders[0]._id));
  expect(stopped?.state).toBe("cancelled");
  expect(stopped?.usageMicros).toBeNull();
  expect(stopped?.config).toEqual(config);
});
test("actual native timer executes the saved scheduled function and queued shell without external I/O", async () => {
  const f = await prepared();
  await vi.advanceTimersByTimeAsync(f.callback.at - Date.now() + 1);
  await f.t.finishInProgressScheduledFunctions();
  await vi.advanceTimersByTimeAsync(1);
  await f.t.finishInProgressScheduledFunctions();
  const orders = await f.t.run((ctx) =>
    ctx.db.query("researchOrders").collect(),
  );
  expect(orders).toHaveLength(1);
  expect(orders[0].occurrence).toEqual({
    generation: f.callback.generation,
    at: f.callback.at,
  });
  expect(orders[0].state).toBe("blocked");
  expect(orders[0].reason).toBe("RESEARCH_DOWNSTREAM_UNAVAILABLE");
  expect(
    await f.t.run((ctx) => ctx.db.query("agentRuns").collect()),
  ).toHaveLength(0);
});
test("profile edits retain an unchanged historical cap after pricing withdrawal, removal is explicit, public projections hide grant/job authority", async () => {
  const f = await prepared();
  const row = (await f.get())!;
  expect(row.profile).not.toHaveProperty("scheduleApproval");
  expect(row.profile).not.toHaveProperty("scheduledJobId");
  await f.t.run(async (ctx) => {
    const p = (await ctx.db.query("aiPolicies").collect())[0];
    await ctx.db.delete(p._id);
  });
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 3,
    commandKey: "withdraw-edit",
    action: {
      kind: "save",
      config: { ...row.version.config, topics: "Still editable" },
    },
  });
  expect((await f.get())!.version.config.cap).toEqual({
    currency: "USD",
    limitMicros: 10000,
  });
  const id = await f.signed.mutation(api.research.runs.start, {
    ...startArgs(f, 4),
    operationKey: "withdraw-run",
  });
  await f.t.mutation(internal.research.runs.execute, {
    orderId: id,
    generation: 1,
  });
  const history = await f.signed.query(api.research.runs.history, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(history.page[0]).not.toHaveProperty("approval");
  expect(history.page[0]).not.toHaveProperty("actorId");
  expect(history.page[0].usageMicros).toBeNull();
  await f.signed.mutation(api.research.profiles.change, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 4,
    commandKey: "remove-cap",
    action: { kind: "save", config: { ...row.version.config, cap: null } },
  });
  expect((await f.get())!.version.config.cap).toBeNull();
});
