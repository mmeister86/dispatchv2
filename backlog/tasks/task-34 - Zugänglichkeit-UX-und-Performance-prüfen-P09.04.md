---
id: TASK-34
title: 'Zugänglichkeit, UX und Performance prüfen (P09.04)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p09
  - r3
milestone: m-3
dependencies:
  - TASK-26
  - TASK-29
  - TASK-30
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P09.04.
Phase: P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität.

**Abhängigkeit:** P07 und P08-Oberflächen. **Dateien:** `src/components/ui/`, betroffene Features, `tests/e2e/accessibility.spec.ts`, `.docs/decisions/ux-audit.md`.

- Kernabläufe vollständig per Tastatur und mit Screenreader prüfen; Fokusführung, Dialoge, Labels und Live-Status verbessern.
- Kalenderaktionen auch ohne Drag & Drop anbieten; Status nicht allein über Farbe vermitteln.
- Lange Threads, schmale Fenster, große Schrift, langsame Verbindungen und unterbrochene Uploads testen.
- Abfragen paginieren, Kalenderbereiche begrenzen, Editor-Reaktionszeit messen und Konflikte bei optimistischen Updates behandeln.
- Texte und Zeit-/Zahlenformate für spätere Lokalisierung vorbereiten; deutsche und englische Produktnutzung definieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J01–J08 sind ohne Maus benutzbar.
- [ ] #2 kein kritischer Text wird abgeschnitten.
- [ ] #3 lokale Eingabe bleibt flüssig.
- [ ] #4 ein KI-Aufruf blockiert weder Navigation noch Editor.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: All routes. Responsive layouts, semantic form labels, keyboard-accessible primitives/dialogs, focus/status affordances, light/dark appearance, calendar alternative to dragging and responsive local editing. Grenze: Full manual keyboard/screen-reader/large-font acceptance remains pending. No production performance claim. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
