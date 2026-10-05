---
id: TASK-17
title: 'Modellzugang, Budgets und sichere Tool-Verträge implementieren (P05.01)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 16:18'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read final reviewed14/15 source/lifecycle contracts and exact official SDK matrix receipts; verify compatible joint packages. 2. Register only actually used official Agent/runtime and exercise published component test helper with scoped context and embeddings off. 3. Implement concrete durable run/attempt funding and idempotent usage ledger with unknown holds, current-authority and stop barriers before each actual paid call. 4. Add strict bounded tools/structured outputs, fixed generation purposes and independent semantic boundary, retry0 and no fallback. 5. Wire actual configuration/run availability guidance and preserve real-vs-demo states; no paid/provider activation. 6. Verify concurrency, per-attempt settlement, loop/time/token/cost limits, injection/foreign refs and late-stop receipts through actual component/model mock paths plus fullchecks/affectedbrowser. 7. Scoped commits and existingEUDev only afterPASS, selfreview/freeze then independentSPEC andQUALITY; retain manual/fullEU/provider acceptance and noDone.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /agent, /settings/billing, /operations. Supporting UI for mock run steps, cancellation, error/cost state and budget/usage previews. Grenze: No generative model adapter, token reservation, tool security, provider accounting or prompt-injection defense proof. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only future UI prep /tmp/dispatch-ai-current-ui-receipt.md supplements boundedAI/provider checklist. Agent route unconditionally presents browser-only conversations/timer answer/progress/cost; real local setters unavailable and prompt clears irrespective acknowledgment. Manual idea form also clears/closes on unavailable real setter. TASK17 core must retain truthful unavailable/config guidance until TASK18 persistent ideas and TASK19 official component chat contracts replace these real paths. Structured source/intent binds exact generated version; free-text source query is not authority. No code/provider calls from prep; use reviewed current editorial revision/immutableversion domain, no parallelcontentstore.

Nur Read-only-Vorbereitung während TASK14, keine AI-Implementierung/Aktivierung: drei aktuelle Context7-Befehle (library-first offizielles /get-convex/agent plus zwei docs, keine Quota) und veröffentlichtes offizielles @convex-dev/agent0.6.4-Paket ohne Installationsskripte nur /tmp geprüft. Tatsächliche usageHandler/rawRequestResponseHandler laufen nach Ergebnis je Step/save, liefern keine Domain-AttemptID und sind kein Pre-request-Budgetgate; Streaming-Save kann erneut versucht werden. Jeder tatsächliche bezahlte Modellaufruf benötigt zuvor eigenen persistierten finanzierten Attempt mit idempotenter Settlement-ID; fehlende Usage bleibt unknown/pending. Exakter gepinnter Hookname rawRequestResponseHandler; aktuelle Main-Beispiele haben abweichenden Alias. Tatsächlicher Streaming-Errorlogger erfordert sanitisierte Adapterfehler ohne private Bodies/Secrets. Receipt /tmp/dispatch-agent-budget-hooks-current-docs.md, Brief /tmp/dispatch-model-budget-implementation-brief.md. Joint-Matrix/Mock-Component-Durchstich folgt Implementer nach14/15; kein Modell-/Embedding-/Paid-/Dev-Call oder manueller Nachweis.

Additional read-only exact paid-call boundary receipt /tmp/dispatch-ai-sdk6-budget-middleware-current-docs.md:3currentContext7commands identify latestV4 docs, exact official ai6.0.300/provider3.0.18 archives prove V3 wrapGenerate/wrapStream awaiting preflight before actual underlying request. Native concrete middleware can fund own durableattemptID before call; Agent post-result usageHandler still insufficient. Candidate matrix metadata compatible declaredAgent0.6.4 AI6, but finaljointcompile/mockedcomponent required. Noinstall/provider/customerdata activation;17notstarted.

Pinned officialAgent0.6.4 further read-only source evidence: @convex-dev/agent/test exports register(t,name=agent) for real component schema/modules through current convex-test; future matrix must actually run these through-component tests. Generation-only embeddingModel absent prevents automatic message embeddings; searchOtherThreads defaults false and must remain explicit false unless scoped retrieval authorized. Component userId is not workspace/account authority; sharedhuman crossworkspace context needs concrete mapping checks. Receipt /tmp/dispatch-agent-budget-hooks-current-docs.md updated, no17code/paid/embedding/data call.

Implementation authorized now after final reviewedTASK15 source1706c05 SPEC49/QUALITY40PASS. Brief /tmp/dispatch-model-budget-implementation-brief.md and actual .docs/github-signal-domain-contract.md; historicalSignals readability is not model/content purpose authority. Compatible candidate officialAgent0.6.4/ai6.0.300/openai-compatible2.0.81 must jointly compile and run actual published component tests, generation-only embeddings absent/searchOtherThreads:false. Customer generation/search/semantic remain purpose/pricing/fullprocessing-gated; existingkeypresence does not activate. Each actual attempted call requires durable fresh funding/ownattemptID before SDKdoGenerate/doStream; post-result hooks alone insufficient, no paidSDKretry/fallback. No17code beforethisstart or realpaid/manualproof.

TASK17 implementation progress: exact official Agent0.6.4/AI6.0.300/openai-compatible2.0.81 installed; official component codegen and published @convex-dev/agent/test helper execute real modules. Five targeted through-Agent checks PASS: underlying doGenerate observes committed own attempt and budget holds before call; one stable official prompt/output; transport failure makes one physical call with unknown holds/no blind retry; sensitive errors are sanitized; human stop allows truthful late token-estimate settlement while blocking output; bounded tool loop/foreign or forbidden arguments are checked. Joint Convex TypeScript compile PASS. Streaming/deadline/settlement, UI and final broad checks remain in progress; no paid/provider/customer transfer or independent acceptance is claimed. pnpm core-js build script explicitly denied, not executed. Fresh SPEC then QUALITY follow frozen implementation.

Implementer freeze 2026-10-05: source 928b26c9af0d6e09be7cf70f0202347bee6d1e2e on master; source commit window closed and index empty. Official Agent 0.6.4 / AI 6.0.300 / openai-compatible 2.0.81 uses durable funding before underlying model attempts, three quota scopes, idempotent settlement and retained unknown financial liabilities. Current four-store/component inventory and explicit processing/pricing/manual gates are documented in .docs/model-run-contract.md. Implementer reports 279 unit tests in 22 files, typecheck, lint, build, bundle and actual affected browser PASS; existing EU-West-1 Dev and Agent ready 18:10:52. No policy/grants, paid provider calls or activation values were created. Independent SPEC review has started against the concrete frozen source; QUALITY and code acceptance remain pending. TASK remains In Progress, no manual/provider acceptance or Done.

Independent SPEC isolated a concrete P2 current-grant defect at convex/ai/runs.ts136-156: after a workspace/account grant loses approvedBy, create would reject it but active skips the absent approver and a pre-existing run can reach the actual model mock. Two through-Agent negatives are RED; four other own negatives pass. Reproducer /tmp/dispatch-model-budget-spec-negative.test.ts. This is a server-side grant-change boundary, not a public policy activation. Minimal shared guard correction and permanent regression are required before SPEC re-review and QUALITY; no acceptance criteria checked.

Final independent SPEC verdict NEEDS WORK, frozen928b26c: 27 registered tests pass; nine own negatives yield five passes and four failures covering two P2 findings. In addition to removed non-provider approver, provider.ts205-210 passes per-part metadata unchanged, and actual pinned openai-compatible tool-call thought-signature metadata persists in official Agent assistant/tool providerOptions. Actual intercepted provider.execute reproduces it, no live call. Real affected browser PASS, fixture closed. Receipt /tmp/dispatch-model-budget-spec-receipt.md. Root assigns minimal shared grant guard and per-part metadata minimization, permanent through-Agent regressions, then independent SPEC re-review before QUALITY. No code acceptance yet.
<!-- SECTION:NOTES:END -->
