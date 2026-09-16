---
id: TASK-28
title: Begrenzte Pre-Publish-Analyse implementieren (P08.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p08
  - r3
milestone: m-3
dependencies:
  - TASK-27
  - TASK-17
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P08.02.
Phase: P08 – Algorithm Intelligence im Composer.

**Abhängigkeit:** P08.01, P05.01. **Dateien:** `convex/intelligence/analyze.ts`, `convex/intelligence/predictions.ts`, `convex/intelligence/scoring.ts`; Tests `convex/intelligence/scoring.test.ts`, `tests/evals/intelligence/`.

- Konkrete Entwurfsversion mit Account, freigegebenem Profil und verfügbarer Historie analysieren.
- Semantische Passung, LLM-Bewertungen und deterministische Aggregation getrennt nachvollziehbar machen.
- Wertebereiche, fehlende Komponenten, Risiko-Flags und maximal drei priorisierte Empfehlungen validieren.
- Analyse nach Input-Fingerprint cachen; veraltete Predictions bei neuer Version sichtbar kennzeichnen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cold Start funktioniert.
- [ ] #2 identische gespeicherte Komponenten ergeben denselben Aggregatscore.
- [ ] #3 ungültige Modellantworten werden nicht als Erfolg dargestellt.
- [ ] #4 fehlende Analyse blockiert manuelles Publishing nicht.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
