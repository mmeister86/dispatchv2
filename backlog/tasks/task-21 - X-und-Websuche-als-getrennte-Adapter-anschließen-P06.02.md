---
id: TASK-21
title: X- und Websuche als getrennte Adapter anschließen (P06.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 19:06'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read final reviewed TASK20 profile/order contract, TASK17 finance ownership, TASK10 credential guards and current X/Requesty primary documentation; derive concrete stable order/step identity and actual operation pricing rather than generation-token fiction.
2. Implement independent bounded native X recent-search/trend and Requesty source-stream adapters with current tenant/actor/account/purpose/capability/processing/pricing evidence, no retries or unverified fallback; extend existing aiBudgets/aiAttempts accounting for concrete paid search operations and cumulative actual-currency order limits.
3. Add minimum current-authorized scoped cache/fill ownership and actual source lifecycle/invalidation barriers, preserving partial/empty/failed/unknown distinctions; old prepared schedules and historical blocked orders never become paid work without explicit native reactivation.
4. Connect actual Research availability, capabilities and source results to the existing real UI, preserving dirty inputs/receipts and truthful unknown usage/trends. Research evidence/clustering and Inbox handoff remain TASK22/23.
5. Verify actual funded state inside intercepted physical I/O, no duplicate cache fills or erased unknown liabilities, cumulative cap/three-scope races, late settlement, source-removal and authority changes, SSE corruption/EOF/limits, independent source failures and current real UI; run affected regressions/type/lint/build/bundle/official codegen and existing EU Dev sync only after green checks.
6. Scoped commits and source freeze, fresh SPEC then fresh QUALITY and corrections/re-review. Record isolated code acceptance only after proof; no provider/policy/budget activation, live invoice/rights claim or Backlog Done without manual user confirmation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research, /operations. Supporting empty/partial/source-failure/budget-result scenarios and transparent source/capability information. Grenze: No X/Web search adapters, live trends, provider cache or source-removal synchronization. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only future provider preparation: /tmp/dispatch-research-provider-implementation-brief.md plus /tmp/dispatch-requesty-search-current-docs.md (three current Context7 commands, official docs, no provider call). Native SSE retains supplied URL/title metadata and actual usage; sources do not establish exact claim attribution/temporal trend, and provider-drop error/EOF cannot become completed evidence. ChatCompletions has no proved internal search max_uses bound; EU routing snippet does not prove complete processing chain. Future21 must reuse reviewed17/20, independent X/Web failures, scoped authorized cache and source-removal barriers; no21 implementation/AC or paid/customer-data activation.

Read-only preparation /tmp/dispatch-research-funding-code-map.md traces every actual generation finance caller and X read credential loader after frozen TASK19 source f6cb20e. Existing aiBudgets/aiAttempts transaction ownership remains central, but current runId/thread/model/token/literal-provider validators cannot represent native X/search unchanged. Future concrete order/step/pricing-unit extension must fund before physical I/O, preserve same-logical-step unknown liabilities and late settlement, and enforce cumulative actual-currency order limits from reviewed TASK20. Never create dummy Agent/model calls, fictitious X tokens or a parallel financial ledger. Native Requesty search requires separately evidenced finite cover for internal search charges; generation token estimates alone do not establish it. No provider/source activation, TASK21 code or acceptance evidence from this preparation.

Current X documentation preparation completed: /tmp/dispatch-x-research-current-docs.md, Context7 library-first /websites/x_x-api plus two docs commands outside sandbox; supplemental official docs because retrieval omitted exact spec/pricing. Current generated recent-search spec post.fields/repost_count/referenced_posts and query max4096 differs from guide tweetFields/512; conservative query ceiling and explicit operation/account compatibility proof required, no guessed fields or absent-to-zero metrics. Trends authorization docs also differ; actual access mode evidence remains mandatory. Current reference pricing is resource/request based and daily dedupe expressly soft, not actual configured price or permission. Batch compliance async upload/download URLs and delete/rehydrate/scrub events documented; no live calls, job, token read, settings, pricing, budget or provider activation. Final20 independent review still prerequisite.
<!-- SECTION:NOTES:END -->
