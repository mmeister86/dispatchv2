---
id: TASK-59
title: Generierte Bilder und erweiterte Videoarbeit ergänzen (P15.04)
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
  - TASK-9
  - TASK-37
  - TASK-65
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P15.04.
Phase: P15 – Weitere Arbeitsquellen, Wiederverwertung und Medien.

**Abhängigkeit:** P02.03, P10-Usage, bestätigte Nachfrage. **Dateien:** `convex/media/generation.ts`, `convex/media/jobs.ts`, `src/features/drafts/media-studio.tsx`.

- Bildgenerierung mit Briefing, Kostenanzeige, Jobstatus, Herkunft und manueller Auswahl anbieten.
- Varianten, Alt-Text und plattformgerechte Ausgaben in die bestehende Asset-Versionierung integrieren.
- Video zunächst mit belegtem Bedarf spezifizieren: Upload-Aufbereitung, Untertitel oder Ausschnitte sind getrennte Fähigkeiten von vollständiger Generierung.
- Abbruch, Fehlversuche, große Dateien und Speicher-/Kostenlimits behandeln.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Generierung verändert keinen freigegebenen Post.
- [ ] #2 Nur ausdrücklich ausgewählte Medien werden Bestandteil einer neuen Version.
- [ ] #3 Kosten und externe Verarbeitung sind nachvollziehbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
