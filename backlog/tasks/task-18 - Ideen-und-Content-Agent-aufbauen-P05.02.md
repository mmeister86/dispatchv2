---
id: TASK-18
title: Ideen und Content Agent aufbauen (P05.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p05
  - r2
milestone: m-2
dependencies:
  - TASK-17
  - TASK-7
  - TASK-15
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P05.02.
Phase: P05 – Agent-Grundlage, Content Agent und Chat.

**Abhängigkeit:** P05.01, P02.01, P04.02. **Dateien:** `convex/content/ideas.ts`, `convex/ai/contentAgent.ts`, `convex/ai/contentTools.ts`, `src/features/ideas/`; Test `convex/ai/contentAgent.test.ts`.

- Ideen als strategische Ebene mit Perspektive, Quellen und Priorität implementieren.
- Agent-Werkzeuge zum Lesen des Kontexts und Erstellen von Ideen/Entwurfsversionen anbieten.
- Manuelle Notizen, Gesprächsinhalte und Arbeitssignale als mögliche Ausgangspunkte integrieren.
- Ablehnung und Änderung als Feedback speichern; unbelegte Projekterfolge oder erfundene Erfahrungen verhindern.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J03 führt zu einer belegbaren Idee und einem editierbaren Entwurf.
- [ ] #2 Der Agent begründet seine Auswahl, veröffentlicht nichts und behauptet keinen Zustand ohne Tool-Ergebnis.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
