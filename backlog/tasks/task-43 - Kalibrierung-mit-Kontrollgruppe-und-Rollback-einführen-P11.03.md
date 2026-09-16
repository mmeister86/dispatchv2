---
id: TASK-43
title: Kalibrierung mit Kontrollgruppe und Rollback einführen (P11.03)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p11
  - r5
  - arbeitspaket
milestone: m-5
dependencies:
  - TASK-42
  - TASK-43.1
  - TASK-43.2
  - TASK-43.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kein Trainingsbeispiel nutzt zukünftige Messwerte.
- [ ] #2 kleine oder verschobene Datensätze aktivieren kein scheinpräzises Modell.
- [ ] #3 Ein Modell wird nur mit dokumentierter Verbesserung und nachvollziehbarem Geltungsbereich produktiv.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
