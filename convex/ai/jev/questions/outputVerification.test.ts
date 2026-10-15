import { expect, test } from "vitest";
import {
  criterionKeys,
  normalizeVerification,
  verificationDecision,
  resolveVerificationQuestions,
  verificationVersions,
} from "./outputVerification";
const answers = (extra: Record<string, number | undefined> = {}) =>
  Object.fromEntries(
    criterionKeys.map((key) => [
      key,
      {
        type: "noul" as const,
        probability:
          extra[key] ??
          (key === "newStrongClaim" || key === "unwantedPromotion" ? 0.1 : 0.9),
      },
    ]),
  );
const wire = () => ({
  model: "synthetic-verifier-1",
  usage: { input_tokens: 100, output_tokens: 10 },
  answers: Object.fromEntries(
    criterionKeys.map((key) => [
      key,
      {
        type: "noul",
        noul:
          key === "newStrongClaim" || key === "unwantedPromotion" ? 0.1 : 0.9,
      },
    ]),
  ),
});
test("exact immutable seven Noul rubrics have their own normalization and hypotheses", () => {
  const definition = resolveVerificationQuestions(
    verificationVersions.question,
    verificationVersions.normalization,
  );
  expect(Object.keys(definition.questions)).toEqual([...criterionKeys]);
  expect(
    Object.values(definition.questions).every((q) => q.type === "noul"),
  ).toBe(true);
  expect(() =>
    resolveVerificationQuestions(
      "jev-intent-routing-v1",
      verificationVersions.normalization,
    ),
  ).toThrow("VERIFICATION_CONFIGURATION_REQUIRED");
  expect(() =>
    resolveVerificationQuestions(
      verificationVersions.question,
      "jev-normalization-v1",
    ),
  ).toThrow("VERIFICATION_CONFIGURATION_REQUIRED");
});
test("Noul probabilities preserve original values and reject extra keys/confidence/model/usage/nonfinite/missing answers", () => {
  expect(normalizeVerification(wire(), "synthetic-verifier-1")).toEqual({
    outcome: "success",
    answers: answers(),
  });
  const bad: unknown[] = [];
  const extra = wire();
  Object.assign(extra.answers, { other: { type: "noul", noul: 1 } });
  bad.push(extra);
  const confidence = wire();
  Object.assign(confidence.answers.meaningPreserved!, { confidence: 0.9 });
  bad.push(confidence);
  const missing = wire();
  delete missing.answers.meaningPreserved;
  bad.push(missing);
  bad.push(
    { ...wire(), model: "other" },
    { ...wire(), usage: { input_tokens: 1.2, output_tokens: 0 } },
    {
      ...wire(),
      usage: { input_tokens: 1, output_tokens: Number.MAX_SAFE_INTEGER },
    },
  );
  for (const n of [NaN, Infinity, -0.01, 1.01]) {
    const v = wire();
    v.answers.meaningPreserved!.noul = n;
    bad.push(v);
  }
  for (const value of bad)
    expect(normalizeVerification(value, "synthetic-verifier-1")).toEqual({
      outcome: "invalid_response",
    });
});
test("material uncertainty takes precedence for all combinations of fit flags and boundaries remain exact", () => {
  for (let bits = 0; bits < 16; bits++)
    for (const material of [
      { newStrongClaim: 0.100001 },
      { meaningPreserved: 0.899999 },
      { intentPreserved: 0.899999 },
    ]) {
      const flags = {
        unwantedPromotion: bits & 1 ? 0.9 : 0.1,
        toneFits: bits & 2 ? 0.1 : 0.9,
        ctaFits: bits & 4 ? 0.1 : 0.9,
        networkFits: bits & 8 ? 0.1 : 0.9,
      };
      const result = verificationDecision(answers({ ...flags, ...material }), {
        tone: true,
        cta: true,
      });
      expect(result.decision).toBe("manual_review");
      expect(result.reasonKeys).toEqual(Object.keys(material));
    }
  expect(
    verificationDecision(answers(), { tone: true, cta: true }).decision,
  ).toBe("accept");
  expect(
    verificationDecision(answers({ networkFits: 0.89999 }), {
      tone: true,
      cta: true,
    }).decision,
  ).toBe("repairable");
});
test("absent tone/style and CTA are unspecified rather than inferred rejection", () => {
  const result = verificationDecision(answers({ toneFits: 0, ctaFits: 0 }), {
    tone: false,
    cta: false,
  });
  expect(result.decision).toBe("accept_with_warning");
  expect(result.reasonKeys).toEqual([]);
  expect(result.criteria.toneFits).toEqual({
    probability: 0,
    applicability: "unspecified",
  });
  expect(result.criteria.ctaFits).toEqual({
    probability: 0,
    applicability: "unspecified",
  });
  expect(() =>
    verificationDecision(
      { ...answers(), other: { type: "noul", probability: 0.9 } },
      { tone: true, cta: true },
    ),
  ).toThrow("VERIFICATION_RESULT_INVALID");
});
