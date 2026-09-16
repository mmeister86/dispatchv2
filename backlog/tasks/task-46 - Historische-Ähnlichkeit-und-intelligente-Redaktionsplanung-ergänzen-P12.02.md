---
id: TASK-46
title: Historische Ähnlichkeit und intelligente Redaktionsplanung ergänzen (P12.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p12
  - r5
milestone: m-5
dependencies:
  - TASK-42
  - TASK-45
  - TASK-25
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P12.02.
Phase: P12 – Persönliche Stimme, strategische Planung und kontinuierliche Verbesserung.

**Abhängigkeit:** P11.02, P12.01, P07. **Dateien:** `convex/content/similarity.ts`, `convex/planning/strategy.ts`, `convex/planning/recurring.ts`; Test `convex/planning/strategy.test.ts`.

- Ähnliche eigene Posts semantisch auffinden, innerhalb des Accounts und zulässigen Workspace-Kontexts.
- Wiederholungen, Themenübersättigung, bewährte Formate und geplante Serien berücksichtigen.
- Regelmäßige Planvorschläge mit Nutzerfrequenz und Zeitfenstern erzeugen; bestehende Termine weiterhin schützen.
- Erst bei geeigneter Historie vorsichtige Timing-Empfehlungen anbieten und deren Evidenz zeigen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine Serie bleibt thematisch zusammenhängend, erzeugt aber keine nahezu identischen Posts.
- [ ] #2 Ein wiederkehrender Planlauf verschiebt oder ersetzt keine bestehenden Termine ohne Auftrag.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
