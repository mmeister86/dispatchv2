---
id: TASK-28.1
title: >-
  Jev-Adapter mit begrenzten Aufrufen und Betriebsflags implementieren (P08.02,
  Teil 1)
status: In Progress
assignee: []
created_date: '2026-09-18 15:20'
updated_date: '2026-10-04 19:25'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence, /operations. Supporting disabled/provider-failure/low-confidence and local cost/bounded-attempt states. Grenze: No TypeSafe SDK integration, EU-only data-path approval, circuit breaker or provider accounting. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
