---
id: TASK-43.1
title: >-
  Zulässige Lernziele und zeitlich getrennte Referenzdaten definieren (P11.03,
  Teil 1)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 12:22'
labels:
  - p11
  - r5
  - teilpaket
  - jev
milestone: m-5
dependencies:
  - TASK-42
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-43
priority: medium
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P11.03. Verantwortung: convex/performance/calibration.ts und tests/evals/calibration/; Datenvertrag.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P11.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Referenzdaten binden normalisierte Performance an das Assessment zum Veröffentlichungszeitpunkt. Netzwerk, Account, Fragen-/Modell-/Formelversion und Messfenster erhalten; nicht vergleichbare Versionsstände getrennt auswerten. Nur zulässige kontrollierte/anonymisierte Daten verwenden; Lernziel ist die Kalibrierung von Dispatch, nicht das Training von Jev.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Lernziele unterscheiden messbare Outcomes von Content-Heuristiken; der konkrete Verwendungszweck ist freigegeben.
- [x] #2 Datensplits enthalten keine zukünftigen Messwerte in Trainingsbeispielen.
- [x] #3 Mindestdaten, kleine Segmente, Drift und fehlende Werte sind als dokumentierte Eingangstore behandelt.
- [x] #4 Datensatz und zeitliche Splits schließen rückwirkende Scores sowie künftige Outcomes als damalige Eingaben aus und trennen inkompatible Versionen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace existing normalized snapshot/assessment retention, publication knowledge and real Operations route; use exact ROOT .docs/calibration-reference-contract.md after accepted TASK25.
2. Implement two typed purpose/reference tables, separate default-OFF local-learning consent/revocation and immutable server-derived account/version/model/question/formula scoped specifications. Preserve original semantic results and existing retained-read helper callers.
3. Build bounded native prepublication assessment plus 24h reply/impression references with exact temporal provenance, chronological train/two holdout blocks, 200-attempt frame plus 201st sentinel, explicit missing/incompatible/expired exclusions and original/current minimum retention. Candidate remains not frozen; all activation ineligible.
4. Connect actual styled Operations calibration and existing IntelligenceProfiles; retain local simulations only behind Demo boundary. Actual protected server reference options, current Owner/Admin consent, pending/error/role/scope/expiry guards, useful missing-configuration guidance.
5. Verify meaningful registered native temporal/rights/retention/dedup/bounds tests, affected real styled browser plus Demo/route guard; freeze actual source/body/config/runner before executions, preserve failures, run full/static/build/bundle/codegen and configured EU Dev --once.
6. ROOT scoped source commit after evidence reading, fresh SPEC then QUALITY; actual lawful consent, empirical adequacy, live/manual acceptance and Done remain open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ROOT releases TASK43.1 software scope after accepting TASK25 c2bfc4a under standing user project-decision authorization; TASK42 dependency software accepted, manual statuses remain open. Exact engineering contract: .docs/calibration-reference-contract.md. First purpose dispatch-local-reply-ordering-v1: independent complete single TEXT X posts, measured reply events/impressions at24h ±60s, one exact account/analysis stratum. This selects an engineering purpose, grants no actual data rights and enables no provider/model. 30 independent posts/28days is only an unvalidated engineering screen; empirical policy remains UNSET. No training/activation in43.1. Separate actual Owner/Admin consent default OFF, preserved source/metric rights, bounded cleanup and original horizons. ROOT owns all docs/Backlog metadata; fresh sole writer receives exact13 SOURCE ownership; no Done without manual human confirmation.

Scoped software accepted at e5bae9cf after fresh SPEC2 and QUALITY2 original native controls; native23/full827/45, types/build/bundle/scopedformat and configured existing EU Dev ready UTC12:06:09. Exact13source/frozen/commit hashes and58 writer receipts/2822 copies verified. Backend/full receipts precede only later UI classes/planning log/browser assertions; final affected UI checks pass, qualified in .docs/reviews/task-43.1-calibration-reference-validation.md. Independent review fixtures reuse corpus helpers, no actual rights/empirical certificate. AC2/3/4 checked SOFTWARE ONLY; AC1 real lawful-purpose/manual evidence and both manual DoD remain OPEN; status In Progress, no Done. Next43.2 has separate ROOT contract, no activation43.1.
<!-- SECTION:NOTES:END -->
