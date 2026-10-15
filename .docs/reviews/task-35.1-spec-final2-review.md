# TASK-35.1 — fresh independent SPEC final2

**Verdict: PASS for the repaired bounded impressions slice.** This is a fresh verdict on final2, not a carry-forward of final1 PASS. My final1 SPEC missed the legacy NaN age predicate; distinct QUALITY correctly withheld acceptance. The actual unchanged independent failing assertion is now GREEN. Distinct fresh QUALITY and remaining Root release gates follow separately.

Freeze SHA256 `ad001848863bbd9d3c56d681330a344576a7421f93ccb7f66082732d0ffca518`; ready SHA256 `03aa1ef964e51f8a5893e87f966c4d364848eb2f432685068d8ce96ab15e5a5d`; verified locally. HEAD `93b76bc9cc6deeea6e3373e6d0144a777b8c5d22`. Read the retained final1 QUALITY blocker/report, exact control/assertion and RED evidence, final2 readiness/repair, actual timestamp guards and new registered control, scoped release/criteria and unchanged consumer/proof paths.

## Concrete repaired boundary

At `convex/operations/pilot.ts:173–175`, both original snapshot observedAt and providerCreatedAt must be finite when non-null, before retained proof and pure describe. This prevents NaN from making the existing comparison `abs(observedAt-providerCreatedAt-24h)>60s` falsely pass. Either non-null NaN/+Infinity/-Infinity causes whole-query PILOT_SOURCE_UNAVAILABLE; no successful measured count or partial-number fallback.

Null clocks still reach existing missing-provider-time handling: n0/sum null/mean null. Finite clocks120s outside the permitted age tolerance remain unknown, not errors or measured0. Original valid clock pair still yields n1/sum7/mean7. No timestamp normalization/defaults, weakened original binding, shared-baseline modification or broader framework.

Final2 changes exactly pilot.ts and pilot.test.ts; the other347 final1 source/config paths are byte-identical. The nine registered Pilot controls include the new two-field table, with all finite/null/invalid outcomes actually executed. The original private QUALITY test file/config/assertion are unchanged; SHA256 control `706eaf744df9a795cdd39edeef05d68ad49dc71434e5fdc71b16ab442e124a8e`.

## Fresh executions

- `pnpm exec vitest run convex/operations/pilot.test.ts convex/performance/baselines.test.ts tests/foundation.test.ts --silent=false`: exit0, **31 tests /3 files PASS**,9 Pilot+17 original baselines+5 foundation. Fresh log `/tmp/dispatch-35.1-spec-final2-native.log`. Five-proof native measurement remains173 queries,177 documents,69,422 read bytes;0 writes/scheduled functions. This measures actual Auth-inclusive synthetic fixture work, not production provider/OCC behavior.
- `node node_modules/vitest/vitest.mjs run --config /tmp/dispatch-35.1-quality-final1-private.config.mjs -t 'QUALITY corrupt observation clock'`: exit0, **the exact independent control PASS**,8 original fixture tests skipped. Fresh log `/tmp/dispatch-35.1-spec-final2-private-clock.log`. Its old `/tmp/dispatch-35.1-quality-final1-clock.log` stays RED with the original n1/sum7/mean7 incorrect resolution evidence; nothing was rewritten or waived.
- `DISPATCH_HEALTH_EVIDENCE_DIR=/tmp/dispatch-35.1-spec-final2-browser node tests/operations.browser.mjs`: exit0, fresh original frozen harness on5189, unique evidence directory, actual App/Store/production CSS1280/390. Owner/Admin versus Editor/Viewer/account selection, correlation/new nonce/account-role-sessionABA, null versus zero, local expiry without new key, entropy/retry/error privacy passed. Prior Health/notifications/inbox/four-role export/Demo controls passed; provider/App storage/domain writes0. Expected injected error-boundary stacks remain deliberate negative controls; browser receipt has no unexpected pageerrors. Both fresh Pilot screenshots visually inspected: desktop numerical zero clear; mobile wraps the explanatory card/control without horizontal overflow, metric group continues below first viewport.
- Fresh private-copy Babel preservation check: original107 assertions retained structurally and in order;143 current. No original comparison artifact or assertion changed.

## Current contract rechecked

Registered public get and internal sample reuse live verified native session/own membership/active workspace, OwnerAdmin/current actor/exact account before numbers. Original singleton/no-media/version/draft/schedule/position/external attempt/confirmation/generation/connection binding stays intact. <=8 distinct canonical original policy field descriptors, retained original policy fingerprint/current numeric account-policy-actor-grant-credential horizon and exact24h candidate remain required. No private ancestry/topic/assessment/media walk/provider/write path is added. Proof/DB/index/native budget failure remains whole-response unavailable.

Existing pure describe preserves metric-specific known n and compatible original definitions/dialects, valid zero/null and safe integer aggregates. Hash keys hide raw definition identifiers; DTO exposes no private contents/provider IDs/hidden omissions/expense/usefulness/time-saving/whole-Pilot denominator. Latest5 original singleton text-post sample and unknown remainder are explicit. Empty/unavailable is not measured zero. Native policy tariff and Health window counts remain excluded from Pilot expenses/population.

Outer Auth/scope metrics are deducted before same-snapshot nested limits; public successful totals256queries/256documents/512KiB and full32KiB DTO rechecked. Nonfinite guard adds no reads. Native crossing-read overage is qualified, not a pre-read no-overshoot promise. Internal reproof and public bounded consumer roles stay as released. UI fresh-key native wrapper/session/account/scope fences, generic errors and minimum proof-expiry clock remain intact and freshly exercised.

## Exact guards and preserved failure history

All349 final2 frozen paths match before/after:344 nongenerated+5 generated.339 protected old non-generated baseline paths exact; all other347 final1 files and all5 generated hashes unchanged from final1. HEAD/human .zcodeignore unchanged; ignore SHA256 `521c1c381b116d50e24303da3d1859faa648f29bcda2440c0b9035412e0608e5`. No repository/source/test/docs/generated/Backlog/env/config/live/provider modifications by this reviewer; native fixtures are ephemeral.

Every artifact hash in retained final1 QUALITY receipt verifies, including report/receipt, prior SPEC, freeze, private control/config/RED log, native/browser guards/logs/screenshots and assertion proof. Original writer failure history and final2 clock-table RED are preserved; new runs use new paths. The prior localhost EPERM disk log was overwritten by the writer's documented approved retry; no nonexistent preserved artifact is claimed. Entire Demo/Analytics/Store/Auth/shared performance paths are unchanged; old107 browser assertions remain exact.

Machine receipt `/tmp/dispatch-35.1-spec-final2-receipt.json` records freeze/ready/report hashes, command exits/log hashes, exact private-control provenance, fresh browser screenshots/receipt,349 before/after guards and339 protected/347 unchanged/history reconciliation.

No full unchanged suite/static/codegen/Dev/production/manual/legal acceptance by this reviewer. Parent35 remains open. Observed UI cleanup cannot retract already authorized in-flight bytes or erase SDK buffers; no instant revocation claim. This fresh SPEC PASS permits distinct QUALITY review, not manual Done.
