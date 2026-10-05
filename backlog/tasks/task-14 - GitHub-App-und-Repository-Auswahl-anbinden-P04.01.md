---
id: TASK-14
title: GitHub-App und Repository-Auswahl anbinden (P04.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 12:59'
labels:
  - p04
  - r2
milestone: m-2
dependencies:
  - TASK-5
  - TASK-1
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P04.01.
Phase: P04 – GitHub und Arbeitssignale.

**Abhängigkeit:** P01.02, P00.01. **Dateien:** `convex/integrations/github/app.ts`, `convex/integrations/github/repositories.ts`, `src/features/settings/github.tsx`; Test `convex/integrations/github/app.test.ts`.

- Installation, persönliche und Organisations-Repositories sowie erlaubte Auswahl synchronisieren.
- Zugriff, Monitoring und Content-Erzeugung als getrennte Einstellungen modellieren.
- Entzug einzelner Repositories und Deinstallation verarbeiten.
- Projektkontext und erlaubten Umgang mit privaten Änderungen pro Repository erfassen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D05: Erlaubten Umfang privater Repository-Daten bestätigen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Nur freigegebene Repositories sind sichtbar.
- [ ] #2 deaktivierte Quellen erzeugen keine neuen Content-Aufträge.
- [ ] #3 GitHub-Login bleibt unabhängig.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse current verified session/workspace authorization and separate GitHub login from App-source access.
2. Implement least-privilege App JWT/installation token and installation/repository synchronization; missing App private key remains visibly unconfigured.
3. Apply chosen D05: explicit per-workspace repository selection, separate access/monitoring/content settings, limited communicable context, private file/diff model use separately consented and region-gated.
4. Handle repository access removal and installation deletion with immediate source barriers, preserving historical provenance without new work.
5. Wire genuine settings/source state and independently review requirements and quality; actual configured repository/manual proof stays explicit and no automatic Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/integrations, /onboarding. GitHub-login and repository-App installation are separate mock controls; repository selection/monitoring, event scope and private-context consent. Grenze: No GitHub App permission synchronization or actual repository data. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

D05 implementation scope chosen by root under the users explicit delegated decision authority on2026-10-05; see domain-contracts.md. This selects bounded opt-in contracts, not actual private-source/model activation or a legal/EU proof. Missing GITHUB_APP_PRIVATE_KEY continues as visible setup guidance per latest user answer.

Readonly current official GitHub docs confirm setup installation_id can be spoofed: per-workspace binding must verify GitHub App user authorization plus accessible installation/repository intersection. Global App JWT/installation token and GITHUB_APP_INSTALLATION_ID are not a human/tenant authorization proof. App source OAuth stays separate from BetterAuth GitHub login; missing required App client configuration must be visible rather than bypassing proof. Receipt /tmp/dispatch-github-authorization-docs.md; current TASK-10 crypto/auth patterns may be reused only where concrete contracts match.

Read-only future implementation prep after TASK-10 settles: separate source GitHub-App USER authorization must prove accessible installation/repository intersection; global AppID/installation env cannot authorize tenant. Exact current docs /tmp/dispatch-github-authorization-docs.md and scoped brief prepared. UI tracing found real /signals currently renders unconditional mock signalSeed and unavailable local handoff; TASK-14 source guidance must guard that real path empty/config until genuine TASK-15 ingestion, preserving explicit demo. No code/provider effects from prep; actual scope remains separate access/monitoring/content/private purpose D05.

Additional read-only current App OAuth/JWT prep: Context7 library-first official /github/docs plus2docs (3commands, no quota error), independently verified primary App-user-token/JWT/refresh guides. App-user flow supports S256 PKCE; fine-grained app/user intersection has empty traditional scope; clientID differsAppID. Expiring access8h/refresh6months and refresh invalidates old pair require lease/CAS/unknown-safe reauth. Current examples API header2026-03-10; native RS256 JWT iat-60s/exp<=600s/clientIDpreferred. Receipt /tmp/dispatch-github-oauth-jwt-current-docs.md. No implementation/provider/private-repo call; TASK12.3 still active, TASK14 awaits publishing reviews.
<!-- SECTION:NOTES:END -->
