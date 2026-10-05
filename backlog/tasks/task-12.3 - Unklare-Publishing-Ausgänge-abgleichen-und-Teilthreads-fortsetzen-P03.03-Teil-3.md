---
id: TASK-12.3
title: >-
  Unklare Publishing-Ausgänge abgleichen und Teilthreads fortsetzen (P03.03,
  Teil 3)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 14:07'
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
- [x] #1 Transiente, permanente und unklare Ergebnisse sind getrennt; Provider-Hinweise begrenzen Backoff und Wiederaufnahme.
- [x] #2 Timeout nach möglichem Provider-Erfolg pausiert für Abgleich und löst keinen Blind-Retry aus.
- [x] #3 Gezielte Fortsetzung sendet nur fehlende Einzelposts; Abschluss enthält Inhaltssnapshot und externe Links.
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

Unabhängige SPEC initial FAIL auf b00093a: 71 registrierte Checks bestehen, fünf isolierte Negativprüfungen belegen vier Lücken (vollständige URL-Token statt Substring; immutableMedia-/SHA-/Namespace-Prüfung bei READ und Evidence-CAS; erreichbarer bestehender Abbruchbefehl für uncertain; historische Medien/Alt-Texte vor Calendar-Fortsetzung). Originalimplementer behebt alle Befunde und ergänzt permanente Regressionen; QUALITY wartet auf SPEC-Re-review-PASS. ROOT separat: alle 34 Playwright-Regressionsfälle auf b00093a bestehen (2,1 Minuten). Nachweis .docs/reviews/task-12.3-x-reconciliation-validation.md. Keine Live-/manuelle Abnahme, Task bleibt In Progress.

Korrektur-Freeze 59528b2: alle vier initialen SPEC-Befunde laut Implementer korrigiert; 186 Unit-Checks (74 X-Thread), Typprüfung, Formatierung, Build, Bundle, Diff und tatsächliche Composer-/Kalender-Fixture bestehen. Permanente Regressionen prüfen vollständige URL-Token, SHA-/Referenz-/Namespace-Drift vor/während GET, erreichbaren awaited unknown-Abbruch mit Fehler/Puffererhalt und historische Alt-Texte vor Calendar-Fortsetzung. EU-Dev final 15:32:11 aktiviert. Unabhängiges SPEC-Re-review und ROOTs gezielte Browserprüfung laufen; QUALITY/AC-Abhaken bleiben bis Review offen. Kein Done/Live-/manueller Nachweis.

Unabhängiges SPEC-Re-review PASS auf 59528b2: 76 registrierte X/UI-Checks, 13 Medienprüfungen, 13 isolierte Regressionen und tatsächlicher Composer-/Calendar-Fixture auf separatem Port 5186 bestehen. Alle vier ursprünglichen Befunde geschlossen; temporäre Repo-Dateien entfernt. ROOT zusätzlich pnpm test:x-thread auf korrigiertem Source PASS einschließlich historischer Calendar-Alt-Texte/unknown-Abbruch; 5174 frei und 5173 erhalten. Fresh unabhängiges QUALITY läuft. Kein Live-/manueller Nachweis und kein Done.

Fresh QUALITY NEEDS WORK auf 59528b2: kein Critical/Minor, ein Important P2. Drei registrierte Negativfälle zeigen, dass nach Watchdog-Pause ein spätes eindeutiges 201/429-Receipt zwar den Versuch auflöst, aber der normale Auftrag in reconciliation_required bleibt (Teilfortsetzung gesperrt bzw. vollständig bestätigter Thread nicht published). 76 X/UI-Checks und drei zusätzliche Credential-/Connection-/Workspace-CAS-Negatives bestehen. Originalimplementer korrigiert den gemeinsamen Übergang aus vollständiger begrenzter autoritativer Historie ohne automatischen Versand/Cap-Aktivierung; unknown/sending/abort bleiben erhalten. Danach SPEC-Delta- und QUALITY-Re-review. Kein Done/Live-/manueller Nachweis.

QUALITY-Korrektur a4396d3: 197 Unit-Checks, alle weiteren Checks und tatsächliche UI-Fixture bestehen; EU-Dev 15:45:32. ROOT gezielte Fixture separat PASS. SPEC-Delta: Backend 87 registrierte und 12 isolierte Checks bestehen inkl. aller drei QUALITY-Repros; ein P2-UI-Restfall: cached-confirm priorisiert alten Kandidaten999 statt gespeicherter ID125 und trifft korrekt X_POST_CHECKPOINT_CONFLICT. Originalimplementer korrigiert ausschließlich Auswahl gespeicherter ID für diesen Befehl, hält unknown-Eingabepuffer/Backendguards und ergänzt permanente Browserregression. Danach SPEC- und QUALITY-Re-review; weiterhin kein Done/Live-/manueller Nachweis.

Tiny UI-Korrektur 752c522: gespeicherte Bestätigung übergibt ausdrücklich gespeicherte externalId; unknown-Kandidatenpuffer unverändert, keine Backend-/API-Änderung. Permanente tatsächliche Calendar-Regressionsprüfung RED (send999) → GREEN (send125/published); UI2-Checks, tatsächliche Fixture, Type/Format/Build/Bundle/Diff bestehen. Vorheriger 197-Unit-Nachweis gilt für unverändertes Backend. EU-Dev 15:50:53. Unabhängiges SPEC-Delta-Re-review läuft; ursprüngliches QUALITY-Re-review danach. Kein Done/Live-/manueller Nachweis.

SPEC-Delta PASS752c522 (ursprüngliche Browserreproduktion, UI2/diff). QUALITY-Re-review schließt ursprüngliche drei Late-Receipt-Befunde; 93 registrierte/originale Checks und 13 zusätzliche Negatives bestehen. Neuer ImportantP2-Kompatibilitätsfall: retained cancelled ohne optionale abort-Auditfelder wird durch gespeicherte Bestätigung zu partial und danach fortgesetzt. Originalimplementer erhält cancelled/published als terminale Autorität ohne erfundene Auditdaten; gezielter nativer Workspace-/Account-/Attemptstate-Index sperrt historische unknown/sending vor neuer first-write Erzeugung ohne broad Scan. Permanente Legacy-/Terminal-Regressionsprüfungen und Re-Reviews stehen aus. Weiterhin kein Done/Live-/manueller Nachweis.

Terminal-Korrektur-Freeze 7734008: cancelled/published bleiben nach vollständiger begrenzter Prefix-/History-Prüfung terminal, auch ohne optionale Auditfelder; unresolved Effects separat erhalten. Konkreter nativer Attempt-Index by_workspaceId_and_accountId_and_stage mit zwei first()-Abfragen hält unknown/sending-Kontosperren auch bei älteren cancelled-Zeilen. Keine erfundenen Auditdaten, kein Flag/Service/Scan. Vier permanente RED→GREEN-Regressionen; Implementer 201 Unit-Checks (89 X-thread), Type/Format/Build/Bundle/Diff PASS. Codegen-Analyse separat PASS, bestehende EU-Dev 16:01:05 aktiviert. SPEC-Delta und ursprüngliches QUALITY-Re-review ausstehend; AC/Done weiterhin offen. Keine Live-/manuelle Abnahme.

Finales SPEC-Delta PASS7734008: unabhängig 91 gezielte registrierte X/UI-Prüfungen, drei isolierte Terminal-/History-Negatives und Diff PASS. Terminalautorität, separate unresolved-Effects-/Account-/Fehlerbarrieren, zwei exakte indexed first()-Reads und vorherige Strict-Evidence-/Source-CAS-/Consent-/UI-Korrekturen bestätigt; keine Auditdaten erfunden. Ursprüngliches QUALITY-Re-review läuft; weiterhin keine manuelle/Live-Abnahme oder Done.

Final7734008 unabhängig SPEC und QUALITY PASS; keine verbleibenden Critical/Important/Minor-Befunde. QUALITY 91 registrierte X/UI-Checks plus gespeicherte14-Check-Reproduktion und finales16/16-Negativpaket einschließlich unknown/sending-Kontosperren vor tatsächlichem READ sowie separater neuer Proof-Erstellung danach. Vollständige begrenzte Historie/Prefix bleibt Voraussetzung, cancelled/published terminal, keine erfundenen Auditdaten/Cap-Proof/POSTs. Implementer201gesamt; vorherige ROOT34-Browserbaseline und betroffene tatsächliche Fixture bestehen. AC1–3 isoliert in Code/Tests verifiziert; Nachweis .docs/reviews/task-12.3-x-reconciliation-validation.md. Authentifizierte manuelle J02/J08, tatsächlicher Provider/EU-R2/Runtime/Kosten und ausdrückliche Done-Bestätigung bleiben offen. Status In Progress.
<!-- SECTION:NOTES:END -->
