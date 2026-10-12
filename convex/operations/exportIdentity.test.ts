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
  ]) {
    const r = await f.signed.query(page, { ...f.args, model });
    expect(r.data.rows).toHaveLength(1);
    expect(JSON.stringify(r.data)).not.toMatch(/SENTINEL|foreign-user/);
    expect(r.data.excluded).toContain("bearer_tokens");
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
test("one-record native cursor continues and omits newly created rows beyond original ceiling", async () => {
  vi.useFakeTimers();
  try {
    const f = await setup();
    for (let i = 0; i < 3; i++) {
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
    expect(first.data.rows).toHaveLength(1);
    expect(first.isDone).toBe(false);
    const second = await f.signed.query(page, {
      ...f.args,
      model: "account",
      cursor: first.cursor,
      creationUpperBound: first.creationUpperBound,
    });
    expect(second.data.rows).toHaveLength(1);
    expect(second.data.rows[0].recordId).not.toBe(first.data.rows[0].recordId);
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
    const third = await f.signed.query(page, {
      ...f.args,
      model: "account",
      cursor: second.cursor,
      creationUpperBound: first.creationUpperBound,
    });
    const last = await f.signed.query(page, {
      ...f.args,
      model: "account",
      cursor: third.cursor,
      creationUpperBound: first.creationUpperBound,
    });
    expect(last.data.rows).toEqual([]);
    let end = last;
    for (let i = 0; !end.isDone && i < 8; i++) {
      end = await f.signed.query(page, {
        ...f.args,
        model: "account",
        cursor: end.cursor,
        creationUpperBound: first.creationUpperBound,
      });
      expect(end.data.rows).toEqual([]);
    }
    expect(end.isDone).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
