# TASK-9 — staged R2 media validation

Date: 2026-10-05. Work directly on master. Backlog remains In Progress until explicit user confirmation after manual testing. Missing provider access is handled with visible configuration guidance, as requested by the user.

## Review-ready code

`33663d3` implements temporary upload sessions, conditional immutable R2 final writes/readback, bounded media validation, quota reservation, expiry-aware cleanup, indexed historical references, lifecycle barriers, paginated library, private previews and version-bound alt metadata. Inventory and supported runtime ceilings: [media domain contract](../media-domain-contract.md).

Implementer evidence: 58 unit checks, frontend/Convex typecheck, formatting, build, seeded bundle security and two calendar/comment browser checks passed. Configured Convex dev updated at 12:32:36; internal cleanup Node smoke exercised the missing-configuration path without records or external writes. These reported checks are separate from independent checks below.

Root independently ran the complete browser suite at the frozen media code: `pnpm test:e2e`, 34/34 passed in 2.0 minutes on isolated port5174. Most product checks exercise the explicit demo; this is regression evidence, not authenticated live R2 acceptance.

## Independent SPEC review — NEEDS WORK at 33663d3

The reviewer independently ran 16 targeted media/backend/UI checks and two safe counterexample checks. All ran successfully; the counterexamples demonstrate three defects:

1. P1: A second CRC-valid PNG IHDR changes decoder metadata after only the first IHDR was checked. A small duplicate header with interlace=1 reaches pngjs's unbounded inflate path; changed dimensions also evade predecode bounds. Reject malformed/duplicate headers before decoding, rather than checking after allocation.
2. P2: Composer attachment selection reads only the initial resources list. A newly uploaded asset beyond the first101 is reachable in the paginated library but cannot acquire its first draft reference through the picker. Reuse the authorized paginated inventory for attachment selection.
3. P2: A second historical-version page carries versions without their media descriptors. An older version referencing an asset outside the initial resources/detail windows retains its alt text but cannot display/restore the asset. Load and merge the authorized descriptors required by each history page.

Safe reproduction: `/private/tmp/dispatch-r2-spec.test.ts`, invoked with `pnpm exec vitest run --config /private/tmp/dispatch-r2-spec.config.mts`. This temporary evidence is not a durable repository regression until the implementer adds the negative checks.

The three corrections are committed in `f381e39`: strict PNG chunk metadata/order checks before decode; the existing paginated inventory reused by Composer; shared authorized version-asset descriptors returned with history and merged in the real store. Committed negative checks reproduced the defects before correction. Implementer evidence on the corrected source: 62 unit checks, typecheck, formatting, build, seeded bundle security and four targeted browser checks passed. Configured Convex dev updated at 12:44:09. No new schema, jobs or dependencies were added by this correction.

Root independently ran `pnpm audit --prod` on the updated pinned production dependencies: no known vulnerabilities found.

## Independent SPEC re-review — PASS at f381e39

Four committed targeted files: 20/20 checks passed independently. The original safe PNG exploit was changed to require rejection, and the inventory/history counterexamples were reconstructed against the corrected DTOs: two further checks passed. The reviewer verified predecode PNG bounds,50-item Composer pagination, workspace-filtered history descriptors bounded by20 versions×20 references and exact historical alt restoration.

## Independent QUALITY review — running

The reviewer reproduced a P2 StrictMode bug in the actual MediaLibrary using an isolated Vite/Playwright fixture on port5174, with production source unchanged. Its mounted-ref effect cleanup sets `mounted.current=false`, but setup does not restore true. React StrictMode's setup/cleanup/setup cycle therefore suppresses successful command notifications and the `finally` busy reset. An initially enabled delete button remains disabled after successful completion.

Temporary evidence: `/tmp/dispatch-r2-quality-browser.mjs` and `/tmp/dispatch-r2-strictmode-success.png`. The fixture server was closed.

The reviewer also reproduced a P1 MP4 predecode-validation gap using two small bounded fixtures: the Vorscan treats `dref` entries as opaque while MP4Box parses their children. An unsupported table child exceeds the advertised sample-count ceiling, and a nested child exceeds the advertised depth ceiling, yet both are accepted. The supported self-contained data-reference structure must be validated before library parsing. Safe temporary checks: `/tmp/dispatch-r2-quality.test.ts` and `/tmp/dispatch-r2-quality.config.mts`,2/2 passed as counterexamples. No large resource-exhaustion fixture was run or requested.

The review agent was interrupted by an automated content filter after reporting these two findings; the full QUALITY review did not complete and no PASS is claimed. The implementer is assigned scoped defensive corrections plus small negative regressions. A fresh independent reviewer will inspect the complete corrected unit, including remaining UI/lifecycle paths. The next provider implementer starts only after QUALITY passes too.

## Corrections frozen at a51f9ed — renewed reviews pending

Tests-first commit `1e494b1` reproduces the two findings with bounded inputs and the actual React component. `a51f9ed` corrects mounted lifecycle handling and validates the supported MP4 data-reference/recursive AAC descriptor forms before MP4Box. Only two production files change; schema, jobs and dependencies are unchanged. Supported forms and inventory are recorded in the media contract.

Implementer evidence:64 unit checks, eight targeted media-byte checks, actual `pnpm test:media-lifecycle` browser checks for success/failure/unmount/workspace change, typecheck, formatting, build and seeded bundle checks passed. The valid small H.264/AAC fixture also decodes with FFmpeg. Configured Dev updated at12:58:28. Renewed SPEC review is running; the fresh complete QUALITY review follows only after its PASS. No final quality/release claim is made yet.

## Independent renewed SPEC — PASS at a51f9ed

The reviewer independently ran four targeted files:22/22 unit checks passed. The actual isolated `pnpm test:media-lifecycle` browser check passed for StrictMode success/failure and true unmount/workspace replacement; server/browser closed. The reviewer verified the supported bounded MP4 metadata before decoding, valid H.264/AAC fixtures, preserved previous corrections and unchanged schema/jobs/dependencies. The fresh reviewer is now performing the full-unit QUALITY audit. External acceptance gates below remain open.

## Fresh complete QUALITY — NEEDS WORK at a51f9ed

The full audit confirms the prior corrections and core authorization, immutability, quota, generations, reference deletion and lifecycle mechanisms. Four findings remain:

1. P1: MP4 table bounds are individual, while unsupported track counts are rejected after MP4Box already allocates their sample lists. A tiny three-track fixture demonstrates three sample-list builds before rejection. Enforce supported track count, whole-file sample-allocation budget and structural-table uniqueness before parsing; no stress fixture is needed.
2. P2: `MIME_LIMITS["toString"]` resolves an inherited property, making the numeric preparation check ineffective. A small unsupported-MIME reservation is admitted. Require supported own numeric entries in the shared lookup.
3. P2: Replaying preparation after changing the configured bucket signs the session's old bucket, while finish/preview/cleanup reject that binding. Reject storage-binding drift before signing; do not issue an unusable grant.
4. P3: The native file input's key changes on selection, remounting it and clearing the visible filename while the File remains buffered. Preserve the input across selection and reset only after accepted success.

Independent evidence:22 targeted checks and the actual lifecycle browser check passed. Additional actual uploader/preview checks passed for failed-upload buffer preservation, cancellation during preparation, stale workspace responses and renewal after error. Counterexamples: `/tmp/dispatch-r2-quality-final.test.ts` with `/tmp/dispatch-r2-quality-final.config.mts`; UI evidence: `/tmp/dispatch-r2-quality-async.browser.mjs`. Servers/browser closed, source unchanged, no real provider writes. Worker corrections and re-review are pending. A narrow follow-up checks whether physical account/endpoint drift is the same storage-binding cause; it does not assume credential rotation should invalidate a stable namespace.

## Actual acceptance still open

An approved existing private bucket with actual EU jurisdiction and restricted S3 access, browser-origin CORS, live signature/size enforcement, conditional-write/runtime/race probes, late-PUT cleanup and authenticated manual upload/abort/preview-refresh/replacement evidence remain open. No bucket, public post or test email was created. An EU location hint or a passing synthetic test does not satisfy those checks.
