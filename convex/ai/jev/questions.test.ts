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
test("only new immutable payload and paired executable references resolve", () => {
  const profile = {
    network: "x",
    surface: "for_you",
    payload: {
      version: "x-post-analysis-v1",
      refs: {
        questionSet: "jev-post-analysis-v1",
        normalization: "jev-normalization-v1",
        formula: "dispatch-score-v1",
        routing: "disabled-v1",
        verification: "disabled-v1",
      },
    },
  } as Doc<"algorithmProfiles">;
  const d = resolveQuestions(profile);
  expect(d.version).toBe("jev-post-analysis-v1");
  expect(Object.keys(d.questions)).toHaveLength(9);
  expect(d.questions.contentType.type).toBe("choice");
  for (const change of [
    { network: "other" },
    { payload: { ...profile.payload, version: "x-public-context-v1" } },
    {
      payload: {
        ...profile.payload,
        refs: {
          ...profile.payload.refs,
          normalization: "unavailable-until-task28",
        },
      },
    },
  ])
    expect(() =>
      resolveQuestions({ ...profile, ...change } as Doc<"algorithmProfiles">),
    ).toThrow("JEV_QUESTION_CONFIGURATION_REQUIRED");
});
