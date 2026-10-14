import { vi, expect } from "vitest";
import { api } from "../convex/_generated/api";
import { mediaFixture } from "./media-fixture";
const create = api.intelligence.algorithmProfiles.create;
export const head = "e62790c99484b51424c2eccc488ed4e7517e8778";
export const old = "b412112d03f27acbfd668e0cc040abcafa1080c1";
export async function fixture() {
  const f = await mediaFixture();
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId: f.workspaceId,
      provider: "X",
      providerIdentity: "source-test",
      name: "Source test",
      handle: "@sources",
      connection: "disconnected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
        publish: false,
      },
    }),
  );
  const scope = { workspaceId: f.workspaceId, accountId };
  const profile = await f.signed.mutation(create, {
    ...scope,
    expectedRevision: 0,
    commandKey: crypto.randomUUID(),
    variant: "post-analysis",
  });
  return { ...f, scope, baseProfileId: profile.algorithmId! };
}
export function transport(
  options: {
    sha?: string;
    status?: number;
    link?: string;
    compare?: Record<string, unknown>;
    rawFailure?: boolean;
    patch?: string;
  } = {},
) {
  const sha = options.sha ?? head;
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    expect(init.redirect).toBe("error");
    if (url.includes("commits/main"))
      return new Response(
        JSON.stringify({
          sha,
          commit: { committer: { date: "2026-10-06T04:59:30Z" } },
        }),
        {
          status: options.status ?? 200,
          headers: options.status === 429 ? { "retry-after": "3600" } : {},
        },
      );
    if (url.includes("/compare/")) {
      expect(url).toBe(
        `https://api.github.com/repos/xai-org/x-algorithm/compare/${old}...${sha}?per_page=100&page=1`,
      );
      return new Response(
        JSON.stringify({
          status: "ahead",
          total_commits: 1,
          ahead_by: 1,
          behind_by: 0,
          base_commit: { sha: old },
          merge_base_commit: { sha: old },
          commits: [{ sha }],
          files: [
            {
              filename: "README.md",
              status: "modified",
              patch: options.patch ?? "small change",
            },
          ],
          ...options.compare,
        }),
        { headers: { link: options.link ?? "" } },
      );
    }
    expect(url).toMatch(
      new RegExp(
        `^https://raw.githubusercontent.com/xai-org/x-algorithm/${sha}/`,
      ),
    );
    return new Response("synthetic public source bytes", {
      status: options.rawFailure ? 404 : 200,
    });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
export async function independent(f: Awaited<ReturnType<typeof fixture>>) {
  const reviewer = await f.t.run(async (ctx) => {
    const { components } = await import("../convex/_generated/api");
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Independent reviewer",
          email: "reviewer@example.test",
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: {
          userId: u._id,
          providerId: "credential",
          accountId: u._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          password: "synthetic-hash",
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
    const id = await ctx.db.insert("users", {
      authId: u._id,
      defaultWorkspaceId: f.workspaceId,
      activeWorkspaceId: f.workspaceId,
    });
    await ctx.db.insert("memberships", {
      workspaceId: f.workspaceId,
      userId: id,
      role: "Admin",
    });
    return { subject: u._id, sessionId: session._id };
  });
  return {
    signed: f.t.withIdentity(reviewer),
    userId: await f.t
      .run((ctx) =>
        ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", reviewer.subject))
          .unique(),
      )
      .then((u) => u!._id),
  };
}
export const input = (
  f: Awaited<ReturnType<typeof fixture>>,
  full = false,
) => ({
  ...f.scope,
  baseProfileId: f.baseProfileId,
  full,
  commandKey: crypto.randomUUID(),
});
