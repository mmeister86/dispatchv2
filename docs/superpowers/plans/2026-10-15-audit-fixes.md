# Audit Fixes — Implementation Plan

Source: ponytail-audit reports of 2026-10-14/15 on `main@3042eb8` (15 findings).
Worktree: `/tmp/opencode/dispatchv2-audit`, branch `fix/audit-findings`.

## Global Constraints

- Smallest fix that fully works. No new dependencies, no new abstractions, no config nobody asked for.
- Never cut: validation at trust boundaries, error handling that prevents data loss, security checks.
- Existing `ponytail:`/`shortcut:` comments with named limits are decisions, not defects — do not "fix" them.
- Per task: implement, run the covering tests (targeted `pnpm exec vitest run <file>` — the full suite takes >10 min, do not run it), `pnpm typecheck`, and Prettier on touched files (`pnpm exec prettier --write <files>`). Commit on `fix/audit-findings` with a conventional message.
- Write a report file per task (path given in the dispatch) and return only: status, commits, one-line test summary, concerns.
- Never dispatch subagents yourself.

---

### Task 1: Publishing attempts — scope the 100-cap to the current generation (+ direct tests)

Findings 1 + 7. `convex/publishing/attempts.ts:51-68`: `claim` loads `.take(101)` attempts scoped only by `scheduleId` and fails with `X_RECONCILIATION_REQUIRED` when total history across all generations exceeds 100, so a repeatedly retried thread can never publish again.

- Scope the main scan to the current generation via the existing index `by_scheduleId_and_generation_and_position` (`.eq("scheduleId", …).eq("generation", s.generation)`).
- Keep the cross-generation safety check (any older generation in stage `unknown`/`sending` blocks) but make it bounded without the 100-row total cap: paginate/scan older generations with early exit on first hit. Reuse patterns already in this file/codebase; do not invent a new helper if a loop over `paginate` works.
- Add `convex/publishing/attempts.test.ts` (convex-test, follow the harness style of neighbouring `*.test.ts` in `convex/`): claim → second claim rejected → lease expiry → reclaim → receipt called twice stays idempotent → >100 historical attempts in old generations no longer brick a fresh generation, while an old generation stuck in `sending` still blocks.
- Covering tests: the new test file + `pnpm exec vitest run tests/x-thread.test.ts`.

### Task 2: Auth email — timeout and body cancel

Finding 3. `convex/auth.ts:27-45` `sendEmail` does a bare `fetch` to Resend with no timeout; `convex/team.ts:989-1019` already does it right (10s abort + bounded body).

- Add `signal: AbortSignal.timeout(10_000)` to the fetch and `await response.body?.cancel()` after the status check, matching the existing behaviour/expectations in this codebase.
- Add or extend a test with a hanging fake fetch next to `convex/operations/authAdmission.test.ts` (or the nearest existing auth test file — check where `sendEmail`/auth flows are tested first; if none reaches it, test at the closest seam and say so in the report).
- Covering tests: that test file.

### Task 3: Auth admission tables — retention sweep

Finding 2. `convex/operations/authAdmission.ts` inserts `authLeases`/`authWritePermits`/`authEmailIssuance`/session/journal rows per auth request and never deletes them; account deletion explicitly excludes them (`convex/operations/deletionExecutor.ts:752-759`).

- Add one paginated internal sweep (copy the shape of an existing sweep, e.g. `internal.team.sweep` with cursor/phase args): delete `complete`/`revoked` leases with `expiresAt < now − 30d` plus their permits/sessions; delete expired `authEmailIssuance`/`authVerificationJournal` rows. Deleting a lease row is fail-closed elsewhere — verify that claim in code before relying on it.
- Register it in `convex/crons.ts` on the existing 15-minute cadence pattern.
- Do NOT change the deletion-executor exclusion list; note in the report why the sweep (not erasure) owns this retention.
- Covering tests: extend `convex/operations/authAdmission.test.ts` with sweep deletes-old/keeps-fresh cases.

### Task 4: Demo state — validate `readState` deeply enough not to brick the app

Finding 4. `src/lib/store.tsx:44-66` only checks `schemaVersion`, 6 arrays, and truthy `preferences`; a parseable-but-wrong payload (e.g. `preferences: {}`) crashes `src/App.tsx:512` on every load.

- Merge parsed state over `createSeed()` defaults (or validate `preferences.name`/`timezone` are strings and required nested shapes) so a corrupt payload falls back to seed instead of crashing. Keep it to the smallest check that covers the crash surface you find — grep the consumers of `readState`'s return before deciding the shape.
- Add one unit test with the corrupt payload above (find where store-adjacent tests live, e.g. `tests/media-store.test.ts` style; if `readState` is not exported, export it for the test — that is the only permitted API change).
- Covering tests: the new/extended test file.

### Task 5: `revoke_user` webhook — paginate the fan-out

Finding 5. `convex/integrations/github/deliveries.ts:305-334` processes 20 connections × up to 100 repos in one mutation; on transaction-limit failure the receipt stays `pending` and retries every minute forever (`:390-422`).

- Carry a sub-cursor (connection id + repository cursor) on the receipt row and process one bounded slice per invocation, rescheduling `process` until exhausted — same checkpoint pattern the outer pagination already uses. The durable revocation barrier (`applyRevocation`, `:56-92`) must still apply immediately and completely in the first invocation; only repository-flag cleanup becomes eventual.
- Covering tests: existing GitHub delivery/recovery tests (`convex/integrations/github/recovery.test.ts` and neighbours) + a new case where one slice does not finish all repos and a second invocation completes.

### Task 6: Cloud mode — notification-read state must persist locally

Finding 6 (audit #8). `src/App.tsx:215-218,502,707,723` × `src/lib/store.tsx:1054-1059`: in cloud mode `persist()` calls `unavailable()` and never sets the value, so "mark as read" is silently discarded and the unread badge returns forever.

- Allowlist harmless UI-pref keys (keys ending in `-notification-read`) to persist to localStorage in cloud mode too; everything else keeps the current unavailable behaviour. Alternatively hide the read-tracking UI in cloud mode if that is visibly simpler in the actual code — decide from the code, state the choice in the report.
- Covering tests: nearest existing store/App test seam; if none exists, a small unit test for the persist allowlist.

### Task 7: Data export — adaptive page size instead of 1 row per query

Finding 7 (audit #9). `convex/operations/export.ts:180-188` and the same `paginate({ numItems: 1 })` pattern in `exportRecords.ts`, `exportRemaining.ts`, `exportPrivate.ts`, `exportFinance.ts`, `exportIntelligence.ts`, `exportShared.ts:750`: one authenticated round-trip per row, each re-running workspace auth + proof walks.

- Raise page size adaptively: accumulate rows until the existing ~64KB DTO size check (see `export.ts:255-265`) would trip, then return the cursor at the last emitted row. Keep the per-request proof-freshness behaviour: rows whose proof expired mid-page keep the existing skip (`export.ts:209-222` area).
- Apply to all files sharing the pattern; keep each file's DTO shape unchanged.
- Covering tests: existing export tests (`convex/operations/export.test.ts`, `exportPrivate.test.ts`, `exportIdentity.test.ts`) must pass unchanged.

### Task 8: GitHub webhook receipts — 30-day retention for processed receipts

Finding 8 (audit #11). `convex/integrations/github/deliveries.ts:185-204,390-396`: processed receipts + GUID rows are kept forever; research sources already expire after 30 days (`convex/lib/operationalRetention.ts:3`).

- In the existing `resume` cron path (or a sibling sweep in the same file), delete `processed` receipts and their `githubDeliveryGuids` where `latestReceivedAt < now − 30d`, paginated at 25 like other sweeps. Keep `githubSignals` untouched (they copy the needed fields at `:262-288`). Verify the recovery scan's 24h lookback (`convex/integrations/github/recovery.ts:222`) before choosing 30d.
- Covering tests: existing deliveries/recovery tests + a sweep case (old processed deleted, fresh/pending kept).

### Task 9: CI runs browser tests + vitest config splits evals

Findings 9 (audit #6 + #15). `.github/workflows/ci.yml:14-19` never runs Playwright; `tests/*.browser.mjs` (26 files) mostly have no npm script; there is no `vitest.config.*`, so `pnpm test` sweeps `tests/evals/**` into every run and takes >10 min.

- CI: add one job/step `pnpm exec playwright install --with-deps chromium && pnpm test:e2e` (keep the existing job's steps untouched otherwise).
- Add a `test:browser` script that runs the orphan `tests/*.browser.mjs` files (or a glob runner) and wire it into CI only if it runs headless-clean locally — if some scripts need credentials/manual setup, list them in the report and exclude them explicitly in the script, do not leave the glob silently partial.
- Add a minimal `vitest.config.ts` that excludes `tests/evals/**` from the default run and add a `test:evals` script for them; CI must call both `pnpm test` and `pnpm test:evals`.
- Covering checks: `pnpm test` (must now finish and pass), `pnpm test:evals`, and a local Playwright smoke (`pnpm test:e2e` if it completes in reasonable time, otherwise say so).

### Task 10: Lint — replace the hand-maintained Prettier allowlist with globs

Finding 10 (audit #10). `package.json:15` lists files one by one; ~73 files are never format-checked; no ESLint exists.

- Replace the list with glob patterns (`src/**/*.{ts,tsx,css}`, `convex/**/*.ts`, `tests/**/*.{ts,mjs}`, `shared/*.ts`, root configs) plus a `.prettierignore` for `_generated`, fixtures, and generated output.
- Run it: expect one bulk-format pass over previously unchecked files — commit the formatting separately from the `package.json` change if the diff is large (two commits, formatting second, both in this task).
- Also enable `noUnusedLocals`/`noUnusedParameters` only if `tsconfig` already nearly complies; if enabling them produces a large cleanup, do NOT do it — report the count instead. No ESLint.
- Covering checks: `pnpm lint`, `pnpm typecheck`.

### Task 11: Store/Calendar/Drafts — memoize and de-quadratic the hot renders

Finding 11 (audit #12). `src/lib/store.tsx:647-1009` rebuilds projections and a fresh context value on every render (0 `useMemo` in the store); `src/pages/Calendar.tsx:365-371` × `src/lib/time.ts:30-45` constructs an `Intl.DateTimeFormat` per schedule per day; `src/pages/Drafts.tsx:160-186` re-runs `find`/`some` per draft per keystroke.

- Store: wrap the state construction (744-809) in `useMemo` keyed on the query results it consumes; build one `Map<versionId, version>` per bundle instead of per-comment/per-schedule `find`.
- Time: cache one `Intl.DateTimeFormat` per timezone in `src/lib/time.ts`.
- Calendar: bucket schedules by civil date once (`Map`) instead of filtering per day. Drafts: precompute `scheduledDraftIds` as a `Set` before filtering.
- No behaviour change. Covering checks: `pnpm typecheck` + existing frontend tests (`pnpm exec vitest run tests/media-store.test.ts tests/first-write-ui.test.ts` and any calendar-time tests).

### Task 12: Lean — one `cn`, delete dead UI components

Finding 12 (audit #13). Two `cn` implementations ship: `src/lib/utils.ts` (clsx + tailwind-merge, 2 importers) vs the `cn` package (16 importers); `src/components/ui/{alert,avatar,badge,select,separator}.tsx` are imported by nothing.

- Point the 2 `@/lib/utils` importers (`src/App.tsx:94`, `src/components/shared.tsx:4`) at `cn`, delete `src/lib/utils.ts`, remove `clsx` + `tailwind-merge` from `package.json` (keep `cn`).
- Re-grep before deleting: confirm zero importers of the 5 UI files across `src/ convex/ tests/`, then delete them.
- Covering checks: `pnpm typecheck`, `pnpm build`, `pnpm test:bundle`.

### Task 13: Lean/perf — lazy heavy pages + `safeHref`

Finding 13 (audit #14). `src/App.tsx:95-99` statically imports Overview/Drafts/Calendar/Ideas/Plans while neighbours use `lazy()`; external URLs from data render into `href` without a protocol allowlist (`src/pages/Research.tsx:426-429`, `src/features/research/source-search.tsx:230-234`, `src/features/research/pipeline.tsx:467`, `src/features/intelligence/profiles.tsx:345,720,813`).

- Convert the 5 static page imports to the same `lazy()` pattern used directly below them.
- Add one `safeHref()` helper (http/https only, else `undefined`) at the natural shared location and apply it at the anchor sites above.
- Covering checks: `pnpm typecheck`, `pnpm build`.

---

## Out of scope

- Singleton OCC counters (`convex/integrations/github/barriers.ts`, `convex/integrations/x/oauth.ts`): named `ponytail:` decisions; revisit only with measured contention.
- Retention sweep re-scheduling (`convex/operations/retention.ts`): noted in audit, not a numbered finding; skip.
- Demo media base64 budget (`src/pages/Media.tsx`): minor sub-finding, skip unless Task 4 touches the same code anyway.
- Any refactoring beyond the named fixes.
