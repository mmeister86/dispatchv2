---
id: TASK-32
title: Benachrichtigungen zuverlässig und konfigurierbar machen (P09.02)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 16:04'
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
<!-- SECTION:NOTES:END -->
