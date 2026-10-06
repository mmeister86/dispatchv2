import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embed } from "ai";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import { validVector } from "../content/similarity";
const endpoint = "https://router.eu.requesty.ai/v1/embeddings";
const invalid = () => new Error("EMBEDDING_PROVIDER_UNAVAILABLE");
export const execute = action({
  args: { attemptId: v.id("aiAttempts") },
  returns: v.object({
    outcome: v.union(
      v.literal("prepared"),
      v.literal("replay"),
      v.literal("unavailable"),
    ),
    vectorId: v.union(v.id("contentEmbeddings"), v.null()),
  }),
  handler: async (
    ctx,
    a,
  ): Promise<{
    outcome: "prepared" | "replay" | "unavailable";
    vectorId: import("../_generated/dataModel").Id<"contentEmbeddings"> | null;
  }> => {
    const apiKey = process.env.REQUESTY_API_KEY;
    let captured;
    try {
      captured = await ctx.runMutation(internal.content.similarity.claim, a);
    } catch (e) {
      rethrowUnexpectedSourceError(e);
      return { outcome: "unavailable", vectorId: null };
    }
    if (!apiKey) return { outcome: "unavailable", vectorId: null };
    if (!captured) return { outcome: "replay", vectorId: null };
    const { attempt: t, policy: p, text } = captured;
    let calls = 0,
      tokens: number | null = null,
      rawVector: number[] | null = null;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const provider = createOpenAICompatible({
        name: "requesty",
        apiKey,
        baseURL: p.baseURL,
        fetch: async (url, init) => {
          if (
            ++calls !== 1 ||
            String(url) !== endpoint ||
            init?.method !== "POST" ||
            typeof init.body !== "string" ||
            new TextEncoder().encode(init.body).length > 256 * 1024 ||
            Date.now() >= t.deadline ||
            controller.signal.aborted
          )
            throw invalid();
          const request = JSON.parse(init.body);
          if (
            request.model !== t.model ||
            request.encoding_format !== "float" ||
            request.dimensions !== t.identity.dimension ||
            !Array.isArray(request.input) ||
            request.input.length !== 1 ||
            request.input[0] !== text
          )
            throw invalid();
          await ctx.runQuery(internal.content.similarity.context, a);
          if (Date.now() >= t.deadline || controller.signal.aborted)
            throw invalid();
          const response = await fetch(url, {
            ...init,
            redirect: "error",
            signal: controller.signal,
          });
          if (
            response.redirected ||
            (response.url && response.url !== endpoint) ||
            !response.body
          )
            throw invalid();
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const next = await reader.read();
              if (next.done) break;
              size += next.value.byteLength;
              if (size > 256 * 1024) throw invalid();
              chunks.push(next.value);
            }
          } finally {
            void reader.cancel().catch(() => {});
          }
          const bytes = new Uint8Array(size);
          let at = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, at);
            at += chunk.length;
          }
          const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          let raw;
          try {
            raw = JSON.parse(body);
          } catch {
            throw invalid();
          }
          if (
            response.ok &&
            raw &&
            typeof raw === "object" &&
            !Array.isArray(raw)
          ) {
            const u = raw.usage;
            if (
              u &&
              typeof u === "object" &&
              !Array.isArray(u) &&
              Number.isSafeInteger(u.prompt_tokens) &&
              u.prompt_tokens >= 0 &&
              u.prompt_tokens <= 1e9 &&
              u.total_tokens === u.prompt_tokens &&
              (u.cost === undefined ||
                (typeof u.cost === "number" &&
                  Number.isFinite(u.cost) &&
                  u.cost >= 0))
            )
              tokens = u.prompt_tokens;
            if (
              raw.model === t.identity.resolvedModel &&
              Array.isArray(raw.data) &&
              raw.data.length === 1 &&
              raw.data[0]?.index === 0 &&
              Array.isArray(raw.data[0].embedding) &&
              validVector(raw.data[0].embedding, t.identity.dimension) &&
              tokens !== null &&
              tokens <= t.maxInputTokens
            )
              rawVector = raw.data[0].embedding;
          }
          return new Response(body, {
            status: response.status,
            headers: response.headers,
          });
        },
      });
      const pending = embed({
        model: provider.embeddingModel(t.model),
        value: text,
        maxRetries: 0,
        abortSignal: controller.signal,
        providerOptions: {
          openaiCompatible: { dimensions: t.identity.dimension },
        },
      });
      const result = await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => {
              controller.abort();
              reject(invalid());
            },
            Math.max(1, t.deadline - Date.now()),
          );
        }),
      ]);
      await ctx.runMutation(internal.content.similarity.settle, {
        ...a,
        inputTokens: tokens,
        errorCode: rawVector === null ? "EMBEDDING_RESPONSE_INVALID" : null,
      });
      if (
        rawVector === null ||
        JSON.stringify(result.embedding) !== JSON.stringify(rawVector) ||
        result.usage.tokens !== tokens ||
        Date.now() >= t.deadline
      )
        return { outcome: "unavailable", vectorId: null };
      const vectorId = await ctx.runMutation(
        internal.content.similarity.commit,
        { ...a, vector: rawVector },
      );
      return { outcome: vectorId ? "prepared" : "unavailable", vectorId };
    } catch {
      await ctx.runMutation(internal.content.similarity.settle, {
        ...a,
        inputTokens: tokens,
        errorCode: "EMBEDDING_PROVIDER_UNAVAILABLE",
      });
      return { outcome: "unavailable", vectorId: null };
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
    }
  },
});
