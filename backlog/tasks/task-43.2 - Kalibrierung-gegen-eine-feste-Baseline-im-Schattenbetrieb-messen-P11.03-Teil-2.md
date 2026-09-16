---
id: TASK-43.2
title: >-
  Kalibrierung gegen eine feste Baseline im Schattenbetrieb messen (P11.03, Teil
  2)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p11
  - r5
  - teilpaket
milestone: m-5
dependencies:
  - TASK-43.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-43
priority: medium
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P11.03. Verantwortung: convex/performance/models.ts und versionierte Evaluation.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P11.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Statische Baseline und einfache statistische Kalibrierung werden auf zeitlich getrennten Daten verglichen.
- [ ] #2 Schattenbetrieb berichtet Fallzahl, Stabilität, Drift und Fehler je Segment.
- [ ] #3 Unzureichende Daten oder fehlender Nutzen lassen das Kandidatenmodell inaktiv; komplexere Verfahren benötigen eigene Begründung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
