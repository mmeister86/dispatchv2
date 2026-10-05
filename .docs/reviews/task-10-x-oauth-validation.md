# TASK-10 — staged X OAuth validation

Date2026-10-05. Work directly on master; Backlog remains In Progress until explicit user confirmation after manual testing. Missing provider configuration is surfaced visibly. No real OAuth/refresh/remote revoke/social post/email/bucket or remote Git push was performed.

## Frozen implementation

Review head `49d9402` (last commit tests only); production `9b31e50`, activated on existing accurate-lion-749 at13:40:59 via `pnpm exec convex dev --once`. Commits separate OAuth implementation, scheduled connection sequence, scope-loss correction, UI/browser/contract evidence and final test assertions. Inventory and actual configuration/manual gates: [X OAuth contract](../x-oauth-domain-contract.md).

Implemented verified actor/current-workspace Owner/Admin one-use S256 PKCE, separate native AES-GCM named-key ciphertext, true provider identity/global binding/transfer fencing, refresh generation/lease CAS and unknown rotating-token outcome recovery, explicit local disconnect and truthful remote-not-attempted status, public evidence instead of credentials, actual awaited Settings/callback and StrictMode-safe completion. Fresh OAuth connection sequence pins schedule/credential access; refresh preserves it. Initial publishing remains disabled until actual write evidence, separate from returned scope eligibility.

Implementer reports full89 unit checks, final19 targeted OAuth tests, frontend+Convex typecheck, formatting, build and seeded bundle scan passing. Actual `pnpm test:x-oauth` browser fixture passes StrictMode success, denial, workspace change, true unmount, missing config and awaited commands/failures. These reports are separate from independent reviews below.

## Independent reviews

Independent SPEC PASS on frozen49d9402:19/19 targeted OAuth tests and actual `pnpm test:x-oauth` passed. The first sandbox browser attempt hit localhost EPERM; exact command-specific escalated rerun passed and5174 closed. Reviewer verified complete authorization/state/PKCE/crypto/rotation/identity-transfer/refresh/sequence/credential-gate/UI/inventory scope with no required changes, edits or provider effects. Current root-only metadata does not alter production. Independent full QUALITY now running; no final quality or release claim yet.

Root independently ran the existing auth browser regression on isolated5175 with reset/verification endpoints intercepted:3/3 passed in4 seconds; no emails. First sandbox attempt failed binding localhost with EPERM; command-specific escalated rerun passed, not an application correction. Isolated server closed; user5173 untouched.

## Independent complete QUALITY — NEEDS WORK at49d9402

One Important finding, zero Critical findings and no other confirmed defects. Shared `client.validToken` accepts non-ASCII U+0100. A small actual-parser counterexample accepts `unicode-\u0100`, but native `Headers` rejects it in Authorization. Initial callback's `/users/me` fails safely; refresh does not make that identity request, so it may persist the unusable token and return success. Correct the shared boundary with supported printable ASCII/header-safe token validation and a malformed-refresh regression proving no success, reauth/unknown outcome and ciphertext removal.

The reviewer independently ran19/19 focused tests and traced complete transfer fencing, auth/lifecycle, key rotation/AAD, secret DTOs, generation/lease/unknown outcomes, inventory/cleanup bounds, connection sequences and actual callback lifecycle; these mechanisms otherwise hold. Date-sensitive query caching was investigated against current docs but not reported as a defect without proof. Reviewer made no changes or provider effects. Scoped tests-first correction assigned to original implementer; renewed SPEC then QUALITY required before TASK-12.1.

## Token correction frozen at75088c3 — renewed reviews pending

Three negative regressions failed before correction: malformed initial access token, malformed refresh token and malformed-access refresh falsely succeeding. The shared validator now requires printable non-whitespace ASCII (0x21–0x7e) for all initial/refresh access/refresh-token paths. Malformed refresh rejects with `X_REFRESH_OUTCOME_UNKNOWN`, removes ciphertext and marks the account `reauth_required`. No UI change or per-caller workaround.

Implementer reports22 targeted OAuth tests/92 full tests, typecheck, formatting, build and bundle checks passing. Existing Dev activated at13:49:16. Prior actual browser evidence applies to unchanged UI; no live provider/env effects. Renewed independent SPEC is running, then QUALITY re-review; actual gates below remain open.

## Actual acceptance still open

Confidential X OAuth2 client/app setup and exact registered SITE_URL callback; valid32-byte canonical Base64 encryption key with non-secret `INTEGRATION_ENCRYPTION_KEY_ID`, previous-key rotation exercise, real human account identity/scopes/refresh/role-workspace UX. No environment secret values read or set by implementer. Local disconnect does not prove remote grant removal; provider-side access removal remains explicit manual evidence. Actual entitlement/media/public test content and complete provider/EU/customer-data approval gates belong to later units and acceptance, not these synthetic checks. No Backlog Done.
