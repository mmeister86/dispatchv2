// User-selected maximum; source withdrawal or an earlier deadline always wins.
export const OPERATIONAL_RETENTION_MS = 30 * 86400000;
export function operationalUntil(
  createdAt: number,
  sourceUntil?: number | null,
) {
  return Math.min(
    createdAt + OPERATIONAL_RETENTION_MS,
    sourceUntil ?? Infinity,
  );
}
