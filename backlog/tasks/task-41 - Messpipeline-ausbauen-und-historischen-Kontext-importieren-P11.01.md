---
id: TASK-41
title: Messpipeline ausbauen und historischen Kontext importieren (P11.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 07:23'
labels:
  - p11
  - r5
  - jev
milestone: m-5
dependencies:
  - TASK-30
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P11.01.
Phase: P11 – Performance Feedback und Account Intelligence.

**Abhängigkeit:** P08.04; Datenverwendungsfreigabe für den konkreten Zweck. **Dateien:** `convex/performance/collect.ts`, `convex/performance/backfill.ts`, `convex/performance/metricDefinitions.ts`; Test `convex/performance/collect.test.ts`.

- Snapshot-Fenster nach tatsächlichem Nutzen und Kosten bis zu den vorgesehenen fünf Zeitpunkten ausbauen.
- Aktualisierungsverzögerungen, gelöschte Posts, abgelaufene Abfragefenster, widerrufene Tokens und fehlende Metriken abbilden.
- Zulässige eigene historische Posts als Kontext importieren; keine historischen privaten Metriken erfinden.
- Einzelelemente und Thread-Aggregate korrekt verknüpfen; verwendete Medienmetriken auf ihre Aggregationsebene prüfen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).

### JEV-Abgleich vom 18.09.2026

Publikations-Assessments aus TASK-30 mit tatsächlich verfügbaren Performance-Metriken verbinden. Netzwerk, Accountgröße, Content-/Medientyp, Veröffentlichungszeit, Beobachtungsfenster und historische Basis erhalten. Nachträgliche Analyse historischer Posts separat als solche kennzeichnen; fehlende historische Assessments nicht als zeitgenössische Evidenz ausgeben.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Import ist idempotent, begrenzt und löschbar.
- [ ] #2 alte Posts mit fehlenden Metriken bleiben als unvollständig markiert.
- [ ] #3 bei nicht erfüllten Zugriffsrechten bleibt der Collector kontrolliert deaktiviert.
- [ ] #4 Metrik-/Assessment-Joins erhalten Publikationsversion und damaligen Modell-/Frage-/Formelstand; Backfill ist von damaliger Bewertung unterscheidbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read accepted TASK30 source18add46 and actual Analytics/publishing/OAuth/accounting end to end; reuse current primary X history/resource-pricing evidence.
2. Add explicit supported window subset without mutating old policy/consent or inventing past measurements; preserve immutable version/then-assessment ID or NULL.
3. Implement separately permitted bounded own-history jobs: max3 pages of max100 owned resources, native checkpoints, stable idempotency, current-authority per physical GET and maximum-resource reservation in the existing ledger.
4. Wire real Analytics import/progress/pause/resume/cancel/delete, honest old missing values/actual ages and compatible known thread coverage; enforce original text horizons, bounded physical cleanup and late finance without resurrection.
5. Verify meaningful registered/full/static/browser/existing EU Dev, freeze/scoped SOURCE commit, fresh SPEC then QUALITY; document actual inventory/recovery limits and keep live/manual/Done gates open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /analytics — Datenverwaltung. Fixed historical-post import with progress/pause/resume/cancel, origin label and deletion; absent metrics remain unknown. Grenze: No provider history retrieval, metric collector or historical assessment reconstruction. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Released after reviewed TASK30 SOURCE18add46, independent SPEC8 and QUALITY3 PASS,full700/40 and existing EU Dev09:11:42. The user authorizes remaining software and routine choices on master; provider activation and human Done remain separate. A fresh sole writer owns performance/history/windows and actual Analytics plus narrowly reused authority/accounting/lifecycle paths and meaningful tests. ROOT owns metadata; the source commit window stays CLOSED until exact freeze approval. Current implementation brief /tmp/dispatch-task41-implementation-brief.md:8683 bytes,SHA2567ae94c5bc871731559ec216c52de52112b975a9cb8c91491dfff30da82955a68. Primary history receipt1d01468d and billing receipt668fc8c were fully read: own timeline max_results5..100; reads charge per returned resource; customer ownOAuth does not imply the app-owner discount. Reserve max_results times approved resource price before every page; soft provider dedup is never assumed free. Require a separate explicit own-history text/context purpose; cap3 pages×100 posts,no foreign expansion,fabricated historical private counts or contemporary assessments. Supported15min/1h/6h/24h/48h windows require an explicit subset,with existing24/48 defaults preserved. Immutable first-send knowledge and original protected horizons remain. Actual rights/pricing/grants/credentials/policy activation and live/manual acceptance stay OPEN; no seeds or automatic paid activation.
<!-- SECTION:NOTES:END -->
