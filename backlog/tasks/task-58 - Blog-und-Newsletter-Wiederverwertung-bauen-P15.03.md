---
id: TASK-58
title: Blog- und Newsletter-Wiederverwertung bauen (P15.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p15
  - r8
  - portfolio-kandidat
  - jev
milestone: m-8
dependencies:
  - TASK-45
  - TASK-52
  - TASK-65
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
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

### JEV-Abgleich vom 18.09.2026

Bei Auswahl dieses Portfolio-Pakets Jev nur für begrenzte Recycling-/Reuse-Entscheidungen verwenden (Aktualität, Redundanz, Updatebedarf, Wiederverwendungsstrategie). Extraktion, Zusammenfassung und neue Texte bleiben beim generativen LLM; Convex steuert Planung/Freigaben. Provider-/Kontext-/Datenschutzgrenzen und Fallback „keine automatische Empfehlung“ gelten auch hier.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Artikel kann mehrere brauchbare Posts liefern, ohne Zitate zu verfälschen oder fremde Inhalte als eigene Erfahrung auszugeben.
- [ ] #2 Herkunft und Nutzungsberechtigung sind im Workflow berücksichtigt.
- [ ] #3 Ein eingesetzter Jev-Recycling-Schritt erzeugt nur strukturierte Entscheidungen; unsichere/fehlende Antworten lösen weder Veröffentlichung noch unkontrollierte Wiederverwertung aus.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /repurpose, /drafts/:id, /calendar. Paste text or URL as reference, confirm rights, select fixed demo sections, review channel variants and create individually approved drafts; overlap/source warnings. Grenze: Provided input is not fetched or AI-extracted; all output passages are explicitly fixed examples. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
