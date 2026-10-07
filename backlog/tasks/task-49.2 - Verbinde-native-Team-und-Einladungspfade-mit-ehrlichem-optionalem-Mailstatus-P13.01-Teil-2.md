---
id: TASK-49.2
title: >-
  Verbinde native Team- und Einladungspfade mit ehrlichem optionalem Mailstatus
  (P13.01, Teil 2)
status: To Do
assignee: []
created_date: '2026-10-06 16:13'
updated_date: '2026-10-07 01:31'
labels: []
dependencies:
  - TASK-49.1
references:
  - .docs/team-review-continuation-contract.md
parent_task_id: TASK-49
priority: medium
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nach akzeptiertem49.1 reale Team/Demo-Split, auth-only Acceptance und notwendige Store-Recovery an native Commands anbinden. Bestehender direct-fetch Resend nur als optional explicit-send Vertrag/interceptierte Tests; keine neuen Provider/Komponenten oder tatsächliche Emails. Keine50-Reviewpolicy-Mockfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cloud-Team zeigt tatsächliche Mitglieder/Invite-Resultate; verified Acceptance-Route außerhalb aktiver Workspace-Bootstrap-Abhängigkeit erhält sicheren Login-/Verify-Returnpath und Viewer-Entry.
- [ ] #2 Awaited exakte Commands behalten Dirty/Retry-Intent und Account-/Workspace-/Rollen-Epochs; styled echte Routen Desktop/390px/Demo sind geprüft.
- [ ] #3 Optionaler bestehender Resend-Pfad hat durable Claim, unveränderte bounded Idempotenz, accepted-vs-unknown Wahrheit und currentInvite-Proof; fehlende Konfiguration gibt null Calls, keine Live-Mail-Abnahme.
- [ ] #4 Eingeführte Delivery-/Recipient-Daten und Cleanup sind inventarisiert; Source-Freeze, frisches SPEC, distinct QUALITY und root EU dokumentiert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind dokumentiert.
- [ ] #2 Der Nutzer bestätigt nach manueller Prüfung ausdrücklich die Freigabe zum Done-Status.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-onlySpezialisten-Vorarbeit .docs/reviews/task-49-team-preflight.md angenommen: nativeTeam/DemoSplit+auth-onlyverifiedInvitationReturnRoute+StoreRecovery auf separataccepted49.1, keine localGuest/Support/Review50Mockfreigabe. OptionalResend viaexistingdirectFetch: explicitSend/durableClaim/fixedunchangedbytes+key/originalboundedwindow/providerAccepted≠delivered, currentInviteAuthority, unknown/lateOriginalReceipt undPersonalCleanup vorConsumer. Keine tatsächlicheMail, keineSecretsgeprüft, aktuelleProviderdocs vorImplementation viactx7. Styles/desktop390/nativeRoute/dirtyretry/role-workspace-unmount-expiry; reineVorarbeitkeineImplementierung/Review/Done.

Focusedreadonly final49source UI/auth preflight adopted task-49.2-final49-ui-preflight.md/-source.json; root18repositoryhashes inclcontract+brief verified against historicalb908freeze (49.1QUALITYcorrection/fullsuite/Dev stillpending). Explicit sharedverifiedAuthBoundary auth-only invitationRoute must bypass WorkspaceStoreProvider/AppShell; callback signup/reverification currently forces invitation via onboarding. Actual previewworkspaceId captured beside immutableaccept args then awaited nativeworkspaces.select; acceptresult hasnoworkspaceId and preview no recipientemail (own verifiedsessionemail onlyifdisplayneeded). CloudTeamallowlist/nativeDemo dispatcher beforemockbody; original50review/guests/support unavailable. ExistingdirectResend syntaxonly, noactualdurableinvite deliveryyet. No source/tests/providers/manual acceptancebyreadonlyreport.
<!-- SECTION:NOTES:END -->
