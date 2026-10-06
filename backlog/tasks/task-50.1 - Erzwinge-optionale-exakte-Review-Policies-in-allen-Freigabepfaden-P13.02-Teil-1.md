---
id: TASK-50.1
title: >-
  Erzwinge optionale exakte Review-Policies in allen Freigabepfaden (P13.02,
  Teil 1)
status: To Do
assignee: []
created_date: '2026-10-06 16:13'
labels: []
dependencies:
  - TASK-49.2
references:
  - .docs/team-review-continuation-contract.md
parent_task_id: TASK-50
priority: medium
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Kohäsive minimale gemeinsame native Review-Grenze nach49 und final45-47. Bestehende Kommentare/Zuweisungen wiederverwenden, keine zweite Freigabe/ACL. Editorial und Brand optional OFF, finale Owner/Admin Pflicht. Root entscheidet frozenPolicy-Vertrag wie referenziert; Auflösungen/Assignment sind keine Approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Default-OFF Policy erhält Single-User-Finalfreigabe; enabled stages binden aktuelle echte Rollen, immutable Version/Account/Policy und terminale Withdrawal/CAS/Replay.
- [ ] #2 Shared approve/checkApproval, Planning beideModes, Scheduler/send, FirstWrite und reconcile continuation erzwingen denselben aktuellen Admission-/Frozen-Pin-Vertrag.
- [ ] #3 P1-Approval kann unter P2 keinen neuen Termin autorisieren; existierender Frozen-P1 und pureMove bleiben mit currentSource/Reviewer gültig, ohne Auto-Cancel/Rewrite/Reactivation.
- [ ] #4 Neue Reviews werden bei Quellen-/Autoritätsverlust sofort maskiert und indexiert physisch bereinigt; Publishing-/Finanz-Eltern bleiben, fresh SPEC/QUALITY nach Freeze dokumentiert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind dokumentiert.
- [ ] #2 Der Nutzer bestätigt nach manueller Prüfung ausdrücklich die Freigabe zum Done-Status.
<!-- DOD:END -->
