# TASK-33.1 unit4A — independent QUALITY review

**Verdict: APPROVE. Ready to merge: Yes, for the reviewed frozen unit4A scope.**

Base: `eb32ad6`. Head: the working-tree replacement freeze in `/tmp/task33-intelligence-a-freeze.json`, dated `2026-10-09T09:24:46.833563+00:00`; no new commit was assumed. All **17/17 SHA-256 hashes matched before and after this review**. This review followed the repaired SPEC pass in `/tmp/task33-intelligence-a-spec-repaired.md` and independently inspected the implementation, existing callers, and tests. No source, Git, Backlog, or deployment changes were made.

## Strengths

- **Read boundaries are explicit.** `convex/operations/exportIntelligence.ts:752` validates the current native identity/session, selected active workspace, role, family arguments, and pagination parameters before selecting a candidate. Shared families require Owner/Admin. The five private-family indexes select the current actor before loading private candidates, and standalone verification discovery uses `verification.actorId` rather than the producer. The workspace-checking proof context, per-account scoping, and structural relationship checks protect reused native proofs from interpreting foreign references as ordinary source loss.
- **Historical records preserve their saved meaning.** The archive uses original Draft versions, profile IDs, original analyzer/routing receipts, retained source proofs, and original horizons. The repaired analyzer helper retains original policy/budget validation; routing model provenance comes from the validated original attempt. Retired public declarations and historical style versions do not acquire a current-selection requirement. The native verifier exports its own normalized criteria and retains the distinction between producer and verifier.
- **Failure behavior is conservative and understandable.** Positive, explicitly recognized direct loss yields a restricted header with material nulled only after structural checks. Unexpected proof/database failures propagate. Native cursor continuation and immutable creation bounds replace list caps; a page contains one candidate. Finite-number/negative-zero checks and the 64 KiB check cover the entire envelope, without silently truncating arrays or converting a failed proof into an empty success.
- **Existing behavior is preserved by narrow seams.** Routing's retained proof and receipt changes are exports/renames. The verifier's throwing retained helper contains the previous projection's proof logic, leaving the existing projection error classification in place. The analyzer access file is AST-identical after reversing only the helper export/rename and its sole pre-existing caller rename. Profile live proof callers retain the live default. Style proof reuse keeps native authority/ancestry checks and the 32-node bound; tested existing command/history callers still pass.
- **The browser uses explicit projections and the existing lifetime machinery.** `src/features/settings/data-archive.tsx:33` onward allowlists the new DTOs, including nested verification, routing, style, update, and normalized assessment fields. Zero/null and the actual normalized Answer union survive. The existing request correlation, scope epoch/nonce, expiry rechecks, unmount handling and object-URL cleanup also cover the new endpoint and selectors. The new browser harness explicitly labels its transport as mocked.
- **The test extraction is faithful.** Independently inspected and ran the AST comparison scripts. All 13 moved fixture declarations match their baseline implementations, and all remaining original routing/verification/profile-update test statements are unchanged at AST level. The new fixture modules provide native producer setup rather than importing test suites for side effects.

## Issues

### Critical

None found.

### Important

None found.

### Minor

None requiring a change for this unit.

## Maintainability assessment

The new `exportIntelligence.ts` is 1,524 lines, including explicit key lists, validators, proof helpers and fifteen family branches. Its size is material, but it has one clear responsibility: projecting bounded retained Intelligence/Jev/Style archive pages through native domain proofs. The helpers isolate cross-cutting structural checks; the family branches remain direct and auditable. I do not recommend a new generic archive engine or splitting the domain reader solely to reduce line count in this change. The UI's added projection tables likewise make the public download contract explicit. The browser diff includes formatting churn, but the inspected changes do not present a correctness reason to block this freeze.

## Independent verification

1. Freeze verification: **17/17 PASS**, before and after review.
2. `node node_modules/vitest/vitest.mjs run convex/operations/exportIntelligence.test.ts -t 'session and shared|whole UTF8|nested actor|unknown resource|original command mismatch|distinct verifier|native funded routing|saved request rejects|original analyzer'`: **20 PASS, 23 skipped**. Covers auth/shared role boundaries, oversized wire failure, nested actor/reference corruption, resource-error propagation, verifier ownership, funded historical routing, saved profile boundaries, and original analyzer receipt corruption.
3. `node node_modules/vitest/vitest.mjs run convex/operations/exportIntelligence.test.ts -t 'native standalone verification exports|native composite first|native history exceeds|103-path|creation bound|retired and review-expired'`: **6 PASS, 37 skipped**. Covers retained verifier/composite semantics, uncapped history, exact clipped public observations, creation bounds, and historical public profiles.
4. `node node_modules/vitest/vitest.mjs run convex/ai/styleProfiles.test.ts -t 'registered empty account|human correction creates|exact replay after later|retiring an unselected ancestor|correction ancestry keeps|registered history returns|actual native resource errors'`: **7 PASS, 26 skipped**. Existing native save/select/replay, proposal/correction, historical ancestry/selector authority, catalog masking, and resource-failure behavior remain intact.
5. Inspected and executed `/tmp/task33-spec-harness/parity.cjs`: **13 extracted declarations + all remaining original test statements AST parity PASS**.
6. Inspected and executed `/tmp/task33-spec-harness/analyzer-parity.cjs`: **entire analyzer access file AST parity PASS** after the approved export/rename and sole existing caller rename.

The 26 archive tests and seven existing style tests above are **native Convex-test executions**, using real registered producers/proofs and synthetic provider transport where applicable. They are distinct from the mounted browser harness, whose Convex transport is mocked. No live provider call or production deployment was performed.

## Assessment

**Ready to merge: Yes.** No actionable critical or important quality defect was found in the reviewed freeze. The repaired implementation has clear authorization and projection boundaries, retains native historical-proof behavior, and passes the bounded independent checks above.

This approval is a code-quality gate for unit4A, not manual user acceptance, Backlog closure, a current production-deployment claim, or proof of unit4B/4C coverage.

**Practical limits:** I did not rerun the full browser harness, TypeScript/build/format checks, the entire baseline suite, or the long style stress test. Broader reported results remain prior evidence, including the known baseline of 1,582 passing tests with one unrelated 900-second style timeout; they are not a fresh full-baseline pass from this review. The browser source and added assertions were inspected, but current browser execution was not independently repeated.
