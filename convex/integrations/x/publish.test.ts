import { afterEach, expect, test, vi } from "vitest";
import { PNG } from "pngjs";
import { validateBytes } from "../../media/validation";
import {
  checkedBytes,
  mediaRequest,
  uploadResult,
  transientR2Read,
} from "./publish";

afterEach(() => vi.restoreAllMocks());
test("only known R2 GET transport and throttling/service errors are retryable", () => {
  for (const error of [
    { name: "TimeoutError" },
    { name: "AbortError" },
    { code: "ECONNRESET" },
    { $metadata: { httpStatusCode: 429 } },
    { $metadata: { httpStatusCode: 503 } },
  ])
    expect(transientR2Read(error)).toBe(true);
  for (const error of [
    new Error("unknown"),
    { name: "AccessDenied" },
    { $metadata: { httpStatusCode: 403 } },
    { $metadata: { httpStatusCode: 404 } },
    { name: "MediaValidationError" },
    null,
  ])
    expect(transientR2Read(error)).toBe(false);
});
test("approved checksum and size fail before provider receives bytes", () => {
  const bytes = PNG.sync.write({
    width: 1,
    height: 1,
    data: Buffer.from([1, 2, 3, 255]),
  } as PNG);
  const expected = validateBytes(bytes, bytes.length, "image/png");
  expect(checkedBytes(bytes, expected)).toBe(bytes);
  expect(() =>
    checkedBytes(bytes, { ...expected, checksum: "0".repeat(64) }),
  ).toThrow();
  expect(() =>
    uploadResult(
      {
        data: {
          id: "123",
          processing_info: { state: "succeeded", check_after_secs: "1" },
        },
      },
      "123",
      true,
    ),
  ).toThrow();
  expect(() =>
    checkedBytes(bytes, { ...expected, size: bytes.length + 1 }),
  ).toThrow();
});
test("provider responses reject wrong IDs, duration and processing types", () => {
  const response = {
    data: {
      id: "123",
      expires_after_secs: 3600,
      processing_info: { state: "pending", check_after_secs: 2 },
    },
  };
  expect(uploadResult(response, "123", true)).toMatchObject({
    mediaId: "123",
    state: "processing",
    waitMs: 2000,
  });
  expect(() => uploadResult(response, "456", true)).toThrow();
  expect(() =>
    uploadResult({ data: { id: "123", expires_after_secs: Infinity } }),
  ).toThrow();
  expect(() =>
    uploadResult(
      { data: { id: "123", processing_info: { state: "unknown" } } },
      "123",
      true,
    ),
  ).toThrow();
});
test("fixed HTTPS requests use approved nested alt and no redirects; POST timeout stays uncertain", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ data: { id: "123" } })));
  await mediaRequest("metadata", "fixture-token", "123", "Exact approved alt");
  expect(fetch).toHaveBeenCalledWith(
    "https://api.x.com/2/media/metadata",
    expect.objectContaining({
      redirect: "error",
      body: JSON.stringify({
        id: "123",
        metadata: { alt_text: { text: "Exact approved alt" } },
      }),
    }),
  );
  await expect(
    mediaRequest("append", "fixture-token", undefined, {
      bytes: Buffer.from([1]),
      segment: 0,
    }),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockRejectedValueOnce(new Error("network"));
  await expect(
    mediaRequest("initialize", "fixture-token", undefined, {
      size: 12,
      mime: "image/png",
    }),
  ).rejects.toMatchObject({ outcome: "uncertain" });
  fetch.mockResolvedValueOnce(new Response("x".repeat(32769)));
  await expect(
    mediaRequest("status", "fixture-token", "123"),
  ).rejects.toThrow();
});

test("media key preserves only actual initialized provider evidence, never inferred from an ID", () => {
  expect(
    uploadResult({
      data: { id: "123", media_key: "3_123", expires_after_secs: 3600 },
    }).mediaKey,
  ).toBe("3_123");
  expect(
    uploadResult({ data: { id: "123", expires_after_secs: 3600 } }).mediaKey,
  ).toBeUndefined();
  expect(() =>
    uploadResult({
      data: {
        id: "123",
        media_key: "https://foreign.test",
        expires_after_secs: 3600,
      },
    }),
  ).toThrow();
});
