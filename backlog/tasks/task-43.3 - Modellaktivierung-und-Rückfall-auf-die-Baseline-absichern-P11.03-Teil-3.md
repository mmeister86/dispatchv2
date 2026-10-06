---
id: TASK-43.3
title: 'Modellaktivierung und Rückfall auf die Baseline absichern (P11.03, Teil 3)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 13:28'
labels:
  - p11
  - r5
  - teilpaket
  - jev
milestone: m-5
dependencies:
  - TASK-43.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-43
priority: medium
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P11.03. Verantwortung: convex/performance/models.ts; Aktivierung, Geltungsbereich und Rollback.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P11.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Scoregewichte und Routing-/Verifier-Policies getrennt versionieren und nur für belegte Workspaces/Accounts/Netzwerke aktivieren. Rollback stellt eine konkrete Baseline wieder her; gespeicherte Assessments behalten ursprüngliche Semantik und Ergebniswerte. Jev kann weder Aktivierung noch Gewichte selbst verändern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Nur dokumentiert verbesserte und freigegebene Modellversionen werden für ihren belegten Geltungsbereich aktiviert.
- [ ] #2 Rollback und Fallback auf statische Baseline funktionieren bei Fehlern oder Drift.
- [ ] #3 Historische Predictions behalten ihre Profil-/Modellreferenzen; Aktivierungs- und Rücknahmetests bestehen.
- [ ] #4 Rollback von Gewichtung und Entscheidungsschwellen ist geprüft, ohne historische Assessments umzuberechnen oder ihren ursprünglichen Versionsstand zu verlieren.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. After independent43.2 acceptance, implement .docs/calibration-activation-contract.md using existing native models and ONE fixed mature block1 monitoring checkpoint; no initial permission or empirical defaults.
2. Add exact Owner/CAS/replay activation and rollback, current projection through a capped native internal query, immutable beforeSend pin and bounded protected retention cleanup.
3. Wire real Operations and separate saved-assessment projection with explicit configuration, expiry, pending and errors; single measured checkpoint, finite approval, no continuous drift claim.
4. Verify genuine supported native qualification, monitor chronology/current rights/D-F deadlines/unusedblock2, actual beforeSend candidate/static capacity fallback, historical invariance and cleanup; full/type/format/build/bundle/existing Dev.
5. Scoped master commits and fresh SPEC then separate QUALITY; actual policies/rights/live/manual/Done remain open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /operations — Shadow-Kalibrierung. Explicit local candidate activation and rollback with recorded version labels. Grenze: No production model activation, historical assessment migration or actual model fallback. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

ROOT releases scoped engineering after independently accepted43.2 source21ccb0e. .docs/calibration-activation-contract.md is authoritative; /tmp/dispatch-continuation-43.3-design.md provides traced seams and native child-limit mechanism proof. Two fixed monitoring blocks, NO initial-use permission, static before mature first pass; original policy values remain UNSET and old retention cannot extend. Native internal query boundary avoids circular source extraction/cache abstractions. Actual Owner/policy/rights/live/manual/Done remain separate.

2026-10-06 timing refinement: actual snapshots.begin forbids collection beforeconfirmedAt+24h. Negative24h-minus-tolerance fixtures would be unreachable. Original28-day publication span/24h maturity and30-day numeric retention normally leave <2d; <=60s positive confirmation delay can give incidental slack, so universal impossibility was not claimed. ROOT chooses ONE mature block1 checkpoint with D<F<=unusedblock2Start and original horizons; no phase/second-continuity branch/initialpermission. Existing native secondblock vocabulary grants no authority. This fully scoped finite drift/expiry/rollback contract is simpler and reachable without altering original retention; writer informed before verifying two-checkpoint branches.

Root-Fortsetzungsprüfung vor Freeze: native positive Kandidatenbindung/beforeSend und echter160-Query-Child-Fallback bestehen laut Writer. Optionaler assessments.get-Child erhält ebenfalls aktuelle transactionLimits. Operations erhält direkte Owner-Deklaration mit leeren Pflichtfeldern statt bloßer Konfigurationsanweisung. Bestätigter Lifecycle-Fehler: Sweep durfte deklarierte/finale Einmal-Sperren nicht durch Löschen freigeben, solange passiver Originalkandidat gültig bleibt; sonst Rollenentzug/Wiederherstellung ermöglicht Ersatzversuch. Writer ersetzt geschützte Deklarations-/Check-Daten durch minimale scoped spent-ID-Marker in vorhandener Tabelle bis Originalkandidatenfrist und ergänzt native Gegenproben. Vertrag .docs/calibration-activation-contract.md präzisiert. Noch kein Freeze, keine frischen SPEC/QUALITY, keine AC-/Done-Abnahme.
<!-- SECTION:NOTES:END -->
