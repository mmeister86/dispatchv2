---
id: TASK-64
title: Private Beta anhand der Nutzerabläufe und Betriebsübungen abnehmen
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p09
  - r3
  - gate
milestone: m-3
dependencies:
  - TASK-27
  - TASK-28
  - TASK-29
  - TASK-30
  - TASK-31
  - TASK-32
  - TASK-33
  - TASK-34
  - TASK-35
  - TASK-36
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Zusätzliches explizites Beta-Gate aus §12.6. Ergebnisse und verbleibende Grenzen in .docs/decisions/beta-review.md dokumentieren. Die Aufgaben P08/P09 liefern die Implementierung; dieses Ticket führt deren gemeinsame Produktabnahme zusammen.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md. Geplante Arbeit; Abnahme/Done erst nach ausdrücklicher Nutzerbestätigung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J01–J08 und J12 sind in Staging einschließlich Fehler- und Berechtigungsfällen nachgewiesen.
- [ ] #2 J07 verändert nur nach Übernahme eine Version; fehlende Intelligence blockiert manuelles Publishing nicht.
- [ ] #3 Datenkontrollen, erste zulässige Messdaten und zugängliche Kernoberflächen sind geprüft.
- [ ] #4 Provider-Ausfall, Workflow-Recovery und Restore wurden ohne Doppelveröffentlichung geübt.
- [ ] #5 Ein neuer Nutzer kann das Onboarding ohne ständige Entwicklerhilfe abschließen.
- [ ] #6 Beta-Bericht enthält Testergebnisse, offene Grenzen und ausdrückliche Nutzerfreigabe.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
