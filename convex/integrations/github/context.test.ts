import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { api, internal, components } from "../../_generated/api";
import {
  sourceFixture,
  send,
  push,
  release,
} from "../../../tests/github-fixture";
import { modelFixture } from "../../../tests/model-fixture";
import { base64 } from "../../lib/crypto";
import { selectedPatches } from "./contextRead";
import type { Doc, Id } from "../../_generated/dataModel";
const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const patch =
  "@@ -1 +1 @@\n-export const name = 'old';\n+export const name = 'new';";
function comparison() {
  return {
    status: "ahead",
    total_commits: 1,
    base_commit: { sha: push.before },
    merge_base_commit: { sha: push.before },
    commits: [
      {
        sha: push.after,
        commit: { message: "raw private message never persisted" },
      },
    ],
    files: [
      {
        filename: "src/example.ts",
        sha: "3".repeat(40),
        status: "modified",
        patch,
        additions: 1,
        deletions: 1,
      },
    ],
  };
}
async function fixture(payload: unknown = push, event = "push") {
  const f = await sourceFixture(2);
  await send(f, payload, event);
  const receipt = await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  );
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt!._id,
  });
  const signal = await f.t.run((ctx) =>
    ctx.db
      .query("githubSignals")
      .withIndex("by_workspaceId_and_receivedAt", (q) =>
        q.eq("workspaceId", f.workspaceId),
      )
      .first(),
  );
  await f.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: f.repositories[0],
    expectedGeneration: 1,
    access: true,
    monitoring: true,
    content: true,
    contextRead: true,
    communicableContext: "selected patch consent",
  });
  vi.stubEnv("GITHUB_APP_CLIENT_ID", "synthetic-client");
  vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "synthetic-secret");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", privateKey);
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "synthetic");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", base64(new Uint8Array(32).fill(1)));
  const args = {
    workspaceId: f.workspaceId,
    signalId: signal!._id,
    expectedGeneration: 2,
    paths: ["src/example.ts"],
    operationKey: "context-one",
  };
  const contextId = await f.signed.mutation(
    api.integrations.github.context.request,
    args,
  );
  return { ...f, signal: signal!, args, contextId };
}
function github(data = comparison(), onCompare?: () => Promise<void>) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, options) => {
      expect(options?.redirect).toBe("error");
      const u = new URL(String(url));
      expect(u.hostname).toBe("api.github.com");
      if (u.pathname === "/app/installations/50/access_tokens") {
        expect(JSON.parse(String(options?.body))).toEqual({
          repository_ids: [101],
          permissions: { metadata: "read", contents: "read" },
        });
        return Response.json({
          token: "synthetic-installation-token",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          permissions: { metadata: "read", contents: "read" },
          repositories: [{ id: 101 }],
        });
      }
      expect(u.pathname).toBe(
        `/repos/fixture/project/compare/${push.before}...${push.after}`,
      );
      expect(u.search).toBe("");
      expect(options?.method).toBe("GET");
      await onCompare?.();
      return Response.json(data);
    });
}
async function ready() {
  const f = await fixture();
  const spy = github();
  await f.t.action(internal.integrations.github.contextRead.load, {
    contextId: f.contextId,
  });
  spy.mockRestore();
  return f;
}
async function row(f: Awaited<ReturnType<typeof fixture>>) {
  return (await f.t.run((ctx) => ctx.db.get(f.contextId)))!;
}
async function approve(f: Awaited<ReturnType<typeof fixture>>) {
  return f.signed.mutation(api.integrations.github.context.approve, {
    workspaceId: f.workspaceId,
    contextId: f.contextId,
    expectedHash: (await row(f)).hash,
    approved: true,
  });
}
async function generative() {
  const f = await ready();
  const m = await modelFixture(f);
  await f.t.run(async (ctx) => {
    for (const p of await ctx.db.query("aiPolicies").collect())
      await ctx.db.patch(p._id, { purposes: ["summary", "draft"] });
    for (const b of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(b._id, { purposes: ["summary", "draft"] });
  });
  await approve(f);
  const runId = await f.signed.mutation(
    api.integrations.github.context.summarize,
    {
      workspaceId: f.workspaceId,
      contextId: f.contextId,
      expectedHash: (await row(f)).hash,
      accountId: m.accountId,
    },
  );
  return { ...f, ...m, runId };
}
const result = (decision = "relevant") => ({
  decision,
  summary: "Selected patch changes a name; outcome remains unproven.",
  rationale: "An editorial question can explore this shown change.",
  novelty: "Unknown: no history comparison was provided.",
  uncertainty:
    "Uncalibrated interpretation of one selected patch, no full repository coverage.",
  references: ["src/example.ts"],
  evidence: [{ path: "src/example.ts", quote: "+export const name = 'new';" }],
  title: decision === "relevant" ? "Naming tradeoffs" : "",
  perspective:
    decision === "relevant" ? "What naming criteria help maintainers?" : "",
  questions: decision === "relevant" ? ["Why was this changed?"] : [],
});
async function model(
  f: Awaited<ReturnType<typeof generative>>,
  p: Record<string, unknown> = result(),
  during?: () => Promise<void>,
  fail = false,
) {
  vi.stubEnv("REQUESTY_API_KEY", "synthetic-only");
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, options) => {
      expect(String(url)).toBe(
        "https://router.eu.requesty.ai/v1/chat/completions",
      );
      expect(options?.redirect).toBe("error");
      const attempts = await f.t.run((ctx) =>
        ctx.db
          .query("aiAttempts")
          .withIndex("by_runId_and_key", (q) => q.eq("runId", f.runId))
          .collect(),
      );
      expect(attempts).toHaveLength(1);
      expect(attempts[0].state).toBe("sent");
      expect(attempts[0].heldMicros).toBeGreaterThan(0);
      expect(String(options?.body)).toContain(patch.split("\n")[1]);
      expect(String(options?.body)).not.toContain("raw private message");
      await during?.();
      if (fail) throw Error("synthetic secret transport failure");
      return Response.json({
        id: "synthetic",
        object: "chat.completion",
        created: 1,
        model: "synthetic/model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({ text: JSON.stringify(p) }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    });
  await f.t.action(internal.ai.provider.execute, { runId: f.runId });
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
}
test("exact historical signed signal gets separate current admission, native contents token, selected patch hash and idempotent command; original facts stay unchanged", async () => {
  const f = await ready();
  const c = await row(f);
  expect(c.state).toBe("ready");
  expect(c.generation).toBe(2);
  expect(c.excerpts[0].patch).toBe(patch);
  expect(c.hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(
    await f.signed.mutation(api.integrations.github.context.request, f.args),
  ).toBe(c._id);
  expect(await f.t.run((ctx) => ctx.db.get(f.signal._id))).toEqual(f.signal);
  expect(JSON.stringify(c)).not.toContain("raw private message");
  await expect(
    f.signed.mutation(api.integrations.github.context.request, {
      ...f.args,
      paths: ["README.md"],
    }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  await expect(
    f.signed.mutation(api.content.ideas.create, {
      workspaceId: f.workspaceId,
      title: "old",
      perspective: "current?",
      note: "",
      priority: "normal",
      source: { kind: "signal", signalId: f.signal._id },
      operationKey: "old-signal",
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
});
test("hash mismatch, missing per-repository read consent and foreign workspace cannot admit or approve context", async () => {
  const f = await ready();
  await expect(
    f.signed.mutation(api.integrations.github.context.approve, {
      workspaceId: f.workspaceId,
      contextId: f.contextId,
      expectedHash: "fake",
      approved: true,
    }),
  ).rejects.toThrow("CONTEXT_CHANGED");
  await expect(
    f.signed.query(api.integrations.github.context.latest, {
      workspaceId: f.workspaces[1],
      signalId: f.signal._id,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS");
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { contextRead: false }),
  );
  await expect(
    f.signed.mutation(api.integrations.github.context.request, {
      ...f.args,
      operationKey: "another-key",
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
  expect(
    await f.signed.query(api.integrations.github.context.latest, {
      workspaceId: f.workspaceId,
      signalId: f.signal._id,
    }),
  ).toEqual([]);
});
test("release tag is not signed commit evidence and cannot cause a token or model call", async () => {
  const f = await fixture(release, "release");
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(Error("must not call"));
  await f.t.action(internal.integrations.github.contextRead.load, {
    contextId: f.contextId,
  });
  expect(spy).not.toHaveBeenCalled();
  expect((await row(f)).state).toBe("needs_context");
});
test("missing App key has visible failed configuration receipt without fabricated context", async () => {
  const f = await fixture();
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
  const spy = vi.spyOn(globalThis, "fetch");
  await f.t.action(internal.integrations.github.contextRead.load, {
    contextId: f.contextId,
  });
  expect(spy).not.toHaveBeenCalled();
  expect(await row(f)).toMatchObject({
    state: "failed",
    errorCode: "GITHUB_APP_PRIVATE_KEY_REQUIRED",
    excerpts: [],
  });
});
test.each([
  "binary",
  "secret",
  "renamed-secret",
  "truncated",
  "compare-limit",
  "wrong-head",
])(
  "%s compare leaves needs_context without retaining unsafe content",
  async (kind) => {
    const f = await fixture();
    const data = comparison();
    if (kind === "binary")
      delete (data.files[0] as Partial<(typeof data.files)[0]>).patch;
    if (kind === "secret")
      data.files[0].patch = "@@ -0,0 +1 @@\n+api_key = 'synthetic-secret'";
    if (kind === "renamed-secret") {
      data.files[0].status = "renamed";
      Object.assign(data.files[0], { previous_filename: ".env" });
    }
    if (kind === "truncated")
      data.files[0].patch = "@@ -1,2 +1,2 @@\n-old\n+new";
    if (kind === "compare-limit") data.total_commits = 251;
    if (kind === "wrong-head") data.commits[0].sha = "f".repeat(40);
    github(data);
    await f.t.action(internal.integrations.github.contextRead.load, {
      contextId: f.contextId,
    });
    expect(await row(f)).toMatchObject({
      state: "needs_context",
      excerpts: [],
      errorCode: "GITHUB_CONTEXT_COVERAGE_UNSAFE",
    });
  },
);
test("credential changes during fixed compare fence result and all later reads", async () => {
  const f = await fixture();
  github(comparison(), async () => {
    await f.t.run(async (ctx) => {
      const c = await ctx.db
        .query("githubConnections")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", f.workspaceId))
        .unique();
      await ctx.db.patch(c!._id, { credentialGeneration: 2 });
    });
  });
  await f.t.action(internal.integrations.github.contextRead.load, {
    contextId: f.contextId,
  });
  expect((await row(f)).excerpts).toEqual([]);
  await expect(
    f.t.query(internal.integrations.github.context.read, {
      contextId: f.contextId,
    }),
  ).rejects.toThrow("CONTEXT_CHANGED");
});
test("maintenance summary through actual official Agent is funded before fixed physical call and creates no idea/draft", async () => {
  const f = await generative();
  await model(f, result("maintenance"));
  expect(await row(f)).toMatchObject({
    decision: "maintenance",
    resultIdeaId: null,
  });
  expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.query("drafts").collect())).toEqual([]);
  expect((await f.t.run((ctx) => ctx.db.get(f.runId)))!.state).toBe(
    "completed",
  );
});
test("relevant actual funded result creates one immutable context-bound idea and explicit reviewed handoff yields actual draft only", async () => {
  const f = await generative();
  await model(f);
  const c = await row(f);
  expect(c.resultIdeaId).not.toBeNull();
  const ideaId = c.resultIdeaId!;
  const idea = (
    await f.signed.query(api.content.ideas.list, {
      workspaceId: f.workspaceId,
      paginationOpts: { numItems: 10, cursor: null },
    })
  ).page[0];
  expect(idea.version.source).toEqual({ kind: "context", contextId: c._id });
  expect(idea.version.originals[0]).toContain(push.after);
  expect(idea.version.rationale).toBe(result().rationale);
  expect(idea.version.questions).toEqual(result().questions);
  expect(
    await f.signed.mutation(api.integrations.github.context.summarize, {
      workspaceId: f.workspaceId,
      contextId: c._id,
      expectedHash: c.hash,
      accountId: f.accountId,
    }),
  ).toBe(f.runId);
  const h = await f.signed.mutation(api.content.ideas.handoff, {
    workspaceId: f.workspaceId,
    ideaId,
    expectedRevision: 1,
    accountId: null,
    intent: "Editable reviewed text",
    draftText: "Human reviewed naming question",
    clarificationConfirmed: true,
  });
  expect(h.draftId).toBeTruthy();
  expect(await f.t.run((ctx) => ctx.db.query("approvals").collect())).toEqual(
    [],
  );
  expect(await f.t.run((ctx) => ctx.db.query("schedules").collect())).toEqual(
    [],
  );
});
test("provider failure preserves original signed facts and unknown liability with no output or automatic paid retry", async () => {
  const f = await generative();
  await model(f, result(), undefined, true);
  expect(await f.t.run((ctx) => ctx.db.get(f.signal._id))).toEqual(f.signal);
  expect((await row(f)).resultIdeaId).toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(f.runId)))!.state).toBe("failed");
  const attempts = await f.t.run((ctx) => ctx.db.query("aiAttempts").collect());
  expect(attempts[0].state).toBe("unknown");
  expect(attempts[0].heldMicros).toBeGreaterThan(0);
});
test.each(["withdraw", "role", "stop", "account", "source", "credential"])(
  "%s after send prevents late idea while safe usage settles once",
  async (kind) => {
    const f = await generative();
    await model(f, result(), async () => {
      if (kind === "withdraw")
        await f.signed.mutation(api.integrations.github.context.approve, {
          workspaceId: f.workspaceId,
          contextId: f.contextId,
          expectedHash: (await row(f)).hash,
          approved: false,
        });
      if (kind === "stop")
        await f.signed.mutation(api.ai.runs.stop, {
          workspaceId: f.workspaceId,
          runId: f.runId,
        });
      if (kind === "role")
        await f.t.run(async (ctx) => {
          const m = await ctx.db
            .query("memberships")
            .withIndex("by_userId_and_workspaceId", (q) =>
              q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
            )
            .unique();
          await ctx.db.patch(m!._id, { role: "Viewer" });
        });
      if (kind === "source")
        await f.t.run((ctx) =>
          ctx.db.patch(f.repositories[0], {
            contextRead: false,
            generation: 3,
          }),
        );
      if (kind === "credential")
        await f.t.run(async (ctx) => {
          const c = await ctx.db
            .query("githubConnections")
            .withIndex("by_workspaceId", (q) =>
              q.eq("workspaceId", f.workspaceId),
            )
            .unique();
          await ctx.db.patch(c!._id, { credentialGeneration: 2 });
        });
      if (kind === "account")
        await f.t.run((ctx) =>
          ctx.db.patch(f.accountId, { connection: "disconnected" }),
        );
    });
    expect((await row(f)).resultIdeaId).toBeNull();
    const attempts = await f.t.run((ctx) =>
      ctx.db.query("aiAttempts").collect(),
    );
    expect(attempts[0].state).toBe("settled");
    expect(attempts[0].estimatedMicros).toBe(30);
    expect(await f.t.run((ctx) => ctx.db.query("ideas").collect())).toEqual([]);
  },
);
test("missing model policy never consumes approved context or loses signal, and forbidden output references never create an idea", async () => {
  const f = await ready();
  await approve(f);
  await expect(
    f.signed.mutation(api.integrations.github.context.summarize, {
      workspaceId: f.workspaceId,
      contextId: f.contextId,
      expectedHash: (await row(f)).hash,
      accountId: await f.t.run((ctx) =>
        ctx.db.insert("socialAccounts", {
          workspaceId: f.workspaceId,
          provider: "X",
          providerIdentity: "synthetic",
          name: "Synthetic",
          handle: "@synthetic",
          connection: "connected",
          capability: {
            maxText: 280,
            maxThread: 10,
            maxMedia: 4,
            mediaTypes: [],
            publish: false,
          },
        }),
      ),
    }),
  ).rejects.toThrow("PROCESSING_CONFIGURATION");
  expect((await row(f)).runId).toBeNull();
  const g = await generative();
  await model(g, { ...result(), references: ["unapproved.ts"] });
  expect((await row(g)).resultIdeaId).toBeNull();
  expect((await g.t.run((ctx) => ctx.db.get(g.runId)))!.state).toBe("failed");
});

test.each(["forced", "created", "deleted", "zero", "diverged"])(
  "%s input cannot pretend exact signed push context",
  async (kind) => {
    const payload = structuredClone(push);
    if (kind === "forced") payload.forced = true;
    if (kind === "created") payload.created = true;
    if (kind === "deleted") payload.deleted = true;
    if (kind === "zero") payload.before = "0".repeat(40);
    const f = await fixture(payload);
    const data = comparison();
    if (kind === "diverged") data.merge_base_commit.sha = "f".repeat(40);
    const spy = github(data);
    await f.t.action(internal.integrations.github.contextRead.load, {
      contextId: f.contextId,
    });
    expect((await row(f)).state).toBe("needs_context");
    if (kind !== "diverged") expect(spy).not.toHaveBeenCalled();
  },
);
test("fabricated evidence and forbidden publish field are rejected despite a valid paid response", async () => {
  for (const invalid of [
    {
      ...result(),
      evidence: [{ path: "src/example.ts", quote: "invented achievement" }],
    },
    { ...result(), publish: true },
  ]) {
    const f = await generative();
    await model(f, invalid);
    expect((await row(f)).resultIdeaId).toBeNull();
    expect((await f.t.run((ctx) => ctx.db.get(f.runId)))!.state).toBe("failed");
    vi.restoreAllMocks();
  }
});
