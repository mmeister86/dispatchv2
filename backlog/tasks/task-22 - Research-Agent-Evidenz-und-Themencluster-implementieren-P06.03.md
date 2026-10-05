---
id: TASK-22
title: 'Research Agent, Evidenz und Themencluster implementieren (P06.03)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 19:45'
labels:
  - p06
  - r2
  - arbeitspaket
milestone: m-2
dependencies:
  - TASK-21
  - TASK-22.1
  - TASK-22.2
  - TASK-22.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P06.03.
Phase: P06 – Eigenständiger proaktiver Recherche-Agent.

**Abhängigkeit:** P06.02. **Dateien:** `convex/ai/researchAgent.ts`, `convex/ai/researchTools.ts`, `convex/research/evidence.ts`, `convex/research/clusters.ts`, `convex/research/evaluate.ts`; Tests `tests/evals/research/`.

- Die zehn Schritte aus Abschnitt 6.3 als begrenzten, wiederaufnehmbaren Ablauf implementieren.
- Quellen, Behauptungen, eigene Interpretation und Datenlücken getrennt speichern.
- Themenduplikate, wiederaufgewärmte Meldungen, Quellenkopien und schon veröffentlichte Themen erkennen.
- Für geeignete Ergebnisse konkrete Account-Perspektiven und einen begründeten Gültigkeitszeitraum liefern.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D08: Gültigkeitsfenster und Prüfung zeitkritischer Inhalte festlegen.

Großes Paket: Die zugeordneten Unteraufgaben liefern die Implementierung in begrenzten Schritten. Dieses übergeordnete Ticket hält den vollständigen Planvertrag und wird erst nach integrierter Abnahme aller Unteraufgaben geschlossen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eine kuratierte Stichprobe umfasst relevante, irrelevante, alte, widersprüchliche und bösartig instruierende Quellen.
- [ ] #2 Der Agent verlinkt echte gelieferte Quellen und erfindet keine URLs oder Trenddynamik.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research. Synthetic evidence separates source claims and interpretation; topic/freshness/confidence context and distinct run outcomes. Grenze: No research pipeline, evidence evaluation, semantic clustering or real trend detection. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only future decomposition prepared during TASK15 independent reviews: /tmp/dispatch-research-evidence-implementation-brief.md (22.1 source/claim/interpretation/gaps and explicit unknown freshness), /tmp/dispatch-research-pipeline-implementation-brief.md (22.2 ten actual resumable funded steps), /tmp/dispatch-research-evaluation-implementation-brief.md (22.3 fixed curated cases and honest synthetic versus live metrics). /tmp/dispatch-research-inbox-implementation-brief.md prepares23 actual commands/source-chain/idempotenthandoff. These are requirement briefs only, no22/23code/paidcalls/activation or acceptance. Implement sequentially after independently reviewed17–21/18/19 and actual final interfaces, native smallestreuse/freshSPECthenQUALITY; D08recordedbefore22.1, no universalTTL/trend/URL/confidence/cost invention or BacklogDone.

Clarification: D08 is still a prepared conservative proposal; ROOT must record the delegated implementation decision before22.1 starts. The previous note describes that future requirement, not a completed decision or live freshness validation.

Current decision clarification: the earlier note saying D08 was only prepared is superseded by the formal ROOT decision already recorded in domain-contracts/release-scope and TASK22.1 (5f01f79). Use source-specific classification, separate publication/event/observation timestamps, versioned purpose rule and finite justified validity; no blanket TTL or model-created automatic eligibility. TASK21 final source review still precedes TASK22.1 implementation. No evidence/source verification or acceptance claimed by this metadata clarification.
<!-- SECTION:NOTES:END -->
