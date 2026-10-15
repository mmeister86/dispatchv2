"use node";
import { ConvexError, v, type Infer } from "convex/values";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { configuration } from "../media/r2";
import { requireR2Binding } from "../media/binding";
import { args, receipt } from "./exportMediaSource";

export const CHUNK_BYTES = 512 * 1024;
const result = v.object({
  ...receipt.fields,
  bytes: v.bytes(),
  offset: v.number(),
  nextOffset: v.number(),
  done: v.boolean(),
});
export const readOriginal = action({
  args: { ...args, offset: v.number() },
  returns: result,
  handler: async (ctx, { offset, ...a }): Promise<Infer<typeof result>> => {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset % CHUNK_BYTES !== 0 ||
      (offset > 0 && a.expectedChecksum === null)
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const before = await ctx.runQuery(
      internal.operations.exportMediaSource.prove,
      a,
    );
    if (offset >= before.size) throw new ConvexError("EXPORT_REQUEST_INVALID");
    const end = Math.min(before.size, offset + CHUNK_BYTES) - 1;
    const { client, ...binding } = configuration();
    requireR2Binding(before, binding);
    const abort = new AbortController();
    const timer = setTimeout(
      () => abort.abort(),
      Math.max(1, before.proofValidUntil - Date.now()),
    );
    let stream:
      (AsyncIterable<Uint8Array> & { destroy?: () => void }) | undefined;
    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: before.bucket,
          Key: before.objectKey,
          Range: `bytes=${offset}-${end}`,
        }),
        { abortSignal: abort.signal },
      );
      stream = response.Body as typeof stream;
      if (
        !stream ||
        typeof stream[Symbol.asyncIterator] !== "function" ||
        response.ContentRange !== `bytes ${offset}-${end}/${before.size}` ||
        response.ContentLength !== end - offset + 1
      )
        throw new ConvexError("EXPORT_MEDIA_CORRUPT");
      const bytes = new Uint8Array(end - offset + 1);
      let length = 0;
      for await (const chunk of stream) {
        if (
          abort.signal.aborted ||
          length + chunk.byteLength > bytes.byteLength
        )
          throw new ConvexError("EXPORT_MEDIA_CORRUPT");
        bytes.set(chunk, length);
        length += chunk.byteLength;
      }
      if (length !== bytes.byteLength)
        throw new ConvexError("EXPORT_MEDIA_CORRUPT");
      const after = await ctx.runQuery(
        internal.operations.exportMediaSource.prove,
        { ...a, expectedChecksum: before.checksum },
      );
      const stable = ({
        observedAt: _o,
        proofValidUntil: _p,
        ...rest
      }: typeof before) => rest;
      if (
        Date.now() >= Math.min(before.proofValidUntil, after.proofValidUntil) ||
        JSON.stringify(stable(before)) !== JSON.stringify(stable(after))
      )
        throw new ConvexError("EXPORT_SCOPE_CHANGED");
      const { bucket: _b, objectKey: _k, r2AccountId: _r, ...safe } = after;
      return {
        ...safe,
        bytes: bytes.buffer,
        offset,
        nextOffset: end + 1,
        done: end + 1 === before.size,
      };
    } catch (e) {
      if (
        (e as { name?: string }).name === "NoSuchKey" ||
        (e as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        throw new ConvexError("EXPORT_MEDIA_MISSING");
      throw e;
    } finally {
      clearTimeout(timer);
      stream?.destroy?.();
      client.destroy();
    }
  },
});
