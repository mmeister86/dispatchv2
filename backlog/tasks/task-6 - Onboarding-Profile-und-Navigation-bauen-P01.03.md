---
id: TASK-6
title: 'Onboarding, Profile und Navigation bauen (P01.03)'
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p01
  - r0
milestone: m-0
dependencies:
  - TASK-5
  - TASK-3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P01.03.
Phase: P01 – Anwendung, Identität und persönlicher Kontext.

**Abhängigkeit:** P01.02, P00.03. **Dateien:** `convex/preferences.ts`, `convex/accountProfiles.ts`, `src/features/onboarding/`, `src/components/app-shell/`, `src/routes/app/overview.tsx`.

- Zeitzone, Sprache, Projektbeschreibung, Zielgruppe, Ton und grundlegende Themen erfassen; sinnvolle Überspringen-/Nachholen-Pfade anbieten.
- X-Verbindung als Aktivierungsschritt, GitHub und proaktive Recherche als bewusst aktivierbare Quellen darstellen.
- Overview, Calendar, Drafts, Ideas, Research, Agent und Settings mit verständlichen Leerzuständen anlegen.
- Herkunft und Sichtbarkeit von privatem Projektkontext im Onboarding erklären.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D01: Erstnutzer und UI-/Content-Sprachen entscheiden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Nutzer kann ohne GitHub starten.
- [ ] #2 fehlender Kontext wird ehrlich angezeigt.
- [ ] #3 Zeitzone kommt aus Nutzereinstellung und nicht aus der Serverlokalität.
- [ ] #4 Onboarding ist mit Tastatur bedienbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
