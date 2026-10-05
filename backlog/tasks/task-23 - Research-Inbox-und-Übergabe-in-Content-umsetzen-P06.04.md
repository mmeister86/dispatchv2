---
id: TASK-23
title: Research Inbox und Übergabe in Content umsetzen (P06.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 23:38'
labels:
  - p06
  - r2
milestone: m-2
dependencies:
  - TASK-22
  - TASK-18
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P06.04.
Phase: P06 – Eigenständiger proaktiver Recherche-Agent.

**Abhängigkeit:** P06.03, P05.02. **Dateien:** `src/features/research/inbox.tsx`, `src/features/research/item-detail.tsx`, `convex/research/handoff.ts`; Test `tests/e2e/proactive-research.spec.ts`.

- Themen, Quellen, Aktualität, Begründung und Unsicherheit lesbar darstellen.
- Ignorieren, archivieren, nachrecherchieren, Agent befragen und Idee erzeugen anbieten.
- Automatische Erstellung von Ideen/Entwürfen nur entsprechend aktivierter Profiloption zulassen.
- Doppelte Übergaben verhindern und die komplette Quellenkette erhalten.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J04 und J05 funktionieren ohne GitHub-Anschluss.
- [ ] #2 Aus einer Forschungsquelle entsteht höchstens die ausdrücklich gewünschte Zahl von Vorschlägen.
- [ ] #3 Inhalte bleiben vor Veröffentlichung freigabepflichtig.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Nach geprüftem TASK22.3 zuerst TASK23.1: aktuelle Evidenz-/Inbox-Review- und Content-Übergabeverträge mit bestehenden Ideen/Entwürfen und Quellenketten implementieren und unabhängig prüfen.
2. Danach TASK23.2: explizite gezielte Aufträge und aktuelle Evidenz in persönliche Agent-Chats integrieren; J05 ist mehr als ein Navigationslink.
3. Danach TASK23.3: echte vorhandene Inbox-/Agent-UI, sichere Nachrecherche und neu explizit aktivierte begrenzte automatische Übergaben verbinden; integrierte J04/J05-Prüfungen.
4. Je Teilpaket ein Implementer, frischer SPEC- und QUALITY-Review, regelmäßige scoped master commits; Elternkriterien erst nach integrierten Nachweisen, Done nur nach manueller Nutzerbestätigung.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research, /ideas, /drafts/:id, /agent. Inbox filtering/detail, archive/ignore/update, ask-agent transition, create idea/draft and retained source chain; duplicate local handoffs reopen existing objects. Grenze: Updating a demo source changes local metadata; it performs no new research. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only actual23map /tmp/dispatch-research-inbox-current-code-map.md basedaccepted22.2source3b51807. RealpipelineInbox alreadydisplaysresults butonlyresumeaction; ignore/archive/research/chat/idea remainDemo. Existing18/19 sources acceptGitHub/note notResearch; research→note wouldlosecurrentprimary/secondarysource/purpose/expiryguards. AutoHandoff literalfalse acrossschema/config/projection, J05 needsactualtargetedorder notjustchatcontext. ROOT decomposed23 intoCLIchildren23.1→23.2→23.3 ToDo withexplicitAC/DoD/manualconfirmation; no backendimplementationreleasebefore22.3review. Reusecurrentexistingprimitive/sourceguards/physicalcomponentfixtures, no genericbus/provider/newInboxstore.
<!-- SECTION:NOTES:END -->
