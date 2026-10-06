"use node";
import { ConvexError, v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { open } from "../lib/crypto";
import { association } from "../integrations/x/fields";
import type { Tokens } from "../integrations/x/client";
import { normalize } from "./normalize";
export const read = internalAction({
  args: { snapshotId: v.id("performanceSnapshots"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    let c, token;
    try {
      c = await ctx.runQuery(
        internal.performance.snapshots.credentialSource,
        a,
      );
      token = await open<Tokens>(
        c.envelope!,
        association(c.workspaceId, c.accountId),
      );
    } catch (e) {
      await ctx.runMutation(internal.performance.snapshots.block, {
        ...a,
        reason:
          e instanceof ConvexError
            ? String(e.data)
            : "OWN_METRICS_CREDENTIAL_UNAVAILABLE",
      });
      return null;
    }
    const attempt = await ctx.runMutation(
      internal.performance.snapshots.begin,
      { ...a, credentialGeneration: c.generation },
    );
    if (!attempt) return null;
    const controller = new AbortController(),
      deadline = Date.now() + 15000;
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("OWN_METRICS_DEADLINE"));
      }, 15000);
    });
    let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let knownCharge = false,
      reason: string | null = "OWN_METRICS_READ_OUTCOME_UNKNOWN",
      result = normalize(
        null,
        attempt.externalId,
        attempt.providerIdentity,
        attempt.fields,
        attempt.dialect,
        "unavailable",
      );
    try {
      const url = new URL(`https://api.x.com/2/tweets/${attempt.externalId}`);
      url.searchParams.set(
        attempt.dialect === "tweet-fields-retweet-v2"
          ? "tweet.fields"
          : "post.fields",
        "id,author_id,created_at,public_metrics" +
          (attempt.fields.some((f) =>
            ["url_clicks", "profile_clicks"].includes(f),
          )
            ? ",non_public_metrics"
            : ""),
      );
      const pending = fetch(url.href, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token.accessToken}` },
      }).then((response) => {
        if (Date.now() >= deadline) {
          void response.body?.cancel().catch(() => {});
          throw new Error("OWN_METRICS_DEADLINE");
        }
        return response;
      });
      const response = await Promise.race([pending, timeout]);
      // Only successful single-post reads establish one approved priced unit. Error billing remains held/unknown.
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        reason =
          response.status === 404
            ? "OWN_METRICS_POST_NOT_FOUND"
            : response.status === 401 || response.status === 403
              ? "OWN_METRICS_ACCESS_UNAVAILABLE"
              : "OWN_METRICS_READ_FAILED";
        result = normalize(
          null,
          attempt.externalId,
          attempt.providerIdentity,
          attempt.fields,
          attempt.dialect,
          response.status === 404
            ? "unavailable"
            : response.status === 401 || response.status === 403
              ? "access_expired"
              : "unavailable",
        );
      } else {
        const reader = response.body?.getReader();
        bodyReader = reader;
        if (!reader) throw new Error();
        let size = 0;
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await Promise.race([reader.read(), timeout]);
          if (Date.now() >= deadline) throw new Error("OWN_METRICS_DEADLINE");
          if (done) break;
          size += value.byteLength;
          if (size > 32768) {
            void reader.cancel().catch(() => {});
            throw new Error();
          }
          chunks.push(value);
        }
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        result = normalize(
          data,
          attempt.externalId,
          attempt.providerIdentity,
          attempt.fields,
          attempt.dialect,
        );
        knownCharge = result.valid;
        reason = result.valid ? null : "OWN_METRICS_RESPONSE_INVALID";
      }
    } catch {
      /* No blind retry: ambiguous billing stays held in the existing three quota scopes. */
    } finally {
      clearTimeout(timer!);
      controller.abort();
      void bodyReader?.cancel().catch(() => {});
    }
    await ctx.runMutation(internal.performance.snapshots.finish, {
      attemptId: attempt.attemptId,
      knownCharge,
      fields: result.fields,
      providerCreatedAt: result.providerCreatedAt,
      reason,
    });
    return null;
  },
});
