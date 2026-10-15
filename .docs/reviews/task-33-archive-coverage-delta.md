# TASK33.1 archive coverage delta — 2026-10-09

Read-only reconciliation of actual104 defineTable declarations against shared19, current private10 implementation, preferences and final16 plan. Table identifiers were mechanically enumerated; semantic aliases were then reconciled manually. Only missing branches/fields below, not another inventory. Private/shared writers retain source ownership. No code/Backlog/git/deploy changes.

## 1. Research profile discovery and complete saved config history — genuinely missing

Add `researchProfiles` and `researchProfileVersions` fixed branches to the planned records/config export endpoint (or private module's existing fixed family surface after its writer is done). These supply profileId to existing `publicOrders`. No new generic discovery endpoint.

- Rights: Owner/Admin selected workspace shared configuration; exact account root workspace first. Profiles are user-authored settings, including never-run, paused, disabled, deleted and no-longer-priced profiles. Their saved declarations do NOT require an executable provider grant or active workflow.
- Discovery: `researchProfiles.by_workspaceId_and_accountId` prefix workspace (all accounts) or exact account. One row/page; validate row.accountId. This works even when no orders exist. A currentVersionId missing/foreign is structural failure for the config, not fabricated defaults; the profile status header can remain a separate honest result.
- DTO profileId/accountId/revision/currentVersionId/paused/deleted/scheduleActive/scheduleGeneration/nextAt and safe activation declaration `{kind,language,operations,autoHandoff?}`. Preserve actual false/null/absence. Include original scheduleActorId only as shared operational responsibility if authorized. Omit scheduledJobId, account/credential sequence, scheduleApproval/budget IDs and captured activation approvals/fingerprints. `activeOrderId` is not a discovery shortcut; do not expose it if it points to another actor's targeted private order.
- Versions: `researchProfileVersions.by_profileId_and_actorId_and_commandKey` with profileId prefix paginates all immutable saved versions; key ordering is not numeric version order or a commit snapshot. Optional targeted by_profileId_and_number index improves chronological pages but is not required just to enumerate. Validate row.workspaceId/profileId/actor and native root association. DTO versionId/profileId/number/actorId/createdAt plus complete explicit `research/fields.ts::config`: topics,project,audience,languages,regions,preferredSources,exclusions,freshnessDays,topicCount,frequency,timeZone,clock,weekday,cap,autoHandoff. Do not infer new action history from copied config; commands save a version even for pause/delete. Drop commandKey/fingerprint.
- Reuse `research/access.ts::account/currentProfile` for references, not `liveAuthority/prerequisites/orderAuthority` (execution gates would hide configured-only or historical settings). Current `research/profiles.get` returns only current version and removes executable fields: a useful projection pattern, not full history.
- Fixtures: `convex/research/schedules.test.ts` tests95 (manual no budget),116 (CAS immutable snapshot),149 (pause/delete),386/521 (historic cap after config/pricing change); `tests/research-fixture.ts`. New case configured profile with zero orders must export and provide discovery ID.

## 2. Research source provider configuration — genuinely missing from dataUsePolicies

Extend final plan's fixed `dataUsePolicies` branch with `researchSourcePolicies` (same endpoint, one discriminator).

- Rights Owner/Admin; native workspace/account binding. Index `by_workspaceId_and_accountId_and_operation`, all three fixed operations (x-recent,x-trends,web-search) and any actual retained rows. Do not call `providerAccess.policy` as an archive visibility requirement: it requires enabled/live configuration and would lose disabled or expired original declarations.
- Allow id/accountId/operation/enabled/version/generation/approvedBy/expiresAt, actual accessEvidence/processingEvidence/pricingEvidence/rightsEvidence/protocolEvidence/lifecycleEvidence/lifecycleValidUntil/retentionMs/protocol/currency/unit/unitMicros/totalChargeBoundEvidence/allocationEvidence/costCurrencyEvidence/model/woeid/authMode. Explicit human policy prose is meaningful; do not export arbitrary environment config. `allocatedProviderLimitMicros` is a scoped declared allocation, distinct from global live provider balances: include only labelled original local allocation, never a fetched global balance.
- Exclude credentialFingerprint and any credential/envelope/lease. No provider calls. Finite/UTF8 caps; original historical values preserved. No separate Research consent table exists: enabled/approvedBy/generation and saved activation declaration are the concrete stored choices; captured order approvals stay with original orders and are not new consent.
- Fixtures: `convex/research/providers.test.ts`, `tests/research-fixture.ts`; configure without starting any order, disabled/expired policy, injected credential sentinel omitted.

## 3. Human Research handoff receipts — genuinely missing

Add `ownResearchHandoffs` to fixed own-record families. Table `researchContentHandoffs` is a real human command/result record, not just an internal copy binding.

- Discovery exact `by_workspaceId_and_actorId_and_commandKey` prefix current workspace/current actor (or requestHash equivalent); all own roles for reads. Validate same workspace/account; no Owner/Admin override. DTO receiptId/accountId/createdAt/selection/count/target/results with actual Idea/version/Draft/version identifiers.
- Protected selection/result lineage: currentEvidence for each selected source under its original order authority; enforce own targeted-order ownership before exposing it; validate resulting Idea/Draft roots and immutable versions plus ideaProofUntil/draftResearchProof and original source association. At most5 selections/results from producer; malformed larger legacy arrays fail whole page. Foreign links fail; positive removed/expired source omits protected selection/result DTO, not silently fabricating empty success. Original own operational header may be separately retained.
- Do not return requestHash/commandKey. Original intent is NOT stored on this receipt; do not reconstruct it from the hash. It survives on the resulting Idea.handoff (delta4).
- Reuse source checks in `research/handoff.ts::consumeEvidence`, and `proposalFamily` only where proving exact duplicate proposal ancestry; never call mutation to obtain export data. Fixtures `convex/research/handoff.test.ts`, relevant pipeline human/automatic handoff tests, research-fixture.

## 4. Human Idea→Draft handoff declaration — missing fields in shared19/own results

Current shared `ideas` DTO omits `ideas.handoff` entirely. Smallest safe extension is an `ownIdeaHandoffs` branch in own-record endpoint using existing ideas actor prefix; avoids changing shared rights or leaking another person's intent. Alternatively explicit own-gated optional projection on existing ideas family, with shared rows unchanged.

- `ideas.by_workspaceId_and_actorId_and_operationKey` prefix current user. DTO ideaId/ideaVersionId/ideaRevision/accountId/draftId/draftVersionId/actorId/intent/clarificationConfirmed/text/at; original human intent and text matter even when no `researchContentHandoffs` exists (manual Idea handoff/candidate application).
- Prove original Idea/version/account and exact Draft/version root associations plus retained source ancestry before payload. Validate handoff.actorId is current user; an Idea created by one actor can be handed off by another, so the existing root actor index alone is NOT complete handoff-actor discovery. They can differ: content/ideas.ts::handoff checks editable role/current workspace but does not require idea.actorId===ctx.user._id, and stores ctx.user._id on handoff. Add focused `(workspaceId,handoff.actorId)` index; never scan other users then publish hidden progress.
- Exclude candidateCommand.key/fingerprint/contentHash and executable target envelope. Preserve candidate verification reference/result only through already-planned proven verifier result family. No replay/approval creation.
- Fixtures: actual `convex/content/ideas.test.ts`, research/handoff.test.ts and candidate apply tests; include created-by-A/handed-off-by-B case to verify complete own discovery.

## 5. Research evidence and order projection delta — no additional endpoint

Observed current private writer `orderEvidence` returns annotation/model/assessment/promptVersion/policyVersion/createdAt/minretentionUntil, but does NOT include these meaningful stored fields:

- `payload.perspective`: original profileVersionId/audience/topics/project (cannot be replaced by today's config).
- `parentEvidenceId`, sourceId, observedAt, sourceGeneration, actorId/annotationActorId (original review/source lineage; apply existing original source/account proof).
- `inboxRevision`, `inboxDisposition`, `inboxActorId`: actual human active/ignored/archived choice. Preserve optional absence; UI defaults are presentation, not historical facts. `inboxCommands` has only actor/key/fingerprint/revision, no action/time: omit key/fingerprint and do not manufacture an action history; actor+revision optional if needed.

Existing currentEvidence/material proof already governs payload. Verify parentEvidence same order/workspace; direct foreign mismatch fails. Keep sources independently authorized. Add fields to existing explicit validator/projection, no new index/query. Fixtures `convex/research/pipeline.test.ts` and evidence/inbox tests in that file.

Current `projectOrder` similarly omits actual `reResearch` and `automaticHandoff` business outcome. Add safe fields while material proof is valid: reResearch.topic and proven parent evidence/order/source IDs (omit material fingerprints); automatic activationGeneration/profileVersionId/option(count,target,intent)/state/selection/results and safe finite timestamps if stored. Reprove each retained result source/root; no automatic resume. `automaticHandoff.actorId` must not bypass own targeted privacy. Native language, chosen operations and per-operation original outcome/cacheHit belong alongside original query; do not expose captured approvals/cache IDs/provider errors. Fixtures marked automatic/human-review and Inbox re-research tests in pipeline.test.ts.

## 6. GitHub connection and repository declaration settings — omitted parent/fields

Extend planned fixed records `githubRepositories` projection and add a singleton `githubConnection` branch. Must work when zero repositories are selected or the connection is disconnected/reauth_required.

- `githubConnections.by_workspaceId` unique. Owner/Admin selected workspace; DTO status/identity/login/installations(id,owner,kind)/inventoryLimited/updatedAt; explicitly own/shared authorized original connection metadata. No envelope, credentialGeneration, sync/admission/discovery sequence, refresh token TTL/lease or arbitrary error text. Use `integrations/github/fields.ts::publicConnection` as allowlist reference, not raw row.
- Repository branch must preserve selected, access, monitoring, content, contextRead, communicableContext, purposeActorId/purposeAt/purposeVersion, generation, verifiedAt/proofExpiresAt and actual declared repo identifiers; `by_workspaceId_and_providerId` workspace prefix enumerates deselected rows too. Existing native list only returns selected/current authorized items; do not reuse it as archive.
- Split saved declaration metadata from protected external source/patch bytes. Stale provider proof must not erase user's saved opt-in/out and communicableContext declaration; currentContext/checkSource remains necessary for external private excerpts/signals. No renewal of grant.
- Fixtures `tests/github-fixture.ts`, `convex/integrations/github/{app,context,recovery}.test.ts`, repo/source tests located by existing API calls; zero selected repos, stale/disconnected but declaration retained.

## 7. X connection settings and own authorization outcomes — missing safe nested fields

Extend existing planned `socialAccounts` explicit DTO with safe X evidence; no new settings table/engine:

- account.xEvidence scopes, identityVerifiedAt, textScopeEligible,mediaScopeEligible,liveWrite,remoteRevocation and proven historical writeProof {externalId,attemptId,confirmedAt}. No bearer tokens exist in this object; don't throw out user-visible verified/scopes status just because it is called evidence. ConnectionSequence can stay internal; prove original writeAttempt/account/workspace before original effect reference. Export supported account capabilities already planned.
- `xCredentials` remains excluded as a secret container; optional separately projected own/account granted-scope+expiresAt metadata only if current settings needs it, never envelope/keyId/iv/ciphertext/lease/cleanAfter. Account evidence suffices for minimum connection settings.
- `xOAuthStates` and `githubOAuthStates`: optional fixed `ownAuthorizationOutcomes` branch if archive promises connection-attempt history. Meaningful own status/createdAt/expiresAt/provider/accountId only; no digest/verifier/redirectUri/generation/revocation sequence. X already has by_workspaceId_and_userId; GitHub only workspace index, so focused workspace+userId needed for private bounded discovery. These are technical admission records and may instead be intentionally excluded with provider/account status parent coverage; do not claim attempted-connection history then.
- Fixtures `convex/integrations/x/oauth.test.ts`, github/app.test.ts; prove other actor states invisible and crypto envelope sentinels absent.

## 8. Configuration/consent branches must enumerate without result rows — clarify existing plan, no extra family

The planned dataUsePolicies/Controls, styleVersions, calibrationPurposes, intelligenceProfiles branches must be reached from account discovery even with ZERO orders/posts/assessments/models/experiments. Include all retained versions and actual disabled/withdrawn/deleted settings metadata. Specifically performanceControls.contentPolicyId/contentApprovedBy is the human content-use consent (performanceContentPolicies), separate from metric measurement permission. embeddingControls has its own consent/generation; calibration purpose consent/withdrawal actors/times are separate. Do not impose their execution/retained-content proofs on plain original declarations or hide a withdrawn consent because `allowed` rejects execution.

Research dataUse addition in delta2 is the only truly absent policy table; aliases in previous plan already cover embeddingControls/styleProfileControls/calibrationControls/historyPolicies/Controls/performancePolicies/Controls/jevControls and intelligenceSourceUpdates/ProfileReceipts. There is no new stored general30-day preference table; do not invent one for this export.

## Deliberate non-additions validated during exact-table reconciliation

researchClusters is technical keyed membership only (clusters.ts comment; latest100 evidence IDs), not separately authored topic text. Preserve authorized clusterId in evidence.model and original context links; exclude raw cluster key/full mixed-private member list. researchCaches/provider lease/query result caches are represented by original order/source/result lineage, not independently dumped. researchSourceBindings/researchCopyBindings/draftResearchCopies/ideaRunCopies remain source-proven parent relations. Global githubAdmissionOrder/githubRevocationBarriers/githubWebhookReceipts/githubDeliveryGuids/githubRecoveryScan and xOAuthFence/xBindings are shared operational/revocation internals, not user configuration. App users createdAt/selected identity already covered by self; default/active workspace pointers are selection mechanics and other workspace contents require their own selection. mediaUploadSessions/mediaVersionReferences, editorialNotices/teamInvitations/teamCommands and remaining model-family aliases are already explicitly planned, not new omissions.

No full-archive completion follows from table-name coverage. Most important implementation additions: standalone Research profile/version/provider policy branches, own handoff receipt/declaration branches, small evidence/order field delta, GitHub empty-connection/config and safe X settings fields. Current retained content proof must remain separate from export of stored user's disabled/withdrawn declarations.
