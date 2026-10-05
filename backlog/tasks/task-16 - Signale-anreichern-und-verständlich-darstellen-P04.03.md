---
id: TASK-16
title: Signale anreichern und verständlich darstellen (P04.03)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 16:52'
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
- [ ] #1 Wartungsrauschen bleibt ohne Draft.
- [ ] #2 relevante Änderung wird zur begründeten Idee weitergereicht.
- [ ] #3 ein Modellfehler verliert das Signal nicht.
- [ ] #4 P04.01–P04.02 können vor P05 geliefert werden.
- [ ] #5 AI-Anreicherung folgt nach dessen Modelladapter.
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
<!-- SECTION:NOTES:END -->
