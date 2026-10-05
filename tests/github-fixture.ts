import { vi } from "vitest";
import { createHmac } from "node:crypto";
import { mediaFixture } from "./media-fixture";
import type { Id } from "../convex/_generated/dataModel";
export function config() {
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", "synthetic-secret");
  vi.stubEnv("GITHUB_APP_ID", "42");
  vi.stubEnv("SITE_URL", "http://localhost:5174");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-auth-secret-with-enough-length");
}
export const push = {
  installation: { id: 50 },
  repository: { id: 101, full_name: "fixture/project", private: true },
  ref: "refs/heads/main",
  before: "1".repeat(40),
  after: "2".repeat(40),
  created: false,
  deleted: false,
  forced: false,
  commits: [
    {
      id: "2".repeat(40),
      message: "🔐 private secret should not persist",
      added: ["private-file.ts"],
    },
  ],
  head_commit: { message: "not persisted" },
};
export const release = {
  installation: { id: 50 },
  repository: push.repository,
  action: "published",
  release: {
    id: 400,
    tag_name: "v1.0.0",
    draft: false,
    prerelease: true,
    published_at: "2026-10-01T10:00:00Z",
    body: "private release secret",
  },
};
export const installation = {
  id: 50,
  app_id: 42,
  account: { id: 7 },
  target_id: 7,
  target_type: "User",
  repository_selection: "selected",
  permissions: { metadata: "read", contents: "read" },
};
export async function sourceFixture(count = 1) {
  config();
  const f = await mediaFixture();
  const repositories: Id<"githubRepositories">[] = [],
    workspaces = [f.workspaceId];
  await f.t.run(async (ctx) => {
    for (let n = 0; n < count; n++) {
      const workspaceId =
        n === 0
          ? f.workspaceId
          : await ctx.db.insert("workspaces", {
              name: `Workspace${n}`,
              description: "",
            });
      if (n) {
        workspaces.push(workspaceId);
        await ctx.db.insert("memberships", {
          workspaceId,
          userId: f.userId,
          role: "Owner",
        });
      }
      await ctx.db.insert("githubConnections", {
        workspaceId,
        actorId: f.userId,
        generation: 1,
        credentialGeneration: 1,
        syncSequence: 0,
        status: "connected",
        identity: "7",
        login: "fixture",
        installations: [{ id: "50", owner: "fixture", kind: "User" }],
        inventoryLimited: false,
        envelope: {
          version: 1,
          keyId: "fixture",
          iv: "fixture",
          ciphertext: "fixture",
        },
        expiresAt: Date.now() + 86400000,
        refreshExpiresAt: 0,
        leaseUntil: 0,
        updatedAt: Date.now(),
      });
      repositories.push(
        await ctx.db.insert("githubRepositories", {
          workspaceId,
          providerId: "101",
          installationId: "50",
          fullName: "fixture/project",
          private: true,
          selected: true,
          access: true,
          monitoring: true,
          content: false,
          communicableContext: "explicit context",
          purposeActorId: f.userId,
          purposeAt: Date.now() - 1000,
          purposeVersion: 1,
          connectionGeneration: 1,
          generation: 1,
          verifiedAt: Date.now() - 1000,
          proofExpiresAt: Date.now() + 900000,
          updatedAt: Date.now(),
        }),
      );
    }
  });
  return { ...f, repositories, workspaces };
}
export async function send(
  f: Awaited<ReturnType<typeof mediaFixture>>,
  payload: unknown = push,
  event = "push",
  guid = crypto.randomUUID(),
  signed?: string,
) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return f.t.fetch("/integrations/github/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": event,
      "X-GitHub-Delivery": guid,
      "X-Hub-Signature-256": signed ?? signature(body),
    },
    body,
  });
}

export function signature(body: string) {
  return (
    "sha256=" +
    createHmac("sha256", "synthetic-secret").update(body).digest("hex")
  );
}
