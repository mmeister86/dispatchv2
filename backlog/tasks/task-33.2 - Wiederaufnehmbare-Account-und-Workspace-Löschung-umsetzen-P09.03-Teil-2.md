---
id: TASK-33.2
title: 'Wiederaufnehmbare Account- und Workspace-Löschung umsetzen (P09.03, Teil 2)'
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
  - TASK-33.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-33
priority: medium
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.03. Verantwortung: convex/operations/deletion.ts und deletion.test.ts; Ausbau des betreuten R2-Basisbetriebs.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Löschung sperrt neue Arbeit, stoppt Jobs, entfernt Tokens und verhindert späte Neuanlage durch laufende Actions.
- [ ] #2 R2-Objekte, Metadaten, Agent-Memory, Embeddings und abgeleitete Modelle werden mit dauerhaftem Fortschritt bereinigt; fehlende Objekte sind idempotenter Erfolg.
- [ ] #3 Account-Löschung entfernt keine fremden gemeinsamen Workspaces; alleinige Owner wählen Übergabe oder bewusste Workspace-Löschung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
