---
id: TASK-30
title: Messgrundlage bereits in der Beta schaffen (P08.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 07:23'
labels:
  - p08
  - r3
  - jev
milestone: m-3
dependencies:
  - TASK-28
  - TASK-12
  - TASK-1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P08.04.
Phase: P08 – Algorithm Intelligence im Composer.

**Abhängigkeit:** P08.02, P03.03 und Metrik-/Datenverwendungstor aus P00.01. **Dateien:** `convex/performance/capabilities.ts`, `convex/performance/snapshots.ts`, `convex/content/feedback.ts`; Test `convex/performance/snapshots.test.ts`.

- Verfügbare eigene Post-Metriken anhand tatsächlicher Credentials erfassen und deren Definition speichern.
- Einen kostengünstigen ersten Snapshot-Zeitplan aktivieren, beispielsweise 24 und 48 Stunden; weitere Fenster erst bei ausreichendem Budget.
- Annahme, Ablehnung und Bearbeitungsumfang der Entwürfe unabhängig von X-Metriken erfassen.
- Datenherkunft, Messalter und fehlende Felder so speichern, dass P11 darauf aufbauen kann.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D12: Konkreten Analysezweck und Datenverwendung freigeben; keine pauschale Trainingserlaubnis.

### JEV-Abgleich vom 18.09.2026

Das beim Publish tatsächlich verfügbare Assessment unveränderlich mit publizierter Inhaltsversion, Account, Netzwerk und Veröffentlichung verknüpfen. Provider/Modell, Frage-/Profil-/Formelversion, semantische und deterministische Signale sowie Beobachtungsfenster persistieren. Bei fehlender Analyse bleibt der Bezug ausdrücklich leer/unbekannt; kein Publikationsblocker und keine nachträglich berechnete Bewertung als damaligen Kenntnisstand ausgeben. Spätere Analytics werden über diesen Bezug für kontrollierte Kalibrierung verbunden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Die Beta sammelt zulässige reale Daten, ohne bereits accountbezogene Wirksamkeit zu behaupten.
- [x] #2 Ein nicht verfügbares Feld erscheint nicht als gemessene Null.
- [x] #3 Der Collector kann pausiert und gelöscht werden.
- [x] #4 Publikations-Snapshot verweist auf genau die veröffentlichte Version und den damals verfügbaren Analyse-/Versionsstand; spätere Analyseänderungen überschreiben ihn nicht.
- [x] #5 Posts ohne Assessment werden weiter veröffentlicht und ihre fehlende Analyse bleibt bei späteren Vergleichen explizit erkennbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. After accepted TASK29, trace immutable publish/assessment, OAuth read authority and existing accounting paths.
2. Capture contemporaneous exact-version publication knowledge or explicit null at first send; preserve unknown-reconciliation knowledge.
3. Add bounded default-OFF own-metrics purpose/capability/consent with same financial ledger, native 24/48-hour snapshots, pause/delete/current generation fences and separate protected context cleanup.
4. Wire actual Analytics unknown/zero/configuration states and independent versioned editorial feedback, retaining explicit Demo.
5. Verify meaningful registered controls/static/full/existing EU Dev/browser, freeze/scoped commit, independent SPEC then QUALITY; retain real-data/manual Done gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /analytics, /drafts/:id. Supporting missing-metric/unknown-value displays, local metric collection pause/delete and versioned composer analysis display. Grenze: No actual 24/48-hour metric snapshots or provider/publish-time assessment joins. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only current metrics receipt prepared at /tmp/dispatch-x-metrics-current-docs.md: exactly three Context7 commands (library first, official X API v2 /websites/x_x-api) plus primary official page verification, no live provider or activation. Current metrics guide documents own user-context private metrics within30days and distinct repeated impressions/video aggregation, but current lookup reference differs in post.fields/repost_count versus guide tweet.fields/retweet_count. Future collector must version and explicitly verify the configured dialect, field eligibility and missing/partial states; this discrepancy is not silently normalized into measured zeros. No TASK30 code or acceptance is claimed; D12 collection-purpose/window/budget decision remains before activation.

ROOTpreparation only until TASK29 finalQUALITY softwareacceptance. Current brief c4bc7ecc readfull, map bb994855/currentofficialXdocs48dce459 reused. ActualbeforeSend→onePOST→immediatereceipt boundary traced, capturethen-known exactversion assessment or NULL, no laterbackfill or publishblock. D12 purpose own-post descriptive/editorialfeedback, no training/embed/causal/autonomy; operatorapproval notactivated. Separate approvedownnumericcounts authority from upstreamshortResearchtext horizons; protectedassessment/context joins stillfullsource/horizon cleanup. Explicitdialect/missingfield states, sameledger/purpose/currentOAuth, bounded24/48windows. Newrows/jobs futureinventory/export/delete/recovery needsdocumenting notpremature33/36certification. No sourcewriter/code/AC/live/manualDone yet.

Released after reviewed TASK29 correctedSOURCE43647691, SPEC7/freshQUALITY3 own PASS/full674/39/EUDev07:52:14, metadata a707dd4. Fresh sole writer owns actual metrics/publicationbinding/Analytics/editorialfeedback and affected tests; ROOT metadata only. Current brief c4bc7ecc authoritative, especially separate independent own-count authority and protected-derived source cleanup. Default OFF/visible missing configuration; no approvals/policy seeds/activation. Exact freeze before scoped commit then SPEC and QUALITY; AC1 real permitted data and all manual Done gates remain open.

Software release after reviewed SOURCE 18add46f08950b0e7e368ff7c437803e4331e67a (tree 37ea249). Independent replacement SPEC:8/2 PASS at09:17:10; same fresh QUALITY:3 PASS at09:19:03. Original reviewer bodies and genuine RED logs remain unchanged. Original writer and SPEC recovery failed with actual agent-thread-limit refusals, requiring explicitly qualified replacements. Captured source-horizon defects were corrected across shared assessment/feedback reads and cleanup; final-budget payload loss and permanently running denied responses were corrected without weakening current authority or original late accounting. Final700 tests/40 files,26 focused cases,static/build/bundle/codegen and existing EU Dev09:11:42(6.47s)/posttypes pass. ROOT verified all21 current/committed source paths and198 frozen evidence/receipt records. Final receipts/hashes and pending manual cases are in .docs/reviews/task-30-performance-validation.md. AC2–5 are checked as bounded SOFTWARE only. AC1 actual permitted real collection, manual DoD and explicit Done consent remain OPEN. No provider/policy/grant activation, real entitlement, empirical efficacy or sustained24/48-hour live proof. Qualified mocked Analytics evidence was reused for unchanged UI. Future TASK33/36 inventory remains a handoff. Continue directly with TASK41.
<!-- SECTION:NOTES:END -->
