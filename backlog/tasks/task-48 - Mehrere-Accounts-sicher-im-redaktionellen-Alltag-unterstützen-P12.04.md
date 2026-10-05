---
id: TASK-48
title: Mehrere Accounts sicher im redaktionellen Alltag unterstützen (P12.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 08:44'
labels:
  - p12
  - r5
milestone: m-5
dependencies:
  - TASK-10
  - TASK-25
  - TASK-37
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P12.04.
Phase: P12 – Persönliche Stimme, strategische Planung und kontinuierliche Verbesserung.

**Abhängigkeit:** P03.01, P07, P10-Entitlements. **Dateien:** `src/features/settings/account-manager.tsx`, `src/features/drafts/account-selector.tsx`, `convex/planning/accountScope.ts`; Test `tests/e2e/multiple-accounts.spec.ts`.

- Mehrere zulässige Accounts desselben Providers mit eigenen Profilen, Research-Einstellungen, Kalendern und Kontingenten verwalten.
- Den aktiven Account in Chat, Composer, Research Inbox und Freigabedialog dauerhaft erkennbar machen.
- Accountwechsel in einem Entwurf als bewusste neue Zuordnung behandeln; Freigaben und Analysen nicht ungeprüft übertragen.
- Einen Account trennen, ohne andere Accounts oder deren laufende Planungen zu unterbrechen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Nutzer kann zwei X-Accounts bedienen, ohne Inhalte oder Freigaben zu verwechseln.
- [ ] #2 Ein expliziter Accountwechsel aktualisiert Kontext und Berechtigungsprüfung.
- [ ] #3 automatische Wiederverwendung fremder Account-Historie findet nicht statt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Workspacegebundene Account-Auswahl aus serverseitiger Snapshot-Abfrage nutzen.
2. Varianten, Freigaben und Termine streng an ihren Zielaccount binden.
3. Accountwechsel und fremde Account-IDs testen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: Global account selector, /settings/integrations, /agent, /research, /drafts/:id. Multiple mock accounts, visible context, explicit composer reassignment and renewed review; account-scoped research/chat and independent disconnect. Grenze: No real multi-account OAuth or provider quota isolation. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
