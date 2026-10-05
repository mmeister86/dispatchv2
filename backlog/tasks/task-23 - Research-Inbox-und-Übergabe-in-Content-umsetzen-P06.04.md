---
id: TASK-23
title: Research Inbox und Übergabe in Content umsetzen (P06.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p06
  - r2
milestone: m-2
dependencies:
  - TASK-22
  - TASK-18
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P06.04.
Phase: P06 – Eigenständiger proaktiver Recherche-Agent.

**Abhängigkeit:** P06.03, P05.02. **Dateien:** `src/features/research/inbox.tsx`, `src/features/research/item-detail.tsx`, `convex/research/handoff.ts`; Test `tests/e2e/proactive-research.spec.ts`.

- Themen, Quellen, Aktualität, Begründung und Unsicherheit lesbar darstellen.
- Ignorieren, archivieren, nachrecherchieren, Agent befragen und Idee erzeugen anbieten.
- Automatische Erstellung von Ideen/Entwürfen nur entsprechend aktivierter Profiloption zulassen.
- Doppelte Übergaben verhindern und die komplette Quellenkette erhalten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J04 und J05 funktionieren ohne GitHub-Anschluss.
- [ ] #2 Aus einer Forschungsquelle entsteht höchstens die ausdrücklich gewünschte Zahl von Vorschlägen.
- [ ] #3 Inhalte bleiben vor Veröffentlichung freigabepflichtig.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research, /ideas, /drafts/:id, /agent. Inbox filtering/detail, archive/ignore/update, ask-agent transition, create idea/draft and retained source chain; duplicate local handoffs reopen existing objects. Grenze: Updating a demo source changes local metadata; it performs no new research. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
