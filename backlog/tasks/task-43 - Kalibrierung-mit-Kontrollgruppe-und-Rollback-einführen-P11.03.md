---
id: TASK-43
title: Kalibrierung mit Kontrollgruppe und Rollback einführen (P11.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 12:22'
labels:
  - p11
  - r5
  - arbeitspaket
  - jev
milestone: m-5
dependencies:
  - TASK-42
  - TASK-43.1
  - TASK-43.2
  - TASK-43.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P11.03.
Phase: P11 – Performance Feedback und Account Intelligence.

**Abhängigkeit:** P11.02, ausreichende Daten und Freigabe der Datenverwendung. **Dateien:** `convex/performance/calibration.ts`, `convex/performance/models.ts`, `tests/evals/calibration/`.

- Messbare Lernziele festlegen; Content-Heuristiken und tatsächlich beobachtete Outcomes getrennt halten.
- Statische Baseline, einfache statistische Kalibrierung und gegebenenfalls komplexere Verfahren anhand zeitlich getrennter Daten vergleichen.
- Neue Modelle im Schattenbetrieb auswerten und Fallzahl, Stabilität, Drift und Fehler je Segment berichten.
- Aktivierung, Rückfall auf Baseline und Rücknahme einer Modellversion implementieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D12: Lernverfahren, ausreichende Daten und Verwendungsrechte vor Aktivierung prüfen.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).

Großes Paket: Die zugeordneten Unteraufgaben liefern die Implementierung in begrenzten Schritten. Dieses übergeordnete Ticket hält den vollständigen Planvertrag und wird erst nach integrierter Abnahme aller Unteraufgaben geschlossen.

### JEV-Abgleich vom 18.09.2026

Kalibriert werden Dispatch-eigene Scoregewichte und gegebenenfalls Routing-/Verifier-Schwellen; Jev selbst wird weder trainiert noch darf es eigene Gewichte ändern. Semantische Inhaltsmerkmale bleiben von Outcome-Prognosen getrennt. Fragen-/Modell-/Formel-/Policy-Versionen, erlaubter Datenzweck und normalisierte Performance sind Teil jedes Evaluationsstands. Startwerte aus dem Guide sind zu prüfende Hypothesen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kein Trainingsbeispiel nutzt zukünftige Messwerte.
- [ ] #2 kleine oder verschobene Datensätze aktivieren kein scheinpräzises Modell.
- [ ] #3 Ein Modell wird nur mit dokumentierter Verbesserung und nachvollziehbarem Geltungsbereich produktiv.
- [ ] #4 Kalibrierungsänderungen betreffen versionierte Dispatch-Gewichte/Policies; kein Jev-Training und keine selbständige Gewichtsänderung durch den Provider.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /operations — Shadow-Kalibrierung. Candidate/baseline form, synthetic sample/drift/error scenarios, blocked/allowed activation, version log and rollback. Grenze: No real learning, calibration, holdout data, measured improvement or Jev training. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

ROOT releases software subtask43.1 after accepted25/42: .docs/calibration-reference-contract.md. Separate default-OFF local-learning purpose, bounded lawful temporal reference snapshots and real Operations reference UI only. Actual use rights/adequate empirical data remain unresolved; no fitted candidate, paid provider reads, model activation or efficacy claim. 43.2/43.3 follow reviewed43.1; parent/manual DoD remain In Progress.

43.1 scoped native-reference software accepted at e5bae9cf after fresh SPEC then QUALITY; exact original lineage/default-OFF separate purpose/current proofs/retention/real Operations. Evidence .docs/reviews/task-43.1-calibration-reference-validation.md. 43.2 released via .docs/calibration-model-contract.md for passive train-only fit and two-block comparison. Parent empirical improvement/real rights/human manual/Done remain OPEN; no model activation43.1/43.2.
<!-- SECTION:NOTES:END -->
