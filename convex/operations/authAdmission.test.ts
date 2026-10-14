import { convexTest } from "convex-test";
import betterAuthComponent from "@convex-dev/better-auth/test";
import { expect, test, vi } from "vitest";
import schema from "../schema";
import { components, internal } from "../_generated/api";
vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-test-secret-only");
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).map(
    ([path, load]) => [new URL(path, import.meta.url).pathname, load],
  ),
);
const setup = () => {
  const t = convexTest(schema, modules);
  betterAuthComponent.register(t);
  return t;
};
const userData = (email = "candidate@example.test") => ({
  name: "Candidate",
  email,
  emailVerified: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
test("fixed guard journals native legacy birth and rejects session before account admission", async () => {
  const t = setup();
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData() },
  });
  expect(user).not.toBeNull();
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: user._id,
        token: "legacy",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 60000,
      } as never,
    },
  });
  expect(session).toBeNull();
  const journal = await t.run((ctx) => ctx.db.query("authRoots").unique());
  expect(journal?.authId).toBe(user._id);
  expect(journal?.state).toBe("pending");
});
test("unconfigured admission guard fails closed until initialize binds it", async () => {
  const t = setup();
  await expect(
    t.mutation(components.betterAuth.adapter.create, {
      input: { model: "user", data: userData() },
    }),
  ).rejects.toThrow("AUTH_GUARD_NOT_CONFIGURED");
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData() },
  });
  expect(user).not.toBeNull();
});
const accountData = (
  userId: string,
  providerId = "credential",
  accountId = userId,
) => ({
  userId,
  providerId,
  accountId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  password: "synthetic-hash",
});
const sessionData = (userId: string) => ({
  userId,
  token: crypto.randomUUID(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  expiresAt: Date.now() + 60000,
});
async function addFence(
  t: ReturnType<typeof setup>,
  kind: "authId" | "email" | "provider",
  value: string,
  cooldown = 30 * 86400000,
) {
  const { digest } = await import("./authAdmission");
  await t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Synthetic",
      description: "",
    });
    const userId = await ctx.db.insert("users", {
      authId: "synthetic-actor",
      activeWorkspaceId: workspaceId,
      defaultWorkspaceId: workspaceId,
    });
    const jobId = await ctx.db.insert("deletionJobs", {
      scope: "account",
      actorId: userId,
      userId,
      authId: "synthetic-actor",
      deleteWorkspaces: [],
      commandKey: "synthetic-fence",
      intent: "synthetic",
      state: "blocked",
      phase: "fence",
      processed: 0,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retentionUntil: Date.now() + cooldown,
    });
    await ctx.db.insert("authReplayFences", {
      kind,
      digest: await digest(
        JSON.stringify([kind, value]),
        (await ctx.db.query("authGuardKey").unique())!.key,
      ),
      jobId,
      createdAt: Date.now(),
    });
  });
}
test("fixed config is idempotent and protected from native CRUD; missing configuration closes eligibility", async () => {
  const t = setup();
  expect(
    (await t.query(internal.operations.authAdmission.eligibility, {})).eligible,
  ).toBe(false);
  await t.mutation(internal.operations.authAdmission.initialize, {});
  await t.mutation(internal.operations.authAdmission.initialize, {});
  expect(await t.query(components.betterAuth.guard.health, {})).toEqual({
    configured: true,
    count: 1,
    revision: "dispatch-admission-v1",
  });
  await expect(
    t.mutation(components.betterAuth.guard.configure, {
      create: "arbitrary",
      update: "arbitrary",
      verificationDelete: "arbitrary",
    }),
  ).rejects.toThrow("AUTH_GUARD_ALREADY_BOUND");
  await expect(
    t.query(components.betterAuth.adapter.findOne, {
      model: "admissionGuard" as never,
    }),
  ).rejects.toThrow();
  expect(
    (await t.query(internal.operations.authAdmission.eligibility, {})).reason,
  ).toBe("READY");
});
test("legacy delayed reset cannot create orphan account or session after root removal", async () => {
  const t = setup();
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData() },
  });
  await t.mutation(components.betterAuth.adapter.deleteOne, {
    input: { model: "user", where: [{ field: "_id", value: user._id }] },
  });
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: { model: "account", data: accountData(user._id) },
    }),
  ).toBeNull();
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: { model: "session", data: sessionData(user._id) },
    }),
  ).toBeNull();
});
test("changed-email denied provider commits candidate purge while preserving an admitted foreign root", async () => {
  const t = setup();
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData("changed@example.test") },
  });
  await addFence(t, "provider", JSON.stringify(["github", "target-provider"]));
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: accountData(user._id, "github", "target-provider"),
      },
    }),
  ).toBeNull();
  expect(
    await t.query(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", value: user._id }],
    }),
  ).toBeNull();
  const foreign = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData("foreign@example.test") },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "account", data: accountData(foreign._id) },
  });
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: accountData(foreign._id, "github", "target-provider"),
      },
    }),
  ).toBeNull();
  expect(
    await t.query(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", value: foreign._id }],
    }),
  ).not.toBeNull();
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: { model: "session", data: sessionData(foreign._id) },
    }),
  ).not.toBeNull();
});
test("immutable expired provisional deadline denies late approval and exact empty cleanup", async () => {
  const t = setup();
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData() },
  });
  const original = await t.run(async (ctx) => {
    const journal = (await ctx.db.query("authRoots").unique())!;
    await ctx.db.patch(journal._id, { pendingUntil: Date.now() - 1 });
    return journal;
  });
  expect(original.pendingUntil - original.bornAt).toBe(120000);
  await t.mutation(internal.operations.authAdmission.expirePending, {
    authId: user._id,
  });
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: { model: "account", data: accountData(user._id) },
    }),
  ).toBeNull();
  expect(
    (await t.run((ctx) => ctx.db.query("authRoots").unique()))?.state,
  ).toBe("revoked");
});
test("guard journals original verification provenance after consume without retaining values", async () => {
  const t = setup();
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const data = {
    identifier: "synthetic-late-oauth-state",
    value: "synthetic-sensitive-state",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 60000,
  };
  const row = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "verification", data },
  });
  await t.mutation(components.betterAuth.adapter.deleteOne, {
    input: { model: "verification", where: [{ field: "_id", value: row._id }] },
  });
  const journal = await t.run((ctx) =>
    ctx.db.query("authVerificationJournal").unique(),
  );
  expect(journal).toMatchObject({
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    producer: "unproven",
    consumed: true,
  });
  expect(JSON.stringify(journal)).not.toContain(data.identifier);
  expect(JSON.stringify(journal)).not.toContain(data.value);
});
test("native hook Dates, optional credentials and null fields canonicalize exactly", async () => {
  const { canonicalWrite } = await import("./authAdmission");
  const t = setup();
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData() },
  });
  for (const data of [
    accountData(user._id),
    {
      ...accountData(user._id, "github", "provider"),
      accessToken: "synthetic-token",
      scope: null,
      refreshToken: null,
      accessTokenExpiresAt: 123000,
    },
  ]) {
    const hook = {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
    const inserted = await t.mutation(components.betterAuth.adapter.create, {
      input: { model: "account", data },
    });
    expect(canonicalWrite("account", "create", hook)).toBe(
      canonicalWrite("account", "create", inserted),
    );
    expect(
      canonicalWrite("account", "create", { ...hook, scope: null }),
    ).not.toBe(canonicalWrite("account", "create", { ...hook, scope: "" }));
  }
});
test("configured current native signup verifies JWT and resets exact credential account", async () => {
  vi.stubEnv("SITE_URL", "http://localhost:5173");
  vi.stubEnv("CONVEX_SITE_URL", "https://auth-test.convex.site");
  vi.stubEnv("RESEND_API_KEY", "synthetic-only");
  const emails: { text: string }[] = [];
  const delivery = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (request, options) => {
      if (String(request) !== "https://api.resend.com/emails")
        throw new Error("Unexpected provider transport");
      emails.push(JSON.parse(options!.body as string));
      return new Response("{}", { status: 200 });
    });
  try {
    const t = setup();
    await t.mutation(internal.operations.authAdmission.initialize, {});
    const post = (path: string, body: unknown) =>
      t.fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify(body),
      });
    const email = "current-native@example.test";
    const password = "synthetic-password123";
    const signup = await post("sign-up/email", {
      name: "Current",
      email,
      password,
    });
    expect(signup.status).toBe(200);
    const jwt = new URL(emails[0].text.split("\n\n")[1]);
    const verified = await t.fetch(jwt.pathname + jwt.search);
    expect(verified.status).toBe(302);
    expect((await post("sign-in/email", { email, password })).status).toBe(200);
    expect((await post("request-password-reset", { email })).status).toBe(200);
    const resetUrl = new URL(emails.at(-1)!.text.split("\n\n")[1]);
    const token = resetUrl.pathname.split("/").at(-1);
    expect(
      (
        await post("reset-password", {
          token,
          newPassword: "replacement-password123",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post("sign-in/email", {
          email,
          password: "replacement-password123",
        })
      ).status,
    ).toBe(200);
    const permits = await t.run((ctx) =>
      ctx.db.query("authWritePermits").collect(),
    );
    expect(permits.length).toBeGreaterThan(0);
    expect(permits.every((permit) => permit.consumed)).toBe(true);
    expect(JSON.stringify(permits)).not.toContain(password);
  } finally {
    delivery.mockRestore();
  }
});
test("actual legacy HS256 JWT cannot verify a fresh native generation while newly issued JWT can", async () => {
  const { createEmailVerificationToken } = await import("better-auth/api");
  vi.stubEnv("SITE_URL", "http://localhost:5173");
  vi.stubEnv("CONVEX_SITE_URL", "https://auth-test.convex.site");
  vi.stubEnv("RESEND_API_KEY", "synthetic-only");
  const emails: { text: string }[] = [];
  const delivery = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_, options) => {
      emails.push(JSON.parse(options!.body as string));
      return new Response("{}", { status: 200 });
    });
  try {
    const t = setup();
    const email = "reregister@example.test";
    await t.mutation(internal.operations.authAdmission.initialize, {});
    const old = await t.mutation(components.betterAuth.adapter.create, {
      input: { model: "user", data: userData(email) },
    });
    const oldJwt = await createEmailVerificationToken(
      process.env.BETTER_AUTH_SECRET!,
      email,
      undefined,
      60 * 86400,
    );
    await t.mutation(internal.operations.authAdmission.initialize, {});
    await addFence(t, "email", email, -60000);
    await addFence(t, "authId", old._id, -60000);
    await t.mutation(components.betterAuth.adapter.deleteOne, {
      input: { model: "user", where: [{ field: "_id", value: old._id }] },
    });
    const response = await t.fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        name: "Fresh",
        email,
        password: "fresh-password123",
      }),
    });
    expect(response.status).toBe(200);
    const fresh = (await response.json()).user;
    expect(fresh.id).not.toBe(old._id);
    const rejected = await t.fetch(
      `/api/auth/verify-email?token=${encodeURIComponent(oldJwt)}`,
    );
    expect(rejected.status).toBe(401);
    const nativeFresh = () =>
      t.query(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: fresh.id }],
      });
    expect((await nativeFresh()).emailVerified).toBe(false);
    const newJwt = new URL(emails.at(-1)!.text.split("\n\n")[1]);
    expect((await t.fetch(newJwt.pathname + newJwt.search)).status).toBe(302);
    expect((await nativeFresh()).emailVerified).toBe(true);
    expect(
      await t.mutation(components.betterAuth.adapter.create, {
        input: { model: "session", data: sessionData(fresh.id) },
      }),
    ).toBeNull();
  } finally {
    delivery.mockRestore();
  }
});
test("native validated GitHub callback with current state admits changed email; old paused callback cannot borrow fresh approval", async () => {
  vi.stubEnv("SITE_URL", "http://localhost:5173");
  vi.stubEnv("CONVEX_SITE_URL", "https://auth-test.convex.site");
  vi.stubEnv("GITHUB_CLIENT_ID", "synthetic-client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "synthetic-secret");
  let releaseOld!: () => void;
  const paused = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  let enteredOld!: () => void;
  const entered = new Promise<void>((resolve) => {
    enteredOld = resolve;
  });
  const transport = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (request, options) => {
      const url = request instanceof Request ? request.url : String(request);
      const response = (value: unknown) =>
        new Response(JSON.stringify(value), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      if (url.startsWith("https://github.com/login/oauth/access_token")) {
        const body = String(options?.body ?? "");
        if (body.includes("old-code")) {
          enteredOld();
          await paused;
        }
        return response({
          access_token: body.includes("old-code")
            ? "old-synthetic-access"
            : "new-synthetic-access",
          token_type: "bearer",
          scope: "read:user user:email",
        });
      }
      if (url.startsWith("https://api.github.com/user/emails"))
        return response([
          {
            email: "changed-native@example.test",
            primary: true,
            verified: true,
          },
        ]);
      if (url.startsWith("https://api.github.com/user"))
        return response({
          id: 77,
          login: "synthetic",
          name: "Native profile",
          email: "changed-native@example.test",
          avatar_url: null,
        });
      throw new Error("Unexpected native provider transport");
    });
  try {
    const t = setup();
    const start = async () => {
      const response = await t.fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          provider: "github",
          callbackURL: "http://localhost:5173/",
        }),
      });
      expect(response.status).toBe(200);
      const state = new URL((await response.json()).url).searchParams.get(
        "state",
      )!;
      const cookie = response.headers
        .get("set-cookie")!
        .split(/,(?=\s*[^ ;]+=)/)
        .map((part) => part.trim().split(";")[0])
        .join("; ");
      return { state, cookie };
    };
    await t.mutation(internal.operations.authAdmission.initialize, {});
    const oldState = await start();
    await addFence(t, "provider", JSON.stringify(["github", "77"]), -60000);
    const callback = (proof: Awaited<ReturnType<typeof start>>, code: string) =>
      t.fetch(
        `/api/auth/callback/github?state=${encodeURIComponent(proof.state)}&code=${code}`,
        {
          headers: {
            "better-auth-cookie": proof.cookie,
            Origin: "http://localhost:5173",
          },
        },
      );
    const oldRequest = callback(oldState, "old-code");
    await entered;
    const fresh = await callback(await start(), "current-code");

    expect(fresh.status).toBe(302);
    // Simulate staleness under initialize-first: the old state's
    // verification was journaled under the guard, so its paused callback
    // lease is still proven. Revoke that suspended lease before resuming it,
    // so the stale callback cannot borrow the fresh approval (previously an
    // unproven pre-guard producer provided the staleness).
    const revoked = await t.run(async (ctx) => {
      const leases = await ctx.db.query("authLeases").collect();
      const stale = leases.filter(
        (lease) =>
          lease.path === "/callback/github" && lease.state === "active",
      );
      for (const lease of stale)
        await ctx.db.patch(lease._id, { state: "revoked" });
      return stale.length;
    });
    expect(revoked).toBe(1);
    const roots = await t.run((ctx) => ctx.db.query("authRoots").collect());
    const admitted = roots.filter((row) => row.state === "admitted");
    expect(admitted).toHaveLength(1);
    expect(admitted[0].requiresProof).toBe(true);
    releaseOld();
    const old = await oldRequest;
    expect([302, 401]).toContain(old.status);
    if (old.status === 302)
      expect(
        new URL(old.headers.get("location")!).searchParams.get("error"),
      ).toBeTruthy();
    const accounts = await t.query(components.betterAuth.adapter.findMany, {
      model: "account",
      where: [{ field: "userId", value: admitted[0].authId }],
      paginationOpts: { numItems: 25, cursor: null },
    });
    expect(accounts.page).toHaveLength(1);
    expect(accounts.page[0].accessToken).toBe("new-synthetic-access");
    const sessions = await t.query(components.betterAuth.adapter.findMany, {
      model: "session",
      where: [{ field: "userId", value: admitted[0].authId }],
      paginationOpts: { numItems: 25, cursor: null },
    });
    expect(sessions.page).toHaveLength(1);
  } finally {
    releaseOld();
    transport.mockRestore();
    vi.unstubAllEnvs();
    vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-test-secret-only");
  }
});
test("late legacy producer cannot create current state proof and exact session nonce cannot authorize a different generated token", async () => {
  const { digest, canonicalWrite } = await import("./authAdmission");
  const t = setup();
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const key = await t.query(internal.operations.authAdmission.admissionKey, {});
  const state = "synthetic-late-producer";
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "verification",
      data: {
        identifier: state,
        value: JSON.stringify({
          oauthState: state,
          codeVerifier: "synthetic",
          expiresAt: Date.now() + 60000,
        }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 60000,
      },
    },
  });
  const old = await t.mutation(internal.operations.authAdmission.beginLease, {
    path: "/callback/github",
    source: "state",
    sourceDigest: await digest(state, key),
  });
  expect(old.proven).toBe(false);
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData("precise@example.test") },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "account", data: accountData(user._id) },
  });
  await addFence(t, "email", "precise@example.test", -60000);
  const lease = await t.mutation(internal.operations.authAdmission.beginLease, {
    path: "/sign-in/email",
    source: "current",
  });
  const data = sessionData(user._id);
  const nonce = crypto.randomUUID();
  await t.mutation(internal.operations.authAdmission.issuePermit, {
    leaseId: lease.id,
    nonce,
    model: "session",
    operation: "create",
    authId: user._id,
    operationDigest: await digest(
      canonicalWrite("session", "create", data),
      key,
    ),
  });
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: { ...data, token: "different-generated-token" },
      },
      approvalNonce: nonce,
    }),
  ).toBeNull();
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: { model: "session", data },
      approvalNonce: nonce,
    }),
  ).not.toBeNull();
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: { ...data, token: "replayed-nonce-token" },
      },
      approvalNonce: nonce,
    }),
  ).toBeNull();
});
test("compiled component runtime matches fixed native source guard and refuses singleton CRUD", async () => {
  const { default: distSchema } =
    await import("../../node_modules/@convex-dev/better-auth/dist/component/schema.js");
  const distModules = Object.fromEntries(
    Object.entries(
      import.meta.glob(
        "../../node_modules/@convex-dev/better-auth/dist/component/**/*.js",
      ),
    ).map(([path, load]) => [new URL(path, import.meta.url).pathname, load]),
  );
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", distSchema, distModules);
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data: userData("compiled@example.test") },
  });
  expect(
    await t.mutation(components.betterAuth.adapter.create, {
      input: { model: "session", data: sessionData(user._id) },
    }),
  ).toBeNull();
  await expect(
    t.query(components.betterAuth.adapter.findOne, {
      model: "admissionGuard" as never,
    }),
  ).rejects.toThrow();
  expect(await t.query(components.betterAuth.guard.health, {})).toEqual({
    count: 1,
    configured: true,
    revision: "dispatch-admission-v1",
  });
});

test("second deletion refreshes email cooldown", async () => {
  const { digest, canonicalWrite } = await import("./authAdmission");
  const t = setup();
  await t.mutation(internal.operations.authAdmission.initialize, {});
  const email = "repeat@example.test";
  let previousJobId: string;
  const old = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name: "Current",
        email,
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "account",
      data: {
        userId: old._id,
        providerId: "credential",
        accountId: old._id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  });
  const key = await t.query(internal.operations.authAdmission.admissionKey, {});
  const jobId = await t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Test",
      description: "",
    });
    const userId = await ctx.db.insert("users", {
      authId: old._id,
      activeWorkspaceId: workspaceId,
      defaultWorkspaceId: workspaceId,
      lifecycle: "deleting",
    });
    const common = {
      scope: "account" as const,
      actorId: userId,
      userId,
      authId: old._id,
      deleteWorkspaces: [],
      commandKey: "old",
      intent: "test",
      state: "blocked" as const,
      phase: "fence" as const,
      processed: 0,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const oldJob = await ctx.db.insert("deletionJobs", {
      ...common,
      retentionUntil: Date.now() - 60000,
    });
    previousJobId = oldJob;
    for (const [kind, value] of [
      ["email", email],
      ["provider", JSON.stringify(["credential", old._id])],
    ] as const)
      await ctx.db.insert("authReplayFences", {
        kind,
        digest: await digest(JSON.stringify([kind, value]), key),
        jobId: oldJob,
        createdAt: Date.now() - 60000,
      });
    return await ctx.db.insert("deletionJobs", {
      ...common,
      commandKey: "new",
      retentionUntil: Date.now() + 86400000,
    });
  });
  await t.mutation(internal.operations.authAdmission.fencePreparedAccount, {
    jobId,
  });
  const fenced = await t.run((ctx) =>
    ctx.db.query("authReplayFences").collect(),
  );
  expect(
    fenced.filter((f) => f.kind !== "authId").every((f) => f.jobId === jobId),
  ).toBe(true);
  const deadline = await t.run(
    async (ctx) => (await ctx.db.get(jobId))!.retentionUntil,
  );
  await t.mutation(internal.operations.authAdmission.fencePreparedAccount, {
    jobId,
  });
  expect(
    await t.run(async (ctx) => (await ctx.db.get(jobId))!.retentionUntil),
  ).toBe(deadline);
  expect(
    await t.run(
      async (ctx) =>
        (await ctx.db.get(previousJobId as typeof jobId))!.retentionUntil,
    ),
  ).toBeLessThan(Date.now());
  expect(
    await t.run((ctx) => ctx.db.query("authReplayFences").collect()),
  ).toEqual(fenced);
  await t.mutation(components.betterAuth.adapter.deleteMany, {
    input: { model: "account", where: [{ field: "userId", value: old._id }] },
    paginationOpts: { numItems: 25, cursor: null },
  });
  await t.mutation(components.betterAuth.adapter.deleteOne, {
    input: { model: "user", where: [{ field: "_id", value: old._id }] },
  });
  const lease = await t.mutation(internal.operations.authAdmission.beginLease, {
    path: "/sign-up/email",
    source: "current",
  });
  const data = {
    name: "Fresh",
    email,
    emailVerified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const nonce = crypto.randomUUID();
  await t.mutation(internal.operations.authAdmission.issuePermit, {
    leaseId: lease.id,
    nonce,
    model: "user",
    operation: "create",
    operationDigest: await digest(canonicalWrite("user", "create", data), key),
  });
  const result = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: "user", data },
    approvalNonce: nonce,
  });
  if (result) {
    const account = {
      userId: result._id,
      providerId: "credential",
      accountId: result._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      password: "synthetic-hash",
    };
    const an = crypto.randomUUID();
    await t.mutation(internal.operations.authAdmission.issuePermit, {
      leaseId: lease.id,
      nonce: an,
      model: "account",
      operation: "create",
      authId: result._id,
      operationDigest: await digest(
        canonicalWrite("account", "create", account),
        key,
      ),
    });
    expect(
      await t.mutation(components.betterAuth.adapter.create, {
        input: { model: "account", data: account },
        approvalNonce: an,
      }),
    ).not.toBeNull();
    const session = {
      userId: result._id,
      token: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60000,
    };
    const sn = crypto.randomUUID();
    await t.mutation(internal.operations.authAdmission.issuePermit, {
      leaseId: lease.id,
      nonce: sn,
      model: "session",
      operation: "create",
      authId: result._id,
      operationDigest: await digest(
        canonicalWrite("session", "create", session),
        key,
      ),
    });
    expect(
      await t.mutation(components.betterAuth.adapter.create, {
        input: { model: "session", data: session },
        approvalNonce: sn,
      }),
    ).not.toBeNull();
  }
  expect(result).toBeNull();
});
