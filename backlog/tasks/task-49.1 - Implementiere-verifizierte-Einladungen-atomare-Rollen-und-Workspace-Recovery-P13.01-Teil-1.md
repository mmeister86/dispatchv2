---
id: TASK-49.1
title: >-
  Implementiere verifizierte Einladungen, atomare Rollen und Workspace-Recovery
  (P13.01, Teil 1)
status: In Progress
assignee: []
created_date: '2026-10-06 16:13'
updated_date: '2026-10-07 01:59'
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
- [x] #1 Aktuelle verifizierte Zielidentität erhält über echte öffentliche Invitation-Commands höchstens eine Membership; exaktes Replay, Ablauf, Scope, Race und unchanged already-member Role sind geprüft.
- [x] #2 Native Owner/Admin-Matrix, atomarer Transfer, konkurrierender Last-Owner-Schutz und current-actor Revocation bei Arbeit sind geprüft; keine kommerzielle Entitlement-Behauptung.
- [x] #3 Verlust aktiver Membership hat sicheren User-/Store-Recovery-Vertrag und Viewer-Beitritt benötigt keine unzulässige Onboarding-Präferenzmutation.
- [x] #4 Neue Einladungs-/Actor-/Consumption-Daten haben begrenzte Cleanup-/Inventory-Kanten; Freeze, frisches SPEC und separate QUALITY dokumentieren Softwaregrenzen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind dokumentiert.
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

SoleWriter benötigt neueTeam-API-Typen; Root intermediatescodegen --typecheck enable erzeugtBindings, GesamtlaufExit1 wegen ungeprüfterReady-Fixtures nach neuer users.current-RecoveryUnion. FAILED/INCOMPLETE beweglicherZwischenstand, keinFinalGate/Dev. VollständigerLog/HashReceipt dispatch-continuation-49.1-codegen-intermediate-* bewahrt. EngeOwnershipErweiterung für tatsächliche state===ready-Narrowing vorhandenerTests/Fixtures und echteRecovery-/weiterhinDeniedProtectedScope-Negative autorisiert; keineTestlöschung/Count-/Limitabschächung/!Maskierung. FinaleCodegen/Freeze/Reviews erstSOURCE_READY STOP.

Konkreter Actor-Fence-Befund während SupportingBrowser: key aus users.current.userId allein verhindert verspätete alteDiscoveryResponse bei neuem BetterAuthSessionActor nicht. Enge gemeinsameRootCause-Korrektur im bereits owned users.current/Store autorisiert: aktuelles eigenes serverauthId, Vergleich mit aktueller verifizierter AuthClientSession vor protectedqueries/projection und actor-scopedBootstrapCompletion. Tatsächliches installedSDK +currentofficialctx7Identity-Mapping statt Fixture-Annahme prüfen; lateoldReady UND Recovery/UserSwitch/Bootstrap explizit testen. Kein globalerEpoch/AuthBoundaryRedesign/neueDependency; Source noch beweglich, keinFinalGateClaim.

SOURCE_READY15ownedpaths:31/3native plus302/10existing regression checks; root65source/log/pixelhashes verified. Finalcodegen TypeScript exit0,323-sourcefreeze519880a1c943fda17afa7288a9519ecfa2ab81f25820b337fda5bdd914c76e2a and all rootstatic checks pass. Fresh independentSPEC confirms introduced command lifecycle gap: after actual public issue and root missing/deleting, preview masks and sweep clears invite payload but original unexpired command fingerprint/result remain. Original3public repros, rejected freeze/source/static/handoff preserved; no whole-suite/commit/Dev/AC acceptance claim. Shared existing sweep correction and unchanged independent RED reruns before fresh corrected freeze/reviews.

Corrective SOURCE_READY STOP: narrow team.ts/shared currentCommand+clearCommand and registered2regressions only;321other source/config hashes and4independent repro/config files unchanged. Root13repairartifact hashes verified/full handoff+diff read. Existing indexed by_cleanAfter>nul page50 now rechecks native actor/live workspace/member/original operation role/expiry and continues behind eligiblepages; no schema/API/newregistry. Original10/2 independent now allPASS incl3originalREDs,33/3native,302/10affected support; registered meaningfulRED preserved. Corrected final rootcodegen exit0/new323freeze b908327aa55b9e14e0e837535c929a696ff8f626503ffb1d021b6a2802d9323a; fresh correctedSPEC pending. Original rejectedSPEC/source/static/failures preserved, no whole-suite/Dev/AC/Done claim.

Fresh correctedSPEC PASS: original10/2 unchanged controls and3priorRED→GREEN,33/3registered,1/1 command-phase unknown-fault transaction rollback; root13artifact hashes verified. DistinctQUALITY detects concrete productionStore ABA pending-operation gap (A→B→A; old request completion reenables button while newer create still pending). Root stopped own whole-native run SIGINT actualExit130, no matching processes; partiallog/323b908freeze/static/SPEC/source preserved under dispatch-continuation-49.1-before-quality-fix. INTERRUPTED/INCOMPLETE not testFAIL or wholePASS. Awaiting fullQUALITYrejectedreport then minimum sharedrecover operation/session fence; no software/Dev/Done acceptance.

Second correctiveSOURCE_READYSTOP: onlyStore+registeredbrowser changed;321other source/config files inclbackend and10originalindependent files unchanged. Root20artifact hashes/doccommands/exactdiff fullyread/verified. Sharedlocal objectowner/busyref invalidated onactor/session.id/pending/retry/effectcleanup/unmount; oldsuccess/error cannotrelease newpending, currentsuccess/error survives processed same-session snapshot changes. OwnedmeaningfulABA RED→GREEN; original immutablefinalABA/keyboard/bootstrapRetry allGREEN;7/2originalconsumer/appTSC/2format/diff0. CurrentContext7library→docs2commands durableexit0/support SDKsession.id mapping; noquota/no tokens. Finalrootcodegenexit0/new323freezef83203143c93a74cedafd06a522e4c933cc17556116909a7403bee96d3a3b6c9; freshfinalSPEC then distinctcorrectedQUALITY and rootcompletewholegate afterPASS. Prior interrupted130 staysnotPASS/testFAIL. No sourcecommit/Dev/AC/Done yet.

Final fresh SPEC and distinct corrected QUALITY PASS on323freeze f83203143c93a74cedafd06a522e4c933cc17556116909a7403bee96d3a3b6c9; root verifies final reports/receipts/logs/pixels/10original independent hashes. Actual unchanged ABA/keyboard/bootstrap and exact registered Browser assertions via private plumbing-only copies PASS, original7/2nativeconsumers PASS. Finalcodegen and7rootstatic checks exit0 unchangedsource. Fresh full native gate started only after both reviews PASS; earlier interrupted130 remains archived INCOMPLETE, not wholePASS/testFAIL. Sourcecommit/exactEUDev/AC acceptance stillpending; no manualDone.

Root fresh complete native gate actualexit0:1091 tests/52files in709.029seconds,323reviewed source/config hashes unchanged. Final SPEC/distinctQUALITY and codegen/app-backendTSC/configured+ownedformat/nativeVite+originalbundleAssertions/diff checks PASS. Source software acceptance criteria verified; sourcecommit/exactexistingEUDev follow. Actualmanual/live/provider/OCC/legal/full33/36 acceptance not claimed; DoD2 open and statusInProgress.
<!-- SECTION:NOTES:END -->
