"use node";
import {
  TypeSafeClient,
  RateLimitError,
  APITimeoutError,
  APIUserAbortError,
  APIError,
} from "@typesafe-ai/sdk";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { v } from "convex/values";
import {
  requestFields,
  outcome,
  answer,
  type Outcome,
  type Answer,
} from "./types";
import { normalize, usage } from "./normalize";
const endpoint = "https://api.typesafe.ai/v1/systemone";
export const execute = internalAction({
  args: requestFields,
  returns: v.object({
    outcome: v.union(outcome, v.literal("unavailable")),
    answers: v.union(v.record(v.string(), answer), v.null()),
  }),
  handler: async (
    ctx,
    a,
  ): Promise<{
    outcome: Outcome | "unavailable";
    answers: Record<string, Answer> | null;
  }> => {
    let captured;
    try {
      captured = await ctx.runQuery(internal.ai.jev.access.context, a);
    } catch {
      return { outcome: "unavailable" as const, answers: null };
    }
    const timeoutMs =
      a.mode === "composer"
        ? captured.c.composerTimeoutMs
        : captured.c.backgroundTimeoutMs;
    const deadline = Math.min(a.deadline, Date.now() + timeoutMs);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined,
      attemptId: Id<"aiAttempts"> | null = null,
      calls = 0,
      expired = false,
      invalidBody = false,
      started = Date.now();
    const record = async (value: unknown, result: Outcome) => {
      if (!attemptId) return;
      const model =
        value &&
        typeof value === "object" &&
        "model" in value &&
        typeof value.model === "string" &&
        /^[A-Za-z0-9_.-]{1,100}$/.test(value.model)
          ? value.model
          : null;
      await ctx.runMutation(internal.ai.jev.access.settle, {
        attemptId,
        ...usage(value),
        resolvedModel: model,
        outcome: expired ? "timeout" : result,
        latencyMs: Math.min(600000, Math.max(0, Date.now() - started)),
      });
    };
    try {
      const client = new TypeSafeClient({
        apiKey: process.env.TYPESAFE_API_KEY,
        baseURL: "https://api.typesafe.ai",
        defaultModel: captured.p.model,
        logLevel: "off",
        retry: { maxRetries: 0 },
        timeout: Math.max(1, deadline - Date.now()),
        fetch: async (url, init) => {
          if (
            ++calls !== 1 ||
            url !== endpoint ||
            init?.method !== "POST" ||
            typeof init.body !== "string" ||
            new TextEncoder().encode(init.body).length >
              captured.p.maxInputTokens ||
            Date.now() >= deadline ||
            controller.signal.aborted
          )
            throw new Error("JEV_REQUEST_INVALID");
          // Exactly one awaited funded attempt precedes this physical boundary; SDK retries cannot reuse it.
          started = Date.now();
          const response = await fetch(url, { ...init, redirect: "error" });
          if (!response.body) return response;
          const reader = response.body.getReader();
          let bytes = 0;
          return new Response(
            new ReadableStream({
              async pull(stream) {
                try {
                  const next = await reader.read();
                  if (next.done) {
                    stream.close();
                    return;
                  }
                  bytes += next.value.byteLength;
                  if (bytes > 64000) {
                    invalidBody = true;
                    throw new Error("JEV_RESPONSE_LIMIT");
                  }
                  stream.enqueue(next.value);
                } catch {
                  void reader.cancel().catch(() => {});
                  stream.error(new Error("JEV_RESPONSE_INVALID"));
                }
              },
              cancel() {
                void reader.cancel().catch(() => {});
              },
            }),
            { status: response.status, headers: response.headers },
          );
        },
      });
      attemptId = await ctx.runMutation(internal.ai.jev.access.fund, {
        ...a,
        expectedFingerprint: captured.requestFingerprint,
      });
      if (Date.now() >= deadline) {
        expired = true;
        controller.abort();
        await record(null, "timeout");
        return { outcome: "timeout", answers: null };
      }
      const pending = Promise.resolve(
        client.systemOne(
          {
            state: captured.state,
            questions: captured.questions,
            model: captured.p.model,
          },
          {
            signal: controller.signal,
            timeout: Math.max(1, deadline - Date.now()),
            retry: { maxRetries: 0 },
          },
        ),
      ).then(
        async (value) => {
          let result = normalize(value, captured.questions);
          const tokens = usage(value);
          if (
            tokens.inputTokens !== null &&
            tokens.outputTokens !== null &&
            (tokens.inputTokens > captured.p.maxInputTokens ||
              tokens.outputTokens > captured.p.maxOutputTokens)
          )
            result = { outcome: "invalid_response" };
          return {
            ...result,
            receipt: { ...usage(value), model: value?.model ?? null },
          };
        },
        async (error) => {
          const result: Outcome = invalidBody
            ? "invalid_response"
            : error instanceof RateLimitError
              ? "rate_limit"
              : error instanceof APITimeoutError ||
                  error instanceof APIUserAbortError
                ? "timeout"
                : "provider_error";
          const value = error instanceof APIError ? error.body : null;
          return { outcome: result, receipt: { ...usage(value), model: null } };
        },
      );
      const result = await Promise.race([
        pending,
        new Promise<{ outcome: "timeout" }>((resolve) => {
          timer = setTimeout(
            () => {
              expired = true;
              controller.abort();
              resolve({ outcome: "timeout" });
            },
            Math.max(1, deadline - Date.now()),
          );
        }),
      ]);
      await record(
        "receipt" in result
          ? {
              usage: {
                input_tokens: result.receipt.inputTokens,
                output_tokens: result.receipt.outputTokens,
              },
              model: result.receipt.model,
            }
          : null,
        result.outcome,
      );
      if (result.outcome === "success" || result.outcome === "low_confidence") {
        // Current permission/source/profile required again before exposing even normalized results.
        try {
          await ctx.runQuery(internal.ai.jev.access.context, a);
        } catch {
          return { outcome: "unavailable" as const, answers: null };
        }
      }
      return {
        outcome: result.outcome,
        answers:
          (result.outcome === "success" ||
            result.outcome === "low_confidence") &&
          "answers" in result
            ? result.answers
            : null,
      };
    } catch {
      await record(null, expired ? "timeout" : "provider_error");
      return {
        outcome: expired ? ("timeout" as const) : ("provider_error" as const),
        answers: null,
      };
    } finally {
      if (timer) clearTimeout(timer);
      // No writes from pending promises after Action return. Unknown holds require an authoritative later receipt; never replay automatically.
    }
  },
});
