---
id: TASK-28.3
title: >-
  Jev-Assessments versionsgebunden speichern und isoliert cachen (P08.02, Teil
  3)
status: In Progress
assignee: []
created_date: '2026-09-18 15:20'
updated_date: '2026-10-04 19:25'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence. Mock analysis identity binds draft/account/version; edited content marks result stale; obsolete local timers are cancelled. Grenze: No backend assessment schema, tenant-isolated cache, production retention or historical reproduction. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
