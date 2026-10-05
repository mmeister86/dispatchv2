import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthComponent from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, internal, components } from "../convex/_generated/api";
import { seal } from "../convex/lib/crypto";
import { association } from "../convex/integrations/x/fields";
import { postRequest } from "../convex/integrations/x/publish";
import { matchedPost } from "../convex/publishing/reconcile";
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
        : response(String(1001 + fetch.mock.calls.length)),
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
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(true);
  expect(
    fetch.mock.calls.filter(
      ([url]) => String(url) === "https://api.x.com/2/tweets",
    ),
  ).toHaveLength(3);
});

test("committed schedule claim durably continues if dispatch stops before returning", async () => {
  const f = await fixture(false, false);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () =>
      response(String(101 + fetch.mock.calls.length)),
    );
  await f.t.mutation(internal.publishing.claim, f.job);
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  expect(await f.t.run((ctx) => ctx.db.get(f.scheduleId))).toMatchObject({
    state: "published",
    publishedCount: 3,
  });
  expect(fetch).toHaveBeenCalledTimes(3);
});

test.each(["finalize", "processing"] as const)(
  "%s retains actual returned media key when initialize omitted it",
  async (phase) => {
    const f = await fixture(),
      m = await attachMedia(f);
    vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "synthetic");
    await f.t.run((ctx) =>
      ctx.db.patch(m.checkpointId, { phase, mediaKey: undefined }),
    );
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          id: "456",
          media_key: "3_456",
          expires_after_secs: 3600,
          processing_info: { state: "succeeded" },
        },
      }),
    );
    await f.t.action(internal.integrations.x.publish.prepare, {
      ...f.job,
      mediaPosition: 0,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await f.t.run((ctx) => ctx.db.get(m.checkpointId))).toMatchObject({
      phase: "metadata",
      mediaKey: "3_456",
    });
  },
);

test.each(["finalize", "processing"] as const)(
  "%s conflicting media key stops without replacing acknowledged evidence",
  async (phase) => {
    const f = await fixture(),
      m = await attachMedia(f);
    vi.stubEnv("R2_ACCESS_KEY_ID", "synthetic");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "synthetic");
    await f.t.run((ctx) => ctx.db.patch(m.checkpointId, { phase }));
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          id: "456",
          media_key: "3_other",
          expires_after_secs: 3600,
          processing_info: { state: "succeeded" },
        },
      }),
    );
    await f.t.action(internal.integrations.x.publish.prepare, {
      ...f.job,
      mediaPosition: 0,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await f.t.run((ctx) => ctx.db.get(m.checkpointId))).toMatchObject({
      phase: "uncertain",
      mediaKey: "3_456",
      errorCode: "X_MEDIA_KEY_CONFLICT",
    });
    expect(
      await f.t.mutation(internal.publishing.media.ready, {
        ...f.job,
        mediaPosition: 0,
      }),
    ).toBeNull();
  },
);

test("public abort of an unknown first POST retains outcome and blocks another first-write job", async () => {
  const f = await fixture(true);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  const before = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(before.state).toBe("reconciliation_required");
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: before.generation,
  });
  const after = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(after).toMatchObject({
    state: "reconciliation_required",
    errorCode: before.errorCode,
    abortRequestedBy: f.actorId,
  });
  expect(after.abortRequestedAt).toBeDefined();
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content: { ...f.content, title: "Another proof" },
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
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each(["confirmed", "unknown", "rejected"] as const)(
  "repeated public abort during sending preserves barrier after late %s receipt",
  async (outcome) => {
    const f = await fixture(true),
      c = (await f.t.mutation(internal.publishing.attempts.claim, f.job))!;
    const fetch = vi.spyOn(globalThis, "fetch");
    await f.t.mutation(internal.publishing.attempts.beforeSend, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    });
    const args = {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    };
    await f.signed.mutation(api.editorial.cancel, args);
    const once = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
    expect(once.state).toBe("reconciliation_required");
    await f.signed.mutation(api.editorial.cancel, {
      ...args,
      expectedGeneration: once.generation,
    });
    await expect(
      f.signed.mutation(api.editorial.cancel, args),
    ).resolves.toBeNull();
    expect(await f.t.run((ctx) => ctx.db.get(f.scheduleId))).toEqual(once);
    await f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      outcome,
      ...(outcome === "confirmed"
        ? { externalId: "101", httpStatus: 201 }
        : { errorCode: "X_POST_OUTCOME_UNKNOWN" }),
      durationMs: 1,
    });
    const after = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
    expect(after).toMatchObject({
      state: "reconciliation_required",
      generation: once.generation,
      abortRequestedAt: once.abortRequestedAt,
      abortRequestedBy: f.actorId,
      publishedCount: outcome === "confirmed" ? 1 : 0,
    });
    if (outcome === "confirmed")
      expect(after.externalPosts?.[0].externalId).toBe("101");
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
    ).toBe(false);
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
    expect(fetch).not.toHaveBeenCalled();
  },
);

test("public abort of a resolved stopped prefix preserves IDs and cannot be resumed", async () => {
  const f = await fixture();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(response("101"))
    .mockResolvedValueOnce(new Response("rejected", { status: 400 }));
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.action(internal.publishing.workflows.step, f.job);
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
    "partially_published",
  );
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  });
  const after = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(after).toMatchObject({
    state: "cancelled",
    publishedCount: 1,
    abortRequestedBy: f.actorId,
  });
  expect(after.externalPosts?.[0].externalId).toBe("101");
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("persisted abort fences all send paths and repeated abort still checks owner and role", async () => {
  const f = await fixture();
  const args = {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  };
  await f.signed.mutation(api.editorial.cancel, args);
  const after = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  // A future reconciliation state change must never silently remove the persisted send fence.
  await f.t.run((ctx) => ctx.db.patch(f.scheduleId, { state: "publishing" }));
  const job = { scheduleId: f.scheduleId, generation: after.generation };
  expect(
    await f.t.mutation(internal.publishing.attempts.claim, job),
  ).toBeNull();
  await expect(
    f.t.query(internal.integrations.x.oauth.scheduleSource, {
      ...job,
      operation: "text",
    }),
  ).rejects.toThrow("SCHEDULE_ABORT_REQUESTED");
  await expect(
    f.t.mutation(internal.publishing.media.ready, { ...job, mediaPosition: 0 }),
  ).rejects.toThrow("SCHEDULE_ABORT_REQUESTED");
  await f.t.run((ctx) => ctx.db.patch(f.scheduleId, { state: "scheduled" }));
  expect(await f.t.mutation(internal.publishing.claim, job)).toBeNull();
  await expect(
    f.signed.mutation(api.editorial.reschedule, {
      ...args,
      expectedGeneration: after.generation,
      at: Date.now() + 60000,
      timezone: "UTC",
      localTime: "2026-10-06T12:02",
    }),
  ).rejects.toThrow("SCHEDULE_NOT_MOVABLE");
  const otherWorkspaceId = await f.signed.mutation(api.workspaces.create, {
    name: "Other",
    description: "Fixture",
  });
  await expect(
    f.signed.mutation(api.editorial.cancel, {
      ...args,
      workspaceId: otherWorkspaceId,
    }),
  ).rejects.toThrow("REFERENCE_ACCESS_DENIED");
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", f.actorId).eq("workspaceId", f.workspaceId),
      )
      .unique();
    await ctx.db.patch(m!._id, { role: "Viewer" });
  });
  await expect(f.signed.mutation(api.editorial.cancel, args)).rejects.toThrow(
    "ROLE_ACCESS_DENIED",
  );
});

const lookup = (id = "101", text = "First", parent?: string) =>
  Response.json({
    data: {
      id,
      text,
      author_id: "123",
      created_at: new Date(Date.now()).toISOString(),
      referenced_posts: parent ? [{ type: "replied_to", id: parent }] : [],
      edit_history_post_ids: [id],
      attachments: { media_keys: [] },
    },
  });
test("positive read reconciliation confirms evidence without sending or proving write access", async () => {
  const f = await fixture(true);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  fetch.mockClear().mockResolvedValue(lookup());
  const args = {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
    position: 0,
    candidateId: "101",
  };
  expect(await f.signed.action(api.publishing.reconcile.lookup, args)).toBe(
    "confirmed",
  );
  expect(await f.signed.action(api.publishing.reconcile.lookup, args)).toBe(
    "confirmed",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]?.method).toBe("GET");
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(false);
  const s = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(s).toMatchObject({ state: "partially_published", publishedCount: 1 });
  expect(s.externalPosts?.[0].url).toBe("https://x.com/i/web/status/101");
});
test.each([
  "404",
  "empty",
  "author",
  "text",
  "parent",
  "media",
  "time",
  "id",
  "edited",
  "missing",
  "timeout",
])("%s lookup never proves unknown write absent", async (change) => {
  const f = await fixture();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  let value = await lookup().json();
  if (change === "author") value.data.author_id = "999";
  if (change === "text") value.data.text = "Different";
  if (change === "parent")
    value.data.referenced_posts = [{ type: "replied_to", id: "999" }];
  if (change === "media") value.data.attachments.media_keys = ["3_other"];
  if (change === "time") value.data.created_at = "2000-01-01T00:00:00Z";
  if (change === "id") value.data.id = "102";
  if (change === "edited") value.data.edit_history_post_ids = ["99", "101"];
  if (change === "missing") delete value.data.author_id;
  fetch
    .mockClear()
    .mockResolvedValue(
      change === "404"
        ? new Response("{}", { status: 404 })
        : Response.json(change === "empty" ? { data: [] } : value),
    );
  if (change === "timeout") fetch.mockRejectedValue(new Error("timeout"));
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    }),
  ).toBe("unknown");
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
    "reconciliation_required",
  );
  await expect(
    f.signed.mutation(api.publishing.reconcile.continueThread, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    }),
  ).rejects.toThrow("X_RECONCILIATION_REQUIRED");
});
test("explicit continuation preserves confirmed 1/2 across generation and sends only 3", async () => {
  const f = await fixture();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(response("101"))
    .mockResolvedValueOnce(response("102"))
    .mockResolvedValueOnce(new Response("{}", { status: 429 }));
  for (let i = 0; i < 3; i++)
    await f.t.action(internal.publishing.workflows.step, f.job);
  const args = {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  };
  await f.signed.mutation(api.publishing.reconcile.continueThread, args);
  await expect(
    f.signed.mutation(api.publishing.reconcile.continueThread, args),
  ).rejects.toThrow("SCHEDULE_CONFLICT");
  fetch.mockClear().mockResolvedValue(response("103"));
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({
    text: "Third",
    reply: { in_reply_to_tweet_id: "102" },
  });
  const s = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
  expect(s).toMatchObject({
    state: "published",
    publishedCount: 3,
    generation: 2,
    versionId: f.versionId,
  });
  expect(s.externalPosts?.map((p) => p.externalId)).toEqual([
    "101",
    "102",
    "103",
  ]);
});
test("aborted unknown can be reconciled to retained evidence but never resumed or enabled", async () => {
  const f = await fixture(true);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  });
  fetch.mockClear().mockResolvedValue(lookup());
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 2,
      position: 0,
      candidateId: "101",
    }),
  ).toBe("confirmed");
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!).toMatchObject({
    state: "cancelled",
    abortRequestedBy: f.actorId,
    publishedCount: 1,
  });
  await expect(
    f.signed.mutation(api.publishing.reconcile.continueThread, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 2,
    }),
  ).rejects.toThrow("SCHEDULE_ABORT_REQUESTED");
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(false);
});

test("POST Retry-After and permanent rejection restrict explicit continuation", async () => {
  for (const status of [429, 400]) {
    const f = await fixture();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status, headers: { "Retry-After": "60" } }),
    );
    await f.t.action(internal.publishing.workflows.step, f.job);
    await expect(
      f.signed.mutation(api.publishing.reconcile.continueThread, {
        workspaceId: f.workspaceId,
        scheduleId: f.scheduleId,
        expectedGeneration: 1,
      }),
    ).rejects.toThrow(
      status === 429 ? "X_POST_RATE_LIMITED" : "X_POST_PERMANENT_REJECTION",
    );
    vi.restoreAllMocks();
  }
});
test("NFC and exact returned URL entities reconcile without guessing index units", async () => {
  const f = await fixture();
  const text = " cafe\u0301 https://example.com/a \n";
  await f.t.run((ctx) =>
    ctx.db.patch(f.versionId, { content: { ...f.content, text: [text] } }),
  );
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  const value = await lookup("101", " café https://t.co/AbC \n").json();
  value.data.entities = {
    urls: [
      {
        url: "https://t.co/AbC",
        expanded_url: "https://example.com/a",
        start: 999,
        end: 1000,
      },
    ],
  };
  fetch.mockClear().mockResolvedValue(Response.json(value));
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "https://x.com/fixture/status/101",
    }),
  ).toBe("confirmed");
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
    "published",
  );
});
test("ambiguous repeated URL transform and missing upload media-key evidence stay unknown", async () => {
  for (const kind of ["url", "media"]) {
    const f = await fixture();
    if (kind === "url")
      await f.t.run((ctx) =>
        ctx.db.patch(f.versionId, {
          content: {
            ...f.content,
            text: ["https://example.com/a https://example.com/a"],
          },
        }),
      );
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("timeout"));
    await f.t.action(internal.publishing.workflows.step, f.job);
    const attempt = (await f.t.run((ctx) =>
      ctx.db
        .query("xPostAttempts")
        .withIndex("by_scheduleId_and_generation_and_position", (q) =>
          q.eq("scheduleId", f.scheduleId),
        )
        .first(),
    ))!;
    if (kind === "media")
      await f.t.run((ctx) =>
        ctx.db.patch(attempt._id, { mediaIds: ["456"], mediaKeys: [null] }),
      );
    const value = await lookup(
      "101",
      kind === "url" ? "https://t.co/AbC https://t.co/AbC" : "First",
    ).json();
    if (kind === "url")
      value.data.entities = {
        urls: [
          { url: "https://t.co/AbC", expanded_url: "https://example.com/a" },
        ],
      };
    else value.data.attachments.media_keys = ["3_456"];
    fetch.mockClear().mockResolvedValue(Response.json(value));
    expect(
      await f.signed.action(api.publishing.reconcile.lookup, {
        workspaceId: f.workspaceId,
        scheduleId: f.scheduleId,
        expectedGeneration: 1,
        position: 0,
        candidateId: "101",
      }),
    ).toBe("unknown");
    vi.restoreAllMocks();
  }
});
test("reconnect requires separate same-snapshot reauthorization after positive lookup", async () => {
  const f = await fixture(true);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(f.accountId))!;
    await ctx.db.patch(a._id, {
      xEvidence: { ...a.xEvidence!, connectionSequence: 8 },
    });
  });
  fetch.mockClear().mockResolvedValue(lookup());
  await f.signed.action(api.publishing.reconcile.lookup, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
    position: 0,
    candidateId: "101",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  await f.signed.mutation(api.publishing.reconcile.continueThread, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  });
  fetch
    .mockClear()
    .mockResolvedValueOnce(response("102"))
    .mockResolvedValueOnce(response("103"));
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(
    JSON.parse(fetch.mock.calls[0][1]!.body as string).reply
      .in_reply_to_tweet_id,
  ).toBe("101");
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(true);
});
test.each(["role", "lifecycle", "scope", "binding", "identity"])(
  "%s drift during GET prevents committing client/cross-context evidence",
  async (kind) => {
    const f = await fixture(true);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("timeout"));
    await f.t.action(internal.publishing.workflows.step, f.job);
    fetch.mockImplementation(async () => {
      await f.t.run(async (ctx) => {
        if (kind === "role") {
          const m = await ctx.db
            .query("memberships")
            .withIndex("by_userId_and_workspaceId", (q) =>
              q.eq("userId", f.actorId).eq("workspaceId", f.workspaceId),
            )
            .unique();
          await ctx.db.patch(m!._id, { role: "Editor" });
        }
        if (kind === "lifecycle")
          await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
        if (kind === "scope")
          await ctx.db.patch(f.credentialId, { scopes: [] });
        if (kind === "binding") {
          const b = await ctx.db
            .query("xBindings")
            .withIndex("by_providerIdentity", (q) =>
              q.eq("providerIdentity", "123"),
            )
            .unique();
          await ctx.db.patch(b!._id, { accountId: undefined });
        }
        if (kind === "identity")
          await ctx.db.patch(f.accountId, { providerIdentity: "999" });
      });
      return lookup();
    });
    await expect(
      f.signed.action(api.publishing.reconcile.lookup, {
        workspaceId: f.workspaceId,
        scheduleId: f.scheduleId,
        expectedGeneration: 1,
        position: 0,
        candidateId: "101",
      }),
    ).rejects.toThrow();
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.publishedCount,
    ).toBe(0);
  },
);

test("confirmed late POST can finalize persisted abort through authorized reconciliation without another send", async () => {
  const f = await fixture(true),
    c = (await f.t.mutation(internal.publishing.attempts.claim, f.job))!;
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    credentialGeneration: 1,
    mediaIds: [],
  });
  await f.signed.mutation(api.editorial.cancel, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  });
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    outcome: "confirmed",
    externalId: "101",
    httpStatus: 201,
    durationMs: 1,
  });
  const fetch = vi.spyOn(globalThis, "fetch");
  await f.signed.action(api.publishing.reconcile.lookup, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 2,
    position: 0,
    candidateId: "101",
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!).toMatchObject({
    state: "cancelled",
    abortRequestedBy: f.actorId,
    publishedCount: 1,
  });
  expect(fetch).not.toHaveBeenCalled();
});
test("concurrent reads cannot replace a confirmed ID or enable capability", async () => {
  const f = await fixture(true),
    fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  fetch.mockImplementation(async () => {
    await wait;
    return lookup();
  });
  const args = {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
    position: 0,
    candidateId: "101",
  };
  const first = f.signed.action(api.publishing.reconcile.lookup, args);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await expect(
    f.signed.action(api.publishing.reconcile.lookup, {
      ...args,
      candidateId: "102",
    }),
  ).rejects.toThrow("X_RECONCILIATION_IN_PROGRESS");
  release();
  expect(await first).toBe("confirmed");
  await expect(
    f.signed.action(api.publishing.reconcile.lookup, {
      ...args,
      candidateId: "102",
    }),
  ).rejects.toThrow("X_POST_CHECKPOINT_CONFLICT");
});
test("provider read backoff is persisted and a new click never bypasses it", async () => {
  const f = await fixture(),
    fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  fetch
    .mockClear()
    .mockResolvedValue(
      new Response("{}", { status: 429, headers: { "retry-after": "90" } }),
    );
  const args = {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
    position: 0,
    candidateId: "101",
  };
  expect(await f.signed.action(api.publishing.reconcile.lookup, args)).toBe(
    "unknown",
  );
  await expect(
    f.signed.action(api.publishing.reconcile.lookup, args),
  ).rejects.toThrow("X_RECONCILIATION_BACKOFF");
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 90000);
  fetch.mockResolvedValue(lookup());
  // Candidate creation is outside the captured request window; waiting never fabricates proof.
  expect(await f.signed.action(api.publishing.reconcile.lookup, args)).toBe(
    "unknown",
  );
});

test("ordinary partial thread can reverify current connection through exact fresh continuation without resending prefix", async () => {
  const f = await fixture();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(response("101"))
    .mockResolvedValueOnce(response("102"))
    .mockResolvedValueOnce(new Response("{}", { status: 429 }));
  for (let i = 0; i < 3; i++)
    await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.run(async (ctx) => {
    const a = (await ctx.db.get(f.accountId))!;
    await ctx.db.patch(a._id, {
      capability: { ...a.capability, publish: false },
      xEvidence: {
        ...a.xEvidence!,
        connectionSequence: 8,
        liveWrite: "unverified",
      },
    });
  });
  await f.signed.mutation(api.publishing.reconcile.continueThread, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!).toMatchObject({
    purpose: "first_write_verification",
    versionId: f.versionId,
    accountConnectionSequence: 8,
    publishedCount: 2,
  });
  fetch.mockClear().mockResolvedValue(response("103"));
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60000));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({
    text: "Third",
    reply: { in_reply_to_tweet_id: "102" },
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(true);
});

test("fresh explicit read authorization after the bounded window can reconcile without a lifetime three-read dead end", async () => {
  const f = await fixture(),
    fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  const original = await lookup().json(),
    args = {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    };
  fetch.mockClear().mockResolvedValue(new Response("{}", { status: 404 }));
  for (let i = 0; i < 3; i++)
    await f.signed.action(api.publishing.reconcile.lookup, args);
  await expect(
    f.signed.action(api.publishing.reconcile.lookup, args),
  ).rejects.toThrow("X_RECONCILIATION_BUDGET_EXHAUSTED");
  expect(fetch).toHaveBeenCalledTimes(3);
  vi.setSystemTime(Date.now() + 15 * 60000 + 1);
  fetch.mockResolvedValue(Response.json(original));
  expect(await f.signed.action(api.publishing.reconcile.lookup, args)).toBe(
    "confirmed",
  );
  expect(fetch).toHaveBeenCalledTimes(4);
});

test("positive media reconciliation uses captured real upload keys and confirmed reply parent", async () => {
  const f = await fixture();
  await attachMedia(f);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  const value = await lookup().json();
  value.data.attachments.media_keys = ["3_456"];
  fetch.mockClear().mockResolvedValue(Response.json(value));
  await f.signed.action(api.publishing.reconcile.lookup, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
    position: 0,
    candidateId: "101",
  });
  await f.signed.mutation(api.publishing.reconcile.continueThread, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
  });
  fetch.mockClear().mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, {
    scheduleId: f.scheduleId,
    generation: 2,
  });
  fetch.mockClear().mockResolvedValue(lookup("102", "Second", "101"));
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 2,
      position: 1,
      candidateId: "102",
    }),
  ).toBe("confirmed");
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.externalPosts?.map(
      (p) => p.externalId,
    ),
  ).toEqual(["101", "102"]);
});
test("changed source and expired old intent require same-snapshot human checks before continuation", async () => {
  for (const kind of ["source", "expiry"]) {
    const f = await fixture(true);
    const media = await attachMedia(f);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("101"))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await f.t.action(internal.publishing.workflows.step, f.job);
    await f.t.action(internal.publishing.workflows.step, f.job);
    if (kind === "source")
      await f.t.run((ctx) =>
        ctx.db.patch(media.assetId, { checksum: "c".repeat(64) }),
      );
    else vi.setSystemTime(Date.now() + 46 * 60000);
    const command = f.signed.mutation(api.publishing.reconcile.continueThread, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    });
    if (kind === "source")
      await expect(command).rejects.toThrow("MEDIA_SNAPSHOT_CHANGED");
    else await expect(command).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  }
});

test("human abort finalization uses definitive late rejection and never discards an unknown effect", async () => {
  for (const outcome of ["rejected", "unknown"] as const) {
    const f = await fixture(true),
      c = (await f.t.mutation(internal.publishing.attempts.claim, f.job))!;
    await f.t.mutation(internal.publishing.attempts.beforeSend, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      credentialGeneration: 1,
      mediaIds: [],
    });
    await f.signed.mutation(api.editorial.cancel, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    });
    await f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      outcome,
      errorCode:
        outcome === "unknown" ? "X_POST_OUTCOME_UNKNOWN" : "X_POST_REJECTED",
      httpStatus: outcome === "unknown" ? 500 : 400,
      durationMs: 1,
    });
    const command = f.signed.mutation(api.publishing.reconcile.finalizeAbort, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 2,
    });
    if (outcome === "unknown")
      await expect(command).rejects.toThrow("X_RECONCILIATION_REQUIRED");
    else {
      await expect(command).resolves.toBeNull();
      expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
        "cancelled",
      );
    }
  }
});

test.each(["role", "lifecycle", "generation"])(
  "idempotent known abort finalization rechecks current %s authority",
  async (kind) => {
    const f = await fixture(true, false);
    await f.signed.mutation(api.editorial.cancel, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    });
    const args = {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 2,
    };
    await f.signed.mutation(api.publishing.reconcile.finalizeAbort, args);
    await f.t.run(async (ctx) => {
      if (kind === "role") {
        const m = await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.actorId).eq("workspaceId", f.workspaceId),
          )
          .unique();
        await ctx.db.patch(m!._id, { role: "Viewer" });
      } else if (kind === "lifecycle")
        await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
      else await ctx.db.patch(f.scheduleId, { generation: 3 });
    });
    await expect(
      f.signed.mutation(api.publishing.reconcile.finalizeAbort, args),
    ).rejects.toThrow(
      kind === "role"
        ? "ROLE_ACCESS_DENIED"
        : kind === "generation"
          ? "SCHEDULE_CONFLICT"
          : "WORKSPACE_INACTIVE",
    );
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.abortRequestedAt,
    ).toBeDefined();
  },
);

test("SPEC: a shortened URL cannot match by replacing only a substring of a longer URL", () => {
  const now = Date.now();
  const data = {
    data: {
      id: "101",
      author_id: "123",
      text: "See https://t.co/z/b",
      created_at: new Date(now).toISOString(),
      referenced_posts: [],
      edit_history_post_ids: ["101"],
      attachments: { media_keys: [] },
      entities: {
        urls: [
          { url: "https://t.co/z", expanded_url: "https://example.test/a" },
        ],
      },
    },
  };
  expect(
    matchedPost(
      data,
      { providerIdentity: "123", mediaIds: [], requestStartedAt: now },
      "101",
      "See https://example.test/a/b",
    ),
  ).toBe(false);
});
test("SPEC: reconciliation commit rechecks immutable approved media source", async () => {
  const f = await fixture(true);
  const media = await attachMedia(f);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  fetch.mockImplementation(async () => {
    await f.t.run((ctx) =>
      ctx.db.patch(media.assetId, { checksum: "c".repeat(64) }),
    );
    return Response.json({
      data: {
        id: "101",
        author_id: "123",
        text: "First",
        created_at: new Date(Date.now()).toISOString(),
        referenced_posts: [],
        edit_history_post_ids: ["101"],
        attachments: { media_keys: ["3_456"] },
      },
    });
  });
  await expect(
    f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    }),
  ).rejects.toThrow("MEDIA_SNAPSHOT_CHANGED");
});

test("SPEC: actual lookup cannot confirm a longer URL through a partial returned entity", async () => {
  const f = await fixture(true);
  await f.t.run(async (ctx) => {
    const ver = (await ctx.db.get(f.versionId))!;
    await ctx.db.patch(f.versionId, {
      content: {
        ...ver.content,
        text: ["See https://example.test/a/b", "Second", "Third"],
      },
    });
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("timeout"));
  await f.t.action(internal.publishing.workflows.step, f.job);
  fetch.mockResolvedValue(
    Response.json({
      data: {
        id: "101",
        author_id: "123",
        text: "See https://t.co/z/b",
        created_at: new Date(Date.now()).toISOString(),
        referenced_posts: [],
        edit_history_post_ids: ["101"],
        attachments: { media_keys: [] },
        entities: {
          urls: [
            { url: "https://t.co/z", expanded_url: "https://example.test/a" },
          ],
        },
      },
    }),
  );
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    }),
  ).toBe("unknown");
});

test.each(["before", "during"])(
  "immutable media checksum, reference and namespace drift %s GET cannot grant evidence",
  async (timing) => {
    for (const kind of ["checksum", "reference", "namespace"] as const) {
      const f = await fixture(true),
        media = await attachMedia(f);
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("timeout"));
      await f.t.action(internal.publishing.workflows.step, f.job);
      const drift = () =>
        f.t.run(async (ctx) => {
          if (kind === "checksum")
            await ctx.db.patch(media.assetId, { checksum: "c".repeat(64) });
          else if (kind === "namespace")
            await ctx.db.patch(media.assetId, { bucket: "another-bucket" });
          else {
            const foreign = await ctx.db.insert("workspaces", {
              name: "Foreign",
              description: "Fixture",
              lifecycle: "active",
            });
            await ctx.db.patch(media.assetId, { workspaceId: foreign });
          }
        });
      if (timing === "before") await drift();
      fetch.mockClear().mockImplementation(async () => {
        if (timing === "during") await drift();
        const data = await lookup().json();
        data.data.attachments.media_keys = ["3_456"];
        return Response.json(data);
      });
      await expect(
        f.signed.action(api.publishing.reconcile.lookup, {
          workspaceId: f.workspaceId,
          scheduleId: f.scheduleId,
          expectedGeneration: 1,
          position: 0,
          candidateId: "101",
        }),
      ).rejects.toThrow(
        kind === "checksum"
          ? "MEDIA_SNAPSHOT_CHANGED"
          : kind === "namespace"
            ? "MEDIA_CONFIGURATION_REQUIRED"
            : "REFERENCE_ACCESS_DENIED",
      );
      expect(fetch).toHaveBeenCalledTimes(timing === "before" ? 0 : 1);
      const schedule = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
      expect(schedule.externalPosts ?? []).toEqual([]);
      expect(schedule.abortRequestedAt).toBeUndefined();
      expect(
        (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
      ).toBe(false);
      vi.restoreAllMocks();
    }
  },
);

async function expiredSending() {
  const f = await fixture(true);
  const c = (await f.t.mutation(internal.publishing.attempts.claim, f.job))!;
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    credentialGeneration: 1,
    mediaIds: [],
  });
  vi.setSystemTime(c.leaseUntil + 1);
  await f.t.mutation(internal.publishing.attempts.claim, f.job);
  expect((await f.t.run((ctx) => ctx.db.get(c._id)))?.stage).toBe("unknown");
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))?.state).toBe(
    "reconciliation_required",
  );
  return { f, c };
}
test("QUALITY: explicit idempotent lookup releases known late confirmation for continuation", async () => {
  const { f, c } = await expiredSending();
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    outcome: "confirmed",
    externalId: "101",
    httpStatus: 201,
    durationMs: 1,
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(
      new Error("Must not fetch: confirmed receipt is enough"),
    );
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    }),
  ).toBe("confirmed");
  expect(fetch).not.toHaveBeenCalled();
  const inspection = await f.signed.query(api.publishing.reconcile.inspect, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
  });
  expect(inspection.positions.map((p) => p.stage)).toEqual([
    "confirmed",
    "unsent",
    "unsent",
  ]);
  await expect(
    f.signed.mutation(api.publishing.reconcile.continueThread, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    }),
  ).resolves.toBeNull();
});
test("QUALITY: known late rejection remains eligible for explicit continuation", async () => {
  const { f, c } = await expiredSending();
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    outcome: "rejected",
    errorCode: "X_POST_RATE_LIMITED",
    httpStatus: 429,
    durationMs: 1,
  });
  const inspection = await f.signed.query(api.publishing.reconcile.inspect, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
  });
  expect(inspection.positions.map((p) => p.stage)).toEqual([
    "rejected",
    "unsent",
    "unsent",
  ]);
  await expect(
    f.signed.mutation(api.publishing.reconcile.continueThread, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    }),
  ).resolves.toBeNull();
});

test("QUALITY: final late confirmation becomes published after explicit reconciliation", async () => {
  const f = await fixture(true);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json({ data: { id: "101" } }, { status: 201 }),
    )
    .mockResolvedValueOnce(
      Response.json({ data: { id: "102" } }, { status: 201 }),
    );
  await f.t.action(internal.publishing.workflows.step, f.job);
  await f.t.action(internal.publishing.workflows.step, f.job);
  const c = (await f.t.mutation(internal.publishing.attempts.claim, f.job))!;
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    credentialGeneration: 1,
    mediaIds: [],
  });
  vi.setSystemTime(c.leaseUntil + 1);
  await f.t.mutation(internal.publishing.attempts.claim, f.job);
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    outcome: "confirmed",
    externalId: "103",
    httpStatus: 201,
    durationMs: 1,
  });
  fetch
    .mockClear()
    .mockRejectedValue(new Error("Known receipt must not fetch"));
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 2,
      candidateId: "103",
    }),
  ).toBe("confirmed");
  expect(fetch).not.toHaveBeenCalled();
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))?.externalPosts?.map(
      (p) => p.externalId,
    ),
  ).toEqual(["101", "102", "103"]);
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))?.state).toBe(
    "published",
  );
});

test("known late receipt completion does not require expired read tokens or current R2 configuration", async () => {
  const f = await fixture(true);
  await attachMedia(f);
  const c = (await f.t.mutation(internal.publishing.attempts.claim, f.job))!;
  await f.t.mutation(internal.publishing.attempts.beforeSend, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    credentialGeneration: 1,
    mediaIds: ["456"],
  });
  vi.setSystemTime(c.leaseUntil + 1);
  await f.t.mutation(internal.publishing.attempts.claim, f.job);
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    outcome: "confirmed",
    externalId: "101",
    httpStatus: 201,
    durationMs: 1,
  });
  await f.t.run((ctx) =>
    ctx.db.patch(f.credentialId, { expiresAt: Date.now() - 1 }),
  );
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
  vi.stubEnv("R2_MEDIA_BUCKET", "");
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Known must not fetch"));
  expect(
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    }),
  ).toBe("confirmed");
  expect(fetch).not.toHaveBeenCalled();
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
    "partially_published",
  );
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
  ).toBe(false);
  await expect(
    f.signed.mutation(api.publishing.reconcile.continueThread, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    }),
  ).rejects.toThrow();
});

test.each([429, 400])(
  "resolved late rejection %s preserves provider backoff or permanent refusal",
  async (httpStatus) => {
    const { f, c } = await expiredSending();
    await f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      outcome: "rejected",
      errorCode: httpStatus === 429 ? "X_POST_RATE_LIMITED" : "X_POST_REJECTED",
      httpStatus,
      rateResetAt: Date.now() + 60000,
      durationMs: 1,
    });
    const args = {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    };
    const inspection = await f.signed.query(api.publishing.reconcile.inspect, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
    });
    expect(inspection.positions[0].stage).toBe("rejected");
    expect(inspection.positions[0].notBefore).toBe(Date.now() + 60000);
    await expect(
      f.signed.mutation(api.publishing.reconcile.continueThread, args),
    ).rejects.toThrow(
      httpStatus === 429 ? "X_POST_RATE_LIMITED" : "X_POST_PERMANENT_REJECTION",
    );
    expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.generation).toBe(
      1,
    );
  },
);

test.each(["role", "lifecycle", "generation", "provider", "parent"])(
  "stored late completion still checks current %s guards",
  async (kind) => {
    const { f, c } = await expiredSending();
    await f.t.mutation(internal.publishing.attempts.receipt, {
      attemptId: c._id,
      claimSequence: c.claimSequence,
      outcome: "confirmed",
      externalId: "101",
      httpStatus: 201,
      durationMs: 1,
    });
    await f.t.run(async (ctx) => {
      if (kind === "role") {
        const m = await ctx.db
          .query("memberships")
          .withIndex("by_userId_and_workspaceId", (q) =>
            q.eq("userId", f.actorId).eq("workspaceId", f.workspaceId),
          )
          .unique();
        await ctx.db.patch(m!._id, { role: "Viewer" });
      } else if (kind === "lifecycle")
        await ctx.db.patch(f.workspaceId, { lifecycle: "deleting" });
      else if (kind === "generation")
        await ctx.db.patch(f.scheduleId, { generation: 2 });
      else if (kind === "provider")
        await ctx.db.patch(f.accountId, { providerIdentity: "other" });
      else await ctx.db.patch(c._id, { parentId: "invalid-parent" });
    });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No provider request"));
    await expect(
      f.signed.action(api.publishing.reconcile.lookup, {
        workspaceId: f.workspaceId,
        scheduleId: f.scheduleId,
        expectedGeneration: 1,
        position: 0,
        candidateId: "101",
      }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
      "reconciliation_required",
    );
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.accountId)))!.capability.publish,
    ).toBe(false);
  },
);

test("QUALITY DELTA: legacy cancelled status cannot be reopened by confirming stored receipt", async () => {
  const { f, c } = await expiredSending();
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    outcome: "confirmed",
    externalId: "101",
    httpStatus: 201,
    durationMs: 1,
  });
  const args = {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
    position: 0,
    candidateId: "101",
  };
  // Existing schedules may lack the optional fields introduced for TASK12.2 abort audit.
  await f.t.run((ctx) =>
    ctx.db.patch(f.scheduleId, {
      state: "cancelled",
      abortRequestedAt: undefined,
      abortRequestedBy: undefined,
    }),
  );
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Must not fetch"));
  expect(await f.signed.action(api.publishing.reconcile.lookup, args)).toBe(
    "confirmed",
  );
  expect(fetch).not.toHaveBeenCalled();
  const normalized = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))?.state;
  let resumed = false;
  try {
    await f.signed.mutation(api.publishing.reconcile.continueThread, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    });
    resumed = true;
  } catch {
    /* A cancelled operation must remain blocked. */
  }
  expect({ normalized, resumed }).toEqual({
    normalized: "cancelled",
    resumed: false,
  });
});

test.each(["unknown", "sending"] as const)(
  "legacy cancelled %s retains cancellation and the account barrier",
  async (stage) => {
    const { f, c } = await expiredSending();
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.scheduleId, {
        state: "cancelled",
        abortRequestedAt: undefined,
        abortRequestedBy: undefined,
      });
      await ctx.db.patch(c._id, { stage });
    });
    await f.signed.mutation(api.editorial.revoke, {
      workspaceId: f.workspaceId,
      approvalId: f.approvalId,
    });
    const approvalId = await f.signed.mutation(
      api.editorial.approveFirstWrite,
      {
        workspaceId: f.workspaceId,
        versionId: f.versionId,
        accountId: f.accountId,
      },
    );
    await expect(
      f.signed.mutation(api.editorial.confirmFirstWrite, {
        workspaceId: f.workspaceId,
        versionId: f.versionId,
        accountId: f.accountId,
        approvalId,
      }),
    ).rejects.toThrow("FIRST_WRITE_ACTIVE_JOB");
    const storedAttempt = (await f.t.run((ctx) => ctx.db.get(c._id)))!;
    const value = await lookup().json();
    value.data.created_at = new Date(
      storedAttempt.requestStartedAt!,
    ).toISOString();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json(value));
    if (stage === "sending") vi.setSystemTime(Date.now() + 20001);
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    });
    await f.signed.action(api.publishing.reconcile.lookup, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
      position: 0,
      candidateId: "101",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const s = (await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!;
    expect(s.state).toBe("cancelled");
    expect(s.abortRequestedAt).toBeUndefined();
    expect(s.abortRequestedBy).toBeUndefined();
    await expect(
      f.signed.mutation(api.publishing.reconcile.continueThread, {
        workspaceId: f.workspaceId,
        scheduleId: f.scheduleId,
        expectedGeneration: 1,
      }),
    ).rejects.toThrow();
  },
);

test("published terminal status cannot be reopened by stored receipt reconciliation", async () => {
  const { f, c } = await expiredSending();
  await f.t.mutation(internal.publishing.attempts.receipt, {
    attemptId: c._id,
    claimSequence: c.claimSequence,
    outcome: "confirmed",
    externalId: "101",
    httpStatus: 201,
    durationMs: 1,
  });
  await f.t.run((ctx) => ctx.db.patch(f.scheduleId, { state: "published" }));
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("No new provider request"));
  await f.signed.action(api.publishing.reconcile.lookup, {
    workspaceId: f.workspaceId,
    scheduleId: f.scheduleId,
    expectedGeneration: 1,
    position: 0,
    candidateId: "101",
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.scheduleId)))!.state).toBe(
    "published",
  );
  expect(fetch).not.toHaveBeenCalled();
  await expect(
    f.signed.mutation(api.publishing.reconcile.continueThread, {
      workspaceId: f.workspaceId,
      scheduleId: f.scheduleId,
      expectedGeneration: 1,
    }),
  ).rejects.toThrow();
});
