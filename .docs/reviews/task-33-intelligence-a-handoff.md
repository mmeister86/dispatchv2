# TASK-33.1 unit4A source handoff

Frozen source manifest: `/tmp/task33-intelligence-a-freeze.json`; exact SHA256 list: `/tmp/task33-intelligence-a-SHA256SUMS`. Sixteen owned paths only. Root reported branch `codex/backend-research-summaries`, baseline `eb32ad6`; this writer ran no Git commands, staged nothing, committed nothing, deployed nothing, and changed no Backlog/doc files. Root must run Git diff validation and independent SPEC then distinct QUALITY review before committing. This is unit4A, not completion of all TASK-33.

## Implementation

`operations/exportIntelligence.page` exposes fifteen fixed families. Every page checks expected auth/session/request correlation, active workspace, exact family parent selectors and role before reading one candidate from a native index. Shared declarations are Owner/Admin; operational rows are strictly current actor, including Viewer safe headers. Five added indexes: four `[workspaceId, actorId]` indexes for assessment requests/recommendation receipts/routing operations/content requests, and one `[workspaceId, verification.actorId]` index. Existing indexes remain. All five contain no operation key. Creation bounds are applied directly to native immutable creation-clock indexes. Whole-envelope finite/-0 and 64KiB UTF8 guards fail rather than truncate.

Native retained proof seams reuse routing original paid-policy/processing-rights/budgets, retained run graphs, original verifier packet/receipt, retained style version/proposal/command proofs, and structurally retained public source-update evidence. Public algorithm declarations retain expired review windows and retired states. Direct positive loss yields explicit null protected material where supported, while exact reference, actor, reciprocal, ancestry and unknown resource errors still abort the page. Erased candidate metadata is accepted only when the original candidate row is explicitly source-unavailable and its exact candidate/run/input/ref/receipt bindings still hold. Stopped/cleaned composite parents mask child intent and results too. No archive writes, provider I/O, scheduler calls or usage reconstruction.

The existing mounted `NativeArchiveExport` handles all families, exact native draft and source-kind inputs, own/shared role visibility, whitelist-only per-page JSON, and the existing session/workspace/account/role/family epoch, nonce, lifetime and Blob guards. Settings already mounts this component, so no extra Settings wiring was necessary.

## Pure fixture extraction

Approved fixture files contain the original native fixture helper bodies relocated to reusable modules, with adjusted import paths and only strict helper dependencies. They do not register or inherit suites:

- `tests/jev-verification-fixture.ts`: candidateFixture/configureVerifier/configuredFixture/repairableComposite/wire; original `convex/ai/jev/verify.test.ts` now imports them.
- `tests/intelligence-update-fixture.ts`: fixture/transport/independent/input/old/head; original `convex/intelligence/profileUpdates.test.ts` now imports them.
- `tests/jev-routing-fixture.ts`: fixture/response; original `convex/ai/jev/routing.test.ts` now imports them.

All three original native suites passed in the final 280-test regression. Baseline body identity is reviewable via root's Git diff (writer was forbidden Git commands).

## Verification evidence

- `/tmp/task33-intelligence-regression.log`: **8 files, 280 tests passed**. Exact command: `pnpm exec vitest run convex/operations/exportIntelligence.test.ts convex/operations/export.test.ts convex/operations/exportPrivate.test.ts convex/operations/exportShared.test.ts convex/intelligence/profileUpdates.test.ts convex/intelligence/profiles.test.ts convex/ai/jev/verify.test.ts convex/ai/jev/routing.test.ts`.
- `/tmp/task33-intelligence-style-regression.log`: **8 passed, 25 deliberately skipped**. Selected native style tests: empty/save/select, replay, rejected proposal, copied/reset/retire/rollback, unselected retired ancestry, original selector authority, native resource failures, native continued history. No long stress suite run.
- `/tmp/task33-intelligence-native-final.log`: final **30/30 archive tests passed** after formatting and test-only type annotation.
- `/tmp/task33-intelligence-typecheck-final.log`: **both TS projects passed** via `pnpm run typecheck`.
- `/tmp/task33-intelligence-build.log`: **production build passed**. Existing warnings report >500kB chunks and ineffective dynamic import; no deploy.
- `/tmp/task33-intelligence-format-check.log`: **all sixteen owned files pass Prettier**. Final source scan also checked no trailing whitespace/conflict markers. Root still needs `git diff --check`.
- `/tmp/task33-intelligence-browser-final.log` and `/tmp/task33-intelligence-browser-final/intelligence-archive.json`: **targeted mounted browser run exited 0**. Actual own-routing and own-verification downloaded JSON files inspected; nested secret/hash/key sentinels removed; exact draft/account/source-kind request selectors; own Editor/Viewer visibility; corrupt envelope, source expiry, account/session/workspace/role/family ABA and unmount guards. Transport is explicitly **MOCKED**, native backend proofs are separate.
- `/tmp/task33-intelligence-browser-regression.log` and `/tmp/task33-intelligence-browser-regression/receipt.json`: **full existing mounted operations browser regression exited 0**, including existing shared/private archive behavior and common Blob/lifetime guards. Intentional error-boundary console errors are part of existing negative scenarios.

TDD evidence retained: `/tmp/task33-intelligence-cursor-red.log` (4 failed/26 passed, native cursors leaked operation keys) then `/tmp/task33-intelligence-cursor-green.log` (30 passed); `/tmp/task33-intelligence-erased-red.log` (2 failed/28 passed, candidate erasure and stopped parent) then `/tmp/task33-intelligence-erased-green.log` (30 passed). Initial feature missing-endpoint/family failures were observed earlier; the final logs above are reproducible final verification evidence.

## Native archive coverage

Thirty tests cover all fifteen families with actual native fixture and operation paths. Multipage original assessment requests, paid/default-OFF routing, standalone verifiers, composite root/repair requests, assessments plus adoption receipts, both algorithm variants, audiences/selection receipts, all three source-update kinds, style declarations/commands and rejected proposals. Native selections/controls are singleton per account and are verified in their actual one-row contract.

Specific proofs include complete seven-criterion standalone result after dispatch deadline; first/repair/final composite with final retained past deadline; distinct verifier discovers only own slot without foreign producer intent; Viewer protected-loss headers; exact original analyzer provenance and actual adoption receipt values; old policy after selection change plus original expired budget; 27 style declarations/commands and 17 source checks beyond old UI caps; both source model variants, expired-review derived declaration; authentic 103-path clipped public observation; actual 32-node style graph then deliberate 33rd corrupt sentinel failure; immutable page upper bound; nested operation/reference/slot corruption; foreign references even when source-loss flags are set; original verifier receipt mismatch; source cleanup/erasure; numeric NaN/Infinity/-0; >64KiB original public payload; unknown database read error propagation; no reads-side writes/provider/scheduler effects; hidden operation keys absent from both whole wire and decoded/stringified native cursor.

## Deliberate limits

No full baseline rerun: root's baseline already had 1582 passes and one existing long style timeout; the requested long stress suite was explicitly excluded. No live hosted Convex/browser transport or deployment. Only actual selected native cases above are claimed. Remaining 4B history/calibration/experiments, 4C policies/usage, records/Auth/media/deletion/retention are outside this source unit.

## Superseding SPEC repair freeze (four confirmed findings)

The original sixteen-file freeze above was rejected by independent SPEC. The **current** `/tmp/task33-intelligence-a-freeze.json` and `/tmp/task33-intelligence-a-SHA256SUMS` now freeze **17** owned paths after repair. Prior manifest retained at `/tmp/task33-intelligence-a-freeze-before-spec-repair.json`. The one additional approved production path is `convex/ai/jev/access.ts`: export/rename the existing receipt helper to `analyzerReceipt` and update its sole local caller, with the proof body/error semantics unchanged. Root/SPEC should independently verify that body parity.

1. Own assessment requests now prove both original saved algorithm/audience rows against exact workspace/account/network/surface **before** deciding whether an unavailable header may be returned. Their original historical IDs and lifecycle status remain intact.
2. Assessments now scope-check the original attempt and policy row and reuse `analyzerReceipt`, which validates original policy kind/fingerprint/model/version, native receipt ownership and financial consistency, and all three exact original budget scopes. No current controls, selected policy, provider credential, policy expiry or execution review gate was added.
3. Assessment download answer allowlist now preserves normalized `type`, `value`, `confidence`, `probability`. Mounted download assertions cover all nine native-shaped answers, zero score/probability/confidence and supported null answer/result provenance states. Independent source-derived projector reproduction also passes against actual native analyzer output.
4. Routing rows and download allowlists include actual `policyId`, `attemptId`, and nullable explicit provenance (`policyVersion`, `requestedModel`, `resolvedModel`) from the validated original routing receipt. No attempt yields null provenance; no attempt/model is manufactured for configuration-required, human-choice or pending native rows. Original model provenance remains preserved after policy selection changes. Credentials/fingerprints/operation keys remain absent.

### Repair verification

- `/tmp/task33-intelligence-repair-spec-red.log`: independent five reproductions RED before fixes.
- `/tmp/task33-intelligence-repair-spec-final.log`: **5/5 independent reproductions PASS**, including exact source-derived UI projector parity. Same command as reviewer: `node node_modules/vitest/vitest.mjs run --root /tmp/task33-spec-harness regression.test.ts`.
- `/tmp/task33-intelligence-repair-native-red.log`: **15 failures/28 passes** before fixes: all eight profile workspace/account retained/unavailable combinations, five analyzer policy/model/fingerprint corruptions, and strengthened routing provenance cases.
- `/tmp/task33-intelligence-repair-native-final.log`: **43/43 archive tests PASS**.
- `/tmp/task33-intelligence-repair-regression.log`: **8 files, 293 tests PASS** (same original eight suites listed above; an accidentally listed nonexistent `access.test.ts` matched no extra suite and is not counted).
- `/tmp/task33-intelligence-repair-analyzer.log`: actual `convex/ai/jev/analyzePost.test.ts`, **4/4 PASS**, verifying existing analyzer execution behavior after receipt seam extraction.
- `/tmp/task33-intelligence-repair-style.log`: **8 selected style tests PASS, 25 skipped**. Long stress not rerun.
- `/tmp/task33-intelligence-repair-types.log`: final **both-project typecheck PASS**.
- `/tmp/task33-intelligence-repair-build.log`: **build PASS**, existing chunk/dynamic-import warnings only.
- `/tmp/task33-intelligence-repair-format-check.log`: **all 17 files pass Prettier**. Final whitespace/conflict scan passed. Git diff check remains root-owned.
- `/tmp/task33-intelligence-repair-browser.log` and `/tmp/task33-intelligence-repair-browser/intelligence-archive.json`: **targeted mounted browser exit 0**, now including normative normalized assessment answer/download parity and routing provenance/no-attempt null semantics, plus prior lifetime and correlation guards. Transport remains explicitly **MOCKED**. The test initially exposed an incorrectly reused mocked cursor on the second assessment page; the mock now advances its native cursor, and final test passes.

The full existing operations browser pass from the original freeze remains recorded above; it was not rerun for these four narrow repairs. No broad baseline/stress run, deployment, Git/Backlog action or unrelated source change. Source is frozen again for SPEC repair re-review, followed by distinct QUALITY review only after SPEC passes.
