---
id: TASK-26
title: Dispatch-MVP anhand realer Redaktionsarbeit abnehmen (P07.03)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p07
  - r2
  - gate
milestone: m-2
dependencies:
  - TASK-16
  - TASK-25
  - TASK-63
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P07.03.
Phase: P07 – Kalenderbewusste Planung aus beiden Quellen.

**Abhängigkeit:** P04.03–P07.02 und Basisbetrieb aus P09. **Dateien:** `tests/e2e/core-loop.spec.ts`, `.docs/decisions/mvp-review.md`.

- J01–J06 und J08 mit freigegebenen Testaccounts durchlaufen.
- Eine Woche Content sowohl aus Projektarbeit als auch aus proaktiver Recherche vorbereiten und selektiv veröffentlichen.
- Quellenrichtigkeit, persönliche Passung, Editieraufwand und Kalendernutzen dokumentieren.
- Kritische Qualitäts- und Zuverlässigkeitsmängel vor Beta-Ausbau beheben.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Beide Quellen erzeugen tatsächlich akzeptierte Inhalte, nicht nur technisch gültige AI-Ausgaben.
- [ ] #2 Die Benutzerfreigabe des MVP wird ausdrücklich eingeholt und im Backlog dokumentiert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
