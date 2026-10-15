---
id: TASK-47
title: Begrenzte Experimente und Lernkontrolle bauen (P12.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 15:23'
labels:
  - p12
  - r5
milestone: m-5
dependencies:
  - TASK-43
  - TASK-46
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P12.03.
Phase: P12 – Persönliche Stimme, strategische Planung und kontinuierliche Verbesserung.

**Abhängigkeit:** P11.03, P12.02. **Dateien:** `convex/performance/experiments.ts`, `src/features/analytics/experiments.tsx`, `tests/evals/personalization/`.

- Hypothese, Zielmetrik, Varianten, Zeitraum und Abbruchregel vor Experimentstart festhalten.
- Einfache Tests von Hook, Format oder Timing nur innerhalb erlaubter Posting-Frequenz anbieten.
- Unkontrollierte Unterschiede, kleine Stichproben und zeitabhängige Effekte im Ergebnis sichtbar machen.
- Verbesserungen an Entwurfsakzeptanz und Bearbeitungsaufwand ebenso berücksichtigen wie Plattformmetriken.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Das Produkt bezeichnet beobachtete Zusammenhänge nicht automatisch als Kausalität.
- [ ] #2 Experimente umgehen keine Inhaltsfreigabe und vervielfachen keine Posts nur zur Datensammlung.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Akzeptierte48Attribution/45BeforeResultSourceCleanup/46konkretePins übernehmen und final proof reconciliieren.
2.47.1 finiteSpec/Assignment/EditorialFeedbackOutcome/CAS/Stop und tatsächlicheExperimentsRoute mit eingeführtemCleanup.
3. Freeze/frischesSPEC→distinctQUALITY/RootCommit/exaktesbestehendesEUDev.
4.47.2 vorPossibleEffect exakteApprovedScheduleAssignment plus separat admitted retainedMetric/LocalUseProof, transparenteMatching/Missingness.
5. Separate47.2Freeze/Reviews/Commit/Dev, Graph33/36 und empirical/live/manualDone offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /experiments. Create/edit hypothesis, target metric, A/B descriptions, observation window and stop rule; start/stop/resume/complete and small-sample synthetic results. Grenze: No experiment assignment, platform posting, causal inference or actual learning. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only Fortsetzung /tmp/dispatch-continuation-47-contract-proposal.md vollständig durch Root gelesen. Vorläufige Sequenz nach48/45/46: 47.1 explizite finite native A/B-Deklaration/exakte manuelle Versionzuordnung/deskriptive Editorial-Outcomes, dann47.2 separat erlaubte ursprüngliche Publishing-Zuordnung/passende retained Metrics. Keine Content-/Schedule-/Provider-Erzeugung oder automatische Gewinneraktivierung. Zusätzliche SharedFeedback-Seam: record/list/sweep/purge prüfen aktuell nur before-Version;45/47 benötigen exact resultingVersion scope/draft/account, Minimum beider original/current Quellenhorizonte und indexed result-cleanup. Aktuelle accept-Rows unterscheiden decide versus approval nicht; Wiederholungen sind keine unabhängigen Samples. Kein empirischer Aufwand-/Frequenz-/Metrikdefault, keine Permission oder Implementierungsfreigabe aus diesem Design; endgültige source ownership erst nach akzeptiertem45/46.

Prospektiver .docs/editorial-experiment-contract.md und47.1/47.2 viaCLI erstellt, beideToDo. KeineSourceImplementierung. Routine32Units/28days sind endlicheSoftwareobergrenzen, keinegewähltenNutzerwerte/validierteSampleSize. ActualFeedbackOrigin explicit-vs-approval istlegacyambiguous; keineOriginInference/nInflation/EditEffort/KausalWinner. Final45/46Proofs vor47Admission reconciliieren.
<!-- SECTION:NOTES:END -->
