---
id: TASK-6
title: 'Onboarding, Profile und Navigation bauen (P01.03)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 09:29'
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
- [x] #1 Ein Nutzer kann ohne GitHub starten.
- [x] #2 fehlender Kontext wird ehrlich angezeigt.
- [x] #3 Zeitzone kommt aus Nutzereinstellung und nicht aus der Serverlokalität.
- [ ] #4 Onboarding ist mit Tastatur bedienbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Profil und Onboarding serverseitig persistieren.
2. Leere Workspaces ohne Demo-Accounts und Beispielinhalte starten.
3. Onboarding und Workspace-/Account-Auswahl an authentifizierte Queries/Mutations anbinden.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /onboarding, /overview, /settings/profile. Four-step onboarding, skip/later paths, project, language, timezone, audience, tone/topics, optional GitHub/research and mock social activation. Grenze: Context is browser-local. No data transfer or real activation. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Profil/Projekt/Timezone dauerhaft in Convex; ohne GitHub startbar, fehlende Verbindungen ehrlich angezeigt. Aufschieben hält onboardingDone=false und Schritte bleiben über Einstellungen erreichbar. Spec- und Quality-Reviews bestanden; Tastatur- und vollständige Aktivierungsabnahme folgt mit Domain-Anbindung.
<!-- SECTION:NOTES:END -->
