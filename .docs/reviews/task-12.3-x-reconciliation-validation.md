# TASK-12.3 — X reconciliation and exact continuation validation

Code and automated checks are reviewed independently. Backlog remains In Progress; this receipt does not establish live provider or manual acceptance.

## Initial implementation

Backend `0b5f7cc`, UI/contract `b00093a`; frozen source `b00093a4a9e7a76be62521559d3b6b2ab66e1cea`. The existing engine gained strict candidate lookup, explicit exact partial continuation and a saved-abort finalizer. No automatic POST retry or second publishing engine was introduced.

Implementer: 181 unit checks in 16 files, TypeScript, format, build, bundle, diff and the actual intercepted Composer/Calendar fixture pass. Fixture includes backoff timers, dirty/candidate buffers, explicit continuation and ID-free known abort finalization. Existing EU Dev activated at 15:21:29 on 2026-10-05; codegen analysis and runtime activation are separate operations. User server 5173 preserved; fixture 5174 released.

ROOT: all 34 Playwright browser regressions pass on this source in 2.1 minutes. Three historical TASK-69 screenshots rewritten by that run were restored to their prior committed contents. These broad browser checks do not cover all reconciliation trust boundaries.

## Independent SPEC review — initial FAIL

The fresh reviewer read actual code and ran 71 registered backend/UI checks plus five isolated negative reproductions. The initial freeze has four concrete gaps:

1. P1: URL substring substitution can falsely confirm different content. Approved `See https://example.test/a/b`, returned `See https://t.co/z/b`, entity URL `https://t.co/z` and expanded URL `https://example.test/a` incorrectly match. Pure matching and registered lookup reproduce it. Require complete, unambiguous actual URL tokens; ambiguous evidence stays unknown.
2. P1: read source and evidence CAS omit approved immutable-media guards. An approved asset checksum changed during the GET still produces confirmed evidence. Reuse existing source/reference/namespace guards without broadening paused READ into publishing authority.
3. P2: an uncertain job cannot request abort through Composer/Calendar. Existing `cancelSchedule` is sufficient but hidden for that state; the new finalizer only appears after an abort already exists. Expose the existing awaited command while preserving unresolved effects and the account barrier.
4. P2: Calendar continuation omits actual historical media/alt evidence. Composer already shows it; Calendar must display the exact stored snapshot before renewed publishing consent.

Isolated reproductions are saved locally at `/tmp/dispatch-x-reconciliation-spec-repro.test.ts`; the temporary repository test was removed. The original implementer owns fixes, permanent regressions and a new freeze. SPEC re-review must pass before independent QUALITY starts.

## Correction freeze — re-review pending

Scoped correction `59528b2023f93e84b907001f44345df1c30e153d` addresses all four initial findings. Full approved URL tokens use the installed official parser, with a conservative actual t.co suffix boundary because that parser can shorten t.co paths. The existing strict first-write media-source block is shared concretely and rechecked by paused READ source/credential/evidence paths; the known-outcome abort finalizer remains independent of unrelated R2 availability. Recovery exposes the existing awaited unknown-job abort command. Calendar displays the stored media/alt metadata directly before continuation consent.

Implementer: 186 full unit checks (74 X-thread checks), TypeScript, format, build, bundle, diff and actual Composer/Calendar fixture pass. Permanent negatives cover the original backend reproductions and before/during-GET SHA/reference/namespace drift; browser checks include awaited abort failure/success, preserved buffers, one cancel control and historical Calendar alt. Existing EU Dev activated at 15:32:11. Independent SPEC re-review and ROOT's targeted actual UI-fixture run are pending; no QUALITY verdict yet. The prior ROOT 34-browser baseline applies to the unaffected demo flows, not as a claim that these initial negative cases were covered.

## Remaining external/manual gates

Actual X client/scopes, authorized live lookup/write, strict current response-field availability, EU-R2 runtime/media/cost evidence and authenticated manual journeys remain open. No real OAuth, X GET/POST, R2 mutation, email, new deployment or remote push was performed. A positive read never proves API write access or authorizes a follow-up post. Only actual current credentialed POST acknowledgement can enable the separately gated write capability.
