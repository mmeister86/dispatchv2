---
id: TASK-14
title: GitHub-App und Repository-Auswahl anbinden (P04.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 14:38'
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
1. Begin after TASK12.3 final7734008 independent SPEC/QUALITY PASS; read current App-user OAuth/JWT proof contracts and existing authorization/crypto/UI callers.
2. Implement separate verified human App-source OAuth with one-use PKCE and tenant/role/lifecycle fences, bounded human/App installation-repository intersection and encrypted credentials; missing configuration remains visible.
3. Persist explicit per-workspace authorized repository selection with independent access/monitoring/content purposes, bounded communicable private context and source-generation revocation barriers.
4. Reuse settings/onboarding/callback patterns with awaited commands and StrictMode-safe cleanup; GitHub login stays independent. Guard real Signals against unconditional demo seed/handoff until TASK15 factual ingestion.
5. Test spoofed installation/foreign authority/intersection/stale sync/disconnect/refresh/purpose barriers and actual affected UI; full checks, existing EU Dev, inventory/contract and scoped freeze commits.
6. Fresh independent SPEC then QUALITY, fix and re-review; document live/manual gates and no automatic Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/integrations, /onboarding. GitHub-login and repository-App installation are separate mock controls; repository selection/monitoring, event scope and private-context consent. Grenze: No GitHub App permission synchronization or actual repository data. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

D05 implementation scope chosen by root under the users explicit delegated decision authority on2026-10-05; see domain-contracts.md. This selects bounded opt-in contracts, not actual private-source/model activation or a legal/EU proof. Missing GITHUB_APP_PRIVATE_KEY continues as visible setup guidance per latest user answer.

Readonly current official GitHub docs confirm setup installation_id can be spoofed: per-workspace binding must verify GitHub App user authorization plus accessible installation/repository intersection. Global App JWT/installation token and GITHUB_APP_INSTALLATION_ID are not a human/tenant authorization proof. App source OAuth stays separate from BetterAuth GitHub login; missing required App client configuration must be visible rather than bypassing proof. Receipt /tmp/dispatch-github-authorization-docs.md; current TASK-10 crypto/auth patterns may be reused only where concrete contracts match.

Read-only future implementation prep after TASK-10 settles: separate source GitHub-App USER authorization must prove accessible installation/repository intersection; global AppID/installation env cannot authorize tenant. Exact current docs /tmp/dispatch-github-authorization-docs.md and scoped brief prepared. UI tracing found real /signals currently renders unconditional mock signalSeed and unavailable local handoff; TASK-14 source guidance must guard that real path empty/config until genuine TASK-15 ingestion, preserving explicit demo. No code/provider effects from prep; actual scope remains separate access/monitoring/content/private purpose D05.

Additional read-only current App OAuth/JWT prep: Context7 library-first official /github/docs plus2docs (3commands, no quota error), independently verified primary App-user-token/JWT/refresh guides. App-user flow supports S256 PKCE; fine-grained app/user intersection has empty traditional scope; clientID differsAppID. Expiring access8h/refresh6months and refresh invalidates old pair require lease/CAS/unknown-safe reauth. Current examples API header2026-03-10; native RS256 JWT iat-60s/exp<=600s/clientIDpreferred. Receipt /tmp/dispatch-github-oauth-jwt-current-docs.md. No implementation/provider/private-repo call; TASK12.3 still active, TASK14 awaits publishing reviews.

Fresh SDD TASK14 implementation starts on master after finalTASK12.3 source7734008 independent SPEC/QUALITY PASS, ROOT metadata4744ad8. Scoped complete brief /tmp/dispatch-github-app-implementation-brief.md; current official receipts /tmp/dispatch-github-authorization-docs.md and /tmp/dispatch-github-oauth-jwt-current-docs.md. Global AppID/installationID never tenant proof; separate human App OAuth intersection/purposes required. Real Signals seed leak belongs this unit; genuine event ingestion follows TASK15, AI after17/18. Missing privatekey/sourceOAuthconfiguration remains visible guidance per user instruction. No actual provider/private-repository/model call or manual acceptance claimed.

Initialer Source-Freeze aa6e021 (Backend753a7e6) auf master: Implementer215/215 Unit-Checks (14 GitHub), Type/Format/Build/Bundle-/Diff-Prüfungen und tatsächliche Callback-/Settings-/Signals-Fixture PASS. Scope separates App-UserOAuth/S256, Mensch/App/Repository-Intersection, verschlüsselte unknown-safe Credentials, ausdrückliche Quellen/Purposes, aktuelle15min-Proofs und Source-/Discovery-Generationen. One-repo metadata:read-Installationstoken intern mit Source-Recheck; Hintergrundrechte unabhängig UI-Workspace. Native Cleanup, drei Tabellen/abgefragte Indizes inventarisiert, ungenutzter Validator/Index entfernt. Eager Guidance-Import-Bundle-Befund ohne Abschwächen vorhandener Prüfungen korrigiert. Bestehende EU-Dev final16:25:19 aktiviert,5174frei/5173erhalten. Fresh SPEC läuft, QUALITY erst nach PASS; ROOT Auth-/Onboarding-Regressionsprüfung läuft. Nachweis .docs/reviews/task-14-github-app-validation.md. Keine Live-/manuelle Abnahme, kein Done.

ROOT unabhängig pnpm test:e2e:auth PASS: drei abgefangene Auth-Ziel-/Formularregressionen in4,4Sekunden; Fixture5175geschlossen, kein tatsächlicher Email-/Provider-Call. Fresh SPEC weiterhin in Prüfung, keine QUALITY-/Live-/manuelle Abnahme.

Fresh SPEC NEEDS WORK aa6e021: ein P2-UI-Freshness-Befund. Date.now in gecachter Convex-Query invalidiert idle UI nicht; nach15min bleiben Settings Zugriff geprüft/Controls und Signals-Quellen sichtbar. Frische Backend-/Sourceguards sperren korrekt, kein Effekt-Autorisierungsbypass. Tatsächliche Browserrepro /tmp/dispatch-github-app-spec-expiry.browser.mjs mit16min-Clock FAIL1statt0Label. Originalimplementer korrigiert gemeinsame konkrete Deadline-Anzeige beiderViews ohne DB-Poller/Expirytable/generischenService und ergänzt permanenteRegression. Unabhängig15registrierte+5Negatives+OriginalBrowserPASS, sonst keine fehlende/übermäßige14Scope. SPEC-Re-review vorQUALITY; keinDone/Live-/manuellerNachweis.

Expiry correction frozen c0944f0: shared concrete proof deadline/visibility hook updates idle Settings and Signals; dirty source context survives expiry/renewal, backend guards unchanged. Permanent actual browser expiry/renewal/visibility/StrictMode cleanup passes;216 full tests and type/lint/build/bundle/diff PASS, existing EU Dev activated16:33:57. Independent SPEC delta running before fresh QUALITY; no AC or status closure.

Independent SPEC PASS c0944f0:16 targeted registered checks, actual expanded browser and separate staggered-expiry/renewal/remaining-source/unmount checks pass without DB updates/actions. Original idle-expiry P2 resolved; no missing/excessive scope. Fresh independent QUALITY now running. Provider/manual gates remain open; status In Progress.
<!-- SECTION:NOTES:END -->
