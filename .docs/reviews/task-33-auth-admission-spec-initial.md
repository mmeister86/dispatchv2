# Task33.2 unit6B — SPEC NEEDS FIX

## Freeze and evidence
All 11 SHA-256 entries in `/tmp/task33-auth-admission-freeze.json` match, including after review. Inspected actual app admission/HTTP source, the native SDK source+dist patch, authorization/deletion-status changes, and final protocol sections 155–end of `.docs/reviews/task-33-auth-erasure-preflight.md`. Baseline is 6de8b2f. Unrelated diff files excluded. Routine reported 27 focused tests, TS/format and 2 fresh-install source/dist tests are trusted; not rerun.

## Concrete finding — refresh identity fences on repeated deletion
Severity: blocker for specified cooldown/fresh-generation policy.
Source: `convex/operations/authAdmission.ts:547` (`fencePreparedAccount` inserts only if absent), together with `:202` (`latestFence` returns retained fence's original job retentionUntil), `:331` (new-root cutoff) and `:412` (account admission cutoff).

After a first deletion cooldown ends, a user can deliberately register again. On deleting that new AuthID, its email/provider digest already exists, so `fencePreparedAccount` leaves the fence attached to the FIRST job. A current request during the SECOND job's cooldown therefore passes the old cutoff. This is not merely an unknown provisional birth: native account admission and exact generated session creation also succeed under that lease. A current state produced before the second deletion can similarly remain admissible against the first cutoff instead of being rejected as pre-second-fence provenance. Exact old-AuthID fencing remains intact but does not repair new-root email/provider cutoff.

Reproduction: isolated `/private/tmp/task33-auth-patch-repro/repeat-fence.test.ts`, using actual fresh installed @convex-dev/better-auth native adapter and convex-test. It initializes the fixed guard; creates/adopts an existing native root; seeds its email digest with an expired first job; creates a valid second sealed account job with future retentionUntil; invokes actual `fencePreparedAccount`; removes the old native account/root; issues current exact HMAC nonce approvals. Native user create returns a row, account create returns a row, and native session create returns a row. Expected new-root denial fails. Command: `node_modules/.bin/vitest run repeat-fence.test.ts` in that temporary project. One concrete failing regression; no source/test files in repository modified.

Suggestion: preserve retained digest while updating its effective cutoff/job provenance to the latest (or maximum) deletion barrier, so every deletion applies its own cooldown and original-state threshold. Cover second deletion of a deliberately reauthorized identity; ensure exact AuthID fence ownership remains sealed to its job.

## Limits
No broad suite/build/browser, deployment, live provider transport, live erasure, Git or Backlog changes. Reproduction uses synthetic trusted permits against native adapter, not live HTTP/provider. No end-to-end physical erasure certification. Other inspected required seams had no additional actionable gap established in this bounded review.
