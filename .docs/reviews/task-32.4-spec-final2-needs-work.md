# TASK-32.4 — fresh SPEC final2: NEEDS_WORK

Frozen source: `bced26578ef17ac628359c574c0f30746b33e73a`; freeze SHA256 `1d3cb5100c0853e2a7d052c2c2b7d16dd7d114d6584d6bbbddc27bbfb111d4c2`. Source-ready SHA256 `e900b1ac26cc406a692771fdd2584dd6ba33cb0dda4ba32f187cf0602278d6ef`.

## Reproduced defect

**P2 — a settled expired command permanently locks the same mounted Publishing inbox.** `src/features/drafts/review.tsx:875–890` filters the expired rows before deriving the deadline passed to `useNativeCommand`. When a pending read crosses its original finite `sourceUntil`, the last row disappears and the hook receives `null`. Consequently the hook’s `expired` cleanup (`:45–54`) never runs. Its late ACK is correctly rejected by `originalUntil` inside `valid()` (`:61–68`), but `finally` (`:90–95`) also uses that time-sensitive predicate and never clears the still-owned ticket/busy state.

The independent actual-App control starts a read while a row is valid, advances the installed browser clock by 501ms past the 500ms horizon, confirms the link disappears, settles the original correlated ACK, then supplies a **distinct next-episode id/version with a fresh finite 60s horizon** in the same native scope. Its new read button remains disabled for the full 5s assertion timeout. This is a local UI liveness defect; no unauthorized payload or duplicate provider POST was observed.

Exact stronger RED control: `/tmp/dispatch-32.4-spec-final2-next-episode.browser.mjs`, failing `toBeEnabled` at line 1977; log `/tmp/dispatch-32.4-spec-final2-next-episode-browser.log`, exit 1. The earlier control `/tmp/dispatch-32.4-spec-final2-expiry.browser.mjs` is also preserved unchanged (exit 1); it re-presented the same synthetic row with a null horizon, so the distinct-new-episode confirmation is the decisive control. Both use the existing local native transport fixture with the frozen actual App, Store, hook and production CSS, not a replacement implementation.

Repair boundary: central shared `useNativeCommand` should distinguish mounted/scope/epoch/ticket ownership cleanup from deadline-dependent result/error acceptance. Keep late results invisible and do not let an old ticket clear a newer command. Merely passing the minimum from expired cached rows can leave later valid rows permanently locked. A fresh scoped regression should cover a pending command crossing expiry, a late settled ACK/error, and a new currently proved episode.

## Independently verified scope

- Read CLI TASK-32.4, source release and birth-minimum/transport/capture clarifications; all ten owned-path diffs, the complete new notices backend and registered tests, the added Publishing UI, shared command hook and clock, original failure callers/review-source dependencies, cleanup dispatch and original transport projection.
- `node node_modules/vitest/vitest.mjs run convex/publishing/notices.test.ts tests/editorial.test.ts tests/reviews.test.ts tests/x-thread.test.ts`: **180 tests / 4 files PASS**, exit 0 (2.79s).
- Unmodified `tests/operations.browser.mjs`: **PASS**, actual App/Store/production CSS at 1280/390, own fresh evidence directory. Transport is a local synthetic fixture; no provider calls. Existing 171 assertions remain in original AST order, 207 current / 36 new / zero superseded. Narrow App label/visibility correction preserves Demo’s existing handler and label.
- Native controls cover immutable failure birth/original recipient and distinct approver, continuation without ownership renewal, missing/expired/malformed proof, own-only pagination before caps, atomic/idempotent read/dismiss up to 25, private transport exclusion, immediate source-loss masking, bounded rootless/multi-page physical cleanup, unexpected error propagation/rollback, legacy unchanged pending evidence and genuine synthetic late ACK. Whole-entry two-stage 25-row read/dismiss uses at most 640 queries/docs, 512KiB read bytes and 64KiB wire. These are measured installed-native limits, not a production concurrency guarantee.
- Browser controls cover loaded-only counts, current auth/session/workspace/account/role correlation and ABA remounts, generic private errors, expiry hiding, entropy/retry and local-vs-native button distinction. The added independent combined pending/expiry case fails despite the original harness passing.

## Provenance and limits

All 353 frozen source/config files match before and after, including 338 protected old nongenerated files and five generated files; inventory has no extra/missing source paths. HEAD and human `.zcodeignore` unchanged. Source-ready historical RED/failed-setup logs remain hash-exact. No repository, task, documentation, generated file, environment, provider or persistent database changes were made by this review.

Root reported interrupting the single whole-native final2 run after this defect (exit 130); it is not a PASS. No whole-suite, Dev deployment, manual acceptance, actual mail/POST delivery or production OCC claim is made here. Separate QUALITY and final acceptance remain pending a repaired fresh freeze.
