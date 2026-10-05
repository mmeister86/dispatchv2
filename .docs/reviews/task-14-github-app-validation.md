# TASK-14 — GitHub App source validation

Initial frozen source `aa6e021ff4b07754b6d56c89246ada76b9118a52` (backend `753a7e6`, final UI/tests/contract `aa6e021`). Independent SPEC is in progress; QUALITY follows SPEC PASS. Backlog remains In Progress, with actual provider and manual acceptance open.

## Implementation and reported checks

Separate App-user OAuth with one-use S256 PKCE, verified human/workspace/App installation-repository intersection, encrypted credentials, unknown-safe refresh, explicit selected sources and independent access/monitoring/content purposes. Current human proof expires after15minutes with explicit bounded resync. Source/credential/discovery generations prevent late callbacks or inventory from restoring removed access. Background source checks use actual actor memberships/lifecycle rather than UI selection. Restricted installation credentials use one selected repository and metadata:read, with a source recheck after I/O. No factual webhook ingestion or model/file/diff access was introduced.

Real Settings/onboarding/callback use awaited commands and genuine configuration/source state. Real Signals no longer displays demo seeds, scores or a fake handoff; explicit demo keeps its fixtures. Disconnect revokes local authority immediately and honestly distinguishes unattempted remote removal from GitHub sign-in.

Implementer: 215/215 unit checks (14 GitHub checks), full TypeScript, format, build, bundle-secret/server-code exclusion and diff checks PASS. Actual affected browser fixture PASS: one StrictMode exchange, denial, workspace switch, missing source/private-key configuration, awaited settings failure with retained edit buffer, honest disconnect and real/demo Signals separation. An eager guidance import initially failed bundle exclusion; it was corrected without weakening the existing checks. Self-review removed an unused document validator and unused installation index. These are implementation receipts, not independent acceptance.

Official codegen analysis and runtime activation are distinct. Final existing EU Dev activated at16:25:19 on2026-10-05 after final schema cleanup. Fixture5174 closed; user's5173 untouched. Actual inventory/API contract is `.docs/github-app-domain-contract.md`: githubConnections/githubOAuthStates/githubRepositories plus queried native indexes, cleanup, purposes and source/credential generations. TASK-15 must reuse the concrete checkSource/source/installationCredential boundaries.

ROOT independently ran `pnpm test:e2e:auth`: all three existing intercepted auth destination/form regressions PASS in4.4seconds. Fixture5175 closed; no actual email or provider operation. Fresh independent SPEC is checking actual code/requirements and own negatives; no final review verdict is claimed yet.

## Remaining live and manual gates

App source client/callback/private-key configuration, actual individual/org installation and human repository intersection, real refresh and remote permission removal/revocation, restricted metadata token behavior and authenticated manual UI acceptance remain open. Current primary docs receipts cover App-user OAuth/JWT; synthetic tests are not live provider proof. No actual provider/private-repository/model call, email, remote revocation, new deployment, environment secret or push was performed. TASK-15 factual events and TASK-16 model context are separate future units. No Backlog Done without explicit user confirmation after manual testing.
