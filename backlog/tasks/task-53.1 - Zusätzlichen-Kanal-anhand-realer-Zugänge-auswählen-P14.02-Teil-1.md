---
id: TASK-53.1
title: 'Zusätzlichen Kanal anhand realer Zugänge auswählen (P14.02, Teil 1)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-07 17:22'
labels:
  - p14
  - r7
  - teilpaket
milestone: m-7
dependencies:
  - TASK-52
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-53
priority: medium
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P14.02. Verantwortung: .docs/decisions/additional-channel.md; Entscheidung D09/D14.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P14.02. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LinkedIn, Bluesky und Mastodon sind nach Zielgruppe, API-Zugang, Kosten und Betriebsaufwand verglichen.
- [ ] #2 Genau ein nutzbarer Kanal ist vom Produktinhaber ausgewählt; keine Fähigkeiten werden ohne Zugang versprochen.
- [ ] #3 Konkrete Adapterdateien, Auth-/Medien-/Metrikfähigkeiten und Abnahmetests des gewählten Kanals sind vor Coding festgelegt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nutzerklärung im Fortsetzungs-Chat am07.10.2026: künftig sind grundsätzlich alle Social-Media-Kanäle vorstellbar; aktuell bestehen keine API-Vorbereitungen. Eine LinkedIn-App wurde für v1 angelegt. Root plant LinkedIn als ersten zu untersuchenden zusätzlichen Kanal; dies ist noch kein bestätigter nutzbarer API-Zugang, keine fertige Provider-Auswahl/AC2-Abnahme und kein Aktivierungsbeleg. Vergleich/Zugangsprüfung und konkreter Adaptervertrag bleiben vor Umsetzung erforderlich; laufende native Backend-Pakete werden unabhängig fortgesetzt.
<!-- SECTION:NOTES:END -->
