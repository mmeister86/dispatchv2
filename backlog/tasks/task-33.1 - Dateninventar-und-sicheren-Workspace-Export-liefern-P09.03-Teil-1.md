---
id: TASK-33.1
title: 'Dateninventar und sicheren Workspace-Export liefern (P09.03, Teil 1)'
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
  - TASK-26
  - TASK-29
  - TASK-30
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-33
priority: medium
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.03. Verantwortung: convex/operations/export.ts und .docs/decisions/data-inventory.md.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inventar erfasst Zweck, Besitzer, Weitergabe, Retention und Löschweg aller bis P08 eingeführten Domain- und Komponentendaten.
- [ ] #2 Autorisierter Export enthält Inhalte, Quellen, Pläne, Präferenzen und relevante Agent-/Workflow-Daten, jedoch keine Provider-Secrets.
- [ ] #3 Fremde Workspace-/Account-IDs werden abgelehnt; große Exporte sind kontrolliert ausführbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
