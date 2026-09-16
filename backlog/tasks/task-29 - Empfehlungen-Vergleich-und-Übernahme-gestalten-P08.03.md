---
id: TASK-29
title: 'Empfehlungen, Vergleich und Übernahme gestalten (P08.03)'
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
  - TASK-8
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P08.03.
Phase: P08 – Algorithm Intelligence im Composer.

**Abhängigkeit:** P08.02, P02.02. **Dateien:** `src/features/intelligence/analysis-panel.tsx`, `src/features/intelligence/recommendation-diff.tsx`; Test `tests/e2e/intelligence.spec.ts`.

- Score, Teilwerte, Quellenstand und begrenzte Aussagekraft im Composer verständlich anzeigen.
- Verbesserungen mit Begründung und nachvollziehbarem Text-/Medien-Diff vorschlagen.
- Annahme erzeugt eine neue Entwurfsversion; mehrere Vorschläge können einzeln übernommen werden.
- Keine Reichweitengarantie, erfundene persönliche Erfahrung oder künstliche Engagement-Frage in Optimierungen zulassen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J07 funktioniert.
- [ ] #2 Ein Klick auf „Analysieren“ verändert keinen Text.
- [ ] #3 Übernommene Optimierung ersetzt keinen geplanten Inhalt und übernimmt keine frühere Freigabe.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
