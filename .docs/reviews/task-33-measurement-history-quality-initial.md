# TASK33.1 / unit 4B1 — independent QUALITY review

Verdict: **CHANGES REQUESTED — two Important correctness findings.** No Critical privacy/security issue identified. The passing submitted suite does not cover these two contradictions. Do not treat this review as QUALITY approval.

Reviewed baseline: `21584404c1df35c79af4016a65f78a00a76119e9`.
Frozen aggregate: `061a008fbcc83bfd9fb924793a759d620b735b4f78ac96dd8a03778ebea84033`.
All nine exact hashes matched at both start and end; final evidence `/tmp/task33-quality-final-hashes.json`. Repository source, Git, Backlog and deployment were read-only. Only `/tmp` review artifacts were written.

## Important findings

### 1. Reject future history-job generations in the historyJobs export

Location: `convex/operations/exportIntelligence.ts:1608–1617` (especially the preflight at 1614).

The historyJobs branch verifies its original policy/receipt and nonnegative counts, but never verifies the job's generation against the account's unique history control. The historyPosts branch already requires `row.generation <= job.generation <= control.generation` at lines 1170–1172. Consequently the same impossible original job is rejected while exporting posts but accepted while exporting jobs.

Independent native reproduction: create and complete the real three-page import (75 rows), assert the positive historyJobs generation is 1, patch only job.generation to 999 while the native control remains at 1. The historyPosts export correctly rejects with REFERENCE_ACCESS_DENIED; historyJobs resolves and downloads the contradictory job with generation 999. This violates the explicit future/impossible-generation whole-page rejection requirement and exposes invalid archive history as normal data.

Suggested minimum repair: validate the job's positive safe generation against its scoped unique current control before returning its DTO, while continuing to allow older receipt generations and ordinary old jobs below the current control generation. Add the independent case for the historyJobs family.

### 2. Expiry masks an invalid original prospective-candidate graph

Location: `convex/operations/exportIntelligence.ts:1423–1426` (the direct-loss return in knowledgePinLost; missing guard belongs in the preceding original graph preflight).

The new preflight checks policy/spec/purpose hashes but omits the original experiment's prospective-mode requirement. Native `models.qualified` enforces that requirement at `convex/performance/models.ts:953–960`. This check only executes through retainedPin when the saved pin has not expired. Setting proofUntil to the past therefore converts a real original-graph contradiction into an ordinary unavailable projection.

Independent native reproduction: use qualifiedCorpus and actual checkMonitoring/activate/assessment/scheduling/beforeSend producers; assert the exported saved candidate is retained. Patch only the original experiment.payload.mode from prospective to retrospective. With a live pin, export correctly rejects CALIBRATION_PROSPECTIVE_CANDIDATE_REQUIRED. Then expire only the saved projection proofUntil: export resolves with `projection:null, materialAvailability:"unavailable"`, hiding the original contradiction. No pin or declaration/candidate/evaluation fingerprint was recomputed or patched.

Suggested minimum repair: require the original prospective qualification predicates in the structural preflight before expiry/current-loss handling, keeping the native retainedPin body unchanged. Add the live-and-expired reproduction so direct loss cannot mask this class of original qualification failure.

## Independent runtime evidence

- `/tmp/task33-quality-repro.test.ts` contains both new QUALITY REPRO cases. It copies the existing independent harness into a separate tmp file, preserving native fixture producers; it does not import test modules. Only the two new cases run via the name filter.
- Config: `/tmp/task33-quality-vitest.config.mjs`.
- Command: `./node_modules/.bin/vitest run --config /tmp/task33-quality-vitest.config.mjs -t 'QUALITY REPRO'`.
- Output: `/tmp/task33-quality-repro.log`: **2 failed as expected**, both at export promises resolving instead of rejecting, after positive baselines and complementary rejection assertions succeeded; no setup/schema failure. Duration 2.38 s.
- Separately ran `./node_modules/.bin/vitest run convex/operations/exportMeasurements.test.ts`: **27/27 passed**, duration 5.69 s. Output `/tmp/task33-quality-native-suite.log`.

## Other reviewed properties

- Exact session/auth/request identity, active-workspace and Owner/Admin gate precede candidate selection; account required and irrelevant selectors rejected.
- Eight fixed families use immutable creation-bound native pagination with numItems=1 and native continueCursor/isDone. Existing whole-envelope UTF-8 64-KiB and finite/-0 guards remain; the proofContext preserves ctx metadata and checks all read documents.
- Explicit backend/UI field allowlists remove provider identity, fingerprints, credential details, provider cursors and scheduler IDs; snapshot measured zero/null and static saved null projection are preserved.
- History and metric original receipt checks align with the native finish owner exclusions, original scoped policy and ordered distinct budget-grant binding checks. Native rights helpers remain unchanged; unexpected failures propagate.
- Saved candidate uses retainedPin without recomputing publicationProjection; retention after rollback and native resource-limit propagation are exercised by the submitted suite.
- Schema diff is exactly the one publicationKnowledge workspace/account index. models.ts diff is exactly the exported retainedPin and canonical hash alias; helper bodies/callers unchanged.
- Fixture parity independently checked against the baseline: both relocated fixture functions match exactly except the authorized export/name change; all remaining source after fixture/import relocation matches exactly in collect.test.ts and snapshots.test.ts. Initial AST attempt was unavailable because installed TypeScript exposes only its native-compiler version module; exact text comparison succeeded.
- UI adds choices/allowlists and nested safe projection only. Existing mounted export scope/session/role/family/account epoch/nonce/unmount/expiry guards, one-page file download and native next/done behavior remain. Browser harness changes are native-shaped mocked DTO cases, role visibility checks and Chromium download pacing only.

## Limits

No full baseline/stress rerun, browser rerun, build/type rerun, hosted provider/deployment check or source fix performed. Browser evidence remains the earlier mocked full-app run, not native backend proof. Two reproducible fail-closed archive-integrity gaps remain; this freeze needs repair and fresh targeted review.
