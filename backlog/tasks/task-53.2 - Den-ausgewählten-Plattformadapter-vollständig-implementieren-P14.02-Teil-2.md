---
id: TASK-53.2
title: 'Den ausgewählten Plattformadapter vollständig implementieren (P14.02, Teil 2)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p14
  - r7
  - teilpaket
milestone: m-7
dependencies:
  - TASK-53.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-53
priority: medium
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P14.02. Verantwortung: Provider-Module nach der dokumentierten Kanalentscheidung; Nutzung des Vertrags aus P14.01.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P14.02. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Auth, Account-Capabilities, Inhaltsvalidierung, Medien und Veröffentlichung nutzen den gemeinsamen Provider-Vertrag.
- [ ] #2 Versionsfreigaben und Termine sind je Kanal getrennt; Fehler/Wiederaufnahme verhindern Doppelveröffentlichung.
- [ ] #3 Verfügbare Metriken und fehlende Fähigkeiten sind sichtbar; Export, Löschung und Token-Widerruf umfassen den neuen Provider.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/integrations, /drafts/:id, /calendar, /analytics. Supporting account/instance metadata, channel validation, media preview, independent outcomes and metric availability. Grenze: No actual platform adapter/OAuth/publishing/metrics or token lifecycle. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
