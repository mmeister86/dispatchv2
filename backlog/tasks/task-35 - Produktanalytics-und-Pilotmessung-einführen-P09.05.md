---
id: TASK-35
title: Produktanalytics und Pilotmessung einführen (P09.05)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p09
  - r3
milestone: m-3
dependencies:
  - TASK-26
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P09.05.
Phase: P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität.

**Abhängigkeit:** P07.03. **Dateien:** `src/lib/analytics.ts`, `convex/operations/productEvents.ts`, `.docs/decisions/metric-definitions.md`; Test `convex/operations/productEvents.test.ts`.

- PRD-Ereignisse um Research-Quelle, Planannahme und Intelligence-Nutzung ergänzen, ohne private Inhaltsdaten zu übertragen.
- Erfolgreiche Hintergrundveröffentlichungen serverseitig messen; ein geschlossener Browser darf sie nicht unsichtbar machen.
- Aktivierung, Quellenakzeptanz, Editieraufwand, Zeitersparnis und Kosten je akzeptiertem Entwurf definieren.
- Session-Replay nur nach passender Produkt-/Datenschutzentscheidung und mit wirksamer Maskierung sensibler Flächen einsetzen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ereignisse werden bei Wiederholung nicht doppelt gezählt.
- [ ] #2 kein Prompt, Diff, Token, Textentwurf oder E-Mail-Inhalt wird ungeplant an Analytics übergeben.
- [ ] #3 Das Pilot-Dashboard beantwortet die Fragen aus Abschnitt 12.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
