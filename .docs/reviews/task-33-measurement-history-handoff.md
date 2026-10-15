# TASK33.1 unit 4B1 handoff — frozen for fresh SPEC, then distinct QUALITY

Baseline supplied by coordinator: `21584404c1df35c79af4016a65f78a00a76119e9`.
Exact nine-file SHA manifest: `/tmp/task33-measurement-history-freeze.json`.
Aggregate manifest SHA256: `061a008fbcc83bfd9fb924793a759d620b735b4f78ac96dd8a03778ebea84033`.
Implementation status: SPEC repair round2 complete; frozen for SPEC re-review (QUALITY has not started); no source changes after this freeze. Coordinator owns Backlog, docs, Git and commit. No task was marked Done.

## Scope and implementation

Eight fixed shared families added to existing exportIntelligence page: historyPosts, historyJobs, historyPolicies, historyControls, performanceSnapshots, performancePolicies, performanceControls, publicationKnowledge. Reuses current exact verified session/auth/request identity, active workspace and Owner/Admin gate, required selected account, irrelevant selector rejection, original native creation bound, single-candidate native cursor pagination, whole-envelope UTF8 64KiB/numeric guards and native proofContext (including meta).

All new DTOs explicitly allowlist saved fields before wire. Imported source text uses retainedHorizon; observed numeric fields use retainedSnapshotHorizon independently of Draft text grants; candidate projections use retainedPin. All retained minima pass existing explicit finite future horizon guard. No broad native failure catch, capacity conversion, graph reset, source regrant, or new endpoint. Positive directly observed expiry/withdrawal/deletion/original actor loss returns saved header/state and null material. Structural/fingerprint/unique-row contradictions fail whole page first. Original nulls, measured zero, optional age/late absence and saved static score:null/pin:null remain exact.

History native generation nuance confirmed and approved by coordinator: manage pause/resume/cancel advances job/control generation in place. Old history row with `row.generation < job.generation <= currentControl.generation` is a directly corroborated unavailable generation, after original scope/job/policy/fingerprint references. Future/impossible generations fail. Job metadata can retain an older receipt generation, provided exact job/policy binding and positive receipt generation<=job generation. Native proof helper itself remains unchanged.

Schema changes ONLY add publicationKnowledge.by_workspaceId_and_accountId. Models changes ONLY export existing retainedPin function and named alias `retainedPinHash` of unchanged canonical hash (separately approved). Original helper bodies, defaults/callers and error semantics stay intact.

Settings existing mounted NativeArchiveExport adds eight choices and native-shaped allowlists, recursively projecting numeric field objects and candidate projection/pin. Existing one-page-per-click UI and stale response/family/account/session/role/nonce/unmount/expiry guards remain intact. No aggregate download engine.

Fixture sharing: collect.test.ts fixture body moved to tests/performance-export-fixture.ts as historyFixture (export/name only); snapshots.test.ts publishingFixture body moved to same pure fixture file. Old test bodies/assertions were not changed; imports removed only when dependencies moved. No test-module imports or side-effect registration. Coordinator should verify exact baseline AST/body parity with its Git access.

## Verification (all final gates passed)

- Meaningful initial RED: `/tmp/task33-measurements-red.log`: real native history/first-send/measurement producers rejected unsupported family validator before implementation.
- Native new suite: 18 cases in exportMeasurements.test.ts.
- Final native regression: `/tmp/task33-measurements-regression.log`: 6 files, **157 tests passed**, no unhandled errors. Includes new18 + prior exportIntelligence43 + exportShared/exportPrivate + collect/snapshots existing tests.
- Backend TypeScript: `/tmp/task33-measurements-type.log` (empty; exit0).
- Frontend TypeScript: `/tmp/task33-measurements-frontend-type.log` (empty; exit0).
- Production build: `/tmp/task33-measurements-build.log` exit0; existing chunk-size and ineffective dynamic import warnings.
- Formatting for all nine owned files: `/tmp/task33-measurements-format-check.log` pass.
- Actual mounted App/Store/CSS browser with mocked transport: `/tmp/task33-measurements-browser/intelligence-archive.json`, `/tmp/task33-measurements-browser.log` exit0. Every new family downloaded and compared exactly with representative native-shaped DTO, with forbidden extras stripped. Covers raw field shape, measured0/missingnull, optional absence, five windows, disabled/expired config, original static-null and candidate pin; prior actual routing/verification/normalized assessment downloads and denial/correlation/ABA/unmount/source expiry cases also pass. Mocked transport explicitly labeled in evidence. Added pacing in harness to avoid Chromium's >10 rapid download throttling; no production timing change.

Native new cases include 75 records from actual three-provider-page backfill; exact old published Draft/then knowledge after newer Draft text and imported latest text; actual first-send unknown/rejected; genuine qualifiedCorpus + native fit/check/activate/assessment/first-send candidate retained after rollback; original pin corruption after expiry; actual static score:null with applicable current assessment; calibration512 query capacity propagation using native ctx.meta; all five measurement windows; numeric source independent of withdrawn Draft context; exact helper expired MIN; current source withdrawal; actor loss; four-role denial; selector/session denial; original creation boundary; duplicate/scoped reference errors; nonfinite/-0/unsafe counts/oversize rejection; and native paused I/O plus pause/resume/cancel fence behavior.

## Review notes / limits

- Native calibration candidate data are genuine native fixture producers and proofs, with synthetic provider transport. No hosted provider/deployment certificate claimed.
- Most structural/loss checks live within the existing exportIntelligence file; no generic raw export engine or unrelated production refactor added.
- Retained source proofs may traverse substantial native lineage. Native transaction limits and calibration pair guards are unchanged and propagate failure; no truncation fallback.
- Unit 4B1 only. No calibration/model/experiment export families (4B2), usage/finance/source policies (4C), deletion, or 30-day retention completion. No deployment, commit, full ~1030s baseline, or long style stress run.


## SPEC repair round 1 — latest frozen verification

Independent SPEC found two fail-open paths: original metric receipt budgetIds were not revalidated, and an expired saved candidate pin could mask the original experiment policy fingerprint corruption. Both were reproduced before edits. Only exportIntelligence.ts and exportMeasurements.test.ts changed in this repair; the other seven frozen files, native proof helper bodies and UI/browser projection are unchanged.

Repair details:
- Before any snapshot material/source-loss decision, require exactly three distinct original receipt grant IDs, load each original grant, validate ordered provider/workspace/account key, scope, currency and exact workspace/account identities. Also preserve original native policy/receipt currency and unit/reservation equality. Existing current-rights helper still rechecks current grants.
- Before any pin source-loss decision, validate original experiment policy hash using the existing canonical retainedPinHash; retain native CALIBRATION_POLICY_CHANGED for that defect. Also validate original experiment spec/purpose fingerprints, evaluation policy/spec linkage, candidate and evaluation spec identities, training/evaluation/monitoring snapshot spec/purpose/generation bindings, and native monitoring compatibility relationships. All precede expiry handling. Original experiment/spec/snapshot/policy expiry and original policy-reviewer loss remain direct unavailable conditions only after structural proof. No changes to retainedPin or other native proofs.
- Added two real-producer regression cases. Original metric grants cover duplicate, reordered, missing and foreign-account grants against both live and expired snapshots. Genuine first-send candidate covers original experiment policy/spec/purpose corruption against both live and expired saved pins, then restores original experiment and proves legitimate expired pin still produces a null protected projection.

Evidence for this repair:
- `/tmp/task33-measurements-repair-red.log`: exact independent SPEC repros fail as expected before code edits (2 failures).
- `/tmp/task33-measurements-repair-regression-red.log`: new committed-location regression cases fail as expected before code edits (2 failures).
- `/tmp/task33-measurements-spec-repro-green.log`: exact independent SPEC repros now 2/2 pass.
- `/tmp/task33-measurements-repair-green.log`: new archive suite20/20 passes.
- `/tmp/task33-measurements-repair-regression.log`: final6files,159/159 tests pass; no unhandled errors.
- `/tmp/task33-measurements-repair-backend-type.log` and `/tmp/task33-measurements-repair-frontend-type.log`: both exit0, empty logs.
- `/tmp/task33-measurements-repair-build.log`: exit0; same existing chunk-size/ineffective dynamic import warnings.
- `/tmp/task33-measurements-repair-format-check.log`: all nine owned files pass formatting.
- Browser not rerun this repair because neither UI nor projection shape changed; previous browser evidence still applies, explicitly mocked transport.

The previous freeze is retained in `/tmp/task33-measurement-history-freeze-pre-spec-repair.json`. The current freeze manifest contains all nine revised exact SHA256 values. No source edits after this revised freeze. Await fresh SPEC re-review before distinct QUALITY.


## SPEC repair round 2 — mixed original receipt ownership

Current freeze supersedes round1. Only exportIntelligence.ts and exportMeasurements.test.ts changed; the other seven exact owned hashes are unchanged. Native helper bodies and callers, DTOs, UI and browser remain unchanged. Await fresh SPEC PASS before distinct QUALITY.

Both original receipt preflights now require their native owner discriminator and absence of runId, researchOrderId and logicalIntent before any source-loss handling. Compared the complete original predicates of snapshots.finish (240–296) and history.finish (502–555). The snapshot preflight already covered the remaining original references, ordered grants and policy equality. History now uses one narrow historyReceiptReferences helper in both historyPosts and historyJobs: original job/policy IDs and fingerprint, native page integer/range and active page, policy version/currency/unit/maxResults/reservation equality, exactly three distinct ordered original grants with native key/scope/currency/workspace/account equality. Existing job receipt generation<=current saved job generation preserves genuine native management transitions. Original required fields are schema-required; an attempted missing page mutation was rejected by native schema validation before persistence, not treated as valid expiry. No production schema or proof helper changes.

Seven added native regression cases start from actual provider collection receipts. Each forbidden foreign-union field is tested independently against live and expired metric snapshots and both live/expired history families. Foreign run/order references are intentionally dangling table-valid corruption payloads; the receipt/lineage itself is produced natively. The history fixture imports one actual provider page and then calls native history.begin for the next page, proving retained text/header baseline before corruption. A further case covers history page negative/out-of-range/wrong-current-page, original policy version/currency/unit/maxResults/reservation, missing/duplicate/reordered original grant arrays against both families and both lifetimes.

Evidence:
- /tmp/task33-measurements-mixed-red.log: meaningful independent metric mixed-owner repro RED. Two appended independent history cases are INVALID SETUP: imported() fully settles pages and job.attemptId is null, so their db.patch fails before querying export. These are not claimed as valid reproductions; original reviewer file is untouched.
- /tmp/task33-measurements-mixed-regression-red.log: all seven new in-repository cases RED with native valid receipt setup and exports wrongly resolving; no schema/setup failure in this final RED log.
- /tmp/task33-measurements-mixed-green.log: archive suite27/27 PASS.
- /tmp/task33-measurements-mixed-regression.log: six focused native files166/166 PASS, no unhandled errors (archive + prior intelligence/shared/private + collect/snapshots).
- /tmp/task33-measurements-mixed-spec-green.log: three valid independent cases PASS: original grant duplicate, original expired policy fingerprint, mixed metric receipt. Two invalid history setup cases intentionally excluded; native history correctness is demonstrated by the seven own cases above.
- /tmp/task33-measurements-mixed-backend-type.log and /tmp/task33-measurements-mixed-frontend-type.log: both exit0.
- /tmp/task33-measurements-mixed-format-check.log: all nine owned files PASS.
- Build and browser not rerun this narrow repair: prior round1 build PASS and original browser evidence remain applicable; DTO/projection/UI unchanged. No new build concern found.

Prior round1 freeze retained at /tmp/task33-measurement-history-freeze-pre-mixed-repair.json. All nine current exact SHA256 values are in the main freeze manifest; aggregate uses SHA256 of compact JSON file-array. No source edits after this freeze. Unit4B1 only; no 4B2/4C/retention/deletion completion or hosted deployment claimed.
