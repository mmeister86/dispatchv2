---
id: TASK-49
title: Einladungen und belastbare Rollenmatrix umsetzen (P13.01)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p13
  - r6
milestone: m-6
dependencies:
  - TASK-64
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P13.01.
Phase: P13 – Teams, Rollen und Kundenkontexte.

**Abhängigkeit:** P09, stabile Tenant-Domain. **Dateien:** `convex/team/invitations.ts`, `convex/team/memberships.ts`, `src/features/team/members.tsx`; Test `convex/team/permissions.test.ts`.

- Ablaufende Einladungen, Widerruf, Annahme und Rollenwechsel implementieren.
- Owner, Admin, Editor und Viewer mit expliziten Rechten für Accounts, Billing, Freigaben, Publishing und Datenlöschung definieren.
- Letzten Owner schützen und kontrollierten Eigentümerwechsel anbieten.
- Rollenänderungen auf laufende Sessions, Agent-Aufträge und ausstehende Freigaben anwenden.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Editor kann keinen Tarif ändern oder fremde Accounts freigeben.
- [ ] #2 Viewer bleibt lesend.
- [ ] #3 ein ausgeschiedenes Mitglied erhält keinen Zugriff über alte Links oder laufende Agent-Threads.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
