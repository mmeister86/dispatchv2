---
id: TASK-25
title: Selektive Annahme und sichere Ausführung ermöglichen (P07.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 10:39'
labels:
  - p07
  - r2
milestone: m-2
dependencies:
  - TASK-24
  - TASK-8
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P07.02.
Phase: P07 – Kalenderbewusste Planung aus beiden Quellen.

**Abhängigkeit:** P07.01, P02.02. **Dateien:** `convex/planning/accept.ts`, `src/features/agent/plan-preview.tsx`, `src/features/calendar/proposed-items.tsx`; Test `tests/e2e/agent-planning.spec.ts`.

- Entwürfe prüfen, separat bearbeiten, freigeben und ausgewählte Slots annehmen lassen.
- Konflikte und Quellenfrische bei Annahme erneut prüfen.
- Angenommene Vorschläge deterministisch in geplante Posts überführen; übrige Vorschläge erhalten.
- Eine ausdrücklich beschriftete kombinierte Aktion „Version freigeben und planen“ erlauben, ohne eine implizite Freigabe aus bloßer Planansicht abzuleiten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D08: Quellenfrische vor Planung und Versand beachten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J06 funktioniert.
- [ ] #2 zwei angenommene von drei Vorschlägen ergeben genau zwei Termine.
- [ ] #3 Parallel geänderte Kalenderdaten werden erkannt und bestehende Einträge bleiben erhalten.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace actual Plans/proposal/source/history and ordinary approval/checkApproval/schedule/reschedule/Calendar callers; fresh sole writer on master after accepted24. Reproduce stale other-approver reuse through genuine registered API RED before shared predicate change.
2. Narrowly extract/reuse existing ordinary approval and schedule transactions. Explicit current-human approval reuses only same human ordinary receipt; preserve original actors/approvals/jobs, first-write separation and native explicitly reviewed old snapshots. Planner unchanged captured current version/revision remains required.
3. Implement one max7 distinct selected-set native mutation with current Owner/Admin, exact plan/workspace/account/item/version/revision/ordinaryapproval/civiltime/source/media/originalproof/immutableassessment/exacthistoricalcontext/occupancy validation. All NEW selections commit or rollback together; prior accepted receipts remain. Persist actual finite per-item schedule/approval/acceptance identity, idempotent replay without rebinding; accepted items cannot be proposal-rejected.
4. Real Plans selectable pending elements, separately reviewed exact-version approval and required explicitly labelled Version freigeben und planen. Await commands, preserve selection/error on failure, guard role/scope/unmount/expiry, show actual accepted calendar receipts. Existing Composer edits require new proposal; Calendar reads native schedules, no local simulation or fake Agent IDs.
5. Genuine native stale-approver/2of3/duplicate/concurrent/atomicrollback/version/context/account/purpose/role/slot/unknown-effect negatives and historical scheduling invariants. If standard native short source proof underfills daily planner, clearly qualify three-item persisted acceptance fixture and retain actual eligible propose→accept flow; never stretch deadlines for tests or claim live next-week J06.
6. Freeze exact source/body/config/runner BEFORE executions, preserve genuine RED and harness errors with UTC/argv/childexit/rawhash; full/static/build/bundle/bindingcodegen/configured EU Dev/affected actual styled mocked-browser desktop390 checks. ROOT scoped source commit after full reading; fresh SPEC then QUALITY, manual/provider/Done remain open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /plans, /drafts/:id, /calendar. Review/edit proposals, independently approve concrete versions, select a subset and accept only selected slots; existing slots protected by local conflict checks. Grenze: No backend acceptance mutation, live source-freshness check or collaborative concurrency. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

ROOT releases TASK25 after fresh SPEC/QUALITY acceptance of TASK24 source25d439d under standing user authorization. Exact release /tmp/dispatch-task25-release-contract.md10007B SHA900dee218142e7fc711767bbd06409cca766bd4f4c2630706e39d0060fb1b80d; ROOT approval reuse clarifications /tmp/dispatch-task25-root-approval-clarifications.md3646B SHAa8819dd78080bf6e07e0e14d0dd9c429cfa26e60b799c931bb72ddaaaa500a75. Old actor reuse gap is source inference until writer native RED. Required combined action is not optional. Reuse actual /plans and native editorial scheduler, no parallel content/approval/calendar/effect ledger. ROOT owns Backlog/docs metadata, writer exact SOURCE scope separately assigned. In Progress/manual DoD unchecked.
<!-- SECTION:NOTES:END -->
