---
id: TASK-31
title: 'Betriebsereignisse, Alerts und Wiederherstellung konsolidieren (P09.01)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p09
  - r3
milestone: m-3
dependencies:
  - TASK-26
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein synthetischer Fehler führt zu einem nachvollziehbaren Ereignis und einer passenden Betreiberaktion.
- [ ] #2 Ein still hängender Job wird erkannt.
- [ ] #3 Wiederherstellung ist anhand des Runbooks möglich.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
