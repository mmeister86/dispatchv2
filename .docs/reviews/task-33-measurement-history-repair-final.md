# TASK33.1 / unit 4B1 — bounded quality repair

Baseline: `21584404c1df35c79af4016a65f78a00a76119e9`; repair round 2.

Implemented only in `convex/operations/exportIntelligence.ts` and `convex/operations/exportMeasurements.test.ts`:

- History jobs now require a positive safe generation no greater than the unique workspace/account history control generation. Older valid jobs remain allowed.
- Saved candidate structural preflight now preserves the native `CALIBRATION_PROSPECTIVE_CANDIDATE_REQUIRED` failure when the original evaluation is unqualified, experiment is not prospective, or candidate transfer is null/zero, including after proof expiry. Native model helpers and producer behavior are unchanged.
- Added two real-producer regression tests for future job generation and retrospective original experiment mode after saved-pin expiry.

Independent reproduction before edits: `./node_modules/.bin/vitest run --config /tmp/task33-quality-vitest.config.mjs -t 'QUALITY REPRO'` — 2 failed as expected.

Final checks:

- Same QUALITY REPRO command — 2 passed, 23 skipped.
- `./node_modules/.bin/vitest run convex/operations/exportMeasurements.test.ts` — 29 passed.
- `./node_modules/.bin/tsc -p convex/tsconfig.json --noEmit` — passed.
- `./node_modules/.bin/prettier --check convex/operations/exportIntelligence.ts convex/operations/exportMeasurements.test.ts` — passed.
- All nine manifest file hashes and aggregate revalidated.

Updated manifest: `/tmp/task33-measurement-history-freeze.json`. New aggregate SHA-256: `8c3535b715fbf22e91b552dea9c1d332e69c6c2a05db8083b8558164165d904a`.

Owned-file SHA-256 values:

- `convex/operations/exportIntelligence.ts`: `1238a8e6e689626cb6382a4bf700030c014bf963119144bd61c0a7517a6c9518`
- `convex/operations/exportMeasurements.test.ts`: `8a33fb557b8de250814bbefda8b19958a451a570da1fdf2c89a9e69aa921e6bf`

Limits: no full repository/typecheck build, browser run, broad regression suite, deployment, Git operation, or changes outside the two owned files. UI and helpers were unchanged.
