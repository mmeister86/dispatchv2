---
id: TASK-32.4
title: Zeige eigene Publishing-Fehler im persönlichen Posteingang
status: In Progress
assignee: []
created_date: '2026-10-07 22:52'
updated_date: '2026-10-07 23:16'
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
- [ ] #1 Neue Fehler werden bei tatsächlichen bestehenden First-Failure-Pfaden einmal pro Original-Schedule/Generation/Empfänger gebunden; Replay und Fortsetzung ändern keine ursprünglichen Header oder Lesestände und aktivieren keine Mail.
- [ ] #2 Begrenzte native Anzeige und eigene Read/Dismiss-Mutationen prüfen aktuellen verifizierten Empfänger, Workspace, originale Inhalte und Quellen vor sichtbaren Daten oder Writes; keine Admin-Mailbox-Ausnahme oder erfundenen Gesamtsummen.
- [ ] #3 Bestehende Quellen-/Actor-/Versions-Cleanup-Seams bereinigen die Präsentation fortsetzbar auch bei fehlenden Wurzeln; terminale Dedupe-Fakten und echte unbekannte/verspätete Publishing-Effekte bleiben korrekt.
- [ ] #4 Bestehender Drawer zeigt die neue Familie mit sicheren Links und ehrlicher geladener Abdeckung; native Isolation/Replay/Late-Receipt/Cleanup und tatsächlicher styled Browser sowie frische Reviews und Root-Gates sind belegt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Alle technischen ACs sind überprüft, der konkrete Stand committed und erforderliche Dev-Synchronisierung dokumentiert.
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
<!-- SECTION:NOTES:END -->
