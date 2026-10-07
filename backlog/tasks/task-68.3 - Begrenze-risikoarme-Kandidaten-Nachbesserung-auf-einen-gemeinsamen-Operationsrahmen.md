---
id: TASK-68.3
title: >-
  Begrenze risikoarme Kandidaten-Nachbesserung auf einen gemeinsamen
  Operationsrahmen
status: To Do
assignee: []
created_date: '2026-10-06 23:12'
updated_date: '2026-10-07 11:13'
labels: []
dependencies:
  - TASK-68.2
references:
  - .docs/jev-generation-continuation-contract.md
parent_task_id: TASK-68
priority: medium
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nach separat technisch akzeptierter exakter Verifikation höchstens eine klar risikoarme Nachbesserung erlauben. Ursprüngliche Quelle/Absicht und sticky Risiko-Referenzen unverändert; reparierter Kandidat muss erneut exakt geprüft werden. Native unveränderliche Operation hält ursprüngliche Deadline, Stufen-/Call-/Generation-/Verification- und Kostenlimits; vorhandene Generation- UND Jev-Funding-Pfade erzwingen denselben Rahmen atomar gegen echte eigene aiAttempts, gehaltene und beobachtete Kosten. Unknown-Holds nicht nullen, Child-Runs setzen nichts zurück, SDK-Retries null; notwendige finale Verifikationskapazität vor Reparatur reservieren. Konkrete Limits/Preis-/Rechtefakten bleiben ungefüllt bis echte Konfiguration. Menschliche Anwendung erzeugt neue ungeprüfte Version, niemals automatische Freigabe oder Publikation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Höchstens ein risikoarmer Repair verwendet unveränderte Original-Baseline; starke Claims und Bedeutungs-/Intentrisiko verhindern Repair und bleiben sticky. Finale exakte Prüfung ist Voraussetzung für semantisches Ergebnis und schafft keine menschliche Freigabe.
- [ ] #2 Generation und Jev erzwingen atomar dieselbe ursprüngliche Zeit-/Call-/Kosten-/Versuchsgrenze gegen vorhandene eigene Finanzbelege; Unknown-Holds, Late-Settlement, Currency und finale Verifikationsreserve bleiben korrekt, ohne zweites Ledger oder Child-Reset.
- [ ] #3 Exakter Replay/Current-Proof/Stop/Supersession/SourceClock und physischer Candidate-/Agent-/Quellen-Lifecycle verhindern Reaktivierung oder verlorene Buffer-Änderung; menschliche Anwendung erzeugt neue ungeprüfte Version und erhält bestehende Publishing-/Finanz-Eltern.
- [ ] #4 Registered native Actions mit SDK-Abfangtests belegen tatsächliche Aufruf-/Funding-/Zeitgrenzen und finale Reserve, styled Composer ehrliche Erschöpfungs-/Ungeprüft-/Manual-Review-States; frische separate SPEC/QUALITY, native Gesamtprüfung/static und exaktes bestehendes EUDev sind dokumentiert, reale Modellqualität/manuelle Done bleiben offen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Automatisierte Prüfungen und offene manuelle Abnahme sind konkret dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Final akzeptierte exakte Verifikation und beide tatsächlichen Funding-Pfade abgleichen.
2. Einen ursprünglichen immutable Operationsrahmen mit nativen Stage/Call/Time/Cost/Reserve-Grenzen ergänzen.
3. Höchstens einen risikoarmen Repair mit Original-Baseline, sticky Risiken und finanziell reservierter finaler Prüfung ausführen.
4. Current-Proofs/Stop/Supersession/Agent-Cleanup und menschliche neue ungeprüfte Version mit ehrlichen Erschöpfungs-/Manual-Review-States anbinden.
5. Tatsächliche native Funding/SDK/Time-Grenzen und styled Browser, Source-Freeze/fresh SPEC/distinct QUALITY, Gesamtprüfungen/static und Root-Commit/exaktes bestehendes EUDev; manualDone offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Konkrete CLI-Vorbereitung unter fortlaufend freigegebenem Backend-Ausbau, noch kein SourceWriter/Implementierungs-/Test-/Review-/Dev-Nachweis. Finale vorherige Source-Einheiten zuerst technisch akzeptieren; Root hält genau einen Writer und unabhängige frische SPEC/QUALITY. Status To Do, AC/DoD ungeprüft, keine Provideraktivierung oder manuelle Abnahme.

Root fullyread/adopted independent readonly native source proposal .docs/reviews/task-68.2-68.3-native-source-plan.md SHA c0f8369abecbf6081a6f70c009f76e2bc4e9ca77460a61e04172765648bf9fd0; receipt e4ed76a5/report30445bytes, actual Context7library-first3 commands outside sandbox/installedSDK0.6.0. Seven own Noul rubrics/probability-not-confidence, strictnormalization/sticky original claim/meaning/intent risk; existingcontentRequest optional envelope and owned receipt counted once across two provider budgetgraphs, immutable clock before initial generation/no retroactive claims, truthful finalverification reserve and one-shot repairedcandidate binding proposed. Root verified18observed source/docs/installed entries (moving owned allowed),3preserved prior artifacts and last saved docslog; first2docsUTC/stdout and targetedtruncation qualified. Newreserved owner-state and already-booked spend+reheld unknown semantics/API remain decisions requiring accepted68.1/68.2 reconciliation; no source release/tests/provider/Dev/AC acceptance. ToDo/manualDone remain open. Initial multi-task append-notes command was rejected without changes; separate per-task CLI updates apply this note.
<!-- SECTION:NOTES:END -->
