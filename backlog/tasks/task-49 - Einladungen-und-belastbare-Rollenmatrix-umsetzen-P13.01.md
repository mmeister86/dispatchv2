---
id: TASK-49
title: Einladungen und belastbare Rollenmatrix umsetzen (P13.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 16:14'
labels:
  - p13
  - r6
milestone: m-6
dependencies:
  - TASK-64
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P13.01.
Phase: P13 – Teams, Rollen und Kundenkontexte.

**Abhängigkeit:** P09, stabile Tenant-Domain. **Dateien:** `convex/team/invitations.ts`, `convex/team/memberships.ts`, `src/features/team/members.tsx`; Test `convex/team/permissions.test.ts`.

- Ablaufende Einladungen, Widerruf, Annahme und Rollenwechsel implementieren.
- Owner, Admin, Editor und Viewer mit expliziten Rechten für Accounts, Billing, Freigaben, Publishing und Datenlöschung definieren.
- Letzten Owner schützen und kontrollierten Eigentümerwechsel anbieten.
- Rollenänderungen auf laufende Sessions, Agent-Aufträge und ausstehende Freigaben anwenden.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Editor kann keinen Tarif ändern oder fremde Accounts freigeben.
- [ ] #2 Viewer bleibt lesend.
- [ ] #3 ein ausgeschiedenes Mitglied erhält keinen Zugriff über alte Links oder laufende Agent-Threads.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Mitglieder und befristete Einladungen serverseitig mit realen Identitäten speichern.
2. Einladungsannahme, Rollenwechsel, Entzug und letzten Owner transaktional schützen.
3. Team-UI an dedizierte Queries/Mutations anbinden; Rollenmatrix testen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /team. Invite/accept/revoke/expire, member roles, permissions preview, owner transfer/last-owner protection and selectable demo role. Grenze: No invitation email, authenticated memberships or server-side permission enforcement. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root hat /tmp/dispatch-continuation-49-50-seams.md vollständig gelesen (read-only, keine Tests/Implementierung). Actual membership writers bislang nur users.provisionUser/workspaces.create selfOwner; keine Produktionseinladung oder zweiter Reviewer-Onboarding-Pfad. TeamPage Cloud verwendet noch lokale Demoidentitäten.49 soll vorhandene verified auth identity/current memberships reuse, gezielte expiring acceptance mit current inviter/Owner-grant proof, atomare lastOwner/transfer/duplicate guards und recovery bei entferntem activeWorkspace liefern; kein roleRegistry/SeatEntitlement.44 native getrennte Evaluator/Reviewer-Tests sind keine tatsächlich vorhandenen zweiten menschlichen Accounts. Neue Invite-Personendaten/Lifetime/Restore in33/36, echte Mail optionalbestehenderTransport mit ehrlichemDeliverystatus, bei Prüfung nur intercepted und keine tatsächlichen Mails. Endgültiger Vertrag/SourceOwnership nach aktuellen48/45/46/47-Slices.

Root vollständig read/adopted /tmp/dispatch-continuation-49-50-contract-proposal.md plus currentctx7BetterAuth/ResendDesignEvidence, contract .docs/team-review-continuation-contract.md.49.1native verifiedInvites+role/lastOwner/recovery→49.2auth-onlyAcceptance/nativeTeam/optionalexistingmail als ToDo geschaffen. Root wählt opaqueInvitationID nurReference/currentverifiedtargetAuthority; already-member consumeTerminal unveränderteRole. Cloud /team currentlygateUnavailable, ViewerOnboardingprefwriteGap und invalidActiveMembershipUsersCurrent recovery echteSeams. KeinInvite/actualEmail/Test/Source49 diesesReports,37entitlement/tariff/manuelleDone offen.
<!-- SECTION:NOTES:END -->
