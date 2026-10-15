# TASK-68.2 verification-only final source proposal — READONLY_PREPARATION_STOP

Root decisions in the latest brief replace the earlier unresolved one-slot choice: one admitted standalone verification command per immutable candidate, configuration-required does not consume it, exact whole-command replay only, no replacement/rechecks. The earlier reconciliation and receipt remain immutable. Actual CLI68.2/68.3 and the full continuation contract were read. No source/test/CLI/docs/codegen/provider mutation or test execution occurred. Source334 remains exactly frozen at bcd1bcf4; fresh68.1 QUALITY/whole gates/technical acceptance remain pending. All names below are proposed implementation contracts, not installed callable refs.

## Concrete storage and immutable native reference

Reuse the unique producer `contentRequests.by_runId` row already proved by candidateProof. Add optional `verification` object with a literal `kind: standalone-verification-v1`. One immutable `ideaVersions._id` candidate is the sole subject; candidate payload remains only on that version. Existing request actor is the producer; pin the authenticated verifier separately as verification.actorId. Preserve request legacy fingerprint/intent/runId and optional mode meaning.

Minimal slot fields:

- Exact command/scope: candidateVersionId, contentHash, provenanceHash, operationKey, commandFingerprint, verifying actorId; producerRunId/inputVersionId and request's original workspace/account join. Native-only requestFingerprint covers COMPLETE original packet, original style/absence/media and exact own policy/model/questions/hypotheses, separate from human commandFingerprint.
- Original admission: startedAt, deadline, sourceUntil (number|null, original minimum), policyId/policyFingerprint, controlId, questionVersion, normalizationVersion, probability/thresholdVersion. Actual prices/model/grants remain pinned via immutable policy and the receipt, not copied source text.
- State: ready|admitted|finished|stopped, attemptId:null|aiAttempt ID, sourceUnavailable:boolean, result:null|strict normalized seven-criterion decision/provenance, resultFingerprint:null|string, stickyRisk:null|original candidate ID/hash plus bounded reason enums. Erasure drops protected probabilities/reasons, keeps only permitted terminal audit/financial identity and irreversible sourceUnavailable. Original risk cannot turn into a clean result after error/restore.

Proposed public reference `VerificationRef`:

```ts
{
  contentRequestId: Id<'contentRequests'>,
  candidateVersionId: Id<'ideaVersions'>,
  contentHash: string,
  commandFingerprint: string
}
```

The slot's original verifier actor and own command key are validated server-side. Ref joins the exact request slot and candidate ID/hash on every reader/action/fund/fetch/finish. It is not a free URL, client-produced result or substitute for current proof. A same-workspace different request/attempt pair is rejected before writes even if individually valid. Original policy and receipt continue to exist for real money after semantic erasure.

`prepare({workspaceId, versionId, contentHash, operationKey})` returns `{status:'ready', reference:VerificationRef}` or `{status:'configuration_required', reference:null}`. Native roles/current candidate/full original source/style/media/account proof are checked first. For an empty slot, own verifier controls/policy/processing/EU/price/credential/three grants/circuit/input capacity MUST validate before any patch, scheduler claim or financial write. Known configuration denials return configuration-required with unchanged request and zero attempts; unknown/capacity exceptions propagate. Thus a lost configuration ACK retry remains the same whole prepare command but configuration can later become eligible without a burnt slot.

For an occupied slot, validate actual caller/current authority and exact version/hash/key/whole-command fingerprint before immutable replay. Do not replace slot/policy/start/deadline/horizon or schedule a new paid action. Another key, hash or actor fails explicit already-bound/conflict. Later missing current purpose does not delete the money header or create a replacement slot; get can show terminal/unavailable metadata and original usage separately. Source erasure and own purpose withdrawal remain irreversible for that admitted command.

## Native operation, result and checked application

Proposed `check({workspaceId, reference})` is a public authorization wrapper around one registered internal checkAction. Internal status stops dispatch if slot.result exists, slot.sourceUnavailable, state stopped or attemptId != null. An empty ready slot is not funding evidence. fund must atomically reprove exact ref/current packet/own policy and reserve all three actual Jev scopes via changeLiability, insert one own attempt and set attemptId/state admitted. Concurrent or duplicate actions cannot pass that mutation again.

Existing TypeSafe client gets one explicit verification branch with its own context/fund/authorizeFetch/settle/normalizer refs. The verifier-only execution result includes `attemptId:null|ID`; finish is skipped if THIS invocation never funded. This prevents a duplicate Action's unavailable fallback from finalizing another still-running original attempt. Original analyzer/router result DTOs and execution behavior remain unchanged. Existing SDK retries0/client+percall, logLevel off, fixed endpoint/one-fetch guard/body caps/AbortSignal and no-pending-writes-after-Action-return semantics stay intact.

Immediately before physical fetch, authorizeFetch validates ref + exact owned attempt + packet fingerprint AFTER awaited fund, then rechecks deadline/source/role/account/style/own purpose. Record physical entry only at actual fetch. A never-entered denial can settle known zero with released original hold; entered ambiguous I/O stays unknown/held. An original authoritative later settlement is a separately registered native receipt path, not a pending-JS promise write after terminated Action. No automatic resend, paid retry or claim of live late-action-runtime behavior.

finish requires the original ref AND exact attemptId returned by the funded invocation. Validate the owner/pair, original packet/current candidate/own rights, normalized model/questions/usage provenance and original clock before storing semantics. Commit one resultFingerprint over exact candidate/ref/versioned normalized values and decision. Exact duplicate finish returns original; changed same-pair result cannot overwrite it. A timeout/invalid/unknown result is terminal unchecked, not permission to dispatch again; later known money never upgrades frozen semantics automatically. Current source loss masks/scrubs semantics, independently settles genuine money.

`get({workspaceId, reference})` and additive candidate.verification project:

```ts
{
  reference: VerificationRef,
  applicability: 'current'|'historical'|'unavailable',
  sourceUntil: number|null,
  state: 'ready'|'admitted'|'finished'|'stopped',
  result: null | {
    candidateVersionId, contentHash, provenanceHash,
    questionVersion, normalizationVersion, thresholdVersion,
    model, decision, criteria, reasonKeys, resultFingerprint
  },
  stickyRisk: null | { candidateVersionId, contentHash, reasonKeys },
  usage: null | { attemptId, state, heldMicros, estimatedMicros, currency }
}
```

Criteria are the exact seven named `{probability:number, applicability:'specified'|'unspecified'}` records; decisions are unchecked/manual_review/repairable/accept_with_warning/accept metadata only. An unavailable projection hides protected result/reasons; retained history uses its original pins, separate from current admission. Null usage means no owned funded receipt, NEVER inferred from null result; validate the actual attempt/ref pair before exposing any usage.

Optional exact checked application argument:

```ts
verification?: {
  reference: VerificationRef,
  resultFingerprint: string
}
```

Include this optional native reference in command fingerprint ONLY when present, so every earlier unchecked apply key/argument/fingerprint remains unchanged. Current verify proof must match SAME candidate/version/hash/result fingerprint, including manual/unchecked warnings, before a human chooses to apply the displayed result. No result can replace claimsReviewed or human intent. Persist the optional checked reference on the existing handoff.candidateCommand audit slot; no copied probabilities on DraftVersions. Existing handoff's full fingerprint determines replay: an old unchecked receipt cannot be upgraded by later reference, even on the same candidate. Public read of that original Draft remains unapproved and original receipt remains unchanged. Future edits/versions do not inherit semantic certification or approval. Dirty/current-target/CAS/session/clock/ABA fences remain the actual shared CandidateApplication behavior.

## Full original packet and deterministic rubric

Export existing routing.source as `routingSourceProof` without replacing its body. candidateProof/current and ideaProofUntil share ONE MaterialWalk32; the retained baseline reader adds original complete input title/originals/attributed note/previous perspective/rationale/questions/approved context excerpts, original explicit intent and eligible original style/absence. Append whole ordered candidate posts and safe human-selected media descriptors/alt. Never send native private checksum/objectKey/credentials or unseen image claims, never flatten/truncate the baseline. Native oversize/resource denial propagates before admission, not a partial model packet.

The seven keys remain meaningPreserved, intentPreserved, newStrongClaim, unwantedPromotion, toneFits, ctaFits, networkFits. New questions/outputVerification.ts owns immutable rubrics, strict resolver, normalizer and deterministic probability hypotheses. Expected resolved model, safe bounded usage, exactly seven answers and strict `{type:'noul',noul:finite[0,1]}` wire objects are required. No confidence interpretation or Analyzer/router score/math/rubric reuse. Missing tone/CTA/style is explicitly unspecified; no invented no-CTA discriminator. All seven wire answers may be required while optional unsupported criteria remain unscored/unspecified in the projection.

Versioned .10/.90 startup hypotheses from the adopted proposal stay labeled uncalibrated and not activated; exact boundary behavior must be exhaustive in pure and native tests. Priorities: actual source loss → unavailable; errors/unset/invalid/unknown → unchecked; new strong claim or meaning/intent/support uncertainty → sticky original manual_review before fit flags; only genuinely bounded low-risk fit mismatch → repairable annotation; fully supported clean applicable criteria → accept or proportional warning. NO repair implementation in68.2. Later invalid/new view cannot clear a stored original material-risk marker. Native structural X/media validation still controls hard limits independently.

## Finance, default OFF and actual reader narrowing

Add a third explicit output-verification Jev policy/control discriminant and owner `jev-output-verifier`; verification:global/account keys are distinct from analyzer and routing. Policy pins actual approved credential/model/EU processing/storage/training/price/currency/versions/token/timeout facts; absent or partial configuration stays off. No synthetic grant/FX/default price/model/config activation. Reuse actual Jev provider/workspace/account budgets, require purpose in each grant and charge one genuine receipt once, not three scope charges. Standalone verification currency can differ from generation; display actual generation/router/verifier currencies separately.

Verifier aiAttempt uses `producerRunId`, never legacy `runId`; it carries exact contentRequestId/candidateVersionId/commandFingerprint/requestFingerprint plus own immutable actor/account/policy/model/three-budget/usage header. Use existing by_jev_operation owner/workspace/account/actor/operationKey to prove unique owned command attempt. Settlement also receives exact reference/attempt and requires owner output-verifier/provider typesafe/purpose output-verification, original native command pair, policy fingerprint/rates/currency, three distinct correct budget scopes and once-only settled liability. If semantic roots/slot protected fields are erased, retain the permitted original operation/financial skeleton; candidate/source/root availability is not a late-money precondition. Wrong stored pointer, wrong request or foreign owner fails atomically.

Existing generationAttempt rejects foreign owner and old runId queries therefore do not include verifier receipts. Analyzer controls/policy reject purpose-bearing rows; router controls/receipt already require exact purpose/owner/pair. Their old unions, scores and original assertions stay intact. New branch validators need compatible optional absent legacy fields for union narrowing; don't contaminate generation/Analyzer rows. No compiler failure was run/observed here. Only a demonstrated TS narrowing error may justify an additional reader edit; source ownership is not expanded on speculation.

Settings adds a separate output-verification section in existing models.tsx: real ready/configuration_required from its own reader, default OFF guidance and Owner/Admin explicit account withdrawal using existing useNativeCommand/nativeScope. No enable UI/setup/grant or backend CAS fiction. Shared CandidateApplication displays all seven probabilities/unspecified states, original sticky manual warning, exact current/history/source minimum and owned held/unknown usage. A lost prepare ACK retries the same whole args/key; an already funded unknown command only resumes safe get/status, never paid classify/generate/check.

## Concrete native indexes and cleanup order

Optional slot fields are indexed only where consumed:

1. contentRequests.by_verification_candidate: `[verification.candidateVersionId]` → candidate-ID purge, even absent Idea/version root.
2. contentRequests.by_verification_actor: `[verification.actorId,verification.sourceUnavailable]` → verifying actor loss without confusing producer actor.
3. contentRequests.by_verification_scope: `[workspaceId,accountId,verification.sourceUnavailable]` → own account/global purpose withdrawal.
4. contentRequests.by_verification_source: `[verification.sourceUnavailable,verification.sourceUntil]` → bounded proof sweep, including legitimate null horizon; inspect retained proof for each row, not expiry-only.
5. aiAttempts.by_verification_pending: `[owner,workspaceId,accountId,candidateVersionId,state]` → native sent/unknown dedup barrier. Reuse existing by_jev_operation for exact command attempt; no composite stage/reservation index.

The actual existing unique contentRequests.by_runId finds the producer request even if output candidate/Idea/run vanished. Introduced verification slot cleanup in contentCleanup.candidateRun schedules verifier producer-run purge BEFORE its ideaVersions lookup; introduced candidateCopies callback schedules candidate-ID verifier purge BEFORE its healthy-candidate return. Thus existing runs.purgeSource and contentCopies.sweep already delegate before missing/terminal-root returns, so their bodies need no change. Verifier purge only clears introduced verification result/risk reasons/protected packet pins, marks terminal erasure/stopped and retains own finance. Healthy generation candidate/media/application ancestry remains unchanged on own verifier withdrawal.

Existing routing.purge gains one bounded verifier callback at initial cursor BEFORE its query, using actor/scope where supplied and original proof otherwise. Its existing15-minute cron also drives verifier null-horizon proof sweep; no new cron necessary. Never pass routing.force as unconditional verifier erase: its source must be independently proved (and own verifier withdrawal calls its own explicit force path). Candidate source loss continues original68.1 candidate/applied raw/Agent cleanup; verifier-purpose loss alone must not invoke candidate/run erasure or inherit another circuit probe. All pages25 for known native scrubs; per-row proof page1 if aggregate document/ancestry pressure requires. Unknown/capacity errors rollback rather than erase, no limit increase or revival after regrant.

No verification Agent is created. Existing producer Agent messages remain protected by original source callbacks and real executionFinishedAt gate, with actual candidate/applied copy erasure intact. Verifier state is transient packet plus bounded normalized request result, no additional raw Agent/prompt storage. Source-loss rootgone callbacks must scrub introduced normalized result before/independently of older root/complete guards. Financial skeleton and confirmed publication parents survive.

## Exact proposed unit and sequential meaningful controls

Production ownership shrinks to12 paths (two new), relative to previous14 proposal. No new table/service/registry/ledger/dependency/Requesty provider/Store/Drafts/crons/contentCopies/runs/accounting edit is required:

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
- `src/features/ideas/ideas.tsx`
- `src/features/settings/models.tsx`

Proposed controls, append-only original assertions except new modules:

- `convex/ai/jev/verify.test.ts` (new)
- `convex/ai/jev/questions/outputVerification.test.ts` (new)
- `convex/ai/jev/client.test.ts`
- `convex/content/ideas.test.ts`
- `tests/ideas.browser.mjs`
- `tests/review-queue.browser.mjs`

Actual six relevant existing test bodies were targeted: client.test first SDK/funding/denial body; questions.test whole immutable resolver; routing.test exact receipt contamination/withdrawal pages; ideas.test candidate rootgone/Agent-finished/post-fund proof controls; Ideas and full-App review browser candidate whole-args/observed session ABA/current clock controls. This is partial body preparation, NOT running or accepting those tests. New module bodies don't exist yet.

Sequence after explicit source release only:

1. Registered minimal RED: no-config prepare leaves request.verification absent/zero attempts; configured native candidate first admission binds one ref; same whole args replay and competing key/actor/hash fail atomically. Build native fields/slot/own default-OFF config and safe exact packet/rubrics.
2. Genuine installed SDK/registered Action: real production seven questions and full ordered original packet, durable OWNED verifier attempt plus all three holds BEFORE transport; concurrent Actions/lost ACK never second HTTP. Test duplicate unfunded finish cannot replace first action; strictly malformed/missing/nonfinite/confidence/model/version/usage response fails unchecked. Test ALL combined material+fit precedence, unspecified tone/CTA/style, immutable sticky/resultFingerprint.
3. Native money: fund-after-proof and physical-after-fund race independently; zero-entry known zero versus entered unknown/held; no post-return pending writes. Authoritative original settlement after purpose/source/actor loss releases/books once with original currency, wrong same-workspace pointer/pair/owner/three scopes rejects. Producer generation/router receipts unchanged; differing verifier currency displayed honestly; no Draft approvals/schedules.
4. Native read/apply/lifecycle: accepted exact checked ref vs changed candidate/result/CAS; old unchecked handoff cannot upgrade; same proof before replay; current selection vs retained history/null minima; purpose withdrawal keeps healthy candidate/unapproved Draft intact; >25, rootmissing/complete, absent candidate/Idea/run plus original Agent unfinished/finished, verifier actor loss, later regrant and unknown-capacity rollback. New fields physically absent after indexed scrub, money unchanged.
5. Coherent pause for ROOT codegen/new API bindings, then App+Convex TS and configured format/native affected files. Original reader bodies/compiler failures stay honest, no waiver/extra ownership without concrete cause.
6. Styled actual Settings/Ideas/shared Composer1280/390: own defaultOFF/partial/no-config no occupied slot, all criteria/unspecified/manual sticky/unknown usages, exact native checked ref+unapproved output, lost prepare-ACK same args, no paid redispatch on unknown, dirty/CAS/source-clock/observed session-ABA/unmount/late ACK; separate Demo zero-native. Stable meaningful viewport content and finite-animation checks, preserve previous tiled full-page capture qualification and all old artifacts. No fabricated clean pixels or screenreader/model-quality/late-live-runtime claim. Final STOP writer handoff; root owns frozen source/freshSPEC/distinctQUALITY/full/static/commit/exactEUDev.

68.3 remains separate: before INITIAL candidate generation capture its original common envelope, final reserve and one repair. Earlier standalone68.1 producer/68.2 check histories stay honest and cannot retrospectively gain cap/clock/repair certification. No unresolved one-slot policy question remains after root decision. Only actual approved model/rights/EU/prices/token/timeout/grants and versioned uncalibrated threshold configuration remain unset; precise field names above are routine proposed implementation choices for root’s final ownership release. **READONLY_PREPARATION_STOP.**
