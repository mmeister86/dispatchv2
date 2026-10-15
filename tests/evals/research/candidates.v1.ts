import type { Doc } from "../../../convex/_generated/dataModel";
// Controlled candidate responses, not reference truth or live model generations.
export const candidateVersion = "controlled-candidate/v1";
export function candidateItem(
  source: Doc<"researchSources">,
  materialHash: string,
) {
  return {
    title: "Municipal heat-pump pilot",
    sourceId: source._id,
    materialHash,
    annotation: {
      claim: source.text ?? "Delivered headline only",
      consequentialOrContested: false,
      eventBased: false,
      quote: source.text,
      interpretation: "Potential account context, needs human review",
      gaps: [] as string[],
      relevance: "Declared pilot fixture topic",
      novelty: "Unknown beyond supplied history",
      uncertainty: "Fixture statement, truth not evaluated",
      freshness: "time-sensitive" as const,
      validityReason: "Human review required",
    },
    perspective: "Explain municipal pilot context",
    dynamics: "Rising 50% today", // deliberately unsupported; actual assess must replace it
    clusterId: null,
    clusterRevision: null,
    historyIds: [] as string[],
    copySourceIds: [] as string[],
    eventAt: null as number | null,
    eventQuote: null as string | null,
  };
}
