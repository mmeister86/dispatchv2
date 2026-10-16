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

### Task 3: Complete stale per-file browser mocks (tests/*.browser.mjs)

**Files:**
- Modify: the affected `tests/*.browser.mjs` files — from the per-file catalog: `agent-chat`, `calibration-references`, `experiments`, `finite-series`, `github-app`, `github-context`, `intelligence-profiles`, `jev-assessments`, `own-metrics`, `performance-baselines`, `planning`, `research-content`, `semantic-retrieval`, `style-profiles`, `team-invitations` (15 files; a file drops off this list only if it passes unmodified in Step 1). No other files. No product code.

**Interfaces:**
- Consumes: each file's own mock table for `fixture:convex/react` and `fixture:@/lib/auth-client`, and the precedent stub semantics already in passing files: `useConvex=()=>({})` (tests/x-thread.browser.mjs), `usePaginatedQuery=()=>({results:[],status:"Exhausted",loadMore:()=>{}})` and `useAction=()=>()=>Promise.reject(new Error("No provider"))` (tests/agent-chat.browser.mjs), and the auth-client stub shape in the passing real-app tests (tests/operations.browser.mjs / tests/review-queue.browser.mjs, which include `authClient` with `useSession`). Product imports are legitimate (`convex@1.46` exports `useConvex`) — product code stays untouched.
- Produces: every `tests/*.browser.mjs` file passing individually, so `pnpm test:browser` can run end-to-end (Task 4 proves the loop).

- [ ] **Step 1: Establish the per-file baseline**

First remove stale local evidence dirs (local-only artifact; CI runs fresh): `rm -rf /tmp/dispatch-*-browser-*`. Then for each file on the list, run `timeout 240 node tests/<name>.browser.mjs` and record pass/fail + first error. (Already-known catalog: 10 files pass unmodified — experiments/finite-series/planning fail on `authClient.useSession is not a function`, five files miss the `authClient` export, the rest miss convex/react exports; github-context shows a TimeoutError. Your runs confirm or correct this per file.)

- [ ] **Step 2: Complete each failing file's mocks, precedent-shaped, iterating**

For each failing file: add exactly the missing exports to that file's existing mock strings, using the precedent semantics above (for auth-client: mirror the passing files' stub, including `authClient.useSession` returning the same session shape those stubs use). Re-run the file after each completion round; module errors surface one layer at a time, so iterate until the file passes or you have evidence of a different defect class. Do not change what any stub *returns* beyond adding the missing exports/methods with precedent semantics; do not edit test assertions, flows, or timeouts in these files. Special case: if `github-context` still fails with TimeoutError after its mocks are complete (missing: useConvex, useAction, usePaginatedQuery), stop on that file and report it as a concern with the new error output — do not improvise a fix.

- [ ] **Step 3: Verify the affected set**

Run each modified file once more from a clean evidence state (`rm -rf /tmp/dispatch-*-browser-*` first): `timeout 240 node tests/<name>.browser.mjs` per file.
Expected: every file exits 0. Also confirm the previously passing files you did not touch are not in your diff. Clean artifacts: `git checkout -- .docs/ 2>/dev/null; rm -rf test-results playwright-report`.

- [ ] **Step 4: Commit**

```bash
git add tests/*.browser.mjs
git commit -m "fix(tests): complete stale browser fixture mocks for current imports"
```
(Only actually-modified files will be staged by the pathspec if unchanged ones are untouched — verify `git status` shows exactly the files you edited.)

---

### Task 4: Stale copy and geometry sync in planning / calibration-references / intelligence-profiles

**Files:**
- Modify: `tests/planning.browser.mjs` (assertions at :423 and :515-533), `tests/calibration-references.browser.mjs` (:104, :106-108, geometry loop :548-562), `tests/intelligence-profiles.browser.mjs` (:91). No other files. No product code.

**Interfaces:**
- Consumes: current product state — plans state label `Historisch angenommen · im Kalender` (src/features/plans/plans.tsx:43, renamed intentionally in f364e72); real routes for `/team` and `/experiments` (App.tsx allow-regex grew in 08094a8/cce8d98; their pages are covered by tests/team-invitations.browser.mjs and tests/experiments.browser.mjs); NativeHealth loading state `Betriebsbelege werden geladen …` and NativePilot loading state `Messwerte werden geladen …` (src/features/operations/health.tsx; TASK-31/35 placeholders removed in e5bae9c; same loading assertions already used by passing tests/operations.browser.mjs:1029). Product is correct everywhere here.
- Produces: the three files passing individually from a clean evidence state.

- [ ] **Step 1: Reproduce**

Run: `rm -rf /tmp/dispatch-*-browser-*` then `timeout 240 node tests/planning.browser.mjs`, `timeout 240 node tests/calibration-references.browser.mjs`, `timeout 240 node tests/intelligence-profiles.browser.mjs` (clean artifacts between runs: `git checkout -- .docs/ 2>/dev/null; rm -rf test-results playwright-report`).
Expected: planning fails at :423 (then would fail at :515-533); calibration-references fails at :104; intelligence-profiles fails at :91.

- [ ] **Step 2: planning — update the state label and the route-gate list**

At :423 change the regex to `/Historisch angenommen · im Kalender/`. In the route-gate loop (:515-533), remove `"/team"` and `"/experiments"` from the list of paths expected to render the not-yet-connected EmptyState (both have real pages now, covered by their own browser tests). Change nothing else in the file.

- [ ] **Step 3: calibration-references + intelligence-profiles — assert the real loading states**

In calibration-references at :104, replace the TASK-31 placeholder expectation with an assertion that the status text `Betriebsbelege werden geladen …` is visible (mirror the form used at tests/operations.browser.mjs:1029); at :106-108 do the same for the TASK-35 pilot placeholder with `Messwerte werden geladen …`. In intelligence-profiles at :91, replace the TASK-31 placeholder expectation with the same `Betriebsbelege werden geladen …` assertion. The assertion intent is preserved: the tab shows a defined, non-fake state in this fixture.

- [ ] **Step 4: calibration-references — synchronize the geometry measurement**

In the mobile overflow loop (:548-562), before measuring the `Betriebspolitik und Kontrollplan unveränderlich binden` button's widths, call `await button.scrollIntoViewIfNeeded()` (the first geometry query after a viewport change reads clientWidth 0 in Chrome; after scrolling into view the measurement is real). Do not change the overflow criterion itself (scrollWidth vs viewport width) or any other measurement in the loop.

- [ ] **Step 5: Verify the three files**

Run: `rm -rf /tmp/dispatch-*-browser-*` then each file with `timeout 240 node tests/<name>.browser.mjs`.
Expected: all three exit 0. Clean artifacts (`git checkout -- .docs/ 2>/dev/null; rm -rf test-results playwright-report`).

- [ ] **Step 6: Commit**

```bash
git add tests/planning.browser.mjs tests/calibration-references.browser.mjs tests/intelligence-profiles.browser.mjs
git commit -m "fix(tests): update browser expectations for renamed labels and native operations UI"
```

---

### Task 5: Fix async-commit races in agent-chat and github-context browser tests

**Files:**
- Modify: `tests/agent-chat.browser.mjs` (assertions around :502-507), `tests/github-context.browser.mjs` (flows at :85-90 and :154-159). No other files — in particular do NOT touch the benign same-pattern flow at github-context :228 (it converges via workspace-keyed remount; changing passing code is out of scope). No product code.

**Interfaces:**
- Consumes: React concurrent-root commit timing. In agent-chat, :502-505 mutates `window.state.accounts = []` and calls `window.render()` in one evaluate; :506 passes against the stale DOM and synchronizes nothing; :507 then polls the pre-commit DOM and Playwright throws a strict-mode violation immediately (3 options) even though the DOM converges to one option. In github-context, :85-89 (and :154-159) set a flag + `window.render()` + resolve a pending command in ONE synchronous evaluate, so the product's eligibility gate (ref updated only at commit, src/features/signals/context.tsx) still sees the old value — under the real transport these arrive in separate tasks and the gate holds; the product is correct.
- Produces: both files passing individually (twice each, deterministic) from a clean evidence state.

- [ ] **Step 1: Reproduce**

Run: `rm -rf /tmp/dispatch-*-browser-*` then `timeout 240 node tests/agent-chat.browser.mjs` and `timeout 240 node tests/github-context.browser.mjs`.
Expected: agent-chat fails at :507 (strict mode violation, 3 options found); github-context fails at :90 (`role="status"` count 1 instead of 0).

- [ ] **Step 2: agent-chat — wait for the commit before asserting options**

Immediately before the :507 assertion, insert a commit wait in repo idiom: `await page.waitForFunction(() => document.querySelectorAll("select[aria-label='Aktiver Account'] option").length === 1);` (waitForFunction precedent: tests/github-app.browser.mjs, tests/research-profile.browser.mjs). Keep the existing `toHaveText("Kein Account verbunden")` assertion unchanged.

- [ ] **Step 3: github-context — split the evaluates at both race sites**

At :85-90 and :154-159, split the single evaluate into: (a) one evaluate that sets the flag (`window.allowed = false` / `window.account = "account-two"`) and calls `window.render()`; (b) wait for commit evidence — for (A) the not-allowed paragraph `Aktuelle separate Patch-Lese-Freigabe, gültiger Repository-Nachweis und Editor-Rechte nötig.` becoming visible or the input becoming disabled (whichever the surrounding code already exposes; src/features/signals/context.tsx:118), for (B) a `waitForFunction` on a committed-state signal following the committed-flag pattern of tests/research-profile.browser.mjs:236; (c) only then, in a separate evaluate, resolve the pending command. Keep every existing assertion (including `toHaveCount(0)` on the status role) unchanged.

- [ ] **Step 4: Verify both files twice**

Run (clean evidence state first): `timeout 240 node tests/agent-chat.browser.mjs` ×2 and `timeout 240 node tests/github-context.browser.mjs` ×2.
Expected: exit 0 all four runs. Clean artifacts (`git checkout -- .docs/ 2>/dev/null; rm -rf test-results playwright-report`).

- [ ] **Step 5: Commit**

```bash
git add tests/agent-chat.browser.mjs tests/github-context.browser.mjs
git commit -m "fix(tests): synchronize browser assertions with react commit"
```

---

### Task 6: Full CI battery re-verification (supersedes Task 2)

**Files:**
- Modify: none. Verification only, exactly as Task 2 specified: if a step fails, do NOT fix it — report BLOCKED with step, failing tests/files, and first error verbatim. No commit in this task.

- [ ] **Step 1: Static + unit + evals + build**

Run: `pnpm lint && pnpm typecheck && pnpm test:bundle` — expected all exit 0.
Run: `timeout 900 pnpm vitest run --maxWorkers=4` — expected 78/78 files pass (if only heavy-file 5s timeouts appear, re-run that file sequentially to distinguish flake from real failure and report both).
Run: `timeout 900 pnpm test:evals` — expected exit 0.
Run: `pnpm build` — expected exit 0.

- [ ] **Step 2: Playwright e2e, full**

Run: `timeout 900 pnpm test:e2e` — expected 34 passed, exit 0. Clean artifacts afterwards.

- [ ] **Step 3: Browser loop end-to-end**

Run: `rm -rf /tmp/dispatch-*-browser-* && timeout 1200 pnpm test:browser` — expected exit 0 (all 26 files in sequence).

- [ ] **Step 4: Confirm clean tree and report**

Run: `git status --short` — expected clean. No commit in this task.

---
