---
id: TASK-41
title: Messpipeline ausbauen und historischen Kontext importieren (P11.01)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p11
  - r5
milestone: m-5
dependencies:
  - TASK-30
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P11.01.
Phase: P11 – Performance Feedback und Account Intelligence.

**Abhängigkeit:** P08.04; Datenverwendungsfreigabe für den konkreten Zweck. **Dateien:** `convex/performance/collect.ts`, `convex/performance/backfill.ts`, `convex/performance/metricDefinitions.ts`; Test `convex/performance/collect.test.ts`.

- Snapshot-Fenster nach tatsächlichem Nutzen und Kosten bis zu den vorgesehenen fünf Zeitpunkten ausbauen.
- Aktualisierungsverzögerungen, gelöschte Posts, abgelaufene Abfragefenster, widerrufene Tokens und fehlende Metriken abbilden.
- Zulässige eigene historische Posts als Kontext importieren; keine historischen privaten Metriken erfinden.
- Einzelelemente und Thread-Aggregate korrekt verknüpfen; verwendete Medienmetriken auf ihre Aggregationsebene prüfen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Import ist idempotent, begrenzt und löschbar.
- [ ] #2 alte Posts mit fehlenden Metriken bleiben als unvollständig markiert.
- [ ] #3 bei nicht erfüllten Zugriffsrechten bleibt der Collector kontrolliert deaktiviert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
