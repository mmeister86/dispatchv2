---
id: TASK-33.1.1
title: Ermögliche den Export eigener Profilangaben
status: Done
assignee: []
created_date: '2026-10-07 21:32'
updated_date: '2026-10-12'
labels: []
dependencies: []
references:
  - .docs/reviews/task-33.1-first-unit-yagni-critique.md
  - .docs/reviews/task-33.1-export-request-scope-reconciliation.md
parent_task_id: TASK-33.1
priority: medium
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Erste bewusst begrenzte native Export-Einheit: aktuell autorisierte eigene Profilangaben des ausgewählten aktiven Workspaces als JSON herunterladen. Bestehende Auth-/Workspace-/Preference-Helfer nutzen; keine Export-Jobs, Chunks, neue Tabellen oder Provider. Vollständiger Workspace-/Komponentenexport bleibt gesondert offen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Verifizierter aktueller Actor mit gültiger nativer Session exportiert nur eigenes Profil und ausgewählten aktiven Workspace-Kontext; Owner/Admin/Editor/Viewer erhalten gleiche Self-Rechte. Fremde Actors/Workspace-IDs, fehlende Profile und inaktive Workspaces werden abgewiesen.
- [x] #2 Server liefert typisierte erlaubte Profilfelder mit Format, Zeitpunkt und expliziter Teil-Coverage/unsupported-Familien unter64KiB Wire-Limit; keine Secrets/Auth-Komponentenrecords/private Inhaltsfamilien/verborgenen Zähler, keine Defaults oder stillen Trunkierungen.
- [x] #3 Cloud-Download nutzt pro Klick frischen begrenzten RequestKey und native Auth-/Session-Korrelation außerhalb der Exportdatei. Bestehende Scope-Remounts/Tickets verwerfen beobachtete Session-/Workspace-ABA und verspätete Antworten; keine App-eigene lokale/native Persistenz (gewünschte Download-Datei und transienter SDK-Puffer ausgenommen), Demo unverändert.
- [x] #4 Native Isolation/Session/Lifecycle/Legacy-Größe/Fehler-/Read-Kontrollen und tatsächliche Blob-/Scope-/Rollen-Browserprüfungen, unabhängige Reviews, Type/Build/Codegen und exaktes EUDev sind dokumentiert. Voller Export, Legal-/Lösch-/Retention- und manuelles Done bleiben offen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Technische Prüfungen und konkrete Teilumfang-Grenzen sind dokumentiert.
- [x] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehende Auth/Workspace/Profile- und UI-Download-Pfade wiederverwenden
2. Begrenzten Self-Export und Cloud-Download mit Scope-/Session-Korrelation implementieren
3. Native/Browser-Isolation prüfen, eingefrorene Quelle unabhängig reviewen
4. Type/Build/Codegen und exaktes EUDev dokumentieren; manuelles Done offen lassen
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Source-Release .docs/reviews/task-33.1.1-profile-export-source-release.md. Keine App-eigene lokale/native Persistenz; gewünschte Download-Datei und transienter SDK-Puffer sind ausdrücklich davon unterschieden. Fünf Owned-Pfade; Backend32.2 technisch akzeptiert.

Fünf Sourcepfade pausiert: SourceReady df8aa2e;346Inventory/336geschützte alte Nicht-Generated exakt; DemoDataSettings/downloadBlob und67alteBrowserasserts erhalten. Writer34/3fokussiert nativePASS (7Export), beideTSC/format/diff und tatsächlicher App/Store/CSSBrowser1280/390 mitvierJSONDateienPASS. Rootintermediate+finalCodegenPASS; nur api.d.ts2Zeilen, finalzeroDelta. Finalfreeze10b688ff; unabhängigeSPEC undRootgezielteNative/7Static laufen. Kein frischerFullsuite-, Dev-, Legal- odermanuellesDoneClaim.

Technisch akzeptiert: source20d0b68, frozen10b688ff, freshSPEC/distinctQUALITY, Root12/2betroffeneNative+7Static, Writer34/3, tatsächlichevierJSONDownloads1280/390; exactEUDev457/onlypublicselfQuery/456OldContracts+5HTTPunchanged. Siehe .docs/reviews/task-33.1.1-validation.md. Kein frischerFullsuite-/Legal-/WholeexportClaim; InProgress/manuelleDoD2offen.

2026-10-10: Parent-Integration506/506 gezielte Tests, kompletter Typecheck/Build und Workspace-Recovery/Deletion-Browserprüfung bestanden. Bisher akzeptierter Self-Profile-Export unverändert; manuelles Done weiterhin offen.
2026-10-12: Auf ausdrückliche Nutzeranweisung geschlossen; technische ACs belegt, frische gezielte Export-Tests 167/167 PASS. Manuelles Done per Nutzerbestätigung 2026-10-12.
<!-- SECTION:NOTES:END -->
