# TASK-32.5 final distinct code QUALITY review — PASS

## Scope and integrity

Read-only final review on HEAD9566961c7a3d255eed15c94aeb93f5dc26b058b3 with freeze3 `/tmp/dispatch-32.5-root-freeze3.json`, exact source release `.docs/reviews/task-32.5-research-summary-source-release.md`, task record, SPEC3 `/tmp/dispatch-32.5-spec3.md`, prior full QUALITY2 and the repaired actual code/tests/browser assertions. Freeze2→3 changes only preferences.ts, summaries.test.ts, operations.browser.mjs. Prior full eleven-path quality/security/lifecycle assessment remains applicable to unchanged code. No reviewer repository/index/HEAD/task/docs/codegen/provider/deploy changes. All356 frozen source/config hashes, five generated files included, HEAD and human.zcodeignore matched before/after; final receipt `/tmp/dispatch-32.5-quality-hash-after3.json`.

## Strengths

- The small repair uses the existing release mutation and existing quietWindow. Outside quiet, availableAt remains immediate while the release job schedules the next actual quiet boundary; at that captured callback, current quiet is rechecked and the same mutation schedules the actual end. This produces real preference-root database transitions to invalidate subscribed query projections, rather than letting a browser renew source proof itself (`convex/preferences.ts:457–481`).
- Every release first verifies retained original entry, current opt-ins, actor/workspace/account/profile/version/generation and source proofs. A stale epoch returns without touching replacement jobs. Pending jobs are cancelled using native state inspection, with unexpected errors propagating. Future jobs are strictly before original immutable deadline. Original finishedAt/sourceUntil/deadline/expiryJob are preserved.
- Native control covers outside quiet→boundary→end with actual captured registered-job arguments, genuine finish and live fixture authority. The next interval and DST skipped start/end/later repeated end remain covered. Original expiry before quiet end removes the reference rather than keeping an unusable notice.
- The browser addition keeps the house clock/command behavior: expired cached proof hides, exact correlated fresh server projection restores the same original after end, and a late old dismissal response cannot clear the replacement in-flight command. No production UI expansion was necessary.
- Source binding, material outcome classification, same-transaction replay fencing, actor/orphan cleanup pagination, bounded five-entry metadata, old preference/export contracts, and separate mandatory notice families retain the strengths documented in QUALITY2. No new dependency/table/registry/transport/provider activation or generated changes.

## Issues

### Critical (Must Fix)
None found.

### Important (Should Fix)
None remaining in the exact released unit. QUALITY2's missing quiet-end wake is repaired by the intermediate start-boundary callback and end callback topology.

### Minor (Nice to Have)
No actionable minor issue. Do not expand the patch for stylistic cleanup.

## Independent executed controls

All commands used installed local Vitest, actual registered functions, and no provider network IO. These were independently executed for QUALITY3 rather than accepting SPEC results:

1. `./node_modules/.bin/vitest run --config /tmp/dispatch-32.5-quality-transition-controls.config.mjs --testTimeout 15000`
   - **2 passed**; log `/tmp/dispatch-32.5-quality-transition-green3.log`.
   - Corrected runner executes actual captured start job before inspecting the end job, then executes actual captured end job and confirms presentation. Malformed observed NaN/Infinity/-Infinity/unsafe integer clocks remain harmless no-op against validated original clocks.
2. `./node_modules/.bin/vitest run --config /tmp/dispatch-32.5-spec-current-horizon-released3.config.mjs --testTimeout 15000`
   - **1 passed**; log `/tmp/dispatch-32.5-quality-current-horizon-green3.log`.
   - Genuine original admission19:59, grant shortened after admission to20:30; boundary callback schedules21:00 within original deadline; actual later callback rechecks expired source, returns no public notice and physically removes protected reference. A scheduled wake is not future source authority. Exact release bounds future job time by immutable original deadline; no separate current-proof future-time bound is required.
3. `./node_modules/.bin/vitest run --config /tmp/dispatch-32.5-spec-vitest.config.mjs --testTimeout 15000`
   - **1 passed**; log `/tmp/dispatch-32.5-quality-adversarial-green3.log`.
   - Unchanged independent positive-native delivered-source/cache-loss and partial-classification control remains green.
4. `./node_modules/.bin/vitest run convex/research/summaries.test.ts -t 'native pre-quiet|native during-quiet|quiet boundary drops|quiet-end native|quiet revision cancels' --testTimeout 15000`
   - **9 passed,20 skipped (29 total)**; log `/tmp/dispatch-32.5-quality-quiet-focused3.log`.
   - Prequiet actual boundary/end, during quiet, repeated/missing DST endpoints, skipped start boundary, original source deadline before end, next interval bounded by frozen deadline, cancellation/revision/stale epoch.

The original RED `/tmp/dispatch-32.5-quality-controls.test.ts` and `.log` are byte-identical before/after this review (SHA256 control `5a8a25d14137737e8d683672303cf4c2f7658945e042e841c5e5aff6853511e7`; log `e70144577610d7680256746cebe00e08f0e2185695147ce295db57dd03080e53`). They are preserved historical evidence, not relabeled green. That runner advances the clock across the new boundary without executing its registered callback; its direct-end-job assertion is no longer a correct test of the repaired two-step topology. The corrected separate runner supplies the necessary callback and verifies actual recovery.

## Recommendations

No further source change needed for this review. Continue Root's separate broad/static/browser gates, actual personal-metadata inventory addendum and exact existing EUDev sync. Keep the report's evidence limits explicit and manual Done open; no profile/shared-version export claim should silently include added personal metadata.

## Declined to judge

- Declined to judge hosted EUDev scheduler retry/cancellation and real subscription delivery timing: these controls inspect native fixture job records and invoke actual captured registered callbacks; they do not deploy or run hosted subscriptions. Root's Dev step remains independent.
- Declined to certify full native/static/build/bundle/browser gates from this narrow re-review: Root runs those; no duplicate full suite. Actual browser additions were read, with previous mobile success image directly inspected in QUALITY2. No claim of screen-reader certification.
- Declined to judge full33 export/erasure/legal provider-backup retention: outside exact release; added personal metadata remains beyond unchanged profile/shared export, inventory addendum pending Root, parent33 open.
- Declined to claim new real-model positive evidence provider integration or universal recursive graph resource guarantees: new pipeline test is actual registered empty pipeline, positive material source controls use provider mocks; ancestry/resource propagation controls are injected errors and existing walks have independent bounds.
- Declined to impose a separate future current-proof-time scheduling restriction absent the exact release. Current shortened authority is checked before every display/callback/mutation and scrubbed through the existing proof worker/original horizon; the independently executed shortened-grant control confirms this safety behavior.

## Assessment

**Ready to merge? Yes for the reviewed source unit, subject to Root's remaining broad gates, inventory addendum and exact existing EUDev verification — PASS.**

The quiet repair is minimal and complete: native start/end transitions restore eligible original notices without renewing age or manufacturing browser authority. No remaining actionable correctness, security, lifecycle, preservation, type, resource-bound or rollback defect was found in the defined implementation; manual task Done remains user-controlled.
