import { afterEach, expect, test, vi } from "vitest";
import { api, internal, components } from "../../_generated/api";
import { mediaFixture } from "../../../tests/media-fixture";
import { base64, keyring, open, seal, sha256 } from "../../lib/crypto";
import { identity, tokens, request, configuration } from "./client";
import { association } from "./fields";

const scopes = "tweet.read users.read tweet.write offline.access media.write";
function config() {
  vi.stubEnv("SITE_URL", "https://dispatch.example");
  vi.stubEnv("X_CLIENT_ID", "fixture-client");
  vi.stubEnv("X_CLIENT_SECRET", "fixture-secret");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "key-one");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", base64(new Uint8Array(32).fill(1)));
  vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEY_ID", "");
  vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEY", "");
}
function provider(
  user = "100",
  access = "fixture-access",
  refresh = "fixture-refresh",
) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, options) => {
      expect(options?.redirect).toBe("error");
      if (String(url).endsWith("/token"))
        return Response.json({
          access_token: access,
          refresh_token: refresh,
          token_type: "bearer",
          expires_in: 7200,
          scope: scopes,
        });
      expect(String(url)).toBe("https://api.x.com/2/users/me");
      return Response.json({
        data: { id: user, name: "Fixture Owner", username: "fixture" },
      });
    });
}
async function start(
  f: Awaited<ReturnType<typeof mediaFixture>>,
  accountId?: import("../../_generated/dataModel").Id<"socialAccounts">,
) {
  const url = new URL(
    await f.signed.action(api.integrations.x.client.start, {
      workspaceId: f.workspaceId,
      accountId,
    }),
  );
  expect(url.origin).toBe("https://x.com");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  return {
    workspaceId: f.workspaceId,
    state: url.searchParams.get("state")!,
    code: "fixture-code",
    denied: false,
  };
}
async function connect(f: Awaited<ReturnType<typeof mediaFixture>>) {
  provider();
  return f.signed.action(api.integrations.x.client.callback, await start(f));
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("S256 PKCE, encrypted storage, public evidence, one-use state and immediate disconnect", async () => {
  config();
  const f = await mediaFixture();
  provider();
  const args = await start(f);
  const pending = await f.t.run((ctx) => ctx.db.query("xOAuthStates").first());
  expect(JSON.stringify(pending)).not.toContain("fixture-secret");
  const verifier = await open<string>(
    pending!.verifier!,
    `x-pkce:${f.workspaceId}:${pending!.digest}`,
  );
  expect(verifier).toHaveLength(43);
  expect(await sha256(args.state)).toBe(pending!.digest);
  const id = await f.signed.action(api.integrations.x.client.callback, args);
  const c = await f.t.run((ctx) => ctx.db.query("xCredentials").first());
  expect(await open(c!.envelope!, association(f.workspaceId, id))).toEqual({
    accessToken: "fixture-access",
    refreshToken: "fixture-refresh",
  });
  const resources = await f.signed.query(api.editorial.resources, {
    workspaceId: f.workspaceId,
  });
  expect(resources.accounts[0].connection).toBe("connected");
  expect(resources.accounts[0].capability.publish).toBe(false);
  expect(resources.accounts[0].xEvidence).toMatchObject({
    textScopeEligible: true,
    mediaScopeEligible: true,
    liveWrite: "unverified",
  });
  for (const secret of [
    "fixture-access",
    "fixture-refresh",
    "ciphertext",
    "verifier",
    "digest",
  ])
    expect(JSON.stringify(resources)).not.toContain(secret);
  await expect(
    f.signed.action(api.integrations.x.client.callback, args),
  ).rejects.toThrow("X_OAUTH_STATE_INVALID");
  await f.signed.mutation(api.integrations.x.oauth.disconnect, {
    workspaceId: f.workspaceId,
    accountId: id,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.query("xCredentials").first()))!.envelope,
  ).toBeUndefined();
  expect(
    (
      await f.signed.query(api.editorial.resources, {
        workspaceId: f.workspaceId,
      })
    ).accounts[0].xEvidence?.remoteRevocation,
  ).toBe("not_attempted");
});

test("wrong workspace/current selection, initiator, role and lifecycle cannot consume valid state", async () => {
  config();
  const f = await mediaFixture(),
    args = await start(f);
  const other = await f.signed.mutation(api.workspaces.create, {
    name: "Other",
    description: "",
  });
  await expect(
    f.signed.action(api.integrations.x.client.callback, args),
  ).rejects.toThrow("X_WORKSPACE_CHANGED");
  await expect(
    f.signed.action(api.integrations.x.client.callback, {
      ...args,
      workspaceId: other,
    }),
  ).rejects.toThrow("X_OAUTH_STATE_INVALID");
  await f.signed.mutation(api.workspaces.select, {
    workspaceId: f.workspaceId,
  });
  const state = await f.t.run((ctx) => ctx.db.query("xOAuthStates").first());
  const otherUserId = await f.t.run((ctx) =>
    ctx.db.insert("users", {
      authId: "other-initiator",
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    }),
  );
  await f.t.run((ctx) => ctx.db.patch(state!._id, { userId: otherUserId }));
  await expect(
    f.signed.action(api.integrations.x.client.callback, args),
  ).rejects.toThrow("X_OAUTH_STATE_INVALID");
  await f.t.run(async (ctx) => {
    await ctx.db.patch(state!._id, { userId: f.userId });
    const member = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(member!._id, { role: "Editor" });
  });
  await expect(
    f.signed.action(api.integrations.x.client.callback, args),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(
    f.signed.action(api.integrations.x.client.callback, args),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
  expect((await f.t.run((ctx) => ctx.db.get(state!._id)))!.status).toBe(
    "pending",
  );
});

test("denial, expiry, malformed state and replaced attempts fail without provider exchange", async () => {
  config();
  const f = await mediaFixture(),
    args = await start(f);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Unexpected request"));
  await expect(
    f.signed.action(api.integrations.x.client.callback, {
      ...args,
      state: "wrong",
    }),
  ).rejects.toThrow("X_OAUTH_STATE_INVALID");
  await expect(
    f.signed.action(api.integrations.x.client.callback, {
      ...args,
      denied: true,
    }),
  ).rejects.toThrow("X_OAUTH_DENIED");
  expect(fetch).not.toHaveBeenCalled();
  expect(
    (await f.t.run((ctx) => ctx.db.query("xOAuthStates").first()))!.verifier,
  ).toBeUndefined();
  const next = await start(f);
  await start(f);
  await expect(
    f.signed.action(api.integrations.x.client.callback, next),
  ).rejects.toThrow("X_OAUTH_STATE_INVALID");
  await f.t.run(async (ctx) => {
    const s = await ctx.db.query("xOAuthStates").first();
    await ctx.db.patch(s!._id, { expiresAt: Date.now() - 1 });
  });
  await f.t.mutation(internal.integrations.x.oauth.cleanup, {});
  expect(await f.t.run((ctx) => ctx.db.query("xOAuthStates").take(1))).toEqual(
    [],
  );
});

test("same identity reconnect preserves ID; different identity cannot replace historical target", async () => {
  config();
  const f = await mediaFixture(),
    id = await connect(f);
  const same = await start(f, id);
  expect(await f.signed.action(api.integrations.x.client.callback, same)).toBe(
    id,
  );
  vi.restoreAllMocks();
  provider("200");
  await expect(
    f.signed.action(api.integrations.x.client.callback, await start(f, id)),
  ).rejects.toThrow("X_RECONNECT_IDENTITY_MISMATCH");
  const old = await f.t.run((ctx) => ctx.db.get(id));
  expect(old!.providerIdentity).toBe("100");
  expect(
    await f.signed.action(api.integrations.x.client.callback, await start(f)),
  ).not.toBe(id);
});

async function second(f: Awaited<ReturnType<typeof mediaFixture>>) {
  const ident = await f.t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Other",
          email: "other@example.test",
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
            userId: user._id,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  const signed = f.t.withIdentity(ident);
  await signed.mutation(api.users.bootstrap, {});
  const { activeWorkspaceId: workspaceId } = await signed.query(
    api.users.current,
    {},
  );
  return { ...f, signed, workspaceId };
}
test("concurrent global binding, reauth reservation, explicit transfer and pre-disconnect callback invalidation", async () => {
  config();
  const f = await mediaFixture(),
    other = await second(f);
  provider();
  const a = await start(f),
    b = await start(other);
  const results = await Promise.allSettled([
    f.signed.action(api.integrations.x.client.callback, a),
    other.signed.action(api.integrations.x.client.callback, b),
  ]);
  expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  const winner = results[0].status === "fulfilled" ? f : other,
    loser = winner === f ? other : f;
  const id = (
    results.find((x) => x.status === "fulfilled") as PromiseFulfilledResult<
      import("../../_generated/dataModel").Id<"socialAccounts">
    >
  ).value;
  await winner.t.run((ctx) =>
    ctx.db.patch(id, { connection: "reauth_required" }),
  );
  await expect(
    loser.signed.action(api.integrations.x.client.callback, await start(loser)),
  ).rejects.toThrow("X_ACCOUNT_BINDING_CONFLICT");
  const stale = await start(loser);
  await winner.signed.mutation(api.integrations.x.oauth.disconnect, {
    workspaceId: winner.workspaceId,
    accountId: id,
  });
  await expect(
    loser.signed.action(api.integrations.x.client.callback, stale),
  ).rejects.toThrow("X_ACCOUNT_BINDING_CONFLICT");
  const moved = await loser.signed.action(
    api.integrations.x.client.callback,
    await start(loser),
  );
  expect(moved).not.toBe(id);
  const bound = await f.t.run((ctx) => ctx.db.query("xBindings").first());
  expect(bound!.workspaceId).toBe(loser.workspaceId);
});

test("capacity prevents invisible account101; reconnect existing ID still works", async () => {
  config();
  const f = await mediaFixture(),
    id = await connect(f);
  await f.t.run(async (ctx) => {
    const template = (await ctx.db.get(id))!;
    const { _id, _creationTime, ...fields } = template;
    void _id;
    void _creationTime;
    for (let n = 1; n < 100; n++)
      await ctx.db.insert("socialAccounts", {
        ...fields,
        providerIdentity: String(1000 + n),
      });
  });
  vi.restoreAllMocks();
  provider("200");
  await expect(
    f.signed.action(api.integrations.x.client.callback, await start(f)),
  ).rejects.toThrow("X_ACCOUNT_CAPACITY_REACHED");
  vi.restoreAllMocks();
  provider();
  expect(
    await f.signed.action(
      api.integrations.x.client.callback,
      await start(f, id),
    ),
  ).toBe(id);
});

test("role or lifecycle lost during exchange prevents commit", async () => {
  config();
  const f = await mediaFixture(),
    args = await start(f);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).endsWith("/token"))
      return Response.json({
        access_token: "fixture-access",
        token_type: "bearer",
        expires_in: 7200,
        scope: scopes,
      });
    await f.t.run((ctx) =>
      ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
    );
    return Response.json({
      data: { id: "100", name: "Fixture", username: "fixture" },
    });
  });
  await expect(
    f.signed.action(api.integrations.x.client.callback, args),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
  expect(
    await f.t.run((ctx) => ctx.db.query("socialAccounts").take(1)),
  ).toEqual([]);
});

test("parallel refresh and rotation commit once; stale completion cannot survive reconnect/disconnect", async () => {
  config();
  const f = await mediaFixture(),
    id = await connect(f);
  const a = { workspaceId: f.workspaceId, accountId: id };
  const claims = await Promise.all([
    f.signed.mutation(internal.integrations.x.oauth.refreshClaim, a),
    f.signed.mutation(internal.integrations.x.oauth.refreshClaim, a),
  ]);
  expect(claims.filter((c) => c.credential)).toHaveLength(1);
  const c = claims.find((c) => c.credential)!.credential!;
  await f.signed.action(api.integrations.x.client.callback, await start(f, id));
  await expect(
    f.signed.mutation(internal.integrations.x.oauth.refreshComplete, {
      ...a,
      generation: c.generation,
      envelope: await seal(
        { accessToken: "stale" },
        association(f.workspaceId, id),
      ),
      expiresAt: Date.now() + 10000,
      scopes: [],
    }),
  ).rejects.toThrow("X_CONNECTION_CHANGED");
  const fresh = await f.signed.mutation(
    internal.integrations.x.oauth.refreshClaim,
    a,
  );
  await f.signed.mutation(api.integrations.x.oauth.disconnect, a);
  await f.t.mutation(internal.integrations.x.oauth.refreshFailed, {
    ...a,
    generation: fresh.credential!.generation,
    code: "X_REAUTH_REQUIRED",
  });
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.connection).toBe(
    "disconnected",
  );
  expect(
    (await f.t.run((ctx) => ctx.db.query("xCredentials").first()))!.envelope,
  ).toBeUndefined();
});

test("actual refresh persists rotated token; invalid_grant and unknown transport require reconnect", async () => {
  config();
  const f = await mediaFixture(),
    id = await connect(f),
    a = { workspaceId: f.workspaceId, accountId: id };
  vi.restoreAllMocks();
  const fetch = provider("100", "rotated-access", "rotated-refresh");
  await f.signed.action(api.integrations.x.client.refresh, a);
  const c = await f.t.run((ctx) => ctx.db.query("xCredentials").first());
  expect(await open(c!.envelope!, association(f.workspaceId, id))).toEqual({
    accessToken: "rotated-access",
    refreshToken: "rotated-refresh",
  });
  expect(
    new URLSearchParams(fetch.mock.calls[0][1]!.body as string).get(
      "refresh_token",
    ),
  ).toBe("fixture-refresh");
  fetch.mockResolvedValue(
    Response.json(
      { error: "invalid_grant", secret: "never-show" },
      { status: 400 },
    ),
  );
  await expect(
    f.signed.action(api.integrations.x.client.refresh, a),
  ).rejects.toThrow("X_REAUTH_REQUIRED");
  expect((await f.t.run((ctx) => ctx.db.get(id)))!.connection).toBe(
    "reauth_required",
  );
  vi.restoreAllMocks();
  provider();
  await f.signed.action(api.integrations.x.client.callback, await start(f, id));
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("network uncertain"),
  );
  await expect(
    f.signed.action(api.integrations.x.client.refresh, a),
  ).rejects.toThrow("X_REFRESH_OUTCOME_UNKNOWN");
  await expect(
    f.signed.action(api.integrations.x.client.refresh, a),
  ).rejects.toThrow("X_REAUTH_REQUIRED");
});

test("expired refresh lease is never blind retried; cleanup preserves identity reservation", async () => {
  config();
  const f = await mediaFixture(),
    id = await connect(f),
    a = { workspaceId: f.workspaceId, accountId: id };
  const claimed = await f.signed.mutation(
    internal.integrations.x.oauth.refreshClaim,
    a,
  );
  await f.t.run((ctx) =>
    ctx.db.patch(claimed.credential!._id, {
      leaseUntil: Date.now() - 1,
      cleanAfter: Date.now() - 1,
    }),
  );
  const result = await f.signed.mutation(
    internal.integrations.x.oauth.refreshClaim,
    a,
  );
  expect(result.code).toBe("X_REFRESH_OUTCOME_UNKNOWN");
  await f.t.mutation(internal.integrations.x.oauth.cleanup, {});
  expect(
    (await f.t.run((ctx) => ctx.db.query("xBindings").first()))!.accountId,
  ).toBe(id);
});

test("AES-GCM reads previous key/writes current, rejects unknown keys and association tampering", async () => {
  config();
  const encrypted = await seal({ token: "fixture" }, "workspace/account");
  vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEY_ID", "key-one");
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_PREVIOUS_KEY",
    base64(new Uint8Array(32).fill(1)),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "key-two");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", base64(new Uint8Array(32).fill(2)));
  expect(await open(encrypted, "workspace/account")).toEqual({
    token: "fixture",
  });
  expect((await seal("new", "workspace/account")).keyId).toBe("key-two");
  await expect(open(encrypted, "other/account")).rejects.toThrow(
    "X_CREDENTIAL_UNREADABLE",
  );
  await expect(
    open({ ...encrypted, keyId: "missing" }, "workspace/account"),
  ).rejects.toThrow("X_ENCRYPTION_KEY_UNAVAILABLE");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "weak");
  expect(() => keyring()).toThrow("X_ENCRYPTION_CONFIGURATION_REQUIRED");
});

test("strict token/user/config boundaries and bounded provider response reject unsafe data", async () => {
  config();
  const valid = {
    access_token: "a",
    token_type: "bearer",
    expires_in: 3600,
    scope: scopes,
  };
  for (const patch of [
    { expires_in: Infinity },
    { token_type: "Basic" },
    { access_token: "line\nbreak" },
    { scope: "secret with spaces\n" },
  ])
    expect(() => tokens({ ...valid, ...patch })).toThrow(
      "X_PROVIDER_RESPONSE_INVALID",
    );
  expect(() =>
    identity({
      data: { id: "client-identity", name: "fake", username: "fake" },
    }),
  ).toThrow();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("x".repeat(32769)),
  );
  await expect(
    request("me", configuration(), undefined, "synthetic"),
  ).rejects.toThrow("X_PROVIDER_RESPONSE_INVALID");
  vi.stubEnv("SITE_URL", "https://attacker@dispatch.example");
  expect(() => configuration()).toThrow("X_CONFIGURATION_REQUIRED");
});
