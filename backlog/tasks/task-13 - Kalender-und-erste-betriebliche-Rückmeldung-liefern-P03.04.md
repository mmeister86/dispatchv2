---
id: TASK-13
title: Kalender und erste betriebliche Rückmeldung liefern (P03.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p03
  - r1
milestone: m-1
dependencies:
  - TASK-11
  - TASK-12
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P03.04.
Phase: P03 – X-Verbindung, zuverlässiges Publishing und Kalender.

**Abhängigkeit:** P03.02–P03.03. **Dateien:** `src/features/calendar/`, `src/lib/dates.ts`, `src/features/drafts/publish-status.tsx`, `convex/operations/systemEvents.ts`; Test `tests/e2e/manual-publishing.spec.ts`.

- Wochen-, Monats- und Agendaansicht mit begrenzten Zeitraumabfragen bauen.
- Ungeplante Entwürfe separat anbieten; Verschieben geplanter Inhalte und Tastatur-Alternative unterstützen.
- Erfolg, Fehler, Teilveröffentlichung und nötige Reauth mit konkreten nächsten Aktionen darstellen.
- Erste technische Ereignisse und E-Mail-Benachrichtigung für kritische Publishing-Probleme integrieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J02 und J08 funktionieren im freigegebenen Testaccount.
- [ ] #2 veröffentlichte Posts sind nicht verschiebbar.
- [ ] #3 ein Fehler ist ohne Zugriff auf Backend-Logs verständlich.
- [ ] #4 R1 ist ein interner Meilenstein, noch nicht das vollständige Produktversprechen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /calendar. Week/month/agenda views, account/status filters, unscheduled drafts, move/cancel dialogs and keyboard alternative to dragging; successful/partial/uncertain statuses and next actions. Grenze: No real calendar jobs or critical email delivery. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
