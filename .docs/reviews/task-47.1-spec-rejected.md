# TASK-47.1 independent frozen SPEC review — NEEDS WORK

Reviewed baseline HEAD `8fcc9004b958d951ac413f78f463e27c394ae768`, frozen 319-file manifest `/tmp/dispatch-continuation-47.1-freeze.json`, SHA256 `a13e7cc13231f2044a5bcb1ea0c3585ed1d28f8f717f8d5f8629e48f204ad4dc`. All 319 hashes matched before and after review. Reviewer is independent of the writer, preflight and forthcoming QUALITY. Source, API, Backlog and repository docs were not modified; no deployment, provider call, grant, activation or commit was performed. Review ends here; root owns repairs and a new freeze.

Three reproduced findings: one P1 source-withdrawal projection defect and two P2 correctness defects. The normal native denominator aggregation passed an independent registered-function check. The actual browser fixture's inconsistent hardcoded example is not evidence of a native denominator defect.

## P1 — Mask the complete withdrawn experiment at the public projection boundary

`convex/performance/experiments.ts:723–740` decides that any withdrawn assignment makes the whole experiment unreadable, returns `state: "withdrawn"` and `spec: null`, but returns the previously built `units`, `counts` and `arms` unchanged. Rows 696–720 already accumulated still-visible arm labels and outcome numbers.

Concrete native trigger: declare two manual immutable units, start, record an actual accept for unit B, then mark unit A's native draft version source-unavailable. Calling public `performance/experiments:get` before physical scrub correctly returns withdrawn/spec=null, but also returns unit B's `arm: "B"`, `outcome: "accept"`, global accept=1/decided=1, and arm B accept=1. Exact captured response: `/tmp/dispatch-spec47/withdrawn-detail.json`.

Why this violates the current contract: the implementation's `scrub()` transitions the entire experiment to source-unavailable, removes its human specification and schedules `purgeExperiment` to remove every sibling arm and protected binding. The public projection already declares this same whole-experiment loss, yet delays masking those derivatives until cleanup. The UI happens to hide results when spec=null; callers of the public query can still retrieve them. The contract requires immediate masking before consumers, independently of physical cleanup. Historical assignment/version/reviewer IDs and enrolled/withdrawn skeleton counts may remain; the finding does not require deleting those audit parents or unrelated ordinary feedback.

Suggestion: apply the same whole-experiment masking decision to returned arm/outcome/edit projections and derived aggregates. Keep genuinely unavailable units distinct from fabricated zero observations and preserve the minimal allowed skeleton. This is not a demand to erase unrelated ordinary approvals, schedules or finances.

Unchanged RED test: `independent: globally withdrawn experiment masks every arm and numeric derivative` in `/tmp/dispatch-spec47/editorial-repro.test.ts`.

## P2 — Reject replay receipts whose experiment root no longer exists

`convex/performance/experiments.ts:316–342` loads the old receipt's root but runs authority/assignment proof only inside `if (e)`. When the root is missing, `if (old)` still returns the successful original receipt.

Concrete native trigger: declare, delete that exact `editorialExperiments` root through the native test database while its receipt remains, replay the unchanged original declaration arguments/key. Public `performance/experiments:change` resolves with the old experimentId, receiptId and revision instead of rejecting current source loss.

The defect is specifically a missing-root replay boundary. Valid retained stopped/ended roots with current proof should continue replaying historical receipts, and replay must not reactivate them. Merely retaining historical IDs in unavailable skeletons is permitted. This replay emits no new provider call or approval, but falsely acknowledges a command without its required current root/source/authority proof. Root-gone cleanup is an explicit lifecycle boundary, not a request to implement whole TASK-33 erasure now.

Suggestion: require the receipt's existing, currently provable experiment root before returning its protected success receipt; preserve accepted terminal-root replay behavior.

Unchanged RED test: `independent: exact replay must reprove root existence` in `/tmp/dispatch-spec47/editorial-repro.test.ts`.

## P2 — Apply the declared observation window before its bounded event ceiling

`convex/performance/experiments.ts:577–599` queries all sequences after start through stopSequence, or MAX_SAFE_INTEGER when not explicitly stopped, takes 129 and rejects overflow before excluding timestamps at/after endsAt.

Concrete native trigger: declare two manual units, start, record one actual in-window accept, advance the native clock to endsAt+1, record 128 more ordinary native accepts for the same immutable version/reviewer, then get the ended experiment. All 128 later rows should be outside `[startsAt, endsAt)`, but `get` throws `EXPERIMENT_RESOURCE_CEILING`. An immutable ended observation with only one eligible event becomes unreadable because ordinary later work accumulates. `sweep` uses the same observations helper and likewise cannot finish that proof check.

Suggestion: use the exact eligible timestamp/sequence window when bounding the native corpus; maintain bounded reads, real overflow errors for genuinely over-cap in-window evidence, exact same-millisecond start/stop sequence semantics, explicit missingness and no observation early-stop based on decided sample counts. Do not raise native budgets or silently cherry-pick the first 128 eligible events.

Unchanged RED test: `independent: ended observation ignores later ordinary repeated feedback before its cap check` in `/tmp/dispatch-spec47/editorial-repro.test.ts`. This reproduction uses 129 real public feedback decisions, not fabricated event rows.

## Executed checks and inspected behavior

- Source hash guard before/after: 319 unchanged; final receipt `/tmp/dispatch-spec47/final-source-receipt.json`.
- `node node_modules/vitest/vitest.mjs run --config /tmp/dispatch-spec47/vitest.config.mjs`: actual Vitest exit1, three unchanged RED cases and one independent positive denominator case; two files. `/tmp/dispatch-spec47/independent.log`, durable `/tmp/dispatch-spec47/receipt.json`. Earlier exploratory executions of the same REDs also failed; their shell wrapper printed logs after Vitest and therefore had outer shell exit0. The durable receipt records the real Vitest exit1.
- Independent positive case `/tmp/dispatch-spec47/denominators.test.ts`: four actual native immutable units, repeated accept plus contradictory reject, a B reject, a B accept and a native same-text save. Global counts exactly enrolled4/decided2/accept1/reject1/conflict1/noFeedback1; A conflict1/noFeedback1 and B accept1/reject1; actual measured edit extent0 remains zero with editCount1 and missingEdits0. Captured `/tmp/dispatch-spec47/native-denominators.json`.
- `node node_modules/vitest/vitest.mjs run convex/performance/experiments.test.ts tests/editorial.test.ts convex/content/similarity.test.ts`: PASS75 tests/3 files, exit0,3.87s. `/tmp/dispatch-spec47/registered-0.log`.
- `node node_modules/vitest/vitest.mjs run convex/planning/recurring.test.ts -t experiment`: PASS5,33 original skipped/38 total, exit0,5.47s. `/tmp/dispatch-spec47/registered-1.log`. These exercise the genuine native multi-approval sequence caller, retained style versus consumed plan scrub and draft-only independence, root-gone indexed cleanup beyond one page, actual second weekly consumed draft context, and the 32-unit shared125-vector frame.
- Earlier focused registered selection across experiment and recurring modules: PASS34,39 skipped/73 total, exit0,5.57s; `/tmp/dispatch-spec47/focused.log`. This overlaps the later complete experiment and five recurring cases and is not additional unique coverage.
- Durable registered command/exit receipts `/tmp/dispatch-spec47/registered-receipts.json`.

Read the authoritative contract including immutable enrollment-cap clarification, full source-ready handoff, full experiment fields/functions/projection/purge/sweep implementation, feedback evidence/record/cleanup, MaterialWalk/source-loss handling, changed style/recurring/series/frame proof seams, schema/crons, real experiment component/Explore/App route gate and actual styled browser harness. Traced actual `feedback.record` callers through native save/approval and selective planning acceptance; default `seriesPlanProof` callers retain current=true, experiment calls explicitly use retained current=false. Shared frame ancestor Set is reused in transaction context, remaining budget is recomputed after the frame, cached series/frame proof is transaction-local, and exact per-plan/reverse binding proof still runs. No evidence found of a new publishing/generation/funding store or experiment-side provider request.

Native mixed32/aggregate32 and shared125-frame checks passed at unchanged4096 queries/16MiB/32000 documents. Qualifications from the handoff remain essential: mixed32 shares30 recursive ancestors; shared-frame32 uses two eligible GitHub versions across16 synthetic Editor memberships, not32 independent empirical samples. No arbitrary unshared maximum payload or empirical validity claim. The original900000ms allowances and baseline tests were not changed.

The real UI uses keyed workspace/account identity, current role epoch and unmount fences, captured original args/key on uncertain retry, explicit CAS recovery, source/end clocks, empty human declarations and native-vs-Demo split. UI source and existing harness were inspected; this reviewer did not independently rerun browser/static/build/full-native/deploy gates. Root's static/pixel checks and writer's browser evidence remain separately attributed. Native aggregation is verified above rather than inferred from the hardcoded fixture. No library documentation or unrelated future47.2/33/36 requirement was introduced.

## Acceptance limit

NEEDS WORK. Existing focused tests passing do not override the three independent RED regressions. Preserve these repros unchanged for the corrected freeze, add native regression coverage at the shared boundaries, then perform fresh SPEC and distinct QUALITY/full-root gates. The writer's stopped broad run is INCOMPLETE and never PASS; expected1023/51 was arithmetic only. Manual/empirical/provider acceptance and Backlog Done remain open. Reviewer has stopped all work.
