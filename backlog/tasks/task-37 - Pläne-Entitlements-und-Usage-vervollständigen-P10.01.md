---
id: TASK-37
title: 'Pläne, Entitlements und Usage vervollständigen (P10.01)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p10
  - r4
milestone: m-4
dependencies:
  - TASK-64
  - TASK-17
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P10.01.
Phase: P10 – Kommerzielles SaaS und öffentliche Veröffentlichung.

**Abhängigkeit:** P09, frühe Budget-Domain aus P05.01. **Dateien:** `convex/billing/entitlements.ts`, `convex/billing/usageLedger.ts`, `convex/billing/plans.ts`; Test `convex/billing/entitlements.test.ts`.

- Produkte nach Fähigkeiten und Limits modellieren: Accounts, Repositories, Research, AI, geplante Posts, Teamplätze und Speicher.
- Rechte serverseitig prüfen; UI nutzt dieselben erklärbaren Grenzen, ist aber nicht die Durchsetzungsinstanz.
- Reservierung und tatsächlichen Verbrauch bei Parallelität, Abbruch und Wiederholung konsistent führen.
- Downgrade, Testphase, überzogene Limits und Zahlungsprobleme als konkrete Zustandsregeln definieren.

**Vorgeschlagene Produktregel:** Neue kostenpflichtige Research-/AI-Läufe stoppen bei fehlender Berechtigung. Bereits freigegebene Termine werden während einer klar kommunizierten Kulanzfrist weiter bedient; danach pausieren sie sichtbar. Umfang und Dauer werden vor GA entschieden, nicht im Code versteckt.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D10: Preise, Quoten und Kulanz auf Basis realer Unit Economics entscheiden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gleichzeitige Agent-Läufe überschreiten das vereinbarte Budget nicht unbemerkt.
- [ ] #2 derselbe Verbrauchsbeleg wird nicht doppelt gebucht, tatsächlich neue Provider-Versuche bleiben als Kosten sichtbar.
- [ ] #3 Eine mögliche Kulanz gegenüber Kunden ist eine gesonderte Billing-Regel.
- [ ] #4 ein Downgrade löscht keine Nutzerinhalte.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/billing. Mock plan and quota usage, trial/active/limit/payment/grace/expired status previews; preserved contents on local downgrade. Grenze: No server-side entitlement enforcement, actual usage ledger or real billing grace policy. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
