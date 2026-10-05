---
id: TASK-22.1
title: 'Research-Evidenz und Gültigkeitsvertrag implementieren (P06.03, Teil 1)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p06
  - r2
  - teilpaket
milestone: m-2
dependencies:
  - TASK-21
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-22
priority: high
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P06.03. Verantwortung: convex/research/evidence.ts; strukturierter Ergebnisvertrag aus §§6.1–6.3.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P06.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gelieferte Quellen, überprüfbare Behauptungen, Interpretation und Datenlücken werden getrennt gespeichert.
- [ ] #2 Account-Perspektive, Relevanz, Unsicherheit und begründeter Gültigkeitszeitraum sind je Ergebnis vorhanden.
- [ ] #3 Ungültige oder entfernte Evidenz kann nicht erneut als gültige Quelle übergeben werden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research — inbox/detail. Source URLs, source claim, interpretation, confidence and freshness warning remain visible in local content handoff. Grenze: Demo URLs are marked example sources. No real evidence validity/expiry enforcement or removed-source feed. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
