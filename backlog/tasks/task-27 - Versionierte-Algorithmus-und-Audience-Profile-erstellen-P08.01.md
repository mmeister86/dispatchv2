---
id: TASK-27
title: Versionierte Algorithmus- und Audience-Profile erstellen (P08.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 02:51'
labels:
  - p08
  - jev
  - r2
milestone: m-2
dependencies:
  - TASK-1
  - TASK-7
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
  - .docs/decisions/release-scope.md
priority: medium
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P08.01.
Phase: P08 – Algorithm Intelligence im Composer.

**Abhängigkeit:** P00.01, P02.01. Die Profile werden vor der MVP-Abnahme benötigt; keine Abhängigkeit auf P07.03. **Dateien:** `convex/intelligence/algorithmProfiles.ts`, `convex/intelligence/audienceProfiles.ts`, `.docs/decisions/analysis-contract.md`; Test `convex/intelligence/profiles.test.ts`.

- Aussagen der X-Algorithmus-Unterlage gegen konkrete öffentliche Quellstände prüfen; belegte Mechanismen, Interpretation und unbekannte Produktionsdetails trennen.
- Profilzustände `draft`, `reviewed`, `active`, `retired` mit Quellen-Commit, Gültigkeit und internem Freigabenachweis einführen.
- Audience-Profile versionieren und Embeddings zusammen mit Modellkennung, Dimension und Erstellungszeit speichern.
- Die bisherigen sieben Dimensionen und beiden Reichweitenperspektiven mit dem Jev-Inhaltsmodell abgleichen; unbelegte Reichweitenperspektiven nicht als prognostizierte Zahlen übernehmen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

### JEV-Abgleich vom 18.09.2026

Den bisherigen Intelligence-Vertrag mit JEV §§9–20, 26 und 47–49 abgleichen. Explizit trennen: semantische Inhaltsmerkmale, deterministische Post-Signale, beobachtete Account-Performance und tatsächlich definierte Audience-Passung. Die UI darf aus dem Beispiel-Frageset kein ungemessenes „Good audience fit“ ableiten.

Fragesätze, aufgelöstes Modell soweit verfügbar, Normalisierung, Algorithmus-/Audience-Profil, Scoreformel und Routing-/Verifikationspolicy separat versionieren. Schwellen, Gewichte und Cold-Start-Werte als zu evaluierende Startannahmen dokumentieren. Dimensionen dienen einer Inhaltsheuristik und keiner Vorhersage von Reichweite, Likes oder Umsatz; unbelegte Plattformalgorithmus-Annahmen werden nicht zur Wahrheit erklärt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine Analyse referenziert genau einen aktiven Profilstand.
- [ ] #2 Profilwechsel verändern historische Predictions nicht.
- [ ] #3 Fehlendes Audience-Profil führt zu ehrlicher unvollständiger Bewertung, nicht zu erfundener Passung.
- [ ] #4 Eine Zuordnung dokumentiert für jede bisherige Dimension, ob sie Jev, deterministische Logik, ein eigenes Audience-Signal oder spätere gemessene Analytics benötigt.
- [ ] #5 Frage-/Formel-/Policy-Änderungen erhalten neue Versionen; fehlende Signale und niedrige Confidence besitzen definierte Zustände.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace actual immutable editorial/account/current role and Demo Operations/Settings/Composer profile boundaries; use reviewed pinned public context and approved analysis contract.
2. Persist immutable algorithm/declared Audience version payloads and atomic current selection with current Owner/Admin review, activation/rollback/retirement receipts.
3. Wire real current profile UI/status through awaited scoped commands; expose missing Audience/embedding/executable analysis honestly, preserve unrelated Demo Operations.
4. Meaningful registered version/selection concurrency/foreign scope/role/lifecycle/replay/rollback/missing signal tests and affected actual React browser; no dummy predictions or model calls.
5. Full/static/build/bundle/codegen/existingEUDev aftergreen/posttypes; exact scoped sourcefreeze, freshSPEC thenQUALITY. Softwareprofileboundary distinguished from actual28.3 analysis AC1/2 and manualDone.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence, /operations — Algorithmusprofile. Profile/question/formula references, honest missing audience fit and cold-start marker; internal candidate/source review and profile version controls. Grenze: No verified X-algorithm model, embeddings, real audience signal or production profile activation. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Delegierte Implementierungsentscheidung vor Score-Code in .docs/decisions/analysis-contract.md dokumentiert: genau dispatch-score-v1 nach TASK-28.2, Cold-Start 0.5 ausdrücklich angenommener Standard, keine erfundene Audience-/Reach-Messung. Menschliche Evals, aktuelle Quellenprüfung und EU-Datenpfad bleiben tatsächliche Abnahmetore.

ROOT release after corrected23.3 SOURCEd9caca72 finalSAME SPEC/freshQUALITY PASS, userwholebackendUI scope/ordinarychoices delegated. Full /tmp/dispatch-intelligence-profiles-implementation-brief.md and trusted /tmp/dispatch-task27-current-profile-map.md; ROOTownsmetadata, onefreshsolewriter source. Versioned immutable algorithm/declared Audience +atomic account/network/surface selection, explicitcurrentOwnerAdmin review/activate/rollback/retire; report publiccodecontext notalreadyactive/no productionrankingclaim/scoringInfluence none. ExistingAudience mutablepreference isdeclaredcontext, noGoodfit/embeddings/measurement. Noactualanalysis/Prediction table now; AC1/2 end-to-end pendingreal28.3 consumer, nofake analyzer. Distinct versionrefs honest unavailable executableSDK until28; no2ledger/genericfactory/promptcopy/vectorstore. ActualcurrentSDKmap /tmp/dispatch-task28-current-adapter-map.md forfuture28, noSDKinstalled/processingproof, nopaidactivation. AllTASK27AC/manualDone remainopen beforefreshreviews.

ROOT read original registered-command RED /tmp/dispatch-task27-red.log04:51:32 beforeprofileimplementation: Could not find module intelligence/profiles. Executed missing-feature contractRED, nothistoricalprivacy/predictionfailure. Sourceowner accepted minimalnewintelligence sharedFields/profiles/algorithmProfiles/audienceProfiles/test, additive schema, one features/intelligence UI, minimalexisting Operations/Settings/Drafts mounts/browser/contract/officialbinding. Concrete account/x/for_you atomicselection, immutablepayloads and command auditreceipt/currentOwnerAdminlifecycle, disconnectedpublishingaccount validinformationalcontext. Noadditionalsharedhelper/analyzer/SDK/embeddings. Fullgreen/reviews/manual stillpending; sourcewindowclosed.
<!-- SECTION:NOTES:END -->
