---
id: TASK-23.2
title: 'Gezielte Recherche mit persönlichen Agent-Chats verbinden (P06.04, Teil 2)'
status: To Do
assignee: []
created_date: '2026-10-05 23:38'
labels: []
dependencies:
  - TASK-23.1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
parent_task_id: TASK-23
priority: high
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teilpaket zu TASK23/J05: expliziten themengebundenen Research-Auftrag aus dem persönlichen Chat und aktuelle evidenzgebundene Zusammenfassung ermöglichen. Bestehende persönliche Agent-Threads, Finanzierungs- und Research-Auftragsverträge verwenden; keine allgemeinen Recherchetools oder freie Notizkopien als Ersatz. Umsetzung erst nach ROOT-Freigabe und geprüftem Teil 1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein expliziter persönlicher Chat-Auftrag erzeugt gezielte Recherche ohne GitHub mit unveränderlicher Themenabsicht, tatsächlichen Auftrag-IDs und bestehenden aktuellen Budget- und Abbruchprüfungen.
- [ ] #2 Rechercheergebnisse werden nur mit aktuellen evidenzgebundenen Referenzen in den eigenen Chat übernommen; Fremdthread, fremder Account, Ablauf und Entzug sind gesperrt.
- [ ] #3 Chat-Historie, Folgeanfragen und Idee-Tools erhalten die vollständige Quellenkette und können Research nicht als freie Notiz ohne Quellenprüfungen weitergeben.
- [ ] #4 Fehlende Konfiguration, Wiederholung, Stop, unbekannter Verbrauch und Wiederaufnahme bleiben ehrlich und erzeugen keine zusätzlichen bezahlten Aufrufe.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und offene manuelle Abnahme sind dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
