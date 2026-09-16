---
id: TASK-56
title: GitHub-Signale erweitern (P15.01)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p15
  - r8
  - portfolio-kandidat
milestone: m-8
dependencies:
  - TASK-16
  - TASK-65
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P15.01.
Phase: P15 – Weitere Arbeitsquellen, Wiederverwertung und Medien.

**Abhängigkeit:** P04 und Feedback aus realer Nutzung. **Dateien:** GitHub-Eventhandler und Fixtures, `convex/content/signalPolicies.ts`.

- Pull Requests mit Merge-/Release-Kontext ergänzen; rohe Zwischenstände und spätere Releases nicht mehrfach als identische Geschichte behandeln.
- Issues und Discussions nach konfigurierbarer Relevanz und erlaubtem Datenumfang unterstützen.
- Zusammengehörige Aktivitäten zu einem narrativen Anlass bündeln.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PR, Merge und Release erzeugen keine unbegründete Dreifachveröffentlichung.
- [ ] #2 vertrauliche Diskussionen gelangen nur im ausdrücklich erlaubten Umfang in Modellkontext.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
