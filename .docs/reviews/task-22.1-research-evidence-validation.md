# TASK-22.1 source-bound evidence validation

Baseline `0a5533c1f0133802722904d283e7cfb31aa75e2f`; implementation checkpoint `49a9b9971e95f4e39629261e407dc10df83436bd`, exactly thirteen authorized source/contract/test paths. Intervening ROOT commits contain the concrete D08 human-review decision and official codegen semantics only. Independent SPEC is active; QUALITY and code acceptance remain pending.

The [evidence contract](../research-evidence-contract.md) describes manual source-bound annotations and immutable human review for `research-context`. Exact quotes establish provenance, not truth. Current actual material, delivery graph, actor rights and finite source/statement horizons determine visibility and eligibility. Metadata-only sources, unknown freshness and uncorroborated consequential claims remain Review. This unit does not implement the full Research workflow, Inbox handoff or funded source generation.

## Implementer checks and preserved initial failures

The existing native fixture had77 cases. At23:03:55 on2026-10-05, the first90-case run produced88 PASS/2 RED. One was a real integration defect: source invalidation only scheduled copy cleanup, leaving copied annotations and assessment text in the immediate inventory. The fix performs a bounded synchronous first batch in the shared cleanup path. The other was a fixture mistake: it supplied the public minimum proof horizon to a source expiry CAS requiring the raw stored source expiry; the existing CAS correctly did nothing. The corrected fixture reads the stored expiry/generation.90/90 passed23:04:25. Original tool transcript retains these results; no initial test-log file was created.

Progression:93 cases passed23:06:54 and23:09:02;95 passed23:10:05, then after actual scheduled-continuation strengthening23:11:20 and final copy-field erasure assertions23:16:07. Full493 cases/27 files passed23:10:17 and23:15:40. Counts overlap and are not summed as independent coverage. The cleanup stress fixture injects106 records beyond the manual per-order100 ceiling: the actual invalidation clears100, then the actual scheduled continuation clears the remaining6. A separate old-material continuation preserves a new-material copy.

Implementer reports typecheck, full lint, build, bundle exclusion and diff checks PASS, plus an actual ResearchPage browser fixture using synthetic hooks/providers. Browser cases cover create, frozen retry after lost acknowledgement, human review, shorter validity while idle, changed-material form reset and source deadline. This is actual UI behavior, not a real Convex/provider round trip. User Vite5173PID48521 was preserved and owned5174 closed.

Two initial browser failures were harness errors: the fixture attempted editing while the existing failed-command freeze correctly disabled controls, and an unscoped status locator matched both action confirmation and material-change notice. The corrected fixture verifies disabled controls/exact retry and scopes the material-change text. Final PASS remains in the tool transcript; no saved browser stdout log or reliable embedded timestamp is claimed.

Official codegen passed23:16:31 and existing EU Dev reported functions ready23:17:15, after local checks. Logs: `/tmp/dispatch-task22.1-codegen-final.log` and `/tmp/dispatch-task22.1-dev-final.log`. Post-generation typecheck/diff checks passed. No provider/model call, policy/grant activation, configuration or data seeding is claimed. Codegen analysis does not itself change running deployment code; Dev sync does.

## Acceptance boundary

Fresh independent SPEC must inspect the actual full source and run meaningful own negatives. Fresh independent QUALITY starts only after current SPEC passes; findings return to the original implementer, then the same SPEC reviewer checks the delta. AC remain unchecked at this checkpoint. Backlog stays In Progress until explicit human confirmation after manual testing. Live source rights, processing, provider protocol, pricing, retention and manual acceptance remain separate gates; existing prepared schedules remain inert.
