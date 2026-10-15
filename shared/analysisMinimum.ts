// Processing start limit only; no empirical content-quality or reach claim.
export const MIN_ANALYSIS_CHARACTERS = 20;
export function hasAnalysisContent(thread: string[]) {
  return (
    [...thread.join("").replace(/\s/g, "")].length >= MIN_ANALYSIS_CHARACTERS
  );
}
