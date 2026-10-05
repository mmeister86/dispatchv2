---
id: TASK-33.3
title: >-
  Retention, Quellenlöschung und Datenkontrollen vervollständigen (P09.03, Teil
  3)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p09
  - r3
  - teilpaket
  - jev
milestone: m-3
dependencies:
  - TASK-33.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-33
priority: medium
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.03. Verantwortung: convex/operations/retention.ts und src/features/settings/data-controls.tsx.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Explizite Retention für Assessments, Cache, Usage, kontrollierte Evaluation und optional kurzlebige Debug-Rohantworten festlegen; Debug-Speicherung standardmäßig deaktivieren. Quellenlöschung/Widerruf bis in abgeleitete Analysen und Cache propagieren. Provider-Retention und Grenzen gegenüber lokaler Löschung verständlich dokumentieren.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Workflow-Journale, Agent-Komponentendaten und temporäre/verwaiste R2-Objekte besitzen explizite Bereinigung nach gesicherten Publishing-Nachweisen.
- [ ] #2 Provider-Entfernungen propagieren durch Quellenkopien, Caches und Agent-Kontexte; Restore/Replay reaktiviert keine gesperrte Evidenz.
- [ ] #3 UI erklärt Export/Löschfortschritt, Backups, Provider-Kopien, Integrationsentfernung und öffentliche Posts; Lifecycle-Tests bestehen.
- [ ] #4 Retention-/Replay-Prüfungen schließen Jev-Daten ein; abgelaufene Debug-Rohantworten werden entfernt und gesperrte Quellen nicht durch Cache/Restore reaktiviert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/data, /settings/sources. Retention configuration and explanations distinguishing local deletion, integration removal and public posts; source removal local control. Grenze: No automatic retention, backup restore or propagated provider-source deletion. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
