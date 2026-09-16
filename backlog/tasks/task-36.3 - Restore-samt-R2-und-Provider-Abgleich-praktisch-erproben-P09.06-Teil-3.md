---
id: TASK-36.3
title: 'Restore samt R2- und Provider-Abgleich praktisch erproben (P09.06, Teil 3)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p09
  - r3
  - teilpaket
milestone: m-3
dependencies:
  - TASK-36.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-36
priority: medium
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.06. Verantwortung: .docs/runbooks/recovery.md; Wiederherstellungsübung und Nachweis.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.06. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Restore gleicht Convex-Asset-Referenzen mit R2-Objekten ab; Datenbank-Backup wird nicht als Medienbackup behandelt.
- [ ] #2 Alte Scheduler-Daten werden vor Freischaltung mit externen Veröffentlichungen abgeglichen; es entstehen keine doppelten Posts.
- [ ] #3 Gemessene Wiederherstellungszeit und Datenverlustgrenzen sind als Grundlage für D15/GA dokumentiert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
