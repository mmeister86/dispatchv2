# TASK-15: GitHub webhook and factual signal validation

Code freeze on master: `05ebfd8165f3f2917bb0a9f3cd7d5fb97478fd90`, backend `22f4f70`; follows independently reviewed TASK-14 `ad9d395`. Scope is signed Push/Release facts, separate tenant ingestion, immediate revocation, bounded failed-receiver recovery and the existing Signals UI. No TASK-16 AI enrichment, model activation or manual acceptance is included.

## Implementer evidence

- 246 registered checks across20 files PASS;26 new TASK15 checks:15 webhook and11 recovery. Synthetic HTTP and transaction checks cover exact raw-byte HMAC, invalid-signature no-write, body/time boundaries, semantic-event and tenant dedupe,31-workspace fanout, monotone revocation fencing, known-GUID replay, ambiguous new-GUID security closure, current authority and local recovery.
- Two independent Owner sessions share one actual intercepted App POST, a cumulative three-attempt GUID limit and cooldown, while separately receiving their own signed-callback signal. Scoped DTOs expose no other tenant's recovery row, actor or private metadata.
- Explicit local admission of an already durable signed receipt verifies current source generation, identity, visibility, purpose and actor. Original event timestamps survive; separate actor/time provenance records the new human authorization. No remote POST or new attempt is consumed; autonomous processing retains its original purpose boundary.
- Frontend/backend typecheck, configured formatting, build, client secret-bundle check and diff check PASS.
- Actual Chrome/React fixture PASS, completion observed2026-10-05 17:22:17 CEST; fact provenance/pagination, real versus demo, awaited commands, remote202 pending, cached lease expiry, explicit local recovery and workspace/unmount behavior. Fixture5174 closed; user's5173 PID62707 retained.
- Official codegen and existing EU Dev activation PASS. Actual CLI functions-ready receipt2026-10-05 17:22:59 CEST on the configured existing deployment. No genuine provider/model/mail/R2 effect, secret configuration or new deployment was performed.

## Independent review

Fresh SPEC agent `github_signals_spec` is reviewing the frozen source against actual TASK15, D05, the final source and signal contracts, and ROOT's explicit recovery/replay clarifications. Its independently executed evidence and findings are pending. Fresh QUALITY follows SPEC acceptance; neither review is claimed here.

## Remaining acceptance

Actual GitHub webhook registration, signatures and permissions on the wire, real receiver outage/redelivery, provider retention/rate behavior, authenticated manual UI/privacy acceptance and lifecycle/export/restore exercises remain open. Configured key presence and synthetic tests do not establish those proofs. Backlog remains In Progress, with no automatic Done or release claim.
