# Task 33.1 / unit 4B1 — independent SPEC review

Verdict: ❌ NOT SPEC COMPLIANT. Two actionable P1 defects reproduced against the frozen implementation. Quality review must wait for repair and a new spec pass.

Baseline: `21584404c1df35c79af4016a65f78a00a76119e9`.
All nine SHA-256 values in `/tmp/task33-measurement-history-freeze.json` matched both at review start and after reproductions. Source, Git, Backlog and deployment were not mutated. Reproduction files/logs are in `/tmp`.

## P1 — Validate the original metric receipt's grants before exporting measured material

Location: `convex/operations/exportIntelligence.ts:1195–1217` (`snapshotReferences`, specifically the receipt binding at 1198–1207).

The exporter validates the original receipt owner, snapshot, generation and policy fingerprint, but never validates its `budgetIds`. `measurementRightsLost` and `retainedSnapshotHorizon` consult the current grants by account keys instead; they cannot establish that the original receipt references the correct three distinct grants. This violates the requested exact original receipt/grants binding and whole-page rejection of duplicate/mixed corruption.

Independent reproduction: start from the actual `publishingFixture(true)` → first send → confirmation → native `performance.collect.read` observed snapshot. Replace only its real receipt's `budgetIds` with `[originalProviderGrant, originalProviderGrant, originalProviderGrant]`. Export `performanceSnapshots`. The query succeeds with `materialAvailability: "retained"`, measured impressions `0`, likes `3`, and reposts `1`. Expected: whole query rejects. This is not a handmade successful graph: only the corruption is patched after native production.

Native evidence: `convex/performance/snapshots.ts:259–282` rejects wrong cardinality, duplicates, wrong ordered grant key/scope/currency and foreign workspace/account binding. These original grant checks are absent from the export preflight.

Minimum repair: in the archive-only original receipt preflight, validate exactly three distinct receipt grant IDs and each referenced grant's original provider/workspace/account position, key, scope, currency and workspace/account binding, before any unavailable/expiry branch. Preserve the native helper and its callers. Add a regression for duplicate and foreign original grants using the native measured fixture. Current grants still require the existing retained helper.

## P1 — Do not mask a corrupt original experiment fingerprint with an expired candidate pin

Location: `convex/operations/exportIntelligence.ts:1294–1320` (`knowledgePinLost` structural validation), reached from `1628–1629`.

The pre-expiry validation loads the original experiment but checks only its kind, identity, purpose and generation. It never checks `experiment.payload.policyFingerprint` against the saved experiment policy. If the saved publication projection has expired, `knowledgePinLost` returns true and bypasses `retainedPin`, converting that corrupt original graph into a successful unavailable header. The specification explicitly requires validating original structure/fingerprints before direct expiry masking.

Independent reproduction: genuine `qualifiedCorpus` → mature monitoring snapshot → native passing check → native activation → actual target assessment/schedule → `publishing.attempts.beforeSend` yielding a candidate projection. Change only the original experiment's `payload.policyFingerprint` to `"WRONG"`. While the saved pin is live, export correctly rejects with `CALIBRATION_POLICY_CHANGED`. Change only the saved projection `proofUntil` to `Date.now() - 1`. Export now succeeds with that publication's `projection: null` and `materialAvailability: "unavailable"`, despite the unchanged malformed experiment fingerprint.

Native evidence: `convex/performance/models.ts:164–184` checks the original experiment policy fingerprint. The archive preflight lacks this binding.

Minimum repair: include the original experiment policy fingerprint binding in the archive-only structural checks before evaluating direct source loss; review the other original experiment links already required by the native retained proof for the same omission pattern. Preserve the helper-only export changes in `models.ts`; do not alter its proof behavior. Add this exact live-corruption/expired-corruption regression.

## Independent checks and limits

- Ran `npx vitest run convex/operations/exportMeasurements.test.ts`: all 18 submitted cases pass (4.41 s); log `/tmp/task33-spec-tests.log`.
- Ran two isolated additional native-fixture reproductions; both expected-rejection assertions fail because export resolves. Command: `./node_modules/.bin/vitest run --config /tmp/task33-spec-vitest.config.mjs -t 'SPEC REPRO'`. Reproduction source: `/tmp/task33-spec-repro.test.ts`; complete output: `/tmp/task33-spec-repro.log` (2.33 s).
- Read the actual export/schema/UI/browser diffs, current original producers and retained helpers. Eight fixed account-scoped families, native numItems=1 creation-bound pagination, complete wire numeric/64-KiB checks, exact source field allowlists, saved static score/pin null handling, and the two allowed models helper exports are present.
- Verified fixture relocation with exact source equality, stronger than AST-only comparison: baseline `collect.test.ts` fixture body equals exported `historyFixture`; baseline `snapshots.test.ts` fixture body equals exported `publishingFixture`. Removing only imports and the relocated functions leaves both test-suite sources byte-identical, preserving assertion bodies/order/constants/error assertions. No test suites are imported as fixtures.
- Read the RED log showing unsupported-family validator failures after genuine producer setup. Browser additions use actual native-shaped fields and downloaded JSON equality, but remain mocked full-app tests; they do not establish native backend proof correctness.
- Did not rerun the full baseline, 157-test regression, mounted browser, type/build or deployment; no hosted-runtime claim. The two demonstrated fail-open paths block spec approval regardless of those broader checks.
