# Task33.2 unit6B — SPEC PASS

## Freeze and scope
All 11 hashes in the updated `/tmp/task33-auth-admission-freeze.json` match, including after targeted verification. Re-review covers the previously concrete repeat-deletion defect and its effect on retained original-artifact/generation barriers. Only authAdmission.ts and authAdmission.test.ts changed in the repair; pinned SDK patch and prior fresh-install source/dist parity remain applicable.

## Repair verified
`convex/operations/authAdmission.ts:554–560` advances an existing digest's job reference only when a distinct validated sealed job has a stronger fixed retentionUntil. Digest/creation timestamp remain stable; same-job retries do not move deadlines; earlier job audit retention stays unchanged. Missing prior job leaves the existing fence conservative because latestFence yields Infinity. The new job reference feeds the already-required new-root originalStartedAt cutoff and native account email/provider fenceTime; proofs from before the new cooldown therefore cannot use the first job's expired barrier. Exact current nonce, full canonical HMAC, lease expiry, authId/generation, and immutable provenance checks remain unchanged. The repair does not remove replay fences or add a permanent email/provider ban.

Targeted native regression independently run: `node_modules/.bin/vitest run convex/operations/authAdmission.test.ts -t 'second deletion refreshes email cooldown'` — 1 passed, 12 skipped. Reviewed the test: both email/provider digests point to the second job; repeated fencing preserves digest rows and deadlines; earlier job remains expired; current exact-nonce/full-HMAC native user creation during second cooldown returns committed null, preventing its account/session continuation. This is the regression previously RED against the frozen original source.

No remaining actionable spec defect established in the bounded reviewed unit. Prior inspection covered actual app admission/HTTP source, native SDK source+dist patch, authorization/deletion-status changes, and agreed final protocol sections 155–end. Routine reported 28 focused tests and backend TypeScript/format are trusted rather than repeated.

## Limits
No broad suite/build/browser, new preflight, installation repeat, deployment, live provider transport, live erasure, Git or Backlog changes. Synthetic native regression does not certify live rollout or end-to-end physical erasure. Retained content-free replay/provenance metadata and preserved unsupported/unowned artifacts remain disclosed.
