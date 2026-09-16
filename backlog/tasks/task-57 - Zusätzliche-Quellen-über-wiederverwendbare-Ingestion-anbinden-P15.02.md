---
id: TASK-57
title: Zusätzliche Quellen über wiederverwendbare Ingestion anbinden (P15.02)
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
  - TASK-22
  - TASK-33
  - TASK-65
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P15.02.
Phase: P15 – Weitere Arbeitsquellen, Wiederverwertung und Medien.

**Abhängigkeit:** P06-Evidenzvertrag und P09-Lifecycle. **Dateien:** `convex/integrations/sources/`, `convex/research/sourceSubscriptions.ts`, `src/features/settings/sources.tsx`.

- Zuerst RSS und explizit eingegebene Artikelquellen als begrenzte, leicht kontrollierbare Eingänge ergänzen.
- Linear und Notion nach nachgewiesener Nutzung als Arbeitsquellen anbinden.
- Slack und Discord nur über ausdrücklich gewählte Bereiche, Berechtigungen und Retention integrieren.
- Product Hunt als öffentliche Kontextquelle mit korrekter Herkunft, Aktualität und Deduplizierung aufnehmen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).

Quellen einzeln freigeben: RSS/Artikel zuerst; Linear/Notion nach Nutzungsnachweis; Slack/Discord nur für ausdrücklich gewählte Bereiche; Product Hunt mit zulässigem Zugang. Vor Adapter-Coding je ausgewählter Quelle eigene Unteraufgabe mit Auth, Ingestion, Deduplizierung, Fehlern und Löschung anlegen. Nicht alle Quellen sind automatisch beauftragt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Neue Quellen erzeugen dieselben nachvollziehbaren Signals/Research Items.
- [ ] #2 Das Entfernen einer Quelle stoppt Jobs und entfernt oder entkoppelt deren Daten gemäß bestätigter Lifecycle-Regel.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
