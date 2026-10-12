# Task 33.1 / unit 4B1 — independent SPEC re-review

Verdict: ❌ NOT SPEC COMPLIANT — the two original P1 findings are repaired, but one adjacent explicit mixed-union binding requirement remains violated. Do not start QUALITY yet.

Reviewed frozen aggregate `eea6b0c98925ddcf67d8d386834d5983380ac3c2da3f6f2734a01ff760befaab`. All nine manifest hashes match at both start and finish. Read-only repository/Git/Backlog/deployment; only `/tmp` reproduction artifacts were written.

## Original findings resolved

- Original metric grants now require exactly three distinct ordered IDs with original key/scope/currency and workspace/account binding, plus receipt-policy currency and rate agreement (`exportIntelligence.ts:1203–1232`). Validation precedes material-loss handling.
- Candidate preflight now checks the original experiment policy/spec/purpose fingerprints and adjacent original specification/snapshot/purpose links before expiry/source-loss handling (`exportIntelligence.ts:1319–1405`). No native retained-helper behavior changed.
- Both original independent reproductions pass against this freeze: `/tmp/task33-spec-repaired-repro.log` (2 passed, 2.48 s).
- All 20 submitted focused native cases pass: `/tmp/task33-spec-repaired-tests.log` (20 passed, 5.91 s).

## P1 — Reject mixed native receipt ownership before exporting history or metrics

Exact repair points in `convex/operations/exportIntelligence.ts`:

- `historyReferences` original history receipt binding at **1136–1144**;
- `snapshotReferences` original metric receipt binding at **1198–1202**;
- `historyJobs` original history receipt binding at **1573–1581**.

These checks require `owner === "own-history"` or `owner === "own-metrics"`, but accept the optional `runId`, `researchOrderId`, and `logicalIntent` ownership fields. Those fields are admitted by the shared storage validator but explicitly forbidden by the native receipt owner checks: `performance/history.ts:504–512` and `performance/snapshots.ts:241–249`. Thus the export accepts a mixed receipt union the original native graph rejects, contrary to the requested whole-page rejection of mixed/union corruption.

Independent reproduction uses the real producer fixtures already reviewed. For metrics: native first send, confirmation and collection produce the observed snapshot and settled receipt; patch only the real receipt's `logicalIntent` to `"foreign-owner-intent"`; export `performanceSnapshots`. It succeeds and exports retained measured values. For history: native backfill imports 75 posts; patch only the real job receipt's `logicalIntent` likewise; each of `historyPosts` and `historyJobs` succeeds. Expected in every case: query rejection before any successful wire result.

Evidence: `/tmp/task33-spec-repro.test.ts` now contains three `SPEC REPRO mixed` cases. Run `./node_modules/.bin/vitest run --config /tmp/task33-spec-vitest.config.mjs -t 'SPEC REPRO mixed'`. All three expected-rejection assertions fail because promises resolve; `/tmp/task33-spec-repaired-mixed.log` (3 failed, 1.30 s). Only corruption was patched after genuine native production.

Minimum repair: require all three fields to be `undefined` alongside the original owner discriminator in the three archive receipt preflights, mirroring native owner checks. Add focused field-by-field regression coverage with live and unavailable/expired rows. Preserve native helpers, receipt producers, UI, and the existing valid metadata export path. This adjacent omission was missed in my initial review; it is a concrete existing contract failure, not a new requested feature.

## Scope and remaining verification

The revised changes are limited to the two owned export/test files. The prior exact-source fixture-parity result, helper-only models exports, eight-family UI projection review and unchanged schema/UI findings remain applicable. No broad baseline, browser rerun, deployment, type/build rerun or QUALITY assessment was performed in this re-review. The three demonstrated acceptance paths block SPEC approval independently of those broader gates.
