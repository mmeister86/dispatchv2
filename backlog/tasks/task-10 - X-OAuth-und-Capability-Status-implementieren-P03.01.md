---
id: TASK-10
title: X-OAuth und Capability-Status implementieren (P03.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-04 19:25'
labels:
  - p03
  - r1
milestone: m-1
dependencies:
  - TASK-1
  - TASK-5
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P03.01.
Phase: P03 – X-Verbindung, zuverlässiges Publishing und Kalender.

**Abhängigkeit:** P00.01, P01.02. **Dateien:** `convex/integrations/x/oauth.ts`, `convex/integrations/x/client.ts`, `convex/lib/crypto.ts`, `src/features/settings/social-accounts.tsx`; Test `convex/integrations/x/oauth.test.ts`.

- OAuth-State und PKCE kurzlebig, einmalig und an Nutzer/Workspace binden.
- Tokens verschlüsselt serverseitig speichern, Erneuerung koordinieren und Schlüsselrotation vorsehen.
- Account-Metadaten und verfügbare Fähigkeiten ohne Credentials an den Client liefern.
- Trennen, erneutes Verbinden, widerrufene Tokens und parallel laufende Refreshes behandeln.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D06: Publishing-Workspace je Provider-Account festlegen.
- D16: Besondere X-Fähigkeiten nur mit belegtem Zugang anbieten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Falscher oder wiederverwendeter State wird verworfen.
- [ ] #2 Token-Refresh überschreibt keine neueren Credentials.
- [ ] #3 gesperrte Accounts wechseln in einen sichtbaren Reauth-Zustand.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/integrations. Mock social account connection, reconnect/disconnect and account/instance metadata. Grenze: No X OAuth/PKCE/tokens/refresh. Connection labels explicitly describe simulated publishing. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.
<!-- SECTION:NOTES:END -->
