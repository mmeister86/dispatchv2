---
id: TASK-36.1
title: 'Getrennte Deployment-Umgebungen und Release-Smokes einrichten (P09.06, Teil 1)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p09
  - r3
  - teilpaket
milestone: m-3
dependencies:
  - TASK-4
  - TASK-29
  - TASK-30
  - TASK-31
  - TASK-32
  - TASK-33
  - TASK-34
  - TASK-35
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-36
priority: medium
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.06. Verantwortung: Cloudflare-/CI-Konfiguration und tests/e2e/release-smoke.spec.ts.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.06. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Staging/Produktion trennen Secrets, Domains, OAuth-Callbacks und Webhook-Ziele.
- [ ] #2 R2-Buckets, Credentials, CORS und Lifecycle-Konfiguration sind pro Umgebung getrennt.
- [ ] #3 Release-Smokes bestehen über echte Domains; Feature Flags erlauben schrittweise Aktivierung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
