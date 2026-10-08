# TASK-32.4 — personal Publishing inbox validation

Technically accepted source `0bdd9e4c2aabb3919e01c15864e2f0e62df3b9ea`, synchronized to existing EU Dev `accurate-lion-749` on 2026-10-08 at 05:29:45 UTC. Manual acceptance and Backlog Done remain open.

Actual first-failure transactions preserve the original schedule/generation/recipient tuple and capture only a supportable original presentation binding. Replay does not replace binding or read state. Current verified recipient/session/workspace and original actor, approval, version/account and source horizons precede visible rows/counts and atomic read/dismiss. The public DTO omits private source bindings; the existing transport/resources contract remains unchanged. Optional mail remains unavailable.

Expected authority/source loss hides presentation immediately. Existing lifecycle seams dispatch bounded native cleanup continuations, one parent per transaction, including missing roots. These scrub presentation while preserving operational dedupe and genuine uncertain/late transport effects. This is eventual physical cleanup, not full global retention or erasure.

Two independently reproduced defects were repaired: an expired pending command retained its busy ticket and blocked a subsequent valid episode; a 25-parent deep-source cleanup exceeded the public sampling budget and rolled back. Shared command ownership now releases the expired ticket without allowing its late acknowledgement to release a newer ticket. All three cleanup workers use one-parent native transactions. Original failure reports are preserved in `task-32.4-spec-final2-needs-work.md` and `task-32.4-backend-cleanup-needs-work.md`; interrupted final2 whole-suite exit130 is not a passing result.

Final3 verification:

- Root whole native suite: **1,506 tests in 61 files passed**, 863.36 seconds reported by Vitest (864.04 seconds elapsed).
- All seven Root static gates passed: guarded codegen, app/backend type checks, configured lint, owned formatting, native build with original bundle assertions, and diff check.
- Independent SPEC and separate QUALITY passed; each ran 183 affected native controls in four files. The unchanged historical deep-cleanup drain now passes; the actual expired-command/new-episode browser reproduction also passes.
- Actual mounted App/Store/production-CSS browser: **211 assertions**, preserving all 171 original and 207 prior assertions. Final 1280/390 screenshots inspected. Long labels fit; Cloud's local-output read control is accurately labelled, and Demo remains intact.
- Source freeze: 353 files, ten owned source paths, 338 original non-generated paths protected, five generated files. Human `.zcodeignore` unchanged and unstaged.
- Exact Dev metadata: **468 entries**, exactly seven new Publishing-notice interfaces. Every prior461 args/returns/type/visibility contract and all five HTTP entries remain unchanged; all353 frozen source hashes remain unchanged after synchronization.

Public entry bounds remain 640 queries/documents, 512KiB reads, 64KiB wire and25 rows. Actual25-row controls measured381 queries/380 documents with reviews off,606/605 with two reviews, and630/630 for read/dismiss with25 writes/no scheduled jobs. Resource failures propagate and mutations roll back; no pre-read zero-overshoot guarantee is claimed. Cleanup uses native platform transaction limits instead of the public sampling ceiling.

Evidence: final3 freeze `/tmp/dispatch-32.4-final3-freeze.json`; Root native/static receipts `/tmp/dispatch-32.4-final3-{native,static}-receipt.json`; separate reports `task-32.4-spec-final3.md` and `task-32.4-quality-final3.md`; exact Dev receipt `/tmp/dispatch-32.4-continuation-dev-receipt.json` and metadata. Native whole-suite log SHA256 `de38239ea6558c74bcc9b14babae5707bff627d048b733ec0bfcf291c147fc57`.

These controls do not claim real-provider delivery, a live outage/restore drill, production deployment, or manual acceptance. Larger TASK-31/32/33 obligations remain open.
