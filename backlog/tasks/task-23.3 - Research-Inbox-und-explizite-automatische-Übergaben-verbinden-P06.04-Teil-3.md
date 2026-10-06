---
id: TASK-23.3
title: 'Research-Inbox und explizite automatische Übergaben verbinden (P06.04, Teil 3)'
status: In Progress
assignee: []
created_date: '2026-10-05 23:38'
updated_date: '2026-10-06 02:00'
labels: []
dependencies:
  - TASK-23.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-23
priority: high
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu TASK23/J04/J05: vorhandene echte Research- und Agent-Oberflächen mit den geprüften Inbox-, Content- und Chat-Kommandos verbinden; aktuelle Profiloptionen für begrenzte automatische Ideen-/Entwurf-Übergaben umsetzen. Demo bleibt explizit, vorhandene Quellen- und Freigabeverträge bleiben wirksam. Umsetzung erst nach ROOT-Freigabe und geprüften Teilen 1/2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Account-Inbox und Details zeigen tatsächliche aktuelle Quellen, Zeitprovenienz, Perspektive, Unsicherheit und getrennte Lauf- und Reviewzustände mit begrenzter Pagination.
- [ ] #2 Ignorieren, Archivieren, echte Nachrecherche, Agent befragen und Idee-/Entwurf-Übergaben sind awaited Server-Kommandos mit echten Ergebnislinks und erhaltener Eingabe bei Fehlern.
- [ ] #3 Automatische Content-Übergabe erfordert neue explizite aktuelle versionierte Profiloption und begrenzte Anzahl; alte Profile/Aufträge werden nicht still aktiviert, Wiederholung dupliziert keine Vorschläge.
- [ ] #4 J04 und J05 laufen in echten registrierten Domain- und betroffenen Browserprüfungen ohne GitHub; kein Inhalt wird automatisch freigegeben, geplant oder veröffentlicht.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und offene manuelle Abnahme sind dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace final23.2 evidence/thread admission and existing Inbox/profile/activation/handoff consumers.
2. Wire scoped paged Inbox and exact immutable current evidence details/dispositions/content handoff, awaited commands and finite proof resets.
3. Add narrow stable existing-evidence attach to own personal thread and genuine immutable lineage-bound one-off re-research; preserve all source/budget/cleanup/unknown contracts.
4. Add explicit new saved auto option and new scheduled activation capture, bounded eligible human-reviewed one-shot handoff; old versions/orders remain inert and no approval/schedule/publication.
5. Registered real Workflow/Agent/native J04/J05 and source/config/replay/revoke/oldversion negative controls; affected actual React browser and full/static/build/bundle/codegen/EUDev aftergreen.
6. Exact scoped master source freeze, fresh SPEC then QUALITY; software criteria only after PASS, manualDone remains open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ROOT release after final23.2 SOURCEeb4feb0 freshSPEC/QUALITY+sameUIcopydeltaPASS. Full brief /tmp/dispatch-task23.3-release-brief.md, trusted frozen maps /tmp/dispatch-task23.3-versioned-activation-map.md and /tmp/dispatch-task23.3-chat-api-map.md. New scoped Inbox attachment needed; reuse stable create own thread then exact current evidence attach, no intermediary Note/Idea or thread picker. Genuine new pipeline re-research carries full immutable parent lineage; no old promotion/profile rewrite. New scheduled-only versioned auto capture count1..5/target/intent requires current finite HUMAN automaticEligible assessment and actor/grants; finish/review consumer frozen once with honest underfill, old versions/work inert, no automatic approve/schedule/publish. Sole source writer, ROOT metadata only; no AC/Done before fresh reviews.

ROOT read first contractRED /tmp/task23-3-inbox-original-red.log03:59:11 missing public evidence.inbox, not historical privacy exposure. RetainedGREEN /tmp/task23-3-inbox-green.log03:59:43 actual9/9 tests1file, current compound-index paged Inbox and stable disposition replay. Initial20 reported count mistaken, implementer acknowledged9. Intermediate bytes; attachment/lineage/marked auto/UI/full/Dev/freeze/reviews remain. No AC/Done.
<!-- SECTION:NOTES:END -->
