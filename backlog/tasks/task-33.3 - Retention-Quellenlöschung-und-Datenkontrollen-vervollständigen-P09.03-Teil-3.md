---
id: TASK-33.3
title: >-
  Retention, Quellenlöschung und Datenkontrollen vervollständigen (P09.03, Teil
  3)
status: Done
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-12'
labels:
  - p09
  - r3
  - teilpaket
  - jev
milestone: m-3
dependencies:
  - TASK-33.2
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-33
priority: medium
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P09.03. Verantwortung: convex/operations/retention.ts und src/features/settings/data-controls.tsx.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P09.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Explizite Retention für Assessments, Cache, Usage, kontrollierte Evaluation und optional kurzlebige Debug-Rohantworten festlegen; Debug-Speicherung standardmäßig deaktivieren. Quellenlöschung/Widerruf bis in abgeleitete Analysen und Cache propagieren. Provider-Retention und Grenzen gegenüber lokaler Löschung verständlich dokumentieren.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Workflow-Journale, Agent-Komponentendaten und temporäre/verwaiste R2-Objekte besitzen explizite Bereinigung nach gesicherten Publishing-Nachweisen.
- [x] #2 Provider-Entfernungen propagieren durch Quellenkopien, Caches und Agent-Kontexte; Restore/Replay reaktiviert keine gesperrte Evidenz.
- [x] #3 UI erklärt Export/Löschfortschritt, Backups, Provider-Kopien, Integrationsentfernung und öffentliche Posts; Lifecycle-Tests bestehen.
- [x] #4 Retention-/Replay-Prüfungen schließen Jev-Daten ein; abgelaufene Debug-Rohantworten werden entfernt und gesperrte Quellen nicht durch Cache/Restore reaktiviert.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [x] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/data, /settings/sources. Retention configuration and explanations distinguishing local deletion, integration removal and public posts; source removal local control. Grenze: No automatic retention, backup restore or propagated provider-source deletion. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

2026-10-09: Nutzer bestätigt 30 Tage als gewünschte Aufbewahrung. Umsetzung nutzt eine unverlängerbare betriebliche Obergrenze mit früherem Quellenwiderruf/-ablauf und Löschung. Inhaltsfreie Sperren für ungeklärte externe Effekte, offene Abrechnung und noch gültige Upload-/Replay-Risiken bleiben bis zum sicheren Abgleich; keine gesetzliche oder fremde Provider-/Backup-Frist erfunden. Inventarentscheidung aktualisiert, technische Retention noch in Umsetzung.

2026-10-10: Source-loss-/Retention-Hooks, bounded sweep, native Agent/Workflow-Restbereinigung einschließlich _storage umgesetzt. Betriebliche Ausführung/Diagnose30Tage; gespeicherte Business-/Kalibrierungsnachweise behalten originale zweckgebundene Fristen. Kürzere Quellenfrist hat Vorrang, minimale Replay/Settlement-Barrieren bleiben bis sicherem Abgleich. UI erklärt Provider-Kopien/Backups/öffentliche Posts. Manuelle Abnahme offen.

2026-10-12: Auf ausdrückliche Nutzeranweisung geschlossen; technische ACs belegt, frische gezielte Retention-Tests 10/10 PASS. Manuelles Done per Nutzerbestätigung 2026-10-12.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Quellenverlust und betriebliche Retention propagieren über Caches, Run-/Chat-/Research-Kopien, Jev-Operationaldaten sowie native Agent/Workflow-Komponenten. Gepinnte scoped Patches erfassen Datei-Claims vor Parentverlust, entfernen exakt zugeordnete Storage-Bytes und scoped residuals; Cron heilt wiederhergestellte Cleanup-Header. Operative30-Tage-Frist verlängert keine kürzere Quellenfrist und deaktiviert keine zweckgebundene gespeicherte Kalibrierung. UI erklärt Fortschritt/Retry, Provider-Kopien/Backups und öffentliche Posts. Finale Integration506/506 plus Browser/Typecheck/Build bestanden. Kein Live-Provider-/Backup-Erasure-Nachweis; manuelle Abnahme offen.
<!-- SECTION:FINAL_SUMMARY:END -->
