import { afterEach, expect, test, vi } from "vitest";
import {
  config,
  push,
  release,
  installation,
  sourceFixture,
  send,
  signature,
} from "../../../tests/github-fixture";
import { mediaFixture } from "../../../tests/media-fixture";
import { api, internal } from "../../_generated/api";
import {
  parseEvent,
  readBody,
  verifySignature,
  MAX_BODY,
  receive,
} from "./webhook";
import type { ActionCtx } from "../../_generated/server";
async function processAll(f: Awaited<ReturnType<typeof mediaFixture>>) {
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
test("the actual webhook rejects an unsigned body before any domain write", async () => {
  config();
  const f = await mediaFixture();
  const response = await f.t.fetch("/integrations/github/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "00000000-0000-4000-8000-000000000001",
    },
    body: "{}",
  });
  expect(response.status).toBe(401);
});

test("exact Unicode and whitespace bytes, minimal facts, GUID conflict and changed-GUID replay", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture(2),
    body = JSON.stringify(push, null, 2),
    guid = crypto.randomUUID();
  expect(
    await verifySignature(
      new TextEncoder().encode(body),
      signature(body),
      "synthetic-secret",
    ),
  ).toBe(true);
  expect(
    (await send(f, body, "push", guid, signature(JSON.stringify(push)))).status,
  ).toBe(401);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubWebhookReceipts").collect()),
  ).toEqual([]);
  expect((await send(f, body, "push", guid)).status).toBe(202);
  expect((await send(f, { ...push, forced: true }, "push", guid)).status).toBe(
    409,
  );
  expect((await send(f, body, "push", crypto.randomUUID())).status).toBe(202);
  await processAll(f);
  // A signed reserialization of this same factual event must still deduplicate.
  expect(
    (await send(f, JSON.stringify(push), "push", crypto.randomUUID())).status,
  ).toBe(202);
  await processAll(f);
  const signals = await f.t.run((ctx) =>
    ctx.db.query("githubSignals").collect(),
  );
  expect(signals).toHaveLength(2);
  expect(new Set(signals.map((s) => s.workspaceId)).size).toBe(2);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubWebhookReceipts").collect()),
  ).toHaveLength(2);
  for (const table of ["githubWebhookReceipts", "githubSignals"] as const) {
    const stored = JSON.stringify(
      await f.t.run((ctx) => ctx.db.query(table).collect()),
    );
    for (const privateText of [
      "private secret",
      "not persisted",
      "private-file",
      "private release secret",
      "fixture-access",
    ])
      expect(stored).not.toContain(privateText);
  }
  for (const workspaceId of f.workspaces)
    expect(
      (
        await f.signed.query(api.content.signals.list, {
          workspaceId,
          paginationOpts: { cursor: null, numItems: 25 },
        })
      ).page,
    ).toHaveLength(1);
});
test("header reinterpretation and malformed/oversized body write nothing; published releases only", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  for (const [payload, event] of [
    [release, "github_app_authorization"],
    [release, "push"],
    [push, "release"],
    [
      {
        action: "revoked",
        sender: { id: 7, type: "User" },
        repository: push.repository,
      },
      "github_app_authorization",
    ],
    [{ ...push, installation: {} }, "push"],
  ] as const)
    expect((await send(f, payload, event)).status).toBe(400);
  expect((await send(f, "{")).status).toBe(400);
  expect((await send(f, " ".repeat(MAX_BODY + 1))).status).toBe(413);
  expect(
    (
      await send(
        f,
        push,
        "push",
        crypto.randomUUID(),
        "sha256=" + "0".repeat(64),
      )
    ).status,
  ).toBe(401);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubWebhookReceipts").collect()),
  ).toEqual([]);
  expect(
    (await send(f, { ...release, action: "created" }, "release")).status,
  ).toBe(204);
  expect((await send(f, release, "release")).status).toBe(202);
  await processAll(f);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").first()),
  ).toMatchObject({
    kind: "release",
    prerelease: true,
    providerAt: Date.parse(release.release.published_at),
    url: "https://github.com/fixture/project/releases/tag/v1.0.0",
  });
});
test("streamed actual byte cap and deadline work without Content-Length", async () => {
  vi.useFakeTimers();
  await expect(
    readBody(
      new Request("https://fixture.test", {
        method: "POST",
        body: new Uint8Array(11),
      }),
      10,
    ),
  ).rejects.toThrow("TOO_LARGE");
  const stream = new ReadableStream({ start() {} });
  const pending = expect(
    readBody(
      new Request("https://fixture.test", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
      10,
      20,
    ),
  ).rejects.toThrow("TIMEOUT");
  await vi.advanceTimersByTimeAsync(21);
  await pending;
});
test("durable-RPC budget never returns2xx for an unconfirmed commit; late committed receipt remains deduplicable", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture(),
    guid = crypto.randomUUID(),
    body = JSON.stringify(push);
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const runMutation = vi.fn((_ref, args) => {
    entered();
    return new Promise((resolve) => {
      setTimeout(
        async () =>
          resolve(
            await f.t.mutation(
              internal.integrations.github.deliveries.record,
              args,
            ),
          ),
        9000,
      );
    });
  });
  // Convex strips this internal test hook from its published declaration; this is the actual registered HTTP handler.
  const response = (
    receive as unknown as {
      _handler: (ctx: ActionCtx, request: Request) => Promise<Response>;
    }
  )._handler(
    { runMutation } as unknown as ActionCtx,
    new Request("https://fixture.test/integrations/github/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "push",
        "X-GitHub-Delivery": guid,
        "X-Hub-Signature-256": signature(body),
      },
      body,
    }),
  );
  await started;
  await vi.advanceTimersByTimeAsync(8501);
  expect((await response).status).toBe(503);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubWebhookReceipts").collect()),
  ).toEqual([]);
  await vi.advanceTimersByTimeAsync(501);
  await processAll(f);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubWebhookReceipts").collect()),
  ).toHaveLength(1);
  expect((await send(f, body, "push", guid)).status).toBe(202);
  await processAll(f);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toHaveLength(1);
});
test("bounded fanout resumes and deduplicates beyond its first25 independently entitled workspaces", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture(31);
  expect((await send(f)).status).toBe(202);
  const receipt = (await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  ))!;
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt._id,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toHaveLength(25);
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt._id,
  });
  await processAll(f);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toHaveLength(31);
  expect(await f.t.run((ctx) => ctx.db.get(receipt._id))).toMatchObject({
    state: "processed",
    processedCount: 31,
  });
});
test.each([
  "monitoring",
  "expired",
  "role",
  "lifecycle",
  "foreign",
  "private",
  "removed",
])("%s source cannot create factual signals", async (mode) => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  await f.t.run(async (ctx) => {
    const r = f.repositories[0];
    if (mode === "monitoring")
      await ctx.db.patch(r, { monitoring: false, content: false });
    if (mode === "expired")
      await ctx.db.patch(r, { proofExpiresAt: Date.now() - 1 });
    if (mode === "foreign") await ctx.db.patch(r, { installationId: "999" });
    if (mode === "private") await ctx.db.patch(r, { private: false });
    if (mode === "removed")
      await ctx.db.patch(r, { selected: false, generation: 2 });
    if (mode === "role") {
      const m = await ctx.db
        .query("memberships")
        .withIndex("by_userId_and_workspaceId", (q) =>
          q.eq("userId", f.userId).eq("workspaceId", f.workspaceId),
        )
        .unique();
      await ctx.db.patch(m!._id, { role: "Viewer" });
    }
    if (mode === "lifecycle")
      await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
  });
  expect((await send(f)).status).toBe(202);
  await processAll(f);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toEqual([]);
});
test("known GUID revocation replay is idempotent; identical-body new GUID after fresh grant conservatively closes again", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture(2);
  const body = {
    action: "revoked",
    sender: { id: 7, type: "User", login: "fixture" },
  };
  const guid = crypto.randomUUID();
  expect((await send(f, body, "github_app_authorization", guid)).status).toBe(
    202,
  );
  await expect(
    f.t.query(internal.integrations.github.repositories.source, {
      workspaceId: f.workspaceId,
      repositoryId: f.repositories[0],
      generation: 1,
      purpose: "monitoring",
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
  const state = {
    workspaceId: f.workspaceId,
    userId: f.userId,
    digest: "new-human",
    generation: 1,
    redirectUri: "https://dispatch.example/integrations/github/callback",
    expiresAt: Date.now() + 600000,
    status: "claimed" as const,
    revocationSequence: 1,
  };
  const stateId = await f.t.run((ctx) =>
    ctx.db.insert("githubOAuthStates", state),
  );
  await f.signed.mutation(internal.integrations.github.repositories.complete, {
    workspaceId: f.workspaceId,
    stateId,
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
  });
  expect((await send(f, body, "github_app_authorization", guid)).status).toBe(
    202,
  );
  await processAll(f);
  const c = await f.t.run((ctx) =>
    ctx.db
      .query("githubConnections")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", f.workspaceId))
      .unique(),
  );
  expect(c).toMatchObject({ status: "connected", authorizedSequence: 1 });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("githubRevocationBarriers")
        .withIndex("by_key", (q) => q.eq("key", "user:7"))
        .unique(),
    ),
  ).toMatchObject({ sequence: 1 });
  expect(
    (await send(f, body, "github_app_authorization", crypto.randomUUID()))
      .status,
  ).toBe(202);
  await expect(
    f.signed.query(internal.integrations.github.repositories.credential, {
      workspaceId: f.workspaceId,
    }),
  ).rejects.toThrow("AUTHORIZATION_REVOKED");
  await processAll(f);
  expect(await f.t.run((ctx) => ctx.db.get(c!._id))).toMatchObject({
    status: "reauth_required",
    errorCode: "GITHUB_REVOCATION_RECHECK_REQUIRED",
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("githubWebhookReceipts").first()),
  ).toMatchObject({ revocationSequence: 2, ambiguousRevocation: true });
});
test("empty all-to-selected removal blocks late discovery, fresh explicit resync works and added doesn't restore", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  const begin = () =>
    f.signed.mutation(
      internal.integrations.github.repositories.beginDiscovery,
      {
        workspaceId: f.workspaceId,
        generation: 1,
        credentialGeneration: 1,
        installationId: "50",
        selectId: "101",
      },
    );
  const old = await begin();
  const revoked = {
    action: "removed",
    installation,
    repository_selection: "selected",
    repositories_added: [],
    repositories_removed: [],
    sender: { id: 7 },
  };
  expect((await send(f, revoked, "installation_repositories")).status).toBe(
    202,
  );
  const verify = (b: Awaited<ReturnType<typeof begin>>) =>
    f.signed.mutation(internal.integrations.github.repositories.verify, {
      workspaceId: f.workspaceId,
      generation: 1,
      credentialGeneration: 1,
      installationId: "50",
      selectId: "101",
      ...b,
      repositories: [
        {
          providerId: "101",
          installationId: "50",
          fullName: "fixture/project",
          private: true,
        },
      ],
      complete: true,
    });
  await expect(verify(old)).rejects.toThrow("SOURCE_CHANGED");
  await processAll(f);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.repositories[0])))!.monitoring,
  ).toBe(false);
  expect(
    (
      await send(
        f,
        { ...revoked, action: "added", repositories_added: [{ id: 101 }] },
        "installation_repositories",
      )
    ).status,
  ).toBe(204);
  const fresh = await begin();
  await verify(fresh);
  const r = (await f.t.run((ctx) => ctx.db.get(f.repositories[0])))!;
  expect(r).toMatchObject({
    verifiedSequence: 1,
    monitoring: false,
    content: false,
  });
  await f.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: r._id,
    expectedGeneration: r.generation,
    access: true,
    monitoring: true,
    content: false,
    communicableContext: "Human restored purpose",
  });
  await expect(
    f.t.query(internal.integrations.github.repositories.source, {
      workspaceId: f.workspaceId,
      repositoryId: r._id,
      generation: r.generation + 1,
      purpose: "monitoring",
    }),
  ).resolves.toMatchObject({ providerId: "101" });
  expect(
    parseEvent("installation", { action: "unsuspend", installation }),
  ).toBe(null);
});
