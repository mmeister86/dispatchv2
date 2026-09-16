---
id: TASK-12.1
title: 'Finalisierte Medien sicher für X vorbereiten (P03.03, Teil 1)'
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
  - TASK-11
  - TASK-9
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-12
priority: high
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P03.03. Verantwortung: convex/integrations/x/publish.ts; R2-Abruf und Medienvorbereitung des Publishing-Workflows.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P03.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Abruf prüft Tenant, finale Objektidentität, erwarteten Inhalt und Medienbereitschaft; abgelaufene URLs werden erneuert.
- [ ] #2 Unterstützte Medien durchlaufen begrenzten block-/streamweisen Upload, asynchrone Verarbeitung und Verfallsprüfung innerhalb gemessener Runtime-Grenzen.
- [ ] #3 Unterbrechung während Upload/Verarbeitung ist wiederaufnehmbar; Kosten des Transfers sind messbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
