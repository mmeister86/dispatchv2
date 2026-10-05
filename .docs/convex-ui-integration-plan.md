# Dispatch Convex/UI Integration Plan

> Execute with subagent-driven-development: one implementer per unit, followed by spec and code-quality reviews. Work directly on master (user correction); commit validated units regularly. Backlog statuses stay In Progress pending manual user confirmation.

**Goal:** Replace the browser-only product simulation with authenticated Convex domain operations and real, capability-gated integrations.

**Architecture:** Keep the existing Vite/React interface and domain invariants. Convex owns identities, workspace membership, immutable content versions, approvals, schedules, provider state and jobs. Better Auth owns sessions; private R2 owns media bytes. Queries are reactive, mutations authorize every referenced workspace/account, external effects run only in actions after durable claims.

**Stack:** Existing React/Vite/TypeScript/shadcn, Convex, Convex Better Auth, installed official components where needed. No additional API server.

## Ordered implementation units

- [x] 1. TASK-4/5/6 foundation code: packages, generated backend, Better Auth HTTP/CORS, idempotent user/workspace bootstrap, persistent profile, auth UI, protected routes, empty data and reactive store contract. Deployed to dev; spec and quality reviews pass at `136a7f0`. Live sender/social acceptance and later-domain tenant negatives remain open; this checkbox does not close Backlog tasks.
- [x] 2a. TASK-7/8/11/13 editorial code: normalized immutable versions, explicit awaited commands, human approvals/revocation, generation-bound scheduling/calendar, CAS/local-buffer preservation and bounded recovery. Independent SPEC and QUALITY PASS at `f041927`; 42 tests and real comment-race browser check pass. Provider jobs remain honestly blocked until real publishing; authenticated manual checks and J02/J08 remain open, Backlog is not closed.
- [ ] 2b (after providers/research). TASK-24/25/48/49/50: source-aware proposals, selective atomic acceptance, account context and team roles/invitations/review policies. Reuse the established editorial domain instead of creating a second content store.
- [ ] 3a. TASK-9: private R2 temporary upload/finalization/preview/cleanup with server-validated immutable bytes, version-bound alt metadata, indexed reference protection, progress/abort and configuration guidance. Independent reviews before the next provider unit.
- [ ] 3b. TASK-10: encrypted X PKCE/refresh, verified identity and capability evidence. D06 chooses one active publishing workspace with explicit disconnect/fresh OAuth transfer; no silent tenant takeover.
- [ ] 3c. TASK-12.1: bounded validated R2-to-X media transfer, exact version-bound alt metadata, durable processing/expiry checkpoints.
- [ ] 3d. TASK-12.2: deterministic approved thread publishing, durable per-position intent and confirmed IDs, no automatic retry of non-idempotent writes.
- [ ] 3e. TASK-12.3 and integrated TASK-12: unknown-effect reconciliation and explicit safe continuation, complete immutable result/links. Each publishing subunit gets a fresh implementer and two reviews. No unauthorized public test posts.
- [ ] 3f. TASK-14/15/16, then TASK-52 after proven X behavior: GitHub installation/repository selection and verified idempotent webhooks, factual processing; extract only the concrete reusable provider contract. Keep missing credentials/scopes explicit and continue independent code without claiming live integration.
- [ ] 4. TASK-17–23/22.1–22.3/27–30/28.1–28.3/41–47/56–60/67/68: bounded model/research actions, official agent history, budgets/usage, source provenance and freshness, version-bound Jev analysis, measured analytics, profiles and experiments. Real capabilities only; unknown metrics remain unknown. Wire each existing UI action to server results and check untrusted-input/approval separation.
- [ ] 5. TASK-31–39/33.1–33.3/36.1–36.3/37/38/51/53–55/61/62: durable operational events, notifications, inventory/export/deletion/retention, billing lifecycle and entitlements, additional channels only with actual configured access, bounded autonomy policies and kill switch, deployment/recovery configuration. Track unresolved external prerequisites individually rather than treating mock actions as implemented integrations.
- [ ] 6. TASK-3/26/34/40/63/64/65/66: run product/auth/domain/browser checks, document real task coverage and outstanding provider/manual release gates; no automatic Done or GA claim. Final whole-change review and clean master commits.

## Working rules

Use Backlog CLI exclusively to update task metadata, plans, verification notes and criteria. Preserve the user's existing .gitignore edit. Fetch library documentation via ctx7 outside the default sandbox (library before docs, max 3 commands per question). Never print environment secret values. Use the configured cloud dev deployment, never provision an unrelated anonymous deployment. Optional/paid providers without credentials remain visibly unavailable until configured; implement the surrounding contract and continue independent work.

User clarification: missing R2 S3 EU-bucket credentials and GitHub App private key should initially produce visible configuration guidance. Continue implementing their contracts without requesting these credentials again.

## Verification evidence

Initial baseline: 17 domain tests passed and TypeScript passed on 2026-10-05. Repository initially had only master and an uncommitted .env.local ignore entry; a temporary main branch was created before the user corrected the target to master.
