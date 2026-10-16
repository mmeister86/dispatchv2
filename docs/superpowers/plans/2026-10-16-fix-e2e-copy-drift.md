# Fix E2E Copy Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm test:e2e` pass again (4 failing Playwright tests in `tests/ui.e2e.ts`) by updating stale test expectations to the current, intentional product copy — no product changes.

**Architecture:** One root cause with two surfaces: commit d5cb592 ("fix(accounts): preserve isolated account targets and reconnects", 2026-10-06) deliberately made approval/scheduling copy account-scoped — the unapproved banner became `Diese Arbeitsversion für <handle> ist noch nicht freigegeben` (src/pages/Drafts.tsx:1294) and the account-switch warning became `Wechsel von <A> zu <B>: Der alte Snapshot kann weiterhin …` (src/pages/Drafts.tsx:913-925). d5cb592 updated tests/agent-chat.browser.mjs but missed tests/ui.e2e.ts, whose expectations date from the initial commit 2939870. Product behavior and its semantic guarantees (unapproved state, snapshot protection) are intact and independently pinned (model.test.ts, disabled-button + localStorage assertions in the e2e tests themselves).

**Tech Stack:** TypeScript, Playwright 1.63 (`pnpm test:e2e`, chromium headless shell, demo mode via `VITE_DEMO_MODE=true` dev server on :5174, auto-started by playwright.config.ts), Vitest for the rest of the CI battery.

**Spec:** None. The current product copy and behavior are the authority; the four failing tests encode outdated copy. Diagnosis evidence (2026-10-16, reproduced locally on dff1368: 4 failed / 30 passed, identical to CI) is summarized in the SDD ledger for this plan.

## Global Constraints

- **Test code only.** Only `tests/ui.e2e.ts` may change. No product code (`src/**`, `convex/**`, `shared/**`), no other test files, no config, no `package.json`, no new dependencies. If you believe a product change is required, stop and report BLOCKED with evidence.
- **Assertion strength must not shrink.** The banner expectation must still match only the unapproved-state sentence (it renders exclusively in the unapproved branch, src/pages/Drafts.tsx:1292-1294) — a regex that would also match the approved branch or arbitrary text is a failed fix. The account-switch expectation must still match the schedule-protection alert (the `Wechsel von …` banner at Drafts.tsx:913-925). No assertion may be deleted or replaced by a weaker one (no `toBeVisible` removals, no `.first()`/`.nth()` loosening, no timeout increases as a substitute for matching).
- **Do not hardcode the varying handle where it varies.** The banner appears with `@matthiasbuilds` (tests :99, :126) and with `Matthias · Founder` (:144). Use a handle-tolerant pattern (e.g. `/Diese Arbeitsversion für .+ ist noch nicht freigegeben/`). For the account-switch alert, the semantic core `Der alte Snapshot kann weiterhin` must be part of the pattern.
- **One task = one commit** for Task 1, message: `fix(tests): update e2e expectations for account-scoped copy`.
- Always wrap Playwright runs in `timeout` as specified. Playwright writes screenshots into `.docs/reviews/evidence/` and `test-results/` when tests run — revert/delete those artifacts before committing (`git checkout -- .docs/`, `rm -rf test-results playwright-report`); they are never part of a commit.

## Review Focus

- The banner regex must not match the approved-branch sentence or the "keinen Account" fallback unintentionally — check what each branch renders (Drafts.tsx around :1280-1300).
- After the first assertion is fixed, each of the four tests must pass *completely* — later assertions were audited as current, but the full test run is the proof, not the audit.
- The account-switch test's semantic guarantee must remain proven by its data assertions (slot-1 unchanged: accountId `acc-x`, version 1), not just by the warning text.
- `git diff --stat` for Task 1 shows only `tests/ui.e2e.ts`.

---

### Task 1: Update the four stale copy expectations in tests/ui.e2e.ts

**Files:**
- Modify: `tests/ui.e2e.ts` (expectations at :108-109, :136-137, :159-160, and :380-381)

**Interfaces:**
- Consumes: current product copy — banner `Diese Arbeitsversion für ${handle} ist noch nicht freigegeben` (src/pages/Drafts.tsx:1294, unapproved branch only) and alert `Wechsel von @matthiasbuilds zu Matthias · Founder: Der alte Snapshot kann weiterhin für @matthiasbuilds veröffentlicht werden. …` (src/pages/Drafts.tsx:913-925). Product code is correct (commit d5cb592 intentional; tests/agent-chat.browser.mjs:581 already uses the new banner copy) — do not touch it.
- Produces: the four tests passing end-to-end: "composer editing invalidates approval while scheduled snapshot remains untouched" (:99), "analysis stays bound to identity and recommendations create an unapproved version" (:126), "multi-channel variants retain thread structure and use independent approval" (:144), "a scheduled X snapshot cannot be replaced after switching its working draft to LinkedIn" (:365).

- [ ] **Step 1: Reproduce**

Run: `timeout 600 pnpm exec playwright test tests/ui.e2e.ts -g "composer editing|analysis stays|multi-channel|LinkedIn"`
Expected: 4 failed — three at the banner expectation ("element(s) not found", waiting for the old banner string), one at the account-switch expectation (:380-381, waiting for /Account geändert: Den bisherigen Slot/).

- [ ] **Step 2: Update the three banner expectations**

At :108-109, :136-137, and :159-160, replace the exact-string expectation `page.getByText("Diese Arbeitsversion ist noch nicht freigegeben")` with the handle-tolerant regex `page.getByText(/Diese Arbeitsversion für .+ ist noch nicht freigegeben/)`. Keep the surrounding `await expect(...)` form and everything else in the tests unchanged.

- [ ] **Step 3: Update the account-switch expectation**

At :380-381, replace `page.getByText(/Account geändert: Den bisherigen Slot/)` with a pattern matching the current alert, including the semantic core: `page.getByText(/Wechsel von @matthiasbuilds zu Matthias · Founder: Der alte Snapshot kann weiterhin/)` — or the shorter `/Der alte Snapshot kann weiterhin für @matthiasbuilds veröffentlicht werden/` if you verify from the error context / DOM that it matches exactly one element. Keep the `await expect(...)` form; change nothing else.

- [ ] **Step 4: Verify the four tests end-to-end**

Run: `timeout 600 pnpm exec playwright test tests/ui.e2e.ts -g "composer editing|analysis stays|multi-channel|LinkedIn"`
Expected: 4 passed. (This proves all post-banner assertions too — they were audited as current, this run is the evidence.) Then clean run artifacts: `git checkout -- .docs/ 2>/dev/null; rm -rf test-results playwright-report`.

- [ ] **Step 5: Commit**

```bash
git add tests/ui.e2e.ts
git commit -m "fix(tests): update e2e expectations for account-scoped copy"
```

---

### Task 2: Full CI battery verification on this branch

**Files:**
- Modify: none. This is a verification task: run the battery, report results, change nothing. If a step fails, do NOT fix it here — report BLOCKED with the failing step, the failing tests, and the error output; the controller will rule on scope.

**Interfaces:**
- Consumes: Task 1's commit on this branch.
- Produces: evidence that the whole "App checks" workflow (`.github/workflows/ci.yml`) passes locally: lint, typecheck, unit tests, eval tests, build, bundle check, Playwright e2e, browser tests.

- [ ] **Step 1: Static checks + unit + evals + build**

Run: `pnpm lint && pnpm typecheck && pnpm test:bundle`
Expected: all exit 0. (Note: `pnpm lint` now covers `tests/**`, so this also proves Task 1's edit is prettier-clean.)
Run: `timeout 900 pnpm vitest run --maxWorkers=4` (the unit suite; CI-like parallelism per the previous plan's ruling — plain `pnpm test` on this many-core box has known pre-existing load flakes in the heaviest files)
Expected: 78/78 files pass.
Run: `timeout 900 pnpm test:evals`
Expected: exit 0.
Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 2: Playwright e2e, full**

Run: `timeout 900 pnpm test:e2e`
Expected: 34 passed (30 previously passing + the 4 fixed), exit 0. Clean artifacts afterwards: `git checkout -- .docs/ 2>/dev/null; rm -rf test-results playwright-report`.

- [ ] **Step 3: Browser tests (the CI step after e2e; never yet reached by a green run)**

Run: `timeout 900 pnpm test:browser`
Expected: exit 0. This step runs every `tests/*.browser.mjs` in sequence; it has never been observed green end-to-end in CI (previous runs failed earlier). If any file fails, capture which file and the first error — that is a BLOCKED report, not a fix mandate.

- [ ] **Step 4: Confirm clean tree and report**

Run: `git status --short`
Expected: clean (verification changed nothing; run artifacts removed). No commit in this task.

---
