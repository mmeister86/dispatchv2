# Dispatch Convex/UI Integration Plan

> Execute with subagent-driven-development: one implementer per unit, followed by spec and code-quality reviews. Work directly on master (user correction); commit validated units regularly. Backlog statuses stay In Progress pending manual user confirmation.

**Goal:** Replace the browser-only product simulation with authenticated Convex domain operations and real, capability-gated integrations.

**Architecture:** Keep the existing Vite/React interface and domain invariants. Convex owns identities, workspace membership, immutable content versions, approvals, schedules, provider state and jobs. Better Auth owns sessions; private R2 owns media bytes. Queries are reactive, mutations authorize every referenced workspace/account, external effects run only in actions after durable claims.

**Stack:** Existing React/Vite/TypeScript/shadcn, Convex, Convex Better Auth, installed official components where needed. No additional API server.

## Ordered implementation units

- [ ] 1. TASK-4/5/6: packages, generated backend, Better Auth HTTP/CORS, idempotent user/workspace bootstrap, persistent profile, real login/signup/verification/reset/logout, protected routes, empty data and reactive store contract. Check authentication/tenant isolation, TypeScript, build and actual dev deploy. No secret values in logs or client bundles.
- [ ] 2. TASK-7/8/11/13/24/25/48/49/50: normalized editorial data and explicit server commands; immutable version/approval snapshots; generation-bound scheduling, selective plan acceptance and team roles/invitations. Migrate synchronous UI callbacks to awaited operations; test concurrency, cross-tenant references, stale approvals and snapshot preservation.
- [ ] 3. TASK-9/10/12/12.1/12.2/12.3/14/15/16/52: private R2 temporary upload/finalization/preview/cleanup, encrypted provider tokens, X PKCE/capabilities, GitHub installation/repository selection and verified idempotent webhooks, durable publisher checkpoints and uncertain-result reconciliation. Keep missing credentials/scopes explicit; test provider-independent invariants and configured dev integration without unauthorized public test posts.
- [ ] 4. TASK-17–23/22.1–22.3/27–30/28.1–28.3/41–47/56–60/67/68: bounded model/research actions, official agent history, budgets/usage, source provenance and freshness, version-bound Jev analysis, measured analytics, profiles and experiments. Real capabilities only; unknown metrics remain unknown. Wire each existing UI action to server results and check untrusted-input/approval separation.
- [ ] 5. TASK-31–39/33.1–33.3/36.1–36.3/37/38/51/53–55/61/62: durable operational events, notifications, inventory/export/deletion/retention, billing lifecycle and entitlements, additional channels only with actual configured access, bounded autonomy policies and kill switch, deployment/recovery configuration. Track unresolved external prerequisites individually rather than treating mock actions as implemented integrations.
- [ ] 6. TASK-3/26/34/40/63/64/65/66: run product/auth/domain/browser checks, document real task coverage and outstanding provider/manual release gates; no automatic Done or GA claim. Final whole-change review and clean main commits.

## Working rules

Use Backlog CLI exclusively to update task metadata, plans, verification notes and criteria. Preserve the user's existing .gitignore edit. Fetch library documentation via ctx7 outside the default sandbox (library before docs, max 3 commands per question). Never print environment secret values. Use the configured cloud dev deployment, never provision an unrelated anonymous deployment. Optional/paid providers without credentials remain visibly unavailable until configured; implement the surrounding contract and continue independent work.

## Verification evidence

Initial baseline: 17 domain tests passed and TypeScript passed on 2026-10-05. Repository initially had only master and an uncommitted .env.local ignore entry; a temporary main branch was created before the user corrected the target to master.
