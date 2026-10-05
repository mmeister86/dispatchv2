# Editorial validation — TASK-7/8/11/13

2026-10-05 · master · code commits `9376587`, `6eea458`, `2079e68` · current-scope SPEC PASS; independent QUALITY review pending.

## Verified code scope

Persisted immutable single/thread versions and account references; compare-and-save revision conflicts; explicit awaited UI commands; exact human version/account approvals and revocations; retained planned snapshots and explicit newly approved replacement; atomic scheduler registration, generation claims, cancellation ordering; UTC instants with retained IANA/local intention; bounded history and calendar queries; version-bound comments and real current-member assignment; durable sanitized events and notification states.

See [domain contract](../editorial-domain-contract.md) for exact tables, limits and future inventory/deletion obligations. Provider enrollment, R2 assets and X publishing belong to subsequent units. The current dispatcher reports `PUBLISHER_NOT_CONFIGURED` and never invents published IDs.

## Evidence

- Root independently ran all unit tests at `2079e68`: 7 files, 40 tests passed; earlier full frontend/Convex typecheck passed at `6eea458`.
- Implementer reports full typecheck, formatting check, production build and seeded-secret bundle check passing at the fix commit. Actual Convex Dev update succeeded at 12:00:15 on the configured development deployment; no production deployment.
- Initial demo E2E run: 31 of 32 passed; one Agent test was interrupted by implementer Vite HMR. After freezing source changes, the focused Agent rerun passed. Real public-auth navigation regressions: 3 passed. These are not authenticated editorial acceptance.
- Independent SPEC reviewer reproduced browser/profile timezone inconsistency and a generic configuration destination at `6eea458`. Both were repaired at `2079e68`; independent re-review ran all 40 unit tests, the LA-browser/Berlin-profile calendar E2E and the seeded-secret bundle check successfully.
- Calendar checks include civil-date labels/ranges/navigation, Berlin 23/25-hour DST days and Havana missing/overlapping midnight. Profile timezone changes retain stored UTC appointment values.
- Configuration guidance displays required key names as prose; it reads no secret values. The bundle check permits three necessary inert names only in the Settings chunk, while rejecting injected secret values in every JavaScript chunk.

## Remaining acceptance

Manual authenticated Composer/workspace-switch checks; real authorized account enrollment, J02/J08 publishing and media transfers in later provider units; verified email sender and actual delivery. No accounts were enrolled, no public test posts or test emails sent, no live R2 resources created by this unit.

Backlog tasks remain In Progress until explicit user confirmation after manual testing. Automated checks do not close tasks or establish the complete product/release promise.
