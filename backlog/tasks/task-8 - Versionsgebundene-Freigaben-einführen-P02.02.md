---
id: TASK-8
title: Versionsgebundene Freigaben einführen (P02.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p02
  - r1
milestone: m-1
dependencies:
  - TASK-7
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P02.02.
Phase: P02 – Entwürfe, Versionen, Freigaben und Medien.

**Abhängigkeit:** P02.01. **Dateien:** `convex/content/approvals.ts`, `src/features/drafts/approval-panel.tsx`; Test `convex/content/approvals.test.ts`.

- Freigabe und Widerruf als eigene auditable Domain-Aktionen implementieren.
- Account und Version bei jeder Freigabe explizit binden.
- Arbeitsversion und bereits freigegebene/geplante Version im Composer unterscheiden.
- Agent-Werkzeuge von menschlichen Freigabeoperationen trennen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D07: Geplante Version bleibt erhalten; Austausch erst nach neuer Freigabe entscheiden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine freigegebene Version V1 erlaubt nicht das Senden von V2.
- [ ] #2 Accountwechsel und Medienänderung erfordern neue Freigabe.
- [ ] #3 Widerruf vor Publishing-Claim verhindert die Ausführung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
