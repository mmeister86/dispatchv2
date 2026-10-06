---
id: TASK-28.3
title: >-
  Jev-Assessments versionsgebunden speichern und isoliert cachen (P08.02, Teil
  3)
status: In Progress
assignee: []
created_date: '2026-09-18 15:20'
updated_date: '2026-10-06 04:28'
labels:
  - p08
  - jev
  - teilpaket
  - r2
milestone: m-2
dependencies:
  - TASK-28.2
  - TASK-7
references:
  - .docs/JEV_INTEGRATION.md
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/decisions/release-scope.md
parent_task_id: TASK-28
priority: medium
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Verantwortung: Assessment-Schema und interne Mutations/Queries, Cache und Analyzer-Anbindung im Content-Modell. Den Schemaentwurf aus dem Leitfaden an die bestehenden Dispatch-Entitäten anpassen.

- Assessments an Workspace, Account, exakte Entwurfs-/Inhaltsversion, Netzwerk und Input-Fingerprint binden; postId allein reicht nicht. Provider, angefragtes/aufgelöstes Modell soweit verfügbar, Fragen-, Normalisierungs-, Profil-, Formel- und Policy-Version, Zeitstempel, Teilwerte, Confidence und Usage speichern.
- Cache-Key aus kanonisch serialisierten tatsächlich genutzten Inputs ableiten: Text, Netzwerk, Ziel, Audience, Account-Kontext und alle relevanten Versionen. Tenant-Isolation und Zugriffsprüfung gelten auch für Cache-Treffer; keine workspaceübergreifende Wiederverwendung privater Analysen.
- Kosmetische Whitespace-Änderungen nur normalisieren, soweit sie keine inhaltlich/strukturell bewertete Eigenschaft ändern. Strukturscore und semantische Analyse dürfen nicht durch ungeeignete Normalisierung stale werden.
- Veraltete und überholte Requests abbrechen, soweit unterstützt, andernfalls Ergebnisse zuverlässig verwerfen. Späte Antworten ersetzen keine aktuelle Analyse und erzeugen nach Löschung keine Daten neu.
- Im MVP nur normalisierte Ergebnisse und Metadaten persistieren. Optionales Debug-Raw-Logging explizit begrenzen, zugriffsschützen, zeitnah löschen und standardmäßig deaktivieren; keine zusätzlichen vollständigen Prompt-/Draft-Kopien im Normalbetrieb.

Quelle: .docs/JEV_INTEGRATION.md. Geplante Arbeit; Umsetzung im freigegebenen Release-Umfang. Keine Implementierung oder Providerfreigabe durch diese Backlog-Anpassung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Assessment-Abfragen und Cache-Treffer prüfen Workspace/Account und exakte Inhaltsversion; Tenant-Negativtests bestehen.
- [ ] #2 Gleiche relevante Inputs treffen den Cache; Änderungen an Netzwerk, Ziel, Audience, Account-Kontext oder relevanten Versionen invalidieren ihn.
- [ ] #3 Out-of-order-Antworten, Draft-Wechsel und Löschung können keine veralteten Ergebnisse als aktuell speichern oder gelöschte Daten reaktivieren.
- [ ] #4 Persistierte Metadaten erlauben historische Reproduktion; Analysefehler oder Cache-Ausfall blockieren manuelles Publishing nicht.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Consume the reviewed28.2 actual analyzer and exact saved-version/profile/source contracts.
2. Persist only normalized results and immutable reproducibility metadata with stable semantic identity distinct from physical requests.
3. Authorize before hits and atomically fence latest current writes; extend actual protected read/physical withdrawal cleanup without changing financial receipts.
4. Wire current/history analysis while manual publishing stays independent; prove tenant/cache/out-of-order/deletion boundaries.
5. Run full checks/existing EU Dev, freeze exact source and fresh SPEC then QUALITY; retain manual Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence. Mock analysis identity binds draft/account/version; edited content marks result stale; obsolete local timers are cancelled. Grenze: No backend assessment schema, tenant-isolated cache, production retention or historical reproduction. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

ROOT preparation only, implementation waits accepted28.2 actualresult/inputtypes. Readonly persistence map7655c2a9 reviewedfull; no currentassessment/cache/history backend. Stable semanticidentity excludes transientphysicalactor/opkey/deadline; exactsavedversion/tenant binding retained. Currentproof BEFORE hit andatomiclatewrite fence/derivedwithdrawalcleanup required; no2financialledger/rawpromptcopy. No manualDone/liveprovider/EU/humaneval acceptance.

Released after accepted28.2 actual analyzer SOURCE c2e81f7, fresh SPEC/QUALITY PASS. Consume actual four-field SDK state and returned normalized output; strip transient deterministic segment text before persistence. Exact saved-version/current source/profile proof, stable semantic identity distinct from physical attempts, authorization before cache and atomic latest/current writes; extend protected projection and physical cleanup while preserving financial receipts. One fresh sole writer, full checks/existingEUDev/browser/frozen source then fresh SPEC and QUALITY; no activation/manual Done.
<!-- SECTION:NOTES:END -->
