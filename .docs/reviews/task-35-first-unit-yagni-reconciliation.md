# TASK-35 — first native Pilot consumer reconciliation

READONLY SOURCE ANALYSIS / NOT RELEASED. No implementation, tests, provider calls, acceptance or Backlog changes. Reconciles the existing TASK-35 source plan and operations/notifications contract with accepted 68.3/31.1/32.1/32.2. Observed docs HEAD: 283d3612b15a30755a5f89727f5844b314f19c89; accepted backend source supplied by Root: 008b1c9, metadata 456. Export writer 33.1.1 is active: no claim of a global frozen source tree. Its Settings/browser/export work was neither edited nor reviewed here.

## Recommended first unit

Mount a small **descriptive measured account sample** in the Cloud Operations Pilot tab. Use original retained Own Metrics receipts; do not call it a whole-pilot result. Initially show measured impressions and their actual sample size for one fixed 24-hour observation window, separated by existing compatible post/thread/media/definition/dialect cohorts. No experiment enrollment, human intake, cost allocation or new producer is needed for this useful consumer.

Cloud currently has only the explicit unavailable paragraph (`src/pages/Operations.tsx:69–96`). The seeded `DemoPilotPanel` remains a separate Demo branch. This is a new native consumer, not correction of previously mounted fake Cloud pilot results.

A tiny Owner/Admin query projection is justified because existing overview returns full posts, assessments, snapshots and topic segmentation. Do not expose that rich DTO through a new summary endpoint merely to discard its fields in JSX. Call the already exported `readOverview` directly in the same QueryCtx and map only the finite numeric projection. No registered query-to-query call, new index, table, event bus, opt-in, ledger, registry, observer or metrics provider activation.

## Exact existing seams

- `convex/lib/authorization.ts:18–80`: `requireUser`, `requireWorkspace`, `requireRole`, `requireReference`, `workspaceQuery`. The new wrapper should require Owner/Admin before domain reads; active workspace/current membership and exact account reference precede the sample. UI role hiding alone is not backend authority.
- `convex/performance/snapshots.ts:454–507`: existing `overview` wrapper/validator; `readOverview` is exported at 510 and ends at 761. It reads existing native receipts without actions or provider requests. Its current caller is `src/features/analytics/OwnMetrics.tsx` (history and filtered queries).
- `readOverview:540–552` selects latest **20 confirmed post attempts**, in descending native index order, before date/window/format filtering. This is not a confirmation-time-complete scan, enrolled cohort or tenant history.
- `readOverview:577–593,656–672`: current source proof separately controls assessment/topic; those fields need not enter Pilot. `retainedSnapshotHorizon` is already exported at 807; overview uses it at 666 to admit independently authorized numeric snapshots with current minimum expiry.
- `convex/performance/baselines.ts:146–231`: exported `describe` groups compatible immutable snapshot definitions/dialect/window/media and schedule units; complete thread coverage requires all original positions and matching version. Invalid/incomplete/missing numeric values remain null.
- `baselines.ts:265–285`: each metric has its own known-value `n`, safe integer sum and nullable mean. Use **impressions.n**, not cohort.n/attempted as its denominator. Thread sum is one schedule unit when complete; constituent positions are not separate complete publications.
- `baselines.ts:286–344`: rates already use matched numerator and impression denominator from the same compatible units; zero/missing denominator is null. These can be a later small display extension, not a new calculation engine.
- `src/features/analytics/Baselines.tsx:6` is an existing presentation reference, but its full component also renders topic labels/segments and unit details. Do not mount the whole rich component or `OwnMetrics`, which includes consent/removal/provider-related controls and feedback/history.
- `src/features/operations/health.tsx:114–224` supplies the existing nativeScope keyed component/account/explicit refresh/error/expiry pattern. `src/lib/store.tsx:811` already builds session/workspace/account/role scope. Reuse the pattern, not its health DTO or financial facade; no new store field or parsing scope strings.

## Narrow finite response and truthful coverage

Return selected account ID, native observedAt, fixed observation-window hours, definition marker, minimum emitted proof expiry, and at most the existing bounded cohort aggregates: finite unit/media codes, definition/dialect identity, impressions known n/sum/mean and allowlisted numeric missing reasons. Omit posts, external/provider IDs, assessments, topic/hour segments, chart/units, content, free feedback, email, raw provider errors and policy configuration. No recovery link is necessary for this first aggregate-only panel; ordinary Analytics navigation suffices.

Always label coverage **partial: retained measurable units discovered within latest 20 confirmed attempts**. The native candidate window precedes source eligibility and time filtering. Therefore omit nativeAttemptCount/postsWithoutSnapshots and any hidden/withdrawn total, hasMore, omitted-row count, success percentage, complete denominator or cap+1 assertion. Unknown remainder stays unknown. Existing cohort missing reasons describe retained numeric receipts; they must not become counts of inaccessible source parents.

The fixed 24-hour value is the requested metric observation age, not a rolling previous-day pilot interval. Baseline cohort from/to describe observed provider-created times, not proof that every publication in that interval was covered. No invented pilot admission/window or whole-history first result. UI hides the displayed sample at its native proof deadline even without another request, and clears/rekeys on current account/session/workspace/role changes. Cached prior-scope data must not survive selection changes. Unavailable/empty is not a known zero. A measured zero with valid current numeric proof is a real zero.

`readOverview` is finite at 20 candidate attempts and five predefined snapshot-window lookups per candidate, but also walks receipt/source/media dependencies. This preflight does **not** certify a new total transaction read/document/byte budget. Release must either establish a finite bound from those existing validators or return unavailable on a small concrete same-snapshot guard; do not copy Health's generic 128/512 facade or advertise its budgets for this consumer. Mapping after the same QueryCtx read preserves the existing current numeric rights proof; it cannot justify added private chat/Research counters.

## Accepted work does not fill absent Pilot facts

- 31.1 Health `convex/operations/health.ts:397` is an operational bounded family receipt projection. Its windows, family counts and financial samples are **not whole-pilot populations or expenses**. Explicitly exclude it as the Pilot aggregator.
- 68.3 composite receipts now bind generation/first verifier/one repair/final verifier to original actors and finance. That does not establish cohort allocation or usefulness. Booked evidence, held unknown exposure and late rehold retain their native distinctions and original currency. No composite/provider/workspace/account counter triple sum.
- 32.2 failure episodes dedupe original schedule/generation/recipient and preserve legacy uncertainty/late ACK. A notification episode is neither a publication denominator nor usefulness/delivery/read proof. 32.1's unavailable optional channels remain unavailable; this panel must not activate them.
- `convex/content/feedback.ts:177–226` exports `decide` and `list`, but approval also creates accept receipts. Accept is not an explicit useful decision. Edit extent is not editing duration. Do not count these as useful or saved time.
- Original performance policy `unitMicros/currency` is a configured tariff, not booked invoice evidence. First panel has no cost totals or currency conversion. Costs/cost per useful unit, activation, retention, attribution, editing duration and time saved remain unavailable.
- Private TASK-47 publication-count-v1 inspectors in `convex/performance/experiments.ts` prove full original publication bindings under experiment admission. Baseline thread completeness is not equivalent to that stronger pilot publication metric. A future ordinary-publication caller may justify a small extraction then; no helper export/extraction is needed for this first measured sample.

## Minimal eventual ownership and release decision

Production: new `convex/operations/pilot.ts` (one authenticated read-only aggregate wrapper/finite validator), new `src/features/operations/pilot.tsx` (small scoped numeric consumer), and existing `src/pages/Operations.tsx` (Cloud tab mount only). Existing performance helpers, schema, finance, notification transport, Store and Demo stay outside ownership.

Eventual verification ownership: new `convex/operations/pilot.test.ts` for real role/account/current-rights/expiry/hidden-count/null controls, and existing `scripts/operations.browser.mjs` only after the active 33.1.1 writer releases it. Root owns generated API and release metadata. No tests executed in this preparation.

If even this small new projection is not desired yet, the honest two-path UI alternative is a native Pilot explanation plus a link to existing Analytics measured samples; that exposes no new metric capability. The next larger real backend unit is whole-publication receipt inspection, requiring a consumed extraction and original immutable bindings, not a speculative human-event table. Recommend the measured-sample consumer first, with the finite work bound resolved before source release.

Read qualifications: targeted named helper bodies and existing plan/contract only; no broad inventory or live sample. A few guessed authorization/store paths were absent and resolved to the exact paths above. Human `.zcodeignore` observed unchanged hash: 521c1c381b116d50e24303da3d1859faa648f29bcda2440c0b9035412e0608e5. This is preparation, not TASK-35 acceptance or implementation permission.

Root adoption: preparation only; no source release. Eventual browser ownership is tests/operations.browser.mjs (the scripts/ path above is a reporting typo). Resolve the existing helper work bound before implementation; do not add a second sampler or generic budget facade.
