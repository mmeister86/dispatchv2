---
id: TASK-50.1
title: >-
  Erzwinge optionale exakte Review-Policies in allen Freigabepfaden (P13.02,
  Teil 1)
status: To Do
assignee: []
created_date: '2026-10-06 16:13'
updated_date: '2026-10-06 23:14'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Nach technisch akzeptiertem 47/49 finale Source/Role/Team-/Lifecycle-Seams und alle Approval-/Schedule-Writer abgleichen.
2. Konkrete default-OFF Policy/immutable Stage-Entscheidungen und server-authored aktuelle Admission-/Frozen-Pins im gemeinsamen approve/checkApproval ergänzen.
3. Planning beide Modes, FirstWrite approve+confirm, reconcile continuation und pureMove-vs-newAdmission an dieselbe Grenze anbinden.
4. Quellen-/Reviewer-/Horizon-Masks und indexed physische Cleanup ohne Publishing-/Finanz-Löschung prüfen.
5. Registered native Writer/Policy/P1-P2/Text+Media/Replay/Lifecycle-Regressionen, Source-Freeze/fresh SPEC/distinct QUALITY, vollständige native/static/build/bundle/codegen und Root-Commit/exaktes EUDev; manuelle Done-Abnahme offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-only TASK50-preflight vollständig von Root gelesen und als .docs/reviews/task-50-review-preflight.md mit 14 stabilen Source-Hashes archiviert. Drei echte Approval-Inserts, zwei Schedule-Inserts, FirstWrite approve+confirm, direkte reconcile-Continuation und pureMove-vs-replacement sind verbindliche spätere Writer-Seams. resolveComment recheckt derzeit keine exakte Source; Assignment noch ohne CAS/key; bestehender Drawer/Mail-State ist kein recipient-nativer Readstate. Noch keine Source-/Test-/Review-/Dev-Abnahme; final47/49 zuerst technisch akzeptieren und dann erneut abgleichen.
<!-- SECTION:NOTES:END -->
