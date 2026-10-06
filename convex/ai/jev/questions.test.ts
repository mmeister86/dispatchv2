import { expect, test } from "vitest";
import { resolveQuestions } from "./questions";
import type { Doc } from "../../_generated/dataModel";
test("production resolver never reinterprets TASK-27 unavailable profile references as executable questions", () => {
  expect(() =>
    resolveQuestions({
      payload: { refs: { questionSet: "unavailable-until-task28" } },
    } as Doc<"algorithmProfiles">),
  ).toThrow("JEV_QUESTION_CONFIGURATION_REQUIRED");
});
