---
id: TASK-63
title: Sicheren Basisbetrieb vor der MVP-Abnahme nachweisen
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p09
  - r2
  - gate
milestone: m-2
dependencies:
  - TASK-4
  - TASK-5
  - TASK-9
  - TASK-13
  - TASK-19
  - TASK-23
  - TASK-25
  - TASK-29
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/decisions/release-scope.md
priority: high
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Frühe P09-Maßnahmen aus §10/P09-Einleitung als eigenständige Voraussetzung von P07.03 liefern. Die spätere P09-Konsolidierung bleibt in R3. Betreute Löschung einschließlich Jobs, Credentials, Convex-Daten, R2-Objekten und eingeführten Agent-Komponentendaten implementieren und dokumentieren; kein Warten auf das spätere Self-Service-UI.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md. Geplante Arbeit; Abnahme/Done erst nach ausdrücklicher Nutzerbestätigung.

D04 vom 19.09.2026 zieht Intelligence in R2 vor. Der Basisbetrieb umfasst deshalb bereits Jev-Assessments, Analyse-Caches, Run-/Usage-Daten, deren Workspace-Isolation, Budget-/Abbruchkontrollen und betreute Löschung. TASK-29 ist Voraussetzung für die integrierte Prüfung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Secrets sind serverseitig geschützt; Frontend-Bundle und allgemeine Logs enthalten keine Credentials.
- [ ] #2 Tenant-/Account-Negativtests decken die bis R2 eingeführten Queries, Mutations, Actions und Agent-Werkzeuge ab.
- [ ] #3 Agent-Läufe besitzen wirksame Budget-, Schritt- und Zeitlimits sowie Abbruchkontrollen.
- [ ] #4 Publishing-Fehler, Teilthreads und unklare Ausgänge sind mit nächsten Schritten sichtbar.
- [ ] #5 Entwicklungs-, Test- und Produktionszugänge einschließlich R2 sind getrennt.
- [ ] #6 Eine dokumentierte betreute Workspace-Löschung stoppt neue Arbeit und kann nach Unterbrechung ohne Datenreaktivierung fortgesetzt werden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /calendar, /agent, /operations, /settings/data. Supporting failure/partial/uncertain recovery, local cancellation and data-control UI scenarios. Grenze: Security, tenant-negative tests, real budgets, separate environments and supervised remote deletion are outside mock scope; gate is not passed. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
