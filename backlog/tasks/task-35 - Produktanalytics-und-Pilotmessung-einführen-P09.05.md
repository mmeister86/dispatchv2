---
id: TASK-35
title: Produktanalytics und Pilotmessung einführen (P09.05)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-07 11:28'
labels:
  - p09
  - r3
  - jev
milestone: m-3
dependencies:
  - TASK-26
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P09.05.
Phase: P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität.

**Abhängigkeit:** P07.03. **Dateien:** `src/lib/analytics.ts`, `convex/operations/productEvents.ts`, `.docs/decisions/metric-definitions.md`; Test `convex/operations/productEvents.test.ts`.

- PRD-Ereignisse um Research-Quelle, Planannahme und Intelligence-Nutzung ergänzen, ohne private Inhaltsdaten zu übertragen.
- Erfolgreiche Hintergrundveröffentlichungen serverseitig messen; ein geschlossener Browser darf sie nicht unsichtbar machen.
- Aktivierung, Quellenakzeptanz, Editieraufwand, Zeitersparnis und Kosten je akzeptiertem Entwurf definieren.
- Session-Replay nur nach passender Produkt-/Datenschutzentscheidung und mit wirksamer Maskierung sensibler Flächen einsetzen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

### JEV-Abgleich vom 18.09.2026

Jev-Produktmetriken umfassen Analyse-Nutzung, Latenz, Erfolg, Fallback, Flag-Deaktivierung und Übernahme/Ablehnung von Empfehlungen. Rybbit erhält keine privaten Drafts, Prompts, vollständigen Provider-State oder Secrets. Technische Token-/Kostenmessung bleibt von Inhaltstelemetrie getrennt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ereignisse werden bei Wiederholung nicht doppelt gezählt.
- [ ] #2 kein Prompt, Diff, Token, Textentwurf oder E-Mail-Inhalt wird ungeplant an Analytics übergeben.
- [ ] #3 Das Pilot-Dashboard beantwortet die Fragen aus Abschnitt 12.
- [ ] #4 Geprüfte Jev-Analytics-Payloads enthalten nur freigegebene Produktmetriken und keine privaten Entwurfstexte oder Secrets.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /operations — Pilot-Auswertung. Local draft/review/calendar indicators plus manually entered edit effort, time saving and cost per accepted draft. Grenze: No Rybbit/remote telemetry, automatic time measurement or real pilot results. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root read-only sequel /tmp/dispatch-continuation-35-seams.md erstellt: kein productEvents/Rybbit/metric-definitions Backend vorhanden; native editorial/plan/recommendation/Jev/publication receipts liefern Teilfakten, keine kompletten Kohorten oder gemessenen Aufwand/Zeitersparnis. Nach31/32 Ereignis-/Recipient-Scope bestehende Fakten/prospektive47Outcomes dedupliziert nutzen, keine zweite Eventbus-/Finanzledger und keine private/nestedPayloads/externeTelemetry-Seeding. ThreadPositionen≠vollePublication, cancelledLateConfirm und readOnlyMatch als tatsächlicheBelege getrennt; PlanReplay/lateFinance nie neueCounts. LegacyFeedbackaccept Approval-vs-explicit ambiguous,TextDistance≠Effort,UsersProvisionTime≠SignupCohort undmutableDraftsource≠SourceAttribution. BoundedwindowCoverage/denominators/unknownCosts/currencies/originalSourceMask+physicalintroducedcopyCleanup beforeconsumer; tatsächliche Pilot/Provider/Abnahme offen. KeineSourceImplementation/Testclaim diesesReports.

Weiterer konsolidierter Vertrag .docs/operations-notifications-contract.md bindet ProductMeasurement an bestehende Domain/finite31Occurrence/explicit47Outcomes. Keine externeAnalytics- oder SessionReplay-Entscheidung/SDK durch diesen Vertrag. VollständigeProducerprüfung/final45-50/67-68ProofReconciliation und separate native SourceUnits bleiben vorImplementierung Pflicht.

Read-only future reconciliation adopted: .docs/reviews/task-31-32-35-current-native-reconciliation.md. Reuse finite native publication counts/receipt currencies and prospective human usefulness/effort/attribution facts; default unspecified measurements remain unset, Demo amounts are not native pilot evidence. Reconcile accepted TASK-68 before release. No implementation/test acceptance; all ACs remain open.
<!-- SECTION:NOTES:END -->
