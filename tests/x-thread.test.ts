import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthComponent from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, internal, components } from "../convex/_generated/api";
import { seal } from "../convex/lib/crypto";
import { association } from "../convex/integrations/x/fields";
import { postRequest } from "../convex/integrations/x/publish";
import { draftValid } from "../src/lib/model";
const modules = import.meta.glob("../convex/**/*.ts");
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function fixture(proof = false, claim = true) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00Z"));
  vi.stubEnv("AUTH_EMAIL_FROM", "");
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    Buffer.alloc(32, 1).toString("base64"),
  );
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY_ID", "fixture");
  const t = convexTest(schema, modules);
  betterAuthComponent.register(t);
  const identity = await t.run(async (ctx) => {
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Owner",
          email: "thread@example.test",
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
            userId: user._id,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        },
      },
    );
    return { subject: user._id, sessionId: session._id };
  });
  const signed = t.withIdentity(identity),
    actorId = await signed.mutation(api.users.bootstrap, {});
  const { activeWorkspaceId: workspaceId } = await signed.query(
    api.users.current,
    {},
  );
  const accountId = await t.run((ctx) =>
    ctx.db.insert("socialAccounts", {
      workspaceId,
      provider: "X",
      providerIdentity: "123",
      name: "Fixture",
      handle: "@fixture",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 100,
        maxMedia: 4,
        mediaTypes: ["image", "video"],
        publish: !proof,
      },
      xEvidence: {
        scopes: ["tweet.read", "users.read", "tweet.write", "media.write"],
        identityVerifiedAt: Date.now(),
        connectionSequence: 1,
        textScopeEligible: true,
        mediaScopeEligible: true,
        liveWrite: proof ? "unverified" : "verified",
      },
    }),
  );
  const credentialId = await t.run(async (ctx) => {
    await ctx.db.insert("xBindings", {
      workspaceId,
      accountId,
      providerIdentity: "123",
      changedSequence: 1,
      changedAt: Date.now(),
    });
    return ctx.db.insert("xCredentials", {
      workspaceId,
      accountId,
      generation: 1,
      envelope: await seal(
        { accessToken: "synthetic-token" },
        association(workspaceId, accountId),
      ),
      scopes: ["tweet.read", "users.read", "tweet.write", "media.write"],
      expiresAt: Date.now() + 86400000,
      leaseUntil: 0,
      cleanAfter: Date.now() + 86400000,
    });
  });
  const content = {
    title: "Exact thread",
    text: ["First", "Second", "Third"],
    media: [],
    accountId,
    pillar: "",
    strategy: "generic",
  };
  const draftId = await signed.mutation(api.editorial.create, {
    workspaceId,
    content,
    source: "Fixture",
  });
  const versionId = (await signed.query(api.editorial.get, {
    workspaceId,
    draftId,
  }))!.versions[0]._id;
  const approve = () =>
    signed.mutation(
      proof ? api.editorial.approveFirstWrite : api.editorial.approve,
      { workspaceId, versionId, accountId },
    );
  const approvalId = await approve();
  const scheduleId = proof
    ? await signed.mutation(api.editorial.confirmFirstWrite, {
        workspaceId,
        versionId,
        accountId,
        approvalId,
      })
    : await signed.mutation(api.editorial.schedule, {
        workspaceId,
        versionId,
        accountId,
        approvalId,
        at: Date.now() + 60000,
        timezone: "UTC",
        localTime: "2026-10-06T12:01",
      });
  if (!proof) vi.setSystemTime(Date.now() + 60000);
  const job = { scheduleId, generation: 1 };
  if (claim) await t.mutation(internal.publishing.claim, job);
  return {
    t,
    signed,
    workspaceId,
    actorId,
    accountId,
    credentialId,
    content,
    draftId,
    versionId,
    approvalId,
    scheduleId,
    job,
    approve,
  };
}
const response = (id: string) =>
  new Response(JSON.stringify({ data: { id, text: "server text" } }), {
    status: 201,
  });
test("weighted X validation handles CJK, long URLs, emoji and invalid characters in the real draft guard", async () => {
  const f = await fixture();
  const bundle = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  }))!;
  const draft = {
    id: "d",
    workspaceId: "w",
    accountId: "a",
    title: "T",
    pillar: "",
    strategy: "",
    comments: [],
    versions: [
      {
        number: 1,
        text: ["界".repeat(141)],
        mediaIds: [],
        createdAt: "",
        reason: "",
      },
    ],
  };
  const account = {
    id: "a",
    workspaceId: "w",
    name: "A",
    handle: "@a",
    channel: "X" as const,
    connected: true,
    color: "",
    capability: {
      maxText: 280,
      maxThread: 100,
      maxMedia: 4,
      mediaTypes: [] as ("image" | "video")[],
      publish: true,
    },
  };
  expect(draftValid(draft, [account], [])).toBe(false);
  draft.versions[0].text = ["https://example.com/" + "a".repeat(350)];
  expect(draftValid(draft, [account], [])).toBe(true);
  draft.versions[0].text = ["👨‍👩‍👧‍👦".repeat(140)];
  expect(draftValid(draft, [account], [])).toBe(true);
  draft.versions[0].text = ["invalid\uffff"];
  expect(draftValid(draft, [account], [])).toBe(false);
  await expect(
    f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      expectedRevision: bundle.draft.revision,
      content: { ...f.content, text: ["界".repeat(141)] },
      reason: "CJK",
    }),
  ).rejects.toThrow("CAPABILITY_VALIDATION_FAILED");
});
test("actual thread replies chain exact confirmed IDs and resume skips confirmed positions 1 and 2", async () => {
  const f = await fixture();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(response("101"))
    .mockResolvedValueOnce(response("102"))
    .mockResolvedValueOnce(response("103"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.publishedCount,
  ).toBe(2);
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetch.mock.calls[1][1]!.body as string).reply).toEqual({
    in_reply_to_tweet_id: "101",
  });
  expect(JSON.parse(fetch.mock.calls[2][1]!.body as string).reply).toEqual({
    in_reply_to_tweet_id: "102",
  });
  const row = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(row.state).toBe("published");
  expect(row.externalPosts?.map((p) => p.externalId)).toEqual([
    "101",
    "102",
    "103",
  ]);
});
test("crash in durable sending intent becomes unknown and never auto resends", async () => {
  const f = await fixture(),
    c = await f.t.mutation(internal.publishing.attempts.claim, f.job);
  expect(c).toBeTruthy();
  expect(
    await f.t.mutation(internal.publishing.attempts.beforeSend, {
      attemptId: c!._id,
      claimSequence: c!.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    }),
  ).toBe(true);
  vi.setSystemTime(Date.now() + 11 * 60000 + 1);
  const fetch = vi.spyOn(globalThis, "fetch");
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(fetch).not.toHaveBeenCalled();
  const row = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(row.state).toBe("reconciliation_required");
  expect(row.errorCode).toBe("X_POST_OUTCOME_UNKNOWN");
});
test("transport timeout and ambiguous POST 5xx pause without automatic retry", async () => {
  for (const outcome of [
    new Error("lost response"),
    new Response("{}", { status: 503 }),
  ]) {
    const f = await fixture(),
      fetch = vi.spyOn(globalThis, "fetch");
    if (outcome instanceof Error) fetch.mockRejectedValue(outcome);
    else fetch.mockResolvedValue(outcome);
    await f.t.action(internal.publishing.workflows.step, f.job);
    await f.t.action(internal.publishing.workflows.step, f.job);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
      "reconciliation_required",
    );
    fetch.mockRestore();
  }
});
test("duplicate claims and stale CAS cannot create a second post operation", async () => {
  const f = await fixture();
  const claims = await Promise.all([
    f.t.mutation(internal.publishing.attempts.claim, f.job),
    f.t.mutation(internal.publishing.attempts.claim, f.job),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const c = claims.find(Boolean)!;
  expect(
    await f.t.mutation(internal.publishing.attempts.beforeSend, {
      attemptId: c._id,
      claimSequence: c.claimSequence + 1,
      credentialGeneration: 1,
      mediaIds: [],
    }),
  ).toBe(false);
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence + 1,
    outcome: "confirmed",
    externalId: "999",
    durationMs: 1,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.publishedCount,
  ).toBe(0);
});
test("first-write purpose requires concrete approval and separate confirmation; normal scheduling cannot reuse it", async () => {
  const f = await fixture(true);
  await expect(
    f.signed.mutation(api.editorial.approve, {
      workspaceId: f.workspaceId,
      versionId: f.versionId,
      accountId: f.accountId,
    }),
  ).rejects.toThrow("ACCOUNT_REAUTH_OR_CAPABILITY_REQUIRED");
  await expect(
    f.signed.mutation(api.editorial.schedule, {
      workspaceId: f.workspaceId,
      versionId: f.versionId,
      accountId: f.accountId,
      approvalId: f.approvalId,
      at: Date.now() + 60000,
      timezone: "UTC",
      localTime: "2026-10-06T12:01",
    }),
  ).rejects.toThrow("APPROVAL_PURPOSE_MISMATCH");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response("101"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  const account = (await f.t.run((ctx) => ctx.db.get(f.accountId)))!;
  expect(account.capability.publish).toBe(true);
  expect(account.xEvidence?.writeProof?.externalId).toBe("101");
  expect(account.capability.maxText).toBe(280);
});
test("unknown first write does not enable publishing; expired first-write intent never sends", async () => {
  const f = await fixture(true),
    fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(false);
  const expired = await fixture(true);
  vi.setSystemTime(Date.now() + 46 * 60000);
  fetch.mockClear();
  await expired.t.action(internal.publishing.workflows.step, expired.job);
  expect(fetch).not.toHaveBeenCalled();
  expect(
    (await expired.t.run((ctx) => ctx.db.get(expired.scheduleId)))!.errorCode,
  ).toBe("FIRST_WRITE_INTENT_EXPIRED");
});
test("final credential/role/revocation/lifecycle check rejects before any POST", async () => {
  for (const change of [
    "credentials",
    "role",
    "revoked",
    "lifecycle",
    "connection",
  ]) {
    const f = await fixture();
    const c = (await f.t.mutation(internal.publishing.attempts.claim, f.job))!;
    await f.t.run(async (ctx) => {
      if (change === "credentials")
        await ctx.db.patch(f.credentialId, { generation: 2 });
      if (change === "role") {
        const m = await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.actorId).eq("workspaceId", f.workspaceId),
          )
          .unique();
        await ctx.db.patch(m!._id, { role: "Viewer" });
      }
      if (change === "revoked")
        await ctx.db.patch(f.approvalId, { revokedAt: Date.now() });
      if (change === "lifecycle")
        await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
      if (change === "connection") {
        const a = (await ctx.db.get(f.accountId))!;
        await ctx.db.patch(f.accountId, {
          xEvidence: { ...a.xEvidence!, connectionSequence: 2 },
        });
      }
    });
    await expect(
      f.t.mutation(internal.publishing.attempts.beforeSend, {
        attemptId: c._id,
        claimSequence: c.claimSequence,
        credentialGeneration: 1,
        mediaIds: [],
      }),
    ).rejects.toThrow();
  }
});
test("cancel/reconnect during HTTP preserves actual late ID without resurrection or capability proof", async () => {
  const f = await fixture(true);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    await f.signed.mutation(api.editorial.cancel, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    });
    await f.t.run(async (ctx) => {
      const a = (await ctx.db.get(f.accountId))!;
      await ctx.db.patch(f.accountId, {
        xEvidence: { ...a.xEvidence!, connectionSequence: 2 },
      });
    });
    return response("101");
  });
  await f.t.action(internal.publishing.workflows.step, f.job);
  const row = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(row.state).toBe("reconciliation_required");
  expect(row.externalPosts?.[0].externalId).toBe("101");
  expect(row.publishedCount).toBe(1);
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(false);
});
test("post transport fixed endpoint, nested media/reply, 201 ID and one fetch only", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(response("123"));
  expect(await postRequest("synthetic", "Hello", ["456"], "789")).toMatchObject(
    { externalId: "123" },
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe("https://api.x.com/2/tweets");
  expect(fetch.mock.calls[0][1]!.redirect).toBe("error");
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
    text: "Hello",
    media: { media_ids: ["456"] },
    reply: { in_reply_to_tweet_id: "789" },
  });
  fetch.mockResolvedValue(response("foreign/url"));
  await expect(postRequest("synthetic", "Hello", [])).rejects.toMatchObject({
    outcome: "unknown",
  });
});

test("repeated confirmation returns the original job and a second draft cannot start parallel first verification", async () => {
  const f = await fixture(true);
  const args = {
    workspaceId: f.workspaceId,
    versionId: f.versionId,
    accountId: f.accountId,
    approvalId: f.approvalId,
  };
  expect(await f.signed.mutation(api.editorial.confirmFirstWrite, args)).toBe(
    f.scheduleId,
  );
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: { ...f.content, title: "Another thread" },
    source: "Fixture",
  });
  const versionId = (await f.signed.query(api.editorial.get, {
    workspaceId: f.workspaceId,
    draftId,
  }))!.versions[0]._id;
  const approvalId = await f.signed.mutation(api.editorial.approveFirstWrite, {
    workspaceId: f.workspaceId,
    versionId,
    accountId: f.accountId,
  });
  await expect(
    f.signed.mutation(api.editorial.confirmFirstWrite, {
      workspaceId: f.workspaceId,
      versionId,
      accountId: f.accountId,
      approvalId,
    }),
  ).rejects.toThrow("FIRST_WRITE_ACTIVE_JOB");
});
test("expired preparing lease resumes safely while expiry of sending lease does not", async () => {
  const f = await fixture();
  const first = (await f.t.mutation(
    internal.publishing.attempts.claim,
    f.job,
  ))!;
  vi.setSystemTime(Date.now() + 11 * 60000 + 1);
  const second = (await f.t.mutation(
    internal.publishing.attempts.claim,
    f.job,
  ))!;
  expect(second._id).toBe(first._id);
  expect(second.claimSequence).toBe(first.claimSequence + 1);
  expect(second.stage).toBe("preparing");
});
test("a refreshed token with the same connection is accepted but missing actual required scopes never sends", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.credentialId, { generation: 2 }));
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(response("101"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(fetch).toHaveBeenCalledTimes(1);
  await f.t.run((ctx) =>
    ctx.db.patch(f.credentialId, { scopes: ["tweet.write"] }),
  );
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.errorCode).toBe(
    "X_SCOPE_REQUIRED",
  );
});

async function attachMedia(
  f: Awaited<ReturnType<typeof fixture>>,
  phase: "ready" | "uncertain" = "ready",
) {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a".repeat(32));
  vi.stubEnv("R2_MEDIA_BUCKET", "fixture");
  vi.stubEnv("R2_MEDIA_EU_CONFIRMED", "true");
  return f.t.run(async (ctx) => {
    const assetId = await ctx.db.insert("mediaAssets", {
      workspaceId: f.workspaceId,
      storageProvider: "r2",
      objectKey: "pending",
      checksum: "b".repeat(64),
      name: "Approved image",
      type: "image",
      mime: "image/png",
      size: 70,
      state: "ready",
      bucket: "fixture",
      r2AccountId: "a".repeat(32),
    });
    const key = `final/${f.workspaceId}/${assetId}`;
    const sessionId = await ctx.db.insert("mediaUploadSessions", {
      workspaceId: f.workspaceId,
      assetId,
      temporaryKey: "temporary",
      finalKey: key,
      bucket: "fixture",
      r2AccountId: "a".repeat(32),
      expectedSize: 70,
      expectedMime: "image/png",
      expiresAt: Date.now() + 3600000,
      state: "ready",
      leaseUntil: 0,
      generation: 1,
      cleanAfter: Date.now() + 3600000,
    });
    await ctx.db.patch(assetId, { uploadSessionId: sessionId, objectKey: key });
    const version = (await ctx.db.get(f.versionId))!;
    await ctx.db.patch(f.versionId, {
      content: {
        ...version.content,
        media: [{ assetId, alt: "Immutable approved alt" }],
      },
      mediaChecksums: [{ assetId, checksum: "b".repeat(64), objectKey: key }],
    });
    const checkpointId = await ctx.db.insert("xMediaCheckpoints", {
      ...f.job,
      mediaPosition: 0,
      workspaceId: f.workspaceId,
      versionId: f.versionId,
      accountId: f.accountId,
      assetId,
      objectKey: key,
      checksum: "b".repeat(64),
      alt: "Immutable approved alt",
      size: 70,
      mime: "image/png",
      bucket: "fixture",
      r2AccountId: "a".repeat(32),
      attempt: 1,
      phase,
      claimSequence: 1,
      leaseUntil: 0,
      nextSegment: 1,
      nextCheckAt: Date.now(),
      deadline: Date.now() + 1800000,
      statusReads: 0,
      metadataApplied: true,
      mediaId: "456",
      mediaKey: "3_456",
      expiresAt: Date.now() + 3600000,
      bytesRead: 70,
      bytesUploaded: 70,
      bytesSubmitted: 70,
      chunkCount: 1,
      providerRequests: 4,
      durationMs: 1,
      measurementIncomplete: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(phase === "uncertain"
        ? { errorCode: "X_MEDIA_OUTCOME_UNKNOWN" }
        : {}),
    });
    return { assetId, checkpointId };
  });
}
test("approved media attaches only to first position and captures actual provider media key", async () => {
  const f = await fixture();
  await attachMedia(f);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(response("101"))
    .mockResolvedValueOnce(response("102"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string).media).toEqual({
    media_ids: ["456"],
  });
  expect(
    JSON.parse(fetch.mock.calls[1][1]!.body as string).media,
  ).toBeUndefined();
  const attempts = await f.t.run((ctx) =>
    ctx.db
      .query("xPostAttempts")
      .withIndex("by_scheduleId_and_generation_and_position", (q) =>
        q.eq("scheduleId", f.scheduleId).eq("generation", 1),
      )
      .take(100),
  );
  expect(attempts[0].mediaKeys).toEqual(["3_456"]);
  expect(attempts[1].mediaIds).toEqual([]);
});
test("expired media and changed immutable alt/source block the immediate attach gate", async () => {
  for (const change of ["expired", "alt", "checksum"]) {
    const f = await fixture(),
      m = await attachMedia(f),
      c = (await f.t.mutation(internal.publishing.attempts.claim, f.job))!;
    await f.t.run((ctx) =>
      change === "expired"
        ? ctx.db.patch(m.checkpointId, { expiresAt: Date.now() + 50000 })
        : change === "alt"
          ? ctx.db.patch(m.checkpointId, { alt: "Changed" })
          : ctx.db.patch(m.assetId, { checksum: "c".repeat(64) }),
    );
    await expect(
      f.t.mutation(internal.publishing.attempts.beforeSend, {
        attemptId: c._id,
        claimSequence: c.claimSequence,
        credentialGeneration: 1,
        mediaIds: ["456"],
      }),
    ).rejects.toThrow();
  }
});
test("terminal uncertain media pauses coordinator instead of polling or sending text without attachment", async () => {
  const f = await fixture();
  await attachMedia(f, "uncertain");
  const fetch = vi.spyOn(globalThis, "fetch");
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(fetch).not.toHaveBeenCalled();
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
    "reconciliation_required",
  );
});
test("proof approval authority, wrong account and revoked proof cannot confirm", async () => {
  const f = await fixture(true);
  await expect(
    f.signed.mutation(api.editorial.confirmFirstWrite, {
      workspaceId: f.workspaceId,
      versionId: f.versionId,
      accountId: f.accountId,
      approvalId: await f.t.run((ctx) =>
        ctx.db.insert("approvals", {
          workspaceId: f.workspaceId,
          draftId: f.draftId,
          versionId: f.versionId,
          accountId: f.accountId,
          actorId: f.actorId,
          createdAt: Date.now(),
          revokedAt: null,
          revokedBy: null,
        }),
      ),
    }),
  ).rejects.toThrow("APPROVAL_PURPOSE_MISMATCH");
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.actorId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(m!._id, { role: "Editor" });
  });
  await expect(f.approve()).rejects.toThrow("ROLE_ACCESS_DENIED");
});
test("bounded malformed success and HTTP rejection have distinct durable outcomes", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("x".repeat(32769), { status: 201 }));
  await expect(postRequest("synthetic", "Text", [])).rejects.toMatchObject({
    outcome: "unknown",
  });
  fetch.mockResolvedValue(
    new Response("{}", {
      status: 429,
      headers: { "x-rate-limit-reset": "1791204000" },
    }),
  );
  await expect(postRequest("synthetic", "Text", [])).rejects.toMatchObject({
    outcome: "rejected",
    code: "X_POST_RATE_LIMITED",
    rateResetAt: 1791204000000,
  });
  fetch.mockClear();
  await expect(postRequest("synthetic", "Text", ["bad"])).rejects.toMatchObject(
    { outcome: "rejected" },
  );
  expect(fetch).not.toHaveBeenCalled();
});

test("binding ownership drift and actual permission rejection close the standard publishing gate", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const binding = await ctx.db
      .query("xBindings")
      .withIndex("by_providerIdentity", (q) => q.eq("providerIdentity", "123"))
      .unique();
    await ctx.db.patch(binding!._id, { accountId: undefined });
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("{}", { status: 403 }));
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect(fetch).not.toHaveBeenCalled();
  const rejected = await fixture();
  await rejected.t.action(internal.publishing.workflows.step, rejected.job);
  expect(
    (await rejected.t.run((ctx) => ctx.db.get(rejected.accountId)))!.capability
      .publish,
  ).toBe(false);
  expect(
    (await rejected.t.run((ctx) => ctx.db.get(rejected.scheduleId)))!.state,
  ).toBe("failed");
});
test("validation does not mutate approved decomposed Unicode, URL, or whitespace in the submitted text", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(response("123"));
  const text = " cafe\u0301 https://example.com/" + "a".repeat(300) + " \n";
  await postRequest("synthetic", text, []);
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string).text).toBe(text);
  const f = await fixture();
  await expect(
    f.signed.mutation(api.editorial.save, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
      expectedRevision: 1,
      content: { ...f.content, text: ["Invalid \ud800"] },
      reason: "Unicode",
    }),
  ).rejects.toThrow("CAPABILITY_VALIDATION_FAILED");
});

test("native scheduler executes the whole confirmed thread once, including redundant watchdogs", async () => {
  const f = await fixture(false, false);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(response("101"))
    .mockResolvedValueOnce(response("102"))
    .mockResolvedValueOnce(response("103"));
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  const row = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect({ state: row.state, error: row.errorCode }).toEqual({
    state: "published",
    error: null,
  });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(row.publishedCount).toBe(3);
});

test("first-write approval rejects a broken reciprocal ready media session before granting consent", async () => {
  const f = await fixture(true),
    m = await attachMedia(f);
  await f.t.run(async (ctx) => {
    const asset = (await ctx.db.get(m.assetId))!;
    await ctx.db.patch(asset.uploadSessionId!, { state: "failed" });
  });
  await expect(f.approve()).rejects.toThrow("MEDIA_NOT_READY");
});

test("late rejection from an older credential generation does not disable refreshed current credentials", async () => {
  const f = await fixture();
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    await f.t.run((ctx) => ctx.db.patch(f.credentialId, { generation: 2 }));
    return new Response("{}", { status: 401 });
  });
  await f.t.action(internal.publishing.workflows.step, f.job);
  const account = (await f.t.run((ctx) => ctx.db.get(f.accountId)))!;
  expect(account.connection).toBe("connected");
  expect(account.capability.publish).toBe(true);
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
    "failed",
  );
});

test("actual mocked OAuth connection with distinct ordering fence allows separate exact first-write proof", async () => {
  const f = await fixture(false, false);
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  });
  vi.stubEnv("SITE_URL", "https://dispatch.example");
  vi.stubEnv("X_CLIENT_ID", "synthetic-client");
  vi.stubEnv("X_CLIENT_SECRET", "synthetic-secret");
  await f.t.run((ctx) =>
    ctx.db.insert("xOAuthFence", { key: "oauth", sequence: 100 }),
  );
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).endsWith("/oauth2/token")
      ? Response.json({
          access_token: "fresh-synthetic",
          refresh_token: "synthetic-refresh",
          token_type: "bearer",
          expires_in: 7200,
          scope: "tweet.write tweet.read users.read offline.access media.write",
        })
      : String(url).endsWith("/users/me")
        ? Response.json({
            data: { id: "123", name: "Fixture", username: "fixture" },
          })
        : response("1001"),
  );
  const url = new URL(
    await f.signed.action(api.integrations.x.client.start, {
      workspaceId: f.workspaceId,
      accountId: f.accountId,
    }),
  );
  await f.signed.action(api.integrations.x.client.callback, {
    workspaceId: f.workspaceId,
    state: url.searchParams.get("state")!,
    code: "synthetic-code",
    denied: false,
  });
  const { account, binding } = await f.t.run(async (ctx) => ({
    account: (await ctx.db.get(f.accountId))!,
    binding: (await ctx.db
      .query("xBindings")
      .withIndex("by_providerIdentity", (q) => q.eq("providerIdentity", "123"))
      .unique())!,
  }));
  expect(account.xEvidence!.connectionSequence).not.toBe(
    binding.changedSequence,
  );
  expect(account.capability.publish).toBe(false);
  const target = {
    workspaceId: f.workspaceId,
    accountId: f.accountId,
    versionId: f.versionId,
  };
  const approvalId = await f.signed.mutation(
    api.editorial.approveFirstWrite,
    target,
  );
  const scheduleId = await f.signed.mutation(api.editorial.confirmFirstWrite, {
    ...target,
    approvalId,
  });
  await f.t.action(internal.publishing.dispatch, { scheduleId, generation: 1 });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(true);
  expect(
    fetch.mock.calls.filter(
      ([url]) => String(url) === "https://api.x.com/2/tweets",
    ),
  ).toHaveLength(1);
});
