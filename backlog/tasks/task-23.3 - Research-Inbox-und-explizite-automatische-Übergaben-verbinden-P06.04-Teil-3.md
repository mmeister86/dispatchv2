---
id: TASK-23.3
title: 'Research-Inbox und explizite automatische Übergaben verbinden (P06.04, Teil 3)'
status: To Do
assignee: []
created_date: '2026-10-05 23:38'
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
