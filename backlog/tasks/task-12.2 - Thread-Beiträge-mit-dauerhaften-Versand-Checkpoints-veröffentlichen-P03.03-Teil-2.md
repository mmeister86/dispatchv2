---
id: TASK-12.2
title: >-
  Thread-Beiträge mit dauerhaften Versand-Checkpoints veröffentlichen (P03.03,
  Teil 2)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 12:17'
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
<!-- SECTION:NOTES:END -->
