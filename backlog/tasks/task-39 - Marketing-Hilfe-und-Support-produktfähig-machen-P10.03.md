---
id: TASK-39
title: 'Marketing, Hilfe und Support produktfähig machen (P10.03)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p10
  - r4
milestone: m-4
dependencies:
  - TASK-35
  - TASK-37
  - TASK-38
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P10.03.
Phase: P10 – Kommerzielles SaaS und öffentliche Veröffentlichung.

**Abhängigkeit:** P09.05, P10.01; vollständige Abnahme zusätzlich nach P10.02. **Dateien:** öffentliche Seiten unter `src/routes/`, `src/features/help/`, `.docs/runbooks/support.md`.

- Produktseite, Nutzenbeispiele, Preise, Onboarding-Hilfe und häufige Fehlerfälle erstellen.
- Rechercheumfang, Freigabekontrolle und heuristische Scores realistisch beschreiben.
- Datenschutz-/Vertragsinformationen, verantwortliche Betreiberinformationen und notwendige Einwilligungswege fachlich prüfen lassen.
- Supportablauf mit minimalem Datenzugriff, nachvollziehbaren Zugriffsfreigaben und Eskalation etablieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein neuer Nutzer kann sich ohne Entwicklerhilfe registrieren, bezahlen, X verbinden, ersten Content planen, Kosten verstehen und kündigen.
- [ ] #2 Support benötigt keinen pauschalen Zugriff auf alle privaten Inhalte.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /welcome, /help, /legal, /team. Public benefits/example prices, registration links, help/error guidance, clearly provisional legal/demo notes, scoped time-limited support consent. Grenze: No reviewed legal contract/operator certification or actual support access. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
