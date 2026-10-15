# Task 33.1 / unit 4B1 — bounded SPEC delta review

Verdict: **SPEC PASS for the two authorized delta guards.** All nine manifest file SHA-256 values matched `/tmp/task33-measurement-history-freeze.json` on review; the two changed-file hashes match the assigned values. No source or Git files were changed.

- `historyJobs` export now requires a unique workspace/account control and a positive safe job generation no greater than the control generation (`convex/operations/exportIntelligence.ts`, historyJobs case). Receipt validation independently allows older generations (`a.generation <= job.generation`) and requires the original active-page relation. This meets the intended positive control bound while retaining pause/resume receipt behavior.
- Saved-candidate validation checks original `evidenceQualified`, prospective mode, and non-null/nonzero transfer before expiry/source-loss classification, returning `CALIBRATION_PROSPECTIVE_CANDIDATE_REQUIRED`. Existing retained-pin validation remains in place for eligible candidates.
- Both independent `QUALITY REPRO` cases pass (2 passed, 23 skipped); the targeted measurement suite passes (29/29). This directly exercises the new job-generation and expired retrospective-candidate cases.

This is a bounded SPEC pass for the delta and preserves the prior approved fixed-scope SPEC. It is not a broader regression, browser, build, or deployment review.
