import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import { mediaFixture } from "../../../tests/media-fixture";
import { base64, open } from "../../lib/crypto";
import { configuration, tokens, appJwt, request } from "./app";
import { association } from "./fields";
import { generateKeyPairSync } from "node:crypto";
function config() {
  vi.stubEnv("SITE_URL", "https://dispatch.example");
  vi.stubEnv("GITHUB_APP_ID", "42");
  vi.stubEnv("GITHUB_APP_CLIENT_ID", "fixture-client");
  vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "fixture-secret");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "key-one");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", base64(new Uint8Array(32).fill(1)));
  vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEY_ID", "");
  vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEY", "");
}
const repo = {
  id: 101,
  full_name: "fixture/project",
  private: true,
  owner: { login: "fixture" },
  name: "project",
  permissions: { pull: true },
};
function provider(appId = 42, repositories: unknown[] = [repo]) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, options) => {
      expect(options?.redirect).toBe("error");
      const path = new URL(String(url)).pathname;
      if (path === "/login/oauth/access_token")
        return Response.json({
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
          token_type: "bearer",
          scope: "",
          expires_in: 28800,
          refresh_token_expires_in: 15897600,
        });
      if (path === "/user") return Response.json({ id: 7, login: "fixture" });
      if (path === "/user/installations")
        return Response.json({
          total_count: 1,
          installations: [
            {
              id: 50,
              app_id: appId,
              suspended_at: null,
              account: { login: "fixture", type: "User" },
            },
          ],
        });
      if (path === "/user/installations/50/repositories")
        return Response.json({
          total_count: repositories.length,
          repositories,
        });
      throw Error("unexpected endpoint");
    });
}
async function connect(f: Awaited<ReturnType<typeof mediaFixture>>) {
  const url = new URL(
    await f.signed.action(api.integrations.github.app.start, {
      workspaceId: f.workspaceId,
    }),
  );
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  const args = {
    workspaceId: f.workspaceId,
    state: url.searchParams.get("state")!,
    code: "fixture-code",
    denied: false,
  };
  await f.signed.action(api.integrations.github.app.callback, args);
  return args;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
test("separate human OAuth, encrypted one-use PKCE, selected intersection and independent purposes", async () => {
  config();
  const f = await mediaFixture();
  provider();
  const args = await connect(f);
  const c = await f.t.run((ctx) => ctx.db.query("githubConnections").first());
  expect(await open(c!.envelope!, association(f.workspaceId))).toMatchObject({
    accessToken: "fixture-access",
  });
  await expect(
    f.signed.action(api.integrations.github.app.callback, args),
  ).rejects.toThrow("GITHUB_OAUTH_STATE_INVALID");
  expect(
    (
      await f.signed.query(api.integrations.github.repositories.list, {
        workspaceId: f.workspaceId,
      })
    ).repositories,
  ).toEqual([]);
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "50",
    repositoryId: "101",
  });
  let view = await f.signed.query(api.integrations.github.repositories.list, {
    workspaceId: f.workspaceId,
  });
  expect(view.repositories[0]).toMatchObject({
    access: true,
    monitoring: false,
    content: false,
    private: true,
  });
  for (const secret of [
    "fixture-access",
    "fixture-refresh",
    "ciphertext",
    "verifier",
  ])
    expect(JSON.stringify(view)).not.toContain(secret);
  const id = view.repositories[0]._id;
  await expect(
    f.signed.mutation(api.integrations.github.repositories.configure, {
      workspaceId: f.workspaceId,
      repositoryId: id,
      expectedGeneration: 1,
      access: true,
      monitoring: false,
      content: true,
      communicableContext: "",
    }),
  ).rejects.toThrow("GITHUB_PURPOSE_REQUIRED");
  await f.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: id,
    expectedGeneration: 1,
    access: true,
    monitoring: true,
    content: true,
    communicableContext: "Approved public description",
  });
  const source = await f.t.query(
    internal.integrations.github.repositories.source,
    {
      workspaceId: f.workspaceId,
      repositoryId: id,
      generation: 2,
      purpose: "content",
    },
  );
  expect(source.communicableContext).toBe("Approved public description");
  await f.signed.mutation(api.integrations.github.repositories.remove, {
    workspaceId: f.workspaceId,
    repositoryId: id,
    expectedGeneration: 2,
  });
  await expect(
    f.t.query(internal.integrations.github.repositories.source, {
      workspaceId: f.workspaceId,
      repositoryId: id,
      generation: 2,
      purpose: "content",
    }),
  ).rejects.toThrow("GITHUB_SOURCE_DISABLED");
  view = await f.signed.query(api.integrations.github.repositories.list, {
    workspaceId: f.workspaceId,
  });
  expect(view.repositories).toEqual([]);
});
test("spoofed installation and App mismatch never grant source access", async () => {
  config();
  const f = await mediaFixture();
  provider(999);
  await expect(connect(f)).rejects.toThrow("GITHUB_APP_ACCESS_REQUIRED");
  vi.restoreAllMocks();
  provider();
  await connect(f);
  await expect(
    f.signed.action(api.integrations.github.app.select, {
      workspaceId: f.workspaceId,
      installationId: "999",
      repositoryId: "101",
    }),
  ).rejects.toThrow("GITHUB_INSTALLATION_DENIED");
  await expect(
    f.signed.action(api.integrations.github.app.select, {
      workspaceId: f.workspaceId,
      installationId: "50",
      repositoryId: "999",
    }),
  ).rejects.toThrow("GITHUB_REPOSITORY_DENIED");
});
test("refresh timeout consumes local lease and requires reauthorization without replay", async () => {
  config();
  const f = await mediaFixture();
  provider();
  await connect(f);
  vi.restoreAllMocks();
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("lost response"));
  await expect(
    f.signed.action(api.integrations.github.app.refresh, {
      workspaceId: f.workspaceId,
    }),
  ).rejects.toThrow("GITHUB_REFRESH_OUTCOME_UNKNOWN");
  await expect(
    f.signed.action(api.integrations.github.app.refresh, {
      workspaceId: f.workspaceId,
    }),
  ).rejects.toThrow("GITHUB_REAUTH_REQUIRED");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("token expiry optional, replacement pair strict, JWT native RS256 and bounded fixed requests", async () => {
  config();
  expect(
    tokens({ access_token: "valid", token_type: "bearer", scope: "" })
      .expiresAt,
  ).toBe(Number.MAX_SAFE_INTEGER);
  expect(() =>
    tokens({ access_token: "valid", token_type: "bearer", scope: "repo" }),
  ).toThrow("GITHUB_PROVIDER_RESPONSE_INVALID");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv(
    "GITHUB_APP_PRIVATE_KEY",
    privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
  );
  const jwt = appJwt(configuration());
  expect(
    JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString()),
  ).toEqual({ alg: "RS256", typ: "JWT" });
  const body = JSON.parse(
    Buffer.from(jwt.split(".")[1], "base64url").toString(),
  );
  expect(body.iss).toBe("fixture-client");
  expect(body.exp - body.iat).toBe(660);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("x".repeat(1024 * 1024 + 1)),
  );
  await expect(request("/user", "token")).rejects.toThrow(
    "GITHUB_PROVIDER_RESPONSE_INVALID",
  );
});
test("role, selected workspace, initiator and lifecycle fence OAuth and late inventory", async () => {
  config();
  const f = await mediaFixture();
  provider();
  const url = new URL(
    await f.signed.action(api.integrations.github.app.start, {
      workspaceId: f.workspaceId,
    }),
  );
  const args = {
    workspaceId: f.workspaceId,
    state: url.searchParams.get("state")!,
    code: "fixture-code",
    denied: false,
  };
  const other = await f.signed.mutation(api.workspaces.create, {
    name: "Other",
    description: "",
  });
  await expect(
    f.signed.action(api.integrations.github.app.callback, args),
  ).rejects.toThrow("GITHUB_WORKSPACE_CHANGED");
  await f.signed.mutation(api.workspaces.select, {
    workspaceId: f.workspaceId,
  });
  const membership = await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique(),
  );
  await f.t.run((ctx) => ctx.db.patch(membership!._id, { role: "Viewer" }));
  await expect(
    f.signed.action(api.integrations.github.app.callback, args),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  await f.t.run((ctx) => ctx.db.patch(membership!._id, { role: "Owner" }));
  await f.signed.action(api.integrations.github.app.callback, args);
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "50",
    repositoryId: "101",
  });
  let r = (
    await f.signed.query(api.integrations.github.repositories.settings, {
      workspaceId: f.workspaceId,
    })
  ).repositories[0];
  vi.restoreAllMocks();
  const fetched = provider();
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const original = fetched.getMockImplementation()!;
  fetched.mockImplementation(async (url, opts) => {
    if (String(url).includes("/repositories")) await held;
    return original(url, opts);
  });
  const pending = f.signed.action(
    api.integrations.github.app.discoverRepositories,
    { workspaceId: f.workspaceId, installationId: "50" },
  );
  await vi.waitFor(() =>
    expect(
      fetched.mock.calls.some(([url]) => String(url).includes("/repositories")),
    ).toBe(true),
  );
  await f.signed.mutation(api.integrations.github.repositories.remove, {
    workspaceId: f.workspaceId,
    repositoryId: r._id,
    expectedGeneration: r.generation,
  });
  release();
  await expect(pending).rejects.toThrow("GITHUB_SOURCE_CHANGED");
  expect(
    (
      await f.signed.query(api.integrations.github.repositories.list, {
        workspaceId: f.workspaceId,
      })
    ).repositories,
  ).toEqual([]);
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(
    f.signed.action(api.integrations.github.app.start, {
      workspaceId: f.workspaceId,
    }),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
});
test("verified repository permission removal disables both purposes; stale and foreign source jobs fail", async () => {
  config();
  const f = await mediaFixture();
  provider();
  await connect(f);
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "50",
    repositoryId: "101",
  });
  const r = (
    await f.signed.query(api.integrations.github.repositories.settings, {
      workspaceId: f.workspaceId,
    })
  ).repositories[0];
  await f.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: r._id,
    expectedGeneration: r.generation,
    access: true,
    monitoring: true,
    content: true,
    communicableContext: "Public summary",
  });
  vi.restoreAllMocks();
  provider(42, []);
  await f.signed.action(api.integrations.github.app.discoverRepositories, {
    workspaceId: f.workspaceId,
    installationId: "50",
  });
  expect(
    (
      await f.signed.query(api.integrations.github.repositories.settings, {
        workspaceId: f.workspaceId,
      })
    ).repositories[0],
  ).toMatchObject({
    access: false,
    monitoring: false,
    content: false,
    authorized: false,
  });
  await expect(
    f.t.query(internal.integrations.github.repositories.source, {
      workspaceId: f.workspaceId,
      repositoryId: r._id,
      generation: r.generation + 1,
      purpose: "content",
    }),
  ).rejects.toThrow("GITHUB_SOURCE_DISABLED");
});
test("disconnect closes callbacks and credentials immediately without changing login", async () => {
  config();
  const f = await mediaFixture();
  provider();
  const args = await connect(f);
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "50",
    repositoryId: "101",
  });
  await f.signed.mutation(api.integrations.github.repositories.disconnect, {
    workspaceId: f.workspaceId,
  });
  await expect(
    f.signed.action(api.integrations.github.app.callback, args),
  ).rejects.toThrow("GITHUB_OAUTH_STATE_INVALID");
  expect(
    (await f.t.run((ctx) => ctx.db.query("githubConnections").first()))!
      .envelope,
  ).toBeUndefined();
  expect((await f.signed.query(api.users.current, {})).activeWorkspaceId).toBe(
    f.workspaceId,
  );
});
test("private source context has explicit consent and background authority ignores UI selection but honors revocation", async () => {
  config();
  const f = await mediaFixture();
  provider();
  await connect(f);
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "50",
    repositoryId: "101",
  });
  const r = (
    await f.signed.query(api.integrations.github.repositories.settings, {
      workspaceId: f.workspaceId,
    })
  ).repositories[0];
  await f.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: r._id,
    expectedGeneration: 1,
    access: true,
    monitoring: true,
    content: true,
    communicableContext: "Communicable only",
  });
  await f.signed.mutation(api.workspaces.create, {
    name: "Other",
    description: "",
  });
  const args = {
    workspaceId: f.workspaceId,
    repositoryId: r._id,
    generation: 2,
    purpose: "content" as const,
  };
  expect(
    (await f.t.query(internal.integrations.github.repositories.source, args))
      .communicableContext,
  ).toBe("Communicable only");
  const m = await f.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
      )
      .unique(),
  );
  await f.t.run((ctx) => ctx.db.patch(m!._id, { role: "Editor" }));
  await expect(
    f.t.query(internal.integrations.github.repositories.source, args),
  ).rejects.toThrow("GITHUB_SOURCE_DISABLED");
});
test("fresh scoped installation token contains only the selected repository and metadata permission", async () => {
  config();
  const f = await mediaFixture();
  provider();
  await connect(f);
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "50",
    repositoryId: "101",
  });
  const r = (
    await f.signed.query(api.integrations.github.repositories.settings, {
      workspaceId: f.workspaceId,
    })
  ).repositories[0];
  await f.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: r._id,
    expectedGeneration: 1,
    access: true,
    monitoring: true,
    content: false,
    communicableContext: "",
  });
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv(
    "GITHUB_APP_PRIVATE_KEY",
    privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
  );
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
    expect(String(url)).toBe(
      "https://api.github.com/app/installations/50/access_tokens",
    );
    expect(JSON.parse(String(opts!.body))).toEqual({
      repository_ids: [101],
      permissions: { metadata: "read" },
    });
    return Response.json({
      token: "installation-fixture",
      permissions: { metadata: "read" },
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      repositories: [{ id: 101 }],
    });
  });
  expect(
    (
      await f.t.action(
        internal.integrations.github.app.installationCredential,
        {
          workspaceId: f.workspaceId,
          repositoryId: r._id,
          generation: 2,
          purpose: "monitoring",
        },
      )
    ).token,
  ).toBe("installation-fixture");
});
test("proof expiry and privacy transition close new/late content until explicit renewed purpose", async () => {
  config();
  const f = await mediaFixture();
  provider(42, [{ ...repo, private: false }]);
  await connect(f);
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "50",
    repositoryId: "101",
  });
  const r = (
    await f.signed.query(api.integrations.github.repositories.settings, {
      workspaceId: f.workspaceId,
    })
  ).repositories[0];
  await f.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: r._id,
    expectedGeneration: 1,
    access: true,
    monitoring: true,
    content: true,
    communicableContext: "",
  });
  vi.restoreAllMocks();
  provider();
  await f.signed.action(api.integrations.github.app.discoverRepositories, {
    workspaceId: f.workspaceId,
    installationId: "50",
  });
  let view = (
    await f.signed.query(api.integrations.github.repositories.settings, {
      workspaceId: f.workspaceId,
    })
  ).repositories[0];
  expect(view).toMatchObject({
    private: true,
    monitoring: false,
    content: false,
    generation: 3,
  });
  await expect(
    f.t.query(internal.integrations.github.repositories.source, {
      workspaceId: f.workspaceId,
      repositoryId: r._id,
      generation: 2,
      purpose: "content",
    }),
  ).rejects.toThrow("GITHUB_SOURCE_DISABLED");
  await f.t.run((ctx) =>
    ctx.db.patch(r._id, { proofExpiresAt: Date.now() - 1 }),
  );
  expect(
    (
      await f.signed.query(api.integrations.github.repositories.list, {
        workspaceId: f.workspaceId,
      })
    ).repositories,
  ).toEqual([]);
});
test("rotation reads previous key and successful refresh replaces both credentials; expired lease cleanup never replays", async () => {
  config();
  const f = await mediaFixture();
  provider();
  await connect(f);
  vi.stubEnv("INTEGRATION_ENCRYPTION_PREVIOUS_KEY_ID", "key-one");
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_PREVIOUS_KEY",
    base64(new Uint8Array(32).fill(1)),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "key-two");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", base64(new Uint8Array(32).fill(2)));
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      access_token: "next-access",
      refresh_token: "next-refresh",
      token_type: "bearer",
      scope: "",
      expires_in: 28800,
      refresh_token_expires_in: 15897600,
    }),
  );
  await f.signed.action(api.integrations.github.app.refresh, {
    workspaceId: f.workspaceId,
  });
  const c = await f.t.run((ctx) => ctx.db.query("githubConnections").first());
  expect(c!.envelope!.keyId).toBe("key-two");
  expect(await open(c!.envelope!, association(f.workspaceId))).toEqual({
    accessToken: "next-access",
    refreshToken: "next-refresh",
  });
  await f.t.run((ctx) => ctx.db.patch(c!._id, { leaseUntil: Date.now() - 1 }));
  await f.t.mutation(internal.integrations.github.repositories.cleanup, {});
  expect((await f.t.run((ctx) => ctx.db.get(c!._id)))!.status).toBe(
    "reauth_required",
  );
});
test("401 closes source authority even when provider returns an unparseable body", async () => {
  config();
  const f = await mediaFixture();
  provider();
  await connect(f);
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("unauthorized html", { status: 401 }),
  );
  await expect(
    f.signed.action(api.integrations.github.app.discoverRepositories, {
      workspaceId: f.workspaceId,
      installationId: "50",
    }),
  ).rejects.toThrow("GITHUB_REAUTH_REQUIRED");
  expect(
    (await f.t.run((ctx) => ctx.db.query("githubConnections").first()))!.status,
  ).toBe("reauth_required");
});
test("disconnect during OAuth provider I/O cannot restore a connection or accept late identity proof", async () => {
  config();
  const f = await mediaFixture(),
    fetcher = provider();
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve)),
    original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, options) => {
    if (new URL(String(url)).pathname === "/user") await held;
    return original(url, options);
  });
  const pending = connect(f);
  await vi.waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        ([url]) => new URL(String(url)).pathname === "/user",
      ),
    ).toBe(true),
  );
  await f.signed.mutation(api.integrations.github.repositories.disconnect, {
    workspaceId: f.workspaceId,
  });
  release();
  await expect(pending).rejects.toThrow("GITHUB_CONNECTION_CHANGED");
  expect(
    (await f.t.run((ctx) => ctx.db.query("githubConnections").first()))!.status,
  ).toBe("disconnected");
  expect(
    (
      await f.signed.query(api.integrations.github.repositories.list, {
        workspaceId: f.workspaceId,
      })
    ).repositories,
  ).toEqual([]);
});
test("unselected installation metadata is not included in ordinary workspace projections", async () => {
  config();
  const f = await mediaFixture();
  provider();
  await connect(f);
  expect(
    (
      await f.signed.query(api.integrations.github.repositories.list, {
        workspaceId: f.workspaceId,
      })
    ).connection!.installations,
  ).toEqual([]);
  expect(
    (
      await f.signed.query(api.integrations.github.repositories.settings, {
        workspaceId: f.workspaceId,
      })
    ).connection!.installations,
  ).toHaveLength(1);
});

test("revoked other installation does not block two remaining-source resyncs or repeat revocation generation", async () => {
  config();
  const f = await mediaFixture();
  let both = true;
  const fetched = provider();
  const original = fetched.getMockImplementation()!;
  fetched.mockImplementation(async (u, o) => {
    const path = new URL(String(u)).pathname;
    if (path === "/user/installations")
      return Response.json({
        total_count: both ? 2 : 1,
        installations: [
          {
            id: 50,
            app_id: 42,
            suspended_at: null,
            account: { login: "fixture", type: "User" },
          },
          ...(both
            ? [
                {
                  id: 60,
                  app_id: 42,
                  suspended_at: null,
                  account: { login: "other", type: "Organization" },
                },
              ]
            : []),
        ],
      });
    if (path === "/user/installations/60/repositories")
      return Response.json({
        total_count: 1,
        repositories: [
          {
            ...repo,
            id: 201,
            full_name: "other/project",
            owner: { login: "other" },
          },
        ],
      });
    return original(u, o);
  });
  await connect(f);
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "50",
    repositoryId: "101",
  });
  await f.signed.action(api.integrations.github.app.select, {
    workspaceId: f.workspaceId,
    installationId: "60",
    repositoryId: "201",
  });
  const selected = (
    await f.signed.query(api.integrations.github.repositories.settings, {
      workspaceId: f.workspaceId,
    })
  ).repositories;
  for (const r of selected)
    await f.signed.mutation(api.integrations.github.repositories.configure, {
      workspaceId: f.workspaceId,
      repositoryId: r._id,
      expectedGeneration: r.generation,
      access: true,
      monitoring: true,
      content: true,
      communicableContext: "Communicable metadata only",
    });
  const activeA = selected.find((r) => r.providerId === "101")!,
    removedB = selected.find((r) => r.providerId === "201")!;
  both = false;
  const failures: string[] = [];
  const revokedGenerations: number[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await f.signed.action(api.integrations.github.app.discoverRepositories, {
        workspaceId: f.workspaceId,
        installationId: "50",
      });
      const closed = (
        await f.signed.query(api.integrations.github.repositories.settings, {
          workspaceId: f.workspaceId,
        })
      ).repositories.find((r) => r.providerId === "201")!;
      revokedGenerations.push(closed.generation);
      await expect(
        f.t.query(internal.integrations.github.repositories.source, {
          workspaceId: f.workspaceId,
          repositoryId: removedB._id,
          generation: removedB.generation + 1,
          purpose: "content",
        }),
      ).rejects.toThrow("GITHUB_SOURCE_DISABLED");
      expect(
        (
          await f.t.query(internal.integrations.github.repositories.source, {
            workspaceId: f.workspaceId,
            repositoryId: activeA._id,
            generation: activeA.generation + 1,
            purpose: "content",
          })
        ).providerId,
      ).toBe("101");
    } catch (e) {
      failures.push(String(e));
    }
  }
  expect(failures).toEqual([]);
  expect(revokedGenerations).toEqual([
    removedB.generation + 2,
    removedB.generation + 2,
  ]);
  const v = await f.signed.query(
    api.integrations.github.repositories.settings,
    { workspaceId: f.workspaceId },
  );
  expect(v.repositories.find((r) => r.providerId === "201")).toMatchObject({
    access: false,
    monitoring: false,
    content: false,
    authorized: false,
  });
  expect(v.repositories.find((r) => r.providerId === "101")).toMatchObject({
    authorized: true,
  });
});
test.each(["configure", "role", "disconnect"] as const)(
  "scoped inventory still rejects concurrent %s during provider I/O",
  async (change) => {
    config();
    const f = await mediaFixture(),
      fetcher = provider();
    await connect(f);
    await f.signed.action(api.integrations.github.app.select, {
      workspaceId: f.workspaceId,
      installationId: "50",
      repositoryId: "101",
    });
    const r = (
      await f.signed.query(api.integrations.github.repositories.settings, {
        workspaceId: f.workspaceId,
      })
    ).repositories[0];
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve)),
      original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (url, options) => {
      if (
        new URL(String(url)).pathname === "/user/installations/50/repositories"
      )
        await held;
      return original(url, options);
    });
    const pending = f.signed.action(
      api.integrations.github.app.discoverRepositories,
      { workspaceId: f.workspaceId, installationId: "50" },
    );
    await vi.waitFor(() =>
      expect(
        fetcher.mock.calls.filter(
          ([url]) =>
            new URL(String(url)).pathname ===
            "/user/installations/50/repositories",
        ).length,
      ).toBe(2),
    );
    if (change === "configure")
      await f.signed.mutation(api.integrations.github.repositories.configure, {
        workspaceId: f.workspaceId,
        repositoryId: r._id,
        expectedGeneration: r.generation,
        access: true,
        monitoring: false,
        content: false,
        communicableContext: "Changed during I/O",
      });
    else if (change === "role") {
      const m = await f.t.run((ctx) =>
        ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
          )
          .unique(),
      );
      await f.t.run((ctx) => ctx.db.patch(m!._id, { role: "Viewer" }));
    } else
      await f.signed.mutation(api.integrations.github.repositories.disconnect, {
        workspaceId: f.workspaceId,
      });
    release();
    await expect(pending).rejects.toThrow(
      change === "configure"
        ? "GITHUB_SOURCE_CHANGED"
        : change === "role"
          ? "ROLE_ACCESS_DENIED"
          : "GITHUB_REAUTH_REQUIRED",
    );
  },
);
