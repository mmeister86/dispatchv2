---
id: TASK-23.2
title: 'Gezielte Recherche mit persönlichen Agent-Chats verbinden (P06.04, Teil 2)'
status: In Progress
assignee: []
created_date: '2026-10-05 23:38'
updated_date: '2026-10-06 01:04'
labels: []
dependencies:
  - TASK-23.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-23
priority: high
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu TASK23/J05: expliziten themengebundenen Research-Auftrag aus dem persönlichen Chat und aktuelle evidenzgebundene Zusammenfassung ermöglichen. Bestehende persönliche Agent-Threads, Finanzierungs- und Research-Auftragsverträge verwenden; keine allgemeinen Recherchetools oder freie Notizkopien als Ersatz. Umsetzung erst nach ROOT-Freigabe und geprüftem Teil 1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein expliziter persönlicher Chat-Auftrag erzeugt gezielte Recherche ohne GitHub mit unveränderlicher Themenabsicht, tatsächlichen Auftrag-IDs und bestehenden aktuellen Budget- und Abbruchprüfungen.
- [ ] #2 Rechercheergebnisse werden nur mit aktuellen evidenzgebundenen Referenzen in den eigenen Chat übernommen; Fremdthread, fremder Account, Ablauf und Entzug sind gesperrt.
- [ ] #3 Chat-Historie, Folgeanfragen und Idee-Tools erhalten die vollständige Quellenkette und können Research nicht als freie Notiz ohne Quellenprüfungen weitergeben.
- [ ] #4 Fehlende Konfiguration, Wiederholung, Stop, unbekannter Verbrauch und Wiederaufnahme bleiben ehrlich und erzeugen keine zusätzlichen bezahlten Aufrufe.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und offene manuelle Abnahme sind dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace reviewed23.1 typed evidence/current proof and actual personal Agent/thread/run/funding/cleanup callers.
2. Add narrow immutable one-off targeted pipeline admission from scoped personal chat, preserving saved profile and separately bound semantic topic; stable receipts and honest configuration outcomes.
3. Persist deterministic supported evidence summaries in actual native history and carry current bounded sources through history/stream/followup/idea generation and tool consumers; immediate read fence and concrete cleanup preserve unknown/late financial receipts.
4. Wire awaited existing real Chat commands with stable exact retry, profile/config guidance and genuine order/result links; preserve account/role epochs and finite source-clock resets.
5. Prove actual registered no-GitHub Workflow/Agent/native J05, source-negative/replay/stop/unknown/expiry/cleanup controls and changed actual browser paths; full/static/build/bundle/codegen/EU Dev onlyaftergreen.
6. Scoped master commit/freeze, fresh SPEC thenQUALITY; ROOT tracks software criteria onlyafterPASS, manualDone remainsopen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ROOTrelease after23.1 finalSOURCE6fde7a9 SAME SPEC+freshQUALITYPASS. Concrete brief /tmp/dispatch-task23.2-release-brief.md, trustedcurrentmap /tmp/dispatch-targeted-chat-research-map.md. Explicitdomainbutton/current savedprofile+revision, immutabletopic usedretrieval ANDmodel/evidence; no temporarysave/autocreate/arbitrary oldorderpromotion/general researchtool. Actualscopedconversation, deterministicdurable currentevidence summary noextra paidchatcall; separatelyfundedexplicit followup. Review vseligible vsapproval distinct; source-aware existingIdeasgenerate/conversationssend sibling mustleave23.1 block ONLYwithreal source-bound transport. Concretefullhistory/currentproof/nativecleanup/executionFinished/isDone/unknownholds; noNote laundering/newmessagesstore/ledger/paid/provideractivation. One freshimplementationwriter; ROOTownsmetadata/exactcommitwindow; noDone.
<!-- SECTION:NOTES:END -->
