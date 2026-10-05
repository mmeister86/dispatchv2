---
id: TASK-22.2
title: 'Begrenzten Research-Workflow und Themencluster bauen (P06.03, Teil 2)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 22:16'
labels:
  - p06
  - r2
  - teilpaket
milestone: m-2
dependencies:
  - TASK-22.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-22
priority: high
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P06.03. Verantwortung: convex/ai/researchAgent.ts, researchTools.ts, convex/research/clusters.ts; zehn Pipeline-Schritte aus §6.3.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P06.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Der wiederaufnehmbare Ablauf führt alle zehn Schritte mit Tenant-Kontext, Budget, Timeout und Abbruchprüfung aus.
- [ ] #2 Themenduplikate, Quellenkopien, alte Meldungen und bereits veröffentlichte Themen werden erkannt.
- [ ] #3 Leeres Ergebnis, partielle Quellenausfälle und Budgetende erscheinen als unterschiedliche Zustände.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace accepted20/21/22.1 immutable orders, current source graph, existing17 funded generation and19 stable Agent IDs, actual published history and original ten-step contract. Keep all old callbacks/blocked orders inert.
2. Add explicit current workflow admission/activation and minimum durable ten-step orchestration with bounded IDs/checkpoints, one combined search-generation order cap, same existing ledger and stable attempts; no new provider/funding/message framework.
3. Reuse separate native search operations and funded official Agent for bounded semantic clustering/output; validate every supplied source/material/history/cluster ID and quote, preserve publication/event/observation, distinguish copy/old/history uncertainty, keep human validity distinct.
4. Persist actual bounded clusters/results with CAS/idempotence and current-authority/retention cleanup at all effects; expose real pipeline result/history/start/stop/resume/configuration UI. Inbox interaction/optional content bridge remains23 unless actually delivered here; no fake handoff or automatic publication.
5. Reuse current occurrence engine only behind new explicit workflow schedule activation; resume paid steps without blind retry, keep unknown liabilities, stop new effects and reconcile actual late usage once. Distinct empty/partial/budget/cancel/failure outcomes.
6. Exercise real ten-step/component interrupt/resume and current scope/source/role/cost/timeout/stop boundaries, duplicate cluster commits, malicious/old/copied/published-topic cases and unknown accounting; appropriate full checks and actual UI, official codegen and existing EU Dev after green. Scoped commits/freeze then fresh SPEC followed by QUALITY; code AC only after independent proof, never Done without manual confirmation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research — history. Mock run start/cancel, completed/partial/budget/failed/empty outcomes, profile snapshot and optional local draft handoff. Grenze: No ten-step agent workflow, semantic deduplication or remote budget reservation. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Implementation released byROOT after final22.1source3e079cefSPEC/QUALITYPASS; source-only milestone496full/no modelorprovideractivation. Read-only actualmap /tmp/dispatch-research-pipeline-actual-code-map.md identifies realincompatibilities: old20generation-prerequisites-only inertcallbacks; native.finish releasesactiveOrder early; generationAttempt rejectsresearchOrderId/logicalIntent, so linkorder→agentRun outsideattempts unlessownercontract explicitlyreviewed; generationcurrentaccountgate notremoved forWeb.22.1 evidencecreate/review are HUMAN, purpose research-context only; modeloutput cannotimpersonate humanattestation. SuppliedID/material/actualquote validation and newcopy/promptretention hooks mandatory. Prefer1boundedquery initially/one fundedsemanticcall for6–8, not10modelcalls or duplicatequeues. Workflowcomponent onlyif actualruntime needed/currentdocs+pinnedcompatibility/actualnestedcomponenttests; paidretryfalse/domainlate guards. Persist actual result query/UI now, no claim23accept/archive/promote/autoHandoff currentlyfalse withoutactualbridge. No oldschedule automaticupgrade, paidcalls/activation or manualDone.

Implementerresearch_pipeline active BASEd062346. Concreteownership approved actualpipeline/Agent/tools/clusters/currentnative-generation-source helpers/officialbindings/UI/tests/contract plus schedules/access/profiles ifnewexplicitworkflowactivation needsreuseoccurrenceengine. OfficialWorkflow0.4.8 installedpinned inWIP, currentContext7library→docs outside sandbox; runtimecompile/review/Devnotyetclaimed. Chosen1snapshotquery/separateops/1semanticfundedcall/retryfalse/order→stableAgentbinding outsideattemptowner; actualnativecache.begin initialreserves+sameorder native-generationcap/currentpreIOcoverage. Minimaltechnicalclusters store evidenceIDs(no rawsource), justified indexedresearchSourceBindings captures ALLsecondarysources+promptdeps; actualcopyreadfences/totalboundedcleanup/nativecomponentisDone inventoryrequired. NativeAgentbody insidefundedaction protecteddomainpayload; Workflowjournal onlyIDs/hash/count/status notrawmodel/source/history. InitialmissingresearchTools module RED issetup/harness, notgenuinebusinessregression. Old20callbacks/blockedordersinert; autoHandofffalseuntilactual23bridge, no modelhumanattestation/publishingactivation. WIPonly no ACCEPT/Done. Futureoperations acceptedbaselineinventory /tmp/dispatch-research-current-operations-inventory.md excludesWIP andrecords currentnonchatpurge/missedexpire-restore gaps for33/36.

2026-10-06 local implementer milestone: 515 tests across28 files, TypeScript and actual synthetic Research browser PASS; not final source/review/Dev acceptance. Remaining pre-freeze corrections: flatten prior cluster evidence source dependencies into bounded current bindings/read-pre-post-I/O fences/cleanup (total10-source ceiling with explicit incomplete coverage), and prevent arbitrary model dynamics prose from becoming a displayed growth assertion when no time series was delivered. Existing Workflow+Agent registered runtime full-path checks use intercepted physical HTTP, not live provider calls. No staging window yet; source remains WIP, no AC checked or Done.
<!-- SECTION:NOTES:END -->
