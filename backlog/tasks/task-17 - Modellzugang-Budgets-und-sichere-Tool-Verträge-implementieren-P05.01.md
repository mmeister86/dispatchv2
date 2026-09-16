---
id: TASK-17
title: 'Modellzugang, Budgets und sichere Tool-Verträge implementieren (P05.01)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p05
  - r2
milestone: m-2
dependencies:
  - TASK-1
  - TASK-5
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P05.01.
Phase: P05 – Agent-Grundlage, Content Agent und Chat.

**Abhängigkeit:** P00.01, P01.02. **Dateien:** `convex/ai/provider.ts`, `convex/ai/runContext.ts`, `convex/ai/toolSchemas.ts`, `convex/billing/usageReservations.ts`; Tests `convex/ai/provider.test.ts`, `convex/ai/tools.test.ts`.

- Modellzwecke für Zusammenfassung, Recherche, Entwurf, Planung, Bewertung und Embeddings zentral konfigurieren.
- Strukturierte Outputs validieren; unbekannte Felder, ungültige IDs und unvollständige Antworten zurückweisen.
- Pro Lauf Tool-Schritte, Zeit, Tokens und Kosten begrenzen; Abbruch und Budgetreservierung umsetzen.
- Modell-/Netzwerkaufrufe in begrenzte Actions legen; Workflow-Schritte führen überwiegend IDs und kleine Ergebnisse statt Medienbytes, vollständiger Webseiten oder wiederholter Chatverläufe. SDK- und Workflow-Wiederholungen sowie Agent-Promptreferenzen nach Abschnitt 4.4 koordinieren.
- Externe Texte als Daten behandeln; URL-Zugriffe auf zulässige Protokolle beschränken und private Netzwerkziele blockieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prompt Injection aus Repository oder Webseite kann keine Secrets auslesen oder fremde Entitäten verändern.
- [ ] #2 Ein Endlos-Tool-Loop stoppt am Budget.
- [ ] #3 Verbindungsfehler führen nicht zu unkontrollierten Modellwechseln oder Mehrfachkosten.
- [ ] #4 Jeder tatsächliche Provider-Versuch wird höchstens einmal verbucht.
- [ ] #5 zusätzliche Versuche benötigen neue Budgetdeckung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
