---
id: TASK-43.2
title: >-
  Kalibrierung gegen eine feste Baseline im Schattenbetrieb messen (P11.03, Teil
  2)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p11
  - r5
  - teilpaket
  - jev
milestone: m-5
dependencies:
  - TASK-43.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-43
priority: medium
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P11.03. Verantwortung: convex/performance/models.ts und versionierte Evaluation.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P11.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Globale Heuristik gegen workspace-/accountbezogene Dispatch-Gewichte und gegebenenfalls neue Entscheidungsschwellen vergleichen. Nur ausreichend besetzte Segmente mit normalisierten Outcomes auswerten; fehlende Historie behält die deklarierte Baseline. Änderungen an Jev-Fragen/Modellständen nicht mit Kalibrierungseffekten vermischen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Statische Baseline und einfache statistische Kalibrierung werden auf zeitlich getrennten Daten verglichen.
- [ ] #2 Schattenbetrieb berichtet Fallzahl, Stabilität, Drift und Fehler je Segment.
- [ ] #3 Unzureichende Daten oder fehlender Nutzen lassen das Kandidatenmodell inaktiv; komplexere Verfahren benötigen eigene Begründung.
- [ ] #4 Auswertung weist Versionsstände, Fallzahlen und normalisierte Vergleichsgruppen aus; unzureichende Daten aktivieren keine personalisierten Gewichte oder neuen Entscheidungsschwellen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /operations — Shadow-Kalibrierung. Mock shadow comparison displays sample size, quality, drift and error with insufficient-data gate. Grenze: Fixed example evaluation, not statistical evidence. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
