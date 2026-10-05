---
id: TASK-15
title: Webhooks und Signal-Ingestion idempotent umsetzen (P04.02)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 13:08'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse final reviewed TASK14 App proof/source records and native HTTP/crypto/scheduler; confirm current webhook and delivery recovery contract.
2. Bound raw body and verify HMAC before any domain write; persist auditable receipt and schedule async processing before fast2xx acknowledgement.
3. Process allowlisted Push/Release into tenant-scoped factual signals with atomic per-workspace/body/event dedupe and resumable fanout; recheck source generation/purpose/lifecycle before commit.
4. Detect failed provider deliveries and provide bounded cursor/window redelivery or reconciliation, preserving privacy and coverage gaps; no assumption automatic redelivery.
5. Wire real Signals factual state and truthful recovery/configuration; AI enrichment remains TASK16 after17/18.
6. Validate signature/replay/multiple-workspace/crash/disabled-source/receiver-outage recovery and affected actual UI; full checks/Dev/scoped commits/independent SPEC then QUALITY; no Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-only preparation while TASK12.3 active; no implementation. Current official Context7 library-first /github/docs plus2docs (3commands/noquota), independently verified primary guides in /tmp/dispatch-github-webhook-current-docs.md. Raw-byte SHA256 HMAC/fast10sec2xx afterdurable receipt; GUID stable acrossredelivery; no automaticredelivery; App-global JWT-only delivery endpoints cursor<=100 and202redelivery notcompletion. Body-only signature means headers alone are not authenticated event/tenant proof; signed-body identity and per-workspace dedupe required. Missing privatekey/webhooksecret remains visibleguidance; actual TASK14 interfaces supplied afterreviews.
<!-- SECTION:NOTES:END -->
