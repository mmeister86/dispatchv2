---
id: TASK-15
title: Webhooks und Signal-Ingestion idempotent umsetzen (P04.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-05 15:39'
labels:
  - p04
  - r2
milestone: m-2
dependencies:
  - TASK-14
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P04.02.
Phase: P04 – GitHub und Arbeitssignale.

**Abhängigkeit:** P04.01. **Dateien:** `convex/http.ts`, `convex/integrations/github/webhook.ts`, `convex/content/signals.ts`; Test `convex/integrations/github/webhook.test.ts`.

- Signatur am unveränderten Request-Body prüfen und Eventgröße begrenzen.
- Zustellung zuerst nachvollziehbar erfassen, anschließend Workspace-spezifische Signale verarbeiten.
- Nach dauerhafter Erfassung innerhalb von zehn Sekunden antworten; Anreicherung asynchron ausführen. Fehlgeschlagene GitHub-Zustellungen selbst erkennen und über einen dokumentierten Redelivery-/Abgleichpfad nachholen; automatische Wiederzustellung wird nicht vorausgesetzt.
- Push und Release unterstützen; mehrere erlaubte Workspaces dürfen denselben externen Anlass getrennt verarbeiten.
- Doppelte Zustellung und Wiederaufnahme atomar deduplizieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ein Event erzeugt höchstens ein Signal je berechtigtem Workspace und Ereignis.
- [x] #2 Eine globale External-ID-Prüfung unterdrückt nicht versehentlich andere Mandanten.
- [x] #3 Ungültige Signaturen erzeugen keine Domain-Daten.
- [x] #4 Ein während des Empfängerausfalls gesendeter Push/Release kann nachträglich ohne doppelte Signale verarbeitet werden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Start after TASK14 ad9d395 independent SPEC/QUALITY PASS; read exact current source/generation/credential contracts and primary webhook/revocation/recovery receipts.
2. Verify bounded unchanged raw bytes with native HMAC before writes, discriminate signed event shape, durably store minimal factual receipt and native scheduled processing before fast acknowledgement.
3. Process Push/Release per authorized workspace with source-purpose/proof/actor/lifecycle/generation rechecks, resumable bounded fanout and atomic body/event/tenant dedupe; apply verified revocation barriers.
4. Implement bounded App-JWT failed-delivery detection and explicit selected-source recovery with truthful cursor/window/gaps/cooldown and accepted-versus-processed status.
5. Wire actual paged factual Signals and recovery/configuration, keeping AI and idea handoff unavailable until reviewed17/18; no invented scores or demo outcomes in real UI.
6. Validate exact signatures/replays/header reinterpretation/foreign or disabled sources/multiple tenants/interrupted processing/receiver outage redelivery and affected actual UI; full checks, existingEUDev, native inventory/scoped commits/freeze then fresh SPEC and QUALITY/fix/re-review. No live provider or automaticDone.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-only preparation while TASK12.3 active; no implementation. Current official Context7 library-first /github/docs plus2docs (3commands/noquota), independently verified primary guides in /tmp/dispatch-github-webhook-current-docs.md. Raw-byte SHA256 HMAC/fast10sec2xx afterdurable receipt; GUID stable acrossredelivery; no automaticredelivery; App-global JWT-only delivery endpoints cursor<=100 and202redelivery notcompletion. Body-only signature means headers alone are not authenticated event/tenant proof; signed-body identity and per-workspace dedupe required. Missing privatekey/webhooksecret remains visibleguidance; actual TASK14 interfaces supplied afterreviews.

Weitere Read-only-Prep während TASK14: Context7 library-first offizielles /github/docs plus docs (zwei Befehle/keine Quota), direkt aktuelle GitHub- und Octokit-Payload-Verträge geprüft. Receipt /tmp/dispatch-github-revocation-webhook-current-docs.md: github_app_authorization.revoked hat sender ohne installation und beendet User-Zugriff, nicht Deinstallation; volle Installation enthält app_id/IDs, Aktionen deleted/suspend/unsuspend/new_permissions_accepted. Repository-Auswahl all→selected kann leere removed-Arrays liefern: vorhandene breite Proofs dann konservativ invalidieren und konkret resyncen; added/unsuspend erteilt keine lokale Purpose-Aktivierung. Signierter Body plus diskriminative Form/Digest schützt vor Header-/GUID-Replay, sender/ghost ist keine Human-Autorität. Native WebCrypto auf unveränderten begrenzten Bytes; tatsächliche14-Gates werden nach Freeze übernommen. Keine Implementierung/Provider-/Webhook-/manuelle Abnahme.

Implementation assigned following final TASK14 ad9d395 SPEC/QUALITY PASS; root closing metadata fc87b6d. Full brief /tmp/dispatch-github-signal-implementation-brief.md and current webhook/revocation/recovery primary docs required. Missing App-privatekey/webhooksecret stays visible per user answer. Implement actual typed factual-ingestion/recovery paths with synthetic effects only; no actual authenticated provider/redelivery/model request. New fresh worker, independent SPEC then QUALITY, no BacklogDone.

Resolved security occurrence ambiguity with implementer: App-user revoked body has no signed eventID/time; a genuine repeat after fresh OAuth can have identical bytes/HMAC with new unsigned GUID. Permanent body-only suppression would miss the real revoke. Chosen conservative policy: knownGUID idempotent, newGUID/sameSecurityBody new monotonicFence plus visible unclear/resync, so freshproof may close again; no perfect replay/DoS immunity claim. Push/Release body+signedoccasion dedupe unchanged. Required freshgrant→secondidenticalbody revoke regression and documented ceiling; no extra providerlookup framework/actualcall.

Implementation scope clarification: a fresh explicit Owner/Admin local recovery command may consume an already durable signed receipt after renewed current source proof, with exact source generation, actor/lifecycle/purpose and observed provider/installation/repository/privacy checks. It does not rebind old background work automatically, invent original timestamps, send another provider POST or reset cumulative GUID attempt/cooldown limits. Known delivery-GUID repeats remain idempotent; indistinguishable new-GUID security occurrences conservatively close authority again. Independent reviews verify these boundaries after source freeze. No live/manual acceptance or Done.

Implementer frozen on master05ebfd8 (backend22f4f70), commit window closed/index empty. 246 registered checks/20 files PASS, 26 new TASK15 checks15webhook+11recovery; type/lint/build/bundle/diff PASS. Actual affected Chrome/React fixture completed17:22:17 CEST; existing EU Dev officially activated17:22:59 CEST. Separate tenant signals, immediate monotone barriers, global GUID cooldown/max3 and explicit local admission with current source authority verified synthetically. Fresh independent SPEC started; QUALITY follows acceptance. Review .docs/reviews/task-15-github-signal-validation.md; no live/manual/provider/privacy acceptance or Done.

Independent SPEC reproduced a required correction at05ebfd8: disable monitoring generation2, accept signed Push202, enable generation3 with identical Date.now, actual automatic processor produces a signal despite later purpose grant. Wallclock equality must not grant retroactive automatic authority; explicit authorized local recovery remains separate. Independent deadline negatives still being completed. Acceptance criteria remain unchecked until correction/re-review; no manual/provider acceptance or Done.

Initial independent SPEC verdict NEEDS WORK: one P2 same-millisecond purpose-admission defect. 26 existing checks PASS, six own negatives fivePASS/oneFAIL; real native Fetch stalled-body abort at15sec PASS/no deadline finding. Reproduction /tmp/dispatch-github-signals-spec-negative.test.ts, receipt /tmp/dispatch-github-signals-spec-receipt.md. Fresh focused correction implementer github_signals_fix assigned; automatic admission needs monotone proven ordering, current explicit local recovery/timestamps remain. Independent browser and final SPEC/QUALITY pending. No AC/Done/live claim.

Focused correction frozen1706c05: concrete singleton admission counter, optional receipt/source order, actualeventKey index retaining first admission across semantic reserialization; both purposewriters/common automaticguard. No clock-based ordering, securitysequence remains separate, unknownlegacy requires explicit currentlocalrecovery. 32TASK15/252full checks PASS, fulltype/lint/build/bundle/diff/codegen. ActualReactfixture unknownorderguidance PASS, observed completion17:31:48–approx17:31:55; existingEUDev ready17:31:48. Fresh independentSPEC re-review github_signals_spec_delta underway; QUALITY still gated. No AC/Done/liveclaim.

Final independent SPEC PASS1706c05:49/49 checks=32registeredTASK15+17ownnegatives/delta; savedmillisecondrepro, rollback/semanticcopies/bothwriters/positive2tenant/legacyexplicit/currentauthority PASS. OwnactualReactfixture PASS unknownorderguidance/currentlocalrecovery/pending/provenance/idleexpiry/lateworkspacecleanup; temporaryrepo files/5174closed, user5173retained. Receipt /tmp/dispatch-github-signals-spec-delta-receipt.md. Fresh independentQUALITY github_signals_quality nowstarted; no finalAC/live/manual/Done claim.

Final isolated code acceptance at1706c05: independentSPEC49+ownactualReactPASS and freshQUALITY40(32registered+8own)PASS/nofindings. QUALITY17:38:09 actual beforecleanupdeleted/suspend barrier31tenantfanout, userrevokerefreshfence, delayedcurrentauth andscanlease/header negatives. All4AC checked ONLY synthetic actualHTTP/domain/interceptedrecovery code evidence; realGitHubregistration/signature/wire/outage/redelivery/retention/privacy/manual gates remain open. Review .docs/reviews/task-15-github-signal-validation.md, domain actualinventory includes seventh nativegithubAdmissionOrder plus optionalorderfields/eventindex. Status InProgress, noDone. Next17boundedmodels then18content precede16enrichment.
<!-- SECTION:NOTES:END -->
