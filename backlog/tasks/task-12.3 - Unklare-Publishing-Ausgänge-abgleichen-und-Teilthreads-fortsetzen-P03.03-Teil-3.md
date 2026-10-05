---
id: TASK-12.3
title: >-
  Unklare Publishing-Ausgänge abgleichen und Teilthreads fortsetzen (P03.03,
  Teil 3)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 13:23'
labels:
  - p03
  - r1
  - teilpaket
milestone: m-1
dependencies:
  - TASK-12.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-12
priority: high
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P03.03. Verantwortung: convex/publishing/reconcile.ts und workflows.test.ts; Recovery und Fehlerklassifikation.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P03.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Transiente, permanente und unklare Ergebnisse sind getrennt; Provider-Hinweise begrenzen Backoff und Wiederaufnahme.
- [ ] #2 Timeout nach möglichem Provider-Erfolg pausiert für Abgleich und löst keinen Blind-Retry aus.
- [ ] #3 Gezielte Fortsetzung sendet nur fehlende Einzelposts; Abschluss enthält Inhaltssnapshot und externe Links.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse final reviewed TASK12.2 checkpoint engine, OAuth/media guards and current primary lookup contract; begin only after SPEC and QUALITY PASS.
2. Add bounded Owner/Admin candidate-ID lookup with strict author/text/parent/media/time evidence, CAS receipts and visible read backoff; absence never means unsent and lookup never grants write capability.
3. Require separate human continuation consent for the same immutable version/provider identity; advance generation while preserving confirmed prefix and unresolved barriers, including persistent abort requests.
4. Wire real Drafts/Calendar reconciliation, exact snapshots/links and awaited errors without losing buffers.
5. Test strict positive/negative evidence, cancellation/late receipts, new-generation missing-only continuation and actual UI; full checks, existing Dev, scoped commits and independent SPEC then QUALITY.
6. Record inventory and live/manual gates; do not mark Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /calendar?view=agenda. Uncertain outcomes require explicit mock reconciliation; partial/failed snapshots have continuation and snapshot review controls. Grenze: No provider reconciliation, real retry/backoff or remote duplicate-prevention evidence. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Preparation only while TASK12.2 QUALITY cancellation correction is pending. Root candidate-ID lookup is the minimum sufficient reconciliation path; no automatic timeline collector or speculative provider abstraction. Current docs receipt /tmp/dispatch-x-reconciliation-current-docs.md (Context7 library-first3commands plus current primary schema); final implementation brief /tmp/dispatch-x-reconciliation-implementation-brief.md. Actual final12.2 hash/abort-field receipt will be supplied after both reviews PASS. No implementation/provider call or acceptance claimed.

Fresh SDD implementation begins after TASK12.2 final eddf1a2 independent SPEC/QUALITY PASS. Concrete final engine/optional abortRequestedAt/By and cross-generation evidence documented in .docs/x-thread-publishing-contract.md; root full brief /tmp/dispatch-x-reconciliation-implementation-brief.md. Scope candidate-ID verified read-only reconciliation, explicit same-snapshot missing-only continuation/new generation/realUI, positive evidence never grants write capability and abort never cleared to resend. No live provider action or manual acceptance authorized by these synthetic checks.

Delegated root continuation clarification in .docs/decisions/first-write-verification.md: ordinary partial after same-identity reconnect may have capfalse while partial accountBarrier blocks separate proof. Concrete continueThread may obtain fresh exact immutableversion/providerIdentity/prefix OwnerAdmin approval plus separate visible-post ack and new persisted bounded first_write_verification purpose for definitelyunsent positions only. Unknown/sending/abort/differentidentity block; normalcalendar guards unchanged, no generic bypass; READmatch nevercapProof. Required regression ordinarypartial->reconnect->freshconsent->onlymissingactualPOSTproof. Documentation/codegen clarification: installedConvex1.46 codegen uploads analysis/types without finishPush/runtime activation; existingDevonce follows fullchecks.

Implementer-Zwischenstand: 177 Unit-Checks, Typprüfung und tatsächliche Composer-/Kalender-Fixture bestehen; Fixture-Port 5174 ist wieder frei. Selbstreview ergänzt vor Freeze eine konkrete aktuelle Owner/Admin-finalizeAbort-CAS für bereits eindeutig abgelehnte oder bestätigte Outcomes ohne Kandidaten-ID. Unklare/sending Outcomes einschließlich alter Generationen bleiben gesperrt; Abort-Flag wird niemals gelöscht. Abschließende Gesamttests und unabhängige SPEC/QUALITY stehen noch aus. Keine Live-Provider- oder manuelle Abnahme.

Code-Freeze b00093a (Backend 0b5f7cc, UI/Contract b00093a): 181 Unit-Checks, Typprüfung, Formatierung, Build, Bundle- und Diff-Prüfung bestehen; tatsächlicher Composer-/Kalender-Browsertest umfasst Backoff-Timer, Puffererhalt, explizite Fortsetzung und ID-freien bekannten Abort-Abschluss. Bestehende EU-Dev final um 15:21:29 aktiviert, Codegen-Analyse davon getrennt. Unabhängige SPEC-Prüfung und ROOT-Gesamtbrowserregression laufen; QUALITY folgt erst nach SPEC-PASS. AC/Done bleiben bis verifizierten Reviews bzw. manueller Nutzerbestätigung offen. Keine Live-Provideraktionen.
<!-- SECTION:NOTES:END -->
