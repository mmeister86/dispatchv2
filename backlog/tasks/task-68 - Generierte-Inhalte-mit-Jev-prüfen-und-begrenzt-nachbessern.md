---
id: TASK-68
title: Generierte Inhalte mit Jev prüfen und begrenzt nachbessern
status: In Progress
assignee: []
created_date: '2026-09-18 15:20'
updated_date: '2026-10-06 23:12'
labels:
  - r5
  - jev
  - erweiterung
milestone: m-5
dependencies:
  - TASK-67
  - TASK-29
  - TASK-8
references:
  - .docs/JEV_INTEGRATION.md
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
JEV-Rollout: Output Verification nach der Analyzer-Auslieferung und dem Intent-Routing. Geplante Einordnung R5; verbindlicher Release-Umfang über TASK-2. Keine rückwärtsgerichtete Pflichtabhängigkeit von TASK-18 oder TASK-64.

Verantwortung: convex/ai/jev/questions/outputVerification.ts, verifyGeneratedPost.ts und deterministische Verifikationspolicy im Convex-Generierungsworkflow.
- Quelle, explizite Nutzerabsicht, erzeugte konkrete Version, Zielnetzwerk, Kommunikationsziel, angefragten Ton und CTA vergleichen. Bedeutung/Intention, neue starke Claims, unerwünschte Promotion und Netzwerkpassung getrennt messen; keine fehlenden Kriterien aus dem Beispielcode als implementiert annehmen.
- Convex entscheidet accept, accept-with-warning, regenerate oder manual-review. Schwellwerte und Reihenfolge aus dem Guide sind Platzhalter; Priorität bei mehreren Flags dokumentieren und testen, insbesondere starke neue Claims nicht durch automatisches Regenerieren verdecken.
- Automatische Regeneration nur bei klar abgegrenzten risikoarmen Fehlern und mit festem Gesamtlimit für Generation, Prüfung, Versuche, Zeit und Kosten. Erschöpftes Budget/unklare Antworten führen zur sichtbaren Warnung oder manuellen Prüfung, nie zu Endlosschleifen.
- Bei Jev-Ausfall konservative lokale Regeln und sichtbaren Ungeprüft-Status verwenden. Manuelles Publishing bleibt möglich, bestehende Autorisierungs-/Freigaberegeln bleiben verbindlich. Jede Textänderung erzeugt eine neue Version ohne geerbte Freigabe.
- Funktionsflag getrennt aktivieren; Nutzung/Entscheidungen versioniert und ohne Draft-Inhalte protokollieren. Neue Daten in Inventar, Export, Löschung und Retention aufnehmen.

Quelle: .docs/JEV_INTEGRATION.md. Geplante Arbeit; Umsetzung im freigegebenen Release-Umfang. Keine Implementierung oder Providerfreigabe durch diese Backlog-Anpassung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Referenzfälle prüfen Bedeutung, Intention, Ton, CTA, neue Claims und Zielnetzwerk; kombinierte Flags führen zur dokumentierten deterministischen Entscheidung.
- [ ] #2 Regenerationsschleifen enden nach konfigurierten Versuchs-, Zeit- und Budgetgrenzen; Provider-Retries vervielfachen das Gesamtlimit nicht.
- [ ] #3 Timeout, Providerfehler, ungültige Antworten und deaktiviertes Flag liefern einen sichtbaren Fallback ohne automatisches Publishing oder übernommene Freigabe.
- [ ] #4 Jede Prüfung ist an Quelle und konkrete Ergebnisversion gebunden; überholte Antworten können keine neuere Version akzeptieren.
- [ ] #5 Verifikationsdaten besitzen isolierte Zugriffe, Versionierung, Telemetrie und dokumentierte Lebenszyklusregeln.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence. Version-bound mock verification, warning/manual confirmation/unavailable, individual criterion notes, bounded attempts and explicit local rewrite into a fresh reviewable version. Grenze: No factual/output verification, real generation or provider-controlled retry; no automatic publication. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Rootcontract .docs/jev-generation-continuation-contract.md: missingactualgeneratedpost seam requires separatelyreviewed narrow candidateoutput mode in EXISTINGfunded purpose=draft generator, then68exactverifier→finiteoneLowRiskRepair. Currentperspective/humanDraftText maynotclaimfull68. NativecandidateID/source/style/version first, all7criteria, noulprobability≠confidence, stickystrongclaim/meaning/intent risk manualreview beforelowfit/repair; exacthumanapply/newunapprovedversions. Bothgeneration/Jevfund gates sameimmutablewholeoperation(time/calls/cost/unknownheld) withoutsecondledger/childreset/currencyfiction; reservefinalverification before repair. Indexedprotectedcandidate/Agent/descendantcleanup beforeconsumer; final45-50 reconciliation/rootfreshreviews/EU required. Noactualpaidactivation/tests/manualDone.

Drei konkrete native CLI-Untertasks jetzt angelegt: 68.1 Kandidaten-Voraussetzung im EXISTING purpose=draft Generator nach67.2; 68.2 exakte sieben-Kriterien-Jev-Verifikation nach68.1; 68.3 höchstens ein risikoarmer Repair mit gemeinsamem finanzierten Operationsrahmen nach68.2. Diese actual IDs ersetzen bisher unnummerierte Vorarbeit. Noch keine Implementierung/Tests/Dev oder Providerfreigabe, manuelle Done-Abnahme offen.
<!-- SECTION:NOTES:END -->
