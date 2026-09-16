---
id: TASK-30
title: Messgrundlage bereits in der Beta schaffen (P08.04)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p08
  - r3
milestone: m-3
dependencies:
  - TASK-28
  - TASK-12
  - TASK-1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P08.04.
Phase: P08 – Algorithm Intelligence im Composer.

**Abhängigkeit:** P08.02, P03.03 und Metrik-/Datenverwendungstor aus P00.01. **Dateien:** `convex/performance/capabilities.ts`, `convex/performance/snapshots.ts`, `convex/content/feedback.ts`; Test `convex/performance/snapshots.test.ts`.

- Verfügbare eigene Post-Metriken anhand tatsächlicher Credentials erfassen und deren Definition speichern.
- Einen kostengünstigen ersten Snapshot-Zeitplan aktivieren, beispielsweise 24 und 48 Stunden; weitere Fenster erst bei ausreichendem Budget.
- Annahme, Ablehnung und Bearbeitungsumfang der Entwürfe unabhängig von X-Metriken erfassen.
- Datenherkunft, Messalter und fehlende Felder so speichern, dass P11 darauf aufbauen kann.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D12: Konkreten Analysezweck und Datenverwendung freigeben; keine pauschale Trainingserlaubnis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Die Beta sammelt zulässige reale Daten, ohne bereits accountbezogene Wirksamkeit zu behaupten.
- [ ] #2 Ein nicht verfügbares Feld erscheint nicht als gemessene Null.
- [ ] #3 Der Collector kann pausiert und gelöscht werden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
