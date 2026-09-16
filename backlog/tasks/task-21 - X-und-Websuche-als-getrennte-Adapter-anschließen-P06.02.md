---
id: TASK-21
title: X- und Websuche als getrennte Adapter anschließen (P06.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p06
  - r2
milestone: m-2
dependencies:
  - TASK-20
  - TASK-10
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P06.02.
Phase: P06 – Eigenständiger proaktiver Recherche-Agent.

**Abhängigkeit:** P06.01, P03.01. **Dateien:** `convex/integrations/x/research.ts`, `convex/research/webSearch.ts`, `convex/research/cache.ts`; Test `convex/research/providers.test.ts`.

- Verfügbare X-Suche und Trend-Endpunkte entsprechend der Capability-Matrix nutzen.
- Websuche mit Quellenrückgabe integrieren; Suchanfrage, Sprache und Zeitpunkt protokollieren.
- Ergebnismengen, Pagination, Kosten und Antwortgrößen begrenzen; identische zulässige Abfragen kurzzeitig cachen.
- Partielle Ergebnisse bei Ausfall einer Quelle erhalten; private oder personalisierte Daten nicht zwischen Workspaces cachen.
- Den in P00 geprüften Provider-Lifecycle bereits für gespeicherte X-Recherche anwenden: entfernte/gesperrte Quellen und Löschanfragen nachvollziehbar an Evidenz, Caches, Embeddings und Agent-Kontext weitergeben. Betroffene Inhalte bereinigen, Evidenz ungültig markieren und davon abhängige Vorschläge erneut prüfen; P09.03 konsolidiert diesen Pfad.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 X-Ausfall blockiert weder Webrecherche noch Publishing.
- [ ] #2 fehlende Trendberechtigung wird sichtbar und niemals als vorhandene Live-Trendfunktion ausgegeben.
- [ ] #3 Cache und Budgetgrenzen werden nachweislich eingehalten.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
