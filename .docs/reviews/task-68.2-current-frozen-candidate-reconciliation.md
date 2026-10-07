# TASK-68.2 current frozen Candidate reconciliation — READONLY STOP

This resolves the adopted proposal’s 68.1 seams only. Frozen source is 334 files, freeze SHA `bcd1bcf4afe823700394e375b3a11a710b1caee2664bd6e8173b327bce660e2b`; all 334 string hashes are exact before/after. Independent SPEC68.1 is pending. No source release, test/review acceptance, SDK query, test, provider/model effect, configuration activation or repository mutation occurred. Only this private report and receipt were created.

## Actual resolved seams

- `ideaVersions._id` is the immutable candidate ID. Its optional candidate holds exact native content, contentHash, provenanceHash, routingOperationId and commandFingerprint; producer runId/inputVersionId are existing version fields. Content hash is the original ordered canonical title/text/media asset+alt/account/pillar/strategy array, not a concatenated string or repaired baseline. Private candidateMediaChecksums remains server-only.
- Producer `contentRequests.by_runId` joins outputKind=`social-post-candidate`, input version/revision, original producer actor/account, routing operation and command fingerprint to resultIdeaId. CandidateProof checks those exact pairs, whole media pin equality, native capability/media state, native hashes and run style context. Do not pass producerRunId into the new verifier receipt’s legacy runId field: runs.recent/generationStatus select that index for generation-owned receipts.
- `candidateProof(ctx, ver, fresh, walk)` and `ideaProofUntil` already supply shared aggregate-32 proof/horizon. Fresh proof requires current native candidate root and original current routing/style selection; retained proof remains historical until actual source loss. A new verifier must use the SAME MaterialWalk throughout baseline, candidate, media and source joins; unknown/capacity errors propagate. Completed routing’s physical execution deadline is not a later verifier deadline.
- Public `content/ideas:candidate({workspaceId,versionId})` already returns current/historical/unavailable, nullable sourceUntil, native candidate and safe intent. Public applyCandidate takes exact versionId/hash/key/human intent/claimsReviewed plus null new target or exact draftId/versionId/revision. It authorizes current proof BEFORE immutable handoff replay and uses central native Draft CAS. Existing handoff is one bound receipt; a later check must not silently upgrade an already-applied version or rewrite its receipt.
- CandidateApplication is shared by Ideas and the already-open Composer. It scopes immutable retries and ACK to real native session/workspace/account/role/current target/full buffer, masks expired sources, and preserves dirty text. Extending that component covers both consumers without Store, Drafts, model or FirstWrite changes. Demo remains separate zero-native behavior.
- Native candidateRun finds outputs through by_runId even when the run is missing/terminal; candidateCopies uses by_versionId media references, by_handoff_ideaVersionId, by_candidateVersionId/by_ideaVersionId applied drafts and by_inputVersionId children in bounded 25-row pages. Existing contentCopies callback is scheduled before root/cycle early return. Any introduced verification slot must be scrubbed before candidateCopies’ healthy-root return and independently by candidate ID when the candidate/Idea/run root is gone.

## Minimum verification-only proposal (not installed API)

Reuse the producer contentRequest with ONE optional, versioned `standalone-verification` command/result slot for that exact native candidate. Pin verifying actor separately from original producer actor, candidate ID/hash/provenance, original input/request/run/routing/whole intent/style-or-absence/media proof, immutable key/fingerprint, own policy/control/model/versions, original verification start/deadline/sourceUntil and exact own attempt ID. Store only normalized probabilities/applicability/decision/reason enums plus provenance and sticky original risk identity; no copied candidate/source/prompt/raw response/provider free explanation. Same key+whole args replays; another key cannot overwrite that immutable slot. This bounded first-check policy is a proposal to finalize at source release; it does not create a hidden unlimited recheck history.

Proposed native verify.ts has explicit prepare/get/check, availability and Owner/Admin account withdrawal plus internal context/fund/authorizeFetch/settle/finish/status/purge. These names are proposed, not callable refs. Prepare resolves the current candidate/producer graph and original verifier-only deadline atomically, before its own paid check; get uses original retained proof for history and separate current admission. Status/attempt claim prevents duplicate paid dispatch after a lost ACK. Finish commits only the exact operation/candidate/fingerprint/attempt pair after current proof. Money settlement validates its original receipt regardless of current semantic permission; physically never-entered denial releases a known-zero hold, entered ambiguous I/O retains its actual unknown liability. Check uses existing TypeSafe physical client via one explicit third dispatch, not a second transport.

One useful export is the existing private routing `source` function under an explicit `routingSourceProof` alias, with its body unchanged. It supplies the native original facts, attributed userClaims, previous interpretation/rationale/questions, approved context excerpts, exact intent and eligible selected style/absence without invoking routing.context’s expired classifier execution clock. New verificationProof is used by verifier admission/read and existing candidate projection/apply; no generic proof framework.

Extend candidate read additively with a safe verification DTO and exact nullable receipt usage (held/unknown is not inferred from null result). Optional checked-application pins, when present, must identify the native verification command/result for the same candidate hash and be included in the whole apply fingerprint. Absence preserves old unchecked application keys and behavior. Apply rechecks current result before binding its immutable handoff, still requires human intent/ACK and creates only an unapproved working version. No semantic accept creates review decisions, approval, schedule or FirstWrite acknowledgement. A previously bound unchecked handoff cannot gain certification through replay.

Seven immutable Noul criteria stay exactly the adopted meaningPreserved, intentPreserved, newStrongClaim, unwantedPromotion, toneFits, ctaFits and networkFits rubric. Own strict normalizer accepts only expected resolved model, bounded safe integer usage, all seven exact keys and each `{type:'noul',noul:finite[0,1]}`; reject missing/extra/confidence/probability-wire fields. Normalize to probability, never confidence. Missing tone/style is explicitly unspecified. Current nullable CTA has no separate explicit `no CTA` discriminator, so do not invent one. Full original supplied baseline and whole ordered candidate are one bounded packet; oversize fails, never truncates or flattens. No media bytes/object keys/checksums are sent as factual evidence.

Conservative precedence remains source unavailable → unchecked on unavailable/invalid/unknown/unset policy → manual review for original meaning/intent/support uncertainty or strengthened claims → only bounded low-risk fit flags → accept/accept-with-warning. Persist sticky original candidate/hash/risk references; a failed/clean later view cannot clear them. A `repairable` annotation is only metadata in 68.2, with NO repair action. Hypothesis thresholds remain versioned, explicitly uncalibrated and inactive until approved; reuse neither Analyzer .7 nor router .50/.90.

## Own purpose, readers and concrete minimum ownership

Own default-OFF purpose `output-verification`, owner `jev-output-verifier`, verification:global/account keys, own policy/processing-storage-training/EU/credential/model/pricing/versions and three current purpose grants. Extend existing aiBudgets purpose union and jevPolicies/jevControls/aiAttempts unions; keep all seven current financial owners unchanged. Reuse changeLiability and the existing three Jev provider/workspace/account budgets; count each receipt once, never sum the same three-scope charge three times. Preserve late original settlement and do not require matching generation currency for an independent check; show generation, routing and verifier costs separately with their actual currencies, no FX.

Existing access.controls/policy already reject rows with a purpose; analyzer receipt and generationAttempt reject foreign owners, router uses exact purpose/owner and operation-attempt pairs. New verifier fields must preserve those discriminants and legacy by_runId index semantics. Settings must add a separate truthful verification availability/withdrawal section in models.tsx, not reinterpret analyzer/routing availability. No public enable/setup, pretend CAS, configured model/prices or paid grants are promised. Only widen access.ts/other existing receipt reader files if an actual compiler/narrowing defect is demonstrated; not preemptively.

Proposed production ownership (14 paths; two new exact modules):

- `convex/ai/jev/types.ts`
- `convex/ai/jev/client.ts`
- `convex/ai/jev/routing.ts`
- `convex/ai/jev/questions/outputVerification.ts` (new)
- `convex/ai/jev/verify.ts` (new)
- `convex/ai/fields.ts`
- `convex/content/ideaFields.ts`
- `convex/content/ideas.ts`
- `convex/schema.ts`
- `convex/research/contentCleanup.ts`
- `convex/ai/contentCopies.ts`
- `convex/crons.ts`
- `src/features/ideas/ideas.tsx`
- `src/features/settings/models.tsx`

Proposed six controls (new verifier controls plus append-only existing assertions):

- `convex/ai/jev/verify.test.ts` (new)
- `convex/ai/jev/questions/outputVerification.test.ts` (new)
- `convex/ai/jev/client.test.ts`
- `convex/content/ideas.test.ts`
- `tests/ideas.browser.mjs`
- `tests/review-queue.browser.mjs`

No provider.ts, runs.ts, accounting.ts, sourceAccess.ts, Store, Drafts, team/style or existing Analyzer normalization changes are presently necessary for verification-only. Native 32/25/body/retry/time/resource limits stay unchanged. New production modules require root-only codegen after coherent pause.

Reuse contentRequests.by_runId and by_jev_operation (new exact owner) for producer and immutable command receipt joins. Proposed used indexes only where the introduced slot is consumed: contentRequests by verification.candidateVersionId (rootgone cleanup), verification.actorId (verifier actor withdrawal), workspace/account/verification.sourceUnavailable (own purpose withdrawal), verification.sourceUnavailable/sourceUntil (bounded proof sweep, including null horizon); aiAttempts by owner/workspace/account/candidateVersionId/state (pending unknown gate). Use candidate cleanup callbacks and one bounded verification proof cron. No composite stage/reservation index, reservation state, repair run or extra ledger is needed in 68.2. Index names/fields must be verified against the final slot validator at implementation, not advertised as installed.

## Boundary and remaining decisions

Standalone68.1 calls have NO original generation→verification→repair composite envelope. 68.2 creates an honest later verification-only clock and may display actual original generation/routing receipts, never retroactively certifies a joint cap/deadline. Original whole-envelope capture BEFORE initial generation, common currencies/call budgets, final reserve, one repair and final check remain exclusively68.3. Do not add their fields/transport changes now.

The one-slot immutable standalone recheck policy and exact result-reference field names must be finalized at source release; if repeated separately paid checks are required, demonstrate the immutable existing-family storage requirement before changing this minimum. Numeric hypothesis boundaries, resolved model, original timeout/token/price/EU/rights/grant evidence remain unset approved configuration, not invented product grants. No further product question is necessary for this preparation. Root decides release after actual68.1 acceptance. Remaining test proposals are meaningful native strict-seven/pair/source/fund/zero-versus-unknown/late/sticky/25+/null/rootgone and styled actual Ideas/Composer/Settings source clock/session/ABA/dirty/whole-key retries with separate Demo. None were run here.

Read scope is hash-qualified in the receipt. Searches of Drafts and the two performance receipt owners are not full body reads; missing guessed settings/client/usage/controls paths were discovery failures only, not evidence. No repeated SDK documentation commands occurred. STOP: no implementation or review acceptance.
