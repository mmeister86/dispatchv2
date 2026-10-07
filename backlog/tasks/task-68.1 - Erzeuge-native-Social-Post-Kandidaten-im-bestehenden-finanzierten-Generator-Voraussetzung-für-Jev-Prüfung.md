---
id: TASK-68.1
title: >-
  Erzeuge native Social-Post-Kandidaten im bestehenden finanzierten Generator
  (Voraussetzung für Jev-Prüfung)
status: In Progress
assignee: []
created_date: '2026-10-06 23:11'
updated_date: '2026-10-07 12:53'
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
<!-- SECTION:NOTES:END -->
