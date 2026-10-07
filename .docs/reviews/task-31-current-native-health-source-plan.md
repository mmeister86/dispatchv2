# TASK-31 — current native Operations health source proposal

**PROPOSAL_ONLY. READONLY_PREPARATION_STOP.** Task: “Betriebsereignisse, Alerts und Wiederherstellung konsolidieren (P09.01)”. Actual CLI: In Progress; all four ACs and both DoD items remain unchecked. No implementation release, tests, browser execution, provider calls, environment inspection, source/API acceptance or readiness claim. Implement only after separately accepted TASK-68.3 and a fresh Root release. The adopted `.docs/reviews/task-31-32-35-current-native-reconciliation.md` and original 68.2 baseline remain immutable.

This narrows that adopted plan to one actual consumer: the Cloud Operations health tab. It does not repeat the TASK-32 notification or TASK-35 pilot design.

## Current mount and exact reuse boundary

`src/pages/Operations.tsx:74–115` already separates Cloud from Demo. Cloud's health tab explicitly says unavailable; calibration and algorithm profiles are real separate components. Demo HealthPanel uses workspace-local eventSeed, a650ms success timer and local reconciliation. The App protected route mounts `/operations`, and its sidebar link is visible independently of role. Therefore add an Owner/Admin-only **health component**, not a role gate over the entire page or a replacement for the existing real profile tabs. Keep Demo's local qualification and seeded state isolated.

`convex/lib/authorization.ts` provides current verified user, membership, workspace lifecycle and role predicates. Proposed `health.get` is a `workspaceQuery` plus `requireRole(ctx.membership,[Owner,Admin])` and `ctx.user.activeWorkspaceId === ctx.workspace._id`; reject before reading any domain sample. An optional accountId must be an actual same-workspace account. This query introduces no mutation or recovery authority.

The actual read paths expose two concrete hazards for this new consumer:

* `ai.runs.recent` takes10 workspace runs and then reads receipts; it has no private actor/chat exclusion. Do not wrap it as an Admin health list.
* `research.runs.history` paginates first, filters targetedChat afterward and returns the unfiltered isDone/cursor. Do not derive public Health counts, sample limits or hasMore from it. Owner/Admin does not gain another actor's private conversation. `conversationAccess` checks exact actor/account/workspace; workspace Health deliberately excludes **all** private conversations, including the operator's own.

Global `githubRecoveryScan.by_key('app')` remains App-wide scan evidence. Its oldestAt/limited/error/notBefore is not tenant backlog coverage. `signals.recoveries` owns the real workspace recovery projection and derives localReceipt/current unknown, but also reads shared-GUID cooldown/attempt limits: reuse that actual gate, never relabel its shared attempt count as a tenant count. `publishing.reconcile.inspect` is an existing read projection with up to101 attempt rows and thread positions; it is not a safe universal Health aggregate or a new send permission. Recovery components already own their stronger current source/review/session checks.

## Exact proposed DTO, not an installed API

Proposed query arguments are workspaceId, optional accountId and a bounded opaque refreshKey (at most64 characters). The UI captures a new key for an explicit “Nachweis aktualisieren” read; server time and native guards remain authoritative. This avoids relying on unchanged reactive query arguments to reevaluate Date.now after expiry. A refresh key grants no source permission and creates no occurrence/attempt. One fixed result contract; no dynamic observer registration or arbitrary metadata:

```ts
{
  workspaceId, accountId: NativeAccountId | null,
  authId: string, sessionId: string,
  observedAt: number, validUntil: number,
  coverage: {
    kind: "bounded_receipt_sample", accountsLoaded: number,
    moreEligibleAccounts: boolean, total: null,
    reasons: ("parent_cap" | "child_cap" | "read_budget" |
              "family_not_implemented")[]
  },
  families: [{
    family: "publishing" | "github" | "media" | "research" |
            "generation" | "own_metrics" | "own_history" |
            "jev_analyzer" | "intent_routing" |
            "embedding" | "output_verification",
    coverage: "bounded" | "not_evaluated",
    sampledRows: number, moreEligibleRows: boolean | null, total: null,
    configuration: "not_evaluated" | "disabled" |
                   "configuration_required" | "locally_eligible",
    remoteCheck: "not_performed",
    reason: SafeCode | null,
    rows: [{
      parent: FiniteNativeParentRef, accountId: NativeAccountId | null,
      state: SafeNativeState, code: SafeCode | null,
      recordedAt: number | null, deadline: number | null,
      leaseUntil: number | null, notBefore: number | null,
      proofUntil: number | null, overdue: boolean,
      recovery: AuthorizedFiniteRouteRef | null,
      receiptCoverage: "complete_for_parent" | "bounded" | "not_evaluated",
      moreReceipts: boolean | null,
      receipts: [{
        attemptId: NativeAttemptId, owner: AcceptedNativeOwner,
        state: SafeReceiptState, currency: string,
        heldMicros: number, estimatedMicros: number | null,
        settledAt: number | null
      }]
    }]
  }]
}
```

Native ID/ref types and validators are finite unions of the actually implemented parents, not a free string/payload dictionary. The owner union is reconciled against the accepted 68.3 source before implementation. Family labels may describe omitted work; they do not imply its readers are installed. No titles, prompt/topic/question/text/alt/patch, provider body, object key, bucket/account binding, auth URL, email, credential fingerprint or raw exception message. Do not put arbitrary source props into `parent`, `code` or route parameters. Keep correlation as existing allowlisted parent/attempt identity, not a new correlation registry.

Auth/session fields reuse the actual pattern in `editorial.reviews.get:539–564`. `validUntil = min(observedAt+30000, current minimum displayed proof horizon)`; null proof horizon means no declared horizon, not healthy forever. A new request must reprove scope. Use existing nativeScope/session identity and proof-clock fencing; expired cached rows/links/counts disappear or show “Nachweis aktualisieren”, never a green success. Client time can mark a known deadline overdue, but never settles money, executes recovery or changes native state.

## Smallest concrete read algorithm and ownership

First source unit implements five receipt families: publishing, GitHub, media, public research, public generation. Other fixed family cards initially have `coverage:not_evaluated`, rows[], sampledRows0, moreEligibleRows:null, configuration:not_evaluated and total:null. This is an explicit coverage boundary, not proof of no jobs/no liabilities. Separate pure local-admission adapters can follow for the accepted seven financial owners and output verification; no amount may be filled from configuration or a proposed future schema.

Proposed fixed caps: at most3 authorized accounts (fetch4 for public account cap+1),6 rows per implemented family,30 rows overall,6 validated financial children per row (fetch7 for child cap+1). Shared request safety budget:128 logical DB reads/queries,512 documents,512KiB observed DB bytes,64KiB serialized DTO. An implementation must reconcile these proposed ceilings with actual runtime metrics and original owner readers before release; do not widen or weaken existing 32-material/101-attempt/native limits to fit this overview. Charge parent, child and proof reads to the shared budget. Reserve enough for an already started proof before starting it; stop an unstarted family/parent with explicit read_budget coverage. An actual unexpected query/byte/resource failure propagates; it is not caught as disabled/source loss/provider failure. A deliberately sampled child window never proves a complete thread or total cost. No cursor is returned by this initial DTO.

| Family | Actual selection and minimum proposed projection |
|---|---|
| Publishing | Existing `schedules.by_workspaceId_and_at` bounded recent receipts. Show stored schedule state and original version/account/generation; up to6 actual attempt rows and necessary media checkpoint rows through existing schedule/generation indices. Compare original deadlines/lease/reconcileNotBefore; expired sending is attention/uncertain, never rejection or unsent. Stored position zero is not whole-thread completion. Source/approval/review proof must succeed before a Draft recovery link is emitted; the link opens existing Draft/Calendar recovery. A limited sample does not claim coverage of all stalled schedules; targeted attention selection is a later small query decision if the real UI requires it. |
| GitHub | Existing workspace updatedAt recovery index, current same-workspace repository generation/monitoring source proof and `localEvidence`. Allowlist missing/requesting/accepted/unknown/processed and localReceipt, lease/notBefore. Shared GUID cooldown remains an external gate, not a tenant incident total. Do not project global scan timestamps/oldestAt as this family's coverage. Link existing Signals recovery only. |
| Media | Existing `mediaAssets.by_workspaceId_and_state` for uploading/validating/deleting/failed with a shared6-row family cap across finite state branches; selected asset→`mediaUploadSessions.by_assetId`. Ready/deleted are not sampled as incidents. Reuse native expiresAt, leaseUntil and cleanAfter semantics. A cancelled session remains quota liability until actual deletion receipt; validating is explicitly resumable before its original24h abandonment threshold. Query never invokes cleanup/due or creates an R2 request. Link existing Media UI; no Health quota repair command. |
| Public research | Bounded authorized accounts→actual profiles→**new selective index** below. Exclude every targetedChat order before limit, count, cap+1, amount/hasMore and cursor decisions. Show original state/deadline/native outcome; completed versus empty/partial/failed/unknown remain different. `usageMicros:null` is not zero. Deleted/unselected profile coverage is omitted, not “no jobs”. Stop remains the existing role/source/generation command in Research. |
| Public generation | **New selective index** below; only draft/summary/plan branches, original conversationId and chatOperationId absent. Exclude all chat and research Agent-run families; public research is represented through its order. No Agent thread/message/stream query at any point. Current/retained source/style proof governs the parent/link, and original validated generation receipts govern amounts. Existing state=completed/settled0 does not itself prove provider success. Link existing Ideas, Signals or Plans where a current exact parent is actually available; otherwise recovery:null. |

Only two new indices are justified by the concrete private-sample consumer:

1. `agentRuns`: `[workspaceId,purpose,conversationId,chatOperationId,createdAt]`; select a finite allowed purpose with both private links absent **in the index prefix**, before take3/cap+1 per branch; merge deterministic createdAt+nativeID ordering under the shared6 cap. This avoids a capped mixed private/public scan. Existing `generationPurpose` also includes research and chat; both are deliberately omitted here.
2. `researchOrders`: `[profileId,targetedChat.conversationId,createdAt]`; prefix the selected profile and absent targeted conversation, then bounded take. Existing `research/cache.ts` already uses an indexed optional-field equality with undefined, so the proposal is grounded in the installed code pattern. Validate historical targetedChat invariants in the future native control; malformed ambiguous private linkage must fail closed, not be counted publicly. No backfilled visibility table or observer state is needed.

Do not implement “take a mixed page, filter private rows, return old hasMore” or hidden scanned-row totals. Public DTO equality must hold when an arbitrary number of another actor's private rows are added between unchanged eligible rows. Authorization/source omissions can reduce the displayed authorized sample; do not return the hidden count or infer total completeness from an empty visible result.

Production ownership for the first release: new `convex/operations/health.ts`, new `src/features/operations/health.tsx`, existing `src/pages/Operations.tsx` health mount only, and `convex/schema.ts` only the two justified indices. Existing owner modules are reference-only unless a truly shared pure status/proof helper requires a small explicit export; source release must list that exact helper/body first. Do not add errors.ts/systemEvents.ts merely because TASK-31's old description names them. No copied event stream, new table/ledger/watchdog/telemetry library or provider transport.

Controls: new `convex/operations/health.test.ts` and an isolated `tests/operations.browser.mjs` using real mounted Cloud Operations/Store/production CSS and clearly synthetic native transport; extend the existing browser task runner only if needed to execute that script. Root owns Backlog and eventual concrete runbook/docs. This is path ownership proposed for a later release, not permission to edit now.

## Local configuration, actual evidence and money

Actual `media/r2.status` authorizes workspace access and only calls `configuration()`, which constructs S3Client; it makes no R2 network request. Task-9's current read-only CLI notes explicitly document that distinction. Configuration constructor success and local binding/key presence cannot mean upload/CORS/namespace/runtime service health. Initial Health query does not import the Node R2 module or call this action on render: media configuration remains not_evaluated, and the existing Media configuration UI may label an explicit result “lokal konfiguriert; Verbindung nicht geprüft”. Historical ready/deletion receipts are evidence of their original operation, not current bucket health or new provider tests. Task-9's separately recorded live notes are external historical evidence, not this preparation's live check.

Generation `runs.availability` actually returns configuration_required unconditionally plus local booleans; do not rewrite that into ready. Analyzer `jev/access.availability` validates native controls/policy/grants/profiles and returns ready/disabled/configuration_required/unavailable; its ready means local admission eligibility. Embedding `similarity.availability` separately reports enabled/sendConfigured/storedEnabled/proof expiry. Routing availability is an independently scoped local configuration check. Own metrics/history overview readers return bounded posts and imported text as well as metadata: **do not call their full content overviews just to draw a Health lamp**. Reuse/export narrowly the existing pure control/policy/credential status predicates and job receipt checks in their owner modules, or leave their card not_evaluated in the first unit. Current service availability, uptime, latency distribution and recovery are not inferred from any of these booleans.

Seven existing finance families remain generation (legacy owner omitted), native-search, jev-analyzer, intent-routing, own-metrics, own-history and own-content-embedding. Validate each original receipt through its actual owner/parent reader. Do not use one generalized aiAttempt cast or aiBudgets provider totals: provider scope is shared across tenants and may include excluded private work. A single attempt's three original provider/workspace/account reserve counters are three scopes of one liability; never sum them into triple spend. No workspace/global aggregate cost is part of the initial DTO. Keep receipt currency and actual estimatedMicros null/0 distinction; sent before HTTP is not confirmed physical I/O, unknown remains held after timeout, and late genuine settlement updates the same immutable original receipt exactly once. Current policy price cannot reprice old receipts; no FX, fabricated billedMicros or missing-field zero.

During this preparation 68.2's writer is creating the verifier path and schema/owner widening. Read names/partial shapes are moving observations, **not accepted installed APIs**. Root's narrow compiler-reader addendum names `jev-output-verifier`; do not assume the proposed verifier get/availability/circuit/receipt fields are final or treat analyzer/routing controls as verifier health. After accepted68.2/68.3 reconcile actual verifier parent, original owner/price/three grants, pending/known-zero/unknown/current-retained states and whole composite operation envelope. Until then output_verification is explicitly not_evaluated. Health may never prepare/verify/classify, acquire a circuit probe, fund, settle, regenerate, retry physical work or delete/regrant authority.

## Future acceptance checks, not executed results

1. Actual two-workspace/all-role controls: Owner/Admin with active matching workspace can read; Editor/Viewer, foreign account and deleting workspace are denied before samples. Source/account/grant/actor/role loss removes links/protected metadata under existing proof predicates. UI old auth/session/nativeScope response cannot flash after account/workspace ABA.
2. Native privacy counterexample with interleaved >cap foreign and same-operator chat runs, targetedChat research and their unknown costly receipts: public rows/counts/cap+1/hasMore/cursors/amounts byte-identical to the public-only control. Spy on Agent component APIs and provider fetch: zero calls. Test allowed public-purpose branches and optional-index legacy invariants; do not merely assert excluded rows absent.
3. Real cap+1 boundaries, three accounts, multiple state branches, deterministic ties, six financial children and exhausted shared read budget: limited sample labeled, total always null, empty not healthy. Native injected unknown/query/resource errors propagate and make no mutation/erasure/circuit change. Protected original resource ceilings and existing tests remain unchanged.
4. Actual stored lease/deadline/notBefore edges at just-before/exact/after times: stalled publishing, GitHub expired request lease and research running deadline show attention without resend. Cooldown is awaiting, unknown costs remain held, cancelled media quota is not released by the query. This proves detection **when overview is read**, not a continuously running alert/watchdog.
5. Original financial-owner/currency validation across seven accepted owners and later accepted verifier; zero versus null, multiple policies/currencies, missing/foreign receipt, same receipt reached through two parents, cancelled source and late settlement. Existing owner commands settle; Health only rereads. Amounts do not multiply by three scopes and private receipts never enter totals.
6. Actual styled Cloud health at1280/390, keyboard, unloaded/limited/not_evaluated/error states and source clock, preserved calibration/profile tabs, role/session swap, authorized existing route links and isolated Demo timer. No generic “Wiederholen” or local Demo success in Cloud. There is no authenticated/manual/screenreader proof until actually performed.
7. Root later writes a concrete finite runbook around existing Publishing lookup/continueThread/finalizeAbort, Signals recovery and Research stop/configuration. Exercise controlled Jev outage/recovery with original caps and manual publishing under its independent approval/FirstWrite/review rules. No injected events or guessed occurrence table solely to satisfy AC1; consume original real synthetic native failure receipt. Recovery exercise, external service evidence and all Task31 ACs remain open until that work occurs.

## Read and guard qualification

Full meaningful TASK-31 CLI text and both adopted Operations contracts were read. Actual source was inspected at the exact ranges/searches recorded in the receipt; the initial full Operations output and some batched source output were truncated, so only read Cloud/Health/body ranges are claimed. Relevant native tests were **read**, never run. No Context7 docs command was needed: this is code/business-seam review, not a library syntax/usage request.

Initial source guard at15:29:36.360923UTC protects315 actual unowned non-generated original paths. Root corrected its brief's307 count: the original334 map contains5 generated files; the other8 previously counted as generated are configuration paths and remain protected. Later Root explicitly added ONLY `convex/ai/runs.test.ts` to the sole 68.2 writer's ownership; immutable addendum SHA `be3debd72bafb8a92b74087ab0459a94a6620b73b0b57ce4920cd8c2d9b2f965`. Final preparation guard therefore checks **314 original unowned non-generated paths**; original315-before map and baseline remain intact. Moving19 owned paths (15 original+4 new) and5 generated paths are excluded. Expected final source count338 is a baseline expectation, not an accepted current freeze. No all334 unchanged claim is made under this writer.

Initial six immutable input guards and two later-start receipt guards plus the ownership addendum are checked before/after. The old plan is untouched. An initial expected307 assertion failed only because the brief's count was wrong; Root corrected the count and then authorized the extra writer file. Missing-path/glob discovery mistakes and truncated displays are recorded; no source defect or test failure is claimed. Final report/receipt are new private artifacts. **READONLY_PREPARATION_STOP.**
