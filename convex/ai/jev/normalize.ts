import { z } from "zod";
import type { Answer, Normalized } from "./types";
import { MIN_CONFIDENCE } from "./thresholds";
const probability = z.number().finite().min(0).max(1);
const token = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export function usage(value: unknown) {
  const r = z
    .object({
      usage: z.object({ input_tokens: token, output_tokens: token }).strict(),
    })
    .safeParse(value);
  return r.success
    ? {
        inputTokens: r.data.usage.input_tokens,
        outputTokens: r.data.usage.output_tokens,
      }
    : { inputTokens: null, outputTokens: null };
}
const description = z.string().min(1).max(4000);
const question = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("choice"),
      instructions: description,
      criteria: z.record(
        z.string().regex(/^[A-Za-z0-9_-]{1,60}$/),
        description,
      ),
    })
    .strict(),
  z
    .object({
      type: z.literal("score"),
      instructions: description,
      criteria: z.array(description).min(2).max(10),
    })
    .strict(),
  z
    .object({
      type: z.literal("noul"),
      instructions: description,
      criteria: z
        .object({ true: description.optional(), false: description.optional() })
        .strict()
        .optional(),
    })
    .strict(),
]);
export function validQuestions(value: unknown) {
  const parsed = z
    .record(z.string().regex(/^[A-Za-z0-9_-]{1,60}$/), question)
    .parse(value);
  const keys = Object.keys(parsed);
  if (
    !keys.length ||
    keys.length > 20 ||
    Object.values(parsed).some(
      (q) =>
        q.type === "choice" &&
        (Object.keys(q.criteria).length < 2 ||
          Object.keys(q.criteria).length > 20),
    )
  )
    throw new Error("JEV_QUESTIONS_INVALID");
  return parsed;
}
function probabilities(value: unknown, keys: string[]) {
  const p = z.record(z.string(), probability).parse(value);
  if (
    Object.keys(p).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(p, k)) ||
    Math.abs(Object.values(p).reduce((a, b) => a + b, 0) - 1) > 1e-6
  )
    throw new Error();
  return p;
}
export function normalize(value: unknown, definitions: unknown): Normalized {
  try {
    const questions = validQuestions(definitions);
    const response = z
      .object({
        model: z.literal("jev-1.13.0"),
        usage: z.object({ input_tokens: token, output_tokens: token }).strict(),
        answers: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(value);
    if (Object.keys(response.answers).length !== Object.keys(questions).length)
      throw new Error();
    const answers: Record<string, Answer> = {};
    let low = false;
    for (const [key, q] of Object.entries(questions)) {
      const raw = response.answers[key];
      if (q.type === "noul") {
        const r = z
          .object({ type: z.literal("noul"), noul: probability })
          .strict()
          .parse(raw);
        answers[key] = { type: "noul", probability: r.noul };
      } else if (q.type === "choice") {
        const r = z
          .object({
            type: z.literal("choice"),
            choice: z.string(),
            confidence: probability,
            probabilities: z.unknown(),
          })
          .strict()
          .parse(raw);
        probabilities(r.probabilities, Object.keys(q.criteria));
        if (!Object.hasOwn(q.criteria, r.choice)) throw new Error();
        answers[key] = {
          type: "choice",
          value: r.choice,
          confidence: r.confidence,
        };
        low ||= r.confidence < MIN_CONFIDENCE;
      } else {
        const r = z
          .object({
            type: z.literal("score"),
            score: z
              .number()
              .finite()
              .min(0)
              .max(q.criteria.length - 1),
            confidence: probability,
            probabilities: z.unknown(),
            legend: z.record(z.string(), description),
          })
          .strict()
          .parse(raw);
        const keys = q.criteria.map((_, i) => String(i));
        probabilities(r.probabilities, keys);
        if (
          Object.keys(r.legend).length !== keys.length ||
          keys.some((k, i) => r.legend[k] !== q.criteria[i])
        )
          throw new Error();
        answers[key] = {
          type: "score",
          value: r.score / (q.criteria.length - 1),
          confidence: r.confidence,
        };
        low ||= r.confidence < MIN_CONFIDENCE;
      }
    }
    return { outcome: low ? "low_confidence" : "success", answers };
  } catch {
    return { outcome: "invalid_response" };
  }
}
