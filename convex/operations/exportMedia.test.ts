import { afterEach, describe, expect, it, vi } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { mediaFixture } from "../../tests/media-fixture";
import { api, internal } from "../_generated/api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function setup() {
  vi.stubEnv("R2_MEDIA_BUCKET", "test-bucket");
  vi.stubEnv("R2_ACCESS_KEY_ID", "fixture-key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "fixture-secret");
  vi.stubEnv("R2_MEDIA_EU_CONFIRMED", "true");
  const f = await mediaFixture();
  const s = await f.ready();
  const bytes = new Uint8Array(70).fill(7);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  await f.t.run((ctx) => ctx.db.patch(s.assetId, { checksum }));
  const own = await f.signed.query(api.operations.export.self, {
    workspaceId: f.workspaceId,
    expectedAuthId: (await f.t.run((ctx) => ctx.db.get(f.userId)))!.authId,
    requestKey: "fixture",
  });
  const args = {
    workspaceId: f.workspaceId,
    expectedAuthId: own.authId,
    expectedSessionId: own.sessionId,
    requestKey: "media-fixture",
    selection: { kind: "asset" as const, assetId: s.assetId },
    expectedChecksum: null,
  };
  return { ...f, s, bytes, checksum, args };
}
describe("original media export", () => {
  it("reads exact server-derived byte range and exposes no storage secrets", async () => {
    const f = await setup();
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockImplementation((async (...p: unknown[]) => {
        expect((p[0] as { input: unknown }).input).toEqual({
          Bucket: "test-bucket",
          Key: `final/${f.workspaceId}/${f.s.assetId}`,
          Range: "bytes=0-69",
        });
        return {
          Body: Readable.from([f.bytes]),
          ContentRange: "bytes 0-69/70",
          ContentLength: 70,
        };
      }) as never);
    const r = await f.signed.action(api.operations.exportMedia.readOriginal, {
      ...f.args,
      offset: 0,
    });
    expect(new Uint8Array(r.bytes)).toEqual(f.bytes);
    expect(r.done).toBe(true);
    expect(r.nextOffset).toBe(70);
    expect(JSON.stringify(r)).not.toMatch(
      /test-bucket|fixture-secret|objectKey|r2AccountId/,
    );
    expect(send).toHaveBeenCalledOnce();
  });
  it("rejects stale session, cross workspace and corrupt immutable upload binding before I/O", async () => {
    const f = await setup();
    const send = vi.spyOn(S3Client.prototype, "send");
    await expect(
      f.signed.action(api.operations.exportMedia.readOriginal, {
        ...f.args,
        expectedSessionId: "other",
        offset: 0,
      }),
    ).rejects.toThrow("EXPORT_SCOPE_CHANGED");
    const other = await f.t.run((ctx) =>
      ctx.db.insert("workspaces", { name: "Other", description: "" }),
    );
    await expect(
      f.signed.action(api.operations.exportMedia.readOriginal, {
        ...f.args,
        workspaceId: other,
        offset: 0,
      }),
    ).rejects.toThrow();
    await f.t.run((ctx) => ctx.db.patch(f.s._id, { finalKey: "wrong-key" }));
    await expect(
      f.signed.action(api.operations.exportMedia.readOriginal, {
        ...f.args,
        offset: 0,
      }),
    ).rejects.toThrow("EXPORT_MEDIA_UNAVAILABLE");
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects ignored ranges, oversized/truncated streams and missing objects", async () => {
    const f = await setup();
    const send = vi.spyOn(S3Client.prototype, "send");
    for (const body of [new Uint8Array(69), new Uint8Array(71)]) {
      send.mockResolvedValueOnce({
        Body: Readable.from([body]),
        ContentRange: "bytes 0-69/70",
        ContentLength: 70,
      } as never);
      await expect(
        f.signed.action(api.operations.exportMedia.readOriginal, {
          ...f.args,
          offset: 0,
        }),
      ).rejects.toThrow("EXPORT_MEDIA_CORRUPT");
    }
    send.mockResolvedValueOnce({
      Body: Readable.from([f.bytes]),
      ContentLength: 70,
    } as never);
    await expect(
      f.signed.action(api.operations.exportMedia.readOriginal, {
        ...f.args,
        offset: 0,
      }),
    ).rejects.toThrow("EXPORT_MEDIA_CORRUPT");
    send.mockRejectedValueOnce(
      Object.assign(new Error("missing"), { name: "NoSuchKey" }),
    );
    await expect(
      f.signed.action(api.operations.exportMedia.readOriginal, {
        ...f.args,
        offset: 0,
      }),
    ).rejects.toThrow("EXPORT_MEDIA_MISSING");
  });
  it("fails if lifecycle changes during streaming and never returns those bytes", async () => {
    const f = await setup();
    vi.spyOn(S3Client.prototype, "send").mockResolvedValue({
      Body: Readable.from(
        (async function* () {
          await f.t.run((ctx) =>
            ctx.db.patch(f.workspaceId, { lifecycle: "deleting" }),
          );
          yield f.bytes;
        })(),
      ),
      ContentRange: "bytes 0-69/70",
      ContentLength: 70,
    } as never);
    await expect(
      f.signed.action(api.operations.exportMedia.readOriginal, {
        ...f.args,
        offset: 0,
      }),
    ).rejects.toThrow("WORKSPACE_INACTIVE");
  });
  it("requires aligned offsets and a checksum pin for continuation", async () => {
    const f = await setup();
    for (const offset of [1, -1, 524288])
      await expect(
        f.signed.action(api.operations.exportMedia.readOriginal, {
          ...f.args,
          offset,
        }),
      ).rejects.toThrow("EXPORT_REQUEST_INVALID");
    await expect(
      f.signed.query(internal.operations.exportMediaSource.prove, {
        ...f.args,
        expectedChecksum: "0".repeat(64),
      }),
    ).rejects.toThrow("EXPORT_MEDIA_UNAVAILABLE");
  });
});
