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

The implementer has been assigned the three corrections and regression checks. SPEC re-review and the subsequent independent QUALITY review remain pending. The next provider implementer starts only after both pass.

## Actual acceptance still open

An approved existing private bucket with actual EU jurisdiction and restricted S3 access, browser-origin CORS, live signature/size enforcement, conditional-write/runtime/race probes, late-PUT cleanup and authenticated manual upload/abort/preview-refresh/replacement evidence remain open. No bucket, public post or test email was created. An EU location hint or a passing synthetic test does not satisfy those checks.
