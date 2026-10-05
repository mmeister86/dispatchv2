---
id: TASK-12.2
title: >-
  Thread-Beiträge mit dauerhaften Versand-Checkpoints veröffentlichen (P03.03,
  Teil 2)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 12:54'
labels:
  - p03
  - r1
  - teilpaket
milestone: m-1
dependencies:
  - TASK-12.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-12
priority: high
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P03.03. Verantwortung: convex/publishing/workflows.ts und attempts.ts; deterministischer Versand der freigegebenen Version.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P03.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Jeder Einzelpost besitzt eine nachvollziehbare Operation und einen dauerhaften Checkpoint mit externer ID.
- [ ] #2 Account, Version und Autorisierung werden unmittelbar vor Versand geprüft.
- [ ] #3 Automatische SDK-/Workflow-Retries nicht idempotenter Schreibaufrufe sind deaktiviert; ein Crash nach Beitrag 2 wiederholt bestätigte Beiträge 1/2 nicht.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse reviewed approval/schedule/X credentials and TASK12.1 media engine; fetch current post contract before new API code.
2. Implement durable per-position intent/confirmed-ID checkpoints and native bounded coordinator with no unknown-write retries.
3. Add explicit human-approved first-write verification purpose and concrete UI confirmation, truthful results/configuration.
4. Check isolated crash/race/permission/media/unknown cases and actual browser UI, full checks and existing Dev; independent SPEC then QUALITY before reconciliation.
5. Record inventory and live/manual gates; do not set Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /calendar?view=agenda. Thread detail shows each contribution and confirmed checkpoint; local completion updates only pending mock contributions. Grenze: No durable backend checkpoints or external IDs. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Fresh SDD implementation begins after TASK12.1 final SPEC/QUALITYddd3ad4. Explicit first-write decision .docs/decisions/first-write-verification.md; current provider receipt /tmp/dispatch-x-post-current-docs.md. Existing version-level media list attaches to first position only, shown in exact human consent snapshot. No root/provider live posts without actual testaccount/content authorization; current missing configuration remains visible per user decision.

Implementation ongoing: native per-position preparing/sending/confirmed/rejected/unknown CAS checkpoints, concrete expiring first-write approval/schedule purpose, first-position-only media and actual optional media_key capture. Official twitter-text3.1.0 replaces incorrect UTF16/CJK/URL counting in shared checks; root independent pnpm audit --audit-level moderate reports no known vulnerabilities after install. Root Context7 current post query plus primary endpoint/schema receipts resolve201/nestedmedia/reply; no matched Context7 character docs after3 commands, current official character guide/repository used explicitly. No runtime deployment or live provider evidence claimed at this stage; UI/browser/full checks/reviews remain.

Implementation frozen at 8b84329 (backend 1122ef3). Implementer reports 136 tests/16 files, type/lint/build/bundle/diff and four actual local browser fixtures PASS; configured existing EU Convex Dev --once ready 14:40:34. OAuth reconnect-to-first-write regression preserves distinct global binding fence and pinned account connection sequence. Root full34 browser regression and independent SPEC are running; QUALITY follows SPEC PASS. No live provider/manual acceptance or Backlog closure claimed. Receipt .docs/x-thread-publishing-contract.md and .docs/reviews/task-12.2-x-thread-validation.md.

Independent SPEC FAIL on 8b84329: (1) initial publishing.claim commits publishing before a separate action registers continuation, so an intervening crash leaves no durable watchdog/attempt; (2) finalize/status actual media_key is parsed but discarded when INIT omitted it. Reviewer independently reproduced both with two failing temporary tests; 31 existing targeted checks pass. Original implementer is correcting causes with durable native claim scheduling and retained/conflict-checked media-key evidence, then re-review. No AC or Done marked.

Root independent existing Playwright regression on 8b84329: all34 cases PASS in2.1min, including calendar/editor/navigation/accessibility. This is local browser evidence, not live provider/manual acceptance. SPEC defects remain under correction; no broad regression repeat needed unless subsequent UI changes/failures justify it.

Fix candidate 9f5f593: initial workflow step registered atomically within claim mutation; dispatch no longer has separate action gap. Finalize/status retains real acknowledged media keys; conflicts pause uncertain without overwriting. Five permanent regressions reproduced red then green; implementer full141/type/lint/build/bundle/diff and existing EU Dev ready14:45:43 PASS. UI unchanged from root34 browser PASS. Same independent SPEC reviewer re-review running; QUALITY not yet started.

Independent SPEC re-review PASS on 9f5f593:47 repository tests plus4 isolated checks PASS, including original claim crash gap and finalize/status missing key reproductions plus absent-key evidence. No outstanding SPEC finding. Fresh independent QUALITY review now running on frozen code; AC/manually confirmed Done remain pending.

Independent QUALITY NEEDS WORK on9f5f593: public cancel changes uncertain zero-confirmed write to cancelled and clears error, releasing first-write account barrier although provider POST may exist. Two isolated reproductions fail (unknown->cancel->new proof; repeated cancel of sending->late receipt),8 existing safety tests pass. Original implementer corrects central cancellation with persistent idempotent abort intent/unresolved evidence barrier and no late advance/proof activation. QUALITY re-review and SPEC delta required; no AC/Done closure.

Cancellation fix candidate eddf1a2 frozen: schedules optional abortRequestedAt/By, current public authority/ownership before idempotence, generation invalidated once, bounded indexed cross-generation unresolved barrier/error/IDs retained, known resolved prefix may cancel, shared claim/send/reschedule guards reject abort, late receipts evidence-only. Six permanent regressions PASS; implementer147full/type/lint/build/bundle/diff and existingEUDev ready14:53:02PASS. SPEC delta review running before QUALITY re-review; UI unchanged/root34PASS. New fields added to contract inventory for TASK33/36.
<!-- SECTION:NOTES:END -->
