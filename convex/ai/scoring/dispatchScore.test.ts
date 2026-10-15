import { expect, test } from "vitest";
import { dispatchScore, describeThread } from "./dispatchScore";
import { POST_ANALYSIS } from "../jev/questions/postAnalysis";
import type { Answer } from "../jev/types";
import { normalize } from "../jev/normalize";
const answers = (): Record<string, Answer> =>
  Object.fromEntries(
    Object.entries(POST_ANALYSIS.questions).map(([key, q]) => [
      key,
      q.type === "score"
        ? { type: "score", value: 0.5, confidence: 0.7 }
        : q.type === "choice"
          ? { type: "choice", value: "other", confidence: 0.7 }
          : { type: "noul", probability: 0.5 },
    ]),
  );
test("fixed formula reproduces exact boundaries, assumed history and missing confidence", () => {
  const input = answers();
  const score = dispatchScore(input, 0.5);
  expect(score.aggregate).toBeCloseTo(50, 12);
  expect(dispatchScore(input, 0.5)).toEqual(score);
  expect(score.history).toEqual({
    value: 0.5,
    basis: "assumed_cold_start_baseline",
  });
  for (const value of [0, 1, 0.123456789]) {
    for (const a of Object.values(input))
      if (a.type === "score") a.value = value;
    expect(dispatchScore(input, value).aggregate).toBeCloseTo(
      (value * 0.9 + 0.05) * 100,
      12,
    );
  }
  for (const key of Object.keys(input)) {
    const broken = answers();
    delete broken[key];
    expect(dispatchScore(broken, 0.5).aggregate).toBeNull();
  }
  const low = answers();
  if (low.hookStrength.type !== "score") throw new Error();
  low.hookStrength.confidence = 0.69999;
  expect(dispatchScore(low, 0.5).aggregate).toBeNull();
  expect(
    dispatchScore(
      { ...answers(), hookStrength: { type: "noul", probability: 1 } },
      0.5,
    ).aggregate,
  ).toBeNull();
  for (const value of [NaN, Infinity, -0.1, 1.1])
    expect(dispatchScore(answers(), value).aggregate).toBeNull();
});
test("all segments use actual text capability and preserve descriptive counts", () => {
  const signals = describeThread(
    [
      { position: 0, text: "Hello #one @alice\n\nHello #one @alice" },
      { position: 1, text: "Reply? https://example.org" },
    ],
    [],
    { maxText: 20 },
  );
  expect(signals.segments[0]).toMatchObject({
    hashtags: 2,
    mentions: 2,
    repeatedParagraphs: true,
    lengthValid: false,
  });
  expect(signals.segments[1]).toMatchObject({
    links: 1,
    questionMarks: 1,
    explicitCtaSigns: 1,
  });
  expect(signals.structure).toBe(0.625);
  expect(signals.segments[0].text).toBe(
    "Hello #one @alice\n\nHello #one @alice",
  );
});
test("real immutable rubric normalizes fractional SDK index without rounding or fake noul confidence", () => {
  const raw = Object.fromEntries(
    Object.entries(POST_ANALYSIS.questions).map(([k, q]) => [
      k,
      q.type === "score"
        ? {
            type: "score",
            score: 1.23456789,
            confidence: 0.7,
            probabilities: { 0: 0.2, 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.2 },
            legend: Object.fromEntries(
              q.criteria.map((s, i) => [String(i), s]),
            ),
          }
        : q.type === "choice"
          ? {
              type: "choice",
              choice: "other",
              confidence: 0.7,
              probabilities: Object.fromEntries(
                Object.keys(q.criteria).map((k) => [k, 0.125]),
              ),
            }
          : { type: "noul", noul: 0.8 },
    ]),
  );
  const result = normalize(
    {
      model: "jev-1.13.0",
      usage: { input_tokens: 1, output_tokens: 0 },
      answers: raw,
    },
    POST_ANALYSIS.questions,
  );
  expect(result.outcome).toBe("success");
  if (result.outcome === "invalid_response") throw new Error();
  expect(result.answers.hookStrength).toEqual({
    type: "score",
    value: 1.23456789 / 4,
    confidence: 0.7,
  });
  expect(result.answers.clickbait).toEqual({ type: "noul", probability: 0.8 });
});

test("aggregate boundary refuses forged confidence, unrecognized answers and invalid labels", () => {
  for (const replacement of [
    {
      key: "hookStrength",
      answer: { type: "score", value: 0.5, confidence: NaN },
    },
    {
      key: "hookStrength",
      answer: { type: "score", value: 1.01, confidence: 1 },
    },
    {
      key: "contentType",
      answer: { type: "choice", value: "launch", confidence: 1 },
    },
    {
      key: "clickbait",
      answer: { type: "noul", probability: 0.5, confidence: 1 },
    },
    { key: "clickbait", answer: { type: "noul", probability: Infinity } },
    { key: "extra", answer: { type: "noul", probability: 0.5 } },
  ])
    expect(
      dispatchScore(
        { ...answers(), [replacement.key]: replacement.answer },
        0.5,
      ).aggregate,
    ).toBeNull();
  expect(dispatchScore(null, 0.5).missing).toHaveLength(9);
});
test("structure checks threshold counts, capability bounds, malformed text and normalized duplicates", () => {
  const texts = [
    "#a #b #c @one @two @three",
    "#a #b #c #d @one @two @three @four",
    "First   paragraph.\n\nFIRST paragraph.",
    "a".repeat(281),
  ];
  const result = describeThread(
    texts.map((text, position) => ({ text, position })),
    [
      { type: "image", alt: "Declared image description" },
      { type: "video", alt: "" },
    ],
    { maxText: 280 },
  );
  expect(result.segments.map((s) => s.structure)).toEqual([1, 0.5, 0.75, 0.75]);
  expect(result.structure).toBe(0.75);
  expect(result.media).toEqual({
    present: true,
    count: 2,
    images: 1,
    videos: 1,
    withAlt: 1,
  });
  expect(
    describeThread([{ position: 0, text: "hello" }], [], { maxText: 4 })
      .segments[0].lengthValid,
  ).toBe(false);
  expect(() =>
    describeThread([{ position: 1, text: "bad order" }], [], { maxText: 280 }),
  ).toThrow("JEV_INPUT_INVALID");
  expect(() => describeThread([], [], { maxText: 280 })).toThrow(
    "JEV_INPUT_INVALID",
  );
  expect(
    describeThread([{ position: 0, text: "\uD800" }], [], { maxText: 280 })
      .segments[0].lengthValid,
  ).toBe(false);
});
test("each approved component has its independent fixed weight and score is never rounded", () => {
  const base = answers();
  for (const a of Object.values(base)) if (a.type === "score") a.value = 0;
  for (const [key, weight] of Object.entries({
    hookStrength: 0.2,
    clarity: 0.2,
    discussionPotential: 0.2,
    originality: 0.15,
    naturalCta: 0.05,
  })) {
    const changed = {
      ...base,
      [key]: { type: "score", value: 1, confidence: 1 },
    };
    expect(dispatchScore(changed, 0).aggregate).toBeCloseTo(
      (weight + 0.05) * 100,
      12,
    );
  }
  expect(dispatchScore(base, 1).aggregate).toBeCloseTo(15, 12);
  const fractional = dispatchScore(
    {
      ...base,
      hookStrength: { type: "score", value: 0.123456789, confidence: 0.7 },
    },
    0,
  );
  expect(fractional.aggregate).toBeCloseTo(
    (0.123456789 * 0.2 + 0.05) * 100,
    12,
  );
  expect(fractional.aggregate).not.toBe(Math.round(fractional.aggregate!));
  expect(fractional.weights).toEqual({
    hookStrength: 0.2,
    clarity: 0.2,
    discussionPotential: 0.2,
    originality: 0.15,
    naturalCta: 0.05,
    structure: 0.1,
    history: 0.1,
  });
});
