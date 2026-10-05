---
id: TASK-55
title: Weitere Plattformen nach dem gleichen vollständigen Gate ausbauen (P14.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p14
  - r7
  - optional
milestone: m-7
dependencies:
  - TASK-54
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P14.04.
Phase: P14 – Multi-Channel Publishing und plattformspezifische Intelligence.

**Abhängigkeit:** P14.03 und jeweilige Nachfrage-/Machbarkeitsentscheidung. **Dateien:** konkret benannte Provider-Module je neuem Backlog-Paket.

- LinkedIn, Bluesky, Mastodon und Threads im priorisierten Portfolio führen.
- Für Mastodon insbesondere Instanzfähigkeiten und getrennte Instanz-Zugänge berücksichtigen.
- Instagram, Facebook und TikTok nur nach eigener Produktspezifikation aufnehmen; Medienproduktion, Kontotypen und API-Zugang verändern den Workflow wesentlich.
- Für jeden neuen Kanal dieselben Freigabe-, Fehler-, Export- und Löschtests wiederholen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Jeder freigegebene Kanal besitzt dokumentierte Fähigkeiten und Einschränkungen.
- [ ] #2 Keine Plattform wird nur durch einen neuen Enum-Wert als unterstützt ausgewiesen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/integrations, /drafts/:id. Illustrative X/LinkedIn/Bluesky/Mastodon accounts including Mastodon HTTPS instance input; independent local variant workflow. Grenze: No supported live integration promise; Threads/Instagram/Facebook/TikTok have no introduced real adapter or workflow. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
