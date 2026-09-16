---
id: TASK-22
title: 'Research Agent, Evidenz und Themencluster implementieren (P06.03)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p06
  - r2
  - arbeitspaket
milestone: m-2
dependencies:
  - TASK-21
  - TASK-22.1
  - TASK-22.2
  - TASK-22.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P06.03.
Phase: P06 – Eigenständiger proaktiver Recherche-Agent.

**Abhängigkeit:** P06.02. **Dateien:** `convex/ai/researchAgent.ts`, `convex/ai/researchTools.ts`, `convex/research/evidence.ts`, `convex/research/clusters.ts`, `convex/research/evaluate.ts`; Tests `tests/evals/research/`.

- Die zehn Schritte aus Abschnitt 6.3 als begrenzten, wiederaufnehmbaren Ablauf implementieren.
- Quellen, Behauptungen, eigene Interpretation und Datenlücken getrennt speichern.
- Themenduplikate, wiederaufgewärmte Meldungen, Quellenkopien und schon veröffentlichte Themen erkennen.
- Für geeignete Ergebnisse konkrete Account-Perspektiven und einen begründeten Gültigkeitszeitraum liefern.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D08: Gültigkeitsfenster und Prüfung zeitkritischer Inhalte festlegen.

Großes Paket: Die zugeordneten Unteraufgaben liefern die Implementierung in begrenzten Schritten. Dieses übergeordnete Ticket hält den vollständigen Planvertrag und wird erst nach integrierter Abnahme aller Unteraufgaben geschlossen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine kuratierte Stichprobe umfasst relevante, irrelevante, alte, widersprüchliche und bösartig instruierende Quellen.
- [ ] #2 Der Agent verlinkt echte gelieferte Quellen und erfindet keine URLs oder Trenddynamik.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
