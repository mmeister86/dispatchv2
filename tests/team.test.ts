import { convexTest } from "convex-test";
import betterAuthComponent from "@convex-dev/better-auth/test";
import { afterEach, expect, test, vi } from "vitest";
import type { FunctionArgs } from "convex/server";
import schema from "../convex/schema";
import { api, components, internal } from "../convex/_generated/api";
const team = api.team;
const modules = import.meta.glob("../convex/**/*.ts");
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function setup() {
  const t = convexTest(schema, modules);
  betterAuthComponent.register(t);
  return t;
}
async function person(
  t: ReturnType<typeof setup>,
  email: string,
  verified = true,
) {
  const identity = await t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: email.split("@")[0],
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
          expiresAt: Date.now() + 40 * 86400000,
        },
      },
    });
    return { subject: u._id, sessionId: s._id };
  });
  return t.withIdentity(identity);
}
async function fixture() {
  const t = setup(),
    owner = await person(t, "owner@example.test");
  const ownerId = await owner.mutation(api.users.bootstrap, {}),
    snapshot = await owner.query(api.users.current, {});
  if (snapshot.state !== "ready")
    throw new Error("Fixture workspace must be ready");
  return { t, owner, ownerId, workspaceId: snapshot.activeWorkspaceId };
}
async function invite(
  f: Awaited<ReturnType<typeof fixture>>,
  email: string,
  role: "Owner" | "Admin" | "Editor" | "Viewer" = "Viewer",
  key = crypto.randomUUID(),
) {
  const state = await f.owner.query(team.list, { workspaceId: f.workspaceId });
  const result = await f.owner.mutation(team.change, {
    workspaceId: f.workspaceId,
    commandKey: key,
    expectedRevision: state.revision,
    action: { kind: "invite", email, role, lifetimeDays: 1 },
  });
  if (!result.invitationId)
    throw new Error("Issued invitation must have an ID");
  return { ...result, invitationId: result.invitationId };
}
async function join(
  f: Awaited<ReturnType<typeof fixture>>,
  email: string,
  role: "Owner" | "Admin" | "Editor" | "Viewer" = "Editor",
) {
  const signed = await person(f.t, email),
    issued = await invite(f, email, role);
  const preview = await signed.query(team.preview, {
    invitationId: issued.invitationId,
  });
  if (!preview) throw new Error("Verified invitation must be available");
  const args = {
    invitationId: issued.invitationId,
    expectedRevision: preview.revision,
    commandKey: crypto.randomUUID(),
  };
  const accepted = await signed.mutation(team.accept, args);
  if (!accepted.membershipId || !accepted.userId)
    throw new Error("Accepted membership must be real");
  return {
    signed,
    issued,
    accepted: {
      ...accepted,
      membershipId: accepted.membershipId,
      userId: accepted.userId,
    },
    args,
  };
}
test("recovery query is auth-only and read-only after active membership loss", async () => {
  const f = await fixture();
  const other = await f.owner.mutation(api.workspaces.create, {
    name: "Other",
    description: "",
  });
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.ownerId).eq("workspaceId", other),
      )
      .unique();
    await ctx.db.delete(m!._id);
  });
  const before = await f.t.run((ctx) => ctx.db.get(f.ownerId));
  const recovered = await f.owner.query(api.users.current, {});
  expect(recovered).toMatchObject({
    state: "recovery",
    activeWorkspaceId: null,
    preferences: null,
    repairWorkspaceId: f.workspaceId,
  });
  expect(recovered.workspaces.map((w) => w.id)).toEqual([f.workspaceId]);
  expect(await f.t.run((ctx) => ctx.db.get(f.ownerId))).toEqual(before);
  await f.owner.mutation(api.workspaces.select, { workspaceId: f.workspaceId });
  expect(await f.owner.query(api.users.current, {})).toMatchObject({
    state: "ready",
    activeWorkspaceId: f.workspaceId,
  });
});
test("public verified target grants one Viewer membership and genuine ready preferences; replay never regrants", async () => {
  const f = await fixture(),
    j = await join(f, "VIEWER@example.test", "Viewer");
  expect(j.accepted.disposition).toBe("joined");
  expect(await j.signed.mutation(team.accept, j.args)).toEqual(j.accepted);
  await j.signed.mutation(api.workspaces.select, {
    workspaceId: f.workspaceId,
  });
  const snapshot = await j.signed.query(api.users.current, {});
  const actualUser = await f.t.run((ctx) => ctx.db.get(j.accepted.userId));
  expect(snapshot.authId).toBe(actualUser!.authId);
  const actualIdentity = await f.t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", value: snapshot.authId }],
    }),
  );
  expect(actualIdentity).toMatchObject({
    _id: snapshot.authId,
    emailVerified: true,
  });
  expect(snapshot).toMatchObject({
    state: "ready",
    preferences: { name: "VIEWER", onboardingDone: true },
  });
  expect(snapshot.workspaces.find((w) => w.id === f.workspaceId)?.role).toBe(
    "Viewer",
  );
  const state = await f.owner.query(team.list, { workspaceId: f.workspaceId });
  await f.owner.mutation(team.change, {
    workspaceId: f.workspaceId,
    commandKey: crypto.randomUUID(),
    expectedRevision: state.revision,
    action: { kind: "remove", membershipId: j.accepted.membershipId },
  });
  await expect(j.signed.mutation(team.accept, j.args)).rejects.toThrow(
    "INVITATION_UNAVAILABLE",
  );
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", j.accepted.userId).eq("workspaceId", f.workspaceId),
        )
        .unique(),
    ),
  ).toBeNull();
});
test("opaque invite lookup reveals no metadata and performs no provisioning for wrong or unverified identity", async () => {
  const f = await fixture(),
    issued = await invite(f, "recipient@example.test");
  const wrong = await person(f.t, "wrong@example.test"),
    unverified = await person(f.t, "recipient@example.test", false);
  const before = await f.t.run((ctx) => ctx.db.query("users").take(10));
  expect(
    await wrong.query(team.preview, { invitationId: issued.invitationId }),
  ).toBeNull();
  await expect(
    wrong.mutation(team.accept, {
      invitationId: issued.invitationId,
      expectedRevision: 1,
      commandKey: crypto.randomUUID(),
    }),
  ).rejects.toThrow("INVITATION_UNAVAILABLE");
  await expect(
    unverified.query(team.preview, { invitationId: issued.invitationId }),
  ).rejects.toThrow("EMAIL_NOT_VERIFIED");
  expect(await f.t.run((ctx) => ctx.db.query("users").take(10))).toEqual(
    before,
  );
});
test("already member consumes invitation without role promotion and Admin cannot grant Owner", async () => {
  const f = await fixture(),
    j = await join(f, "admin@example.test", "Admin");
  const again = await invite(f, "admin@example.test", "Owner"),
    preview = await j.signed.query(team.preview, {
      invitationId: again.invitationId,
    });
  if (!preview) throw new Error("Verified invitation must be available");
  const result = await j.signed.mutation(team.accept, {
    invitationId: again.invitationId,
    expectedRevision: preview.revision,
    commandKey: crypto.randomUUID(),
  });
  expect(result.disposition).toBe("already-member");
  expect(
    (await f.t.run((ctx) => ctx.db.get(j.accepted.membershipId)))?.role,
  ).toBe("Admin");
  const state = await j.signed.query(team.list, { workspaceId: f.workspaceId });
  await expect(
    j.signed.mutation(team.change, {
      workspaceId: f.workspaceId,
      commandKey: crypto.randomUUID(),
      expectedRevision: state.revision,
      action: {
        kind: "invite",
        email: "another@example.test",
        role: "Owner",
        lifetimeDays: 1,
      },
    }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
});
async function change(
  f: Awaited<ReturnType<typeof fixture>>,
  action: FunctionArgs<typeof team.change>["action"],
  actor = f.owner,
) {
  const state = await actor.query(team.list, { workspaceId: f.workspaceId });
  return actor.mutation(team.change, {
    workspaceId: f.workspaceId,
    expectedRevision: state.revision,
    commandKey: crypto.randomUUID(),
    action,
  });
}
test("Owner transfer is atomic and concurrent last-Owner changes leave an Owner", async () => {
  const f = await fixture(),
    j = await join(f, "second-owner@example.test", "Owner");
  const state = await f.owner.query(team.list, { workspaceId: f.workspaceId });
  const original = state.members.find((m) => m.userId === f.ownerId)!;
  const args = { workspaceId: f.workspaceId, expectedRevision: state.revision };
  const races = await Promise.allSettled([
    f.owner.mutation(team.change, {
      ...args,
      commandKey: "demote-owner-1",
      action: {
        kind: "role",
        membershipId: original.membershipId,
        role: "Admin",
      },
    }),
    j.signed.mutation(team.change, {
      ...args,
      commandKey: "remove-owner-2",
      action: { kind: "leave" },
    }),
  ]);
  expect(races.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const after = await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", f.workspaceId))
      .take(101),
  );
  expect(after.filter((m) => m.role === "Owner")).toHaveLength(1);
  const owner = after.find((m) => m.role === "Owner")!,
    actor = owner.userId === f.ownerId ? f.owner : j.signed;
  await expect(
    change(f, { kind: "role", membershipId: owner._id, role: "Viewer" }, actor),
  ).rejects.toThrow("LAST_OWNER_REQUIRED");
  await expect(
    change(f, { kind: "remove", membershipId: owner._id }, actor),
  ).rejects.toThrow("LAST_OWNER_REQUIRED");
  await expect(change(f, { kind: "leave" }, actor)).rejects.toThrow(
    "LAST_OWNER_REQUIRED",
  );
  const target = await join(f, "transfer@example.test", "Editor");
  // The fixture's original actor may be Admin after the race, so use the surviving Owner.
  const state2 = await actor.query(team.list, { workspaceId: f.workspaceId });
  const transferred = await actor.mutation(team.change, {
    workspaceId: f.workspaceId,
    expectedRevision: state2.revision,
    commandKey: "atomic-transfer",
    action: { kind: "transfer", membershipId: target.accepted.membershipId },
  });
  expect(transferred.disposition).toBe("transferred");
  expect(
    await f.t.run((ctx) => ctx.db.get(target.accepted.membershipId)),
  ).toMatchObject({ role: "Owner" });
  expect(await f.t.run((ctx) => ctx.db.get(owner._id))).toMatchObject({
    role: "Admin",
  });
});
test("exact command intent and CAS recheck current actor without repeating grants", async () => {
  const f = await fixture(),
    state = await f.owner.query(team.list, { workspaceId: f.workspaceId });
  const args = {
    workspaceId: f.workspaceId,
    expectedRevision: state.revision,
    commandKey: "immutable-invite",
    action: {
      kind: "invite" as const,
      email: "recipient@example.test",
      role: "Editor" as const,
      lifetimeDays: 7,
    },
  };
  const issued = await f.owner.mutation(team.change, args);
  expect(await f.owner.mutation(team.change, args)).toEqual(issued);
  await expect(
    f.owner.mutation(team.change, {
      ...args,
      action: { ...args.action, role: "Admin" },
    }),
  ).rejects.toThrow("TEAM_COMMAND_CONFLICT");
  await expect(
    f.owner.mutation(team.change, { ...args, commandKey: "new-stale-key" }),
  ).rejects.toThrow("TEAM_REVISION_CONFLICT");
  const j = await join(f, "admin-loss@example.test", "Admin"),
    state2 = await j.signed.query(team.list, { workspaceId: f.workspaceId });
  const adminArgs = {
    workspaceId: f.workspaceId,
    expectedRevision: state2.revision,
    commandKey: "admin-own-invite",
    action: args.action,
  };
  await j.signed.mutation(team.change, adminArgs);
  await change(f, {
    kind: "role",
    membershipId: j.accepted.membershipId,
    role: "Viewer",
  });
  await expect(j.signed.mutation(team.change, adminArgs)).rejects.toThrow(
    "ROLE_ACCESS_DENIED",
  );
  await change(f, {
    kind: "role",
    membershipId: j.accepted.membershipId,
    role: "Admin",
  });
  expect(await j.signed.mutation(team.change, adminArgs)).toMatchObject({
    disposition: "issued",
  });
});
test("pending inviter loss, revocation, expiry and inactive workspace prevent target provisioning", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    j = await join(f, "inviter@example.test", "Admin");
  const state = await j.signed.query(team.list, { workspaceId: f.workspaceId });
  const issued = await j.signed.mutation(team.change, {
    workspaceId: f.workspaceId,
    expectedRevision: state.revision,
    commandKey: "pending-by-admin",
    action: {
      kind: "invite",
      email: "target@example.test",
      role: "Viewer",
      lifetimeDays: 1,
    },
  });
  if (!issued.invitationId) throw new Error("Expected invitation");
  const target = await person(f.t, "target@example.test");
  const counts = await f.t.run((ctx) => ctx.db.query("users").take(101));
  await change(f, {
    kind: "role",
    membershipId: j.accepted.membershipId,
    role: "Viewer",
  });
  expect(
    await target.query(team.preview, { invitationId: issued.invitationId }),
  ).toBeNull();
  await expect(
    target.mutation(team.accept, {
      invitationId: issued.invitationId,
      expectedRevision: 2,
      commandKey: "blocked-recipient",
    }),
  ).rejects.toThrow("INVITATION_UNAVAILABLE");
  expect(await f.t.run((ctx) => ctx.db.query("users").take(101))).toEqual(
    counts,
  );
  for (const kind of ["revoke", "expiry", "workspace"]) {
    const next = await invite(f, `${kind}@example.test`),
      recipient = await person(f.t, `${kind}@example.test`);
    if (kind === "revoke")
      await change(f, { kind: "revoke", invitationId: next.invitationId });
    if (kind === "expiry") vi.advanceTimersByTime(86400001);
    if (kind === "workspace")
      await f.t.run((ctx) =>
        ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
      );
    expect(
      await recipient.query(team.preview, { invitationId: next.invitationId }),
    ).toBeNull();
    await expect(
      recipient.mutation(team.accept, {
        invitationId: next.invitationId,
        expectedRevision: next.revision,
        commandKey: "blocked-recipient",
      }),
    ).rejects.toThrow("INVITATION_UNAVAILABLE");
  }
});
test("accept/revoke race consumes at most once and historical acceptance remains valid after inviter role loss", async () => {
  const f = await fixture(),
    signed = await person(f.t, "race@example.test"),
    issued = await invite(f, "race@example.test");
  const results = await Promise.allSettled([
    signed.mutation(team.accept, {
      invitationId: issued.invitationId,
      expectedRevision: issued.revision,
      commandKey: "race-accept-key",
    }),
    f.owner.mutation(team.change, {
      workspaceId: f.workspaceId,
      expectedRevision: issued.revision,
      commandKey: "race-revoke-key",
      action: { kind: "revoke", invitationId: issued.invitationId },
    }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const j = await join(f, "historic@example.test", "Admin"),
    other = await join(f, "owner2@example.test", "Owner");
  const original = (
    await f.owner.query(team.list, { workspaceId: f.workspaceId })
  ).members.find((m) => m.userId === f.ownerId)!;
  await change(
    f,
    { kind: "role", membershipId: original.membershipId, role: "Viewer" },
    other.signed,
  );
  expect(await j.signed.mutation(team.accept, j.args)).toEqual(j.accepted);
});
test("bounded own recovery filters inactive metadata and repairs genuine missing Viewer preferences", async () => {
  const f = await fixture(),
    j = await join(f, "repair@example.test", "Viewer");
  await j.signed.mutation(api.workspaces.select, {
    workspaceId: f.workspaceId,
  });
  await f.t.run(async (ctx) => {
    const p = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", j.accepted.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.delete(p!._id);
  });
  expect(await j.signed.query(api.users.current, {})).toMatchObject({
    state: "recovery",
    preferences: null,
    repairWorkspaceId: f.workspaceId,
  });
  await j.signed.mutation(api.workspaces.select, {
    workspaceId: f.workspaceId,
  });
  expect(await j.signed.query(api.users.current, {})).toMatchObject({
    state: "ready",
    preferences: { name: "repair", onboardingDone: true },
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, {
      lifecycle: "deleted",
      name: "PRIVATE INACTIVE NAME",
    }),
  );
  const result = await j.signed.query(api.users.current, {});
  expect(JSON.stringify(result)).not.toContain("PRIVATE INACTIVE NAME");
  expect(result).toMatchObject({
    state: "recovery",
    activeWorkspaceId: null,
    preferences: null,
  });
});
test("invitation address and lifetime reject invalid input and preserve plus-address identity", async () => {
  const f = await fixture();
  for (const address of [
    "bad",
    "header@example.test\r\nBcc:evil@example.test",
    "a".repeat(255) + "@example.test",
  ])
    await expect(invite(f, address)).rejects.toThrow(
      "INVALID_INVITATION_EMAIL",
    );
  const state = await f.owner.query(team.list, { workspaceId: f.workspaceId });
  for (const lifetimeDays of [0, 31, 1.5])
    await expect(
      f.owner.mutation(team.change, {
        workspaceId: f.workspaceId,
        expectedRevision: state.revision,
        commandKey: crypto.randomUUID(),
        action: {
          kind: "invite",
          email: "valid@example.test",
          role: "Viewer",
          lifetimeDays,
        },
      }),
    ).rejects.toThrow("INVITATION_LIFETIME_INVALID");
  const issued = await invite(f, " recipient+tag@EXAMPLE.test ");
  expect(
    await (
      await person(f.t, "recipient@example.test")
    ).query(team.preview, { invitationId: issued.invitationId }),
  ).toBeNull();
  expect(
    await (
      await person(f.t, "recipient+tag@example.test")
    ).query(team.preview, { invitationId: issued.invitationId }),
  ).toMatchObject({ workspaceId: f.workspaceId, role: "Viewer" });
});
test("native cap+1 detects own-membership, member and pending overflow without partial grants", async () => {
  const f = await fixture(),
    target = await person(f.t, "cap@example.test"),
    issued = await invite(f, "cap@example.test");
  await f.t.run(async (ctx) => {
    for (let n = 0; n < 100; n++)
      await ctx.db.insert("memberships", {
        userId: f.ownerId,
        workspaceId: await ctx.db.insert("workspaces", {
          name: `Own${n}`,
          description: "",
        }),
        role: "Viewer",
      });
  });
  await expect(f.owner.query(api.users.current, {})).rejects.toThrow(
    "WORKSPACE_LIMIT_REQUIRES_PAGINATION",
  );
  await expect(
    f.owner.mutation(api.workspaces.create, {
      name: "Over cap",
      description: "",
    }),
  ).rejects.toThrow("WORKSPACE_LIMIT");
  await f.t.run(async (ctx) => {
    for (let n = 0; n < 100; n++)
      await ctx.db.insert("memberships", {
        workspaceId: f.workspaceId,
        userId: await ctx.db.insert("users", {
          authId: `native-cap-${n}`,
          defaultWorkspaceId: f.workspaceId,
          activeWorkspaceId: f.workspaceId,
        }),
        role: "Viewer",
      });
  });
  await expect(
    target.mutation(team.accept, {
      invitationId: issued.invitationId,
      expectedRevision: issued.revision,
      commandKey: "cap-accept-key",
    }),
  ).rejects.toThrow("MEMBER_LIMIT_REQUIRES_PAGINATION");
  const actualTarget = await f.t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: "cap@example.test" }],
    }),
  );
  if (!actualTarget) throw new Error("Expected native recipient identity");
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", actualTarget._id))
        .unique(),
    ),
  ).toBeNull();
  const g = await fixture();
  await g.t.run(async (ctx) => {
    for (let n = 0; n < 100; n++)
      await ctx.db.insert("teamInvitations", {
        workspaceId: g.workspaceId,
        createdBy: g.ownerId,
        email: `pending${n}@example.test`,
        role: "Viewer",
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        status: "pending",
      });
  });
  await expect(invite(g, "overflow@example.test")).rejects.toThrow(
    "INVITATION_LIMIT",
  );
  const h = await fixture(),
    j = await join(h, "own-cap@example.test", "Viewer");
  await h.t.run(async (ctx) => {
    for (let n = 0; n < 98; n++)
      await ctx.db.insert("memberships", {
        userId: j.accepted.userId,
        workspaceId: await ctx.db.insert("workspaces", {
          name: `Target own${n}`,
          description: "",
        }),
        role: "Viewer",
      });
  });
  const extra = await h.owner.mutation(api.workspaces.create, {
    name: "New target",
    description: "",
  });
  const invitation = await invite(
    { ...h, workspaceId: extra },
    "own-cap@example.test",
  );
  const before = await h.t.run(async (ctx) => ({
    user: await ctx.db.get(j.accepted.userId),
    members: await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", extra))
      .take(101),
    preferences: await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", j.accepted.userId).eq("workspaceId", extra),
      )
      .unique(),
  }));
  await expect(
    j.signed.mutation(team.accept, {
      invitationId: invitation.invitationId,
      expectedRevision: invitation.revision,
      commandKey: "own-cap-accept-key",
    }),
  ).rejects.toThrow("WORKSPACE_LIMIT");
  expect(
    await h.t.run(async (ctx) => ({
      user: await ctx.db.get(j.accepted.userId),
      members: await ctx.db
        .query("memberships")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", extra))
        .take(101),
      preferences: await ctx.db
        .query("preferences")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", j.accepted.userId).eq("workspaceId", extra),
        )
        .unique(),
    })),
  ).toEqual(before);
});
test("indexed actor cleanup drains beyond an eligible first page and cleared commands cannot replay", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    j = await join(f, "cleanup@example.test", "Admin");
  const eligible = await f.t.run(async (ctx) => {
    const user = (await ctx.db.get(j.accepted.userId))!;
    const ids = [];
    for (let n = 0; n < 55; n++)
      ids.push(
        await ctx.db.insert("teamInvitations", {
          workspaceId: user.defaultWorkspaceId,
          createdBy: user._id,
          email: `eligible${n}@example.test`,
          role: "Viewer",
          createdAt: Date.now(),
          expiresAt: Date.now() + 86400000,
          status: "pending",
        }),
      );
    return ids;
  });
  const ids = await f.t.run(async (ctx) => {
    const list = [];
    for (let n = 0; n < 55; n++)
      list.push(
        await ctx.db.insert("teamInvitations", {
          workspaceId: f.workspaceId,
          createdBy: j.accepted.userId,
          email: `cleanup${n}@example.test`,
          role: "Viewer",
          createdAt: Date.now(),
          expiresAt: Date.now() + 86400000,
          status: "pending",
        }),
      );
    return list;
  });
  await change(f, { kind: "remove", membershipId: j.accepted.membershipId });
  await f.t.mutation(internal.team.purgeActor, { actorId: j.accepted.userId });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const rows = await f.t.run((ctx) =>
    Promise.all(ids.map((id) => ctx.db.get(id))),
  );
  expect(
    rows.every(
      (i) => i?.status === "unavailable" && !i.email && !i.createdBy && !i.role,
    ),
  ).toBe(true);
  for (const id of eligible)
    expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
      status: "pending",
      createdBy: j.accepted.userId,
      role: "Viewer",
    });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("teamCommands")
        .withIndex("by_actorId_and_sourceUnavailable", (q) =>
          q.eq("actorId", j.accepted.userId).eq("sourceUnavailable", false),
        )
        .take(1),
    ),
  ).toEqual([]);
  // A legitimate new grant is allowed, but cannot recover physically consumed command authority.
  const issued = await invite(f, "cleanup@example.test", "Admin"),
    preview = await j.signed.query(team.preview, {
      invitationId: issued.invitationId,
    });
  if (!preview) throw new Error("Expected regrant preview");
  await j.signed.mutation(team.accept, {
    invitationId: issued.invitationId,
    expectedRevision: preview.revision,
    commandKey: "legitimate-regrant",
  });
  await expect(j.signed.mutation(team.accept, j.args)).rejects.toThrow(
    "TEAM_COMMAND_UNAVAILABLE",
  );
});
test("public joined actor removal denies actual Agent fund/tool/commit while original late settlement remains once-only", async () => {
  const { modelFixture } = await import("./model-fixture");
  const f = await modelFixture(),
    teamFixture = {
      t: f.t,
      owner: f.signed,
      ownerId: f.userId,
      workspaceId: f.workspaceId,
    };
  const j = await join(teamFixture, "agent-joined@example.test", "Editor");
  const runId = await f.t.mutation(internal.ai.runs.create, {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    actorId: j.accepted.userId,
    purpose: "draft",
    prompt: "Synthetic joined-user run",
    promptVersion: "fixture-v1",
    sources: [],
  });
  const active = { runId, generation: 1, executionKey: "joined-agent" };
  await f.t.mutation(internal.ai.runs.claim, {
    runId,
    executionKey: active.executionKey,
  });
  const attemptId = await f.t.mutation(internal.ai.runs.fund, {
    ...active,
    key: "before-loss",
  });
  const attempt = (await f.t.run((ctx) => ctx.db.get(attemptId)))!;
  expect(attempt.heldMicros).toBeGreaterThan(0);
  await change(teamFixture, {
    kind: "remove",
    membershipId: j.accepted.membershipId,
  });
  await expect(
    f.t.mutation(internal.ai.runs.fund, { ...active, key: "after-loss" }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  await expect(
    f.t.mutation(internal.ai.runs.toolContext, active),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  await f.t.mutation(internal.ai.runs.finish, { ...active, failed: false });
  expect(await f.t.run((ctx) => ctx.db.get(runId))).toMatchObject({
    state: "failed",
  });
  const receipt = {
    attemptId,
    inputTokens: 2,
    outputTokens: 1,
    errorCode: null,
  };
  await f.t.mutation(internal.ai.runs.settle, receipt);
  const budgets = await f.t.run((ctx) =>
    Promise.all(attempt.budgetIds.map((id) => ctx.db.get(id))),
  );
  expect(budgets.every((b) => b?.heldMicros === 0 && b.spentMicros === 3)).toBe(
    true,
  );
  await f.t.mutation(internal.ai.runs.settle, receipt);
  expect(
    await f.t.run((ctx) =>
      Promise.all(attempt.budgetIds.map((id) => ctx.db.get(id))),
    ),
  ).toEqual(budgets);
  expect(await f.t.run((ctx) => ctx.db.get(attemptId))).toMatchObject({
    runId,
  });
});
async function publicationFixture(
  participant: "scheduler" | "approver",
  withMedia = false,
) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T08:00:00Z"));
  vi.stubEnv("R2_MEDIA_BUCKET", "synthetic-eu");
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "fixture");
  const { mediaFixture } = await import("./media-fixture"),
    { seal } = await import("../convex/lib/crypto"),
    { association } = await import("../convex/integrations/x/fields"),
    { localInput } = await import("../src/lib/time");
  const f = await mediaFixture(),
    teamFixture = {
      t: f.t,
      owner: f.signed,
      ownerId: f.userId,
      workspaceId: f.workspaceId,
    },
    j = await join(teamFixture, `${participant}@example.test`, "Admin");
  const accountId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "native-team-publishing",
      name: "Synthetic",
      handle: "synthetic",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: ["image"],
        publish: true,
      },
      xEvidence: {
        connectionSequence: 1,
        scopes: ["media.write", "tweet.write", "users.read", "tweet.read"],
        identityVerifiedAt: Date.now(),
        textScopeEligible: true,
        mediaScopeEligible: true,
        liveWrite: "verified",
      },
    });
    await ctx.db.insert("xCredentials", {
      workspaceId: f.workspaceId,
      accountId: id,
      generation: 1,
      envelope: await seal(
        { accessToken: "synthetic" },
        association(f.workspaceId, id),
      ),
      expiresAt: Date.now() + 86400000,
      scopes: ["media.write", "tweet.write", "users.read", "tweet.read"],
      leaseUntil: 0,
      cleanAfter: Date.now() + 86400000,
    });
    await ctx.db.insert("xBindings", {
      providerIdentity: "native-team-publishing",
      workspaceId: f.workspaceId,
      accountId: id,
      changedAt: Date.now(),
      changedSequence: 1,
    });
    return id;
  });
  const { PNG } = await import("pngjs"),
    { validateBytes } = await import("../convex/media/validation");
  const ready = async () => {
    const bytes = PNG.sync.write({
      width: 1,
      height: 1,
      data: Buffer.from([1, 2, 3, 255]),
    } as import("pngjs").PNG);
    const s = await f.signed.mutation(internal.media.uploads.reserve, {
      workspaceId: f.workspaceId,
      requestId: crypto.randomUUID(),
      name: "Synthetic.png",
      size: bytes.length,
      mime: "image/png",
      alt: "Synthetic",
    });
    const claim = await f.signed.mutation(internal.media.uploads.claim, {
      workspaceId: f.workspaceId,
      sessionId: s._id,
    });
    await f.t.mutation(internal.media.uploads.complete, {
      sessionId: s._id,
      generation: claim.generation,
      metadata: validateBytes(bytes, bytes.length, "image/png"),
    });
    return s;
  };
  const media = withMedia ? [await ready(), await ready()] : [];
  const content = {
    title: "Native joined user",
    text: ["First", "Second"],
    media: media.map((m) => ({
      assetId: m.assetId,
      alt: "Synthetic immutable media",
    })),
    accountId,
    pillar: "",
    strategy: "generic",
  };
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content,
    source: "Manual synthetic",
  });
  const versionId = (await f.t.run((ctx) => ctx.db.get(draftId)))!
    .currentVersionId!;
  const approvalId = await (
    participant === "approver" ? j.signed : f.signed
  ).mutation(api.editorial.approve, {
    workspaceId: f.workspaceId,
    accountId,
    versionId,
  });
  const at = Date.now() + 3600000;
  const scheduleId = await (
    participant === "scheduler" ? j.signed : f.signed
  ).mutation(api.editorial.schedule, {
    workspaceId: f.workspaceId,
    accountId,
    versionId,
    approvalId,
    at,
    timezone: "UTC",
    localTime: localInput(new Date(at).toISOString(), "UTC"),
  });
  vi.setSystemTime(at);
  expect(
    await f.t.mutation(internal.publishing.claim, {
      scheduleId,
      generation: 1,
    }),
  ).not.toBeNull();
  return {
    ...f,
    teamFixture,
    j,
    accountId,
    draftId,
    versionId,
    approvalId,
    scheduleId,
  };
}
for (const participant of ["scheduler", "approver"] as const) {
  test(`public joined ${participant} role loss denies native beforeSend and keeps genuine confirmed late receipt`, async () => {
    const f = await publicationFixture(participant);
    const c = await f.t.mutation(internal.publishing.attempts.claim, {
      scheduleId: f.scheduleId,
      generation: 1,
    });
    if (!c) throw new Error("Native attempt expected");
    const args = {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    };
    expect(
      await f.t.mutation(internal.publishing.attempts.beforeSend, args),
    ).toBe(true);
    await change(f.teamFixture, {
      kind: "role",
      membershipId: f.j.accepted.membershipId,
      role: "Viewer",
    });
    await f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      outcome: "confirmed",
      externalId: "123456789",
      durationMs: 1,
    });
    expect(await f.t.run((ctx) => ctx.db.get(c._id))).toMatchObject({
      stage: "confirmed",
      externalId: "123456789",
    });
    expect(await f.t.run((ctx) => ctx.db.get(f.scheduleId))).toMatchObject({
      externalPosts: [{ externalId: "123456789", attemptId: c._id }],
    });
    expect(
      await f.t.mutation(internal.publishing.attempts.claim, {
        scheduleId: f.scheduleId,
        generation: 1,
      }),
    ).toBeNull();
    // Separate genuine public approval/schedule/claim: role loss before the first native send.
    const g = await publicationFixture(participant);
    const prepared = await g.t.mutation(internal.publishing.attempts.claim, {
      scheduleId: g.scheduleId,
      generation: 1,
    });
    if (!prepared) throw new Error("Prepared attempt expected");
    await change(g.teamFixture, {
      kind: "remove",
      membershipId: g.j.accepted.membershipId,
    });
    await expect(
      g.t.mutation(internal.publishing.attempts.beforeSend, {
        attemptId: prepared._id,
        claimSequence: prepared.claimSequence,
        credentialGeneration: 1,
        mediaIds: [],
      }),
    ).rejects.toThrow(
      participant === "scheduler"
        ? "SCHEDULER_AUTHORITY_CHANGED"
        : "APPROVER_AUTHORITY_CHANGED",
    );
    expect(await g.t.run((ctx) => ctx.db.get(prepared._id))).toMatchObject({
      stage: "preparing",
    });
    expect(
      (await g.t.run((ctx) => ctx.db.get(prepared._id)))!.requestStartedAt,
    ).toBeUndefined();
  });
  test(`public joined ${participant} loss denies EACH real media beforeRequest and preserves original late evidence`, async () => {
    const f = await publicationFixture(participant, true);
    const checkpoints = [];
    for (const mediaPosition of [0, 1]) {
      const c = await f.t.mutation(internal.publishing.media.claim, {
        scheduleId: f.scheduleId,
        generation: 1,
        mediaPosition,
      });
      if (!c) throw new Error("Native media checkpoint expected");
      checkpoints.push(c);
    }
    const c = checkpoints[0];
    expect(
      await f.t.mutation(internal.publishing.media.beforeRequest, {
        checkpointId: c._id,
        claimSequence: c.claimSequence,
        credentialGeneration: 1,
        bytesRead: 70,
        durationMs: 1,
      }),
    ).toBe(true);
    await change(f.teamFixture, {
      kind: "role",
      membershipId: f.j.accepted.membershipId,
      role: "Viewer",
    });
    await f.t.mutation(internal.publishing.media.receipt, {
      checkpointId: c._id,
      claimSequence: c.claimSequence,
      phase: "append",
      mediaId: "synthetic-native-media",
      expiresAt: Date.now() + 600000,
      waitMs: 0,
      bytesRead: 0,
      durationMs: 1,
      incomplete: false,
    });
    expect(await f.t.run((ctx) => ctx.db.get(c._id))).toMatchObject({
      phase: "blocked",
      mediaId: "synthetic-native-media",
      providerRequests: 1,
    });
    const second = checkpoints[1];
    await expect(
      f.t.mutation(internal.publishing.media.beforeRequest, {
        checkpointId: second._id,
        claimSequence: second.claimSequence,
        credentialGeneration: 1,
        bytesRead: 70,
        durationMs: 1,
      }),
    ).rejects.toThrow(
      participant === "scheduler"
        ? "SCHEDULER_AUTHORITY_CHANGED"
        : "APPROVER_AUTHORITY_CHANGED",
    );
    expect(await f.t.run((ctx) => ctx.db.get(second._id))).toMatchObject({
      operation: "read",
      providerRequests: 0,
    });
    expect(await f.t.run((ctx) => ctx.db.get(f.approvalId))).not.toBeNull();
    expect(await f.t.run((ctx) => ctx.db.get(f.versionId))).not.toBeNull();
  });
}
for (const participant of ["creator", "reviewer"] as const) {
  test(`public joined experiment ${participant} keeps original membership pin across actual removal and valid new grant`, async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T08:00:00Z"));
    const { mediaFixture } = await import("./media-fixture");
    const f = await mediaFixture(),
      teamFixture = {
        t: f.t,
        owner: f.signed,
        ownerId: f.userId,
        workspaceId: f.workspaceId,
      };
    const j = await join(
      teamFixture,
      `${participant}-experiment@example.test`,
      participant === "creator" ? "Admin" : "Editor",
    );
    const accountId = await f.t.run((ctx) =>
      ctx.db.insert("socialAccounts", {
        workspaceId: f.workspaceId,
        provider: "X",
        providerIdentity: "experiment",
        name: "Synthetic",
        handle: "synthetic",
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
    const versions = [];
    for (let n = 0; n < 2; n++) {
      const draftId = await f.signed.mutation(api.editorial.create, {
        workspaceId: f.workspaceId,
        content: {
          title: `Unit${n}`,
          text: [`Unit${n}`],
          media: [],
          accountId,
          pillar: "",
          strategy: "manual",
        },
        source: "Manual synthetic",
      });
      versions.push(
        (await f.t.run((ctx) => ctx.db.get(draftId)))!.currentVersionId!,
      );
    }
    const spec = {
      hypothesis: "Synthetic prospective editorial",
      dimension: "hook" as const,
      a: "A",
      b: "B",
      outcome: "editorial-decision-v1" as const,
      startsAt: Date.now(),
      endsAt: Date.now() + 3600000,
      sampleCap: 2,
      stopCondition: "End hour",
      context: "Manual synthetic",
      frequency: "One human review",
    };
    const declared = await (
      participant === "creator" ? j.signed : f.signed
    ).mutation(api.performance.experiments.change, {
      workspaceId: f.workspaceId,
      accountId,
      expectedRevision: 0,
      commandKey: "joined-native-experiment",
      action: {
        kind: "declare",
        spec,
        units: versions.map((versionId, n) => ({
          versionId,
          reviewerId: participant === "reviewer" ? j.accepted.userId : f.userId,
          arm: n ? ("B" as const) : ("A" as const),
          planItemId: null,
        })),
      },
    });
    const args = {
      workspaceId: f.workspaceId,
      accountId,
      experimentId: declared.experimentId,
    };
    expect(
      (await f.signed.query(api.performance.experiments.get, args))?.spec,
    ).toEqual(spec);
    await change(teamFixture, {
      kind: "role",
      membershipId: j.accepted.membershipId,
      role: "Viewer",
    });
    expect(
      (await f.signed.query(api.performance.experiments.get, args))?.spec,
    ).toBeNull();
    await change(teamFixture, {
      kind: "role",
      membershipId: j.accepted.membershipId,
      role: participant === "creator" ? "Admin" : "Editor",
    });
    expect(
      (await f.signed.query(api.performance.experiments.get, args))?.spec,
    ).toEqual(spec);
    await change(teamFixture, {
      kind: "remove",
      membershipId: j.accepted.membershipId,
    });
    const issued = await invite(
      teamFixture,
      `${participant}-experiment@example.test`,
      participant === "creator" ? "Admin" : "Editor",
    );
    const preview = await j.signed.query(team.preview, {
      invitationId: issued.invitationId,
    });
    if (!preview) throw new Error("Expected genuine new grant");
    const renewed = await j.signed.mutation(team.accept, {
      invitationId: issued.invitationId,
      expectedRevision: preview.revision,
      commandKey: "new-legitimate-membership",
    });
    expect(renewed.membershipId).not.toBe(j.accepted.membershipId);
    expect(
      (await f.signed.query(api.performance.experiments.get, args))?.spec,
    ).toBeNull();
    await f.t.mutation(internal.performance.experiments.sweep, {
      cursor: null,
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await f.t.run((ctx) => ctx.db.get(declared.experimentId)),
    ).toMatchObject({ sourceUnavailable: true, spec: null });
    for (const id of versions)
      expect(await f.t.run((ctx) => ctx.db.get(id))).not.toBeNull();
  });
}
test("indexed periodic expiry clears beyond a page without recreating consumed invitation/command payload", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    issued = await invite(f, "expiry-cleanup@example.test"),
    recipient = await person(f.t, "expiry-cleanup@example.test");
  const rows: (typeof issued.invitationId)[] = [];
  for (let n = 0; n < 55; n++)
    rows.push((await invite(f, `old-${n}@example.test`)).invitationId);
  vi.advanceTimersByTime(31 * 86400000);
  await f.t.mutation(internal.team.sweep, {
    cursor: null,
    phase: "invitations",
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const cleared = await f.t.run((ctx) =>
    Promise.all([...rows, issued.invitationId].map((id) => ctx.db.get(id))),
  );
  expect(
    cleared.every(
      (i) => i?.status === "expired" && !i.email && !i.role && !i.createdBy,
    ),
  ).toBe(true);
  expect(
    await recipient.query(team.preview, { invitationId: issued.invitationId }),
  ).toBeNull();
  const commands = await f.t.run((ctx) =>
    ctx.db.query("teamCommands").take(101),
  );
  expect(commands).toHaveLength(56);
  expect(
    commands.every(
      (c) =>
        c.sourceUnavailable &&
        !c.result &&
        !c.fingerprint &&
        c.cleanAfter === null,
    ),
  ).toBe(true);
});
test("public joined Research actor loss denies actual cache begin/commit while original late native-search cost settles once", async () => {
  const { fixture: researchFixture } = await import("./research-fixture");
  const f = await researchFixture(["x-recent"]),
    teamFixture = {
      t: f.t,
      owner: f.signed,
      ownerId: f.userId,
      workspaceId: f.workspaceId,
    },
    j = await join(teamFixture, "research-joined@example.test", "Editor");
  const orderId = await j.signed.mutation(api.research.native.start, {
    workspaceId: f.workspaceId,
    profileId: f.profileId,
    expectedRevision: 2,
    operationKey: "joined-research-operation",
    query: "Synthetic product news",
    language: "de",
    operations: ["x-recent"],
  });
  const args = { orderId, generation: 1, operation: "x-recent" as const },
    fill = await f.t.mutation(internal.research.cache.begin, args);
  if (!fill.attemptId) throw new Error("Native admitted attempt expected");
  await change(teamFixture, {
    kind: "remove",
    membershipId: j.accepted.membershipId,
  });
  await expect(
    f.t.mutation(internal.research.cache.begin, args),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  await expect(
    f.t.mutation(internal.research.cache.commit, {
      orderId,
      generation: 1,
      cacheId: fill.cacheId,
      state: "empty",
      reason: null,
      sources: [],
      truncated: false,
    }),
  ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  const receipt = {
    attemptId: fill.attemptId,
    units: 3,
    reportedCost: null,
    costInvalid: false,
    errorCode: null,
  };
  await f.t.mutation(internal.research.cache.settle, receipt);
  await f.t.mutation(internal.research.cache.settle, receipt);
  expect(await f.t.run((ctx) => ctx.db.get(fill.attemptId!))).toMatchObject({
    state: "settled",
    estimatedMicros: 30,
    heldMicros: 0,
  });
  expect(await f.t.run((ctx) => ctx.db.get(fill.cacheId))).toMatchObject({
    state: "unknown",
    sourceIds: [],
  });
});
test("public joined GitHub purpose actor controls real retained source independently from connection owner", async () => {
  const { sourceFixture } = await import("./github-fixture");
  const f = await sourceFixture(),
    teamFixture = {
      t: f.t,
      owner: f.signed,
      ownerId: f.userId,
      workspaceId: f.workspaceId,
    },
    j = await join(teamFixture, "github-joined@example.test", "Admin");
  await j.signed.mutation(api.workspaces.select, {
    workspaceId: f.workspaceId,
  });
  const r = (await f.t.run((ctx) => ctx.db.get(f.repositories[0])))!;
  await j.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: r._id,
    expectedGeneration: r.generation,
    access: true,
    monitoring: true,
    content: true,
    communicableContext: "Explicit synthetic content",
  });
  const current = (await f.t.run((ctx) => ctx.db.get(r._id)))!,
    args = {
      workspaceId: f.workspaceId,
      repositoryId: r._id,
      generation: current.generation,
      purpose: "content" as const,
    };
  expect(
    await f.t.query(internal.integrations.github.repositories.source, args),
  ).toMatchObject({ communicableContext: "Explicit synthetic content" });
  expect(await f.t.run((ctx) => ctx.db.get(r._id))).toMatchObject({
    purposeActorId: j.accepted.userId,
  });
  await change(teamFixture, {
    kind: "role",
    membershipId: j.accepted.membershipId,
    role: "Viewer",
  });
  await expect(
    f.t.query(internal.integrations.github.repositories.source, args),
  ).rejects.toThrow("GITHUB_SOURCE_DISABLED");
  expect(await f.t.run((ctx) => ctx.db.get(f.userId))).not.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(r._id))).not.toBeNull();
  await change(teamFixture, {
    kind: "role",
    membershipId: j.accepted.membershipId,
    role: "Admin",
  });
  expect(
    await f.t.query(internal.integrations.github.repositories.source, args),
  ).toMatchObject({ communicableContext: "Explicit synthetic content" });
  expect(await f.t.run((ctx) => ctx.db.get(r._id))).toMatchObject({
    purposeActorId: j.accepted.userId,
  });
});
test("public joined finite-series actor proves native original membership fingerprint without a global epoch", async () => {
  const { modelFixture } = await import("./model-fixture"),
    { seriesAuthority } = await import("../convex/planning/strategy"),
    { sha256 } = await import("../convex/lib/crypto");
  const f = await modelFixture(),
    teamFixture = {
      t: f.t,
      owner: f.signed,
      ownerId: f.userId,
      workspaceId: f.workspaceId,
    },
    j = await join(teamFixture, "series-joined@example.test", "Editor");
  // Isolated native authority fixture; this does not stand in for full finite-series admission/frame tests.
  const seriesId = await f.t.run(async (ctx) => {
    const user = (await ctx.db.get(j.accepted.userId))!,
      m = (await ctx.db.get(j.accepted.membershipId))!;
    return ctx.db.insert("planningSeries", {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
      revision: 1,
      generation: 1,
      enabled: false,
      versionId: null,
      actorId: user._id,
      membershipId: m._id,
      actorFingerprint: await sha256(
        JSON.stringify([
          user._id,
          user._creationTime,
          user.authId,
          m._id,
          m._creationTime,
        ]),
      ),
      providerIdentity: "synthetic",
      connectionSequence: 0,
      nextAt: null,
      nextIndex: 0,
      remaining: 0,
      nextKey: null,
      scheduledJobId: null,
      reason: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  const proof = () =>
    f.t.run(async (ctx) => seriesAuthority(ctx, (await ctx.db.get(seriesId))!));
  expect((await proof()).membership._id).toBe(j.accepted.membershipId);
  await change(teamFixture, {
    kind: "role",
    membershipId: j.accepted.membershipId,
    role: "Viewer",
  });
  await expect(proof()).rejects.toThrow("ROLE_ACCESS_DENIED");
  await change(teamFixture, {
    kind: "role",
    membershipId: j.accepted.membershipId,
    role: "Editor",
  });
  expect((await proof()).membership._id).toBe(j.accepted.membershipId);
  await change(teamFixture, {
    kind: "remove",
    membershipId: j.accepted.membershipId,
  });
  const issued = await invite(
      teamFixture,
      "series-joined@example.test",
      "Editor",
    ),
    preview = await j.signed.query(team.preview, {
      invitationId: issued.invitationId,
    });
  if (!preview) throw new Error("Expected genuine regrant");
  await j.signed.mutation(team.accept, {
    invitationId: issued.invitationId,
    expectedRevision: preview.revision,
    commandKey: "series-new-membership",
  });
  await expect(proof()).rejects.toThrow("SERIES_AUTHORITY_CHANGED");
});
test("elapsed original invitation expiry hides accepted lookup metadata without renewing its historical command", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    j = await join(f, "accepted-expiry@example.test", "Viewer");
  expect(
    await j.signed.query(team.preview, { invitationId: j.issued.invitationId }),
  ).not.toBeNull();
  vi.advanceTimersByTime(86400001);
  expect(
    await j.signed.query(team.preview, { invitationId: j.issued.invitationId }),
  ).toBeNull();
  await expect(j.signed.mutation(team.accept, j.args)).rejects.toThrow(
    "INVITATION_UNAVAILABLE",
  );
  expect(
    await f.t.run((ctx) => ctx.db.get(j.accepted.membershipId)),
  ).toMatchObject({ role: "Viewer" });
});

test("ordinary periodic command proof crosses eligible first page and scrubs unexpired lost workspace payload", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  for (let n = 0; n < 55; n++)
    await invite(f, `eligible-command-${n}@example.test`);
  const viewer = await join(
    f,
    "eligible-historical-viewer@example.test",
    "Viewer",
  );
  const other = await f.owner.mutation(api.workspaces.create, {
    name: "Lost command root",
    description: "",
  });
  const lostScope = { ...f, workspaceId: other };
  for (let n = 0; n < 55; n++)
    await invite(lostScope, `lost-command-${n}@example.test`);
  const before = await f.t.run((ctx) => ctx.db.query("teamCommands").take(200));
  const eligible = before.filter((c) => c.workspaceId === f.workspaceId);
  const lost = before.filter((c) => c.workspaceId === other);
  expect(eligible).toHaveLength(57);
  expect(lost).toHaveLength(55);
  expect(
    lost.every(
      (c) =>
        c.cleanAfter !== null &&
        c.cleanAfter > Date.now() &&
        c.fingerprint &&
        c.result &&
        !c.sourceUnavailable,
    ),
  ).toBe(true);
  await f.t.run((ctx) => ctx.db.patch(other, { lifecycle: "deleting" }));
  await f.t.mutation(internal.team.sweep, {
    phase: "invitations",
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  for (const c of eligible)
    expect(await f.t.run((ctx) => ctx.db.get(c._id))).toEqual(c);
  for (const c of lost) {
    const current = await f.t.run((ctx) => ctx.db.get(c._id));
    expect(current).toMatchObject({
      sourceUnavailable: true,
      cleanAfter: null,
    });
    expect(current?.fingerprint).toBeUndefined();
    expect(current?.result).toBeUndefined();
  }
  expect(await viewer.signed.mutation(team.accept, viewer.args)).toEqual(
    viewer.accepted,
  );
});
test("periodic operation proof retains eligible Viewer acceptance and scrubs lost admin or missing actor commands", async () => {
  vi.useFakeTimers();
  const f = await fixture(),
    j = await join(f, "periodic-actor@example.test", "Admin");
  const issued = await invite(
    { ...f, owner: j.signed },
    "actor-operation@example.test",
  );
  const before = await f.t.run((ctx) =>
    ctx.db
      .query("teamCommands")
      .withIndex("by_actorId_and_sourceUnavailable", (q) =>
        q.eq("actorId", j.accepted.userId).eq("sourceUnavailable", false),
      )
      .take(101),
  );
  expect(before).toHaveLength(2);
  const accepted = before.find((c) => c.result?.disposition === "joined")!;
  const administration = before.find(
    (c) => c.result?.invitationId === issued.invitationId,
  )!;
  // Inject current authority loss without scheduling actor purge, isolating periodic discovery.
  await f.t.run((ctx) =>
    ctx.db.patch(j.accepted.membershipId, { role: "Viewer" }),
  );
  await f.t.mutation(internal.team.sweep, {
    phase: "invitations",
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.db.get(accepted._id))).toEqual(accepted);
  expect(await j.signed.mutation(team.accept, j.args)).toEqual(j.accepted);
  const cleared = await f.t.run((ctx) => ctx.db.get(administration._id));
  expect(cleared).toMatchObject({ sourceUnavailable: true, cleanAfter: null });
  expect(cleared?.fingerprint).toBeUndefined();
  expect(cleared?.result).toBeUndefined();
  // A dangling membership does not establish an existing native actor.
  await f.t.run((ctx) => ctx.db.delete(j.accepted.userId));
  expect(
    await f.t.run((ctx) => ctx.db.get(j.accepted.membershipId)),
  ).not.toBeNull();
  await f.t.mutation(internal.team.sweep, {
    phase: "invitations",
    cursor: null,
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const missingActor = await f.t.run((ctx) => ctx.db.get(accepted._id));
  expect(missingActor).toMatchObject({
    sourceUnavailable: true,
    cleanAfter: null,
  });
  expect(missingActor?.fingerprint).toBeUndefined();
  expect(missingActor?.result).toBeUndefined();
  expect(
    await f.t.run((ctx) => ctx.db.get(j.issued.invitationId)),
  ).toMatchObject({
    status: "accepted",
    acceptedUserId: j.accepted.userId,
    result: j.accepted,
  });
});
