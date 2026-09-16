---
id: TASK-15
title: Webhooks und Signal-Ingestion idempotent umsetzen (P04.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-16 20:12'
labels:
  - p04
  - r2
milestone: m-2
dependencies:
  - TASK-14
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P04.02.
Phase: P04 – GitHub und Arbeitssignale.

**Abhängigkeit:** P04.01. **Dateien:** `convex/http.ts`, `convex/integrations/github/webhook.ts`, `convex/content/signals.ts`; Test `convex/integrations/github/webhook.test.ts`.

- Signatur am unveränderten Request-Body prüfen und Eventgröße begrenzen.
- Zustellung zuerst nachvollziehbar erfassen, anschließend Workspace-spezifische Signale verarbeiten.
- Nach dauerhafter Erfassung innerhalb von zehn Sekunden antworten; Anreicherung asynchron ausführen. Fehlgeschlagene GitHub-Zustellungen selbst erkennen und über einen dokumentierten Redelivery-/Abgleichpfad nachholen; automatische Wiederzustellung wird nicht vorausgesetzt.
- Push und Release unterstützen; mehrere erlaubte Workspaces dürfen denselben externen Anlass getrennt verarbeiten.
- Doppelte Zustellung und Wiederaufnahme atomar deduplizieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Event erzeugt höchstens ein Signal je berechtigtem Workspace und Ereignis.
- [ ] #2 Eine globale External-ID-Prüfung unterdrückt nicht versehentlich andere Mandanten.
- [ ] #3 Ungültige Signaturen erzeugen keine Domain-Daten.
- [ ] #4 Ein während des Empfängerausfalls gesendeter Push/Release kann nachträglich ohne doppelte Signale verarbeitet werden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->
