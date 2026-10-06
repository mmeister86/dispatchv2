import { expect, test } from "vitest";
import { normalize } from "./normalize";
const questions = {
  tone: {
    type: "choice",
    instructions: "Choose",
    criteria: { calm: "Calm", loud: "Loud" },
  },
  clarity: {
    type: "score",
    instructions: "Score",
    criteria: ["0", "1", "2", "3", "4"],
  },
  promotion: { type: "noul", instructions: "Promotion?" },
} as const;
const response = () => ({
  model: "jev-1.13.0",
  usage: { input_tokens: 10, output_tokens: 0 },
  answers: {
    tone: {
      type: "choice",
      choice: "calm",
      confidence: 0.8,
      probabilities: { calm: 0.9, loud: 0.1 },
    },
    clarity: {
      type: "score",
      score: 2.375,
      confidence: 0.8,
      legend: { 0: "0", 1: "1", 2: "2", 3: "3", 4: "4" },
      probabilities: { 0: 0, 1: 0, 2: 0.625, 3: 0.375, 4: 0 },
    },
    promotion: { type: "noul", noul: 0.99 },
  },
});
test("fractional ordered scores normalize without rounding; noul never invents confidence", () => {
  expect(normalize(response(), questions)).toMatchObject({
    outcome: "success",
    answers: {
      clarity: { value: 0.59375, confidence: 0.8 },
      promotion: { probability: 0.99 },
    },
  });
});
test("invalid or low-confidence answers never become a successful aggregate", () => {
  const r = response();
  r.answers.clarity.confidence = 0.1;
  expect(normalize(r, questions).outcome).toBe("low_confidence");
  for (const value of [NaN, Infinity, -1, 4.01]) {
    const bad = response();
    bad.answers.clarity.score = value;
    expect(normalize(bad, questions).outcome).toBe("invalid_response");
  }
  const extra = response();
  extra.answers.tone.probabilities = {
    calm: 0.9,
    loud: 0.1,
    alien: 0,
  } as typeof extra.answers.tone.probabilities;
  expect(normalize(extra, questions).outcome).toBe("invalid_response");
  const missing = response();
  delete (missing.answers as Record<string, unknown>).clarity;
  expect(normalize(missing, questions).outcome).toBe("invalid_response");
});
test("separate confidence, exact labels/rubric and response usage/model must be valid at runtime", () => {
  const mutations = [
    (r: ReturnType<typeof response>) => {
      delete (r.answers.tone as Record<string, unknown>).confidence;
    },
    (r: ReturnType<typeof response>) => {
      r.answers.tone.choice = "alien";
    },
    (r: ReturnType<typeof response>) => {
      r.answers.clarity.legend[4] = "changed";
    },
    (r: ReturnType<typeof response>) => {
      (r.answers.promotion as Record<string, unknown>).confidence = 0.99;
    },
    (r: ReturnType<typeof response>) => {
      r.usage.input_tokens = -1;
    },
    (r: ReturnType<typeof response>) => {
      r.model = "jev-latest";
    },
  ];
  for (const mutate of mutations) {
    const r = response();
    mutate(r);
    expect(normalize(r, questions).outcome).toBe("invalid_response");
  }
});
