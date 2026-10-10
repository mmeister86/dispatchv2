import { afterEach, expect, test, vi } from "vitest";
import { mediaFixture } from "../../tests/media-fixture";
import { api, internal, components } from "../_generated/api";
import { requireWorkspace } from "../lib/authorization";
const prepare = internal.operations.deletion.prepareWorkspace;
const status = api.operations.deletion.status;
afterEach(() => vi.unstubAllEnvs());
test("persisted inactive user denies stale workspace proof and bootstrap and current presents inactive", async () => {
  const f = await mediaFixture();
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  await f.t.run((ctx) => ctx.db.patch(f.userId, { lifecycle: "deleting" }));
  await expect(
    f.t.run((ctx) => requireWorkspace(ctx, f.workspaceId, user)),
  ).rejects.toThrow("ACCOUNT_INACTIVE");
  await expect(f.signed.mutation(api.users.bootstrap, {})).rejects.toThrow(
    "ACCOUNT_INACTIVE",
  );
  expect((await f.signed.query(api.users.current, {})).state).toBe("inactive");
});
test("workspace preparation fences once, preserves replay and status outside locked workspace", async () => {
  const f = await mediaFixture();
  const args = {
    workspaceId: f.workspaceId,
    expectedTeamRevision: 0,
    commandKey: "delete_workspace_1",
    confirmation: "delete-workspace" as const,
  };
  const job = await f.signed.mutation(prepare, args);
  expect(job.phase).toBe("fence");
  expect(job.processed).toBe(0);
  expect(await f.signed.mutation(prepare, args)).toEqual(job);
  expect(await f.signed.query(status, { jobId: job.id })).toEqual(job);
  expect((await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.lifecycle).toBe(
    "deleting",
  );
  await expect(
    f.signed.mutation(prepare, { ...args, expectedTeamRevision: 1 }),
  ).rejects.toThrow("DELETION_COMMAND_CONFLICT");
  await expect(f.t.query(status, { jobId: job.id })).rejects.toThrow();
  expect(JSON.stringify(job)).not.toMatch(/authId|commandKey/);
});
const account = internal.operations.deletion.prepareAccount;
const preview = api.operations.deletion.accountPreview;
const workspacePreview = api.operations.deletion.workspacePreview;
test("account deletion requires explicit sole-owned selection and seals immutable scope", async () => {
  const f = await mediaFixture();
  expect((await f.signed.query(preview, {})).workspaces[0].soleOwner).toBe(
    true,
  );
  await expect(
    f.signed.mutation(account, {
      commandKey: "delete_account_1",
      confirmation: "delete-account" as const,
      deleteWorkspaces: [],
    }),
  ).rejects.toThrow("SOLE_OWNER_REQUIRES_SELECTION");
  await expect(
    f.signed.mutation(account, {
      commandKey: "delete_account_1",
      confirmation: "delete-account" as const,
      deleteWorkspaces: [
        { workspaceId: f.workspaceId, expectedTeamRevision: 9 },
      ],
    }),
  ).rejects.toThrow("TEAM_REVISION_CONFLICT");
  const args = {
    commandKey: "delete_account_1",
    confirmation: "delete-account" as const,
    deleteWorkspaces: [{ workspaceId: f.workspaceId, expectedTeamRevision: 0 }],
  };
  const job = await f.signed.mutation(account, args);
  expect(await f.signed.mutation(account, args)).toEqual(job);
  expect((await f.signed.query(api.users.current, {})).state).toBe("inactive");
  expect(await f.signed.query(status, { jobId: job.id })).toEqual(job);
  const raw = (await f.t.run((ctx) => ctx.db.get(job.id)))!;
  expect(raw.retentionUntil - raw.createdAt).toBe(30 * 86400000);
  await expect(
    f.signed.mutation(account, { ...args, deleteWorkspaces: [] }),
  ).rejects.toThrow("DELETION_COMMAND_CONFLICT");
});
test("only active persisted alternate owners permit preservation; shared workspace cannot be selected", async () => {
  const f = await mediaFixture();
  const other = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      authId: "other",
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    });
    await ctx.db.insert("memberships", {
      userId: id,
      workspaceId: f.workspaceId,
      role: "Owner",
    });
    return id;
  });
  const a = {
    commandKey: "delete_account_2",
    confirmation: "delete-account" as const,
    deleteWorkspaces: [{ workspaceId: f.workspaceId, expectedTeamRevision: 0 }],
  };
  await expect(f.signed.mutation(account, a)).rejects.toThrow(
    "DELETION_SELECTION_INVALID",
  );
  await f.t.run((ctx) => ctx.db.patch(other, { lifecycle: "deleting" }));
  expect((await f.signed.query(preview, {})).workspaces[0].soleOwner).toBe(
    true,
  );
  await expect(
    f.signed.mutation(account, { ...a, deleteWorkspaces: [] }),
  ).rejects.toThrow("SOLE_OWNER_REQUIRES_SELECTION");
  await f.t.run((ctx) => ctx.db.patch(other, { lifecycle: "active" }));
  await f.signed.mutation(account, { ...a, deleteWorkspaces: [] });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.lifecycle,
  ).toBeUndefined();
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.workspaceId)))!.teamRevision,
  ).toBe(1);
});
test("workspace preview rejects every non-owner and account discovery fails over 100", async () => {
  const f = await mediaFixture();
  for (const role of ["Admin", "Editor", "Viewer"] as const) {
    await f.t.run(async (ctx) => {
      const m = (await ctx.db.query("memberships").first())!;
      await ctx.db.patch(m._id, { role });
    });
    await expect(
      f.signed.query(workspacePreview, { workspaceId: f.workspaceId }),
    ).rejects.toThrow("ROLE_ACCESS_DENIED");
  }
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 100; i++) {
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "extra",
        description: "",
      });
      await ctx.db.insert("memberships", {
        workspaceId,
        userId: f.userId,
        role: "Viewer",
      });
    }
  });
  await expect(f.signed.query(preview, {})).rejects.toThrow(
    "WORKSPACE_LIMIT_REQUIRES_PAGINATION",
  );
});
async function recipient(f: Awaited<ReturnType<typeof mediaFixture>>) {
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Recipient",
          email: "recipient@example.test",
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
  return { identity, signed: f.t.withIdentity(identity) };
}
test("accepted invitation replay cannot revive an inactive recipient", async () => {
  const f = await mediaFixture(),
    r = await recipient(f);
  const issued = await f.signed.mutation(api.team.change, {
    workspaceId: f.workspaceId,
    commandKey: "invite_recipient_1",
    expectedRevision: 0,
    action: {
      kind: "invite",
      email: "recipient@example.test",
      role: "Viewer",
      lifetimeDays: 1,
    },
  });
  const invitationId = issued.invitationId!;
  const visible = (await r.signed.query(api.team.preview, { invitationId }))!;
  const args = {
    invitationId,
    expectedRevision: visible.revision,
    commandKey: "accept_recipient_1",
  };
  const accepted = await r.signed.mutation(api.team.accept, args);
  await f.t.run((ctx) =>
    ctx.db.patch(accepted.userId!, { lifecycle: "deleting" }),
  );
  expect(await r.signed.query(api.team.preview, { invitationId })).toBeNull();
  await expect(r.signed.mutation(api.team.accept, args)).rejects.toThrow(
    "INVITATION_UNAVAILABLE",
  );
});
test("concurrent co-owner account fences leave one active owner and foreign status stays private", async () => {
  const f = await mediaFixture(),
    r = await recipient(f);
  const other = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      authId: r.identity.subject,
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    });
    await ctx.db.insert("memberships", {
      userId: id,
      workspaceId: f.workspaceId,
      role: "Owner",
    });
    return id;
  });
  const results = await Promise.allSettled([
    f.signed.mutation(account, {
      commandKey: "delete_co_owner_1",
      confirmation: "delete-account" as const,
      deleteWorkspaces: [],
    }),
    r.signed.mutation(account, {
      commandKey: "delete_co_owner_2",
      confirmation: "delete-account" as const,
      deleteWorkspaces: [],
    }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const users = await f.t.run(async (ctx) => [
    await ctx.db.get(f.userId),
    await ctx.db.get(other),
  ]);
  expect(users.filter((u) => !u!.lifecycle)).toHaveLength(1);
  const job = (
    results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>
  ).value;
  const foreign = users[0]!.lifecycle ? r.signed : f.signed;
  await expect(foreign.query(status, { jobId: job.id })).rejects.toThrow(
    "DELETION_ACCESS_DENIED",
  );
  const active = users.find((u) => !u!.lifecycle)!;
  expect(
    (await f.t.run((ctx) => requireWorkspace(ctx, f.workspaceId, active))).user
      ._id,
  ).toBe(active._id);
});
test("team leave and transfer cannot rely on an inactive co-owner", async () => {
  const f = await mediaFixture();
  const target = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      authId: "inactive-owner",
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
      lifecycle: "deleting",
    });
    return ctx.db.insert("memberships", {
      userId: id,
      workspaceId: f.workspaceId,
      role: "Owner",
    });
  });
  await expect(
    f.signed.mutation(api.team.change, {
      workspaceId: f.workspaceId,
      commandKey: "team_leave_inactive",
      expectedRevision: 0,
      action: { kind: "leave" },
    }),
  ).rejects.toThrow("LAST_OWNER_REQUIRED");
  await expect(
    f.signed.mutation(api.team.change, {
      workspaceId: f.workspaceId,
      commandKey: "team_transfer_inactive",
      expectedRevision: 0,
      action: { kind: "transfer", membershipId: target },
    }),
  ).rejects.toThrow("ACCOUNT_INACTIVE");
});
test("sealed status keeps only original verified native session access after Auth fence; content and bootstrap remain denied", async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-deletion-guard-secret");
  const f = await mediaFixture();
  await f.t.mutation(internal.operations.authAdmission.initialize, {});
  const job = await f.signed.mutation(account, {
    commandKey: "auth-last-status",
    confirmation: "delete-account",
    deleteWorkspaces: [{ workspaceId: f.workspaceId, expectedTeamRevision: 0 }],
  });
  await f.t.mutation(internal.operations.authAdmission.fencePreparedAccount, {
    jobId: job.id,
  });
  expect(await f.signed.query(status, { jobId: job.id })).toEqual(job);
  await expect(f.signed.mutation(api.users.bootstrap, {})).rejects.toThrow(
    "AUTH_IDENTITY_INACTIVE",
  );
  await expect(f.signed.query(api.users.current, {})).rejects.toThrow(
    "AUTH_IDENTITY_INACTIVE",
  );
  const original = await f.t.run((ctx) => ctx.db.get(f.userId));
  const foreign = await f.t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name: "Foreign",
        email: "foreign-status@example.test",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  });
  await f.t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "account",
      data: {
        userId: foreign._id,
        accountId: foreign._id,
        providerId: "credential",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  });
  const session = await f.t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: foreign._id,
        token: "synthetic-foreign-session",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 60000,
      },
    },
  });
  await expect(
    f.t
      .withIdentity({ subject: foreign._id, sessionId: session._id })
      .query(status, { jobId: job.id }),
  ).rejects.toThrow("DELETION_ACCESS_DENIED");
  await expect(
    f.t
      .withIdentity({ subject: original!.authId, sessionId: session._id })
      .query(status, { jobId: job.id }),
  ).rejects.toThrow("DELETION_ACCESS_DENIED");
  const nativeSessions = await f.t.query(
    components.betterAuth.adapter.findMany,
    {
      model: "session",
      where: [{ field: "userId", value: original!.authId }],
      paginationOpts: { numItems: 25, cursor: null },
    },
  );
  await f.t.mutation(components.betterAuth.adapter.deleteOne, {
    input: {
      model: "session",
      where: [{ field: "_id", value: nativeSessions.page[0]._id }],
    },
  });
  await expect(f.signed.query(status, { jobId: job.id })).rejects.toThrow();
});
test("native erasure primitives capture exact token ownership, use bounded reset-cursor pages, and keep Auth root last", async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-native-purge-secret");
  const f = await mediaFixture();
  await f.t.mutation(internal.operations.authAdmission.initialize, {});
  const actor = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const verification = await f.t.mutation(
    components.betterAuth.adapter.create,
    {
      input: {
        model: "verification",
        data: {
          identifier: "reset-password:synthetic-owned-reset",
          value: actor.authId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 60000,
        },
      },
    },
  );
  for (let n = 0; n < 30; n++)
    await f.t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: actor.authId,
          token: `synthetic-purge-${n}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 60000,
        },
      },
    });
  const job = await f.signed.mutation(account, {
    commandKey: "native-purge",
    confirmation: "delete-account",
    deleteWorkspaces: [{ workspaceId: f.workspaceId, expectedTeamRevision: 0 }],
  });
  await f.t.mutation(internal.operations.authAdmission.fencePreparedAccount, {
    jobId: job.id,
  });
  const captured = await f.t.mutation(
    internal.operations.authAdmission.captureVerificationPage,
    { jobId: job.id, cursor: null },
  );
  expect(captured.targetOwned).toBe(1);
  await f.t.run((ctx) => ctx.db.patch(job.id, { phase: "auth" }));
  const purge = (model: "session" | "verification" | "user") =>
    f.t.mutation(internal.operations.authAdmission.purgeNativePage, {
      jobId: job.id,
      model,
    });
  await expect(purge("user")).rejects.toThrow("AUTH_ROOT_LAST_REQUIRED");
  expect((await purge("session")).processed).toBe(25);
  expect((await purge("session")).processed).toBe(6);
  expect((await purge("verification")).processed).toBe(1);
  expect(
    await f.t.query(components.betterAuth.adapter.findOne, {
      model: "verification",
      where: [{ field: "_id", value: verification._id }],
    }),
  ).toBeNull();
  expect(
    (
      await f.t.query(internal.operations.authAdmission.nativeErasureProof, {
        jobId: job.id,
      })
    ).ownedAbsent,
  ).toBe(true);
  expect((await purge("user")).processed).toBe(1);
  const proof = await f.t.query(
    internal.operations.authAdmission.nativeErasureProof,
    { jobId: job.id },
  );
  expect(proof.rootPresent).toBe(false);
  expect(proof.retainedReplayFences).toBe(true);
  expect(proof.unownedVerification).toBe("preserved-not-certified");
});
