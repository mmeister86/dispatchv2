---
id: TASK-18
title: Ideen und Content Agent aufbauen (P05.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 16:52'
labels:
  - p05
  - r2
  - jev
milestone: m-2
dependencies:
  - TASK-17
  - TASK-7
  - TASK-15
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P05.02.
Phase: P05 – Agent-Grundlage, Content Agent und Chat.

**Abhängigkeit:** P05.01, P02.01, P04.02. **Dateien:** `convex/content/ideas.ts`, `convex/ai/contentAgent.ts`, `convex/ai/contentTools.ts`, `src/features/ideas/`; Test `convex/ai/contentAgent.test.ts`.

- Ideen als strategische Ebene mit Perspektive, Quellen und Priorität implementieren.
- Agent-Werkzeuge zum Lesen des Kontexts und Erstellen von Ideen/Entwurfsversionen anbieten.
- Manuelle Notizen, Gesprächsinhalte und Arbeitssignale als mögliche Ausgangspunkte integrieren.
- Ablehnung und Änderung als Feedback speichern; unbelegte Projekterfolge oder erfundene Erfahrungen verhindern.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

### JEV-Abgleich vom 18.09.2026

Der Content Agent bleibt die generative Schicht. Atomare Intent-Entscheidungen und Output-Prüfungen werden später durch TASK-67/TASK-68 ergänzt; Convex behält die Ablaufkontrolle. R2 benötigt keinen laufenden Jev-Provider. Quellenbindung, Nutzerabsicht und konkrete Entwurfsversion so erhalten, dass spätere Verifikation den Originalkontext vergleichen kann.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 J03 führt zu einer belegbaren Idee und einem editierbaren Entwurf.
- [x] #2 Der Agent begründet seine Auswahl, veröffentlicht nichts und behauptet keinen Zustand ohne Tool-Ergebnis.
- [x] #3 Ideen-/Entwurfserzeugung funktioniert mit deaktiviertem Jev; Quelle, Nutzerabsicht und erzeugte Version bleiben für spätere Prüfungen nachvollziehbar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Start only after TASK17 independent SPEC and QUALITY pass; read actual final model/provider/source/editorial interfaces. 2. Implement authorized durable manual ideas, revision-bound feedback and typed evidence/intent without requiring an activated model. 3. Reuse the existing immutable editorial transaction for explicit idempotent idea-to-draft handoff, preserving exact source/intent/version and returning actual IDs. 4. Add only concrete bounded Content Agent tools or typed generation output through reviewed official Agent funding, stop, usage and current-source guards; Jev remains separate and processing/pricing unavailable states truthful. 5. Replace real-mode Ideas local setters with awaited backend commands, preserving buffers on errors and ignoring late workspace results; demo remains explicit. 6. Verify tenant/role/lifecycle/CAS/source-revocation/unsupported-claim/duplicate-handoff and real UI behavior, plus full checks and existing EU Dev. 7. Freeze scoped master commits, run independent SPEC then QUALITY and document code-only evidence; leave human/provider acceptance and Done open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /ideas, /signals, /agent, /drafts/:id. Create/archive/accept local ideas with perspective/source; hand off note, signal or chat proposal into editable draft. Grenze: No Content Agent generation or factual verification. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only preparation /tmp/dispatch-content-agent-implementation-brief.md now includes actual TASK17 source928b26c interfaces and four-store/component inventory. TASK17 independent reviews are still pending; no TASK18 implementation or acceptance is claimed. The existing provider.execute returns only a run receipt; a concrete task18 caller must narrowly reuse its funded fixed-provider path for validated content results rather than adding a second model engine. Manual idea operations remain usable without model/account-generation readiness.

TASK17 final code dependency now reviewed at89e1cfa: SPEC44PASS/QUALITY41PASS, actual browserPASS, four-store/official component contract .docs/model-run-contract.md and root .docs/reviews/task-17-model-budget-validation.md. Root now releases TASK18 implementation under the original backend/UI authorization and delegated decisions. Start manual ideas/feedback/atomic editorial handoff without requiring model activation; bounded generative path reuses actual reviewed middleware and current grants/source guards. No new engine/history, automatic approval/schedule/publishing or paid probes. Fresh implementer then independent SPEC/QUALITY; real J03/model/manual acceptance remains separate.

Backend intermediate55f6658 on master, scoped commit window closed/index empty. Implementer observes14 targeted and299 total tests/23files plus Typecheck/diffPASS. Actual authenticated handlers, signed synthetic GitHub events and official Agent/fixed intercepted Requesty adapter inspect durable funding at the physical request. Current run context also pins bound idea revision before further steps; edit after send allows safe usage but blocks late idea effects. An initial pagination DTO return-boundary defect was fixed in the actual handler. UI/browser/contract/full build/bundle/existing Dev still pending; first synthetic browser fixture needed its demo Store export, corrected and rerunning. This is an intermediate receipt, not final freeze/SPEC/QUALITY/J03/manual acceptance; no criteria or Done checked.

Final implementer source frozen at ad3fc252e10dd48c56d0e437f1bc1e13b7771f49 (base875069a, backend55f6658), index empty. Actual contract .docs/idea-content-contract.md inventories ideas/ideaVersions/ideaFeedback/contentRequests and official Agent provenance. Implementer reports305 tests/23files,20 targeted, type/lint/build/bundle/diff and affected real browser PASS; existing EU Dev ready18:44:33/4.85s. No provider activation, grants, paid model/private GitHub reads or manual J03 acceptance. Fresh independent SPEC now reviewing entire source and own actual-handler cases; QUALITY follows only after SPEC PASS. Criteria and Done remain unchecked pending verified review evidence.

Independent SPEC PASS at productionad3fc25:53 registered Ideas/allAI plus8 own actual-handler/component checks and actual affected browser. Independent fresh QUALITY PASS at same source:53 registered plus8 separately authored concurrency/replay/account/grant/financial checks and actual browser; no confirmed findings. Full synthetic signed-event to funded proposal to real idea to confirmed actual draft to editable second immutable version verifies J03 code path with Jev off and exact provenance, no approval/schedule. Root .docs/reviews/task-18-idea-content-validation.md separates implementer/reviewer evidence, synthetic transports and live/manual limits. AC1-3 checked for code-only verification; actual J03/provider quality/processing/pricing/manual acceptance and lifecycle/conversation/enrichment remain open. Status stays In Progress and Done requires explicit human confirmation after manual testing.
<!-- SECTION:NOTES:END -->
