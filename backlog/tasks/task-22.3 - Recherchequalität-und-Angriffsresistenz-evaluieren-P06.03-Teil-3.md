---
id: TASK-22.3
title: 'Recherchequalität und Angriffsresistenz evaluieren (P06.03, Teil 3)'
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
  - TASK-22.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-22
priority: high
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P06.03. Verantwortung: convex/research/evaluate.ts und tests/evals/research/; versionierter Referenzdatensatz.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P06.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stichprobe enthält relevante, irrelevante, alte, widersprüchliche und bösartig instruierende Quellen.
- [ ] #2 Ausgaben referenzieren ausschließlich tatsächlich gelieferte Quellen; URLs und Trenddynamik werden nicht erfunden.
- [ ] #3 Ergebnisbericht weist Quellenrichtigkeit, Wiederholungen, Frische, Kosten und bekannte Grenzen aus.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
