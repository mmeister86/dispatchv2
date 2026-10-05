---
id: TASK-53.3
title: 'Kanalvarianten und vollständigen Multi-Channel-Loop abnehmen (P14.02, Teil 3)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p14
  - r7
  - teilpaket
  - jev
milestone: m-7
dependencies:
  - TASK-53.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-53
priority: medium
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P14.02. Verantwortung: tests/e2e/multichannel.spec.ts und Settings-/Composer-Integration.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P14.02. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Für X und den tatsächlich ausgewählten Kanal je Variante eigene Version/Freigabe behalten. Geeigneten Originaltext unverändert wiederverwenden können; keine pauschale Erzeugung mehrerer Rewrites allein wegen mehrerer Zielkanäle. Spätere Jev-Network-Fit-Empfehlungen aus TASK-54 ändern nur nach Nutzerübernahme den Entwurf; dieses Gate verlangt noch keine zusätzliche unbestellte Plattform.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine gemeinsame Idee wird in passende Länge, Struktur und Ton für X und den gewählten Kanal überführt.
- [ ] #2 J11 besteht mit getrennten Versionen, Freigaben, Zeitpunkten und Ergebnissen.
- [ ] #3 Fehler auf einem Kanal verändert keinen erfolgreichen Status auf dem anderen; reale Provider-Abnahme ist dokumentiert.
- [ ] #4 Ein bereits geeigneter Originaltext kann kanalübergreifend verwendet werden, während Versionen, Freigaben, Providergrenzen und Versandzustände unabhängig bleiben.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id, /calendar. Choose target account and preserve original text array/media in linked channel variant; separate approval, schedule and result; suitable original text is reused unchanged. Grenze: No semantic channel adaptation or real end-to-end provider acceptance. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
