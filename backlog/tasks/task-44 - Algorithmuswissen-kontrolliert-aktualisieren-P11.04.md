---
id: TASK-44
title: Algorithmuswissen kontrolliert aktualisieren (P11.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p11
  - r5
milestone: m-5
dependencies:
  - TASK-27
  - TASK-28
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P11.04.
Phase: P11 – Performance Feedback und Account Intelligence.

**Abhängigkeit:** P08.01–P08.02 für Quellen-/Profilpflege; P11.03 zusätzlich nur bei Änderungen bereits kalibrierter Modelle. **Dateien:** `convex/intelligence/profileUpdates.ts`, interne Review-Oberfläche, `.docs/runbooks/algorithm-updates.md`.

- Änderungen öffentlich verwendeter Quellen erkennen und als internen Review-Vorschlag erfassen.
- Quelländerung, Interpretation und mögliche Auswirkung auf Dispatch-Regeln nebeneinanderstellen.
- Referenzfälle erneut evaluieren und Profil aktivieren oder verwerfen.
- Alte Profil- und Modellstände für historische Nachvollziehbarkeit erhalten, bis deren Retention endet.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Bedingte Abhängigkeit: P11.03 wird nur für Änderungen bereits kalibrierter Modelle benötigt. Reine Quellen-/Profilpflege darf vorher beginnen.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein fremder Repository-Commit verändert keine produktive Bewertung ohne interne Prüfung.
- [ ] #2 Eine fehlerhafte Aktivierung kann rückgängig gemacht werden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /operations — Algorithmusprofile. Mock before/after source statement, interpretation, affected rule, review/evaluation, activate/discard/rollback and version log. Grenze: No actual source monitoring, verified algorithm knowledge or production assessment changes. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
