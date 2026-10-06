# Current intelligence profile contract — TASK-27

This is the implemented profile boundary, not a model evaluation or provider authorization. Actual analysis/prediction records do not exist. TASK-27 acceptance criteria 1/2 remain pending the genuine TASK-28.3 analysis consumer; tests capture immutable profile IDs and concrete projection references without inventing predictions. Manual acceptance and Done remain open.

## Scope and authority

One `intelligenceSelections` row per actual workspace/socialAccount/`x`/`for_you` scope atomically selects nullable Algorithm and declared Audience IDs. Every command uses the authenticated current verified user, active workspace, account membership/reference, current Owner/Admin role and expected selection revision. A disconnected X account may hold informational context; this grants no publishing or paid processing permission. Other networks return unavailable.

Creating a candidate, reviewing, selecting, rollback and retirement are explicit registered mutations. No startup seeding or automatic selection/review occurs. Commands increment the shared scope revision and append one immutable `intelligenceProfileReceipts` record carrying actor, exact intent fingerprint/key, returned IDs, reason, time and revision. This receipt is also the audit history. An exact retry returns its original result even after later commands; changed intent under the same actor/account/key conflicts. Replay first checks current command actor/workspace/account access, never reapplies a historical transition. OCC plus the unique indexed scope read prevents competing commands from committing mixed selections.

Algorithm and Audience payloads, provenance, created actor/time and contract references are never patched. Explicit review/retirement metadata is mutable; active is a derived selection state, not a mutable boolean on each version. Retirement clears the corresponding current selection while retaining rows and receipts. Rollback uses at most one indexed receipt per exact scope/pair/action (select and rollback). It is a new current command referencing a previously selected actual pair; it checks reviewed/non-retired state, current creator/reviewer authority, current source deadline and current command actor. Selecting or rolling back creates a new activation actor. Retirement does not replace the activation authority for a retained counterpart.

The capture query retains historical IDs and returns profile-context usability separately from missing analysis. Current creator/reviewer/activation Owner/Admin memberships must exist; demotion or removal makes context review-needed. Current workspace inactivity/account absence rejects access. Source expiry is checked at command admission and capture evaluation. Convex cached query time is not a clock: the UI separately checks the immutable deadline every 30 seconds. A future analyzer must recheck this authority/deadline in its own admission mutation; the query is a presentation snapshot, not permission to run a model. This profile permission is not a processing consent; restored generation/provider grants cannot be inferred from it.

UI commands await acknowledgment, retain failed input and the exact original retry intent, and require an explicit action to take a newer revision. Keyed workspace/account components reject replies to a previous account; a monotonic role epoch rejects replies across role withdrawal/restoration. No optimistic review/activation or timeout success exists. Operations keeps unrelated local Demo controls; its real algorithm tab uses these records. Settings has declared account-version controls beside unchanged personal/onboarding preferences. Composer displays read-only account profile status while its non-Demo analysis tab remains unavailable.

## Pinned informational candidate

`x-public-context-v1` stores the exact `xai-org/x-algorithm` commit `b412112d03f27acbfd668e0cc040abcafa1080c1`, commit time 2026-10-03T03:26:56Z, observation 2026-10-05T09:42:27Z, immutable commit URLs and all 13 raw file SHA-256 values from [the reviewed public source report](reviews/task-27-44-public-x-source-review.md). `sourceScope=public_code`, `productionState=unknown`, `scoringInfluence=none`. The report is candidate content, not a current account reviewer receipt. Its 2026-10-12 UTC review deadline is an operational assumption. Expired candidates cannot have the deadline reset by a metadata review; TASK-44 must supply a new reviewed source snapshot. No public X weights are imported into the Dispatch formula.

Every actual Algorithm ID contains distinct references: `formula=dispatch-score-v1`; `questionSet` and `normalization=unavailable-until-task28`; `routing=disabled-v1`; `verification=disabled-v1`. These identify availability, not executable SDK contracts. There is no arbitrary label registry or endpoint to overwrite them. Future question/formula/policy changes require a new immutable payload/ID and explicit review/selection after TASK-28 implements the concrete contract.

Audience payloads use `declared-audience-v1` plus their immutable record ID, bounded 4000-character authorized account description, `source=authorized_declaration`, `measurement=unavailable`, `embedding=unavailable`. Personal mutable preferences are not automatically imported or treated as account authority. There is no current embedding/model/dimension/vector consumer, so no vector import/store/provider call is created.

## Score and missing states

[The analysis decision](decisions/analysis-contract.md) defines a future content heuristic: Hook .20, clarity .20, discussion .20, originality .15, natural CTA .05, structure .10, historical fit .10. Only the display rounds; missing required signals or low confidence means no aggregate. The implemented capture always has `aggregate=null` and missing `analysis`/`embedding`; absent profiles add `algorithm`/`audience`, unusable reviews add `algorithm-review`/`audience-review`, withdrawn selection authority adds `selection-authority`. `audienceFit=unavailable`; historical .5 is expressly `assumed_cold_start_baseline`, not measurement. No analyzer computes these components in TASK-27. Actual ordered SDK questions, normalization, resolved models, required-signal/low-confidence assessment records and evals belong to TASK-28.

| Former dimension | Current permitted interpretation / required measurement |
| --- | --- |
| Audience Fit | Unavailable until an own defined measured signal; declaration is context only. |
| Share Potential | No share/reach number; future Hook/Originality semantic labels. |
| Conversation Potential | Future semantic discussion quality, not predicted comment count. |
| Follow Potential | Unavailable without own evaluated measurement; natural CTA is a separate semantic property. |
| Dwell Potential | No duration prediction; deterministic length/structure. |
| Discovery Potential | No discovery prediction; deterministic descriptive links/hashtags/mentions. |
| Content Health | Future individual promotion/claim/clickbait probabilities and provider warnings, no second aggregate. |

Follower/discovery reach perspectives remain unavailable without separately measured evidence. `structure-v1` is a Dispatch editorial starting assumption, not an X ranking fact. Current three-weight Operations Demo state and seven fixed Composer Demo bars remain explicitly local examples.

## Inventory for TASK-33 / TASK-36

New tables: `algorithmProfiles`, `audienceProfiles`, `intelligenceSelections`, `intelligenceProfileReceipts`. All carry workspace/account/network/surface. Payloads contain public evidence or declared customer context; rows/receipts also reference creator/reviewer/activation/command user IDs. Selection references Algorithm/Audience IDs; command receipts preserve historical pairs. Later actual assessments must capture immutable IDs/references at admission rather than look up current selection on historical display.

Current reads use indexed bounded newest-50 version lists plus any older currently selected version, and separately paginated decision history, max25 per page. This is an explicit current UI ceiling, not a complete archival export. TASK-33 needs complete paginated workspace/account export and deletion/retention policies for these tables/refs, including declared text and actor references. TASK-36 needs snapshot referential reconciliation and restoration checks. This document does not certify those future flows. Restoration cannot infer renewed processing permission from profile receipts; current memberships/source validity/provider-purpose grants must be separately proved.

## Verification boundary

`convex/intelligence/profiles.test.ts` calls registered mutations/queries with the existing Better Auth component fixture. It checks immutable payload/ref captures, missing signals, exact replay, scope/CAS concurrency, rollback/retirement, current authority/deadlines, foreign/unauthenticated/invalid/inactive scope and paginated command history. The first missing-module RED is preserved separately. Later authority controls are implementation-first validation, not historical RED.

`tests/intelligence-profiles.browser.mjs` renders the real Operations tab and actual profile component with a registered-function-name mock transport. It checks awaited UI, retained input, exact retry, read-only and declared-audience controls, role withdrawal/restoration/account late replies, Demo separation and render errors. It proves frontend behavior against controlled transport, not a live session/model/EU processing path. Final logs and source hashes are supplied to ROOT for fresh specification and quality review before any source commit window.
