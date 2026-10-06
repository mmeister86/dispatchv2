---
id: TASK-43.2
title: >-
  Kalibrierung gegen eine feste Baseline im Schattenbetrieb messen (P11.03, Teil
  2)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 12:22'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace accepted43.1 native proof/retention/callers and approved .docs/calibration-model-contract.md.
2. Implement immutable passive experiment/candidate/evaluation with train-only native proof, canonical9-transfer ranking and two-block diagnostics; default empirical policy null/inactive.
3. Wire real scoped Operations controls/results and explicit configuration/expiry/error guidance; preserve Jev/static score/cache/Demo.
4. Verify native chronology/no-heldout-fit/rights/retention/capacity/replay, current styled desktop390 UI and appropriate full/static/build/bundle/Dev checks with actual frozen evidence.
5. Freeze exact11SOURCE, scoped master commit after ROOT approval, fresh SPEC then QUALITY and same-writer fixes; actual rights/empirical/manual/Done remain OPEN.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /operations — Shadow-Kalibrierung. Mock shadow comparison displays sample size, quality, drift and error with insufficient-data gate. Grenze: Fixed example evaluation, not statistical evidence. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

ROOT releases scoped engineering implementation after reviewed43.1 e5bae9cf; exact11SOURCE ownership/closed-nine train-only proof/predeclaration/retention/UI gates in .docs/calibration-model-contract.md. Actual empirical thresholds are not invented or seeded; null policy forever diagnostic/inactive, actual configured evidence/consent required. One experiment/spec, one immutable candidate, future-policy/freeze chronology, no production activation/resolver until43.3.
<!-- SECTION:NOTES:END -->
