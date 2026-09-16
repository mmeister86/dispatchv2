---
id: TASK-54
title: Gemeinsamen Kalender und mehrkanalige Analyse ergänzen (P14.03)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p14
  - r7
milestone: m-7
dependencies:
  - TASK-53
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P14.03.
Phase: P14 – Multi-Channel Publishing und plattformspezifische Intelligence.

**Abhängigkeit:** P14.02. **Dateien:** `src/features/calendar/channel-filters.tsx`, `src/features/analytics/channel-comparison.tsx`, `convex/intelligence/platformProfiles.ts`.

- Account-/Kanalfilter, getrennte Veröffentlichungszeitpunkte und Status je Variante anzeigen.
- Anpassungen an einer Variante von anderen Varianten entkoppeln; bewusste Übernahme als Vorschlag anbieten.
- Gemeinsame Analysedimensionen mit plattformspezifischen Regeln und belegtem Wissensstand kombinieren.
- Vergleichbare Kennzahlen gegenüber plattformspezifischen oder nicht verfügbaren Metriken abgrenzen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Es gibt keinen scheinbar universellen Reichweitenscore über inkompatible Plattformmetriken.
- [ ] #2 Ein Nutzer erkennt, welche Variante auf welchem Kanal tatsächlich veröffentlicht wurde.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
