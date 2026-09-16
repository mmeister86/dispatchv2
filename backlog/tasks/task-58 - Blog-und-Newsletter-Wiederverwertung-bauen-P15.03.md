---
id: TASK-58
title: Blog- und Newsletter-Wiederverwertung bauen (P15.03)
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
  - TASK-45
  - TASK-52
  - TASK-65
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P15.03.
Phase: P15 – Weitere Arbeitsquellen, Wiederverwertung und Medien.

**Abhängigkeit:** P12.01, P14.01. **Dateien:** `convex/content/repurposing.ts`, `src/features/drafts/repurpose-wizard.tsx`; Test `tests/e2e/repurposing.spec.ts`.

- Vom Nutzer bereitgestellte oder berechtigt zugängliche Langtexte importieren und Quellenbezug erhalten.
- Aussagen, Zielgruppe und wiederverwendbare Abschnitte extrahieren; keine neuen Tatsachen ergänzen.
- Mehrere eigenständige Ideen und kanalgeeignete Varianten vorschlagen.
- Serienabstand, Überschneidung und individuelle Freigaben in den Kalender übernehmen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Artikel kann mehrere brauchbare Posts liefern, ohne Zitate zu verfälschen oder fremde Inhalte als eigene Erfahrung auszugeben.
- [ ] #2 Herkunft und Nutzungsberechtigung sind im Workflow berücksichtigt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
