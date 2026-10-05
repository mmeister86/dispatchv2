---
id: TASK-25
title: Selektive Annahme und sichere Ausführung ermöglichen (P07.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 08:44'
labels:
  - p07
  - r2
milestone: m-2
dependencies:
  - TASK-24
  - TASK-8
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P07.02.
Phase: P07 – Kalenderbewusste Planung aus beiden Quellen.

**Abhängigkeit:** P07.01, P02.02. **Dateien:** `convex/planning/accept.ts`, `src/features/agent/plan-preview.tsx`, `src/features/calendar/proposed-items.tsx`; Test `tests/e2e/agent-planning.spec.ts`.

- Entwürfe prüfen, separat bearbeiten, freigeben und ausgewählte Slots annehmen lassen.
- Konflikte und Quellenfrische bei Annahme erneut prüfen.
- Angenommene Vorschläge deterministisch in geplante Posts überführen; übrige Vorschläge erhalten.
- Eine ausdrücklich beschriftete kombinierte Aktion „Version freigeben und planen“ erlauben, ohne eine implizite Freigabe aus bloßer Planansicht abzuleiten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D08: Quellenfrische vor Planung und Versand beachten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J06 funktioniert.
- [ ] #2 zwei angenommene von drei Vorschlägen ergeben genau zwei Termine.
- [ ] #3 Parallel geänderte Kalenderdaten werden erkannt und bestehende Einträge bleiben erhalten.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ausgewählte Vorschläge transaktional und idempotent mit erneut geprüfter Freigabe/Frische annehmen.
2. Genau einen Termin je angenommenem Element erstellen; keine Freigabe implizit erzeugen.
3. Doppelklick, Parallelannahme, Teilmenge und Slotkonflikt prüfen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /plans, /drafts/:id, /calendar. Review/edit proposals, independently approve concrete versions, select a subset and accept only selected slots; existing slots protected by local conflict checks. Grenze: No backend acceptance mutation, live source-freshness check or collaborative concurrency. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
