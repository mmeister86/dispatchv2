---
id: TASK-43.3
title: 'Modellaktivierung und Rückfall auf die Baseline absichern (P11.03, Teil 3)'
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
  - TASK-43.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-43
priority: medium
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P11.03. Verantwortung: convex/performance/models.ts; Aktivierung, Geltungsbereich und Rollback.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P11.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Nur dokumentiert verbesserte und freigegebene Modellversionen werden für ihren belegten Geltungsbereich aktiviert.
- [ ] #2 Rollback und Fallback auf statische Baseline funktionieren bei Fehlern oder Drift.
- [ ] #3 Historische Predictions behalten ihre Profil-/Modellreferenzen; Aktivierungs- und Rücknahmetests bestehen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
