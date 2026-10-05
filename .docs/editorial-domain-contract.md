# Editorial backend contract — TASK-7/8/11/13

R1 internal milestone. The Dev deployment implements editorial persistence and planning. Provider publishing and verified account enrollment are later units; TASK-9 implements the R2 upload/preview/lifecycle code with initial configuration guidance (see [media contract](media-domain-contract.md)); no public account factory or media-ready setter exists. Synthetic test fixtures do not establish J02/J08 live acceptance.

## Authoritative records

- `drafts`: workspace, author, current immutable version, CAS revision, source and optional current-member assignee. `draftVersions`: ordered text, account selection, title/pillar/strategy, immutable asset references with alt metadata, author/time/reason and server-captured asset checksum/object key. Versions are never patched by public commands. Maximum encoded content snapshot: 32 KiB.
- `socialAccounts`: verified provider identity, connection and capability adapter result (`maxText`, `maxThread`, `maxMedia`, media types, publishing capability). Only later internal verified provider code may insert/update accounts and capabilities.
- `mediaAssets`: workspace, R2 immutable final object key/checksum, validated type/size and lifecycle. Only internal session-bound byte-validation code owns creation/readiness. A changed key/checksum invalidates old approval preflight.
- `approvals`: workspace, exact version/account, human actor/time and separately recorded revocation actor/time. Owner/Admin only. This API does not expose an agent approval tool.
- `schedules`: exact version/account/approval/actor, UTC instant, original IANA zone/local input, generation, internal scheduler job and durable publishing state. Scheduling and scheduler registration happen in one mutation. DB atomicity does not extend to external APIs.
- `editorialComments`: workspace, immutable version, server author, creation time and resolution state. Assignment validates current workspace membership.
- `editorialEvents`: sanitized operation codes with workspace/draft/schedule/actor/time; no credentials or post content. `publishingNotifications`: recipient and durable pending/sent/blocked delivery state. Real Resend delivery requires AUTH_EMAIL_FROM, RESEND_API_KEY and SITE_URL; missing configuration is persisted as blocked. No test email is sent by this unit.

These workspace-bound tables must join the later inventory/export/deletion implementation. Media byte deletion and database deletion must be coordinated by the later R2 lifecycle implementation; TASK-9 adds indexed whole-version media references and coordinated expiry-aware cleanup.

## Public and internal commands

`editorial.create`, `save(expectedRevision)`, `approve(versionId,accountId)`, `revoke(approvalId)`, `schedule`, `reschedule(expectedGeneration)` and `cancel(expectedGeneration)` are explicit validated domain commands. `addComment`, `resolveComment(expectedResolved)` and `assign` validate current authority/references. Every nested account and asset is workspace-checked.

New versions do not replace already planned versions. Replacement requires explicit `reschedule` with a newly approved version and its approval ID, retaining the schedule account. Changed account requires a separate newly approved schedule. Revocation before claim blocks claim; after claim each later send step must recheck approval. Cancel before claim prevents claim; cancel after claim invalidates generation and reports reconciliation required. Published rows cannot move or cancel.

Internal `publishing.claim(scheduleId,generation)` atomically consumes a due scheduled generation once and returns its exact immutable content. `publishing.checkSend` must be called before **every** future provider send step and rechecks generation/state, scheduling actor membership, human approver authority, account capability/connection and media snapshot/readiness. Provider attempts and external IDs must be persisted by the following publisher unit. Current `dispatch` records PUBLISHER_NOT_CONFIGURED after a valid claim and a critical event/notification; it never marks content published. No universal retry or automatic re-send is offered.

## Time and query bounds

The delegated D05 strategy is UTC instant plus retained IANA zone/local input. Server and UI share `resolveLocalTime`: reject gaps; require the explicitly selected UTC instance for overlaps. Profile zone changes never alter existing stored UTC instants. Past schedules are rejected.

`list` pages at most 25 drafts and returns current snapshot and status metadata, not entire history. `get` fetches a composer by ID independently of the list page and includes the latest 20 versions plus referenced scheduled snapshots. `history` pages older immutable versions in groups of 20. Composer preserves dirty local input on reactive updates and save conflict; explicit reload confirms discarding local edits.

`calendar` accepts at most 93 days, optional workspace-checked account and returns `{ rows: [{ schedule, version }], tooDense }`. Over 100 rows returns `tooDense: true` and no partial rows; the UI asks for week or account filtering. Active schedules remain present in composer despite newer historical rows. Composer shows recent history, while bounded calendar windows retrieve historical scheduled/publishing outcomes by their instant.

New planning is atomically limited to 100 active scheduled/publishing rows per draft. Legacy overflow remains readable with `schedulesLimited`; the composer offers cancellation of a visible planned row, and other rows become reachable as active rows are cancelled. Returned schedules' exact approvals are loaded in addition to the latest 100 approval records, with workspace/draft/version/account validation, preserving revocation of old planned snapshots.

Resources show the first 100 accounts/ready assets; loaded versions also return their referenced asset descriptors, and the media library separately paginates50 rows. Resources expose `resourcesLimited`; larger account inventories need the later paginated provider UI. Comment display shows latest 100 comments and exposes `commentsLimited`. Current member options are authorized member IDs with preference names and server roles, never demo people.

## Verification and external limits

Convex transaction tests cover CAS, immutable snapshots, reference/role validation, approval identity, claim deduplication, generations, cancellation ordering, capability limits, media checksum changes, planned version replacement, dense calendar recovery, paginated history, comments/assignment and Berlin DST gap/overlap. Tests insert internal synthetic fixtures and make no external social writes.

Manual authenticated composer/workspace-switch verification and later approved provider account J02/J08 live publishing remain acceptance steps. Intelligence and channel-variant simulation remain visibly unavailable outside explicit demo mode. Media uploads/previews use the TASK-9 authorized R2 path and show missing EU-bucket configuration. Backlog tasks remain In Progress pending explicit user confirmation.
