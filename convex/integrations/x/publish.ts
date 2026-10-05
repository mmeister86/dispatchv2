"use node";
import { ConvexError, v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { configuration, readBounded } from "../../media/r2";
import { validateBytes } from "../../media/validation";
import { requireR2Binding } from "../../media/binding";
import {
  mediaJob,
  CHUNK_BYTES,
  EXPIRY_MARGIN_MS,
} from "../../publishing/mediaFields";

export class MediaRequestError extends Error {
  constructor(
    public outcome: "uncertain" | "failed" | "retry",
    public code: string,
    public waitMs = 1000,
  ) {
    super(code);
  }
}
class TransientR2ReadError extends Error {}
export function transientR2Read(error: unknown) {
  const e = error as {
    name?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  } | null;
  return Boolean(
    e &&
    (["TimeoutError", "RequestTimeout", "AbortError"].includes(e.name ?? "") ||
      ["ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(e.code ?? "") ||
      e.$metadata?.httpStatusCode === 429 ||
      (e.$metadata?.httpStatusCode !== undefined &&
        e.$metadata.httpStatusCode >= 500 &&
        e.$metadata.httpStatusCode <= 599)),
  );
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("X_MEDIA_RESPONSE_INVALID");
  return value as Record<string, unknown>;
}
function integer(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error("X_MEDIA_RESPONSE_INVALID");
  return value;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9]{1,19}$/.test(value))
    throw new Error("X_MEDIA_RESPONSE_INVALID");
  return value;
}
export function checkedBytes(
  bytes: Buffer | null,
  expected: { size: number; mime: string; checksum: string },
) {
  if (
    !bytes ||
    validateBytes(bytes, expected.size, expected.mime).checksum !==
      expected.checksum
  )
    throw new ConvexError("MEDIA_SOURCE_CHANGED");
  return bytes;
}
export function uploadResult(
  value: unknown,
  expectedId?: string,
  processing = false,
) {
  const result = object(value),
    data = object(result.data);
  if (
    result.errors !== undefined &&
    (!Array.isArray(result.errors) || result.errors.length)
  )
    throw new Error("X_MEDIA_RESPONSE_INVALID");
  const mediaId = id(data.id);
  const mediaKey = data.media_key;
  if (
    mediaKey !== undefined &&
    (typeof mediaKey !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(mediaKey))
  )
    throw new Error("X_MEDIA_RESPONSE_INVALID");
  if (expectedId && mediaId !== expectedId)
    throw new Error("X_MEDIA_RESPONSE_INVALID");
  const expiresAt =
    data.expires_after_secs === undefined
      ? undefined
      : Date.now() + integer(data.expires_after_secs, 1, 7 * 86400) * 1000;
  if (!processing && !expiresAt) throw new Error("X_MEDIA_RESPONSE_INVALID");
  let state: "metadata" | "processing" | "failed" = "metadata",
    waitMs = 0;
  if (data.processing_info !== undefined) {
    const info = object(data.processing_info);
    if (info.progress_percent !== undefined)
      integer(info.progress_percent, 0, 100);
    if (info.check_after_secs !== undefined)
      integer(info.check_after_secs, 0, 1800);
    if (info.state === "pending" || info.state === "in_progress") {
      state = "processing";
      waitMs = integer(info.check_after_secs, 0, 1800) * 1000;
      waitMs = Math.max(1000, waitMs);
    } else if (info.state === "failed") state = "failed";
    else if (info.state !== "succeeded")
      throw new Error("X_MEDIA_RESPONSE_INVALID");
  }
  return {
    mediaId,
    expiresAt,
    state,
    waitMs,
    ...(mediaKey ? { mediaKey: mediaKey as string } : {}),
  };
}
type Operation = "initialize" | "append" | "finalize" | "status" | "metadata";
export async function mediaRequest(
  operation: Operation,
  token: string,
  mediaId?: string,
  input?:
    | { size: number; mime: string }
    | { bytes: Buffer; segment: number }
    | string,
) {
  if (operation !== "initialize") id(mediaId);
  const url =
    operation === "initialize"
      ? "https://api.x.com/2/media/upload/initialize"
      : operation === "metadata"
        ? "https://api.x.com/2/media/metadata"
        : operation === "status"
          ? `https://api.x.com/2/media/upload?media_id=${mediaId}&command=STATUS`
          : `https://api.x.com/2/media/upload/${mediaId}/${operation}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | FormData | undefined;
  if (operation === "append") {
    const chunk = input as { bytes: Buffer; segment: number };
    integer(chunk.segment, 0, 999);
    integer(chunk.bytes.length, 1, CHUNK_BYTES);
    const form = new FormData();
    form.set("segment_index", String(chunk.segment));
    form.set(
      "media",
      new Blob([new Uint8Array(chunk.bytes)], {
        type: "application/octet-stream",
      }),
      "chunk",
    );
    body = form;
  } else if (operation === "initialize") {
    const src = input as { size: number; mime: string };
    body = JSON.stringify({
      total_bytes: src.size,
      media_type: src.mime,
      media_category:
        src.mime === "video/mp4"
          ? "tweet_video"
          : src.mime === "image/gif"
            ? "tweet_gif"
            : "tweet_image",
      shared: false,
    });
    headers["Content-Type"] = "application/json";
  } else if (operation === "metadata") {
    if (typeof input !== "string" || !input.trim() || input.length > 1000)
      throw new Error("MEDIA_ALT_INVALID");
    body = JSON.stringify({
      id: mediaId,
      metadata: { alt_text: { text: input } },
    });
    headers["Content-Type"] = "application/json";
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: operation === "status" ? "GET" : "POST",
      headers,
      ...(body ? { body } : {}),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (
        operation === "status" &&
        (response.status === 429 || response.status >= 500)
      ) {
        const hint = response.headers.get("retry-after"),
          seconds =
            hint && /^\d+$/.test(hint)
              ? Number(hint)
              : hint
                ? (Date.parse(hint) - Date.now()) / 1000
                : 1;
        throw new MediaRequestError(
          "retry",
          "X_MEDIA_STATUS_RETRY",
          Number.isFinite(seconds)
            ? Math.max(1000, Math.min(1800000, seconds * 1000))
            : 1000,
        );
      }
      throw new MediaRequestError(
        response.status >= 500 ? "uncertain" : "failed",
        response.status === 401 || response.status === 403
          ? "X_REAUTH_OR_MEDIA_CAPABILITY_REQUIRED"
          : "X_MEDIA_REQUEST_REJECTED",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("X_MEDIA_RESPONSE_INVALID");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new Error("X_MEDIA_RESPONSE_INVALID");
      }
      chunks.push(value);
    }
    const result = object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (
      result.errors !== undefined &&
      (!Array.isArray(result.errors) || result.errors.length)
    )
      throw new Error("X_MEDIA_RESPONSE_INVALID");
    const data = object(result.data);
    if (operation === "append") integer(data.expires_at, 1, 253402300799);
    if (operation === "metadata" && id(data.id) !== mediaId)
      throw new Error("X_MEDIA_RESPONSE_INVALID");
    return result;
  } catch (e) {
    if (e instanceof MediaRequestError) throw e;
    throw new MediaRequestError(
      operation === "status" ? "retry" : "uncertain",
      "X_MEDIA_OUTCOME_UNKNOWN",
    );
  } finally {
    clearTimeout(timer);
  }
}
export const prepare = internalAction({
  args: mediaJob,
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    const c = await ctx.runMutation(internal.publishing.media.claim, a);
    if (!c) return null;
    const claim = { checkpointId: c._id, claimSequence: c.claimSequence };
    let bytesRead = 0,
      readStarted = false,
      requestStarted = false,
      measuredAt = Date.now();
    try {
      const config = configuration();
      requireR2Binding(c, config);
      let bytes: Buffer | undefined;
      if (c.phase === "initialize" || c.phase === "append") {
        readStarted = true;
        let retrieved: Buffer | null;
        try {
          retrieved = await readBounded(
            config.client,
            c.bucket,
            c.objectKey,
            c.size,
            (count) => {
              bytesRead += count;
            },
          );
        } catch (e) {
          // Retry only the read transport boundary; byte validation and credential/configuration errors stay permanent.
          if (transientR2Read(e)) throw new TransientR2ReadError();
          throw e;
        }
        bytes = checkedBytes(retrieved, c);
      }
      const credential = await ctx.runAction(
        internal.integrations.x.client.credentialForSchedule,
        {
          scheduleId: a.scheduleId,
          generation: a.generation,
          operation: "media",
        },
      );
      const approved = await ctx.runMutation(
        internal.publishing.media.beforeRequest,
        {
          ...claim,
          credentialGeneration: credential.credentialGeneration,
          bytesRead,
          durationMs: Date.now() - measuredAt,
        },
      );
      if (!approved) throw new ConvexError("X_MEDIA_EXPIRED_OR_CLAIM_CHANGED");
      bytesRead = 0;
      measuredAt = Date.now();
      requestStarted = true;
      const operation =
        c.phase === "processing" ? "status" : (c.phase as Operation);
      const input =
        operation === "initialize"
          ? { size: c.size, mime: c.mime }
          : operation === "append"
            ? {
                bytes: bytes!.subarray(
                  c.nextSegment * CHUNK_BYTES,
                  (c.nextSegment + 1) * CHUNK_BYTES,
                ),
                segment: c.nextSegment,
              }
            : operation === "metadata"
              ? c.alt
              : undefined;
      const response = await mediaRequest(
        operation,
        credential.accessToken,
        c.mediaId,
        input,
      );
      let phase:
          | "append"
          | "finalize"
          | "processing"
          | "metadata"
          | "ready"
          | "failed"
          | "expired",
        mediaId = c.mediaId,
        mediaKey = c.mediaKey,
        expiresAt = c.expiresAt,
        waitMs = 0;
      if (operation === "initialize") {
        const result = uploadResult(response);
        mediaId = result.mediaId;
        mediaKey = result.mediaKey;
        expiresAt = result.expiresAt;
        phase = "append";
      } else if (operation === "append") {
        expiresAt = Math.min(
          expiresAt!,
          integer(object(response.data).expires_at, 1, 253402300799) * 1000,
        );
        phase =
          (c.nextSegment + 1) * CHUNK_BYTES >= c.size ? "finalize" : "append";
      } else if (operation === "metadata") phase = "ready";
      else {
        const result = uploadResult(response, mediaId, true);
        phase = result.state;
        waitMs = result.waitMs;
        expiresAt = Math.min(expiresAt!, result.expiresAt ?? expiresAt!);
      }
      if (expiresAt! <= Date.now() + EXPIRY_MARGIN_MS) phase = "expired";
      await ctx.runMutation(internal.publishing.media.receipt, {
        ...claim,
        phase,
        mediaId,
        ...(mediaKey ? { mediaKey } : {}),
        expiresAt,
        waitMs,
        bytesRead: 0,
        durationMs: Date.now() - measuredAt,
        incomplete: false,
        ...(phase === "failed"
          ? { errorCode: "X_MEDIA_PROCESSING_FAILED" }
          : {}),
      });
    } catch (e) {
      const readRetry =
        e instanceof TransientR2ReadError && (c.readRetries ?? 0) < 3;
      const retry =
        requestStarted &&
        c.phase === "processing" &&
        (!(e instanceof MediaRequestError) || e.outcome === "retry");
      const expired =
        e instanceof ConvexError &&
        e.data === "X_MEDIA_EXPIRED_OR_CLAIM_CHANGED";
      await ctx.runMutation(internal.publishing.media.receipt, {
        ...claim,
        phase: readRetry
          ? c.phase
          : expired
            ? "expired"
            : retry
              ? "processing"
              : requestStarted &&
                  (!(e instanceof MediaRequestError) ||
                    e.outcome === "uncertain")
                ? "uncertain"
                : "failed",
        waitMs: readRetry
          ? 1000 * 2 ** (c.readRetries ?? 0)
          : retry
            ? Math.min(
                (e instanceof MediaRequestError ? e.waitMs : 1000) *
                  2 ** Math.min(c.statusReads, 5),
                1800000,
              )
            : 0,
        errorCode:
          e instanceof TransientR2ReadError
            ? readRetry
              ? "MEDIA_RETRIEVAL_RETRY"
              : "MEDIA_READ_RETRY_BUDGET_EXHAUSTED"
            : e instanceof ConvexError
              ? String(e.data)
              : e instanceof MediaRequestError
                ? e.code
                : "MEDIA_RETRIEVAL_FAILED",
        bytesRead,
        durationMs: Date.now() - measuredAt,
        incomplete: requestStarted || readStarted,
      });
    }
    return null;
  },
});

export class PostRequestError extends Error {
  constructor(
    public outcome: "unknown" | "rejected",
    public code: string,
    public httpStatus?: number,
    public rateResetAt?: number,
  ) {
    super(code);
  }
}
export async function postRequest(
  token: string,
  text: string,
  mediaIds: string[],
  parentId?: string,
) {
  if (
    typeof text !== "string" ||
    !text.trim() ||
    mediaIds.length > 4 ||
    mediaIds.some((m) => !/^[0-9]{1,19}$/.test(m)) ||
    (parentId !== undefined && !/^[0-9]{1,19}$/.test(parentId))
  )
    throw new PostRequestError("rejected", "X_POST_BODY_INVALID");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  let httpStatus: number | undefined, rateResetAt: number | undefined;
  try {
    const response = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}),
        ...(parentId ? { reply: { in_reply_to_tweet_id: parentId } } : {}),
      }),
    });
    httpStatus = response.status;
    const reset = response.headers.get("x-rate-limit-reset");
    if (reset && /^\d{1,12}$/.test(reset)) rateResetAt = Number(reset) * 1000;
    // These statuses prove a rejected request. Server errors and other statuses may have executed it.
    if ([400, 401, 403, 422, 429].includes(response.status)) {
      await response.body?.cancel();
      throw new PostRequestError(
        "rejected",
        response.status === 401 || response.status === 403
          ? "X_REAUTH_OR_CAPABILITY_REQUIRED"
          : response.status === 429
            ? "X_POST_RATE_LIMITED"
            : "X_POST_REJECTED",
        httpStatus,
        rateResetAt,
      );
    }
    if (response.status !== 201) {
      await response.body?.cancel();
      throw new Error("X_POST_RESPONSE_INVALID");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("X_POST_RESPONSE_INVALID");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new Error("X_POST_RESPONSE_INVALID");
      }
      chunks.push(value);
    }
    const result = object(JSON.parse(Buffer.concat(chunks).toString("utf8"))),
      data = object(result.data);
    // A real ID is confirmed even when the provider also returns partial errors; never repeat a confirmed write.
    return { externalId: id(data.id), rateResetAt };
  } catch (e) {
    if (e instanceof PostRequestError) throw e;
    throw new PostRequestError(
      "unknown",
      "X_POST_OUTCOME_UNKNOWN",
      httpStatus,
      rateResetAt,
    );
  } finally {
    clearTimeout(timer);
  }
}
