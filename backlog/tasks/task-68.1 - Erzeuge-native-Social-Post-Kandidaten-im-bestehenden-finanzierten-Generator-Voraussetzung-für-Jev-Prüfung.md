---
id: TASK-68.1
title: >-
  Erzeuge native Social-Post-Kandidaten im bestehenden finanzierten Generator
  (Voraussetzung für Jev-Prüfung)
status: In Progress
assignee: []
created_date: '2026-10-06 23:11'
updated_date: '2026-10-07 15:08'
labels: []
dependencies:
  - TASK-67.2
references:
  - .docs/jev-generation-continuation-contract.md
parent_task_id: TASK-68
priority: medium
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nach technisch akzeptiertem 67.2 den tatsächlich vorhandenen purpose=draft Perspektiven-Generator um einen ausdrücklich angefragten Social-Post-Kandidaten-Modus erweitern. Exakter Output-Kind, Quelle, Style, Netzwerk, Kommunikationsziel, Ton, CTA und Strategie gehören zum unveränderlichen nativen Intent. Bounded ordered Post/Thread durch bestehende Regeln validieren und native Candidate-ID/Hash/Run speichern, bevor Jev prüfen darf. Bestehende Finanzierung, Rollen, Source-Proof und Agent-Lifecycle wiederverwenden; kein zweiter Generator, Registry, Ledger oder Provider. Perspektiven-Modus bleibt erhalten; nur menschliche Anwendung erzeugt eine neue ungeprüfte Version. Root-only Codegen/Freeze/Reviews/Commit/exaktes bestehendes EUDev, kein bezahlter Live-Aufruf und keine manuelle Done-Abnahme.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Expliziter Kandidatenmodus verwendet den bestehenden finanzierten purpose=draft Pfad mit unveränderlichem vollständigem Intent und nativer Candidate-ID/Hash/Run; Perspektiven-Modus bleibt unverändert und Providerantworten schaffen keine Autorität.
- [ ] #2 Ganze geordnete Post-/Thread-Kandidaten werden mit bestehenden Capability-/Content-/Media-Grenzen validiert; Rollen, Account, Source, Style, Zweck, Preis und bestehende Finanzbelege gelten vor Funding/Tool/HTTP/Commit.
- [ ] #3 Menschliche Anwendung erzeugt eine neue ungeprüfte Version mit aktuellem Buffer-/Revisions-Fence; superseded/revoked/expired Antworten und gespeicherte Agent-Kopien werden maskiert sowie indexed physisch bereinigt, ohne Finanz-/Publishing-Eltern zu löschen.
- [ ] #4 Registered native Action mit abgefangenem SDK, tatsächliche styled Ideas/Composer, frische separate SPEC/QUALITY, unveränderte native Gesamtprüfungen/static und exaktes bestehendes EUDev sind dokumentiert; reale Modellqualität und manuelle Done-Abnahme bleiben offen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Automatisierte Prüfungen und offene manuelle Abnahme sind konkret dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Nach technisch akzeptiertem 67.2 tatsächlichen Generator/Funding/Source/Style/Agent-Lifecycle abgleichen.
2. Expliziten Kandidaten-Output-Kind im vorhandenen purpose=draft Pfad und native immutable Candidate-ID/Hash/Run ergänzen.
3. Ganze geordnete Post-/Thread-Ausgabe mit bestehenden Content/Capability/Media-Grenzen und indexed physischer Cleanup prüfen.
4. Menschliche Anwendung als neue ungeprüfte Version mit aktuellen Buffer-/Revisions-Fences und echten UI-States anbinden.
5. Registered native Action/SDK-Abfangtests, styled Browser, Source-Freeze/fresh SPEC/distinct QUALITY, Gesamtprüfungen/static und Root-Commit/exaktes bestehendes EUDev; manualDone offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Konkrete CLI-Vorbereitung unter fortlaufend freigegebenem Backend-Ausbau, noch kein SourceWriter/Implementierungs-/Test-/Review-/Dev-Nachweis. Finale vorherige Source-Einheiten zuerst technisch akzeptieren; Root hält genau einen Writer und unabhängige frische SPEC/QUALITY. Status To Do, AC/DoD ungeprüft, keine Provideraktivierung oder manuelle Abnahme.

KonkreterReadonlyCallerPreflight .docs/reviews/task-67-routing-generator-preflight.md: purpose=draft tatsächlicherperspectiveJSON erzeugtIdea, keinSocialPostPipeline. Expliziteroutputmode+wholeNativeCandidateID/hash/run/intent muss vorVerifier existieren; currentprovider.execute/common5createRunCallers, mediaSnapshot/recordMediaReferences/CAS/humanunapprovednewversion undindexedrun/source/style/AgentexecutionFinishedCleanup beachten. Agent0.6.4text-onlyInvariant nutzen; komponentenfilesDeleteMetadata≠storagebytesdelete undmemories/orphanVectorsnichtthreaddelete. NurVorbereitung, ToDo/unreleased/unverified.

Root vollständig las83-line aktuellen Readonly-Plan .docs/reviews/task-68.1-actual-candidate-source-plan.md, SHA80a2455bdd0bc3abd33d22b1b1acb2fe6e5f8b0682bc920a30912df904ca2090. Tatsächlicher gefundeter Agent/parser, whole ordered Capability/Content/Media, native Idea/Draft/CAS/Source/Approval und indexed Cleanup-Seams konkret geprüft. Minimum-Vorschlag: optionaler immutable Kandidat in vorhandenen ideaVersions, vorhandene mediaVersionReferences mit exakt typisiertem nativen Version-Ziel, originaler purpose=draft und fünf Caller erhalten. Menschliche Anwendung nutzt bestehenden Buffer/Revisionspfad und einen ausdrücklich gewählten Target; kein neues Workflow-Framework. Exact67.2 API/Request/Proof bleibt ungeklärt bis separat technisch akzeptiert; nur Vorbereitung, keine Source-Freigabe/Tests/Provider/AC-Akzeptanz. To Do/manualDone offen.

Root prepared /tmp/dispatch-68.1-writer-brief.md (preparation only) after fully reading adopted83line candidate plan and actual shared editorial/media/source/Composer callers. Existing-family candidate/nativeVersion+media reference union, exact new/current Draft application preserving both ancestry, shared save propagation for recommendations, independent root-gone terminal payload/ref cleanup clarified. No source release or test/API acceptance; final67.2 source/receipt/cleanup reconciliation first. Task remains To Do/ACs and manualDoD open.

Readonly current frozen67.2 seam delta adopted as proposal: root reconstructed exact19-path hash9346cfbc654d18f688a456655201e315f5316d4282b4dfad6df97429aee94505 against6c249e93. Targeted agent ranges/searches, not full-file reads; five proposed control bodies not freshly inspected. Exact14production+6control proposal in /tmp/dispatch-68.1-writer-brief.md. Existing provider/ai.fields/Store/mapping/Settings/media readers reference-only; candidate X-only explicit mode/media/wholecommand proof; native read/apply existing handoff receipt/Composer fences; shared lineage and bounded cleanup before root/research guards. Current67.2QUALITY/fullgates/commit/exactDev pending; no source release/test acceptance, ToDo/AC/manualDoD open.

Predecessor67.2 separately TECHNICALLY_ACCEPTED sourcecommit2f095443e8880c5027030c98b58728045fbc04fe/334freeze6c249e93/freshSPEC+distinctQUALITY/1351native54files/sevenstatic/exact existingEUDev427metadata/one newinternalpurgeRouting/41interfaces/fiveHTTP unchanged. Root adopted current frozen-seam19-path readonly reconciliation and minimum14production+6control proposal; solewriter release planned after root verificationdocs commit and immutable baseline. Reuse existing funded provider transport/nativeMedia/Composer and source32/horizons/original3scope finance; X-only explicit candidate mode, ordered payload/nativeID/hash/run, explicit human unapproved application and bounded rootgone cleanup. All68.1 AC/DoD remain open; no sourcewriter/candidate/verifier/repair/provider activation yet.

Intermediate source STOP verified by Root:334 source/20 owned/314 protected,13 changed owned,all six original control prefixes and human .zcodeignore exact. Actual registered RED1 failure/49 skips then scoped GREEN1 pass/49 skips; earlier projection/hash/type/control-format failures preserved. Current backend TSC and20path format EXIT0. Intermediate installed Convex codegen --typecheck enable EXIT0 2026-10-07T13:29:22.588165–13:29:32.533060UTC against existing authorized EUDev;321 non-generated sources unchanged,309 protected non-generated exact,0 generated changes. Root proof /tmp/dispatch-68.1-codegen-intermediate-root-verification.json. Sole writer explicitly resumed for actual Ideas/Composer and expanded lifecycle/media/finance/CAS/styled browser controls. Intermediate upload is not final source/Dev/manual acceptance; all AC/DoD remain open, status In Progress.

Final writer SOURCE_READY_STOP_ALL_EDITS at2026-10-07T14:17UTC; Root read actual report/semantic receipt and production/new native+browser deltas, verified334source/20owned/314protected/17changed owned/original20 copies/native4 prefixes/protected editorial bodies/humanignore,300 immutable artifacts,39 timed checks,35 final pixels plus21 private probe hashes. Final scoped native202PASS/4files/0skip; bothTS/current20format0; stronger Ideas-final2 and Composer-final3 browser0. Initial final browser ABA timing was invalid evidence, failures preserved; stronger observed-session/late-settlement assertions replace it. Demo fullpage tiling qualified as capture anomaly by unchanged private DOM+viewport probe; Root direct current5images, not all hashes as views. Root final installed codegen --typecheck enable0 at14:19:41.035091–14:19:49.942134UTC,321 nongen and all334handoff exact. New final334freeze bcd1bcf4afe823700394e375b3a11a710b1caee2664bd6e8173b327bce660e2b at14:20:00.971968UTC; fresh independent SPEC released. Distinct QUALITY/root whole-native+sevenstatic/commit/exactEUDev acceptance pending. No paid/provider/model/manual/full33–36 claim; allAC/DoD remain open, status In Progress.

Fresh distinct QUALITY PASS on final334 freeze bcd1bcf4, report .docs/reviews/task-68.1-candidate-quality-review.md SHA c4cf1c83df7f35b46296db30f144859474be2ccb739f460ce6cd4195c37178f3, receipt b4971278da93d6edfaf49cb29d245519e58b6048571801e55eca331270bd4337. Root accepted actual report/semantic receipt/both private native bodies/logs and independently verified334source20owned314protected,30 initial +16 later-window inputs,27artifacts/six timed checks,20HEAD originals/four native prefixes/two editorial/two browser main bodies; windows/read scopes qualified. Own6 distinct controls =first4PASS1preserved public-save fixtureFAIL +second2PASS4SKIP; registered42PASS160SKIP. Actual postfund expiry/media loss knownzero versus physically entered stop/oldUSD late41 once;26 actual native committed/applied/Agent rootless cleanup families preserve independent same-asset sibling, not26paid modelcalls. Root seven static gates EXIT0: finalcodegen,AppTS,ConvexTS,configuredformat,owned20format,originalbundle-secretassertions,diffcheck. Actual logs read, static receipt e3b7b0ec33922b2dbdec6e72a383f6607f84203014230ae1ff9746abf775d128; current334exact. Root source proofs /tmp/dispatch-continuation-68.1-spec-root-verification.json and quality-root-verification.json; .docs/reviews/task-68.1-candidate-validation.md updated. Whole native suite now running; exact sourcecommit/existingEUDev pending, AC and manualDone remain open. Nine direct root current pixels, resizedComposer and Demo fullpage tiling anomaly qualified; no deployed termination/OCC/provider/model/screenreader/full33-36 claim.
<!-- SECTION:NOTES:END -->
