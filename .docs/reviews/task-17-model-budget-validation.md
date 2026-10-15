# TASK-17 model run validation

Scope: model access, durable attempt funding, bounded tools and actual configuration/run UI. Source `928b26c`, corrected at `89e1cfa5b3b2b567e271d75f8e178349f3846407`; master. This records code evidence, not live processing, pricing, provider or human acceptance.

## Concrete implementation

The official Agent 0.6.4, AI SDK 6.0.300 and openai-compatible 2.0.81 use the supported V3 middleware boundary. Each actual underlying model attempt awaits transactional funding against provider, workspace and account coverage. Stable official thread/prompt references replace a separate message store. Current authority, source content purpose, policy fingerprint, deadlines and execution ownership are rechecked along the concrete run path.

Attempt admission and settlement are durable and idempotent. Missing usage, invalid provider cost, unverified currency and overage retain financial liabilities; token estimates are separate from bills. Stop and withdrawn permissions block further work while allowing safe late usage to settle. SDK retries and fallback are off. Generation, embedding and semantic decisions remain distinct; no customer generation policy or funded grant was seeded.

The real Agent/configuration UI displays acknowledged stored runs and configuration guidance. Demo answers and fixed costs remain in explicit demo mode. The actual inventory, annotation-dependent model limitation and later export/delete obligations are in [the model run contract](../model-run-contract.md).

## Implementer evidence

- Initial source: 279 tests in 22 files and typecheck, lint, build, bundle and affected real browser PASS. Existing EU-West-1 Dev and official Agent ready 18:10:52.
- Correction: 285 tests in 22 files, 33 registered through-component cases and nine original reviewer counterexamples PASS; typecheck, lint, build, bundle and affected real browser PASS. Existing Dev ready 18:22:22.
- No paid model/search/embedding call, customer-text transfer, activation values or unrelated deployment. These counts are implementer receipts, separate from independent review.

## Independent SPEC

Initial review of `928b26c`: **NEEDS WORK**, two P2 findings. Registered 27 tests passed; nine own cases yielded five passes and four failures. The actual affected browser passed.

1. Removing `approvedBy` from a schema-valid workspace/account grant after creation still allowed an existing run's next actual attempt. Creation denied that state, but the shared active check skipped the absent approver.
2. Top-level metadata stripping left content-part metadata intact. The real pinned adapter with intercepted HTTP persisted a tool-call thought signature as official component message `providerOptions`.

The five-line production correction requires a current approver for each non-provider scope and minimizes metadata on every non-streaming content part before Agent persistence. Permanent actual-component regressions cover both scopes, late withdrawal and real adapter/stream paths.

Independent re-review at `89e1cfa`: **PASS**, 33 registered cases, nine original cases and two new post-send withdrawal cases, **44 total**. Late usage settles once while context, further funding and successful output remain fenced. Source, Backlog, index and deployment were read-only during review.

Evidence: `/tmp/dispatch-model-budget-spec-receipt.md`, `/tmp/dispatch-model-budget-spec-delta-receipt.md` and their isolated runnable test/config files. The initial failures remain documented instead of being counted as successful verification.

## Independent QUALITY

Independent QUALITY at `89e1cfa`: **PASS**, no confirmed finding. 33 registered actual-component cases and eight own accounting cases, **41 total**, plus the actual real-mode Agent/UI acknowledgement fixture passed. The reviewer observed these runs separately from implementer and SPEC counts.

Own cases verify conflicting concurrent receipts, atomic three-scope rollback at an account cap, one execution owner, late settlement after grant expiry, unknown currency even for reported zero, duplicate late-cost reholding, conflicting cost rollback and overage after stop. The browser fixture verifies pending stop, failure/retry and late workspace isolation; its own server/browser were closed.

Evidence: `/tmp/dispatch-model-budget-quality-receipt.md` and the isolated runnable test/config files. Production, documentation, Backlog and index remained read-only. These are code checks, not live invoice or provider verification.

## Open acceptance

Complete processing-chain evidence, fixed model/protocol compatibility, approved purpose/pricing/grants, actual provider usage/currency reconciliation and authenticated manual work remain open. Configuration guidance is not activation. TASK-17 stays In Progress; only the user can confirm Done after manual testing.
