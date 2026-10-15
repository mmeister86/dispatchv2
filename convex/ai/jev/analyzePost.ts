import { v, type Infer } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { requestFields } from "./types";
import { describeThread, dispatchScore } from "../scoring/dispatchScore";
import { resultContract } from "./resultFields";
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
