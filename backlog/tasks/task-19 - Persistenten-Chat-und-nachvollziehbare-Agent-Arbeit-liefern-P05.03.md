---
id: TASK-19
title: Persistenten Chat und nachvollziehbare Agent-Arbeit liefern (P05.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 17:23'
labels:
  - p05
  - r2
milestone: m-2
dependencies:
  - TASK-18
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P05.03.
Phase: P05 – Agent-Grundlage, Content Agent und Chat.

**Abhängigkeit:** P05.02. **Dateien:** `convex/ai/conversations.ts`, `convex/ai/runs.ts`, `src/features/agent/chat.tsx`, `src/features/agent/action-cards.tsx`; Test `tests/e2e/agent-chat.spec.ts`.

- Konversationen sicher mit Workspace, Account und Component-Thread verknüpfen.
- Streaming, laufende Aktionen, Abbruch und Wiederaufnahme anzeigen.
- Tool-Ergebnisse als verlinkte Produktobjekte präsentieren; Vorschläge und ausgeführte Aktionen klar unterscheiden.
- Tokenverbrauch, Kosten, Modell-/Promptversion und Fehler im Run erfassen, ohne vertrauliche Inhalte in allgemeine Logs zu kopieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reload erhält Gespräch und erzeugte Objekte.
- [ ] #2 auch eine nach Abbruch fertig werdende Action darf keine neuen Content-/Planungsobjekte anlegen.
- [ ] #3 Ergebnis-, Fehler- und Verbrauchsabgleich bleiben zulässig.
- [ ] #4 Ein Nutzer kann einen anderen Component-Thread nicht über erratene IDs lesen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse reviewed17/18 and final16 current authority, official Agent history and one workspace/account conversation mapping. 2. Bind every read/stream/write to the domain conversation; validate native cursor membership, durable sends, funding, stop/continuation and actual object receipts. 3. Replace real chat simulation with awaited persistent UI and truthful configuration/usage/cleanup states, retaining explicit Demo. 4. Exercise actual component and physical synthetic adapter boundaries, affected UI and full checks; scoped commits and existing EU Dev once. 5. Independent SPEC then separate QUALITY; root verifies code criteria without Done or live/manual acceptance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /agent. Account-scoped local conversations, simulated streaming/actions, stop/resume/error, linked draft proposal and mock step/cost states. Grenze: No Component threads, remote model streaming or token telemetry. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only future backend preparation: actual AgentPage currently stores local conversations/messages, simulated330ms streaming/fixed answer/fabricated costs and fixed draft proposal. Future19 brief /tmp/dispatch-chat-implementation-brief.md requires official Agent-owned history plus authorized workspace/account/thread mapping, actual17 budgets/attempts and18 object tools, durable stop barrier with late evidence-only settlement, stable prompt references, safe explicit continuation, awaited real UI and truthful unavailable configuration. No19 implementation or AC evidence yet; final17/18 contracts must precede assignment.

Read-only preparation updated for reviewed18ad3fc25 (SPEC53+8 own/browser and QUALITY53+8 separate own/browser); actual16 context integration still underway and reviewed final source remains prerequisite. Concrete installed Agent0.6.4 stream boundary: component streams.listDeltas accepts threadId but fetches caller cursor.streamId without checking thread ownership. TASK19 must authorize conversation mapping AND prove each bounded stream cursor belongs to that actual thread before native delta read; blind syncStreams forwarding is insufficient. Validate actual same-human cross-workspace/account, finished/aborted and foreign/old cursor cases. Read final /tmp/dispatch-chat-code-map.md and current /tmp/dispatch-chat-implementation-brief.md. No current public chat streaming API, no19 implementation or existing18 defect claimed by this preparation.

Read-only installed API map complete at /tmp/dispatch-chat-code-map.md: native listStreams with server-derived threadId and streaming/finished/aborted gives at most100 actual thread-scoped metadata IDs; there is no exported single-stream lookup. Validate bounded unique cursor IDs and safe nonnegative integers against that list before any listDeltas call; unproved/old/deleted streams fail closed or are omitted with history/list resync, never probed for data. Native useUIMessages stream-only pagination uses numItems=0, an authorized sentinel the public guard must support. Existing conversation history must not automatically forward previously revoked private sources through a fresh source-less run; recheck all source/context approvals actually included or start a new thread without withdrawn history. Same operation cannot bypass held unknown attempts by new run ID. Preparation only, no19 source or acceptance.

Native API preparation recorded at /tmp/dispatch-chat-native-api-current-docs.md through exactly three fresh Context7 CLI requests and pinned0.6.4 source inspection. Agent.deleteThreadAsync wrapper discards the component mutation isDone receipt and only initiates recursive cleanup; native direct mutation can preserve real completion proof. Persist stop first, keep financial unknown liabilities and truthful local cleanup; do not equate hiding a mapping or one accepted asynchronous page with complete erasure. TASK16 re-SPEC5ae8da3 passed66 registered and11 independent checks; separate QUALITY underway. No19 source implementation starts before final16 QUALITY passes.
<!-- SECTION:NOTES:END -->
