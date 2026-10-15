# TASK-46.1 exact final freeze SPEC — PASS

Final HEAD `5b76d52996bc4973adbb099e06f876b9a4883a66`. Final308-file manifest `/tmp/dispatch-continuation-46.1-freeze.json` SHA-256 `9123cc748977628ce645bf5732c1ebdd409bd5c73bbddcde5a86e2c8a32abf69`. All308 current file hashes matched before and after this focused final recheck. `src/features/content/Similarity.tsx` final SHA-256 `3d5a6dc2cdf65297a31152f821f9102cca41ba831bdbf324270886b2c676d6ec`.

## Exact one-copy followup

Compared the entire final manifest with `/tmp/dispatch-continuation-46.1-backend-tested-freeze.json` SHA-256 `e6701c9f9c174d582a64fdb735d702d77e1d3e7a7dc57db0ef929d58fb15cb38`: identical308-file membership and exactly one changed file, Similarity.tsx. Replacing its new literal with the previous literal in memory reconstructs the tested file's exact SHA-256. This independently proves the complete source delta is one replay-message literal; all backend/schema/native-test/config files remain byte-identical to the prior accepted SPEC and full-suite tested freeze.

At `Similarity.tsx:178`, the replay message now reads: `Dieser Auftrag wird nicht erneut gesendet. Status und Finanzbeleg bleiben erhalten.` It correctly states no further send without asserting the attempt was previously sent. Reviewed the unchanged claim path at `similarity.ts:670`: an expired still-reserved attempt can become cancelled, release only its unsent held liability, retain its receipt/status, and return null/replay without a provider call. The neutral message also remains accurate for already sent/settled/unknown replay. It does not modify retry identity, admission, liability, cleanup or render control flow.

**Verdict: SPEC PASS for the exact final whole freeze.** Prior retention P1 stays resolved by the byte-identical shared capture clamp and its registered regression. No remaining actionable P0/P1/P2 finding in reviewed scope.

## Verification and limits

Independent prior focused verification remains22 semantic +33 history/collection registered checksPASS. Root reports the final full native suite950 tests/49 filesPASS in724.46s with every tested freeze hash unchanged; all native code under that run is byte-identical in the final freeze. Sole writer reports17 synthetic styled browser checks, app TypeScript and formattingPASS for the copy followup. This reviewer checked the browser report but did not independently rerun browser/TypeScript/formatter or the full native suite. No redundant backend/full-suite run was performed for the literal-only change.

No source/original-test/product edits, provider calls, deployments, commits, seeds, credential reads or subagents during this recheck. Distinct QUALITY review remains required. Synthetic vectors/transport/UI are mechanics evidence, not empirical semantic accuracy or real-account manual acceptance. Actual EU/model/storage/upstream/training/rights/pricing facts, all-source-pattern resource coverage, full33/36 export/provider-backup acceptance and user manual acceptance/BacklogDone remain open.

## Appendix — preserved retention-fix SPEC review

The report below records the preceding backend-tested freeze. Its statement that root's final full suite still followed was accurate at that earlier review; the950/49PASS result recorded above supersedes that pending state. Its retained source review, independent checks and limitations otherwise remain applicable.

# TASK-46.1 fresh final SPEC re-review — PASS

Final frozen HEAD `5b76d52996bc4973adbb099e06f876b9a4883a66`; manifest `/tmp/dispatch-continuation-46.1-freeze.json` SHA-256 `e6701c9f9c174d582a64fdb735d702d77e1d3e7a7dc57db0ef929d58fb15cb38`. All308 listed hashes matched before and after final review/tests. Corrected `convex/performance/history.ts` SHA-256 `29820cd829342da07f3069387afdef26ff876a82d8e5500ae20da84c3ca6b954`; corrected `convex/content/similarity.test.ts` SHA-256 `97f90dc32b821899402b91fa492169a571165f3ebb2da5aa8cf152dfebcf9581`.

Reviewer was not the implementer/preflight reviewer. Initial rejected report is preserved at `/tmp/dispatch-continuation-46.1-before-retention-fix-spec.md`. Sole writer stopped before this final review; root reports repeated native codegenPASS. No product/source/original-test edits, commits, deployments, seeds, live provider calls, credential reads, or subagents. The earlier coordinated temporary diagnostic was already removed.

## Prior P1 resolved in shared source proof

`history.ts:910` adds `j.createdAt + p.retentionMs` to the existing current/original horizon minimum. The start transaction captures retention into the original job at253–258 and records its capture time at266; finish clamps later imported-row horizon to that job horizon at713. The correction uses original capture time and therefore cannot renew retention on every proof or postpone the cutoff to a later page-import finish time. Existing original expiry/job/row/credential/grant ceilings and original/current actor/account/connection checks remain in the minimum/proof.

All direct retained-source callers were rechecked: semantic `sourceProof` at `similarity.ts:242` (hence prepare/claim/pre-I/O context/commit/frame/purge/sweep), history reimport deduplication at664, bounded history expiry at982, and overview projection at1093. The fix is shared across admission, immediate masking and cleanup rather than only the visible frame.

New registered regression at `similarity.test.ts:1381` prepares an intercepted SDK vector, creates a new current same-connection policy using registered history.configure with1000ms retention after400ms, and requires the still-valid frame/vector horizon to equal original job.createdAt+1000 rather than Date.now()+1000. It drains semantic sweep, then advances601ms and proves prepared0/eligible0/no matches, rejects a fresh prepare without transport or a new attempt/reservation, runs registered history.expire plus actual scheduled derivative cleanup, and proves the imported row/vector are physically deleted while the original history job financial identity and embedding budgets remain unchanged and the settled40-micro estimate survives with source pin/fingerprint/intent removed. Re-expanded current retention then cannot resurrect the actually deleted row/vector or admit a new attempt. Mutable history recovery checkpoints/updatedAt are intentionally excluded from the financial-identity equality, while budgets and original job fields remain compared.

No remaining actionable P0/P1/P2 finding in the reviewed TASK46.1 scope.

## Reviewed scope and passing evidence

Read section46.1 and final `content/similarityFields.ts`, `content/similarity.ts`, `ai/embeddings.ts`, full `Similarity.tsx`, relevant semantic tests/browser fixture, narrow schema/AI-owner/sourceProof/history/cleanup/crons diffs, existing draft research/material proof and ledger functions, and actual Drafts/OwnMetrics insertion points.

The inspected implementation separates default-OFF semantic consent and immutable evidence-bearing policies from generation/history/analyzer grants, introduces one concrete embedding-owner union using the existing three aiBudgets, reserves before durable sent CAS and one SDK POST, fixes route/body/redirect/retry/deadline limits, checks raw model/index/vector/usage, rejects financial cross-owner use, preserves unknown holds and once-only original estimated settlement, and rechecks original/current source/actor/epoch authority. No added dependency, Agent memory setup, automatic UI indexing or second ledger was found in scope.

Frame mechanics use cap+1 history overflow, exact draft IDs, <=100+25 frame/topK5, compatible identity and actual cosine. Each source retains its existing32 ancestor ceiling; aggregate protected ancestors>32 produce explicit unavailable resource ceiling rather than erasure. Indexed one-proof cleanup preserves parents and propagates runtime/resource errors. The corrected shared retention proof now addresses the prior P1.

**Fresh final native runs:** `node node_modules/vitest/vitest.mjs run convex/content/similarity.test.ts convex/performance/history.test.ts` selected the existing semantic file (there is no history.test.ts),22/22 PASS,3.77s. Then `node node_modules/vitest/vitest.mjs run convex/performance/collect.test.ts` —33/33 PASS,1.44s. Total55 focused registered checks pass. Provider transport was intercepted; no live external request. The original rejected-freeze diagnostic is historical failure evidence, not a failure against this corrected freeze.

**Resource-test scope:** reviewed explicit native4096-query/16MiB/32000-document transaction limits in the100-history/25-draft/4096-dimension fixture, one history job, one draft with31 recursive idea ancestors plus draft root and24 manual drafts. Root/writer recorded952 queries/1027 documents/8,003,917bytes for that frame and125 queries/125 documents/502,930bytes for its single-proof cleanup. Do not generalize that fixture to all source patterns or use convex-test defaults as proof of native ceilings.

**UI evidence:** reviewed manual-only command creation, exact same receipt retry, pending/stale-role/account/generation fences, disconnected/expired-policy/lost-grant withdrawal branch, current horizon timer, overflow/partial/unavailable messages and actual Demo branch separation. Browser report lists17 synthetic transport checks, including selected draftB frame retainingA+B and zero automatic transport. Viewed corrected `/tmp/dispatch-task46.1-evidence/semantic-390.png`: one readable styled card, no visually repeated section. `capture-layout.json` reports one heading/section,width390,height710 in390x844 document. Browser execution was not rerun by this reviewer; root's capture diagnostic and report remain synthetic local UI evidence, not real-account/manual acceptance.

## Limits and disposition

PASS for the final frozen section46.1 implementation/spec boundary. Distinct QUALITY review and root final full/static/build/bundle/Dev evidence still follow; this report does not independently certify those. The interrupted full suite on the rejected freeze is notPASS evidence. Root's repeated native codegen result is reported evidence, not an independently rerun codegen check.

The100+25 fixture demonstrates its stated concrete source pattern/native ceilings, not every protected ancestry/source pattern. Injected vectors/intercepted transport prove semantic mechanics and financial/authorization boundaries, not empirical semantic accuracy or actual EU/model/storage/upstream/training/rights/pricing facts. Browser evidence is synthetic styled UI coverage, not authenticated real-account/manual acceptance. Full33/36 export/provider-backup acceptance and user manual acceptance/BacklogDone remain open.
