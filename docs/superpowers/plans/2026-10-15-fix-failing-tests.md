# Fix Failing Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm test` (plus `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:bundle`) pass again on commit 3042eb8 by fixing six test-side defects; no product behavior changes.

**Architecture:** Five independent root causes, all in test/fixture code (diagnosed 2026-10-15 with file:line evidence, reproduced per file): (1) one test consumes the production algorithm-profile seed whose hardcoded review deadline 2026-10-12 has passed; (2) eight ideas tests still expect pre-retention-cap (`null`) horizons after commit aa575de introduced the 30-day operational-retention cap; (3) calibration tests let `vi.runAllTimers()` fire 120 s auth-guard timers and jump the fake clock past a holdout boundary, plus one heavy test exceeds the 5 s default timeout; (4) one conversations test raw-patches run state while its scheduled executor is in flight and gets clobbered; (5) one similarity max-shape test needs ~8.7 s against the 5 s default; (6) one styleProfiles variant's workload needs >880 s of CPU. Each task fixes one root cause in one file, following existing repo patterns.

**Tech Stack:** TypeScript, Vitest 5, convex-test, pnpm 12.8.1. Repo has no vitest config; per-test timeouts use the trailing numeric `test(...)` argument (precedent: `convex/planning/recurring.test.ts:802`).

**Spec:** None. The failing tests themselves encode the requirements; product behavior is the authority and must not change. Diagnosis summaries are in the SDD ledger for this plan.

## Global Constraints

- **Test code only.** Only files matching `*.test.ts` (and, if a task explicitly says so, test fixtures under `tests/`) may change. No product code (`convex/**` non-test, `src/**`, `shared/**`), no config, no `package.json`, no new dependencies, no global vitest `testTimeout`. If you believe a product change is required, stop and report BLOCKED with evidence instead of making it.
- **No new fixed calendar dates.** Any date you introduce must be runtime-relative (e.g. `Date.now() + 86400000`, pattern in `tests/jev-fixture.ts:52`) or derived from fixture values (e.g. `createdAt + 30 * 86400000`). Hardcoding another future date recreates the bug.
- **Assertion strength must not shrink.** Where an expected value changes, assert the new semantics precisely (exact computed value or bounded range), never `expect.anything()`, truthiness, or deletion of the assertion.
- **One task = one commit**, message style follows repo (`fix(tests): ...`). Run only the task's own test file(s) for verification; the full suite runs once at the end by the controller.
- Working directory: `/tmp/opencode/dispatchv2-testfix` (branch `fix/test-time-bomb`). Every vitest invocation must be wrapped in `timeout` as specified — one test in this repo can otherwise run for >15 minutes.

## Review Focus

- A test fixed with a wall-clock-derived date must still pass when the clock is advanced +30 days — no new time bombs (Tasks 1, 2, 3).
- Bounded-horizon assertions must reject `null`/unbounded values, not merely accept any number (Task 2).
- The calibration sweep must still execute its 0-delay scheduled chains; only the 120 s guard timers may stay pending (Task 3).
- The shrunk styleProfiles variant must still assert disjoint catalogs, exact node details, and bounded cleanup — with smaller N, not with assertions removed (Task 6).
- `git diff --stat` for every task shows only the task's named test file (all tasks).

---

### Task 1: analyzePost — expired production seed review deadline

**Files:**
- Modify: `convex/ai/jev/analyzePost.test.ts` (failing test at line 160, review step at line 206)

**Interfaces:**
- Consumes: production mutation `api.intelligence.algorithmProfiles.create` (unchanged). Without proposal/evaluation ids it bakes the pinned snapshot with `reviewDueAt: 2026-10-12` (`convex/intelligence/algorithmProfiles.ts:116`), which `convex/intelligence/profiles.ts:282-283` now rejects as `INTELLIGENCE_SOURCE_REVIEW_EXPIRED`. Product code is correct per `.docs/intelligence-profile-contract.md:19` — do not touch it.
- Produces: passing `convex/ai/jev/analyzePost.test.ts` (4/4).

- [ ] **Step 1: Reproduce**

Run: `timeout 120 ./node_modules/.bin/vitest run convex/ai/jev/analyzePost.test.ts`
Expected: 1 failed (`INTELLIGENCE_SOURCE_REVIEW_EXPIRED` at profiles.ts:283), 3 passed.

- [ ] **Step 2: Make the created candidate reviewable with a runtime-relative deadline**

In the failing test, after the `algorithmProfiles.create` call that creates the candidate used by the `review-algorithm` step (test line ~206), patch that candidate's `payload.reviewDueAt` to `Date.now() + 86400000` via the test's existing db access (`t.run(async (ctx) => ...)`, as used elsewhere in this test/fixture), mirroring `tests/jev-fixture.ts:52`. Keep every other assertion and step identical. If the candidate's id is not reachable in the test, instead seed via the proposal/evaluation path (algorithmProfiles.ts:143-151 computes `reviewDueAt = observedAt + WEEK` at runtime) — choose whichever is the smaller diff; do not weaken the "requires explicit review/select" assertions.

- [ ] **Step 3: Verify**

Run: `timeout 120 ./node_modules/.bin/vitest run convex/ai/jev/analyzePost.test.ts`
Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add convex/ai/jev/analyzePost.test.ts
git commit -m "fix(tests): use runtime-relative review deadline in analyzePost profile test"
```

---

### Task 2: ideas — stale null-horizon expectations after retention cap

**Files:**
- Modify: `convex/content/ideas.test.ts` (8 failing tests: lines ~807, 1338 ×4 variants, 2191, 2405, 2862)

**Interfaces:**
- Consumes: `operationalUntil(createdAt, sourceUntil) = min(createdAt + 30 * 86400000, sourceUntil ?? Infinity)` from `convex/lib/operationalRetention.ts` (commit aa575de, product — unchanged). It is always finite; the tests still expect `null` horizons (e.g. `expect(...).toBeNull()` at :1338 receives `createdAt + 30d`).
- Produces: passing `convex/content/ideas.test.ts` (73/73).

- [ ] **Step 1: Reproduce**

Run: `timeout 420 ./node_modules/.bin/vitest run convex/content/ideas.test.ts`
Expected: 8 failed | 65 passed. Failing: "TASK45.2 exact style pin survives unselected saves and retained output is erased after selector loss", "TASK45.2 account-scoped input proof rejects original styled ancestry across consumers" (styled/edited/manual-parent/inherited-run), "candidate exact replay preserves legacy command identity and candidate media ordering, no mode promotion", "candidate superseded current choice stays readable as history without fresh application", "candidate >25 genuine native request/output/Agent families are erased on null-horizon original operation loss".

- [ ] **Step 2: Update the 8 horizon expectations to the capped semantics**

For each failing assertion, replace the `null`/unbounded expectation with the exact bounded value the product computes: where `sourceUntil` is null, horizon must equal `createdAt + 30 * 86400000` for the relevant record (use the fixture's actual `createdAt` value in scope; if it is not directly available, assert the bounded range `> Date.now()` and `<= createdAt + 30 * 86400000 + slack` — never a hardcoded calendar timestamp). For the "null-horizon" test (:2862), keep the erase-on-horizon-loss scenario but assert the 30-day-capped horizon, and rename the test only if its name would otherwise state a false premise (keep the rest of the name recognizable). Do not change any non-horizon assertion.

- [ ] **Step 3: Verify**

Run: `timeout 420 ./node_modules/.bin/vitest run convex/content/ideas.test.ts`
Expected: 73 passed.

- [ ] **Step 4: Commit**

```bash
git add convex/content/ideas.test.ts
git commit -m "fix(tests): expect 30d retention-capped horizons in ideas tests"
```

---

### Task 3: calibration models — fake-clock jump over holdout boundary + heavy test timeout

**Files:**
- Modify: `tests/evals/calibration/models.test.ts` (`sweepModelsOnly` at :1382-1385; failing tests at :999 and :1386-1421)

**Interfaces:**
- Consumes: fake timers pinned by `tests/evals/calibration/fixture.ts` (`NOW = 2026-10-06`, `vi.useFakeTimers()`); auth guard schedules 120 s timers (`convex/operations/authAdmission.ts:11` `pendingLifetime = 120_000`, product — unchanged). `vi.runAllTimers()` in `sweepModelsOnly` fires them, jumping the clock +120 s past `holdout1Start` (only 3000 ms headroom), so `convex/performance/models.ts:1092` rejects with `CALIBRATION_MONITORING_INTERVAL_INVALID` before the tombstone check. Do not reorder product guards.
- Produces: passing `tests/evals/calibration/models.test.ts` (20/20).

- [ ] **Step 1: Reproduce**

Run: `timeout 300 ./node_modules/.bin/vitest run tests/evals/calibration/models.test.ts`
Expected: 2 failed | 18 passed ("Owner restoration cannot redeclare..." with the wrong error; "registered beforeSend pins..." timed out in 5000ms).

- [ ] **Step 2: Bound the sweep's timer advance**

Change `sweepModelsOnly` to advance timers by 0 instead of running all timers: `finishAllScheduledFunctions(() => vi.advanceTimersByTime(0))` — the established pattern in `tests/reviews.test.ts` / `tests/x-thread.test.ts`. This must still drain the sweep's 0-delay pagination chains; if (and only if) the sweep then fails to complete, fall back to re-pinning the clock with `vi.setSystemTime(...)` to the pre-sweep value immediately after the sweep call in the "Owner restoration" test, and report which route you took.

- [ ] **Step 3: Give the heavy test a per-test timeout**

For "registered beforeSend pins a genuinely qualified finite candidate, exact replay does not reactivate, and expiry removes only protected derivatives" (:999, measured body ≈7.1 s, assertions all pass with more time), add the trailing timeout argument in repo style: `}, 30000);`. Change no other test's timeout.

- [ ] **Step 4: Verify**

Run: `timeout 300 ./node_modules/.bin/vitest run tests/evals/calibration/models.test.ts`
Expected: 20 passed. Also run `timeout 300 ./node_modules/.bin/vitest run tests/evals/calibration/references.test.ts` to confirm the shared fixture's other consumer still passes (23 passed) — without modifying it.

- [ ] **Step 5: Commit**

```bash
git add tests/evals/calibration/models.test.ts
git commit -m "fix(tests): bound calibration sweep timer advance and time out heavy test"
```

---

### Task 4: conversations — settle scheduled executor before patching run state

**Files:**
- Modify: `convex/ai/conversations.test.ts` (failing test "generic stop denies a second real Editor for another actor's running personal chat", assertion at :1023, state patch at :1010)

**Interfaces:**
- Consumes: `f.send()` schedules `internal.ai.provider.execute` via `runAfter(0, ...)` (`convex/ai/conversations.ts:463`); the in-flight executor claims the run and, with no API key stubbed, fails it via `internal.ai.runs.finish` (`convex/ai/runs.ts:934-937`, the only failed-writer that does not bump `generation` — hence observed `{state:'failed', generation:1}`). Product stop handlers deny access before touching the run — product is correct, do not touch it.
- Produces: passing `convex/ai/conversations.test.ts` (33/33).

- [ ] **Step 1: Reproduce**

Run: `timeout 300 ./node_modules/.bin/vitest run convex/ai/conversations.test.ts -t "generic stop denies a second real Editor"` (twice)
Expected both times: only the `running` variant fails at :1023 (`state: 'failed'` vs expected `'running'`).

- [ ] **Step 2: Drain the scheduled executor before the raw state patch**

In that test, immediately after `f.send()` (and before the `ctx.db.patch(runId, { state })` setup), drain scheduled functions using the same helper/idiom this file or sibling tests already use for convex-test (e.g. `await f.t.finishAllScheduledFunctions(vi.runAllTimers)` — match the exact idiom found in the codebase; the run ends terminally `failed`, after which the test's patch is the last writer for all 5 state variants). Change nothing else in the test; the CHAT_ACCESS_DENIED assertions and final state assertions stay as they are.

- [ ] **Step 3: Verify**

Run: `timeout 300 ./node_modules/.bin/vitest run convex/ai/conversations.test.ts` (twice)
Expected both times: 33 passed.

- [ ] **Step 4: Commit**

```bash
git add convex/ai/conversations.test.ts
git commit -m "fix(tests): settle scheduled executor before patching run state in stop test"
```

---

### Task 5: similarity — per-test timeout for max-shape test

**Files:**
- Modify: `convex/content/similarity.test.ts` (test "full 100 imported-history plus 25 exact drafts frame fits native limits and cap+1 is explicit")

**Interfaces:**
- Consumes: nothing new. Measured: body ≈8.7 s (3 runs, passes with `--testTimeout=60000`, date-independent); cost is convex-test serialization of 125 × 4096-dim vectors + 12 KB texts, not product logic (~0.4 s).
- Produces: passing `convex/content/similarity.test.ts` (22/22).

- [ ] **Step 1: Reproduce**

Run: `timeout 120 ./node_modules/.bin/vitest run convex/content/similarity.test.ts -t "full 100 imported-history"`
Expected: FAIL "Test timed out in 5000ms".

- [ ] **Step 2: Add the trailing per-test timeout**

Append the trailing timeout argument to that single `test(...)` call in repo style: `}, 60000);`. Do not shrink the test's data (its purpose is the max native shape), do not add a vitest config or global timeout, do not touch other tests.

- [ ] **Step 3: Verify**

Run: `timeout 180 ./node_modules/.bin/vitest run convex/content/similarity.test.ts`
Expected: 22 passed.

- [ ] **Step 4: Commit**

```bash
git add convex/content/similarity.test.ts
git commit -m "fix(tests): allow 60s for similarity max-shape test"
```

---

### Task 6: styleProfiles — shrink the mixed=true workload explosion

**Files:**
- Modify: `convex/ai/styleProfiles.test.ts` (test "disjoint26 native catalogs, exact32-node details and bounded cleanup retain physical evidence (mixed=true)" at :1577, its own timeout 900000 at :1865)

**Interfaces:**
- Consumes: `versionProof` ancestry walk + sha256 per node per command (`convex/ai/styleProfiles.ts:207-276`, product — unchanged). Current mixed=true shape: 26 roots × (1 save + 15 editorial cycles × (select+propose+accept)) ≈ 1976 commands, 23,990-byte payloads (test :1591), then 390 detail queries, 1-row maintenance pagination (:1801-1819), ~2100 chained sweep jobs (:1833), final `toEqual` over ~3000 docs. Measured: mixed=false sibling passes in 138.8 s; mixed=true exceeds 880 s. Not date-dependent (fake clock pinned at 2026-10-06).
- Produces: `convex/ai/styleProfiles.test.ts` fully passing, with the mixed=true test completing in ≤120 s.

- [ ] **Step 1: Reproduce (bounded)**

Run: `timeout 240 ./node_modules/.bin/vitest run convex/ai/styleProfiles.test.ts -t "mixed=true" --testTimeout=120000`
Expected: does not pass within the bound (times out / killed). Do not run this file unbounded at any point in this task.

- [ ] **Step 2: Reduce the mixed=true variant's workload, preserving assertion kinds**

Reduce the mixed=true workload parameters — roots (26 → ~6) and editorial cycles per root (15 → ~2) are the first levers; reduce the 23,990-byte payload for this variant only if count reduction alone cannot reach ≤120 s (check first whether payload size is load-bearing for this test's assertions). Update every derived expectation (catalog counts, node counts, cleanup evidence) consistently from the new parameters — prefer computing expectations from the parameter values over hardcoding new magic numbers where the test already parameterizes. If the test name encodes counts ("disjoint26", "exact32-node"), rename those fragments to match the new shape. The mixed=false variant and all other tests in the file stay untouched. Every assertion kind present today (disjoint catalogs, exact node details, bounded cleanup, physical evidence) must still be asserted — removing or weakening assertions to fit the budget is a failed task.

- [ ] **Step 3: Verify**

Run: `timeout 1200 ./node_modules/.bin/vitest run convex/ai/styleProfiles.test.ts`
Expected: all tests pass; report the mixed=true test's duration from the output (must be ≤120 s).

- [ ] **Step 4: Commit**

```bash
git add convex/ai/styleProfiles.test.ts
git commit -m "fix(tests): shrink styleProfiles mixed workload to bounded size"
```

---
