import { ConvexError } from "convex/values";
import { POST_ANALYSIS } from "./questions/postAnalysis";
import type { Doc } from "../../_generated/dataModel";
export type Definition = {
  version: string;
  questions: Record<
    string,
    | { type: "choice"; instructions: string; criteria: Record<string, string> }
    | {
        type: "score";
        instructions: string;
        criteria: [string, string, ...string[]];
      }
    | {
        type: "noul";
        instructions: string;
        criteria?: { true?: string; false?: string };
      }
  >;
};
export function resolveQuestions(
  profile: Doc<"algorithmProfiles">,
): Definition {
  const r = profile.payload.refs;
  if (
    profile.network !== "x" ||
    profile.surface !== "for_you" ||
    profile.payload.version !== "x-post-analysis-v1" ||
    r.questionSet !== POST_ANALYSIS.version ||
    r.normalization !== "jev-normalization-v1" ||
    r.formula !== "dispatch-score-v1" ||
    r.routing !== "disabled-v1" ||
    r.verification !== "disabled-v1"
  )
    throw new ConvexError("JEV_QUESTION_CONFIGURATION_REQUIRED");
  return POST_ANALYSIS;
}
