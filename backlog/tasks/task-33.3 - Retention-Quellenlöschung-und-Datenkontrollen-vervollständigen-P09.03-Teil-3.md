---
id: TASK-33.3
title: >-
  Retention, Quellenlöschung und Datenkontrollen vervollständigen (P09.03, Teil
  3)
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
  - TASK-33.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-33
priority: medium
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.03. Verantwortung: convex/operations/retention.ts und src/features/settings/data-controls.tsx.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Workflow-Journale, Agent-Komponentendaten und temporäre/verwaiste R2-Objekte besitzen explizite Bereinigung nach gesicherten Publishing-Nachweisen.
- [ ] #2 Provider-Entfernungen propagieren durch Quellenkopien, Caches und Agent-Kontexte; Restore/Replay reaktiviert keine gesperrte Evidenz.
- [ ] #3 UI erklärt Export/Löschfortschritt, Backups, Provider-Kopien, Integrationsentfernung und öffentliche Posts; Lifecycle-Tests bestehen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
