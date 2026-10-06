---
id: TASK-29
title: 'Empfehlungen, Vergleich und Übernahme gestalten (P08.03)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 05:22'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Consume accepted exact-version assessment/current eligibility APIs and existing editorial save contract.
2. Derive at most three genuine structural/accessibility recommendations with precise frozen thread/media diffs; no unsupported semantic rewrite or reach claim.
3. Add narrowly guarded, idempotent adoption using the shared save transaction; create a new unapproved version without replacing schedules and invalidate old-base siblings.
4. Verify real UI low/missing/running/stale/error states, bounded calls and preserved typing/failed review; complete full checks/existing EU Dev.
5. Freeze exact source and run fresh SPEC then QUALITY; retain human/live/manual acceptance gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id — Intelligence. Manual mock analysis does not change text; up to three explained recommendations with before/after review, explicit acceptance into a new unapproved version. Grenze: No generated recommendations, reach guarantee or automatic rewrite. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

ROOT preparation only, implementation waits accepted28.3 actual API. Read-only requirement-grounded design advice /tmp/dispatch-task29-minimal-design-advice.md SHAb236f964c5ea49d6500d1255bca09fbfa524bd2feb2642e878587fceaaee5b3d reviewed complete. Actual TASK29/J07 does not mandate arbitrary generative rewriting. Choose conditional structural/accessibility recommendations: precise adjacent byte-identical duplicate, explicitly selected safe standalone token reduction, human-entered missing image alt; at most3 and zero when no safe edit, fixed actual reasons permitted. Product limits explicit, no demo transform/semantic guarantee. Exact current server rederivation and shared editorial-save transaction, idempotent ACK, full diff, first adoption invalidates siblings; no old approval or planned snapshot replacement. Future brief /tmp/dispatch-task29-implementation-brief.md SHA f3d1dbd799b90616daae0468f70658f779f1566e69ca4b99f129bff6ad5b1c8d. No code/live/provider/manual acceptance.

Released after reviewed28.3 SOURCE93270d5 exact18 normalizedassessment/currenteligibility APIs, fresh SPEC09987505/QUALITY08729df0 PASS/full647/38. Consume actualanalyze/get/history and sharededitorialsave transaction. Brief f3d1dbd7/designb236f964; currentpinned twitter-text UTF16/fulltoken API source +slice control docs d30a3a9b. Existing normalmedia saves alreadyrequire nonblankalt; do not weaken validation to manufacture missingalt recommendations, onlyconditionallegacy recovery. Atmost3 genuine safe edits/zero allowed; source/current exactbinding/idempotent explicitnewversion/fullorderedfrozendiff, no oldapproval/schedule replacement/semanticreach promises. Freshsolewriter then frozenindependentSPEC/QUALITY; ROOTownsmetadata/manualDoneopen.
<!-- SECTION:NOTES:END -->
