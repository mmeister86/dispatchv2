---
id: TASK-42
title: Account-Baselines und Performance-Ansichten entwickeln (P11.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p11
  - r5
milestone: m-5
dependencies:
  - TASK-41
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P11.02.
Phase: P11 – Performance Feedback und Account Intelligence.

**Abhängigkeit:** P11.01 und genügend beobachtete Daten. **Dateien:** `convex/performance/baselines.ts`, `src/features/analytics/post-performance.tsx`, `src/features/analytics/account-overview.tsx`; Test `convex/performance/baselines.test.ts`.

- Vergleichsgruppen nach Account, Format und Messalter bilden; kleine Gruppen sichtbar begrenzen.
- Themen, Formate und Veröffentlichungsfenster beschreibend auswerten.
- Prediction und Ergebnis nebeneinanderstellen, ohne nicht messbare Dimensionen als validiert zu kennzeichnen.
- Outcome-Daten als kompakte `performance_signal`-Einträge an den Content-Kontext zurückgeben.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Der Nutzer kann nachvollziehen, welche Posts relativ zur passenden eigenen Basis gut liefen.
- [ ] #2 Diagramme weisen Zeitraum, Fallzahl und fehlende Daten aus.
- [ ] #3 Follower-Wachstum wird nicht als bewiesene Post-Attribution dargestellt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
