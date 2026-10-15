---
id: TASK-32.3
title: Speichere persönliche Benachrichtigungspräferenzen nativ
status: In Progress
assignee: []
created_date: '2026-10-07 22:39'
updated_date: '2026-10-07 23:15'
labels: []
dependencies: []
parent_task_id: TASK-32
priority: high
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Setze den noch offenen Konfigurationsumfang von TASK-32 um: eigene Einstellungen aller vier Rollen werden in der bestehenden Preferences-Zeile gespeichert. Fehlende Werte bedeuten optional OFF; gespeicherte Auswahlen sind keine aktive Zustellung oder Marketingeinwilligung. Profil-, Agent- und Planungskontext bleiben auf ihre bisherigen Felder begrenzt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Verifizierte aktuelle Mitglieder aller vier Rollen lesen und ändern ausschließlich ihre eigenen Einstellungen im ausgewählten aktiven Workspace; kein übergebener Empfänger/User/Email und keine Admin-Ausnahme.
- [x] #2 Optionaler Mail-/InApp-Summary- und Wochen-/Research-Consent, explizite Zeitzone und optionale Ruhezeit werden als begrenzter fixer Wert mit nativer Revision/CAS gespeichert; fehlender Consent ist OFF, Pflicht-InApp und angeforderte Auth-Mails bleiben eigenständig.
- [x] #3 users.current projiziert nur ursprüngliche Profilfelder; bestehende Profil-/Projekt-/Viewer-Grenzen und alle aktuellen Producer bleiben erhalten. Cloud Settings zeigen native Persistenz und ehrliche noch fehlende Versand-/Summary-Fähigkeit; Demo bleibt lokal.
- [x] #4 Registrierte Self/Rollen/Isolation/CAS/Validierung und echte styled Browser mit Reload/Dirty/SessionWorkspaceRoleABA/Error/Demo sind geprüft; frische SPEC/QUALITY, angemessene Gesamtprüfung, Codegen/Static/Build und exaktes bestehendes EUDev dokumentiert. Manual Done bleibt offen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Alle technischen ACs sind überprüft, der konkrete Stand committed und erforderliche Dev-Synchronisierung dokumentiert.
- [ ] #2 Der Nutzer hat nach eigener Prüfung ausdrücklich bestätigt, dass dieser Task als Done markiert werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehende eigene Preferences mit fixem optionalem Consent und Revision verwenden; users.current nur ursprüngliche Profilfelder projizieren. 2. Native Vier-Rollen-Self-API und echte Cloud Settings mit Dirty/Revision/Session-Scope und ehrlicher unverfügbarer Zustellung anbinden. 3. Registrierte Isolation/CAS/Validierung und styled Browser/Demo prüfen; sieben Source-Pfade pausieren. 4. Finalcodegen/FreshSPEC/distinctQUALITY/ein angemessener Gesamt-Nativlauf/7Static/Build/exaktes EUDev; manuelle Done-Abnahme offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Konkrete Sourcefreigabe .docs/reviews/task-32.3-native-preferences-source-release.md auf HEAD4a22190 und349Sourcefiles nach technisch geprüfter35.1. Native Einstellungen sind gespeicherte Auswahlen, keine aktive Mail/Summary/Marketingfreigabe. SiebenOwned/339altegeschützteNongens, kein neuer Producer/Store/Service/Transport. Fortsetzung des gesamten ursprünglichen Backend-Auftrags; Parent32 und andere Pflichtmodule bleiben offen.

FreshSPECfinal1NEEDS_WORK: tatsächliche registrierteMutation speichert +01:00 trotzIANA/UTCVertrag. Historischer74/4/browserPASSüberstimmtDefekt nicht. RootFullnative47505vorReparaturabgebrochenexit130;keinGesamtPASS. EngerFixnurpreferences.ts/test.ts, unveränderterprivaterREDControl→GREEN undneuerFinalfreeze/Reviews/Gateserforderlich;API/UI/anderen349Sourcepfadebleibenexakt.

Technische Abnahme: Commit cb5f5efa0d371011d44ed3387cdf8d59ec8192ff; 1488 native Tests / 60 Dateien PASS, sieben statische Build-Gates PASS, frische SPEC und getrennte QUALITY PASS. Bestehende EU-Dev-Instanz bestätigt 461 Schnittstellen (+2), alle 459 alten vollständigen Verträge und fünf HTTP unverändert. Manuelle Nutzerbestätigung für Done bleibt offen.
<!-- SECTION:NOTES:END -->
