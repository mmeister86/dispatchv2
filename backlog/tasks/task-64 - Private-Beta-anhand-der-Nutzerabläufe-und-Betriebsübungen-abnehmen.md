---
id: TASK-64
title: Private Beta anhand der Nutzerabläufe und Betriebsübungen abnehmen
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p09
  - r3
  - gate
  - jev
milestone: m-3
dependencies:
  - TASK-26
  - TASK-27
  - TASK-28
  - TASK-29
  - TASK-30
  - TASK-31
  - TASK-32
  - TASK-33
  - TASK-34
  - TASK-35
  - TASK-36
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: high
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Zusätzliches explizites Beta-Gate aus §12.6. Ergebnisse und verbleibende Grenzen in .docs/decisions/beta-review.md dokumentieren. P08.01–P08.03 liefern bereits R2; P08.04 und P09 liefern den zusätzlichen Beta-Umfang; dieses Ticket führt deren gemeinsame Produktabnahme zusammen.

Quelle: .docs/dispatch-end-to-end-implementation-plan.md. Geplante Arbeit; Abnahme/Done erst nach ausdrücklicher Nutzerbestätigung.

### JEV-Abgleich vom 18.09.2026

Der erste Jev-Umfang aus TASK-28/29 wird seit D04 vom 19.09.2026 bereits in TASK-26/R2 abgenommen. Das Beta-Gate prüft ihn erneut und ergänzt TASK-30 sowie Datenkontrollen/Betrieb: serverseitige gepinnte Integration, EU-only-/DPA-Aktivierungstor, normalisierte versionierte Assessments, reproduzierbarer erklärbarer Score, Low-Confidence-/Unavailable-Zustände, isolierter Cache, Timeouts, Telemetrie ohne Drafts und Deaktivierung ohne Deployment. Die Prüfpunkte aus JEV §44 sind dem jeweils frühesten Release zugeordnet: Analyzer-/Sicherheitsgrundlage vor R2 (TASK-1/26/28/29/63), weitergehende Messung und Datenkontrollen vor R3 (TASK-30/33/64).

TASK-67/TASK-68 bleiben spätere Erweiterungen; das Beta-Gate aktiviert weder automatisches Routing noch Regeneration. Ohne Providerfreigabe darf eine Beta nur mit ausdrücklich dokumentiert reduziertem Umfang und deaktiviertem Jev abgenommen werden, nicht mit behaupteter Jev-Produktionsreife.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 J01–J08 und J12 sind in Staging einschließlich Fehler- und Berechtigungsfällen nachgewiesen.
- [ ] #2 J07 verändert nur nach Übernahme eine Version; fehlende Intelligence blockiert manuelles Publishing nicht.
- [ ] #3 Datenkontrollen, erste zulässige Messdaten und zugängliche Kernoberflächen sind geprüft.
- [ ] #4 Provider-Ausfall, Workflow-Recovery und Restore wurden ohne Doppelveröffentlichung geübt.
- [ ] #5 Ein neuer Nutzer kann das Onboarding ohne ständige Entwicklerhilfe abschließen.
- [ ] #6 Beta-Bericht enthält Testergebnisse, offene Grenzen und ausdrückliche Nutzerfreigabe.
- [ ] #7 Ein Ende-zu-Ende-Nachweis deckt Jev-Ausfall/Timeout, Deaktivierung ohne Deployment, Low Confidence, Draft-Wechsel, Cache-Isolation und weiterhin mögliches manuelles Publishing ab.
- [ ] #8 Vor Jev-Aktivierung sind SDK-/Runtime-Nachweis, versionierte Evaluation und TypeSafe-Datenschutz-/EU-only-Freigabe dokumentiert; offene Nachweise erlauben keine Kundendatenaufrufe.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-19 D04: Nutzer verlangt Intelligence bereits im Dispatch-MVP/R2. Release-Zuordnung aktualisiert; keine Umsetzung oder Provideraktivierung. Maßgeblich: .docs/decisions/release-scope.md.

TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /onboarding and J01–J08/J12 routes below. Interactive UI prototypes for core journeys, absent-intelligence fallback, data controls and provider-failure previews are available for manual review. Grenze: No private-beta/staging/SDK/EU-only/restore acceptance; original release gate remains open. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
