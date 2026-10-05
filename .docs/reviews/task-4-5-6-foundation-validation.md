# TASK-4 / TASK-5 / TASK-6 foundation validation

Date: 2026-10-05. Branch: `master`. Development deployment: `accurate-lion-749`.

## Verified

- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`: pass.
- `pnpm test`: **22/22 pass** (17 existing model tests and 5 foundation tests).
- `pnpm build`, `pnpm test:bundle`: pass. The bundle check rebuilds with sentinel server secrets and rejects leaked values; no actual secret values are read. Better Auth's vendor code contains an inert `BETTER_AUTH_SECRET` name.
- `pnpm audit --prod`: no known vulnerabilities. Better Auth stays on patched **1.6.33**, Convex component **0.12.5**, Convex **1.46.0**.
- `pnpm test:e2e`: final stable run **31/31 pass** on explicit demo mode, port 5174. An earlier mobile timeout passed both an isolated rerun and the final full run.
- `pnpm exec convex dev --once`: final push succeeds with typechecking; Better Auth component installed on the configured development deployment.
- Live anonymous `get-session`: `200`, `null`. Anonymous `users:bootstrap` is denied.
- Live CORS permits exact `http://localhost:5173` and `http://127.0.0.1:5173`; foreign origin receives no allow header and foreign auth POST returns `403`.
- Real default frontend smoke: direct `/settings/profile` redirects to `/login?returnTo=%2Fsettings%2Fprofile`; real login renders, demo bypass is absent, GitHub is disabled, public landing renders, no browser errors. The loaded capabilities show the restricted sender note. Screenshot: `evidence/task-5/auth-login.png`.
- Isolated real auth HTTP handlers verify email, mint a Convex JWT with correct audience/subject/session, reset a password, revoke existing sessions, reject old passwords and reject reused reset tokens. Only the email transport is mocked in this isolated test.
- Foundation data tests cover idempotent atomic user/workspace/Owner/profile initialization, normalized profile/project persistence, foreign workspace and reference denial, Viewer denial, invalid timezone, expired/unverified sessions and revoked active membership.

## Remaining acceptance limits

- No verified `AUTH_EMAIL_FROM` is configured. The real Resend handler uses the restricted `onboarding@resend.dev` sender; inbox delivery to arbitrary users is **not verified**.
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are absent. Social-login configuration exists but a live OAuth callback is **not verified**. Existing GitHub App credentials are separate repository authorization.
- No authenticated live inbox-driven browser registration/reset was claimed. GitHub Actions workflow is committed; its commands passed locally, but the hosted workflow has not run here.
- Existing UI modules outside overview/profile/workspaces/onboarding remain visibly gated until their own normalized backend commands land. Legacy central and module-local domain setters reject production writes rather than claiming persistence. No fake connections, publishing outcomes or whole-AppState server blob are introduced.
- Tasks remain **In Progress** pending explicit user acceptance; no task was marked Done.
