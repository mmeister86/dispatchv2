---
id: TASK-54
title: Gemeinsamen Kalender und mehrkanalige Analyse ergänzen (P14.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p14
  - r7
  - jev
milestone: m-7
dependencies:
  - TASK-53
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P14.03.
Phase: P14 – Multi-Channel Publishing und plattformspezifische Intelligence.

**Abhängigkeit:** P14.02. **Dateien:** `src/features/calendar/channel-filters.tsx`, `src/features/analytics/channel-comparison.tsx`, `convex/intelligence/platformProfiles.ts`.

- Account-/Kanalfilter, getrennte Veröffentlichungszeitpunkte und Status je Variante anzeigen.
- Anpassungen an einer Variante von anderen Varianten entkoppeln; bewusste Übernahme als Vorschlag anbieten.
- Gemeinsame Analysedimensionen mit plattformspezifischen Regeln und belegtem Wissensstand kombinieren.
- Vergleichbare Kennzahlen gegenüber plattformspezifischen oder nicht verfügbaren Metriken abgrenzen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).

### JEV-Abgleich vom 18.09.2026

Jev Network Fit in convex/ai/jev/questions/networkFit.ts und evaluateNetworkFit.ts hinter eigenem Flag ergänzen. Kriterien je tatsächlich eingeführtem Netzwerk versionieren: X etwa Kürze/Aktualität/Dialog, LinkedIn fachliche Relevanz/Klarheit/Glaubwürdigkeit, Bluesky Natürlichkeit/Community-Bezug – letztere nur, wenn als Kanal gewählt/freigegeben. Weitere gewählte Kanäle erhalten einen eigenen belegten Vertrag.

Jev bewertet semantische Eigenschaften pro Netzwerk; Convex kombiniert sie mit deterministischen Limits und entscheidet unverändert verwenden, kleine Anpassung oder kanalbezogener Rewrite. Vorhandene passende Texte nicht unnötig vervielfachen. Bei Unsicherheit/Ausfall Empfehlung ausblenden, ohne Publishing zu blockieren. Keine Plattformalgorithmus-Gerüchte oder konkrete Reichweitenprognose als Grundlage. Adapter/Cache/Usage und eingeführte Verifikation wiederverwenden, neue Daten in den Lifecycle aufnehmen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Es gibt keinen scheinbar universellen Reichweitenscore über inkompatible Plattformmetriken.
- [ ] #2 Ein Nutzer erkennt, welche Variante auf welchem Kanal tatsächlich veröffentlicht wurde.
- [ ] #3 Fragesätze und Evaluation sind je freigegebenem Kanal versioniert; nicht ausgewählte Kanäle erhalten weder sichtbare Capability noch Publishing-Versprechen.
- [ ] #4 Passender Originaltext kann unverändert bleiben; nötige Anpassungen sind nutzerkontrolliert und unterliegen harten Providerlimits sowie getrennten Versionen/Freigaben.
- [ ] #5 Low Confidence, Timeout, Flag-Deaktivierung und Cache-Isolation sind geprüft; ungeprüfte oder inkompatible Netzwerkbewertungen werden nicht als Erfolg angezeigt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /calendar, /analytics, /drafts/:id. Account/channel-aware variants, independent schedule/result display and separate account/channel baselines with missing metrics. Grenze: No real network-fit analysis or universal reach score. Mock composer analysis is clearly limited. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
