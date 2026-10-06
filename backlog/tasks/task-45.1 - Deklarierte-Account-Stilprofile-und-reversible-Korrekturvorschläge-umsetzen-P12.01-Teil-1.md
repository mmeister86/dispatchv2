---
id: TASK-45.1
title: >-
  Deklarierte Account-Stilprofile und reversible Korrekturvorschläge umsetzen
  (P12.01, Teil 1)
status: In Progress
assignee: []
created_date: '2026-10-06 14:00'
updated_date: '2026-10-06 20:14'
labels: []
dependencies: []
references:
  - .docs/style-profile-contract.md
parent_task_id: TASK-45
priority: medium
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Erstes natives Teilpaket gemäß .docs/style-profile-contract.md: accountweite ausdrückliche Autor-/Erfahrungsdeklaration getrennt von gewünschtem Ton, versionierte Säulen/Beispiele/Verbote, exakte menschliche Feedback-Korrekturvorschläge, explizite Auswahl/Reset/Rollback und vollständige eingeführte Quellen-Cleanup-Kante. Noch kein Generator-Verbraucher oder automatisches Lernen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Validierte immutable Account-Versionen trennen Nutzer-Erfahrungsbehauptungen, Ton und Beispiele; kein Demo-/Präferenzimport und keine gelernte Biografie.
- [x] #2 Aktuelle Rollen/Scope, CAS, exaktes Replay, explizite Auswahl und gültiger historischer Rollback/Reset sind nativ geprüft.
- [x] #3 Reversible menschliche Vorschläge binden tatsächliche Feedback-/Draft-Versionen, erklären Änderungen und bewahren Quellenfristen; Verlust maskiert und entfernt eingeführte geschützte Kopien ohne Finanz-/Publishing-Verlust.
- [x] #4 Reale Settings-Oberfläche, Desktop/390px/Demo und frische SPEC/QUALITY nach Source-Freeze sind dokumentiert; manuelle Abnahme bleibt offen.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve native RED evidence and original security/authority/lifecycle invariants.
2. Replace aggregate protected reads with 25-row audit catalogs and exact per-root detail queries in actual Settings.
3. Add one exact typed proof-loss guard at actual shared callers; rethrow unknown/resource failures; bound maintenance proof callbacks to one indexed target.
4. Verify all original semantics plus disjoint/mixed native limits, committed-state safety, source-loss drain, styled desktop/mobile and wider checks.
5. Freeze, fresh independent SPEC then distinct QUALITY; root commits and validates exact accepted source in existing EU Dev.
6. Keep In Progress pending explicit manual acceptance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Vor Writerstart vorhandene TASK48-Account-/Feedback-Korrekturen abwarten: .docs/multi-account-continuation-contract.md. Bestehende A→B-Reassignment-Feedbackzeilen müssen als Mischereignisse ausgeschieden werden; echte Editor-/Approval-/Publishing-Linie bleibt erhalten. Zusätzlich im Style-Proposal weiter exact before/result gleicheAccount/Draft/Workspace prüfen; kein falsches unabhängiges Lernsignal aus Accountwechsel.

Read-only47-Folgeaudit vonRoot vollständig gelesen: contentFeedback record/list/sweep/purge beweist bislang nur before-Version.45.1s Feedback-Korrekturvorschläge müssen beide exakten before/resultVersion-Quellen samt workspace/draft/account und Minimum original/current horizons beweisen;48-Attributionsfix allein reicht nicht für resulting-source withdrawal. Ergebnisabhängige physical cleanup/index ist vor einem neuen Feedbackconsumer nötig, nicht erst bei47. Keine kopierten Texte oder Identitätsbehauptungen aus editExtent.

Root ownsourceTrace draftResearchProof→ideaProofUntil/currentIdeaSource erwiesauchGithubSignal/ContextAncestors trotzHelperName. Stylefeedback/Examples müssen diese echtenCurrentProofs+OriginalHorizons binden; neu eingeführteStyleDerivatives physischmask/removen vorConsumer, bestehendeGithubBaseContext-ErasureDeferral33 nichtalspermissionübernehmen. .docs/style-profile-contract.md präzisiert; read-only33/36Report separatgelesen, keine45SourceImplementation.

Writerstart freigegeben erst nach vollständig akzeptiertem TASK48source d5cb59235ee8f023d570cd4b3056fc8db5e9b7f2 samt RootEUDev2026-10-06T15:56:25Z. Root las vollständige read-only preparation /tmp/dispatch-continuation-45.1-preparation.md; keine blockierende Scope-Frage. SoleSourceWriter; vorhandene selectedVersionId/selectedBy/selectionReceiptId bleiben bei unselektiertem Save/Proposal/Reject stabil, commandRevision ist kein Selector-Beleg. Vollständige bilateralFeedback-/neueGithubStyleDerivate-Cleanup vorConsumer; bestehendeGithubBaseErase33 bleibt ausdrücklich separat. Root besitzt Metadaten/Commit/Dev; nach Freeze SPEC→QUALITY.

Root las tatsächliche initial4RED-Logs:2missingStyleModule(expectednewfeature),2realeSharedFeedbackLücken(resultPurge/nullHorizonSweep). Writer meldet initialSharedCasesGREEN und15currentnativePASS inkl signedGithub→Idea→Draft→Feedback und56-copyContinuation/financeParentRetention, nochkeinFreeze/reviewAcceptance. Root explizit retirementdistinction .docs/style-profile-contract.md: retained-sourceHistory(v1+copiedv2) bleibt bei ordinaryv1Retire physisch erhalten, eligibleCurrentAncestry(v2) select/copy/propose/rollback denied; source/expiry/currentAuthorityLoss separat erasure. Writer ergänzt tatsächlichenNativeCase; Reports bisfinalFreeze vorläufig.

Root hat initialen Freeze (10 Source/55 Kontext/67 Artefakte), SPEC22/2 und distinct QUALITY samt32 Artefakten vollständig geprüft. QUALITY FAIL: P1 native history spread liefert pageStatus/splitCursor außerhalb des strikten Response-Vertrags; P2 gespeicherte Vorschläge zeigen nur Ton/Positionierung, nicht tatsächlich mitübernommene Säulen/Gewichte/Beispiele/Verbote, gespeicherte Versionen ebenfalls unvollständig. Reale native/gestylte Reproducer erhalten. SoleWriter gezielt für explizite Pagination-Projektion und vollständigen gespeicherten Vorher/Vorschlag-Vergleich plus native/Browser-Regression freigegeben; anschließend neuer Freeze und frische SPEC→distinctQUALITY. Alte Belege werden unverändert aufbewahrt. Kein45.2Consumer, keine Commit/Dev/manuelleDone-Freigabe durch diesen Zwischenstand.

Root hat corrected SPEC PASS24/2 samt28 Artefakten und corrected QUALITY FAIL26/2 (23PASS3FAIL) samt26 Artefakten vollständig gelesen/hash-verifiziert. Neuer P1: gültige32-Knoten-Linien bei history25/get25+ältererAuswahl überschreiten native4096Queries; ordinary/23990Byte/15AcceptedEdges drei Varianten eines Befunds, Quellen bleiben tatsächlich gültig. Bytes16MiB war nicht der zuerst scheiternde Grenzwert. Alte P1/P2 fixes nativ bestätigt; corrected QUALITY Zusatz-UI blieb nach Chrome-Kontextverlust unvollständig, kein vollständigerPASS behauptet.65Source/Context+49Artifacts und255OriginalPreservation unverändert. Root las MinimalChange-Vorbereitung /tmp/dispatch-continuation-45.1-limits-preparation.md und thaut allein styleProfiles.ts/.test.ts für Query-lokale Reads/Autorität/exakteFeedbackEvidence; proRoot32/eligible/retained/cycle sowie uncachedMutations/Sweeps erhalten. Anschließend neuerFreeze/frischeSPEC→distinctQUALITY, keine45.2/Commit/Dev/Done-Freigabe aus diesemFAIL.

Root verified disjoint SPEC manifest:16 artifacts+12 references unchanged. Registered 26 independent32-node roots with23990-byte bodies expose aggregate16MiB failure despite repeated-read memoization (all9 prior checks898/48 qualified PASS). Native maintenance RED additionally commits8 false command reason scrubs after ordinary resourceError while versions phase rolls back; only test fixtures, no45.1Dev deployment. Root selects minimal B: lightweight audit catalog plus exact protected detail queries, unchanged public25/ancestry32/full-body authority proofs; bounded one-target proof maintenance and shared exact semantic-error guard at actual callers including feedback/contentProof/currentEvidence reviewer translation. Sole writer release follows; previous reports/frozen evidence remain immutable.

Fortsetzung im Chat 01a1129d-4c93-7a42-b04c-e870c8d05b62: ursprünglicher Chat und SPEC-B-Bericht gelesen; alle 16 Source- und 50 Kontext-Hashes unverändert bestätigt. Frischer unabhängiger QUALITY-Review läuft; keine erneute Ausführung der bereits geprüften großen Drain-Fixtures ohne neuen Fehler. Branch codex/backend-style-continuation. TASK45.2 bis QUALITY-Freigabe nur lesend vorbereitet; manuelle Abnahme bleibt offen.

Frische Fortsetzungsprüfungen: App/Backend-TypeScript, scoped Prettier, git diff --check, Vite Build und unveränderte Secret-Bundle-Assertions bestanden (installierte Node-Entrypoints). QUALITY: 51 gezielte native Tests und echte gestylte Settings-Browserprüfung bestanden. Unveränderter Scheduler-Test hat Fake-Clock-Race; temporäre Kopie mit kontrolliertem Zeitfortschritt erfüllt alle Originalassertions. Maintained Harness-Korrektur folgt in45.2; keine Produktänderung am Publishing. Abschlussstatus bleibt In Progress; manuelle Abnahme offen.

Frischer QUALITY-Bericht /tmp/dispatch-continuation-45.1-resume-quality.md: PASS im betroffenen eingefrorenen45.1Software-Scope, 51nativePASS/20bewusstgefiltert und echteDesktop390/DemoBrowserPASS. Alle16Source/50Kontext/160Artefakte live+copy unverändert. Vorheriger unabhängigerSPEC-B vollständig gelesen. Separater unveränderterSchedulerFixture-Befund ausdrücklich qualifiziert; kontrollierte temporäre Kopie besteht Originalassertions, nicht all-native-green behauptet. Technische Softwareprüfung akzeptiert; Commit/EUDev folgt, manueller Done bleibt offen.

Software gesichert in Commit f13f3f8 auf codex/backend-style-continuation. Versuch des vorhandenen EU-Dev-Deployments wurde vom automatischen Approval-Reviewer abgelehnt: fehlende explizite Autorisierung für die gemeinsame Remote-Umgebung. Kein Deployment ausgeführt. Technische45.1Softwarefreigabe liegt vor;45.2kann lokal umgesetzt/getestet werden. Remote-Bereitstellung bleibt bis Nutzerfreigabe offen.

Integrierter finaler 45.1/45.2-Source auf master als e54ea78 bereitgestellt: erfolgreicher exakter EU-Dev-Sync accurate-lion-749 nach neuer automatischer Prüfung der inzwischen direkt belegten ursprünglichen Nutzerautorisation. Alle 928 nativen Tests, unabhängiger SPEC/QUALITY und tatsächliche Browser bestehen; remote API-Metadaten bestätigt. Frühere Ablehnung bleibt als nicht ausgeführter Versuch dokumentiert. Details .docs/reviews/task-45.2-style-generator-validation.md. Status weiterhin In Progress bis ausdrücklicher manueller Abnahme.
<!-- SECTION:NOTES:END -->
