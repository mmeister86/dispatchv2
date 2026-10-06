---
id: TASK-28
title: Begrenzte Pre-Publish-Analyse implementieren (P08.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 05:22'
labels:
  - p08
  - jev
  - arbeitspaket
  - r2
milestone: m-2
dependencies:
  - TASK-27
  - TASK-17
  - TASK-28.1
  - TASK-28.2
  - TASK-28.3
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
  - .docs/decisions/release-scope.md
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P08.02.
Phase: P08 – Algorithm Intelligence im Composer.

**Abhängigkeit:** P08.01, P05.01. **Dateien:** `convex/intelligence/analyze.ts`, `convex/intelligence/predictions.ts`, `convex/intelligence/scoring.ts`; Tests `convex/intelligence/scoring.test.ts`, `tests/evals/intelligence/`.

- Konkrete Entwurfsversion mit Account, freigegebenem Profil und verfügbarer Historie analysieren.
- Semantische Jev-Signale, eigene Audience-Signale und deterministische Aggregation getrennt nachvollziehbar machen.
- Wertebereiche, fehlende Komponenten, Risiko-Flags und maximal drei priorisierte Empfehlungen validieren.
- Analyse nach Input-Fingerprint cachen; veraltete Predictions bei neuer Version sichtbar kennzeichnen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

### JEV-Abgleich vom 18.09.2026

Erster produktiver Jev-Funktionsumfang: Post Analyzer + Dispatch Score hinter Flags. Konkrete Teilaufgaben: TASK-28.1 liefert Adapter/Betriebsschutz, TASK-28.2 semantische und deterministische Signale samt reproduzierbarer Heuristik/Evaluation, TASK-28.3 versionsgebundene Speicherung und isolierten Cache. Dieses Paket integriert die drei Ergebnisse; Composer-Darstellung in TASK-29.

Providerpfade: convex/ai/jev/*; Scoreberechnung: convex/ai/scoring/dispatchScore.ts. Bestehende Intelligence-Module konsumieren nur normalisierte Dispatch-Typen. Normalisierte Assessments ersetzen den Eindruck einer Reach-Prediction. DPA/EU-only-Freigabe vor Kundendaten, Provider-/Fragen-/Formelversion, niedrige Confidence, Timeouts, Fallbacks und Usage sind Pflicht. Routing und automatische Regeneration sind ausdrücklich nachgelagerte Funktionen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cold Start funktioniert.
- [x] #2 identische gespeicherte Komponenten ergeben denselben Aggregatscore.
- [x] #3 ungültige Modellantworten werden nicht als Erfolg dargestellt.
- [x] #4 fehlende Analyse blockiert manuelles Publishing nicht.
- [ ] #5 Adapter, Analyzer/Score und Assessment-/Cache-Unteraufgaben sind integriert und durch Contract-/Unit-Tests sowie versionierte menschlich geprüfte Eval-Beispiele belegt.
- [x] #6 Ein Assessment ist Workspace, Account, exakter Draft-Version und Netzwerk zugeordnet; Cache berücksichtigt alle verwendeten Inputs und Versionen.
- [x] #7 Jev kann ohne Deployment deaktiviert werden; fehlende Freigabe, Provider-Ausfall und Low Confidence bleiben sichtbar und verhindern kein manuelles Publishing.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence. Explicit mock analysis, current/stale/disabled/unavailable/low-confidence states, fixed dimensions and version/account identity. Grenze: No Jev call, normalized persisted provider assessment or real intelligence validation. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Reviewed28.1/2/3 actual integration software accepted: bounded pinned SDK/defaultOFF/singlefunding, immutable actualrubric/score/assumedcoldstart0.5, strict invalid/low/missing outcomes, exactversion semantic cache/currentproof/history/cleanup and realComposer. SOURCE72a412ca/c2e81f7/93270d5; final647/38 and fresh28.3SPEC54/6 including3own; QUALITY35/4 including3own PASS. SoftwareAC1/2/3/4/6/7 checked; wholeAC5 remains unchecked because human-reviewed Eval component is still missing (28.2 wholeAC3 also open). Manualpublishing independent by existing code/registeredchecks, not live/manual certificate. ActualEU6chain/provider/auth/manual DoD/Done remain open;29 handles realproposal/diff/adoption next.
<!-- SECTION:NOTES:END -->
