"use node";
import {
  TypeSafeClient,
  RateLimitError,
  APITimeoutError,
  APIUserAbortError,
  APIError,
} from "@typesafe-ai/sdk";
import { internalAction, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import {
  requestFields,
  outcome,
  answer,
  type Outcome,
  type Answer,
} from "./types";
import { normalize, usage, validQuestions } from "./normalize";
import type { Request } from "./access";
import type { Definition } from "./questions";
import {
  normalizeRouting,
  resolveRoutingQuestions,
} from "./questions/intentRouting";
import { rethrowUnexpectedSourceError } from "../../lib/sourceProof";
const endpoint = "https://api.typesafe.ai/v1/systemone";
type Dispatch =
  | { kind: "analyzer"; request: Request }
  | { kind: "intent-routing"; operationId: Id<"jevRoutingOperations"> };
const resultContract = v.object({
  outcome: v.union(outcome, v.literal("unavailable")),
  answers: v.union(v.record(v.string(), answer), v.null()),
});
function routingLoss(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    if (error.data.endsWith("ANCESTRY_LIMIT")) throw error;
    if (
      [
        "ROUTING_SOURCE_UNAVAILABLE",
        "ROUTING_ACCOUNT_CHANGED",
        "ROUTING_AUTHORITY_UNAVAILABLE",
        "ROUTING_PURPOSE_WITHDRAWN",
        "ROUTING_CONFIGURATION_REQUIRED",
        "ROUTING_CIRCUIT_OPEN",
        "ROUTING_SUPERSEDED",
        "ROUTING_EXPIRED",
        "ROUTING_INPUT_LIMIT",
        "MODEL_BUDGET_EXHAUSTED",
        "ROUTING_ALREADY_ADMITTED",
        "ROUTING_USAGE_UNRESOLVED",
      ].includes(error.data)
    )
      return;
  }
  rethrowUnexpectedSourceError(error);
}
async function executePhysical(
  ctx: ActionCtx,
  a: Dispatch,
): Promise<{
  outcome: Outcome | "unavailable";
  answers: Record<string, Answer> | null;
}> {
  let captured;
  try {
    captured =
      a.kind === "analyzer"
        ? {
            kind: "analyzer" as const,
            value: await ctx.runQuery(
              internal.ai.jev.access.context,
              a.request,
            ),
          }
        : {
            kind: "intent-routing" as const,
            value: await ctx.runQuery(internal.ai.jev.routing.context, {
              operationId: a.operationId,
            }),
          };
  } catch (error) {
    if (a.kind === "intent-routing") routingLoss(error);
    return { outcome: "unavailable" as const, answers: null };
  }
  const timeoutMs =
    a.kind === "analyzer" && a.request.mode === "composer"
      ? captured.value.c.composerTimeoutMs
      : captured.value.c.backgroundTimeoutMs;
  const deadline = Math.min(
    a.kind === "analyzer"
      ? a.request.deadline
      : captured.kind === "intent-routing"
        ? captured.value.deadline
        : Date.now(),
    Date.now() + timeoutMs,
  );
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined,
    attemptId: Id<"aiAttempts"> | null = null,
    calls = 0,
    expired = false,
    invalidBody = false,
    physicalStarted = false,
    started = Date.now();
  let proofError: unknown;
  const record = async (value: unknown, result: Outcome | "unavailable") => {
    if (!attemptId) return;
    const model =
      value &&
      typeof value === "object" &&
      "model" in value &&
      typeof value.model === "string" &&
      /^[A-Za-z0-9_.-]{1,100}$/.test(value.model)
        ? value.model
        : null;
    const finalOutcome: Outcome | "unavailable" =
      a.kind === "intent-routing" && !physicalStarted
        ? "unavailable"
        : expired
          ? "timeout"
          : result;
    const settlement = {
      attemptId,
      ...(a.kind === "intent-routing" && !physicalStarted
        ? { inputTokens: 0, outputTokens: 0 }
        : usage(value)),
      resolvedModel: model,
      outcome: finalOutcome,
      latencyMs: Math.min(600000, Math.max(0, Date.now() - started)),
    };
    if (a.kind === "intent-routing")
      await ctx.runMutation(internal.ai.jev.routing.settle, settlement);
    else
      await ctx.runMutation(internal.ai.jev.access.settle, {
        ...settlement,
        outcome:
          settlement.outcome === "unavailable"
            ? "provider_error"
            : settlement.outcome,
      });
  };
  try {
    const client = new TypeSafeClient({
      apiKey: process.env.TYPESAFE_API_KEY,
      baseURL: "https://api.typesafe.ai",
      defaultModel: captured.value.p.model,
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
            captured.value.p.maxInputTokens ||
          Date.now() >= deadline ||
          controller.signal.aborted
        )
          throw new Error("JEV_REQUEST_INVALID");
        // Exactly one awaited funded attempt precedes this physical boundary; SDK retries cannot reuse it.
        if (a.kind === "intent-routing") {
          try {
            await ctx.runQuery(internal.ai.jev.routing.authorizeFetch, {
              operationId: a.operationId,
              attemptId: attemptId!,
              expectedFingerprint: captured.value.requestFingerprint,
            });
          } catch (error) {
            proofError = error;
            throw error;
          }
          if (Date.now() >= deadline || controller.signal.aborted) {
            expired = true;
            controller.abort();
            throw new Error("JEV_REQUEST_EXPIRED");
          }
        }
        started = Date.now();
        physicalStarted = true;
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
    attemptId =
      a.kind === "analyzer"
        ? await ctx.runMutation(internal.ai.jev.access.fund, {
            ...a.request,
            expectedFingerprint: captured.value.requestFingerprint,
          })
        : await ctx.runMutation(internal.ai.jev.routing.fund, {
            operationId: a.operationId,
            expectedFingerprint: captured.value.requestFingerprint,
          });
    if (Date.now() >= deadline) {
      expired = true;
      controller.abort();
      await record(null, "timeout");
      return { outcome: "timeout", answers: null };
    }
    const questions: Definition["questions"] =
      captured.kind === "intent-routing"
        ? resolveRoutingQuestions(
            captured.value.p.questionVersion,
            captured.value.p.normalizationVersion,
          ).questions
        : Object.fromEntries(
            Object.entries(validQuestions(captured.value.questions)).map(
              ([key, q]) => [
                key,
                q.type === "score"
                  ? {
                      ...q,
                      criteria: [
                        q.criteria[0]!,
                        q.criteria[1]!,
                        ...q.criteria.slice(2),
                      ] as [string, string, ...string[]],
                    }
                  : q,
              ],
            ),
          );
    const pending = Promise.resolve(
      client.systemOne(
        {
          state: captured.value.state,
          questions,
          model: captured.value.p.model,
        },
        {
          signal: controller.signal,
          timeout: Math.max(1, deadline - Date.now()),
          retry: { maxRetries: 0 },
        },
      ),
    ).then(
      async (value) => {
        let result =
          captured.kind === "analyzer"
            ? normalize(value, captured.value.questions)
            : normalizeRouting(value, captured.value.p.model);
        const tokens = usage(value);
        if (
          tokens.inputTokens !== null &&
          tokens.outputTokens !== null &&
          (tokens.inputTokens > captured.value.p.maxInputTokens ||
            tokens.outputTokens > captured.value.p.maxOutputTokens)
        )
          result = { outcome: "invalid_response" };
        return {
          ...result,
          receipt: { ...usage(value), model: value?.model ?? null },
        };
      },
      async (error) => {
        const result: Outcome | "unavailable" = proofError
          ? "unavailable"
          : expired
            ? "timeout"
            : invalidBody
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
    if (proofError) routingLoss(proofError);
    if (a.kind === "intent-routing" && !physicalStarted)
      return { outcome: "unavailable", answers: null };
    if (result.outcome === "success" || result.outcome === "low_confidence") {
      // Current permission/source/profile required again before exposing even normalized results.
      try {
        if (a.kind === "analyzer")
          await ctx.runQuery(internal.ai.jev.access.context, a.request);
        else
          await ctx.runQuery(internal.ai.jev.routing.context, {
            operationId: a.operationId,
          });
      } catch (error) {
        if (a.kind === "intent-routing") routingLoss(error);
        return { outcome: "unavailable" as const, answers: null };
      }
    }
    return {
      outcome: result.outcome,
      answers:
        (result.outcome === "success" || result.outcome === "low_confidence") &&
        "answers" in result
          ? result.answers
          : null,
    };
  } catch (error) {
    await record(
      null,
      expired
        ? "timeout"
        : a.kind === "intent-routing"
          ? "unavailable"
          : "provider_error",
    );
    if (a.kind === "intent-routing") {
      routingLoss(error);
      return { outcome: "unavailable", answers: null };
    }
    return {
      outcome: expired ? ("timeout" as const) : ("provider_error" as const),
      answers: null,
    };
  } finally {
    if (timer) clearTimeout(timer);
    // No writes from pending promises after Action return. Unknown holds require an authoritative later receipt; never replay automatically.
  }
}
export const execute = internalAction({
  args: requestFields,
  returns: resultContract,
  handler: async (ctx, a) =>
    executePhysical(ctx, { kind: "analyzer", request: a }),
});
export const executeRouting = internalAction({
  args: { operationId: v.id("jevRoutingOperations") },
  returns: resultContract,
  handler: async (ctx, a) =>
    executePhysical(ctx, {
      kind: "intent-routing",
      operationId: a.operationId,
    }),
});
