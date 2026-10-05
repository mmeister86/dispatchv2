---
id: TASK-16
title: Signale anreichern und verständlich darstellen (P04.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 10:34'
labels:
  - p04
  - r2
milestone: m-2
dependencies:
  - TASK-15
  - TASK-17
  - TASK-18
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P04.03.
Phase: P04 – GitHub und Arbeitssignale.

**Abhängigkeit:** P04.02, P05.01; Übergabe zur Idee nach P05.02. **Dateien:** `convex/integrations/github/enrichment.ts`, `src/features/signals/`, `tests/fixtures/github/`.

- Begrenzten Commit-, Datei- und Diff-Kontext laden; Geheimnisse und ungeeignete private Details vor Modellübergabe filtern.
- Zusammenfassung, Relevanz, Neuigkeit und Confidence mit belegbarem Bezug erzeugen.
- Triviale Änderungen als verarbeitet kennzeichnen, ohne zwangsläufig Ideen anzulegen.
- Quelle, verwendeten Kontext und redaktionelle Entscheidung im Produkt anzeigen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Wartungsrauschen bleibt ohne Draft.
- [ ] #2 relevante Änderung wird zur begründeten Idee weitergereicht.
- [ ] #3 ein Modellfehler verliert das Signal nicht.
- [ ] #4 P04.01–P04.02 können vor P05 geliefert werden.
- [ ] #5 AI-Anreicherung folgt nach dessen Modelladapter.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse reviewed TASK-14 source bindings and TASK-15 durable per-workspace ingestion.
2. Wait for reviewed TASK-17 bounded model/budget contracts and TASK-18 idea/content operations; no duplicate model pipeline.
3. Load bounded allowed commit/file/diff context, filter secrets/private details and preserve factual source evidence.
4. Enrich only through approved purpose/region paths, retain signals on failures and classify maintenance noise without drafts.
5. Wire real signal detail and explicit idea handoff, independently review requirements and quality, verify regression and live/manual gates. Keep In Progress until user confirmation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /signals. Synthetic signal filters/details, original event versus editorial interpretation, relevance/novelty/confidence/private status, maintenance noise and failed enrichment, idea handoff. Grenze: No GitHub retrieval, secret filtering or AI enrichment. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
