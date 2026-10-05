"use node";
import { ConvexError, v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { request } from "./app";
import { allowedPath, safePatch } from "./context";
// ponytail: one compare, ≤20 commits, <300 files, three ≤2500-byte selected patches; needs_context at the ceiling, no pagination/repository copies.
function completePatch(patch: string, additions: unknown, deletions: unknown) {
  let expectedOld = 0,
    expectedNew = 0,
    old = 0,
    next = 0,
    added = 0,
    removed = 0,
    hunks = 0;
  for (const line of patch.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(
      line,
    );
    if (hunk) {
      if (hunks && (old !== expectedOld || next !== expectedNew)) return false;
      expectedOld = Number(hunk[2] ?? 1);
      expectedNew = Number(hunk[4] ?? 1);
      old = 0;
      next = 0;
      hunks++;
      continue;
    }
    if (!hunks) return false;
    if (line.startsWith("+")) {
      next++;
      added++;
    } else if (line.startsWith("-")) {
      old++;
      removed++;
    } else if (line.startsWith(" ")) {
      old++;
      next++;
    } else if (line !== "\\ No newline at end of file") return false;
  }
  return (
    hunks > 0 &&
    old === expectedOld &&
    next === expectedNew &&
    added === additions &&
    removed === deletions
  );
}
export function selectedPatches(
  data: Record<string, unknown>,
  before: string,
  after: string,
  paths: string[],
) {
  const base = data.base_commit as Record<string, unknown> | undefined;
  const commits = data.commits as { sha?: unknown }[] | undefined;
  const files = data.files as Record<string, unknown>[] | undefined;
  if (
    base?.sha !== before ||
    (data.merge_base_commit as { sha?: unknown } | undefined)?.sha !== before ||
    !Array.isArray(commits) ||
    !Number.isSafeInteger(data.total_commits) ||
    Number(data.total_commits) < 1 ||
    Number(data.total_commits) > 20 ||
    commits.length !== data.total_commits ||
    commits.at(-1)?.sha !== after ||
    !Array.isArray(files) ||
    files.length >= 300 ||
    data.status !== "ahead"
  )
    throw new ConvexError("GITHUB_CONTEXT_COVERAGE_UNSAFE");
  return paths.map((path) => {
    const matches = files.filter((f) => f.filename === path);
    const f = matches[0];
    if (
      matches.length !== 1 ||
      !f ||
      !allowedPath(path) ||
      typeof f.sha !== "string" ||
      !/^[0-9a-f]{40}$/.test(f.sha) ||
      !["added", "modified", "removed", "renamed"].includes(String(f.status)) ||
      typeof f.patch !== "string" ||
      !safePatch(f.patch) ||
      !completePatch(f.patch, f.additions, f.deletions) ||
      (f.status === "renamed" &&
        (typeof f.previous_filename !== "string" ||
          !allowedPath(f.previous_filename)))
    )
      throw new ConvexError("GITHUB_CONTEXT_COVERAGE_UNSAFE");
    // Patch text only. Never follow a download/Contents URL, symlink target or submodule reference.
    return {
      path,
      previousPath: f.status === "renamed" ? String(f.previous_filename) : null,
      blobSha: f.sha,
      change: String(f.status),
      patch: f.patch,
    };
  });
}
export const load = internalAction({
  args: { contextId: v.id("githubContexts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    try {
      const {
        context: c,
        fullName,
        before,
        after,
      } = await ctx.runQuery(internal.integrations.github.context.read, a);
      if (c.state !== "pending") return null;
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName))
        throw new ConvexError("GITHUB_CONTEXT_COVERAGE_UNSAFE");
      const credential = await ctx.runAction(
        internal.integrations.github.app.installationCredential,
        {
          workspaceId: c.workspaceId,
          repositoryId: c.repositoryId,
          generation: c.generation,
          purpose: "context",
          contextId: c._id,
        },
      );
      await ctx.runQuery(internal.integrations.github.context.read, a);
      const data = await request(
        `/repos/${fullName}/compare/${before}...${after}`,
        credential.token,
      );
      await ctx.runQuery(internal.integrations.github.context.read, a);
      const excerpts = selectedPatches(data, before, after, c.paths);
      await ctx.runMutation(internal.integrations.github.context.commit, {
        ...a,
        excerpts,
        errorCode: null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code =
        [
          "GITHUB_APP_PRIVATE_KEY_REQUIRED",
          "GITHUB_CONTEXT_COVERAGE_UNSAFE",
          "GITHUB_REAUTH_REQUIRED",
          "GITHUB_RATE_LIMITED",
        ].find((code) => message.includes(code)) ??
        (message.includes("CONFIGURATION")
          ? "GITHUB_CONFIGURATION_REQUIRED"
          : "GITHUB_CONTEXT_READ_FAILED");
      try {
        await ctx.runMutation(internal.integrations.github.context.commit, {
          ...a,
          excerpts: [],
          errorCode: code,
        });
      } catch {
        /* Current consent withdrawal prohibits persisting even a late read result. */
      }
    }
    return null;
  },
});
