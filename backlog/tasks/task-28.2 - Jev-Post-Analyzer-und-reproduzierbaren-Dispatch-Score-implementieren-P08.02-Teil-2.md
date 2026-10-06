---
id: TASK-28.2
title: >-
  Jev-Post-Analyzer und reproduzierbaren Dispatch Score implementieren (P08.02,
  Teil 2)
status: In Progress
assignee: []
created_date: '2026-09-18 15:20'
updated_date: '2026-10-06 03:29'
labels:
  - p08
  - jev
  - teilpaket
  - r2
milestone: m-2
dependencies:
  - TASK-28.1
  - TASK-27
references:
  - .docs/JEV_INTEGRATION.md
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/decisions/release-scope.md
parent_task_id: TASK-28
priority: medium
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Verantwortung: convex/ai/jev/questions/postAnalysis.ts, analyzePost.ts und convex/ai/scoring/dispatchScore.ts; Unit-/Contract-Tests und tests/evals/intelligence/.

- Den Analysevertrag aus TASK-27 umsetzen: Content-Typ, Hook, Klarheit, Originalität, Diskussionspotenzial, natürliche CTA sowie Wahrscheinlichkeiten für Promotion, starke Behauptungen und Clickbait. Audience Fit nur bei eigenem definiertem und gemessenem Signal ausweisen; das Beispiel-Frageset liefert es nicht automatisch.
- Textlänge, Medien/Links, Hashtags, Mentions, Zeilen, Fragen, explizite CTA und Strukturmerkmale deterministisch berechnen; strukturScore nachvollziehbar definieren und versionieren.
- Tatsächliche SDK-Skala verifizieren und Scores auf 0..1 normalisieren, ohne Zwischenrundung. Dispatch berechnet die 0..100-Heuristik: Hook .20, Klarheit .20, Diskussion .20, Originalität .15, CTA .05, Struktur .10, historische Passung .10. Cold-Start-Wert .5 für historische Passung ausdrücklich als Standardwert markieren. Erst die Anzeige runden.
- Teil-Confidence, fehlende Werte und konfigurierbare Policies getrennt abbilden. Kein Gesamtscore bei unzureichenden Pflichtsignalen; fehlende Werte nicht als gemessene Null ausgeben. Die Startgewichte und Schwellen sind keine validierte Performanceprognose.
- Menschlich geprüfte Referenzposts mit Erwartungsbereichen pflegen: Launch, Announcement, Opinion, Educational, Story, Promotion, schwache/starke Hooks, Clickbait, mehrdeutige Absicht, technische/konversationelle Texte, starke Claims sowie keine/starke CTA. Änderungen an Fragen und Formeln versioniert evaluieren.

Quelle: .docs/JEV_INTEGRATION.md. Geplante Arbeit; Umsetzung im freigegebenen Release-Umfang. Keine Implementierung oder Providerfreigabe durch diese Backlog-Anpassung.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identische gespeicherte semantische und deterministische Komponenten erzeugen unter derselben Formelversion denselben Score; Grenzwerte, Cold Start und fehlende Werte sind getestet.
- [ ] #2 Jev trifft atomare semantische Entscheidungen; Scoreaggregation, Policies und Ausführung bleiben in Dispatch/Convex.
- [ ] #3 Unit- und Contract-Tests prüfen Normalisierung, deterministische Signale, Gewichtung, Confidence und fehlerhafte Antworten; das versionierte Eval-Dataset besitzt menschlich geprüfte Erwartungsbereiche.
- [ ] #4 Keine Aussage zu Audience Fit oder künftiger Reichweite wird aus einem nicht vorhandenen Messsignal abgeleitet.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Consume the reviewed28.1 adapter and define a genuine immutable ordered post question/normalization version.
2. Introduce executable profile references through new immutable payloads with explicit review/select, preserving old profile meaning.
3. Compute descriptive structure signals and deterministic dispatch-score-v1 with missing/low-confidence and assumed cold-start states.
4. Add transparent technical fixtures and reproducible controls; leave human-reviewed expectation-range acceptance open.
5. Run full checks/existing EU Dev, freeze source and independent SPEC then QUALITY; retain manual Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence. Hook/clarity/discussion/originality/natural CTA/structure/history dimensions, fixed weighted illustrative score, missing values and declared 50 cold-start standard. Grenze: All semantic values are hypothetical; no evaluated model, audience match or reach prediction. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

ROOT preparation only, actual implementation waits reviewed28.1 adapter/sourcecontract. Current TASK27 unavailable executable refs must not be silently reinterpreted; genuine new immutable profile payloads require explicit review/select. Whole ordered thread and descriptive media, no measured Audience Fit/reach. Actual AC3 includes HUMAN reviewed expected ranges; synthetic/AI technical fixtures do not satisfy that portion or justify whole checkbox. No SDK/provider activation or human acceptance claimed.
<!-- SECTION:NOTES:END -->
