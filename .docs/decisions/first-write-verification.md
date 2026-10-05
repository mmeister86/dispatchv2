# First X write verification — TASK-12

Decision2026-10-05 within the user's delegated implementation authority. This describes the concrete TASK-12.2 implementation; no live probe or public post was performed. D06 identity/connection binding and D16 separate special-capability gates remain authoritative.

Fresh OAuth verifies identity and scope eligibility, while live publishing remains unverified and disabled. Editing already works under the ordinary content/format limits. Normal approval, scheduling and send guards require publishing capability; requiring a prior Dispatch post before any first write would create a circular setup flow.

TASK-12.2 will offer an explicit immediate first-write verification using a human-approved exact version and account. The UI must clearly say that it publishes visible content, show the immutable snapshot and target account, and require Owner/Admin content approval followed by a separate confirmation to start publishing and verify access. This is an actual publishing intent, not a read-only connection test.

Reuse existing approval, schedule and attempt records with a small typed purpose. A verification approval cannot authorize ordinary future calendar scheduling. Only the concrete verification command may create a due verification job after checking the actor, current workspace/lifecycle, exact version/account/connection sequence, returned scopes, ready media, immutable references and deterministic limits. Central preflight and credential/media access recognize that persisted purpose; public commands and model tools cannot supply a general capability bypass. A bounded intent expiry prevents stalled verification jobs from posting much later.

Persist the same per-position intent and outcome checkpoints as normal publishing. A confirmed provider write ID is evidence for that credentialed account and current connection. Only a still-current connection may acquire standard publishing capability from the result. This does not prove premium lengths, quote posts, metrics or research access. Unknown outcomes never enable capability or trigger blind retries; TASK-12.3 reconciles them. Late results preserve external outcome evidence without reactivating disconnected accounts or cancelled jobs.

Capability evidence must come from the validated response to Dispatch's credentialed write. A later read-only lookup can identify an existing matching post for reconciliation, but cannot prove it was created using those API credentials; the same content could have been posted manually. Such a lookup does not enable publishing capability. A later expressly approved remaining position or new verification job can provide the required actual write response.

The consented thread may continue through its remaining positions under the same exact approval and guards. Confirmed positions are never resent. Future contents still require their own human approvals, and old scheduled connection sequences remain blocked after reconnect.

TASK-12.1 supplies the guarded media engine first; TASK-12.2 adds this concrete parent integration and reviews affected guards. Isolated tests can prove domain behavior. Registered client, human target account/content authorization, real write/runtime/processing evidence and manual acceptance remain open; root does not execute a live verification during this coding task without that authorization.
