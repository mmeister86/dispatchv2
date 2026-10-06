---
id: TASK-49.1
title: >-
  Implementiere verifizierte Einladungen, atomare Rollen und Workspace-Recovery
  (P13.01, Teil 1)
status: To Do
assignee: []
created_date: '2026-10-06 16:13'
updated_date: '2026-10-06 22:01'
labels: []
dependencies: []
references:
  - .docs/team-review-continuation-contract.md
parent_task_id: TASK-49
priority: medium
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Erstes kohäsives natives Team-Paket nach final45-47-Reconciliation. Bestehende BetterAuth-Identität und Memberships nutzen; opaque Invite-ID ist nur Referenz, Zielverifiedemail ist Authority. Native Invitation/Command/OCC/currentrole/LastOwner/Recovery; keine neue Orgplugin/ACL, kein tatsächlicher Mailversand. Root besitzt Commit/Dev und Metadaten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Aktuelle verifizierte Zielidentität erhält über echte öffentliche Invitation-Commands höchstens eine Membership; exaktes Replay, Ablauf, Scope, Race und unchanged already-member Role sind geprüft.
- [ ] #2 Native Owner/Admin-Matrix, atomarer Transfer, konkurrierender Last-Owner-Schutz und current-actor Revocation bei Arbeit sind geprüft; keine kommerzielle Entitlement-Behauptung.
- [ ] #3 Verlust aktiver Membership hat sicheren User-/Store-Recovery-Vertrag und Viewer-Beitritt benötigt keine unzulässige Onboarding-Präferenzmutation.
- [ ] #4 Neue Einladungs-/Actor-/Consumption-Daten haben begrenzte Cleanup-/Inventory-Kanten; Freeze, frisches SPEC und separate QUALITY dokumentieren Softwaregrenzen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind dokumentiert.
- [ ] #2 Der Nutzer bestätigt nach manueller Prüfung ausdrücklich die Freigabe zum Done-Status.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-onlyVorarbeit .docs/reviews/task-49-team-preflight.md von getrenntemTeam/Authority-Spezialisten, rootvollständiggelesen; baseline8cfdf19/accepted46.1, moving46.2 ausdrücklichkeinReview. Sharedusers.current Recovery blockiert aktuell verloreneactiveMembership, nimmtinactiveWorkspace-Daten undmissinginvitedPrefs nicht sicherauf. Minimumverifiedauth-only öffentlicheInviteCommands/nativeMemberCAS/lastOwner/privatecap+1/realViewerPreferences und Recovery ohne requireWorkspace zu schwächen. GegenactualAgent/Research/Jev/history/text/media/firstWrite/continuation next-boundaries nachpublicInvitejoin testen; originalLateMoney/possibleEffects bleiben. Final45–47 und APIs vorSource erneutreconciliieren; keine neuenTests/Source/Provider/Abnahme durchPreflight, StatusToDo.
<!-- SECTION:NOTES:END -->
