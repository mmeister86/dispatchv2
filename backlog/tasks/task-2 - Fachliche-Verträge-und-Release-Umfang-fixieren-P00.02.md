---
id: TASK-2
title: Fachliche Verträge und Release-Umfang fixieren (P00.02)
status: Done
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-01 10:34'
labels:
  - p00
  - r0
  - jev
milestone: m-0
dependencies:
  - TASK-1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
  - .docs/decisions/domain-contracts.md
  - .docs/decisions/release-scope.md
  - .docs/reviews/2026-09-19-task-2-contract-validation.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P00.02.
Phase: P00 – Machbarkeit und Produktverträge.

**Abhängigkeit:** P00.01. **Dateien:** `.docs/decisions/domain-contracts.md`, `.docs/decisions/release-scope.md`.

- Die Entscheidungen aus Abschnitt 1 sowie Zustandsautomaten aus Abschnitt 5 als verbindliche Grundlage festhalten.
- Account-Verknüpfung, Freigabe, Zeitzonen, Research-Aktualität und Fehlerwiederaufnahme anhand konkreter Beispiele beschreiben.
- Private Alpha, Dispatch-MVP, Beta und GA mit den genannten Nutzerabläufen abgrenzen.
- Offene Produktentscheidungen aus Abschnitt 16 jeweils einem Verantwortlichen und einem Entscheidungstor zuweisen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D04 bestätigt am 19.09.2026: Intelligence einschließlich Analyzer, Dispatch Score und J07 bereits im Dispatch-MVP/R2.
- D01–D17 mit Verantwortlichen und Entscheidungstoren führen.

### JEV-Abgleich vom 18.09.2026

Architekturvertrag ergänzen: Jev klassifiziert/bewertet/verifiziert hinter einem internen Adapter; generative LLMs schreiben, recherchieren und erklären; Convex orchestriert, wendet Geschäftsregeln an und persistiert; Publishing bleibt in Provider-Adaptern. Kein zusätzliches autonomes Agentenframework für diese Integration.

„MVP“ im JEV-Leitfaden meint den ersten Jev-Funktionsumfang. Der Dispatch-MVP bleibt R2; Post Analyzer + Dispatch Score gehören nach D04 vom 19.09.2026 zu R2/P08.01–P08.03, aufgeteilt in TASK-28.1, TASK-28.2, TASK-28.3. TASK-67 und TASK-68 sind als anschließende R5-Erweiterungen eingeplant, Network Fit folgt im bestehenden R7-Kanalausbau; konkrete Release-Zuordnung und Aktivierung dokumentieren. Kalibrierung bleibt R5, erweitertes Recycling nach MVP im ausgewählten Portfolio. Keine Freigabe zusätzlicher Publishing-Kanäle allein durch Erwähnung von LinkedIn/Bluesky im Guide.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 J01–J12 haben eine zugehörige Release-Stufe.
- [x] #2 es gibt genau eine Definition des Dispatch-MVP und keine implizite autonome Veröffentlichung.
- [x] #3 Der Architektur-/Release-Vertrag unterscheidet Dispatch-MVP und ersten Jev-Umfang und ordnet Analyzer, Routing, Verifikation, Kalibrierung und Network Fit ausdrücklich zu.
- [x] #4 Jev entscheidet keine Veröffentlichung, Authentifizierung, Abrechnung oder Termine; EU-only- und Kanal-Auswahltore bleiben verbindlich.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [x] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Vorhandene Produktverträge, Task-1-Nachweise und JEV-Abgleich konsolidieren.
2. D04 nach Nutzerentscheidung vom 19.09.2026 ändern: Intelligence einschließlich Analyzer, Dispatch Score und J07 gehört in R2.
3. Domain-Vertrag, Release-Vertrag und Entscheidungsregister D01–D17 erstellen; offene Providerwahl nicht vorziehen.
4. Gesamtplan, Roadmap und betroffene Backlog-Zuordnungen/Abhängigkeiten konsistent aktualisieren.
5. Dokumente, Referenzen und Abhängigkeitsgraph prüfen; manuelle Nutzerabnahme vorbereiten, Status bis Bestätigung offen lassen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19: Fortsetzung durch Nutzer beauftragt. D04 ausdrücklich entschieden: Intelligence soll bereits in den Dispatch-MVP/R2. Analyzer/Dispatch Score/J07 werden vorgezogen; Kalibrierung und weitere Jev-Erweiterungen bleiben spätere Stufen. TASK-1 bleibt offen, Providerentscheidung ist vertagt. Vertragsarbeit darf unabhängig fortgesetzt werden; technische oder datenschutzbezogene Aktivierungen werden dadurch nicht freigegeben.

2026-09-19: domain-contracts.md und release-scope.md erstellt; Hauptagent führte Release-/Backlog-Abgleich aus, Subagent domain_contract_review erstellte Domain-Vertrag und prüfte Konsistenz. D04-Nutzerentscheidung umgesetzt: TASK-27/28/28.1/28.2/28.3/29 von R3 nach R2 verschoben, TASK-27 von MVP-Gate entkoppelt, TASK-26/63/64 sowie TASK-1/17/67 und Gesamtplan/Roadmap/JEV-Guide angepasst.
Verifiziert: J01–J12 12/12, D01–D17 17/17, 137 lokale Links/Anker, 89 Tasks mit R2=23/R3=14, Intelligence-Abhängigkeiten, DST-Beispiele; backlog doctor und git diff --check bestanden. Keine Anwendungstests oder Provideraufrufe. Prüfbericht: .docs/reviews/2026-09-19-task-2-contract-validation.md.
AC1–4 dokumentarisch erfüllt. Manuelle Nutzerabnahme ausstehend; Status In Progress und DoD offen. D06, Zeit-/Frischeregeln, Scoreformel und Providerfreigaben bleiben ausdrücklich an ihren Toren offen. CLI-Grenze: bestehende Milestone-Beschreibungen nicht editierbar; historische m-2/m-3-Kurztexte in Roadmap als überholt gekennzeichnet, Task-Zuordnungen aktualisiert.

2026-10-01: Nutzer weist ausdrücklich an, TASK-2 auf Done zu setzen. Dokumentarische AC1–4 sowie die bereits dokumentierten Prüfungen sind abgenommen. D04 bleibt verbindlich: Analyzer, Dispatch Score und J07 gehören zu R2. Offene Entscheidungen und technische/Datenschutz-Aktivierungstore bleiben in domain-contracts.md und release-scope.md erhalten. Keine zusätzlichen Provideraufrufe oder Implementierungsfreigaben durch den Statusabschluss.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fachliche Zustands- und Release-Verträge konsolidiert; J01–J12, D01–D17 und R2-Intelligence-Zuordnung dokumentiert und geprüft. Nutzer bestätigt den Abschluss ausdrücklich am 01.10.2026. Offene Entscheidungs- und Aktivierungstore bleiben verbindlich.
<!-- SECTION:FINAL_SUMMARY:END -->
