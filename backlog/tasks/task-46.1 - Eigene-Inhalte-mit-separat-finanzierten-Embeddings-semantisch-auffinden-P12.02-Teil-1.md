---
id: TASK-46.1
title: >-
  Eigene Inhalte mit separat finanzierten Embeddings semantisch auffinden
  (P12.02, Teil 1)
status: In Progress
assignee: []
created_date: '2026-10-06 15:21'
updated_date: '2026-10-06 21:51'
labels: []
dependencies: []
references:
  - .docs/semantic-planning-contract.md
parent_task_id: TASK-46
priority: medium
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nach akzeptiertem48 und45: konkretes default-OFF EmbeddingPurpose/Policy/Consent mit tatsächlicher EUModel/Dimension/Pricing-Konfiguration, originalSource-bound NativeVectors und begrenztem Cosine-Frame im bestehenden dreifachBudget/AttemptLedger. Vertrag .docs/semantic-planning-contract.md. Kein AgentMemory, neuerProvider, autonomeCall, zweitesLedger oder lexical-as-semantic; introducedSourceCleanup vorConsumer, tatsächliche Modell-/Semantik-/manual-Fakten bleiben getrennt offen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ohne tatsächliche Policy, Zweckfreigabe, Modellidentität, Dimension und drei Budgets erfolgt kein Embedding-Aufruf; genaue Calls werden vorI/O reserviert und exakt einmal reconciled.
- [x] #2 Kompatible echte Vektoren liefern account-isolierte begrenzte Ähnlichkeit mit explizitem Frame, fehlenden Daten und originalen Quellhorizonten; Testvektoren beweisen keine Live-Semantikqualität.
- [x] #3 Source-/Purpose-/Actorverlust maskiert und entfernt geschützte Vektoren/Abkömmlinge physisch ohne finanzielle oder Publishing-Eltern zu verlieren.
- [ ] #4 Native Scope/Replay/Transport/Ledger/Lifecycle und tatsächliche styled UI sowie frisches SPEC/QUALITY und exaktes bestehendes EUDev sind dokumentiert; manuelle Done-Bestätigung bleibt erforderlich.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Automatisierte Prüfungen und noch offene manuelle Abnahme sind konkret dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehenden Ledger und Quellenbeweise wiederverwenden; aktuelle SDK-Dokumentation prüfen.
2. Native Tests für Finanzierung, Scope, Replay, Transport und Quellenverlust ergänzen.
3. Default-OFF Embeddings, begrenzte Ähnlichkeitssuche und physische Bereinigung mit realer UI umsetzen.
4. Typen, Tests und UI prüfen; Quelle einfrieren und getrennte SPEC-/QUALITY-Reviews durchführen.
5. Auf master committen, bestehende Dev-Umgebung synchronisieren und Abnahme offen dokumentieren.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fortsetzung auf master nach geprüfter TASK-45.2. aiAttempts bleibt einzige finanzielle Autorität und übernimmt den exakten manuellen Embedding-Befehlsbeleg; keine zusätzliche Operationstabelle. Tatsächliche Modell-, EU-, Rechte- und Preisangaben werden nicht erfunden oder aktiviert.

Zwischenstand des sole Source-Writers: 10 neue registrierte native Semantiktests grün; echte volle100-History+25-Draft-Frame-Probe mit125 vollständig abgefangenen SDK-Aufrufen und Original-Ledger-Belegen unter unveränderten nativen Leselimits. 40 betroffene Core/History-Tests grün. Noch kein Freeze/Review/Commit/Dev-Deploy. Vor Freeze werden Override-Usage, unabhängige Quellenketten, aktuelle Owner-/Account-Epoch-Beweise sowie expliziter Widerruf bei blockierter Konfiguration und physische Cleanup-Fortsetzungen geprüft; keine Live-Providerarbeit oder Qualitätsbehauptung.

Präzisierung zum125er-Zwischenstand: Convex-test Default erzwingt die nativen Transaktionsgrenzen nicht automatisch. Der bisherige PASS belegt Funktions-/Finanzablauf mit abgefangenem SDK, keine erzwungene Read-Budget-Abnahme. Writer ergänzt registrierten ctx.runQuery-Probe mit expliziten unveränderten4096 Queries/16MiB/32000 Dokumenten, maximaler4096D-Vektorgröße und payloadreichen Policies/Quellen; konkrete Messungen bleiben bis Ergebnis offen. Vollständige Ancestry-Reproof-Sweeps verwenden nun eine ausgewählte Quelle pro Callback.

Explizit erzwungener Maximalrahmen nun PASS: 100 payloadreiche importierte Historieneinträge aus genau einem Job plus25 Entwürfe,4096D und umfangreiche Policy-Belege; genau EIN Entwurf hat31 Idee-Vorfahren plus Entwurfswurzel,24 sind manuell. Registrierte Transaktion unter Originalgrenzen4096 Queries/16MiB/32000 Dokumenten gemessen:946 Queries,1021 Dokumente,7990412 Bytes. Eigenständige32er-Quellenbeweise und explizites gemeinsames32er-Frame-Limit bleiben erhalten.18 neue native Tests grün; Freeze/Reviews/Codegen/Dev und tatsächliche Browserprüfung noch offen. Fehlender REQUESTY-Key verhindert neue Reservierung und gibt nur originalActor-eigene reserved Holds frei; sent/unknown bleiben finanziell erhalten.

Erster Freeze308 Dateien SHA d329905c4125001d75d1c581f35004601e15fbe9ec645a0898be68caf61cb20b. Native Codegen, App/Backend-Typen, konfigurierte plus neue UI-Formatprüfung, Build und originale Bundle-Secret-Assertions PASS. Fresh SPEC reproduziert P1: kürzere aktuelle same-connection History-Policy retentionMs wurde vom shared retainedHorizon nicht an original job.createdAt gebunden; ein zu alter Vektor blieb vorbereitet. Diagnose /tmp/dispatch-continuation-46.1-retention-diagnostic.log; alle308Hashes unverändert. Ganze eingefrorene Suite gestoppt Exit130, NICHT PASS. Noch kein Commit/Deploy/QUALITY. Minimaler Shared-Proof-Fix und registrierter Maskierungs/0IO/physischer Löschtest folgen vor neuem Freeze/Review.

SPEC-P1 minimal behoben: shared retainedHorizon enthält jetzt original historyJob.createdAt + currentPolicy.retentionMs, zusätzlich zu allen bestehenden Original-/Current-Ceilings. Registrierte22. Semantikprobe zuerst RED, dann GREEN: noch gültiger kürzerer Horizont, spätere Maskierung und0neueReservierung/Fetch, vollständige Text/Vektor/Attempt-Pin-Bereinigung, originale Jobidentität+settledSchätzung/Spends erhalten; längere spätere Policy belebt gelöschte Quelle nicht wieder.55fokussierte Tests(22semantic+33history/metrics), Typecheck/Format/diff PASS. Native Codegen erneutPASS; neuer308DateienFreeze SHA e6701c9f9c174d582a64fdb735d702d77e1d3e7a7dc57db0ef929d58fb15cb38, unabhängigerSPEC-Recheck läuft; QUALITY/FullFinalSuite/Commit/Dev bleiben offen.

Final backend freeze e6701c9f9c174d582a64fdb735d702d77e1d3e7a7dc57db0ef929d58fb15cb38:950Tests/49Files PASS724.46s Exit0;308Hashes unverändert. Fresh SPEC und distinct QUALITY akzeptieren Quellen-/Finanz-/Transport-/Lifecycle-Verhalten; unabhängige55 bzw26Native und17BrowserChecks PASS. Nachreview P2: replay kann nie gesendeten cancelledReserved-Beleg meinen, daher ausschließlich neutralen UI-Satz korrigieren; backend/nativeFreeze bleibt identisch. Frische fokussierte Copy-SPEC/QUALITY, finaler Gesamtfreeze, Commit und exaktes EUDev noch offen; keine Done-Schließung.

Final wholeSourceFreeze308files SHA9123cc748977628ce645bf5732c1ebdd409bd5c73bbddcde5a86e2c8a32abf69. FreshfocusedSPEC und distinctQUALITY PASS: exakt ein neutraler Replay-Satz geändert,307andereDateien/backend/native byte-identisch zur950/49PASS-Suite.17actualstyledBrowser/AppTS/Format und finale originale Bundle-Assertions PASS. Reviewberichte dauerhaft .docs/reviews/task-46.1-spec.md und -quality.md; keine weiterenP0/P1/P2. TechnischeAC1–3 geprüft; AC4/exaktesEUDev noch offen, manualDone bleibt offen.
<!-- SECTION:NOTES:END -->
