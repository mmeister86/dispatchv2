---
id: TASK-24
title: Pläne und Vorschlagslogik erstellen (P07.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 09:27'
labels:
  - p07
  - r2
milestone: m-2
dependencies:
  - TASK-13
  - TASK-19
  - TASK-23
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P07.01.
Phase: P07 – Kalenderbewusste Planung aus beiden Quellen.

**Abhängigkeit:** P03.04, P05.03, P06.04. **Dateien:** `convex/planning/plans.ts`, `convex/planning/propose.ts`, `convex/planning/conflicts.ts`; Test `convex/planning/plans.test.ts`.

- Anzahl, Zeitraum, Account und Präferenzen als strukturierten Planauftrag erfassen.
- Kalender, relevante Arbeitssignale, Research und bisherige Inhalte zusammenführen.
- Themenmix, Wiederholungen, Gültigkeit und nutzerdefinierte Zeitfenster berücksichtigen.
- Für jedes Planelement Quellen, konkrete Entwurfsversion, Slot und Auswahlgrund speichern.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Plan kann ausschließlich aus Recherche, ausschließlich aus Arbeit oder gemischt entstehen.
- [ ] #2 Zu wenig geeignetes Material führt zu einem ehrlichen kleineren Plan und keiner beliebigen Auffüllung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read current editorial/time/source/Research/Ideas/Plans callers and reuse native seams; direct master with sole writer after reviewed42.
2. Persist bounded request count1..7, inclusive period≤93 civil days, account, captured actual preference ID/values, IANA zone, single daily user local time, source mode and immutable source/version/slot/reason/status. Scan latest25 indexed drafts with probe26 and visible partial coverage; no paid generator, filler, detached protected text or automatic handoff.
3. Define pure research/work/mix from exact current lineage; use supported immutable D08 assessment/current proof across intended instant, active disposition, account/media/capability. Diversity/exact version/source-family repeats only; unknown/expired material yields explicit shortage/review.
4. Share exact workspace/account/UTC occupancy with actual schedule/reschedule callers. Scheduled/publishing/partial/reconcile or confirmed/sending/unknown effects block even failed/cancelled; untouched cancelled may be free. Failclosed bound; no overwrite/autoshift/minimum-spacing inference. Shared DST resolver skips past/gap/ambiguous time with reason and retains original UTC/IANA/local.
5. Explicit live/Demo split; actual reactive guarded projections and awaited commands with pending/error/dirty form/current scope/expiry handling, exact pinned-version display, composer link. TASK25 separately owns approval and atomic selective acceptance; live Series remains visibly unavailable until46.
6. Native registered domain checks genuine RED→GREEN, affected styled browser with honest mocked transport qualification, sequential full/static/build/bundle/existing EU Dev. Freeze exact source/raw evidence/base IDs for ROOT scoped commit, fresh SPEC then QUALITY. Document inventory/recovery seams. Manual/provider/empirical Done remains open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /plans. Plan-request form for account, count, starting date/time, source mix and pillar; limited fixed proposals with source/rationale, smaller plan if material is insufficient. Grenze: No AI plan generation or live editorial-context analysis. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only future brief /tmp/dispatch-planning-implementation-brief.md covers separate24 and25 units after reviewed12/18/19/23. Reuse actual immutable editorial versions/approvals/schedules, source-bound proposals, chat and Research; no second calendar/content store. Require a concrete ROOT conflict/freshness policy before implementation, preserve established UTC/IANA/DST rules and existing entries, use honest smaller plans and actual source permissions, then selective idempotent acceptance with explicit version/account human approval. No24/25 code, pricing activation, provider call or acceptance in this preparation.

ROOT releases TASK-24 software implementation after reviewed TASK-42 at db58b6e; standing user authorization covers routine choices/direct master. Concrete authority: /tmp/dispatch-task24-release-contract.md8217B SHA f95811d1cae87b05b2c4fc951f5942ad778f0e0f0266170c33e93660625f3fdf and current-flow map19860B SHA7d7aca3e2b198e011172b1f7c03ad738f27acf14f7c0ba0415abf0d1b152da66. Fixed first release selects real current unplanned immutable drafts; no model generation or scheduling. Source-only modes/unknown proof/shortage explicit, latest25 ceiling/93days/count7/dailytime disclosed. Exact conflicts and all-or-none selected-set acceptance for separate25 are ROOT decisions. Existing preference has no immutable version; freeze actual record/values. Fresh sole writer/SPEC/QUALITY; actual external rights/customer/manual confirmation stay open.
<!-- SECTION:NOTES:END -->
