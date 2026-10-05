import { afterEach, expect, test, vi } from "vitest";
import { PNG } from "pngjs";
import { validateBytes } from "../../media/validation";
import { checkedBytes, mediaRequest, uploadResult } from "./publish";

afterEach(() => vi.restoreAllMocks());
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
