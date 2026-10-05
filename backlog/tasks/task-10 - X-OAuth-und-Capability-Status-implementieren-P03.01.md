---
id: TASK-10
title: X-OAuth und Capability-Status implementieren (P03.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 11:49'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bestehende Social-Account-, Freigabe- und Konfigurationsverträge übernehmen; aktuelle X-OAuth2-Dokumentation prüfen.
2. D06 als einen aktiven Publishing-Workspace je Provider-Identität umsetzen: kein stilles Übernehmen; zuerst autorisiertes Trennen im bisherigen Workspace, danach expliziter frischer OAuth im neuen. Alte Inhalte/Freigaben werden nicht übertragen.
3. Einmaligen actor-/workspace-gebundenen PKCE-State, getrennte verschlüsselte Server-Tokens, koordinierte Refresh-Generationen und Wiederverbindung derselben Identität implementieren.
4. Account-Verwaltung mit realen Metadaten, nachgewiesenen Capabilities und konkreten Konfigurations-/Reauth-Zuständen verbinden.
5. Foreign-State, Replay, parallele Refreshes, Disconnect und Identitätskonflikte prüfen; keine unangekündigten öffentlichen Testposts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /settings/integrations. Mock social account connection, reconnect/disconnect and account/instance metadata. Grenze: No X OAuth/PKCE/tokens/refresh. Connection labels explicitly describe simulated publishing. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

D06-Implementierungsentscheidung innerhalb der vom Nutzer übertragenen Freiheit: ein aktiver Publishing-Workspace je Provider-Identität, expliziter Disconnect vor einer neuen Bindung, keine automatische Cross-Tenant-Verknüpfung/Übernahme oder Übertragung alter Freigaben. Live Callback-/Scope-/Zugangsnachweise bleiben getrennte Abnahme; keine Consumer- oder historischen V1-User-Tokens einsetzen.

Implementation starts after TASK-9 independentSPEC/QUALITY PASSfe3af37. Fresh unit implementer owns X OAuth/PKCE, separateencrypted credentials, generation-safe refresh/disconnect and concrete authenticated settings/callback. Root owns Backlog. Current X primary docs prepared; D06 explicitdisconnect/freshOAuth crossworkspace and D16 evidence-only capability apply. Missing configuration visible, no publicposts/realOAuth/manual evidence claimed. One fresh implementer, sequential SPEC and QUALITY before publisher subunits.

CLI clarification verified via current Context7 and installed Convex1.46 primary source: codegen may upload bundles for deployment-side analysis/type generation but does not activate running functions (runCodegen has no finishPush). Initial provisional activation interpretation corrected. Full tests/typecheck then convex dev --once performs actual existing-Dev activation. No credentials/provider effects from this read-only verification; receipt /tmp/dispatch-convex-cli-receipt.md.

Review head49d9402 frozen (production9b31e50, lasttests-only). Worker reportsfull89unit/final19OAuth checks/type/lint/build/seededbundle and actualtest:x-oauth StrictMode/denial/workspace/unmount/config/awaitedcommands PASS. ExistingDev accurate-lion-749 activated13:40:59 afterchecks; no liveOAuth/refresh/providerwrite/revoke/envsecretsread/set. SeparatexOAuthStates/xCredentials/xBindings/xOAuthFence inventory and key-ID/previouspair/manualgates documented in .docs/x-oauth-domain-contract.md. NewOAuthconnectionsequence pins schedules/internalcredentialgate, refreshretainssequence. IndependentSPEC nowrunning, QUALITY afterPASS; rootauthbrowserregression separatelyrunning5175 withemailsintercepted. No Done.

IndependentSPEC PASS49d9402:19/19OAuth tests +actualtest:x-oauth browser passed (sandboxlistenerEPERM retriedescalated,5174closed). Fulltask authorization/state/PKCE/crypto/keyrotation/globalbinding/fencing/refreshCAS/unknownoutcome/connectionsequence/internalcredentialgate/realUI/inventory checked; no findings/edits/provider effects. Rootauth5175regression3/3PASS withemailsintercepted closed. Full independentQUALITY nowrunning; live/manualgates open and statusInProgress.

IndependentcompleteQUALITY NEEDS WORK49d9402:1Important/0Critical/nootherconfirmeddefects. SharedvalidToken accepts nonASCIIU+0100; actualparser smallfixture succeeds while nativeAuthorizationHeaders throws. Initial/mefailssafe, refreshexchange maypersistbadtoken/reportsuccess. Originalimplementer assignedtestsfirstmalformedrefresh thenshared printableASCII/headersafe validation, reauthunknown+secretremoval/no success assertion and regressions. 19focusedtestsPASS; auth/fence/crypto/CAS/lifecycle/bounds/sequence/UIotherwisehold. Querycachingtime investigatednotconfirmed/notfinding. SPECthenQUALITYrereviewbeforepublisher; externalmanualgatesopen.

Tokenboundarycorrection frozen75088c3:3negativechecks failedbeforefix; sharedvalidToken printable nonwhitespaceASCII0x21..0x7e acrossinitial/refresh/access/refreshToken. Malformedrefresh X_REFRESH_OUTCOME_UNKNOWN removescipher+reauth/no successfulreturn. Worker22OAuth/92fullunit,type/lint/build/bundlePASS,existingDevactivated13:49:16; UIunchanged/priorbrowserholds. No provider/enveffects. RenewedSPECnowrunningthenQUALITY; actualgatesopen,statusInProgress.
<!-- SECTION:NOTES:END -->
