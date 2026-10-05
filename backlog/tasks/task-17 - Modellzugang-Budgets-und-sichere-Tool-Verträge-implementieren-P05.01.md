---
id: TASK-17
title: 'Modellzugang, Budgets und sichere Tool-Verträge implementieren (P05.01)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 11:33'
labels:
  - p05
  - r2
  - jev
milestone: m-2
dependencies:
  - TASK-1
  - TASK-5
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P05.01.
Phase: P05 – Agent-Grundlage, Content Agent und Chat.

**Abhängigkeit:** P00.01, P01.02. **Dateien:** `convex/ai/provider.ts`, `convex/ai/runContext.ts`, `convex/ai/toolSchemas.ts`, `convex/billing/usageReservations.ts`; Tests `convex/ai/provider.test.ts`, `convex/ai/tools.test.ts`.

- Modellzwecke für generative Zusammenfassung, Recherche, Entwurf, Planung und Embeddings zentral konfigurieren; semantische Entscheidungen über eine gesonderte Providergrenze anbinden.
- Strukturierte Outputs validieren; unbekannte Felder, ungültige IDs und unvollständige Antworten zurückweisen.
- Pro Lauf Tool-Schritte, Zeit, Tokens und Kosten begrenzen; Abbruch und Budgetreservierung umsetzen.
- Modell-/Netzwerkaufrufe in begrenzte Actions legen; Workflow-Schritte führen überwiegend IDs und kleine Ergebnisse statt Medienbytes, vollständiger Webseiten oder wiederholter Chatverläufe. SDK- und Workflow-Wiederholungen sowie Agent-Promptreferenzen nach Abschnitt 4.4 koordinieren.
- Externe Texte als Daten behandeln; URL-Zugriffe auf zulässige Protokolle beschränken und private Netzwerkziele blockieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

### JEV-Abgleich vom 18.09.2026

Die Providerzwecke unterscheiden generative Arbeit und semantische Entscheidungen. R2 liefert gemeinsame Verträge/Budget-/Usage-Grenzen und erweitert den vorhandenen Convex-Workflow; der konkrete TypeSafe-Adapter wird erst in TASK-28.1 implementiert. Seit D04 vom 19.09.2026 gehört auch TASK-28.1 zu R2: Der Adapter folgt auf diese gemeinsamen Grenzen und wird vor der MVP-Abnahme integriert.

SDK-spezifischer Jev-Code bleibt ausschließlich unter convex/ai/jev. Domain-Code konsumiert validierte interne Ergebnisse. choice/score-Confidence und noul-Wahrscheinlichkeit getrennt modellieren; keine erfundene Confidence oder automatische Region-Fallbacks. Spätere Jev-Aufrufe nutzen dieselben kontrollierten Action-/Workflow-, Budget- und Telemetriegrenzen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prompt Injection aus Repository oder Webseite kann keine Secrets auslesen oder fremde Entitäten verändern.
- [ ] #2 Ein Endlos-Tool-Loop stoppt am Budget.
- [ ] #3 Verbindungsfehler führen nicht zu unkontrollierten Modellwechseln oder Mehrfachkosten.
- [ ] #4 Jeder tatsächliche Provider-Versuch wird höchstens einmal verbucht.
- [ ] #5 zusätzliche Versuche benötigen neue Budgetdeckung.
- [ ] #6 Providerverträge trennen Generation und semantische Entscheidungen; R2 funktioniert ohne aktivierten Jev-Provider und ohne Abhängigkeit von P08.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /agent, /settings/billing, /operations. Supporting UI for mock run steps, cancellation, error/cost state and budget/usage previews. Grenze: No generative model adapter, token reservation, tool security, provider accounting or prompt-injection defense proof. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only future UI prep /tmp/dispatch-ai-current-ui-receipt.md supplements boundedAI/provider checklist. Agent route unconditionally presents browser-only conversations/timer answer/progress/cost; real local setters unavailable and prompt clears irrespective acknowledgment. Manual idea form also clears/closes on unavailable real setter. TASK17 core must retain truthful unavailable/config guidance until TASK18 persistent ideas and TASK19 official component chat contracts replace these real paths. Structured source/intent binds exact generated version; free-text source query is not authority. No code/provider calls from prep; use reviewed current editorial revision/immutableversion domain, no parallelcontentstore.
<!-- SECTION:NOTES:END -->
