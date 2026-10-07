---
id: TASK-49.1
title: >-
  Implementiere verifizierte Einladungen, atomare Rollen und Workspace-Recovery
  (P13.01, Teil 1)
status: In Progress
assignee: []
created_date: '2026-10-06 16:13'
updated_date: '2026-10-07 00:44'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Finale45–47-Proofs und eigene User-/Store-Recovery-Caller abgleichen.
2. Verifizierte native Invitation/Command-Receipts und begrenzte aktuelle Scope-/Recipient-Autorität implementieren.
3. Owner/Admin-Matrix, atomaren Transfer/LastOwner und genuine PublicInvite-Join vor realen Folgeeffekten prüfen.
4. User-/Store-Recovery, echte Viewer-Preferences und eingeführte indexierte Cleanup-Kanten verbinden.
5. Native Checks/Consumer-Kompatibilität, SourceReadySTOP, finaleCodegen/Freeze/freshSPEC/distinctQUALITY/rootGanzsuite/Commit/exaktesEUDev; manualDone bleibt offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-onlyVorarbeit .docs/reviews/task-49-team-preflight.md von getrenntemTeam/Authority-Spezialisten, rootvollständiggelesen; baseline8cfdf19/accepted46.1, moving46.2 ausdrücklichkeinReview. Sharedusers.current Recovery blockiert aktuell verloreneactiveMembership, nimmtinactiveWorkspace-Daten undmissinginvitedPrefs nicht sicherauf. Minimumverifiedauth-only öffentlicheInviteCommands/nativeMemberCAS/lastOwner/privatecap+1/realViewerPreferences und Recovery ohne requireWorkspace zu schwächen. GegenactualAgent/Research/Jev/history/text/media/firstWrite/continuation next-boundaries nachpublicInvitejoin testen; originalLateMoney/possibleEffects bleiben. Final45–47 und APIs vorSource erneutreconciliieren; keine neuenTests/Source/Provider/Abnahme durchPreflight, StatusToDo.

Zusätzlicher konkreter zukünftiger SoleWriterBrief /tmp/dispatch-49.1-writer-brief.md vorbereitet aus dem vollständig gelesenen durable Team-Preflight/Vertrag. Keine SourceFreigabe vor final akzeptierter47.2; aktuelle45-47-Proofs und native Caller vor Implementierung erneut abgleichen. Native auth-only Recovery/Viewer-Preferences, verified live Recipient, OCC-lastOwner/Receipts und introduced indexed Cleanup zuerst; actual Team/Auth-UI/optional Mail bleibt49.2.

Finaler Read-only-Abgleich gegen corrected47.2Freeze363e5ae6 übernommen in task-49-final47-seams.md/-source.json; Root hat alle30Repository-Dateihashes bestätigt. Zwei Briefpräzisierungen vor zukünftiger Sourcefreigabe: final46Series und47Creator/Reviewer haben reale ursprüngliche Membership-ID/Creation/Auth-Pins, Remove+Insert darf alteManifeste nicht erneuern; SameRowRoleRegrant bleibt getrennt. Minimale src/lib/store.tsx-Recovery-Response-Kompatibilität gehört49.1, vollständige Team/AuthInvitation/Mail49.2. SoleStorecaller muss unresolvedSnapshot/alteScopeBuffers vor protectedQuery/preferencesDestructure sperren. Tatsächliche47.2Software/Dev-Abnahme fehlt noch; Task bleibt To Do, keinSource/Test/Provider/ManualDone-Claim.

Sourcevoraussetzung47.2 technisch akzeptiert4f2996b:1065/51kompletteTests/711.579s/freshSPEC/distinctQUALITY/static/codegen/build/bundle; exaktesEUDev00:43:38UTC/383actualEntries/exakt2newinternal/5HTTPunchanged/319Hashesunchanged. Root vorbereitet finalen SoleWriterBrief samt exakten47.2ReleaseFacts und adopted49-final47-seams; genau einSourceWriter nach Root-Verifikationsdocscommit. Kein tatsächlicher Mail/Provider/Grants/TeamUI49.2- oder manuelleDone-Claim.
<!-- SECTION:NOTES:END -->
