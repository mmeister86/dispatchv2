---
id: TASK-62
title: 'Schattenbetrieb, Kill Switch und begrenzten Pilot durchführen (P16.02)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p16
  - r9
  - optional
milestone: m-9
dependencies:
  - TASK-61
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P16.02.
Phase: P16 – Optionale kontrollierte Autonomie.

**Abhängigkeit:** P16.01. **Dateien:** `convex/automation/shadow.ts`, `convex/automation/controls.ts`, `.docs/runbooks/autonomy.md`.

- Zunächst nur zeigen, welche Inhalte unter der Policy veröffentlicht worden wären.
- Fehlentscheidungen, Abstimmungen mit dem Nutzer und übersehene Risiken auswerten.
- Erst nach ausdrücklicher Pilotfreigabe einen eng begrenzten realen Betrieb aktivieren.
- Globalen und accountbezogenen Stop sowie verständliche rückblickende Übersicht anbieten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Stop wirkt auf noch nicht extern ausgeführte Schritte.
- [ ] #2 die verbleibende Grenze bei bereits angenommenen Provider-Aufrufen ist sichtbar.
- [ ] #3 Das Produkt bleibt vollständig nutzbar, wenn diese optionale Stufe dauerhaft deaktiviert bleibt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/automation. Shadow candidate review/history, global/account stops, local limits and retrospective decisions; manual calendar remains independent. Grenze: No autonomous pilot or background execution; externally accepted calls cannot be undone by this UI. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
