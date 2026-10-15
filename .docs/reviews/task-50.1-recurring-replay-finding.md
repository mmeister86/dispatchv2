# TASK-50.1 narrow full-native recurring investigation — NEEDS_WORK / STOP

The unchanged focused recurring suite reproduces the exact three failures from the root full-native run: **35 PASS / 3 FAIL, EXIT 1**. This is a production replay regression, not an obsolete assertion. No repair was made. The prior affected 290/7 and independent QUALITY PASS certificates remain immutable certificates of their stated scopes; they do not certify this failing full suite.

## Concrete trigger and cause

`convex/planning/recurring.test.ts:418` replays two accepted native selections after real series disable and scheduled physical cleanup. The two parameterized tests at `:1626` replay an accepted selection after a real alternative style selection, through either recurring sweep or fire-replay, and physical cleanup. All three throw `REVIEW_SOURCE_UNAVAILABLE` at the newly added `convex/planning/accept.ts:102`, specifically `item.sourceUnavailable`.

`recurring.scrubPlan:60–105` fences proposal presentation and clears plan semantic state and bindings; it also marks every plan item sourceUnavailable. These operations leave the accepted approval/schedule parents unchanged. The new accepted replay branch confuses this proposal fencing with unreadability of the actual retained exact draft source. Its subsequent `seriesPlanProof(ctx, plan, false)` independently rejects the same scenarios: that helper still requires `!plan.sourceUnavailable`, plan.semantic and exact unsrubbed semanticPlanBindings, even with current=false. Removing only the first check would therefore leave another rejection (`SERIES_VERSION_CHANGED`).

The adopted contract at `.docs/team-review-continuation-contract.md:33`, final47/49 seams at `:52` and final49 preparation at `:14` require original readable exact IDs/current caller/scope/source, without current-series/fresh-plan admission or effect reactivation. Original recurring assertions enforce that contract and must remain.

## Actual retained proof, existing helper and original horizons

Fresh private diagnostics execute faithful copies of only these three native scenarios against the actual unchanged production functions. They preserve the original early successful replay and all native setup/cleanup. They then assert the observed failure and directly test the existing source helpers. **All three demonstrate:**

- `historicalReviewSource(ctx, exactVersion, original item/approval/schedule horizons)` succeeds after cleanup; actual draft root/version/source/account remain readable.
- Existing `seriesVersionProof(ctx, originalSeries, originalVersion, false)` succeeds. It retains original series actor/membership identity and account/connection authority, immutable version fingerprint/config, original style version/selection receipt/current eligible selector and original complete native candidate/history frame. Its underlying `scopedStyleProof(..., false)` accepts a later current selection without recapturing the original selection, but still proves retained original source. Unknown/capacity errors are not caught by these diagnostics as source loss.
- `seriesPlanProof(..., false)` throws `SERIES_VERSION_CHANGED` on the erased proposal layer.
- Exact replay itself still throws `REVIEW_SOURCE_UNAVAILABLE`; diagnostic PASS proves this defect state, not repaired behavior.

After scrub, original `plan.series` still retains seriesId/versionId/generation/index/at/key/sourceUntil. Item retains versionId/draftId/account/timing/revision, accepted IDs/actor/mode and original **proofUntil, validityUntil, contextProofUntil**. Approval/schedule reviewPin.sourceUntil and planningSeriesVersions.sourceUntil remain original. In each failing fixture, now=1791277200000; item proofUntil=validityUntil=plan.series.sourceUntil=original version.sourceUntil=1793865585000; approval/schedule reviewPin.sourceUntil=1793865600000; contextProofUntil=null. Exact/native retained proof returns 1793865585000, preserving the earlier original minimum. `item.historyVersionIds=[]` was originally empty in these first occurrences.

A minimal correction should validate retained exact native source and original-series proof rather than requiring the discarded proposal presentation. Preserve every exact actor/scope/ID/timing check, original horizons, native budget and terminal effect behavior. No generic bypass or horizon recapture is justified.

## Consumed contextual history must remain explicit

`scrubPlan` also erases item.sources/families/rootEvidenceIds/historyVersionIds. A separate actual native second-occurrence control first accepts a real earlier schedule, proves that a new plan consumed its exact version in historyVersionIds, accepts the second item, disables and drains cleanup. The original nonempty historyVersionIds then becomes `[]`, while **contextProofUntil remains 1793865585000**. This is erased dependency metadata, not a newly empty context.

The existing original-series/frame proof covers immutable config candidateVersionIds and the configured native history frame. It does **not** generically reconstruct all separately captured previousTopics/historyVersionIds from erased metadata. In this concrete second-occurrence fixture the consumed version is one of the original candidates, so deleting it after disable makes the frame proof throw SERIES_SOURCE_UNAVAILABLE. That does not establish coverage for arbitrary consumed versions outside those candidates.

A narrow accepted-item-only retention of the original historyVersionIds alongside its already retained contextProofUntil is a concrete candidate for the writer; proposed-item/body scrub must remain. The accepted replay can then prove each actual original historical version with historicalReviewSource and the original context horizon, without reconstructing latest history. Root owns the exact correction and ownership release. Do not silently accept cleared `[]` with non-null contextProofUntil as proof that no original contextual source was consumed.

## Independent negative evidence

On fresh real fixtures after disable/cleanup, actual draft root deletion denies REVIEW_SOURCE_UNAVAILABLE; original series actor root deletion denies SERIES_AUTHORITY_CHANGED; original style version deletion denies STYLE_REFERENCE_ACCESS_DENIED; actual original-series sourceUntil expiry denies SERIES_SOURCE_UNAVAILABLE; actual style sourceUntil expiry denies STYLE_SOURCE_UNAVAILABLE. Actual series/series-version root deletion is detected by the explicit existence guard before calling the existing helper (`MISSING_ORIGINAL_SERIES_ROOT`, a **private diagnostic sentinel**, not a production error code).

For the genuinely consumed prior native draft, after disable: original context horizon expiry by advancing native fixture clock beyond its captured horizon denies REVIEW_SOURCE_UNAVAILABLE; physical consumed-version deletion denies REVIEW_SOURCE_UNAVAILABLE through historicalReviewSource using the original saved version identity. Original native frame then denies SERIES_SOURCE_UNAVAILABLE. These controls never modify production source or invent new grants.

## Commands, receipts and limits

All six actual commands, observed exits, local Vitest starts/durations and SHA256 log hashes are in the adjacent receipt. The unchanged focused 38 suite uses installed Vitest and original timeouts; no timeout flags or test-source edits. Private diagnostics use default 15000ms and preserved original native fixture mechanics. Their modified expectations intentionally observe the regression, not replace the original assertions. The initial incorrect tests/recurring.test.ts path produced no-tests EXIT1 and is preserved separately.

The 328 actual frozen source hashes match fa2a7373bb854d304e087c75ffe49255f6a5fbc9abeb0842bcf85e11b95a1923 at both diagnostic guard captures; HEAD e56ea852854d27319f8b47ee773d656533800dbb. Final guard at 2026-10-07T04:18:53.533480+00:00 also verifies **457 prior evidence hashes**, zero mismatches. Original recurring38 test bytes remain exact. Initial guard was captured after the unchanged focused run and before the private diagnostics; no pre-focused capture is fabricated. No whole-root duplicate, new UI/pixels, codegen/CLI/docs/Backlog/source changes, repair, commit, deploy, dependency/provider/config changes or live IO. Only deliberate reviewer-created files use /tmp/dispatch-quality501-full-recurring-*; unchanged native recurring38 retains its registered original temporary metric sinks, also used by the concurrent root suite. No receipt treats those metric sinks as immutable prior evidence.

**Verdict: NEEDS_WORK / STOP.** Full-suite final disposition belongs to root after its unchanged running command completes. Release requires a narrow source correction and fresh original regression checks, not weakening these assertions.
