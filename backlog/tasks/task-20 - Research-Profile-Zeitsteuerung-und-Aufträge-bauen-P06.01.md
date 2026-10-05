---
id: TASK-20
title: 'Research-Profile, Zeitsteuerung und Aufträge bauen (P06.01)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 17:29'
labels:
  - p06
  - r2
milestone: m-2
dependencies:
  - TASK-6
  - TASK-17
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P06.01.
Phase: P06 – Eigenständiger proaktiver Recherche-Agent.

**Abhängigkeit:** P01.03, P05.01. **Dateien:** `convex/research/profiles.ts`, `convex/research/schedules.ts`, `convex/research/runs.ts`, `src/features/research/profile-editor.tsx`; Test `convex/research/schedules.test.ts`.

- Profilfelder aus Abschnitt 6.1 einschließlich Pause, Frequenz und Budget konfigurieren.
- Manuelle, planmäßige und vom Content Agent angeforderte Recherche als denselben Auftragstyp modellieren.
- Überlappende Läufe desselben Profils zusammenführen oder begrenzt in die Warteschlange stellen.
- Nächsten Lauf, letzten Erfolg und verbrauchtes Budget im Produkt sichtbar machen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D02: Frequenz und Startbudget nach P00-Messung festlegen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Recherche läuft ohne GitHub-Ereignis.
- [ ] #2 Pause verhindert neue Läufe.
- [ ] #3 doppelte Scheduler-Aufrufe erzeugen keinen doppelten Auftrag.
- [ ] #4 ein Profilwechsel verändert laufende Jobs nicht rückwirkend.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research — profile/history tabs. Account-scoped research settings, project relevance, topic/audience/language/region/source/exclusion/freshness/count/frequency/budget, pause, mock next/last runs, immutable profile snapshot per local run. Grenze: No scheduled research or external lookup; frequency and next-run display preview configuration only. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only future preparation /tmp/dispatch-research-profile-implementation-brief.md: actual profile/history UI uses local daily2EUR/sample/timer data. Real20 requires immutable profile snapshots, bounded unified manual/scheduled/ContentAgent orders, pause/generation/idempotence and server IANA occurrence state reusing final17 budget/stop authority. D02 activation remains versioned and gated by actual processing/pricing/funded limits; demo values are not measured approved defaults. No20 implementation/AC evidence; downstream21/22 must produce actual research before integratedAC1 acceptance.

Read-only official Workflow runtime preparation /tmp/dispatch-workflow-runtime-current-docs.md: three Context7 commands plus published workflow0.4.8/workpool0.4.13 archives and peer metadata inspected without installation/scripts. Declared peers match current Convex/helpers, but complete joint compilation/through-component runtime still required. Concrete step.runAction retry:false and retryActionsByDefault:false prevent layered paid retries; in-flight Actions can finish after Workflow cancellation, so current domain stop/source/grant fences remain mandatory. Actual published workflow/test helper registers nested workpool and batchWorker; inventory/retention and stable bounded journal IDs are required once mounted. No TASK20 code/activation or acceptance from this preparation.

Root formal D02 initial implementation rule recorded under delegated decisions: real profiles manual-only/inactive schedule with no seeded paid budget; periodic starts require explicit current activation and the same processing/pricing/three-scope coverage as manual orders. Finite user order cap uses actual approved pricing currency, with no fictional EUR conversion or demo-derived quota/start amount; at most one active profile order and exact scheduler occurrence dedupe. This decides initial product behavior, not actual provider activation, measured operating budget or20 code acceptance. Final19/16 shared contracts and root assignment remain prerequisite for implementation.

Read-only explorer actual map complete /tmp/dispatch-research-profile-code-map.md: ResearchPage has no real/Demo split and displays daily2EUR/seed completedrun/sampleInbox although real local setter is unavailable; no actual create/save/delete/timezone controls. Reuse existing workspace/reference/currentactor guards, immutable Ideas CAS/version/operation receipt, native editorial scheduler generation/cancel and IANA time helpers. Proposed minimum3 domain stores with one embedded schedule, immutable profileversions and unifiedorders; names are proposals notschema claims. CurrentVersion change alone mustnotcancel immutable oldrunning snapshot; livepause/stop/role/account/source guards independent. Root delegated recurrence rule nowformal: explicit savedIANA/localclock/weekday; gap skips thatlocaloccurrence, overlap earlierinstantonly, exactUTC+generationdedupe, no automatic missed-period batch and zonechange onlyfuture explicitreplan. No20source/AC acceptance; wait reviewed19 before freshimplementation.
<!-- SECTION:NOTES:END -->
