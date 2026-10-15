# TASK-33.1 unit4A — independent repaired SPEC review

**Verdict: ✅ SPEC compliant for the reviewed unit4A scope. All four original findings are repaired. Proceed to the separate fresh QUALITY gate.**

Reviewed the replacement freeze timestamp `2026-10-09T09:24:46.833563+00:00` in `/tmp/task33-intelligence-a-freeze.json`, against baseline `eb32ad6`. All **17 file hashes** matched at the start and after verification. The initial rejected review `/tmp/task33-intelligence-a-spec.md` remains intact. This re-review made no source, Git, Backlog or deployment edits.

## Repair verification

1. **Original request profile boundaries — repaired.** `convex/operations/exportIntelligence.ts` now loads both saved algorithm/audience IDs through `scoped` with the original workspace/account, and checks network `x` plus surface `for_you` before Draft source availability is considered. Both retained and unavailable paths therefore abort on foreign profile references. Historical IDs/status are preserved; today's selection is not substituted. The original two independent retained/erased reproductions pass. The archive suite also checks both profile types across workspace/account and retained/unavailable combinations.

2. **Original assessment policy proof — repaired.** The assessment branch scopes its original attempt, checks `jev-analyzer` ownership, scopes that attempt's original policy, and calls the extracted `analyzerReceipt`. The helper rejects the wrong policy kind, mismatched original fingerprint/model/version/scope, invalid receipt financial values, and incorrect original budget scopes. Existing assessment-to-attempt provenance bindings remain. It does not replace the policy with today's selection or add live execution controls/review/expiry gates. The independent foreign-policy reproduction passes; five additional native policy/receipt corruption variants pass.

   **Extraction parity:** `/tmp/task33-spec-harness/analyzer-parity.cjs` compared the entire `convex/ai/jev/access.ts` AST with `eb32ad6`, undoing only `receipt` → exported `analyzerReceipt` and its sole existing `settle` caller rename. The entire file's AST is otherwise identical, including proof body, error strings and settlement behavior. The only additional call site is the archive. Four existing analyzer execution tests pass independently.

3. **Normalized assessment download — repaired.** `src/features/settings/data-archive.tsx:203` now projects `type value confidence probability`, matching the native normalized Answer union. The unchanged independent reproduction runs the actual source-derived UI projector against an assessment produced through the real native analyzer flow; all answer values now survive. Inspected browser test additions assert all nine normalized answers and actual downloaded zero/null fields, and clearly identify their transport as mocked. The provided repaired browser evidence was inspected, not represented as an independent browser rerun.

4. **Original routing provenance — repaired.** The backend keeps the validated native `routingReceipt` result and projects actual original `policyId`, `attemptId` and nullable explicit provenance (`policyVersion`, `requestedModel`, `resolvedModel`). The validator and browser allowlist agree. No-attempt operations preserve null attempt/provenance; policy ID stays whatever the original operation saved. Native tests check default-OFF and human-choice nulls, pending pre-attempt nulls, funded original receipt values and persistence after current policy selection changes. Result/fallback status remains independent of this provenance projection. The original funded-model reproduction passes. No credentials, fingerprints or command/semantic keys were added to the wire.

## Independent checks run

- `node node_modules/vitest/vitest.mjs run --root /tmp/task33-spec-harness regression.test.ts` — **5/5 PASS**, 1.25 seconds. These are the unchanged original independent failing reproductions, including the actual source-derived download projector.
- `node node_modules/vitest/vitest.mjs run convex/operations/exportIntelligence.test.ts convex/ai/jev/analyzePost.test.ts` — **47/47 PASS** (43 archive + 4 existing analyzer), 2.57 seconds.
- `node /tmp/task33-spec-harness/analyzer-parity.cjs` — **entire analyzer access file AST parity PASS**, after only the approved export/helper/caller rename.
- `node /tmp/task33-spec-harness/parity.cjs` — **13 extracted fixture declarations and all remaining original routing/verification/profile-update test statements retain baseline AST parity**. Only exports and the necessary dynamic import relocation differ.
- Freeze SHA-256 check — **17/17 PASS before and after review**.

The original SPEC review's structural checks remain applicable: fifteen semantic families, five safe actor-prefix indexes, current auth/session/workspace gates, native single-candidate creation-bound pagination, common source-proof context, exact composite/verifier ownership, narrow retained native proof seams, public historical profile/update handling, explicit allowlists, whole-envelope numeric/byte failure, and existing mounted archive lifetime/correlation guards. Unchanged frozen paths have unchanged hashes. No new actionable SPEC regression was found in the four repairs or approved analyzer seam.

## Limits

Did not deploy, rerun the full browser harness, or run the long style/baseline stress suite. The writer's broader test/build/browser claims are distinct from the independent checks above. This PASS authorizes progression to QUALITY review, not Backlog closure, user acceptance, or deployment.
