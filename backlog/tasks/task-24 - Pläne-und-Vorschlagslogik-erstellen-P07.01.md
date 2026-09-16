---
id: TASK-24
title: Pläne und Vorschlagslogik erstellen (P07.01)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p07
  - r2
milestone: m-2
dependencies:
  - TASK-13
  - TASK-19
  - TASK-23
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P07.01.
Phase: P07 – Kalenderbewusste Planung aus beiden Quellen.

**Abhängigkeit:** P03.04, P05.03, P06.04. **Dateien:** `convex/planning/plans.ts`, `convex/planning/propose.ts`, `convex/planning/conflicts.ts`; Test `convex/planning/plans.test.ts`.

- Anzahl, Zeitraum, Account und Präferenzen als strukturierten Planauftrag erfassen.
- Kalender, relevante Arbeitssignale, Research und bisherige Inhalte zusammenführen.
- Themenmix, Wiederholungen, Gültigkeit und nutzerdefinierte Zeitfenster berücksichtigen.
- Für jedes Planelement Quellen, konkrete Entwurfsversion, Slot und Auswahlgrund speichern.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Plan kann ausschließlich aus Recherche, ausschließlich aus Arbeit oder gemischt entstehen.
- [ ] #2 Zu wenig geeignetes Material führt zu einem ehrlichen kleineren Plan und keiner beliebigen Auffüllung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
