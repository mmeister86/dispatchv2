import twitterText from "twitter-text";
import { textCount, textWithinLimit } from "../../../shared/xText";
import { POST_ANALYSIS } from "../jev/questions/postAnalysis";
import { MIN_CONFIDENCE } from "../jev/thresholds";
export const FORMULA_VERSION = "dispatch-score-v1";
export const STRUCTURE_VERSION = "structure-v1";
export const THRESHOLD_VERSION = "jev-confidence-startup-v1";
export const WEIGHTS = {
  hookStrength: 0.2,
  clarity: 0.2,
  discussionPotential: 0.2,
  originality: 0.15,
  naturalCta: 0.05,
  structure: 0.1,
  history: 0.1,
} as const;
export function describeThread(
  thread: { position: number; text: string }[],
  media: { type: "image" | "video"; alt: string }[],
  capability: { maxText: number },
) {
  if (
    !thread.length ||
    thread.some((s, i) => s.position !== i || typeof s.text !== "string") ||
    !Number.isSafeInteger(capability.maxText) ||
    capability.maxText < 1
  )
    throw new Error("JEV_INPUT_INVALID");
  const segments = thread.map(({ position, text }) => {
    const hashtags = twitterText.extractHashtags(text).length,
      mentions = twitterText.extractMentions(text).length;
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase())
      .filter(Boolean);
    const repeatedParagraphs = new Set(paragraphs).size !== paragraphs.length;
    const lengthValid = textWithinLimit(text, "X", capability.maxText);
    const checks = [
      lengthValid,
      hashtags <= 3,
      mentions <= 3,
      !repeatedParagraphs,
    ];
    return {
      position,
      text,
      length: textCount(text).length,
      lengthValid,
      hashtags,
      mentions,
      links: twitterText.extractUrlsWithIndices(text, {
        extractUrlsWithoutProtocol: false,
      }).length,
      lines: text.split(/\r?\n/).length,
      questionMarks: (text.match(/[?？]/g) ?? []).length,
      // Descriptive lexical signs only; the model's natural CTA is a separate semantic property.
      explicitCtaSigns: (
        text.match(
          /\b(reply|comment|share|subscribe|follow|download|try|join|buy|antwortet|kommentiert|teilt|abonniert|folgt|kauft)\b/gi,
        ) ?? []
      ).length,
      repeatedParagraphs,
      structure: checks.filter(Boolean).length / 4,
    };
  });
  return {
    version: STRUCTURE_VERSION as typeof STRUCTURE_VERSION,
    segments,
    media: {
      present: media.length > 0,
      count: media.length,
      images: media.filter((m) => m.type === "image").length,
      videos: media.filter((m) => m.type === "video").length,
      withAlt: media.filter((m) => m.alt.trim()).length,
    },
    structure:
      segments.reduce((sum, s) => sum + s.structure, 0) / segments.length,
  };
}
const unit = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
export function dispatchScore(answers: unknown, structure: unknown) {
  const history = { value: 0.5, basis: "assumed_cold_start_baseline" as const };
  const missing: string[] = [],
    lowConfidence: string[] = [];
  const values: Record<string, number> = {};
  const source =
    answers && typeof answers === "object"
      ? (answers as Record<string, unknown>)
      : {};
  if (
    Object.keys(source).some((k) => !Object.hasOwn(POST_ANALYSIS.questions, k))
  )
    missing.push("unexpected_answers");
  for (const [key, q] of Object.entries(POST_ANALYSIS.questions)) {
    const a = source[key] as Record<string, unknown> | undefined;
    if (
      !a ||
      typeof a !== "object" ||
      Object.keys(a).sort().join(",") !==
        (q.type === "noul" ? "probability,type" : "confidence,type,value") ||
      a.type !== q.type ||
      (q.type === "noul"
        ? !unit(a.probability) || Object.hasOwn(a, "confidence")
        : !unit(a.confidence) ||
          (q.type === "score"
            ? !unit(a.value)
            : typeof a.value !== "string" ||
              !Object.hasOwn(
                POST_ANALYSIS.questions.contentType.criteria,
                a.value,
              )))
    ) {
      missing.push(key);
      continue;
    }
    if (q.type !== "noul" && (a.confidence as number) < MIN_CONFIDENCE)
      lowConfidence.push(key);
    if (q.type === "score") values[key] = a.value as number;
  }
  if (!unit(structure)) missing.push("structure");
  const components: Record<string, number> = {
    ...values,
    structure: structure as number,
    history: history.value,
  };
  const aggregate =
    missing.length || lowConfidence.length
      ? null
      : Object.entries(WEIGHTS).reduce(
          (sum, [key, weight]) => sum + components[key] * weight,
          0,
        ) * 100;
  return {
    formulaVersion: FORMULA_VERSION as typeof FORMULA_VERSION,
    thresholdVersion: THRESHOLD_VERSION as typeof THRESHOLD_VERSION,
    thresholdBasis: "uncalibrated_startup_assumption" as const,
    minimumConfidence: MIN_CONFIDENCE,
    weights: WEIGHTS,
    aggregate,
    missing,
    lowConfidence,
    history,
    audienceFit: "unavailable" as const,
  };
}
