# TASK-31.2 — independent critical runbook QUALITY

**NEEDS_WORK: one narrow navigation wording correction.** Reviewed the complete49-line `.docs/runbooks/backend-recovery.md` at SHA `5351609735ab3307744f3160e5634bb0b64c29dee0a08c147b3c0230b90dd7b2` against immutable accepted HEAD `4a22190c7014bc2f2facbd214f28dc0db1a8b533`. No source/docs/task changes, tests, provider/network calls or drills were performed.

## Finding

**P3 — discoverability, runbook line7.** The instruction says to enter “unter Betrieb & Qualität”. The real sidebar link and breadcrumb label are **Betriebsübersicht** (`src/App.tsx:375`, `:426`); **Betrieb & Qualität** is the page heading after navigation (`src/pages/Operations.tsx:77`). The explicit `/operations` URL mitigates this, but an operator following the named menu entry will not find that label. Suggested minimal correction: “über **Betriebsübersicht** (`/operations`; Seitenüberschrift **Betrieb & Qualität**) den Tab **Systemzustand** …”. This is a documentation usability correction, not a backend defect or live recovery failure.

## Actual targeted checks

Read immutable source using `git show 4a22190:<path>`, not unaccepted live TASK32.3 preference/schema/UI changes. Checked Operations page mounting/default tab, App sidebar/breadcrumb/route, Health actual labels/role gate/server current-workspace/session/resource guard and financial/link display. Systemzustand, Betriebsbelege, Nachweis aktualisieren and Vorhandenen Vorgang öffnen match.

Checked X recovery actual UI labels and native context/lookup/continue/finalize boundaries: Owner/Admin/current workspace/generation/original schedule-version-account/provider identity; candidate lookup issues a concrete GET, whereas explicit continuation only admits remaining positions with current review/content checks. Unknown checkpoints, 400/422 and rate reset block continuation; cancellation does not establish absence of started effects. The runbook does not conflate lookup with a retry or reset genuine late ACKs.

Checked GitHub local admission/remote claim/finish and recovery transport plus crons: local signed facts do not consume a remote attempt; remote admission shares the GUID-wide maximum3 and at least900000ms wait, respects lease/source generation/current role, and 202 is request acceptance rather than processed proof. Pending resumption is1minute and failed-delivery detection15minutes. Existing button labels and no automatic POST retry/full coverage claims match.

Checked Research resume and source/material authorization, order liability and purge completion joins: own workspace/Owner-Admin-Editor, retained workflow, queued/running, unexpired deadline and current materials; inProgress is acknowledged, restart uses the same workflow journal. Liability preserves original currency, distinguishes null from known0 and holds from settlement; usagePending is unresolved liability. Purge waits for native Agent traversal and workflow cleanup plus empty bounded journal and bound copy checks. The document qualifies complete as this bound cleanup, not universal erasure/restore.

Checked media UI labels and uploads.claim/remove→r2.finish→cleanup.claim/delete/receipt: Editor finalizes own session; Owner/Admin may finalize other workspace sessions. Referenced versions and legacy assets fail closed. Final quota release follows successful bound final R2 deletion and receipt; unknown/failed deletion writes no success receipt. Cleanup batch20, cron15minutes, validating recovery protection until24h after expiry, permanent tombstones and misbound namespace reconciliation match. Optional notify is a zero-I/O/zero-mutation no-op while the unchanged original pending-result endpoint admits genuine late results; sent does not establish delivery/read.

## Guard and limits

Doc hash matches before/read and after; ready receipt SHA matches `892e727ab23c1986dd2fce650c4da342acaf0368b232cdb62f5037e4919c86c6`. All20 linked immutable-source hashes match the writer receipt; additional App/Settings/media/uploads/GitHub transport/authorization basis identities are recorded in `/tmp/dispatch-31.2-runbook-quality-guard.json`. Current351 source/config files match the Root TASK32.3 final2 freeze at completion; HEAD and human `.zcodeignore` remain exact. This completion guard is not a claim that this document review had independently frozen every live file before reading.

The review is a focused critical-claim/document usability review, not a complete module security audit, native test rerun, cloud provider verification, alert acceptance, restore certification or live recovery drill. Root's running TASK32.3 full-native gate was untouched. Parent TASK31 alerts/live drills and manual Done remain open.
