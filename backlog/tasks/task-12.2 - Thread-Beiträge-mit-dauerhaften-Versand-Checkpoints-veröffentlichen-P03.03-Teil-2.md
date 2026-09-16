---
id: TASK-12.2
title: >-
  Thread-Beiträge mit dauerhaften Versand-Checkpoints veröffentlichen (P03.03,
  Teil 2)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p03
  - r1
  - teilpaket
milestone: m-1
dependencies:
  - TASK-12.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-12
priority: high
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P03.03. Verantwortung: convex/publishing/workflows.ts und attempts.ts; deterministischer Versand der freigegebenen Version.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P03.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Jeder Einzelpost besitzt eine nachvollziehbare Operation und einen dauerhaften Checkpoint mit externer ID.
- [ ] #2 Account, Version und Autorisierung werden unmittelbar vor Versand geprüft.
- [ ] #3 Automatische SDK-/Workflow-Retries nicht idempotenter Schreibaufrufe sind deaktiviert; ein Crash nach Beitrag 2 wiederholt bestätigte Beiträge 1/2 nicht.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
