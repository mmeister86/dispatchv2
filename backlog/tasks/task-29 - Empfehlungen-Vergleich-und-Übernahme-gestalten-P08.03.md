---
id: TASK-29
title: 'Empfehlungen, Vergleich und Übernahme gestalten (P08.03)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p08
  - jev
  - r2
milestone: m-2
dependencies:
  - TASK-28
  - TASK-8
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
  - .docs/decisions/release-scope.md
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P08.03.
Phase: P08 – Algorithm Intelligence im Composer.

**Abhängigkeit:** P08.02, P02.02. **Dateien:** `src/features/intelligence/analysis-panel.tsx`, `src/features/intelligence/recommendation-diff.tsx`; Test `tests/e2e/intelligence.spec.ts`.

- Score, Teilwerte, Quellenstand und begrenzte Aussagekraft im Composer verständlich anzeigen.
- Verbesserungen mit Begründung und nachvollziehbarem Text-/Medien-Diff vorschlagen.
- Annahme erzeugt eine neue Entwurfsversion; mehrere Vorschläge können einzeln übernommen werden.
- Keine Reichweitengarantie, erfundene persönliche Erfahrung oder künstliche Engagement-Frage in Optimierungen zulassen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

### JEV-Abgleich vom 18.09.2026

Den Dispatch Score als Inhaltsheuristik 0..100 mit erklärbaren Teilwerten, Daten-/Versionsstand, fehlenden Werten und Confidence zeigen. Laufende, veraltete, deaktivierte und nicht verfügbare Analyse unterscheiden; den letzten gültigen Stand sichtbar erhalten, aber nicht als aktuell ausgeben. Erklärungen liefern feste Produkttexte oder die generative Schicht.

Manuelle Analyse und optionales Debouncing (Startwert 800 ms) mit Mindesttextlänge und bedeutsamen Inhaltsänderungen verbinden. Identische Inputs cachen, überholte Requests abbrechen/verwerfen und Tippen nie blockieren. Kosmetische Änderungen dürfen strukturrelevante Unterschiede nicht verdecken. Warnungen beschreiben Inhaltseigenschaften, keine Reichweiten-/Erfolgsversprechen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J07 funktioniert.
- [ ] #2 Ein Klick auf „Analysieren“ verändert keinen Text.
- [ ] #3 Übernommene Optimierung ersetzt keinen geplanten Inhalt und übernimmt keine frühere Freigabe.
- [ ] #4 UI-Fälle für niedrige Confidence, unvollständige Daten, laufende/veraltete Analyse und Providerausfall sind geprüft; unbelegte Audience-Passung wird nicht angezeigt.
- [ ] #5 Schnelle Texteingabe erzeugt begrenzte Analysen; eine ältere Antwort überschreibt keine aktuelle Bewertung, und Eingabe bleibt bedienbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence. Manual mock analysis does not change text; up to three explained recommendations with before/after review, explicit acceptance into a new unapproved version. Grenze: No generated recommendations, reach guarantee or automatic rewrite. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
