---
id: TASK-16
title: Signale anreichern und verständlich darstellen (P04.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 17:26'
labels:
  - p04
  - r2
milestone: m-2
dependencies:
  - TASK-15
  - TASK-17
  - TASK-18
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P04.03.
Phase: P04 – GitHub und Arbeitssignale.

**Abhängigkeit:** P04.02, P05.01; Übergabe zur Idee nach P05.02. **Dateien:** `convex/integrations/github/enrichment.ts`, `src/features/signals/`, `tests/fixtures/github/`.

- Begrenzten Commit-, Datei- und Diff-Kontext laden; Geheimnisse und ungeeignete private Details vor Modellübergabe filtern.
- Zusammenfassung, Relevanz, Neuigkeit und Confidence mit belegbarem Bezug erzeugen.
- Triviale Änderungen als verarbeitet kennzeichnen, ohne zwangsläufig Ideen anzulegen.
- Quelle, verwendeten Kontext und redaktionelle Entscheidung im Produkt anzeigen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Wartungsrauschen bleibt ohne Draft.
- [x] #2 relevante Änderung wird zur begründeten Idee weitergereicht.
- [x] #3 ein Modellfehler verliert das Signal nicht.
- [x] #4 P04.01–P04.02 können vor P05 geliefert werden.
- [x] #5 AI-Anreicherung folgt nach dessen Modelladapter.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read reviewed14/15/17/18 source contracts and current GitHub context API receipt; preserve original signed facts/admission and existing funding. 2. Extend only current repository-purpose writers for explicit bounded context selection, exact historical-signal admission, source/connection/credential fencing and hash-bound human approval. 3. Reuse the actual one-repository App token primitive for concrete Contents-read; load fixed-origin bounded Push commit/file/diff context, exclude unsafe or incomplete material and keep gaps visible. 4. Implement concrete summary/enrichment receipts through reviewed funded official Agent, distinguishing maintenance/needs_context/relevant and original facts/approved evidence/user claims/interpretation; retain original signal on failure. 5. Reuse actual immutable idea insertion and existing explicit editorial handoff with real returned IDs; wire awaited Signals/Settings context actions and truthful missing-configuration states. 6. Verify actual-handler/component/current-purpose/replay/secret/rename/coverage/funding/late-result and affected real UI cases; full checks and existing EU Dev after PASS. 7. Freeze scoped master source, independent SPEC then QUALITY; record code-only criteria and live/manual gaps, leave Done open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /signals. Synthetic signal filters/details, original event versus editorial interpretation, relevance/novelty/confidence/private status, maintenance noise and failed enrichment, idea handoff. Grenze: No GitHub retrieval, secret filtering or AI enrichment. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only implementation brief prepared while TASK17 is being completed: /tmp/dispatch-github-enrichment-implementation-brief.md. Start only after independently reviewed17 and18, reusing final14/15 source and factual-signal contracts. This task explicitly needs bounded commit/file/diff context; current metadata-only access and content purpose must not silently grant private file/model transfer. Add the smallest explicit context consent and current-generation approval, update existing purpose writers/native admission order, validate least actual token permissions and current GitHub APIs, and keep unsafe/incomplete context as needs_context. Secret filtering is not claimed perfect; facts, approved context, user claims and interpretation stay separate. No16 code, private context fetch, model activation, paid call or acceptance from this preparation.

Additional read-only current context receipt /tmp/dispatch-github-context-current-docs.md: three library-first Context7 commands plus primary official API2026-03-10 verify compare250default commits/max300files only firstpage, commit JSON file pagination max3000, optional binary patches, renamed previous_filename, exact contents ref/size/symlink/submodule limits and selected repository_ids plus explicit Contents-read App permission. No private fetch/token mint/model call or TASK16 implementation. Existing metadata token/content-purpose does not silently grant private context/model transfer. Reviewed17 available at89e1cfa;18 implementation underway and independent reviews still prerequisite.

Root D05 refinement recorded in domain-contracts/release-scope: one exact historical signed signal may receive a new explicit current context admission under unchanged original facts/generation/admission/recovery provenance; no global retroactive grant or relaxed source guard. Concrete filtered context needs current hash-bound human approval before model transfer. Push exact immutable SHAs/selected paths form initial file/diff caller; release tags never pretend event commit evidence. Read-only code map /tmp/dispatch-github-context-code-map.md identifies actual writers/token/run/idea/UI reuse points. Source18ad3fc25 passed SPEC53 plus8 own/browser; final QUALITY receipt pending before implementation assignment. No16 provider call or activation from this note.

Dependency18 now independently reviewed atad3fc25:SPEC53 registered+8 own/browser PASS and QUALITY53 registered+8 separate own/browser PASS; reviewed17 remains89e1cfa. Root records18 code-only acceptance and releases fresh TASK16 implementation under original whole-backlog authorization/delegated decisions. Use actual reviewed idea/run/editorial/source helpers and D05 refinement; no provider activation or private/paid probe is authorized by code readiness. Missing App key/contents capability/full processing path remains visible, as requested.

Concrete caller minimizes retrieval to compare patch/path/blob-SHA for at most3 selected changed paths; no Contents/tree/download/symlink-resolving endpoint. Coverage is selected patch excerpts, not full files or entire repository changes. Additional read-only /tmp/dispatch-github-compare-boundary-current-docs.md used exactly3 library-first Context7 calls plus official primary pages: BASE...HEAD and base/merge-base/status fields are documented, but precise diverged patch semantics was not established. Root conservatively requires signed before basis/merge-basis and after in fully bounded actual commits; diverged/behind/zero-SHA/missing/incomplete evidence remains needs_context, no guessed last-page head. /tmp/dispatch-github-enrichment-review-checklist.md records actual-handler/transport/funding/current-approval/retention/UI boundaries for final independent reviews. Implementer codegen/typecheck passed and targeted suite underway; no final16 receipt or criteria acceptance yet.

Backend intermediate017d0b0 committed with98 targeted tests/5suites,27 new context regressions, typecheck/diff PASS; source commit window closed/index empty. Implementer actual SignalContext browser fixture PASS covers pending/stable key/error-buffer/hash approval/late source-account-workspace/config-stop/maintenance noDraft/actual idea navigation; owned5174 closed. Existing affected GitHub Settings/Signals compatibility, full checks, final contract and existing EU Dev remain pending before sourcefreeze and independent SPEC/QUALITY. No final16 acceptance or Done from this intermediate receipt.

Final implementer source frozen77ba114b603446bcf7a77cc7178ec727a0417e9c (backend017d0b0, base5c99601), index empty/source window closed. Full333 tests/24files,28 context cases, type/lint/build/bundle/codegen/diff and actual SignalContext plus GitHub Settings/Signals browsers PASS; owned5174 closed/user5173 preserved. Existing EU Dev ready19:08:07/4.75s. Exactly one new githubContexts store with concrete indexes/pins/hash approval/summary/result, existing repository contextRead defaultOFF and typed contextId in existing idea/run sources. Follow-up Ideas.generate receives actual currently approved excerpts with shared fences. Fresh independent SPEC reviewing full source and own actual boundaries; separate QUALITY only after PASS. No policy/grant activation, private/paid/provider probe/manual acceptance or final16 AC/Done claimed.

Independent SPEC at77ba114 NEEDS WORK, one reproducedP2: shared deliveries.closeRepository omits contextRead reset and already-closed predicate. Actual signed installation.deleted leaves access/monitoring/content false and proof0/newgeneration but contextRead true; Settings retains checked withdrawn flag. Existing source/barrier/generation denies old work, no immediate bypass claimed. Registered131 tests/7files PASS, own9PASS/1 closureFAIL, both affected actual browsers PASS. Receipt /tmp/dispatch-enrichment-spec-receipt.md and runnable isolated test/config. Original implementer assigned verify/reproduce then minimal shared-writer correction and actual signed caller regressions. No criteria accepted; re-SPEC then freshQUALITY required before19.

Confirmed SPEC correction source5ae8da30b93345d051a69fc693d74c492582219e frozen, minimal shared closeRepository fully-closed predicate plus contextRead:false reset; originalsource77ba114 retained in history. Implementer reproduced original9PASS/1FAIL first, then original10/10PASS and added6 actual signed closure regressions across both shared fanout paths, staleflag and replay. Affected66/3 and full339/24 including34context, type/lint/build/bundle/codegen/diff and affected actualGitHubSettings/Signals browserPASS; EUDev19:17:28/5.13s, own5174closed/user5173preserved. Same independent SPEC reviewer now rechecking correction and own cases; freshQUALITY only after re-PASS. Initialfailure remains documented, no codecriteria orDone accepted yet.

Final independent re-SPEC PASS5ae8da3:66 affected registered, original own10/10 plus one separate cross-workspace signed fanout/newGUID/clock-rollback case. Fresh independent QUALITY PASS whole5c99601..5ae8da3:137 registered/7files,8 own actual-handler/transport cases, both actual SignalContext and GitHubSettings browsers; no findings. Full signed historical source->hash-approved patch->funded officialAgent->real immutableIdea->human edit->concurrent duplicate-safe realDraft verified. Policy/authority withdrawal blocks domain writes while lateusage settles once; unproved cost currency retains full3scope holds. Root review .docs/reviews/task-16-github-enrichment-validation.md preserves original SPEC failure, correction and separate actual receipts. Code-only AC1-5 checked; status In Progress, human DoD/manualJ03/privateGitHub/completeprocessing/pricing/live quality and laterlifecycle remain open. TASK19 may proceed on actual reviewed16/17/18 interfaces.
<!-- SECTION:NOTES:END -->
