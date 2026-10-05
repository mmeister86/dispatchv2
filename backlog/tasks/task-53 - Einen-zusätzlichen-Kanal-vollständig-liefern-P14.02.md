---
id: TASK-53
title: Einen zusätzlichen Kanal vollständig liefern (P14.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p14
  - r7
  - arbeitspaket
milestone: m-7
dependencies:
  - TASK-52
  - TASK-53.1
  - TASK-53.2
  - TASK-53.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P14.02.
Phase: P14 – Multi-Channel Publishing und plattformspezifische Intelligence.

**Abhängigkeit:** P14.01 und Provider-Freigabe. **Geplante Dateien für den ersten Kandidaten:** `convex/integrations/linkedin/oauth.ts`, `convex/integrations/linkedin/publish.ts`, `convex/integrations/linkedin/metrics.ts`, `src/features/settings/linkedin-account.tsx`, `tests/e2e/multichannel.spec.ts`.

- LinkedIn als ersten Nachfragekandidaten mit Bluesky und Mastodon anhand Zielgruppe, API-Zugang, Kosten und Betriebsaufwand vergleichen.
- Genau einen verfügbaren Kanal auswählen. Falls das Entscheidungstor statt LinkedIn Bluesky oder Mastodon auswählt, die konkreten Adapterdateien und Testfälle im Paket vor Coding-Beginn entsprechend neu festlegen.
- Auth, Inhaltsvalidierung, Medien, Veröffentlichung, Wiederaufnahme und messbare Ergebnisse end-to-end implementieren.
- Die gemeinsame Idee in kanalgeeignete Länge, Struktur und Ton überführen; separate Freigaben beibehalten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D09/D14: Genau einen zusätzlichen Kanal auswählen; LinkedIn ist ein Kandidat, keine Vorentscheidung.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).

Großes Paket: Die zugeordneten Unteraufgaben liefern die Implementierung in begrenzten Schritten. Dieses übergeordnete Ticket hält den vollständigen Planvertrag und wird erst nach integrierter Abnahme aller Unteraufgaben geschlossen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J11 funktioniert für X und den ausgewählten Kanal.
- [ ] #2 Die Plattform ist erst integriert, wenn der vollständige Loop abgenommen wurde.
- [ ] #3 eine bloße OAuth-Verbindung genügt nicht.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/integrations, /drafts/:id, /calendar, /analytics. Mock additional-channel connection and independent content/review/scheduling/result surfaces. Grenze: No additional real channel is selected, authorized or integrated. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
