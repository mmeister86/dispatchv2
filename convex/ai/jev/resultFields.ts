import { v } from "convex/values";
import { answer, outcome } from "./types";
export const segmentFields = {
  position: v.number(),
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
};
const nullableNumber = v.union(v.number(), v.null());
export const resultContract = v.object({
  outcome: v.union(outcome, v.literal("unavailable")),
  answers: v.union(v.record(v.string(), answer), v.null()),
  deterministic: v.union(
    v.object({
      version: v.literal("structure-v1"),
      segments: v.array(
        v.object({
          ...segmentFields,
          text: v.string(),
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
