# Task 33.1 / unit 4B1 — final independent SPEC re-review

Verdict: ✅ SPEC PASS for the reviewed nine-file implementation. The original grant/fingerprint findings and the valid mixed-owner finding are repaired. Proceed to the separate QUALITY review; this is not a QUALITY or deployment certification.

Frozen aggregate: `061a008fbcc83bfd9fb924793a759d620b735b4f78ac96dd8a03778ebea84033`. All nine hashes matched at the start and at the end of this review. Only `/tmp` reproduction/report artifacts were written; repository source, Git, Backlog and deployment remained read-only.

## Independent evidence

- Original independent duplicate-metric-grants and expired-corrupt-experiment reproductions both pass.
- Original valid independent mixed metric owner reproduction passes.
- Two corrected independent history cases pass, one for each of `historyPosts` and `historyJobs`. Their fixture imports a real first page via native backfill, verifies the positive archive result, begins native second-page funded I/O, asserts a real non-null active receipt is present, verifies the positive archive result again, then patches only `logicalIntent`. Both live and expired source cases reject with `REFERENCE_ACCESS_DENIED`.
- All five independent cases pass in 2.50 s: `/tmp/task33-spec-final-repro.test.ts`, config `/tmp/task33-spec-final-vitest.config.mjs`, output `/tmp/task33-spec-final-repro.log`. Command: `./node_modules/.bin/vitest run --config /tmp/task33-spec-final-vitest.config.mjs -t 'SPEC REPRO'`.
- Independently reran the complete submitted measurement archive suite: 27 tests pass in 5.90 s, output `/tmp/task33-spec-final-tests.log`. Command: `./node_modules/.bin/vitest run convex/operations/exportMeasurements.test.ts`.

## Source verification

`historyReceiptReferences` now checks the actual native history receipt owner exclusions (`runId`, `researchOrderId`, `logicalIntent` all absent), exact job/policy/scope/fingerprint, valid original generation, page range and active-page agreement, original policy version/currency/rate/max-results/reservation, and exactly three distinct ordered grants with their keys/scope/currency/workspace/account bindings. Both history post and history job branches call this preflight. It preserves the approved older-receipt-generation case from native pause/resume/cancel and does not invent a receipt when the native job has none. Compared directly with the structural predicates in `performance/history.ts`'s `finish`.

The metric preflight now includes the same native owner exclusions in addition to the previously repaired exact three-grant binding and policy currency/rate/reservation checks. Compared directly with `performance/snapshots.ts`'s `finish`. These checks execute before live/expired/unavailable material handling.

Candidate structural validation retains the original experiment policy/spec/purpose fingerprint repair and original neighboring specification/snapshot/purpose bindings before direct expiry/source loss. Live protected projections still use the existing native retained helper, so its graph/resource/capacity failures propagate.

The remaining seven frozen paths are unchanged from the initial review. Initial verification of all eight fixed selectors, account/session/role scope, native numItems=1 creation-bound pagination, wire numeric/64-KiB checks, native-shaped allowlists and original null/absence preservation remains applicable. Exact source parity of the two relocated fixture bodies and pre-existing test statements remains applicable; the native helpers are still only exported/aliased as authorized.

## Correction to the previous re-review report

My prior report `/tmp/task33-measurement-history-spec-repaired.md` incorrectly described all three mixed-owner cases as export promises resolving. The two history cases were invalid reproductions: `imported()` had completed native settlement and cleared `job.attemptId`, so they failed at `db.patch(null)` before calling export. This is visible at lines 114–126 of `/tmp/task33-spec-repaired-mixed.log`. I withdraw those two historical runtime claims. The original metric mixed-owner case was valid, and source inspection independently showed the missing history owner exclusions. The corrected active-history cases above now provide valid runtime coverage of the repaired implementation. The original shared `/tmp` harness was left untouched during this final round; corrected tests live in a separate file.

## Limits

No broad baseline, six-suite regression rerun, browser rerun, build/type rerun or deployment was performed by this reviewer in the final round. Earlier browser evidence is still mocked full-app/native-shaped JSON coverage, not native Convex proof. The final independent native tests and source inspection support SPEC PASS; the separate QUALITY gate remains outstanding.
