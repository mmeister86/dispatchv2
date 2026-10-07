# TASK-33.1.1 — independent fresh SPEC final1

**Verdict: PASS for the released selected-workspace self-profile export slice.** No concrete correctness/privacy defect found in the frozen source. This is not parent33/33.1 completion, distinct QUALITY, full native rerun, deployment/legal/manual acceptance or permission to mark Done.

Freeze SHA256: `10b688ff81f5e4542d494628a593efee3f8b4b4203749307b32bf2a76277f21a`; source-ready SHA256: `df8aa2e133a321269753bce74f4547c50d249bd777c015c3d84e5453ad1918cd`. Both were verified locally. HEAD before/after: `283d3612b15a30755a5f89727f5844b314f19c89`.

## Reviewed authority and actual implementation

Read CLI TASK33.1.1 AC1–4/DoD, source release, first-unit YAGNI critique and request/scope reconciliation. Reviewed complete export query/component/native tests, actual Settings mount diff, Store keyed scope and installed Auth helper, complete export browser controls plus native foundation tests. The initial combined freeze/ready tool display truncated; structured JSON was subsequently parsed and every frozen path checked, rather than claiming all printed lines were read.

`convex/operations/export.ts:self` reuses workspaceQuery: live verified native Auth user, own indexed app user, current own membership and active workspace. Client expectedAuthId must match ctx.user.authId, and selected workspace must be the user's actual activeWorkspaceId. No user/table/cursor/session selector or Admin override exists. The own preference index is the fourth single-row app read; missing profile fails. All four membership roles share self rights. Native session ID is read from identity after existing helper proves session existence/expiry; no client-echo session is treated as authority. Valid production identity claims remain the trust boundary.

The server constructs fields explicitly: app ID/creation context, workspace ID/name, own role and original eight profile fields. No default profile, context description, owner identity, private family count or content/component/provider data. Correlation wrapper is wire-only. NaN/infinities/negative zero cannot be silently normalized by JSON; onboardingStep finite legacy values are preserved rather than constrained to current onboarding defaults. Complete wire JSON including correlation is checked <=64KiB; exact boundary and one-byte overflow run natively. Coverage.complete is qualified by selected_workspace_self_profile and static included/unsupported families, not a whole-data claim. Native read/index errors propagate; no partial success fallback.

`src/features/settings/data-export.tsx` creates a fresh UUID inside try on each explicit click, calls query without prewarming/subscription, disables duplicate in-flight work and checks ticket/scope/native auth/session/request/workspace before Blob construction. Download serializes result.data only. Actual Store parent remount includes auth/session/app-user/workspace/role; Settings additionally keys by nativeScope including account. Effect cleanup invalidates old tickets and revokes URL/timer. URL is also revoked after successful handoff and on handoff failure. Generic errors contain no raw protected backend/provider/entropy text. The status accurately says handed to download, not saved or physically delivered.

Pinned ConvexReactClient.query source confirms identical args may use localQueryResult immediately; unique keys partition that cache. Browser fixture checks actual per-click uniqueness and native correlation mismatches; it does not run the physical SDK network/cache. This is source corroboration plus actual consumer behavior, not a production token/cache test.

## Independent executed evidence

1. `pnpm exec vitest run convex/operations/export.test.ts tests/foundation.test.ts` → exit0, **12 tests /2 files PASS** (seven export, five existing foundation). Log `/tmp/dispatch-33.1.1-spec-final1-native.log`. Registered export controls exercised real native role/self isolation, foreign/unselected/inactive workspace, membership loss, missing/expired/unverified sessions, invalid selectors, absent/oversized/nonfinite legacy data including-0, invariant whole response under20 foreign private profiles, duplicate-index error and native read-limit failure. Native assertions bound fixture total reads including Auth <=10 queries/<=8 documents, with no export writes/scheduling/HTTP. Foundation includes actual Auth handler/JWT/session lifecycle with mocked mail delivery; no physical mail/provider call occurred.
2. `DISPATCH_HEALTH_EVIDENCE_DIR=/tmp/dispatch-33.1.1-spec-final1-browser node tests/operations.browser.mjs` → exit0, original frozen harness, port5189, actual App/Store/production CSS at1280/390. Own unique evidence directory and receipt. Four actual downloaded role JSON files were parsed; correlation/private fields absent. Fresh keys, entropy failure/retry, mismatched native auth/session/request, role late response, observed session/workspaceABA, unmount/late error, failed anchor handoff URL cleanup, zero App storage/domain writes and blocked provider routes passed. Existing Health/notification/inbox/Demo controls also passed. Browser receipt reports no unexpected pageerrors/provider calls. The log contains expected injected Health error-boundary stacks; these are deliberate existing negative controls, not hidden run failure.
3. Visually inspected the actual 1280 and390 export screenshots. Partial-export explanation and download button fit; Viewer self rights remain available. No manual accessibility or user testing claimed.

No full suite rerun, static/build/codegen or EUDev was performed by this reviewer. Root's codegen/static evidence remains separate; this verdict does not substitute for the remaining release gates.

## Preservation and artifact integrity

Before and after all346 frozen source/config paths match exactly (341 non-generated,5 generated). Original baseline343 paths were separately reconciled:336 protected old non-generated paths exact; only Root api.d.ts import/map delta exists among generated files (two additions, inspected). Human .zcodeignore stays SHA256 `521c1c381b116d50e24303da3d1859faa648f29bcda2440c0b9035412e0608e5`. No repository/test/source/docs/Backlog/config/provider/live data mutations were made by this review; native fixture setup is ephemeral.

The complete Demo downloadBlob+DataSettings tail is byte-identical to HEAD. Browser original67 expect blocks remain unchanged: full diff removes only the import line and old direct-query transport stub; current107 include40 additions. All other original tests match protected baseline hashes. All six historical writer RED/setup/entropy/failed-harness logs match source-ready hashes and remain untouched.

A private read-only AST inspection setup failed because installed typescript default export lacks ScriptTarget.Latest. It is recorded separately and not counted as PASS. Exact source diff and Demo-tail comparison provided the preservation proof instead. No original assertion or test fixture was modified.

Machine-readable receipt: `/tmp/dispatch-33.1.1-spec-final1-receipt.json`, with before/after guards, native/browser commands/exits and SHA256 artifacts including this report, screenshots, originals preservation and historical provenance.

## Limits

Authorization linearizes at the native query snapshot. Observed UI scope cleanup discards late results; it does not instantly revoke an already authorized in-flight response or bytes saved by the user. No SDK-buffer erasure, abort of computation, physical file revocation, whole account/workspace/components export, legal portability/retention/deletion proof or manual Done claim. Separate QUALITY and Root release/deployment gates remain pending.
