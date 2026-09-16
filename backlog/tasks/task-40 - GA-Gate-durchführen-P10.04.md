---
id: TASK-40
title: GA-Gate durchführen (P10.04)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p10
  - r4
  - gate
milestone: m-4
dependencies:
  - TASK-64
  - TASK-39
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P10.04.
Phase: P10 – Kommerzielles SaaS und öffentliche Veröffentlichung.

**Abhängigkeit:** P08–P10.03. **Dateien:** `.docs/decisions/ga-review.md`, `tests/e2e/billing.spec.ts`, `tests/e2e/release-smoke.spec.ts`.

- Vollständige Abnahme nach Abschnitt 12 mit repräsentativen Accounts, Medien und Ausfällen durchführen.
- Pilotkosten, Nutzungsbindung, Quellenqualität und Publishing-Verlässlichkeit gegen die vorab vereinbarten Ziele prüfen.
- Offene kritische Fehler schließen; bewusste Produktgrenzen in Hilfe und Capability-Anzeige darstellen.
- Öffentliche Veröffentlichung und deren Zugangs-/Kostenfolgen als gesonderte Freigabe mit konkretem Release-Bericht vorbereiten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D15: Verbindliche Betriebsziele, RPO/RTO und Retention vor GA bestätigen und durch Restore nachweisen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Der Betreiber bestätigt den GA-Release nach eigener Prüfung.
- [ ] #2 Ein grüner Build allein begründet keine Marktreife.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
