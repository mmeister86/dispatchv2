# TASK-68.3 distinct FINAL4 QUALITY — NEEDS_WORK

Exact frozen source: `/tmp/dispatch-68.3-final4-freeze.json`, SHA256 `80bedb7055e8bb43daf6b283d81503775a21e9a9ad608c630a13d75996c17bca`, HEAD `aad403ed46bd28ba7793dbebc1aecb918531b196`. Independently verified all339 source hashes before and after; both mismatch maps empty. Read the complete fresh FINAL4 SPEC report, agreed continuation source plan, Jev generation continuation contract and actual read-only Backlog68.3. Traced concrete admission/current/source/style/clock, native funding/physical provider closures, reservation/binding/settlement/completion/application, rootless cleanup and shared UI selection/buffer/retry paths. No repository mutation by reviewer. The after-guard is a point-in-time check recorded in the receipt; Root subsequently released corrective work, so it does not assert continuing immutability.

The common money accounting, same original actor guards, conservative original-baseline repair and explicit human child selection are well placed. Previous SPEC actor/circuit/approver families do not remain findings. Two independently reproduced operation-key defects block acceptance of this exact source; neither requires speculative refactoring.

## Confirmed findings

### 🔴 P2: Repair insertion breaks existing exact generation replay

`convex/ai/jev/composite.ts:428–436` inserts a child contentRequest with the user supplied repair operationKey without enforcing the existing workspace/actor/operationKey identity. `convex/content/ideas.ts:650` subsequently queries that index with `.unique()`.

Reproduction uses an ordinary valid repair command whose operationKey equals the original generation operationKey. Repair succeeds and stores a second request in the same existing namespace. Retrying the unchanged original public generateComposite command rejects with `unique() query returned more than one result from table contentRequests`, instead of returning its exact original ready/runId result. This violates the agreed original-command replay contract and also affects the legacy generation reader sharing this index. No corrupt database fixture is needed.

Consider checking the existing index before child/Agent preparation and rejecting a occupied key with the existing conflict semantics, retaining exact repair replay before that check. Apply the same invariant to keys occupied by any other initial/repair request, without weakening `.unique()` to arbitrary selection. Add native no-effect collision denial and original replay controls.

### 🔴 P1: Reserved final verifier bypasses the operation-key admission guard and strands a hold

`convex/ai/jev/composite.ts:474` derives the final verification operationKey as `${repairOperationKey}:final`; the first verifier accepts this same valid string as its own key. `convex/ai/jev/verify.ts:632–668` converts the reserved receipt to an ordinary sent verifier receipt before the existing `by_jev_operation` duplicate guard at lines688–700, which only runs for the other funding branch. Shared receipt ownership at line790 relies on `.unique()` for that namespace.

Reproduction: first verification key `shared-composite-repair:final`, repair key `shared-composite-repair`. Original generation/first SDK check/repair SDK generation all succeed normally. Final public check converts the reserved17000 hold to owner=jev-output-verifier/state=sent, then receipt authorization and settlement throw native `.unique()` multiple-results errors. Independent effects capture confirms **0 final HTTP calls**, **2 ordinary verifier rows with the same operation key**, and **17000 heldMicros retained as sent**. This also makes later receipt projection/settlement fail, while reservation cancellation no longer accepts the converted owner. It is a concrete money and error-handling defect at an unentered physical call.

Consider enforcing the same existing verifier operation-key guard before final conversion, and detecting an already occupied derived key before repair admission so known impossibility does not spend repair money. Retain immutable exact reference/receipt identity; do not weaken settlement uniqueness or invent usage to clear the hold. Cover first/final and separate standalone/composite existing-key collisions and no native/Agent/money/scheduler/HTTP effects.

## Independent evidence

- Fresh original native command `pnpm exec vitest run convex/ai/jev/verify.test.ts convex/ai/runs.test.ts convex/content/ideas.test.ts`: **142 tests/3 suites PASS**, `/tmp/dispatch-68.3-quality-final-native.log`. No original assertions or resource ceilings changed.
- Independent copied fixture with absolute imports of actual frozen modules: `/tmp/dispatch-68.3-quality-final-control/probe.test.ts`; only first-key fixture parameterization and appended private controls. Original assertions preserved. New controls are outside repository.
- Command `pnpm exec vitest run --config /tmp/dispatch-68.3-quality-final-control/config.mjs -t 'QUALITY '`: **2 counterexamples RED**,50 original tests intentionally skipped; `/tmp/dispatch-68.3-quality-final-controls2.log`. Earlier one-control failed log remains `/tmp/dispatch-68.3-quality-final-controls.log`.
- Separate effects command `pnpm exec vitest run --config /tmp/dispatch-68.3-quality-final-control/config.mjs -t 'QUALITY final reserved'`: **1 RED**,51 skipped, with the explicit zeroHTTP/sent17000/two-key-row capture; `/tmp/dispatch-68.3-quality-final-finalcollision-effects.log`. Earlier two-control source retained as probe-v2.test.ts.
- Actual styled Ideas/Composer source traced (explicit recursive child selection, scope resets, original retry closure, no automatic buffer application). Fresh SPEC browser passes were read as provenance, not recast as new QUALITY execution. Once new confirmed blockers existed, no duplicate old-source browser or long full-suite run was started.
- No new finding against booked+reheld exposure, own circuit probe, same actor, configuration-only response, original time/style/baseline or bounded Agent cleanup in this review. Existing142 controls include their registered installedSDK/rollback/lifecycle cases; this is not a production distributed concurrency certificate.

## Limits and handoff

NEEDS_WORK applies to exact FINAL4 source despite original registered tests passing. The private counterexamples use native actions and installed SDK intercepted fetch mechanics, not paid model semantics. Real-provider semantic quality, production OCC/distributed concurrency, full33–36/manual lifecycle acceptance and usermanualDone remain open. Root full native/static/build/bundle/qualified bindings/exact existing authorized EUDev gates are separate; no source/dev acceptance is inferred. No source/generated/config/deps/env/docs/Backlog/commit/deploy/provider activation mutation performed. Request minimal root-cause correction and a new frozen independent review. Do not mark TASK-68.3 Done.
