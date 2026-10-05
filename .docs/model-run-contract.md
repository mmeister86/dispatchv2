# TASK-17: Model runs, attempts and budget boundaries

The concrete generation path uses `@convex-dev/agent` 0.6.4, `ai` 6.0.300, `@ai-sdk/openai-compatible` 2.0.81 and Zod 4.1.13. The published Agent test registration helper exercises the actual component schema and functions. The current Vite version is unchanged; no Requesty SDK is installed. `core-js` build scripts remain explicitly denied.

## Activation and purpose

Generation purposes are `summary`, `research`, `draft` and `plan`. A server-controlled `aiPolicies` record must explicitly enable the fixed Requesty EU endpoint, model, purpose list, configuration version, bounded limits, processing evidence and pricing evidence. The complete processing chain (gateway, inference, logs, cache, storage, subprocessors and rights) still requires actual verification. A key or EU gateway hostname alone establishes no processing permission.

No policy or funded grant is seeded in Dev. No customer-facing start mutation or chat implementation is introduced by this task. The real Agent page shows configuration guidance and durable run receipts; demo responses only exist in demo mode. The configuration query therefore reports customer generation as requiring configuration, even when an operator has stored partial evidence. Settings do not activate generation. `REQUESTY_BASE_URL`, `REQUESTY_TEST_MODEL` and model-controlled hosts cannot override the fixed server contract.

Embedding and semantic decisions remain separately disabled. No embedding model, Jev call, semantic fallback or cross-thread search is configured. Existing R2 behavior has no new Jev dependency. Model use, search, embedding, provider processing proof and billing activation are not accepted by synthetic tests.

## Run and authorization

`ai.runs.create` is an internal mutation with actual workspace, account, actor and repository IDs. Its concrete later caller must derive actor/workspace from the authenticated domain operation. It checks current membership (`Owner`, `Admin`, `Editor`), active workspace lifecycle, connected account and connection sequence, and each repository's current generation and **content** permission. Reading factual signals or monitoring a repository is insufficient. External text is untrusted context.

The mutation creates one official Agent thread and saves one prompt, storing only the component references on `agentRuns`. It does not create another messages table. Raw component IDs and component `userId` are not tenant authority. The bounded generation helper accepts a domain run ID and follows its authorized mapping; public queries omit component IDs, prompts, actors, grants and global provider usage.

Runs bind purpose, prompt version, policy version and a fingerprint of the actual policy record. A same-version policy change cannot retarget an admitted run. Claiming a ready run creates one execution owner; an already running or crashed run cannot be blindly reclaimed. Deadline, generation, membership, account, grants, source purpose and lifecycle are rechecked before each actual call and context read, and before exposing a successful result. Stop increments the run generation. Safe late usage can settle after stop/revocation without reactivating work or creating content.

The only model tool is `read_context`, with a strict empty input object. Its bounded response contains the authorized workspace profile and actor's own preferences. It cannot accept another workspace ID, read secrets/environment/general database state, approve, schedule or publish. No proposal/content domain writes are introduced ahead of TASK-18/19.

## Durable attempt and receipt

The supported AI SDK 6 **V3** middleware awaits a transactional `ai.runs.fund` **before** underlying `doGenerate` or `doStream`. Agent's post-result hooks are not used as preflight funding. Every actual SDK attempt has its own unique durable attempt ID/key and a reservation against separate provider, workspace and account limits. Duplicate admission keys fail; an unresolved `sent` or `unknown` attempt blocks another paid step. SDK retries are zero and no provider fallback or action retry controller is added.

Workspace/account grants require a current Owner/Admin approver, matching policy version, currency, purpose and expiry. Provider limits are operational ceilings, not public cross-tenant spend. Concurrent mutations enforce available coverage. The reservation uses configured input/output ceilings and versioned rates; byte limits conservatively bound prompt/context input before network activity.

Known token receipts retain input/output counts and the configured price estimate. Integer arithmetic rounds micro-unit estimates upward without floating-point loss, including unusually large valid receipts. Identical callbacks settle once; conflicting receipts fail. Missing/invalid usage retains the hold. Crash after admission without receipt remains `sent`/pending, never free and never permission to replay. A genuine subsequent attempt needs a new admission and fresh coverage.

`estimatedMicros` is a configured token-price estimate; `billedMicros` remains null. Requesty's reported `usage.cost` is retained separately as `reportedCost`, with `reportedCurrency` null. Currency, conversion and reconciliation are not invented. Invalid, nonfinite, negative or malformed provider cost marks `reportedCostInvalid` and retains an unknown financial receipt. Any unverified provider amount keeps the conservative reservation held and blocks another attempt, even if text generation finished. Actual token estimates exceeding the original reservation expand the liability hold or retain the full provisional spend and fence further execution. Expense is never discarded because it exceeds the reservation. Late new cost evidence reholds coverage once without booking the prior estimate a second time. Operator reconciliation and invoices belong to later billing work; there is no public release or synthetic invoice endpoint here.

## Network, output and errors

Only the fixed HTTPS POST chat-completions endpoint is accepted, with redirects disabled. No general webpage fetch proxy exists. Requests, responses, streams, output tokens, attempts, tool steps and wall-clock time are bounded. Both request setup and every stream read have an absolute deadline, so a hanging provider promise cannot bypass the limit. Cancellation does not release unresolved coverage.

Final generation uses `Output.object` with strict `{ text: nonempty bounded string }`. Final JSON is validated inside middleware before the Agent saves successful output; partial stream deltas are not validated final domain content. Additional fields, invalid JSON and invalid text fail. Provider transport/errors are replaced with a coarse safe error before the Agent's own error logger receives them. Raw request/response persistence is absent; raw chunks are excluded, generation response metadata/warnings are stripped and only selected usage/cost evidence reaches the domain receipt. This includes metadata on individual text/tool parts, which the SDK otherwise translates into persisted `providerOptions` and later prompts. Models requiring those annotations to round-trip are outside this minimized contract until explicitly verified and approved. No raw bodies, headers or secret values enter general logs.

## Inventory and lifecycle obligations

| Store        | Indexes used now                         | Purpose                                                                |
| ------------ | ---------------------------------------- | ---------------------------------------------------------------------- |
| `aiPolicies` | `by_key`                                 | Server-only approved configuration/evidence                            |
| `aiBudgets`  | `by_key`                                 | Three scoped reservation/provisional-usage counters                    |
| `agentRuns`  | `by_workspaceId_and_createdAt`           | Domain thread mapping, fencing and latest ten own-workspace receipts   |
| `aiAttempts` | `by_runId_and_key`, `by_runId_and_state` | Unique admission, bounded receipt reads and unresolved-attempt barrier |

The mounted official `agent` component owns `threads`, `messages`, `streamingMessages`, `streamDeltas`, `memories`, `files`, `apiKeys` and `embeddings_{128,256,512,768,1024,1408,1536,2048,3072,4096}`. Current calls use threads/messages; persistent stream deltas, files, memories, playground keys and embeddings are not enabled by this unit. Domain IDs retain thread/prompt links. Stop is a fence, not deletion. Workspace deletion does not automatically delete component-owned prompt/history or financial receipts. TASK-33/36 must include these links and component stores in concrete export, deletion and retention handling; no successful deletion/export claim is made here.

Public run display is scoped to the current workspace, bounded to ten runs/ten attempts each, and labels stored state and estimates explicitly. Stop awaits the mutation acknowledgement, displays failures, permits retry and ignores late callbacks after a workspace unmount. No percentage, fake answer or fixed cost is shown in real mode.

## Verification provenance

Current Context7 documentation and the installed exact-version declarations/source confirm the V3 middleware boundary, published Agent component helper, openai-compatible metadata extractor and AI SDK 6 structured output. Latest V4/AI SDK 7 examples are not authority for this matrix. Primary references: [Convex Agent](https://docs.convex.dev/agents), [AI SDK middleware](https://ai-sdk.dev/docs/ai-sdk-core/middleware), [OpenAI-compatible provider](https://ai-sdk.dev/providers/openai-compatible-providers), [structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data). Exact version source and through-component tests establish the pinned runtime behavior.

Synthetic regressions inspect durable funded state **inside the actual underlying SDK mock/intercepted HTTP call**. They cover concurrency at cap, duplicate admission/settlement, unresolved transport failures without retry, late stop usage, source/role/lifecycle/grant and policy changes, forbidden tool fields, bounded loops, final-output rejection, streams, hanging calls and unknown/over-limit financial receipts. Browser fixtures exercise actual real-mode Agent/configuration components with pending stop, failed acknowledgement, retry and workspace switching. No real paid provider/search/embedding call or customer-text transfer is performed as verification.

Implementation receipt (2026-10-05): 279 unit tests in 22 files, typecheck, lint, production build, injected-secret bundle check and affected real-component browser fixture passed. Official `convex dev --once` synchronized the existing EU-West-1 Dev and installed the Agent component at 18:10:52; no policy/grant rows or activation variables were created. Independent SPEC/QUALITY review and human acceptance remain separate gates.

Independent SPEC review of `928b26c` reproduced two P2 gaps: removing a required non-provider grant approver after creation did not revoke active use; per-part response metadata survived top-level minimization. Both are corrected in the shared active guard and concrete SDK result boundary. The nine independent negative cases changed from five PASS/four RED to nine PASS. Permanent regressions cover both approver scopes before/after send, safe late usage, the actual pinned adapter's tool thought-signature route, text metadata and stream-tool metadata. These corrections do not establish public activation, customer-data processing approval or model-specific protocol compatibility.

Correction receipt (2026-10-05): 285 unit tests in 22 files, typecheck, lint, build, bundle-secret check and affected real-component browser fixture passed; nine independent SPEC counterexamples passed again. Existing EU-West-1 Dev functions were ready at 18:22:22 after `convex dev --once`. No processing/policy/budget activation or real provider request occurred. Corrected source awaits independent re-SPEC and QUALITY.
