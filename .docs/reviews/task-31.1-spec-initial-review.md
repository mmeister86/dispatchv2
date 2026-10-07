# TASK-31.1 — Fresh final SPEC review 1

Verdict: **NEEDS_WORK**. Two independent native controls find failures that the registered tests do not cover. Source remained frozen throughout this review.

## Frozen scope and authority

Reviewed actual Backlog CLI TASK-31.1 acceptance criteria, `.docs/reviews/task-31.1-native-health-source-release.md` and its adopted addenda, current native owner modules, the eight released files, and the actual browser harness. Freeze `/tmp/dispatch-31.1-final1-freeze.json` SHA256 `a3e2ca1a090e72d45297f81d0b6c3ae85149f771642281e5b8630488342516db`; ready receipt SHA256 `d97b82becf77f8e574f42ac7024b4901e33e17b7de3181e4dcd992c9796b2b0f`.

All 343 source/config files match the freeze before and after. HEAD remains `c5f4f14cc8b0d89351e50f44aad76afb2720ee56`; `.zcodeignore` remains SHA256 `521c1c381b116d50e24303da3d1859faa648f29bcda2440c0b9035412e0608e5`. No source, tests, Backlog, generated code, schema, config, environment, dependencies, or live data were edited. Independent controls and evidence were written only under `/tmp`; fixture mutations were ephemeral Convex-test operations.

## Findings

### P1 — Real cancellation hides unknown Publishing effects

Concrete trigger: start with the source-valid schedule and unknown send used by the new native test, then call the actual registered `api.editorial.cancel` command. Health before cancellation returns attention. After the actual cancellation, Health returns `rows: [], sampledRows: 0, moreEligibleRows: false, reason: null`, although the unknown attempt remains unresolved.

Path: `convex/editorial.ts:1442` increments generation and sets `abortRequestedAt`; `convex/operations/health.ts:516` calls `publishing.preflight`, which calls `editorial.checkApproval`; `convex/editorial.ts:1179` throws `SCHEDULE_ABORT_REQUESTED`, and Health treats this execution denial as source omission. Independently, Health child selectors at lines 529 and 540 restrict to the new schedule generation, whereas cancellation deliberately retains the original generation's unknown send liability. Existing Health test at line 705 fabricates `state: cancelled` without the real abort marker or generation transition, so its PASS does not establish the acceptance behavior.

Evidence: `/tmp/dispatch-31.1-spec-final1-control.test.ts` and `/tmp/dispatch-31.1-spec-final1-control2.log`. The first control log records a corrected fixture argument error only; the second invokes the actual cancellation and demonstrates the failure. HTTP spy remains uncalled.

Minimum correction: treat the public immutable Publishing header and owned unknown physical effect as workspace operational evidence. Bind each shown physical receipt to the exact same workspace/account/original schedule/version/generation; preserve unknown effects across relevant generations within the existing read budget. Current approval/source preflight should gate the recovery link instead of erasing historical unknown physical effects. Do not clear abort state, retry, issue provider requests, grant send authority, or weaken private ancestry proof. If a row cannot be proved, coverage must avoid false completeness. This is a metadata projection correction, not authorization to publish.

### P2 — Source omissions turn a bounded parent window into false completeness

Concrete trigger: retain one eligible Publishing schedule, insert seven newer same-workspace schedules with revoked approvals, then read Health. The seven are correctly omitted before counting, but the valid eighth is outside `.take(7)`. Returned metadata says `moreEligibleRows: false`, `reason: null`, zero rows. This falsely asserts that no additional eligible parent exists.

Path: `empty` initializes false; parent selectors at `health.ts:495–513` take seven; `admit` at lines 470–487 only changes moreEligibleRows after a fully proved seventh admitted parent or deliberate resource stop. Expected source omissions leave false unchanged. Similar finite merged `.slice(0, 7)` windows exist for Media, Research, and Generation.

Evidence: `/tmp/dispatch-31.1-spec-final1-window.test.ts` and `/tmp/dispatch-31.1-spec-final1-window.log`; assertion `moreEligibleRows === null` fails with actual false. The eligibility proof is not mirrored from implementation: the retained valid parent was present in the preceding native read and is unchanged after adding revoked records.

Minimum correction: a limited search that encounters omissions and cannot prove exhaustion must report unknown/null further eligibility, without counting source-denied records or changing DTO metadata according to hidden/private records. True cap+1 should continue to depend on a fully proved eligible extra parent. Do not increase global reads or claim tenant totals.

Additional static cap boundary requiring attention in the repair: Research and Generation set `moreReceipts` from raw seventh-child presence while proving only the first six receipts (`health.ts:714–716`, `815–827`). A wrong-owner or otherwise inadmissible seventh child must not establish eligible financial overflow. This is a directly visible proof gap; no third independent runtime control or separate severity claim was made for it.

## Checks and evidence

- Registered native Health/Media Uploads/GitHub Recovery: 3 files, 37 tests PASS, `/tmp/dispatch-31.1-spec-final1-native3.log`.
- Registered native Health/Media Assets/GitHub Recovery: 3 files, 42 tests PASS, `/tmp/dispatch-31.1-spec-final1-native47.log`. The filename was chosen before discovering its actual count; this review does not claim 47 tests.
- Initial narrower invocation selected only two existing files: 28 PASS, `/tmp/dispatch-31.1-spec-final1-native.log`; the requested signals test path did not exist, so this is not three-file evidence.
- Actual original browser harness completed against full App/Store and production CSS at 1280 and 390. Receipt `/tmp/dispatch-31.1-spec-final1-browser-escalated/receipt.json`: session ABA, account fences, expiry, explicit refresh, error privacy, partial coverage, existing profile/calibration tabs, isolated Demo timer PASS; provider requests `[]`, unexpected errors `[]`. Its intentional private transport error appears only in console diagnostics and is hidden by the UI. Initial localhost bind was denied inside sandbox; authorized local-only escalation succeeded with a distinct evidence directory.
- Independent actual-cancellation control: FAIL, retained unresolved send disappeared.
- Independent bounded-window/omission control: FAIL, falsely complete metadata.
- Before/after 343-file read-only guards: PASS, zero delta.

## Other inspected acceptance boundaries

Owner/Admin, active workspace, session, and account authorization precede domain sampling. The finite DTO excludes raw content/configuration/provider errors and declares unevaluated families and configuration. Public Generation/Research selector prefixes filter private ancestry before sample caps; no Agent component read is invoked by production Health. Money retains original currency, heldMicros, estimatedMicros null versus zero, and settledAt, including late booked/unknown liability. Completed generation does not become overdue solely from its execution deadline. GitHub reuses current source proof and shared cooldown projection without exposing global GUID attempt counts as tenant totals. Media presents local quota/session receipts and does not assert network health. Recovery routes point to existing native views and do not execute recovery.

Resource implementation uses the installed native transaction-metrics and same-snapshot nested query limits, subtracting outer authorization and the nested call from 128 queries/512 docs/512 KiB. Private identity sentinel denotes only deliberately unstarted reads; counter reservation occurs before awaits; outstanding parallel reads drain before real native errors win over partial stop. JSON DTO is checked against 64 KiB. The new suite covers actual custom-limit wiring/resource failures and native privacy invariance, but passing tests do not override the two concrete failures above.

No full suite, independent QUALITY, live/dev acceptance, provider proof, manual accessibility, deployment, or manual Backlog Done claim. Repair and a fresh freeze/review are required before SPEC PASS.
