---
id: TASK-20
title: 'Research-Profile, Zeitsteuerung und Aufträge bauen (P06.01)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 00:07'
labels:
  - p06
  - r2
milestone: m-2
dependencies:
  - TASK-6
  - TASK-17
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P06.01.
Phase: P06 – Eigenständiger proaktiver Recherche-Agent.

**Abhängigkeit:** P01.03, P05.01. **Dateien:** `convex/research/profiles.ts`, `convex/research/schedules.ts`, `convex/research/runs.ts`, `src/features/research/profile-editor.tsx`; Test `convex/research/schedules.test.ts`.

- Profilfelder aus Abschnitt 6.1 einschließlich Pause, Frequenz und Budget konfigurieren.
- Manuelle, planmäßige und vom Content Agent angeforderte Recherche als denselben Auftragstyp modellieren.
- Überlappende Läufe desselben Profils zusammenführen oder begrenzt in die Warteschlange stellen.
- Nächsten Lauf, letzten Erfolg und verbrauchtes Budget im Produkt sichtbar machen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Entscheidungen (Empfehlungen sind noch keine Freigaben):
- D02: Frequenz und Startbudget nach P00-Messung festlegen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Recherche läuft ohne GitHub-Ereignis.
- [x] #2 Pause verhindert neue Läufe.
- [x] #3 doppelte Scheduler-Aufrufe erzeugen keinen doppelten Auftrag.
- [ ] #4 ein Profilwechsel verändert laufende Jobs nicht rückwirkend.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the actual reviewed TASK16/17/18/19 contracts, Research UI/native code map and formal D02 recurrence rules.
2. Implement durable real profiles and immutable versions, bounded unified orders and native schedule generation/idempotence; keep downstream research unavailable until TASK21/22.
3. Wire real profile/history controls with awaited commands, preserved error/CAS buffers and explicit Demo separation; expose actual configuration and status.
4. Verify current lifecycle/source/budget boundaries, concurrent admission, snapshot independence and saved-IANA DST recurrence with meaningful actual-component/UI checks.
5. Run full checks and scoped master commits, synchronize existing EU Dev, freeze source for fresh SPEC then separate QUALITY.
6. Record code evidence and check only proven criteria; keep integrated research and human/live acceptance separate and status In Progress.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /research — profile/history tabs. Account-scoped research settings, project relevance, topic/audience/language/region/source/exclusion/freshness/count/frequency/budget, pause, mock next/last runs, immutable profile snapshot per local run. Grenze: No scheduled research or external lookup; frequency and next-run display preview configuration only. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only future preparation /tmp/dispatch-research-profile-implementation-brief.md: actual profile/history UI uses local daily2EUR/sample/timer data. Real20 requires immutable profile snapshots, bounded unified manual/scheduled/ContentAgent orders, pause/generation/idempotence and server IANA occurrence state reusing final17 budget/stop authority. D02 activation remains versioned and gated by actual processing/pricing/funded limits; demo values are not measured approved defaults. No20 implementation/AC evidence; downstream21/22 must produce actual research before integratedAC1 acceptance.

Read-only official Workflow runtime preparation /tmp/dispatch-workflow-runtime-current-docs.md: three Context7 commands plus published workflow0.4.8/workpool0.4.13 archives and peer metadata inspected without installation/scripts. Declared peers match current Convex/helpers, but complete joint compilation/through-component runtime still required. Concrete step.runAction retry:false and retryActionsByDefault:false prevent layered paid retries; in-flight Actions can finish after Workflow cancellation, so current domain stop/source/grant fences remain mandatory. Actual published workflow/test helper registers nested workpool and batchWorker; inventory/retention and stable bounded journal IDs are required once mounted. No TASK20 code/activation or acceptance from this preparation.

Root formal D02 initial implementation rule recorded under delegated decisions: real profiles manual-only/inactive schedule with no seeded paid budget; periodic starts require explicit current activation and the same processing/pricing/three-scope coverage as manual orders. Finite user order cap uses actual approved pricing currency, with no fictional EUR conversion or demo-derived quota/start amount; at most one active profile order and exact scheduler occurrence dedupe. This decides initial product behavior, not actual provider activation, measured operating budget or20 code acceptance. Final19/16 shared contracts and root assignment remain prerequisite for implementation.

Read-only explorer actual map complete /tmp/dispatch-research-profile-code-map.md: ResearchPage has no real/Demo split and displays daily2EUR/seed completedrun/sampleInbox although real local setter is unavailable; no actual create/save/delete/timezone controls. Reuse existing workspace/reference/currentactor guards, immutable Ideas CAS/version/operation receipt, native editorial scheduler generation/cancel and IANA time helpers. Proposed minimum3 domain stores with one embedded schedule, immutable profileversions and unifiedorders; names are proposals notschema claims. CurrentVersion change alone mustnotcancel immutable oldrunning snapshot; livepause/stop/role/account/source guards independent. Root delegated recurrence rule nowformal: explicit savedIANA/localclock/weekday; gap skips thatlocaloccurrence, overlap earlierinstantonly, exactUTC+generationdedupe, no automatic missed-period batch and zonechange onlyfuture explicitreplan. No20source/AC acceptance; wait reviewed19 before freshimplementation.

Implementation released after TASK19 final re-SPEC/QUALITY PASS8e5a6b4. Read final .docs/chat-domain-contract.md and /tmp/dispatch-research-profile-code-map.md: actual convo/operation/run authority, immutable source pins and same-operation unknown barriers. Shared generic personal-chat stop now enforces original actor/account before terminal returns and exact-old-run native abort; do not bypass it through arbitrary caller IDs. Root owns metadata; fresh implementer owns minimal durable profiles/immutable versions/unified orders/native scheduler/real profile-history UI and unitcontract. Formal D02 manual-inactive/no seeded budget, finite actual-currency cap and saved-IANA gap-skip/earlier-overlap recurrence apply. Real research remains unavailable until actual21/22; AC1 cannotbecheckedfromblockedorder alone. IndependentSPEC thenQUALITY required; noDone/manual/provideractivation.

Root D02 clarification formalized in domain-contracts: prepared native schedule before researchpipeline mayonly produce visible configuration-blocked callback receipts. Generation prerequisites are NOTnativeX/Web approval. Later adapterdeployment cannot automaticallyactivatepaidsearch; explicit reactivation captures currentnativeprovider/processing/pricing/budgetproof. Blocked oldorders cannotbecome newpaidattempts. Minimal20 localreadonlyeligibilitycheck approved (notreservation/secondledger), existingvalidPolicy+3indexedgrants/currentapprovers/fullcapcoverage reused, actual21paidledgerextension separatelylater. Profileedit/save usefulwithoutprovideractivation.

Fresh SPEC at frozen 6f1d062 reproduced a P2 lost-ACK UI defect in actual React: failed pause/activation/delete closures can become unreachable after reactive profile state changes; a later same-kind toggle replays an obsolete successful receipt without applying current intent. Registered 19 and own 9 native cases pass, but independent browser counterexample is red. Root verified shared command callers; minimal explicit retry/new-command correction assigned to original implementer before re-SPEC. No acceptance criterion checked or Done transition from initial implementation.

Final code source c300fa4 (backend32ed459 / initial6f1d062); independent re-SPEC and fresh QUALITY PASS. Review .docs/reviews/task-20-research-profile-validation.md preserves original P2 lost-ACK browser RED and corrected visible exact-retry/fresh-intent path. Initial implementer387/26 and full checks/codegen/EU Dev20:52:14 remain separate; UI-only correction actual browser/type/lint/build/bundle/diff passed, no backend/Dev rerun. Initial SPEC19+9own backend/browser RED; delta six own actual UI groups+registered browser PASS. QUALITY23 registered+7own native+3own actual UI+registered browser PASS, harness role-render correction explicit. AC2 pause and AC3 exact native occurrence checked as code criteria. AC1 real independent research and full AC4 running downstream research remain unchecked for21/22; immutable queued snapshot proof is not paid running execution. Actual search funding/rights/processing/pricing/invoice/Content-Agent caller/lifecycle/manual gates remain open. No provider/grant activation or Done; In Progress pending explicit manual user confirmation.

AC1 nowSOFTWAREverified byreviewedactual22.2/22.3registered fundednative+model Workflow fixtures withoutGitHub; profiles/schedules/providers/pipeline actualhelpers useaccountwithnoGitHub. No paid/provideractivation/manualclaim. AC4 exactordinarysaveWHILEnative/modelIOunresolved+oldprompt/evidenceprofileVersion notyettested: currentqueued/finishedcasesinsufficient. Read-onlysupplement /tmp/dispatch-research-content-provenance-map.md; keepAC4open pendingmeaningfulactualIOregression inupcomingsourcehandoffintegration. Pause/deletewithdrawal cancels bydesign, ordinarysave retainsimmutableorder. TaskInProgress, noDone.
<!-- SECTION:NOTES:END -->
