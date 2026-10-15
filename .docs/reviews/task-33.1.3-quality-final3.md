# TASK-33.1.3 final3 distinct QUALITY / Ponytail / Convex security review — PASS

What this change does: Adds one current authorized shared Draft-version page to the existing native export module and settings UI. Each page exports at most one explicitly projected business payload, after current retained-source validation; it does not promise a complete historical or atomic Workspace archive.

## Scope and integrity

Read the full source release `.docs/reviews/task-33.1.3-version-export-source-release.md`, fresh SPEC report and receipt, all six changed source paths, authorization wrapper and connected original contentProof/sourceAccess/currentIdeaSource/materialWalk logic. Applied Convex reviewer and Ponytail review skills. No source, Backlog, commit, dependency, SDK codegen or Dev action was performed. HEAD remains ec7d59da30e0a8096b31275f579061f51e54d60a. Freeze SHA256 6ff1b84742d58d85990abe9b7450bcbdbf009e9d0ebd083b02033872169154bf.

Before/after all 355 frozen source/config hashes match: five existing generated files unchanged, six owned paths frozen, 344 protected nongenerated paths unchanged. Tracked inventory, Git status, HEAD and human .zcodeignore SHA are unchanged. All artifact hashes cited by fresh SPEC receipt, including historical freeze1 NEEDS_WORK and anomalous formal390 capture, independently match. History is preserved.

## Review findings

No concrete must-fix or should-fix defect found against the released grant. One additional public workspaceQuery uses the existing current verified authentication/session, membership and selected-workspace checks. Owner/Admin and expected-identity denials precede domain reads. Root, version, account and Workspace bindings precede payload admission. Positive root/account absence, explicit unavailable state or finite expired row horizon omit the entire business payload; foreign/corrupt bindings, ambiguous retained proof errors, ancestry/cycle exhaustion, native resource errors and oversized wire fail the page. There is no source identifier, omission skeleton or reason/count side channel added to data.

The explicit shared business projection includes ordered text/title, owned account, pillar/strategy/reason, immutable version/draft identities and finite clocks. It excludes author, source/provenance, media, private archive, person and secret metadata. Derived shared text keeps the original editorial sharing policy; this is not a new right to an original author's private archive. Original draftResearchProof and its default 32-node material walk remain in use without a new cache, walker or private-reader override.

The single Workspace index selects one native raw candidate with native cursor and finite first-observation _creationTime upper bound. The backend rejects a page larger than one candidate. Existing native whole-query transaction limits include authentication and proof work; no artificial 128-query/512KiB cap or universal graph-liveness promise is added. UTF8 full wire is checked at 64KiB, with no truncation; download payload is a compact subset. Deadline is capped at 30 seconds and the current proof horizon.

UI verifies request, auth, session, Workspace, role, bound, native cursor progress and clocks before download. Account/nativeScope/request epoch and nonce fences reject ABA, unmount and late acknowledgments. Entropy/serialization and handoff failures fail closed, release busy state and revoke object URLs. The pre-click deadline and cursor advancement checks preserve retry position. Empty admitted pages can continue explicitly; reaching the end permits a new selection. Existing self export function and component behavior are unchanged. Existing house components are reused with status/alert output and no added dependency/framework. The security/correlation logic has concrete negative and producer tests; no speculative abstraction is warranted.

## Independent actual validation

Installed Vitest run, exit0: 207 tests across five files, including all 17 export tests and editorial/preferences/ideas/research pipeline checks. Installed application tsc -b and backend tsc --noEmit each exit0. Git diff --check exit0.

Actual registered create + twelve generate/claim/commitProposal/finish + handoff control: 25 counted ancestry nodes, 166 native queries/166 documents, 56,931 bytes read, 787 UTF8 wire bytes, zero query writes or scheduling, and fetch spy unused. Initial policy/account/budgets and validated proposal output are synthetic; scheduled provider functions are not executed. The separate injected completed-run graph is explicitly labeled as a helper fixture, not a full generation run. Role and identity denial controls each use only five authentication/Workspace reads, equal to native auth baseline, zero source proof calls/writes/scheduling. These measures describe the actual controls, not every graph shape or platform-limit certification.

Unmodified current styled tests/operations.browser.mjs ran outside sandbox on localhost with unique DISPATCH_HEALTH_EVIDENCE_DIR, exit0. Actual App/store/production CSS, mocked native transport. Receipt reports errors[] and provider[]; console PRIVATE_PROVIDER_ERROR stack traces are intentional existing error-boundary fixtures, not suppressed unknown errors. Independent AST helper exit0 confirms all 245 original assertions retained in order among 283 current assertions, 38 additions and zero superseded assertions. Harness receipt does not enumerate new Workspace tests separately; their assertions are present in the executed source and included in AST preservation.

Inspected fresh actual workspace-versions-1280.png and workspace-versions-390.png pixels directly: desktop1280x900 and mobile390x901 are clean. Mobile has one app view and footer with no repeated strip; controls/text fit and the existing horizontal settings navigation remains scrollable. The new formal capture waits exactly two requestAnimationFrames plus500ms after each viewport resize. Fresh captures close the historical freeze1 visual-evidence issue against final3 only. No private diagnostic replaces these formal captures.

Verdict: Ship this bounded source change. PASS is technical source/fixture evidence, not deployment or manual acceptance.

Not checked: live model/provider execution, Dev synchronization, human manual acceptance or manual assistive-technology certification. Remaining risk: export is partial/current per page; retained graphs can fail closed at existing ancestry/native limits, and other parent-export families remain open.
