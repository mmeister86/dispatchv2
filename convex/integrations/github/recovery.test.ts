import { afterEach, expect, test, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { api, internal, components } from "../../_generated/api";
import {
  sourceFixture,
  send,
  push,
  release,
} from "../../../tests/github-fixture";
import { deliveryRequest, deliveryMetadata } from "./recovery";
function config() {
  vi.stubEnv("GITHUB_APP_CLIENT_ID", "fixture-client");
  const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv(
    "GITHUB_APP_PRIVATE_KEY",
    key.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  );
}
function delivery(
  guid: string,
  event = "push",
  id = 1,
  repositoryId = 101,
  status: number | null = null,
) {
  return {
    id,
    guid,
    event,
    action: event === "release" ? "published" : null,
    installation_id: 50,
    repository_id: repositoryId,
    delivered_at: new Date().toISOString(),
    status_code: status,
    redelivery: false,
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
test.each(["push", "release"])(
  "receiver outage %s: scoped JWT detection,202 stays awaiting,actual signed redelivery produces one signal",
  async (event) => {
    vi.useFakeTimers();
    const f = await sourceFixture(2);
    config();
    const guid = crypto.randomUUID(),
      payload = event === "push" ? push : release;
    const calls: string[] = [];
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        calls.push(`${init?.method} ${url.pathname}`);
        expect(url.origin).toBe("https://api.github.com");
        expect(init?.redirect).toBe("error");
        const authorization = new Headers(init?.headers).get("Authorization")!;
        const jwt = authorization.slice(7).split(".");
        expect(jwt).toHaveLength(3);
        expect(
          JSON.parse(Buffer.from(jwt[1], "base64url").toString()),
        ).toMatchObject({ iss: "fixture-client" });
        if (url.pathname === "/app/hook/deliveries") {
          expect(url.searchParams.get("per_page")).toBe("100");
          expect(url.searchParams.has("status")).toBe(false);
          return Response.json([
            delivery(guid, event),
            delivery(crypto.randomUUID(), event, 2, 999, 500),
          ]);
        }
        expect(url.pathname).toBe("/app/hook/deliveries/1/attempts");
        return new Response(null, { status: 202 });
      });
    await f.signed.action(api.integrations.github.recovery.detect, {
      workspaceId: f.workspaceId,
    });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const rows = await f.t.run((ctx) =>
      ctx.db.query("githubRecoveries").collect(),
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.workspaceId)).size).toBe(2);
    expect(rows.every((r) => r.guid === guid)).toBe(true);
    const row = rows.find((r) => r.workspaceId === f.workspaceId)!;
    await expect(
      f.signed.action(api.integrations.github.recovery.redeliver, {
        expectedGeneration: 1,
        workspaceId: f.workspaceId,
        recoveryId: rows.find((r) => r.workspaceId !== f.workspaceId)!._id,
      }),
    ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
    await f.signed.action(api.integrations.github.recovery.redeliver, {
      expectedGeneration: 1,
      workspaceId: f.workspaceId,
      recoveryId: row._id,
    });
    expect(await f.t.run((ctx) => ctx.db.get(row._id))).toMatchObject({
      state: "accepted",
      attempts: 1,
    });
    expect(
      await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
    ).toEqual([]);
    await expect(
      f.signed.action(api.integrations.github.recovery.redeliver, {
        expectedGeneration: 1,
        workspaceId: f.workspaceId,
        recoveryId: row._id,
      }),
    ).rejects.toThrow("NOT_READY");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await send(f, payload, event, guid)).status).toBe(202);
    expect((await send(f, payload, event, guid)).status).toBe(202);
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(
      await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
    ).toHaveLength(2);
    expect(await f.t.run((ctx) => ctx.db.get(row._id))).toMatchObject({
      state: "processed",
      attempts: 1,
    });
    expect(calls).toEqual([
      "GET /app/hook/deliveries",
      "POST /app/hook/deliveries/1/attempts",
    ]);
  },
);
test("failed detection scope stays isolated, duplicate attempts group byGUID and null/zero/success-without-local-receipt remain visible", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  config();
  const guid = crypto.randomUUID(),
    oldAt = Date.now() - 2 * 86400000;
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json([
      delivery(guid),
      delivery(guid, "push", 2, 101, 500),
      delivery(crypto.randomUUID(), "push", 3, 101, 0),
      delivery(crypto.randomUUID(), "release", 4, 101, 200),
      { ...delivery(crypto.randomUUID(), "release", 5), action: "created" },
      {
        ...delivery(crypto.randomUUID(), "push", 6),
        delivered_at: new Date(oldAt).toISOString(),
      },
    ]),
  );
  await f.t.action(internal.integrations.github.recovery.scan, {});
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  const rows = await f.t.run((ctx) =>
    ctx.db.query("githubRecoveries").collect(),
  );
  expect(rows).toHaveLength(3);
  expect(rows.filter((r) => r.guid === guid)).toHaveLength(1);
  expect(rows.some((r) => r.providerStatus === 0)).toBe(true);
  expect(rows.some((r) => r.providerStatus === 200)).toBe(true);
  expect(
    await f.signed.query(api.integrations.github.recoveryState.scanStatus, {
      workspaceId: f.workspaceId,
    }),
  ).toMatchObject({ limited: false, oldestAt: oldAt });
});
test("missing keys are visible configuration evidence and never create provider attempts", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  vi.stubEnv("GITHUB_APP_CLIENT_ID", "fixture-client");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
  const spy = vi.spyOn(globalThis, "fetch");
  await f.signed.action(api.integrations.github.recovery.detect, {
    workspaceId: f.workspaceId,
  });
  expect(spy).not.toHaveBeenCalled();
  expect(
    await f.signed.query(api.integrations.github.recoveryState.scanStatus, {
      workspaceId: f.workspaceId,
    }),
  ).toMatchObject({
    limited: true,
    errorCode: "GITHUB_APP_PRIVATE_KEY_REQUIRED",
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("githubRecoveries").collect()),
  ).toEqual([]);
});
test("native recovery provider caps, redirects, rate headers and unknown POST outcome are strict", async () => {
  vi.useFakeTimers();
  const spy = vi.spyOn(globalThis, "fetch");
  spy.mockResolvedValueOnce(
    new Response(null, {
      status: 403,
      headers: { "x-ratelimit-remaining": "0", "retry-after": "3600" },
    }),
  );
  await expect(
    deliveryRequest("/app/hook/deliveries", "fixture-jwt"),
  ).rejects.toMatchObject({
    code: "GITHUB_RATE_LIMITED",
    notBefore: Date.now() + 3600000,
  });
  spy.mockResolvedValueOnce(
    Response.json([], {
      headers: { Link: '<http://localhost/private?cursor=token>; rel="next"' },
    }),
  );
  await expect(
    deliveryRequest("/app/hook/deliveries", "fixture-jwt"),
  ).rejects.toThrow("RESPONSE_INVALID");
  spy.mockResolvedValueOnce(new Response(" ".repeat(1024 * 1024 + 1)));
  await expect(
    deliveryRequest("/app/hook/deliveries", "fixture-jwt"),
  ).rejects.toThrow("RESPONSE_INVALID");
  spy.mockRejectedValueOnce(Error("synthetic timeout"));
  await expect(
    deliveryRequest("/app/hook/deliveries/1/attempts", "fixture-jwt"),
  ).rejects.toThrow("OUTCOME_UNKNOWN");
  await expect(deliveryRequest("/user", "fixture-jwt")).rejects.toThrow(
    "ENDPOINT_INVALID",
  );
  expect(
    deliveryMetadata({ ...delivery(crypto.randomUUID()), repository_id: null }),
  ).toBe(null);
});
test("unknown POST result holds cooldown; expiry,role loss or source-generation changes prevent another effect", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  config();
  const guid = crypto.randomUUID();
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json([delivery(guid)]));
  await f.t.action(internal.integrations.github.recovery.scan, {});
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  const r = (await f.t.run((ctx) => ctx.db.query("githubRecoveries").first()))!;
  spy.mockRejectedValue(Error("timeout not provider confirmation"));
  await expect(
    f.signed.action(api.integrations.github.recovery.redeliver, {
      expectedGeneration: 1,
      workspaceId: f.workspaceId,
      recoveryId: r._id,
    }),
  ).rejects.toThrow("OUTCOME_UNKNOWN");
  expect(await f.t.run((ctx) => ctx.db.get(r._id))).toMatchObject({
    state: "unknown",
    attempts: 1,
  });
  await expect(
    f.signed.action(api.integrations.github.recovery.redeliver, {
      expectedGeneration: 1,
      workspaceId: f.workspaceId,
      recoveryId: r._id,
    }),
  ).rejects.toThrow("NOT_READY");
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], { generation: 2, monitoring: false }),
  );
  await expect(
    f.signed.action(api.integrations.github.recovery.redeliver, {
      expectedGeneration: 1,
      workspaceId: f.workspaceId,
      recoveryId: r._id,
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
  expect(spy).toHaveBeenCalledTimes(2);
});
test("explicit fresh-generation recovery preserves the same scope and attempt budget; installation drift remains closed", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  config();
  const guid = crypto.randomUUID();
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json([delivery(guid)]));
  await f.t.action(internal.integrations.github.recovery.scan, {});
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  const r = (await f.t.run((ctx) => ctx.db.query("githubRecoveries").first()))!;
  spy.mockRejectedValueOnce(Error("unknown"));
  await expect(
    f.signed.action(api.integrations.github.recovery.redeliver, {
      workspaceId: f.workspaceId,
      recoveryId: r._id,
      expectedGeneration: 1,
    }),
  ).rejects.toThrow("OUTCOME_UNKNOWN");
  await vi.advanceTimersByTimeAsync(900001);
  await f.t.run((ctx) =>
    ctx.db.patch(f.repositories[0], {
      generation: 2,
      proofExpiresAt: Date.now() + 900000,
      verifiedAt: Date.now(),
      purposeAt: Date.now(),
    }),
  );
  await expect(
    f.signed.action(api.integrations.github.recovery.redeliver, {
      workspaceId: f.workspaceId,
      recoveryId: r._id,
      expectedGeneration: 1,
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
  spy.mockResolvedValueOnce(new Response(null, { status: 202 }));
  await f.signed.action(api.integrations.github.recovery.redeliver, {
    workspaceId: f.workspaceId,
    recoveryId: r._id,
    expectedGeneration: 2,
  });
  expect(await f.t.run((ctx) => ctx.db.get(r._id))).toMatchObject({
    state: "accepted",
    generation: 2,
    attempts: 2,
  });
  await vi.advanceTimersByTimeAsync(900001);
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.repositories[0], {
      generation: 3,
      installationId: "51",
      proofExpiresAt: Date.now() + 900000,
    });
    const c = await ctx.db.query("githubConnections").first();
    await ctx.db.patch(c!._id, {
      installations: [{ id: "51", owner: "fixture", kind: "User" }],
    });
  });
  await expect(
    f.signed.action(api.integrations.github.recovery.redeliver, {
      workspaceId: f.workspaceId,
      recoveryId: r._id,
      expectedGeneration: 3,
    }),
  ).rejects.toThrow("SOURCE_DISABLED");
  expect(spy).toHaveBeenCalledTimes(3);
});
test("role loss after claim closes the actual pre-POST scope boundary", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  config();
  const guid = crypto.randomUUID();
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json([delivery(guid)]));
  await f.t.action(internal.integrations.github.recovery.scan, {});
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  const r = (await f.t.run((ctx) => ctx.db.query("githubRecoveries").first()))!;
  const claim = await f.signed.mutation(
    internal.integrations.github.recoveryState.claim,
    { workspaceId: f.workspaceId, recoveryId: r._id, expectedGeneration: 1 },
  );
  await f.t.run(async (ctx) => {
    const m = await ctx.db.query("memberships").first();
    await ctx.db.patch(m!._id, { role: "Viewer" });
  });
  await expect(
    f.signed.query(internal.integrations.github.recoveryState.scope, {
      workspaceId: f.workspaceId,
      recoveryId: r._id,
      sequence: claim!.sequence,
    }),
  ).rejects.toThrow("ROLE_ACCESS_DENIED");
  expect(spy).toHaveBeenCalledTimes(1);
});
test("concurrent two-Owner recovery performs one App POST, shares three attempts and still processes each tenant", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture(2);
  config();
  const guid = crypto.randomUUID();
  const identity = await f.t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Second Owner",
          email: "second-owner@example.test",
          emailVerified: true,
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
            userId: u._id,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        },
      },
    );
    return { subject: u._id, sessionId: session._id };
  });
  const other = f.t.withIdentity(identity),
    otherUser = await other.mutation(api.users.bootstrap, {});
  await f.t.run(async (ctx) => {
    await ctx.db.insert("memberships", {
      workspaceId: f.workspaces[1],
      userId: otherUser,
      role: "Owner",
    });
    await ctx.db.patch(otherUser, { activeWorkspaceId: f.workspaces[1] });
  });
  let entered!: () => void,
    completePost!: (response: Response) => void,
    postCount = 0;
  const sending = new Promise<void>((resolve) => {
    entered = resolve;
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/app/hook/deliveries") return Response.json([delivery(guid)]);
    expect(path).toBe("/app/hook/deliveries/1/attempts");
    expect(init?.method).toBe("POST");
    postCount++;
    if (postCount === 1) {
      entered();
      return new Promise((resolve) => {
        completePost = resolve;
      });
    }
    return new Response(null, { status: 202 });
  });
  await f.t.action(internal.integrations.github.recovery.scan, {});
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  const rows = await f.t.run((ctx) =>
    ctx.db.query("githubRecoveries").collect(),
  );
  const first = rows.find((r) => r.workspaceId === f.workspaceId)!,
    second = rows.find((r) => r.workspaceId === f.workspaces[1])!;
  const a = {
      workspaceId: f.workspaceId,
      recoveryId: first._id,
      expectedGeneration: 1,
    },
    b = {
      workspaceId: second.workspaceId,
      recoveryId: second._id,
      expectedGeneration: 1,
    };
  const results = Promise.allSettled([
    f.signed.action(api.integrations.github.recovery.redeliver, a),
    other.action(api.integrations.github.recovery.redeliver, b),
  ]);
  await sending;
  completePost(new Response(null, { status: 202 }));
  const completed = await results;
  expect(completed.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(completed.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(postCount).toBe(1);
  const view = await other.query(api.content.signals.recoveries, {
    workspaceId: second.workspaceId,
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(view.page).toHaveLength(1);
  expect(view.page[0].notBefore).toBeGreaterThan(Date.now());
  expect(view.page[0].attempts).toBe(1);
  expect(JSON.stringify(view)).not.toContain(f.workspaceId);
  for (const [actor, args] of [
    [other, b],
    [f.signed, a],
  ] as const) {
    await vi.advanceTimersByTimeAsync(900001);
    await f.t.run(async (ctx) => {
      for (const id of f.repositories)
        await ctx.db.patch(id, { proofExpiresAt: Date.now() + 900000 });
    });
    await actor.action(api.integrations.github.recovery.redeliver, args);
  }
  expect(postCount).toBe(3);
  await vi.advanceTimersByTimeAsync(900001);
  await f.t.run(async (ctx) => {
    for (const id of f.repositories)
      await ctx.db.patch(id, { proofExpiresAt: Date.now() + 900000 });
  });
  await expect(
    other.action(api.integrations.github.recovery.redeliver, b),
  ).rejects.toThrow("NOT_READY");
  expect(postCount).toBe(3);
  expect((await send(f, push, "push", guid)).status).toBe(202);
  expect((await send(f, push, "push", guid)).status).toBe(202);
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  expect(
    (
      await f.signed.query(api.content.signals.list, {
        workspaceId: f.workspaceId,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toHaveLength(1);
  expect(
    (
      await other.query(api.content.signals.list, {
        workspaceId: second.workspaceId,
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).page,
  ).toHaveLength(1);
});
test("a continuing provider listing stops at ten pages and cannot reset into an unbounded native loop", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture();
  config();
  let pages = 0;
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      pages++;
      expect(new URL(String(input)).pathname).toBe("/app/hook/deliveries");
      return Response.json(
        Array.from({ length: 100 }, (_, n) =>
          delivery(crypto.randomUUID(), "push", pages * 100 + n + 1, 999, 500),
        ),
        {
          headers: {
            Link: `<https://api.github.com/app/hook/deliveries?cursor=page-${pages}>; rel="next"`,
          },
        },
      );
    });
  await f.t.action(internal.integrations.github.recovery.scan, {});
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  expect(spy).toHaveBeenCalledTimes(10);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubRecoveryScan").first()),
  ).toMatchObject({
    pages: 10,
    limited: true,
    cursor: "page-10",
    leaseUntil: 0,
  });
  await f.t.action(internal.integrations.github.recovery.scan, {});
  expect(spy).toHaveBeenCalledTimes(10);
  expect(
    await f.t.run((ctx) => ctx.db.query("githubRecoveries").collect()),
  ).toEqual([]);
});

test("explicit current local admission of a proof-blocked signed receipt is atomic, preserves origin, and makes no remote attempt", async () => {
  vi.useFakeTimers();
  const f = await sourceFixture(2),
    guid = crypto.randomUUID();
  const receivedAt = Date.now();
  await f.t.run(async (ctx) => {
    for (const id of f.repositories)
      await ctx.db.patch(id, { proofExpiresAt: Date.now() - 1 });
  });
  expect((await send(f, push, "push", guid)).status).toBe(202);
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toHaveLength(0);
  await f.t.run(async (ctx) => {
    for (const id of f.repositories)
      await ctx.db.patch(id, {
        proofExpiresAt: Date.now() + 900000,
        generation: 2,
        purposeAt: Date.now(),
      });
  });
  await f.t.mutation(internal.integrations.github.recoveryState.track, {
    delivery: {
      deliveryId: "1",
      guid,
      event: "push",
      installationId: "50",
      providerId: "101",
      deliveredAt: receivedAt,
      providerStatus: 503,
    },
    cursor: null,
  });
  const row = (
    await f.t.run((ctx) => ctx.db.query("githubRecoveries").collect())
  ).find((r) => r.workspaceId === f.workspaceId)!;
  // An old autonomous invocation still cannot bind this receipt to the new purpose.
  const receipt = await f.t.run((ctx) =>
    ctx.db.query("githubWebhookReceipts").first(),
  );
  await f.t.run((ctx) =>
    ctx.db.patch(receipt!._id, { state: "pending", cursor: null }),
  );
  await f.t.mutation(internal.integrations.github.deliveries.process, {
    receiptId: receipt!._id,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("githubSignals").collect()),
  ).toHaveLength(0);
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("No provider call permitted"));
  const args = {
    workspaceId: f.workspaceId,
    recoveryId: row._id,
    expectedGeneration: 2,
  };
  await expect(
    f.signed.action(api.integrations.github.recovery.redeliver, {
      ...args,
      expectedGeneration: 1,
    }),
  ).rejects.toThrow();
  // Drifted privacy cannot be readmitted even by an Owner.
  await f.t.run((ctx) => ctx.db.patch(f.repositories[0], { private: false }));
  await expect(
    f.signed.action(api.integrations.github.recovery.redeliver, args),
  ).rejects.toThrow("SOURCE_BLOCKED");
  await f.t.run((ctx) => ctx.db.patch(f.repositories[0], { private: true }));
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
    generation: 2,
    workspaceId: f.workspaceId,
    explicitRecovery: { actorId: f.userId, recoveryId: row._id },
  });
  expect(signals[0].explicitRecovery!.authorizedAt).toBeGreaterThanOrEqual(
    receivedAt,
  );
  expect(await f.t.run((ctx) => ctx.db.get(row._id))).toMatchObject({
    state: "processed",
    attempts: 0,
    sequence: 1,
  });
  const page = await f.signed.query(api.content.signals.recoveries, {
    workspaceId: f.workspaceId,
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(page.page[0]).toMatchObject({
    state: "processed",
    localReceipt: true,
  });
});
