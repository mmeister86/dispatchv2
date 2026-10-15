---
id: TASK-32.2
title: Dedupliziere Publishing-Fehlermeldungen und unterdrücke optionale Mails
status: In Progress
assignee: []
created_date: '2026-10-07 21:07'
updated_date: '2026-10-07 21:41'
labels: []
dependencies: []
references:
  - .docs/reviews/task-32.2-failure-episode-source-plan.md
  - .docs/reviews/task-32.2-failure-episode-source-release.md
parent_task_id: TASK-32
priority: high
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bestehende publishingNotifications atomar nach originalem Schedule/Generation/Empfänger deduplizieren. Ohne implementierte native optionale Versandfreigabe bleiben neue Episoden und alte queued/direct notify-Aufrufe ohne externen Mailversand. Domain-Fehler und historische mögliche Transportbelege bleiben erhalten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Wiederholte oder konkurrierende echte failure-Aufrufe derselben ursprünglichen Episode erzeugen genau eine Meldung und bewahren ursprüngliche ID/Zeit/Zustand; tatsächliche neue Generationen sind getrennt.
- [x] #2 Neue optionale Meldungen lösen keinen Mailjob aus; registrierte queued/direct notify-Aufrufe haben unabhängig von Konfiguration keinerlei Provider- oder Auth-Empfänger-I/O. Auth- und Teamtransporte bleiben unverändert.
- [x] #3 Alle Legacy-Belege einschließlich pending bleiben unverändert und erhalten keine nachträgliche Generation. Bereits eingetretene Original-Transporte dürfen ihre echten späteren Resultate weiter erfassen; keine Zustellungsbehauptung und kein Zurücksetzen von Domain-/Unknown-/Late-Receipt-Belegen.
- [x] #4 Fokussierte native Wiederholungs-/Konkurrenz-/Legacy-/ZeroIO-Kontrollen, dokumentierte Korrektur der alten Transport-Erwartung, unabhängige Reviews, Gesamttests/static und exaktes EUDev sind geprüft.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Automatisierte Prüfung und offene Grenzen sind dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Originale failure-Caller und notificationFields/Index-Lesewege abgleichen; generation-Tupel und Legacy-Pending-Grenze bestätigen.
2. Nur vier freigegebene Dateien: atomare Episode-Dedupe, neue optionale Meldungen blocked/noenqueue, notify callable zeroIO/zeroMutation; ursprüngliche späte Resultate erhalten.
3. Fokussierte native Kontrollen/Type/Format; Rootcodegen, Freeze, frischeSPEC und separateQUALITY.
4. Fullnative/static/build, selektiver Sourcecommit und exaktes bestehendes EUDev; technische Kriterien dokumentieren, manuellesDone offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root has read the full minimal proposal and approved direction only. Persistent copy .docs/reviews/task-32.2-failure-episode-source-plan.md. Exactly3 existing production paths plus focused existing native tests; no new table/preferences/receipt framework. Wait for TASK32.1 UI freeze/technical acceptance before source release (one writer). New episode generation must be positive safe integer; malformed header must not roll back original failed schedule/event, and grants no optional receipt or effect. Native source release/reviews/full checks/EUDev remain pending.

Root identified correction to readonly proposal: legacy pending may include already-entered original transport. Do not patch pending→blocked solely on new optional suppression; that would fence original late notificationResult and erase possible effect evidence. Minimal notify callable should return null with no I/O or state mutation; new generation-bound episodes are blocked/noenqueue at creation. Existing notificationResult must retain original late-result ability. Source release still pending after32.1 review/commit.

Root source release after32.1 accepted source670e234/docs33865b5. Exact4writerpaths/339protected; no extra metadata framework. Legacypending-zeroMutation correction mandatory: keep original notificationResult lateACK capability. Root generated/commit/review/Dev ownership; no real mail/provider/consent activation.

Current official Convex docs fetched via AGENTS ctx7 library-first/docs outside sandbox (2commands, /llmstxt/convex_dev_llms-full_txt). Confirm exact index equality order, atomic mutations, finite OCC retries may ultimately fail, index backfill before new function registration. Sources docs.convex.dev/database/reading-data/indexes, /database/writing-data, /error. Numeric exactgeneration excludes absentlegacy without inference. Installed native concurrent tests are not distributed production OCC certification.

Solewriter4paths paused;122native/2files PASS (editorial+x-thread), bothTSC/scopedformat/diffPASS. Root read fullproduction/testdiff andverified343/339protected/loghashes. Actualhelperconcurrent/replay+corruptduplicatefirstreceipt, registeredreschedule/newgen, tuple/malformed andconfigured direct+queued recipienttripwire/zeroHTTP/legacyunchanged/lateACK controls.77 priorassertions retained exceptone explicit EMAIL_CONFIGURATION_REQUIRED→OPTIONAL_EMAIL_UNAVAILABLE semanticcorrection. Rootcodegen typecheckenable PASS21:20:29–21:20:39UTC;338nongens/343inventory/humanexact/all5generatedzeroDelta. Frozenfreshreviews/fullnative/static/sourcecommit/EUDev/manualDone stillpending.

FreshSPECfinal1 PASS after independently rerun122/2focusednative; currentcaller/generation/latephysical paths andunchangednotificationResultbody verified. All343/339protected/generated/head/humanbeforeafterexact, oldRED/errorlogsretained. SPEC report70a5219075f2deadea4daa4d6e3d9278461b0c526456c06d2e76b9c21adc9269 receiptb0fd74e4adf4f986345295e0aa4ce29390f30890c3e08b09dd068aaa017a0ce6. DistinctQUALITYdispatched afterPASS; Rootfullnative/static/commit/EUDev/manualDone stillpending.

DistinctQUALITYfinal1 scopedPASS afterSPEC: actual122/2native +independentregisteredsetter/resources1PASS (blockedepisode cannotbecome sent, optionalgeneration validatesactualresourceDTO). All343/339protected/head/human/SPECreadyhistoricfailedlogsexact, originalnotificationResultbyteexact. Report59673a232c6c20efd7a828d3d7afef4c57cc3125cef3858434533332d4813a80 receipt36278c66b968358e8b50e92ffbffae60f857970cfefd70e6c3e706b292aec62b. Reviewerwrongpath/loader failures preserved, notcountedPASS. Rootfullnative4799/static37108 nowrunning exactfinal1freeze; sourcewriterspaused; no Dev/manualDone acceptance.

Technisch akzeptiert: source008b1c9, fresh SPEC/distinct QUALITY, full1462/57, sieben statische Gates und exaktes EUDev456/5HTTP; nur optionales generation-Rückgabefeld. Siehe .docs/reviews/task-32.2-validation.md. In Progress; manuelle DoD2 offen.
<!-- SECTION:NOTES:END -->
