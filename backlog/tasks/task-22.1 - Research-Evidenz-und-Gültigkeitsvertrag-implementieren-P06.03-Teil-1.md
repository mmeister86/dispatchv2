---
id: TASK-22.1
title: 'Research-Evidenz und Gültigkeitsvertrag implementieren (P06.03, Teil 1)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 21:36'
labels:
  - p06
  - r2
  - teilpaket
milestone: m-2
dependencies:
  - TASK-21
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-22
priority: high
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P06.03. Verantwortung: convex/research/evidence.ts; strukturierter Ergebnisvertrag aus §§6.1–6.3.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P06.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gelieferte Quellen, überprüfbare Behauptungen, Interpretation und Datenlücken werden getrennt gespeichert.
- [ ] #2 Account-Perspektive, Relevanz, Unsicherheit und begründeter Gültigkeitszeitraum sind je Ergebnis vorhanden.
- [ ] #3 Ungültige oder entfernte Evidenz kann nicht erneut als gültige Quelle übergeben werden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace reviewed TASK21 final native order/cache/source authority, actual material identity and retention hooks against D08 and the full research contract.
2. Implement the minimum tenant/account/order/source-bound evidence and structured result create/read/validation contract: actual delivered sources, source assertions/support, interpretation and gaps separate; bounded account perspective, relevance/uncertainty and justified freshness without invented verification or universal expiry.
3. Fence mutable source payload/version, current rights/purpose/actor/account/profile/generation and actual validity at ingestion/read/each effect; extend concrete invalidate/expire cleanup for actual evidence copies with bounded completion proof and no resurrection.
4. Connect only the existing actual source/evidence controls needed by this unit; metadata-only sources stay visibly unverified, no fake Inbox/full Agent or unsupported handoff. Preserve command keys, dirty inputs, current proof clock and real/Demo separation.
5. Run meaningful wrong-source/foreign-scope/quote/metadata/freshness/copy/conflict/source-revocation/late-effect and actual retention tests, affected regressions/type/lint/build/bundle/browser where changed and official codegen/existing EU Dev after green; no paid provider/model/source activation.
6. Scoped commits/self-review/freeze; fresh SPEC then fresh QUALITY with correction deltas. Check code AC only after independent evidence; Backlog stays In Progress until explicit user manual confirmation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research — inbox/detail. Source URLs, source claim, interpretation, confidence and freshness warning remain visible in local content handoff. Grenze: Demo URLs are marked example sources. No real evidence validity/expiry enforcement or removed-source feed. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root formal D08 initial rule recorded in domain-contracts/release-scope under delegated choices: time-sensitive/context-dependent/time-independent/unknown freshness distinct; publication/event/observation times never conflated. Actualsource+versionedpurpose rule and finite justified validity required for automaticeligibility; model expiry or searchwindow alone cannotgrant. Expired/unknown/removed/blocked/unreachable evidence stays Review, no universal24/48h TTL. Recheck creates separate actual-source proof; changedclaims newresult/contentversion and humanapproval. Initialdecision establishes no measuredlimits/provideractivation/sourceverification or22.1code; futureimplementation after final19/20/21 and rootassignment.

Read-only native-source retrieval preparation /tmp/dispatch-research-source-fetch-current-docs.md: Context7 library-first /nodejs/node/v22_20_0 with two docs calls outside sandbox, no quota/network failure. Native DNS-all and net.BlockList/mapped-IPv6 checks avoid an unnecessary parser dependency. Exact https.request custom lookup/connection pinning syntax and actual runtime/TLS/redirect/timeout behavior still need current official/installed-source proof and actual synthetic connection tests if concrete delivered-source-ID retrieval is needed. No fetcher, source/provider call, SSRF certificate, TASK22 code or AC evidence implied; actual reviewed TASK21 sources/funding/cache schema remains prerequisite. Complete D08 claim support still cannot come from URL/title alone.

Implementation released by ROOT after final TASK21 re-SPEC and QUALITY PASS e5e1c1e. Currentsource wins over earlier43f3cc5 prepmap. Read actualprovidercontract and finalreview: native3source stores/canonicalv2/legacyunknowncompat/ownfundedcontext coverage and source rights distinct; cachehitmaypriorfillorder. Sourcegenerationpolicygen notuniquecontentversion, bindactualmaterialidentity/observation/expiry. Web/trends metadata notarticle/body/factualquote; actualXboundedtextavailable. D08formal5f01f79 actualsource+versionedpurposevalidityrule/justifiedfiniteexpiry, otherwiseReview; modelproposal/searchwindow/newobservedtime noauthority. Newcopiedevidence extends actualphysicalscrub/proof/retention hooks now. No genericprovider/secondledger/messageengine, no paidactivation/Done. Full22.2 tenstepworkflow and23Inbox/contentbridge separate; 22.1mustnotclaim them.

ROOT concrete D08 choice: manualsourcebound creation now, nofundedmodelbridge/articlefetcher. AddminimumexplicitOwnerAdmin humanvalidityreview asNEWimmutablelineage foractualmaterial+annotationversion/purpose/currentversionedrule/boundedmaxage/requestedfiniteexpiry/justification/actor/time/substantivesupportattestation. Quoteonlyprovenance, labelhumanreviewednotautomaticallyprovedtruth. Clampcurrentactualsource/cache/policy/grantretentionproof; originalreviewerrolecurrent. Source-publication alone cannotrenewoldmentioned event: separateattributedactualeventtime, earliestrelevantbasis for event/time-sensitiveclaims; missingrequiredtimeReview. Metadata-only/unknownfreshness/absentquote/consequential-contestednocorroborationReview. No globalruletable/engine/newproviderorpublicationpermission. Actualdecisionin domain-contracts7.2, initiallimitedrulecoverage documented rather thanfalseuniversalverification.

OfficialcodegenUploadmessage clarified BEFORE runtimeclaim: currentContext7library-first2commands plusinstalledConvex1.46components.ts runCodegen callsstartComponentsPushAndCodegen analysis/bindings, notfinishPush; runtimefinishPush onlyrunComponentsPush/dev. Officialdocs saycodegenconfigurationevaluation doesnotmodifyrunningcode. /tmp/dispatch-codegen-analysis-current-docs.md. Preliminaryofficialbindingsgenerationneededforcompile mayprecedelocalgreen; actualDev--once remainsaftergreen. No accidentalWIPdeployment/provideractivationclaim/no rollback. Workerhumanrule minimum immutablelineage + currentOwnerAdminreview; event/sourcepublication earliestrelevantbasis needed, unknowneventtimingReview.

Frozen implementation49a9b9971e95f4e39629261e407dc10df83436bd exact13paths; index/treeclean. FreshSPEC active, QUALITY notstarted and ACunchecked. Implementer493/27 and95 native/evidence checks plus type/lint/build/bundle/diff and actualResearchPage synthetic-providerbrowser PASS. Officialcodegen23:16:31 / existingEUDevReady23:17:15 afterlocalgreen, no activation/model/provider/liveclaim. Preserved original90case88PASS2RED: genuineinvalidate asynchronouscopycleanup fixed sharedsynchronousfirstbatch; rawsourceexpiryCASfixture corrected independently, notproductexpirybug. Later93/95/full493 progression retained actualtooltranscript (no fabricated initial log). Full pendingreview record .docs/reviews/task-22.1-research-evidence-validation.md. Humanvalidity limited research-context + exactISOeventexcerpt; metadata/unknown/corroboration gaps remainReview, no full22.2workflow/23handoff/manualDone.

FreshSPEC49a9b99 NEEDSFIXES oneconfirmedreviewer-only read visibility defect: separateAdmin demotedViewer removeseligibility butcopiedpayload/assessmentreason exposed; expired/nullassessment skipsreviewercheck. Currentreviewer mustguardcontentproof independentlyof validity; reviewedlineage nullpayload/source/assessment proof0 onwithdrawal, originalauthorizedannotationstillreadable. Originalimplementer releasedonlyevidence.ts/providers.test.ts/contract, scopedcommitpending; sameSPECdelta thenfreshQUALITY. Independent5:4PASS1RED;registered95PASS;actual205copycallbackcleanup→0/replay/ownexpiry andsyntheticReactbrowser+dirtybufferpreservationPASS. /tmp/dispatch-research-evidence-spec-receipt.md actualrunnableproof; fake-timernesting anddisabledbrowserbuffer harnesscorrections preserved. NoAC/manualDone.

Reviewervisibility correctionfrozen3e079cef4d9e9ba0d1a274aa629bebd6816f868b exact3paths/index/treeclean. SharedcurrentReviewercheck nowcontentproof ALLassessments beforecopyprojection; immutableauditrow andauthorizedoriginalannotation preserved. Permanentdistinctreviewer future/null/expired98suite95PASS3RED23:29:43→98PASS23:30:14; originalindependent5GREEN23:30:16 originalREDlogpreserved. Full496/27/type/lint/build/bundle/diff/postgenerationtypePASS; officialcodegen23:32:16 unchangedbindings/existingEUDevReady23:33:03. SameSPECdeltaactive beforefreshQUALITY, ACunchecked. NoUI/ledger/source/retentionchange/paidactivation/manualDone. Detailedreceiptsreviewdoc.
<!-- SECTION:NOTES:END -->
