---
id: TASK-32.1
title: Zeige den tatsächlichen Cloud-Benachrichtigungsumfang
status: In Progress
assignee: []
created_date: '2026-10-07 21:03'
updated_date: '2026-10-07 21:12'
labels: []
dependencies: []
parent_task_id: TASK-32
priority: medium
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nach TASK-31.1 die Cloud-Einstellungen von rein lokalen Demo-Präferenzen trennen und mehrdeutige historische Publishing-Transportzustände ehrlich beschreiben. Vorhandenen Pflicht-Inbox-Fluss erhalten; keine Zukunftspräferenzen, neue API oder Provideraktivierung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cloud zeigt optionale Zusammenfassungen und Ruhezeiten als nicht verfügbar ohne lokale oder native Speicherung; Demo-Verhalten bleibt erhalten.
- [x] #2 Vorhandene Pflichtmeldungen und Empfänger-Inbox bleiben nutzbar; historische blocked/sent-Zustände werden nicht als physisch fehlgeschlagene oder bestätigte Zustellung dargestellt.
- [x] #3 Bestehende mounted Browser-Prüfung deckt Cloud/Demo, Rollen, 1280/390 und fehlende Writes/Provideraufrufe ab; TypeScript, Format und Build bestehen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Technische Prüfung dokumentiert; Task bleibt bis ausdrücklicher manueller Nutzerbestätigung In Progress.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Vorhandene Cloud/Demo-Settings und Publishing-Statusprojektion abgleichen.
2. Ausschließlich Settings.tsx und Overview.tsx minimal korrigieren; vorhandenen Browser-Harness erweitern.
3. Fokussierte Browser-/Type-/Format-/Build-Prüfung und unabhängige Review; Commit und offene manuelle Abnahme dokumentieren.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Source paused exact3files: Settings.tsx/Overview.tsx/existing operations.browser.mjs. Actual prior Cloud route was generic EmptyState; new explicit Cloud branch static OFF/unavailable, no preference hook/storage/API. Original Demo body byte-identical;43 prior mountedHealth assertion calls preserved,24 added. Writer AppTSC/ownedformat/diff/Vitebuild and styledAppStore1280/390browser PASS, all4Cloudroles/Demo persistence/Viewer/existingInbox/no writes/providers/errors. Root verified343 source/hash logs/screenshots;340 protected inclbackend/generated unchanged. Final1freeze a8b6e42960b6ea58bd8a1c8d79c1e87948ba9894f09d89c54473bbb7cca03f16; freshreadonlySPEC dispatched; distinctQUALITY/Rootappropriate5static/commit/manualacceptance pending. No freshfullnative/codegen/Dev warranted for unchanged backend; no claims thereof.

FreshSPEC97946b8 and subsequent distinctQUALITYfb6e6c1 scopedPASS, each actual1280/390mountedAppStoreCSSbrowser/all4Cloudroles/Demo/inbox/transport semantics/oldHealth, provider/errors[]. Root5UIstatic PASS, all343 frozen hashes unchanged,340 protected inclbackend/native/generated exact. Source-only commit670e234aca44a9dcabf44fb7b5fe41e39b3022c3 exactly3paths. Persistent validation/reviews retained; old1459/57/EUDev456 is unchanged-backend evidence, no freshnative/codegen/deployment claim. TechnicalAC1–3/DoD1checked; In Progress/manualDoD2 and Parent32 remainopen.
<!-- SECTION:NOTES:END -->
