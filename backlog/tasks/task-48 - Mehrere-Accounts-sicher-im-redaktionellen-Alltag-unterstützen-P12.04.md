---
id: TASK-48
title: Mehrere Accounts sicher im redaktionellen Alltag unterstützen (P12.04)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-06 14:22'
labels:
  - p12
  - r5
milestone: m-5
dependencies:
  - TASK-10
  - TASK-25
  - TASK-37
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P12.04.
Phase: P12 – Persönliche Stimme, strategische Planung und kontinuierliche Verbesserung.

**Abhängigkeit:** P03.01, P07, P10-Entitlements. **Dateien:** `src/features/settings/account-manager.tsx`, `src/features/drafts/account-selector.tsx`, `convex/planning/accountScope.ts`; Test `tests/e2e/multiple-accounts.spec.ts`.

- Mehrere zulässige Accounts desselben Providers mit eigenen Profilen, Research-Einstellungen, Kalendern und Kontingenten verwalten.
- Den aktiven Account in Chat, Composer, Research Inbox und Freigabedialog dauerhaft erkennbar machen.
- Accountwechsel in einem Entwurf als bewusste neue Zuordnung behandeln; Freigaben und Analysen nicht ungeprüft übertragen.
- Einen Account trennen, ohne andere Accounts oder deren laufende Planungen zu unterbrechen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Nutzer kann zwei X-Accounts bedienen, ohne Inhalte oder Freigaben zu verwechseln.
- [ ] #2 Ein expliziter Accountwechsel aktualisiert Kontext und Berechtigungsprüfung.
- [ ] #3 automatische Wiederverwendung fremder Account-Historie findet nicht statt.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Nach frischem44SPEC/QUALITY kleine vorhandene Account-Seams gemäß .docs/multi-account-continuation-contract.md vor45 korrigieren; soleSourceWriter.
2. Globalen/Chat-Account vereinheitlichen, leere Auswahl und konkrete Aktion-/Frozen-Snapshot-Ziele korrekt anzeigen.
3. Disconnect-A auf seinen pendingReconnect begrenzen bei Erhalt bekannter B-Reconnects und bestehender genericIdentity-Fences.
4. SharedFeedback überspringt Cross-Account-Edit bei legitimer A→B-Zuordnung; alte Mischereignisse im Reader maskieren, gleicheAccount/Accept/Reject unverändert.
5. Zwei-X-native/Auth/Budget/Cache/Approval/FrozenScheduler-Negativtests und echte styledDesktop/390px/Demo-Browser, Full/Typen/Format/Lint/Build/Bundle/Codegen/exaktesEUDev.
6. Source-Freeze, frisches SPEC dann separate QUALITY, RootCommit. TASK37 kommerzielleEntitlements/actualOAuth/live/manualDone bleiben getrennt offen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: Global account selector, /settings/integrations, /agent, /research, /drafts/:id. Multiple mock accounts, visible context, explicit composer reassignment and renewed review; account-scoped research/chat and independent disconnect. Grenze: No real multi-account OAuth or provider quota isolation. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Read-only48Explorer /tmp/dispatch-continuation-48-seams.md vonRoot gelesen. Tatsächliche Gap: RealAgentChat hält nochglobalgültigesA trotz HeaderwechselB; andere Konfiguration zeigtB. OAuthdisconnectA löscht alle pendingStates desselben Initiators, kann bekanntenReconnectB zerstören. ManualA→B erstellt korrekt neuesVersionB; alter freigegebener geplanter A-Snapshot bleibt ausdrücklich ausführbar, nicht nurHistorie—Warnung muss echteZiele nennen, kein implizitesCancel. SharedFeedback record/list zählt MixedA→B editExtent alsA (keineBTextOffenlegung), minimalWriterSkip ohneThrow und LegacyReaderProof erforderlich, damit45/47 nichts falschableiten. Diese vorhandenenSeamKorrekturen werden nach44 vor45 gezogen; keinneuerAccountapparat/EntitlementPermission.100rowcap istkeinP10Tarif; vollekommerzielleZulässigkeit bleibt37-abhängig.
<!-- SECTION:NOTES:END -->
