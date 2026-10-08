---
id: TASK-32.4
title: Zeige eigene Publishing-Fehler im persönlichen Posteingang
status: In Progress
assignee: []
created_date: '2026-10-07 22:52'
updated_date: '2026-10-08 05:30'
labels: []
dependencies: []
parent_task_id: TASK-32
priority: high
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ergänze den vorhandenen persönlichen nativen Posteingang um neue exakt generationgebundene Publishing-Fehler aus der vorhandenen publishingNotifications-Tabelle. Originale Quellenbindungen und Empfängerrechte werden vor Anzeige, Lesen und Ausblenden geprüft; optionale Mail bleibt ausgeschaltet. Vorhandene Effect-Belege und Legacy-Zeilen werden erhalten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Neue Fehler werden bei tatsächlichen bestehenden First-Failure-Pfaden einmal pro Original-Schedule/Generation/Empfänger gebunden; Replay und Fortsetzung ändern keine ursprünglichen Header oder Lesestände und aktivieren keine Mail.
- [x] #2 Begrenzte native Anzeige und eigene Read/Dismiss-Mutationen prüfen aktuellen verifizierten Empfänger, Workspace, originale Inhalte und Quellen vor sichtbaren Daten oder Writes; keine Admin-Mailbox-Ausnahme oder erfundenen Gesamtsummen.
- [x] #3 Bestehende Quellen-/Actor-/Versions-Cleanup-Seams bereinigen die Präsentation fortsetzbar auch bei fehlenden Wurzeln; terminale Dedupe-Fakten und echte unbekannte/verspätete Publishing-Effekte bleiben korrekt.
- [x] #4 Bestehender Drawer zeigt die neue Familie mit sicheren Links und ehrlicher geladener Abdeckung; native Isolation/Replay/Late-Receipt/Cleanup und tatsächlicher styled Browser sowie frische Reviews und Root-Gates sind belegt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Alle technischen ACs sind überprüft, der konkrete Stand committed und erforderliche Dev-Synchronisierung dokumentiert.
- [ ] #2 Der Nutzer hat nach eigener Prüfung ausdrücklich bestätigt, dass dieser Task als Done markiert werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Gegen vorhandene First-Failure-Producer, native Receipt/Continuation und persönlichen Drawer konkret planen; reale Quellenverlust- und Cleanup-Seams vor neuen Datenkanten klären.
2. Nach akzeptierter32.3 eine eng begrenzte Sourcefreigabe und Tests erstellen; bestehenden Fehlerbeleg und vorhandene Quellenprüfer wiederverwenden.
3. Neue Familie mit ursprünglichem Empfänger und Generation im bestehenden Posteingang anbinden, Cleanup und terminale Replay-Fakten erhalten.
4. Pausierter Source, frische SPEC und getrennte QUALITY, angemessene Native/Static/Browser-Gates und exaktes bestehendes EUDev; manuelle Done-Abnahme offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-only Grundlage: /tmp/dispatch-32-publishing-inbox-next-audit.md auf akzeptiertem4a22190. Noch keine Sourcefreigabe oder Umsetzung;32.3 befindet sich im finalen Gesamtcheck. Optionaler Versand wird weder aktiviert noch an Präferenzen gekoppelt.

Sourcefreigabe nach technisch akzeptierter32.3 cb5f5ef: .docs/reviews/task-32.4-publishing-inbox-source-release.md. Ein Writer besitzt neun Pfade; Geburt nutzt ursprünglichen Schedule-Pin statt erneuter Sendefreigabe. Editorial.resources behält explizit ursprünglichen Transportvertrag und zeigt keine neuen privaten Bindungen. Frische Reviews/Gates/Dev und manuelle Abnahme stehen noch aus.

Erster pausierter Handoff:180/4 native und styled Browser206 mit171 Originalprüfungen erhalten. Root-Screenshot/Caller-Review findet bestehenden global beschrifteten Read-Button in App.tsx, dessen Handler nur lokale issues markiert. Enger zusätzlicher Scope: nur diesen Button auf Cloud-lokale Publishing-Ausgabe begrenzen, Demo unverändert; neue spezifische Browserprüfung. Nun10 Pfade/338 geschützte alte Nongens. Kein neuer globaler Native-Mark-all. Finaler Freeze/Reviews/Dev bleiben offen.

Root FINAL2-Freeze /tmp/dispatch-32.4-final2-freeze.json SHA1d3cb5100c0853e2a7d052c2c2b7d16dd7d114d6584d6bbbddc27bbfb111d4c2 auf bced265:353 Source,10 owned,338 originale nongenerated exakt. Guarded final2 Codegen PASS9.49s ohne Delta;7 Root-Static-Gates PASS.180/4 gezielte Native und207 actual styled Browser Assertions belegt;171 Originale unverändert. Ganze Native-Suite und frische unabhängige SPEC/QUALITY laufen/pending; noch keine Source-/Dev-Akzeptanz, kein manuelles Done.

FINAL2 SPEC reproduziert echten UI-Fehler: pending Read nach Quellenablauf lässt shared useNativeCommand ticket/busy stehen und sperrt eine neue gültige Episode. Root Whole-Native vor Reparatur mit130 unterbrochen, kein PASS; Nachweis /tmp/dispatch-32.4-final2-native-interrupted-receipt.json. Minimale gemeinsame Hook-Korrektur und dauerhafte kombinierte Browserkontrolle freigegeben; FINAL3-Freeze/frische Reviews/Root-Gates/Dev erforderlich.

Unabhängiger nativer Cleanup-RED bestätigt:25 echte Failure-Episoden mit gültiger20-stufiger Notizquellenkette, tiefster Owner archiviert;cleanupVersion wirft NOTICE_READ_LIMIT und rollback lässt25 Präsentationen stehen (1650 Reads,598050Bytes). Minimale Korrektur freigegeben:1 Parent pro Cleanup-Transaction/native Cursor+Plattformlimits statt öffentlichem640-Samplinglimit; öffentliche25er API bleibt begrenzt. Dauerhafter Test muss alle geplanten Continuations vollständig drainen und Transportidentitäten bewahren; frische Abnahme folgt erst nach GREEN.

FINAL3 technisch akzeptiert: Source0bdd9e4, Root1506/61 native PASS +7 statische Gates,211 styled Browser mit171 Originalen, frische SPEC und getrennte QUALITY PASS. Beide reproduzierten Hook-/Deep-Cleanup-Defekte mit dauerhaften Kontrollen behoben. Exaktes bestehendesEUDev08.10.2026 05:29:45UTC:468 Entries/+7, sämtliche461 Altverträge und5HTTP unverändert,353 Sourcehashes unverändert. Bericht .docs/reviews/task-32.4-validation.md. AC1–4/DoD1 geprüft; manuelle DoD2/Done bleiben offen.
<!-- SECTION:NOTES:END -->
