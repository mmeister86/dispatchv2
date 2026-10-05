---
id: TASK-26
title: Dispatch-MVP anhand realer Redaktionsarbeit abnehmen (P07.03)
status: To Do
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-09-19 20:29'
labels:
  - p07
  - r2
  - gate
milestone: m-2
dependencies:
  - TASK-16
  - TASK-25
  - TASK-29
  - TASK-63
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/decisions/release-scope.md
priority: high
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P07.03.
Phase: P07 – Kalenderbewusste Planung aus beiden Quellen.

**Abhängigkeit:** P04.03–P07.02, P08.01–P08.03 und Basisbetrieb aus P09. **Dateien:** `tests/e2e/core-loop.spec.ts`, `.docs/decisions/mvp-review.md`.

- J01–J08 mit freigegebenen Testaccounts durchlaufen.
- Eine Woche Content sowohl aus Projektarbeit als auch aus proaktiver Recherche vorbereiten und selektiv veröffentlichen.
- Quellenrichtigkeit, persönliche Passung, Editieraufwand und Kalendernutzen dokumentieren.
- Kritische Qualitäts- und Zuverlässigkeitsmängel vor Beta-Ausbau beheben.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

### D04 – Intelligence im MVP (19.09.2026)

Analyzer, Dispatch Score und bewusste Empfehlungsübernahme (TASK-27–29 einschließlich TASK-28.1–28.3) gehören zum R2-Gate. Nachzuweisen sind Provider-/EU-only-Freigabe, versionierte Assessments, deterministische Scoreaggregation, Low-Confidence-/Unavailable-Zustände, isolierter Cache, begrenzte Aufrufe, Kostenkontrolle und Abschaltbarkeit. Ein Analyseausfall blockiert ansonsten zulässiges manuelles Publishing nicht, ersetzt aber keinen Intelligence-Abnahmenachweis. Ohne freigegebenen Jev-Datenpfad sind Kundendatenaufrufe gesperrt; reduzierter MVP nur nach ausdrücklicher neuer Umfangsentscheidung. Performance-Messpipeline bleibt R3, Routing/Verifikation/Kalibrierung bleiben R5.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Beide Quellen erzeugen tatsächlich akzeptierte Inhalte, nicht nur technisch gültige AI-Ausgaben.
- [ ] #2 Die Benutzerfreigabe des MVP wird ausdrücklich eingeholt und im Backlog dokumentiert.
- [ ] #3 J01–J08 einschließlich Analyzer, Dispatch Score und expliziter Empfehlungsübernahme sind nachgewiesen; fehlende Analyse verändert weder Version noch Freigabe.
- [ ] #4 Jev-Provider- und EU-only-Aktivierungstor sowie sichere Fehler-/Budget-/Cache-/Abschaltzustände sind nachgewiesen; ein reduzierter Umfang erfordert eine ausdrückliche Entscheidung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.
<!-- SECTION:NOTES:END -->
