# Task 33 Implementation Plan

> Agentic workers: use the explicitly requested subagent-driven-development skill; fresh implementer, SPEC review, then distinct QUALITY review per unit.

Goal: implement remaining Task33 export, resumable deletion and retention over actual native domain/component ownership.
Architecture: extend existing indexed readers and lifecycle gates, reuse domain cleanup and component primitives, retain durable object/effect references until safely reconciled. Existing partial exports retain their contracts.
Tech stack: installed React/Convex/Agent/Workflow/BetterAuth/R2; no new dependencies.
Spec: Backlog TASK-33 and every descendant; .docs/dispatch-end-to-end-implementation-plan.md P09.03.

## Global constraints
- Preserve pre-existing working tree edits; no main/master implementation.
- Current user/selected workspace/session/source authority precedes payloads, private ownership remains separate from Owner/Admin rights.
- Bound pages and wire bytes, never call capped UI lists a complete archive.
- Never lose original R2 locators before a durable deletion outcome; fail safely on unknown provider effects.
- User selected operational30-day retention; do not invent legal/provider/backup facts.
- No Backlog Done without explicit user manual confirmation.

## Review focus
- Foreign actor and source-bound private data must remain inaccessible.
- Late async replies and bootstrap must not recreate deleted data.
- Retry/interruption must preserve original object and outstanding-effect identity.
- Absent stored preferences, oversized legacy values and source errors must not yield fabricated successful exports.
- Source expiry/revocation and restore must not renew old grants/horizons.

## Unit 1 — Remaining own preferences and summary metadata (TASK-33.1)
Files: convex/operations/export.ts; convex/operations/export.test.ts; convex/preferences.ts (reuse helper exports only); src/features/settings/data-export.tsx; src/pages/Settings.tsx; relevant tests.
Interface: preferences workspaceQuery({expectedAuthId,expectedSessionId,requestKey}), scoped by workspaceId. Return correlated wire auth/session/request and explicit download DTO dispatch-self-preferences v1. Profile allowlist, stored notifications nullable, retained summary allowlist; no internal job/session/auth IDs in file. Current retainedEntry proof for every summary; finite64KiB ceiling, no truncation/default manufacture. Existing self/versions unchanged.
- [x] Write registered-function failing controls for roles/isolation/session/absent-explicit settings/source expiry and wire limits.
- [x] Implement allowlist and proof reuse; preserve query failures.
- [x] Wire native download with current scope/ticket/session response fence and Blob cleanup.
- [x] Run focused native/static/browser checks and types.
- [x] Fresh SPEC then distinct QUALITY, fix/review findings; commit only owned files (aeb256d).

## Remaining units
Read-only export/lifecycle preflight establishes exact family mapping and component seams before subsequent writers are dispatched. Expand this plan with exact interfaces/files before each unit, staying within existing33.1/33.2/33.3 scope. Finish with whole implementation review, integrated tests/build and documented external limitations/manual acceptance.

## Unit 2 — Shared content, editorial and planning archive (TASK-33.1)
Files: new convex/operations/exportShared.ts and exportShared.test.ts; convex/schema.ts for strictly necessary tenant-prefix discovery indexes; existing proof modules for helper-export-only changes; new src/features/settings/data-archive.tsx and native section wiring; existing operations.browser.mjs controls.
Interface: shared workspaceQuery with expectedAuthId,expectedSessionId,requestKey,fixed family discriminator,cursor,creationUpperBound. Owner/Admin and active selected workspace; family-specific typed allowlist DTO, one expensive native candidate/page, native cursor and creation upper bound, correlated wire envelope and64KiB/full finite-value checks.
Families: shared Draft roots (existing versions endpoint remains), Ideas/versions/feedback, contentFeedback, contentPlans/items, planningSeries/versions/commands/semantic bindings, shared editorial comments/approvals/schedules/events/review policies-controls-decisions-commands. Reuse actual draftResearchProof/ideaProofUntil/candidateProof/seriesVersionProof/seriesPlanProof and existing editorial review/source contracts. Never leak original private archives, source-copy blobs, object checksums/keys, raw command fingerprint/provider errors or hidden unavailable-row skeletons/counts. Original actual shared free text remains source-proved.
- [x] Write registered native failing fixtures for each consumed scope/proof branch, multi-page continuation beyond UI windows, tenant/role/session isolation and secret exclusion.
- [x] Implement explicit allowlists and current root/account/source/purpose checks, with necessary tenant-first indexes; propagate unexpected/ancestry/resource failures.
- [x] Wire bounded family download with current scope/session/nonce/horizon fences and honest per-page/non-snapshot copy.
- [x] Verify relevant native/browser/type/build checks, self-review and freeze.
- [x] Fresh SPEC, then distinct QUALITY; repair/re-review before next writer (033214d).

Later units split remaining private Research/Agent/Workflow archive, Jev/style/history/performance/calibration/experiments, and safe Auth/GitHub/media/notice/operational metadata. Their exact DTOs and proof interfaces are fixed from the actual modules before writer dispatch. No generic raw104-table serializer, no new export jobs/storage dependency.

## Deletion UI/bootstrap integration constraint
The current WorkspaceStoreProvider first calls bootstrap and only then subscribes users.current. A deletion guard that makes bootstrap reject would otherwise strand its author at the generic workspace-loading error; workspace locking also causes users.current to leave ready state. Deletion status must therefore be identity-authorized independently of normal workspace/user wrappers and observable before bootstrap readiness. Add a small native lifecycle progress view at that boundary, with no automatic workspace recreation or lost job selector. Retry resumes the original sealed deletion job; never reactivate lifecycle. Normal recovery/create UI must not render for a deleting account. Preserve demo and other users current workspaces.

## Unit 3 — Own chat and retained Research/Agent/Workflow archive (TASK-33.1)
Files: convex/operations/exportPrivate.ts and native tests; minimal helper-export-only changes in actual source proof modules; schema only for immutable own conversation discovery; generated API registration; native archive consumer and browser controls.
Interface: ten bounded workspaceQuery readers: conversations, conversationMessages, conversationOperations, conversationRuns, targetedOrders, publicOrders, orderSources, orderEvidence, researchMessages, workflowSteps. Native current actor before private discovery, Owner/Admin before public-only Research discovery. No caller actor/thread/workflow/work IDs. Every protected result follows original/current source authority; completed history does not use execution-only orderAuthority. Component pointers derive only from proved original domain roots.
Exact DTOs, native indexes, proof seams and fixtures: [private archive preflight](../reviews/task-33-private-archive-preflight.md). Safe Agent user/assistant plain text only, no tool/reasoning/provider/file payloads; Workflow fixed recognized stages/status/times only, validated original order/run args never returned. Native one-candidate pagination, honest live component history/non-snapshot coverage and full64KiB/finite-value guard. Authentication/ownership/ancestry/resource/component inconsistencies fail whole page; skip only directly established source loss.
- [x] Registered native scope/source/component failing controls and multi-page discovery.
- [x] Implement exact DTO proofs and own/public index isolation.
- [x] Integrate parent selection and downloads with live native scope/session/nonce/horizon guards.
- [x] Focused native/browser/types/build, freeze and independent SPEC then distinct QUALITY (eb32ad6).

## Unit 4 — Retained intelligence and measurement archive (TASK-33.1)
Files: convex/operations/exportIntelligence.ts/native tests; helper-export-only proof seams in style/calibration/models/experiments/Jev modules; necessary immutable scoped indexes; generated registration; archive consumer/browser controls.
Fixed-family pages cover Jev assessments/requests/recommendations/routing/content verification, every profile/source-update/style history, own history and numeric observations, all calibration purposes/references/model variants, experiment manifests/bindings and safe data-use/financial outcomes. Exact scope, field allowlists, proof reuse, indexes and fixtures are specified in [final archive preflight](../reviews/task-33-final-archive-preflight.md), branches1–9. Private actor selectors precede discovery, historic retired/stopped records retain original proof, source loss does not fabricate skeletons or finance zero. Reuse models.readable for every union; static rollback's unbounded proof becomes null rather than wire Infinity. No vector coordinates, executable/provider secrets or arbitrary raw logs.
- [ ] Native positive/negative fixtures for every claimed union and multi-page history.
- [ ] Implement finite bounded fixed-family DTO/proof pages and guarded native downloads.
- [ ] Focused native/browser/types/build; fresh SPEC then distinct QUALITY before next writer.

Execution split:4A Jev assessments/requests/recommendations/routing/content requests and algorithm/audience/source-update/style histories;4B history/measurements/calibration/experiments;4C data-use policies/controls and every original financial ownership variant. Each has a fresh implementer and separate SPEC then QUALITY gate. Reuse the same fixed-family reader/consumer after4A; do not add independent engines. Research source policies join4C; empty-result configuration and withdrawal declarations remain discoverable as configuration metadata.

4B execution is split at independent existing source contracts:4B1 eight history/metrics/first-send-knowledge families;4B2 calibration purposes/specs/snapshots/all eight model variants/controls and experiment roots/commands/assignments/bindings. Each gets a fresh writer and SPEC then distinct QUALITY before the next writer. This bounds review size while preserving complete16-family measurement scope. They extend the existing fixed Intelligence page/consumer rather than add another export engine.

4B1 ownership: existing exportIntelligence.ts fixed family validators/branches and new focused native exportMeasurements.test.ts; schema one publicationKnowledge workspace/account index; models.ts helper-only retainedPin export; existing data-archive.tsx/browser projections and selectors. Allowed pure native performance fixtures may be extracted from collect.test.ts/snapshots.test.ts without altering birth sequence/assertions. Eight families historyPosts/historyJobs/historyPolicies/historyControls/performanceSnapshots/performancePolicies/performanceControls/publicationKnowledge; no calibration experiment branches yet. Require strict future retained minima and exact original first-send generation/version/scope; preserve actual measured0/null, failed/paused/removed safe headers and static saved score/pin null. Full native-shaped DTO-to-browser parity is required, not only handcrafted mock schema.

4B1 native refinement: history.manage pause/resume/cancel advances both current control and job generation while older import rows/financial receipts remain. Exact original parent/policy/fingerprint/receipt links must be checked first; corroborated newer native generation is direct source withdrawal, so old posts retain only actual safe headers, not text. Impossible/future generation or corrupted references still fail. Job metadata can retain older receipt.generation<=saved job.generation; financial settlement extraction remains4C. Existing canonical models hash may be exported by named alias with unchanged body to validate original pin fingerprints before expiry redaction.

4A actual-native refinement: own assessment requests/recommendation receipts/routing/content requests/standalone verification histories are actor=self for all four current membership roles; business declarations/assessments/styles remain Owner/Admin. Retained source helpers still enforce original actor rights; Viewer downgrade allows only safe owned metadata when protected source material is unavailable. Standalone verification may belong to a different actor than producer, requiring one workspace-bound verification-actor index and separate own branch. Recommendation receipts do not store historical assessment/rule references; preserve their actual base/result/revision/clock rather than reconstructing them. Plain public-code/audience declarations retain original expired review windows and retired states as metadata. Exact signatures/DTOs are in [4A preflight](../reviews/task-33-intelligence-a-preflight.md).

4A final cursor check requires four additional `[workspaceId,actorId]` creation-order indexes for assessmentRequests/recommendationReceipts/routingOperations/contentRequests. Existing operation-key suffixes can appear in native continuation cursors, so they are retained for old callers but are not archive discovery indexes. Whole-wire/native-cursor secret sentinel controls accompany the switch; no custom cursor encryption or export engine.

4A initial independent SPEC found four real defects (five native reproductions): assessment-request profile scope, analyzer original policy identity, normalized downloaded answers and routing model provenance. Original writer repairs these before new freeze/re-review; one added helper-only path ai/jev/access.ts exposes the existing exact analyzer receipt proof with no behavior change. Initial30 tests and browser evidence are not acceptance of the defective freeze.

4A accepted after repaired SPEC and distinct QUALITY, exact17-path commit2158440. Independent originalrepro5+archive/analyzer47 pass, QUALITY26archive+7style pass and17hashes/ASTparity. 4B1 fresh measurement_history writer now active on baseline2158440; no other source writer.

4B exact selectors/proofs/native unions are fixed in [measurement preflight](../reviews/task-33-intelligence-b-preflight.md); one new immutable workspace/account publicationKnowledge discovery index is required. Original static score/pin null remains null, only rollback-static proof Infinity is normalized to null, and retained history/snapshot minima must be strictly future.

4B1 initial frozen nine-path implementation passed157 related native tests, types/build/format and targeted mocked mounted browser. Independent SPEC reproduced two P1s: missing original metrics receipt grant binding and masked original experiment policy fingerprint after pin expiry. Original writer repairs both with native regressions before re-freeze/SPEC; QUALITY remains pending. Initial evidence is historical, not accepted source.

## Unit 5 — Remaining records, identity and original-media delivery (TASK-33.1)
Files: convex/operations/exportRecords.ts, exportIdentity.ts and native tests; narrow native proof helper exports/indexes; existing media delivery seams; generated registration; archive UI/browser controls.
Fixed-family pages cover selected workspace/memberships/accounts, original media manifests/references/own uploads and authorized bytes, GitHub shared metadata and own approved contexts, own dismissed/read notices and original delivery receipts, own team/invitation records, own Auth profile/session/linked-account/consent metadata and publication/media external-effect receipts. Exact DTOs and fixtures are specified in final archive preflight branches10–16. Omit bearer/secrets/object keys/private foreign contacts and component locators. Original-media delivery requires actual namespace/version/asset ownership and current transfer proof; missing objects are explicit failure. Other accessible workspaces are deliberate selections, never silent aggregation. Document component/copy/vector implementation derivatives excluded from semantic JSON and their separate physical deletion duties.
- [ ] Native actor/recipient/component/byte ownership and pagination controls; secret sentinels.
- [ ] Implement exact safe metadata projections and actual authenticated original-byte delivery.
- [ ] Native UI/full mounted browser/types/build; fresh SPEC then distinct QUALITY.

Execution split:5A fixed records/own Auth metadata plus Research profile/configuration and actual human handoff coverage;5B original bytes. 5B uses one authenticated fixed-selector Node action with512KiB wire ranges, ≤32MiB/64 sequential calls for one file and reproof before/after each transfer. R2 uses actual GetObject Range and exact immutable namespace/upload/version checksum binding; native owned-Agent attachments derive through approved domain root→thread→message→file→app storage, never client file/storage IDs or remote URLs. Native storage.get currently returns a whole Blob, so that legacy attachment branch has an explicit maximum2GiB read work at the32MiB ceiling; no unsupported Range API is assumed. Inline/native alias and unsupported remote references are explicit. Browser verifies full size/hash and final live scope before one download; no public signed URL or fake missing-object success. Exact proof/fixture plan: [original media](../reviews/task-33-original-media-export-preflight.md).

## Unit 6 — Deletion authorization and durable foundation (TASK-33.2)
Files: authorization/users/team/sourceProof, native schema/indexes/generated API, operations/deletion.ts/tests. Exact closed contracts and seams are specified in [deletion implementation preflight](../reviews/task-33-deletion-implementation-preflight.md). Reload persisted supplied users; fence bootstrap and invitation replay; expose only identity-authorized preview/status and internal preparation until a working executor is present. Preserve sole-owner CAS/explicit transfer-or-workspace-delete and no shared-workspace deletion by implication. Every task/job must be durable, idempotent and independently resumable without reenabling sources or renewing original deadlines.
- [ ] Failing native stale-user/bootstrap/invitation/scope/sole-owner/replay controls.
- [ ] Implement minimal durable jobs, previews/status and common account fence.
- [ ] Focused verification and fresh SPEC then distinct QUALITY.

Execution split:6A persisted lifecycle/job authorization foundation;6B actual Auth admission and bounded erasure seam before the coordinator is enabled. Preferred6B is one exact reproducible @convex-dev/better-auth@0.12.5 component patch: a trusted configured fixed commit-time parent guard runs even for legacy calls omitting optional hooks. Supported app database/HTTP hooks approve exact canonical native account-write HMACs and generated session-token HMACs under fresh immutable artifact/generation leases. Never-admitted native births are atomically journalled and boundedly cleaned after original pending deadline; no carrier field or Better Auth SDK patch. Retained content-free old-identity fences reject metadata-free legacy callbacks while current deliberately renewed signup can receive an exact new-generation permit. Native fixture must prove hash equality, committed deny cleanup, no borrowed fresh permits, JWT issuance isolation and source/dist parity. No absolute hosted timeout is correctness evidence. See the final superseding section of [Auth preflight](../reviews/task-33-auth-erasure-preflight.md); earlier carrier proposals are historical and not selected.

6A also closes the current text-only model writer boundary in existing provider.wrapGenerate/wrapStream: reject unexpected native v3 `file` output before Agent serialization/storage, preserving existing settlement-before-validation. Current app prompt/message/tool inputs are text or fixed objects of strings/native IDs; no file-generation feature is introduced. Use existing wrappers, no dependency or Agent SDK patch. Supported historical own attachments still need source-bound export and explicit physical cleanup. Future file-generation features must introduce producer ownership/lifecycle before relaxing this boundary.

## Unit 7 — Complete bounded deletion coordinator (TASK-33.2)
Files: operations/deletion.ts/tests, exact native cleanup helper seams and missing scoped indexes, reproducible patches/@convex-dev__workflow@0.4.8.patch plus pnpm workspace/lock metadata, generated component API. Closed native phases follow the104-table disposition inventory, held parents, known job generations, original source-copy/vector/model cleanup, owned Agent/Workflow terminal proofs, R2 receipt/grant boundary and Auth-last identity cleanup. Unknown effects retain only minimal replay/settlement identity. Never claim completion for unsupported component/rootless ownership. Enable public start only with working bounded runner.
Workflow patch uses exact scoped indexes/draining, root-last deletion, safe late-callback handling and source/dist parity; no shared component reset. Current14-table Dev empty audit is deployment-specific evidence, not future/production proof. Official Context7 pnpm docs verified patch/patch-commit flow; unchanged pinned pnpm12.8.1 successfully verified outside sandbox on2026-10-09.

Agent file deletion is separate from native thread cleanup: capture all own thread message/file/storage/hash edges before parents vanish, wait definitive producer completion, preserve actual foreign deduped references, then guarded zero-count nonforce metadata retirement plus explicit app storage.delete with durable receipt and absence verification. Ordinary new/reused file counts are supported; addFile race/copy holds/old pending-replacement anomalies cannot be forced to zero. Missing/unowned mappings and historical orphan classes block proof. [Agent erasure preflight](../reviews/task-33-agent-files-erasure-preflight.md) supplies exact APIs and native fixtures; the new current text writer boundary prevents introducing unjournalled SDK file uploads.
- [ ] Native interruptions/retries/late effects/foreign rows/all-family disposition and actual component/object proof controls.
- [ ] Implement runner and pinned Workflow maintenance, prove reproducible install.
- [ ] Focused native/static checks; fresh SPEC then distinct QUALITY before native UI enables start.

## Unit 8 — Retention, revocation and restore barriers (TASK-33.3)
Files: operations/retention.ts/tests, native cron and existing source/cache/pipeline/Jev cleanup seams, inventory/help copy. Fixed30day operational cap from original created/completed boundary, shortened by original source/purpose horizons. Include null-horizon Jev assessments and every introduced transient family; preserve content-free suppression/unknown-effect/outstanding settlement/upload guards until safe. Restored data cannot renew grants, activate erased roots or replay commands. No invented remote/provider/legal retention or raw debug capture.
- [ ]30day/earlier-expiry/null-horizon/nonrenewal/replay controls.
- [ ] Implement bounded sweeps over existing cleanup paths and document each inventory disposition.
- [ ] Fresh SPEC then distinct QUALITY and focused integration verification.

## Unit 9 — Native data controls and integrated acceptance (TASK-33.2/33.3)
Files: src/features/settings/data-controls.tsx, Settings/store lifecycle boundary, browser controls and validation documentation. Durable pre-bootstrap status, explicit irreversible scope/sole-owner choices, resume/reload/sign-out behavior, real server phase/status and honest public-post/provider/backup limits; preserve Demo. Complete all-unit review, appropriate native/type/build/security/browser gates, update verified Backlog ACs through CLI. Manual Done remains pending explicit user confirmation.
- [ ] Native mounted browser reload/scope/owner/sign-out/retry/accessibility controls.
- [ ] Implement live controls and pre-bootstrap lifecycle presentation.
- [ ] Fresh SPEC then distinct QUALITY; final whole implementation review and integrated gates.

### Unit4B2 native discovery refinement
Actual calibration indexes contain saved `createdAt` before native `_creationTime`; add only three immutable archive prefix indexes (purposes workspace/account, references+models workspace/account/kind), retaining old caller indexes. This enables exact native creation-upper-bound range with one candidate/page. Experiment roots/children/control existing exact indexes suffice. Original proof helper exports and every eight model variant remain required; no additional export engine.

### User effort constraint —2026-10-09
User reports80%weeklyquota consumed and24h elapsed, then explicitly chooses continued remaining implementation with sharplybounded effort. Stop further preflights. Use cheaper models for mechanical code/reviews, reuse nativeproofs/fixtures and narrow actual acceptance criteria; no broad tests repeated without concrete cause. Keep required scope/security/data-loss checks, fresh SPEC then distinct QUALITY. Current4B1 QUALITY two reproduced archive-integrity gaps repaired in only export/test by low-cost worker.

4B1 accepted after repaired full SPEC/QUALITY and bounded final delta reviews, exact9source commit eca1227. Final29 export tests+2 independent QUALITY regressions/backendTS pass; earlier166 relevant native tests and unchanged browser/type/build evidence remain explicitly scoped. No parent AC fully checked from this partial unit.

Cost-constrained execution order: prioritize unit6A current persisted-user/workspace deletion gates and durable ownership-authorized foundation next, then working coordinator/retention/UI. Remaining4B2/4C/5 exports remain in scope and will be completed; foundation is independent of those semantic projections. Fresh standard-model writer deletion_foundation_budget owns only authorization/users/team/schema/API/deletion/provider tests, no public destructive start until executor exists. No further preflights.

6A accepted exact10source commit6de8b2f:116 selected native/bothTS/format, freshSPEC36+10hash PASS anddistinctQUALITYAPPROVE withoutrepeat. Internalpreparedjobs remainblocked/fence/0, nopublicstart/executor.6B fresh standardmodel auth_admission_budget now owns one pinnedAuthcomponent fixed-guard patch/currentnative admission+bounded erasure seam, source/dist/reproducibleinstall evidence; no more preflights.


### User-requested stop —2026-10-10
User explicitly selected “Jetzt mit sauberem Zwischenstand beenden” after renewed runtime concern. No new implementation block started. Unit6B accepted exact11-source commit9d8ca84 after fresh SPEC and distinct QUALITY; repeat-deletion fixed-deadline regression repaired.28focused tests,2fresh-source/dist parity tests,bothTS (backend fresh after repair),format,frozenoffline patch install12filesbyteidentical. No public deletion runner or live deployment enabled.
Remaining: complete bounded coordinator/Agent+Workflow+R2 physical cleanup;30day retention/source/replay integration; remaining calibration/experiment/policy/financial/record/Auth metadata and original-byte exports; native deletion controls/pre-bootstrap status integration; final integrated validation. Goal paused at user request; Backlog remains In Progress, no Done or unverified AC checks.
