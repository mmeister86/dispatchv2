---
id: TASK-32.5
title: Zeige optionale Research-Abschlusszusammenfassungen mit Ruhezeiten
status: To Do
assignee: []
created_date: '2026-10-08 06:04'
updated_date: '2026-10-08 06:04'
labels: []
dependencies: []
parent_task_id: TASK-32
priority: high
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nutzerentscheidung 08.10.2026: Research-Zusammenfassung bei Abschluss einer Recherche, kein gebündelter Wochentermin. Native eigene opt-in In-App-Anzeige mit endlicher Ruhezeitverschiebung, originalem Order/Generation/Recipient/Quellenbeweis und Bereinigung. Optionaler E-Mail-Transport bleibt deaktiviert. Konkrete Sourcefreigabe erst nach akzeptiertem laufendem Workspace-Export.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Nur vollständiges eigenes In-App- und Research-Opt-in lässt eine konkrete öffentliche abgeschlossene Recherche mit originaler Generation und aktuellen Recipient/Workspace/Account/Quellenrechten zu; private targeted Chats bleiben außerhalb dieses öffentlichen Summary-Scopes.
- [ ] #2 Ruhezeiten werden in persönlicher IANA-Zone tatsächlich ausgeführt, einschließlich Tageswechsel und DST; endliche ursprüngliche Deadline und idempotente Episode werden bei Callback/Anzeige nicht erneuert.
- [ ] #3 Aktueller Rechte-/Präferenz-/Quellenverlust maskiert sofort und bereinigt begrenzt fortsetzbar; dauerhafte terminale Episode resurrectiert nicht, Pflichtmeldungen und deaktivierte optionale E-Mail bleiben unverändert.
- [ ] #4 Reale registered Replay/Isolation/ZeroIO/DST/Expiry/Purge und bestehende Inbox/Settings-Browserkontrollen, frische getrennte Reviews, Root-Gates und exaktes bestehendes EUDev sind belegt; Done nur nach manueller Nutzerbestätigung.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Human Entscheidung im laufenden Thread 08.10.2026: Bei Abschluss einer Recherche. Read-only audit /tmp/dispatch-32-next-summary-audit.md SHA256 ddb5f7f4f7c37bd2fee11615cf5da8270a76beacdce820ab34da8e5a4af8c7b5 vollständig Root-gelesen: aktuelles inAppSummaries/weekly/research/quiet hat noch keinen Consumer; öffentlicher Research-Index existiert bereits. Minimal eigener Research-Slot am bestehenden Preference-Root, OriginalOrder/Generation/Recipient/source horizon, begrenzte Verschiebung statt neuer allgemeiner Registry/Transportkopie. Keine Sourcefreigabe/Tests/Dev für32.5; wartet auf technisch akzeptierte33.1.3. Weekly benötigt später explizite persönliche Wochentag/Uhrzeitwahl, kein Demo-Default.
<!-- SECTION:NOTES:END -->
