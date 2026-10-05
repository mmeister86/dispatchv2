import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test, expect, vi } from "vitest";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { GifWriter } from "omggif";
import { finalizeObject, readBounded } from "./r2";
import { validateBytes } from "./validation";
import { S3Client } from "@aws-sdk/client-s3";
function png() {
  return PNG.sync.write({
    width: 1,
    height: 1,
    data: Buffer.from([200, 100, 50, 255]),
  } as PNG);
}
test("actual media bytes, checksum and decoded dimensions are validated; forged metadata/truncation/CRC/bombs fail", () => {
  const b = png();
  const result = validateBytes(b, b.length, "image/png");
  expect(result).toMatchObject({
    mime: "image/png",
    size: b.length,
    width: 1,
    height: 1,
    type: "image",
  });
  expect(result.checksum).toHaveLength(64);
  expect(() => validateBytes(b, b.length, "video/mp4")).toThrow();
  expect(() => validateBytes(b, b.length + 1, "image/png")).toThrow();
  const corrupt = Buffer.from(b);
  corrupt[corrupt.length - 5] ^= 255;
  expect(() => validateBytes(corrupt, corrupt.length, "image/png")).toThrow();
  const bomb = Buffer.from(b);
  bomb.writeUInt32BE(0xffffffff, 16);
  expect(() => validateBytes(bomb, bomb.length, "image/png")).toThrow();
  const interlaced = Buffer.from(b);
  interlaced[28] = 1;
  expect(() =>
    validateBytes(interlaced, interlaced.length, "image/png"),
  ).toThrow();
  const jpg = jpeg.encode(
    { width: 1, height: 1, data: Buffer.from([200, 100, 50, 255]) },
    70,
  ).data;
  expect(validateBytes(jpg, jpg.length, "image/jpeg").width).toBe(1);
  expect(() =>
    validateBytes(
      jpg.subarray(0, jpg.length - 10),
      jpg.length - 10,
      "image/jpeg",
    ),
  ).toThrow();
  const gif = Buffer.alloc(1000);
  const writer = new GifWriter(gif, 1, 1, { palette: [0, 0xffffff] });
  writer.addFrame(0, 0, 1, 1, [0]);
  const g = gif.subarray(0, writer.end());
  expect(validateBytes(g, g.length, "image/gif").width).toBe(1);
  expect(() =>
    validateBytes(g.subarray(0, g.length - 2), g.length - 2, "image/gif"),
  ).toThrow();
  const fake = Buffer.from("00000018ftypnot-an-mp4");
  expect(() => validateBytes(fake, fake.length, "video/mp4")).toThrow();
});
test("finalized content cannot be overwritten via a still valid temp grant; DB interruption resumes without copying", async () => {
  const bytes = png(),
    objects = new Map<string, Buffer>([["temp", bytes]]);
  let writes = 0;
  const s = {
    expectedSize: bytes.length,
    expectedMime: "image/png",
    temporaryKey: "temp",
    finalKey: "final",
  };
  const read = async (key: string) => objects.get(key) ?? null;
  const put = async (key: string, b: Buffer) => {
    writes++;
    if (objects.has(key)) throw { $metadata: { httpStatusCode: 412 } };
    objects.set(key, Buffer.from(b));
  };
  const first = await finalizeObject(s, read, put); // Simulate crash before Convex commit.
  objects.set("temp", Buffer.from("new untrusted client bytes"));
  const resumed = await finalizeObject(s, read, put);
  expect(resumed).toEqual(first);
  expect(writes).toBe(1);
  expect(objects.get("final")).toEqual(bytes);
});
test("concurrent immutable write chooses first valid final; invalid final never marks ready", async () => {
  const bytes = png();
  let final: Buffer | null = null;
  const s = {
    expectedSize: bytes.length,
    expectedMime: "image/png",
    temporaryKey: "temp",
    finalKey: "final",
  };
  const read = async (key: string) => (key === "final" ? final : bytes);
  const write = async (_key: string, b: Buffer) => {
    if (final) throw { $metadata: { httpStatusCode: 412 } };
    final = Buffer.from(b);
  };
  const results = await Promise.all([
    finalizeObject(s, read, write),
    finalizeObject(s, read, write),
  ]);
  expect(results[0].checksum).toBe(results[1].checksum);
  final = Buffer.alloc(bytes.length);
  await expect(finalizeObject(s, read, write)).rejects.toThrow(
    "MEDIA_VALIDATION_FAILED",
  );
});
test("streaming actual bytes are capped independently of ContentLength, and bad streams are destroyed", async () => {
  let destroyed = false;
  const stream = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(4);
      yield Buffer.alloc(8);
    },
    destroy() {
      destroyed = true;
    },
  };
  const fake = {
    send: async () => ({ ContentLength: 4, Body: stream }),
  } as unknown as S3Client;
  await expect(readBounded(fake, "bucket", "key", 8)).rejects.toThrow(
    "MEDIA_VALIDATION_FAILED",
  );
  expect(destroyed).toBe(true);
});

test("supported bounded MP4 parses actual container/sample metadata and rejects missing bytes", () => {
  const bytes = readFileSync(
    new URL("../../tests/fixtures/media-h264.mp4", import.meta.url),
  );
  expect(validateBytes(bytes, bytes.length, "video/mp4")).toMatchObject({
    type: "video",
    mime: "video/mp4",
    width: 64,
    height: 64,
    duration: 1,
  });
  const truncated = bytes.subarray(0, bytes.length - 1);
  expect(() =>
    validateBytes(truncated, truncated.length, "video/mp4"),
  ).toThrow();
});

// Tiny valid-CRC chunks exercise parser metadata changes without allocating a bomb.
const crc32 = createRequire(import.meta.url)("pngjs/lib/crc.js").crc32 as (
  bytes: Buffer,
) => number;
function pngChunk(type: string, data: Buffer) {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  chunk.writeInt32BE(
    crc32(chunk.subarray(4, 8 + data.length)),
    8 + data.length,
  );
  return chunk;
}
test("PNG metadata cannot replace the bounded header or violate chunk order/length", () => {
  const original = png();
  const header = Buffer.from(original.subarray(16, 29));
  const interlaced = Buffer.from(header);
  interlaced[12] = 1;
  const insert = (...chunks: Buffer[]) =>
    Buffer.concat([original.subarray(0, 33), ...chunks, original.subarray(33)]);
  const invalid = [
    insert(pngChunk("IHDR", interlaced)),
    insert(pngChunk("IHDR", header)),
    Buffer.concat([
      original.subarray(0, 8),
      pngChunk("IHDR", Buffer.concat([header, Buffer.from([0])])),
      original.subarray(33),
    ]),
    insert(pngChunk("PLTE", Buffer.alloc(771))),
    insert(
      pngChunk("PLTE", Buffer.alloc(3)),
      pngChunk("PLTE", Buffer.alloc(3)),
    ),
    insert(pngChunk("tRNS", Buffer.alloc(2))), // RGBA cannot carry tRNS.
    insert(pngChunk("gAMA", Buffer.alloc(8))),
    insert(
      pngChunk("PLTE", Buffer.alloc(3)),
      pngChunk("gAMA", Buffer.alloc(4)),
    ),
    insert(
      pngChunk("gAMA", Buffer.alloc(4)),
      pngChunk("gAMA", Buffer.alloc(4)),
    ),
    Buffer.concat([
      original.subarray(0, original.length - 12),
      pngChunk("PLTE", Buffer.alloc(3)),
      original.subarray(original.length - 12),
    ]),
    Buffer.concat([
      original.subarray(0, original.length - 12),
      pngChunk("IEND", Buffer.alloc(1)),
    ]),
  ];
  expect(validateBytes(original, original.length, "image/png").width).toBe(1);
  const decode = vi.spyOn(PNG.sync, "read");
  try {
    for (const bytes of invalid)
      expect(() => validateBytes(bytes, bytes.length, "image/png")).toThrow(
        "MEDIA_VALIDATION_FAILED",
      );
    expect(decode).not.toHaveBeenCalled();
  } finally {
    decode.mockRestore();
  }
  const rgb = PNG.sync.write(
    { width: 1, height: 1, data: Buffer.from([200, 100, 50, 255]) } as PNG,
    { colorType: 2 },
  );
  const withMetadata = Buffer.concat([
    rgb.subarray(0, 33),
    pngChunk("gAMA", Buffer.from([0, 0, 177, 143])),
    pngChunk("PLTE", Buffer.alloc(3)),
    pngChunk("tRNS", Buffer.alloc(6)),
    rgb.subarray(33),
  ]);
  expect(
    validateBytes(withMetadata, withMetadata.length, "image/png"),
  ).toMatchObject({ width: 1, height: 1 });
});
