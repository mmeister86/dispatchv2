---
id: TASK-11
title: Scheduler und Freigabeprüfung bauen (P03.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 10:14'
labels:
  - p03
  - r1
milestone: m-1
dependencies:
  - TASK-8
  - TASK-10
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P03.02.
Phase: P03 – X-Verbindung, zuverlässiges Publishing und Kalender.

**Abhängigkeit:** P02.02, P03.01. **Dateien:** `convex/publishing/schedules.ts`, `convex/publishing/state.ts`; Test `convex/publishing/schedules.test.ts`.

- Planen, Verschieben und Abbrechen mit Versions- und Accountprüfung implementieren.
- Zeitpunkte als UTC-Instant speichern, Zeitzone für Absicht und Darstellung erhalten.
- Jobgeneration und atomaren Claim einführen; alte oder doppelte Aufrufe wirkungslos machen.
- Termineintrag und Scheduler-Auftrag in derselben Mutation anlegen; die Transaktionsgarantie des Schedulers nicht auf spätere externe API-Aufrufe übertragen.
- Vergangene Termine, Sommerzeitlücken und doppelte lokale Stunden mit expliziter Nutzerentscheidung behandeln.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Doppelter Scheduler-Aufruf erzeugt nur einen Claim.
- [x] #2 Rescheduling neutralisiert den alten Job.
- [x] #3 Storno und Claim besitzen ein definiertes Rennen.
- [x] #4 Sommer-/Winterzeitfälle werden reproduzierbar getestet.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Termine als UTC-Instant samt Nutzerzone und Ausführungsgeneration speichern.
2. Transaktionale Freigabe-/Slotprüfung und generationgebundene Scheduler-Aufrufe implementieren.
3. Verschieben, Stornieren und ausdrücklichen Snapshot-Wechsel an Serveroperationen anbinden.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id, /plans, /calendar. Local schedule/reschedule/cancel, explicit timezone, future-date validation, duplicate slot checks and ambiguous/nonexistent DST time handling. Grenze: No scheduler, atomic server claim, remote jobs or exactly-once guarantee. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Unabhängige SPEC/QUALITY PASS f041927. Atomarer Termin+Job, ein Claim je Generation, alte Jobs/Storno-Rennen, UTC/IANA-DST-Fälle geprüft; letzte verfügbare Kapazität im unabhängigen Konkurrenztest genau einmal gewonnen. Kein externer API-Transaktionsanspruch. Echte X-Sends folgen TASK-10/12, Nutzerabnahme bleibt offen.
<!-- SECTION:NOTES:END -->
