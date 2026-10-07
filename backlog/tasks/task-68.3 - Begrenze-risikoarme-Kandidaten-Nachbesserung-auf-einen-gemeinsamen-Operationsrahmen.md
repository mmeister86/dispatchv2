---
id: TASK-68.3
title: >-
  Begrenze risikoarme Kandidaten-Nachbesserung auf einen gemeinsamen
  Operationsrahmen
status: In Progress
assignee: []
created_date: '2026-10-06 23:12'
updated_date: '2026-10-07 17:28'
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
1. Akzeptierten68.2-Quellstand/API und bestehende Generator-/Verifikations-/Finanz-/Cleanup-Pfade abgleichen. 2. Expliziten initialen Composite-Einstieg mit unveränderlichem gemeinsamen Rahmen und ehrlichem Default-OFF ergänzen. 3. Höchstens eine risikoarme Reparatur mit atomarer Requesty-/finalerJev-Reserve und exakter Schlussprüfung implementieren. 4. Native SDK-/Funding-/Rollback-/Quellen-/Cleanup- und echte UI/Buffer-Prüfungen ausführen. 5. Quellen einfrieren, frische SPEC/distinctQUALITY und Gesamtprüfung/static/Codegen durchführen, auf master committen und bestehendesEUDev synchronisieren; manuelleDone offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Konkrete CLI-Vorbereitung unter fortlaufend freigegebenem Backend-Ausbau, noch kein SourceWriter/Implementierungs-/Test-/Review-/Dev-Nachweis. Finale vorherige Source-Einheiten zuerst technisch akzeptieren; Root hält genau einen Writer und unabhängige frische SPEC/QUALITY. Status To Do, AC/DoD ungeprüft, keine Provideraktivierung oder manuelle Abnahme.

Root fullyread/adopted independent readonly native source proposal .docs/reviews/task-68.2-68.3-native-source-plan.md SHA c0f8369abecbf6081a6f70c009f76e2bc4e9ca77460a61e04172765648bf9fd0; receipt e4ed76a5/report30445bytes, actual Context7library-first3 commands outside sandbox/installedSDK0.6.0. Seven own Noul rubrics/probability-not-confidence, strictnormalization/sticky original claim/meaning/intent risk; existingcontentRequest optional envelope and owned receipt counted once across two provider budgetgraphs, immutable clock before initial generation/no retroactive claims, truthful finalverification reserve and one-shot repairedcandidate binding proposed. Root verified18observed source/docs/installed entries (moving owned allowed),3preserved prior artifacts and last saved docslog; first2docsUTC/stdout and targetedtruncation qualified. Newreserved owner-state and already-booked spend+reheld unknown semantics/API remain decisions requiring accepted68.1/68.2 reconciliation; no source release/tests/provider/Dev/AC acceptance. ToDo/manualDone remain open. Initial multi-task append-notes command was rejected without changes; separate per-task CLI updates apply this note.

Root adopted READONLY finance preflight .docs/reviews/task-68.3-composite-finance-preflight.md SHA397939c3c6bcc22d4963febbc15e05e72e9b09a8a433b826e7208e0068b65daf; receipt SHA346a1fa27ba9a65db5e63864f29121caabfbed0a8e53422b4b017fcaad091685, Root proof /tmp/dispatch-68.3-composite-finance-preflight-root-verification.json SHAa33c59ba58a6e7388cd15f6b3120823ebe24cb9142d217daad92512da48ce4a9.314protected original nongen/6inputs/5privateartifacts verified;9partial/fullsourceScopes fourstable/fivemoving observations. Root full report/reduced semantics/actualCLI log read, maps mechanically verified; untimed source reads qualified. Derive booked-marker spend plus current hold, never state-settled-only or unknown estimate as booked; actual final Jev reserve plus repair first Requesty hold atomically via existing native budgets before repair, once-only binding after durable repaired candidate. Parent admission before initial generation/no child reset; prior routing scope and actual unset caps/rates/currency/actor authority require explicit final reconciliation. Source68.2 still pending technical acceptance; no source release/tests/AC/config activation/manualDone. Status To Do.

Fortsetzung: konkreter Read-only-Abgleich unter .docs/reviews/task-68.3-continuation-source-plan.md. Root-Scope: gemeinsamer Rahmen beginnt ausschließlich bei expliziter initialer Social-Post-Generierung, umfasst Erstprüfung/höchstens eine Reparatur/Schlussprüfung; vorheriges Routing bleibt separat ausgewiesen. Producer und Verifier sind derselbe aktuelle Nutzer. Reparatur konservativ nur für Ton/CTA/Netzwerk/Format, nicht unerwünschte Promotion oder materielle Risiken. Tatsächliche Caps/Preise/Währung/Freigaben bleiben unkonfiguriert/default OFF. Umsetzung erst nach technischer Abnahme68.2.

Umsetzung freigegeben nach separater technischerAbnahme68.2/source0507715:1404/56nativePASS, SPEC/distinctQUALITYPASS,7static/gens/build/bundlePASS, exaktesEUDev449/18Interfaces/5HTTPunverändert/338sourceHashes. Ein Source-Writer, konkrete vereinbarte Eigentümerschaft, Root behält Backlog/Codegen/Reviews/Commit/Dev. Root-API-Entscheidungen sind im continuation-source-plan ergänzt: additivergenerateComposite-Wrapper, echte parentgebundene generation-reservation/finaleJev-Reservierung; keine Retroaktivität oder erfundene Cap-/Preis-/Währungsfakten. AC/Done noch ungeprüft.
<!-- SECTION:NOTES:END -->
