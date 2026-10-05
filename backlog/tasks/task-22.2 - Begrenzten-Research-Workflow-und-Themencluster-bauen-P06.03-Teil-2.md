---
id: TASK-22.2
title: 'Begrenzten Research-Workflow und Themencluster bauen (P06.03, Teil 2)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 23:19'
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

Source milestone2670f50c5a5ad5138d83cce346bb89bbe2be0819 committed onmaster in an exact34-path window; index/workingtree clean aftercommit. Finalprecommit519 tests/28files PASS local2026-10-06 00:27:11 (/tmp/task22.2-final-cluster-tests.log). Includes actual registered Workflow+Agent full/empty/cleanup/crashpending, sourcecluster/history withdrawal, controlled no-time-series dynamics, Xfailure/Websuccess and multi-item existingcluster CAS/concurrentstage replay. Resume is status-aware and preserves durableIDs. Finalpostcommit checks/codegen/existingEUDev and frozen freshSPEC→QUALITY stillpending; no AC checked/manualDone/provideractivation. ROOT receipt .docs/reviews/task-22.2-research-pipeline-validation.md preserves intermediate/RED/harness distinctions.

FINAL sourcefreeze2670f50 confirmed afterpostcommit type/lint/newfixtureformat/build/bundle/actualResearchbrowser/officialcodegen/postgentype PASS (/tmp/task22.2-frozen-*.log), nogenerateddiff. ExistingEUDev --once EXIT0 functionsready localOct6 00:29:23 /UTC22:29:23 (/tmp/task22.2-frozen-eu-dev-once.log); officialWorkflow/Workpool/batchWorker mounted withoutprovider/grantactivation.519/28testreceipt remainscommittedsource00:27:11. Own5174closed/user5173PID48521preserved. FreshindependentSPEC research_pipeline_spec (astra/medium) nowactive fullbaseline d062346..2670f50; QUALITYonlyafterSPEC PASS. No AC/Done/manual/livequalityclaim.

FreshSPEC2670f50 ReadyNo:3Important/0Critical/0Minor. Exactreceipt /tmp/dispatch-research-pipeline-spec-receipt.md; unchangedindependent7 at00:34:41=3RED4PASS /tmp/dispatch-spec-boundaries-final-red.log, existingpipeline23/23GREEN. Confirmed: displayedsource-retentionproof outlivesgeneration-grant expiry by60400ms despitefreshserverhiding;20actualdeliveredX+Web sourcesselect10silently/outcomecompleted/nocoveragegap; first-order same-topic independentitems cannotshare anewsemanticcluster. ROOTacceptedfindings/handofftooriginalresearch_pipeline forminimalrootcausecorrections: sharedcurrentdisplayhorizons/allaffectedprojections, boundedactualselectioncoverage, explicitlocalwithin-outputtopicgrouping preservingindependentevidence/CAS/replay. InitialRED/scriptSHA retained; sameSPECdelta thenfreshQUALITY; noAC/Done/paidactivation.

Originalimplementer exact10-path correction41709200b7c0bd39d598e6d4800b3f0adcc6e2d8 frozen. Sharedcurrentdisplayproof acrossprimary/secondary grant-source-evidence horizons/Inbox+manualmodel projection; physicalretentionunchanged. Roundrobin10refs plusactualperopcoverage/prompt/gaps/partial. OpaquelocaltopicKey+exactdeclared-title compatibility group independentrows; topicCount UNIQUEgroups aftercopyfilter,20item/10sourceceilings/CAS/replay preserved. Related1topic2evidence productRED fixed. Full527/28 at00:48:06 andunchanged7 at00:48:19 PASS; type/lint/build/bundle/browser/helperformat/codegen/postgentype PASS. Browserinitialfailure fixtureViewer-committiming only, existingassertions/productionguardsretained. EUDevready00:55:02local /tmp/task22.2-correction-eu-dev-once.log clean source/index. SameSPECdelta nowactive: reviewerOWNunchanged7PASS00:55:43, extraaffectedchecks pending; freshQUALITYonlyafterfinalSPEC PASS. NoAC/Done/paidactivation; allRED/log/SHAhistory retained inROOTreceipt.

SameSPECdelta4170920 ReadyNo: ORIGINAL3findings CLOSED; unchanged7PASS/extended10PASS/pipeline31PASS/actualbrowserPASS. NewONEImportant finish-dispositionregression:20actualdelivered→10selected/10omitted, bothnative+validAgentitems[] completed/all3physicalcalls successful, yetfailed/RESEARCH_FAILED dueincomplete folded intofailed. Exact /tmp/dispatch-research-pipeline-spec-delta-receipt.md andunchangednew11=10PASS1RED /tmp/dispatch-spec-delta-empty-coverage.log00:58:07. ROOT narrowhandoffsameimplementer onlyresearchTools/pipeline regression/owncontract ifneeded: partialsuccessfulboundedempty; preserveactualfailure/config/budget/cancelprecedence/noextraIO. Original7/new11/hash/REDhistory retained; sameSPECrecheck→freshQUALITY. NoAC/Done/provideractivation.

Narrowexacttwo-path correctionf92d2eed2cb12163bd8519911c56eb3a221febb9 frozen: separatesselectionincomplete fromtechnicalfailure, validempty+omissions partial, actualfailure/config/budget/preexistingoutcomeprecedence retained. PermanentactualWorkflowregression firstRED1/31 at01:00:43 then32GREEN; reviewernew11 firstRED1/10 at01:00:18 thenunchanged7+11GREEN01:01:08; full528/28GREEN01:01:09. Fourreviewerscript/configSHA unchanged. Type/lint/build/bundle/codegen/postgentype/DevEXIT0 ready01:02:33local /tmp/task22.2-empty-correction-*.log, source/indexclean; user5173preserved/5174absent. FreshsameReviewerbrowserPASS4170920 reusedexplicitly sinceonlybackenddisposition changed. SameSPECfinalrecheckactivef92d2ee fullBASEd062346, freshQUALITYawaitsPASS; noAC/Done/paidactivation. ROOTreceipt preservesallinitial/correctionRED andprooflimits.

FINALindependentSPEC f92d2ee PASS/ReadyYes noCritical/Important/Minor remaining /tmp/dispatch-research-pipeline-spec-final-receipt.md. Reviewerfreshunchanged7PASS01:03:06/unchanged11PASS01:03:07/fourneighboringdispositioncontrolsPASS01:03:32/focused32PASS01:03:34; all4originalscript/config hashes unchanged. Original/correctionRED+limits preserved, actualnontruncatedempty/nativeunknownoutage/config0IO/semantic503/budgetprecedence verified. ROOTfreshWHOLEdeltaQUALITY research_pipeline_quality (AppSec/astra/medium) nowactive d062346..f92d2ee, only/tmp independent artifacts, noimplementer sourceedits. NoAC/Done/paidactivation/manualclaim untilreviewandexplicitmanualuserconfirmation.

Fresh whole-delta QUALITY f92d2ee With fixes: 2 Important/0 Critical/0 Minor. Actual delayed bindModel/provider gives120000ms with immutable order1000ms remaining; actual clearSource/purge cancellation leaves public outcome pending even after stale-generation Workflow completion. Focused130PASS; independent4RED/1PASS /tmp/dispatch-pipeline-quality-f92/confirmed-red.log; full /tmp/dispatch-research-pipeline-quality-receipt.md. ROOT handed both to original implementer: atomic persisted research deadline clamp, active cancellation terminal disposition across real sibling writers, preserve historical terminal outcomes/rights/unknown holds/late finance. Narrow researchTools/pipeline/registered regressions ownership; unchanged RED/scripts/hash preserved, local checks then freeze, same SPEC delta then same QUALITY delta. No AC/Done/provider activation.

Original implementer QUALITY correction exact5 source paths frozen3b518074bc2fb0bc6b5360ff5c00a23b90467318. Atomic persisted research deadline clamp; active pipeline source/retention, profile pause/delete and native-budget cancellation terminalized, historical completed/partial/empty outcomes preserved. First unchangedQUALITY5=4RED1PASS01:15:26/permanent4RED32PASS; direct expiry purge exposed genuine later stale snapshot overwriting cancelled outcome, fixed local normalized snapshot. Focused43PASS01:17:37; full539/28 and unchangedQUALITY5+SPEC7+11+branches4PASS01:17:48. Type/lint/build/bundlePASS; initial test-only branded WorkflowId TS error retained separately. All8 reviewer scripts/configSHA unchanged /tmp/task22.2-quality-correction-reviewer-sha.txt. No UIchange, prior fresh browser reuse explicit. Commit windowclosed; codegen/posttype/Dev then SAME SPECdelta→SAME QUALITYdelta pending; no AC/Done/activation.
<!-- SECTION:NOTES:END -->
