---
id: TASK-46.2
title: >-
  Endliche Serienvorschläge mit vorbereitetem semantischem Kontext planen
  (P12.02, Teil 2)
status: To Do
assignee: []
created_date: '2026-10-06 15:21'
updated_date: '2026-10-06 21:31'
labels: []
dependencies:
  - TASK-46.1
references:
  - .docs/semantic-planning-contract.md
parent_task_id: TASK-46
priority: medium
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nach separat akzeptiertem46.1 und finalem45: native konkrete Serienversion/CAS/Receipts mit expliziter Nutzerfrequenz, IANA/Theme/Pillar und endlichen höchstens4 weekly ProposalOccurrences in28Tagen, max7Items. Vorbereitete compatibleVectors, originalHorizon und vorhandeneSlot/Approval/AcceptPfad verwenden. Kein bezahlterCall imCallback, keineTexterzeugung, autoAccept oderTerminänderung. Vertrag .docs/semantic-planning-contract.md; Timing/Neuheitsqualität bleibt echteEvidenzabhängig.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Konkrete thematische Serien berücksichtigen kompatible Account-Vektoren, Wiederholung und explizite Nutzerwerte; fehlende oder unvollständige Semantik erzeugt sichtbare Sperre/Shortage.
- [ ] #2 Endliche native Wiederholungen enden an Grenze und stale/replayed/disabled Callbacks erzeugen weder neue Provider-Aufrufe noch unbeauftragte Termine.
- [ ] #3 Bestehende mögliche/unklare/bestätigte Publishing-Effekte und Termine bleiben geschützt; nur explizite native selektive Annahme erstellt neue Termine mit exakten Proofs.
- [ ] #4 Native Lifecycle/Slot/CAS/DST/ScopeChecks, tatsächliche PlansBrowser und separate frische SPEC/QUALITY plus exaktes EUDev sind dokumentiert; empirical/live/manualDone bleiben offen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Automatisierte Prüfungen und noch offene manuelle Abnahme sind konkret dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Nach technisch geprüfter46.1 den bestehenden Planner, Style-Pin und nativen Semantik-Frame als konkrete Server-Transaktionen wiederverwenden.
2. Endliche unveränderliche Serienversion, CAS-Belege und genau einen nächsten Callback implementieren; Dependency-Cleanup vor dem neuen Consumer hinzufügen.
3. Vorbereitete Vektoren, explizite Themenzuordnung und Wiederholungsgrenze prüfen; fehlende Semantik als Shortage ausweisen.
4. Bestehende selektive Annahme und unveränderliche Termine/Approval-/Publishing-Belege erhalten; echte Plans-Oberfläche anschließen.
5. Native Scope/Replay/4-Occurrences/DST/Slot/Cleanup/0-Provider-Checks und styled Browser prüfen, Quelle einfrieren, fresh SPEC/distinct QUALITY und exaktes bestehendes EUDev dokumentieren.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-only Vorarbeit /tmp/dispatch-46.2-preflight.md vorhanden. Kein46.2Source-Writer freigegeben, Status bleibtToDo bis46.1 technisch geprüft ist. Minimal drei Serienfamilien plus normalisierte Vektor→Plan-Abhängigkeiten; vorhandene contentPlans dienen als Proposal-/Occurrence-Beleg. Kein zweiter Planner, Occurrence-/Frame-Ledger, Provider im Callback, automatische Annahme oder Terminänderung. Disable zieht unangenommene Serienvorschläge fail-closed zurück, bereits angenommene native Termine bleiben erhalten. Tatsächliche Style/Pillars, Themenzuordnung, gewünschtesFormat, Frequenz/IANA/Zeiten/Zeitraum/Threshold sind explizite Produktangaben und werden nicht erfunden.
<!-- SECTION:NOTES:END -->
