---
id: TASK-32
title: Benachrichtigungen zuverlässig und konfigurierbar machen (P09.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-08 05:30'
labels:
  - p09
  - r3
milestone: m-3
dependencies:
  - TASK-5
  - TASK-13
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P09.02.
Phase: P09 – Sicherheit, Datenschutz, Betrieb und Produktqualität.

**Abhängigkeit:** P01.02, P03.04. **Dateien:** `convex/email/resend.ts`, `convex/operations/notifications.ts`, `src/features/settings/notifications.tsx`; Test `convex/operations/notifications.test.ts`.

- Verifikation, Reset, Reauth und fehlgeschlagenes Publishing über einen nachvollziehbaren Versandprozess behandeln.
- E-Mail und In-App-Hinweise dauerhaft in Dispatch deduplizieren und Häufungen zusammenfassen. Transiente API-/Transportfehler begrenzt wiederholen; permanente Bounces, Beschwerden und gesperrte Empfänger gesondert behandeln. Provider-Annahme, Versand und tatsächliche Zustellung unterscheiden.
- Freiwillige Wochenzusammenfassung, Research-Zusammenfassung und Ruhezeiten ergänzen.
- Kontorelevante Nachrichten von optionalen Zusammenfassungen und Marketing trennen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 E-Mail-Ausfall rollt keinen fachlich erfolgreichen Vorgang zurück.
- [ ] #2 Ein mehrfach fehlgeschlagener Job erzeugt keine unkontrollierte Nachrichtenflut.
- [ ] #3 Nutzerpräferenzen werden bei jedem Versand geprüft.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: Global notification drawer, /settings/notifications. Local in-app issues/read state; email/in-app, weekly/research summary preferences and quiet times. Grenze: No emails, bounces, provider delivery lifecycle or executed quiet-time rules. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root hat /tmp/dispatch-continuation-31-32-seams.md gelesen: reale publishingNotifications+Resendnotify existieren mit perRowIdempotencyKey/generischemCalendarBody, sent bedeutetnurHTTPaccepted—not delivered. KeinNativePrefs/Read/Dismiss/OccurrenceDedupe/DeadlineLease; workspaceResourceszeigtcurrentlylatest50allRecipientMetadata. MinimalnativeSelfPrefs/currentRecipientQuery+readDismiss/exactOccurrence first, optionalboundedquietSummary danach, bestehendenEmailtransportnuractualConfig/HumanPrefs/currentMember/Lifecycle/ParentProof hardenen; unknownAcceptance nichtautomatischresenden. Authreset/verification separateRequestedTransaction; keineactualMailaufrufe/ProviderConfig/SDK/NeuerChannel. IntroducedProtectedCopiesMask/Purge vorProducer, whole33/36manualoffen. AktuellerReportread-only keinefreshTests.

Rootcontract .docs/operations-notifications-contract.md konkretisiert sequenziell SelfPreferences+RecipientInApp, finiteOptInSummary/IANAquiet, dann bestehendeResendHärtung mit echten offiziellenProviderReceipts. Legacy sent=HTTPaccepted weder delivered noch read; scheduleBoundRows nicht alsGenericNotification missbrauchen. CurrentRecipient/pref/lifecycle/domain/privateActor vorcallback/send, sourcecopyindexedphysicalCleanup vorProducer. MissingConfigsichtbar, keineActualEmail/Provideraktivierung/zweiterService;32Source/Test/ManualDone weiterhin offen.

Read-only future reconciliation adopted: .docs/reviews/task-31-32-35-current-native-reconciliation.md. Existing preferences can host self opt-in; absent opt-in remains OFF. Actual convex/http.ts contains Auth/GitHub only: signed mail-provider callbacks are NOT implemented. Future current official provider receipt protocol/configuration and native recipient/parent replay/lifecycle proofs remain required. Earlier signed-callback references describe planned work only. No source release/test acceptance; all ACs remain open.

2026-10-07 ROOT: Aktuelle Benachrichtigungs-Vorbereitung als PROPOSAL_ONLY übernommen: .docs/reviews/task-32-current-native-notifications-source-plan.md (SHA256 f4ec92a58cad2c2b9d2a899ff31fce031e63445fd475485db912bf747ddb8c2c). Vollständiger Bericht in getrennten Bereichen nach anfänglich abgeschnittenem Display gelesen; semantische Receipt-Projektion, danach tatsächlicher CLI-Beschreibung/AC/DoD/Notes-Bereich und Discovery-Qualifikationen. Root-Proof /tmp/dispatch-32-current-native-notifications-source-plan-root-verification.json hält den davor gültigen CLI-Read-False-Zeitpunkt unverändert fest. 314 originale fremde Nicht-Generated-Dateien, 8 Inputs, 4 später gestartete Inputs und 12 private Artefakte verifiziert; 31 qualifizierte Lese-Scopes, Schema beweglich. Archivmetadaten verifiziert, nicht alle archivierten Source-Bodys von Root vollständig gelesen. Konkreter kleinster erster Schritt: Viewer-fähige eigene Preferences und explizite users.current-Profilprojektion, danach generationgebundene Publishing-Episoden im bestehenden Inbox. Native Opt-ins fehlen/OFF; ursprüngliche finite Claims/Zeitzonen/Source-Purges vor optionalen Sendungen. Auth-Mail besitzt noch keine belegte dauerhafte ursprüngliche Bindung; neue Callback-Protokolle erst nach aktuellen offiziellen Docs und tatsächlicher Konfiguration. Keine Tests, Provider/Browser/SDK-Aufrufe oder Abnahme. Source erst nach TASK-31 und finaler TASK-68-Reconciliation; alle AC/DoD und manuelles Done offen.

2026-10-07 ROOT: Begrenzter Auth-Mail-Ownership-Abgleich als weiterer PROPOSAL_ONLY übernommen: .docs/reviews/task-32-auth-mail-owner-reconciliation.md SHA256 a079e749de683e6e67aa05987f144d77a7d71b5f15f13c3ffbaaca4c5b322b39; Root-Proof /tmp/dispatch-32-auth-mail-owner-reconciliation-root-verification.json SHA798a0151502b91f1bbbe18ec301ed27a4b3902be647432feae050c4d1f726a42. Vollständiger Bericht/semantische Receipt-Projektion, 314 geschützte Nicht-Generated-Pfade, 7 Inputs, 2 Artefakte und 14 qualifizierte Lese-Scope-Metadaten verifiziert. Nicht alle archivierten API-/Producer-Bodies unabhängig Root-gelesen. Installiertes Convex-BetterAuth0.12.5 und Core-BetterAuth1.6.33 getrennt; letzteres zusätzlich aktuell per Package-Metadaten beobachtet, keine rückwirkende Guard-Attestierung. Verifikations-JWT besitzt keinen dokumentierten Verification-Row-Mailowner; Reset-Beleg wird konsumiert und ist kein dauerhafter Effektreceipt. Auth User/Session-Schemata haben keine zulässigen Mailclaims. Eine kleine Auth-spezifische Receipt-Familie ist vorgeschlagen, ohne generisches Journal/private Component-Writes/Workspace-Fiktion. Preauth kann ohne Requester-Session erfolgen; auth.session.id bleibt User-ID. Tatsächliche neue öffentliche API-/Provider-Protokollnutzung erst nach aktuellen Context7-Docs/Producer- und Lifecycle-Reconciliation. Keine Tokens, privaten Daten, Provider, Tests oder Zustell-/Abnahmebehauptung; alle AC/DoD bleiben offen.

TASK32.4 technisch geliefert in0bdd9e4:1506/61 native,211 styled Browser, unabhängige Reviews, exaktesEUDev468. Eigene Publishing-Fehler im bestehenden Drawer; Quelle/Empfänger vor read/dismiss, fortsetzbare private Präsentationsbereinigung bei erhaltenen Transportbelegen. Manuelle Abnahme und größere Zusammenfassungs-/Ruhezeiten-/Mail-Verträge bleiben offen.
<!-- SECTION:NOTES:END -->
