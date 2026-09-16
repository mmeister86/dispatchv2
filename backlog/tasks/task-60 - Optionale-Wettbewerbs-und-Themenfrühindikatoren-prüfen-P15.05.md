---
id: TASK-60
title: Optionale Wettbewerbs- und Themenfrühindikatoren prüfen (P15.05)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p15
  - r8
  - optional
  - portfolio-kandidat
milestone: m-8
dependencies:
  - TASK-23
  - TASK-42
  - TASK-65
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P15.05.
Phase: P15 – Weitere Arbeitsquellen, Wiederverwertung und Medien.

**Abhängigkeit:** stabile P06- und P11-Daten, bestätigte Nachfrage und zulässige Quellen. **Dateien:** `convex/research/topicDynamics.ts`, spätere spezifizierte Wettbewerbsansichten.

- Öffentlich beobachtbare Vergleichsaccounts und Themen nur in begrenztem, transparentem Umfang analysieren.
- Steigende Aufmerksamkeit als experimentellen Frühindikator mit Rücktest und Fehlalarmquote ausweisen.
- Ergebnisse auf die eigene Positionierung beziehen; keine automatische Nachahmung fremder Posts erzeugen.
- Vor Umsetzung explizit zwischen der bereits vorhandenen Trenderkennung und einer neuen Trendprognose unterscheiden.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Der Zusatznutzen gegenüber normaler proaktiver Recherche ist im Pilot nachweisbar.
- [ ] #2 Prognosen ohne ausreichende Daten werden nicht als fertige Fähigkeit vermarktet.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
