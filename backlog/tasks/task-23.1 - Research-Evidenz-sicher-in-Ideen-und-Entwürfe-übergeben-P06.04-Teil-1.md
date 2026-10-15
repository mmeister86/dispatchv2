---
id: TASK-23.1
title: 'Research-Evidenz sicher in Ideen und Entwürfe übergeben (P06.04, Teil 1)'
status: In Progress
assignee: []
created_date: '2026-10-05 23:37'
updated_date: '2026-10-06 01:04'
labels: []
dependencies:
  - TASK-22.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-23
priority: high
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu TASK23: aktuelle Research-Evidenz, Inbox-Reviewzustände und wiederholbare explizite Content-Übergaben. Bestehende Ideen/Entwürfe, Quellenketten und Autorisierung wiederverwenden; keine Umwandlung geschützter Evidenz in freie Notizen. Keine Umsetzung vor ROOT-Freigabe nach geprüfter TASK22.3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ignore und Archivierung sind persistent, rollen- und revisionsgebunden und verändern nicht das Ergebnis des Research-Auftrags.
- [x] #2 Jede Übergabe prüft aktuelle primäre und sekundäre Evidenz, Zweck, Account, Materialhash, Ablauf und Autorität; abgelaufene oder fremde Inhalte werden nicht offengelegt.
- [x] #3 Explizite begrenzte Absicht und Anzahl sind unveränderlich gebunden; parallele Wiederholung erzeugt keine zusätzlichen Vorschläge und liefert echte IDs mit vollständiger Quellenkette.
- [x] #4 Ideen und Entwürfe behalten menschliche Freigabepflicht; bestehende Inhalte, Versionen und Finanzbuchungen werden nicht überschrieben.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und offene manuelle Abnahme sind dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace actual evidence/idea/draft/approval/execution read/write and copy-cleanup paths; prove current source-copy guard gaps with registered regressions.
2. Reuse current bounded evidence proof, immutable source references and existing atomic ideas/drafts for explicit capped idempotent handoffs and separate Inbox review states.
3. Preserve provenance through all derived versions/read/history/approval/new publishing effects; hide unavailable protected copies immediately, bound physical cleanup, preserve late financial/technical receipts and human-authored unbound content.
4. Add only necessary source-proof expiry/reset behavior to existing derived-content UI; verify registered replay/roles/lifecycle, actual source-sensitive browser paths and ordinary profile-save-during-I/O snapshot proof.
5. Relevant/full checks, codegen and existing EU Dev only after green, scoped master commit/freeze, fresh SPEC then QUALITY. No automatic profile option/chat bridge/Done until their dependent units/manual confirmation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ROOTrelease after22.3freshSPEC+QUALITYPASS source6c38de90. Actualmaps /tmp/dispatch-research-inbox-current-code-map.md and /tmp/dispatch-research-content-provenance-map.md: typedsource currentlyendsatimmutableIdeaVersion/ideas.handoff, draft/version/query/history/calendar/approve/checkApproval sourceguard missing, source-awareIdea reads incomplete. Do notcopyresearch intoNote orparsesourcestrings asauthority; useexacttypedrefs/replays/count/currentprimary-secondaryrights/expiry/modelhash/reviewer guards andboundedindexedcleanup. MinimalrelatedexistingGitHub-derivedsource guard shouldfollowsharedrealrootcallers, notunrelatedproviderrefactor. Ordinarysave-duringnative/modelIOtestmissingfor20AC4, addactualproof withoutchanging20productionsemantics. No newInboxstore/genericcommandbus/purposeengine/ledger/factory/paidgeneration/autoapproval/schedule/publish. Automaticoption/chatproductUI remain23.2/23.3. Allsourcechangesexactownership/ROOTwindow; sourceprivacy UI expiry/reset ifrequiredcannotbedelayed.

ROOT db59b947 releases sole implementer research_content_handoff (Backend Architect, sol/medium). Concrete replay policy: same immutable evidence/material/model/assessment pins, account/target, explicit normalized intent, ordered unique selection/count reuses original IDs even with another retry key; changed explicit intent is distinct. At most five selections/results, default one, no padding/new paid generation. Read-only targeted-chat mapping proceeds separately for dependent23.2; no chat implementation released.

WIP registered research cases reported green by implementer: concurrent semantic replay returns original unapproved IDs; duplicate review-family selection rejected; current source/role/expiry guards cover idea and draft reads/history/feedback; bounded cleanup removes copied text while retaining technical and financial receipts. Source pins retain hashes rather than assessment quotes; known legacy GitHub handoff reverse relation and shared cached-proof clock included. Exact active-I/O profile snapshot/browser/full checks and fresh independent reviews still pending; no AC or Done claim.

Implementer reports genuine baseline disclosure RED from isolated db59b94 /tmp snapshot: GitHub handoff→revoke→editorial.get exposes copied title; current legacy relation case passes. Initial snapshot optional-field mismatch was harness-only, no live rollback. Actual held-native-I/O ordinary profile-save check now reported green (old query/model/evidence-version snapshot, two settled attempts); TASK20AC4 still awaits fresh independent reviews. Concrete recursive source proof capped32 retained orders with shared active/resolved tracking; browser/full/frozen-source reviews pending.

Local WIP verification: full552/30PASS /tmp/task231-full-test.log; public hooks+late receipt8PASS /tmp/task231-public-cleanup-latefacts.log; actual WorkspaceStoreProvider/Composer two-deadline/manual-buffer fixturePASS /tmp/task231-content-browser.log, Ideas browserPASS /tmp/task231-ideas-browser.log. Count is immutable maximum with honest underfill; alias retry keys remain bound. Calendar own query/dialog guards included; technical thread positions preserved on privacy erasure. Static/Dev/freeze and fresh independent SPEC→QUALITY still pending; no AC/Done.

Frozen SOURCE1bb0d0b72c79392bb7eee547adb2d0b944616259 exact29paths, clean source/index; full552/30 and static/build/bundle/codegen/posttype PASS, actualEUDevready02:39:09. ActualReact mocked-subscription Store/Composer/Calendar/Ideas/XComposer browser PASS, live/manual not claimed. Fresh independent SPEC research_content_spec Backend Architect astra/medium active, QUALITY onlyafterPASS. AllAC/Done remain unchanged;20AC4 awaits both reviews.

Fresh SPEC independently reproduced inherited published-research-draft deadline gap at SOURCE1bb0d0b: parent1791247694861, child1791247794861 (+100000ms). Actual registered source/evidence/handoff and controlled exact confirmed history; /tmp/task231-spec-independent/horizon.log retained. historyMaterial discards draft source deadline; materialAuthority fails to propagate it. Reviewer completing frozen receipt; original implementer correction→sameSPEC required, QUALITY notstarted, noAC/Done.

Fresh SPEC finalNEEDS_FIXES/ReadyNo oneP1 /tmp/dispatch-research-content-spec-receipt.md: history source proof AND actual ai/researchTools pipeline retention omit earliestancestor, child100000ms later; freshservermasks butcachedsnapshot99999ms remain.73registered+canonicalown+browserPASS/all29hashunchanged. Original implementer correction released forsharedhistory/proof/retention/allactualconsumers; permanentactualboundary regression, sameSPECrerunbeforefreshQUALITY. OriginalREDfrozen, noAC/Done.

Permanent actual Workflow/native/model ancestor regression RED /tmp/task231-history-red.log retained. After horizonfix publicexpiry finds secondactualrollback: pipeline.purge cancels nativealready-completedWorkflow→Workflow not running→Agent/journalerasure rolledback; /tmp/task231-history-scheduler-diagnostic.log. ROOT permits sixthcorrectionpathpipeline.ts existingstatus/inProgress guard, actualcleanup/isDonepending retained. SameSPEC mustverify, QUALITYnotstarted, noAC/Done.

Correction SOURCE6fde7a93e92814b0482326da5722b28f0668e56c exact6paths, clean index/tree; inherited history and dedup-context horizons propagated; existing status check avoids completed-native cancellation rollback while actual cleanup retained. Permanent real Workflow/native/model/history/public scheduled expiry GREEN with journal/isDone/Agent erasure + financial/confirmed IDs retained; distinct labeled context MockLanguageModel GREEN and isolated genuineRED retained. Final554/30 +75/3/static/codegen/posttypes PASS, actualEUDev02:57:21. SAME SPEC correction verification active, freshQUALITY gatedPASS; noAC/Done/newbrowser/paid/prod.

SAME SPEC correction PASS/ReadyYes /tmp/dispatch-research-content-spec-correction-receipt.md; independent2/2 +75/3 PASS, all ancestor/descendant retention/proof/cached deadlines equal1791248731139 and expire together; actual completed-native public scheduled journal/isDone/Agent erasure verified, all30 finalsourcehash match6fde7a9, originalRED untouched. Fresh separate QUALITY research_content_quality Application Security Engineer astra/medium nowactive; noAC/Done untilPASS/manual.

Software accepted after final SAME SPEC PASS + fresh QUALITY PASS/ReadyYes /tmp/dispatch-research-content-quality-receipt.md; independent77/5PASS, all30hashmatch6fde7a9/treeclean. Full554/30, finalEUDev02:57:21 and independent actual cached-deadline browser receipts retained. AC1–4 software checked; noDone/manual/liveclaim; originalREDs/initialNEEDS_FIXES preserved. Release next23.2 targetedpersonalchat source-aware transport,23.3automaticoption deferred.
<!-- SECTION:NOTES:END -->
