import { useEffect, useState } from "react";
type Proof = { authorized: boolean; proofExpiresAt: number };
export function githubSourceAuthorized(source: Proof, now: number) {
  return (
    source.authorized &&
    Number.isFinite(source.proofExpiresAt) &&
    source.proofExpiresAt > now
  );
}
const EMPTY: readonly Proof[] = [];
// Convex caches queries: elapsed time alone does not invalidate their authorization projection.
export function useGithubSourceProofClock(sources: readonly Proof[] = EMPTY) {
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const now = Date.now(),
      deadline = Math.min(
        ...sources
          .filter((s) => githubSourceAuthorized(s, now))
          .map((s) => s.proofExpiresAt),
      );
    const refresh = () => setClock(Date.now());
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = Number.isFinite(deadline)
      ? setTimeout(
          refresh,
          Math.min(Math.max(1, deadline - now + 1), 2147483647),
        )
      : undefined;
    document.addEventListener("visibilitychange", visible);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [sources, clock]);
  return Date.now();
}
