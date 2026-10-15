---
id: TASK-68.3
title: >-
  Begrenze risikoarme Kandidaten-Nachbesserung auf einen gemeinsamen
  Operationsrahmen
status: In Progress
assignee: []
created_date: '2026-10-06 23:12'
updated_date: '2026-10-07 19:42'
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
- [x] #1 Höchstens ein risikoarmer Repair verwendet unveränderte Original-Baseline; starke Claims und Bedeutungs-/Intentrisiko verhindern Repair und bleiben sticky. Finale exakte Prüfung ist Voraussetzung für semantisches Ergebnis und schafft keine menschliche Freigabe.
- [x] #2 Generation und Jev erzwingen atomar dieselbe ursprüngliche Zeit-/Call-/Kosten-/Versuchsgrenze gegen vorhandene eigene Finanzbelege; Unknown-Holds, Late-Settlement, Currency und finale Verifikationsreserve bleiben korrekt, ohne zweites Ledger oder Child-Reset.
- [x] #3 Exakter Replay/Current-Proof/Stop/Supersession/SourceClock und physischer Candidate-/Agent-/Quellen-Lifecycle verhindern Reaktivierung oder verlorene Buffer-Änderung; menschliche Anwendung erzeugt neue ungeprüfte Version und erhält bestehende Publishing-/Finanz-Eltern.
- [x] #4 Registered native Actions mit SDK-Abfangtests belegen tatsächliche Aufruf-/Funding-/Zeitgrenzen und finale Reserve, styled Composer ehrliche Erschöpfungs-/Ungeprüft-/Manual-Review-States; frische separate SPEC/QUALITY, native Gesamtprüfung/static und exaktes bestehendes EUDev sind dokumentiert, reale Modellqualität/manuelle Done bleiben offen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Automatisierte Prüfungen und offene manuelle Abnahme sind konkret dokumentiert.
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

Fortsetzung: Der Source-Writer meldet GREEN für die fehlende Konfiguration ohne Agent/Job/Reservierung sowie für den tatsächlichen SDK-Ablauf initiale Generierung → erste Jev-Prüfung → atomare sechs Budget-Holds → einzige Korrektur → exakte Schlussprüfung. Dies sind Entwicklungschecks, noch keine unabhängige technische Abnahme. Root hat Source-Guarded Codegen-/Gesamttest-Runner vorbereitet; reservierte Holds bei fehlenden Runs und zentrale unveränderliche Finanzzuordnung werden vor dem Source-Freeze geprüft. Status bleibt In Progress; kein manuelles Done und keine Provider-Aktivierung.

Unabhängige Read-only-Lifecycle-Analyse (beweglicher Entwicklungsstand, keine Abnahme): bestehende Actor/Purpose/Style-Pfade erreichen Composite-Cleanup. Drei konkrete Restpfade wurden dem einzigen Source-Writer gemeldet: parent discovery aus aiAttempts.by_compositeRootRunId bei fehlenden Requests/Runs; vorhandene Child-Requests ohne ChildRun bzw. bei terminalem Lauf; original-input request discovery vor dem missing-input guard. Die Korrekturen sollen vorhandene Indizes und Cleanup-Seams nutzen; keine neue Finanzbuchhaltung.

Root-Codegen API-Zwischenstand PASS (Receipt /tmp/dispatch-68.3-codegen-intermediate-receipt.json): Typecheck aktiviert, nur generated api.d.ts geändert, 334 übrige Dateien und Inventar unverändert. Kein Final-Freeze/Dev-Abnahme daraus. Separate Read-only-Finanzanalyse meldet zwei Defektfamilien an Writer: Composite-Exposure erneut am Verifier-Fetch sowie Completion/Consumer prüfen; ersten Verifier-Slot nicht ab ursprünglichem Generierungsstart um den separaten Provider-Timeout verkürzen. Original Gesamtdeadline bleibt unverändert, historische rechtzeitige Ergebnisse bleiben lesbar. Native Edge-Controls angefordert.

Final-Freeze erster Reviewstand: unabhängige SPEC NEEDS_WORK trotz128 nativer/3 Suites und beiden Browser-Harnesses PASS. Eigene Half-open Circuit-Probes der ersten/letzten Verifikation werden über unscoped Parent-Konfiguration abgewiesen; gleiche Familie macht fertiges Resultat bei fremder Probe historisch. Bericht .docs/reviews/task-68.3-spec-initial-review.md. Root hat den vollständigen nativen Lauf gezielt vor Source-Korrektur abgebrochen; Partial-Log kein PASS. Kleiner gemeinsamer Fix + tatsächliche Probe-/Consumer-Regressionen an einzigen Writer freigegeben; neue genaue Freeze-Abnahme erforderlich. Kein Done/Provider-Aktivierung.

Zweite eingefrorene SPEC-Abnahme NEEDS_WORK: Circuit-Familie ist durch tatsächliche SDK-/Consumer-Kontrollen behoben,132 native/3 Suites und beide Browser bestehen. Separat bestätigter Same-Actor-Blocker: zweiter Editor kann ersten Composite-Verifier-Slot übernehmen und tatsächlich finanziert ausführen. Bericht .docs/reviews/task-68.3-spec-actor-review.md. Final2 Gesamttest gezielt abgebrochen, Partial-Log kein PASS. Gemeinsamer Actor-Guard + Composite-Denial-/Legacy-Distinct-Verifier-/Late-Settlement-Regressionskontrollen an einzigen Writer freigegeben. Status bleibt In Progress, kein Done/Provider-Aktivierung.

FINAL3 SPEC: Actor-/Circuit-Korrekturen bestätigt; 137 native Tests und beide Browser-Harnesses bestehen. Weiterer Statusblocker: ungültige aktuelle Rolle des konfigurierten Cap-Freigebenden wirft ROLE_ACCESS_DENIED statt configuration_required. Null-Effekte unabhängig bestätigt. Root-Vollprüfung gezielt abgebrochen; minimale gemeinsame Konfigurationskorrektur an einzigen Writer freigegeben. Keine Abnahme, kein Done, keine Provideraktivierung.

FINAL4 SPEC PASS: drei vorherige Blockerfamilien behoben; 142 native Tests/3 Suites, sieben unabhängige Gegenproben und beide original styled Browser-Harnesses bestehen. Exakter 339-Datei-Freeze 80bedb7055e8bb43daf6b283d81503775a21e9a9ad608c630a13d75996c17bca unverändert; sieben Root-static Gates bestehen. Frische distinct QUALITY und vollständige native Suite laufen. Noch keine Source-/Dev-Abnahme, keine AC-Abhaken/Done/Provideraktivierung.

Distinct QUALITY bestätigt Replay-Blocker: Repair kann ursprünglichen contentRequest-Operationsschlüssel erneut verwenden, erzeugt doppelte Zeilen und zerstört originales generateComposite-Replay (unique()). SPEC PASS allein ist keine Abnahme. Root hat eigene Final4-Vollprüfung gezielt angehalten, alle339 Quellen unverändert; angrenzender Verifier-Key-Pfad wird vor minimalem Fix geprüft. Kein Done/Dev/Provideraktivierung.

QUALITY präzisiert zweite Defektfamilie: gleicher Schlüssel für Erst- und finale Verifikation umgeht reserviert→sent-Guard; native unique()-Fehler hinterlässt 17000 micro gehalten bei null finalen HTTP-Aufrufen. Bericht .docs/reviews/task-68.3-quality-key-review.md. Minimaler Fix muss vorhandene normale und reservierte Verifier-Key-Bereiche gemeinsam schützen, auch späteres standalone Funding; keine neue Buchhaltung/erfundene Nutzung. Beide Gegenproben und Null-Effekt-Konflikte an einzigen Writer freigegeben.

FINAL5 SPEC147/3+9private+beideBrowser PASS/static7PASS. Distinct frische QUALITY findet finalen Kandidaten-Cleanup-Blocker: gemeinsame cleanup()-Prüfung validiert nur Erst-Slot; gelöschter finaler Kandidat lässt Schlussprüfungsresultat/Criteria gespeichert. Eigene147/3PASS, unabhängige registrierte1RED, alle339Freezehashes unverändert; Vollsuite noch nicht gestartet. Bericht .docs/reviews/task-68.3-quality-cleanup-review.md. Gemeinsame Prüfung aller vorhandenen Slots mit Original-Erasure/Agent-Cleanup an einzigen Writer freigegeben; keine Source-/Dev-Abnahme, kein Done.

FINAL6 technische Reviewer-Gates PASS: frische SPEC150/3+10private+beideStyledBrowser; distinct QUALITY eigene150/3 und bytegleiches vorheriges finalCandidate-RED nunGREEN. Alle339Quellen/HEAD unverändert, sieben Rootstatic Gates PASS. Vollständige Rootnative Suite jetzt gestartet auf Freeze63b3ec647eda40481b5ea7d15337113ff4f6a23350deb567a39bc8374a443576. Source-/EUDev-Abnahme wartet auf Gesamtlauf und exakten bestehendenEUDev; manuelleDone/RealeModellqualität offen.

Technisch akzeptiert: source4685683b9b56de25021ba36e03842a1abcfc9313/master; fresh SPEC150/3+10private+beideStyledBrowser und distinctQUALITY150/3+bytegleicher vorherigerCleanupRED nunGREEN. Rootgesamt1437Tests/56Dateien/keineFailuresSkips in826.50s,7staticPASS, Freeze339Hashes unverändert. BestehendesEUDev19:41:54–19:42:05UTC erfolgreich;454Metadateneinträge/exakt5neueInterfaces/5HTTP und alteFunctionKindsVisibility erhalten. Details .docs/reviews/task-68.3-validation.md. Technische AC1–4/DoD1 geprüft; Status bleibt InProgress/DoD2offen bis ausdrücklicher manueller Nutzerbestätigung. Keine realeProvider-/Preis-/Limit-/Publishing-Aktivierung.
<!-- SECTION:NOTES:END -->
