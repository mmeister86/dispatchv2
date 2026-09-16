# Dispatch V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-capable version of Dispatch: an authenticated X planning/publishing application that ingests GitHub activity, creates AI-assisted content ideas and drafts, supports research and a calendar, and publishes scheduled posts reliably.

**Architecture:** The browser application is a Vite + React SPA hosted on Cloudflare and uses TanStack Router for navigation. Convex Cloud is the single application backend and source of truth for domain state, scheduling, durable workflows, file storage, agent state, and integrations. Better Auth handles identity, Requesty provides LLM/model access, X and GitHub are external integrations, Resend handles transactional mail, Rybbit handles product analytics, and Stripe Managed Payments is added only after the core product loop works.

**Tech Stack:** Vite, React, TypeScript, TanStack Router, Tailwind CSS, shadcn/ui, Convex Cloud, Better Auth, convex-test, Vitest, Convex Agent, Convex Workflows, `@convex-dev/rate-limiter`, Vercel AI SDK, Requesty, GitHub App/API, X API, Resend, Rybbit, Stripe Managed Payments, Cloudflare.

**Spec:** `PRD.md`

## Global Constraints

- Convex is the single source of truth for application business state.
- Cloudflare hosts the frontend; do not introduce a second application backend without a concrete requirement.
- `workspaceId` is the tenant boundary for workspace-owned domain data.
- All workspace-scoped server functions must derive the authenticated user server-side and validate membership.
- Provider IDs never replace Convex domain IDs.
- Draft versions are immutable.
- A scheduled post always points to an exact `draftVersionId`.
- OAuth credentials never reach the browser and are stored only in the internal `integrationSecrets` domain.
- External side effects must be idempotent where retries are possible.
- Raw GitHub diffs, raw X responses, and large agent traces must not be stored on ordinary Convex documents.
- Human approval is required for publishing by default.
- V1 primary social provider is X.
- Add infrastructure only when a concrete requirement needs it.

---

# Proposed Repository Structure

```text
.
├── PRD.md
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── src/
│   ├── main.tsx
│   ├── router.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── app/
│   │       ├── route.tsx
│   │       ├── overview.tsx
│   │       ├── calendar.tsx
│   │       ├── drafts.index.tsx
│   │       ├── drafts.$draftId.tsx
│   │       ├── ideas.tsx
│   │       ├── research.tsx
│   │       ├── agent.tsx
│   │       └── settings/
│   │           ├── general.tsx
│   │           ├── github.tsx
│   │           ├── social.tsx
│   │           └── billing.tsx
│   ├── components/
│   │   ├── app-shell/
│   │   ├── calendar/
│   │   ├── drafts/
│   │   ├── signals/
│   │   └── research/
│   ├── features/
│   │   ├── auth/
│   │   ├── workspaces/
│   │   ├── github/
│   │   ├── x/
│   │   ├── drafts/
│   │   ├── publishing/
│   │   ├── research/
│   │   ├── agent/
│   │   └── analytics/
│   └── lib/
│       ├── analytics.ts
│       ├── dates.ts
│       └── errors.ts
├── convex/
│   ├── schema.ts
│   ├── auth.ts
│   ├── http.ts
│   ├── lib/
│   │   ├── authz.ts
│   │   ├── crypto.ts
│   │   ├── errors.ts
│   │   └── systemEvents.ts
│   ├── users.ts
│   ├── workspaces.ts
│   ├── integrations.ts
│   ├── repositories.ts
│   ├── socialAccounts.ts
│   ├── contentSignals.ts
│   ├── researchItems.ts
│   ├── contentIdeas.ts
│   ├── drafts.ts
│   ├── mediaAssets.ts
│   ├── scheduledPosts.ts
│   ├── publishedPosts.ts
│   ├── agentRuns.ts
│   ├── github/
│   │   ├── app.ts
│   │   ├── webhook.ts
│   │   ├── client.ts
│   │   └── workflows.ts
│   ├── x/
│   │   ├── oauth.ts
│   │   ├── client.ts
│   │   ├── publish.ts
│   │   ├── research.ts
│   │   └── workflows.ts
│   ├── ai/
│   │   ├── provider.ts
│   │   ├── contentAgent.ts
│   │   ├── tools.ts
│   │   └── workflows.ts
│   └── email/
│       └── resend.ts
└── tests/
    └── e2e/
        ├── auth.spec.ts
        ├── manual-publishing.spec.ts
        ├── github-signal.spec.ts
        └── agent-planning.spec.ts
```

---

# Delivery Sequence

1. Foundation and tenant isolation
2. X manual publishing loop
3. Calendar and media
4. GitHub ingestion and signals
5. AI drafting agent
6. Research
7. Agent planning
8. Reliability, observability, analytics
9. SaaS billing
10. Cloudflare production release

The first public-quality milestone is reached after Epic 8. Stripe is intentionally later.

---

# Epic 1 — Foundation, Auth, and Tenant Isolation

## Ticket 1.1 — Scaffold frontend and Convex

**Files:**
- Create: `src/main.tsx`
- Create: `src/router.tsx`
- Create: `src/routes/__root.tsx`
- Create: `src/routes/index.tsx`
- Create: `convex/schema.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

**Produces:**
- Compiling Vite + React application.
- TanStack Router shell.
- Convex connection.
- V1 schema.
- Vitest + `convex-test` test setup.

**Acceptance criteria:**
- `npm run build` succeeds.
- `npx convex dev --once` validates the schema.
- `npm run test:once` exits successfully.
- The browser renders the root route.

**Test cycle:**
- [ ] Add a schema smoke test in `convex/schema.test.ts` that initializes `convexTest(schema, modules)`.
- [ ] Run `npm run test:once -- convex/schema.test.ts` and verify it initially fails before test dependencies/config are complete.
- [ ] Add `vitest`, `convex-test`, and `@edge-runtime/vm`; configure `vitest.config.ts`.
- [ ] Run the test again and verify PASS.
- [ ] Run `npm run build`.
- [ ] Commit: `chore: scaffold dispatch frontend and convex backend`.

---

## Ticket 1.2 — Better Auth and user projection

**Files:**
- Create: `convex/auth.ts`
- Create: `convex/users.ts`
- Create: `src/features/auth/client.ts`
- Create: `src/routes/login.tsx`
- Create: `src/routes/signup.tsx`
- Test: `convex/users.test.ts`

**Interfaces:**
- Produces: `getOrCreateDomainUser(ctx): Promise<Doc<"users">>`
- Produces: `getCurrentUser` query.

**Behavior:**
- Better Auth remains identity/session source of truth.
- Dispatch creates one `users` projection keyed by `authUserId`.
- Projection creation is idempotent.

**Acceptance criteria:**
- First authenticated request creates one domain user.
- Repeated requests reuse the same user.
- Unauthenticated callers cannot obtain a domain user.

**Test cases:**
- no authenticated identity → throws `UNAUTHENTICATED`
- first identity → inserts user
- same identity twice → still exactly one user

**Commit:** `feat: add better auth user projection`.

---

## Ticket 1.3 — Workspace creation and authorization helpers

**Files:**
- Create: `convex/workspaces.ts`
- Create: `convex/lib/authz.ts`
- Test: `convex/workspaces.test.ts`

**Interfaces:**
- `requireUser(ctx): Promise<Doc<"users">>`
- `requireWorkspaceMember(ctx, workspaceId): Promise<{ user; membership; workspace }>`
- `requireWorkspaceRole(ctx, workspaceId, roles): Promise<...>`
- `createDefaultWorkspace()`

**Behavior:**
- New user gets one default workspace.
- User receives `owner` membership.
- Workspace timezone defaults from onboarding input, not server locale.
- Authorization always validates membership server-side.

**Acceptance criteria:**
- A user cannot query another workspace by guessing its ID.
- Owner can read/update own workspace.
- Membership index `by_workspaceId_and_userId` is used for authz lookup.

**Commit:** `feat: add workspace tenancy and authorization`.

---

# Epic 2 — X Core and Manual Publishing

## Ticket 2.1 — X OAuth connection

**Files:**
- Create: `convex/x/oauth.ts`
- Create: `convex/integrations.ts`
- Create: `convex/socialAccounts.ts`
- Create: `convex/lib/crypto.ts`
- Create: `src/routes/app/settings/social.tsx`
- Test: `convex/x/oauth.test.ts`

**Interfaces:**
- `startXOAuth({ workspaceId }): { authorizationUrl }`
- HTTP callback exchanges authorization code.
- `disconnectX({ workspaceId, socialAccountId })`.

**Security:**
- PKCE verifier/state is validated.
- Access and refresh tokens are encrypted before persistence.
- Token material is stored only in `integrationSecrets`.
- Public queries return account metadata, never credentials.

**Acceptance criteria:**
- Connected X account creates/updates `integration`, `integrationSecrets`, and `socialAccounts`.
- Invalid state is rejected.
- Expired tokens can be refreshed server-side.
- Refresh failure marks account `reauth_required`.

**Commit:** `feat: connect x accounts with oauth`.

---

## Ticket 2.2 — Draft and immutable version model

**Files:**
- Create: `convex/drafts.ts`
- Create: `src/routes/app/drafts.index.tsx`
- Create: `src/routes/app/drafts.$draftId.tsx`
- Create: `src/components/drafts/draft-editor.tsx`
- Test: `convex/drafts.test.ts`

**Interfaces:**
- `createDraft`
- `createDraftVersion`
- `getDraft`
- `listDrafts`
- `approveDraft`
- `rejectDraft`

**Rules:**
- `draftVersions` are never updated after insert.
- Every content edit inserts a new version and updates `draft.currentVersionId`.
- `format="single"` requires exactly one post.
- `format="thread"` requires at least two posts.
- Empty text is rejected.

**Acceptance criteria:**
- Editing a draft retains old versions.
- Version numbers increase monotonically.
- Non-members cannot read/write drafts.
- Approving a draft does not mutate its content.

**Commit:** `feat: add versioned x drafts`.

---

## Ticket 2.3 — Scheduled post state machine

**Files:**
- Create: `convex/scheduledPosts.ts`
- Test: `convex/scheduledPosts.test.ts`

**Interfaces:**
- `scheduleDraft({ draftId, draftVersionId, socialAccountId, scheduledFor })`
- `reschedulePost`
- `cancelScheduledPost`
- `listScheduledPosts({ from, to })`

**State transitions:**
```text
scheduled -> publishing -> published
scheduled -> cancelled
publishing -> failed
failed -> scheduled    (explicit retry)
```

**Rules:**
- Scheduling requires an approved draft.
- Scheduling snapshots a concrete `draftVersionId`.
- Rescheduling updates the durable job reference.
- Past times are rejected except for a small server-clock tolerance.

**Acceptance criteria:**
- Editing the draft after scheduling does not change the scheduled version.
- Cancelling prevents future publish execution.
- Invalid state transitions throw typed domain errors.

**Commit:** `feat: add scheduled post state machine`.

---

## Ticket 2.4 — Idempotent X publisher

**Files:**
- Create: `convex/x/client.ts`
- Create: `convex/x/publish.ts`
- Create: `convex/x/workflows.ts`
- Create: `convex/publishedPosts.ts`
- Test: `convex/x/publish.test.ts`

**Publishing algorithm:**
1. Atomically claim `scheduled -> publishing`.
2. Check whether a `publishedPosts.by_scheduledPostId` record already exists.
3. Load exact draft version.
4. Ensure X token is valid; refresh if needed.
5. Upload referenced media.
6. Publish post 1.
7. For threads, publish each next item as a reply to previous item.
8. Insert `publishedPosts` snapshot.
9. Mark schedule `published`.

**Idempotency:**
- A retry first checks the persisted published result.
- If an ambiguous network failure occurs after X accepts a write, store provider request/response correlation data in system events and do not blindly replay without reconciliation.

**Acceptance criteria:**
- Single posts publish.
- Threads preserve order.
- Retry after already-completed publication does not create duplicates.
- Permanent auth failure marks `reauth_required`.
- Temporary provider failure creates `failed` state plus `systemEvent`.

**Commit:** `feat: publish scheduled posts to x`.

---

# Epic 3 — Media and Calendar

## Ticket 3.1 — Convex Storage media assets

**Files:**
- Create: `convex/mediaAssets.ts`
- Create: `src/features/drafts/media-uploader.tsx`
- Test: `convex/mediaAssets.test.ts`

**Interfaces:**
- `generateUploadUrl`
- `registerMediaAsset`
- `deleteMediaAsset`
- `listWorkspaceMedia`

**Rules:**
- Validate MIME type and size before attaching.
- `storageId` belongs to the same workspace as the draft.
- Deleting an attached asset is rejected until references are removed.

**Acceptance criteria:**
- User can upload an image and attach it to a draft version.
- A user cannot attach another workspace's asset.
- Orphan cleanup can be added later without changing domain IDs.

**Commit:** `feat: add media uploads with convex storage`.

---

## Ticket 3.2 — Week and month calendar

**Files:**
- Create: `src/routes/app/calendar.tsx`
- Create: `src/components/calendar/calendar-view.tsx`
- Create: `src/components/calendar/calendar-item.tsx`
- Create: `src/lib/dates.ts`

**Behavior:**
- Query only the visible date range.
- Show scheduled and published posts.
- Localize display using workspace timezone.
- Drag/drop invokes `reschedulePost`.

**Acceptance criteria:**
- Week and month views work.
- Moving a scheduled item updates Convex and all subscribed clients.
- Published items are not draggable.
- Failed posts are visually distinct and link to error detail.

**Commit:** `feat: add realtime publishing calendar`.

---

# Epic 4 — GitHub Integration and Content Signals

## Ticket 4.1 — GitHub App installation and repository selection

**Files:**
- Create: `convex/github/app.ts`
- Create: `convex/github/client.ts`
- Create: `convex/repositories.ts`
- Create: `src/routes/app/settings/github.tsx`
- Test: `convex/github/app.test.ts`

**Behavior:**
- Store GitHub App installation as `integration`.
- Sync only repositories granted to the installation.
- Repository selection controls `enabled`.
- `contentGenerationEnabled` is separately configurable.

**Acceptance criteria:**
- Private and public repository metadata can be synchronized.
- Revoked installation moves integration to `disconnected`/`error`.
- User can enable/disable individual repositories.

**Commit:** `feat: connect github app repositories`.

---

## Ticket 4.2 — Webhook ingestion and deduplication

**Files:**
- Modify: `convex/http.ts`
- Create: `convex/github/webhook.ts`
- Create: `convex/contentSignals.ts`
- Test: `convex/github/webhook.test.ts`

**Behavior:**
- Validate GitHub signature before parsing event.
- Use GitHub delivery ID/event identity as `externalId`.
- `by_source_and_externalId` prevents duplicate domain signals.
- V1 handles `push` and `release`.
- Disabled repositories acknowledge webhook but do not create content work.

**Acceptance criteria:**
- Invalid signatures return failure.
- Duplicate deliveries do not create duplicate signals.
- Valid push creates one `github_push` signal.
- Valid release creates one `github_release` signal.

**Commit:** `feat: ingest github webhooks as content signals`.

---

## Ticket 4.3 — GitHub signal enrichment workflow

**Files:**
- Create: `convex/github/workflows.ts`
- Modify: `convex/contentSignals.ts`
- Test: `convex/github/workflows.test.ts`

**Workflow steps:**
1. Load compact compare/release metadata from GitHub.
2. Build bounded change context: commit messages, filenames, stats, truncated relevant patches.
3. Ask the AI summarizer for a concise change summary.
4. Score relevance/novelty/confidence.
5. Update signal.
6. If relevance passes configured threshold, enqueue idea generation.

**Storage rule:**
- Raw diffs are transient action input and are not stored on `contentSignals`.

**Acceptance criteria:**
- Small trivial pushes can be marked `processed` without idea creation.
- Relevant pushes become enriched signals.
- Provider failure retries without duplicating signals.

**Commit:** `feat: enrich github signals for content relevance`.

---

# Epic 5 — AI Content Agent

## Ticket 5.1 — Requesty provider abstraction

**Files:**
- Create: `convex/ai/provider.ts`
- Test: `convex/ai/provider.test.ts`

**Interface:**
```ts
type DispatchModelPurpose =
  | "summarize"
  | "research"
  | "draft"
  | "plan"
  | "review";

getLanguageModel(purpose: DispatchModelPurpose)
```

**Rules:**
- Model IDs live in server configuration.
- Domain code never imports a concrete OpenAI/Anthropic client.
- Requesty API key remains server-side.
- Model selection may vary by purpose without changing callers.

**Acceptance criteria:**
- Test provider can be injected in tests.
- Missing configuration fails with a typed system error.

**Commit:** `feat: add requesty model gateway`.

---

## Ticket 5.2 — Content ideas

**Files:**
- Create: `convex/contentIdeas.ts`
- Create: `src/routes/app/ideas.tsx`
- Test: `convex/contentIdeas.test.ts`

**Interfaces:**
- `createIdea`
- `acceptIdea`
- `rejectIdea`
- `listIdeas`
- internal `createIdeaFromAgent`

**Acceptance criteria:**
- Agent-created ideas preserve signal and research references.
- Rejected ideas remain available for future evaluation.
- Cross-workspace references are rejected.

**Commit:** `feat: add content idea domain`.

---

## Ticket 5.3 — Content Agent tools and run tracking

**Files:**
- Create: `convex/ai/contentAgent.ts`
- Create: `convex/ai/tools.ts`
- Create: `convex/agentRuns.ts`
- Create: `src/routes/app/agent.tsx`
- Test: `convex/ai/contentAgent.test.ts`

**V1 tools:**
- `getRecentSignals`
- `getRepositoryContext`
- `getCalendar`
- `getDraft`
- `createContentIdea`
- `createDraft`
- `updateDraft`
- `requestResearch`

**Safety rules:**
- Tools derive workspace from trusted run context.
- Agent cannot publish directly in V1.
- Scheduling requires explicit tool call and approved draft.
- Publish remains a deterministic workflow action, not an LLM tool.

**Acceptance criteria:**
- GitHub signal can result in an idea and draft.
- `agentRuns` records trigger, purpose, model, status, token usage, cost estimate, and errors.
- Tool calls cannot cross workspace boundaries.

**Commit:** `feat: add dispatch content agent`.

---

# Epic 6 — Research

## Ticket 6.1 — Research item lifecycle

**Files:**
- Create: `convex/researchItems.ts`
- Create: `src/routes/app/research.tsx`
- Test: `convex/researchItems.test.ts`

**States:**
`pending -> completed | failed`

**Acceptance criteria:**
- Manual and agent-initiated research both create `researchItems`.
- Sources are stored as compact URLs/IDs, not full scraped pages.
- Failed research contains a stable error code and user-safe message.

**Commit:** `feat: add research item lifecycle`.

---

## Ticket 6.2 — Web research through Requesty

**Files:**
- Create: `convex/ai/workflows.ts`
- Modify: `convex/ai/provider.ts`
- Test: `convex/ai/research.test.ts`

**Behavior:**
- Use a model/provider with native web search when configured.
- Return structured `{ summary, sources, relevanceScore, suggestedAngles }`.
- Persist summary and source URLs.
- Emit a `systemEvent` on provider failure.

**Acceptance criteria:**
- Research result is attributable to sources.
- No arbitrary fetched page body is persisted.
- Retry is bounded.

**Commit:** `feat: add web research workflow`.

---

## Ticket 6.3 — X research and trend search

**Files:**
- Create: `convex/x/research.ts`
- Test: `convex/x/research.test.ts`

**Behavior:**
- Separate limits for `x_search` and `x_trends`.
- Fetch a bounded result set.
- Normalize metrics and post metadata before AI analysis.
- Cache research results long enough to prevent repeated paid reads for identical queries within a short window.

**Acceptance criteria:**
- Agent can request X research.
- API usage is bounded.
- Search failures do not break unrelated publishing operations.

**Commit:** `feat: add bounded x research`.

---

# Epic 7 — Agent Planning

## Ticket 7.1 — Calendar-aware planning

**Files:**
- Modify: `convex/ai/tools.ts`
- Modify: `convex/ai/contentAgent.ts`
- Create: `src/components/agent/plan-preview.tsx`
- Test: `convex/ai/planning.test.ts`

**Flow:**
1. User requests a number of posts/date range.
2. Agent reads existing schedule.
3. Agent reads recent high-value signals.
4. Agent optionally requests research.
5. Agent creates ideas/drafts.
6. Agent proposes slots.
7. User accepts/rejects each proposal.
8. Accepted proposals call deterministic scheduling mutation.

**Acceptance criteria:**
- Agent never silently overwrites existing calendar items.
- Plan preview clearly distinguishes proposed vs scheduled.
- User can accept only a subset.

**Commit:** `feat: add calendar aware agent planning`.

---

# Epic 8 — Reliability, Rate Limits, Email, and Analytics

## Ticket 8.1 — Provider-specific rate limiting

**Files:**
- Create: `convex/rateLimits.ts`
- Modify: `convex/x/research.ts`
- Modify: `convex/x/publish.ts`
- Modify: `convex/ai/contentAgent.ts`
- Test: `convex/rateLimits.test.ts`

**Limit keys:**
- `agent_messages`
- `requesty_tokens`
- `x_publish`
- `x_search`
- `x_trends`
- `github_api`

**Acceptance criteria:**
- Exhausting X search capacity does not block X publishing.
- Per-user/workspace AI budgets are distinct from global provider budgets.
- UI receives retry timing for user-triggered operations.

**Commit:** `feat: add provider specific rate limits`.

---

## Ticket 8.2 — System events and operational error model

**Files:**
- Create: `convex/lib/errors.ts`
- Create: `convex/lib/systemEvents.ts`
- Create: `convex/systemEvents.ts`
- Modify: external integration modules to emit errors
- Test: `convex/systemEvents.test.ts`

**Stable error examples:**
- `X_REAUTH_REQUIRED`
- `X_RATE_LIMITED`
- `X_PUBLISH_FAILED`
- `GITHUB_SIGNATURE_INVALID`
- `GITHUB_API_FAILED`
- `REQUESTY_RATE_LIMITED`
- `REQUESTY_FAILED`
- `RESEND_FAILED`

**Acceptance criteria:**
- User-safe messages are separate from raw provider errors.
- Sensitive token/header data is never logged.
- Critical workflow failures produce `systemEvents`.

**Commit:** `feat: add structured system events`.

---

## Ticket 8.3 — Resend transactional notifications

**Files:**
- Create: `convex/email/resend.ts`
- Modify: publishing and OAuth failure workflows
- Test: `convex/email/resend.test.ts`

**V1 messages:**
- email verification/password reset through Better Auth integration
- X reauthentication required
- scheduled post failed

**Acceptance criteria:**
- Email sending failure never rolls back the publishing domain state.
- Notification attempts are logged without storing email body content in system events.

**Commit:** `feat: add transactional email notifications`.

---

## Ticket 8.4 — Rybbit product analytics wrapper

**Files:**
- Create: `src/lib/analytics.ts`
- Modify: relevant route/actions in frontend
- Test: `src/lib/analytics.test.ts`

**Typed events:**
- `signup_completed`
- `github_connected`
- `repository_enabled`
- `x_connected`
- `idea_created`
- `idea_accepted`
- `idea_rejected`
- `draft_created`
- `draft_approved`
- `post_scheduled`
- `post_rescheduled`
- `post_published`
- `post_publish_failed`
- `agent_chat_started`
- `agent_plan_created`

**Privacy rule:**
- Do not send post bodies, prompts, OAuth values, GitHub diff content, email addresses, or repository private content to Rybbit.

**Commit:** `feat: add privacy conscious product analytics`.

---

# Epic 9 — SaaS Billing

## Ticket 9.1 — Subscription and entitlement domain

**Files:**
- Modify: `convex/schema.ts` to add `subscriptions` and `usageCounters`
- Create: `convex/billing.ts`
- Create: `convex/entitlements.ts`
- Test: `convex/billing.test.ts`

**Entitlements:**
- `aiGeneration`
- `xResearch`
- `agentPlanning`
- `maxRepositories`
- `maxScheduledPosts`

**Rule:**
- Product code asks the entitlement layer, not `plan === "pro"`.

**Acceptance criteria:**
- Free workspace receives deterministic default entitlements.
- Backend operations enforce limits server-side.

**Commit:** `feat: add subscription entitlements`.

---

## Ticket 9.2 — Stripe Managed Payments

**Files:**
- Create: `convex/stripe.ts`
- Modify: `convex/http.ts`
- Create: `src/routes/app/settings/billing.tsx`
- Test: `convex/stripe.test.ts`

**Behavior:**
- Create checkout/management flow according to current Stripe Managed Payments API.
- Verify webhook signatures.
- Map external product/price identifiers to internal plans.
- Webhooks update subscription projection idempotently.

**Acceptance criteria:**
- Duplicate Stripe webhooks do not duplicate subscription state.
- Cancelled/past-due states update entitlements as specified.
- Stripe IDs stay provider fields and are not domain IDs.

**Commit:** `feat: add stripe managed payments`.

---

# Epic 10 — Production and Cloudflare

## Ticket 10.1 — Cloudflare deployment

**Files:**
- Modify: `vite.config.ts`
- Create/modify Cloudflare deployment config according to the current Cloudflare Vite integration
- Create: `.env.example`
- Modify: `README.md`

**Acceptance criteria:**
- Production build deploys to `app.usedispat.ch`.
- SPA route refreshes work for nested TanStack routes.
- No server secret is present in built JS assets.
- Convex production URL is configured by public frontend environment variable only.
- `usedispat.ch` may serve the marketing entry point without changing the app backend.

**Commit:** `chore: deploy dispatch frontend to cloudflare`.

---

## Ticket 10.2 — End-to-end release gates

**Files:**
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/manual-publishing.spec.ts`
- Create: `tests/e2e/github-signal.spec.ts`
- Create: `tests/e2e/agent-planning.spec.ts`

**Required release flows:**

### Manual publishing
`signup -> connect X -> draft -> approve -> schedule -> publish`

### GitHub content
`connect GitHub -> webhook -> signal -> AI draft -> approve -> schedule`

### Research
`research -> research item -> idea -> draft`

### Planning
`ask agent for 3 posts -> proposals -> selectively accept -> scheduled calendar items`

**Release criteria:**
- All Convex unit/domain tests pass.
- All mocked integration tests pass.
- E2E smoke tests pass against staging.
- No critical `systemEvents` during smoke run.
- Manual security check confirms cross-workspace IDs are rejected.
- Manual bundle check confirms no secrets are exposed.

**Commit:** `test: add dispatch v1 release gates`.

---

# MVP Milestones

## M0 — Authenticated Shell
Complete Epic 1.

**Demo:** Sign up, enter app, see own workspace.

## M1 — Useful Without AI
Complete Epic 2 and Epic 3.

**Demo:** Connect X, create/edit a draft, add media, drag it in the calendar, publish automatically.

This is the first point where Dispatch is already a real scheduler.

## M2 — Work Becomes Content
Complete Epic 4.

**Demo:** Push to an enabled repository and see a new enriched signal in Dispatch.

## M3 — AI Copilot
Complete Epic 5.

**Demo:** A GitHub signal becomes an explainable idea and a draft.

## M4 — Live Research
Complete Epic 6.

**Demo:** Search current web/X topics and turn research into an idea.

## M5 — Planning Agent
Complete Epic 7.

**Demo:** Ask for next week's content plan and selectively approve proposed slots.

## M6 — Private Beta Quality
Complete Epic 8 and Epic 10.

**Demo:** Reliability, rate limits, email alerts, analytics, operational traceability, production deployment.

## M7 — Commercial SaaS
Complete Epic 9.

**Demo:** Upgrade a workspace and enforce server-side entitlements.

---

# Test Strategy

## Unit/domain tests
Use Vitest + `convex-test` for:
- authz
- workspace isolation
- state transitions
- versioning
- webhook deduplication
- agent tool authorization
- entitlement checks

## Integration tests
Mock HTTP boundaries for:
- GitHub API/webhooks
- X OAuth/API
- Requesty
- Resend
- Stripe

Do not make paid/live provider calls in ordinary CI.

## Staging smoke tests
Use dedicated staging accounts/installations and a non-production X test path where available.

## Security regression tests
For every workspace-scoped mutation/query, include at least one test proving a second workspace cannot access or mutate the resource by ID.

---

# Implementation Rules for Every Ticket

1. Write the failing domain test first.
2. Run the focused test and confirm it fails for the expected reason.
3. Implement the smallest behavior needed to pass.
4. Run the focused test.
5. Run the affected module test set.
6. Run `npm run test:once`.
7. Run `npm run build` for frontend-facing changes.
8. Review for workspace isolation and secret leakage.
9. Commit one coherent ticket.

---

# Plan Self-Review

## PRD coverage
Covered:
- authentication and workspaces
- X OAuth/publishing
- drafts/versioning
- calendar/media
- GitHub App/webhooks/signals
- Requesty/agent
- research
- planning
- rate limiting
- email
- Rybbit
- observability
- Stripe
- Cloudflare deployment
- security/tenant isolation

Deferred intentionally:
- LinkedIn/Bluesky/Mastodon
- team collaboration UI beyond membership primitives
- performance snapshots/content learning
- content pillars/style profiles
- fully autonomous publishing

## Type consistency
The plan uses the V1 schema entities:
`users`, `workspaces`, `memberships`, `integrations`, `integrationSecrets`,
`repositories`, `socialAccounts`, `contentSignals`, `researchItems`,
`contentIdeas`, `drafts`, `draftVersions`, `mediaAssets`, `scheduledPosts`,
`publishedPosts`, `agentRuns`, `systemEvents`.

## Delivery recommendation
Do not begin GitHub/AI work before M1 is working. A reliable manual X publishing loop validates the hardest irreversible side effect before agentic complexity is introduced.
