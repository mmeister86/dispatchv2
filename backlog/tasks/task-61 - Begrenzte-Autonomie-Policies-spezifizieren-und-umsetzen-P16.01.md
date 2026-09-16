---
id: TASK-61
title: Begrenzte Autonomie-Policies spezifizieren und umsetzen (P16.01)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p16
  - r9
  - optional
milestone: m-9
dependencies:
  - TASK-64
  - TASK-40
  - TASK-43
  - TASK-47
  - TASK-48
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: low
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P16.01.
Phase: P16 – Optionale kontrollierte Autonomie.

**Abhängigkeit:** bewährter Betrieb P09–P12, ausdrückliche Produktentscheidung. **Dateien:** `convex/automation/policies.ts`, `convex/automation/decisions.ts`, `src/features/settings/automation.tsx`; Test `convex/automation/policies.test.ts`.

- Autonomie standardmäßig deaktiviert lassen; Aktivierung für konkrete Accounts, Quellen, Themen, Formate, Frequenzen und Zeiträume verlangen.
- Ein separates, versioniertes Autorisierungsverfahren für Policy-basierte Veröffentlichung definieren; niemals eine menschliche Freigabe fingieren.
- Frische, Quellenbelege, private Daten, Kosten, Medienbereitschaft und definierte Ausschlusskriterien vor jedem Versand prüfen.
- Unsichere Fälle in menschliches Review zurückgeben und jede Entscheidung mit Policyversion protokollieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Umfangstor: Optionaler Portfolio-Kandidat. Erst nach dokumentierter Nachfrage-, Machbarkeits-, Kosten- und Lifecycle-Entscheidung umsetzen. Nicht ausgewählte Optionen blockieren den Pflichtumfang des Releases nicht.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D13: Separate ausdrückliche Produktentscheidung zur optionalen Autonomie erforderlich.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Keine globale Checkbox eröffnet unbeschränkte Veröffentlichung.
- [ ] #2 Policywiderruf verhindert neue Claims.
- [ ] #3 Account-, Versions- und Tenant-Prüfungen bleiben wirksam.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
