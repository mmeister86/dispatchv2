---
id: TASK-19
title: Persistenten Chat und nachvollziehbare Agent-Arbeit liefern (P05.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p05
  - r2
milestone: m-2
dependencies:
  - TASK-18
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P05.03.
Phase: P05 – Agent-Grundlage, Content Agent und Chat.

**Abhängigkeit:** P05.02. **Dateien:** `convex/ai/conversations.ts`, `convex/ai/runs.ts`, `src/features/agent/chat.tsx`, `src/features/agent/action-cards.tsx`; Test `tests/e2e/agent-chat.spec.ts`.

- Konversationen sicher mit Workspace, Account und Component-Thread verknüpfen.
- Streaming, laufende Aktionen, Abbruch und Wiederaufnahme anzeigen.
- Tool-Ergebnisse als verlinkte Produktobjekte präsentieren; Vorschläge und ausgeführte Aktionen klar unterscheiden.
- Tokenverbrauch, Kosten, Modell-/Promptversion und Fehler im Run erfassen, ohne vertrauliche Inhalte in allgemeine Logs zu kopieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reload erhält Gespräch und erzeugte Objekte.
- [ ] #2 auch eine nach Abbruch fertig werdende Action darf keine neuen Content-/Planungsobjekte anlegen.
- [ ] #3 Ergebnis-, Fehler- und Verbrauchsabgleich bleiben zulässig.
- [ ] #4 Ein Nutzer kann einen anderen Component-Thread nicht über erratene IDs lesen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /agent. Account-scoped local conversations, simulated streaming/actions, stop/resume/error, linked draft proposal and mock step/cost states. Grenze: No Component threads, remote model streaming or token telemetry. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
