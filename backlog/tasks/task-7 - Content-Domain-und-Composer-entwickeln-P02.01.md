---
id: TASK-7
title: Content-Domain und Composer entwickeln (P02.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 08:44'
labels:
  - p02
  - r1
milestone: m-1
dependencies:
  - TASK-6
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P02.01.
Phase: P02 – Entwürfe, Versionen, Freigaben und Medien.

**Abhängigkeit:** P01.03. **Dateien:** `convex/content/drafts.ts`, `convex/content/versions.ts`, `src/features/drafts/composer.tsx`, `src/features/drafts/thread-editor.tsx`; Test `convex/content/versions.test.ts`.

- Single-Post- und Thread-Entwürfe mit Account-Zuordnung und unveränderlichen Versionen speichern.
- Speichern, Wiederaufnahme, lokale ungespeicherte Änderungen und konkurrierende Bearbeitung sichtbar behandeln.
- Thread-Reihenfolge, Plattformvalidierung und Versionsvergleich integrieren.
- Listen nach redaktionellem und Veröffentlichungsstatus filtern; keine Veröffentlichung allein durch Editor-Speichern.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine Bearbeitung lässt frühere Versionen unverändert.
- [ ] #2 konkurrierende Speicherungen verlieren keine Änderungen unbemerkt.
- [ ] #3 plattformspezifische Längen- und Formatgrenzen stammen aus dem Capability-Adapter.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Normalisierte Entwürfe und unveränderliche Versionen mit erwarteter Versionsnummer in Convex speichern.
2. Composer, Erstellung, Kommentare, Zuweisung und Varianten auf explizite asynchrone Mutations umstellen.
3. Rechte, Fremdreferenzen, konkurrierende Bearbeitung und Snapshot-Erhalt testen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts, /drafts/:id. Search/status/channel filters, single-post/thread editor, post ordering, unsaved-edit warning, save/reopen, immutable content versions, account assignment, preview and version restoration. Grenze: Persistence is localStorage; cross-user collaborative concurrency is not implemented. No real publishing. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
