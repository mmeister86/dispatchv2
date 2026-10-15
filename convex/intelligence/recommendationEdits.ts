import { ConvexError, v } from "convex/values";
import twitterText from "twitter-text";
import type { Doc } from "../_generated/dataModel";
import { sha256 } from "../lib/crypto";
import type { current } from "../ai/jev/access";
export const RULE_VERSION = "editorial-edits-v1" as const;
export const candidate = v.union(
  v.object({
    kind: v.literal("duplicate"),
    segment: v.number(),
    start: v.number(),
    end: v.number(),
  }),
  v.object({
    kind: v.literal("tokens"),
    segment: v.number(),
    tokens: v.array(
      v.object({
        start: v.number(),
        end: v.number(),
        text: v.string(),
        kind: v.union(v.literal("hashtag"), v.literal("mention")),
      }),
    ),
  }),
  v.object({ kind: v.literal("alt"), mediaIndex: v.number() }),
);
export const recommendations = v.object({
  assessmentId: v.id("jevAssessments"),
  revision: v.number(),
  proof: v.string(),
  ruleVersion: v.literal(RULE_VERSION),
  candidates: v.array(candidate),
});
type Content = Doc<"draftVersions">["content"];
export type Candidate = import("convex/values").Infer<typeof candidate>;
export function edits(content: Content, imageIndices: number[]): Candidate[] {
  const missing = content.media.flatMap((m, i) => (!m.alt.trim() ? [i] : []));
  // Existing save requires every alt: recover only one missing image; otherwise repair manually first.
  if (missing.length)
    return missing.length === 1 && imageIndices.includes(missing[0])
      ? [{ kind: "alt", mediaIndex: missing[0] }]
      : [];
  const out: Candidate[] = [];
  for (const [segment, text] of content.text.entries()) {
    let previous = "",
      start = 0,
      separatorStart = 0;
    for (const match of [
      ...text.matchAll(/\r?\n[\t ]*\r?\n/g),
      { index: text.length, 0: "" },
    ]) {
      const paragraph = text.slice(start, match.index);
      if (paragraph.trim() && paragraph === previous) {
        out.push({
          kind: "duplicate",
          segment,
          start: separatorStart,
          end: match.index!,
        });
        break;
      }
      previous = paragraph;
      separatorStart = match.index!;
      start = match.index! + match[0].length;
    }
  }
  for (const [segment, text] of content.text.entries()) {
    const start = text.lastIndexOf("\n") + 1;
    if (
      start === 0 ||
      !text.slice(0, start).trim() ||
      !/\r?\n[\t ]*\r?\n$/.test(text.slice(0, start)) ||
      /[`"“”«»]/.test(text) ||
      /^[\t ]*~{3,}/m.test(text) ||
      /^[\t ]*(?:>|[-*+] |\d+[.)] )/m.test(text) ||
      /:\s*$/.test(text.slice(0, start))
    )
      continue;
    const tokens = [
      ...twitterText.extractHashtagsWithIndices(text).map((t) => ({
        start: t.indices[0],
        end: t.indices[1],
        text: text.slice(...t.indices),
        kind: "hashtag" as const,
      })),
      ...twitterText.extractMentionsWithIndices(text).map((t) => ({
        start: t.indices[0],
        end: t.indices[1],
        text: text.slice(...t.indices),
        kind: "mention" as const,
      })),
    ]
      .filter((t) => t.start >= start)
      .sort((a, b) => a.start - b.start);
    // ponytail: only one standalone final line and at most 20 tokens; larger blocks require manual editing.
    if (
      tokens.length > 20 ||
      !tokens.length ||
      !["hashtag", "mention"].some(
        (k) => tokens.filter((t) => t.kind === k).length > 3,
      )
    )
      continue;
    let cursor = start,
      safe = true;
    for (const t of tokens) {
      if (!/^[\t \r]*$/.test(text.slice(cursor, t.start))) safe = false;
      cursor = t.end;
    }
    if (safe && /^[\t \r]*$/.test(text.slice(cursor)))
      out.push({ kind: "tokens", segment, tokens });
  }
  return out.slice(0, 3);
}
export const choiceFields = {
  candidateIndex: v.number(),
  tokenIndices: v.array(v.number()),
  alt: v.string(),
};
export function apply(
  content: Content,
  item: Candidate,
  choice: { tokenIndices: number[]; alt: string },
): Content {
  const result: Content = {
    ...content,
    text: [...content.text],
    media: content.media.map((m) => ({ ...m })),
  };
  if (item.kind === "alt") {
    if (
      choice.tokenIndices.length ||
      !choice.alt.trim() ||
      choice.alt.length > 1000
    )
      throw new ConvexError("RECOMMENDATION_INPUT_INVALID");
    result.media[item.mediaIndex].alt = choice.alt;
  } else {
    if (choice.alt) throw new ConvexError("RECOMMENDATION_INPUT_INVALID");
    let ranges: { start: number; end: number }[] = [
      item as Extract<Candidate, { kind: "duplicate" }>,
    ];
    if (item.kind === "tokens") {
      if (
        !choice.tokenIndices.length ||
        choice.tokenIndices.length > item.tokens.length ||
        new Set(choice.tokenIndices).size !== choice.tokenIndices.length ||
        choice.tokenIndices.some(
          (i) => !Number.isSafeInteger(i) || i < 0 || i >= item.tokens.length,
        )
      )
        throw new ConvexError("RECOMMENDATION_INPUT_INVALID");
      ranges = choice.tokenIndices.map((i) => item.tokens[i]);
    } else if (choice.tokenIndices.length)
      throw new ConvexError("RECOMMENDATION_INPUT_INVALID");
    for (const r of ranges.sort((a, b) => b.start - a.start))
      result.text[item.segment] =
        result.text[item.segment].slice(0, r.start) +
        result.text[item.segment].slice(r.end);
  }
  return result;
}
export async function recommendationProof(
  x: Awaited<ReturnType<typeof current>>,
  ver: Doc<"draftVersions">,
  revision: number,
  selectedRevision: number,
) {
  return sha256(
    JSON.stringify({
      rule: RULE_VERSION,
      // Fence-guard fixes must invalidate old reviewed candidate indices; accepted receipts remain permanent.
      contextGuard: "code-fence-v2",
      semanticKey: x.semanticKey,
      policy: await sha256(JSON.stringify(x.p)),
      content: ver.content,
      media: ver.mediaChecksums ?? [],
      sourceUntil: x.sourceUntil,
      revision,
      selectedRevision,
    }),
  );
}

export const receiptFields = {
  workspaceId: v.id("workspaces"),
  actorId: v.id("users"),
  accountId: v.id("socialAccounts"),
  operationKey: v.string(),
  intent: v.string(),
  baseVersionId: v.id("draftVersions"),
  versionId: v.id("draftVersions"),
  revision: v.number(),
};
