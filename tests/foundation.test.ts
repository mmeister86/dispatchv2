import { convexTest } from "convex-test";
import betterAuthComponent from "@convex-dev/better-auth/test";
import { describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api, components } from "../convex/_generated/api";
import { authOrigins } from "../convex/auth";
import { requireReference } from "../convex/lib/authorization";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  betterAuthComponent.register(t);
  return t;
}
async function identity(
  t: ReturnType<typeof setup>,
  email: string,
  verified = true,
  expiresAt = Date.now() + 60_000,
) {
  return await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
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
            expiresAt,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
}

describe("foundation authorization and persistence", () => {
  test("provisions one user, default workspace, Owner membership and profile atomically and idempotently", async () => {
    const t = setup();
    const signed = t.withIdentity(await identity(t, "first@example.test"));
    const userId = await signed.mutation(api.users.bootstrap, {});
    expect(await signed.mutation(api.users.bootstrap, {})).toBe(userId);
    const snapshot = await signed.query(api.users.current, {});
    expect(snapshot.workspaces).toHaveLength(1);
    expect(snapshot.workspaces[0].role).toBe("Owner");
    expect(snapshot.preferences.onboardingDone).toBe(false);
    const counts = await t.run(async (ctx) =>
      Promise.all(
        ["users", "workspaces", "memberships", "preferences"].map((table) =>
          ctx.db.query(table as "users").take(10),
        ),
      ),
    );
    expect(counts.map((rows) => rows.length)).toEqual([1, 1, 1, 1]);
    const profile = {
      ...snapshot.preferences,
      timezone: "America/New_York",
      language: "English" as const,
      audience: "Builders",
      tone: "Precise",
      topics: "Product",
      onboardingDone: true,
      onboardingStep: 3,
    };
    await signed.mutation(api.preferences.save, {
      workspaceId: snapshot.activeWorkspaceId,
      profile,
      project: {
        name: "Real project",
        description: "A project without GitHub",
      },
    });
    const persisted = await signed.query(api.users.current, {});
    expect(persisted.preferences).toEqual(profile);
    expect(persisted.workspaces[0].name).toBe("Real project");
    await expect(
      signed.mutation(api.preferences.save, {
        workspaceId: snapshot.activeWorkspaceId,
        profile: { ...profile, timezone: "Invalid/Timezone" },
      }),
    ).rejects.toThrow("INVALID_TIMEZONE");
  });

  test("foreign workspace and reference IDs are denied and server membership controls roles", async () => {
    const t = setup();
    const first = t.withIdentity(await identity(t, "owner@example.test"));
    const second = t.withIdentity(await identity(t, "second@example.test"));
    await first.mutation(api.users.bootstrap, {});
    const secondId = await second.mutation(api.users.bootstrap, {});
    const foreign = await first.query(api.users.current, {});
    const own = await second.query(api.users.current, {});
    expect(own.activeWorkspaceId).not.toBe(foreign.activeWorkspaceId);
    for (const ref of [api.workspaces.get, api.workspaces.select]) {
      await expect(
        ref === api.workspaces.get
          ? second.query(api.workspaces.get, {
              workspaceId: foreign.activeWorkspaceId,
            })
          : second.mutation(api.workspaces.select, {
              workspaceId: foreign.activeWorkspaceId,
            }),
      ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    }
    await expect(
      second.mutation(api.preferences.save, {
        workspaceId: foreign.activeWorkspaceId,
        profile: own.preferences,
      }),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    expect(() =>
      requireReference(foreign.activeWorkspaceId, {
        workspaceId: own.activeWorkspaceId,
      }),
    ).toThrow("REFERENCE_ACCESS_DENIED");
    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", {
        userId: secondId,
        workspaceId: foreign.activeWorkspaceId,
        role: "Viewer",
      });
    });
    await expect(
      second.mutation(api.preferences.save, {
        workspaceId: foreign.activeWorkspaceId,
        profile: own.preferences,
      }),
    ).rejects.toThrow("ROLE_ACCESS_DENIED");
    const nextId = await second.mutation(api.workspaces.create, {
      name: "Second project",
      description: "",
    });
    expect((await second.query(api.users.current, {})).activeWorkspaceId).toBe(
      nextId,
    );
    await second.mutation(api.workspaces.select, {
      workspaceId: own.activeWorkspaceId,
    });
    expect((await second.query(api.users.current, {})).activeWorkspaceId).toBe(
      own.activeWorkspaceId,
    );
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", secondId).eq("workspaceId", own.activeWorkspaceId),
        )
        .unique();
      await ctx.db.delete(membership!._id);
    });
    await expect(second.query(api.users.current, {})).rejects.toThrow(
      "WORKSPACE_ACCESS_DENIED",
    );
  });

  test("anonymous, unverified, and expired sessions cannot provision data", async () => {
    const t = setup();
    await expect(t.mutation(api.users.bootstrap, {})).rejects.toThrow(
      "Unauthenticated",
    );
    const unverified = t.withIdentity(
      await identity(t, "unverified@example.test", false),
    );
    await expect(unverified.mutation(api.users.bootstrap, {})).rejects.toThrow(
      "EMAIL_NOT_VERIFIED",
    );
    const expired = t.withIdentity(
      await identity(t, "expired@example.test", true, Date.now() - 1000),
    );
    await expect(expired.mutation(api.users.bootstrap, {})).rejects.toThrow(
      "Unauthenticated",
    );
    expect(await t.run(async (ctx) => ctx.db.query("users").take(1))).toEqual(
      [],
    );
  });
});

test("real Better Auth handlers verify email, reset passwords and revoke sessions with mocked delivery", async () => {
  vi.stubEnv("SITE_URL", "http://localhost:5173");
  vi.stubEnv("CONVEX_SITE_URL", "https://auth-test.convex.site");
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "foundation-tests-only-secret-at-least-32-chars",
  );
  vi.stubEnv("RESEND_API_KEY", "test-only");
  const emails: { text: string }[] = [];
  const delivery = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (request, options) => {
      if (String(request) !== "https://api.resend.com/emails")
        throw new Error("Unexpected external request");
      emails.push(JSON.parse(options!.body as string));
      return new Response(JSON.stringify({ id: "test-email" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  try {
    const t = setup();
    const post = (path: string, body: unknown) =>
      t.fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify(body),
      });
    const email = "auth-flow@example.test";
    const password = "original-password123";
    const signup = await post("sign-up/email", {
      name: "Auth test",
      email,
      password,
      callbackURL:
        "http://localhost:5173/onboarding?returnTo=%2Fsettings%2Fprofile",
    });
    expect(signup.status).toBe(200);
    expect(emails).toHaveLength(1);
    const unverified = await post("sign-in/email", { email, password });
    expect(unverified.status).toBe(403);
    const verification = new URL(emails[0].text.split("\n\n")[1]);
    const verified = await t.fetch(verification.pathname + verification.search);
    expect(verified.status).toBe(302);
    expect(
      new URL(verified.headers.get("location")!).searchParams.get("returnTo"),
    ).toBe("/settings/profile");
    const signedIn = await post("sign-in/email", { email, password });
    expect(signedIn.status).toBe(200);
    const signedSession = await signedIn.json();
    expect(signedSession.user.emailVerified).toBe(true);
    const cookie = signedIn.headers
      .get("set-cookie")!
      .match(/(?:__Secure-)?better-auth\.session_token=[^;,]+/)![0];
    const jwt = await t.fetch("/api/auth/convex/token", {
      headers: {
        "better-auth-cookie": cookie,
        Origin: "http://localhost:5173",
      },
    });
    expect(jwt.status).toBe(200);
    const issuedToken = (await jwt.json()).token;
    expect(issuedToken.split(".")).toHaveLength(3);
    const payload = JSON.parse(
      atob(issuedToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    expect(payload.aud).toBe("convex");
    expect(payload.sub).toBe(signedSession.user.id);
    expect(payload.sessionId).toBeTruthy();
    const reset = await post("request-password-reset", {
      email,
      redirectTo:
        "http://localhost:5173/reset-password?returnTo=%2Fsettings%2Fprofile",
    });
    expect(reset.status).toBe(200);
    const link = new URL(emails.at(-1)!.text.split("\n\n")[1]);
    const callback = await t.fetch(link.pathname + link.search);
    const resetDestination = new URL(callback.headers.get("location")!);
    expect(resetDestination.searchParams.get("returnTo")).toBe(
      "/settings/profile",
    );
    const token = resetDestination.searchParams.get("token");
    expect(token).toBeTruthy();
    expect(
      (
        await post("reset-password", {
          token,
          newPassword: "replacement-password123",
        })
      ).status,
    ).toBe(200);
    expect(
      await t.run((ctx) =>
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "session",
          where: [{ field: "token", value: signedSession.token }],
        }),
      ),
    ).toBeNull();
    expect((await post("sign-in/email", { email, password })).status).toBe(401);
    expect(
      (
        await post("sign-in/email", {
          email,
          password: "replacement-password123",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post("reset-password", {
          token,
          newPassword: "reused-password123",
        })
      ).status,
    ).not.toBe(200);
  } finally {
    delivery.mockRestore();
    vi.unstubAllEnvs();
  }
});

test("fixed trusted origins allow only same-port loopback aliases", () => {
  expect(authOrigins("http://localhost:5173")).toEqual([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  expect(authOrigins("https://dispatch.example/app")).toEqual([
    "https://dispatch.example",
  ]);
  expect(authOrigins("http://localhost:5173")).not.toContain(
    "http://localhost:5174",
  );
});
