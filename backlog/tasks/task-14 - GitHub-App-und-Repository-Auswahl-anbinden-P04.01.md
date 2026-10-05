---
id: TASK-14
title: GitHub-App und Repository-Auswahl anbinden (P04.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p04
  - r2
milestone: m-2
dependencies:
  - TASK-5
  - TASK-1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P04.01.
Phase: P04 – GitHub und Arbeitssignale.

**Abhängigkeit:** P01.02, P00.01. **Dateien:** `convex/integrations/github/app.ts`, `convex/integrations/github/repositories.ts`, `src/features/settings/github.tsx`; Test `convex/integrations/github/app.test.ts`.

- Installation, persönliche und Organisations-Repositories sowie erlaubte Auswahl synchronisieren.
- Zugriff, Monitoring und Content-Erzeugung als getrennte Einstellungen modellieren.
- Entzug einzelner Repositories und Deinstallation verarbeiten.
- Projektkontext und erlaubten Umgang mit privaten Änderungen pro Repository erfassen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D05: Erlaubten Umfang privater Repository-Daten bestätigen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Nur freigegebene Repositories sind sichtbar.
- [ ] #2 deaktivierte Quellen erzeugen keine neuen Content-Aufträge.
- [ ] #3 GitHub-Login bleibt unabhängig.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/integrations, /onboarding. GitHub-login and repository-App installation are separate mock controls; repository selection/monitoring, event scope and private-context consent. Grenze: No GitHub App permission synchronization or actual repository data. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
