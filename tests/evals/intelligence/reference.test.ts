import { expect, test } from "vitest";
import data from "./post-technical-reference-v1.json";
import { POST_ANALYSIS } from "../../../convex/ai/jev/questions/postAnalysis";
import { describeThread } from "../../../convex/ai/scoring/dispatchScore";
test("frozen proposed reference ranges are technical only and explicitly pending human acceptance", () => {
  expect(data).toMatchObject({
    reviewStatus: "human_review_pending",
    inferenceExecuted: false,
    calibrationStatus: "uncalibrated",
    origin: "AI_proposed_technical_reference",
    questionVersion: POST_ANALYSIS.version,
  });
  const tags = new Set(data.fixtures.flatMap((f) => f.tags));
  for (const tag of [
    "launch",
    "announcement",
    "opinion",
    "educational",
    "story",
    "promotion",
    "weak_hook",
    "strong_hook",
    "clickbait",
    "ambiguous",
    "technical",
    "conversational",
    "strong_claim",
    "absent_cta",
    "strong_cta",
  ])
    expect(tags.has(tag)).toBe(true);
  expect(new Set(data.fixtures.map((f) => f.id)).size).toBe(
    data.fixtures.length,
  );
  for (const f of data.fixtures) {
    expect(f.reviewStatus).toBe("human_review_pending");
    for (const label of f.proposedContentTypes)
      expect(
        Object.hasOwn(POST_ANALYSIS.questions.contentType.criteria, label),
      ).toBe(true);
    for (const range of Object.values(f.expectedRanges)) {
      expect(range).toHaveLength(2);
      expect(range[0]).toBeGreaterThanOrEqual(0);
      expect(range[1]).toBeLessThanOrEqual(1);
      expect(range[0]).toBeLessThanOrEqual(range[1]);
    }
    expect(
      describeThread(f.thread, [], { maxText: 280 }).segments,
    ).toHaveLength(f.thread.length);
  }
});
