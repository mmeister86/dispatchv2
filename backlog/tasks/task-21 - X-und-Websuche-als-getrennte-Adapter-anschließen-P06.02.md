---
id: TASK-21
title: X- und Websuche als getrennte Adapter anschließen (P06.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 20:16'
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

Implementation released after final TASK20 re-SPEC/fresh QUALITY PASSc300fa4, root final receipt2f71a9e. Read actual three-store/five-index profile/order contract and .docs/reviews/task-20-research-profile-validation.md; old generation-prerequisites-only schedules/blocked orders cannot pay native search after deployment. Native sources have separate current authorizations: Web access does not inherit X search/trend/compliance availability or mutate publishing. Existing aiBudgets/aiAttempts remain accounting authority, extended only for actual concrete order/source/pricing units, no dummy Agent/token conversion or second ledger. Unknown same-logical-source-step liability survives wrapper/cache/new IDs and counts cumulative cap, while independently authorized Web may proceed if remaining actual-currency coverage allows. Read current /tmp/dispatch-x-research-current-docs.md and Requesty receipt. Fresh implementer owns concrete TASK21 source/funding/cache/lifecycle/UI/tests/unit contract; root metadata/decisions/reviews/index windows. No source/model/provider activation or Done.

Fresh implementer native design approved: retain aiAttempts legacy generation shape plus actual native research/order/source/step/pricing-unit shape, aiBudgets native-search purpose and provider-specific keys, one shared held/spent transaction helper with real callers, current tenant/account source policy and scoped cache/tombstone lifecycle. Explicit new native admission preserves old20generation-prerequisite orders/schedules as inert. App-only X proof pins actual bearer hash; independently authorized Web is not globally gated by X connection. Native current pricing currencies extend profile caps without FX/historical relabelling. Initial source written; schema-derived typecheck caught real sibling ai/conversations usage projection needing minimal generation-owner/reference narrowing for union compatibility. Root approves that narrow sibling change and requires affected chat regressions; no new chat feature. Official codegen sandbox network stalled, stopped and command-specific escalation planned; no deployment/activation/check acceptance yet.

Backend checkpoint f50fc59: implementer reports 170 passing affected native/generation/chat/enrichment/idea/profile tests, typecheck and diff validation; source freeze, independent SPEC/QUALITY and final suite remain pending. Approved native allocation boundary: source policy requires current nonblank allocationEvidence and allocatedProviderLimitMicros matching the native-provider grant limit. Evidence must establish an unreserved native slice excluding generation and reserved publishing capacity. Native x operations share native:x; native Requesty policies share native:requesty. These configured slices do not measure combined external credit or actual publishing reserve. Missing evidence or changed allocation limit blocks new I/O; held liabilities and once-only late settlement survive withdrawal. No automatic grant, provider balance claim, policy activation or Backlog acceptance.

Final implementation source frozen at 215b94c04de4626a66d14a2652306c1d59e12902 after backend checkpoint f50fc59. Implementer verification: 426 tests/27 files including 39 native provider tests; actual Research browser (owned fixture closed, user5173 preserved), typecheck/full lint/build/bundle/diff and official codegen passed. Existing EU Dev functions ready21:46:02, no policy/grant/source/provider activation or paid search/model. Minimal final corrections retain first unknown cost/unit evidence, reject conflicts and keep invalid evidence sticky; RED/GREEN tests retained. Existing supplied X_APP_BEARER_TOKEN reused under operation/credential-hash proof. Fresh independent SPEC now reviewing full source BASE4c50535..215b94c with own actual-handler/physical-fetch/UI negatives; QUALITY follows only after SPEC PASS. No AC checked or manual/live acceptance claimed yet.

Independent initial SPEC NEEDS FIXES at215b94c: valid X data plus errors loses supplied partial sources; actual saved-profile language switch shows en but submits stale de; ai.runs.recent omits native/generation receipt-owner/reference narrowing (synthetic malformed native runId alias projects native estimate as generation usage, not claimed public mutation exploit). ROOT inspected actual callers/own fixtures and confirms. Registered39 pass; two independent actual-handler negatives and actual React language scenario RED, prior temporal/native idle expiry prefix passes. Original sources/logs retained in /tmp/dispatch-research-provider-spec-receipt.md; durable three-scope holds inspected inside physical synthetic fetch. Same implementer owns minimal corrections/regressions; same SPEC delta then fresh QUALITY only after PASS. No AC/Done/activation. Root review receipt .docs/reviews/task-21-research-provider-validation.md.

Additional ROOT actual-handler RED22:00:59: native.results projects20microUSD finance even after its native receipt workspaceId alone is changed to another actual workspace. Native settlement validates owner graph; native result projection does not. Same malformed-record boundary as SPEC3, not a public writer exploit. Runnable /tmp/task21-root-native-projection.test.ts and red receipt retained; one own test failed/two copied SPEC cases skipped. Held correction staging window for minimal native projection/settlement shared graph guard. Legitimate cache-hit attachment to prior filling order must remain valid. Initial three-fix437/27/native41/codegen/Dev22:00:40 not final fourth-fix proof. No AC or QUALITY/Done.

Correction source frozen at82e9ff75f6c79a772c4df6319b97b39db5284641: validated mixed X partial data retained with uncertain usage hold; fresh UI displayed/submitted language aligned without altering frozen retries; shared concrete generationAttempt/nativeAttempt guards cover actual financial projections, admission/history/cap/settlement consumers with captured ownership/scope/currency. Legitimate previous-order cache hit and once-only late finance after expiry/withdrawal remain valid. Implementer final448/27/native50 plus196affected/7, actual Research browser/type/lint/build/bundle/diff/officialcodegen passed; existing EU Dev ready22:08:19, no activation/paid I/O. ROOT original native projection negative rerun unchanged22:10:11 PASS one own actual-handler case/two copied SPEC cases skipped, /tmp/task21-root-native-projection-green.log. Same independent SPEC delta now checking original failures and sibling boundaries; fresh QUALITY follows only after PASS. No AC or manual/Done acceptance yet.

Four original finding families re-SPEC PASS82e9ff7:99registered/3 plus5distinctindependenthandlercases and actual isolated/full React fixtures; ROOTnativeprojection negativePASS. This historical PASS is superseded overall by additional effective-intent NEEDS FIXES before QUALITY. ROOT actual X freshness30→90 sends second EXACTidentical physical URL despite first unknown hold; independent SPEC confirms and adds Web freshness changes identicalURL/body plus WOEID query changes identicalURL. Raw/unused operation-agnostic identity inputs bypass unknown barrier. /tmp/dispatch-research-provider-spec-intent-receipt.md and ROOTredlog retained. Originalworker minimal source-specific effective canonicalization plus bounded current-scope legacy raw-identity unknown compatibility; changing algorithm/deploy/restore cannot drop old sent/unknown liability. No absolute time or new wrapper paid-retry bypass. Same SPEC intent delta then fresh QUALITY only after PASS; no AC/Done.
<!-- SECTION:NOTES:END -->
