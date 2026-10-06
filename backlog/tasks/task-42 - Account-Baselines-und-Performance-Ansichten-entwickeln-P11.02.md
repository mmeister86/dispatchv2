---
id: TASK-42
title: Account-Baselines und Performance-Ansichten entwickeln (P11.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 08:37'
labels:
  - p11
  - r5
  - jev
milestone: m-5
dependencies:
  - TASK-41
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P11.02.
Phase: P11 – Performance Feedback und Account Intelligence.

**Abhängigkeit:** P11.01 und genügend beobachtete Daten. **Dateien:** `convex/performance/baselines.ts`, `src/features/analytics/post-performance.tsx`, `src/features/analytics/account-overview.tsx`; Test `convex/performance/baselines.test.ts`.

- Vergleichsgruppen nach Account, Format und Messalter bilden; kleine Gruppen sichtbar begrenzen.
- Themen, Formate und Veröffentlichungsfenster beschreibend auswerten.
- Inhaltsassessment und gemessenes Ergebnis nebeneinanderstellen, ohne heuristische Scores als Reichweitenprognose oder nicht messbare Dimensionen als validiert zu kennzeichnen.
- Outcome-Daten als kompakte `performance_signal`-Einträge an den Content-Kontext zurückgeben.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).

### JEV-Abgleich vom 18.09.2026

Vergleichbare Impression-/Engagement-/Reply-/Repost-/Click-/Follower-Conversion-Raten nur bei verfügbaren passenden Nennern und definiertem Messfenster berechnen. Accountgröße, Netzwerk, Content-/Medientyp, Postingzeit und historische Basis berücksichtigen. Rohcounts verschiedener Accounts nicht direkt als Qualitätsvergleich ausgeben; Korrelationen semantischer Scores mit Ergebnissen sind kein kausaler oder individueller Erfolgsnachweis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Der Nutzer kann nachvollziehen, welche Posts relativ zur passenden eigenen Basis gut liefen.
- [ ] #2 Diagramme weisen Zeitraum, Fallzahl und fehlende Daten aus.
- [ ] #3 Follower-Wachstum wird nicht als bewiesene Post-Attribution dargestellt.
- [ ] #4 Normalisierte Vergleiche legen Nenner, Messfenster, Vergleichsgruppe und fehlende Daten offen; inkompatible Netzwerke und Accountgrößen werden nicht ungeprüft vermischt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read accepted41 SOURCE9d2d0cf and actual native observations/publishing/Analytics/Content source authority; reuse existing collectors, ledger, proof and UI split.
2. Define bounded distinct own-publication units and exact account/network/format/definition/window/provider-age cohorts; arithmetic mean with peer exclusion and explicit unvalidated startup rules.
3. Implement protected descriptive queries, matched numerator/denominator rates, missing/zero/partial/sparse buckets and exact then-assessment provenance.
4. Wire actual Analytics filters/coverage/charts and mounted compact performance_signal Content context with separate purpose/current original deadlines; no automatic paid/model admission or untracked derived note.
5. Run meaningful native registered/currentUI/full/static/build/bundle/existingEUDev checks; freeze/scoped SOURCE commit,freshSPEC thenQUALITY; document33/36 seams and leave realdata/live/manual/Done open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /analytics. Account/channel/period filters, post data and topic/format/time groups; separate account baselines, n/missing data and noncausal caveats. Grenze: Synthetic metrics only; no validated account effectiveness or measured score/outcome relationship. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Released after reviewed TASK-41 source 9d2d0cf under the standing software and routine-decision authorization. A fresh sole writer owns bounded descriptive baselines, actual Analytics and a protected Content consumer, including necessary proof/cleanup callers. ROOT owns metadata; source commit requires an exact verified freeze. Brief: /tmp/dispatch-task42-implementation-brief.md, 11,298 bytes, SHA256 c67a12028caf6c2da26c4757e52f021708f7f16eaec3932e7dbe8a81ad92adb4. Cohorts separate account, network, format, unit, definitions and provider age. The ±60-second tolerance and n<10 warning are unvalidated startup rules. Complete threads count once; target units and duplicate IDs are excluded. Rates use matched measured components and denominators; missing or zero denominators stay unavailable. No follower attribution, causal, reach or calibrated-effectiveness claim. Content context requires a separate purpose and original deadlines; no untracked note or unused helper. Reuse accepted collectors and ledger, with no new dependencies or statistics engine. Real data, empirical effectiveness, processing rights, model activation, manual acceptance and Done remain open; old score history0.5 is unchanged.
<!-- SECTION:NOTES:END -->
