---
id: TASK-46
title: Historische Ähnlichkeit und intelligente Redaktionsplanung ergänzen (P12.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p12
  - r5
  - jev
milestone: m-5
dependencies:
  - TASK-42
  - TASK-45
  - TASK-25
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
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

### JEV-Abgleich vom 18.09.2026

Spätere Jev-Recycling-Entscheidungen sind ein Ausbau nach dem Analyzer: Aktualität, Wiederholung und Updatebedarf sowie repost/rewrite/thread/adapt/skip getrennt bewerten. Nur begrenzten erlaubten Account-Kontext und ein definiertes Bezugsdatum senden; unsichere oder fehlende Analyse erzeugt keinen automatischen Vorschlag. Planung, Kalenderprüfung und Ausführung bleiben Convex, Texte dem Generator vorbehalten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine Serie bleibt thematisch zusammenhängend, erzeugt aber keine nahezu identischen Posts.
- [ ] #2 Ein wiederkehrender Planlauf verschiebt oder ersetzt keine bestehenden Termine ohne Auftrag.
- [ ] #3 Wenn Recycling-Signale eingesetzt werden, führen niedrige Confidence, fehlender Zeitkontext oder Providerausfall zum Verzicht auf den automatischen Vorschlag; Termine/Freigaben bleiben nutzerkontrolliert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /plans, /drafts/:id, /analytics — Muster & Learnings. Recurring-series preferences, related-topic history hints and contextual repetition/timing caveats. Grenze: No semantic similarity or intelligent recurring jobs; series/timing/reuse signals are local illustrative preferences. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
