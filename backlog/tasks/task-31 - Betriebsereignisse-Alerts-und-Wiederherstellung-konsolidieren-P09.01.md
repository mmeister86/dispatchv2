---
id: TASK-31
title: 'Betriebsereignisse, Alerts und Wiederherstellung konsolidieren (P09.01)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 16:04'
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
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P09.01.
Phase: P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität.

**Abhängigkeit:** erste Umsetzung ab P03; Abschluss nach P07. **Dateien:** `convex/operations/errors.ts`, `convex/operations/systemEvents.ts`, `convex/operations/health.ts`, `src/features/settings/system-status.tsx`, `.docs/runbooks/publishing.md`.

- Stabile Fehlercodes, nutzbare Fehlermeldungen und interne Diagnose trennen.
- Runs, Webhooks, Planungen und Provider-Aufrufe mit Korrelations-IDs verbinden; Secrets und private Inhalte aus allgemeinen Logs entfernen.
- Alerts für hängende Veröffentlichungen, Häufungen von Reauth, Webhook-Rückstau und Budgetanomalien einrichten.
- Runbooks für X-Ausfall, Research-Ausfall, fehlerhafte Workflows, kompromittierte Credentials und Wiederaufnahme erstellen und üben.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Die frühe Grundlage beginnt mit P03. Der Abschluss dieses Konsolidierungspakets liegt nach MVP; das separate R2-Basisbetrieb-Ticket verhindert einen Abhängigkeitszyklus.

### JEV-Abgleich vom 18.09.2026

Jev-Operationen und Fehlerklassen in Betriebsereignisse/Runbooks aufnehmen: Latenz, Erfolg, Modell/Frageversion, Usage, Fallback, Timeouts, Rate Limits und Circuit-Breaker-Zustand ohne Draft-Inhalte oder Secrets. Deaktivierung ohne Deployment, kontrollierte Erholung und Budgetanomalien üben. Analyzer-Ausfall zeigt einen nutzbaren Status; Publishing bleibt unter seinen bestehenden Regeln möglich.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein synthetischer Fehler führt zu einem nachvollziehbaren Ereignis und einer passenden Betreiberaktion.
- [ ] #2 Ein still hängender Job wird erkannt.
- [ ] #3 Wiederherstellung ist anhand des Runbooks möglich.
- [ ] #4 Ein Jev-Ausfall und anschließende Erholung sind mit begrenzten Aufrufen, sichtbarem Status und funktionierendem manuellen Publishing geübt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /operations — Systemzustand, /calendar. Mock operational event log, correlation IDs, attention/error/uncertain states, repeat/reconcile previews and publishing next actions. Grenze: No live health monitor, alerts, runbooks exercise or provider recovery evidence. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root hat /tmp/dispatch-continuation-31-32-seams.md vollständig gelesen. VorhandeneEvents/watchdogs/GithubRecovery/JevCircuit/nativeDeadlines/usagePending verwenden; realOperationsHealth derzeit unavailable. KleinsterfolgeReceiptScopedOverview→finiteDurableTransitions/Dedupe→realRunbookLinks, keineprivatePrompt/Research/GlobalFinanceOffenlegung oderallHealthyausleererLatestPage. Recovery verlinkt existierendeautorisiertenDomainCommands, niegenericRetryvonunknownPublishing/Cost. NeueQuelle/ActorPayloads aktuellmaskieren+physischcleanupvorConsumer, keine33Deferral. KeinSource/Test/Provider/Mail/Dev-Nachweis ausread-onlyReport; final48fflineRefs reconciliieren.

Root adotiert read-only31/32Seams und .docs/operations-notifications-contract.md: zuerst bounded native Overview aus tatsächlichen vorhandenen Domainreceipts/leases/currentprivateScope, kein renderProviderCall/emptyAllHealthy/genericUnknownResend/neuerLedger. CrossDomainEvent nur bei tatsächlich fehlendem verbrauchtemReceipt; finiteOriginalOccurrence/Dedupe imOwnertransaction, keine gefälschtenEditorialDraftIDs/Pollzählung. Nach final45-50/67-68ProofGraph konkreteSourceUnits; Recovery bleibt bestehende autorisierteCommands. Keine31Source/Test/ProviderAbnahme dieserVorbereitung.
<!-- SECTION:NOTES:END -->
