---
id: TASK-22.3
title: 'Recherchequalität und Angriffsresistenz evaluieren (P06.03, Teil 3)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 23:24'
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
- [ ] #1 Stichprobe enthält relevante, irrelevante, alte, widersprüchliche und bösartig instruierende Quellen.
- [ ] #2 Ausgaben referenzieren ausschließlich tatsächlich gelieferte Quellen; URLs und Trenddynamik werden nicht erfunden.
- [ ] #3 Ergebnisbericht weist Quellenrichtigkeit, Wiederholungen, Frische, Kosten und bekannte Grenzen aus.
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
<!-- SECTION:NOTES:END -->
