import { afterEach, expect, test, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { api, components } from "../_generated/api";
import { modelFixture } from "../../tests/model-fixture";
const read = makeFunctionReference<"action">(
  "operations/exportAttachmentBytes:read",
);
const list = makeFunctionReference<"query">(
  "operations/exportAttachments:list",
);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function setup() {
  vi.useFakeTimers();
  const f = await modelFixture();
  await f.t.run(async (ctx) => {
    for (const p of await ctx.db.query("aiPolicies").collect())
      await ctx.db.patch(p._id, { purposes: ["draft", "chat"] });
    for (const p of await ctx.db.query("aiBudgets").collect())
      await ctx.db.patch(p._id, { purposes: ["draft", "chat"] });
  });
  const own = { workspaceId: f.workspaceId, accountId: f.accountId };
  const conversationId = await f.signed.mutation(api.ai.conversations.create, {
    ...own,
    operationKey: "attachment-chat",
  });
  const runId = await f.signed.mutation(api.ai.conversations.send, {
    ...own,
    conversationId,
    operationKey: "attachment-send",
    prompt: "Own",
    allowIdeaCreation: false,
  });
  const r = (await f.t.run((ctx) => ctx.db.get(runId)))!;
  const storageId = await f.t.run((ctx) =>
    ctx.storage.store(
      new Blob(["original stored bytes"], { type: "text/plain" }),
    ),
  );
  const meta = (await f.t.run((ctx) => ctx.db.system.get(storageId)))!;
  const file = await f.t.mutation(components.agent.files.addFile, {
    storageId,
    hash: meta.sha256,
    filename: "original.txt",
    mediaType: "text/plain",
  });
  const url = (await f.t.run((ctx) => ctx.storage.getUrl(storageId)))!;
  await f.t.mutation(components.agent.messages.updateMessage, {
    messageId: r.promptMessageId,
    patch: {
      fileIds: [file.fileId],
      message: {
        role: "user",
        content: [
          { type: "file", data: url, mediaType: "text/plain" },
          {
            type: "image",
            image: new Uint8Array([1, 2, 3]).buffer,
            mediaType: "image/png",
          },
          {
            type: "file",
            data: "aGVsbG8=",
            filename: "inline.txt",
            mediaType: "text/plain",
          },
          {
            type: "file",
            data: "https://foreign.invalid/private",
            mediaType: "text/plain",
          },
        ],
      },
    },
  });
  const user = (await f.t.run((ctx) => ctx.db.get(f.userId)))!;
  const identity = await f.signed.run((ctx) => ctx.auth.getUserIdentity());
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: user.authId,
    expectedSessionId: identity!.sessionId as string,
    requestKey: "attachment",
    parent: { kind: "conversation", accountId: f.accountId, conversationId },
    messageId: r.promptMessageId,
    expectedChecksum: null,
    offset: 0,
  };
  return { ...f, args, file, conversationId, storageId };
}
test("native message-linked stored and inline originals export without internal paths or remote fetch", async () => {
  const f = await setup();
  const physical = vi.fn();
  vi.stubGlobal("fetch", physical);
  const a = await f.signed.action(read, {
    ...f.args,
    attachment: { kind: "stored", index: 0 },
  });
  expect(new TextDecoder().decode(a.bytes)).toBe("original stored bytes");
  expect(a.done).toBe(true);
  expect(a.checksum).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(a)).not.toMatch(
    /storageId|fileId|threadId|foreign.invalid/,
  );
  const b = await f.signed.action(read, {
    ...f.args,
    attachment: { kind: "inline", index: 1 },
  });
  expect(Array.from(new Uint8Array(b.bytes))).toEqual([1, 2, 3]);
  const c = await f.signed.action(read, {
    ...f.args,
    attachment: { kind: "inline", index: 2 },
  });
  expect(new TextDecoder().decode(c.bytes)).toBe("hello");
  await expect(
    f.signed.action(read, {
      ...f.args,
      attachment: { kind: "inline", index: 3 },
    }),
  ).rejects.toThrow("UNSUPPORTED_REFERENCE");
  expect(physical).not.toHaveBeenCalled();
  const {
    messageId: _m,
    expectedChecksum: _e,
    offset: _o,
    ...discovery
  } = f.args;
  const p = await f.signed.query(list, { ...discovery, cursor: null });
  expect(p.rows[0]).toMatchObject({
    messageId: f.args.messageId,
    stored: 1,
    inline: [
      { index: 0, disposition: "stored-reference" },
      { index: 1, disposition: "inline" },
      { index: 2, disposition: "inline" },
      { index: 3, disposition: "unsupported-reference" },
    ],
  });
});
test("actor/session/message bindings, hash and inactive source reject originals", async () => {
  const f = await setup(),
    args = { ...f.args, attachment: { kind: "stored", index: 0 } };
  await expect(
    f.signed.action(read, { ...args, expectedSessionId: "foreign" }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  const threadId = await f.t.mutation(components.agent.threads.createThread, {
    userId: "foreign",
  });
  const result = await f.t.mutation(components.agent.messages.addMessages, {
    threadId: threadId._id,
    messages: [{ message: { role: "user", content: "foreign" } }],
  });
  await expect(
    f.signed.action(read, { ...args, messageId: result.messages[0]._id }),
  ).rejects.toThrow("UNAVAILABLE");
  await expect(
    f.signed.action(read, { ...args, expectedChecksum: "wrong" }),
  ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
  await expect(f.signed.action(read, { ...args, offset: 1 })).rejects.toThrow(
    "EXPORT_REQUEST_INVALID",
  );
  await f.t.run((ctx) => ctx.db.patch(f.conversationId, { state: "deleted" }));
  await expect(f.signed.action(read, args)).rejects.toThrow("CHAT_INACTIVE");
});
test("native metadata limits and checksum corruption fail before original bytes", async () => {
  const f = await setup(),
    args = { ...f.args, attachment: { kind: "stored", index: 0 } };
  await f.t.mutation(components.agent.files.deleteFiles, {
    fileIds: [f.file.fileId],
    force: true,
  });
  await expect(f.signed.action(read, args)).rejects.toThrow("UNAVAILABLE");
});
