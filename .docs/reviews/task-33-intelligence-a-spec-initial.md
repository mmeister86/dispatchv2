# TASK-33.1 unit4A — independent SPEC review

**Verdict: ❌ Not spec compliant. Four reproducible P1/P2 findings require repair.**

Reviewed repository `/Volumes/Speicher/Projekte/dispatch_v2`, baseline `eb32ad6`, frozen manifest `/tmp/task33-intelligence-a-freeze.json`. All 16 SHA-256 hashes matched before review and again after the reproductions. Review was read-only for source, Git, Backlog and deployment. Only `/tmp/task33-spec-harness/` and this report were written.

## Findings

### 1. [P1] Own assessment requests export foreign profile references

**Location:** `convex/operations/exportIntelligence.ts:1347` (request reference validation through line 1376).

The branch validates the nested workspace/actor/operation key, account and Draft version, but never reads `request.algorithmId` or `request.audienceId`. Its call to `assessmentSource` is insufficient: `convex/intelligence/assessments.ts:32` only proves the Draft/version source. Consequently this affects both retained requests and unavailable headers.

**Reproduction:** The independent native test creates a real assessment request via `internal.intelligence.assessments.prepare`, clones an algorithm profile into another workspace, and patches the request's `algorithmId` to that foreign profile. Both with a normal Draft and with `draftVersion.sourceUnavailable=true`, `exportIntelligence.page` resolves successfully and places the foreign algorithm ID on the wire. Expected whole-page `REFERENCE_ACCESS_DENIED`; actual success with `materialAvailability` respectively `retained` and `unavailable`.

**Required repair:** Validate both saved profile references against the exact request workspace/account/network/surface before determining source loss or producing a DTO. Preserve legitimate historical profile selection and status; do not replace the saved profile IDs with today's selection. Add real native regressions for foreign algorithm/audience, account mismatch and both retained/unavailable paths.

### 2. [P1] Assessments never prove the original policy referenced by their receipt

**Location:** `convex/operations/exportIntelligence.ts:837` (receipt checks through line 855).

The code compares an attempt's policy/model/provenance fields with the saved assessment, then calls Draft-only `assessmentSource`. It never loads the actual original `jevPolicies` row, verifies its workspace/account and kind, or proves the original policy fingerprint/model binding. Agreement between two referring records does not establish the policy's scope or identity.

**Reproduction:** Produce an assessment through the actual `api.intelligence.assessments.analyze` action and mocked provider transport; prove a baseline archive page succeeds. Change only that assessment's original policy row to a different workspace. The archive still succeeds with the complete assessment result and original policy ID. The independent assertion expecting `REFERENCE_ACCESS_DENIED` fails.

**Required repair:** Use the established original analyzer policy/receipt proof semantics, extracting a narrow retained helper if necessary. Check exact original policy scope, kind, original model/version and saved fingerprint before emitting the assessment, preserving original retention constraints. Do not substitute the current selected policy or require current execution eligibility for historical records. Add the native foreign-policy regression plus original policy/model/fingerprint corruption checks.

### 3. [P2] Download projection drops every normalized assessment answer value

**Location:** `src/features/settings/data-archive.tsx:203`.

The download allowlist uses raw provider answer fields (`choice`, `noul`, `score`, `probabilities`, `legend`). Actual stored normalized answers use `value` for choice/score and `probability` for noul, as defined in `convex/ai/jev/types.ts:24` and the `answer` validator below it. The native endpoint correctly returns those normalized fields, but the download silently strips them. For example `{type:"score", value:0.625, confidence:0.9}` becomes `{type:"score", confidence:0.9}`; `{type:"noul", probability:0.2}` becomes `{type:"noul"}`. All nine answers in a genuine native assessment lose their values.

**Reproduction:** The independent test produces an actual native assessment and archive page, extracts the exact existing `intelligenceData` implementation and its projection helpers from the TSX source using the installed Prettier TypeScript parser, strips only TypeScript syntax with Node's built-in utility, and executes it against that native endpoint output. Deep equality between downloaded and endpoint `result.answers` fails with all `value`/`probability` fields missing. No modified production projector or handwritten surrogate was used.

**Required repair:** Allowlist the persisted normalized Answer fields (`type`, `value`, `confidence`, `probability`). Extend the mounted download regression to use native-shaped normalized answers and assert the downloaded values, including zero/null states where supported. Mocked raw provider payloads are not representative of this boundary.

### 4. [P2] Retained routing archive omits the original model/policy provenance

**Locations:** `convex/operations/exportIntelligence.ts:1398`, `convex/operations/exportIntelligence.ts:1440`, and `src/features/settings/data-archive.tsx:43`.

The native `routingReceipt` is validated but its return value is discarded. The routing DTO and browser allowlist contain no safe original model/policy provenance. The routing operation itself has `policyId` and `attemptId`; the original attempt has its original policy/model fields. Thus a successful retained export preserves the routing choice but loses the required original model pin.

**Reproduction:** Use the extracted original routing fixture, call `routing.prepare`, then the real `routing.classifyAction` with mocked provider transport. The saved original model is `synthetic-routing-1.0`; the entire archive row does not contain it. The independent model-preservation assertion fails.

**Required repair:** Project the required safe provenance from the actual validated original receipt/policy, with an explicit backend validator and matching browser allowlist. Preserve original null/no-attempt cases for default-OFF, fallback and pending operations. Do not invent provenance, use today's selected policy, or expose credentials/fingerprints/operation keys. Add native and downloaded-JSON assertions across funded and no-attempt cases.

## Independent evidence

- Frozen file integrity: all 16 hashes match, including after tests.
- Ran `node node_modules/vitest/vitest.mjs run convex/operations/exportIntelligence.test.ts convex/ai/jev/routing.test.ts convex/ai/jev/verify.test.ts convex/intelligence/profileUpdates.test.ts`: **4 files, 207 tests PASS**, 6.61 seconds.
- Independent `/tmp` reproduction: **5 tests fail**, representing the four findings (request scope has retained and erased variants).
- Reproduction source: `/tmp/task33-spec-harness/regression.test.ts`.
- Full reproduction output: `/tmp/task33-spec-harness/results.txt`.
- Run from repository: `node node_modules/vitest/vitest.mjs run --root /tmp/task33-spec-harness regression.test.ts`.
- Fixture parity script: `/tmp/task33-spec-harness/parity.cjs`; run from repository with `node /tmp/task33-spec-harness/parity.cjs`. Uses the installed Prettier TypeScript AST parser. All **13 extracted declarations** match baseline, ignoring only `export`, source coordinates and the necessary relative dynamic import relocation. All remaining original statements in routing/verify/profileUpdates test files match baseline AST, including assertion order, values and error assertions.
- Inspected supplied browser evidence `/tmp/task33-intelligence-browser-final/intelligence-archive.json`: correctly labels transport as mocked and lists routing/verifier JSON and guard checks. It does not establish normalized assessment download parity; finding 3 demonstrates that gap. Browser evidence was inspected, not rerun or represented as an independent browser pass.
- Root clarified that existing shared `numeric` rejection of `-0` is the accepted requirement; no finding is raised against this behavior.

## Coverage of the requested shape

The frozen implementation contains all 15 fixed families, all five required workspace/actor prefix indexes, native `numItems:1` pagination and immutable `_creationTime` upper bounds. Public arguments do not expose caller actor/user/table selectors. Shared Owner/Admin gating and own actor-prefix queries precede candidate discovery. The common `proofContext` preserves the existing context and tenant checks. Whole-envelope byte and numeric checks, native cursor forwarding, retained routing/verification helper extraction, historical profile-update mode, source update structural links, composite/root bindings, and the archive selection/stale-response guard integration are present.

Native tests exercise genuine assessments plus recommendation receipts over multiple pages, default-OFF/funded routing with policy selection changes, distinct standalone verifier ownership, seven criteria, composite repair/final state, all shared profile/style families, public source-update history beyond old list limits, source loss and graph-limit failure. These passing checks do not negate the four targeted reproductions above.

No generic export engine, new dependency or deployment was introduced by the reviewed scope. This is a SPEC gate; a separate QUALITY review should follow repair and a new freeze.

## Limits

Skipped the full long-running baseline/style stress suite and did not deploy or rerun the full mounted browser harness. The present freeze must not pass the SPEC gate while the demonstrated reference-validation and archive data-loss defects remain.
