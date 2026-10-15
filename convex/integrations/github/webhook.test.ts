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
test.each([0, -60000])(
  "a purpose granted after receipt cannot auto-admit at clock offset %i",
  async (offset) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    const f = await sourceFixture();
    const configure = (generation: number, monitoring: boolean) =>
      f.signed.mutation(api.integrations.github.repositories.configure, {
        workspaceId: f.workspaceId,
        repositoryId: f.repositories[0],
        expectedGeneration: generation,
        access: true,
        monitoring,
        content: false,
        communicableContext: "Explicit purpose",
      });
    await configure(1, false);
    const guid = crypto.randomUUID();
    const receivedAt = Date.now();
    expect((await send(f, push, "push", guid)).status).toBe(202);
    vi.setSystemTime(Date.now() + offset);
    await configure(2, true);
    const receipt = (await f.t.run((ctx) =>
      ctx.db.query("githubWebhookReceipts").first(),
    ))!;
    await f.t.mutation(internal.integrations.github.deliveries.process, {
      receiptId: receipt._id,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
    ).toHaveLength(0);
    // A signed reserialization is still the original event, not renewed permission.
    expect((await send(f, JSON.stringify(push, null, 2))).status).toBe(202);
    await processAll(f);
    expect(
      await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
    ).toHaveLength(0);
    await f.t.mutation(internal.integrations.github.recoveryState.track, {
      delivery: {
        guid,
        deliveryId: "1",
        event: "push",
        providerId: "101",
        installationId: "50",
        deliveredAt: receivedAt,
        providerStatus: 503,
      },
      cursor: null,
    });
    const recovery = (await f.t.run((ctx) =>
      ctx.db.query("githubRecoveries").first(),
    ))!;
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(Error("No provider call"));
    const args = {
      workspaceId: f.workspaceId,
      recoveryId: recovery._id,
      expectedGeneration: 3,
    };
    await expect(
      f.signed.action(api.integrations.github.recovery.redeliver, {
        ...args,
        expectedGeneration: 2,
      }),
    ).rejects.toThrow("SOURCE_DISABLED");
    await f.signed.action(api.integrations.github.recovery.redeliver, args);
    await expect(
      f.signed.action(api.integrations.github.recovery.redeliver, args),
    ).rejects.toThrow("ALREADY_PROCESSED");
    expect(fetcher).not.toHaveBeenCalled();
    const signals = await f.t.run((ctx) =>
      ctx.db.query("githubSignals").collect(),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      receivedAt,
      providerAt: null,
      explicitRecovery: { actorId: f.userId, recoveryId: recovery._id },
    });
    expect(await f.t.run((ctx) => ctx.db.get(recovery._id))).toMatchObject({
      state: "processed",
      attempts: 0,
    });
  },
);
test.each(["source", "receipt", "both"])(
  "unordered legacy %s requires explicit local recovery, including reserialization",
  async (legacy) => {
    vi.useFakeTimers();
    const f = await sourceFixture(),
      guid = crypto.randomUUID();
    expect((await send(f, push, "push", guid)).status).toBe(202);
    const receipt = (await f.t.run((ctx) =>
      ctx.db.query("githubWebhookReceipts").first(),
    ))!;
    await f.t.run(async (ctx) => {
      if (legacy !== "receipt")
        await ctx.db.patch(f.repositories[0], { purposeSequence: undefined });
      if (legacy !== "source")
        await ctx.db.patch(receipt._id, { admissionSequence: undefined });
    });
    expect((await send(f, JSON.stringify(push, null, 2))).status).toBe(202);
    await processAll(f);
    expect(
      await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
    ).toHaveLength(0);
    await f.t.mutation(internal.integrations.github.recoveryState.track, {
      delivery: {
        guid,
        deliveryId: "1",
        event: "push",
        providerId: "101",
        installationId: "50",
        deliveredAt: receipt.receivedAt,
        providerStatus: 503,
      },
      cursor: null,
    });
    const r = (await f.t.run((ctx) =>
      ctx.db.query("githubRecoveries").first(),
    ))!;
    await f.signed.action(api.integrations.github.recovery.redeliver, {
      workspaceId: f.workspaceId,
      recoveryId: r._id,
      expectedGeneration: 1,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
    ).toHaveLength(1);
  },
);
test("a purpose granted before receipt remains ordered across clock rollback", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  await f.signed.mutation(api.integrations.github.repositories.configure, {
    workspaceId: f.workspaceId,
    repositoryId: f.repositories[0],
    expectedGeneration: 1,
    access: true,
    monitoring: true,
    content: false,
    communicableContext: "Explicit renewed purpose",
  });
  const source = (await f.t.run((ctx) => ctx.db.get(f.repositories[0])))!;
  vi.setSystemTime(Date.now() - 60000);
  expect((await send(f)).status).toBe(202);
  await processAll(f);
  const receipt = (await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  ))!;
  expect(source.purposeSequence).toBeLessThan(receipt.admissionSequence!);
  expect(receipt.revocationSequence).toBe(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toHaveLength(1);
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
test("revoke_user flag cleanup resumes across invocations while the barrier bites immediately", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  // 30 selected repositories: one 25-repository slice cannot finish them.
  await f.t.run(async (ctx) => {
    for (let n = 1; n < 30; n++)
      await ctx.db.insert("githubRepositories", {
        workspaceId: f.workspaceId,
        providerId: `20${n}`,
        installationId: "50",
        fullName: `fixture/project-${n}`,
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
      });
  });
  const body = {
    action: "revoked",
    sender: { id: 7, type: "User", login: "fixture" },
  };
  expect(
    (await send(f, body, "github_app_authorization", crypto.randomUUID()))
      .status,
  ).toBe(202);
  // The durable barrier applies in record, before any process invocation.
  await expect(
    f.t.query(internal.integrations.github.repositories.source, {
      workspaceId: f.workspaceId,
      repositoryId: f.repositories[0],
      generation: 1,
      purpose: "monitoring",
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
  const receipt = (await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  ))!;
  const flags = () =>
    f.t.run(async (ctx) => {
      const rows = await ctx.db
        .query("githubRepositories")
        .withIndex("by_workspaceId_and_selected", (q) =>
          q.eq("workspaceId", f.workspaceId).eq("selected", true),
        )
        .collect();
      return {
        open: rows.filter((r) => r.monitoring || r.access).length,
        closed: rows.filter((r) => !r.monitoring && !r.access).length,
      };
    });
  // First step flags the connection and checkpoints; no repository page yet
  // (only one paginated query runs per invocation).
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt._id,
  });
  expect(await flags()).toMatchObject({ open: 30, closed: 0 });
  expect(await f.t.run((ctx) => ctx.db.get(receipt._id))).toMatchObject({
    state: "pending",
    processedCount: 0,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(receipt._id)))!.cursor,
  ).not.toBeNull();
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("githubConnections")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", f.workspaceId))
        .unique(),
    ),
  ).toMatchObject({ status: "reauth_required" });
  // Second invocation closes the first 25-repository slice.
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt._id,
  });
  expect(await flags()).toMatchObject({ open: 5, closed: 25 });
  expect(await f.t.run((ctx) => ctx.db.get(receipt._id))).toMatchObject({
    state: "pending",
    processedCount: 0,
  });
  // Third invocation finishes the remaining flags.
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt._id,
  });
  expect(await flags()).toMatchObject({ open: 0, closed: 30 });
  expect(await f.t.run((ctx) => ctx.db.get(receipt._id))).toMatchObject({
    state: "pending",
    processedCount: 1,
  });
  await processAll(f);
  expect(await f.t.run((ctx) => ctx.db.get(receipt._id))).toMatchObject({
    state: "processed",
    processedCount: 1,
    cursor: null,
  });
});
test("revoke_user for an unknown identity completes instead of reprocessing the empty scan", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  const body = {
    action: "revoked",
    sender: { id: 999, type: "User", login: "stranger" },
  };
  expect(
    (await send(f, body, "github_app_authorization", crypto.randomUUID()))
      .status,
  ).toBe(202);
  await processAll(f);
  // The !target branch advances with the page cursor (null when done) so the
  // outer scan terminates instead of looping on a stale cursor.
  expect(
    await f.t.run((ctx) => ctx.db.query("githubWebhookReceipts").first()),
  ).toMatchObject({ state: "processed", cursor: null });
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
  expect(r.purposeSequence).toBeGreaterThan(f.repositories.length);
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
test("retention sweep deletes only unreferenced old processed receipts and GUIDs", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  const oldGuid = crypto.randomUUID();
  const freshGuid = crypto.randomUUID();
  expect((await send(f, push, "push", oldGuid)).status).toBe(202);
  expect(
    (await send(f, { ...push, after: "3".repeat(40) }, "push", freshGuid))
      .status,
  ).toBe(202);
  await processAll(f);
  // A blocked receipt processes without producing any signal.
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { monitoring: false, content: false }),
  );
  const unreferencedGuid = crypto.randomUUID();
  expect(
    (
      await send(
        f,
        { ...push, after: "5".repeat(40) },
        "push",
        unreferencedGuid,
      )
    ).status,
  ).toBe(202);
  await processAll(f);
  const receipts = await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").collect(),
  );
  expect(receipts).toHaveLength(3);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toHaveLength(2);
  const old = receipts.find((r) => r.guid === oldGuid)!;
  const fresh = receipts.find((r) => r.guid === freshGuid)!;
  const unreferenced = receipts.find((r) => r.guid === unreferencedGuid)!;
  expect(old.state).toBe("processed");
  expect(unreferenced.state).toBe("processed");
  // Age both processed receipts past retention; only the signal-referenced
  // one must survive.
  await f.t.run(async (ctx) => {
    for (const id of [old._id, unreferenced._id])
      await ctx.db.patch(id, { latestReceivedAt: Date.now() - 31 * 86400000 });
  });
  // An old but still-pending receipt is never swept.
  const pendingGuid = crypto.randomUUID();
  expect(
    (await send(f, { ...push, after: "4".repeat(40) }, "push", pendingGuid))
      .status,
  ).toBe(202);
  const pending = (
    await f.t.run((ctx) => ctx.db.query("githubWebhookReceipts").collect())
  ).find((r) => r.guid === pendingGuid)!;
  expect(pending.state).toBe("pending");
  await f.t.run((ctx) =>
    ctx.db.patch(pending._id, {
      latestReceivedAt: Date.now() - 31 * 86400000,
    }),
  );
  await f.t.mutation(internal.integrations.github.deliveries.sweep, {
    cursor: null,
  });
  // Referenced old receipt and its GUID survive; unreferenced one is gone.
  expect(await f.t.run((ctx) => ctx.db.get(old._id))).not.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(unreferenced._id))).toBeNull();
  const guidRow = (guid: string) =>
    f.t.run((ctx) =>
      ctx.db
        .query("githubDeliveryGuids")
        .withIndex("by_guid", (q) => q.eq("guid", guid))
        .unique(),
    );
  expect(await guidRow(oldGuid)).not.toBeNull();
  expect(await guidRow(unreferencedGuid)).toBeNull();
  expect(await guidRow(freshGuid)).not.toBeNull();
  expect(await guidRow(pendingGuid)).not.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(fresh._id))).not.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(pending._id))).not.toBeNull();
  // Signals are never touched by the sweep.
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toHaveLength(2);
});
