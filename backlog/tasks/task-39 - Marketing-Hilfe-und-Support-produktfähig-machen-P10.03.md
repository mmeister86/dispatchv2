---
id: TASK-39
title: 'Marketing, Hilfe und Support produktfähig machen (P10.03)'
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-07 13:37'
labels:
  - p10
  - r4
milestone: m-4
dependencies:
  - TASK-35
  - TASK-37
  - TASK-38
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
priority: medium
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P10.03.
Phase: P10 – Kommerzielles SaaS und öffentliche Veröffentlichung.

**Abhängigkeit:** P09.05, P10.01; vollständige Abnahme zusätzlich nach P10.02. **Dateien:** öffentliche Seiten unter `src/routes/`, `src/features/help/`, `.docs/runbooks/support.md`.

- Produktseite, Nutzenbeispiele, Preise, Onboarding-Hilfe und häufige Fehlerfälle erstellen.
- Rechercheumfang, Freigabekontrolle und heuristische Scores realistisch beschreiben.
- Datenschutz-/Vertragsinformationen, verantwortliche Betreiberinformationen und notwendige Einwilligungswege fachlich prüfen lassen.
- Supportablauf mit minimalem Datenzugriff, nachvollziehbaren Zugriffsfreigaben und Eskalation etablieren.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein neuer Nutzer kann sich ohne Entwicklerhilfe registrieren, bezahlen, X verbinden, ersten Content planen, Kosten verstehen und kündigen.
- [ ] #2 Support benötigt keinen pauschalen Zugriff auf alle privaten Inhalte.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /welcome, /help, /legal, /team. Public benefits/example prices, registration links, help/error guidance, clearly provisional legal/demo notes, scoped time-limited support consent. Grenze: No reviewed legal contract/operator certification or actual support access. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root readonly current preparation /tmp/dispatch-39-current-native-source-plan.md (SHA b34526efb459dd78ea860d62c60942d308416fc572f6ac90dba2f84365c55621). Actual public route/store ranges reveal cloud Help rejects local persistence then sets sent=true, cloud onboarding X step still says unavailable despite existing native SocialAccounts, and Landing/FAQ/Legal retain stale demo/native descriptions. Public Help has no authenticated workspace context; no native support bypass/grant exists,24h switch is DemoTeam only. Smallest later path: reuse existing native OAuth/profile/billing/status routes, honest configured contact with voluntarily shared minimal diagnostics/runbook, no default demo prices/operator/legal certification or broad content access. Report has precise full/range read scopes and after-read baseline hash verification only; no fresh tests/source release/config/support delivery/manual acceptance. Reconcile final31–38 contracts before implementation; allAC/DoD remain open.

Correction to readonly preparation: additional actual store335–425 confirms public cloud emptyContext.role=Viewer, so Help submit is currently disabled/returns before mutation; no reachable false-ACK was reproduced. Actual gap is unavailable cloud support. Setter rejection followed by sent=true is only a latent branch if future Help gains real nonViewer context. Corrected authoritative proposal /tmp/dispatch-39-current-native-source-plan-correction.md SHA aacb0bbadb7523bbe7d1ac43ae1217051c06e5581b2a8bd6b87b3d721542414a supersedes overly strong initial claim; original report/receipt preserved. No source/tests/browser/support delivery acceptance. All AC/DoD remain open.
<!-- SECTION:NOTES:END -->
