---
id: TASK-45
title: Content Pillars und korrigierbare Style Profiles einführen (P12.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 13:21'
labels:
  - p12
  - r5
milestone: m-5
dependencies:
  - TASK-18
  - TASK-27
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P12.01.
Phase: P12 – Persönliche Stimme, strategische Planung und kontinuierliche Verbesserung.

**Abhängigkeit:** P05-Feedback, P08-Audience-Versionierung. **Dateien:** `convex/content/pillars.ts`, `convex/ai/styleProfiles.ts`, `src/features/settings/content-strategy.tsx`; Test `convex/ai/styleProfiles.test.ts`.

- Thematische Säulen, gewünschte Gewichtung, Schreibbeispiele, verbotene Formulierungen und wiederkehrende Positionierung erfassen.
- Aus freigegebenen eigenen Texten und Korrekturen Lernvorschläge ableiten.
- Profiländerungen erklären, versionieren, durch Nutzer korrigierbar machen und bei Bedarf zurücksetzen.
- Tatsächliche persönliche Erfahrungen von bloß gewünschtem Ton unterscheiden.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Stilprofil erfindet keine Biografie oder Erfolge.
- [ ] #2 der Nutzer kann erkennen, warum eine Formulierung bevorzugt wird, und unerwünschtes Lernen rückgängig machen.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/strategy. Editable pillars/weights, writing samples, forbidden phrases and positioning; separate committed/form state, version history, suggestion accept/reject/reset/undo. Grenze: No automatic style learning or inferred biography. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Fortsetzungsvorbereitung 2026-10-06, keine Implementierung: Root hat /tmp/dispatch-continuation-45-47-seams.md und reale Settings/Feedback/Generation-Verbraucher gelesen. StrategySettings ist weiterhin lokal; persönliches preferences/audience/tone darf nicht automatisch accountweite Autorität werden. Nach43.3/44 zunächst kleiner nativer deklarierter Account-Stilvertrag mit expliziter Autorenschaft, unveränderlichen Versionen, menschlich bestätigten Korrekturvorschlägen und Rollback. Säulen können im gemeinsam versionierten Payload liegen; kein eigener Tabellenapparat nötig. Gewünschter Ton/Beispiele sind keine nachgewiesene Biografie. Tatsächlicher Generator liest derzeit mutable tone; exakter Stil-Pin und aktuelle Quellen-/Zweckprüfung gehören in ein separat freigegebenes Folgepaket, keine automatische Provider- oder Lernfreigabe. Vor Writerstart konkrete Unteraufgaben/AC und Vertrag erstellen. TASK46/47 erst danach; Label-Diversität/Codepoint-Änderungen sind keine semantische Ähnlichkeit, Editing-Zeit oder unabhängige Experimentproben.
<!-- SECTION:NOTES:END -->
