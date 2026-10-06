---
id: TASK-23.1
title: 'Research-Evidenz sicher in Ideen und Entwürfe übergeben (P06.04, Teil 1)'
status: In Progress
assignee: []
created_date: '2026-10-05 23:37'
updated_date: '2026-10-06 00:07'
labels: []
dependencies:
  - TASK-22.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-23
priority: high
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu TASK23: aktuelle Research-Evidenz, Inbox-Reviewzustände und wiederholbare explizite Content-Übergaben. Bestehende Ideen/Entwürfe, Quellenketten und Autorisierung wiederverwenden; keine Umwandlung geschützter Evidenz in freie Notizen. Keine Umsetzung vor ROOT-Freigabe nach geprüfter TASK22.3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ignore und Archivierung sind persistent, rollen- und revisionsgebunden und verändern nicht das Ergebnis des Research-Auftrags.
- [ ] #2 Jede Übergabe prüft aktuelle primäre und sekundäre Evidenz, Zweck, Account, Materialhash, Ablauf und Autorität; abgelaufene oder fremde Inhalte werden nicht offengelegt.
- [ ] #3 Explizite begrenzte Absicht und Anzahl sind unveränderlich gebunden; parallele Wiederholung erzeugt keine zusätzlichen Vorschläge und liefert echte IDs mit vollständiger Quellenkette.
- [ ] #4 Ideen und Entwürfe behalten menschliche Freigabepflicht; bestehende Inhalte, Versionen und Finanzbuchungen werden nicht überschrieben.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und offene manuelle Abnahme sind dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace actual evidence/idea/draft/approval/execution read/write and copy-cleanup paths; prove current source-copy guard gaps with registered regressions.
2. Reuse current bounded evidence proof, immutable source references and existing atomic ideas/drafts for explicit capped idempotent handoffs and separate Inbox review states.
3. Preserve provenance through all derived versions/read/history/approval/new publishing effects; hide unavailable protected copies immediately, bound physical cleanup, preserve late financial/technical receipts and human-authored unbound content.
4. Add only necessary source-proof expiry/reset behavior to existing derived-content UI; verify registered replay/roles/lifecycle, actual source-sensitive browser paths and ordinary profile-save-during-I/O snapshot proof.
5. Relevant/full checks, codegen and existing EU Dev only after green, scoped master commit/freeze, fresh SPEC then QUALITY. No automatic profile option/chat bridge/Done until their dependent units/manual confirmation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ROOTrelease after22.3freshSPEC+QUALITYPASS source6c38de90. Actualmaps /tmp/dispatch-research-inbox-current-code-map.md and /tmp/dispatch-research-content-provenance-map.md: typedsource currentlyendsatimmutableIdeaVersion/ideas.handoff, draft/version/query/history/calendar/approve/checkApproval sourceguard missing, source-awareIdea reads incomplete. Do notcopyresearch intoNote orparsesourcestrings asauthority; useexacttypedrefs/replays/count/currentprimary-secondaryrights/expiry/modelhash/reviewer guards andboundedindexedcleanup. MinimalrelatedexistingGitHub-derivedsource guard shouldfollowsharedrealrootcallers, notunrelatedproviderrefactor. Ordinarysave-duringnative/modelIOtestmissingfor20AC4, addactualproof withoutchanging20productionsemantics. No newInboxstore/genericcommandbus/purposeengine/ledger/factory/paidgeneration/autoapproval/schedule/publish. Automaticoption/chatproductUI remain23.2/23.3. Allsourcechangesexactownership/ROOTwindow; sourceprivacy UI expiry/reset ifrequiredcannotbedelayed.
<!-- SECTION:NOTES:END -->
