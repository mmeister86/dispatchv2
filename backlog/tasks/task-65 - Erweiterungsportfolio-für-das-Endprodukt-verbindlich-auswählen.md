---
id: TASK-65
title: Erweiterungsportfolio für das Endprodukt verbindlich auswählen
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p15
  - r8
  - gate
milestone: m-8
dependencies:
  - TASK-26
  - TASK-35
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
D14 und §13 in .docs/decisions/extension-portfolio.md konkretisieren. P15.01–P15.05 anhand Nutzerevidenz, API-Zugang, Kosten, Lifecycle und messbarem Nutzen einzeln auswählen, zurückstellen oder ablehnen. Die Entscheidung beauftragt nicht automatisch sämtliche Quellen und Medienvarianten.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md. Geplante Arbeit; Abnahme/Done erst nach ausdrücklicher Nutzerbestätigung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Für jedes P15-Paket ist Auswahl oder Zurückstellung mit Begründung dokumentiert.
- [ ] #2 Ausgewählte Quellen/Medien sind einzeln mit erlaubtem Datenumfang, Kostenlimit, Abnahme und Verantwortlichkeit benannt.
- [ ] #3 Nur ausgewählte P15-Tasks sind als zusätzliche technische Abhängigkeiten des Endprodukt-Gates eingetragen; nicht gewählte Optionen bleiben offen und blockieren das Gate nicht.
- [ ] #4 Die Auswahl und der Endprodukt-Umfang sind ausdrücklich vom Produktinhaber bestätigt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
