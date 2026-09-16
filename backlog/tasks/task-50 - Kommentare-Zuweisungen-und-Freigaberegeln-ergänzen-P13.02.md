---
id: TASK-50
title: 'Kommentare, Zuweisungen und Freigaberegeln ergänzen (P13.02)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p13
  - r6
milestone: m-6
dependencies:
  - TASK-49
  - TASK-8
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P13.02.
Phase: P13 – Teams, Rollen und Kundenkontexte.

**Abhängigkeit:** P13.01, P02.02. **Dateien:** `convex/team/comments.ts`, `convex/team/approvalPolicies.ts`, `src/features/team/review-panel.tsx`; Test `tests/e2e/team-review.spec.ts`.

- Kommentare und Aufgaben an konkrete Entwürfe beziehungsweise Versionen binden.
- Zuständige Personen, Review-Warteschlange und Benachrichtigungen integrieren.
- Mehrstufige Freigaben mit klarer Rollen-/Account-Policy ergänzen, ohne den Einzelanwenderflow unnötig zu erschweren.
- Änderungen nach Review sichtbar zurück in den erforderlichen Freigabeschritt schicken.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J10 funktioniert.
- [ ] #2 Kommentarauflösung ist keine Inhaltsfreigabe.
- [ ] #3 Änderungen machen alte Reviews nicht stillschweigend gültig.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
