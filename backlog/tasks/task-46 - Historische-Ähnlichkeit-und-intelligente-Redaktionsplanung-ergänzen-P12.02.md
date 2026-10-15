---
id: TASK-46
title: Historische Ähnlichkeit und intelligente Redaktionsplanung ergänzen (P12.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 15:21'
labels:
  - p12
  - r5
  - jev
milestone: m-5
dependencies:
  - TASK-42
  - TASK-45
  - TASK-25
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P12.02.
Phase: P12 – Persönliche Stimme, strategische Planung und kontinuierliche Verbesserung.

**Abhängigkeit:** P11.02, P12.01, P07. **Dateien:** `convex/content/similarity.ts`, `convex/planning/strategy.ts`, `convex/planning/recurring.ts`; Test `convex/planning/strategy.test.ts`.

- Ähnliche eigene Posts semantisch auffinden, innerhalb des Accounts und zulässigen Workspace-Kontexts.
- Wiederholungen, Themenübersättigung, bewährte Formate und geplante Serien berücksichtigen.
- Regelmäßige Planvorschläge mit Nutzerfrequenz und Zeitfenstern erzeugen; bestehende Termine weiterhin schützen.
- Erst bei geeigneter Historie vorsichtige Timing-Empfehlungen anbieten und deren Evidenz zeigen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).

### JEV-Abgleich vom 18.09.2026

Spätere Jev-Recycling-Entscheidungen sind ein Ausbau nach dem Analyzer: Aktualität, Wiederholung und Updatebedarf sowie repost/rewrite/thread/adapt/skip getrennt bewerten. Nur begrenzten erlaubten Account-Kontext und ein definiertes Bezugsdatum senden; unsichere oder fehlende Analyse erzeugt keinen automatischen Vorschlag. Planung, Kalenderprüfung und Ausführung bleiben Convex, Texte dem Generator vorbehalten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine Serie bleibt thematisch zusammenhängend, erzeugt aber keine nahezu identischen Posts.
- [ ] #2 Ein wiederkehrender Planlauf verschiebt oder ersetzt keine bestehenden Termine ohne Auftrag.
- [ ] #3 Wenn Recycling-Signale eingesetzt werden, führen niedrige Confidence, fehlender Zeitkontext oder Providerausfall zum Verzicht auf den automatischen Vorschlag; Termine/Freigaben bleiben nutzerkontrolliert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Akzeptiertes48 und45.1/45.2 abwarten; finalenStyle/DescendantProof vorAdmission reconciliieren.
2.46.1 konkreter separat admitted/funded EmbeddingOwner im bestehendenLedger, NativeVectors und boundedSemanticFrame mit eingeführtemCleanup.
3.46.1 Freeze, frischesSPEC dann distinctQUALITY, RootCommit/exaktesbestehendesEUDev.
4.46.2 endliche nativeSeriesProposals aus preparedVectors/actualStyle/UserFrequency/IANA, sharedSlot/SelectiveAcceptance, zeroProviderCallback.
5.46.2 eigene Freeze/Reviews/Commit/Dev und Inventory33/36; tatsächlicheModel/EU/Pricing/rights/Semantik/Timing/manualDone offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /plans, /drafts/:id, /analytics — Muster & Learnings. Recurring-series preferences, related-topic history hints and contextual repetition/timing caveats. Grenze: No semantic similarity or intelligent recurring jobs; series/timing/reuse signals are local illustrative preferences. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root hat konkreten read-only Semantik/Recurring-Vorschlag /tmp/dispatch-continuation-46-semantic-contract-proposal.md geprüft. Nach akzeptiertem45:46.1 separate explizite funded echte EmbeddingPurpose/Policy/Consent/NativeVector+boundedCosine im bestehendenLedger;46.2 endliche nativeSeries-Proposals mit vorbereiteten kompatiblenVectors/Style, bestehendenSlot/Accept-Gates und ohne bezahlteI/O imCallback. Installierte ai6/openai-compatible unterstützen embeddings, aber vorhandener ChatFetch/AgentusageHandler sind keinfunding-vorIO Embeddingpfad. Erstes konkretes begrenztesVectorFrame vermeidet unbestätigten fixedDimensionIndex/AgentMemory-Aktivierung; Dimension/Model/EUUpstream/Storage/Pricing/Retention/Grants müssen tatsächlich konfiguriert bleiben. ctx7offizielleDokumentation imReport: EURequestyEndpoint allein beweist keinEUUpstream, TokenResponse keineechteBilledCurrency. Keinlexicalalssemantic/History20als30Posts4Wochen/Providerfreigabe/Semantikqualität behauptet. NochkeineImplementierung; exakterVertrag/Unteraufgaben/Ownership nach45Source finalisieren.

Prospektiver Vertrag .docs/semantic-planning-contract.md und46.1/46.2 viaCLI erstellt, beideToDo. RoutineFrame100OwnHistory/25Candidate/top5 und max4weekly/28days/max7batch sind Softwareobergrenzen, keine tatsächlichenPerioden/Entitlements/Semantikgarantie. Vor46 müssen final45StyleSource/DescendantProofs reconciled sein. NochkeineSourceImplementierung/Modell/Provider/Zweckfreigabe.
<!-- SECTION:NOTES:END -->
