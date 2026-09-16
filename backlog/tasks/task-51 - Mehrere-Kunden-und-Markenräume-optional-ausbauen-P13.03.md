---
id: TASK-51
title: Mehrere Kunden- und Markenräume optional ausbauen (P13.03)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p13
  - r6
  - optional
milestone: m-6
dependencies:
  - TASK-50
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P13.03.
Phase: P13 – Teams, Rollen und Kundenkontexte.

**Abhängigkeit:** P13.02 und bestätigte Nachfrage. **Dateien:** `convex/team/clientContexts.ts`, `src/features/team/workspace-switcher.tsx`, zusätzliche Entitlement-Regeln.

- Mehrere klar getrennte Workspaces mit eigenen Accounts, Stimmen, Research-Profilen und Abrechnungseinheiten unterstützen.
- Externe Kundenfreigabe nur über ausdrücklich freigegebene Objekte und zeitlich begrenzte Zugänge anbieten.
- Quoten und Supportzugriffe je Kunde nachvollziehbar machen.
- Mandantenübergreifende Inhaltsvorschläge und versehentliche Accountverwechslung verhindern.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Der Wechsel zwischen zwei Marken übernimmt weder Stil noch private Quellen oder Kalenderinhalte der anderen Marke.
- [ ] #2 Dieses Paket ist eine Portfolio-Option, keine Voraussetzung für Team-Basisfunktionen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
