"use node";
import { ConvexError, v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { open } from "../lib/crypto";
import { association } from "../integrations/x/fields";
import type { Tokens } from "../integrations/x/client";
import { normalizePage } from "./historyNormalize";
export const read = internalAction({
  args: { jobId: v.id("historyJobs"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    let c, token;
    try {
      c = await ctx.runQuery(internal.performance.history.credentialSource, a);
      token = await open<Tokens>(
        c.envelope!,
        association(c.workspaceId, c.accountId),
      );
    } catch (e) {
      await ctx.runMutation(internal.performance.history.block, {
        ...a,
        reason:
          e instanceof ConvexError
            ? String(e.data)
            : "OWN_HISTORY_CREDENTIAL_UNAVAILABLE",
      });
      return null;
    }
    const attempt = await ctx.runMutation(internal.performance.history.begin, {
      ...a,
      credentialGeneration: c.generation,
    });
    if (!attempt) return null;
    const controller = new AbortController(),
      deadline = Date.now() + 15000;
    let timer: ReturnType<typeof setTimeout>,
      reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("OWN_HISTORY_DEADLINE"));
      }, 15000);
    });
    let result = normalizePage(
      null,
      attempt.providerIdentity,
      attempt.maxResults,
    );
    result.reason = "OWN_HISTORY_READ_OUTCOME_UNKNOWN";
    try {
      const url = new URL(
        `https://api.x.com/2/users/${attempt.providerIdentity}/tweets`,
      );
      url.searchParams.set("max_results", String(attempt.maxResults));
      url.searchParams.set("exclude", "retweets");
      url.searchParams.set(
        attempt.dialect === "tweet-fields-retweet-v2"
          ? "tweet.fields"
          : "post.fields",
        "id,author_id,created_at,text,referenced_tweets,attachments",
      );
      if (attempt.cursor)
        url.searchParams.set("pagination_token", attempt.cursor);
      const pending = fetch(url.href, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token.accessToken}` },
      }).then((response) => {
        if (Date.now() >= deadline) {
          void response.body?.cancel().catch(() => {});
          throw new Error("OWN_HISTORY_DEADLINE");
        }
        return response;
      });
      const response = await Promise.race([pending, timeout]);
      if (!response.ok) {
        result.reason =
          response.status === 401 || response.status === 403
            ? "OWN_HISTORY_ACCESS_UNAVAILABLE"
            : response.status === 404
              ? "OWN_HISTORY_OWNER_UNAVAILABLE"
              : "OWN_HISTORY_READ_FAILED";
        void response.body?.cancel().catch(() => {});
      } else {
        reader = response.body?.getReader();
        if (!reader) throw new Error();
        let size = 0;
        const chunks: Uint8Array[] = [];
        // 100 supported 25k UTF-16-unit posts, even JSON-escaped, fit this cap; stream and hard deadline remain bounded.
        for (;;) {
          const { done, value } = await Promise.race([reader.read(), timeout]);
          if (Date.now() >= deadline) throw new Error();
          if (done) break;
          size += value.byteLength;
          if (size > 16 * 1024 * 1024) {
            void reader.cancel().catch(() => {});
            throw new Error("OWN_HISTORY_BODY_LIMIT");
          }
          chunks.push(value);
        }
        result = normalizePage(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
          attempt.providerIdentity,
          attempt.maxResults,
        );
      }
    } catch {
      /* Ambiguous paid pages stay held and are never blindly replayed. */
    } finally {
      clearTimeout(timer!);
      controller.abort();
      void reader?.cancel().catch(() => {});
    }
    await ctx.runMutation(internal.performance.history.finish, {
      attemptId: attempt.attemptId,
      ...result,
    });
    return null;
  },
});
