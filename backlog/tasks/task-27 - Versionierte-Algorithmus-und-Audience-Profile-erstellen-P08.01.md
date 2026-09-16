---
id: TASK-27
title: Versionierte Algorithmus- und Audience-Profile erstellen (P08.01)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p08
  - r3
milestone: m-3
dependencies:
  - TASK-26
  - TASK-1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P08.01.
Phase: P08 – Algorithm Intelligence im Composer.

**Abhängigkeit:** P07.03, P00.01. **Dateien:** `convex/intelligence/algorithmProfiles.ts`, `convex/intelligence/audienceProfiles.ts`, `.docs/decisions/analysis-contract.md`; Test `convex/intelligence/profiles.test.ts`.

- Aussagen der X-Algorithmus-Unterlage gegen konkrete öffentliche Quellstände prüfen; belegte Mechanismen, Interpretation und unbekannte Produktionsdetails trennen.
- Profilzustände `draft`, `reviewed`, `active`, `retired` mit Quellen-Commit, Gültigkeit und internem Freigabenachweis einführen.
- Audience-Profile versionieren und Embeddings zusammen mit Modellkennung, Dimension und Erstellungszeit speichern.
- Die sieben Dimensionen und die beiden Reichweitenperspektiven in einem konsistenten Analysevertrag definieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine Analyse referenziert genau einen aktiven Profilstand.
- [ ] #2 Profilwechsel verändern historische Predictions nicht.
- [ ] #3 Fehlendes Audience-Profil führt zu ehrlicher unvollständiger Bewertung, nicht zu erfundener Passung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
