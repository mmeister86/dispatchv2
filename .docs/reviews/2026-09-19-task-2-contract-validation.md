# TASK-2: Vertrags- und Release-Prüfung

Stand: 19.09.2026. Gegenstand ist Dokumentation, keine Anwendungsimplementierung.

## Ergebnis

Die [fachlichen Verträge](../decisions/domain-contracts.md) und der [Release-Vertrag](../decisions/release-scope.md) liegen zur manuellen Nutzerabnahme vor. D04 wurde während der Bearbeitung ausdrücklich entschieden: **Intelligence bereits im Dispatch-MVP/R2**. Offene Produkt- und Providerentscheidungen behalten eigene Tore; TASK-1 bleibt offen und die Providerwahl vertagt.

## Arbeitsteilung und fachliches Review

- Hauptagent: Release-Vertrag, D01–D17, J01–J12, Abgleich von Gesamtplan/Roadmap/JEV-Leitfaden und ausschließlich per CLI vorgenommene Backlog-Änderungen.
- Subagent `domain_contract_review`: zuerst lesender Abgleich der Domain-Invarianten; anschließend ausschließlich `domain-contracts.md` erstellt und Release-Vertrag auf Widersprüche geprüft.
- Hauptagent: vollständige Domain-Fassung gelesen, mit Release-Vertrag und vorhandenen Task-Gates abgeglichen. Neue Transitionen und Zeitzonenregeln sind als Präzisierung beziehungsweise offene Entscheidung gekennzeichnet.

## Nachweise

| Prüfung | Ergebnis |
|---|---|
| J-Register im Release-Vertrag | J01–J12: 12/12, jede Tabellen-ID genau einmal |
| D-Register im Release-Vertrag | D01–D17: 17/17, jede Tabellen-ID genau einmal; Verantwortlicher und Tor vorhanden |
| Lokale Markdown-Verweise in beiden Verträgen, Gesamtplan, Roadmap und JEV-Guide | 137 Ziele einschließlich vorhandener Anker gültig |
| Backlog-Zuordnung | 89 Tasks erhalten; sechs Intelligence-Tasks nach R2; R2 23 Tasks, R3 14 Tasks |
| Abhängigkeiten | TASK-27 hängt von TASK-1/7 ab; TASK-26 wartet auf TASK-29/63; TASK-63 umfasst Intelligence; TASK-64 wartet ausdrücklich auf TASK-26 |
| `backlog doctor` | Keine doppelten IDs, Selbstabhängigkeiten oder Abhängigkeitszyklen |
| Zeitbeispiele mit Python `zoneinfo` | Berlin 19.09.2026 09:00 = 07:00 UTC; 29.03.2026 02:30 nicht existent; 25.10.2026 02:30 entspricht wahlweise 00:30 oder 01:30 UTC |
| `git diff --check` | Bestanden; anfängliche neue nachgestellte Leerzeichen im Plankopf entfernt |

Die Strukturprüfungen wurden mit einem einmaligen lokalen Python-Skript ausgeführt. Keine Produkt-Tests, kein Build, keine Provideraufrufe und keine Datenschutzfreigabe wurden durchgeführt oder behauptet. Bestehende uncommittete Arbeit wurde erhalten; keine Aufgabe auf Done gesetzt.

## Akzeptanzkriterien

1. **AC1 erfüllt:** Jeder Nutzerablauf ist zugeordnet; J12 unterscheidet frühen Basisbetrieb und vollständigen R3-Ausbau.
2. **AC2 erfüllt:** Eine Definition des Dispatch-MVP; J01–J08 einschließlich Intelligence; keine implizite autonome Veröffentlichung.
3. **AC3 erfüllt:** Erster Jev-Umfang innerhalb R2, Messgrundlage R3, Routing/Verifikation/Kalibrierung R5, Network Fit R7 für ausgewählte Kanäle.
4. **AC4 erfüllt:** Jev erhält keine Publikations-, Authentifizierungs-, Abrechnungs- oder Terminautorität; EU-only- und Kanal-Auswahltore bleiben erhalten.

## Bekannte Dokumentationsgrenze

Die installierte Backlog-CLI bietet für vorhandene Milestones keine Bearbeitung der Beschreibung an. Deshalb bleiben die ursprünglichen Kurztexte in m-2/m-3 unverändert. Task-Milestones und Labels sind korrekt aktualisiert; Roadmap und Release-Vertrag kennzeichnen ausdrücklich ihren Vorrang vor den historischen Kurztexten. Es wurden keine Task-/Milestone-Dateien direkt geändert und keine Milestones zum Umgehen dieser Grenze gelöscht oder neu angelegt.

## Noch erforderliche manuelle Abnahme

- R2-Umfang einschließlich Analyzer/Score/J07 und vorgezogenen Aktivierungsnachweisen prüfen.
- Account-/Versions-/Freigabe-, Planungs-, Research-, Medien- und Wiederaufnahmebeispiele lesen und präzisierte Regeln bestätigen oder korrigieren.
- Offene D06-, DST-/Reise-, Frische-/Slot-, Scoreformel- und Providerentscheidungen mit ihren späteren Toren prüfen. Eine Dokumentabnahme genehmigt diese offenen Optionen nicht automatisch.
- Ausdrücklich bestätigen, ob TASK-2 nach dieser Prüfung auf Done gesetzt werden darf.

Bis dahin bleiben Status **In Progress** und beide Definition-of-Done-Punkte offen; die manuelle Abnahme wurde noch nicht erbracht.
