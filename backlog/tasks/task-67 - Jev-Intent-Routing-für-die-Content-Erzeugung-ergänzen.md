---
id: TASK-67
title: Jev-Intent-Routing für die Content-Erzeugung ergänzen
status: In Progress
assignee: []
created_date: '2026-09-18 15:20'
updated_date: '2026-10-06 16:08'
labels:
  - r5
  - jev
  - erweiterung
milestone: m-5
dependencies:
  - TASK-18
  - TASK-28
  - TASK-64
references:
  - .docs/JEV_INTEGRATION.md
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
JEV-Rollout: unterstützte Entscheidungen nach der ersten Analyzer-Auslieferung. Geplante Einordnung R5; verbindlicher Release-Umfang über TASK-2. Keine Voraussetzung für den bestehenden Dispatch-MVP oder das Analyzer-MVP-Gate.

Verantwortung: convex/ai/jev/questions/intentRouting.ts, classifyIntent.ts und Convex-Generatorauswahl im bestehenden Content-Workflow.
- Versionierte Strategien announcement, milestone, launch, educational, thoughtLeadership, conversation, story, promotional und generic klassifizieren. Jede Kategorie besitzt eine explizite Zuordnung oder einen generischen Fallback.
- Konfigurierbare Confidence-Gates zunächst als Hypothesen führen (unter .50 Fallback, unter .90 weicher Vorschlag, ab .90 Routing); Verhalten mit Referenzdaten evaluieren. Low Confidence, Timeout, Providerausfall und ausgeschaltetes Flag verwenden den generischen Generator.
- Jev liefert nur Kategorie/Confidence; Convex entscheidet über den Generator. Nutzerziel und explizit gewählte Strategie bleiben maßgeblich. Erklärungen und generierte Inhalte kommen aus Produkttext beziehungsweise generativem LLM.
- Shared Adapter, Kostenlimits, Telemetrie und Lebenszykluspflichten für neue Entscheidungsdaten wiederverwenden; keine autonome Veröffentlichung und keine unbeschränkte Agentenschleife.

Quelle: .docs/JEV_INTEGRATION.md. Geplante Arbeit; Umsetzung im freigegebenen Release-Umfang. Keine Implementierung oder Providerfreigabe durch diese Backlog-Anpassung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Jede definierte Strategie ist getestet und auf einen verfügbaren Generator oder generischen Fallback abgebildet.
- [ ] #2 Grenzfälle der Confidence-Policy, Nutzerüberschreibung, fehlende Felder, Timeout und Flag-Deaktivierung sind getestet und versioniert nachvollziehbar.
- [ ] #3 Routing verändert weder bestehende Freigaben noch geplante Inhalte und benötigt keine gesonderte autonome Orchestrierung.
- [ ] #4 Entscheidungsdaten unterliegen Workspace-Isolation, Export/Löschung/Retention und vorhandenen Budget-/Telemetriegrenzen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id. Nine explicit strategy choices with user override and clear illustrative suggestion/fallback text. Grenze: No Jev intent classification, generator routing or confidence evaluation. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root read/adopted complete read-only /tmp/dispatch-continuation-67-68-contract-proposal.md; .docs/jev-generation-continuation-contract.md governs after final45/46/47/49/50ProofReconciliation. Actualgenerator only perspectiveJSONIdea generic, all9strategy map honestgeneric; explicituserstrategy wins, thought-leadership boundaryalias→thoughtLeadership nohistoryrewrite. Jevaccess/resolver/receipts currentlyanalyzeronly, concrete operationpurpose/control union extension needed separatelydefaultOFF/sharedledger/proof+cleanup; notmere analyzePost relabel.67.1native then67.2consumer suggested beforeconcreteCLIcreation/source. NoSource/Test/Provider/Abnahme diesesReports.
<!-- SECTION:NOTES:END -->
