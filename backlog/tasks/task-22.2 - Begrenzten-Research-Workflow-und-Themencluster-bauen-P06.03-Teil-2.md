---
id: TASK-22.2
title: 'Begrenzten Research-Workflow und Themencluster bauen (P06.03, Teil 2)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p06
  - r2
  - teilpaket
milestone: m-2
dependencies:
  - TASK-22.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-22
priority: high
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P06.03. Verantwortung: convex/ai/researchAgent.ts, researchTools.ts, convex/research/clusters.ts; zehn Pipeline-Schritte aus §6.3.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P06.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Der wiederaufnehmbare Ablauf führt alle zehn Schritte mit Tenant-Kontext, Budget, Timeout und Abbruchprüfung aus.
- [ ] #2 Themenduplikate, Quellenkopien, alte Meldungen und bereits veröffentlichte Themen werden erkannt.
- [ ] #3 Leeres Ergebnis, partielle Quellenausfälle und Budgetende erscheinen als unterschiedliche Zustände.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
