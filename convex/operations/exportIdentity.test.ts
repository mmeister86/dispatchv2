import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { mediaFixture } from "../../tests/media-fixture";
import { components } from "../_generated/api";
const page = makeFunctionReference<"query">("operations/exportIdentity:page");
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  vi.stubEnv("R2_MEDIA_BUCKET", "identity-export");
  const f = await mediaFixture();
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  return {
    ...f,
    args: {
      workspaceId: f.workspaceId,
      expectedAuthId: user.authId,
      expectedSessionId: identity!.sessionId as string,
      requestKey: "identity",
      cursor: null,
      creationUpperBound: null,
    },
  };
}
test("own native Auth models are explicitly projected without credentials or foreign records", async () => {
  const f = await setup();
  await f.t.run(async (ctx) => {
    for (const userId of [f.args.expectedAuthId, "foreign-user"]) {
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "account",
          data: {
            userId,
            accountId: "public-account",
            providerId: "github",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            password: "PASSWORD_SENTINEL",
            accessToken: "TOKEN_SENTINEL",
            refreshToken: "REFRESH_SENTINEL",
            idToken: "ID_TOKEN_SENTINEL",
          },
        },
      });
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "oauthApplication",
          data: {
            userId,
            name: "Own app",
            clientId: `public-client-${userId}`,
            clientSecret: "CLIENT_SECRET_SENTINEL",
            metadata: "METADATA_SECRET_SENTINEL",
          },
        },
      });
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "oauthConsent",
          data: {
            userId,
            clientId: "public-client",
            scopes: "read",
            consentGiven: true,
          },
        },
      });
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "oauthAccessToken",
          data: {
            userId,
            clientId: "public-client",
            scopes: "read",
            accessToken: `TOKEN_SENTINEL-${userId}`,
            refreshToken: `REFRESH_SENTINEL-${userId}`,
          },
        },
      });
    }
  });
  for (const model of [
    "user",
    "session",
    "account",
    "oauthApplication",
    "oauthConsent",
    "oauthAccessToken",
  ] as const) {
    // One batched page emits every own record; foreign records stay excluded.
    const rows: { recordId: string; data: unknown }[] = [];
    let cursor: string | null = null,
      creationUpperBound: number | null = null,
      isDone = false;
    for (let i = 0; !isDone && i < 8; i++) {
      const r: {
        data: {
          rows: { recordId: string; data: unknown }[];
          excluded: string[];
        };
        cursor: string | null;
        creationUpperBound: number;
        isDone: boolean;
      } = await f.signed.query(page, {
        ...f.args,
        model,
        cursor,
        creationUpperBound,
      });
      rows.push(...r.data.rows);
      cursor = r.cursor;
      creationUpperBound = r.creationUpperBound;
      isDone = r.isDone;
      expect(r.data.excluded).toContain("bearer_tokens");
    }
    expect(isDone).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toMatch(/SENTINEL|foreign-user/);
  }
});
test("identity/session/workspace guards and fixed selectors reject forged scope", async () => {
  const f = await setup();
  await expect(f.t.query(page, { ...f.args, model: "user" })).rejects.toThrow();
  await expect(
    f.signed.query(page, {
      ...f.args,
      model: "user",
      expectedAuthId: "foreign",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  await expect(
    f.signed.query(page, {
      ...f.args,
      model: "user",
      expectedSessionId: "foreign",
    }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  await expect(
    f.signed.query(page, { ...f.args, model: "verification" }),
  ).rejects.toThrow();
  await f.t.run((ctx) =>
    ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
  );
  await expect(
    f.signed.query(page, { ...f.args, model: "user" }),
  ).rejects.toThrow("WORKSPACE_INACTIVE");
});
test("batched native cursor emits in-ceiling rows and omits newly created rows beyond original ceiling", async () => {
  vi.useFakeTimers();
  try {
    const f = await setup();
    for (let i = 0; i < 30; i++) {
      vi.setSystemTime(Date.now() + 1000);
      await f.t.run((ctx) =>
        ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: "account",
            data: {
              userId: f.args.expectedAuthId,
              accountId: `account-${i}`,
              providerId: "test",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        }),
      );
    }
    const first = await f.signed.query(page, { ...f.args, model: "account" });
    // Per-request candidate cap: at most 25 rows per round-trip.
    expect(first.data.rows).toHaveLength(25);
    expect(first.isDone).toBe(false);
    vi.setSystemTime(Date.now() + 1000);
    await f.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "account",
          data: {
            userId: f.args.expectedAuthId,
            accountId: "late-account",
            providerId: "test",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      }),
    );
    const seen = new Map(
      first.data.rows.map(
        (r: { recordId: string; data: { accountId: string } }) => [
          r.recordId,
          r.data.accountId,
        ],
      ),
    );
    let received = first.data.rows.length;
    let cursor: string | null = first.cursor,
      bound: number | null = first.creationUpperBound,
      isDone = first.isDone;
    for (let i = 0; !isDone && i < 8; i++) {
      const r = await f.signed.query(page, {
        ...f.args,
        model: "account",
        cursor,
        creationUpperBound: bound,
      });
      received += r.data.rows.length;
      for (const row of r.data.rows) seen.set(row.recordId, row.data.accountId);
      cursor = r.cursor;
      bound = r.creationUpperBound;
      isDone = r.isDone;
    }
    expect(isDone).toBe(true);
    // Every created row arrives exactly once (plus the admitted fixture
    // credential); the late insert is excluded.
    expect(received).toBe(seen.size);
    expect(seen.size).toBeGreaterThanOrEqual(30);
    for (let i = 0; i < 30; i++)
      expect([...seen.values()]).toContain(`account-${i}`);
    expect([...seen.values()]).not.toContain("late-account");
  } finally {
    vi.useRealTimers();
  }
});
