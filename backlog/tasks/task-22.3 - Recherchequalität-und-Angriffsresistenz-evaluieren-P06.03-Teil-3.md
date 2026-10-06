---
id: TASK-22.3
title: 'Recherchequalität und Angriffsresistenz evaluieren (P06.03, Teil 3)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 00:07'
labels:
  - p06
  - r2
  - teilpaket
milestone: m-2
dependencies:
  - TASK-22.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-22
priority: high
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P06.03. Verantwortung: convex/research/evaluate.ts und tests/evals/research/; versionierter Referenzdatensatz.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P06.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Stichprobe enthält relevante, irrelevante, alte, widersprüchliche und bösartig instruierende Quellen.
- [x] #2 Ausgaben referenzieren ausschließlich tatsächlich gelieferte Quellen; URLs und Trenddynamik werden nicht erfunden.
- [x] #3 Ergebnisbericht weist Quellenrichtigkeit, Wiederholungen, Frische, Kosten und bekannte Grenzen aus.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Freeze versioned contract-derived reference sources and declared oracles before controlled candidate scoring, with explicit synthetic authorship and unknown live quality.
2. Reuse actual registered research/evidence/funding handlers and existing concrete fixture for bounded delivered-source, freshness/history, isolation/injection, outcome and cost probes.
3. Generate an honest local report from executed probes with counts, failures, unknowns and separate cost provenance; do not add a report service or live provider calls.
4. Run relevant/full checks and exact scoped commit, then independent SPEC and QUALITY review; document manual/provider gates without Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ROOT implementationrelease after independently accepted22.2 source3b51807, prerequisites22.1/21 acceptedcode. Fixed pre-candidate draft /tmp/dispatch-research-evaluation-reference-oracles.md (AI-prepared contract-derived, humanreviewopen) and /tmp/dispatch-research-evaluation-implementation-brief.md. Reference text hashes separate actual source material hashes; fixed synthetic labels are not factual truth/modelsemanticquality. Ownership evaluate.ts/tests/evals/research plus concreteexistingfixture extraction onlywithtwoactualconsumers; no evalplatform/publicreportAPI/newledger/paidprovideractivation. Existing InProgress tasks remain manualpending; no Done.

Implementationevidence WIP: original AI-draft oracle SHA573de70530be4b404be4d57938ceed746a44b7888dbab5f07ce2c5d2fdd979e6 and9text hashes frozen BEFORE controlledcandidate. Actualadapterlimits explicit: Webmetadataonly, Xrecent rejects oldpub; newpub/oldevent remainsseparate. Registered12cases/32probes, 61 interceptedphysicalinvocations with actualfunded/sent-admission checks; no externalrequests. Controlled intentionallyunsupported S2 bakingquote+pilotclaim persistsASUNVERIFIEDReview: declaredsemantic-support FAIL0/1 retained as limitation, no lexicalfactchecker/factualtruthclaim or livequality metric. ROOTapprovedhonestdiagnosticratherthanspeculativeproductionsemanticengine; future23mustpreserveReview/sourcechain/noautoverify/approve/publication. Initial historyfixture prepared vsactualpreparing stage was harness error. Genuine localcostprojection unknownestimate0→requiredNULL RED corrected. Freshfull542/29/type/lint/newpathformat/build/bundle andofficialcodegen/postgentypePASS reported; api.d.ts only2linepuremodule diff; no runtimeAPI/UIchange/Devpush/browserrerun, finalfreeze/reviews pending. Rootfuture23.1→23.2→23.3 ToDo created viaCLI, no parallelimplementation.

Frozen exact11source6c38de90c35d371e2bf35ce68f39ebcdeeaae865 tree/indexclean/windowclosed. Final542/29PASS01:44:50 /tmp/task22.3-final-tests.log +type/lint/newformat/build/bundle/codegenposttypePASS. Selfreview actualhandlerlabel corrected toai.researchAgent.research, finaleval3PASS01:48:24 /tmp/task22.3-final-eval.log; nooracles/candidates/scoringretune. FINALcompactJSON168427bytes SHA bef409160f91998b19ec60b8dee7c82001be7239179af9aee9fce842f6f0efb4 parsedmatchesactual; earlier2537... supersededpre-selfreview only. FixedoracleSHA573de705... unchanged.12cases32probes175technicalchecksALLPASS excludes explicit controlledsemanticFAIL0/1;61intercepted0external/1170estimate500held5unknownbillingNULL. No complete rawprivate snapshots; ordinaryrunner writes/tmp only. Purehelper2generatedbindings no callablehandler/UIchange, noDevpush/newbrowserclaim. Fresh independentSPEC research_evaluation_spec ModelQA/astra/medium active; freshQUALITY onlyafterPASS, noAC/Done/manualacceptance. ROOTreceipt .docs/reviews/task-22.3-research-evaluation-validation.md.

FreshindependentSPEC6c38de90 PASS/ReadyYes no confirmedCritical/Important/Minor /tmp/dispatch-research-evaluation-spec-receipt.md. Focused3PASS01:50:42 +ownindependentnodecheck recomputes12/32/175/61 and1170USD/500/5 fromactualexecution,9textSHA/frozenreport/all11filehashes; realunverifiedReview/automaticEligibilityfalse semanticFAIL0/1 verified. Empty/unknown/mixed/knownzero/failed/absentquote projectiondenominators checked. Rerundidnotmutate frozenfiles. ROOTfreshQUALITY research_evaluation_quality AppSec/astra/medium activeafterSPEC; sourcefrozen noimplementeractive/noAC/Done/Dev/browser/activationclaim.

FINALfreshQUALITY6c38de90 PASS/ReadyYes no confirmedissues /tmp/dispatch-research-evaluation-quality-receipt.md. Own3PASS01:53:22 +independent/tmp checker reconciles12/32/175/61,17pins15quotes2absent,1170USD/500/5,billNULL/current3scopefunding/authoritybefore-after; separatelycorruptedURL/cost/sentinel rejected andpureedge/inputnonmutation checked. All11functionalhashes/frozenoracle/report unchanged/sourceclean. ROOTAC1–3 SOFTWARE controls/reportverified, explicitcontrolledsemanticFAIL0/1/livequality/humanlabels/manualacceptanceOPEN. InProgress notDone. Parent22softwarecriteria reconciled; TASK20AC1nogithubcodeproof nowvalid butAC4 exactsave-duringactualIOprooftestmissing. Next23.1 currentevidence→ideas/drafts actualread/write/cleanup/sourceclock chain, then23.2chat→23.3UI/explicitauto, noprovideractivation.
<!-- SECTION:NOTES:END -->
