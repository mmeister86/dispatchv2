import { ConvexError } from "convex/values";
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
// TASK-28.2 supplies executable immutable definitions and new reviewed profile payloads.
// A TASK-27 context reference is not permission or an executable question version.
export function resolveQuestions(
  _profile: Doc<"algorithmProfiles">,
): Definition {
  throw new ConvexError("JEV_QUESTION_CONFIGURATION_REQUIRED");
}
