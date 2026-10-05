---
id: TASK-43.1
title: >-
  Zulässige Lernziele und zeitlich getrennte Referenzdaten definieren (P11.03,
  Teil 1)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-18 15:20'
labels:
  - p11
  - r5
  - teilpaket
  - jev
milestone: m-5
dependencies:
  - TASK-42
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
parent_task_id: TASK-43
priority: medium
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu P11.03. Verantwortung: convex/performance/calibration.ts und tests/evals/calibration/; Datenvertrag.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md, P11.03. Der übergeordnete Task bewahrt den vollständigen fachlichen Vertrag. Tenant-/Account-Prüfung, Fehlerfälle und aktuelle Provider-Verträge gelten auch hier. Umsetzung erst nach Freigabe des betroffenen Umfangs.

### JEV-Abgleich vom 18.09.2026

Referenzdaten binden normalisierte Performance an das Assessment zum Veröffentlichungszeitpunkt. Netzwerk, Account, Fragen-/Modell-/Formelversion und Messfenster erhalten; nicht vergleichbare Versionsstände getrennt auswerten. Nur zulässige kontrollierte/anonymisierte Daten verwenden; Lernziel ist die Kalibrierung von Dispatch, nicht das Training von Jev.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Lernziele unterscheiden messbare Outcomes von Content-Heuristiken; der konkrete Verwendungszweck ist freigegeben.
- [ ] #2 Datensplits enthalten keine zukünftigen Messwerte in Trainingsbeispielen.
- [ ] #3 Mindestdaten, kleine Segmente, Drift und fehlende Werte sind als dokumentierte Eingangstore behandelt.
- [ ] #4 Datensatz und zeitliche Splits schließen rückwirkende Scores sowie künftige Outcomes als damalige Eingaben aus und trennen inkompatible Versionen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
