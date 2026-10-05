"use node";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { PREVIEW_SECONDS } from "./limits";
import { validateBytes, MediaValidationError } from "./validation";
export function configuration() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucket = process.env.R2_MEDIA_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID,
    secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (
    !account ||
    !/^[a-f0-9]{32}$/i.test(account) ||
    !bucket ||
    !accessKeyId ||
    !secretAccessKey ||
    process.env.R2_MEDIA_EU_CONFIRMED !== "true"
  )
    throw new ConvexError("MEDIA_CONFIGURATION_REQUIRED");
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      forcePathStyle: true,
      endpoint: `https://${account}.eu.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 1,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
}
export const status = action({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ configured: v.boolean() }),
  handler: async (ctx, a): Promise<{ configured: boolean }> => {
    await ctx.runQuery(api.media.uploads.authorize, a);
    try {
      configuration();
      return { configured: true };
    } catch {
      return { configured: false };
    }
  },
});
export const prepare = action({
  args: {
    workspaceId: v.id("workspaces"),
    requestId: v.string(),
    name: v.string(),
    size: v.number(),
    mime: v.string(),
    alt: v.string(),
  },
  returns: v.object({
    sessionId: v.id("mediaUploadSessions"),
    assetId: v.id("mediaAssets"),
    uploadUrl: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (
    ctx,
    a,
  ): Promise<{
    sessionId: Id<"mediaUploadSessions">;
    assetId: Id<"mediaAssets">;
    uploadUrl: string;
    expiresAt: number;
  }> => {
    await ctx.runQuery(api.media.uploads.authorize, {
      workspaceId: a.workspaceId,
    });
    const { client } = configuration();
    const s = await ctx.runMutation(internal.media.uploads.reserve, a);
    // ContentLength is part of the signed request; server streamed-byte checks remain authoritative.
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: s.bucket,
        Key: s.temporaryKey,
        ContentType: s.expectedMime,
        ContentLength: s.expectedSize,
      }),
      {
        expiresIn: Math.max(1, Math.floor((s.expiresAt - Date.now()) / 1000)),
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    );
    return {
      sessionId: s._id,
      assetId: s.assetId,
      uploadUrl,
      expiresAt: s.expiresAt,
    };
  },
});
export async function readBounded(
  client: S3Client,
  bucket: string,
  key: string,
  limit: number,
): Promise<Buffer | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 30000);
  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { abortSignal: abort.signal },
    );
    if (!result.Body) throw new MediaValidationError("MEDIA_VALIDATION_FAILED");
    const stream = result.Body as AsyncIterable<Uint8Array> & {
      destroy?: () => void;
    };
    if (result.ContentLength === undefined || result.ContentLength > limit) {
      stream.destroy?.();
      throw new MediaValidationError("MEDIA_VALIDATION_FAILED");
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
      total += chunk.byteLength;
      if (total > limit) {
        stream.destroy?.();
        throw new MediaValidationError("MEDIA_VALIDATION_FAILED");
      }
      chunks.push(Buffer.from(chunk));
    }
    if (total !== result.ContentLength)
      throw new MediaValidationError("MEDIA_VALIDATION_FAILED");
    return Buffer.concat(chunks, total);
  } catch (e) {
    if (
      (e as { name?: string }).name === "NoSuchKey" ||
      (e as { $metadata?: { httpStatusCode: number } }).$metadata
        ?.httpStatusCode === 404
    )
      return null;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
// The same fixed key is used after every interruption. Existing final bytes always win.
export async function finalizeObject(
  s: {
    expectedSize: number;
    expectedMime: string;
    temporaryKey: string;
    finalKey: string;
  },
  read: (key: string) => Promise<Buffer | null>,
  write: (key: string, bytes: Buffer, mime: string) => Promise<void>,
) {
  let final = await read(s.finalKey);
  if (!final) {
    const temporary = await read(s.temporaryKey);
    if (!temporary) throw new ConvexError("UPLOAD_BYTES_MISSING");
    const checked = validateBytes(temporary, s.expectedSize, s.expectedMime);
    try {
      await write(s.finalKey, temporary, checked.mime);
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode: number } }).$metadata
        ?.httpStatusCode;
      if (status !== 412 && status !== 409) throw e;
    }
    final = await read(s.finalKey);
  }
  if (!final) throw new ConvexError("MEDIA_STORAGE_RETRY_REQUIRED");
  return validateBytes(final, s.expectedSize, s.expectedMime);
}
export const finish = action({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.id("mediaUploadSessions"),
  },
  returns: v.id("mediaAssets"),
  handler: async (ctx, a): Promise<Id<"mediaAssets">> => {
    const s = await ctx.runMutation(internal.media.uploads.claim, a);
    if (s.state === "ready") return s.assetId;
    const { client, bucket } = configuration();
    if (s.bucket !== bucket)
      throw new ConvexError("MEDIA_CONFIGURATION_REQUIRED");
    try {
      const metadata = await finalizeObject(
        s,
        (key) => readBounded(client, bucket, key, s.expectedSize),
        (key, bytes, mime) =>
          client
            .send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: bytes,
                ContentType: mime,
                ContentLength: bytes.length,
                IfNoneMatch: "*",
              }),
              { abortSignal: AbortSignal.timeout(30000) },
            )
            .then(() => {}),
      );
      return await ctx.runMutation(internal.media.uploads.complete, {
        sessionId: s._id,
        generation: s.generation,
        metadata,
      });
    } catch (e) {
      if (e instanceof MediaValidationError) {
        await ctx.runMutation(internal.media.uploads.fail, {
          sessionId: s._id,
          generation: s.generation,
          code: "MEDIA_VALIDATION_FAILED",
        });
        throw new ConvexError("MEDIA_VALIDATION_FAILED");
      }
      if (e instanceof ConvexError) throw e;
      // Keep the persisted final key/claim. A retry after the action lease reads existing final bytes.
      throw new ConvexError("MEDIA_STORAGE_RETRY_REQUIRED");
    }
  },
});
export const preview = action({
  args: { workspaceId: v.id("workspaces"), assetId: v.id("mediaAssets") },
  returns: v.object({ url: v.string(), expiresAt: v.number() }),
  handler: async (ctx, a): Promise<{ url: string; expiresAt: number }> => {
    const s = await ctx.runQuery(internal.media.assets.previewSource, a);
    const { client, bucket } = configuration();
    if (s.bucket !== bucket)
      throw new ConvexError("MEDIA_CONFIGURATION_REQUIRED");
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: s.objectKey,
        ResponseContentType: s.mime,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: PREVIEW_SECONDS },
    );
    return { url, expiresAt: Date.now() + PREVIEW_SECONDS * 1000 };
  },
});
export async function deleteObject(
  client: S3Client,
  bucket: string,
  key: string,
) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
    abortSignal: AbortSignal.timeout(10000),
  });
}
