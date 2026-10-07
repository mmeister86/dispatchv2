---
id: TASK-68.1
title: >-
  Erzeuge native Social-Post-Kandidaten im bestehenden finanzierten Generator
  (Voraussetzung für Jev-Prüfung)
status: To Do
assignee: []
created_date: '2026-10-06 23:11'
updated_date: '2026-10-07 09:46'
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
<!-- SECTION:NOTES:END -->
