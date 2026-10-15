---
id: TASK-52
title: Provider-Vertrag aus bewährtem X-Verhalten herauslösen (P14.01)
status: In Progress
assignee: []
created_date: '2026-09-16 20:12'
updated_date: '2026-10-07 13:41'
labels:
  - p14
  - r7
  - jev
milestone: m-7
dependencies:
  - TASK-40
  - TASK-41
references:
  - .docs/dispatch-end-to-end-implementation-plan.md
  - .docs/JEV_INTEGRATION.md
priority: medium
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planreferenz: .docs/dispatch-end-to-end-implementation-plan.md, P14.01.
Phase: P14 – Multi-Channel Publishing und plattformspezifische Intelligence.

**Abhängigkeit:** stabiles P10, P11-Metrikvertrag. **Dateien:** `convex/integrations/providerContract.ts`, `convex/content/packages.ts`, `convex/content/variants.ts`, `convex/publishing/providerRegistry.ts`; Test `convex/integrations/providerContract.test.ts`.

- Fähigkeiten für Auth, Formate, Textgrenzen, Medien, Threads, Planung, Messwerte und Löschung explizit modellieren.
- Eine gemeinsame Idee mit getrennten Plattform-Drafts, Versionen, Freigaben und Terminen verbinden.
- X auf den Vertrag umstellen, ohne funktionierendes Publishing oder gespeicherte externe IDs zu verlieren.
- Nicht unterstützte Features früh in der UI und Domain-Validierung kenntlich machen.

Voraussetzung: Der betroffene Umfang und offene Entscheidungen müssen vor Beginn freigegeben sein. Diese Aufgabe dokumentiert geplante Arbeit; ihre Erstellung ist keine Implementierungsfreigabe.

Modulübergreifende Pflicht: Neue Daten und Jobs in Tenant-/Account-Prüfung, Dateninventar, Export, Löschung, Retention, Kostenmessung und Deployment/Recovery aufnehmen (Plan §§12/15).

### JEV-Abgleich vom 18.09.2026

Publishing-Adapter und Jev-Entscheidungsadapter bleiben getrennte Grenzen. Plattformlängen, Fähigkeiten und Medienrestriktionen deterministisch validieren; semantische Network-Fit-Werte können diese harten Regeln nicht überstimmen. LinkedIn/Bluesky aus dem Leitfaden sind keine zusätzliche Integrationsfreigabe: TASK-53.1 wählt weiterhin genau einen zusätzlichen Kanal, weitere Kanäle über TASK-55.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ein Adapter kann eine Fähigkeit ausdrücklich nicht anbieten.
- [ ] #2 Ein Fehler auf Kanal A verändert keinen erfolgreichen Status auf Kanal B.
- [ ] #3 Semantische Empfehlungen können keine fehlende Publishing-Capability oder verletzte deterministische Providergrenze freigeben.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevante automatisierte Prüfungen und manuelle Abnahme sind im Task dokumentiert.
- [ ] #2 Der Nutzer hat nach manueller Prüfung ausdrücklich bestätigt, dass dieser Task auf Done gesetzt werden darf.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-69: UI-Anteil als interaktive shadcn/React-Mock-Oberfläche auf master umgesetzt. Ansichten: /drafts/:id, /settings/integrations, /calendar. Linked content packages with separately editable channel drafts, versions, approvals and schedules; channel text limits and separate states. Grenze: No backend provider contract/registry; capability numbers are illustrative local validation, not access-tested platform promises. Nachweise und manuelle Prüffälle: .docs/ui-backlog-coverage.md und .docs/reviews/task-69-ui-validation.md. Kein echter Provider-/Recherche-/KI-/Publishing-Betrieb; gemischte Backend-Kriterien bleiben offen. Status bis zur ausdrücklichen Nutzerabnahme In Progress.

Root adopted readonly current proposal /tmp/dispatch-52-current-native-source-plan.md SHA edbfd79edfe305762f69270cd9efc77595ea601f08b79c6afa0ad7bd1d17762a after full report/semantic receipt;24 selected unowned source/doc/human before-after exact and6 private hashes verified. Existing concrete X native checkpoint/FirstWrite/unknown/read-only reconciliation/ownmetrics transport reuse; single explicit capability contract, no factory/registry/duplicate variant state. Independent existing Drafts with native original Idea provenance first; grouping metadata/index only when real caller needs it, no account-bound candidate/source laundering. Remote post deletion not implemented, explicitly unsupported in Dispatch; no platform maximum/access promises or extra channel selected. Final68.1 ancestry needs fresh reconciliation; moving observations after-only, no334freeze/new tests/source release/backendProvider/manual acceptance. AllAC/DoD open;53.1 already asked platform unanswered, not defaulted.
<!-- SECTION:NOTES:END -->
