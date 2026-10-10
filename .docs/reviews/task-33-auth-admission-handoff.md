# Task33.2 unit6B handoff

Source writer frozen; no further edits. Exact 11 owned file hashes: `/tmp/task33-auth-admission-freeze.json`. Parent owns spec/quality review and commits. No Git, Backlog, deployment, real-provider transport or live erasure performed.

Implemented fixed bind-once component guard (pinned @convex-dev/better-auth 0.12.5, one reproducible pnpm patch), native birth/deadline journal, exact request-local nonce/HMAC permits, JWT issuance and immutable verification provenance, current credential/email/configured GitHub admission, retained replay fences with current reauthorization exception, bounded internal proof/capture/root-last purge primitives. RequireIdentity/bootstrap reject provisional/revoked roots. Narrow deletion status retains only original verified native-session metadata access until Auth-last.

## Verified commands

- `node_modules/.bin/vitest run convex/operations/authAdmission.test.ts convex/operations/deletion.test.ts tests/foundation.test.ts`: 28 tests / 3 files passed. Native cases cover legacy no-handle guard, reset orphan denial, committed null candidate purge, foreign admitted roots, pending expiry, credential/Date/null/full-field canonical binding, actual old-vs-current HS256 JWT same-email/new-root, parsed GitHub state/current callback versus paused old callback, late old state producer, exact generated session token nonce and replay, compiled runtime parity, original native-session deletion status, 25-row native purge/root-last proof.
- `node_modules/.bin/tsc -b --noEmit`: passed.
- `node_modules/.bin/tsc -p convex/tsconfig.json --noEmit`: passed.
- Owned-file `prettier --check`: passed (auth, authorization, schema, both operations/tests, generated api, workspace config).
- `pnpm patch-commit /private/tmp/task33-better-auth-patch --offline`: succeeded; final package includes source, runtime and updated declaration parity.
- Fresh project `/private/tmp/task33-auth-patch-repro`: copied package/lock/workspace/patch, set only temporary storeDir/cacheDir to existing repo's verified `.pnpm-store` and `.cache/pnpm`; `pnpm install --offline --frozen-lockfile --ignore-scripts` succeeded, initial 247 package install zero downloads, supply-chain policies passed. Final patch refresh also succeeded frozen/offline. First empty-cache attempt failed missing offline policy metadata; no integrity bypass was used.
- All 12 patched package files compared byte-identical between installed package and fresh frozen project.
- Fresh project `node_modules/.bin/vitest run parity.test.ts`: 2 tests passed (fresh SOURCE and compiled DIST fixed native guard, pending-session denial, singleton model CRUD refusal, configured health). Temporary fixture copies existing convex tree only; no repository fixture/code changes. Initial absolute external-root glob missed generated modules; fixed temp fixture root and reran green.

## Claims and limits

Internal initialization is required to bind fixed handles and stable private HMAC key. Configured health/expected revision gates eligibility; no public deletion start/runner is enabled. Current supported request admission is verified with synthetic native provider transport. Component admits normal unfenced legacy operation while unconfigured; unconfigured deletion eligibility is false. Configured fences require exact one-use current request proof; no global permanent email/provider ban.

New provisional native user rows may briefly exist; immutable 120-second deadline and exact empty never-admitted cleanup prevent usable session/app resurrection. No claim of zero ephemeral rows, physical end-to-end account erasure, coordinator completion or live deployment. Sealed job authority governs internal erasure primitives; known owned native children/verification are paged at <=25 and native user root is last. Retained content-free replay/provenance metadata persists. Unowned/unsupported verification state, global JWKS and rateLimit are preserved and explicitly not certified physically erased. Request deadline/recovery revokes generation/remaining permits; finally is convenience only.

No full baseline/build/browser validation was run, as directed. Parent should review the frozen diff once before committing/continuing Task33.

## Spec review correction (repeat deletion cooldown)

Existing identity digest fences now update their job reference when another sealed, validated deletion job has a later fixed retention deadline. The digest and original fence creation timestamp stay unchanged. Choosing the strongest proven deadline cannot shorten an existing barrier; same-job retry does not renew its original deadline, and older job audit retention is untouched. Metadata-free stale/replay denial and exact current permit checks remain in place. Missing prior job remains conservatively fail-closed.

Native regression adapted from `/private/tmp/task33-auth-patch-repro/repeat-fence.test.ts` first failed because existing email/provider fences still referenced the expired first job. It now verifies both fences select the second future cooldown, same-job retry leaves fence/deadline unchanged, earlier job retention stays expired, and native exact-nonce/full-HMAC user creation returns committed null during the second cooldown.

After correction: focused authAdmission/deletion/foundation suite 28 tests green; backend `tsc -p convex/tsconfig.json --noEmit` green; impacted two-file Prettier check green. No component patch changed, therefore previous fresh-install/source/DIST parity remains applicable and was not repeated. Updated exact 11-file freeze; stopped edits again.
