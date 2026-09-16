---
id: TASK-2
title: Fachliche Verträge und Release-Umfang fixieren (P00.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p00
  - r0
milestone: m-0
dependencies:
  - TASK-1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P00.02.
Phase: P00 – Machbarkeit und Produktverträge.

**Abhängigkeit:** P00.01. **Dateien:** `.docs/decisions/domain-contracts.md`, `.docs/decisions/release-scope.md`.

- Die Entscheidungen aus Abschnitt 1 sowie Zustandsautomaten aus Abschnitt 5 als verbindliche Grundlage festhalten.
- Account-Verknüpfung, Freigabe, Zeitzonen, Research-Aktualität und Fehlerwiederaufnahme anhand konkreter Beispiele beschreiben.
- Private Alpha, Dispatch-MVP, Beta und GA mit den genannten Nutzerabläufen abgrenzen.
- Offene Produktentscheidungen aus Abschnitt 16 jeweils einem Verantwortlichen und einem Entscheidungstor zuweisen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D04: Intelligence als Beta-Ausbau nach dem Dispatch-MVP bestätigen.
- D01–D17 mit Verantwortlichen und Entscheidungstoren führen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J01–J12 haben eine zugehörige Release-Stufe.
- [ ] #2 es gibt genau eine Definition des Dispatch-MVP und keine implizite autonome Veröffentlichung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
