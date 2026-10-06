import { v, type Infer } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { requestFields, answer, outcome } from "./types";
import { describeThread, dispatchScore } from "../scoring/dispatchScore";
const nullableNumber = v.union(v.number(), v.null());
const resultContract = v.object({
  outcome: v.union(outcome, v.literal("unavailable")),
  answers: v.union(v.record(v.string(), answer), v.null()),
  deterministic: v.union(
    v.object({
      version: v.literal("structure-v1"),
      segments: v.array(
        v.object({
          position: v.number(),
          text: v.string(),
          length: v.number(),
          lengthValid: v.boolean(),
          hashtags: v.number(),
          mentions: v.number(),
          links: v.number(),
          lines: v.number(),
          questionMarks: v.number(),
          explicitCtaSigns: v.number(),
          repeatedParagraphs: v.boolean(),
          structure: v.number(),
        }),
      ),
      media: v.object({
        present: v.boolean(),
        count: v.number(),
        images: v.number(),
        videos: v.number(),
        withAlt: v.number(),
      }),
      structure: v.number(),
    }),
    v.null(),
  ),
  score: v.union(
    v.object({
      formulaVersion: v.literal("dispatch-score-v1"),
      thresholdVersion: v.literal("jev-confidence-startup-v1"),
      thresholdBasis: v.literal("uncalibrated_startup_assumption"),
      minimumConfidence: v.number(),
      weights: v.object({
        hookStrength: v.number(),
        clarity: v.number(),
        discussionPotential: v.number(),
        originality: v.number(),
        naturalCta: v.number(),
        structure: v.number(),
        history: v.number(),
      }),
      aggregate: nullableNumber,
      missing: v.array(v.string()),
      lowConfidence: v.array(v.string()),
      history: v.object({
        value: v.number(),
        basis: v.literal("assumed_cold_start_baseline"),
      }),
      audienceFit: v.literal("unavailable"),
    }),
    v.null(),
  ),
  questionVersion: v.union(v.literal("jev-post-analysis-v1"), v.null()),
  normalizationVersion: v.union(v.literal("jev-normalization-v1"), v.null()),
});
export const analyze = internalAction({
  args: requestFields,
  returns: resultContract,
  handler: async (ctx, a): Promise<Infer<typeof resultContract>> => {
    const unavailable = {
      outcome: "unavailable" as const,
      answers: null,
      deterministic: null,
      score: null,
      questionVersion: null,
      normalizationVersion: null,
    };
    let captured;
    try {
      captured = await ctx.runQuery(internal.ai.jev.access.context, a);
    } catch {
      return unavailable;
    }
    const result = await ctx.runAction(internal.ai.jev.client.execute, a);
    if (
      !result.answers ||
      (result.outcome !== "success" && result.outcome !== "low_confidence")
    )
      return { ...unavailable, outcome: result.outcome };
    try {
      const current = await ctx.runQuery(internal.ai.jev.access.context, a);
      if (
        current.requestFingerprint !== captured.requestFingerprint ||
        current.questionVersion !== "jev-post-analysis-v1"
      )
        return unavailable;
      const deterministic = describeThread(
        current.state.thread,
        current.state.media,
        current.capability,
      );
      const score = dispatchScore(result.answers, deterministic.structure);
      return {
        outcome: result.outcome,
        answers: result.answers,
        deterministic,
        score,
        questionVersion: "jev-post-analysis-v1" as const,
        normalizationVersion: "jev-normalization-v1" as const,
      };
    } catch {
      return unavailable;
    }
  },
});
