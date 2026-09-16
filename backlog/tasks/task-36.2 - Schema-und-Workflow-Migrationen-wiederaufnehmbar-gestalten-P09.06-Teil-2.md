---
id: TASK-36.2
title: 'Schema- und Workflow-Migrationen wiederaufnehmbar gestalten (P09.06, Teil 2)'
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
  - TASK-36.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-36
priority: medium
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.06. Verantwortung: .docs/runbooks/deployment.md und Migrationsmechanik.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.06. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Additive Schemaänderung, unterbrechbarer Backfill und spätere Feldentfernung sind dokumentiert und geprobt.
- [ ] #2 Alte Workflow-Versionen laufen kontrolliert aus oder werden nachvollziehbar migriert.
- [ ] #3 Upgrade und Rollback beschädigen weder aktive Threads noch bestehende Freigaben.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
