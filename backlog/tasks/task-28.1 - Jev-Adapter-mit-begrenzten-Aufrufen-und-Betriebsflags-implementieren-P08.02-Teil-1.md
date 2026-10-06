---
id: TASK-28.1
title: >-
  Jev-Adapter mit begrenzten Aufrufen und Betriebsflags implementieren (P08.02,
  Teil 1)
status: In Progress
assignee: []
created_date: '2026-09-18 15:20'
updated_date: '2026-10-06 03:31'
labels:
  - p08
  - jev
  - teilpaket
  - r2
milestone: m-2
dependencies:
  - TASK-1
  - TASK-17
  - TASK-27
references:
  - .docs/JEV_INTEGRATION.md
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/decisions/release-scope.md
parent_task_id: TASK-28
priority: medium
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Verantwortung: convex/ai/jev/client.ts, types.ts, normalize.ts, thresholds.ts und Provider-Contract-Tests. R2-Grundlage für den Post Analyzer, ohne automatische Workflow-Entscheidungen.

- Aktuelle offizielle SDK-API und Node-/Convex-Runtime prüfen, SDK-Version pinnen und TypeSafe nur in vertrauenswürdigen serverseitigen Actions aufrufen. Alle SDK-Abhängigkeiten bleiben innerhalb convex/ai/jev; TYPESAFE_API_KEY bleibt außerhalb Browser, Datenbankdokumenten und Logs.
- Nur entscheidungsrelevanten Kontext senden. Die EU-only-/Datenschutzprüfung aus TASK-1 ist vor Kundendaten zwingend; fehlende Freigabe hält reale Aufrufe deaktiviert. Mocks erlauben Entwicklung ohne Kundendatenübertragung.
- choice und score liefern getrennte Confidence; noul bleibt eine skalare Wahrscheinlichkeit ohne erfundene Confidence. Fehlende, unendliche oder außerhalb des Vertrags liegende Werte nicht als gültige Analyse normalisieren.
- timeout, rate_limit, provider_error, invalid_response und low_confidence getrennt behandeln. Startwerte 2500 ms für Composer, 5000 ms für Hintergrund nur als konfigurierbare Hypothese; höchstens ein kurzer transienter Retry im Gesamtbudget. SDK-, Action- und Workflow-Retries dürfen sich nicht multiplizieren.
- Circuit Breaker mit dokumentierter Öffnungs- und Erholungsregel; globale und funktionsbezogene Flags standardmäßig aus. Analyzer wird zuerst intern aktiviert, Routing/Verifikation/Network Fit bleiben aus. Deaktivierung wirkt ohne Deployment.
- Operation, Latenz, Erfolg, Modell, Frageversion, Usage und Fallback je Versuch messen; keine Entwurfstexte oder Secrets in allgemeinen Logs/Rybbit. Aktuelle Preise nur in versionierter Kostenkonfiguration.

Quelle: .docs/JEV_INTEGRATION.md. Geplante Arbeit; Umsetzung im freigegebenen Release-Umfang. Keine Implementierung oder Providerfreigabe durch diese Backlog-Anpassung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gepinnter SDK-/Runtime-Durchstich ist dokumentiert; reale Kundendatenaufrufe erfordern den EU-only-/Datenschutznachweis aus TASK-1.
- [ ] #2 Contract-Tests unterscheiden choice-/score-Confidence und noul-Wahrscheinlichkeit und weisen fehlende oder ungültige Antworten zurück.
- [ ] #3 Tests für Timeout, Rate Limit, Providerfehler und SDK-Retries belegen Gesamtzeit-, Versuchs- und Kostenlimits sowie Circuit-Breaker-Erholung.
- [ ] #4 Usage wird je tatsächlichem Versuch höchstens einmal verbucht und jeder weitere Versuch benötigt Budgetdeckung.
- [ ] #5 Flags können Jev ohne Deployment deaktivieren. API-Schlüssel gelangen weder ins Frontend noch in Assessments oder Logs; Assessments und allgemeine Telemetrie speichern keine zusätzlichen privaten Draft-/Prompt-Kopien. Die autorisierte Darstellung und Bearbeitung von Entwürfen im Composer bleibt möglich.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin verified official SDK and prove server Action runtime with intercepted transport.
2. Implement strict normalization, absolute call bounds, default-off flags and bounded circuit with visible missing processing/configuration state.
3. Extend the existing single attempt ledger/shared three-scope counters for narrowly owned Jev attempts, exact current-purpose admission and safe late settlement.
4. Run meaningful registered financial/source/SDK controls, full checks and existing EU Dev; freeze exact source and independent SPEC then QUALITY.
5. Document software evidence; retain manual Done and actual EU-processing acceptance open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence, /operations. Supporting disabled/provider-failure/low-confidence and local cost/bounded-attempt states. Grenze: No TypeSafe SDK integration, EU-only data-path approval, circuit breaker or provider accounting. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

ROOT readonly preparation: current official SDK0.6.0/current primary source and Context7 docs mapped, no install or runtime acceptance yet. Release waits final27 review loop. Missing EU-processing evidence keeps real calls disabled; user preference visible configuration guidance. New concrete analyzer-purpose owner must reuse sole aiAttempts ledger/shared counters, not generation/native-search grants. No AC/Done/live processing claimed.

Implementation released after final27 independent SPEC/QUALITY and corrected label review PASS. Fresh sole source writer uses current SDK0.6.0 primary/Context7 map, strict runtime normalization/bounds/default-off flags/circuit and existing single ledger counters with concrete analyzer ownership. No live paid calls/processing or policy/grant activation; future actual questions28.2/assessments28.3, no arbitrary public classification API. Full checks and independent reviews required before AC; manual Done open.

ROOT read genuine normalization RED05:28:24 two executed failures (fractional valid score success and lowconfidence) before implementation, distinct GREEN05:29:10 two PASS. Actual SDK0.6.0 narrow package/lock pin underway; production resolver explicitly denies old27 unavailable refs. Internal SDK/runtime/admission/ledger/circuit/full checks pending. Minimal existing cache/eval-test receipt-owner discrimination authorized, no22.3 oracle/report retuning. No AC/Done/EU-processing/provider activation.
<!-- SECTION:NOTES:END -->
